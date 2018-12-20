'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
const { getTrackAudioAnalysis, putTrackAudioFeature, putTrackAudioAnalysisForDataset, getTrackAudioFeatures, 
    getTrackInfoExtra} = require('../controllers/spotify');
const { getChartDateList, getAudioAnalysisKey, getGenreName, convertDateToString, shuffle } = require('../helpers/utils');

//const { runData } = require('../helpers/data.js');
var weka = require('../helpers/weka-lib.js');
var Arff = require('arff-utils');
var arffReadFile = require('arff');
var stream = require('fs');

module.exports = {
    buildModel: buildModel,
    saveArffData: saveArffData,
    predict: predict,
    predictModel: predictModel,
    putDistinctKeyToObject: putDistinctKeyToObject,
    buildGenreModel: buildGenreModel,
    predictGenre: predictGenre,
    getTrackGenre: getTrackGenre,
    getAllTrack: getAllTrack
};


function buildModel(req, res) {
    var startDate = req.swagger.params.startDate.value;
    var endDate = req.swagger.params.endDate.value;
    var genreType = req.swagger.params.genreType.value;
    createModel(startDate, endDate, genreType);
    res.json({ status: 200, message: "create afff success" });
}

const pathArff = 'api/public/arff/';
const arffType = ".arff";
const pathModel = 'api/public/model/';
const modelType = ".model";
var BayesClassifier = {
    'classifier': 'weka.classifiers.bayes.NaiveBayes',
    'params': ''
};

var LogisticClassifier = {
    'classifier': 'weka.classifiers.functions.Logistic',
    'params': ''
};


async function createModel(startDate, endDate, genreType) {
    var data = await getDataForBuildModel(startDate, endDate, genreType);
    var trainSet = data
    //data = shuffle(data);
    // var lengthTrainningSet = parseInt(data.length * 0.8);
    // var trainSet = data.splice(0, lengthTrainningSet - 1);
    // var testSet =  data;

    var filename = getGenreName(genreType) + "_" + convertDateToString(startDate) + "_" + convertDateToString(endDate);
    var filenameData = pathArff + filename + arffType;
    console.log("file name data: " + filenameData);
    createArff(trainSet, filenameData);

    // var filenameTest = filename + '_test';
    // var filenameDataTest = pathArff + filenameTest + arffType;
    // console.log("file name data test: " +testSet.length +" "+ filenameDataTest);
    // createArff(testSet, filenameDataTest);
    var modelName = pathModel + filename + modelType;
    console.log("model name" + modelName);
    weka.classify(filenameData, modelName, BayesClassifier, function (err, result) {
        if (err) {
            console.log("Build model error" + err);
        }
        else {
            console.log("Build model success" + result);
            putSync(`model.${genreType}`, modelName);
        }
    });
}
function createArff(data, filename) {
    var arff = new Arff.ArffWriter(filename, Arff.MODE_OBJECT);
    var attributeList = getAudioAnalysisKey();
    for (var attributeName of attributeList) {
        if (attributeName == 'mode') {
            arff.addNominalAttribute("mode", [0,1]);
            continue;
        }
        if (attributeName == 'key') {
            arff.addNominalAttribute("key", [0,1,2,3,4,5,6,7,8,9,10,11]);
            continue;
        }
        if (attributeName == 'time_signature') {
            arff.addNominalAttribute("time_signature", [0,1,2,3,4,5]);
            continue;
        }
        arff.addNumericAttribute(attributeName);
    }
    //arff.addStringAttribute('id');
    arff.addNominalAttribute("hit", ["hit", "non-hit"]);
    //arff.addNumericAttribute("position");
    for (var row of data) {
        arff.addData(row);
    }
    arff.writeToFile(filename);
    //console.log("Write arff file: ", filename);
}

async function getDataForBuildModel(startDate, endDate, genreType) {
    var trackListObject = await getChartDistinctTrackList(startDate, endDate, genreType);
    if (trackListObject == undefined) {
        console.log("Get chart distinct track list error");
    }
    //console.log("Chart distinct track list:", Object.keys(trackListObject).length);
    trackListObject = labelTrackList(trackListObject);
    //console.log("Labeled track list:", Object.keys(trackListObject).length);
    var data = [];
    for (var trackId of Object.keys(trackListObject)) {
        var track = new Object;
        track = await getTrackAudioAnalysis(trackId);
        if (track == undefined || track == '') {
            continue;
        }
        //track.id = trackId;
        // track = await getTrackAudioFeatures(trackId);
        // if (track == undefined) {
        //     continue;
        // }
        // track = convertAudioFeatures(track);
        // if (trackListObject[trackId] > 40) {
        //     continue;
        // }
        track.hit = trackListObject[trackId];
        data.push(track);
    }
    console.log("Data list:", data.length);
    return data;
}

const hitIndex = 10;
const nonhitIndex = 30;
function labelTrackList(trackList) {
    var newTrackList = new Object;
    for (var trackId of Object.keys(trackList)) {
        var position = trackList[trackId];
        if (position <= hitIndex) {
            newTrackList[trackId] = 'hit';
        }
        // if (hitIndex < position  && position < nonhitIndex) {
        //     newTrackList[trackId] = 'potential';
        // }
        if (nonhitIndex <= position) {
            newTrackList[trackId] = 'non-hit';
        }
    }
    return newTrackList;
}


const outerInterval = 180;
async function getChartDistinctTrackList(startDate, endDate, genreType) {
    var startOuterDate = new Date(startDate)
    var endOuterDate = new Date(endDate)
    startDate = new Date()
    endDate = new Date()
    startDate = new Date(startDate.setTime(startOuterDate.getTime() + outerInterval * 86400000));
    endDate = new Date(endDate.setTime(endOuterDate.getTime() - outerInterval * 86400000));
    console.log(startOuterDate, startDate, endDate, endOuterDate)
    var dateList = getChartDateList(startDate, endDate);
    var distinctTracks = new Object;
    for (var date of dateList) {
        var date_str = date.day + date.month + date.year;
        //console.log("Chart tracks", date_str, genreType);
        var chartTracks = await getTrackListForChart(date_str, genreType);
        //console.log("Chart tracks", date_str, chartTracks);
        if (chartTracks == undefined) {
            continue;
        }
        distinctTracks = putDistinctKeyToObject(distinctTracks, chartTracks);
    }

     var dateListBefore = getChartDateList(startOuterDate, startDate);
    for (var date of dateListBefore) {
        var date_str = date.day + date.month + date.year;
        //console.log("Chart tracks", date_str, genreType);
        var chartTracks = await getTrackListForChart(date_str, genreType);
        //console.log("Chart tracks", date_str, chartTracks);
        if (chartTracks == undefined) {
            continue;
        }
        distinctTracks = putDistinctKeyToObjectOuter(distinctTracks, chartTracks);
    }

    var dateListAfter = getChartDateList(endDate, endOuterDate);
    for (var date of dateListAfter) {
        var date_str = date.day + date.month + date.year;
        //console.log("Chart tracks", date_str, genreType);
        var chartTracks = await getTrackListForChart(date_str, genreType);
        //console.log("Chart tracks", date_str, chartTracks);
        if (chartTracks == undefined) {
            continue;
        }
        distinctTracks = putDistinctKeyToObjectOuter(distinctTracks, chartTracks);
    }

    return distinctTracks;
    //console.log("Distinct chart tracks: ", distinctTracks);
}

// Add distinct key from object2 to object1
function putDistinctKeyToObject(object1, object2) {
    //console.log('put dinstinct key');
    for (var key of Object.keys(object2)) {
        // Object has no key
        if (object1[key] == undefined) {
            object1[key] = object2[key];
        }
        // Object has key
        else {
            // If new value smaller old value
            if (object1[key] > object2[key]) {
                object1[key] = object2[key];
            }
        }
    }
    return object1;
}


// Add distinct key from object2 to object1
function putDistinctKeyToObjectOuter(object1, object2) {
    //console.log('put dinstinct key');
    for (var key of Object.keys(object2)) {
        // Object has no key
        if (object1[key] == undefined) {
           continue
        }
        // Object has key
        else {
            // If new value smaller old value
            if (object1[key] > object2[key]) {
                object1[key] = object2[key];
            }
        }
    }
    return object1;
}

function saveArffData() {
    var filenameList = [pathArff + 'dance_data.arff',
    pathArff + 'rock_data.arff',
    pathArff + 'rb_data.arff'];

    for (var filename of filenameList) {
        readArff(filename);
    }
}

function readArff(filename) {
    var readFile = stream.readFile;

    readFile(filename, 'utf8', function (error, content) {
        if (error) {
            return console.error(error); 
        }
        var data = arffReadFile.parse(content).data;
        console.log("Row : ", data.length);
        for (var row of data) {
            putTrackAudioAnalysisForDataset(row);
            putTrackAudioFeature(row);
        }
        console.log("Done save data from "+ filename +" file to database");
    });
}

function predict(req, res) {
    var trackid = req.swagger.params.trackid.value;
    predictModel(trackid);
}
var fileNameTest = 'api/public/arff/test.arff';
async function predictModel(trackid) {
    //  var genreType = await getGenreType(trackid);
    var genreType = await getTrackGenre(trackid);
    var modelName = await getModelName(genreType);
    if (modelName == undefined ) {
        console.log("Genre type is invalid");
        return;
    }
    var trackAnalysis = new Object;
    trackAnalysis = await getTrackAudioAnalysis(trackid);
    if (trackAnalysis == undefined || trackAnalysis == '') {
        console.log("Track analysis is not found");
        return;
    }
    trackAnalysis.hit ='?';
    var trackData = [];
    trackData.push(trackAnalysis);
    await createArff(trackData, fileNameTest);
    var result = await predictTrack(modelName, fileNameTest, BayesClassifier);
    result.prediction = parseFloat(result.prediction);
    if (result.predicted == "hit") {
        var prediction = new Object;
        prediction.hit = result.prediction;
        prediction.nonhit = parseFloat((1 -result.prediction).toFixed(4));
    }

    if (result.predicted == "non-hit") {
        var prediction = new Object;
        prediction.nonhit = result.prediction;
        prediction.hit = parseFloat((1 - result.prediction).toFixed(4));
    }
    return prediction;
}
var fileNameGenreTest = 'api/public/arff/genre_test.arff';
async function predictGenre(trackid) {
    //  var genreType = await getGenreType(trackid);
    var modelName = await getModelName("genre");
    if (modelName == undefined ) {
        console.log("Genre model is not found");
        return;
    }
    var trackFeatures;
    trackFeatures = await getTrackAudioFeatures(trackid);
        if (trackFeatures == undefined) {
            return;
        }
        trackFeatures = convertAudioFeatures(trackFeatures);
    trackFeatures.genre ='?';
    var trackData = [];
    trackData.push(trackFeatures);
    await createArffGenreClassification(trackData, fileNameGenreTest);
    var result = await predictTrack(modelName, fileNameGenreTest, LogisticClassifier);
    return result.predicted;
}

function predictTrack(modelName, fileNameTest, classifier) {
    return new Promise((resolve, reject) => {
        console.log("Predict:" , modelName, fileNameTest);
        weka.predict(modelName, fileNameTest, classifier, function (err, result) {
            if (err) {
                console.log("Predict error" + err);
                resolve(undefined);
            }
            else {
                console.log("Predict success: " + result.predicted, result.prediction);  
                resolve(result);
            }
        });
    });
}

// get model name
function getModelName(genreType) {
    return new Promise((resolve, reject) => {
        get(`model.${genreType}`, (err, value) => {
            if (!err) {
                console.log('get model name:', value);
                resolve(value);
            }
            else {
                //console.log('model name not found');
                resolve(undefined);
            }
        });
    });
}


function buildGenreModel() {
    createModelClassifyGenre();
}

async function createModelClassifyGenre() {
    var data = await getDataForBuildModelClassifyGenre();
    var filename = 'genre_classification';
    var filenameData = pathArff + filename + arffType;
    console.log("file name data" + filenameData);
    createArffGenreClassification(data, filenameData);
    var modelName = pathModel + filename + modelType;
    console.log("model name:  " + modelName);

    weka.classify(filenameData, modelName, LogisticClassifier, function (err, result) {
        if (err) {
            console.log("Build genre model error" + err);
        }
        else {
            console.log("Build genre model success" + result);
            putSync(`model.genre`, modelName);
        }
    });
}

async function getDataForBuildModelClassifyGenre() {
    var trackList = await getAllTrack();
    if (trackList == undefined) {
        console.log("Get all track error");
    }
    console.log("Chart all track list:", trackList.length);
    var data = [];
    for (var trackId of trackList) {
        var track;
        var genre = await getTrackInfoExtra(trackId, 'genre');
        if (genre != 1 && genre != 2 && genre != 3) {
            continue;
        }
        track = await getTrackAudioFeatures(trackId);
        if (track == undefined) {
            continue;
        }
        track = convertAudioFeatures(track);
        track.genre = genre;
        data.push(track);
    }
    console.log("Data list:", data.length);
    return data;
}

function getAllTrack() {
    return new Promise((resolve, reject) => {
        get(`track.all`, (err, value) => {
            if (!err) {
                var object = JSON.parse(value);
                var ids = [];
                for (var k in object) {
                    ids.push(k);
                }
                resolve(ids);
            }
            else {
                resolve(undefined);
            }
        });
    });
}

function createArffGenreClassification(data, filename) {
    var arff = new Arff.ArffWriter(filename, Arff.MODE_OBJECT);
    for (var attributeName of audioFeatureList) {
        if (attributeName == 'mode') {
            arff.addNominalAttribute("mode", [0,1]);
            continue;
        }
        if (attributeName == 'key') {
            arff.addNominalAttribute("key", [0,1,2,3,4,5,6,7,8,9,10,11]);
            continue;
        }
        if (attributeName == 'time_signature') {
            arff.addNominalAttribute("time_signature", [0,1,2,3,4,5]);
            continue;
        }
        arff.addNumericAttribute(attributeName);
    }
    arff.addNominalAttribute("genre", [1, 2,3]);
    for (var row of data) {
        arff.addData(row);
    }
    arff.writeToFile(filename);
    console.log("Write arff file: ", filename);
}

function convertAudioFeatures(featuresString) {
    if (featuresString == undefined) {
        return;
    }
    var features = featuresString.split(";");
    if (features.length < 13) {
        return;
    }
    var featureObject = new Object;
    featureObject.speechiness = parseFloat(features[0]);
    featureObject.acousticness = parseFloat(features[1]);
    featureObject.instrumentalness = parseFloat(features[2]);
    featureObject.liveness = parseFloat(features[3]);
    featureObject.valence = parseFloat(features[4]);
    featureObject.duration_ms = parseFloat(features[5]);
    featureObject.tempo = parseFloat(features[6]);
    featureObject.time_signature = features[7];
    featureObject.mode = features[8];
    featureObject.key = features[9];
    featureObject.loudness = parseFloat(features[10]);
    featureObject.danceability = parseFloat(features[11]);
    featureObject.energy = parseFloat(features[12]);
    //console.log("Feature object", featureObject);
    return featureObject;
}
async function getTrackListForChart(date, genreType) {
    //console.log("Start Get track list for chart", date, genreType);
    return new Promise((resolve, reject) => {
        //console.log("Get track list for chart", date, genreType);
        var chartTracks = new Object;
        get(`chart.${date}.${genreType}`, async (err, value) => {
            if (!err) {
                var trackIds = value.split(";");
                for (var i = 0; i < trackIds.length; i++) {
                    var trackId = trackIds[i];
                    if (trackId == '') {
                        continue;
                    }
                    chartTracks[trackId] = i + 1;
                }
                resolve(chartTracks);
            }
            else {
                console.log('Get track list error', date);
                resolve(undefined);
            }
        });
    });
}
async function getTrackGenre(trackId) {
    var genre = await getTrackGenreFromDatabase(trackId);
    if (genre != undefined && genre != '') {
        return genre
    }
    genre = await predictGenre(trackId);
    console.log("Genre ", trackId, genre);
    if (genre == undefined) {
        return
    }
    putSync(`track.${trackId}.genre`, parseInt(genre));
    return genre
}

function getTrackGenreFromDatabase(trackId) {
    //console.log('get track genre ', trackId);
    return new Promise((resolve, reject) => {
        get(`track.${trackId}.genre`, (err, value) => {
            if (!err) {
                resolve(value);
            }
            else {
                resolve(undefined)
            }
        });
    });
}
// used for get random audio feature chart for home page
const audioFeatureList = ['speechiness',
    'acousticness',
    'instrumentalness',
    'liveness',
    'valence',
    'duration_ms',
    'tempo',
    'time_signature',
    'mode',
    'key',
    'loudness',
    'danceability',
    'energy'];


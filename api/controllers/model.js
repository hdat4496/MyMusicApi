'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
const { getTrackAudioAnalysis, putTrackAudioFeature, putTrackAudioAnalysisForDataset } = require('../controllers/spotify');
const { getTrackListForChart } = require('../controllers/chart');
const { getChartDateList, getAudioAnalysisKey, getGenreName, convertDateToString } = require('../helpers/utils');

//const { runData } = require('../helpers/data.js');
var weka = require('../helpers/weka-lib.js');
var Arff = require('arff-utils');
var arffReadFile = require('arff');
var stream = require('fs');

module.exports = {
    buildModel: buildModel,
    saveArffData: saveArffData,
    predict: predict
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
const danceType = 1;
const rockType = 2;
const rbType = 3
var danceModelName;
var rockModelName;
var rbModelName;
var classifier = {
    'classifier': 'weka.classifiers.bayes.NaiveBayes',
    'params': ''
};

async function createModel(startDate, endDate, genreType) {
    var data = await getDataForBuildModel(startDate, endDate, genreType);
    var filename = getGenreName(genreType) + "_" + convertDateToString(startDate) + "_" + convertDateToString(endDate);
    var filenameData = pathArff + filename + arffType;
    console.log("file name data" + filenameData);
    createArff(data, filenameData);
    var modelName = pathModel + filename + modelType;
    console.log("model name" + modelName);
    weka.classify(filenameData, modelName, classifier, function (err, result) {
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
        arff.addNumericAttribute(attributeName);
    }
    arff.addNominalAttribute("hit", ["hit", "non-hit"]);
    for (var row of data) {
        arff.addData(row);
    }
    arff.writeToFile(filename);
    console.log("Write arff file: ", filename);
}

async function getDataForBuildModel(startDate, endDate, genreType) {
    var trackListObject = await getChartDistinctTrackList(startDate, endDate, genreType);
    if (trackListObject == undefined) {
        console.log("Get chart distinct track list error");
    }
    console.log("Chart distinct track list:", Object.keys(trackListObject).length);
    trackListObject = labelTrackList(trackListObject);
    console.log("Labeled track list:", Object.keys(trackListObject).length);
    var data = [];
    for (var trackId of Object.keys(trackListObject)) {
        var track = new Object;
        track = await getTrackAudioAnalysis(trackId);
        if (track == undefined) {
            continue;
        }
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
        if (nonhitIndex <= position) {
            newTrackList[trackId] = 'non-hit';
        }
    }
    return newTrackList;
}

async function getChartDistinctTrackList(startDate, endDate, genreType) {
    var dateList = getChartDateList(startDate, endDate);
    var distinctTracks = new Object;
    for (var date of dateList) {
        var date_str = date.day + date.month + date.year;
        var chartTracks = await getTrackListForChart(date_str, genreType);
        //console.log("Chart tracks", date_str, chartTracks);
        if (chartTracks == undefined) {
            continue;
        }
        distinctTracks = putDistinctKeyToObject(distinctTracks, chartTracks);
    }
    return distinctTracks;
    //console.log("Distinct chart tracks: ", distinctTracks);
}

// Add distinct key from object2 to object1
function putDistinctKeyToObject(object1, object2) {
    console.log('put dinstinct key');
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
    var genreType = 1;
    var modelName = await getModelName(genreType);
    if (modelName == undefined ) {
        console.log("Genre type is invalid");
        return;
    }
    var trackAnalysis = new Object;
    trackAnalysis = await getTrackAudioAnalysis(trackid);
    if (trackAnalysis == undefined) {
        console.log("Track analysis is not found");
        return;
    }
    trackAnalysis.hit ='hit';
    var trackData = [];
    trackData.push(trackAnalysis);
    await createArff(trackData, fileNameTest);
    console.log(modelName, fileNameTest);
    weka.predict(modelName, fileNameTest, classifier, function (err, result) {
        if (err) {
            console.log("Predict hit error" + err);
        }
        else {
            console.log("Predict hit success: " + result.predicted, result.prediction);
        }
    });

}

// get model name
function getModelName(genreType) {
    return new Promise((resolve, reject) => {
        get(`model.${genreType}`, (err, value) => {
            if (!err) {
                //console.log('get model name:', value);
                resolve(value);
            }
            else {
                //console.log('model name not found');
                resolve(undefined);
            }
        });
    });
}
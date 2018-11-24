'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
const { getTrackAudioAnalysis } = require('../controllers/spotify');
const { getChartDateList, getAudioAnalysisKey, getGenreName, convertDateToString } = require('../helpers/utils');
//const { runData } = require('../helpers/data.js');
var weka = require('../helpers/weka-lib.js');
var Arff = require('arff-utils');

module.exports = {
    buildModel: buildModel
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
async function createModel(startDate, endDate, genreType) {
    var data = await getDataForBuildModel(startDate, endDate, genreType);
    var filename = getGenreName(genreType) + "_" + convertDateToString(startDate) + "_" + convertDateToString(endDate);
    var filenameData = pathArff + filename + arffType;
    console.log("file name data" + filenameData);
    createArff(data, filenameData);
    var modelName = pathModel + filename + modelType;
    var classifier = {
        'classifier': 'weka.classifiers.bayes.NaiveBayes',
        'params': ''
    };
    console.log("model name" + modelName);
    weka.classify(filenameData, modelName, classifier, function (err, result) {
        if (err) {
            console.log("Build model error" + err);
        }
        else {
            console.log("Build model success" + result);
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

async function getTrackListForChart(date, genreType) {
    var chartTracks = new Object;
    return new Promise((resolve, reject) => {
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

'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
const { getTrackAudioFeatures} = require('../controllers/spotify')
const { convertDate, getChartDateList, convertStringToDate } = require('../helpers/utils');
const { putDistinctKeyToObject } = require('../controllers/model');
var Statistics = require("simple-statistics");
//const { runData } = require('../helpers/data.js');


module.exports = {
    putChartData: putChartData,
    getTrackListForChart: getTrackListForChart,
    buildChartFeatures: buildChartFeatures,
    putChartAnalysis: putChartAnalysis,
    getLastedChartTracks: getLastedChartTracks
};

function putChartData(genre, date, trackInfoList) {
    console.log("Put chart data: ", genre, date);
    var dateFormat = convertDate(date);
    //console.log("Date format", dateFormat);
    var dateKey = dateFormat.day + dateFormat.month + dateFormat.year;
    var dateValue = dateFormat.day + '/' + dateFormat.month + '/' + dateFormat.year;
    putSync(`chart.${dateKey}.${genre}.date`, dateValue);
    putSync(`chart.${dateKey}.${genre}.numbertrack`, trackInfoList.length);

    var trackIdChart = [];
    for (var trackInfo of trackInfoList) {
        var position = trackInfo.position;
        if (trackInfo.trackId != undefined) {
            trackIdChart[position - 1] = trackInfo.trackId;
        }
        else {
            trackIdChart[position - 1] = '';
        }
    }
    
    var trackIdsValue = trackIdChart.join(";")
    //console.log('Chart track ids:', trackIdsValue);
    putSync(`chart.${dateKey}.${genre}`, trackIdsValue);

    get(`chart.${genre}.lasted`, async (err, value) => {
        if (!err) {
            var lastedDate = convertStringToDate(value);
            var chartDate = convertStringToDate(dateValue);
            if (lastedDate < chartDate) {
                putSync(`chart.${genre}.lasted`, dateValue);
            }
        }
        else if (err.notFound){
            putSync(`chart.${genre}.lasted`, dateValue);
        }
    });
}

function buildChartFeatures(req, res) {
    var startDate = req.swagger.params.startDate.value;
    var endDate = req.swagger.params.endDate.value;
    var genreType = req.swagger.params.genreType.value; 

    var dateList = getChartDateList(startDate, endDate);
    for (var date of dateList) {
        var date_str = date.day + date.month + date.year;
        putChartAnalysis(date_str, genreType)
    }
}

async function putChartAnalysis(date_str, genreType) {
    console.log("Put chart analysis ", date_str);
    var chartTrackIds = await getTrackListForChart(date_str, genreType);
    if (chartTrackIds == undefined) {
        return;
    }
    var trackFeaturesList = await getChartTrackAudioFeatures(chartTrackIds);
    if (trackFeaturesList == undefined) {
        return;
    }
    //console.log("Track feature list: ",trackFeaturesList );
    var chartAnalysis =  calculateChartFeatures(trackFeaturesList);
    //console.log("Chart analysis:",date_str, chartAnalysis);
    if (chartAnalysis == undefined) {
        return;
    }
    putSync(`chart.${date_str}.${genreType}.analysis`, JSON.stringify(chartAnalysis));
}

async function getChartTrackAudioFeatures(trackIds) {
    var trackFeaturesList = [];
    for (var trackId of Object.keys(trackIds)) {
        var trackFeatures = await getTrackAudioFeatures(trackId);
        if (trackFeatures != undefined) {
            trackFeaturesList.push(trackFeatures);
        }
    }
    return trackFeaturesList;
}
 

function calculateChartFeatures(trackFeaturesList) {
    var chartAnalysis = new Object;
    // speechiness;acousticness;instrumentalness;liveness;valence;duration_ms;tempo;time_signature;mode;key;loudness;danceability;energy 
    var speechiness = [];
    var acousticness = [];
    var instrumentalness = [];
    var liveness = [];
    var valence = [];
    var duration_ms = [];
    var tempo = [];
    var time_signature = []; 
    var mode = [];
    var key = [];
    var loudness = [];
    var danceability = []; 
    var energy = []; 
    for (var trackFeature of trackFeaturesList) {
        var features = trackFeature.split(";");
        speechiness.push(parseFloat(features[0]));
        acousticness.push(parseFloat(features[1]));
        instrumentalness.push(parseFloat(features[2]));
        liveness.push(parseFloat(features[3]));
        valence.push(parseFloat(features[4]));
        duration_ms.push(parseFloat(features[5]));
        tempo.push(parseFloat(features[6]));
        time_signature.push(parseFloat(features[7]));
        mode.push(parseFloat(features[8]));
        key.push(parseFloat(features[9]));
        loudness.push(parseFloat(features[10]));
        danceability.push(parseFloat(features[11]));
        energy.push(parseFloat(features[12]));
    }
    chartAnalysis.speechiness = Statistics.average(speechiness).toFixed(4);
    chartAnalysis.acousticness = Statistics.average(acousticness).toFixed(4);
    chartAnalysis.instrumentalness = Statistics.average(instrumentalness).toFixed(4);
    chartAnalysis.liveness = Statistics.average(liveness).toFixed(4);
    chartAnalysis.valence = Statistics.average(valence).toFixed(4);
    chartAnalysis.duration_ms = Statistics.average(duration_ms).toFixed(4);
    chartAnalysis.tempo = Statistics.average(tempo).toFixed(4);

     //Mode 
     var timeSignatureObject = new Object;
     for (var beatType of time_signature) {
         if (timeSignatureObject[beatType] == undefined) {
            timeSignatureObject[beatType] = 1;
         }
         else {
             var value = timeSignatureObject[beatType];
             timeSignatureObject[beatType] = parseInt(value) + 1;
         }
     } 
     chartAnalysis.time_signature = timeSignatureObject;

    //Mode 
    var modeObject = new Object;
    for (var modeType of mode) {
        if (modeObject[modeType] == undefined) {
            modeObject[modeType] = 1;
        }
        else {
            var value = modeObject[modeType];
            modeObject[modeType] = parseInt(value) + 1;
        }
    } 
    chartAnalysis.mode = modeObject;

    // key
    var keyObject = new Object;
    for (var keyType of key) {
        if (keyObject[keyType] == undefined) {
            keyObject[keyType] = 1;
        }
        else {
            var value = keyObject[keyType];
            keyObject[keyType] = parseInt(value) + 1;
        }
    }
    chartAnalysis.key = keyObject;
    chartAnalysis.loudness = Statistics.average(loudness).toFixed(4);
    chartAnalysis.danceability = Statistics.average(danceability).toFixed(4);
    chartAnalysis.energy = Statistics.average(energy).toFixed(4);
    return chartAnalysis;
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

async function getLastedChartTracks() {
    var genreTypeList = [1,2,3];
    var lastedChartDate = [];
    for (var genreType of genreTypeList) {
        var date = await getChartLasted(genreType);
        if (date == undefined) {
            continue;
        }
        var chart = {
            genreType: genreType,
            date: date
        }
        lastedChartDate.push(chart);
    }
    
    var distinctTracks = new Object;
    for (var chart of lastedChartDate) {
        var dateArray = chart.date.split("/");
        var date_str = dateArray.join("");
        var chartTrackObject = await getTrackListForChart(date_str, chart.genreType);
        if (chartTrackObject == undefined) {
            continue;
        }
        distinctTracks = putDistinctKeyToObject(distinctTracks, chartTrackObject);
    }

    var trackIds = [];

    for (var trackId of Object.keys(distinctTracks)) {
        trackIds.push(trackId);
    }

    return trackIds;
}

async function getChartLasted(genre) {
    return new Promise((resolve, reject) => {
        get(`chart.${genre}.lasted`, (err, value) => {
            if (!err) {
                resolve(value);
            }
            else {
                resolve(undefined);
            }
        });
    });
}
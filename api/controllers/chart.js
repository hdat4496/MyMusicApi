'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
const { getTrackAudioFeatures} = require('../controllers/spotify')
const { convertDate, getChartDateList, convertStringToDate, getRandomInt, getGenreTypeList, getGenreName } = require('../helpers/utils');
const { putDistinctKeyToObject } = require('../controllers/model');
var Statistics = require("simple-statistics");
//const { runData } = require('../helpers/data.js');


module.exports = {
    putChartData: putChartData,
    getTrackListForChart: getTrackListForChart,
    buildChartFeatures: buildChartFeatures,
    putChartAnalysis: putChartAnalysis,
    getLastedChartTracks: getLastedChartTracks,
    getChartReport: getChartReport,
    getChartReportHomePage: getChartReportHomePage
};

function putChartData(genre, date, trackInfoList) {
    if (trackInfoList == undefined || genre == undefined || date == undefined) {
        return;
    }
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
            trackFeatures = trackId + ';' + trackFeatures;
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
    var timeSignatureObject = new Object;
    var modeObject = new Object;
    var keyObject = new Object;
    for (var trackFeature of trackFeaturesList) {
        var features = trackFeature.split(";");
        var trackId = features[0];
        speechiness.push(parseFloat(features[1]));
        acousticness.push(parseFloat(features[2]));
        instrumentalness.push(parseFloat(features[3]));
        liveness.push(parseFloat(features[4]));
        valence.push(parseFloat(features[5]));
        duration_ms.push(parseFloat(features[6]));
        tempo.push(parseFloat(features[7]));

        // time_signature
        var time_signature_key = features[8];
        var time_signature_value = timeSignatureObject[time_signature_key];
        timeSignatureObject[time_signature_key] = (time_signature_value == undefined) ? trackId : time_signature_value + ';' + trackId;

        // mode
        var mode_key = features[9];
        var mode_value = modeObject[mode_key];
        modeObject[mode_key] = (mode_value == undefined) ? trackId : mode_value + ';' + trackId;

        // key
        var key_key = features[10];
        var key_value = keyObject[key_key];
        keyObject[key_key] = (key_value == undefined) ? trackId : key_value + ';' + trackId;
       
        loudness.push(parseFloat(features[11]));
        danceability.push(parseFloat(features[12]));
        energy.push(parseFloat(features[13]));

    }
    chartAnalysis.speechiness = Statistics.average(speechiness).toFixed(4);
    chartAnalysis.acousticness = Statistics.average(acousticness).toFixed(4);
    chartAnalysis.instrumentalness = Statistics.average(instrumentalness).toFixed(4);
    chartAnalysis.liveness = Statistics.average(liveness).toFixed(4);
    chartAnalysis.valence = Statistics.average(valence).toFixed(4);
    chartAnalysis.duration_ms = Statistics.average(duration_ms).toFixed(4);
    chartAnalysis.tempo = Statistics.average(tempo).toFixed(4);
    chartAnalysis.time_signature = timeSignatureObject;
    chartAnalysis.mode = modeObject;
    chartAnalysis.key = keyObject;
    chartAnalysis.loudness = Statistics.average(loudness).toFixed(4);
    chartAnalysis.danceability = Statistics.average(danceability).toFixed(4);
    chartAnalysis.energy = Statistics.average(energy).toFixed(4);
    return chartAnalysis;
}

async function getTrackListForChart(date, genreType) {
    console.log("Start Get track list for chart", date, genreType);
    return new Promise((resolve, reject) => {
        console.log("Get track list for chart", date, genreType);
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

function getChartLasted(genre) {
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
function getChartReport(req, res) {
    var startDate = req.swagger.params.startDate.value;
    var endDate = req.swagger.params.endDate.value;
    var genreType = req.swagger.params.genreType.value;
    getReport(startDate, endDate, genreType)
    .then(function(analysisObject) {
        if (analysisObject == undefined) {
            res.json({ status: 400, value: "get chart track error" });
        }
        else {
            res.json({ status: 200, value: analysisObject});
        }
    })
    .catch(e=>{
        res.json({ status: 400, value: e });
    });
}
const daysIntervalReport = 60;
function getChartReportHomePage(req, res) {
    var endDate = new Date();
    var now = new Date();
    var startDate = new Date(now.setTime(now.getTime() - daysIntervalReport * 86400000));
    var genreTypeList = getGenreTypeList();
    var genreType = getRandomInt(1, genreTypeList.length - 1);
    var featureType = getRandomInt(0, audioFeatureList.length -1);
    console.log("get chart track for home page", startDate, endDate, genreType, featureType);
    getReportHomePage(startDate, endDate, genreType, featureType)
    .then(function(analysisObject) {
        if (analysisObject == undefined) {
            res.json({ status: 400, value: "get chart track for home page error" });
        }
        else {
            var result = new Object;
            result.genreName = getGenreName(genreType);
            result.featureName = getFeatureName(featureType);
            result.data = analysisObject;
            console.log(result);
            res.json({ status: 200, value: result});
        }
    })
    .catch(e=>{
        res.json({ status: 400, value: e });
    });
}

function getReport(startDate, endDate, genreType) {
    return new Promise(async (resolve, reject) => {
    var dateList = getChartDateList(startDate, endDate);
    var speechiness = new Object;
    var acousticness = new Object;
    var instrumentalness = new Object;
    var liveness = new Object;
    var valence = new Object;
    var duration_ms = new Object;
    var tempo = new Object;
    var time_signature = new Object;
    var mode = new Object;
    var key = new Object;
    var loudness = new Object;
    var danceability = new Object; 
    var energy = new Object;

    for (var date of dateList) {
        var date_str = date.day + date.month + date.year;
        var chartAnalysis = await getChartAnalysis(date_str, genreType);
        if (chartAnalysis == undefined) {
            continue;
        }
        var dateKey = date.day + '/' + date.month + '/' + date.year;
        speechiness[dateKey] = parseFloat(chartAnalysis["speechiness"]);
        acousticness[dateKey] = parseFloat(chartAnalysis["acousticness"]);
        instrumentalness[dateKey] = parseFloat(chartAnalysis["instrumentalness"]);
        liveness[dateKey] = parseFloat(chartAnalysis["liveness"]);
        valence[dateKey] = parseFloat(chartAnalysis["valence"]);
        duration_ms[dateKey] = parseFloat(chartAnalysis["duration_ms"]);
        tempo[dateKey] = parseFloat(chartAnalysis["tempo"]);
        time_signature = addElementToObject(time_signature, chartAnalysis["time_signature"]);
        mode = addElementToObject(mode, chartAnalysis["mode"]);
        key = addElementToObject(key, chartAnalysis["key"]);
        loudness[dateKey] = parseFloat(chartAnalysis["loudness"]);
        danceability[dateKey] = parseFloat(chartAnalysis["danceability"]);
        energy[dateKey] = parseFloat(chartAnalysis["energy"]);
    }

    var analysisObject = new Object;
    analysisObject.speechiness = speechiness;
    analysisObject.acousticness = acousticness;
    analysisObject.instrumentalness = instrumentalness;
    analysisObject.liveness = liveness;
    analysisObject.valence = valence;
    analysisObject.duration_ms = duration_ms;
    analysisObject.tempo = tempo;
    analysisObject.time_signature = calculateNumberPerType(time_signature);
    analysisObject.mode = calculateNumberPerType(mode);
    analysisObject.key =  calculateNumberPerType(key);
    analysisObject.loudness = loudness;
    analysisObject.danceability = danceability;
    analysisObject.energy = energy;
    //console.log("Report chart:", analysisObject);
    resolve(analysisObject);
});
}

function getReportHomePage(startDate, endDate, genreType, featureType) {
    return new Promise(async (resolve, reject) => {
    var dateList = getChartDateList(startDate, endDate);
    var feature = new Object;
    var featureName = getFeatureName(featureType);
    
    for (var date of dateList) {
        var date_str = date.day + date.month + date.year;
        var chartAnalysis = await getChartAnalysis(date_str, genreType);
        if (chartAnalysis == undefined) {
            continue;
        }
        var dateKey = date.day + '/' + date.month + '/' + date.year;
        feature[dateKey] = parseFloat(chartAnalysis[featureName]);
    }
    resolve(feature);
});
}
const roundNumber = 4;
// function formatNumber(value) {
//     return parseFloat(value.toFixed(roundNumber));
// }

async function getChartAnalysis(date, genreType) {
    return new Promise((resolve, reject) => {
        get(`chart.${date}.${genreType}.analysis`, (err, value) => {
            if (!err) {
                var chartAnalysis = new Object;
                chartAnalysis = JSON.parse(value);
                resolve(chartAnalysis);
            }
            else {
                resolve(undefined);
            }
        });
    });
}
function addElementToObject(origin_object, new_object ) {
    for (var key of Object.keys(new_object)) {
        var value = origin_object[key];
        origin_object[key] = (value == undefined) ? new_object[key] : value + ";" + new_object[key];
    }
    return origin_object;
}
function calculateNumberPerType(origin_object) {
    var new_object = new Object;
    for (var key of Object.keys(origin_object)) {
        var format_key = key;
        var listTrack = origin_object[key].split(";");
        listTrack = removeDuplicateUsingSet(listTrack);
        new_object[format_key] = listTrack.length;
    }
    return new_object;
}

function removeDuplicateUsingSet(arr){
    var unique_array = Array.from(new Set(arr))
    return unique_array
}

function getFeatureName(featureType) {
    return audioFeatureList[featureType];
}
// used for get random audio feature chart for home page
const audioFeatureList = ['speechiness',
'acousticness',
'instrumentalness',
'liveness',
'valence',
'duration_ms',
'tempo',
'loudness',
'danceability',
'energy'];
// const chartReportInterval = 5;
// function calculationDateInterval(dateList) {
//     var length = dateList.length;
//     if (length <= chartReportInterval) {
//         return dateList;
//     }
//     var result = [];
//     if (length % chartReportInterval == 0) {
//         var dateNumberPerMileStone = length / chartReportInterval;
//         var i =0;
//         while(i < length) {
//             result.push(dateList[i]);
//             i = i + dateNumberPerMileStone;
//         }
//         return result;
//     }
// } 
const minorMode = 'minor';
const majorMode = 'major';
const beats = ' beats';
const keyList = ['C',
'C#',
'D',
'D#',
'E',
'F',
'F#',
'G',
'G#',
'A',
'A#',
'B']
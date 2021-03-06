'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
const { getTrackAudioFeatures, getTrackGeneralInfo } = require('../controllers/spotify')
const { convertDate, getChartDateList, convertStringToDate, getRandomInt, getGenreTypeList, getGenreName, getGenreType, convertDateToString } = require('../helpers/utils');
const { putDistinctKeyToObject } = require('../controllers/model');
const { getUserGenreFavorite } = require('../controllers/user');
var Statistics = require("simple-statistics");
//const { runData } = require('../helpers/data.js');


module.exports = {
    putChartData: putChartData,
    getTrackListForChart: getTrackListForChart,
    buildChartFeatures: buildChartFeatures,
    putChartAnalysis: putChartAnalysis,
    getLastedChartTracks: getLastedChartTracks,
    getChartReport: getChartReport,
    getChartReportHomePage: getChartReportHomePage,
    getAllChart: getAllChart,
    getTrackChart: getTrackChart,
    searchChart: searchChart,
    getChartDate: getChartDate
};
function searchChart(req, res) {
    var startDate = req.swagger.params.startDate.value;
    var endDate = req.swagger.params.endDate.value;
    var genreType = req.swagger.params.genreType.value;
    if (startDate == undefined && endDate == undefined && genreType == undefined) {
        res.json({ status: 400, value: "Mode search chart is empty" });
    }

    searchChartImp(startDate, endDate, genreType)
    .then(function (data) {
        res.json({ status: 200, value: data });
    })
    .catch(e => {
        res.json({ status: 404, value: e });
    });
}

const searchDayInterval = 90;
function searchChartImp(startDate, endDate, genreType) {
    return new Promise(async (resolve, reject) => {
        var genreList = getGenreTypeList();
        if (genreType != undefined) {
            if (genreList.indexOf(genreType) != -1) {
                genreList = [genreType]
            } else {
                reject("Genre type is not valid")
                return;
            }
        }
    
        var currentDate = new Date()
        var tempDate = new Date()
        if (startDate != undefined && endDate != undefined) {
            startDate = new Date(startDate);
            endDate = new Date(endDate);
            if (startDate > endDate) {
                reject("Start date must be before end date!")
                return;
            }
        }
        else {
            if (startDate == undefined && endDate == undefined) {
                endDate = new Date()
                startDate = new Date(tempDate.setTime(endDate.getTime() - searchDayInterval * 86400000));
            }
            else if (startDate != undefined) {
                startDate = new Date(startDate);
                endDate = new Date(tempDate.setTime(startDate.getTime() + searchDayInterval * 86400000));
            }
            else{
                endDate = new Date(endDate);
                if (endDate > currentDate) {
                    endDate = new Date();
                }
                startDate = new Date(tempDate.setTime(endDate.getTime() - searchDayInterval * 86400000));
            }
        }
        
        if (startDate > currentDate) {
            reject("No data found")
            return;
        }
        if (endDate > currentDate) {
            endDate = currentDate
        }

        var result = [];
        result = await getChartList(startDate, endDate, genreList);
        resolve(result);
    })
  
}
function getTrackChart(req, res) {
    var date = req.swagger.params.date.value;
    var genre = req.swagger.params.genre.value;
    getTrackForChart(genre, date)
    .then(function (data) {
        res.json({ status: 200, value: data });
    })
    .catch(e => {
        res.json({ status: 404, value: e });
    });
}

function getTrackForChart(genre, date) {
    return new Promise(async (resolve, reject) => {
        var genreType = getGenreType(genre);
        if (genreType == -1) {
            reject("Genre type is invalid");
        }
        var dateKey = convertStringToDate(date);
        if (dateKey == undefined) {
            reject("Date is invalid");
            return;
        }
        dateKey = convertDateToString(dateKey)
        var trackListObject = await getTrackListForChart(dateKey, genreType);
        if (trackListObject == undefined) {
            reject("No tracks for this chart")
            return;
        }
        var result = []
        for (var trackId of Object.keys(trackListObject)) {
            if (trackListObject[trackId] > 40) {
                break;
            }
            var track = await getTrackGeneralInfo(trackId);
            if (track == undefined) {
                continue;
            }
            track.position = trackListObject[trackId];
            result.push(track);
        }      
        if (result.length == 0) {
            reject("No tracks data for this chart")
            return;
        }
        resolve(result);
    })


}
function getAllChart(req, res) {
    getChart()
        .then(function (data) {
            res.json({ status: 200, value: data });
        })
        .catch(e => {
            res.json({ status: 404, value: e });
        });
}

function getChart() {
    return new Promise(async (resolve, reject) => {
        var currentDate = new Date()
        var startDate = new Date(currentDate.setTime(currentDate.getTime() - 90 * 86400000));
        var result = [];
        result = await getChartList(startDate, new Date(), getGenreTypeList());
        if (result.length == 0) {
            reject("Data not found");
        }
        else {
            resolve(result);
        }
    })
}

async function getChartList(startDate, endDate, genreList) {
    console.log(startDate, endDate, genreList)
    var dateList = getChartDateList(startDate, endDate);
    var result = [];
    for (var date of dateList) {
        for (var genre of genreList) {
            var dateChart = await getChartDate(date.day + date.month + date.year, genre);
            if (dateChart == undefined) {
                continue;
            }
            var chart = {
                genre: getGenreName(genre),
                date: dateChart
            }
            result.push(chart);
        }
    }
    return result;
}

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
        else if (err.notFound) {
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
    var chartAnalysis = calculateChartFeatures(trackFeaturesList);
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
    //console.log("Start Get track list for chart", date, genreType);
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

async function getLastedChartTracks(genreTypeList) {
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
    var userSelect = req.swagger.params.userSelect.value;
    if (userSelect == true) {
        if (startDate == undefined || endDate == undefined || genreType == undefined) {
            res.json({ status: 400, value: "You should select all start date, end date and genre!" });
            return;
        }
        startDate = new Date(startDate);
        endDate = new Date(endDate);
        if (startDate > endDate) {
            res.json({ status: 400, value: "Start date must be before end date!" });
            return;
        }
    }
    else {
        endDate = new Date();
        var now = new Date();
        startDate = new Date(now.setTime(now.getTime() - daysIntervalReport * 86400000));
        genreType = getGenreTypeList()[0];
    }
    //console.log(startDate, endDate, genreType);
    getReport(startDate, endDate, genreType)
        .then(function (analysisObject) {
            res.json({ status: 200, value: analysisObject });
        })
        .catch(e => {
            res.json({ status: 404, value: e });
        });
}
const daysIntervalReport = 365;
const featureTypeNumber = 2;
function getChartReportHomePage(req, res) {
    var token = req.swagger.params.token.value;
    getChartReportHomePageImp(token)
        .then(function (result) {
            res.json({ status: 200, value: result });
        })
        .catch(e => {
            res.json({ status: 400, value: e });
        });
}
function getChartReportHomePageImp(token) {
    return new Promise(async (resolve, reject) => {
        var genreTypeList = getGenreTypeList();
        var genreType = genreTypeList[getRandomInt(0, genreTypeList.length - 1)];
        if (token != undefined && token != '') {
            var genre = await getUserGenreFavorite(token);
            if (genre != undefined) {
                console.log("Get home chart follow user's favorite genre:", genre)
                genreType = genre
            }
        }
        var endDate = new Date();
        var now = new Date();
        var startDate = new Date(now.setTime(now.getTime() - daysIntervalReport * 86400000));
        var featureTypeList = [];
        while (featureTypeList.length < featureTypeNumber) {
            var featureType = getRandomInt(0, audioFeatureList.length - 1);
            if (featureTypeList.indexOf(featureType) == -1) {
                featureTypeList.push(featureType);
            }
        }
        console.log("get chart track for home page", startDate, endDate, genreType, featureTypeList);
        getReportHomePage(startDate, endDate, genreType, featureTypeList)
            .then(function (chartAnalysisList) {
                if (chartAnalysisList.length == 0) {
                    reject("get chart track for home page error");
                }
                else {
                    var result = new Object;
                    result.genreName = getGenreName(genreType);
                    //result.featureName = getFeatureName(featureType);
                    result.data = chartAnalysisList;
                    //console.log(result);
                    resolve(result)
                }
            })
            .catch(e => {
                reject(e)
            });

    })

}

function getReport(startDate, endDate, genreType) {
    return new Promise(async (resolve, reject) => {
        var dateList = getChartDateList(startDate, endDate);
        if (dateList.length == 0) {
            reject("Chart data is not found in this period!");
        }
        console.log("get report date", dateList.length);
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
        var hasData = false;
        for (var date of dateList) {
            var date_str = date.day + date.month + date.year;
            var chartAnalysis = await getChartAnalysis(date_str, genreType);
            if (chartAnalysis == undefined) {
                continue;
            }
            hasData = true;
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
        if (hasData == false) {
            reject("Chart data is not found in this period!");
        }
        var analysisObject = new Object;
        acousticness = convertChartObjectToList(acousticness);
        danceability = convertChartObjectToList(danceability);
        energy = convertChartObjectToList(energy);
        analysisObject.rhythm = {
            label: acousticness.label,
            data_acousticness: acousticness.data,
            data_danceability: danceability.data,
            data_energy: energy.data
        }
        speechiness = convertChartObjectToList(speechiness);
        instrumentalness = convertChartObjectToList(instrumentalness);
        analysisObject.vocality = {
            label: speechiness.label,
            data_speechiness: speechiness.data,
            data_instrumentalness: instrumentalness.data,
        }
        //analysisObject.liveness = liveness;
        analysisObject.valence = convertChartObjectToList(valence);
        analysisObject.duration_ms = convertChartObjectToList(duration_ms);
        analysisObject.tempo = convertChartObjectToList(tempo);
        analysisObject.time_signature = convertChartObjectToList(calculateNumberPerType(time_signature, specialAudioFeatureList[0]));
        analysisObject.mode = convertChartObjectToList(calculateNumberPerType(mode, specialAudioFeatureList[1]));
        analysisObject.key = convertChartObjectToList(calculateNumberPerType(key, specialAudioFeatureList[2]));
        analysisObject.loudness = convertChartObjectToList(loudness);

        //console.log("Report chart:", analysisObject);
        resolve(analysisObject);
    });
}

function getReportHomePage(startDate, endDate, genreType, featureTypeList) {
    return new Promise(async (resolve, reject) => {
        var dateList = getChartDateList(startDate, endDate);
        var result = new Object
        var featureList = getFeatureNames(featureTypeList)
        for (var featureName of featureList) {
            result[featureName] = new Object;
        }
        var hasData = false;
        for (var date of dateList) {
            var date_str = date.day + date.month + date.year;
            var chartAnalysis = await getChartAnalysis(date_str, genreType);
            if (chartAnalysis == undefined) {
                continue;
            }
            hasData = true;
            var dateKey = date.day + '/' + date.month + '/' + date.year;
            for (var featureName of featureList) {
                result[featureName][dateKey] = parseFloat(chartAnalysis[featureName]);
            }
        }

        if (!hasData) {
            resolve([])
        }
        var resultList = []
        for (var featureName of Object.keys(result)) {
            result[featureName] = convertChartObjectToList(result[featureName]);
            result[featureName]['featureName'] = featureName;
            resultList.push(result[featureName]);
        }
        resolve(resultList);
    });
}
const roundNumber = 4;
// function formatNumber(value) {
//     return parseFloat(value.toFixed(roundNumber));
// }
async function getChartDate(date, genreType) {
    return new Promise((resolve, reject) => {
        get(`chart.${date}.${genreType}.date`, (err, value) => {
            if (!err) {
                resolve(value);
            }
            else {
                resolve(undefined);
            }
        });
    });
}

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
function addElementToObject(origin_object, new_object) {
    for (var key of Object.keys(new_object)) {
        var value = origin_object[key];
        origin_object[key] = (value == undefined) ? new_object[key] : value + ";" + new_object[key];
    }
    return origin_object;
}
function calculateNumberPerType(origin_object, featureType) {
    var new_object = new Object;
    for (var key of Object.keys(origin_object)) {
        var format_key = convertKeyFeatureForReport(key, featureType);
        var listTrack = origin_object[key].split(";");
        listTrack = removeDuplicateUsingSet(listTrack);
        new_object[format_key] = listTrack.length;
    }
    return new_object;
}

function convertKeyFeatureForReport(key, featureType) {
    switch (featureType) {
        case specialAudioFeatureList[0]:
            return key + beats;
        case specialAudioFeatureList[1]:
            return (key == 0) ? minorMode : majorMode;
        case specialAudioFeatureList[2]:
            return keyList[key];
        default:
            return key;
    }
}

function removeDuplicateUsingSet(arr) {
    var unique_array = Array.from(new Set(arr))
    return unique_array
}

function convertChartObjectToList(chartAnalysisObject) {
    var chartAnalysis = new Object;
    var label = [];
    var data = [];
    for (var date of Object.keys(chartAnalysisObject)) {
        label.push(date);
        data.push(chartAnalysisObject[date]);
    }
    chartAnalysis.label = label;
    chartAnalysis.data = data;
    return chartAnalysis;
}

function getFeatureNames(featureTypeList) {
    var result = []
    for (var featureType of featureTypeList) {
        result.push(audioFeatureList[featureType])
    }
    return result;
}
const specialAudioFeatureList = [
    'time_signature',
    'mode',
    'key'
]

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
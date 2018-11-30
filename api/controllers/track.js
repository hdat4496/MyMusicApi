'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
const { getLastedChartTracks } = require('../controllers/chart');
const { getTrackAudioFeatures, getTrackInfo, getTrackInfoFromDatabase, getTrackGeneralInfo, getRecommendTrack, searchTrackFromAPI } = require('../controllers/spotify');
const { predictModel } = require('../controllers/model');
const { getRandomInt } = require('../helpers/utils');
//const { runData } = require('../helpers/data.js');
const crypto = require('crypto');
var arff = require('node-arff');
var weka = require('../helpers/weka-lib.js');
var options = {
    'classifier': 'weka.classifiers.bayes.NaiveBayes',
    'params': ''
};
var model = 'api/public/arff/abcmodel.model';

// var weka = require("node-weka")
module.exports = {
    getTrack: getTrack,
    searchTrack: searchTrack,
    searchArtist: searchArtist,
    getHomeTrack: getHomeTrack,
    searchTrackFromAPIFollowTrackTitle: searchTrackFromAPIFollowTrackTitle
};


function searchArtist(req, res) {
    var keyword = req.swagger.params.keyword.value;
    if (keyword !== '') {
        get(`artist.all`, (err, value) => {
            if (!err) {
                var name_ls = JSON.parse(value);
                var artist_ls = [];
                var names = [];
                var ids = [];
                for (var k in name_ls) {
                    if (name_ls[k].toUpperCase().includes(keyword.toUpperCase())) {
                        ids.push(k);
                        names.push(name_ls[k]);
                    }
                }
                if (ids.length !== 0) {
                    ids.map((e, i) => {
                        get(`artist.${e}.imageurl`, (err, value) => {
                            if (!err) {
                                var artist_obj = {
                                    id: e,
                                    name: names[i],
                                    imageurl: value,
                                }
                                artist_ls.push(artist_obj);
                                if (artist_ls.length === ids.length) {
                                    res.json({ status: 200, artist_ls });
                                }
                            }
                        });
                    });
                } else {
                    res.json({ status: 200, artist_ls });
                }
            }
        });
    }

}

function searchTrack(req, res) {
    var keyword = req.swagger.params.keyword.value;
    if (keyword !== '') {
        get(`track.all`, (err, value) => {
            if (!err) {
                var title_ls = JSON.parse(value);
                var track_ls = []
                var ids = []
                for (var k in title_ls) {
                    if (title_ls[k].toUpperCase().includes(keyword.toUpperCase())) {
                        ids.push(k);
                    }
                }
                if (ids.length !== 0) {
                    ids.map(async (trackId) => {
                        var track = await getTrackInfoFromDatabase(trackId);
                        if (track != undefined) {
                            track_ls.push(track);
                        }
                        if (track_ls.length === ids.length) {
                            res.json({ status: 200, value: track_ls });
                        }
                    });
                }
                else {
                    res.json({ status: 200, value: track_ls });
                }
            }
            else {
                res.json({ status: 404, value: '404 Not found' });
            }
        });

    }
}

function searchTrackFromAPIFollowTrackTitle(req, res) {
    var title = req.swagger.params.title.value;
    var key = 'track:' + title;
    console.log("search track title from api", key);
    searchTrackFromAPI(key)
        .then(function (trackList) {
            console.log("Search track title", trackList);
            res.json({ status: 200, value: trackList });
        })
        .catch(e => {
            console.log("Search track title", trackList);
            res.json({ status: 400, value: e });
        })
}

function getTrack(req, res) {
    var trackId = req.swagger.params.id.value;
    getTrackDetail(trackId)
        .then(function (track) {
            if (track == undefined) {
                res.json({ status: 404, value: "get track error" });
            }
            else {
                console.log("Get track", track);
                res.json({ status: 200, value: track });
            }
        })
        .catch(e => {
            res.json({ status: 400, value: e });
        })

}


function getTrackDetail(trackId) {
    return new Promise(async (resolve, reject) => {
        var track = new Object;
        var trackInfo = await getTrackInfo(trackId);
        if (trackInfo == undefined) {
            console.log("Get track info error");
            reject("Get track info error");
            return;
        }
        track.trackInfo = trackInfo;
        //console.log("get track audio features", trackId);
        var trackFeaturesString = await getTrackAudioFeatures(trackId);
        //console.log("Audio features", trackFeaturesString);
        var trackFeatures = convertAudioFeatures(trackFeaturesString);
        track.trackFeatures = (trackFeatures == undefined) ? '' : trackFeatures;
        var hitResult = await predictModel(trackId);
        track.hit = (hitResult == undefined) ? '' : hitResult;
        var recommendTracks = await getRecommendTrack(trackId);
        track.recommendTracks = (recommendTracks == undefined) ? '' : recommendTracks;
        resolve(track);
    });
}

function getHomeTrack(req, res) {
    getNewTrack()
        .then(function (trackGeneralInfoList) {
            if (trackGeneralInfoList == undefined) {
                res.json({ status: 400, value: "get home track error" });
            }
            else {
                res.json({ status: 200, value: trackGeneralInfoList });
            }
        })
        .catch(e => {
            res.json({ status: 400, value: e });
        });


}
const newTrackNumber = 8;
function getNewTrack() {
    return new Promise(async (resolve, reject) => {
        var trackIds = await getLastedChartTracks();
        var length = trackIds.length;
        if (length == 0) {
            reject("No track");
        }
        var newTrackIndexes = [];
        while (newTrackIndexes.length < newTrackNumber) {
            var index = getRandomInt(0, length);
            if (newTrackIndexes.indexOf(index) == -1) {
                newTrackIndexes.push(index);
            }
        }
        console.log("New Track indexs: ", newTrackIndexes);
        var selectedTrackIds = [];
        for (var index of newTrackIndexes) {
            selectedTrackIds.push(trackIds[index]);
        }
        console.log("New Track ids: ", selectedTrackIds);
        var trackGeneralInfoList = [];
        for (var trackId of selectedTrackIds) {
            var trackInfo = await getTrackGeneralInfo(trackId);
            if (trackInfo == undefined) {
                console.log('Get track info error: ', trackId);
                continue;
            }
            trackGeneralInfoList.push(trackInfo);
        }
        console.log("New Track info: ", trackGeneralInfoList);
        resolve(trackGeneralInfoList);
    });
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
    featureObject.time_signature = features[7] + beats;
    featureObject.mode = (features[8] == 0) ? minorMode : majorMode;
    featureObject.key = keyList[parseInt(features[9])];
    featureObject.loudness = parseFloat(features[10]);
    featureObject.danceability = parseFloat(features[11]);
    featureObject.energy = parseFloat(features[12]);
    console.log("Feature object", featureObject);
    return featureObject;
}
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

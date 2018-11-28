'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
const { getLastedChartTracks } = require('../controllers/chart');
const { getTrackAudioFeatures } = require('../controllers/spotify');
// const { runData } = require('../helpers/data.js');
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
    getHomeTrack: getHomeTrack
};

const like = 'like';
const listen = 'listen';
const lyric = 'lyric';
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
                        var track = await getTrackInfo(trackId);
                        if (track != undefined) {
                            track_ls.push(track);
                        }
                        if (track_ls.length === ids.length) {
                            res.json({ status: 200, track_ls });
                        }
                    });
                }
                else {
                    res.json({ status: 200, track_ls });
                }
            }
            else {
                res.json({ status: 404, message: '404 Not found' });
            }
        });

    }
}

function getTrack(req, res) {
    var trackId = req.swagger.params.id.value;
    getTrackDetail(trackId)
        .then(function (track) {
            if (track == undefined) {
                res.json({ status: 400, value: "get track error" });
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
            reject("Get track info error");
        }
        track.trackInfo = trackInfo;
        // var trackFeatures = await getTrackAudioFeatures(trackId);
        // if(trackFeatures == undefined) {
        //     track[trackFeatures] == '';
        // }
        // else {
        //     track[trackFeatures] == trackFeatures;
        // }
        resolve(track);
    });
}

function getHomeTrack(req, res) {
    getNewTrack()
        .then(function (trackGeneralInfoList) {
            if (trackGeneralInfoList == undefined) {
                res.json({ status: 400, value: "get home track error" })
            }
            else {
                res.json({ status: 200, value: trackGeneralInfoList });
            }
        })
        .catch(e => {
            res.json({ status: 400, value: e })
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
            var index = getRandomInt(length);
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


function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

async function getTrackInfo(trackId) {
    var track = new Object;
    var trackGeneralInfo = await getTrackGeneralInfo(trackId);
    if (trackGeneralInfo == undefined) {
        return;
    }
    track = trackGeneralInfo;
    var trackLike = await getTrackInfoExtra(trackId, like);
    if (trackLike == undefined) {
        track[like] = 0;
    }
    else {
        track[like] = trackLike;
    }

    var trackListen = await getTrackInfoExtra(trackId, listen);
    if (trackListen == undefined) {
        track[listen] = 0;
    }
    else {
        track[listen] = trackListen;
    }

    var trackLyric = await getTrackInfoExtra(trackId, lyric);
    if (trackLyric == undefined) {
        track[lyric] = '';
    }
    else {
        track[lyric] = trackLyric;
    }
    return track;
}

function getTrackGeneralInfo(trackId) {
    return new Promise((resolve, reject) => {
        get(`track.${trackId}.info`, (err, value) => {
            if (!err) {
                var trackInfo = value.split(";");
                var track = new Object;
                track.id = trackId;
                track.title = trackInfo[0];
                track.artist = trackInfo[1];
                track.artist_imageurl = trackInfo[2];
                track.genre = trackInfo[3];
                track.genre_imageurl = trackInfo[4];
                track.track_url = trackInfo[5];
                track.track_imageurl = trackInfo[6];
                resolve(track);
            }
            else {
                resolve(undefined);
            }
        });
    });
}

// Get track like/listen/lyric
function getTrackInfoExtra(trackId, infoType) {
    return new Promise((resolve, reject) => {
        get(`track.${trackId}.${infoType}`, (err, value) => {
            if (err) {
                resolve(value);
            }
            else {
                resolve(undefined);
            }
        });
    });
}

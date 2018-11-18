'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
// const { runData } = require('../helpers/data.js');
const crypto = require('crypto');
var arff = require('node-arff');
var weka = require('/home/lap12526-local/MyMusicApi/node_modules/node-weka/lib/weka-lib.js');


// var weka = require("node-weka")
module.exports = {
    getTrack: getTrack_2,
    searchTrack: searchTrack,
    searchArtist: searchArtist
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
                    ids.map((e) => {
                        get(`track.${e}.info`, (err, value) => {
                            if (!err) {
                                var info = value.split(';');
                                get(`track.${e}.like`, (err, value) => {
                                    if (!err) {
                                        var like = value;
                                        get(`track.${e}.listen`, (err, value) => {
                                            if (!err) {
                                                var listen = value;
                                                var track_obj = {
                                                    id: e,
                                                    title: info[0],
                                                    artist: info[1],
                                                    artist_imageurl: info[2],
                                                    genre: info[3],
                                                    genre_imageurl: info[4],
                                                    imageurl: info[6],
                                                    url: info[5],
                                                    like: like,
                                                    listen: listen
                                                }
                                                track_ls.push(track_obj);
                                                if (track_ls.length === ids.length) {
                                                    res.json({ status: 200, track_ls });
                                                }
                                            }
                                        });
                                    }
                                });
                            }
                        });
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

function getTrack_2(req, res) {
    arff.load('api/public/arff/abc.arff', function (err, data) {
        if (err) {
            return console.error(err);
        }
        // console.log(data)
        var options = {
            'classifier': 'weka.classifiers.bayes.NaiveBayes',
            'params': '-D'
        };


        var testData = {
            outlook: 'sunny',
            windy: 'TRUE',
            temperature: 30,
            humidity: 2,
            play: 'no' // last is class attribute
        };

        weka.classify(data, testData, options, function (err, result) {


            console.log(err); //{ predicted: 'yes', prediction: '1' }
            console.log(result); //{ predicted: 'yes', prediction: '1' }
            res.json({ status: 404, message: '404 Not found' });
        });
    });
}

function getTrack(req, res) {
    var token = req.swagger.params.token.value;
    var id = req.swagger.params.id.value;
    // var check = checkToken(token);
    // if (check.isValid && !check.isExpired) {

    // }    
    // else {
    //     res.json({ status: 400, message: 'Token is invalid or expired' });
    // }

    get(`track.${id}.analysis`, (err, value) => {
        //in db
        if (!err) {
            var analysis_ls = value.split(';').map(Number);
            get(`track.${id}.info`, (err, value) => {
                if (!err) {
                    var info_ls = value.split(';');
                    get(`track.${id}.lyric`, (err, value) => {
                        if (!err) {
                            var lyric = value;
                            get(`track.${id}.like`, (err, value) => {
                                if (!err) {
                                    var num_of_like = value;
                                    get(`track.${id}.listen`, (err, value) => {
                                        if (!err) {
                                            var num_of_listen = value;

                                            arff.load('/home/lap12526-local/MyMusicApi/api/public/arff/training.arff', function (err, data) {
                                                if (err) {
                                                    return console.error(err);
                                                }
                                                console.log(data)
                                                var options = {
                                                    'classifier': 'weka.classifiers.bayes.NaiveBayes',
                                                    // 'classifier': 'weka.classifiers.functions.SMO',
                                                    'params': ''
                                                };


                                                // normalize the data (scale all numeric values so that they are between 0 and 1)
                                                // data.normalize();

                                                // randomly sort the data
                                                // data.randomize();
                                            });

                                        }
                                    });
                                }
                                else {
                                    res.json({ status: 404, message: '404 Not found' });
                                }
                            });
                        }
                        else {
                            res.json({ status: 404, message: '404 Not found' });
                        }
                    });

                }
                else {
                    res.json({ status: 404, message: '404 Not found' });
                }
            });
        }
        //in api 
        else {
            res.json({ status: 404, message: '404 Not found' });
        }
    });






}

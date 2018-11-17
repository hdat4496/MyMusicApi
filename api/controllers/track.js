'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
// const { runData } = require('../helpers/data.js');
const crypto = require('crypto');
var arff = require('node-arff');
module.exports = {
    getTrack: getTrack
};


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
                                            
                                            arff.load('/home/lap12526-local/MyMusicApi/api/api/controllers/arff/occ.arff', function(err, data) {
                                                if (err) {
                                                  return console.error(err);
                                                }
                                                console.log('1111111111111111111');
                                                console.log(data)
                                                // var oldest = data.max('age');

                                               
                                                // normalize the data (scale all numeric values so that they are between 0 and 1)
                                                // data.normalize();
                                               
                                                // randomly sort the data
                                                // data.randomize();
                                              })




















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

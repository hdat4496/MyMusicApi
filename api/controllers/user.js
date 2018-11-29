'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
const { getTrackInfoFromDatabase } = require('../controllers/spotify');
//const { runData } = require('../helpers/data.js');
const crypto = require('crypto');
module.exports = {
    login: login,
    signup: signUp,
    test: test,
    getFavoriteSong: getFavoriteSong,

};
function test(req, res) {
    var key = req.swagger.params.key.value;
    get(`${key}`, (err, value) => {
        if (!err) {
            // let abc = JSON.parse(value);
            // console.log(abc);
            // for (var k in abc){
            //     console.log(k);
            //     console.log(abc[k])
            // }
            res.json({ status: 200, message: value });
        }
        else {
            res.json({ status: 400, message: 'Key is not found' });
        }
    });
    // get(`artist.all`, (err, value) => {
    //     if (!err) {
    //         res.json({ status: 200, message: value });
    //         var name_ls = JSON.parse(value);
    //         var ids = [];
    //         for (var k in name_ls) {
    //             ids.push(k);
    //         }
        
    //         for (var id of ids) {
    //             get(`artist.${id}.genre`, (err, value) => {
    //                 if (!err) {
    //                     console.log(id, value);
    //                 }
  
    //             });
    //         }
    //         console.log("number artist: ",ids.length );
    //     }
    //     else {
    //         res.json({ status: 400, message: 'Key is not found' });
    //     }
    // });

    
    // putSync(`track.lated`, '61UQzeiIluhpzpMdY4ag3q,2V65y3PX4DkRhy1djlxd9p;24LS4lQShWyixJ0ZrJXfJ5;3uGDAwRPcOu6tHuKUjk02H;61gnmKsVhB4TuSJWZzjI3N;6i8w8Zdud22ehgJrrzqIVi;412luShbmlgqqgYFStIB1s;3zU9rdflI65tK4dkkNSp77');
}


function login(req, res) {
    console.log()
    var username = req.swagger.params.user_info.value.user_info.username;
    var password = crypto.createHash('sha256').update(req.swagger.params.user_info.value.user_info.password).digest('base64');
    get(`user.${username}`, (err, value) => {
        if (!err && value == password) {
            var token = generateToken(username);
            console.log(token);

            get(`user.${username}.fullname`, (err, value) => {
                if (!err) {
                    res.json({
                        status: 200,
                        username: username,
                        fullname: value,
                        expire: Date.now() + 2592000000,
                        token: token
                    });
                }
                else {
                    res.json({ status: 400, message: 'Full name not found' });
                }
            });
        } else {
            res.json({ status: 400, message: 'User name or password is not correct' });
        }
    });
}

function signUp(req, res) {
    var username = req.swagger.params.user_info_signup.value.user_info_signup.username;
    var fullname = req.swagger.params.user_info_signup.value.user_info_signup.fullname;
    var password = crypto.createHash('sha256').update(req.swagger.params.user_info_signup.value.user_info_signup.password).digest('base64');
    try {
        if (typeof username !== "undefined" && typeof password !== "undefined" && /^[a-zA-Z0-9]*$/.test(username)) {
            get(`user.${username}`, (err, value) => {
                if (err) {
                    if (err.notFound) {
                        putSync(`user.${username}`, password);
                        putSync(`user.${username}.fullname`, fullname);
                        putSync(`user.${username}.playlist`, '');
                        putSync(`user.${username}.favorite`, '');
                        var token = generateToken(username);
                        console.log('Sign up - create new account');
                        console.log(token);
                        res.json({
                            status: 200,
                            username: username,
                            fullname: fullname,
                            expire: Date.now() + 2592000000,
                            token: token
                        });
                    }
                    else {
                        res.json({ status: 400, message: 'Registration fail' });
                    }
                } else {
                    res.json({ status: 400, message: 'User name already exists' });
                }
            });
        } else {
            res.json({ status: 400, message: 'Username and password is require' });
        }

    } catch (err) {
        res.json({ status: 400, message: 'Registration fail' });
    }
}

function getFavoriteSong(req, res) {
    var token = req.swagger.params.token.value;
    var check = checkToken(token);
    if (check.isValid && !check.isExpired) {
        var idList = [];
        var resultList = [];
        get(`user.${check.user}.favorite`, (err, value) => {
            if (!err) {
                if (value != '') {
                    idList = value.split(";");
                    idList.map(async (trackId) => {
                        var track = await getTrackInfoFromDatabase(trackId);
                        if (track != undefined) {
                            resultList.push(track);
                        }
                        if (resultList.length === ids.length) {
                            res.json({ status: 200, resultList });
                        }
                    });
                }
                else {
                    res.json({
                        status: 200,
                        listTrackInfo: resultList
                    });
                }
            } else {
                res.json({ status: 404, message: 'Favorite songs not found' });
            }
        });
    }
    else {
        res.json({ status: 400, message: 'Token is invalid or expired' });
    }
}
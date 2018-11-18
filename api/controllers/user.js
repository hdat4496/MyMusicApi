'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
// const { runData } = require('../helpers/data.js');
const crypto = require('crypto');
module.exports = {
    login: login,
    signup: signUp,
    test: test,
    getFavoriteSong: getFavoriteSong,

};
function test(req, res) {
    // var key = req.swagger.params.key.value;
    // get(`test2`, (err, value) => {
    //     if (!err) {
    //          let abc = JSON.parse(value);
    //          console.log(abc);
    //         for (var k in abc){
    //             console.log(k);
    //             console.log(abc[k])
    //         }
    //     abc  = {}
    //         res.json({ status: 200, message: value });
    //     }
    //     else {
    //         res.json({ status: 400, message: 'Key is not found' });
    //     }
    // });
    // var obj = {};
    // obj['2V65y3PX4DkRhy1djlxd9p'] = 'DON\'T YOU WORRY CHILD';
    // obj['24LS4lQShWyixJ0ZrJXfJ5'] = 'SWEET NOTHING';
    // obj['3uGDAwRPcOu6tHuKUjk02H'] = 'ONE POUND FISH';
    // obj['61gnmKsVhB4TuSJWZzjI3N'] = 'GOLD DUST';
    // obj['6i8w8Zdud22ehgJrrzqIVi'] = 'CAN YOU HEAR ME';
    // putSync(`track.all`, JSON.stringify(obj));

    // var obj = {};
    // obj['1'] = 'SWEDISH HOUSE MAFIA';
    // obj['2'] = 'CALVIN HARRIS';
    // obj['3'] = 'DJ FRESH';
    // obj['4'] = 'WILEY';

    // putSync(`artist.all`, JSON.stringify(obj));
}


function login(req, res) {
    var username = req.swagger.params.user_info.value.username;
    var password = crypto.createHash('sha256').update(req.swagger.params.user_info.value.password).digest('base64');
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
    var username = req.swagger.params.user_info_signup.value.username;
    var fullname = req.swagger.params.user_info_signup.value.fullname;
    console.log(username);
    var password = crypto.createHash('sha256').update(req.swagger.params.user_info_signup.value.password).digest('base64');
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
                    idList.map((value) => {
                        var id = value;
                        get(`track.${id}.info`, (err, value) => {
                            if (!err) {
                                var content = value.split(";");
                                get(`track.${id}.like`, (err, value) => {
                                    if (!err) {
                                        var like = value;
                                        get(`track.${id}.listen`, (err, value) => {
                                            var listen = value;
                                            if (!err) {
                                                var trackInfo = {
                                                    id: id,
                                                    title: content[0],
                                                    artist: content[1],
                                                    artist_imageurl: content[2],
                                                    genre: content[3],
                                                    genre_imageurl: content[4],
                                                    imageurl: content[5],
                                                    url: content[6],
                                                    like: like,
                                                    listen: listen,
                                                }
                                                resultList.push(trackInfo);
                                                if (resultList.length === idList.length) {
                                                    res.json({
                                                        status: 200,
                                                        listTrackInfo: resultList
                                                    });
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
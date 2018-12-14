'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
const { getTrackInfoFromDatabase } = require('../controllers/spotify');
const { getRandomInt } = require('../helpers/utils');

//const { runData } = require('../helpers/data.js');
const crypto = require('crypto');
module.exports = {
    login: login,
    signup: signUp,
    test: test,
    getFavoriteSong: getFavoriteSong,
    checkFavoriteSong: checkFavoriteSong,
    putFavoriteSong: putFavoriteSong,
    updateUserFavoriteGenre: updateUserFavoriteGenre,
    getUserGenreFavorite: getUserGenreFavorite

};
function test(req, res) {
    var key = req.swagger.params.key.value;
    get(`${key}`, (err, value) => {
        if (!err) {
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
                        res.json({ status: 400, message: 'User name already exists' });
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
        get(`user.${check.user}.favorite`, async(err, value) => {
            if (!err) {
                if (value != '') {
                    idList = value.split(";");
                    for (var trackId of idList) {
                        var track = await getTrackInfoFromDatabase(trackId);
                        if (track != undefined) {
                            resultList.push(track);
                        }
                    }
                    res.json({ status: 200, resultList });
                    
                }
                else {
                    res.json({ status: 200, resultList });
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

function checkFavoriteSong(req, res) {
    var token = req.swagger.params.token.value;
    var trackId = req.swagger.params.trackid.value;
    var check = checkToken(token);
    if (check.isValid && !check.isExpired) {
        var idList = [];
        get(`user.${check.user}.favorite`, (err, value) => {
            if (!err) {
                console.log(check.user, value);
                if (value != '') {
                    idList = value.split(";");
                    var hasFavorite = idList.indexOf(trackId);
                    if (hasFavorite == -1) {
                        res.json({ status: 200, value: false });
                    }
                    else {
                        res.json({ status: 200, value: true });
                    }
                }
                else {
                    res.json({ status: 200, value: false });
                }
            } else {
                res.json({ status: 200, value: false });
            }
        });
    }
    else {
        res.json({ status: 400, message: 'Token is invalid or expired' });
    }
}

function putFavoriteSong(req, res) {
    var token = req.swagger.params.token.value;
    var trackId = req.swagger.params.trackid.value;
    var like = req.swagger.params.like.value;
    var check = checkToken(token);
    if (check.isValid && !check.isExpired) {
        var idList = [];
        get(`user.${check.user}.favorite`, (err, value) => {
            if (!err) {
                if (like) {
                    var trackList = (value != '') ? `${value};${trackId}` : trackId;
                    putSync(`user.${check.user}.favorite`, trackList);
                    get(`track.${trackId}.like`, (err, value) => {
                        if (!err) {
                            putSync(`track.${trackId}.like`, parseInt(value)+1);
                            res.json({ status: 200, value: "Update like success" });
                         }
                    });
                }
                else {
                    idList = value.split(";");
                    var index = idList.indexOf(trackId);
                    if (index != -1) {
                        idList.splice(index);                       
                    }
                    var trackList = idList.join(";");

                    putSync(`user.${check.user}.favorite`, trackList);
                    get(`track.${trackId}.like`, (err, value) => {
                        if (!err) {
                            putSync(`track.${trackId}.like`, parseInt(value)-1);
                            res.json({ status: 200, value: "Update like success" });
                         }
                    });
                }
            } else {
                res.json({ status: 200, value: false });
            }
        });
    }
    else {
        res.json({ status: 400, message: 'Token is invalid or expired' });
    }
}

async function updateUserFavoriteGenre(token, genreType) {
    if (genreType == undefined) {
        return
    }
    var check = checkToken(token);
    if (!check.isValid || check.isExpired) {
        console.log("Token is invalid")
       return
    }
    var userGenre = await getUserGenre(check.user);
    if (userGenre == undefined || userGenre == '') {
        console.log("put new user genre", check.user, genreType)
        var genreNumber = [0,0,0]
        genreNumber[genreType-1] = 1;
        var value = genreNumber.join(";")
        putSync(`user.${check.user}.genre`, value);
    } else {
        console.log("update user genre", userGenre, check.user, genreType)
        var genreNumber = userGenre.split(";")
        genreNumber[genreType-1] = parseInt(genreNumber[genreType-1]) + 1;
        var value = genreNumber.join(";")
        putSync(`user.${check.user}.genre`, value);
    }
}

async function getUserGenreFavorite(token) {
    var check = checkToken(token);
    if (!check.isValid || check.isExpired) {
        console.log("Token is invalid")
       return
    }

    var genreList = await getUserGenre(check.user)
    if (genreList == undefined || genreList == '') {
        return
    }
    genreList = genreList.split(";")
    var genreType = 0;
    var max = 0;
    for (var i=0;i<genreList.length;i++) {
        if(genreList[i] > max) {
            genreType = i+1;
        }
    }
    return genreType == 0 ? undefined : genreType
}

function getUserGenre(username) {
    //console.log('get track genre ', trackId);
    return new Promise((resolve, reject) => {
        get(`user.${username}.genre`, (err, value) => {
            if (!err) {
                resolve(value);
            }
            else {
                resolve(undefined)
            }
        });
    });
}
'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
//const { runData } = require('../helpers/data.js');
const crypto = require('crypto');
module.exports = {
    login: login,
    signup: signUp,
    test: test,

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
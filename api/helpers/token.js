var util = require('util');
var jwt = require('jsonwebtoken');

module.exports = {
    checkToken,
    generateToken
};
  
function generateToken(user) {
    return jwt.sign({
        user: user,
        exp: Date.now() + 2592000000
    }, 'secret');
}


function checkToken(token) {
    try {
        var decoded = jwt.verify(token, 'secret');
        return {
            user: decoded.user,
            isValid: true,
            isExpired: Date.now() > decoded.exp,
        }
    } catch(err) {
        return {
            user: '',
            isValid: false,
            isExpired: true
        }
    }
}




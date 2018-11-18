'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
// const { runData } = require('../helpers/data.js');
var Crawler = require("crawler");
var SpotifyWebApi = require('spotify-web-api-node');
// Set necessary parts of the credentials on the constructor
var spotifyApi = new SpotifyWebApi({
    clientId: '9858429e40ac4516838c142ae439f27b',
    clientSecret: '0f0eadd372d94b19ab7c98f5d910fe4c'
});

// Get an access token and 'save' it using a setter
spotifyApi.clientCredentialsGrant().then(
    function (data) {
        console.log('The access token is ' + data.body['access_token']);
        spotifyApi.setAccessToken(data.body['access_token']);
    },
    function (err) {
        console.log('Something went wrong!', err);
    }
);

module.exports = {
    crawl: searchTrackSpotifyAPI,
    searchTrackSpotifyAPI: searchTrackSpotifyAPI
};

function crawl(req, res) {
    var c = new Crawler({
        maxConnections: 10,
        // This will be called for each crawled page
        callback: function (error, res, done) {
            if (error) {
                console.log(error);
            } else {
                var $ = res.$;
                console.log($('.article-date').text().trim());

                $('.chart-positions').find('tr').not('.headings').not('.mobile-actions').not('.actions-view').each((_, ele) => {
                    console.log($(ele).find('.position').text().trim());
                    console.log($(ele).find('.title').text().trim());
                    console.log($(ele).find('.artist').text().trim());
                });
            }
            done();
        }
    });

    // Queue a list of URLs
    c.queue(['https://www.officialcharts.com/charts/dance-singles-chart/20091227/104/',
        'https://www.officialcharts.com/charts/dance-singles-chart/20100103/104/']);
}

function searchTrackSpotifyAPI(res, req) {
    var title = 'Bad romance';
    var artist = 'Lady gaga';
    spotifyApi.searchTracks('track:' + title + ' artist:' + artist).then(
        function (data) {
            var trackInfo = data.body['tracks']['items'][0];
            // track id
            console.log(trackInfo['id']);
            // title
            console.log(trackInfo['name']);
            // track url
            console.log(trackInfo['href']);
            // track image url
            console.log(trackInfo['album']['images'][0]['url']);
            var artists = trackInfo['artists'];
            var artistIds = [];
            for (var i = 0; i < artists.length; i++) {
                // artist id
                console.log(artists[i]['id']);
                artistIds.push(artists[i]['id']);
                // artist name
                console.log(artists[i]['name']);
            }

            getArtistsAPI(artistIds);
        },
        function (err) {
            console.log('Search fail', err);
        }
    );
}

// get list of artists
function getArtistsAPI(artistIds) {
    spotifyApi.getArtists(artistIds)
        .then(function (data) {
            var artists = data.body['artists'];
            for (var i =0 ;i < artists.length; i++) {
                // artist id
                console.log(artists[i]['id']);
                // artist image url
                console.log(artists[i]['images'][0]['url']);
            }
        }, function (err) {
            console.error(err);
        });
}


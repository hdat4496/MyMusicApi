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
    crawl: crawl,
    searchTrackSpotifyAPI: searchTrackSpotifyAPI
};


function crawl() {
    console.log('Crawl data');
    var c = new Crawler({
        maxConnections: 10,
        // This will be called for each crawled page
        callback: function (error, res, done) {
            if (error) {
                console.log(error);
            } else {
                var $ = res.$;
                var tracks = [];
                console.log($('.article-date').text().trim());
                $('.chart-positions').find('tr').not('.headings').not('.mobile-actions').not('.actions-view').each((_, ele) => {
                    var position = $(ele).find('.position').text().trim();
                    var title = $(ele).find('.title').text().trim();
                    var artist = $(ele).find('.artist').text().trim();

                    title = normalizeTitle(title);
                    artist = normalizeArtistName(artist);
                    console.log(position);
                    console.log(title);
                    console.log(artist);
                    var track = {
                        position: position,
                        title: title,
                        artist: artist
                    }
                    tracks.push(track);
                });

                console.log('Crawled data length: ', tracks.length);
                getTrackData(tracks);
            }
            done();
        }
    });

    // Queue a list of URLs
    c.queue(['https://www.officialcharts.com/charts/dance-singles-chart/20130101/104/']);

}

async function getTrackData(tracks) {
    var trackIds = await getTrackInfo(tracks);
    getAudioFeaturesAPI(trackIds);
    
    for(var trackIds of trackIds) {
        getAudioAnalysisAPI(trackIds);
    }
}

async function getTrackInfo(tracks) {
    var trackIds = [];
    await Promise.all(tracks.map(async (track) => {
        var trackid = await searchTrackSpotifyAPI(track.position, track.title, track.artist);
        if (trackid != undefined) {
            trackIds.push(trackid);
        }
    }));
    return trackIds;
}


async function searchTrackSpotifyAPI(position, title, artist) {
    console.log('Search track');
    var id;
    await spotifyApi.searchTracks('track:' + title + ' artist:' + artist).then(
        function (data) {
            var total = data.body.tracks.total;
            if (total == 0) {
                console.log('---------------', position, '----------');
                console.log('---------------NOT FOUND----------');
                return '';
            }
            var trackInfo = data.body.tracks.items[0];
            console.log('---------------', position, '----------');
            // track id
            console.log(trackInfo.id);
            //callback(trackInfo.id);
            id = trackInfo.id;
            // title
            console.log(trackInfo.name);
            // track url
            console.log(trackInfo.href);
            // track image url
            console.log(trackInfo.album.images[0].url);
            var artists = trackInfo.artists;
            var artistIds = [];
            for (var i = 0; i < artists.length; i++) {
                // artist id
                console.log(artists[i].id);
                artistIds.push(artists[i].id);
                // artist name
                console.log(artists[i].name);
            }
            // //getArtistsAPI(artistIds);
            return artistIds;
        },
        function (err) {
            console.log('Search fail', err);
        }
    )
        .then(function (artistIds) {
            if (artistIds === '') {
                return;
            }
            spotifyApi.getArtists(artistIds)
                .then(function (data) {
                    var artists = data.body.artists;
                    for (var i = 0; i < artists.length; i++) {
                        // artist id
                        console.log(artists[i].id);
                        // artist image url
                        console.log(artists[i].images[0].url);
                    }
                }, function (err) {
                    console.error('Get artist error', err);
                });
        });
        return id;
}

// get list of artists
function getArtistsAPI(artistIds) {
    console.log('get artist');
    spotifyApi.getArtists(artistIds)
        .then(function (data) {
            var artists = data.body.artists;
            for (var i = 0; i < artists.length; i++) {
                // artist id
                console.log(artists[i].id);
                // artist image url
                console.log(artists[i].images[0].url);
            }
        }, function (err) {
            console.error('Get artist error', err);
        });
}

// get audio features of track list
function getAudioFeaturesAPI(trackIds) {
    console.log('Get audio feature:', trackIds);
    spotifyApi.getAudioFeaturesForTracks(trackIds)
        .then(function (data) {
            console.log('Get audio feature success');
            var tracks = data.body.audio_features;
            for (var i = 0; i < tracks.length; i++) {
                // track id
                console.log(tracks[i].id);
                // danceability
                console.log('danceability', tracks[i].danceability);
                // energy
                console.log('energy', tracks[i].energy);
            }
        }, function (err) {
            console.error(err);
        });
}

// get audio analysis of one track 
function getAudioAnalysisAPI(trackId) {
    console.log('Get audio analysis:', trackId);
    spotifyApi.getAudioAnalysisForTrack(trackId)
        .then(function (data) {
            console.log('Get audio analysis success');
        }, function (err) {
            console.error(err);
        });
}

function normalizeTitle(title) {
    if (title.includes("(")) {
        var pos = title.indexOf("(");
        var title_re = title.substr(pos);
        title = title.replace(title_re, " ");
    }

    title = title.replace("'", "\\'")

    return title;
}

function normalizeArtistName(artist) {
    while (artist.includes(" FT ")) {
        artist = artist.replace(" FT ", " OR ");
    }

    while (artist.includes(" / ")) {
        artist = artist.replace(" / ", " OR ");
    }

    while (artist.includes("/")) {
        artist = artist.replace("/", " OR ");
    }

    while (artist.includes(" & ")) {
        artist = artist.replace(" & ", " OR ");
    }

    while (artist.includes(" FEATURING ")) {
        artist = artist.replace(" FEATURING ", " OR ");
    }

    return artist;
}


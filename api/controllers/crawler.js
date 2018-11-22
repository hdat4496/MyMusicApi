'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
//const { runData } = require('../helpers/data.js');
var Crawler = require("crawler");
var Statistics = require("simple-statistics");
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


function crawl(req, res) {
    console.log('Crawl data');

    var promise;
    var c = new Crawler({
        maxConnections: 1,
        // This will be called for each crawled page
        callback: async function (error, res, done) {
            if (error) {
                console.log(error);
            } else {
                var $ = res.$;
                var tracks = [];
                var date = $('.article-date').first().text().trim();
                console.log(date);
                $('.chart-positions').find('tr').not('.headings').not('.mobile-actions').not('.actions-view').each((_, ele) => {
                    var position = $(ele).find('.position').text().trim();
                    var title = $(ele).find('.title').text().trim();
                    var artist = $(ele).find('.artist').text().trim();

                    title = normalizeTitle(title);
                    artist = normalizeArtistName(artist);
                    //console.log(position, title, artist);
                    if ((position == '') || (title == '') || (artist == '')) {
                        return;
                    }
                    var track = {
                        position: position,
                        title: title,
                        artist: artist
                    }
                    tracks.push(track);
                });

                console.log('Crawled data length: ', tracks.length);
                var genreType = res.options.genreType;
                await putData(genreType, date, tracks);
            }
            done();
        }
    });

    // Queue a list of URLs
    var url = {
        uri: 'https://www.officialcharts.com/charts/dance-singles-chart/20140226/104/',
        genreType: '1'
    }
    var url1 = {
        uri: 'https://www.officialcharts.com/charts/dance-singles-chart/20140626/104/',
        genreType: '1'
    }
    var url2 = {
        uri: 'https://www.officialcharts.com/charts/dance-singles-chart/20140726/104/',
        genreType: '1'
    }
    c.queue([url, url1, url2]);
}

async function putData(genre, date, tracks) {
    var trackInfoList = await putTrackData(tracks);
    putChartData(genre, date, trackInfoList);
}

async function putTrackData(tracks) {
    var trackInfoList = await getTrackInfo(tracks);
    var newTrackIds = [];
    console.log("Number of track info: ", trackInfoList.length);
    for (var trackInfo of trackInfoList) {
        if (trackInfo.trackId != undefined && trackInfo.exist == false) {
            newTrackIds.push(trackInfo.trackId);
        }
    }
    console.log("Number of new track: ", newTrackIds.length);

    if (newTrackIds.length == 0) {
        console.log('Get track data done because of no new track')
        return;
    }
    getAudioFeaturesAPI(newTrackIds);

    for (var trackId of newTrackIds) {
        getAudioAnalysisAPI(trackId);
    }

    return trackInfoList;
}

async function getTrackInfo(tracks) {
    var trackInfoList = [];

    for (var track of tracks) {
        var trackInfo = await searchTrackSpotifyAPI(track.position, track.title, track.artist);
        //console.log("Get track info done: ", trackid);
        trackInfoList.push(trackInfo);
    }

    console.log("Get all track info done: ", trackInfoList.length);
    return trackInfoList;
}

async function checkTrackExist(trackId) {
    //console.log('check track exist ?');
    return new Promise((resolve, reject) => {
        get(`track.${trackId}.info`, (err, value) => {
            if (err) {
                //console.log('Track is not exist -> store new track');
                resolve(false);
            }
            else {
                reject('Track is already exist');
            }
        });
    });
}

async function searchTrackSpotifyAPI(position, title, artist) {
    //console.log('Search track: ', title, artist);
    var trackInfo;
    var trackId;
    var artistNames = [];
    var artistImageUrl;
    var exist;
    await spotifyApi.searchTracks('track:' + title + ' artist:' + artist).then(
        async function (data) {
            var total = data.body.tracks.total;
            if (total == 0) {
                console.log(title, ';', artist, '---------------NOT FOUND----------');
                return;
            }
            trackInfo = data.body.tracks.items[0];
            trackId = trackInfo.id;
            // check if track exist in database
            exist = await checkTrackExist(trackInfo.id);
            var artists = trackInfo.artists;
            var artistIds = [];
            for (var artist of artists) {
                artistIds.push(artist.id);
            }
            return artistIds;
        },
        function (err) {
            console.log('Search fail', err);
            //searchTrackSpotifyAPI('track:' + title + ' artist:' + artist);
        }
    )
        .then(function (artistIds) {
            if (artistIds == undefined) {
                return;
            }
            spotifyApi.getArtists(artistIds)
                .then(function (data) {
                    var artists = data.body.artists;
                    for (var artist of artists) {
                        var artistInfo = {
                            id: artist.id,
                            name: artist.name,
                            imageurl: artist.images[0].url
                        }
                        // put artist info
                        putArtistInfo(artistInfo, trackInfo.id);
                        artistNames.push(artist.name);
                    }
                    artistImageUrl = artists[0].images[0].url;
                    var track = {
                        id: trackInfo.id,
                        title: trackInfo.name,
                        artist: artistNames.join(" ft "),
                        artist_imageurl: artistImageUrl,
                        genre: '',
                        genre_imageurl: '',
                        track_url: trackInfo.href,
                        track_imageurl: trackInfo.album.images[0].url
                    }
                    putTrackInfo(track);
                }, function (err) {
                    console.error('Get artist error', err);
                });
        })
        .catch(e => {
            console.log('Exception search track: ', e);
            //next(e);
        });
    var trackInfoResult = {
        position: position,
        trackId: trackId,
        exist: exist
    }
    return trackInfoResult;
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
            console.log('Get audio feature list of track success');
            var result = data.body.audio_features;
            for (var trackFeature of result) {
                putTrackAudioFeature(trackFeature);
            }
        }, function (err) {
            console.error('Get audio feature list of track error:', err);
        });
}

// get audio analysis of one track 
async function getAudioAnalysisAPI(trackId) {
    console.log('Get audio analysis:', trackId);
    await spotifyApi.getAudioAnalysisForTrack(trackId)
        .then(async function (data) {
            console.log('Get audio analysis success');
            var audioAnalysis = await calculateAudioAnalysis(data.body);
            putTrackAudioAnalysis(trackId, audioAnalysis);
        }, function (err) {
            getAudioAnalysisAPI(trackId);
            console.error('Get audio analysis error', err);
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


function putTrackInfo(trackInfo) {
    console.log("Put track info:", trackInfo.id);
    if (trackInfo.id == '') {
        return;
    }
    var info = trackInfo.title + ';' + trackInfo.artist + ';' + trackInfo.artist_imageurl + ';'
        + trackInfo.genre + ';' + trackInfo.genre_imageurl + ';' + trackInfo.track_url + ';' + trackInfo.track_imageurl;
    if (info == '') {
        return;
    }
    putSync(`track.${trackInfo.id}.info`, info);
    putSync(`track.${trackInfo.id}.like`, 0);
    putSync(`track.${trackInfo.id}.listen`, 0);

    // TODO: get lyric
    //putSync(`track.2V65y3PX4DkRhy1djlxd9p.lyric`,'This is a lyric. Ahihi');

    get(`track.number`, (err, value) => {
        if (!err) {
            console.log('Add number of track', parseInt(value) + 1);
            putSync(`track.number`, parseInt(value) + 1);
        }
    });

    get(`track`, (err, value) => {
        if (!err) {
            console.log('put track id list', trackInfo.id);
            putSync(`track`, value + ';' + trackInfo.id);
        }
    });
}

function putTrackAudioFeature(audioFeatures) {
    console.log("Put track audio features:", audioFeatures.id);
    if (audioFeatures == undefined) {
        return;
    }

    // speechiness;acousticness;instrumentalness;liveness;valence;duration_ms;tempo;time signature;mode;key;loudness;danceability;energy
    var audioFeaturesValue = audioFeatures.speechiness + ';' + audioFeatures.acousticness + ';' + audioFeatures.instrumentalness + ';'
        + audioFeatures.liveness + ';' + audioFeatures.valence + ';' + audioFeatures.duration_ms + ';' + audioFeatures.tempo + ';' + audioFeatures.time_signature + ';'
        + audioFeatures.mode + ';' + audioFeatures.key + ';' + audioFeatures.loudness + ';' + audioFeatures.danceability + ';' + audioFeatures.energy;

    putSync(`track.${audioFeatures.id}.feature`, audioFeaturesValue);

    console.log("Put track audio features success:", audioFeatures.id);
    //console.log("Put track audio features success:", audioFeatures.id, audioFeaturesValue);
}


function putArtistInfo(artistInfo, trackId) {
    console.log("Put artist:", artistInfo.id, trackId);
    if (artistInfo.id == '') {
        return;
    }
    get(`artist.${artistInfo.id}.track`, (err, value) => {
        // exist: update by adding track value
        if (!err) {
            var trackValue = value + ';' + trackId;
            putSync(`artist.${artistInfo.id}.track`, trackValue);
        }
        else {
            // no exist in database: create new artist
            if (err.notFound) {
                putSync(`artist.${artistInfo.id}.name`, artistInfo.name);
                putSync(`artist.${artistInfo.id}.imageurl`, artistInfo.imageurl);
                putSync(`artist.${artistInfo.id}.track`, trackId);
            }
        }
    });
}

function calculateAudioAnalysis(audioAnalysis) {
    console.log('calculateAudioAnalysis')
    if (audioAnalysis == undefined) {
        return;
    }

    var song = new Object;
    var duration_arr = [];
    var timebre1_arr = [];
    var timebre2_arr = [];
    var timebre3_arr = [];
    var timebre4_arr = [];
    var timebre5_arr = [];
    var timebre6_arr = [];
    var timebre7_arr = [];
    var timebre8_arr = [];
    var timebre9_arr = [];
    var timebre10_arr = [];
    var timebre11_arr = [];
    var timebre12_arr = [];

    for (var beat of audioAnalysis.beats) {
        duration_arr.push(beat.duration);
    }

    for (var segment of audioAnalysis.segments) {
        timebre1_arr.push(segment.timbre[0]);
        timebre2_arr.push(segment.timbre[1]);
        timebre3_arr.push(segment.timbre[2]);
        timebre4_arr.push(segment.timbre[3]);
        timebre5_arr.push(segment.timbre[4]);
        timebre6_arr.push(segment.timbre[5]);
        timebre7_arr.push(segment.timbre[6]);
        timebre8_arr.push(segment.timbre[7]);
        timebre9_arr.push(segment.timbre[8]);
        timebre10_arr.push(segment.timbre[9]);
        timebre11_arr.push(segment.timbre[10]);
        timebre12_arr.push(segment.timbre[11]);
    }
    song.beatdiff_mean = Statistics.mean(duration_arr);
    song.beatdiff_variance = Statistics.variance(duration_arr);
    song.beatdiff_skewness = Statistics.sampleSkewness(duration_arr);
    song.beatdiff_kurtosis = Statistics.sampleKurtosis(duration_arr);
    song.beatdiff_standard_deviation = Statistics.standardDeviation(duration_arr);
    song.beatdiff_80th_percentile = Statistics.quantile(duration_arr, 0.8);
    song.beatdiff_min = Statistics.min(duration_arr);
    song.beatdiff_max = Statistics.max(duration_arr);
    song.beatdiff_range = song.beatdiff_max - song.beatdiff_min;
    song.beatdiff_median = Statistics.median(duration_arr);

    song.timebre_1_mean = Statistics.mean(timebre1_arr);
    song.timebre_1_variance = Statistics.variance(timebre1_arr);
    song.timebre_1_skewness = Statistics.sampleSkewness(timebre1_arr);
    song.timebre_1_kurtosis = Statistics.sampleKurtosis(timebre1_arr);
    song.timebre_1_standard_deviation = Statistics.standardDeviation(timebre1_arr);
    song.timebre_1_80th_percentile = Statistics.quantile(timebre1_arr, 0.8);
    song.timebre_1_min = Statistics.min(timebre1_arr);
    song.timebre_1_max = Statistics.max(timebre1_arr);
    song.timebre_1_range = song.timebre_1_max - song.timebre_1_min;
    song.timebre_1_median = Statistics.median(timebre1_arr);

    song.timebre_2_mean = Statistics.mean(timebre2_arr);
    song.timebre_2_variance = Statistics.variance(timebre2_arr);
    song.timebre_2_skewness = Statistics.sampleSkewness(timebre2_arr);
    song.timebre_2_kurtosis = Statistics.sampleKurtosis(timebre2_arr);
    song.timebre_2_standard_deviation = Statistics.standardDeviation(timebre2_arr);
    song.timebre_2_80th_percentile = Statistics.quantile(timebre2_arr, 0.8);
    song.timebre_2_min = Statistics.min(timebre2_arr);
    song.timebre_2_max = Statistics.max(timebre2_arr);
    song.timebre_2_range = song.timebre_2_max - song.timebre_2_min;
    song.timebre_2_median = Statistics.median(timebre2_arr);

    song.timebre_3_mean = Statistics.mean(timebre3_arr);
    song.timebre_3_variance = Statistics.variance(timebre3_arr);
    song.timebre_3_skewness = Statistics.sampleSkewness(timebre3_arr);
    song.timebre_3_kurtosis = Statistics.sampleKurtosis(timebre3_arr);
    song.timebre_3_standard_deviation = Statistics.standardDeviation(timebre3_arr);
    song.timebre_3_80th_percentile = Statistics.quantile(timebre3_arr, 0.8);
    song.timebre_3_min = Statistics.min(timebre3_arr);
    song.timebre_3_max = Statistics.max(timebre3_arr);
    song.timebre_3_range = song.timebre_3_max - song.timebre_3_min;
    song.timebre_3_median = Statistics.median(timebre3_arr);

    song.timebre_4_mean = Statistics.mean(timebre4_arr);
    song.timebre_4_variance = Statistics.variance(timebre4_arr);
    song.timebre_4_skewness = Statistics.sampleSkewness(timebre4_arr);
    song.timebre_4_kurtosis = Statistics.sampleKurtosis(timebre4_arr);
    song.timebre_4_standard_deviation = Statistics.standardDeviation(timebre4_arr);
    song.timebre_4_80th_percentile = Statistics.quantile(timebre4_arr, 0.8);
    song.timebre_4_min = Statistics.min(timebre4_arr);
    song.timebre_4_max = Statistics.max(timebre4_arr);
    song.timebre_4_range = song.timebre_4_max - song.timebre_4_min;
    song.timebre_4_median = Statistics.median(timebre4_arr);

    song.timebre_5_mean = Statistics.mean(timebre5_arr);
    song.timebre_5_variance = Statistics.variance(timebre5_arr);
    song.timebre_5_skewness = Statistics.sampleSkewness(timebre5_arr);
    song.timebre_5_kurtosis = Statistics.sampleKurtosis(timebre5_arr);
    song.timebre_5_standard_deviation = Statistics.standardDeviation(timebre5_arr);
    song.timebre_5_80th_percentile = Statistics.quantile(timebre5_arr, 0.8);
    song.timebre_5_min = Statistics.min(timebre5_arr);
    song.timebre_5_max = Statistics.max(timebre5_arr);
    song.timebre_5_range = song.timebre_5_max - song.timebre_5_min;
    song.timebre_5_median = Statistics.median(timebre5_arr);

    song.timebre_6_mean = Statistics.mean(timebre6_arr);
    song.timebre_6_variance = Statistics.variance(timebre6_arr);
    song.timebre_6_skewness = Statistics.sampleSkewness(timebre6_arr);
    song.timebre_6_kurtosis = Statistics.sampleKurtosis(timebre6_arr);
    song.timebre_6_standard_deviation = Statistics.standardDeviation(timebre6_arr);
    song.timebre_6_80th_percentile = Statistics.quantile(timebre6_arr, 0.8);
    song.timebre_6_min = Statistics.min(timebre6_arr);
    song.timebre_6_max = Statistics.max(timebre6_arr);
    song.timebre_6_range = song.timebre_6_max - song.timebre_6_min;
    song.timebre_6_median = Statistics.median(timebre6_arr);

    song.timebre_7_mean = Statistics.mean(timebre7_arr);
    song.timebre_7_variance = Statistics.variance(timebre7_arr);
    song.timebre_7_skewness = Statistics.sampleSkewness(timebre7_arr);
    song.timebre_7_kurtosis = Statistics.sampleKurtosis(timebre7_arr);
    song.timebre_7_standard_deviation = Statistics.standardDeviation(timebre7_arr);
    song.timebre_7_80th_percentile = Statistics.quantile(timebre7_arr, 0.8);
    song.timebre_7_min = Statistics.min(timebre7_arr);
    song.timebre_7_max = Statistics.max(timebre7_arr);
    song.timebre_7_range = song.timebre_7_max - song.timebre_7_min;
    song.timebre_7_median = Statistics.median(timebre7_arr);

    song.timebre_8_mean = Statistics.mean(timebre8_arr);
    song.timebre_8_variance = Statistics.variance(timebre8_arr);
    song.timebre_8_skewness = Statistics.sampleSkewness(timebre8_arr);
    song.timebre_8_kurtosis = Statistics.sampleKurtosis(timebre8_arr);
    song.timebre_8_standard_deviation = Statistics.standardDeviation(timebre8_arr);
    song.timebre_8_80th_percentile = Statistics.quantile(timebre8_arr, 0.8);
    song.timebre_8_min = Statistics.min(timebre8_arr);
    song.timebre_8_max = Statistics.max(timebre8_arr);
    song.timebre_8_range = song.timebre_8_max - song.timebre_8_min;
    song.timebre_8_median = Statistics.median(timebre8_arr);

    song.timebre_9_mean = Statistics.mean(timebre9_arr);
    song.timebre_9_variance = Statistics.variance(timebre9_arr);
    song.timebre_9_skewness = Statistics.sampleSkewness(timebre9_arr);
    song.timebre_9_kurtosis = Statistics.sampleKurtosis(timebre9_arr);
    song.timebre_9_standard_deviation = Statistics.standardDeviation(timebre9_arr);
    song.timebre_9_80th_percentile = Statistics.quantile(timebre9_arr, 0.8);
    song.timebre_9_min = Statistics.min(timebre9_arr);
    song.timebre_9_max = Statistics.max(timebre9_arr);
    song.timebre_9_range = song.timebre_9_max - song.timebre_9_min;
    song.timebre_9_median = Statistics.median(timebre9_arr);

    song.timebre_10_mean = Statistics.mean(timebre10_arr);
    song.timebre_10_variance = Statistics.variance(timebre10_arr);
    song.timebre_10_skewness = Statistics.sampleSkewness(timebre10_arr);
    song.timebre_10_kurtosis = Statistics.sampleKurtosis(timebre10_arr);
    song.timebre_10_standard_deviation = Statistics.standardDeviation(timebre10_arr);
    song.timebre_10_80th_percentile = Statistics.quantile(timebre10_arr, 0.8);
    song.timebre_10_min = Statistics.min(timebre10_arr);
    song.timebre_10_max = Statistics.max(timebre10_arr);
    song.timebre_10_range = song.timebre_10_max - song.timebre_10_min;
    song.timebre_10_median = Statistics.median(timebre10_arr);

    song.timebre_11_mean = Statistics.mean(timebre11_arr);
    song.timebre_11_variance = Statistics.variance(timebre11_arr);
    song.timebre_11_skewness = Statistics.sampleSkewness(timebre11_arr);
    song.timebre_11_kurtosis = Statistics.sampleKurtosis(timebre11_arr);
    song.timebre_11_standard_deviation = Statistics.standardDeviation(timebre11_arr);
    song.timebre_11_80th_percentile = Statistics.quantile(timebre11_arr, 0.8);
    song.timebre_11_min = Statistics.min(timebre11_arr);
    song.timebre_11_max = Statistics.max(timebre11_arr);
    song.timebre_11_range = song.timebre_11_max - song.timebre_11_min;
    song.timebre_11_median = Statistics.median(timebre11_arr);

    song.timebre_12_mean = Statistics.mean(timebre12_arr);
    song.timebre_12_variance = Statistics.variance(timebre12_arr);
    song.timebre_12_skewness = Statistics.sampleSkewness(timebre12_arr);
    song.timebre_12_kurtosis = Statistics.sampleKurtosis(timebre12_arr);
    song.timebre_12_standard_deviation = Statistics.standardDeviation(timebre12_arr);
    song.timebre_12_80th_percentile = Statistics.quantile(timebre12_arr, 0.8);
    song.timebre_12_min = Statistics.min(timebre12_arr);
    song.timebre_12_max = Statistics.max(timebre12_arr);
    song.timebre_12_range = song.timebre_12_max - song.timebre_12_min;
    song.timebre_12_median = Statistics.median(timebre12_arr);

    //console.log('calculateAudioAnalysis success', song);

    return song;
}


async function putTrackAudioAnalysis(trackid, audioAnalysis) {
    console.log('Put track audio analysis', trackid);
    var audioAnalysisValue;
    var audioFeatures = await getTrackAudioFeatures(trackid);
    if (audioFeatures == undefined) {
        console.log('Audio feature value not found');
        return;
    }
    //console.log('Audio feature value:', audioFeatures);
    var audioFeaturesFilter = await filterAudioFeatureForAnalysis(audioFeatures);
    //console.log('Audio feature filter value:', audioFeaturesFilter);
    //console.log('Number audio analysis key', Object.keys(audioAnalysis).length);
    for (var key of Object.keys(audioAnalysis)) {
        if (audioAnalysisValue == undefined) {
            audioAnalysisValue = audioAnalysis[key];
        } else {
            audioAnalysisValue = audioAnalysisValue + ';' + audioAnalysis[key];
        }
    }

    var value = audioFeaturesFilter + ";" + audioAnalysisValue
    //console.log('Audio analysis value:', value);
    putSync(`track.${trackid}.analysis`, value);

}

function filterAudioFeatureForAnalysis(audioFeatures) {
    var features = audioFeatures.split(";");
    var result;
    for (var i = 5; i < features.length; i++) {
        if (result == undefined) {
            result = features[i];
        } else {
            result = result + ";" + features[i];
        }
    }
    return result;
}


// get audio features of a track
async function getTrackAudioFeatures(trackId) {
    console.log('Get track audio feature for :', trackId);
    var dataFromDatabase = await getTrackAudioFeaturesFromDatabase(trackId);

    //console.log('Audio feature from database :', dataFromDatabase);
    if (dataFromDatabase != undefined) {
        console.log('Return track audio feature from database :', trackId);
        return dataFromDatabase;
    }

    var dataFromAPI = await getTrackAudioFeaturesFromAPI(trackId);
    console.log('Return track audio feature from api :', trackId, dataFromAPI);
    return dataFromAPI;
    ;
}

// get audio features of a track from database
function getTrackAudioFeaturesFromDatabase(trackId) {
    console.log('get audio feature from database');
    return new Promise((resolve, reject) => {
        get(`track.${trackId}.feature`, (err, value) => {
            if (!err) {
                //console.log('get audio feature from database success:', value);
                resolve(value);
            }
            else {
                //console.log('get audio feature from database not found');
                resolve(undefined);
            }
        });
    });
}


// get audio features of a track from Spotify API
async function getTrackAudioFeaturesFromAPI(trackId) {
    var audioFeaturesValue;
    console.log('Get audio feature from api:', trackId);
    await spotifyApi.getAudioFeaturesForTrack(trackId)
        .then(async function (data) {
            console.log('Get audio feature one track success');
            var audioFeatures = data.body;
            putTrackAudioFeature(audioFeatures);

            audioFeaturesValue = audioFeatures.speechiness + ';' + audioFeatures.acousticness + ';' + audioFeatures.instrumentalness + ';'
                + audioFeatures.liveness + ';' + audioFeatures.valence + ';' + audioFeatures.duration_ms + ';' + audioFeatures.tempo + ';' + audioFeatures.time_signature + ';'
                + audioFeatures.mode + ';' + audioFeatures.key + ';' + audioFeatures.loudness + ';' + audioFeatures.danceability + ';' + audioFeatures.energy;
        }, function (err) {
            console.error('Get audio feature one track error', err);
        });
    return audioFeaturesValue;
}

function putChartData(genre, date, trackInfoList) {
    console.log("Put chart data: ", genre, date);
    var dateFormat = convertDate(date);
    //console.log("Date format", dateFormat);
    var dateKey = dateFormat.day + dateFormat.month + dateFormat.year;
    putSync(`chart.${dateKey}.${genre}.date`, dateFormat.day + '/' + dateFormat.month + '/' + dateFormat.year);
    putSync(`chart.${dateKey}.${genre}.numbertrack`, trackInfoList.length);

    var trackIdChart = [];
    for (var trackInfo of trackInfoList) {
        var position = trackInfo.position;
        if (trackInfo.trackId != undefined) {
            trackIdChart[position - 1] = trackInfo.trackId;
        }
        else {
            trackIdChart[position - 1] = '';
        }
    }
    var trackIdsValue = trackIdChart.join(";")
    //console.log('Chart track ids:', trackIdsValue);
    putSync(`chart.${dateKey}.${genre}`, trackIdsValue);
}

function convertDate(date) {
    // 19 May 2013 -  25 May 2013
    if (date == undefined) {
        return;
    }
    var stringArray = date.split(" ");
    if (stringArray.length < 3) {
        return;
    }

    var day = stringArray[0];
    var month = stringArray[1].toLowerCase();
    var year = stringArray[2];
    var monthArray = ['january', 'february', 'farch', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    for (var i = 0; i < monthArray.length; i++) {
        if (month === monthArray[i]) {
            month = i + 1;
            break;
        }
    }

    if (month < 10) {
        month = '0' + month;
    }
    else {
        month = month.toString();
    }

    var date = {
        day: day,
        month: month,
        year: year
    }
    return date;
}
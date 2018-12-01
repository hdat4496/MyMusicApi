'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
const { getAudioAnalysisKey } = require('../helpers/utils');
//const { runData } = require('../helpers/data.js');
var Statistics = require("simple-statistics");
var SpotifyWebApi = require('spotify-web-api-node');

module.exports = {
    putTrackData: putTrackData,
    getTrackInforDataFromAPI: getTrackInforDataFromAPI,
    getTrackAudioAnalysis: getTrackAudioAnalysis,
    putTrackAudioAnalysisForDataset: putTrackAudioAnalysisForDataset,
    putTrackAudioFeature: putTrackAudioFeature,
    getTrackAudioFeatures: getTrackAudioFeatures,
    getTrackInfo: getTrackInfo,
    getTrackInfoFromDatabase: getTrackInfoFromDatabase,
    getTrackGeneralInfo: getTrackGeneralInfo,
    getRecommendTrack: getRecommendTrack,
    searchTrackFromAPI: searchTrackFromAPI,
    searchArtistFromAPI: searchArtistFromAPI,
    getArtistFromDatabase: getArtistFromDatabase,
    getArtistInfo: getArtistInfo
};

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

// async function authenticateSpotify() {
//     // Set necessary parts of the credentials on the constructor
//     spotifyApi = new SpotifyWebApi({
//         clientId: '9858429e40ac4516838c142ae439f27b',
//         clientSecret: '0f0eadd372d94b19ab7c98f5d910fe4c'
//     });
//     // Get an access token and 'save' it using a setter
//     await spotifyApi.clientCredentialsGrant().then(
//         function (data) {
//             console.log('The access token is ' + data.body['access_token']);
//             spotifyApi.setAccessToken(data.body['access_token']);
//         },
//         function (err) {
//             console.log('Something went wrong!', err);
//         }
//     );
// }

async function putTrackData(tracks) {
    var trackInfoList = await getTrackInfoWhenCrawlData(tracks);
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
        return trackInfoList;
    }
    getAudioFeaturesAPI(newTrackIds);

    for (var trackId of newTrackIds) {
        var hasAnalysisInDatabase = await checkHasTrackAnalysis(trackId);
        if (hasAnalysisInDatabase == false) {
            getAudioAnalysisAPI(trackId);
        }
        else {
            console.log("Track has analysis in database");
        }
    }

    return trackInfoList;
}

async function getTrackInfoWhenCrawlData(tracks) {
    var trackInfoList = [];

    for (var track of tracks) {
        var trackInfo = await getTrackInforDataFromAPI(track.position, track.title, track.artist);
        //console.log("Get track info done: ", trackid);
        trackInfoList.push(trackInfo);
    }

    //console.log("Get all track info done: ", trackInfoList.length);
    return trackInfoList;
}

async function checkTrackExist(trackId) {
    //console.log('check track exist ?', trackId);
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

async function checkHasTrackAnalysis(trackId) {
    //console.log('check has track analysis exist ?', trackId);
    return new Promise((resolve, reject) => {
        get(`track.${trackId}.analysis`, (err, value) => {
            if (err) {
                //console.log('Track is not exist -> store new track');
                resolve(false);
            }
            else {
                resolve(true);
            }
        });
    });
}

async function getTrackInforDataFromAPI(position, title, artist) {
    //console.log('Search track: ', title, artist);
    var track = new Object;
    var trackId;
    var trackInfo;
    var albumId;
    var exist;
    await spotifyApi.searchTracks('track:' + title + ' artist:' + artist).then(
        async function (data) {
            var total = data.body.tracks.total;
            if (total == 0) {
                //console.log(title, ';', artist, '---------------NOT FOUND----------');
                return;
            }
            trackInfo = data.body.tracks.items[0];
            trackId = trackInfo.id;
            // check if track exist in database
            exist = await checkTrackExist(trackInfo.id);

            albumId = trackInfo.album.id;
            var artists = trackInfo.artists;
            var artistIds = [];
            for (var artist of artists) {
                artistIds.push(artist.id);
            }
            return artistIds;
        },
        function (err) {
            console.log('Search fail', err);
            //getTrackInforDataFromAPI(position, title, artist);
        }
    )
        .then(async function (artistIds) {
            //console.log("Get artist ", trackId);
            var artistInfo = await fetchArtist(artistIds, trackId);
            if (artistInfo == undefined || artistInfo.length < 2) {
                return;

            }
            var trackImageUrl = (trackInfo.album.images.length == 0) ? "" : trackInfo.album.images[0].url
            track.id = trackInfo.id;
            track.title = trackInfo.name;
            track.artist = artistInfo[0];
            track.artist_imageurl = artistInfo[1];
            track.track_url = (trackInfo.external_urls.spotify == undefined) ? '' : trackInfo.external_urls.spotify;
            track.track_preview_url = trackInfo.preview_url;
            track.track_imageurl = trackImageUrl;
            track.genre = '';
            track.genre_imageurl = '';
            //console.log("Put track info ", track.id);
            putTrackInfo(track);
        })
        .catch(e => {
            //console.log('Exception search track: ', e);
        });
    var trackInfoResult = {
        position: position,
        trackId: trackId,
        exist: exist
    }
    return trackInfoResult;
}

function getGenre(albumId) {

}

async function fetchArtist(artistIds, trackId) {
    if (artistIds == undefined) {
        //console.log("No artist ids");
        return;
    }
    var artistResult = [];
    await spotifyApi.getArtists(artistIds)
        .then(async function (data) {
            var artists = data.body.artists;
            var artistImageUrl;
            var artistNames = [];
            for (var artist of artists) {
                if (artist.images.length != 0) {
                    artistImageUrl = imageUrl;
                }
                var artistInfo = convertDataApiToArtist(artist);
                // put artist info
                putArtistInfo(artistInfo, trackId);
                artistNames.push(artist.name);
            }
            artistResult.push(artistNames.join(" ft "));
            artistResult.push((artistImageUrl == undefined) ? "" : artistImageUrl);
        }, function (err) {
            console.error('Get artist error:', err);
        });
    return artistResult;
}

// async function getGenre(albumId) {
//     var genre;
//     await spotifyApi.getAlbum(albumId)
//         .then(function (data) {
//             var result = data.body.audio_features;
//             for (var trackFeature of result) {
//                 putTrackAudioFeature(trackFeature);
//             }
//         }, function (err) {
//             console.error('Get audio feature list of track error:', err);
//         });
//     return genre;
// }

// get audio features of track list
function getAudioFeaturesAPI(trackIds) {
    console.log('Get audio feature:', trackIds);
    spotifyApi.getAudioFeaturesForTracks(trackIds)
        .then(function (data) {
            //console.log('Get audio feature list of track success');
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
    var analysis;
    console.log('Get audio analysis:', trackId);
    await spotifyApi.getAudioAnalysisForTrack(trackId)
        .then(async function (data) {
            //console.log('Get audio analysis success');
            var audioAnalysis = await calculateAudioAnalysis(data.body);
            analysis = await putTrackAudioAnalysis(trackId, audioAnalysis);
        }, async function (err) {
            //getAudioAnalysisAPI(trackId);
            console.error('Get audio analysis error', err);
            if (err.statusCode == 504) {
                await getAudioAnalysisAPI(trackId);
            }
        });
    return analysis;
}

function putTrackInfo(trackInfo) {
    //console.log("Put track info:", trackInfo.id);
    if (trackInfo.id == '') {
        return;
    }
    var info = trackInfo.title + ';' + trackInfo.artist + ';' + trackInfo.artist_imageurl + ';'
        + trackInfo.genre + ';' + trackInfo.genre_imageurl + ';' + trackInfo.track_url + ';' + trackInfo.track_imageurl + ';' + trackInfo.track_preview_url;
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
            //console.log('Add number of track', parseInt(value) + 1);
            putSync(`track.number`, parseInt(value) + 1);
        }
        else if (err.notFound) {
            putSync(`track.number`, 1);
        }
    });

    get(`track.all`, (err, value) => {
        if (!err) {
            //console.log('put track all list', trackInfo.id, trackInfo.title);
            var trackAllObject = JSON.parse(value);
            trackAllObject[trackInfo.id] = trackInfo.title;
            putSync(`track.all`, JSON.stringify(trackAllObject));
        }
        else if (err.notFound) {
            //console.log('put track all list first', trackInfo.id, trackInfo.title);
            var trackAllObject = new Object;
            trackAllObject[trackInfo.id] = trackInfo.title;
            putSync(`track.all`, JSON.stringify(trackAllObject));
        }
    });
}

function putTrackAudioFeature(audioFeatures) {
    //console.log("Put track audio features:", audioFeatures.id);
    if (audioFeatures == undefined) {
        return;
    }

    // speechiness;acousticness;instrumentalness;liveness;valence;duration_ms;tempo;time signature;mode;key;loudness;danceability;energy
    var audioFeaturesValue = audioFeatures.speechiness + ';' + audioFeatures.acousticness + ';' + audioFeatures.instrumentalness + ';'
        + audioFeatures.liveness + ';' + audioFeatures.valence + ';' + audioFeatures.duration_ms + ';' + audioFeatures.tempo + ';' + audioFeatures.time_signature + ';'
        + audioFeatures.mode + ';' + audioFeatures.key + ';' + audioFeatures.loudness + ';' + audioFeatures.danceability + ';' + audioFeatures.energy;

    putSync(`track.${audioFeatures.id}.feature`, audioFeaturesValue);

    //console.log("Put track audio features success:", audioFeatures.id);
    //console.log("Put track audio features success:", audioFeatures.id, audioFeaturesValue);
}


function putArtistInfo(artistInfo, trackId) {
    //console.log("Put artist:", artistInfo.id, trackId);
    if (artistInfo.id == '') {
        return;
    }
    get(`artist.${artistInfo.id}.track`, (err, value) => {
        // exist: update by adding track value
        if (!err) {
            var trackValue = value + ';' + trackId;
            putSync(`artist.${artistInfo.id}.track`, trackValue);
            putSync(`artist.${artistInfo.id}.name`, artistInfo.name);
            putSync(`artist.${artistInfo.id}.imageurl`, artistInfo.imageurl);
            putSync(`artist.${artistInfo.id}.genre`, artistInfo.genre);
        }
        else {
            // no exist in database: create new artist
            if (err.notFound) {
                putSync(`artist.${artistInfo.id}.name`, artistInfo.name);
                putSync(`artist.${artistInfo.id}.imageurl`, artistInfo.imageurl);
                putSync(`artist.${artistInfo.id}.track`, trackId);
                putSync(`artist.${artistInfo.id}.genre`, artistInfo.genre);
            }
        }
    });

    get(`artist.all`, (err, value) => {
        if (!err) {
            //console.log('put artist all list', artistInfo.id, artistInfo.name);
            var artistAllObject = JSON.parse(value);
            artistAllObject[artistInfo.id] = artistInfo.name;
            putSync(`artist.all`, JSON.stringify(artistAllObject));
        }
        else if (err.notFound) {
            //console.log('put artist all list', artistInfo.id, artistInfo.name);
            var artistAllObject = new Object;
            artistAllObject[artistInfo.id] = artistInfo.name;
            putSync(`artist.all`, JSON.stringify(artistAllObject));
        }
    });
}

function calculateAudioAnalysis(audioAnalysis) {
    //console.log('calculateAudioAnalysis')
    if (audioAnalysis == undefined) {
        return;
    }

    var song = new Object;
    var duration_arr = [];
    var timbre1_arr = [];
    var timbre2_arr = [];
    var timbre3_arr = [];
    var timbre4_arr = [];
    var timbre5_arr = [];
    var timbre6_arr = [];
    var timbre7_arr = [];
    var timbre8_arr = [];
    var timbre9_arr = [];
    var timbre10_arr = [];
    var timbre11_arr = [];
    var timbre12_arr = [];

    for (var beat of audioAnalysis.beats) {
        duration_arr.push(beat.duration);
    }
    if (duration_arr.length == 0) {
        console.log("Analysis beats empty:", duration_arr);
        return;
    }

    for (var segment of audioAnalysis.segments) {
        timbre1_arr.push(segment.timbre[0]);
        timbre2_arr.push(segment.timbre[1]);
        timbre3_arr.push(segment.timbre[2]);
        timbre4_arr.push(segment.timbre[3]);
        timbre5_arr.push(segment.timbre[4]);
        timbre6_arr.push(segment.timbre[5]);
        timbre7_arr.push(segment.timbre[6]);
        timbre8_arr.push(segment.timbre[7]);
        timbre9_arr.push(segment.timbre[8]);
        timbre10_arr.push(segment.timbre[9]);
        timbre11_arr.push(segment.timbre[10]);
        timbre12_arr.push(segment.timbre[11]);
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

    song.timbre_1_mean = Statistics.mean(timbre1_arr);
    song.timbre_1_variance = Statistics.variance(timbre1_arr);
    song.timbre_1_skewness = Statistics.sampleSkewness(timbre1_arr);
    song.timbre_1_kurtosis = Statistics.sampleKurtosis(timbre1_arr);
    song.timbre_1_standard_deviation = Statistics.standardDeviation(timbre1_arr);
    song.timbre_1_80th_percentile = Statistics.quantile(timbre1_arr, 0.8);
    song.timbre_1_min = Statistics.min(timbre1_arr);
    song.timbre_1_max = Statistics.max(timbre1_arr);
    song.timbre_1_range = song.timbre_1_max - song.timbre_1_min;
    song.timbre_1_median = Statistics.median(timbre1_arr);

    song.timbre_2_mean = Statistics.mean(timbre2_arr);
    song.timbre_2_variance = Statistics.variance(timbre2_arr);
    song.timbre_2_skewness = Statistics.sampleSkewness(timbre2_arr);
    song.timbre_2_kurtosis = Statistics.sampleKurtosis(timbre2_arr);
    song.timbre_2_standard_deviation = Statistics.standardDeviation(timbre2_arr);
    song.timbre_2_80th_percentile = Statistics.quantile(timbre2_arr, 0.8);
    song.timbre_2_min = Statistics.min(timbre2_arr);
    song.timbre_2_max = Statistics.max(timbre2_arr);
    song.timbre_2_range = song.timbre_2_max - song.timbre_2_min;
    song.timbre_2_median = Statistics.median(timbre2_arr);

    song.timbre_3_mean = Statistics.mean(timbre3_arr);
    song.timbre_3_variance = Statistics.variance(timbre3_arr);
    song.timbre_3_skewness = Statistics.sampleSkewness(timbre3_arr);
    song.timbre_3_kurtosis = Statistics.sampleKurtosis(timbre3_arr);
    song.timbre_3_standard_deviation = Statistics.standardDeviation(timbre3_arr);
    song.timbre_3_80th_percentile = Statistics.quantile(timbre3_arr, 0.8);
    song.timbre_3_min = Statistics.min(timbre3_arr);
    song.timbre_3_max = Statistics.max(timbre3_arr);
    song.timbre_3_range = song.timbre_3_max - song.timbre_3_min;
    song.timbre_3_median = Statistics.median(timbre3_arr);

    song.timbre_4_mean = Statistics.mean(timbre4_arr);
    song.timbre_4_variance = Statistics.variance(timbre4_arr);
    song.timbre_4_skewness = Statistics.sampleSkewness(timbre4_arr);
    song.timbre_4_kurtosis = Statistics.sampleKurtosis(timbre4_arr);
    song.timbre_4_standard_deviation = Statistics.standardDeviation(timbre4_arr);
    song.timbre_4_80th_percentile = Statistics.quantile(timbre4_arr, 0.8);
    song.timbre_4_min = Statistics.min(timbre4_arr);
    song.timbre_4_max = Statistics.max(timbre4_arr);
    song.timbre_4_range = song.timbre_4_max - song.timbre_4_min;
    song.timbre_4_median = Statistics.median(timbre4_arr);

    song.timbre_5_mean = Statistics.mean(timbre5_arr);
    song.timbre_5_variance = Statistics.variance(timbre5_arr);
    song.timbre_5_skewness = Statistics.sampleSkewness(timbre5_arr);
    song.timbre_5_kurtosis = Statistics.sampleKurtosis(timbre5_arr);
    song.timbre_5_standard_deviation = Statistics.standardDeviation(timbre5_arr);
    song.timbre_5_80th_percentile = Statistics.quantile(timbre5_arr, 0.8);
    song.timbre_5_min = Statistics.min(timbre5_arr);
    song.timbre_5_max = Statistics.max(timbre5_arr);
    song.timbre_5_range = song.timbre_5_max - song.timbre_5_min;
    song.timbre_5_median = Statistics.median(timbre5_arr);

    song.timbre_6_mean = Statistics.mean(timbre6_arr);
    song.timbre_6_variance = Statistics.variance(timbre6_arr);
    song.timbre_6_skewness = Statistics.sampleSkewness(timbre6_arr);
    song.timbre_6_kurtosis = Statistics.sampleKurtosis(timbre6_arr);
    song.timbre_6_standard_deviation = Statistics.standardDeviation(timbre6_arr);
    song.timbre_6_80th_percentile = Statistics.quantile(timbre6_arr, 0.8);
    song.timbre_6_min = Statistics.min(timbre6_arr);
    song.timbre_6_max = Statistics.max(timbre6_arr);
    song.timbre_6_range = song.timbre_6_max - song.timbre_6_min;
    song.timbre_6_median = Statistics.median(timbre6_arr);

    song.timbre_7_mean = Statistics.mean(timbre7_arr);
    song.timbre_7_variance = Statistics.variance(timbre7_arr);
    song.timbre_7_skewness = Statistics.sampleSkewness(timbre7_arr);
    song.timbre_7_kurtosis = Statistics.sampleKurtosis(timbre7_arr);
    song.timbre_7_standard_deviation = Statistics.standardDeviation(timbre7_arr);
    song.timbre_7_80th_percentile = Statistics.quantile(timbre7_arr, 0.8);
    song.timbre_7_min = Statistics.min(timbre7_arr);
    song.timbre_7_max = Statistics.max(timbre7_arr);
    song.timbre_7_range = song.timbre_7_max - song.timbre_7_min;
    song.timbre_7_median = Statistics.median(timbre7_arr);

    song.timbre_8_mean = Statistics.mean(timbre8_arr);
    song.timbre_8_variance = Statistics.variance(timbre8_arr);
    song.timbre_8_skewness = Statistics.sampleSkewness(timbre8_arr);
    song.timbre_8_kurtosis = Statistics.sampleKurtosis(timbre8_arr);
    song.timbre_8_standard_deviation = Statistics.standardDeviation(timbre8_arr);
    song.timbre_8_80th_percentile = Statistics.quantile(timbre8_arr, 0.8);
    song.timbre_8_min = Statistics.min(timbre8_arr);
    song.timbre_8_max = Statistics.max(timbre8_arr);
    song.timbre_8_range = song.timbre_8_max - song.timbre_8_min;
    song.timbre_8_median = Statistics.median(timbre8_arr);

    song.timbre_9_mean = Statistics.mean(timbre9_arr);
    song.timbre_9_variance = Statistics.variance(timbre9_arr);
    song.timbre_9_skewness = Statistics.sampleSkewness(timbre9_arr);
    song.timbre_9_kurtosis = Statistics.sampleKurtosis(timbre9_arr);
    song.timbre_9_standard_deviation = Statistics.standardDeviation(timbre9_arr);
    song.timbre_9_80th_percentile = Statistics.quantile(timbre9_arr, 0.8);
    song.timbre_9_min = Statistics.min(timbre9_arr);
    song.timbre_9_max = Statistics.max(timbre9_arr);
    song.timbre_9_range = song.timbre_9_max - song.timbre_9_min;
    song.timbre_9_median = Statistics.median(timbre9_arr);

    song.timbre_10_mean = Statistics.mean(timbre10_arr);
    song.timbre_10_variance = Statistics.variance(timbre10_arr);
    song.timbre_10_skewness = Statistics.sampleSkewness(timbre10_arr);
    song.timbre_10_kurtosis = Statistics.sampleKurtosis(timbre10_arr);
    song.timbre_10_standard_deviation = Statistics.standardDeviation(timbre10_arr);
    song.timbre_10_80th_percentile = Statistics.quantile(timbre10_arr, 0.8);
    song.timbre_10_min = Statistics.min(timbre10_arr);
    song.timbre_10_max = Statistics.max(timbre10_arr);
    song.timbre_10_range = song.timbre_10_max - song.timbre_10_min;
    song.timbre_10_median = Statistics.median(timbre10_arr);

    song.timbre_11_mean = Statistics.mean(timbre11_arr);
    song.timbre_11_variance = Statistics.variance(timbre11_arr);
    song.timbre_11_skewness = Statistics.sampleSkewness(timbre11_arr);
    song.timbre_11_kurtosis = Statistics.sampleKurtosis(timbre11_arr);
    song.timbre_11_standard_deviation = Statistics.standardDeviation(timbre11_arr);
    song.timbre_11_80th_percentile = Statistics.quantile(timbre11_arr, 0.8);
    song.timbre_11_min = Statistics.min(timbre11_arr);
    song.timbre_11_max = Statistics.max(timbre11_arr);
    song.timbre_11_range = song.timbre_11_max - song.timbre_11_min;
    song.timbre_11_median = Statistics.median(timbre11_arr);

    song.timbre_12_mean = Statistics.mean(timbre12_arr);
    song.timbre_12_variance = Statistics.variance(timbre12_arr);
    song.timbre_12_skewness = Statistics.sampleSkewness(timbre12_arr);
    song.timbre_12_kurtosis = Statistics.sampleKurtosis(timbre12_arr);
    song.timbre_12_standard_deviation = Statistics.standardDeviation(timbre12_arr);
    song.timbre_12_80th_percentile = Statistics.quantile(timbre12_arr, 0.8);
    song.timbre_12_min = Statistics.min(timbre12_arr);
    song.timbre_12_max = Statistics.max(timbre12_arr);
    song.timbre_12_range = song.timbre_12_max - song.timbre_12_min;
    song.timbre_12_median = Statistics.median(timbre12_arr);

    //console.log('calculateAudioAnalysis success', song);

    return song;
}


async function putTrackAudioAnalysis(trackid, audioAnalysis) {
    //console.log('Put track audio analysis', trackid);
    var audioAnalysisValue;
    var audioFeatures = await getTrackAudioFeatures(trackid);
    if (audioFeatures == undefined || audioAnalysis == undefined) {
        //console.log('Audio feature value not found');
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
    return value;

}
// put data from arff file to database
async function putTrackAudioAnalysisForDataset(audioAnalysis) {
    var audioAnalysisValue;
    var trackid = audioAnalysis.id;
    var analysis_key = getAudioAnalysisKey();
    for (var key of analysis_key) {
        if (audioAnalysisValue == undefined) {
            audioAnalysisValue = audioAnalysis[key];
        } else {
            audioAnalysisValue = audioAnalysisValue + ';' + audioAnalysis[key];
        }
    }
    //console.log('Audio analysis value:', trackid);
    putSync(`track.${trackid}.analysis`, audioAnalysisValue);
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
    //console.log('Get track audio feature for :', trackId);
    var dataFromDatabase = await getTrackAudioFeaturesFromDatabase(trackId);

    //console.log('Audio feature from database :', dataFromDatabase);
    if (dataFromDatabase != undefined) {
        //console.log('Return track audio feature from database :', trackId);
        return dataFromDatabase;
    }

    var dataFromAPI = await getTrackAudioFeaturesFromAPI(trackId);
    //console.log('Return track audio feature from api :', trackId, dataFromAPI);
    return dataFromAPI;
    ;
}

// get audio features of a track from database
function getTrackAudioFeaturesFromDatabase(trackId) {
    //console.log('get audio feature from database');
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
    //console.log('Get audio feature from api:', trackId);
    await spotifyApi.getAudioFeaturesForTrack(trackId)
        .then(async function (data) {
            //console.log('Get audio feature one track success');
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


// get audio analysis of a track
async function getTrackAudioAnalysis(trackId) {
    console.log('Get track audio analysis for :', trackId);
    var dataFromDatabase = await getTrackAnalysisFromDatabase(trackId);

    //console.log('Analysis from database :', dataFromDatabase);
    if (dataFromDatabase != undefined) {
        console.log('Return track analysis from database :', trackId);
        return dataFromDatabase;
    }
    var dataFromAPI = await getAudioAnalysisAPI(trackId);
    if (dataFromAPI == undefined) {
        console.log("Get track analysis from api error");
        return;
    }
    dataFromAPI = convertAnalysis(dataFromAPI.split(";"), trackId);
    console.log('Return track analysis from api :', trackId);
    return dataFromAPI;
}

async function getTrackAnalysisFromDatabase(trackId) {
    var trackAnalysis;
    return new Promise((resolve, reject) => {
        get(`track.${trackId}.analysis`, async (err, value) => {
            if (!err) {
                var analysis_value = value.split(";");
                trackAnalysis = convertAnalysis(analysis_value, trackId);
                resolve(trackAnalysis);
            }
            else {
                console.log('Get track analysis error', err);
                resolve(undefined);
            }
        });
    });
}

function convertAnalysis(analysis_value, trackId) {
    var trackAnalysis = new Object;
    var analysis_key = getAudioAnalysisKey();
    if (analysis_value.length != analysis_key.length) {
        console.log('Convert analysis error: track analysis length is invalid: ', analysis_value);
        return;
    }
    for (var i = 0; i < analysis_value.length; i++) {
        var key = analysis_key[i];
        trackAnalysis[key] = analysis_value[i];
    }
    return trackAnalysis;
}

// get detail infor of a track
async function getTrackInfo(trackId) {
    var trackInfo = new Object;
    console.log('Get track detail for :', trackId);
    await checkTrackExist(trackId)
        .then(async function () {
            console.log("Get track infor from API");
            trackInfo = await getTrackInfoFromAPI(trackId);
            console.log("Track", trackInfo);
            if (trackInfo[id] != undefined) {
                trackInfo[like] = 0;
                trackInfo[listen] = 0;
                trackInfo[lyric] = '';
                var list = [trackId];
                getAudioFeaturesAPI(list);
                var hasAnalysisInDatabase = await checkHasTrackAnalysis(trackId);
                if (hasAnalysisInDatabase == false) {
                    getAudioAnalysisAPI(trackId);
                }
            }
        })
        .catch(async function () {
            trackInfo = await getTrackInfoFromDatabase(trackId);
        });
    return trackInfo;
}
// Get track info from API
async function getTrackInfoFromAPI(trackId) {
    //console.log('Get track info from API: ', trackId);
    var track = new Object;
    var trackInfo;
    var albumId;
    await spotifyApi.getTrack(trackId).then(
        async function (data) {
            trackInfo = data.body;
            if (trackInfo == '') {
                return;
            }

            albumId = trackInfo.album.id;
            var artists = trackInfo.artists;
            var artistIds = [];
            for (var artist of artists) {
                artistIds.push(artist.id);
            }
            return artistIds;
        },
        function (err) {
            console.log('Get track fail', err);
        }
    )
        .then(async function (artistIds) {
            if (artistIds == undefined) {
                return;
            }
            //console.log("Get artist ", trackId);
            var artistInfo = await fetchArtist(artistIds, trackId);
            if (artistInfo == undefined || artistInfo.length < 2) {
                return;

            }
            var trackImageUrl;
            if (trackInfo.album.images.length == 0) {
                trackImageUrl = "";
            }
            else {
                trackImageUrl = trackInfo.album.images[0].url
            }
            track.id = trackInfo.id;
            track.title = trackInfo.name;
            track.artist = artistInfo[0];
            track.artist_imageurl = artistInfo[1];
            track.track_url = (trackInfo.external_urls.spotify == undefined) ? '' : trackInfo.external_urls.spotify;
            track.track_preview_url = trackInfo.preview_url;
            track.track_imageurl = trackImageUrl;
            track.genre = '';
            track.genre_imageurl = '';
            //console.log("Put track info ", track.id);
            putTrackInfo(track);
        })
        .catch(e => {
            //console.log('Exception search track: ', e);
        });
    return track;
}

const like = 'like';
const listen = 'listen';
const lyric = 'lyric';
// Get track info from databse
async function getTrackInfoFromDatabase(trackId) {
    var track = new Object;
    var trackGeneralInfo = await getTrackGeneralInfo(trackId);
    if (trackGeneralInfo == undefined) {
        return;
    }
    track = trackGeneralInfo;
    var trackLike = await getTrackInfoExtra(trackId, like);
    track[like] = (trackLike == undefined) ? 0 : trackLike;

    var trackListen = await getTrackInfoExtra(trackId, listen);
    track[listen] = (trackListen == undefined) ? 0 : trackListen;

    var trackLyric = await getTrackInfoExtra(trackId, lyric);
    track[lyric] = (trackLyric == undefined) ? '' : trackLyric;
    return track;
}

function getTrackGeneralInfo(trackId) {
    return new Promise((resolve, reject) => {
        get(`track.${trackId}.info`, (err, value) => {
            if (!err) {
                var trackInfo = value.split(";");
                var track = new Object;
                track.id = trackId;
                track.title = trackInfo[0];
                track.artist = trackInfo[1];
                track.artist_imageurl = trackInfo[2];
                track.genre = trackInfo[3];
                track.genre_imageurl = trackInfo[4];
                track.track_url = trackInfo[5];
                track.track_imageurl = trackInfo[6];
                track.track_preview_url = trackInfo[7];
                resolve(track);
            }
            else {
                resolve(undefined);
            }
        });
    });
}


// Get track like/listen/lyric
function getTrackInfoExtra(trackId, infoType) {
    return new Promise((resolve, reject) => {
        get(`track.${trackId}.${infoType}`, (err, value) => {
            if (err) {
                resolve(value);
            }
            else {
                resolve(undefined);
            }
        });
    });
}
const recommendTrackNumber = 5;
// get recommend track from Spotify API
async function getRecommendTrack(trackId) {
    var recommendTracks = [];
    console.log('Get recommend track:', trackId);
    await spotifyApi.getRecommendations({ limit: recommendTrackNumber, seed_tracks: [trackId] })
        .then(async function (data) {
            //console.log('Get recommend tracks success:', data.body);
            recommendTracks = convertDataApiToTrackList(data.body.tracks);
        }, async function (err) {
            console.error('Get recommend tracks error', err);
        });
    //console.log(recommendTracks);
    return recommendTracks;
}
async function searchTrackFromAPI(key) {
    //console.log('search track from API: ', key);
    var trackList = [];
    await spotifyApi.searchTracks(key).then(
        async function (data) {
            var total = data.body.tracks.total;
            if (total == 0) {
                return trackList;
            }
            trackList = convertDataApiToTrackList(data.body.tracks.items);
        },
        function (err) {
            console.log('Search track from api fail', key, err);
        }
    );
    return trackList;
}

function convertDataApiToTrackList(tracksData) {
    var trackList = [];
    for (var trackInfo of tracksData) {
        var artists = trackInfo.artists;
        var artistNames = [];
        for (var artist of artists) {
            artistNames.push(artist.name);
        }
        var trackImageUrl = (trackInfo.album.images.length == 0) ? "" : trackInfo.album.images[0].url;
        var track = new Object;
        track.id = trackInfo.id;
        track.title = trackInfo.name;
        track.artist = artistNames.join(" ft ");
        track.track_imageurl = trackImageUrl;
        trackList.push(track);
    }
    return trackList;
}

async function searchArtistFromAPI(name) {
    //console.log('search artist from API: ', name);
    var artistList = [];
    await spotifyApi.searchArtists(name).then(
        async function (data) {
            //console.log(data.body.artists);
            var total = data.body.artists.total;
            if (total == 0) {
                return artistList;
            }
            var artistsData = data.body.artists.items;
            for (var artistInfo of artistsData) {
                var artist = convertDataApiToArtist(artistInfo);
                artistList.push(artist);
            }
        },
        function (err) {
            console.log('Search artist from api fail', err);
        }
    );
    return artistList;
}

function convertDataApiToArtist(artistInfo) {
    var imageUrl = (artistInfo.images.length == 0) ? "" : artistInfo.images[0].url;;
    var genreList = artistInfo.genres;
    var genre = (genreList.length == 0) ? '' : genreList.join(";");
    var artist = new Object;
    artist.id = artistInfo.id;
    artist.name = artistInfo.name;
    artist.imageurl = imageUrl;
    artist.genre = genre;
    return artist;
}

async function getArtistInfo(artistId) {
    var artist = new Object;
    var artistTracks = [];
    var artistInfo = await getArtistFromDatabase(artistId);
    if (artistInfo == undefined) {
        console.log("Get artist info from api", artistId);
        artistInfo = await getArtistFromAPI(artistId);
    }
    if (artistInfo != undefined) {
        artist.info = artistInfo;
        artistTracks = await getTrackOfArtist(artistId);
        artist.tracks = (artistTracks == undefined) ? [] : artistTracks;
    }
    return artist;
}

async function getArtistFromAPI(artistId) {
    var artist;
    await spotifyApi.getArtist(artistId).then(
        function (data) {
            //console.log(data.body);
            var artistsData = data.body;
            artist = convertDataApiToArtist(artistsData);
        },
        function (err) {
            console.log('Search artist from api fail', err);
        }
    );
    return artist;
}

function getArtistFromDatabase(artistId) {
    return new Promise(async (resolve, reject) => {
        var artist = new Object;
        var name = await getArtistInfoByKey(artistId, "name");
        if (name == undefined) {
            resolve(undefined);
        }
        artist.id = artistId;
        artist.name = name;
        var imageurl = await getArtistInfoByKey(artistId, "imageurl");
        artist.imageurl = (imageurl == undefined) ? "" : imageurl;
        var genre = await getArtistInfoByKey(artistId, "genre");
        artist.genre = (genre == undefined) ? "" : genre;
        resolve(artist);
    });
}
function getArtistInfoByKey(artistId, info) {
    return new Promise((resolve, reject) => {
        get(`artist.${artistId}.${info}`, (err, value) => {
            if (!err) {
                resolve(value);
            }
            else {
                resolve(undefined);
            }
        });
    });
}

async function getTrackOfArtist(artistId) {
    //var artistTracks = [];
    var artistTracks = await getTrackOfArtistFromDatabase(artistId);
    if (artistTracks != undefined) {
        console.log("Get track of artist info from database", artistTracks);
        return artistTracks;
    }
    artistTracks = await getTrackOfArtistFromAPI(artistId);
    return artistTracks;
}

async function getTrackOfArtistFromDatabase(artistId) {
    var tracksString = await getArtistInfoByKey(artistId, "track");
    if (tracksString == undefined) {
        return;
    }
    var trackIds = tracksString.split(";");
    var trackList = [];
    for (var trackId of trackIds) {
        var track = await getTrackInfoFromDatabase(trackId);
        if (track != undefined) {
            trackList.push(track);
        }
    }
    console.log("track artist db", trackList.length);
    return trackList;
}

async function getTrackOfArtistFromAPI(artistId) {
    var trackList;
    await spotifyApi.getArtistTopTracks(artistId,'ES').then(
        function (data) {
            //console.log(data.body.tracks);
            var trackData = data.body.tracks;
            trackList = convertDataApiToTrackList(trackData);
        },
        function (err) {
            console.log('Get top track artist from api fail', err);
        }
    );
    return trackList;

}
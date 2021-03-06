'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
//const { runData } = require('../helpers/data.js');

module.exports = {
    convertDate: convertDate,
    getChartDateList: getChartDateList,
    getAudioAnalysisKey: getAudioAnalysisKey,
    getGenreName: getGenreName,
    convertDateToString: convertDateToString,
    convertStringToDate: convertStringToDate,
    getRandomInt: getRandomInt,
    getGenreTypeList: getGenreTypeList,
    shuffle: shuffle,
    getGenreType: getGenreType
};

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
    var monthArray = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
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

function convertDateToString(originDate) {
    var date = new Date(originDate);
    var day = date.getDate();
    var month = date.getMonth() + 1;
    var year = date.getFullYear();
    var day_str = day.toString();
    var month_str = month.toString();
    var year_str = year.toString();
    if (day < 10) {
        day_str = "0" + day_str;
    }
    if (month < 10) {
        month_str = "0" + month_str;
    }

    return day_str + month_str + year_str;
}
const daysInterval = 7;
const dayChangeMilestone = new Date("2015-07-05");
function getChartDateList(startDate, endDate) {
    startDate = new Date(startDate);
    endDate = new Date(endDate);

    if (startDate > endDate) {
        console.log("Chart date is invalid");
        return;
    }

    if (endDate > new Date()) {
        endDate = new Date()
    }
    var realStartDate = findStartDate(startDate);
    var dateList = [];
    endDate = new Date(endDate);
    while (realStartDate <= endDate) {
        var day = realStartDate.getDate();
        var month = realStartDate.getMonth() + 1;
        var year = realStartDate.getFullYear();
        var day_str = day.toString();
        var month_str = month.toString();
        var year_str = year.toString();
        if (day < 10) {
            day_str = "0" + day_str;
        }
        if (month < 10) {
            month_str = "0" + month_str;
        }
        // before 2015-07-05, chart is released on Sunday. After that, chart is released on Friday
        if (realStartDate.getTime() == dayChangeMilestone.getTime()) {
            realStartDate = new Date(realStartDate.setTime(realStartDate.getTime() + 5 * 86400000));
        }
        else {
            realStartDate = new Date(realStartDate.setTime(realStartDate.getTime() + daysInterval * 86400000));
        }
        var date = {
            day: day_str,
            month: month_str,
            year: year_str
        }
        dateList.push(date);
    }
    //console.log("Date list:", dateList);
    return dateList;
}

const FriDayIndex = 5;
const SundayIndex = 0;

function findStartDate(startDate) {
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var startDate = new Date(startDate);
    var dayOfWeek = startDate.getDay();
    var dayReleased;
    // before 2015-07-05, chart is released on Sunday. After that, chart is released on Friday
    if (startDate <= dayChangeMilestone) {
        dayReleased = SundayIndex;
    }
    else {
        dayReleased = FriDayIndex;
    }
    //console.log("Day released:", days[dayReleased]);
    if (dayOfWeek == dayReleased) {
        return startDate;
    }

    var dayAdd = dayReleased - dayOfWeek;
    if (dayAdd < 0) {
        dayAdd = 7 + dayAdd;
    }
    //console.log("Day add:", dayAdd);
    return new Date(startDate.setTime(startDate.getTime() + dayAdd * 86400000));
}
function convertStringToDate(value) {
    var dateArray = value.split("/");
    if (dateArray.length < 3) {
        console.log("chart lasted date type ", value, " is not valid");
        return;
    }
    var date = new Date();
    date.setFullYear(parseInt(dateArray[2]), parseInt(dateArray[1]) - 1, parseInt(dateArray[0]));
    return date;
}


function getRandomInt(min, max) {
    return Math.floor(Math.random() * Math.floor(max) + min);
}


function getAudioAnalysisKey() {
    return analysis_key;
}

function getGenreTypeList() {
    return genreTypeList;
}
const genreTypeList = [4, 1, 2, 3];
const dance = "dance";
const rb = "R&B";
const rock = "rock";
const all = "all";
function getGenreName(genreType) {
    switch (genreType) {
        case genreTypeList[1]:
            return dance;
        case genreTypeList[2]:
            return rock;
        case genreTypeList[3]:
            return rb;
        default:
            return all;
    }
}

function getGenreType(genreName) {
    switch (genreName) {
        case dance:
            return genreTypeList[1];
        case rock:
            return genreTypeList[2];
        case rb:
            return genreTypeList[3];
        case all:
            return genreTypeList[0];
        default:
            return -1;
    }
}
function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}
const analysis_key =
    ['duration_ms',
        'tempo',
        'time_signature',
        'mode',
        'key',
        'loudness',
        'danceability',
        'energy',

        'beatdiff_mean',
        'beatdiff_variance',
        'beatdiff_skewness',
        'beatdiff_kurtosis',
        'beatdiff_standard_deviation',
        'beatdiff_80th_percentile',
        'beatdiff_min',
        'beatdiff_max',
        'beatdiff_range',
        'beatdiff_median',

        'timbre_1_mean',
        'timbre_1_variance',
        'timbre_1_skewness',
        'timbre_1_kurtosis',
        'timbre_1_standard_deviation',
        'timbre_1_80th_percentile',
        'timbre_1_min',
        'timbre_1_max',
        'timbre_1_range',
        'timbre_1_median',

        'timbre_2_mean',
        'timbre_2_variance',
        'timbre_2_skewness',
        'timbre_2_kurtosis',
        'timbre_2_standard_deviation',
        'timbre_2_80th_percentile',
        'timbre_2_min',
        'timbre_2_max',
        'timbre_2_range',
        'timbre_2_median',

        'timbre_3_mean',
        'timbre_3_variance',
        'timbre_3_skewness',
        'timbre_3_kurtosis',
        'timbre_3_standard_deviation',
        'timbre_3_80th_percentile',
        'timbre_3_min',
        'timbre_3_max',
        'timbre_3_range',
        'timbre_3_median',

        'timbre_4_mean',
        'timbre_4_variance',
        'timbre_4_skewness',
        'timbre_4_kurtosis',
        'timbre_4_standard_deviation',
        'timbre_4_80th_percentile',
        'timbre_4_min',
        'timbre_4_max',
        'timbre_4_range',
        'timbre_4_median',

        'timbre_5_mean',
        'timbre_5_variance',
        'timbre_5_skewness',
        'timbre_5_kurtosis',
        'timbre_5_standard_deviation',
        'timbre_5_80th_percentile',
        'timbre_5_min',
        'timbre_5_max',
        'timbre_5_range',
        'timbre_5_median',

        'timbre_6_mean',
        'timbre_6_variance',
        'timbre_6_skewness',
        'timbre_6_kurtosis',
        'timbre_6_standard_deviation',
        'timbre_6_80th_percentile',
        'timbre_6_min',
        'timbre_6_max',
        'timbre_6_range',
        'timbre_6_median',

        'timbre_7_mean',
        'timbre_7_variance',
        'timbre_7_skewness',
        'timbre_7_kurtosis',
        'timbre_7_standard_deviation',
        'timbre_7_80th_percentile',
        'timbre_7_min',
        'timbre_7_max',
        'timbre_7_range',
        'timbre_7_median',

        'timbre_8_mean',
        'timbre_8_variance',
        'timbre_8_skewness',
        'timbre_8_kurtosis',
        'timbre_8_standard_deviation',
        'timbre_8_80th_percentile',
        'timbre_8_min',
        'timbre_8_max',
        'timbre_8_range',
        'timbre_8_median',

        'timbre_9_mean',
        'timbre_9_variance',
        'timbre_9_skewness',
        'timbre_9_kurtosis',
        'timbre_9_standard_deviation',
        'timbre_9_80th_percentile',
        'timbre_9_min',
        'timbre_9_max',
        'timbre_9_range',
        'timbre_9_median',

        'timbre_10_mean',
        'timbre_10_variance',
        'timbre_10_skewness',
        'timbre_10_kurtosis',
        'timbre_10_standard_deviation',
        'timbre_10_80th_percentile',
        'timbre_10_min',
        'timbre_10_max',
        'timbre_10_range',
        'timbre_10_median',

        'timbre_11_mean',
        'timbre_11_variance',
        'timbre_11_skewness',
        'timbre_11_kurtosis',
        'timbre_11_standard_deviation',
        'timbre_11_80th_percentile',
        'timbre_11_min',
        'timbre_11_max',
        'timbre_11_range',
        'timbre_11_median',

        'timbre_12_mean',
        'timbre_12_variance',
        'timbre_12_skewness',
        'timbre_12_kurtosis',
        'timbre_12_standard_deviation',
        'timbre_12_80th_percentile',
        'timbre_12_min',
        'timbre_12_max',
        'timbre_12_range',
        'timbre_12_median']


// var Crawler = require("crawler");
// var c = new Crawler({
//     maxConnections: 1,
//     // This will be called for each crawled page
//     callback: async function (error, res, done) {
//         if (error) {
//             console.log(error);
//         } else {
//             // $ is Cheerio by default
//             //a lean implementation of core jQuery designed specifically for the server
//             var $ = res.$;
//             var tracks = [];
//             var date = $('.article-date').first().text().trim();
//             console.log(date);
//             var genre = res.options.genreType;

//             $('.chart-positions').find('tr').not('.headings').not('.mobile-actions')
//                 .not('.actions-view').each((_, ele) => {
//                     var position = $(ele).find('.position').text().trim();
//                     var title = $(ele).find('.title').text().trim();
//                     var artist = $(ele).find('.artist').text().trim();

//                     title = normalizeTitle(title);
//                     artist = normalizeArtistName(artist);
//                     if ((position == '') || (title == '') || (artist == '')) {
//                         return;
//                     }
//                     var track = {
//                         position: position,
//                         title: title,
//                         artist: artist,
//                         genre: genre
//                     }
//                     tracks.push(track);
//                 });
//         }
//         done();
//     }
// });

// // Queue just one URL, with default callback
// c.queue({
//     uri: 'https://www.officialcharts.com/charts/dance-singles-chart/20181130/104/',
//     genreType: 'dance'
// })
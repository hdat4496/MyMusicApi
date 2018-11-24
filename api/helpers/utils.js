'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
//const { runData } = require('../helpers/data.js');

module.exports = {
    convertDate: convertDate,
    getChartDateList: getChartDateList,
    getAudioAnalysisKey: getAudioAnalysisKey,
    getGenreName: getGenreName,
    convertDateToString: convertDateToString
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
const dayChangeMilestone = new Date("07/05/2015");
function getChartDateList(startDate, endDate) {
    if (startDate > endDate) {
        console.log("Chart date is invalid");
        return;
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
        // before 07/05/2015, chart is released on Sunday. After that, chart is released on Friday
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
    // before 07/05/2015, chart is released on Sunday. After that, chart is released on Friday
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

function getAudioAnalysisKey() {
    return analysis_key;
}

const dance = "dance";
const rb = "R&B";
const rock = "rock";
const all = "all";
function getGenreName(genreType) {
    switch(genreType) {
        case 1:
            return dance;
        case 2: 
            return rock;
        case 3:
            return rb;
        default:
            return all;
    }
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

        'timebre_1_mean',
        'timebre_1_variance',
        'timebre_1_skewness',
        'timebre_1_kurtosis',
        'timebre_1_standard_deviation',
        'timebre_1_80th_percentile',
        'timebre_1_min',
        'timebre_1_max',
        'timebre_1_range',
        'timebre_1_median',

        'timebre_2_mean',
        'timebre_2_variance',
        'timebre_2_skewness',
        'timebre_2_kurtosis',
        'timebre_2_standard_deviation',
        'timebre_2_80th_percentile',
        'timebre_2_min',
        'timebre_2_max',
        'timebre_2_range',
        'timebre_2_median',

        'timebre_3_mean',
        'timebre_3_variance',
        'timebre_3_skewness',
        'timebre_3_kurtosis',
        'timebre_3_standard_deviation',
        'timebre_3_80th_percentile',
        'timebre_3_min',
        'timebre_3_max',
        'timebre_3_range',
        'timebre_3_median',

        'timebre_4_mean',
        'timebre_4_variance',
        'timebre_4_skewness',
        'timebre_4_kurtosis',
        'timebre_4_standard_deviation',
        'timebre_4_80th_percentile',
        'timebre_4_min',
        'timebre_4_max',
        'timebre_4_range',
        'timebre_4_median',

        'timebre_5_mean',
        'timebre_5_variance',
        'timebre_5_skewness',
        'timebre_5_kurtosis',
        'timebre_5_standard_deviation',
        'timebre_5_80th_percentile',
        'timebre_5_min',
        'timebre_5_max',
        'timebre_5_range',
        'timebre_5_median',

        'timebre_6_mean',
        'timebre_6_variance',
        'timebre_6_skewness',
        'timebre_6_kurtosis',
        'timebre_6_standard_deviation',
        'timebre_6_80th_percentile',
        'timebre_6_min',
        'timebre_6_max',
        'timebre_6_range',
        'timebre_6_median',

        'timebre_7_mean',
        'timebre_7_variance',
        'timebre_7_skewness',
        'timebre_7_kurtosis',
        'timebre_7_standard_deviation',
        'timebre_7_80th_percentile',
        'timebre_7_min',
        'timebre_7_max',
        'timebre_7_range',
        'timebre_7_median',

        'timebre_8_mean',
        'timebre_8_variance',
        'timebre_8_skewness',
        'timebre_8_kurtosis',
        'timebre_8_standard_deviation',
        'timebre_8_80th_percentile',
        'timebre_8_min',
        'timebre_8_max',
        'timebre_8_range',
        'timebre_8_median',

        'timebre_9_mean',
        'timebre_9_variance',
        'timebre_9_skewness',
        'timebre_9_kurtosis',
        'timebre_9_standard_deviation',
        'timebre_9_80th_percentile',
        'timebre_9_min',
        'timebre_9_max',
        'timebre_9_range',
        'timebre_9_median',

        'timebre_10_mean',
        'timebre_10_variance',
        'timebre_10_skewness',
        'timebre_10_kurtosis',
        'timebre_10_standard_deviation',
        'timebre_10_80th_percentile',
        'timebre_10_min',
        'timebre_10_max',
        'timebre_10_range',
        'timebre_10_median',

        'timebre_11_mean',
        'timebre_11_variance',
        'timebre_11_skewness',
        'timebre_11_kurtosis',
        'timebre_11_standard_deviation',
        'timebre_11_80th_percentile',
        'timebre_11_min',
        'timebre_11_max',
        'timebre_11_range',
        'timebre_11_median',

        'timebre_12_mean',
        'timebre_12_variance',
        'timebre_12_skewness',
        'timebre_12_kurtosis',
        'timebre_12_standard_deviation',
        'timebre_12_80th_percentile',
        'timebre_12_min',
        'timebre_12_max',
        'timebre_12_range',
        'timebre_12_median']

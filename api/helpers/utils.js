'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
//const { runData } = require('../helpers/data.js');

module.exports = {
    convertDate: convertDate,
    getChartDateList: getChartDateList
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

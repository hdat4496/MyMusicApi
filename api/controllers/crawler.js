'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
//const { runData } = require('../helpers/data.js');
const { getChartDateList, convertDate, getGenreTypeList, getGenreName } = require('../helpers/utils');
const { putTrackData, getTrackGeneralInfo } = require('../controllers/spotify');
const { putChartData, putChartAnalysis } = require('../controllers/chart');
var Crawler = require("crawler");

module.exports = {
    crawl: crawl    
};

function crawl(req, res) {
    var startDate = req.swagger.params.startDate.value;
    var endDate = req.swagger.params.endDate.value;
    var genreType = req.swagger.params.genreType.value;
    if (startDate == undefined || endDate == undefined || genreType == undefined) {
        res.json({ status: 400, value: "You should select all start date, end date and genre!" });
        return;
    }
    startDate = new Date(startDate);
    endDate = new Date(endDate);
    if (startDate > endDate) {
        res.json({ status: 400, value: "Start date must be before end date!" });
        return;
    }
    crawlData(startDate, endDate, genreType)
    .then(function(result) {
        res.json({ status: 200, value: result });
    })
    .catch(e => {
        res.json({ status: 400, value: e });
    })
   
}

function crawlData(startDate, endDate, genreType) {
    return new Promise(async (resolve, reject) => {
        console.log('Crawl data');
        var result = []
        var urlList = createUrlList(startDate, endDate, genreType);
        if (urlList.length == 0) {
            reject("No date chart found")
        }
        var i = 0;
        console.log("url list:", urlList.length);
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
                    var genre = res.options.genreType;
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
                            artist: artist,
                            genre: genre
                        }
                        tracks.push(track);
                    });
    
                    console.log('Crawled data length: ', tracks.length);
                    var trackList = await putData(genre, date, tracks);
                    result = result.concat(trackList);
                    i = i + 1;
                    if (i == urlList.length) {
                        resolve(result);
                    }
                }
                done();
            }
        });
        c.queue(urlList);
    })
}

async function putData(genre, date, tracks) {
    var trackInfoList = await putTrackData(tracks);
    await putChartData(genre, date, trackInfoList);
    var dateFormat = convertDate(date);
    var dateKey = dateFormat.day + dateFormat.month + dateFormat.year;
    putChartAnalysis(dateKey, genre);
    var result = []
    for (var track of trackInfoList) {
        if (track.trackId == undefined) {
            continue;
        }
        var trackResult = await getTrackGeneralInfo(track.trackId);
        trackResult.date = dateFormat.day + "/" + dateFormat.month + "/" +dateFormat.year;
        trackResult.genre = getGenreName(genre)
        trackResult.position = track.position
        result.push(trackResult);
    }
    return result;
}

function normalizeTitle(title) {
    if (title.includes("(")) {
        var pos = title.indexOf("(");
        var title_re = title.substr(pos);
        title = title.replace(title_re, " ");
    }

    while (title.includes("'")) {
        title = title.replace("'", "");
    }
   
    return title;
}

function normalizeArtistName(artist) {
    while (artist.includes(" FT ")) {
        artist = artist.replace(" FT ", " OR ");
    }

    while (artist.includes(" VS ")) {
        artist = artist.replace(" VS ", " OR ");
    }

    while (artist.includes(" / ")) {
        artist = artist.replace(" / ", " OR ");
    }

    while (artist.includes(" & ")) {
        artist = artist.replace(" & ", " OR ");
    }

    while (artist.includes(" FEATURING ")) {
        artist = artist.replace(" FEATURING ", " OR ");
    }

    return artist;
}

const dancePageId = '/104/';
const danceBaseUrl = 'https://www.officialcharts.com/charts/dance-singles-chart/';
const rockPageId = '/111/';
const rockBaseUrl = 'https://www.officialcharts.com/charts/rock-and-metal-singles-chart/';
const rbPageId = '/114/';
const rbBaseUrl = 'https://www.officialcharts.com/charts/r-and-b-singles-chart/';
const allBaseUrl = 'https://www.officialcharts.com/charts/singles-chart/';
const allPageId = '/7501/'

function createUrlList(startDate, endDate, genreType) {
    genreType = parseInt(genreType);
    //console.log("Genre type",genreType);
    var result = [];
    var urlInfo = getUrlInfo(genreType);
    if (urlInfo == undefined || urlInfo.baseUrl == undefined || urlInfo.pageId == undefined) {
        console.log("Not get url info");
        return;
    }
    var dateList = getChartDateList(startDate, endDate);
    for (var date of dateList) {
        var date_str = date.year + date.month + date.day;
        var url = urlInfo.baseUrl + date_str + urlInfo.pageId;
        var urlResult = {
            uri: url,
            genreType: genreType
        }
        result.push(urlResult)
    }

    return result;
}

function getUrlInfo(genreType) {
    var baseUrl;
    var pageId;
    var genreTypeList = getGenreTypeList();
    switch (genreType) {
        case genreTypeList[1]:
            baseUrl = danceBaseUrl;
            pageId = dancePageId;
            break;
        case genreTypeList[2]:
            baseUrl = rockBaseUrl;
            pageId = rockPageId;
            break;
        case genreTypeList[3]:
            baseUrl = rbBaseUrl;
            pageId = rbPageId;
            break;
        default:
            baseUrl = allBaseUrl;
            pageId = allPageId;
    }
    var result = {
        baseUrl: baseUrl,
        pageId: pageId
    }
    return result;
}


'use strict';

const { get, putSync } = require('../helpers/db');
const { generateToken, checkToken } = require('../helpers/token');
// const { runData } = require('../helpers/data.js');
var Crawler = require("crawler");

module.exports = {
    crawl: crawl,
};

function crawl(req, res) {
    var c = new Crawler({
        maxConnections : 10,
        // This will be called for each crawled page
        callback : function (error, res, done) {
            if(error){
                console.log(error);
            }else{
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


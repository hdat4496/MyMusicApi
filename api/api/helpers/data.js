var { putSync } = require('./db');

function runData() {
    // Track
    putSync('track.1.url', 'spotify:track:11dFghVXANMlKmJXsNCbNl');
    putSync('track.1.title', 'We don\'t talk anymore');
    putSync('track.1.artist.1', 'Charlie Puth;https://i.scdn.co/image/966ade7a8c43b72faa53822b74a899c675aaafee'); // value contains: artist name, artist image url
    putSync('track.1.artist.2', 'Selena Gomes;https://i.scdn.co/image/107819f5dc557d5d0a4b216781c6ec1b2f3c5ab2');
    putSync('track.1.artist.count', 2);
    putSync('track.1.genres', 'dance;rock;R&B');
    putSync('track.1.charts', 'dance.1;dance.2');
    putSync('track.1.imageurl', 'https://i.scdn.co/image/107819f5dc557d5d0a4b216781c6ec1b2f3c5ab2');
    putSync('track.1.listen', 1);
    putSync('track.1.like', 1);
    // Track's musical features: 143 features
    putSync('track.1.speechiness', '0.7');
    putSync('track.1.acousticness', '0.5');
    putSync('track.1.beatdiff_mean', '0.5');


    putSync('track.lastedid',1);


    // Artist
    putSync('artist.1.name', 'Charlie Puth');
    putSync('artist.1.imageurl', 'https://i.scdn.co/image/966ade7a8c43b72faa53822b74a899c675aaafee');
    putSync('artist.1.track', '1;2;3;4');
    putSync('artist.2.name', 'Selena Gomez');
    putSync('artist.2.imageurl', 'https://i.scdn.co/image/966ade7a8c43b72faa53822b74a899c675aaafee');
    putSync('artist.2.track', '1;2;3;4');

    putSync('artist.lastedid',2);
    

    // Gerne
    putSync('genre.1.name', 'dance');
    putSync('genre.1.track', '1;2;3;4');
    putSync('genre.1.imageurl.1', 'https://i.scdn.co/image/966ade7a8c43b72faa53822b74a899c675aaafee');
    putSync('genre.1.imageurl.2', 'https://i.scdn.co/image/966ade7a8c43b72faa53822b74a899c675aaafee');
    putSync('genre.2.name', 'R&B');
    putSync('genre.2.track', '1;2;3;4');
    putSync('genre.2.imageurl.1', 'https://i.scdn.co/image/966ade7a8c43b72faa53822b74a899c675aaafee');
    putSync('genre.2.imageurl.2', 'https://i.scdn.co/image/966ade7a8c43b72faa53822b74a899c675aaafee');

    putSync('genre.lastedid',2);

    // Chart
    putSync('chart.1.1.date', '03/08/2018');
    putSync('chart.1.1.numbertrack', 9);
    putSync('chart.1.1.1', '2;0.5;0.6;0.7;134;0.9;...;0.9'); //format is (chart.[genre_id].[chart_id].[position], [track_id];[music_feature_1];[music_feature_2];...;[music_feature_143];)
    putSync('chart.1.1.2', '1;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.1.1.3', '4;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.1.1.4', '6;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.1.1.5', '3;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.1.1.6', '6;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.1.1.7', '8;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.1.1.8', '12;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.1.1.9', '20;0.5;0.6;0.7;134;0.9;...;0.9'); 

    putSync('chart.1.lastedid', 1);


    putSync('chart.2.1.date', '03/08/2018');
    putSync('chart.2.1.numbertrack', 9);
    putSync('chart.2.1.2', '11;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.2.1.3', '40;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.2.1.4', '61;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.2.1.5', '31;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.2.1.6', '62;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.2.1.7', '80;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.2.1.8', '21;0.5;0.6;0.7;134;0.9;...;0.9'); 
    putSync('chart.2.1.9', '22;0.5;0.6;0.7;134;0.9;...;0.9'); 

    putSync('chart.rock.lastedid', 1);

}

runData();
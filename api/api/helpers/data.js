var { putSync } = require('./db');

function runData() {
    // user
    putSync('u.toan', 'jZae727K08KaOmKSgOaGzww/XVqGr/PKEgIMkjrcbJI=');
    putSync('u.toan.status', 'hôm nay chán quá');
    putSync('u.toan.cons', '1;2');
    putSync('u.toan.groups', '1');
    putSync('u.toan.user', 'thao;hoang');
    
    putSync('u.thao', 'jZae727K08KaOmKSgOaGzww/XVqGr/PKEgIMkjrcbJI=');
    putSync('u.thao.status', 'trời đẹp');
    putSync('u.thao.cons', '1;3');
    putSync('u.thao.groups', '1');
    putSync('u.thao.user', 'toan;hoang');

    putSync('u.hoang', 'jZae727K08KaOmKSgOaGzww/XVqGr/PKEgIMkjrcbJI=');
    putSync('u.hoang.status', 'Ngày vui');
    putSync('u.hoang.cons', '3;2');
    putSync('u.hoang.groups', '1');
    putSync('u.hoang.user', 'toan;thao');

    putSync('con.1.user', 'toan;thao');
    putSync('con.1.lastedmsg', 2);
    putSync('con.1.msg.1', Date.now() + ';toan;chào');
    putSync('con.1.msg.2', Date.now() + ';thao;hê hê');
    putSync('con.1.read.toan', 2);
    putSync('con.1.read.thao', 2);

    putSync('con.2.user', 'toan;hoang');
    putSync('con.2.lastedmsg', 3);
    putSync('con.2.msg.1', Date.now() + ';toan;chào');
    putSync('con.2.msg.2', Date.now() + ';hoang;hê hê');
    putSync('con.2.msg.3', Date.now() + ';hoang;hi hi');
    putSync('con.2.read.toan', 2);
    putSync('con.2.read.hoang', 3);

    putSync('con.3.user', 'thao;hoang');
    putSync('con.3.lastedmsg', 3);
    putSync('con.3.msg.1', Date.now() + ';thao;chào hoang');
    putSync('con.3.msg.2', Date.now() + ';thao;mình là thảo');
    putSync('con.3.msg.3', Date.now() + ';hoang;chào thảo');
    putSync('con.3.read.thao', 1);
    putSync('con.3.read.hoang', 3);

    putSync('con.lastedid', 3);


    putSync('group.1', 'zpx');
    putSync('group.1.user', 'toan;thao;hoang');
    putSync('group.1.lastedmsg', 5);
    putSync('group.1.msg.1', Date.now() +';toan;hello mọi người!');
    putSync('group.1.msg.2', Date.now() +';toan;mình là toàn');
    putSync('group.1.msg.3', Date.now() +';thao;hi!!!');
    putSync('group.1.msg.4', Date.now() +';hoang;hello!');
    putSync('group.1.msg.5', Date.now() +';hoang;zalopay!');
    putSync('group.1.read.toan', 2);
    putSync('group.1.read.thao', 3);
    putSync('group.1.read.hoang', 5);

    putSync('group.lastedid', 1);

    putSync('u.all.user', 'toan;hoang;thao');



}

runData();
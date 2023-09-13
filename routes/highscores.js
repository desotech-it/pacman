var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Database = require('../lib/database');
var AWS = require('aws-sdk');
var crypto = require('crypto');

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })

// Create the DynamoDB service object
var ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' })

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
    console.log('Time: ', Date());
    next();
})

router.get('/list', urlencodedParser, function (req, res, next) {
    console.log('[GET /highscores/list]');

    Database.getDb(req.app, function (err, db) {
        if (err) {
            return next(err);
        }

        // Retrieve the top 10 high scores
        var col = db.collection('highscore');
        col.find({}).sort([['score', -1]]).limit(10).toArray(function (err, docs) {
            var result = [];
            if (err) {
                console.log(err);
            }

            docs.forEach(function (item, index, array) {
                result.push({
                    name: item['name'], cloud: item['cloud'],
                    zone: item['zone'], host: item['host'],
                    score: item['score']
                });
            });

            res.json(result);
        });
    });

    // code here
    var params = {
        TableName: 'highscore',
        ScanIndexForward: false,
    }
    var result = [];
    ddb.scan(params, function (err, data) {
        if (err) {
            console.log("Error", err);
        } else {
            console.log("Success", data);
            data.Items.forEach(function (element, index, array) {
                result.push({
                    name: element.Name.S,
                    cloud: element.Cloud.S,
                    zone: element.Zone.S,
                    host: element.Host.S,
                    score: element.Score.N,
                });
            });
            res.json(result);
        }
    });
});

// Accessed at /highscores
router.post('/', urlencodedParser, function (req, res, next) {
    console.log('[POST /highscores] body =', req.body,
        ' host =', req.headers.host,
        ' user-agent =', req.headers['user-agent'],
        ' referer =', req.headers.referer);

    var userScore = parseInt(req.body.score, 10),
        userLevel = parseInt(req.body.level, 10);

    var params = {
        TableName: 'highscore',
        Item: {
            UUID: { S: crypto.randomUUID() },
            Name: { S: req.body.name },
            Cloud: { S: req.body.cloud },
            Zone: { S: req.body.zone },
            Host: { S: req.body.host },
            Score: { N: req.body.score },
            Level: { N: req.body.level },
            Date: { S: new Date().toISOString() },
            Referer: { S: req.headers.referer },
            UserAgent: { S: req.headers['user-agent'] },
            Hostname: { S: req.hostname },
            IpAddr: { S: req.ip },
        }
    };

    ddb.putItem(params, function (err, data) {
        if (err) {
            console.log("Error writing to DynamoDB", err);
        } else {
            console.log("Success writing to DynamoDB", data);
        }
    });

    Database.getDb(req.app, function (err, db) {
        if (err) {
            return next(err);
        }

        // Insert high score with extra user data
        db.collection('highscore').insertOne({
            name: req.body.name,
            cloud: req.body.cloud,
            zone: req.body.zone,
            host: req.body.host,
            score: userScore,
            level: userLevel,
            date: Date(),
            referer: req.headers.referer,
            user_agent: req.headers['user-agent'],
            hostname: req.hostname,
            ip_addr: req.ip
        }, {
            w: 'majority',
            j: true,
            wtimeout: 10000
        }, function (err, result) {
            var returnStatus = '';

            if (err) {
                console.log(err);
                returnStatus = 'error';
            } else {
                console.log('Successfully inserted highscore');
                returnStatus = 'success';
            }

            res.json({
                name: req.body.name,
                zone: req.body.zone,
                score: userScore,
                level: userLevel,
                rs: returnStatus
            });
        });
    });
});

module.exports = router;

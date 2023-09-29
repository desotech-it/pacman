var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
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

    // code here
    var params = {
        TableName: 'highscore',
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
            result.sort((a, b) => {
                if (a.score > b.score) return 1;
                if (a.score < b.score) return -1;
                return 0;
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
});

module.exports = router;

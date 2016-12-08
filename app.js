var express = require('express');
var bodyParser = require('body-parser');
var slack = require('./routes/slack.js');
var schedule = require('node-schedule');

var app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// choose whatever port we want to listen on
var port = process.env.PORT || 8080;

// middleware to use for all requests
// set the response headers
app.use(function(req, res, next) {
	// do logging
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Save-Data");
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	res.setHeader('Access-Control-Allow-Credentials', false);
	next(); // make sure we go to the next routes and don't stop here
});

var j = schedule.scheduleJob({hour: 00, minute: 00}, function(){
    walk.on('dir', function (dir, stat) {
       uploadDir.push(dir);
    });
});


app.use('/', slack);

app.listen(port, function() {
	console.log('Running on port ' + port);
});

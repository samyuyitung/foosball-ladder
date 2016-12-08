var firebase = require("firebase");
var fs = require('fs');
var config = {
	"apiKey": process.env.FIREBASE_API_KEY,
	"authDomain": process.env.FIREBASE_PROJECT_ID,
	"databaseURL": process.env.FIREBASE_DATEBASE_NAME
}
if (fs.existsSync('../config.json'))
	config = require('../config.json').firebase

firebase.initializeApp(config);


ref = firebase.database().ref('users/');
module.exports = {

	addNewUser: function(userId, name, message) {
		ref.once('value', function(snapshot) {
			if (!snapshot.hasChild(userId)) {
				ref.child(userId).set({
					username: name,
					slackId: userId,
					elo: 1500,
					wins: 0,
					losses: 0,
					goalsFor: 0,
					goalsAgainst: 0,
					lastPlayed: 0,
					streak: 'W0',
					shutouts: 0
				});
				message(true);
			} else
				message(false);
		});
	},

	removeUser: function(userId) {
		ref.child(userId).remove();
	},

	getLadder: function(callback) {
		var ladder = [];
		ref.once('value', function(snapshot) {
			snapshot.forEach(function(data) {
				if (data.val().wins + data.val().losses != 0)
					ladder.push({
						name: data.val().username,
						elo: data.val().elo
					});
			});
			ladder.sort(function(a, b) {
				return a.elo - b.elo;
			}).reverse();
			callback(ladder);
		});
	},

	getProfile: function(userId, callback) {
		ref.child(userId).once('value', function(snapshot) {
			callback(snapshot.val());
		});
	},

	updateRatings: function(players) {
		players.forEach(function(player) {
			ref.once('value', function(snapshot) {
				if (snapshot.hasChild(player.slackId)) {
					ref.child(player.slackId).update(player);
				}
			});
		});
	}
}

var firebase = require("firebase");
firebase.initializeApp(require('../config.json').firebase);


ref = firebase.database().ref('users/');
module.exports = {

	addNewUser: function(userId, name, message) {
		//CHECK IF EXISTS FIRST
		ref.once('value', function(snapshot) {
			if (!snapshot.hasChild(userId)) {
				ref.child(userId).set({
					username: name,
					slackId: userId,
					elo: 1500,
					wins: 0,
					losses: 0,
					gamesPlayed: 0,
					goalsFor: 0,
					goalsAgainst: 0,
					streak: 'W0'
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

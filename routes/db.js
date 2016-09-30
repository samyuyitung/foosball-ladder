var firebase = require("firebase");
firebase.initializeApp(require('../config.json').firebase);



module.exports = {
	
	addNewUser: function (userId, name) {
		//CHECK IF EXISTS FIRST
		firebase.database().ref('users/' + name).set({
			username: name,
			slackId: userId,
			elo: 1500,
			wins: 0,
			losses: 0,
			goalsFor: 0,
			goalsAgainst: 0
		});
	},

	removeUser: function (name){
		firebase.database().ref('users/').remove(name);
	},

	getLadder: function(){
		var ladder = [];
		firebase.database().ref('users/').once('value', function(snapshot) {
			snapshot.forEach(function(data){
				ladder.push({
					name: data.val().username, 
					elo: data.val().elo
				});
			});
		ladder.sort(function(a, b) {
			return a.elo - b.elo;
		});

		return ladder;
		});
	}

}
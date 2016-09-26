var firebase = require("firebase");
firebase.initializeApp(require('../config.json').firebase);

var ted = 12;


module.exports = {
	
	addNewUser: function (userId, name) {
		//CHECK IF EXISTS FIRST
		firebase.database().ref('users/' + name).set({
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
	setTed: function (val){
		ted = val;
	},
	getTed: function (){
		return ted; 
	}

}
var request = require("request");
var express = require('express');
var router = express.Router();

var dbconnector = require('./db.js');
var gameManager = require('./game.js');

var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM;
var MemoryDataStore = require('@slack/client').MemoryDataStore;

var botId;
var token = require('../config.json').slackKey;

var rtm = new RtmClient(token, {
	logLevel: 'error',
	dataStore: new MemoryDataStore()
});
rtm.start();

//Get the bot name
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function(rtmStartData) {
	botId = rtmStartData.self.id;
});

/*
 * detect when a message is sent,
 */
rtm.on(RTM_EVENTS.MESSAGE, function(message) {

	if (message.text) {
		//TODO MAKE IT NOT WORK FOR EDITS no body
		messageText = message.text;
		//Check if bot is mentioned first (e.g. @foosbot .. message, NOT message .. @foosbot)
		if (isToBot(messageText)) {
			text = messageText.substr(botId.length + 4).trim();
			if (startsWith(text, "ladder")) {
				getLadder(message.channel);
			} else if (startsWith(text, "add")) {
				addUser(text, message.user, message.channel);
			} else if (startsWith(text, "remove")) {
				removeUser(text, message.user, message.channel);
			} else if (messageContains(text, "challenge")) {
				startGame(text, message.user, message.ts, message.channel);
			} else if (startsWith(text, "final score")) {
				endGame(text, message.user, message.channel);
			} else if (startsWith(text, "show")) {
				show(text, message.user, message.channel);
			}
		} else
			console.log(messageText);
	}
});

/*
 * detect when a reaction is added to a message
 */
rtm.on(RTM_EVENTS.REACTION_ADDED, function(message) {
	isChallengeMessage(message.item.ts, message.user, message.item.channel)
});

/*
 * Message functions
 */

/*
 * Add new user to the firebase database
 * Can add by ("me"): adds person who sent message
 * or by names specified
 */
function addUser(text, user, channel) {
	if (messageContains(text, "add me")) {
		// Check if they already exist
		var callback = function(added) {
			if (added) {
				rtm.sendMessage("adding @" + getUserById(user), channel);

				giphy("welcome", function(data) {
					rtm.sendMessage(data, channel);
				});
			} else {
				rtm.sendMessage("@" + getUserById(user) + " already exists", channel);
			}
		}
		dbconnector.addNewUser(user, getUserById(user), callback);
	} else if (text.match(/^add$/g)) {
		rtm.sendMessage("Who?", channel);
	} else if (text.match(/^add\s+[@|\w|\s]+/g)) {
		rtm.sendMessage("Ask them to add themselves", channel);
	}
}

function removeUser(text, user, channel) {
	if (messageContains(text, "remove me")) {
		dbconnector.removeUser(user);
		rtm.sendMessage("removed @" + getUserById(user) + " from the ladder", channel);
		giphy("bye bye", function(data) {
			rtm.sendMessage(" " + data, channel);
		});
	} else
		rtm.sendMessage("I cant remove anyone but you type `@" + getUserById(botId) + " remove me` to drop", channel);

}
/**
 * @param  {text} The message sent 
 * @param  {channel} The slack channel (to send back message)
 * @return {[type]}
 */
function startGame(text, userId, messageId, channel) {
	if (startsWith(text, "I") || startsWith(text, "me")) {
		var re = /@([\w]+)/g;
		var pivot = text.indexOf("challenge")
		team1 = [];
		team2 = [];

		team1.push({
			name: getUserById(userId),
			userId: userId,
			confirm: true
		});
		var m;
		while (m = re.exec(text)) {
			if (m.index < pivot) {
				team1.push({
					name: getUserById(m[1]),
					userId: m[1],
					confirm: false
				});
			} else {
				team2.push({
					name: getUserById(m[1]),
					userId: m[1],
					confirm: false
				});
			}
		}
		var str = gameManager.setPotentialMatch({
			messageId: messageId,
			team1: team1,
			team2: team2
		});
		if (!str) {
			playerString = "";
			team1.concat(team2).forEach(function(player) {
				if (player.userId !== userId)
					playerString += "<@" + player.userId + "> ";
			});
			rtm.sendMessage("Waiting for " + playerString + " to react toy your message", channel);
		} else {
			rtm.sendMessage(str, channel);
		}
	} else {
		rtm.sendMessage("To use enter `[I/me and <user>] challenge <people>", channel);
	}
}

function isChallengeMessage(messageId, userId, channel) {
	if (gameManager.isChallengeMessageToUser(messageId, userId)) {
		match = gameManager.allConfirmMatch(messageId);
		if (match) {
			var team1msg = "";
			match.team1.forEach(function(player) {
				team1msg += player.name + " ";
			});

			var team2msg = "";
			match.team2.forEach(function(player) {
				team2msg += player.name + " ";
			});
			str = gameManager.startGame(match.team1, match.team2);
			giphy("Game on", function(data) {
				rtm.sendMessage(" " + data, channel);
			});
			rtm.sendMessage("Starting: " + team1msg + "vs. " + team2msg, channel);
			rtm.sendMessage("Msg me again when the game is over with the score", channel);
		}
	}
}

function endGame(text, user, channel) {
	score = gameManager.parseScore(text, user);

	if (score) {
		gameManager.endGame(score, user, function(str) {
			rtm.sendMessage(str, channel);
		})
	} else
		rtm.sendMessage("What was the score", channel);

}


function getLadder(channel) {
	dbconnector.getLadder(function(ladder) {
		var str = "";
		var rank = 1;
		ladder.forEach(function(user) {
			str += rank++ + ". " + user.name + " - " + user.elo + "\n";
		});
		if (str === "")
			str = "Ain't no people here!!!!"
		rtm.sendMessage(str, channel);
	});
}

function show(text, user, channel) {
	if (text.endsWith(" stats")) {
		showStats(text, user, channel);
	}
}

function showStats(text, user, channel) {
	var person = user;
	var re = /@(\w+)/
	if (text.match(re)) {
		person = text.match(re)[1];
	}
	dbconnector.getProfile(person, function(data) {
		str = "Elo: " + data.elo + "\n" + "Record: " + data.wins + " - " + data.losses + "\n" + "Goal differnetial: " + (data.goalsFor - data.goalsAgainst) + "\n" + "Current Streak: " + data.streak + "\n" + "Last played: " + data.lastPlayed;
		rtm.sendMessage(str, channel);
	})
}
/*
 * HELPER FUNCTIONS 
 */
function isToBot(text) {
	return (text.indexOf("@" + botId) == 1);
}

function messageContains(message, str) {
	//change to regex match? to prevent sub stringing
	return message.toLowerCase().includes(str.toLowerCase());
}

function startsWith(message, str) {
	//change to regex match? to prevent sub stringing
	return message.toLowerCase().indexOf(str.toLowerCase()) == 0;
}

function getUserById(id) {
	return rtm.dataStore.getUserById(id).name;
}


function giphy(term, callback) {
	request("http://api.giphy.com/v1/gifs/search?q=" + term + "&api_key=dc6zaTOxFJmzC", function(error, response, body) {
		var data = JSON.parse(body);
		var max = data.data.length;
		var min = 0;
		var randomNumber = Math.floor(Math.random() * (max));
		callback(data.data[randomNumber].images.downsized.url);
	});
}
module.exports = router;

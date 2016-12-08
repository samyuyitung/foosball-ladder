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
var token = process.env.SLACK_KEY || require('../config.json').slackKey;

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
			if (startsWith(text, 'help')) {
				helpMessage(message.channel);
			} else if (startsWith(text, "add")) {
				addUser(text, message.user, message.channel);
			} else if (startsWith(text, "remove")) {
				removeUser(text, message.user, message.channel);
			} else if (messageContains(text, "challenge")) {
				startGame(text, message.user, message.ts, message.channel);
			} else if (startsWith(text, "final score")) {
				endGame(text, message.user, message.ts, message.channel);
			} else if (startsWith(text, "show")) {
				show(text, message.user, message.channel);
			} else
				rtm.sendMessage("I dont know what you are trying to say, ask me help to learn what I can do", message.channel);
		} else
			console.log(messageText);
	}
});

//TODO: SMART EMOJI

/*
 * detect when a reaction is added to a message
 */
rtm.on(RTM_EVENTS.REACTION_ADDED, function(message) {
	if (message.reaction === '+1' || message.reaction == '-1') {
		if (isChallengeMessage(message.item.ts, message.user, message.item.channel)) {
			return;
		} else if (isMatchConfirmation(message.item.ts, message.user, message.item.channel)) {
			return;
		}
	}
});

/*
 * Message functions
 */

function helpMessage(channel) {
	var botName = "@" + getUserById(botId);
	var str = "Hi I'm Foosbot, Here is what I can do:\n" +
		"`" + botName + " add me` - add yourself to the ladder\n" +
		"`" + botName + " I challenge <person>` - Challenge someone to a 1 on 1 match\n" +
		"`" + botName + " me and <partner> challenge <opponent1> and <opponent2>` - Challenge others to a team game\n" +
		"`" + botName + " Final score # : #` - Report the final score of a match after it has been played\n" +
		"`" + botName + " show ladder` - Show the elo ladder\n" +
		"`" + botName + " show my stats` - Show your stats\n" +
		"`" + botName + " show <person> stats` - Show your stats\n" +
		"`" + botName + " remove me` - remove yourself to the ladder\n"
	rtm.sendMessage(str, channel);
	giphy("help", function(data) {
		rtm.sendMessage(" " + data, channel);
	});
}

function addUser(text, user, channel) {
	if (messageContains(text, "add me")) {
		var callback = function(added) {
			if (added) {
				rtm.sendMessage("adding " + mentionUser(user), channel);
				giphy("welcome", function(data) {
					rtm.sendMessage(data, channel);
				});
			} else {
				rtm.sendMessage(mentionUser(user) + " already exists", channel);
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
		rtm.sendMessage("removed " + mentionUser(user) + " from the ladder", channel);
		giphy("bye bye", function(data) {
			rtm.sendMessage(" " + data, channel);
		});
	} else
		rtm.sendMessage("I cant remove anyone but you type `@" + getUserById(botId) + " remove me` to drop out", channel);

}

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
					playerString += mentionUser(player.userId);
			});
			rtm.sendMessage("Waiting for " + playerString + "to react to your message", channel);
		} else {
			rtm.sendMessage(str, channel);
		}
	} else {
		rtm.sendMessage("To use enter `[I/me and <user>] challenge <opponent1> <opponent2>", channel);
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
			rtm.sendMessage("Message me again when the game is over with the score", channel);
		}
		return true;
	}
	return false;
}

function endGame(text, user, messageId, channel) {
	var score = gameManager.parseScore(text, user);
	if (score) {
		gameManager.endGame(score, user, messageId, function(str) {
			rtm.sendMessage(str, channel);
		})
	} else
		rtm.sendMessage("What was the score", channel);
}


function isMatchConfirmation(messageId, userId, channel) {
	if (gameManager.isFinalScoreConfirmation(messageId, userId)) {
		match = gameManager.allConfirmFinalScore(messageId);
		if (match) {
			str = gameManager.updateStats(messageId, function(str) {
				rtm.sendMessage(str, channel);
			});
		}
		return true;
	}
	return false;
}

function show(text, user, channel) {
	if (text.toLowerCase().endsWith(" stats")) {
		showStats(text, user, channel);
	} else if (text.toLowerCase().endsWith(" ladder")) {
		showLadder(channel);
	}
}

function showLadder(channel) {
	dbconnector.getLadder(function(ladder) {
		var str = "";
		var rank = 1;
		ladder.forEach(function(user) {
			str += rank++ + ". " + user.name + " - " + user.elo + "\n";
		});
		if (str === "")
			str = "The ladder is empty, you need to play at least 1 game to be on the ladder\n" +
			"Psst, You should add yourself with `" + mentionUser(botId) + "add me`"
		rtm.sendMessage(str, channel);
	});
}


function showStats(text, user, channel) {
	var person = user;
	var re = /@(\w+)/
	if (text.match(re)) {
		person = text.match(re)[1];
	}
	dbconnector.getProfile(person, function(data) {
		var str = ""
		if (data) {
			var date = new Date(Number(data.lastPlayed - 18000000)).toISOString()
				.replace(/T/, ' ') // replace T with a space
				.replace(/\..+/, '')
			str = "Elo: " + data.elo + "\n" +
				"Record: " + data.wins + " - " + data.losses + "\n" +
				"Goal differnetial: " + (data.goalsFor - data.goalsAgainst) + "\n" +
				"Current Streak: " + data.streak + "\n" +
				"Last played: " + date;
		} else
			str = "What are you doing? You don't exist, add yourself with `" + mentionUser(botId) + "add me`"
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
	return message.toLowerCase().includes(str.toLowerCase());
}

function startsWith(message, str) {
	return message.toLowerCase().indexOf(str.toLowerCase()) == 0;
}

function getUserById(id) {
	if (rtm.dataStore.getUserById(id))
		return rtm.dataStore.getUserById(id).name;
	return null;
}

function mentionUser(userId) {
	return "<@" + userId + "> ";
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

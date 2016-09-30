var express = require('express');
var router = express.Router();

var dbconnector = require('./db.js');
var game  = require('./game.js');

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
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
	botId = rtmStartData.self.id;
});

/*
 * detect when a message is sent,
 */
rtm.on(RTM_EVENTS.MESSAGE, function (message) {

	//TODO MAKE IT NOT WORK FOR EDITS no body

	messageText = message.text;
	//Check if @elo-bot is mentioned first (e.g. @foosbot .. message, NOT message .. @foosbot)
	if (isToBot(messageText)) {
		text = messageText.substr(messageText.indexOf(" ") + 1);
		if(messageContains(text, "ladder")){
			console.log(dbconnector.getLadder());
		} else if(messageContains(text, "add")){
			addUser(text, message.user, message.channel);
		} else if(messageContains(text, "new game")){
			startGame(text, message.channel);
		}
	}
});

/*
 * detect when a reaction is added to a message
 */ 
rtm.on(RTM_EVENTS.REACTION_ADDED, function (message) {
	console.log(message);
	if(isToBot(message.item_user)){
		console.log(getUserById(message.user) + " did " + message.reaction);
	}
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
	if(messageContains(text, "me")){
		dbconnector.addNewUser(user, getUserById(user));
		rtm.sendMessage("adding " + getUserById(user), channel);
	} else {
		var people = text.match(/@(\w+)/g);
		var users = "";
		people.forEach(function(id){
			id = id.substr(1);
			dbconnector.addNewUser(id, getUserById(id));
			users += getUserById(id) + ", ";
		});
		rtm.sendMessage("Added users: " + users.substr(0, users.length8 - 2), channel);
	}
}
/**
 * @param  {text} The message sent 
 * @param  {channel} The slack channel (to send back message)
 * @return {[type]}
 */
function startGame(text, channel){


}

/*
 * HELPER FUNCTIONS 
 */
function isToBot(text){
	return (text.indexOf("@" + botId) == 1);
}

function messageContains(message, str){
	//change to regex match? to prevent sub stringing
	return message.toLowerCase().includes(str.toLowerCase());
}

function getUserById(id){
	return rtm.dataStore.getUserById(id).name;
}

module.exports = router; 

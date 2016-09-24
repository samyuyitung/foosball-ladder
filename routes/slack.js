var express = require('express');
var router = express.Router();

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
	text = message.text;
	//Check if @elo-bot is mentioned
	if (isToBot(text)) {

		if(messageContains(text, "ladder")){
			rtm.sendMessage("Ladder", message.channel)
		} else if(messageContains(text, "new game")){
			rtm.sendMessage("Starting game", message.channel)
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
 * HELPER FUNCTIONS 
 */
function isToBot(text){
	return (text.indexOf("@" + botId) == 1);
}

function messageContains(message, str){
	return message.toLowerCase().includes(str.toLowerCase());
}

function getUserById(id){
	return rtm.dataStore.getUserById(id).name;
}

module.exports = router; 

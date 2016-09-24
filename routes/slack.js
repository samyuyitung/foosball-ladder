var express = require('express');
var router = express.Router();

var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM;
var MemoryDataStore = require('@slack/client').MemoryDataStore;


//var EloRating = require('elo-rating');

var request = require('request');


var botId;
var token = process.env.SLACK_API_TOKEN || '';

var rtm = new RtmClient(token, {
	logLevel: 'error',
	dataStore: new MemoryDataStore()
});
rtm.start();

//Get the bot name
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
	botId = rtmStartData.self.id;
});

rtm.on(RTM_EVENTS.MESSAGE, function (message) {
	text = message.text.toString();
	//Check if @elo-bot is mentioned
	if (isToBot(text)) {

		if(messageContains(text, "ladder")){
			rtm.sendMessage("Ladder", message.channel)
		}
	}
});

/*
 * reaction added to message
 */ 
rtm.on(RTM_EVENTS.REACTION_ADDED, function (message) {

	if(isToBot(message.item_user)){
		console.log(getUserById(message.user) + " did " + message.reaction);
	}
});



/*
 * HELPER FUNCTIONS 
 */
function isToBot(text){
	return messageContains(text,botId)
}

function messageContains(message, str){
	return message.includes(str);
}

function getUserById(id){
	console.log(id);
	return rtm.dataStore.getUserById(id).name;
}

module.exports = router; 

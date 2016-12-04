var shortid = require('shortid');
var dbconnector = require('./db.js');
var EloRating = require('elo-rating');

var games = [];
var playersGames = [];
var firebaseProfiles = [];

var potentialGames = []


function isPlaying(user) {
	for (var i = 0; i < playersGames.length; i++) {
		if (playersGames[i].player === user.userId)
			return true;
	}
	return false;
}

function getPotentialGameById(id) {
	for (var i = 0; i < potentialGames.length; i++)
		if (potentialGames[i].messageId === id)
			return potentialGames[i];
	return null;
}

function getGameById(id) {
	for (var i = 0; i < games.length; i++)
		if (games[i].gameId === id)
			return games[i];
	return null;
}

function getGameByPlayer(player) {
	for (var i = 0; i < playersGames.length; i++) {
		if (playersGames[i].userId === player) {
			return getGameById(playersGames[i].gameId);
		}
	}
}

function getTeam(id, game) {
	var team = 0
	game.team1.forEach(function(player) {
		if (player.userId === id) {
			team = 1;
		}
	});
	game.team2.forEach(function(player) {
		if (player.userId === id) {
			team = 2;
		}
	});
	return team;
}

function splitArrayByTeam(game) {
	team1 = [];
	team2 = [];
	firebaseProfiles.forEach(function(player) {
		if (getTeam(player.slackId, game) === 1) {
			team1.push(player)
		} else
			team2.push(player)
	});
	return {
		team1: team1,
		team2: team2
	};
}

function getAverage(team) {
	var sum = 0;
	team.forEach(function(player) {
		sum += player.elo;
	});
	return sum / team.length;
}
//Form W2 or L2 
function setNewStreak(current, win) {
	var re = /([A-Z])(\d+)/
	var wl = current.match(re)[1];
	var num = parseInt(current.match(re)[2]);

	var newStreak = "";
	if (win) {
		if (wl === 'W')
			newStreak = 'W' + ++num;
		else
			newStreak = 'W1';
	} else {
		if (wl === 'L')
			newStreak = 'L' + ++num;
		else
			newStreak = 'L1';
	}
	return newStreak;
}

function getWinner(score) {
	return score.team1 > score.team2 ? 1 : 2;
}

function updateElos(winner, teams) {
	winner = getWinner(score);
	if (winner == 1) {
		winners = teams.team1;
		losers = teams.team2;
	} else {
		winners = teams.team2;
		losers = teams.team1;
	}
	loseAvg = getAverage(losers);
	winAvg = getAverage(winners);
	winners.forEach(function(player) {
		player.elo = EloRating.calculate(player.elo, loseAvg).playerRating;
		player.gamesPlayed++;
		player.wins++;
		player.lastPlayed = Date.now();
		player.goalsFor += score.team1 > score.team2 ? score.team1 : score.team2;
		player.goalsAgainst += score.team1 < score.team2 ? score.team1 : score.team2;
		player.streak = setNewStreak(player.streak, true);
		player.shutouts += isShutout(score) ? 1 : 0;
	});
	losers.forEach(function(player) {
		player.elo = EloRating.calculate(winAvg, player.elo).opponentRating;
		player.gamesPlayed++;
		player.losses++;
		player.lastPlayed = Date.now();
		player.goalsFor += score.team1 < score.team2 ? score.team1 : score.team2;
		player.goalsAgainst += score.team1 > score.team2 ? score.team1 : score.team2;
		player.streak = setNewStreak(player.streak, false);
	});
	//GOALS ???????
	return winners.concat(losers);
}

function getNamesFromTeam(game, teamNum) {
	var str = "";
	var team = game.team1;
	if (teamNum == 2)
		team = game.team2;
	team.forEach(function(player) {
		str += player.name + " ";
	});
	return str;
}

function isShutout(score) {
	return score.team1 == 0 || score.team2 == 0;
}

module.exports = {

	parseScore(text, sender) {
		var game = getGameByPlayer(sender);
		var score = {};
		var scoreString = text.match(/(\d+\s*:\s*\d+)/g) ? text.match(/(\d+\s*:\s*\d+)/g)[0] : null;
		if (!scoreString)
			return;
		if (getTeam(sender, game) == 1) {
			score.team1 = parseInt(scoreString.match(/(\d+)\s*:/)[1]);
			score.team2 = parseInt(scoreString.match(/:\s*(\d+)/)[1]);
		} else {
			score.team2 = parseInt(scoreString.match(/(\d+)\s*:/)[1]);
			score.team1 = parseInt(scoreString.match(/:\s*(\d+)/)[1]);
		}
		return score;
	},

	startGame: function(t1, t2) {
		//Prevent person from playing 2 games at the same time
		allPlayers = t1.concat(t2);

		var id = shortid.generate();

		allPlayers.forEach(function(player) {
			player.gameId = id;
			playersGames.push(player);
			dbconnector.getProfile(player.userId, function(snapshot) {
				firebaseProfiles.push(snapshot);
			});
		});
		games.push({
			gameId: id,
			team1: t1,
			team2: t2,
			startTime: new Date().getTime(),
		});
	},

	setPotentialMatch: function(data) {
		currentPlayers = [];
		data.team1.concat(data.team2).forEach(function(player) {
			if (isPlaying(player)) {
				currentPlayers.push(player.name);
			}
		});
		if (currentPlayers.length > 0) {
			return currentPlayers + " are playing rn... Huh?!";
		}
		potentialGames.push(data);
	},

	isChallengeMessageToUser: function(messageId, userId) {
		var match = getPotentialGameById(messageId);
		var found = false;
		if (match) {
			match.team1.concat(match.team2).forEach(function(player) {
				if (player.userId === userId) {
					player.confirm = true;
					found = true;
					return;
				}
			});
		}
		return found;
	},

	allConfirmMatch: function(messageId) {
		var match = getPotentialGameById(messageId);
		if (match) {
			var ye = true;
			match.team1.concat(match.team2).forEach(function(player) {
				if (!player.confirm) {
					ye = false;
					return;
				}
			});
			if (ye) {
				potentialGames.splice(potentialGames.indexOf(match), 1);
				return match;
			}
			return null;
		}
		return null;
	},

	endGame: function(score, player, callback) {
		var game = getGameByPlayer(player);
		if (!game)
			return null;
		var players = updateElos(score, splitArrayByTeam(game))
		dbconnector.updateRatings(players);
		players.forEach(function(player) {
			playersGames.splice(playersGames.indexOf(player), 1);
		});
		var str = "";
		if (isShutout(score))
			str += getNamesFromTeam(game, getWinner(score)) + "GOT A SHUTOUT AHAHAHA \nhttp://giphy.com/gifs/reaction-rap-battle-wHAXQpoDZ7WEM"
		else
			str += getNamesFromTeam(game, getWinner(score)) + "Wins!!!"
		callback(str);
	},

	getCurrentGames: function() {
		return games;
	}
};

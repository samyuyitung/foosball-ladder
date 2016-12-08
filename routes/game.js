var shortid = require('shortid');
var dbconnector = require('./db.js');
var EloRating = require('elo-rating');

var games = [];
var playersGames = [];
var firebaseProfiles = [];

var potentialGames = [];
var endedGames = [];

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

function getEndedGameById(id) {
	for (var i = 0; i < endedGames.length; i++)
		if (endedGames[i].messageId === id)
			return endedGames[i];
	return null;
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

function updateElos(score, teams) {
	var winner = getWinner(score);
	if (winner == 1) {
		winners = teams.team1;
		losers = teams.team2;
	} else {
		winners = teams.team2;
		losers = teams.team1;
	}
	var loseAvg = getAverage(losers);
	var winAvg = getAverage(winners);
	winners.forEach(function(player) {
		player.elo = EloRating.calculate(player.elo, loseAvg).playerRating;
		player.wins++;
		player.goalsFor += score.team1 > score.team2 ? score.team1 : score.team2;
		player.goalsAgainst += score.team1 < score.team2 ? score.team1 : score.team2;
		player.streak = setNewStreak(player.streak, true);
		player.shutouts += isShutout(score) ? 1 : 0;
		player.lastPlayed = Date.now();
	});
	losers.forEach(function(player) {
		player.elo = EloRating.calculate(winAvg, player.elo).opponentRating;
		player.losses++;
		player.goalsFor += score.team1 < score.team2 ? score.team1 : score.team2;
		player.goalsAgainst += score.team1 > score.team2 ? score.team1 : score.team2;
		player.streak = setNewStreak(player.streak, false);
		player.lastPlayed = Date.now();
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
		str += "@<" + player.userId + "> ";
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
		// digit whitespace? (not digit, letter, _ or whitespace) whitespace? digit 
		var re = /(\d+\s*[^\w]+\s*\d+)/g;
		var scoreString = re.test(text) ? text.match(re)[0] : null;
		if (!scoreString)
			return;
		var p1re = /(\d+)\s*[^\w]+/
		var p2re = /[^\w]+\s*(\d+)/
		if (getTeam(sender, game) == 1) {
			score.team1 = parseInt(scoreString.match(p1re)[1]);
			score.team2 = parseInt(scoreString.match(p2re)[1]);
		} else {
			score.team2 = parseInt(scoreString.match(p1re)[1]);
			score.team1 = parseInt(scoreString.match(p2re)[1]);
		}
		return score;
	},

	startGame: function(t1, t2) {
		var id = shortid.generate();
		t1.concat(t2).forEach(function(player) {
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
			return currentPlayers + " are playing right now... Huh?!";
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

	endGame: function(score, playerId, messageId, callback) {
		var game = getGameByPlayer(playerId);

		if (!game)
			return null;
		if (getWinner(score) == 1) {
			scoreString = score.team1 + " - " + score.team2
		} else {
			scoreString = score.team2 + " - " + score.team1
		}
		game.team1.concat(game.team2).forEach(function(player) {
			if (player.userId !== playerId)
				player.confirm = false;
		});

		str = "By my calculations, " + getNamesFromTeam(game, getWinner(score)) + "won " + scoreString + "\n" +
			"To confirm the score all players must react to his message with a :thumbsup:";
		endedGames.push({
			messageId: messageId,
			gameId: game.gameId,
			team1: game.team1,
			team2: game.team2,
			score: score
		})
		callback(str)
	},

	isFinalScoreConfirmation: function(messageId, userId) {
		var game = getEndedGameById(messageId);
		var found = false;
		if (game) {
			game.team1.concat(game.team2).forEach(function(player) {
				if (player.userId === userId) {
					player.confirm = true;
					found = true;
					return;
				}
			});
		}
		return found;
	},

	allConfirmFinalScore: function(messageId) {
		var game = getEndedGameById(messageId);
		if (game) {
			var ye = true;
			game.team1.concat(game.team2).forEach(function(player) {
				if (!player.confirm) {
					ye = false;
					return;
				}
			});
			if (ye) {
				return match;
			}
			return null;
		}
		return null;
	},

	updateStats: function(messageId, callback) {
		var game = getEndedGameById(messageId);
		var players = updateElos(game.score, splitArrayByTeam(game))
		dbconnector.updateRatings(players);

		game.team1.concat(game.team2).forEach(function(player) {
			playersGames.splice(playersGames.indexOf(player), 1);
		});
		endedGames.splice(endedGames.indexOf(match), 1);
		var str = "";
		if (isShutout(game.score))
			str += getNamesFromTeam(game, getWinner(game.score)) + "GOT A SHUTOUT AHAHAHA \nhttp://giphy.com/gifs/reaction-rap-battle-wHAXQpoDZ7WEM"
		else
			str += getNamesFromTeam(game, getWinner(game.score)) + "Wins!!!"
		callback(str);
	},

	getCurrentGames: function() {
		return games;
	}
};

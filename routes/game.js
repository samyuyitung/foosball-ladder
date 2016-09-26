
var games = [];

function isPlaying(user) {
	games.forEach(function(game){
		if(game.p1 === user || game.p2 === user)
			return true;
	});
	return false;
}


module.exports = {
	
	startGame: function (user1, user2) {
		//Prevent person from playing 2 games at the same time
		if(isPlaying(user1) || isPlaying(user2))
			return false;
		
		tempGame = {
			p1: user1,
			p2: user2,
			startTime: new Date().getTime(),
		};
		games.push(tempGame);
		return true;
	}
}
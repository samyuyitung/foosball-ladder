# Foosball ladder

This is a slack bot to facilitate and track foosball stats

## Building and Running

### Prerequisites

You need:

1. Node.js
2. A slack bot (key)
3. A firebase database to store the stats

### How to run: 

1. Clone this git repository
2. Enter in your slack key, and firebase information in the config.json.example file and resave it as config.json
3. Install all node dependancies npm install
4. Run the app with npm start

## What this does 
How to use me:  
This is the same as the help menu

* `@foosbot add me` - add yourself to the ladder
* `@foosbot I challenge @person` - Challenge someone to a 1 on 1 match
* `@foosbot me and @partner challenge @opponent1 and @opponent2` - Challenge others to a team game
* `@foosbot Final score # : #` - Report the final score of a match after it has been played
* `@foosbot show ladder` - Show the elo ladder
* `@foosbot show my stats` - Show your stats
* `@foosbot show @person stats` - Show your stats
* `@foosbot remove me` - remove yourself to the ladder
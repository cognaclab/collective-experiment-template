/*===============================================================
// Multi-argent two-armed bandit task
// Author: Wataru Toyokawa
// Date: 13 June 2025
// Collaborating with 
//    * Dr Andrew Whalen
//    * Dr Kevin Lala
//    * Dr Wolfgang Gaissmaier
//
// Note:
// 	  * Saving the behavioural file only when the task is completed 
          (or when a subject disconnects)
      * It can handle from 2 to 4-armed bandit (by changing num_option)
// Requirements:
//    * Node.js
//    * mongoDB and mongosh
//    * originally hosted in a Rocky Linux9
// ============================================================== */

// Load environment variables
require('dotenv').config();

const config = require('../../config/constants');
const logger = require('../utils/logger');
const experimentModeHandler = require('../middleware/templateMode');
const mainJsRouter = require('../middleware/mainJsRouter');

// Loading modules
const express = require('express')
,	path = require('path')
,	app = express()
,	cors = require('cors')
,	server = require('http').Server(app)
,	io = require('socket.io')(server, {
		// below are engine.IO options
		pingInterval: 20000, // how many ms before sending a new ping packet
		pingTimeout: 50000 // how many ms without a pong packet to consider the connection closed
	})
,	bodyParser = require("body-parser")
// ,	config.portnum = 8888
;

// multi-threading like thing in Node.js
const {isMainThread, Worker} = require('worker_threads');



// Experimental variables
const horizon = 20 // number of trials
, sessionNo = 0 // 0 = debug; 
, maxGroupSize = 5 // maximum size per group 
, minGroupSize = parseInt(process.env.MIN_GROUP_SIZE) || 2 // minimal group size below which the session becomes individual tasks
, maxWaitingTime = 10 * 1000 // maximum time allowed in the waiting foyer
, K = 3 // number of bandit options (k-armed bandit)
, maxChoiceStageTime = 10 * 1000 //20*1000 // time limit for decision making
, maxTimeTestScene = 4 * 60 * 1000 // 4*60*1000
, task_order = ['static', 'dynamic'] // ramdomized environmental order (2 rounds)
, changePoints = [17, 29, 45] // trials from which a new env setting starts
, totalGameRound = 2 // number of rounds
// , exp_condition_list = ['groupPayoff'] //['binary', 'gaussian'] // noise profiles
, prob_conditions = 1.0// probability of assigning each exp condition 
, prob_0 = [0.7, 0.4, 0.3] // environment 0 (static)
, prob_1 = [0.8, 0.3, 0.3] // environment 1
, prob_2 = [0.3, 0.3, 0.8] // environment 2
, prob_3 = [0.8, 0.3, 0.3] // environment 3
, prob_4 = [0.3, 0.8, 0.3] // environment 4
, position_best_arm = [ // indeces of the best arm's position 
	indexOfMax(prob_0) // 'indexOfMax' function defined at the bottom
	, indexOfMax(prob_1)
	, indexOfMax(prob_2)
	, indexOfMax(prob_3)
	, indexOfMax(prob_4)
]
, options = [];
;
for (let i = 1; i <= K; i++) {
   options.push(i);
}

// date and time
let myD = new Date()
// , myYear = myD.getFullYear()
, myMonth = myD.getMonth() + 1
, myDate = myD.getUTCDate()
, myHour = myD.getUTCHours()
, myMin = myD.getUTCMinutes()
;
if(myMonth<10){myMonth = '0'+myMonth;}
if(myDate<10){myDate = '0'+myDate;}
if(myHour<10){myHour = '0'+myHour;}
if(myMin<10){myMin = '0'+myMin;}

// experimental server
const currentSubject = 0
// , firstRoomName = myMonth+myDate+myHour+myMin+'_session_'+sessionNo
, firstRoomName = makeid(8) + '_session_' + sessionNo
,	roomStatus = {}
, sessionNameSpace = {}
// , idAssignedThisSession = []
;
// experimental status
let total_N_now = 0
, countDownMainStage = {}
, countDownWaiting = {}
, firstTrialStartingTime // this is to compensate time spent in the task
;
countDownMainStage[firstRoomName] = new Object();
countDownWaiting[firstRoomName] = new Object();

app.set('views', path.join(__dirname, '../../client/views'));
app.set('view engine', 'ejs');


// Experiment mode middleware (must be before routes)
app.use(experimentModeHandler.middleware());

// Main.js routing middleware (must be before static files)
app.use(mainJsRouter.middleware());

app.use(express.static(path.join(__dirname, '../../client/public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors({ origin: ['http://192.168.33.10:8888'], credentials: true })); // origin: true

// Routings
const gameRouter = require('../api/game'); // loading game.ejs from which subjectID is transferred
// Assigning routers to Routing
app.use('/', gameRouter);

// error handling
app.use((err, req, res, next) => {
    logger.error('Server error', {
    	error: err.message,
    	stack: err.stack,
    	url: req.originalUrl,
    	method: req.method
    });
    res.status(500).send('A technical issue happened in the server...😫')
});

// socket handlers
const { handleDisconnect }  = require('../socket/handleDisconnect');

// this 'decoyRoom' is where
// reconnected subjects (those who have a cache) are coming in
// so that no actual rooms are damaged by them
roomStatus['decoyRoom'] = {
    exp_condition: 'decoyRoom', // 
    riskDistributionId: getRandomIntInclusive(max = 13, min = 13), // max = 2, min = 0
    // isLeftRisky: isLeftRisky_list[getRandomIntInclusive(max = 1, min = 0)],
    optionOrder: shuffle(options),
	taskOrder: shuffle(task_order),
    indivOrGroup: -1,
	horizon: horizon,
    n: 0,
    membersID: [],
    subjectNumbers: [],
    disconnectedList: [],
    testPassed: 0,
	newGameRoundReady: 0,
    starting: 0,
    stage: 'firstWaiting',
    maxChoiceStageTime: maxChoiceStageTime,
    choiceTime: [],
	gameRound: 0,
    trial: 1,
	pointer: 1,
    doneId: createArray(horizon * totalGameRound, 0),
    doneNo: createArray(horizon * totalGameRound),
	readyNo: createArray(horizon * totalGameRound),
    socialFreq: createArray(horizon * totalGameRound, K),
    socialInfo: createArray(horizon * totalGameRound, maxGroupSize),
    publicInfo: createArray(horizon * totalGameRound, maxGroupSize),
    share_or_not: createArray(horizon * totalGameRound, maxGroupSize),
    choiceOrder: createArray(horizon * totalGameRound, maxGroupSize),
    saveDataThisRound: [],
    restTime:maxWaitingTime,
	groupTotalPayoff: createArray(horizon * totalGameRound, 0) ,
	groupCumulativePayoff: [0, 0],
    totalPayoff_perIndiv: [0],
    totalPayoff_perIndiv_perGame: new Array(totalGameRound).fill(0),
    groupTotalCost: [0],
    currentEnv: 0,
	envChangeTracker: 0
};
// The following is the first room
// Therefore, Object.keys(roomStatus).length = 2 right now
// A new room will be open once this room becomes full
roomStatus[firstRoomName] = {
    // exp_condition: exp_condition_list[weightedRand2({0:prob_conditions, 1:(1-prob_conditions)})],
    riskDistributionId: getRandomIntInclusive(max = 13, min = 13), // max = 2, min = 0
    // isLeftRisky: isLeftRisky_list[getRandomIntInclusive(max = 1, min = 0)],
    optionOrder: shuffle(options),
	taskOrder: shuffle(task_order),
    indivOrGroup: -1,
	horizon: horizon,
    n: 0,
    membersID: [],
    subjectNumbers: [],
    disconnectedList: [],
    testPassed: 0,
	newGameRoundReady: 0,
    starting: 0,
    stage: 'firstWaiting',
    maxChoiceStageTime: maxChoiceStageTime,
    choiceTime: [],
	gameRound: 0,
    trial: 1,
	pointer: 1,
    doneId: createArray(horizon * totalGameRound, 0),
    doneNo: createArray(horizon * totalGameRound),
	readyNo: createArray(horizon * totalGameRound),
    socialFreq: createArray(horizon * totalGameRound, K),
    socialInfo:createArray(horizon * totalGameRound, maxGroupSize),
    publicInfo: createArray(horizon * totalGameRound, maxGroupSize),
    share_or_not: createArray(horizon * totalGameRound, maxGroupSize),
    choiceOrder: createArray(horizon * totalGameRound, maxGroupSize),
    saveDataThisRound: [],
    restTime:maxWaitingTime,
	groupTotalPayoff: createArray(horizon * totalGameRound, 0) ,
	groupCumulativePayoff: [0, 0],
    totalPayoff_perIndiv: [0],
    totalPayoff_perIndiv_perGame: new Array(totalGameRound).fill(0),
    groupTotalCost: [0],
    currentEnv: 0,
	envChangeTracker: 0
};


/**
 * Letting the server listen the port
 */
// const port = process.env.PORT || portnum;

server.listen(config.PORT, function() {
	logger.info('Game server started', {
		port: config.PORT,
		maxGroupSize,
		minGroupSize,
		horizon,
		maxWaitingTime
	});
});

/**
 * Socket.IO Connection.
 */
io.on('connection', function (client) {
	// client's unique identifier 
	client.subjectID = client.request._query.subjectID;
	client.started = 0;
	// while (client.started == 0) {
	// 	io.to(client.session).emit('S_to_C_welcomeback', {sessionName: client.session, roomName: client.room});
	// }
	// Assigning "client.session" as an unique identifier of the participant
	// If the client already has the sessionName, 
	// put this client into a experimental room
	if (typeof client.request._query.sessionName == 'undefined') {
		// client.sessionName: this is an unique code for each participant
		client.session = client.id;
		client.join(client.session);
		sessionNameSpace[client.session] = 1;
		logger.logConnection('session_assigned', {
			socketId: client.id,
			subjectID: client.subjectID,
			sessionName: client.session
		});
	} else if (client.request._query.sessionName == 'already_finished'){
		// Some web browsers may try to reconnect with this game server when the browser
		// is forced to disconnect. The following script will assure 
		// that such reconnected subject will not go to a normal room, 
		// but to the 'decoyRoom' where nothing will ever never happen.
		client.session = client.request._query.sessionName;
		client.room = 'decoyRoom';
		client.join(client.session);
		client.join(client.room);
		logger.logConnection('session_already_finished', {
			socketId: client.id,
			subjectID: client.subjectID,
			sessionName: client.session
		});
	} else {
		// When client comes back from a short disconnection
		client.session = 'already_finished';
		client.room = 'decoyRoom';
		client.join(client.session);
		client.join(client.room);

		// bye to the client
		io.to(client.session).emit('S_to_C_welcomeback', {sessionName: client.session, roomName: client.room});

		// ban this sessionName from this session
		sessionNameSpace[client.request._query.sessionName] == 1;

		// logging
		logger.logConnection('reconnection_redirected', {
			socketId: client.id,
			subjectID: client.subjectID,
			sessionName: client.request._query.sessionName,
			roomName: client.request._query.roomName
		});

	}

	// When client's game window is ready & latency was calculated
	client.on('core is ready', function(data) {
		if (client.started == 0) {
			client.started = 1
			// client.this_env = 0
			// Time stamp
		    client.latency = data.latency; 
		    logger.logConnection('client_ready', {
		    	socketId: client.id,
		    	subjectID: client.subjectID,
		    	sessionName: client.session,
		    	latency: data.latency
		    });
		    if(data.latency < data.maxLatencyForGroupCondition) {
		    	// Let the client join the newest room
			  	client.roomFindingCounter = 1; // default: roomStatus = {'decoyRoom', 'session_100'}
			  	while (typeof client.room == 'undefined') {
				    // if there are still rooms to check
				    if (client.roomFindingCounter <= Object.keys(roomStatus).length - 1) {
						if(roomStatus[Object.keys(roomStatus)[client.roomFindingCounter]]['starting'] == 0 && roomStatus[Object.keys(roomStatus)[client.roomFindingCounter]]['n'] < maxGroupSize && roomStatus[Object.keys(roomStatus)[client.roomFindingCounter]]['restTime'] > 999) {
							client.room = Object.keys(roomStatus)[client.roomFindingCounter];
							console.log(' - '+ client.session +'('+client.subjectID+')'+' joined to '+ client.room +' (n: '+(1+roomStatus[client.room]['n'])+', total N: '+(1+total_N_now)+')');
						} else {
							client.roomFindingCounter++;
						}
				    } else {
				      // else if there is no more available room left
				      // Make a new room
				      // client.newRoomName = myMonth+myDate+myHour+myMin+'_session_' + (sessionNo + Object.keys(roomStatus).length - 1);
				      client.newRoomName = makeid(7) + '_session_' + (sessionNo + Object.keys(roomStatus).length - 1);
				      roomStatus[client.newRoomName] = 
				      {
						// exp_condition: exp_condition_list[weightedRand2({0:prob_conditions, 1:(1-prob_conditions)})],
						riskDistributionId: getRandomIntInclusive(max = 13, min = 13), // max = 2, min = 0
						// isLeftRisky: isLeftRisky_list[getRandomIntInclusive(max = 1, min = 0)],
						optionOrder: shuffle(options),
						taskOrder: shuffle(task_order),
						indivOrGroup: -1,
						horizon: horizon,
						n: 0,
						membersID: [],
						subjectNumbers: [],
						disconnectedList: [],
						testPassed: 0,
						newGameRoundReady: 0,
						starting: 0,
						stage: 'firstWaiting',
						maxChoiceStageTime: maxChoiceStageTime,
						choiceTime: [],
						gameRound: 0,
						trial: 1,
						pointer: 1,
						doneId: createArray(horizon * totalGameRound, 0),
						doneNo: createArray(horizon * totalGameRound),
						readyNo: createArray(horizon * totalGameRound),
						socialFreq: createArray(horizon * totalGameRound, K),
						socialInfo:createArray(horizon * totalGameRound, maxGroupSize),
						publicInfo: createArray(horizon * totalGameRound, maxGroupSize),
						share_or_not: createArray(horizon * totalGameRound, maxGroupSize),
						choiceOrder: createArray(horizon * totalGameRound, maxGroupSize),
						saveDataThisRound: [],
						restTime:maxWaitingTime,
						groupTotalPayoff: createArray(horizon * totalGameRound, 0) ,
						groupCumulativePayoff: [0, 0],
						totalPayoff_perIndiv: [0],
						totalPayoff_perIndiv_perGame: new Array(totalGameRound).fill(0),
						groupTotalCost: [0],
						currentEnv: 0,
						envChangeTracker: 0
				      };
				      // Register the client to the new room
				      client.room = client.newRoomName;
					  
				      console.log(' - '+ client.session +'('+client.subjectID+')'+' joined to a new room '+ client.room +' (n: '+(1+roomStatus[client.room]['n'])+', total N: '+(1+total_N_now)+')');
				      // Make a clock object in the new room
				      countDownMainStage[client.room] = new Object();
				      countDownWaiting[client.room] = new Object();
				    }
			  	}
			  
				// Let the client join and know the registered room
				client.join(client.room);
				total_N_now++;
				roomStatus[client.room]['n']++
				roomStatus[client.room]['membersID'].push(client.session);
				// Assigning an ID number within the room
				client.subNumCounter = 1;
				while (typeof client.subjectNumber == 'undefined') {
					if (roomStatus[client.room]['subjectNumbers'].indexOf(client.subNumCounter) == -1) {
						roomStatus[client.room]['subjectNumbers'].push(client.subNumCounter);
					  	client.subjectNumber = client.subNumCounter;
					} else {
					  	client.subNumCounter++;
					}
				}
				// Let the client know the specific task's parameters
				emitParameters(client);
		    } else {
		    	// else if latency is too large
		      	// then this subject is go to the individual condition
		      	client.newRoomName = myMonth+myDate+myHour+myMin+'_largeLatency_' + (sessionNo + Object.keys(roomStatus).length - 1);
				roomStatus[client.newRoomName] = 
		      	{
					// exp_condition: exp_condition_list[weightedRand2({0:prob_conditions, 1:(1-prob_conditions)})],
					riskDistributionId: getRandomIntInclusive(max = 13, min = 13), // max = 2, min = 0
					// isLeftRisky: isLeftRisky_list[getRandomIntInclusive(max = 1, min = 0)],
					optionOrder: shuffle(options),
					taskOrder: shuffle(task_order),
					indivOrGroup: 0,
					n: 0,
					membersID: [],
					subjectNumbers: [],
					disconnectedList: [],
					testPassed: 0,
					newGameRoundReady: 0,
					starting: 0,
					stage: 'firstWaiting',
					maxChoiceStageTime: maxChoiceStageTime,
					choiceTime: [],
					gameRound: 0,
					trial: 1,
					pointer: 1,
					doneId: createArray(horizon * totalGameRound, 0),
					doneNo: createArray(horizon * totalGameRound),
					readyNo: createArray(horizon * totalGameRound),
					socialFreq: createArray(horizon * totalGameRound, K),
					socialInfo:createArray(horizon * totalGameRound, maxGroupSize),
					publicInfo: createArray(horizon * totalGameRound, maxGroupSize),
					share_or_not: createArray(horizon * totalGameRound, maxGroupSize),
					choiceOrder: createArray(horizon * totalGameRound, maxGroupSize),
					saveDataThisRound: [],
					restTime:1000
		      	};
				// Register the client to the new room
				client.room = client.newRoomName;
				console.log(' - '+ client.session +'('+client.subjectID+')'+' joined to '+ client.room +' (n: '+(1+roomStatus[client.room]['n'])+', total N: '+(1+total_N_now)+')');
				// Let the client join the registered room
				client.join(client.room);
				//io.to(client).emit('S_to_C_clientSessionName', {sessionName: client.session, roomName: client.room});
				client.subjectNumber = 1;
				total_N_now++;
				roomStatus[client.room]['n']++
				roomStatus[client.room]['membersID'].push(client.session);
				// Let the client know the specific task's parameters
				emitParameters(client);
		    }
		    if(client.room != 'decoyRoom') {
		    	// Let client wait until start flag turns 1
		      	// the clock for the waiting room starts when the first client pops in.
				if (roomStatus[client.room]['n']===1) {
					console.log(' - The first participant came in to the room ' + client.room + '.');
					startWaitingStageClock(client.room);
				}
				// inform rest time to the room
				io.to(client.room).emit('this is the remaining waiting time', {restTime:roomStatus[client.room]['restTime']
					, max:maxWaitingTime
					, maxGroupSize:maxGroupSize
					, horizon:roomStatus[client.room]['horizon']
				});
			}
		}
	});

	client.on('this is the previous restTime', function (data) {
		roomStatus[client.room]['restTime'] = data.restTime;
		if (roomStatus[client.room]['stage'] == 'resuming') {
			console.log(' - waiting clock was just resumed at ' + client.room + '.');
			startWaitingStageClock(client.room);
			roomStatus[client.room]['stage'] = 'firstWaiting';
		}
		// inform rest time to the room
		io.to(client.room).emit('this is the remaining waiting time', {restTime:roomStatus[client.room]['restTime']
			, max:maxWaitingTime
			, maxGroupSize:maxGroupSize
			, horizon:roomStatus[client.room]['horizon']
		});
	});

	// client.on('loading completed', function () {
	// 	console.log('loading completed received');
	// 	io.to(client.room).emit('this is the remaining waiting time', {restTime:roomStatus[client.room]['restTime'], max:maxWaitingTime, maxGroupSize:maxGroupSize, horizon:roomStatus[client.room]['horizon']});
	// });

	client.on('ok individual condition sounds good', function () {
		// finally checking weather group is still below the maxnumber
		if(roomStatus[client.room]['n'] < maxGroupSize) {
			// the status of the client's former room is updated
			roomStatus[client.room]['starting'] = 1;
			roomStatus[client.room]['n']--;
			// create a new individual condition's room
			roomStatus[myMonth+myDate+myHour+myMin+'_sessionIndiv_' + (sessionNo + Object.keys(roomStatus).length - 1)] = 
			{
				// exp_condition: exp_condition_list[weightedRand2({0:prob_conditions, 1:(1-prob_conditions)})],
				riskDistributionId: getRandomIntInclusive(max = 13, min = 13), // max = 2, min = 0
				// isLeftRisky: isLeftRisky_list[getRandomIntInclusive(max = 1, min = 0)],
				optionOrder: shuffle(options),
				taskOrder: shuffle(task_order),
				indivOrGroup: 0,
				n: 0,
				membersID: [],
				subjectNumbers: [],
				disconnectedList: [],
				testPassed: 0,
				newGameRoundReady: 0,
				starting: 0,
				stage: 'firstWaiting',
				maxChoiceStageTime: maxChoiceStageTime,
				choiceTime: [],
				gameRound: 0,
				trial: 1,
				pointer: 1,
				doneId: createArray(horizon * totalGameRound, 0),
				doneNo: createArray(horizon * totalGameRound),
				readyNo: createArray(horizon * totalGameRound),
				socialFreq: createArray(horizon * totalGameRound, K),
				socialInfo:createArray(horizon * totalGameRound, maxGroupSize),
				publicInfo: createArray(horizon * totalGameRound, maxGroupSize),
				share_or_not: createArray(horizon * totalGameRound, maxGroupSize),
				choiceOrder: createArray(horizon * totalGameRound, maxGroupSize),
				saveDataThisRound: [],
				restTime:maxWaitingTime,
				groupTotalPayoff: createArray(horizon * totalGameRound, 0) ,
				groupCumulativePayoff: [0, 0],
				totalPayoff_perIndiv: [0],
				totalPayoff_perIndiv_perGame: new Array(totalGameRound).fill(0),
				groupTotalCost: [0],
				currentEnv: 0,
				envChangeTracker: 0
			};
			// client leave the former room
			client.leave(client.room);
			// client joints the new individual room
			client.room = Object.keys(roomStatus)[Object.keys(roomStatus).length - 1];
			client.join(client.room);
			//total_N_now++;
			roomStatus[client.room]['n']++
			roomStatus[client.room]['membersID'].push(client.session);
			client.subjectNumber = roomStatus[client.room]['n'];
			startSession(client.room);
		} else {
			// if groupSize has reached the enough number
			startSession(client.room);
		}
	});

	// client.on('test passed', function () {
	// 	if (roomStatus[client.room]['testPassed']==0) {
	// 	  	roomStatus[client.room]['stage'] = 'secondWaitingRoom';
	// 	}
	// 	roomStatus[client.room]['testPassed']++;
	// 	console.log(' - '+ client.session + ' passed the test.');
	// 	if (roomStatus[client.room]['testPassed'] >= roomStatus[client.room]['n']) {
	// 	  	console.log(' - ' + client.room + ' is ready to start the game.');
	// 	  	io.to(client.room).emit('all passed the test', {n:roomStatus[client.room]['n'], testPassed:roomStatus[client.room]['testPassed'], exp_condition:roomStatus[client.room]['exp_condition']});
	// 		let now = new Date()
	// 		firstTrialStartingTime = now;
	// 	  	roomStatus[client.room]['stage'] = 'mainTask';
	// 	} else {
	// 	  	io.to(client.session).emit('wait for others finishing test');
	// 	}
	// });

	client.on('test passed', function () {
		if (roomStatus[client.room]['testPassed']==0) {
		  	roomStatus[client.room]['stage'] = 'secondWaitingRoom';
		}
		roomStatus[client.room]['testPassed']++;
		console.log(' - '+ client.session + ' ('+ client.room +') passed the test.');
		if (roomStatus[client.room]['testPassed'] >= roomStatus[client.room]['n']) {
		  	console.log(' - ' + client.room + ' is ready to start the game.');
			roomStatus[client.room]['groupTotalPayoff'][roomStatus[client.room]['pointer']-1] = 0 // initialising the total payoff tracker
		  	io.to(client.room).emit('all passed the test', 
				{n:roomStatus[client.room]['n']
					, testPassed:roomStatus[client.room]['testPassed']
					// , exp_condition:roomStatus[client.room]['exp_condition']
					, gameRound: roomStatus[client.room]['gameRound']
					, groupCumulativePayoff: 0
					, minGroupSize: minGroupSize
				});
			let now = new Date()
		  	firstTrialStartingTime = now;
		  	roomStatus[client.room]['stage'] = 'mainTask';
		} else {
		  	io.to(client.session).emit('wait for others finishing test', {n_test_passed: roomStatus[client.room]['testPassed'], n:roomStatus[client.room]['n']});
		  	io.to(client.room).emit('n_test_passed updated', {n_test_passed: roomStatus[client.room]['testPassed'], n:roomStatus[client.room]['n']});
		}
	});

	

	client.on('choice made', function (data) {

    	// ───────────────────-----─────────────────────────────────────
		// GUARD CLAUSE ─ bail out fast if the state we need is missing
		// ───────────────────-----─────────────────────────────────────
		const room   = roomStatus[client.room];
		const number = client.subjectNumber;
		const session = client.session;

		if (!room || number == null) return;                  // ← quick exit
		// (number == null  catches both undefined AND null)

		// ───────────────────-----─────────────────────────────────────
		// CACHE frequently-used indices so we only calculate them once
		// ───────────────────-----─────────────────────────────────────
		const p      = room.pointer - 1;      // “pointer” shorthand
		const round  = room.gameRound;
		const choice = data.num_choice;

		// ───────────────────-----─────────────────────────────────────
		// MAIN UPDATES
		// ───────────────────-----─────────────────────────────────────
		room.doneId[p].push(number);
		const doneNum = room.doneId[p].length;
		const this_indiv_payoff = Number(data.individual_payoff);
		const this_trial = data.thisTrial;
		const gameType = room.taskOrder[round];

		room.socialInfo[p][doneNum - 1]  = choice;
		room.choiceOrder[p][doneNum - 1] = number;

		room.groupTotalPayoff[p] = (room.groupTotalPayoff[p] || 0) + Number(this_indiv_payoff);
		room.groupCumulativePayoff[round] += this_indiv_payoff;

		console.log(typeof this_indiv_payoff, this_indiv_payoff);  // 'string'  '100'
		console.log(typeof room.groupTotalPayoff[p]);              // should be 'number'

		// log
		if (choice > -1) {
			logger.logGameEvent('choice_made', {
				subjectID: client.subjectID,
				roomId: client.room,
				payload: {
					sessionName: session,
					subjectNumber: number,
					choice,
					payoff: this_indiv_payoff,
					trial: this_trial,
					gameType
				}
			});
		} else {
			logger.logGameEvent('choice_missed', {
				subjectID: client.subjectID,
				roomId: client.room,
				payload: {
					sessionName: session,
					subjectNumber: number,
					trial: this_trial,
					gameType
				}
			});
		}

		// ─── Social-frequency bookkeeping ───────────
		if (room.trial <= room.horizon) {
		if (doneNum === 1) room.socialFreq[p].fill(0); // reset once per round
		if (choice > -1) room.socialFreq[p][choice]++; // bump the chosen option
		}

		// ──────────────────────────────────────────────────────────────
		// SAVE DATA SNAPSHOT FOR MONGODB
		// ──────────────────────────────────────────────────────────────
		const now          = new Date();
		const iso          = now.toISOString(); // YYYY-MM-DDTHH:MM:SS.sssZ
		const timeElapsed  = now - firstTrialStartingTime; // ms since round start

		room.saveDataThisRound.push({
		date                     : iso.slice(0, 10),        // YYYY-MM-DD
		time                     : iso.slice(11, 19),       // HH:MM:SS
		// exp_condition            : room.exp_condition,
		indivOrGroup             : room.indivOrGroup,
		groupSize                : room.n,
		room                     : client.room,
		confirmationID           : session,
		subjectNumber            : number,
		subjectID                : client.subjectID,
		trial                    : room.trial,
		this_env                 : room.currentEnv,
		gameRound                : round,
		gameType                 : gameType,
		chosenOptionLocation     : data.chosenOptionLocation - 1,
		chosenOptionID           : choice,
		individual_payoff        : data.individual_payoff,
		groupCumulativePayoff    : room.groupCumulativePayoff[round],
		groupTotalPayoff         : NaN,
		dataType                 : 'choice',
		timeElapsed,
		latency                  : client.latency,
		socialFreq               : room.socialFreq[p],
		maxGroupSize,
		// currentEnv               : room.currentEnv,
		optionOrder_0            : room.optionOrder[0] - 1,
		optionOrder_1            : room.optionOrder[1] - 1,
		optionOrder_2            : room.optionOrder[2] - 1,
		true_payoff_0            : data.prob_means[0],
		true_payoff_1            : data.prob_means[1],
		true_payoff_2            : data.prob_means[2],
		reactionTime             : data.reactionTime
		});

		// ──────────────────────────────────────────────────────────────
		// UPDATE “done” COUNTER
		// ──────────────────────────────────────────────────────────────
		room.doneNo[p] = (room.doneNo[p] ?? 0) + 1;

		console.log(
		` - doneNo: ${room.doneNo[p]}, current round is ${room.trial} at ${client.room}`
		);

		// ──────────────────────────────────────────────────────────────
		// START NEXT PHASE OR NOTIFY WAITING PLAYERS
		// ──────────────────────────────────────────────────────────────
		if (room.doneNo[p] < room.n) {
			io.to(client.room).emit('these are done subjects', { 
				doneSubject: room.doneId[p] 
			});
		} else {
			// if fewer than two valid choices, team reward is zero
			const countPositive = room.socialInfo[p].filter(n => n > -1).length;
			if (countPositive < 2) {
				room.groupTotalPayoff[p]  -= this_indiv_payoff;
				room.groupCumulativePayoff[round] -= this_indiv_payoff;
				room.groupTotalPayoff[p] = 0;
			}

			// periodic autosave every 20 rounds
			if (room.round != null && room.round % 20 === 0) {
				const worker = createWorker(
				path.join(__dirname, '../services/savingBehaviouralData_array.js'),
				room.saveDataThisRound
				);
				room.saveDataThisRound = [];
			}

			proceedToResult(client.room);
		}

	});

	client.on('Data from Indiv', function (data) {
		logger.logGameEvent('task_completed', {
			subjectID: client.subjectID,
			roomId: client.room,
			payload: {
				sessionName: client.session,
				subjectNumber: client.subjectNumber,
				dataLength: data.length
			}
		});

    	for(let i=0; i<data.length; i++) {
	  		const worker = createWorker(path.join(__dirname, '../services/savingBehaviouralData_indiv.js'), data[i], client.session);
	  	}
	});

	client.on('result feedback ended', function (data) {

		const room   = roomStatus[client.room];
		const trial  = data.thisTrial;

		// ── guard clause ────────────────────────────────────────────
		if (trial > room.horizon) {
			io.to(client.session).emit('reconnected after the game started');
			return;
		}

		// ── update “current environment” for the player ─────────────
		// if (room.gameType === 'dynamic') {
		// 	const idx = changePoints.findIndex((c, i) =>
		// 	trial >= changePoints[i] && trial < (changePoints[i + 1] ?? Infinity)
		// 	);
		// 	client.this_env = idx + 1;         // 1, 2, or 3
		// } else {                             // 'static'
		// 	client.this_env = 0;
		// }

		// ── ready counter for this trial ────────────────────────────
		const p = room.pointer - 1;          // shorthand once per round
		room.readyNo[p] = (room.readyNo[p] ?? 0) + 1;

		// ── start next trial only when all players are ready ───────
		if (room.readyNo[p] < room.n) return;

		// ── compose “group-payoff” record and stash it ─────────────
		const now          = new Date();
		const timeElapsed  = now - firstTrialStartingTime;

		const summary = {
			date          : now.toISOString().slice(0, 10),     // YYYY-MM-DD
			time          : now.toISOString().slice(11, 19),    // HH:MM:SS
			// exp_condition : room.exp_condition,
			indivOrGroup  : room.indivOrGroup,
			groupSize     : room.n,
			room          : client.room,
			confirmationID: client.room,
			subjectNumber : client.room,
			subjectID     : client.room,

			trial         : room.trial,
			gameRound     : room.gameRound,
			this_env      : room.currentEnv,
			gameType      : room.taskOrder[room.gameRound],

			chosenOptionLocation : NaN,
			chosenOptionID       : NaN,
			individual_payoff    : NaN,

			groupCumulativePayoff: room.groupCumulativePayoff[room.gameRound],
			groupTotalPayoff     : room.groupTotalPayoff[p],

			dataType      : 'group payoff',
			timeElapsed,
			latency       : client.latency,
			socialFreq    : room.socialFreq[p],
			maxGroupSize,

			optionOrder_0 : room.optionOrder[0],
			optionOrder_1 : room.optionOrder[1],
			optionOrder_2 : room.optionOrder[2],

			true_payoff_0 : NaN,
			true_payoff_1 : NaN,
			true_payoff_2 : NaN,
			reactionTime  : NaN
		};

		room.saveDataThisRound.push(summary);

		// ── advance the game state ─────────────────────────────────
		proceedTrial(client.room);
	});

	
	client.on('new gameRound ready', function (data) {
		if (roomStatus[client.room]['newGameRoundReady']==0) {
		  	roomStatus[client.room]['stage'] = 'thirdWaitingRoom';
		}
		roomStatus[client.room]['newGameRoundReady']++;
		
		console.log(' - '+ client.session + ` is ready to move on to ${data.taskType}: ` + roomStatus[client.room]['newGameRoundReady'] + '/' + roomStatus[client.room]['n']);
		
		if (roomStatus[client.room]['newGameRoundReady'] >= roomStatus[client.room]['n']) {
		  	
			console.log(' - ' + client.room + ' is ready to start the new game round ' + (roomStatus[client.room]['gameRound']+1) );

		  	io.to(client.room).emit('all are ready to move on', 
				{gameRound: roomStatus[client.room]['gameRound']
					, newGameRoundReady: roomStatus[client.room]['newGameRoundReady']
					// , exp_condition: roomStatus[client.room]['exp_condition']
					, horizon: roomStatus[client.room]['horizon']
					, taskType: data.taskType
					, this_env: 0
					, n: roomStatus[client.room]['n']
				});
		  	
		  	firstTrialStartingTime = new Date();
		  	roomStatus[client.room]['stage'] = 'mainTask';
		} else {
		  	io.to(client.session).emit('wait for others get ready to move on', {n_test_passed: roomStatus[client.room]['newGameRoundReady'], n:roomStatus[client.room]['n']});
			  io.to(client.room).emit('n_test_passed updated', {n_test_passed: roomStatus[client.room]['newGameRoundReady'], n:roomStatus[client.room]['n']});
		}
	});

	client.on("disconnect", function () {
		if(typeof client.room != 'undefined') {
			const room   = roomStatus[client.room];
			const round  = room.gameRound;
			const gameType = room.taskOrder[round];
			let thisRoomName = client.room;

			// ======= remove this client from the room =====
			client.leave(client.room);
			if (thisRoomName != 'decoyRoom') {
				total_N_now--;
			}

			roomStatus[thisRoomName]['disconnectedList'].push(client.session);
			let idPosition;
			//let subjectNumberPosition;
			if(roomStatus[thisRoomName]['membersID'].indexOf(client.session) > -1) {
				idPosition = roomStatus[thisRoomName]['membersID'].indexOf(client.session);
			}
			roomStatus[thisRoomName]['membersID'].splice(idPosition, 1);
			roomStatus[thisRoomName]['subjectNumbers'].splice(idPosition, 1);
			sessionNameSpace[client.session] = 0;

			let doneOrNot = -1;
			// This doneOrNot checks whether the disconnected client has not 
			// yet made a choice in the main stage. If doneOrNot > -1, it means
			// this client has already done the choice.
			if(typeof roomStatus[thisRoomName]['doneId'][roomStatus[thisRoomName]['trial']-1] != 'undefined') {
				doneOrNot = roomStatus[thisRoomName]['doneId'][roomStatus[thisRoomName]['trial']-1].indexOf(client.subjectNumber);
			} 
			if(doneOrNot > -1){
				roomStatus[thisRoomName]['doneId'][roomStatus[thisRoomName]['trial']-1].splice(doneOrNot, 1);
				roomStatus[client.room]['socialInfo'][roomStatus[client.room]['trial']-1].splice(doneOrNot, 1);
				roomStatus[client.room]['socialInfo'][roomStatus[client.room]['trial']-1].push(-1);
				if(typeof roomStatus[client.room]['doneNo'][roomStatus[client.room]['trial']-1] != 'undefined') {
					roomStatus[client.room]['doneNo'][roomStatus[client.room]['trial']-1]--;
				}
			}

			if(roomStatus[thisRoomName]['indivOrGroup'] != 0) {
				// =========  save data to mongodb by loop
			  	const worker = createWorker(path.join(__dirname, '../services/savingBehaviouralData_array.js'), roomStatus[client.room]['saveDataThisRound']);
		  		roomStatus[client.room]['saveDataThisRound'] = [];
		  		// =========  save data to mongodb by loop END
				roomStatus[thisRoomName]['n']--;
				// Note: 
				// if this is the Individual condition session's room, then I want 'n' to remain 1
				// so that no one will never enter this room again. 
				// On the other hand, if this is a group session's room, reducing 'n' may open up 
				// a room for a new-comer if this room is still at the first waiting screen
				// if (roomStatus[client.room]['doneNo'][roomStatus[client.room]['trial']-1] >= roomStatus[client.room]['n']) {
				//   	console.log(` - Result stage ended at: ${client.room}`);
				//   	proceedTrial(client.room);
				// }
			} else { // if this is the individual condition
				const worker = createWorker(path.join(__dirname, '../services/savingBehaviouralData_array.js'), roomStatus[client.room]['saveDataThisRound']);
			  	roomStatus[client.room]['saveDataThisRound'] = [];
			}
			// ======= remove this client from the room =====

			// This section checks if all clients in the room 
			// finishes the comprehension test.
			// If so, the room should move on to the main task.
			if (room.n > 0 && room.stage === 'secondWaitingRoom') {
				if (room.testPassed >= room.n) {
					console.log(' - ' + client.room + ' is ready to start the game (gameType = ' + gameType + ')');
					roomStatus[client.room]['groupTotalPayoff'][roomStatus[client.room]['pointer']-1] = 0 // initialising the total payoff tracker
					io.to(client.room).emit('all passed the test', 
						{n: roomStatus[client.room]['n']
							, testPassed: room.testPassed
							// , exp_condition: roomStatus[client.room]['exp_condition']
							, gameRound: roomStatus[client.room]['gameRound']
							, minGroupSize: minGroupSize
							, horizon: room.horizon
							, gameType: gameType
							, groupCumulativePayoff: 0
						});
					let now = new Date()
					firstTrialStartingTime = now;
					roomStatus[client.room]['stage'] = 'mainTask';
				}
			}

			// This section checks if all clients in the room 
			// finishes the instructino to the new gameRound
			// If so, the room should move on to the new game.
			if (roomStatus[client.room]['n']>0 && roomStatus[client.room]['stage'] == 'thirdWaitingRoom') {
				if (roomStatus[client.room]['newGameRoundReady'] >= roomStatus[client.room]['n']) {
		  	
					console.log(' - ' + client.room + ' is ready to start the new game round ' + (roomStatus[client.room]['gameRound']+1) );
		
					  io.to(client.room).emit('all are ready to move on', 
						{gameRound: roomStatus[client.room]['gameRound']
							, newGameRoundReady: roomStatus[client.room]['newGameRoundReady']
							// , exp_condition: roomStatus[client.room]['exp_condition']
							, horizon: roomStatus[client.room]['horizon']
							, taskType: roomStatus[client.room]['taskOrder'][roomStatus[client.room]['gameRound']]
						});
					  
					  firstTrialStartingTime = new Date();
					  roomStatus[client.room]['stage'] = 'mainTask';
				}
			}

			// This section checks if other clients in the room
			// have been waiting for this disconnected guy in the choice stage
			// If so, and if this means everyone in the room finished
			// this room should proceed to the result stage
			if (roomStatus[client.room]['doneNo'][ roomStatus[client.room]['pointer']-1 ] >= roomStatus[client.room]['n'] && roomStatus[client.room]['stage'] == 'mainTask') {
				// if there are less than two people who did NOT miss
				// team reward becomes zero
				let countPositive = roomStatus[client.room]['socialInfo'][roomStatus[client.room]['pointer']-1].filter(n => n > -1).length;
				if (countPositive < 2) {
					roomStatus[client.room]['groupTotalPayoff'][roomStatus[client.room]['pointer']-1] = 0;
				}
				if(roomStatus[client.room]?.round % 20 === 0) { 
					// save data to mongoDB
					const worker = createWorker(path.join(__dirname, '../services/savingBehaviouralData_array.js'), roomStatus[client.room]['saveDataThisRound']);
					roomStatus[client.room]['saveDataThisRound'] = [];
				}
				proceedToResult(client.room);
			} else {

				io.to(thisRoomName).emit('client disconnected', {roomStatus:roomStatus[thisRoomName], disconnectedClient:client.id});
			}


			
			


			/* // Payoff should be calculated immediately if the disconnected client was the last one 
			if (roomStatus[thisRoomName]['n']>0 && typeof roomStatus[client.room]['socialInfo'][roomStatus[client.room]['trial']-1] != 'undefined') {
				let numChoiceDone = roomStatus[client.room]['socialInfo'][roomStatus[client.room]['trial']-1].filter(function(value){ return value >= 0});
				if (numChoiceDone.length >= roomStatus[thisRoomName]['n']) {
				  	calculatePayoff(0, numChoiceDone, K, thisRoomName, roomStatus[thisRoomName]['choiceOrder'][roomStatus[thisRoomName]['trial']-1], roomStatus[thisRoomName]['socialInfo'][roomStatus[thisRoomName]['trial']-1], client.session, client.subjectNumber);
				  	roomStatus[thisRoomName]['saveDataThisRound'] = [];
				} else {
				  //io.to(thisRoomName).emit('client disconnected', {n:roomStatus[thisRoomName]['n']});
				  //io.to(thisRoomName).emit('client disconnected', {roomStatus:roomStatus[thisRoomName]});
				}
			}
			*/

			// When this disconnection made the groupSize == 0, 
			// waiting room's clock should be reset.
			// If I don't do this, the next new subject would not have time to wait other people.
			if(roomStatus[thisRoomName]['n'] <= 0){
				stopAndResetClock(thisRoomName);
			}

			logger.logConnection('client_disconnected', {
				socketId: client.id,
				subjectID: client.subjectID,
				sessionName: client.session,
				roomName: thisRoomName,
				roomSize: roomStatus[thisRoomName]['n'],
				totalConnections: total_N_now
			});
		}
	});
});

// ==========================================
// Functions
// ==========================================
function getRandomIntInclusive(max, min = 0) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; //Both the maximum and minimum are inclusive 
}

// shuffling function
function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}


function weightedRand2 (spec) {
  var i, sum=0, r=Math.random();
  for (i in spec) {
    sum += spec[i];
    if (r <= sum) return i;
  }
}
//weightedRand2({0:prob_conditions, 1:(1-prob_conditions)});

function rand(max, min = 0) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function proceedToResult (room) {
	roomStatus[room]['stage'] = 'resultFeedback';
	logger.logGameEvent('feedback_stage', {
		subjectID: room,
		roomId: room,
		payload: {
			collectivePayoff: roomStatus[room]['groupTotalPayoff'][roomStatus[room]['pointer']-1],
			socialFreq: roomStatus[room]['socialFreq'][roomStatus[room]['pointer']-1],
			trial: roomStatus[room]['trial']
		}
	});
	// For both group and individual conditions, proceed to result scene
	// Individual players (n=1) should continue playing, not be kicked out
	io.to(room).emit('Proceed to the result scene', roomStatus[room]);
}


function proceedTrial (room) {

	// every single individual payoff
	roomStatus[room]['totalPayoff_perIndiv'][roomStatus[room]['pointer']-1] =
		Math.round( roomStatus[room]['groupTotalPayoff'][roomStatus[room]['pointer']-1] / roomStatus[room]['n'] );
	// total individual payoff for each game
	roomStatus[room]['totalPayoff_perIndiv_perGame'][roomStatus[room]['gameRound']] +=
	roomStatus[room]['totalPayoff_perIndiv'][roomStatus[room]['pointer']-1];

	roomStatus[room]['trial']++; // the position in the gameRound
	roomStatus[room]['pointer']++; // the position in enture data
	roomStatus[room]['groupTotalPayoff'][roomStatus[room]['pointer']-1] = 0 // initialising the total payoff tracker

	// take note the current env
	if (roomStatus[room]['taskOrder'][roomStatus[room]['gameRound']] == 'dynamic') {
		if (roomStatus[room]['trial'] >= changePoints[roomStatus[room]['envChangeTracker']]) {
			roomStatus[room]['currentEnv']++;
			roomStatus[room]['envChangeTracker']++;
			console.log(' - Env changed to '+ (roomStatus[room]['currentEnv']) +' starts in '+ room);
		}
	} else {
		roomStatus[room]['currentEnv'] = 0; // it's always 0 for static
	}

	if(roomStatus[room]['trial'] <= roomStatus[room]['horizon']) {
		// change the room's stage
		roomStatus[room].stage = 'mainTask';
		io.to(room).emit('Proceed to next trial', roomStatus[room]);
		console.log(' - New trial '+ (roomStatus[room]['trial']) +' starts in '+ room);
	} else {
		// change the room's stage
		roomStatus[room].stage = 'instruction';
		// update the room status
		roomStatus[room]['gameRound']++; // move to the next round
		roomStatus[room]['trial'] = 1; // resetting the trial num
		roomStatus[room]['currentEnv'] = 0; // resetting the environment num
		if (roomStatus[room]['taskOrder'][roomStatus[room]['gameRound']] == 'dynamic') {
			roomStatus[room]['horizon'] = config.horizonList[1]
		} else {
			roomStatus[room]['horizon'] = config.horizonList[0]
		}
		// announcing ending the round
		io.to(room).emit('End this session', roomStatus[room]);
		console.log(' - End this round '+ (roomStatus[room]['gameRound']) +' in '+ room);
	}
	
}

function proceedRound (room) {

	// every single individual payoff
	roomStatus[room]['totalPayoff_perIndiv'][roomStatus[room]['pointer']-1] =
		Math.round( roomStatus[room]['groupTotalPayoff'][roomStatus[room]['pointer']-1] / roomStatus[room]['n'] );
	// total individual payoff for each game
	roomStatus[room]['totalPayoff_perIndiv_perGame'][roomStatus[room]['gameRound']] +=
		Math.round( roomStatus[room]['groupTotalPayoff'][roomStatus[room]['pointer']-1] / roomStatus[room]['n'] );

	roomStatus[room]['optionOrder'] = shuffle(options);

	roomStatus[room]['trial']++;
	roomStatus[room]['pointer']++; // pointer keep tracks round + horizon * gameRound
	if(roomStatus[room]['trial'] <= roomStatus[room]['horizon']) {
		io.to(room).emit('Proceed to next round', roomStatus[room]);
	} else {
		io.to(room).emit('End this session', roomStatus[room]);
	}
	console.log(' - New gameRound '+ (roomStatus[room]['gameRound']+1) +' starts in '+room);
}

function countDown(room) {
	//console.log('rest time of ' + room + ' is ' + roomStatus[room]['restTime']);
	roomStatus[room]['restTime'] -= 500;
	if (roomStatus[room]['restTime'] < 0) {
	//setTimeout(function(){ startSession(room) }, 1500); // this delay allows the 'start' text's effect
	if(roomStatus[room]['n'] < minGroupSize && roomStatus[room]['indivOrGroup'] != 0) {
	 	roomStatus[room]['starting'] = 1;
	  	io.to(room).emit('you guys are individual condition');
	} else {
	  	startSession(room);
	}
	//clearTimeout(countDownWaiting[room]);
	} else {
		let room2 = room;
		countDownWaiting[room] = setTimeout(function(){ countDown(room2) }, 500);
	}
}

function startSession (room) {
	if(typeof countDownWaiting[room] != 'undefined') {
		clearTimeout(countDownWaiting[room]);
	}
	roomStatus[room]['starting'] = 1;
	if (roomStatus[room]['n'] < minGroupSize) {
		roomStatus[room]['indivOrGroup'] = 0; // individual condition
	} else {
		roomStatus[room]['indivOrGroup'] = 1; // group condition
	}
	io.to(room).emit('this room gets started', 
		{room: room
		, n: roomStatus[room]['n']
		// , exp_condition: roomStatus[room]['exp_condition']
		, indivOrGroup: roomStatus[room]['indivOrGroup']
		, optionOrder: roomStatus[room]['optionOrder']
		, maxChoiceStageTime:maxChoiceStageTime
		, taskOrder: roomStatus[room]['taskOrder']
		, numOptions: K
		, horizon: horizon
	});
	console.log(' - session started in '+room);
}

function emitParameters(client) {
	// ── local shortcuts ─────────────────────────────────────
	const room   = roomStatus[client.room];
	const { taskOrder } = room;
  
	// ── derive values ───────────────────────────────────────
	room.horizon = horizon;
  
	// ── build one tidy payload object ───────────────────────
	const payload = {
	  id               : client.session,
	  room             : client.room,
	  maxChoiceStageTime,
	  maxTimeTestScene,
	//   exp_condition    : room.exp_condition,
	  info_share_cost  : room.info_share_cost,
	  horizon          : room.horizon,
	  subjectNumber    : client.subjectNumber,
	  indivOrGroup     : room.indivOrGroup,
	  numOptions: K,
	  optionOrder      : room.optionOrder,
	  taskOrder,
	  gameRound        : room.gameRound,
	  changePoints,                               // env-change points
	  environments     : [prob_0, prob_1, prob_2, prob_3, prob_4] // payoff profiles
	};
  
	// ── emit & log ──────────────────────────────────────────
	io.to(client.session).emit('this_is_your_parameters', payload);
	console.log(` - parameters sent to ${client.session} (room ${client.room}) with taskOrder = ${taskOrder}`);
}


function startWaitingStageClock (room) {
    console.log(' - Waiting room opened at '+ room);
    countDown(room);
}

function stopAndResetClock (room) {
  	clearTimeout(countDownWaiting[room]);
  	roomStatus[room]['restTime'] = maxWaitingTime;
}


// function generating a Gaussien random variable
function BoxMuller(m, sigma) {
    let a = 1 - Math.random();
    let b = 1 - Math.random();
    let c = Math.sqrt(-2 * Math.log(a));
    if(0.5 - Math.random() > 0) {
        return c * Math.sin(Math.PI * 2 * b) * sigma + m;
    }else{
        return c * Math.cos(Math.PI * 2 * b) * sigma + m;
    }
};

// a function to create an n-dimensional array
function createArray(length) {
    var arr = new Array(length || 0),
        i = length;

    if (arguments.length > 1) {
        var args = Array.prototype.slice.call(arguments, 1);
        while(i--) arr[length-1 - i] = createArray.apply(this, args);
    }

    return arr;
}

// worker_thread
function createWorker(path, wd, id) {
	const w = new Worker(path, {workerData: wd});

	w.on('error', (err) => {
		console.error(`Worker ${w.workerData} error`)
		console.error(err);
	});

	w.on('exit', (exitCode) => {
		let exitlogtxt = ` - exitted! : ${id}`;
		console.log(exitlogtxt);
	});

	w.on('message', (msg) => {
		let messagelogtxt = ` - [Main] Message got from worker ${msg}`;
		// workerスレッドから送信されたメッセージ
		console.log(messagelogtxt);
	});
	return w;
}

function makeid(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

function indexOfMax(arr) {
    if (arr.length === 0) {
        return -1;
    }

    var max = arr[0];
    var maxIndex = 0;

    for (var i = 1; i < arr.length; i++) {
        if (arr[i] > max) {
            maxIndex = i;
            max = arr[i];
        }
    }

    return maxIndex;
}
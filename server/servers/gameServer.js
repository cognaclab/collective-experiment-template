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

// Config-driven experiment system
const ExperimentLoader = require('../services/ExperimentLoader');
const ExperimentContext = require('../services/ExperimentContext');

// Socket event handlers
const { onConnectioncConfig } = require('../socket/handlerOnConnection');
const { handleCoreReady } = require('../socket/coreReadyHandler');
const { handlePreviousRestTime } = require('../socket/handlePreviousRestTime');
const { handleOkIndividualCondition } = require('../socket/handleOkIndividualCondition');
const handleTestPassed = require('../socket/handleTestPassed');
const handleChoiceMade = require('../socket/handleChoiceMade');
const { handleDataFromIndiv } = require('../socket/handleDataFromIndiv');
const { handleResultFeedbackEnded } = require('../socket/handleResultFeedbackEnded');
const { handleNewGameRoundReady } = require('../socket/handleNewGameRoundReady');
const { handleDisconnect } = require('../socket/handleDisconnect');

// Session management utilities
const { countDown, startSession, reformNewGroups } = require('../socket/sessionManager');
const { emitParameters } = require('../socket/paramEmitters');
const { startWaitingStageClock } = require('../socket/waitingTimers');

// Helper utilities
const {
  makeid,
  createArray,
  indexOfMax,
  shuffle,
  getRandomIntInclusive
} = require('../utils/helpers');

const { createRoom } = require('../utils/roomFactory');

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

// ==========================================
// Initialize Config-Driven Experiment System
// ==========================================
let experimentLoader;
let experimentContext;
let loadedConfig;

try {
	// Load experiment configuration from deployed directory
	experimentLoader = new ExperimentLoader();
	experimentLoader.loadConfig();
	experimentContext = new ExperimentContext(experimentLoader);
	loadedConfig = experimentLoader.gameConfig;

	logger.info('Config-driven experiment system initialized', {
		name: experimentLoader.getMetadata().name,
		strategy: experimentContext.getStrategyName(),
		horizon: loadedConfig.horizon,
		k_armed_bandit: loadedConfig.k_armed_bandit
	});
} catch (error) {
	logger.error('Failed to load experiment config - using fallback defaults', {
		error: error.message
	});
	// Fallback to hardcoded defaults if config loading fails
	loadedConfig = null;
}

// Experimental variables (use loaded config or fallback to defaults)
const horizon = loadedConfig ? loadedConfig.horizon : 20 // number of trials
, sessionNo = 0 // 0 = debug;
, maxGroupSize = loadedConfig ? loadedConfig.max_group_size : 5 // maximum size per group
, minGroupSize = loadedConfig ? loadedConfig.min_group_size : (parseInt(process.env.MIN_GROUP_SIZE) || 2)
, maxWaitingTime = loadedConfig ? loadedConfig.max_waiting_time : config.maxWaitingTime
, K = loadedConfig ? loadedConfig.k_armed_bandit : 3 // number of bandit options
, maxChoiceStageTime = loadedConfig ? loadedConfig.max_choice_time : (10 * 1000)
, maxTimeTestScene = 4 * 60 * 1000 // 4*60*1000
, task_order = ['static', 'dynamic'] // ramdomized environmental order (2 rounds)
, changePoints = [17, 29, 45] // trials from which a new env setting starts
, totalGameRound = loadedConfig ? loadedConfig.total_game_rounds : 2
// , exp_condition_list = ['groupPayoff'] //['binary', 'gaussian'] // noise profiles
, prob_conditions = 1.0// probability of assigning each exp condition
, prob_0 = loadedConfig?.environments?.static?.prob_0 || [0.7, 0.4, 0.3] // environment 0 (static)
, prob_1 = loadedConfig?.environments?.static?.prob_1 || [0.8, 0.3, 0.3] // environment 1
, prob_2 = loadedConfig?.environments?.static?.prob_2 || [0.3, 0.3, 0.8] // environment 2
, prob_3 = loadedConfig?.environments?.static?.prob_3 || [0.8, 0.3, 0.3] // environment 3
, prob_4 = loadedConfig?.environments?.static?.prob_4 || [0.3, 0.8, 0.3] // environment 4
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

// Create a lightweight config for room creation (before gameConfig is fully built)
const roomCreationConfig = {
	maxGroupSize,
	numOptions: K,
	maxWaitingTime,
	maxChoiceStageTime,
	totalGameRound,
	minHorizon: config.minHorizon,
	static_horizons: config.static_horizons,
	numEnv: config.numEnv,
	task_order,
	options,
	prob_conditions,
	exp_condition_list: config.exp_condition_list,
	horizon
};

// this 'decoyRoom' is where reconnected subjects are sent
roomStatus['decoyRoom'] = createRoom({ isDecoy: true, name: 'decoyRoom', config: roomCreationConfig });
/*
// OLD MANUAL CREATION - NOW USING createRoom()
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
*/
// The following is the first room
// Therefore, Object.keys(roomStatus).length = 2 right now
// A new room will be open once this room becomes full
roomStatus[firstRoomName] = createRoom({ name: firstRoomName, config: roomCreationConfig });


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

// ==========================================
// Create game configuration object for handlers
// ==========================================
const gameConfig = {
	roomStatus,
	sessionNameSpace,
	sessionNo,
	horizon,
	minHorizon: config.minHorizon,
	numEnv: config.numEnv,
	static_horizons: config.static_horizons,
	maxGroupSize,
	minGroupSize,
	maxWaitingTime,
	maxChoiceStageTime,
	maxTimeTestScene,
	totalGameRound,
	horizonList: config.horizonList,
	targetGroupSizes: config.targetGroupSizes,
	numOptions: K,
	changes: changePoints,
	prob_0,
	prob_1,
	prob_2,
	prob_3,
	prob_4,
	myMonth,
	myDate,
	myHour,
	myMin,
	PORT: config.PORT,
	// Add experiment context and loader for strategy pattern
	experimentContext,
	experimentLoader,
	loadedConfig
};

/**
 * Socket.IO Connection Handlers
 *
 * Architecture Note: This file uses modular event handlers imported from
 * server/socket/ directory. Each event type has its own handler module for
 * clarity and maintainability. This modular pattern makes it easier to test
 * and modify individual handler logic.
 */
io.on('connection', function (client) {
	// Initialize client connection
	onConnectioncConfig({ config: gameConfig, client, io });

	// Create shared context for all event handlers
	const total_N_nowRef = { value: total_N_now };
	const firstTrialStartingTimeRef = {};

	// ===== Event Handler: 'core is ready' =====
	client.on('core is ready', function(data) {
		const context = {
			config: gameConfig,
			client,
			data,
			roomStatus,
			io,
			countDownMainStage,
			countDownWaiting,
			total_N_nowRef
		};
		handleCoreReady(context);
		// Update global counter
		total_N_now = total_N_nowRef.value;
	});

	// ===== Event Handler: 'this is the previous restTime' =====
	client.on('this is the previous restTime', function(data) {
		handlePreviousRestTime(io, client, data, gameConfig);
	});

	// ===== Event Handler: 'ok individual condition sounds good' =====
	client.on('ok individual condition sounds good', function() {
		handleOkIndividualCondition(client, gameConfig, io, countDownWaiting);
	});

	// ===== Event Handler: 'let me in one of them' (group regrouping) =====
	client.on('let me in one of them', function(data) {
		const { handleLetMeIn } = require('../socket/handleLetMeIn');
		handleLetMeIn(client, gameConfig, data.rooms, io, countDownWaiting);
	});

	// ===== Event Handler: 'test passed' =====
	client.on('test passed', function() {
		if (!firstTrialStartingTimeRef[client.room]) {
			firstTrialStartingTimeRef[client.room] = new Date();
		}
		handleTestPassed(client, gameConfig, io, firstTrialStartingTimeRef);
	});

	// ===== Event Handler: 'choice made' =====
	client.on('choice made', function(data) {
		if (!firstTrialStartingTimeRef[client.room]) {
			firstTrialStartingTimeRef[client.room] = new Date();
		}
		handleChoiceMade(client, data, gameConfig, io, firstTrialStartingTimeRef);
	});

	// ===== Event Handler: 'Data from Indiv' =====
	client.on('Data from Indiv', function(data) {
		handleDataFromIndiv(client, data);
	});

	// ===== Event Handler: 'result feedback ended' =====
	client.on('result feedback ended', function(data) {
		if (!firstTrialStartingTimeRef[client.room]) {
			firstTrialStartingTimeRef[client.room] = new Date();
		}
		handleResultFeedbackEnded(client, data, gameConfig, io, firstTrialStartingTimeRef);
	});

	// ===== Event Handler: 'new gameRound ready' =====
	client.on('new gameRound ready', function(data) {
		firstTrialStartingTimeRef[client.room] = new Date();
		handleNewGameRoundReady(client, data, gameConfig, io, firstTrialStartingTimeRef);
	});

	// ===== Event Handler: 'disconnect' =====
	client.on('disconnect', function() {
		const context = {
			client,
			config: gameConfig,
			io,
			countDownWaiting,
			total_N_nowRef,
			firstTrialStartingTimeRef
		};
		handleDisconnect(context);
		// Update global counter
		total_N_now = total_N_nowRef.value;
	});
});

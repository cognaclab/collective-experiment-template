'use strict';

// config/constants.js or config/game.js

// Load environment variables
require('dotenv').config();

// Helper function to generate random string
function makeid(length) {
   let result           = '';
   let characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
   let charactersLength = characters.length;
   for ( let i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

// Helper function to find index of maximum value
function indexOfMax(arr) {
  return arr.indexOf(Math.max(...arr));
}

// Experimental variables
const ipAddress = process.env.PRODUCTION_URL || `http://tk2-127-63496.vs.sakura.ne.jp`;
const PORT = process.env.GAME_PORT || 8181;
const minHorizon = 19; //19; // horizon for a local static env
const static_horizons = [19,19,19,19]; //[22, 19, 18, 21];
const changes = [19, 38, 57]; //[22, 41, 59]; //[17, 29, 45];
const numEnv = 4; // number of static envs
const horizonList = [minHorizon, minHorizon * numEnv];
const totalGameRound = 4;
const sessionNo = 25082900; // YYMMDD00
const targetGroupSizes = [10, 5, 2]; //[10, 5, 3, 2];
const maxGroupSize = Math.max(...targetGroupSizes);
const minGroupSize = Math.min(...targetGroupSizes);
const maxWaitingTime = 10 * 1000; // 10 seconds for development/testing (use 120 * 1000 for production)
const numOptions = 3;
const maxChoiceStageTime = 10 * 1000;
const maxTimeTestScene = 4 * 60 * 1000;
const taskList = ['static']; //['static', 'dynamic']; // true or false
const task_order = ['static']; //['static', 'dynamic'];
const exp_condition_list = ['groupPayoff'];
const prob_conditions = 1.0;

// Debug subject IDs that bypass validation and can be reused for testing
const debugExceptions = [
  'wataruDebug',  // Original internal test IDs
  'test', 'debug', 'quicktest',    // Quick-test recommended IDs
  'test1', 'test2', 'test3',       // Common test IDs used in docs
  'alice', 'bob', 'carol',         // Named test users in docs
  'player1', 'player2', 'player3'  // Player IDs for group testing
];
const prob_0 = [0.7, 0.4, 0.3];
const prob_1 = [0.8, 0.3, 0.3];
const prob_2 = [0.3, 0.3, 0.8];
const prob_3 = [0.8, 0.3, 0.3];
const prob_4 = [0.3, 0.8, 0.3];

const position_best_arm = [
  indexOfMax(prob_0),
  indexOfMax(prob_1),
  indexOfMax(prob_2),
  indexOfMax(prob_3),
  indexOfMax(prob_4)
];

const options = [];
for (let i = 1; i <= numOptions; i++) {
  options.push(i);
}

// experimental server
const firstRoomName = makeid(8) + '_session_' + sessionNo;
const	roomStatus = {};
const sessionNameSpace = {};
;

// Date and time (formatted with leading zeros)
const now = new Date();
const myMonth = String(now.getMonth() + 1).padStart(2, '0');
const myDate  = String(now.getUTCDate()).padStart(2, '0');
const myHour  = String(now.getUTCHours()).padStart(2, '0');
const myMin   = String(now.getUTCMinutes()).padStart(2, '0');

module.exports = {
  ipAddress,
  PORT,
  horizonList,
  static_horizons,
  minHorizon,
  numEnv,
  sessionNo,
  maxGroupSize,
  minGroupSize,
  targetGroupSizes,
  maxWaitingTime,
  numOptions,
  maxChoiceStageTime,
  maxTimeTestScene,
  taskList,
  task_order,
  changes,
  totalGameRound,
  exp_condition_list,
  prob_conditions,
  debugExceptions,
  prob_0,
  prob_1,
  prob_2,
  prob_3,
  prob_4,
  position_best_arm,
  options,
  firstRoomName,
  roomStatus,
  sessionNameSpace,
  myMonth,
  myDate,
  myHour,
  myMin
};

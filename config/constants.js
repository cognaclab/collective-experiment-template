'use strict';

// config/constants.js
// System-wide configuration and fallback defaults
// NOTE: Experiment-specific values should be in deployed/config.yaml
// This file contains ONLY system infrastructure settings and safe fallback defaults

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

// ==========================================
// SYSTEM INFRASTRUCTURE SETTINGS
// ==========================================

// Server configuration (from environment or defaults)
const ipAddress = process.env.PRODUCTION_URL || `http://tk2-127-63496.vs.sakura.ne.jp`;
const PORT = process.env.GAME_PORT || 8181;

// Debug subject IDs that bypass validation and can be reused for testing
// These are system-wide test accounts, not experiment-specific
const debugExceptions = [
  'wataruDebug',  // Original internal test IDs
  'test', 'debug', 'quicktest',    // Quick-test recommended IDs
  'test1', 'test2', 'test3',       // Common test IDs used in docs
  'alice', 'bob', 'carol',         // Named test users in docs
  'player1', 'player2', 'player3'  // Player IDs for group testing
];

// Date and time (formatted with leading zeros)
const now = new Date();
const myMonth = String(now.getMonth() + 1).padStart(2, '0');
const myDate  = String(now.getUTCDate()).padStart(2, '0');
const myHour  = String(now.getUTCHours()).padStart(2, '0');
const myMin   = String(now.getUTCMinutes()).padStart(2, '0');

// Session tracking
const sessionNo = 25082900; // YYMMDD00
const firstRoomName = makeid(8) + '_session_' + sessionNo;
const roomStatus = {};
const sessionNameSpace = {};

// ==========================================
// FALLBACK DEFAULTS
// Used only when deployed/config.yaml is missing or incomplete
// ==========================================

const FALLBACK_DEFAULTS = {
  // Game parameters
  minHorizon: 19,
  static_horizons: [19, 19, 19, 19],
  changes: [19, 38, 57],
  numEnv: 4,
  totalGameRound: 4,

  // Group settings
  targetGroupSizes: [10, 5, 2],
  maxGroupSize: 10,
  minGroupSize: 2,

  // Time limits
  maxWaitingTime: 120 * 1000, // 2 minutes (production default)
  maxChoiceStageTime: 20 * 1000, // 20 seconds
  maxTimeTestScene: 4 * 60 * 1000, // 4 minutes

  // Bandit settings
  numOptions: 3,

  // Task settings
  taskList: ['static', 'dynamic'],
  task_order: ['static', 'dynamic'],
  exp_condition_list: ['groupPayoff'],
  prob_conditions: 1.0,

  // Environment probabilities (example defaults)
  prob_0: [0.7, 0.4, 0.3],
  prob_1: [0.8, 0.3, 0.3],
  prob_2: [0.3, 0.3, 0.8],
  prob_3: [0.8, 0.3, 0.3],
  prob_4: [0.3, 0.8, 0.3]
};

// Computed fallback values
const horizonList = [FALLBACK_DEFAULTS.minHorizon, FALLBACK_DEFAULTS.minHorizon * FALLBACK_DEFAULTS.numEnv];
const position_best_arm = [
  indexOfMax(FALLBACK_DEFAULTS.prob_0),
  indexOfMax(FALLBACK_DEFAULTS.prob_1),
  indexOfMax(FALLBACK_DEFAULTS.prob_2),
  indexOfMax(FALLBACK_DEFAULTS.prob_3),
  indexOfMax(FALLBACK_DEFAULTS.prob_4)
];

const options = [];
for (let i = 1; i <= FALLBACK_DEFAULTS.numOptions; i++) {
  options.push(i);
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // System infrastructure (always use these)
  ipAddress,
  PORT,
  debugExceptions,
  sessionNo,
  firstRoomName,
  roomStatus,
  sessionNameSpace,
  myMonth,
  myDate,
  myHour,
  myMin,

  // Fallback defaults (used only when config.yaml is missing)
  // These are exported for backward compatibility but should NOT be relied upon
  horizonList: horizonList,
  static_horizons: FALLBACK_DEFAULTS.static_horizons,
  minHorizon: FALLBACK_DEFAULTS.minHorizon,
  numEnv: FALLBACK_DEFAULTS.numEnv,
  maxGroupSize: FALLBACK_DEFAULTS.maxGroupSize,
  minGroupSize: FALLBACK_DEFAULTS.minGroupSize,
  targetGroupSizes: FALLBACK_DEFAULTS.targetGroupSizes,
  maxWaitingTime: FALLBACK_DEFAULTS.maxWaitingTime,
  numOptions: FALLBACK_DEFAULTS.numOptions,
  maxChoiceStageTime: FALLBACK_DEFAULTS.maxChoiceStageTime,
  maxTimeTestScene: FALLBACK_DEFAULTS.maxTimeTestScene,
  taskList: FALLBACK_DEFAULTS.taskList,
  task_order: FALLBACK_DEFAULTS.task_order,
  changes: FALLBACK_DEFAULTS.changes,
  totalGameRound: FALLBACK_DEFAULTS.totalGameRound,
  exp_condition_list: FALLBACK_DEFAULTS.exp_condition_list,
  prob_conditions: FALLBACK_DEFAULTS.prob_conditions,
  prob_0: FALLBACK_DEFAULTS.prob_0,
  prob_1: FALLBACK_DEFAULTS.prob_1,
  prob_2: FALLBACK_DEFAULTS.prob_2,
  prob_3: FALLBACK_DEFAULTS.prob_3,
  prob_4: FALLBACK_DEFAULTS.prob_4,
  position_best_arm,
  options
};

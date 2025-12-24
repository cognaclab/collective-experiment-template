'use strict';
// utils/roomFactory.js

const {
    createArray
    , createArrayOfEmptyArrays
    , createNestedFilledArray
    , createFilledArray
    , getRandomIntInclusive
    , shuffle
    , modeToNumeric
} = require('./helpers');
const constants = require('../../config/constants');
const NetworkGraph = require('./NetworkGraph');
const PairingManager = require('./PairingManager');

/**
 * Create a room with configuration
 * @param {Object} options - Room creation options
 * @param {boolean} options.isDecoy - Whether this is a decoy room
 * @param {string} options.name - Room name
 * @param {Object} options.config - Game configuration (optional, uses constants as fallback)
 * @param {string} options.mode - Experiment mode ('individual' or 'group', optional)
 * @param {string} options.expCondition - Experimental condition label (optional)
 */
function createRoom({ isDecoy = false, name = 'unnamedRoom', config = null, mode = null, expCondition = null } = {}) {
    // Use provided config or fall back to constants
    const maxGroupSize = config?.maxGroupSize || constants.maxGroupSize;
    const numOptions = config?.numOptions || constants.numOptions;
    const maxWaitingTime = config?.maxWaitingTime || constants.maxWaitingTime;
    const maxChoiceStageTime = config?.maxChoiceStageTime || constants.maxChoiceStageTime;
    const totalGameRound = config?.totalGameRound || constants.totalGameRound;
    const minHorizon = config?.minHorizon || constants.minHorizon;
    const static_horizons = config?.static_horizons || constants.static_horizons;
    const numEnv = config?.numEnv || constants.numEnv;
    const task_order = config?.task_order || constants.task_order;
    const options = config?.options || constants.options;

    const totalHorizon = minHorizon * numEnv;
    const taskOrder = shuffle(task_order);
    // Use taskType from config (e.g., 'networked_pd') if provided, otherwise default to first shuffled task
    const taskType = config?.task_type || taskOrder[0];

    // Convert mode string to numeric if provided, otherwise use -1
    const indivOrGroupValue = mode ? modeToNumeric(mode) : -1;

    // Use provided expCondition from YAML config
    const expConditionValue = isDecoy ? 'decoyRoom' : (expCondition || 'default');

    // Initialize network and pairing for networked experiments
    let network = null;
    let pairingManager = null;

    if (config && config.network && config.network.ostracism_enabled) {
        const topology = config.network.initial_topology || 'complete';
        network = new NetworkGraph(maxGroupSize, topology);
        pairingManager = new PairingManager(network, config.pairing || {});
    }

    // Initialize two-phase experiment configuration
    let phaseConfig = null;
    let currentPhaseName = 'blind';
    let currentPhaseIndex = 0;

    if (config?.experiment_phases?.enabled) {
        const phases = config.experiment_phases.phases || [];

        // Handle force_single_phase override (for testing)
        if (config.experiment_phases.force_single_phase) {
            const forcedPhase = phases.find(p => p.name === config.experiment_phases.force_single_phase);
            if (forcedPhase) {
                phaseConfig = forcedPhase;
                currentPhaseName = forcedPhase.name;
            }
        }
        // Handle force_phase_order override (for testing)
        else if (config.experiment_phases.force_phase_order === 'transparent_first') {
            const transparentPhase = phases.find(p => p.name === 'transparent');
            if (transparentPhase) {
                phaseConfig = transparentPhase;
                currentPhaseName = 'transparent';
                currentPhaseIndex = 1; // Treat as if we've already done blind
            }
        }
        // Normal: start with first phase (blind)
        else if (phases.length > 0) {
            phaseConfig = phases[0];
            currentPhaseName = phases[0].name || 'blind';
        }
    }

    return {
        roomId: name, // Store room identifier for database
        experimentConfig: config, // Store full config for RewardCalculator and other uses
        exp_condition: expConditionValue,
        riskDistributionId: getRandomIntInclusive(13, 13),
        optionOrder: shuffle(options),
        taskType: taskType,
        taskOrder: taskOrder,
        indivOrGroup: indivOrGroupValue,
        horizon: taskType === 'static' ? static_horizons[0] : totalHorizon,
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
        doneId: createArrayOfEmptyArrays(totalHorizon),
        doneNo: createArray(totalHorizon),
        readyNo: createArray(totalHorizon),
        socialFreq: createArray(totalHorizon, numOptions),
        socialInfo: createNestedFilledArray(totalHorizon, maxGroupSize, 0),
        publicInfo: createNestedFilledArray(totalHorizon, maxGroupSize, 0),
        share_or_not: createNestedFilledArray(totalHorizon, maxGroupSize, -1),
        choiceOrder: createNestedFilledArray(totalHorizon, maxGroupSize, -1),
        saveDataThisRound: [],
        restTime: maxWaitingTime,
        groupTotalPayoff: createFilledArray(numEnv, 0),
        groupCumulativePayoff: createFilledArray(numEnv, 0),
        totalPayoff_perIndiv: [0],
        totalPayoff_perIndiv_perGame: new Array(totalGameRound).fill(0),
        groupTotalCost: [0],
        currentEnv: 0,
        envChangeTracker: 0,
        currentScene: null,

        // Networked experiment state
        network: network,
        pairingManager: pairingManager,
        currentPairings: [],           // Current round's pairings: [[p1, p2], ...]
        isolatedPlayers: [],           // Players with no valid partners
        ostracismVotes: {},            // { roundNum: { playerId: { partnerId, vote, timestamp } } }
        cooperationHistory: {},        // { playerId: { partnerId: [choices] } }
        roundNumber: 0,                // Current round (for networked PD)

        // Round/Turn structure for networked PD
        // gameRound: which round we're in (0-indexed, e.g., 0, 1, 2 for 3 rounds)
        // turnWithinRound: which turn within the current round (1-indexed, e.g., 1, 2 for 2 turns)
        // turnsPerRound: how many turns per round (from config, default 2)
        // totalGameRounds: total number of rounds (from config, default 3)
        turnWithinRound: 1,
        turnsPerRound: config?.game?.horizon || 2,
        totalGameRounds: config?.game?.total_game_rounds || 3,
        currentRoundPartner: {},       // { playerId: partnerId } - persists for entire round

        // =================================================================
        // Two-Phase Experiment State (blind vs transparent conditions)
        // =================================================================
        currentPhaseIndex: currentPhaseIndex,
        currentPhaseName: currentPhaseName,
        phaseConfig: phaseConfig,
        phaseStartTrial: 1,            // Trial number when current phase started
        phasePayoffs: {},              // payoffs[phaseIndex][playerIndex] = cumulative points

        // MFQ (Moral Foundations Questionnaire) scores
        // Loaded at room formation, used in transparent phase
        mfqScores: {},                 // mfqScores[subjectId] = { scores: {...}, levels: {...} }
        mfqDisplayConfig: config?.mfq_scores?.display_categories || null
    };
}

module.exports = { createRoom };
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
    const taskType = taskOrder[0];//shuffleAndTakeFirst(taskList);

    // Convert mode string to numeric if provided, otherwise use -1
    const indivOrGroupValue = mode ? modeToNumeric(mode) : -1;

    // Use provided expCondition from YAML config
    const expConditionValue = isDecoy ? 'decoyRoom' : (expCondition || 'default');

    return {
        roomId: name, // Store room identifier for database
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
        groupTotalPayoff: createFilledArray(numEnv, 0), //createArray(totalHorizon, 0),
        groupCumulativePayoff: createFilledArray(numEnv, 0), //[0, 0],
        totalPayoff_perIndiv: [0],
        totalPayoff_perIndiv_perGame: new Array(totalGameRound).fill(0),
        groupTotalCost: [0],
        currentEnv: 0,
        envChangeTracker: 0
    };
}

module.exports = { createRoom };
'use strict';
// utils/roomFactory.js

const {
    createArray
    , createArrayOfEmptyArrays
    , createNestedFilledArray
    , createFilledArray
    , getRandomIntInclusive
    , shuffle
    , shuffleAndTakeFirst
    , weightedRand2
} = require('./helpers');
const constants = require('../../config/constants');

/**
 * Create a room with configuration
 * @param {Object} options - Room creation options
 * @param {boolean} options.isDecoy - Whether this is a decoy room
 * @param {string} options.name - Room name
 * @param {Object} options.config - Game configuration (optional, uses constants as fallback)
 */
function createRoom({ isDecoy = false, name = 'unnamedRoom', config = null } = {}) {
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
    const prob_conditions = config?.prob_conditions || constants.prob_conditions;
    const exp_condition_list = config?.exp_condition_list || constants.exp_condition_list;

    const totalHorizon = minHorizon * numEnv;
    const taskOrder = shuffle(task_order);
    const taskType = taskOrder[0];//shuffleAndTakeFirst(taskList);

    return {
        exp_condition: isDecoy ? 'decoyRoom' : exp_condition_list[weightedRand2({ 0: prob_conditions, 1: (1 - prob_conditions) })],
        riskDistributionId: getRandomIntInclusive(13, 13),
        optionOrder: shuffle(options),
        taskType: taskType,
        taskOrder: taskOrder,
        indivOrGroup: -1,
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
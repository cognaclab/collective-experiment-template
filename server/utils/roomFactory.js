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
const {
    maxGroupSize,
    numOptions,
    maxWaitingTime,
    maxChoiceStageTime,
    totalGameRound,
    minHorizon,
    static_horizons,
    numEnv,
    taskList,
    task_order,
    options,
    prob_conditions,
    exp_condition_list
} = require('../../config/constants'); 

const totalHorizon = minHorizon * numEnv;

function createRoom({ isDecoy = false, name = 'unnamedRoom' } = {}) {
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
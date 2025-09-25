// /oneDimensionalTask_beta/models/behaviouralData.js
'use strict';

const mongoose = require('mongoose');
// mongoose.set('useCreateIndex', true);
const Schema = mongoose.Schema;

const Behaviour = new Schema({
    date: { type: String, require: false },
	time: { type: String, require: false },
    subjectID : { type: String, require: false, unique: false },
    exp_condition : { type: String, require: false },
    indivOrGroup : { type: String, require: false },
    groupSize : { type: String, require: false },
    room : { type: String, require: false },
    confirmationID : { type: String, require: false },
    subjectNumber : { type: String, require: false },
    pointer: { type: String, require: false },
    trial: { type: String, require: false },
    gameRound: { type: String, require: false },
    gameType: { type: String, require: false },
    this_env: { type: String, require: false },
    chosenOptionID: { type: String, require: false },
    chosenOptionLocation: { type: String, require: false },
    individual_payoff: { type: String, require: false },
    groupCumulativePayoff: { type: String, require: false },
    groupTotalPayoff: { type: String, require: false },
    socialFreq_0: { type: String, require: false },
    socialFreq_1: { type: String, require: false },
    socialFreq_2: { type: String, require: false },
    true_payoff_0: { type: String, require: false },
    true_payoff_1: { type: String, require: false },
    true_payoff_2: { type: String, require: false },
    dataType: { type: String, require: false },
    timeElapsed: { type: String, require: false },
    latency: { type: String, require: false },
    reactionTime: { type: String, require: false },
    maxGroupSize: { type: String, require: false },
    optionOrder_0 : { type: String, require: false },
    optionOrder_1 : { type: String, require: false },
    optionOrder_2 : { type: String, require: false },
    socialInfo_00: { type: String, require: false },
    socialInfo_01: { type: String, require: false },
    socialInfo_02: { type: String, require: false },
    socialInfo_03: { type: String, require: false },
    socialInfo_04: { type: String, require: false },
    socialInfo_05: { type: String, require: false },
    socialInfo_06: { type: String, require: false },
    socialInfo_07: { type: String, require: false },
    socialInfo_08: { type: String, require: false },
    socialInfo_09: { type: String, require: false },
    socialInfo_10: { type: String, require: false },
    socialInfo_11: { type: String, require: false }
},
    // Use environment variable for collection name, with sensible default
    {collection: process.env.MONGODB_COLLECTION || "default_experiment"}
    // Previous collections:
    // {collection:"collective_reward_exp"} // pilot (June 2025)
    // {collection:"collective_reward_exp_aug"} // exp August 2025
    // {collection:"collective_reward_debug"}
);

module.exports = mongoose.model('behaviour', Behaviour);

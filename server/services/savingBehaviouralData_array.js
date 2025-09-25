require('dotenv').config();
const { parentPort, workerData, isMainThread } = require('worker_threads');
const mongoose = require('mongoose');
const Behaviour = require('../database/models/behaviouralData');
const logger = require('../utils/logger');

const dbName = process.env.MONGODB_URI || 'mongodb://localhost:27017/collective_bandit_dev';

async function runWorker() {
  try {
    await mongoose.connect(dbName);
    const roomInfo = workerData?.[0]?.room || 'undefined';
    logger.logDatabaseOperation('connection_success', 'behaviouralData', { 
      room: roomInfo, 
      uri: dbName 
    });

    // Prepare documents
    const documents = workerData.map(d => ({
      date: d.date,
      time: d.time,
      exp_condition: d.exp_condition,
      indivOrGroup: d.indivOrGroup,
      groupSize: d.groupSize,
      room: d.room,
      confirmationID: d.confirmationID,
      subjectNumber: d.subjectNumber,
      subjectID: d.subjectID,
      pointer: d.pointer,
      trial: d.trial,
      gameRound: d.gameRound,
      gameType: d.gameType,
      chosenOptionID: d.chosenOptionID,
      individual_payoff: d.individual_payoff,
      groupCumulativePayoff: d.groupCumulativePayoff,
      groupTotalPayoff: d.groupTotalPayoff,
      dataType: d.dataType,
      timeElapsed: d.timeElapsed,
      latency: d.latency,
      socialFreq_0: d.socialFreq?.[0],
      socialFreq_1: d.socialFreq?.[1],
      socialFreq_2: d.socialFreq?.[2],
      chosenOptionLocation: d.chosenOptionLocation,
      maxGroupSize: d.maxGroupSize,
      optionOrder_0: d.optionOrder_0,
      optionOrder_1: d.optionOrder_1,
      optionOrder_2: d.optionOrder_2,
      true_payoff_0: d.true_payoff_0,
      true_payoff_1: d.true_payoff_1,
      true_payoff_2: d.true_payoff_2,
      reactionTime: d.reactionTime,
      this_env: d.this_env
    }));

    // Save all at once
    await Behaviour.insertMany(documents);

    logger.logDatabaseOperation('insert_many', 'behaviouralData', { 
      room: roomInfo,
      documentsCount: documents.length,
      isMainThread,
      operation: 'bulk_save'
    });

    if (parentPort) parentPort.postMessage(`[Worker] Finished ${roomInfo}`);
    process.exit(0);

  } catch (err) {
    logger.error('Database worker error', {
      error: err.message,
      stack: err.stack,
      room: workerData?.[0]?.room,
      documentsCount: workerData?.length
    });
    process.exit(1);
  }
}

runWorker();





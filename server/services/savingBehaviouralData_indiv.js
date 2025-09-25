require('dotenv').config();
const {parentPort, workerData, isMainThread, threadId} = require('worker_threads');
const mongoose = require('mongoose');
const dbName = process.env.MONGODB_URI || 'mongodb://localhost:27017/collective_bandit_dev';
// defining a model
const Behaviour = require('../database/models/behaviouralData');
const logger = require('../utils/logger');


async function runWorker() {
  try {
    // Connect to MongoDB
    await mongoose.connect(dbName, { useNewUrlParser: true, useUnifiedTopology: true});
    const roomInfo = workerData?.room || 'undefined';
    logger.logDatabaseOperation('connection_success', 'behaviouralData', { 
      room: roomInfo, 
      uri: dbName,
      workerType: 'individual'
    });

    // save each data to mongodb
    let behaviour = new Behaviour();
    behaviour.date = workerData.date;
    behaviour.time = workerData.time;
    behaviour.exp_condition = workerData.exp_condition;
    behaviour.isLeftRisky = workerData.isLeftRisky;
    behaviour.indivOrGroup = workerData.indivOrGroup;
    behaviour.groupSize = 1;
    behaviour.room = workerData.room;
    behaviour.confirmationID = workerData.confirmationID;
    behaviour.subjectNumber = 1;
    behaviour.amazonID = workerData.amazonID;
    behaviour.round = workerData.round;
    behaviour.choice = workerData.choice;
    behaviour.payoff = workerData.payoff;
    behaviour.totalEarning = workerData.totalEarning;
    behaviour.behaviouralType = workerData.behaviouralType;
    behaviour.timeElapsed = -1;
    behaviour.latency = workerData.latency;
    //behaviour.socialFreq_safe = workerData.socialFreq[0];
    //behaviour.socialFreq_risky = workerData.socialFreq[1];
    behaviour.socialFreq_safe1 = 0;
    behaviour.socialFreq_safe2 = 0;
    behaviour.socialFreq_safe3 = 0;
    behaviour.socialFreq_risky = 0;
    behaviour.riskDistributionId = workerData.riskDistributionId;

    behaviour.save(function(err){
      if(err) {
        logger.error('Individual behaviour save error', {
          error: err.message,
          subjectID: workerData.subjectID || workerData.amazonID,
          room: workerData.room
        });
      } else {
        logger.logDatabaseOperation('save_individual', 'behaviouralData', { 
          room: workerData.room,
          subjectID: workerData.subjectID || workerData.amazonID,
          isMainThread
        });
      }
      process.exit();
      if (parentPort) parentPort.postMessage(`[Worker] Finished ${workerData.room}`);
    });

  } catch (err) {
    logger.error('Individual database worker error', {
      error: err.message,
      stack: err.stack,
      room: workerData?.room,
      subjectID: workerData?.subjectID || workerData?.amazonID
    });
    process.exit(1);
  }
}

runWorker();

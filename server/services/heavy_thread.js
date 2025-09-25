require('dotenv').config();
const {parentPort, workerData, isMainThread, threadId} = require('worker_threads');

// ==========================
const mongoose = require('mongoose');
const dbName = process.env.MONGODB_URI || 'mongodb://localhost:27017/collective_bandit_dev';
// defining a model
const Behaviour = require('../models/behaviouralData');

// save data to mongodb
let now = new Date();
let behaviour = new Behaviour();
behaviour.date = now.getUTCFullYear() + '-' + (now.getUTCMonth() + 1) +'-' + now.getUTCDate();
behaviour.time = now.getUTCHours()+':'+now.getUTCMinutes()+':'+now.getUTCSeconds();
behaviour.expCondition = 0;
behaviour.indivOrGroup = 0;
behaviour.groupSize = 5;
behaviour.room = 1;
behaviour.confirmationID = 0;
behaviour.amazonID = 0;
behaviour.payoffLandscape = 0;
behaviour.round = 0;
behaviour.choice = 0;
behaviour.payoff = 0;
behaviour.totalEarning = 0;
behaviour.behaviouralType = 'choice';
behaviour.timeElapsed = 0;
behaviour.latency = 0;
let dummyInfo0 = new Array(5).fill(-1);
for(let i=0; i<5; i++) {
  eval('behaviour.socialInfo_'+i+'= dummyInfo0['+i+'];');
}
for(let i=0; i<5; i++) {
  eval('behaviour.publicInfo_'+i+'= dummyInfo0['+i+'];');
}

if(behaviour.round>1){
  for(let i = 0; i < data.socialInfo.length; i++) {
    eval('behaviour.socialInfo_'+i+'= data.socialInfo['+i+'];');
    eval('behaviour.publicInfo_'+i+'= data.publicInfo['+i+'];');
  }
}


console.log(`[Worker] isMainThread: ${isMainThread}, workerData: ${workerData}, threadId: ${threadId}`);
let count = 0;
for (let i = 0; i < 10000; i++) {
  for (let j = 0; j < 10000; j++) {
    count++;
    count /= 3
    count = count * count * count
  }
}

mongoose.connect(dbName, {useNewUrlParser: true, useUnifiedTopology: true}, (err, db) => {
  console.log(`Connected successfully to server (worker: ${workerData})`);
});
behaviour.save(function(err){
  if(err) console.log(`err at worker ${workerData}.`);
  console.log(`[Worker] isMainThread: ${isMainThread}, behaviour saved`);
  process.exit();
});

parentPort.postMessage(`[Worker] Finished ${workerData}`)

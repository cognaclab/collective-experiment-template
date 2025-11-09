'use strict';
// ./modules/handleDisconnect.js

const { createWorker, proceedToResult, stopAndResetClock } = require('../utils/helpers');

function handleDisconnect({client, config, io, countDownWaiting, total_N_nowRef, firstTrialStartingTimeRef}) {
  const room = config.roomStatus[client.room];
  const round = room?.gameRound;
  const gameType = room?.taskOrder[round];

  if (!client.room || !room) return;

  client.leave(client.room);
  if (client.room !== 'decoyRoom') total_N_nowRef.value--;

  room.disconnectedList.push(client.session);

  const idPosition = room.membersID.indexOf(client.session);
  if (idPosition > -1) {
    room.membersID.splice(idPosition, 1);
    room.subjectNumbers.splice(idPosition, 1);
  }
  config.sessionNameSpace[client.session] = 0;

  // Handle if user already made a choice
  const p = room.trial - 1;
  const doneOrNot = room.doneId[p]?.indexOf(client.subjectNumber);
  if (doneOrNot > -1) {
    room.doneId[p].splice(doneOrNot, 1);
    room.socialInfo[p].splice(doneOrNot, 1);
    room.socialInfo[p].push(-1);
    if (typeof room.doneNo[p] !== 'undefined') room.doneNo[p]--;
  }

  // Save data if group
  if (room.indivOrGroup !== 0) {
    createWorker('./server/services/savingBehaviouralData_array.js', room.saveDataThisRound);
    room.saveDataThisRound = [];
    room.n--;

    // Reset room state if below minGroupSize (for waiting room backfill)
    const minGroupSize = config.experimentLoader?.gameConfig?.min_group_size || config.minGroupSize || 2;

    if (room.n < minGroupSize && room.readyToStart) {
      const maxWaitingTime = config.experimentLoader?.gameConfig?.max_lobby_wait_time || 120000;

      room.readyToStart = false;
      room.restTime = maxWaitingTime;

      console.log(`🔄 Room ${client.room} reset to waiting state (${room.n}/${minGroupSize} players)`);

      // Notify remaining players
      io.to(client.room).emit('waiting_room_update', {
        n: room.n,
        restTime: room.restTime,
        roomReady: false
      });
    }
  } else {
    createWorker('./server/services/savingBehaviouralData_array.js', room.saveDataThisRound);
    room.saveDataThisRound = [];
  }

  // Transition to main task if comprehension done
  if (room.n > 0 && room.stage === 'secondWaitingRoom' && room.testPassed >= room.n) {
    console.log(` - ${client.room} is ready to start the game (gameType = ${gameType})`);
    room.groupTotalPayoff[p] = 0;
    io.to(client.room).emit('all passed the test', {
      n: room.n,
      testPassed: room.testPassed,
      exp_condition: room.exp_condition,
      gameRound: room.gameRound,
      minGroupSize: config.minGroupSize,
      horizon: room.horizon,
      gameType,
      groupCumulativePayoff: 0
    });
    firstTrialStartingTimeRef[client.room] = new Date();
    room.stage = 'mainTask';
  }

  // Transition to new game round
  if (room.n > 0 && room.stage === 'thirdWaitingRoom' && room.newGameRoundReady >= room.n) {
    console.log(` - ${client.room} is ready to start the new game round ${room.gameRound + 1}`);
    io.to(client.room).emit('all are ready to move on', {
      gameRound: room.gameRound,
      newGameRoundReady: room.newGameRoundReady,
      exp_condition: room.exp_condition,
      horizon: room.horizon,
      taskType: room.taskOrder[room.gameRound]
    });
    firstTrialStartingTimeRef[client.room] = new Date();
    room.stage = 'mainTask';
  }

  // Proceed to result stage if everyone finished
  if (room.doneNo[p] >= room.n && room.stage === 'mainTask') {
    const countPositive = room.socialInfo[p].filter(n => n > -1).length;
    if (countPositive < 2) room.groupTotalPayoff[p] = 0;

    if (room.round % 20 === 0) {
      createWorker('./server/services/savingBehaviouralData_array.js', room.saveDataThisRound);
      room.saveDataThisRound = [];
    }

    proceedToResult(room, client.room, io);
  } else {
    io.to(client.room).emit('client disconnected', { roomStatus: room, disconnectedClient: client.id });
  }

  // If no one left, reset waiting clock
  if (room.n <= 0) stopAndResetClock(config, client.room, countDownWaiting);

  console.log(` - client disconnected: ${client.session} (${client.subjectID}) (room N: ${room.n}, total N: ${total_N_nowRef.value})`);
}

module.exports = { handleDisconnect };
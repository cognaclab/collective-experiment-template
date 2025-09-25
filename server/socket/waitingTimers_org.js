'use strict';
// modules/paramEmitter.js

function startWaitingStageClock(room, io, config, countDownWaiting, startSession, countDown) {
  console.log(' - Waiting room opened at ' + room);

  config.roomStatus[room]['restTime'] -= 500;

  if (config.roomStatus[room]['restTime'] < 0) {
    if (
      config.roomStatus[room]['n'] < config.minGroupSize &&
      config.roomStatus[room]['indivOrGroup'] !== 0
    ) {
      config.roomStatus[room]['starting'] = 1;
      io.to(room).emit('you guys are individual condition');
    } else {
      startSession(room, config, io, countDownWaiting);
    }
  } else {
    const room2 = room;
    countDownWaiting[room] = setTimeout(() => countDown(room2, config, io, countDownWaiting), 500);
  }
}


module.exports = { startWaitingStageClock };

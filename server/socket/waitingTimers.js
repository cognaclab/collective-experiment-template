'use strict';
// modules/paramEmitter.js

function startWaitingStageClock(room, io, config, countDownWaiting, startSession, countDown, reformNewGroups) {

  const this_n = config.roomStatus[room]['n'];

  console.log(' - Waiting room opened at ' + room);

  config.roomStatus[room]['restTime'] -= 500;

  if (config.roomStatus[room]['restTime'] < 0) {
    console.log(` - targetGroupSizes ${config.targetGroupSizes} and this_n = ${this_n} (${room})`)
    if ( 
      // if this_n is not listed as the target group sizes,
      // they should be regrouped 
      !config.targetGroupSizes.includes(this_n) && 
      this_n >= config.minGroupSize 
    ) {
      reformNewGroups(room, config, io, countDownWaiting, this_n);
      console.log('reformNewGroups is fired!');
    }
    else if (
      this_n < config.minGroupSize &&
      config.roomStatus[room]['indivOrGroup'] !== 0
    ) {
      config.roomStatus[room]['starting'] = 1;
      io.to(room).emit('you guys are individual condition');
    } 
    else {
      startSession(room, config, io, countDownWaiting);
    }
  } else {
    const room2 = room;
    countDownWaiting[room] = setTimeout(() => countDown(room2, config, io, countDownWaiting), 500);
  }
}


module.exports = { startWaitingStageClock };

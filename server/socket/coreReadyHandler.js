'use strict';
// modules/coreReadyHandler.js

const { makeid } = require('../utils/helpers');
const { createRoom } = require('../utils/roomFactory');
const { emitParameters } = require('./paramEmitters');
const { startWaitingStageClock } = require('./waitingTimers');
const { countDown, startSession, reformNewGroups } = require('./sessionManager');
const { debugExceptions } = require('../../config/constants');

/**
 * Handle 'core is ready'
 * @param {Object} config - game env parameters
 * @param {Object} client - the Socket.IO client socket
 * @param {Object} data - client's health data
 * @param {Object} roomStatus - status of each room
 * @param {Object} countDownMainStage - main stage timers
 * @param {Object} countDownWaiting - waiting timers 
 * @param {Object} total_N_nowRef - number of people in the server 
 */

function handleCoreReady({ config, client, data, roomStatus, io, countDownMainStage, countDownWaiting, total_N_nowRef }) {
  if (client.started !== 0) return; // nothing happen if it's already started

  client.started = 1;
  client.latency = data.latency;

  console.log(` - Client: ${client.session} (${client.subjectID}) responds with an average latency = ${data.latency} ms.`);

  const shouldJoinGroup = data.latency < data.maxLatencyForGroupCondition;

  if (shouldJoinGroup) {
    client.roomFindingCounter = 1;
    while (typeof client.room === 'undefined') {
      const availableRoomName = Object.keys(roomStatus)[client.roomFindingCounter];
      const availableRoom = roomStatus[availableRoomName];

      if (!availableRoom) break;

      // Use strategy pattern if experimentContext is available
      const maxPlayers = config.experimentContext
        ? config.experimentContext.getMaximumPlayers()
        : config.maxGroupSize;

      const canJoin =
        availableRoom.starting === 0 &&
        availableRoom.n < maxPlayers &&
        availableRoom.restTime > 999;

      if (canJoin) {
        client.room = availableRoomName;
      } else {
        client.roomFindingCounter++;
      }
    }

    if (!client.room) {
      const newRoomName = makeid(7) + `_session_${config.sessionNo + Object.keys(roomStatus).length - 1}`;
      roomStatus[newRoomName] = createRoom({ name: newRoomName, config });
      // Set shorter wait time for debug users (10 seconds instead of 120)
      if (debugExceptions.includes(client.subjectID)) {
        roomStatus[newRoomName].restTime = 10 * 1000;
      }
      client.room = newRoomName;
      countDownMainStage[newRoomName] = {};
      countDownWaiting[newRoomName] = {};
    }

  } else {
    const now = new Date();
    const timestamp = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const newRoomName = `${timestamp}_largeLatency_${config.sessionNo + Object.keys(roomStatus).length - 1}`;
    roomStatus[newRoomName] = createRoom({ name: newRoomName, config });
    roomStatus[newRoomName].horizon = config.horizon; // Ensure horizon is set for individual rooms
    roomStatus[newRoomName].restTime = 1000; // Individual condition has 1-second wait time (debug shortcut)
    client.room = newRoomName;
    client.subjectNumber = 1;
  }

  client.join(client.room);
  total_N_nowRef.value++;
  const thisRoomStatus = roomStatus[client.room];
  thisRoomStatus.n++;
  thisRoomStatus.membersID.push(client.session);

  if (!client.subjectNumber) {
    client.subNumCounter = 1;
    while (!client.subjectNumber) {
      if (!thisRoomStatus.subjectNumbers.includes(client.subNumCounter)) {
        thisRoomStatus.subjectNumbers.push(client.subNumCounter);
        client.subjectNumber = client.subNumCounter;
      } else {
        client.subNumCounter++;
      }
    }
  }

  emitParameters(io, client, config);

  if (client.room !== 'decoyRoom') {
    if (thisRoomStatus.n === 1) {
      console.log(` - The first participant came in to the room ${client.room}.`);
      startWaitingStageClock(client.room, io, config, countDownWaiting, startSession, countDown, reformNewGroups);
    }
    io.to(client.room).emit('this is the remaining waiting time', {
      restTime: thisRoomStatus.restTime,
      max: config.maxWaitingTime,
      maxGroupSize: config.maxGroupSize,
      horizon: thisRoomStatus.horizon,
    });
  }
}

module.exports = { handleCoreReady };

'use strict';
// modules/handlePreviousRestTime.js

const { startWaitingStageClock } = require('./waitingTimers'); 
const { countDown } = require('./sessionManager');

function handlePreviousRestTime(io, client, data, config) {
	const room = client.room;
	const roomState = config.roomStatus[room];

	roomState.restTime = data.restTime;

	if (roomState.stage === 'resuming') {
		console.log(' - waiting clock was just resumed at ' + room + '.');
		// startWaitingStageClock(room, countDown);
		startWaitingStageClock(room, io, config, countDownWaiting, startSession, countDown, reformNewGroups);
		roomState.stage = 'firstWaiting';
	}

	io.to(room).emit('this is the remaining waiting time', {
		restTime: roomState.restTime,
		max: config.maxWaitingTime,
		maxGroupSize: config.maxGroupSize,
		horizon: roomState.horizon
	});
};


module.exports = { handlePreviousRestTime };

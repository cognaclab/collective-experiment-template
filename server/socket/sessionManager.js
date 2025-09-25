'use strict';
// modules/sessionManager.js

const { makeid } = require('../utils/helpers');
const { createRoom } = require('../utils/roomFactory');

function countDown(room, config, io, countDownWaiting) {
	const this_n = config.roomStatus[room]['n'];

	config.roomStatus[room]['restTime'] -= 500;
	if (config.roomStatus[room]['restTime'] < 0) {
		console.log(` - targetGroupSizes ${config.targetGroupSizes} and this_n = ${this_n}`)
		if ( 
			// if this_n is not listed as the target group sizes,
			// they should be regrouped 
			!config.targetGroupSizes.includes(this_n) && 
			this_n >= config.minGroupSize 
		) {
			reformNewGroups(room, config, io, countDownWaiting, this_n);
		}
		else if(
			this_n < config.minGroupSize && 
			config.roomStatus[room]['indivOrGroup'] != 0
		) {
			config.roomStatus[room]['starting'] = 1;
			io.to(room).emit('you guys are individual condition');
		} else {
			startSession(room, config, io, countDownWaiting);
		}
	//clearTimeout(countDownWaiting[room]);
	} else {
		const room2 = room;
		const config2 = config;
		countDownWaiting[room] = setTimeout(function(){ countDown(room2, config2, io, countDownWaiting) }, 500);
	}
}

function startSession (room, config, io, countDownWaiting) {
	if(typeof countDownWaiting[room] != 'undefined') {
		clearTimeout(countDownWaiting[room]);
	}
	config.roomStatus[room]['starting'] = 1;
	if (config.roomStatus[room]['n'] < config.minGroupSize) {
		config.roomStatus[room]['indivOrGroup'] = 0; // individual condition
	} else {
		config.roomStatus[room]['indivOrGroup'] = 1; // group condition
	}

	const room_n = config.roomStatus[room]['n'];
	io.to(room).emit('this room gets started', 
		{room: room
		, n: room_n
		, exp_condition: config.roomStatus[room]['exp_condition']
		, indivOrGroup: config.roomStatus[room]['indivOrGroup']
		, optionOrder: config.roomStatus[room]['optionOrder']
		, maxChoiceStageTime: config.maxChoiceStageTime
		, taskOrder: config.roomStatus[room]['taskOrder'] 
		, horizon: config.roomStatus[room]['horizon'] 
		, taskType: config.roomStatus[room]['taskType'] 
	});
	console.log(` - session started in ${room} (n = ${room_n})`);
}

function reformNewGroups (room, config, io, countDownWaiting, this_n) {

	if(typeof countDownWaiting[room] != 'undefined') {
		clearTimeout(countDownWaiting[room]);
	}

	// closing the old room
	const oldRoomStatus = config.roomStatus[room]
	oldRoomStatus.starting = 1; // to avoid new participants arriving

	// create new rooms
	const newRoomName_1 = makeid(7) + `_room_${config.sessionNo + Object.keys(config.roomStatus).length - 1}`;
	const newRoomName_2 = makeid(7) + `_room_${config.sessionNo + Object.keys(config.roomStatus).length }`;
	const newRoomName_3 = makeid(7) + `_room_${config.sessionNo + Object.keys(config.roomStatus).length + 1}`;
	config.roomStatus[newRoomName_1] = createRoom({ name: newRoomName_1 });
	config.roomStatus[newRoomName_2] = createRoom({ name: newRoomName_2 });
	config.roomStatus[newRoomName_3] = createRoom({ name: newRoomName_3 });
	// to avoid new participants arriving
	config.roomStatus[newRoomName_1]['starting'] = 1; 
	config.roomStatus[newRoomName_2]['starting'] = 1;
	config.roomStatus[newRoomName_3]['starting'] = 1;

	// assigning clients to new rooms
	io.to(room).emit('these are new rooms', {newRoomName_1,newRoomName_2,newRoomName_3});
	
}


module.exports = { countDown, startSession, reformNewGroups };

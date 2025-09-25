'use strict';
// modules/handleOkIndividualCondition.js

const { makeid } = require('../utils/helpers');
const { createRoom } = require('../utils/roomFactory');
const { startSession } = require('./sessionManager');

function handleOkIndividualCondition(client, config, io, countDownWaiting) {
	const oldRoom = client.room;
	const thisRoomStatus = config.roomStatus[oldRoom]

	// Check if group is still below the max size
	if (thisRoomStatus.n < config.maxGroupSize) {
		// Mark room as starting and reduce count
		thisRoomStatus.starting = 1;
		thisRoomStatus.n--;

		// Create a new individual room
		client.indivRoomName = `${makeid(7)}${config.myMonth}${config.myDate}_sessionIndiv_${config.sessionNo + Object.keys(config.roomStatus).length - 1}`;
		config.roomStatus[client.indivRoomName] = createRoom({ name: client.indivRoomName });

		// Move client to new individual room
		client.leave(oldRoom);
		client.room = client.indivRoomName;
		client.join(client.room);

		// Update client details in new room
		config.roomStatus[client.room].n++;
		config.roomStatus[client.room].membersID.push(client.session);
		client.subjectNumber = config.roomStatus[client.room].n;

		startSession(client.room, config, io, countDownWaiting);
	} else {
		// If the original group is already full, just start
		startSession(oldRoom, config, io, countDownWaiting);
	}
};


module.exports = { handleOkIndividualCondition };

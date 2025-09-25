'use strict';
// modules/handleLetMeIn.js

const { startSession } = require('./sessionManager');

function handleLetMeIn(client, config, rooms, io, countDownWaiting) {
	const oldRoom = client.room;
	const oldRoomStatus = config.roomStatus[oldRoom];
	const oldGroupSize = oldRoomStatus['n'];
	let targetSize;
	switch (oldGroupSize) {
		case 9:
			targetSize = [5,2,2];
			break;
		case 8:
			targetSize = [5,3,0];
			break;
		case 7:
			targetSize = [5,2,0];
			break;
		case 6:
			targetSize = [5,1,0];
			break;
		case 4:
			targetSize = [2,2,0];
			break;
		case 3:
			targetSize = [2,1,0];
			break;
		default:
			targetSize = [oldGroupSize, 0, 0]; // unchange size
	}

	// initialise counters
	client.roomFindingCounter = 0;
	client.room = 'decoyRoom'
	client.subjectNumber = 0;

	while (client.room === 'decoyRoom') {
		const availableRoomName = rooms[client.roomFindingCounter];
		const availableRoom = config.roomStatus[availableRoomName];
  
		if (!availableRoom) {
			console.log(`${availableRoomName} does not exist`);
			break;
		}

		const canJoin =
		  availableRoom.n < targetSize[client.roomFindingCounter];
  
		if (canJoin) {
		  client.room = availableRoomName;
		} else {
		  client.roomFindingCounter++;
		}
	}

	client.leave(oldRoom);
	client.join(client.room);
	const newRoomStatus = config.roomStatus[client.room];
	newRoomStatus.n++;
	newRoomStatus.membersID.push(client.session);

	console.log(` - ${client.session} joined ${client.room} (n = ${newRoomStatus.n}; ${newRoomStatus.taskType})`);

	// tell client about the new room
	const payload = {
		id: client.session,
		room: client.room,
		maxChoiceStageTime: config.maxChoiceStageTime,
		maxTimeTestScene: config.maxTimeTestScene,
		horizon: newRoomStatus.horizon,
		subjectNumber: client.subjectNumber,
		numOptions: config.numOptions,
		optionOrder: newRoomStatus.optionOrder,
		taskType: newRoomStatus.taskType,
		taskOrder: newRoomStatus.taskOrder,
		gameRound: newRoomStatus.gameRound,
		changes: config.changes,
		environments: [config.prob_0, config.prob_1, config.prob_2, config.prob_3, config.prob_4]
	};
	io.to(client.session).emit('this_is_your_new_parameters', payload);

	if (client.subjectNumber === 0) {
		client.subNumCounter = 1;
		while (client.subjectNumber === 0) {
		if (!newRoomStatus.subjectNumbers.includes(client.subNumCounter)) {
			newRoomStatus.subjectNumbers.push(client.subNumCounter);
			client.subjectNumber = client.subNumCounter;
		} else {
			client.subNumCounter++;
		}
		}
	}

	// Check if group is still below the max size
	if (newRoomStatus.n === targetSize[client.roomFindingCounter]) {
		startSession(client.room, config, io, countDownWaiting);
	}
};


module.exports = { handleLetMeIn };

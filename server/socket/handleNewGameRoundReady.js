'use strict';
// modules/handleNewGameRoundReady.js

function handleNewGameRoundReady(client, data, config, io, firstTrialStartingTimeRef) {
	const room = config.roomStatus[client.room];

	if (room.newGameRoundReady === 0) {
		room.stage = 'thirdWaitingRoom';
	}

	room.newGameRoundReady++;
	console.log(` - ${client.session} (${client.room}) is ready for period ${room.gameRound+1} (${data.taskType}): ${room.newGameRoundReady}/${room.n}`);

	if (room.newGameRoundReady >= room.n) {
		console.log(` - ${client.room} is ready to start the new game round ${room.gameRound + 1}`);

		// reset room.newGameRoundReady
		room.newGameRoundReady = 0;

		// tell the server this room is ready
		io.to(client.room).emit('all are ready to move on', {
			gameRound          : room.gameRound,
			newGameRoundReady  : room.newGameRoundReady,
			exp_condition      : room.exp_condition,
			horizon            : room.horizon,
			taskType           : data.taskType,
			this_env           : room.currentEnv,
			n                  : room.n
		});

		firstTrialStartingTimeRef[client.room] = new Date();
		room.stage = 'mainTask';
	} else {
		io.to(client.session).emit('wait for others get ready to move on', {
			n_test_passed: room.newGameRoundReady,
			n            : room.n
		});
		io.to(client.room).emit('n_test_passed updated', {
			n_test_passed: room.newGameRoundReady,
			n            : room.n
		});
	}
}

module.exports = { handleNewGameRoundReady };
'use strict';
// modules/handleTestPassed.js

// handleTestPassed.js
module.exports = function handleTestPassed(client, config, io, firstTrialStartingTimeRef) {
	const room = client.room;
	const thisRoomStatus = config.roomStatus[room];

	if (thisRoomStatus['testPassed'] === 0) {
		thisRoomStatus['stage'] = 'secondWaitingRoom';
	}

	thisRoomStatus['testPassed']++;
	console.log(` - ${client.session} (${room}) passed the test.`);

	const testPassed = thisRoomStatus['testPassed'];
	const totalMembers = thisRoomStatus['n'];

	if (testPassed >= totalMembers) {
		console.log(` - ${room} is ready to start the game.`);

		const pointer = thisRoomStatus['pointer'] - 1;
		thisRoomStatus['groupTotalPayoff'][pointer] = 0;

		io.to(room).emit('all passed the test', {
			n: totalMembers,
			testPassed,
			exp_condition: thisRoomStatus['exp_condition'],
			gameRound: thisRoomStatus['gameRound'],
			groupCumulativePayoff: 0,
			minGroupSize: config.minGroupSize,
			horizon: thisRoomStatus.horizon
		});

		const now = new Date();
		firstTrialStartingTimeRef[room] = now;
		thisRoomStatus['stage'] = 'mainTask';

	} else {
		io.to(client.session).emit('wait for others finishing test', {
			n_test_passed: testPassed,
			n: totalMembers
		});
		io.to(room).emit('n_test_passed updated', {
			n_test_passed: testPassed,
			n: totalMembers
		});
	}
};

'use strict';
// ./modules/handleChoiceMade.js

const { createWorker, proceedToResult } = require('../utils/helpers');
// const proceedToResult = require('../utils/proceedToResult');

module.exports = function handleChoiceMade(client, data, config, io, firstTrialStartingTimeRef) {
	const room   = config.roomStatus[client.room];
	const number = client.subjectNumber;
	const session = client.session;

	if (!room || number == null) return;

	const p      = room.pointer - 1;
	const round  = room.gameRound;
	const choice = data.num_choice;

	room.doneId[p].push(number);
	const doneNum = room.doneId[p].length;
	const this_indiv_payoff = Number(data.individual_payoff);
	const this_trial = data.thisTrial;
	const gameType = room.taskType;

	room.socialInfo[p][doneNum - 1]  = choice;
	room.choiceOrder[p][doneNum - 1] = number;

	room.groupTotalPayoff[p] = (room.groupTotalPayoff[p] || 0) + this_indiv_payoff;
	room.groupCumulativePayoff[round] += this_indiv_payoff;

	if (choice > -1) {
		console.log(` - ${session} in ${client.room} (No. ${number}) chose ${choice} and got ${this_indiv_payoff} at t = ${this_trial} (${gameType}).`);
	} else {
		console.log(` - ${session} in ${client.room} (No. ${number}) missed at t = ${this_trial} (${gameType}).`);
	}

	if (room.trial <= room.horizon) {
		if (doneNum === 1) room.socialFreq[p].fill(0);
		if (choice > -1) room.socialFreq[p][choice]++;
	}

	const now = new Date();
	const iso = now.toISOString();
	const timeElapsed = now - firstTrialStartingTimeRef[client.room];

	room.saveDataThisRound.push({
		date: iso.slice(0, 10),
		time: iso.slice(11, 19),
		exp_condition: room.exp_condition,
		indivOrGroup: room.indivOrGroup,
		groupSize: room.n,
		room: client.room,
		confirmationID: session,
		subjectNumber: number,
		subjectID: client.subjectID,
		pointer: room.pointer,
		trial: room.trial,
		this_env: room.currentEnv,
		gameRound: round,
		gameType: gameType,
		chosenOptionLocation: data.chosenOptionLocation - 1,
		chosenOptionID: choice,
		individual_payoff: data.individual_payoff,
		groupCumulativePayoff: room.groupCumulativePayoff[round],
		groupTotalPayoff: NaN,
		dataType: 'choice',
		timeElapsed,
		latency: client.latency,
		socialFreq: room.socialFreq[p],
		maxGroupSize: config.maxGroupSize,
		optionOrder_0: room.optionOrder[0] - 1,
		optionOrder_1: room.optionOrder[1] - 1,
		optionOrder_2: room.optionOrder[2] - 1,
		true_payoff_0: data.prob_means[0],
		true_payoff_1: data.prob_means[1],
		true_payoff_2: data.prob_means[2],
		reactionTime: data.reactionTime
	});

	room.doneNo[p] = (room.doneNo[p] ?? 0) + 1;
	console.log(` - ${session} (${client.room}) is done (doneNo: ${room.doneNo[p]}) at ${room.trial} (room.n: ${room.n}, p: ${p})`);

	if (room.doneNo[p] < room.n) {
		console.log(` - Waiting for others: ${room.doneNo[p]}/${room.n} done`);
		io.to(client.room).emit('these are done subjects', { doneSubject: room.doneId[p] });
	} else {
		console.log(` - All done (${room.doneNo[p]}/${room.n}), proceeding to result`);
		const countPositive = room.socialInfo[p].filter(n => n > -1).length;
		// Only zero out group payoff if in group condition AND not enough participants
		if (countPositive < 2 && room.indivOrGroup === 1) {
			room.groupTotalPayoff[p] -= this_indiv_payoff;
			room.groupCumulativePayoff[round] -= this_indiv_payoff;
			room.groupTotalPayoff[p] = 0;
		}

		if (room.round != null && room.round % 20 === 0) {
			const worker = createWorker('./server/services/savingBehaviouralData_array.js', room.saveDataThisRound);
			room.saveDataThisRound = [];
		}

		// For new config-driven experiments, call handleSceneComplete directly
		if (config.experimentLoader && config.experimentLoader.sequence) {
			console.log(` - Calling handleSceneComplete for SceneMain (config-driven flow)`);
			const handleSceneComplete = require('./handleSceneComplete');
			const sceneCompleteData = {
				scene: 'SceneMain',
				sequence: config.experimentLoader.sequence.sequence
			};
			handleSceneComplete(client, sceneCompleteData, config, io);
		} else {
			// Legacy flow: call proceedToResult
			console.log(` - Calling proceedToResult for ${client.room} (legacy flow)`);
			proceedToResult(room, client.room, io);
		}
	}
};

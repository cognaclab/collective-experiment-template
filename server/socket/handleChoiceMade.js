'use strict';
// ./modules/handleChoiceMade.js

const { createWorker, proceedToResult } = require('../utils/helpers');
const { buildTrialData } = require('../utils/dataBuilders');
const Trial = require('../database/models/Trial');
const Session = require('../database/models/Session');
const logger = require('../utils/logger');

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

	// Build choice data for data builders
	// Determine wasMiss and wasTimeout based on client flags
	// wasMiss: User never clicked any machine before timeout (complete disengagement)
	// wasTimeout: User clicked a machine but didn't confirm before timeout (incomplete action)
	const hadClickedBeforeTimeout = data.hadClickedBeforeTimeout || false;
	const timedOut = data.timedOut || false;

	console.log(`[SERVER RECEIVE] choice=${choice}, timedOut=${timedOut}, hadClickedBeforeTimeout=${hadClickedBeforeTimeout}, data.miss=${data.miss}`);
	console.log(`[SERVER RECEIVE] Full data:`, data);

	const choiceData = {
		thisChoice: choice,
		optionLocation: data.chosenOptionLocation,
		payoff: this_indiv_payoff,
		reactionTime: data.reactionTime,
		timeElapsed: timeElapsed,
		latency: client.latency,
		clientTimestamp: now,
		prob_means: data.prob_means,
		wasTimeout: timedOut && hadClickedBeforeTimeout,  // Clicked but didn't confirm
		wasMiss: timedOut && !hadClickedBeforeTimeout     // Never clicked at all
	};

	// Store timeout/miss flags for routing decisions
	if (!room.timeoutFlags) room.timeoutFlags = {};
	if (!room.missFlags) room.missFlags = {};
	if (!room.timeoutFlags[p]) room.timeoutFlags[p] = [];
	if (!room.missFlags[p]) room.missFlags[p] = [];

	if (timedOut) {
		console.log(`[SERVER FLAGS] Setting timeout/miss flag. doneNum=${doneNum}, p=${p}, hadClickedBeforeTimeout=${hadClickedBeforeTimeout}`);
		if (hadClickedBeforeTimeout) {
			room.timeoutFlags[p][doneNum - 1] = true;
			console.log(`[SERVER FLAGS] Set timeoutFlags[${p}][${doneNum - 1}] = true`);
		} else {
			room.missFlags[p][doneNum - 1] = true;
			console.log(`[SERVER FLAGS] Set missFlags[${p}][${doneNum - 1}] = true`);
		}
	}

	// Use new flexible data structure
	const trialData = buildTrialData(client, room, choiceData, config);

	// Save trial data immediately to database (new approach)
	saveTrialData(trialData);

	// Also keep legacy format for backward compatibility during migration
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

			// Determine trigger type from room state
			const hasTimeout = room.timeoutFlags[p] && room.timeoutFlags[p].some(flag => flag === true);
			const hasMiss = room.missFlags[p] && room.missFlags[p].some(flag => flag === true);

			console.log(` - Checking timeout/miss flags: hasTimeout=${hasTimeout}, hasMiss=${hasMiss}`);
			console.log(` - room.timeoutFlags[${p}]:`, room.timeoutFlags[p]);
			console.log(` - room.missFlags[${p}]:`, room.missFlags[p]);

			let triggerType = 'default';
			if (hasTimeout) {
				triggerType = 'timeout';
			} else if (hasMiss) {
				triggerType = 'miss';
			}

			console.log(` - Determined triggerType: ${triggerType}`);

			const handleSceneComplete = require('./handleSceneComplete');
			const sceneCompleteData = {
				scene: 'SceneMain',
				sequence: config.experimentLoader.sequence.sequence,
				triggerType: triggerType
			};
			handleSceneComplete(client, sceneCompleteData, config, io);
		} else {
			// Legacy flow: call proceedToResult
			console.log(` - Calling proceedToResult for ${client.room} (legacy flow)`);
			proceedToResult(room, client.room, io);
		}
	}
};

/**
 * Save trial data to database asynchronously
 * @param {Object} trialData - Trial data object from buildTrialData
 */
async function saveTrialData(trialData) {
	try {
		const trial = new Trial(trialData);
		const savedTrial = await trial.save();
		logger.info('Trial data saved', {
			experimentName: trialData.experimentName,
			sessionId: trialData.sessionId,
			trial: trialData.trial,
			subjectId: trialData.subjectId,
			_id: savedTrial._id
		});
	} catch (error) {
		logger.error('Failed to save trial data', {
			error: error.message,
			stack: error.stack,
			validationErrors: error.errors,
			experimentName: trialData.experimentName,
			sessionId: trialData.sessionId,
			trial: trialData.trial
		});
	}
}

/**
 * Update session performance data in database
 * @param {String} sessionId - Session ID
 * @param {Object} updateData - Data to update
 */
async function updateSessionData(sessionId, updateData) {
	try {
		await Session.findOneAndUpdate(
			{ sessionId: sessionId },
			{ $set: updateData },
			{ upsert: true, new: true }
		);
		logger.info('Session data updated', { sessionId: sessionId });
	} catch (error) {
		logger.error('Failed to update session data', {
			error: error.message,
			sessionId: sessionId
		});
	}
}

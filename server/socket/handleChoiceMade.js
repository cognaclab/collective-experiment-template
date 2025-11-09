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
	const this_trial = data.thisTrial;
	const gameType = room.taskType;

	// Initialize storage for choices if needed (for matrix games and group experiments)
	if (!room.playerChoices) room.playerChoices = {};
	if (!room.playerChoices[p]) room.playerChoices[p] = {};

	// Store this player's choice
	room.playerChoices[p][number] = choice;

	// Calculate payoff based on reward system type
	let this_indiv_payoff = Number(data.individual_payoff);

	// If using reward_system config, payoffs will be calculated server-side
	const usingRewardSystem = config.experimentLoader && config.experimentLoader.config.reward_system;
	if (usingRewardSystem) {
		this_indiv_payoff = 0; // Will be calculated after all required players choose
	}

	room.socialInfo[p][doneNum - 1]  = choice;
	room.choiceOrder[p][doneNum - 1] = number;

	// Only update payoffs immediately if NOT using reward_system (will be updated later in calculateRewards)
	if (!usingRewardSystem) {
		room.groupTotalPayoff[p] = (room.groupTotalPayoff[p] || 0) + this_indiv_payoff;
		room.groupCumulativePayoff[round] += this_indiv_payoff;
	}

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
		...(data.prob_means && data.prob_means.length > 0 && {
			true_payoff_0: data.prob_means[0],
			true_payoff_1: data.prob_means[1],
			true_payoff_2: data.prob_means[2],
		}),
		reactionTime: data.reactionTime
	});

	room.doneNo[p] = (room.doneNo[p] ?? 0) + 1;
	console.log(` - ${session} (${client.room}) is done (doneNo: ${room.doneNo[p]}) at ${room.trial} (room.n: ${room.n}, p: ${p})`);

	if (room.doneNo[p] < room.n) {
		console.log(` - Waiting for others: ${room.doneNo[p]}/${room.n} done`);
		io.to(client.room).emit('these are done subjects', { doneSubject: room.doneId[p] });
	} else {
		console.log(` - All done (${room.doneNo[p]}/${room.n}), proceeding to result`);

		// Calculate rewards using RewardCalculator if applicable (must wait for all players)
		if (config.experimentLoader && config.experimentLoader.rewardCalculator) {
			calculateRewards(room, p, config);
		}

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

		// For new config-driven experiments, emit confirmation event and delay transition
		if (config.experimentLoader && config.experimentLoader.sequence) {
			// Use tracked current scene instead of hardcoded 'SceneMain'
			const currentScene = room.currentScene || 'SceneMain';
			console.log(` - All players confirmed choices for ${currentScene}`);

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

			// Notify all players that choices are confirmed
			io.to(client.room).emit('all_choices_confirmed', {
				message: 'All players have confirmed their choices'
			});
			console.log(` - Emitted all_choices_confirmed to room ${client.room}`);

			// Wait 3 seconds, then transition to results
			setTimeout(() => {
				console.log(` - 3s delay complete, transitioning to results for ${currentScene}`);

				const handleSceneComplete = require('./handleSceneComplete');
				const sceneCompleteData = {
					scene: currentScene,
					sequence: config.experimentLoader.sequence.sequence,
					triggerType: triggerType,
					bypassSync: true  // Skip scene synchronization - server already coordinated
				};
				handleSceneComplete(client, sceneCompleteData, config, io);
			}, 3000);
		} else {
			// Legacy flow: call proceedToResult
			console.log(` - Calling proceedToResult for ${client.room} (legacy flow)`);
			proceedToResult(room, client.room, io);
		}
	}
};

/**
 * Calculate rewards for all players using RewardCalculator
 * Works for all reward types: payoff_matrix, probabilistic, deterministic
 * @param {Object} room - Room object
 * @param {Number} p - Pointer index (trial - 1)
 * @param {Object} config - Experiment configuration
 */
function calculateRewards(room, p, config) {
	const rewardCalculator = config.experimentLoader.rewardCalculator;
	const choices = room.playerChoices[p];

	console.log(`[REWARD CALC] Calculating rewards for trial ${p + 1}`);
	console.log(`[REWARD CALC] Player choices:`, choices);

	// Get player numbers (ordered array of subject numbers)
	const playerNumbers = Object.keys(choices).map(n => parseInt(n)).sort((a, b) => a - b);

	// Build choices array in order [choice1, choice2, ...]
	const choicesArray = playerNumbers.map(playerNum => choices[playerNum]);

	console.log(`[REWARD CALC] Player numbers:`, playerNumbers);
	console.log(`[REWARD CALC] Choices array:`, choicesArray);

	// Calculate rewards using RewardCalculator
	const context = {
		trial: p + 1,
		environment: room.currentEnv,
		taskType: room.taskType
	};

	const payoffs = rewardCalculator.calculateReward(choicesArray, context);

	console.log(`[REWARD CALC] Calculated payoffs:`, payoffs);

	// Store payoffs in room structure for later retrieval
	if (!room.rewards) room.rewards = {};
	if (!room.rewards[p]) room.rewards[p] = {};

	// Map payoffs back to player numbers
	let totalPayoff = 0;
	playerNumbers.forEach((playerNum, index) => {
		const payoff = Array.isArray(payoffs) ? payoffs[index] : payoffs;
		room.rewards[p][playerNum] = payoff;
		totalPayoff += payoff;
		console.log(`[REWARD CALC] Player ${playerNum} reward: ${payoff}`);
	});

	// Initialize and set group total payoffs (not adding, since this is the first/only time we set them)
	if (!room.groupTotalPayoff[p]) room.groupTotalPayoff[p] = 0;
	if (!room.groupCumulativePayoff[room.gameRound]) room.groupCumulativePayoff[room.gameRound] = 0;

	room.groupTotalPayoff[p] = totalPayoff;
	room.groupCumulativePayoff[room.gameRound] += totalPayoff;

	console.log(`[REWARD CALC] Set group total payoff for trial ${p}: ${room.groupTotalPayoff[p]}`);
}

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

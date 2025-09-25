'use strict';
// modules/handleResultFeedbackEnded.js

const { proceedTrial } = require('../utils/helpers');

function handleResultFeedbackEnded(client, data, config, io, firstTrialStartingTimeRef) {
	const room   = config.roomStatus[client.room];
	const trial  = data.thisTrial;

	// ── guard clause ────────────────────────────────────────────
	if (trial > room.horizon) {
		io.to(client.session).emit('reconnected after the game started');
		return;
	}

	// ── ready counter for this trial ────────────────────────────
	const p = room.pointer - 1;          // shorthand once per round
	room.readyNo[p] = (room.readyNo[p] ?? 0) + 1;

	// ── start next trial only when all players are ready ───────
	if (room.readyNo[p] < room.n) return;

	// ── compose “group-payoff” record and stash it ─────────────
	const now          = new Date();
	const timeElapsed  = now - firstTrialStartingTimeRef[client.room];

	const summary = {
		date          : now.toISOString().slice(0, 10),     // YYYY-MM-DD
		time          : now.toISOString().slice(11, 19),    // HH:MM:SS
		exp_condition : room.exp_condition,
		indivOrGroup  : room.indivOrGroup,
		groupSize     : room.n,
		room          : client.room,
		confirmationID: client.room,
		subjectNumber : client.room,
		subjectID     : client.room,

		pointer       : room.pointer,
		trial         : room.trial,
		gameRound     : room.gameRound,
		this_env      : room.currentEnv,
		gameType      : room.taskType,

		chosenOptionLocation : NaN,
		chosenOptionID       : NaN,
		individual_payoff    : NaN,

		groupCumulativePayoff: room.groupCumulativePayoff[room.gameRound],
		groupTotalPayoff     : room.groupTotalPayoff[p],

		dataType      : 'group payoff',
		timeElapsed,
		latency       : client.latency,
		socialFreq    : room.socialFreq[p],
		maxGroupSize  : config.maxGroupSize,

		optionOrder_0: room.optionOrder[0] - 1,
		optionOrder_1: room.optionOrder[1] - 1,
		optionOrder_2: room.optionOrder[2] - 1,

		true_payoff_0 : NaN,
		true_payoff_1 : NaN,
		true_payoff_2 : NaN,
		reactionTime  : NaN
	};

	room.saveDataThisRound.push(summary);

	// ── advance the game state ─────────────────────────────────
	proceedTrial(room, client.room, io, config);
}

module.exports = { handleResultFeedbackEnded };


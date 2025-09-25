'use strict';
// modules/paramEmitter.js

function emitParameters(io, client, config) {
	const room = config.roomStatus[client.room];
	const { taskType
		, optionOrder
		, gameRound
		, indivOrGroup
		, exp_condition
		, info_share_cost
		, taskOrder } = room;

	room.horizon = taskType === 'static'
		? config.static_horizons[0]
		: config.minHorizon * config.numEnv

	const payload = {
		id: client.session,
		room: client.room,
		maxChoiceStageTime: config.maxChoiceStageTime,
		maxTimeTestScene: config.maxTimeTestScene,
		exp_condition,
		info_share_cost,
		horizon: room.horizon,
		subjectNumber: client.subjectNumber,
		indivOrGroup,
		numOptions: config.numOptions,
		optionOrder,
		taskType,
		taskOrder,
		gameRound,
		changes: config.changes,
		environments: [config.prob_0, config.prob_1, config.prob_2, config.prob_3, config.prob_4]
	};

	io.to(client.session).emit('this_is_your_parameters', payload);
	console.log(` - parameters sent to ${client.session} (room ${client.room}) with taskType = ${taskType}`);
}

module.exports = { emitParameters };

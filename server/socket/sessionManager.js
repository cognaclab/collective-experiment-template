'use strict';
// modules/sessionManager.js

const { makeid } = require('../utils/helpers');
const { createRoom } = require('../utils/roomFactory');

function countDown(room, config, io, countDownWaiting) {
	const this_n = config.roomStatus[room]['n'];
	const thisRoom = config.roomStatus[room];

	config.roomStatus[room]['restTime'] -= 500;
	if (config.roomStatus[room]['restTime'] < 0) {
		console.log(` - targetGroupSizes ${config.targetGroupSizes} and this_n = ${this_n}`)

		// Use strategy pattern if experimentContext is available
		if (config.experimentContext) {
			const shouldWait = config.experimentContext.shouldWaitForPlayers(thisRoom);

			if (shouldWait && this_n < config.minGroupSize) {
				// Check if config specifies strict group mode (no individual fallback)
				const isStrictGroupMode = config.experimentLoader?.gameConfig?.mode === 'group';

				if (isStrictGroupMode) {
					// For strict group experiments, don't fallback to individual - end experiment
					console.log(` - Room ${room} has insufficient players (${this_n}/${config.minGroupSize}) for strict group mode - ending experiment`);
					config.roomStatus[room]['starting'] = 1;
					io.to(room).emit('insufficient_players', {
						message: 'Not enough players joined. Experiment cannot start.',
						minRequired: config.minGroupSize,
						actual: this_n
					});
				} else {
					// Legacy behavior: switch to individual mode
					config.roomStatus[room]['starting'] = 1;
					config.roomStatus[room]['indivOrGroup'] = 0; // Set to individual
					io.to(room).emit('you guys are individual condition');
				}
			} else if (
				!config.targetGroupSizes.includes(this_n) &&
				this_n >= config.minGroupSize
			) {
				// Not target size but above minimum - regroup
				reformNewGroups(room, config, io, countDownWaiting, this_n);
			} else {
				// Ready to start
				startSession(room, config, io, countDownWaiting);
			}
		} else {
			// Fallback to original logic if no experimentContext
			if (
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

	// Use strategy pattern if experimentContext is available
	if (config.experimentContext) {
		const thisRoom = config.roomStatus[room];
		const isReady = config.experimentContext.isRoomReady(thisRoom);

		if (isReady) {
			// Set indivOrGroup based on strategy
			if (config.experimentContext.isIndividual()) {
				config.roomStatus[room]['indivOrGroup'] = 0; // individual
			} else {
				config.roomStatus[room]['indivOrGroup'] = 1; // group
			}
		} else {
			// Fallback: not enough players
			config.roomStatus[room]['indivOrGroup'] = 0;
		}
	} else {
		// Fallback to original logic
		if (config.roomStatus[room]['n'] < config.minGroupSize) {
			config.roomStatus[room]['indivOrGroup'] = 0; // individual condition
		} else {
			config.roomStatus[room]['indivOrGroup'] = 1; // group condition
		}
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
	config.roomStatus[newRoomName_1] = createRoom({ name: newRoomName_1, config });
	config.roomStatus[newRoomName_2] = createRoom({ name: newRoomName_2, config });
	config.roomStatus[newRoomName_3] = createRoom({ name: newRoomName_3, config });
	// to avoid new participants arriving
	config.roomStatus[newRoomName_1]['starting'] = 1; 
	config.roomStatus[newRoomName_2]['starting'] = 1;
	config.roomStatus[newRoomName_3]['starting'] = 1;

	// assigning clients to new rooms
	io.to(room).emit('these are new rooms', {newRoomName_1,newRoomName_2,newRoomName_3});
	
}

function findAvailableGroupRoom(config, maxGroupSize) {
    for (const roomName in config.roomStatus) {
        const room = config.roomStatus[roomName];

        if (room.starting === 0 &&
            room.n < maxGroupSize &&
            room.indivOrGroup === 1 &&
            !room.isTemporary) {
            return { name: roomName, room: room };
        }
    }
    return null;
}

function transitionToSharedRoom(client, config, io) {
    const oldRoom = config.roomStatus[client.room];
    const maxGroupSize = client.maxGroupSize || config.maxGroupSize || 4;
    const minGroupSize = client.minGroupSize || config.minGroupSize || 2;

    if (!oldRoom || !oldRoom.isTemporary) {
        console.warn(`⚠️  Player ${client.subjectID} attempted to transition from non-temporary room ${client.room}`);
        return null;
    }

    const availableRoomInfo = findAvailableGroupRoom(config, maxGroupSize);
    let newRoomName;
    let newRoom;

    if (availableRoomInfo) {
        newRoomName = availableRoomInfo.name;
        newRoom = availableRoomInfo.room;

        client.leave(client.room);
        client.join(newRoomName);

        newRoom.n++;
        newRoom.membersID.push(client.subjectID);
        if (!newRoom.subjectNumbers) newRoom.subjectNumbers = [];
        newRoom.subjectNumbers.push(newRoom.n);

        client.subjectNumber = newRoom.n;

        console.log(`🔄 Player ${client.subjectID} transitioned from temp room ${client.room} → shared room ${newRoomName} (${newRoom.n}/${maxGroupSize})`);

        if (newRoom.n >= minGroupSize && !newRoom.readyToStart) {
            newRoom.readyToStart = true;
            newRoom.restTime = 10000;
            console.log(`🎯 Room ${newRoomName} is ready to start (${newRoom.n}/${minGroupSize} players) - timer reduced to 10 seconds`);

            io.to(newRoomName).emit('waiting_room_update', {
                n: newRoom.n,
                restTime: newRoom.restTime,
                roomReady: true
            });
        }
    } else {
        newRoomName = makeid(7) + `_group`;
        newRoom = createRoom({
            name: newRoomName,
            mode: config.experimentLoader.gameConfig.mode,
            expCondition: config.experimentLoader.gameConfig.exp_condition,
            config: {
                maxGroupSize: maxGroupSize,
                numOptions: config.experimentLoader.gameConfig.k_armed_bandit,
                maxLobbyWaitTime: config.experimentLoader.gameConfig.max_lobby_wait_time,
                maxSceneWaitTime: config.experimentLoader.gameConfig.max_scene_wait_time || 0,
                maxChoiceStageTime: config.experimentLoader.gameConfig.max_choice_time,
                totalGameRound: config.experimentLoader.gameConfig.total_game_rounds,
                minHorizon: config.minHorizon,
                static_horizons: config.static_horizons,
                numEnv: config.numEnv,
                task_order: [],
                options: Array.from({length: config.experimentLoader.gameConfig.k_armed_bandit}, (_, i) => i + 1),
                horizon: config.experimentLoader.gameConfig.horizon
            }
        });

        config.roomStatus[newRoomName] = newRoom;

        client.leave(client.room);
        client.join(newRoomName);

        newRoom.n = 1;
        newRoom.membersID = [client.subjectID];
        newRoom.subjectNumbers = [1];
        newRoom.starting = 0;
        newRoom.isTemporary = false;
        client.subjectNumber = 1;

        console.log(`🔄 Player ${client.subjectID} transitioned from temp room ${client.room} → new shared room ${newRoomName} (1/${maxGroupSize})`);
    }

    const oldRoomName = client.room;
    client.room = newRoomName;

    delete config.roomStatus[oldRoomName];
    console.log(`🗑️  Deleted temporary room ${oldRoomName}`);

    return { roomName: newRoomName, room: newRoom };
}


module.exports = { countDown, startSession, reformNewGroups, transitionToSharedRoom };

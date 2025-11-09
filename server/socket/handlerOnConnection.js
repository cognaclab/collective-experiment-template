'use strict';

/**
 * Handle 'core is ready'
 * @param {Object} config - game env parameters
 * @param {Object} client - the Socket.IO client socket
 * @param {Object} io
 */

const { buildSessionData } = require('../utils/dataBuilders');
const Session = require('../database/models/Session');
const logger = require('../utils/logger');

/**
 * Find an available room that can accept new players for group experiments
 * @param {Object} config - Game configuration
 * @param {number} maxGroupSize - Maximum players per group
 * @returns {Object|null} - { name: roomName, room: roomObject } or null
 */
function findAvailableGroupRoom(config, maxGroupSize) {
    for (const roomName in config.roomStatus) {
        const room = config.roomStatus[roomName];

        // Room is available if: not started, has space, is group mode, not temporary
        if (room.starting === 0 &&           // Not started yet
            room.n < maxGroupSize &&          // Has space for more players
            room.indivOrGroup === 1 &&        // Is group mode
            !room.isTemporary) {              // Not a temporary room
            return { name: roomName, room: room };
        }
    }
    return null;
}

function onConnectioncConfig({ config, client, io }) {

  // Assign client's unique identifier
	client.subjectID = client.request?._query.subjectID;
	client.started = 0;

    // check sessionName already assigned
	const incomingSessionName = client.request?._query.sessionName;

	// Case 1: First-time connection (no sessionName provided)
    if (typeof incomingSessionName === 'undefined') {
        client.session = client.id; // assign new session
        client.join(client.session);
        config.sessionNameSpace[client.session] = 1;

        // Assign to a room immediately for all experiments
        // This ensures room exists before scene_complete events fire
        if (config.experimentLoader && config.experimentLoader.gameConfig) {
            const mode = config.experimentLoader.gameConfig.mode;
            const maxGroupSize = config.experimentLoader.gameConfig.max_group_size;
            const minGroupSize = config.experimentLoader.gameConfig.min_group_size;

            if (mode === 'individual') {
                // Create individual room for this client
                client.room = client.session; // Use session as room name
                client.join(client.room);

                // Set subject number for individual experiments
                client.subjectNumber = 1;

                // Initialize room in roomStatus if it doesn't exist
                if (!config.roomStatus[client.room]) {
                    const { createRoom } = require('../utils/roomFactory');
                    config.roomStatus[client.room] = createRoom({
                        name: client.room,
                        mode: config.experimentLoader.gameConfig.mode,
                        expCondition: config.experimentLoader.gameConfig.exp_condition,
                        config: {
                            maxGroupSize: 1,
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
                    config.roomStatus[client.room].n = 1;
                    config.roomStatus[client.room].membersID = [client.subjectID];
                }

                console.log(`- Room ${client.room} assigned for individual experiment (n=1)`);

                // Create session record in database
                createSessionRecord(client, config.roomStatus[client.room], config);
            } else if (mode === 'group') {
                // Create temporary instruction room for independent progression
                const { makeid } = require('../utils/helpers');
                const { createRoom } = require('../utils/roomFactory');

                const tempRoomName = makeid(7) + `_temp`;

                config.roomStatus[tempRoomName] = createRoom({
                    name: tempRoomName,
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

                client.room = tempRoomName;
                client.join(client.room);

                const room = config.roomStatus[tempRoomName];
                room.isTemporary = true; // Mark as temporary instruction room
                room.n = 1; // Always 1 for temporary rooms
                room.membersID = [client.subjectID];
                room.subjectNumbers = [1];
                room.starting = 0;
                client.subjectNumber = 1; // Will be reassigned when joining permanent room

                // Store config reference for later room transition
                client.maxGroupSize = maxGroupSize;
                client.minGroupSize = config.experimentLoader?.gameConfig?.min_group_size || config.minGroupSize || 2;

                console.log(`📝 Created temporary instruction room ${tempRoomName} for player ${client.subjectID} (will join shared room at waiting room)`);

                // Create session record in database
                createSessionRecord(client, config.roomStatus[client.room], config);
            }
        } else {
            // For non-config-driven experiments, still create session record if room assigned later
            client.pendingSessionCreation = true;
        }

        console.log(`- Exp. ID ${client.session} assigned to ${client.subjectID}`);

    // Case 2: Reconnection from a completed session
    } else if (incomingSessionName === 'already_finished') {
        client.session = incomingSessionName;
        client.room = 'decoyRoom';
        client.join(client.session);
        client.join(client.room);
        console.log(' - Session marked as already finished; decoyRoom assigned');

    // Case 3: Unexpected reconnection from a known session (e.g., browser auto-reconnect)
    } else {
        client.session = 'already_finished';
        client.room = 'decoyRoom';
        client.join(client.session);
        client.join(client.room);

        // Notify client they've been sent to decoyRoom
        io.to(client.session).emit('S_to_C_welcomeback', {
            sessionName: client.session,
            roomName: client.room
        });

        // Mark the original session as already handled
        config.sessionNameSpace[incomingSessionName] = 1;

        // Log the reconnection
        console.log(` - ${incomingSessionName} (${client.subjectID}) in room ${client.request._query.roomName} reconnected`);
    }

}

/**
 * Create session record in database
 * @param {Object} client - Socket client
 * @param {Object} room - Room object
 * @param {Object} config - Experiment config
 */
async function createSessionRecord(client, room, config) {
    try {
        // Store sessionId on client for later reference
        client.sessionId = `${config.experimentName || 'exp'}_${client.session}_${Date.now()}`;
        client.startTime = new Date();

        const sessionData = buildSessionData(client, room, config);

        const session = new Session(sessionData);
        await session.save();

        logger.info('Session record created', {
            sessionId: client.sessionId,
            experimentName: config.experimentName,
            subjectId: client.subjectID
        });
    } catch (error) {
        logger.error('Failed to create session record', {
            error: error.message,
            sessionId: client.sessionId,
            subjectId: client.subjectID
        });
    }
}

module.exports = { onConnectioncConfig };

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
                // For group experiments, create a placeholder room on connection
                // Actual room assignment happens in coreReadyHandler, but this ensures room exists
                client.room = client.session; // Temporary room assignment
                client.join(client.room);

                // Set subject number (will be updated when joining actual group room)
                client.subjectNumber = 1;

                // Initialize temporary room structure
                if (!config.roomStatus[client.room]) {
                    const { createRoom } = require('../utils/roomFactory');
                    config.roomStatus[client.room] = createRoom({
                        name: client.room,
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
                    config.roomStatus[client.room].n = 1; // Will be updated in coreReadyHandler
                    config.roomStatus[client.room].membersID = [client.subjectID];
                    config.roomStatus[client.room].isTemporary = true; // Mark as temporary
                }

                console.log(`- Temporary room ${client.room} created for group experiment (will be assigned in waiting room)`);

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

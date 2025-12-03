'use strict';
/**
 * handleSceneComplete - Server-controlled scene flow handler
 *
 * This handler implements server-side flow control for experiment scenes.
 * It uses the Strategy Pattern to handle both individual (n=1) and multiplayer (n>1)
 * experiments through the same code path.
 *
 * Architecture:
 * - Client emits 'scene_complete' when user finishes a scene
 * - Server tracks readiness across all players in the room
 * - For individual (n=1): Proceeds immediately
 * - For multiplayer (n>1): Waits for all players before proceeding
 * - Server emits 'start_scene' to instruct client(s) which scene to render next
 */

const logger = require('../utils/logger');

/**
 * Scene types that require player synchronization in multiplayer mode
 * Players must wait for all group members before proceeding to these scenes
 * Other scene types allow players to proceed independently at their own pace
 */
const SYNCHRONIZED_SCENE_TYPES = [
    'game',        // Main bandit task scenes (quick-test example)
    'pd_choice',   // 2-player PD choice (prisoners-dilemma example)
    'pd_results',  // 2-player PD results (prisoners-dilemma example)
    'choice',      // Generic choice scenes (networked-pd)
    'results',     // Generic results scenes (networked-pd)
    'feedback',    // Trial feedback scenes (quick-test example)
    'pairing'      // Networked PD: wait for all players before pairs assigned
    // Note: 'ostracism' removed - sync handled by handleOstracismVote after voting
];

/**
 * Find player index in membersID array, handling both string and object formats.
 * membersID can contain either:
 * - strings (legacy format): the subjectID directly
 * - objects (new format): { socketId, subjectId, sessionId, subjectNumber }
 * @param {Array} membersID - Array of member entries
 * @param {string} subjectID - The subject ID to find
 * @returns {number} Index of player (0-based), or -1 if not found
 */
function findPlayerIndex(membersID, subjectID) {
    return membersID.findIndex(m =>
        m === subjectID || m?.subjectId === subjectID
    );
}

/**
 * Get next scene from sequence with conditional routing support
 * @param {string} currentSceneKey - Current scene identifier
 * @param {Array} sequence - Experiment sequence from YAML
 * @param {string} triggerType - Optional trigger type: 'default', 'timeout', 'miss', 'error'
 * @returns {Object|null} Next scene config or null if experiment complete
 */
function getNextScene(currentSceneKey, sequence, triggerType = 'default') {
    const currentScene = sequence.find(s => s.scene === currentSceneKey);

    if (!currentScene) {
        logger.warn('Current scene not found in sequence', { currentSceneKey });
        return null;
    }

    let nextSceneId;

    switch (triggerType) {
        case 'timeout':
            nextSceneId = currentScene.next_on_timeout || currentScene.next;
            logger.info('Using timeout routing', {
                scene: currentSceneKey,
                next: nextSceneId,
                hadConditionalRoute: !!currentScene.next_on_timeout
            });
            break;
        case 'miss':
            nextSceneId = currentScene.next_on_miss || currentScene.next;
            logger.info('Using miss routing', {
                scene: currentSceneKey,
                next: nextSceneId,
                hadConditionalRoute: !!currentScene.next_on_miss
            });
            break;
        case 'error':
            nextSceneId = currentScene.next_on_error || currentScene.next;
            break;
        case 'default':
        default:
            nextSceneId = currentScene.next;
            break;
    }

    if (!nextSceneId) {
        logger.info('No next scene - experiment complete', { currentSceneKey, triggerType });
        return null;
    }

    const nextScene = sequence.find(s => s.scene === nextSceneId);

    if (!nextScene) {
        logger.warn('Next scene not found in sequence', {
            currentSceneKey,
            nextSceneId,
            triggerType
        });
        return null;
    }

    return nextScene;
}

/**
 * Handle scene completion event
 * @param {Object} client - Socket.io client
 * @param {Object} data - Event data { scene: string, sequence: Array, triggerType?: string }
 * @param {Object} config - Game configuration
 * @param {Object} io - Socket.io server instance
 */
async function handleSceneComplete(client, data, config, io) {
    let room = config.roomStatus[client.room];
    const sceneKey = data.scene;
    const triggerType = data.triggerType || 'default';

    console.log(`[SCENE COMPLETE] scene=${sceneKey}, triggerType=${triggerType}, room.trial=${room?.trial}`);

    if (!room) {
        logger.error('Room not found for scene completion', {
            room: client.room,
            scene: sceneKey
        });
        return;
    }

    // Check if synchronization should be bypassed (server-driven transition)
    const bypassSync = data.bypassSync === true;

    // Initialize scene ready counter and timers if not exists
    if (!room.sceneReadyCount) {
        room.sceneReadyCount = {};
    }
    if (!room.sceneTimers) {
        room.sceneTimers = {};
    }

    // Get sequence from experimentLoader (needed early for waiting room check)
    let sequence;

    if (config.experimentLoader && config.experimentLoader.sequence) {
        // experimentLoader.sequence is already the normalized array
        sequence = Array.isArray(config.experimentLoader.sequence)
            ? config.experimentLoader.sequence
            : config.experimentLoader.sequence.sequence || config.experimentLoader.sequence;
    } else if (data.sequence) {
        // Fallback to sequence sent from client
        sequence = data.sequence;
        logger.debug('Using sequence from client data', {
            room: client.room
        });
    }

    if (!sequence) {
        logger.error('No sequence available for scene transition', {
            room: client.room,
            scene: sceneKey
        });
        return;
    }

    // Increment ready count for this scene (unless bypassing sync)
    if (!bypassSync) {
        room.sceneReadyCount[sceneKey] = (room.sceneReadyCount[sceneKey] || 0) + 1;

        logger.debug('Scene completion tracked', {
            room: client.room,
            scene: sceneKey,
            ready: room.sceneReadyCount[sceneKey],
            required: room.n,
            mode: room.indivOrGroup === 1 ? 'group' : 'individual'
        });
    } else {
        logger.info('Bypassing scene synchronization (server-driven transition)', {
            room: client.room,
            scene: sceneKey
        });
    }

    // Check if this is a temporary instruction room - if so, skip synchronization
    const isTemporaryRoom = room.isTemporary === true;

    // Check next scene to determine if we need room transition
    let nextScene = getNextScene(sceneKey, sequence, triggerType);
    const isTransitioningToWaitingRoom = nextScene && nextScene.type === 'waiting';

    // Handle room transition from temporary to shared room
    if (isTemporaryRoom && isTransitioningToWaitingRoom) {
        const { transitionToSharedRoom } = require('./sessionManager');

        logger.info('Transitioning player from temporary room to shared waiting room', {
            oldRoom: client.room,
            player: client.subjectID,
            scene: sceneKey,
            nextScene: nextScene.scene
        });

        const transition = transitionToSharedRoom(client, config, io);

        if (transition) {
            // Update room reference to new shared room
            room = config.roomStatus[transition.roomName];

            // Initialize scene tracking for new room
            if (!room.sceneReadyCount) {
                room.sceneReadyCount = {};
            }
            if (!room.sceneTimers) {
                room.sceneTimers = {};
            }

            logger.info('Player successfully transitioned to shared room', {
                newRoom: transition.roomName,
                roomSize: room.n,
                player: client.subjectID
            });
        } else {
            logger.error('Failed to transition player to shared room', {
                player: client.subjectID,
                oldRoom: client.room
            });
            return;
        }
    }

    // Get current scene config to check if synchronization is required
    const currentSceneConfig = sequence.find(s => s.scene === sceneKey);

    // Determine if this scene type requires player synchronization
    // Also check if the NEXT scene requires sync (e.g., results → pairing needs sync)
    const requiresSync = currentSceneConfig && SYNCHRONIZED_SCENE_TYPES.includes(currentSceneConfig.type);
    const nextRequiresSync = nextScene && SYNCHRONIZED_SCENE_TYPES.includes(nextScene.type);

    // For temporary rooms (instruction phase), always allow individual progression
    // Also skip synchronization if bypassSync flag is set (server-driven transition)
    // Also skip synchronization for non-synchronized scene types (summaries, instructions, etc.)
    // BUT require sync if the NEXT scene requires it (e.g., results → pairing)
    if (isTemporaryRoom || bypassSync || (!requiresSync && !nextRequiresSync)) {
        logger.info(
            bypassSync ? 'Server-driven transition - skipping sync' :
            isTemporaryRoom ? 'Temporary room - allowing individual progression' :
            'Non-synchronized scene - allowing individual progression',
            {
                room: client.room,
                scene: sceneKey,
                sceneType: currentSceneConfig?.type,
                requiresSync: requiresSync,
                nextRequiresSync: nextRequiresSync,
                nextScene: nextScene?.scene,
                player: client.subjectID,
                bypassSync: bypassSync
            }
        );

        // Check for insufficient players when leaving waiting room in group mode
        // This applies to both temporary and non-temporary rooms
        if (currentSceneConfig?.type === 'waiting') {
            const minGroupSize = config.experimentLoader?.gameConfig?.min_group_size || config.minGroupSize || 2;
            const isGroupMode = config.experimentLoader?.gameConfig?.mode === 'group' || room.indivOrGroup === 1;

            if (isGroupMode && room.n < minGroupSize) {
                logger.warn('Insufficient players for group experiment after waiting room', {
                    room: client.room,
                    players: room.n,
                    minRequired: minGroupSize,
                    mode: 'group',
                    isTemporaryRoom: isTemporaryRoom
                });

                io.to(client.room).emit('insufficient_players', {
                    message: 'Not enough players joined. The experiment cannot continue.',
                    minRequired: minGroupSize,
                    actual: room.n
                });
                return;
            }
        }
    } else {
        // For permanent rooms, check if all players are ready
        const allReady = room.sceneReadyCount[sceneKey] >= room.n;

        if (!allReady) {
            // For non-waiting scenes, apply the normal scene wait timeout
            const maxSceneWaitTime = config.experimentLoader?.gameConfig?.max_scene_wait_time || 0;

            // Start timer on first player ready (only if timeout is configured and n > 1)
            if (room.sceneReadyCount[sceneKey] === 1 && maxSceneWaitTime > 0 && room.n > 1) {
                logger.info('Starting scene wait timer', {
                    room: client.room,
                    scene: sceneKey,
                    timeout: maxSceneWaitTime,
                    ready: 1,
                    required: room.n
                });

                room.sceneTimers[sceneKey] = setTimeout(() => {
                    logger.warn('Scene wait timeout - proceeding with ready players', {
                        room: client.room,
                        scene: sceneKey,
                        ready: room.sceneReadyCount[sceneKey],
                        required: room.n,
                        timeout: maxSceneWaitTime
                    });

                    // Force proceed with whoever is ready
                    room.sceneReadyCount[sceneKey] = room.n;

                    // Recursively call this handler to trigger progression
                    handleSceneComplete(client, data, config, io);
                }, maxSceneWaitTime);
            }

            logger.debug('Waiting for other players', {
                room: client.room,
                scene: sceneKey,
                ready: room.sceneReadyCount[sceneKey],
                required: room.n,
                hasTimer: !!room.sceneTimers[sceneKey]
            });
            return; // Wait for other players or timeout
        }
    }

    // Clear timer if it exists (all players ready before timeout)
    if (room.sceneTimers && room.sceneTimers[sceneKey]) {
        clearTimeout(room.sceneTimers[sceneKey]);
        delete room.sceneTimers[sceneKey];
        logger.debug('Cleared scene wait timer - all players ready', {
            room: client.room,
            scene: sceneKey
        });
    }

    // Reset ready counter for this scene
    if (room.sceneReadyCount) {
        room.sceneReadyCount[sceneKey] = 0;
    }

    // Define result scene types that complete a trial and increment counter
    // Note: 'results' is NOT included - it's used in networked-pd for mid-round display
    // and has its own turn-looping logic in the ostracism handler
    const RESULT_SCENE_TYPES = ['feedback', 'pd_results'];

    // Handle trial progression - increment AFTER result/feedback scenes
    if (currentSceneConfig && RESULT_SCENE_TYPES.includes(currentSceneConfig.type)) {
        // Increment trial counter after showing feedback for completed trial
        const oldTrial = room.trial;
        room.trial = (room.trial || 0) + 1;
        console.log(`[TRIAL INCREMENT] After ${sceneKey} (type: ${currentSceneConfig.type}): ${oldTrial} → ${room.trial}`);

        // Reset groupTotalPayoff for next trial and increment pointer (matching legacy behavior)
        const currentPointer = (room.pointer || 1);
        room.pointer = currentPointer + 1;
        const nextPointer = room.pointer - 1;
        room.groupTotalPayoff[nextPointer] = 0;

        // Also reset doneNo for next trial to track readiness
        room.doneNo[nextPointer] = 0;
    }

    // Check if we're completing a summary scene - if so, just use next from sequence
    const isCompletingSummaryScene = currentSceneConfig &&
        (currentSceneConfig.type === 'round_summary' || currentSceneConfig.type === 'final_summary');

    if (isCompletingSummaryScene) {
        // Summary scene complete - proceed to next scene in sequence (don't re-apply summary logic)
        nextScene = getNextScene(sceneKey, sequence, triggerType);

        logger.info('Summary scene completed, proceeding to next scene', {
            room: client.room,
            completedScene: sceneKey,
            completedSceneType: currentSceneConfig.type,
            nextScene: nextScene?.scene,
            nextSceneType: nextScene?.type
        });
    } else if (currentSceneConfig && RESULT_SCENE_TYPES.includes(currentSceneConfig.type)) {
        // After result/feedback, check if we should loop back to game scene or proceed to final summary/questionnaire
        const horizon = config.experimentLoader?.gameConfig?.horizon || config.horizon;

        if (room.trial <= horizon) {
            // Continue to next trial - use the 'next' field from current scene config
            const nextSceneId = currentSceneConfig.next;
            nextScene = sequence.find(s => s.scene === nextSceneId);

            if (!nextScene) {
                logger.warn('Next game scene not found in sequence', {
                    currentScene: sceneKey,
                    nextSceneId: nextSceneId
                });
                nextScene = getNextScene(sceneKey, sequence, triggerType);
            }
        } else {
            // All trials completed, always show round summary first
            const roundSummaryScene = sequence.find(s => s.type === 'round_summary');
            const finalSummaryScene = sequence.find(s => s.type === 'final_summary');
            const questionnaireScene = sequence.find(s => s.type === 'questionnaire');

            if (roundSummaryScene) {
                // Always show round summary first after trials complete (shows trial-by-trial details)
                nextScene = roundSummaryScene;
            } else if (finalSummaryScene) {
                // Fallback to final summary if no round summary exists
                nextScene = finalSummaryScene;
            } else {
                // Fallback to questionnaire or next in sequence
                nextScene = questionnaireScene || getNextScene(sceneKey, sequence, triggerType);
            }

            logger.info('All trials completed, transitioning to summary scene', {
                room: client.room,
                trial: room.trial,
                horizon: horizon,
                nextScene: nextScene?.scene,
                nextSceneType: nextScene?.type
            });
        }
    } else if (!isTemporaryRoom) {
        // For permanent rooms, recalculate next scene (may differ from earlier check)
        nextScene = getNextScene(sceneKey, sequence, triggerType);
    }
    // For temporary rooms, nextScene was already set at line 147

    if (!nextScene) {
        logger.info('Experiment completed for room', {
            room: client.room,
            lastScene: sceneKey
        });

        io.to(client.room).emit('experiment_complete', {
            message: 'Experiment completed successfully'
        });
        return;
    }

    // Check for redirect (completion scenes)
    if (nextScene.redirect) {
        // Build full URL for redirect (prepend APP_URL if relative path)
        let redirectUrl = nextScene.redirect;
        if (redirectUrl.startsWith('/')) {
            const appUrl = process.env.APP_URL || 'http://localhost:8000';
            redirectUrl = appUrl + redirectUrl;
            logger.debug('Converted relative redirect to absolute', {
                original: nextScene.redirect,
                appUrl: appUrl,
                final: redirectUrl
            });
        }

        logger.info('Scene redirecting to page', {
            room: client.room,
            scene: nextScene.scene,
            redirect: redirectUrl,
            playersInRoom: room.n,
            readyCount: room.sceneReadyCount?.[sceneKey] || 0
        });

        io.to(client.room).emit('redirect', {
            url: redirectUrl,
            scene: nextScene.scene
        });
        return;
    }

    // For game-type and choice-type scenes, initialize parameters if not already done
    if ((nextScene.type === 'game' || nextScene.type === 'choice') && !room.parametersInitialized) {
        logger.info('Initializing experiment parameters for game scene', {
            room: client.room,
            scene: nextScene.scene
        });

        // Get environment probabilities from config (for bandit tasks)
        // For PD/choice scenes, these may not exist - that's OK
        const numOptions = config.experimentLoader?.gameConfig?.k_armed_bandit || config.numOptions || 2;
        const horizon = config.experimentLoader?.gameConfig?.horizon || config.horizon || 30;
        const envKey = nextScene.environment || 'static';

        // Build prob_means array from environment probabilities (only for bandit tasks)
        let prob_means = [];
        let vals = [];

        // Only try to get environment probabilities if environments are defined
        const hasEnvironments = config.experimentLoader?.config?.environments;

        if (hasEnvironments && config.experimentLoader) {
            try {
                // Get normalized probabilities (works with both old and new format)
                const probArray = config.experimentLoader.getEnvironmentProbs(envKey);

                // Expand each probability to full horizon length
                prob_means = probArray.map(prob => Array(horizon).fill(prob));

                logger.info('Built prob_means from environment', {
                    envKey,
                    probabilities: probArray,
                    numOptions,
                    horizon,
                    prob_means
                });

                // Build vals array (payoff values - typically 100 for all options)
                vals = Array(numOptions).fill(null).map(() => Array(horizon).fill(100));
            } catch (error) {
                logger.warn('Could not get environment probabilities (may be PD experiment)', {
                    envKey,
                    error: error.message
                });
                // Not fatal for PD experiments
            }
        } else if (!hasEnvironments) {
            // For PD/choice experiments without environments, use empty arrays
            logger.info('No environments defined (PD/choice experiment), skipping prob_means');
        } else {
            // Fallback to legacy config format
            prob_means = [config.prob_0, config.prob_1, config.prob_2, config.prob_3, config.prob_4].slice(0, numOptions);
            vals = Array(numOptions).fill(null).map(() => Array(horizon).fill(100));
            logger.info('Using legacy prob_means', { prob_means });
        }

        // Store on room object for database tracking
        room.prob_means = prob_means;
        room.vals = vals;

        io.to(client.room).emit('init_experiment_params', {
            numOptions: numOptions,
            maxChoiceStageTime: config.experimentLoader?.gameConfig?.max_choice_time || config.maxChoiceStageTime,
            optionOrder: room.optionOrder,
            indivOrGroup: room.indivOrGroup,
            exp_condition: room.exp_condition,
            prob_means: prob_means,
            horizon: horizon,
            taskType: room.taskType  // 'networked_pd', 'static', 'dynamic', etc.
        });

        room.parametersInitialized = true;
    }

    // Prepare scene-specific data to pass to scene.init()
    let sceneData = {};
    const currentGameRound = room.gameRound || 0;
    const currentPointer = (room.pointer || 1) - 1;

    if (nextScene.type === 'game') {
        sceneData = {
            gameRound: currentGameRound,
            trial: room.trial || 1,
            horizon: config.experimentLoader?.gameConfig?.horizon || config.horizon,
            n: room.n,
            taskType: nextScene.environment || 'static',
            groupTotalScore: room.groupTotalPayoff?.[currentPointer] || 0,
            groupCumulativePayoff: room.groupCumulativePayoff?.[currentGameRound] || 0,
            mySocialInfo: {},
            optionOrder: room.optionOrder || [1, 2, 3] // Machine ID order for counterbalancing
        };
    } else if (nextScene.type === 'feedback') {
        const gameScene = sequence.find(s => s.scene === 'SceneMain');
        const horizon = config.experimentLoader?.gameConfig?.horizon || config.horizon;

        sceneData = {
            gameRound: currentGameRound,
            trial: room.trial || 1,
            horizon: horizon,
            n: room.n,
            taskType: room.taskType || 'static',
            groupTotalScore: room.groupTotalPayoff?.[currentPointer] || 0,
            groupCumulativePayoff: room.groupCumulativePayoff?.[currentGameRound] || 0,
            mySocialInfo: room.socialInfo?.[currentPointer] || {}
        };
    } else if (nextScene.type === 'pd_choice') {
        // Prisoner's Dilemma choice scene (simple PD without turns)
        const horizon = config.experimentLoader.gameConfig.horizon || 3;
        sceneData = {
            trial: room.trial || 1,
            totalTrials: horizon,
            maxChoiceTime: config.experimentLoader.gameConfig.max_choice_time || 10000,
            showTimer: true,
            // Explicitly set turnsPerRound=1 for simple PD (no turn structure)
            turnsPerRound: 1,
            gameRound: 1,
            turnWithinRound: room.trial || 1,
            totalRounds: 1
        };
        logger.debug('Preparing ScenePDChoice sceneData', {
            sceneData: sceneData,
            room: client.room,
            trial: room.trial
        });
    } else if (nextScene.type === 'pd_results') {
        // Matrix game results scene - emit PERSONALIZED data to each player

        // Ensure rewards and player choices exist before proceeding
        if (!room.rewards || !room.rewards[currentPointer]) {
            logger.error('Rewards not found for results scene', {
                room: client.room,
                trial: room.trial,
                pointer: currentPointer,
                hasRewards: !!room.rewards
            });
            return;
        }

        const rewards = room.rewards[currentPointer];
        const playerChoices = room.playerChoices?.[currentPointer] || {};

        // Get all sockets in room for personalized emission
        const sockets = await io.in(client.room).fetchSockets();

        logger.info('Emitting personalized results to each player', {
            room: client.room,
            trial: room.trial,
            playerCount: sockets.length
        });

        // Emit personalized data to EACH player individually
        for (const playerSocket of sockets) {
            // Find this player's subject number (supports both string and object membersID formats)
            const playerSubjectNumber = findPlayerIndex(room.membersID, playerSocket.subjectID) + 1;

            if (playerSubjectNumber === 0) {
                logger.warn('Player not found in membersID', {
                    subjectID: playerSocket.subjectID,
                    membersID: room.membersID
                });
                continue;
            }

            // Get THIS player's data
            const myChoice = playerChoices[playerSubjectNumber];
            const myPayoff = rewards[playerSubjectNumber];

            // Get partner's data (the other player)
            const playerNumbers = Object.keys(playerChoices).map(n => parseInt(n));
            const partnerNumber = playerNumbers.find(n => n !== playerSubjectNumber);
            const partnerChoice = partnerNumber !== undefined ? playerChoices[partnerNumber] : null;
            const partnerPayoff = partnerNumber !== undefined ? rewards[partnerNumber] : null;

            // Calculate cumulative points for THIS player
            let totalPoints = 0;
            if (room.rewards) {
                for (let i = 0; i <= currentPointer; i++) {
                    if (room.rewards[i] && room.rewards[i][playerSubjectNumber] !== undefined) {
                        totalPoints += room.rewards[i][playerSubjectNumber];
                    }
                }
            }

            // Build personalized sceneData for THIS player
            const personalizedSceneData = {
                trial: room.trial || 1,
                myChoice: myChoice !== undefined ? myChoice : null,
                partnerChoice: partnerChoice !== null ? partnerChoice : null,
                myPayoff: myPayoff !== undefined ? myPayoff : 0,
                partnerPayoff: partnerPayoff !== null ? partnerPayoff : 0,
                totalPoints: totalPoints,
                wasMiss: room.missFlags?.[currentPointer]?.some(f => f) || false,
                wasTimeout: room.timeoutFlags?.[currentPointer]?.some(f => f) || false
            };

            // Emit to THIS player only
            playerSocket.emit('start_scene', {
                scene: nextScene.scene,
                sceneConfig: nextScene,
                sceneData: personalizedSceneData,
                roomId: client.room,
                sessionId: playerSocket.sessionId,
                subjectId: playerSocket.subjectID
            });

            logger.debug('Emitted personalized results to player', {
                subjectID: playerSocket.subjectID,
                subjectNumber: playerSubjectNumber,
                myChoice,
                myPayoff,
                partnerChoice,
                partnerPayoff,
                totalPoints
            });
        }

        // Track current scene in room state
        if (config.roomStatus[client.room]) {
            config.roomStatus[client.room].currentScene = nextScene.scene;
        }

        // Early return - skip default broadcast for pd_results
        return;
    } else if (nextScene.type === 'ostracism') {
        // Check if we need to loop back to choice (more turns in this round)
        // This implements the round/turn structure: multiple turns with same partner before ostracism
        const turnsPerRound = room.turnsPerRound || config.experimentLoader?.gameConfig?.horizon || 2;
        const turnWithinRound = room.turnWithinRound || 1;

        if (turnWithinRound < turnsPerRound) {
            // Not done with this round yet - loop back to choice scene with same partner
            room.turnWithinRound = turnWithinRound + 1;
            room.trial = (room.trial || 1) + 1;

            logger.info('Looping back to choice scene (more turns in round)', {
                room: client.room,
                gameRound: room.gameRound,
                turnWithinRound: room.turnWithinRound,
                turnsPerRound: turnsPerRound,
                trial: room.trial,
                player: client.subjectID
            });

            // Find this player's index and partner (same partner as before)
            let playerId = -1;
            for (const [idx, player] of Object.entries(room.membersID)) {
                if (player && player.subjectId === client.subjectID) {
                    playerId = parseInt(idx);
                    break;
                }
            }

            // Get partner from currentRoundPartner or currentPairings
            const partnerId = room.currentRoundPartner?.[playerId] ??
                (room.currentPairings?.find(([p1, p2]) => p1 === playerId || p2 === playerId)
                    ?.find(p => p !== playerId));
            const partner = partnerId !== null && partnerId !== undefined ? room.membersID[partnerId] : null;

            // Build choice scene data with same partner info
            const choiceData = {
                trial: room.trial,
                totalTrials: turnsPerRound * (room.totalGameRounds || 3),
                gameRound: (room.gameRound || 0) + 1,
                turnWithinRound: room.turnWithinRound,
                turnsPerRound: turnsPerRound,
                totalRounds: room.totalGameRounds || 3,
                maxChoiceTime: config.experimentLoader?.gameConfig?.max_choice_time || 20000,
                showTimer: true,
                showPartner: true,
                partnerId: partnerId,
                partnerSubjectId: partner?.subjectId || `Player ${partnerId}`
            };

            // Emit choice scene to triggering player (they proceed independently, but sync at choice submission)
            client.emit('start_scene', {
                scene: 'ScenePDChoice',
                sceneConfig: {
                    scene: 'ScenePDChoice',
                    type: 'choice',
                    next: 'ScenePDResults'
                },
                sceneData: choiceData,
                roomId: client.room,
                sessionId: client.sessionId,
                subjectId: client.subjectID
            });

            // Track current scene
            if (config.roomStatus[client.room]) {
                config.roomStatus[client.room].currentScene = 'ScenePDChoice';
            }

            return; // Skip ostracism - loop back to choice
        }

        // All turns complete - proceed to ostracism voting
        // Ostracism voting scene - emit PERSONALIZED data to TRIGGERING player only
        // Each player transitions independently when they click Continue on results
        // Synchronization happens AFTER voting via handleOstracismVote.js

        // Find this player's index in membersID (object keyed by player number)
        let playerId = -1;
        for (const [idx, player] of Object.entries(room.membersID)) {
            if (player && player.subjectId === client.subjectID) {
                playerId = parseInt(idx);
                break;
            }
        }

        if (playerId === -1) {
            logger.warn('Player not found in membersID for ostracism', {
                subjectID: client.subjectID
            });
            return;
        }

        // Helper function to find partner from currentPairings
        const findPartner = (pId) => {
            if (!room.currentPairings) return null;
            for (const [p1, p2] of room.currentPairings) {
                if (p1 === pId) return p2;
                if (p2 === pId) return p1;
            }
            return null;
        };

        // Find this player's partner from currentPairings
        const partnerId = findPartner(playerId);
        const partner = partnerId !== null ? room.membersID[partnerId] : null;

        // Get cooperation history with this partner
        const cooperationHistory = room.cooperationHistory?.[playerId]?.[partnerId] || [];

        // Calculate cooperation stats
        const totalInteractions = cooperationHistory.length;
        const partnerCooperations = cooperationHistory.filter(c => c === 0).length;

        const ostracismData = {
            roundNumber: (room.gameRound || 0) + 1,
            totalRounds: room.totalGameRounds || config.experimentLoader?.gameConfig?.total_game_rounds || 3,
            partnerId: partnerId,
            partnerSubjectId: partner?.subjectId || `Player ${partnerId}`,
            cooperationHistory: cooperationHistory,
            cooperationStats: {
                totalInteractions: totalInteractions,
                partnerCooperations: partnerCooperations,
                cooperationRate: totalInteractions > 0 ? Math.round((partnerCooperations / totalInteractions) * 100) : 0
            },
            cumulativePayoff: room.cumulativePayoffs?.[playerId] || 0,
            isIsolated: room.network?.isIsolated?.(playerId) || false
        };

        // Emit ONLY to the triggering client (not all players)
        client.emit('start_scene', {
            scene: nextScene.scene,
            sceneConfig: nextScene,
            sceneData: ostracismData,
            roomId: client.room,
            sessionId: client.sessionId,
            subjectId: client.subjectID
        });

        logger.info('Emitted ostracism scene to triggering player only', {
            playerId: playerId,
            partnerId: partnerId,
            subjectID: client.subjectID,
            totalInteractions: totalInteractions,
            partnerCooperations: partnerCooperations
        });

        // Track current scene in room state
        if (config.roomStatus[client.room]) {
            config.roomStatus[client.room].currentScene = nextScene.scene;
        }

        // Early return - skip default broadcast for ostracism
        return;
    } else if (nextScene.type === 'network_update') {
        // Network update scene - emit network state data to each player
        // This runs AFTER all ostracism votes have been processed
        const sockets = await io.in(client.room).fetchSockets();

        logger.info('Emitting network_update scene data to all players', {
            room: client.room,
            playerCount: sockets.length
        });

        for (const playerSocket of sockets) {
            // Find player ID from membersID (object keyed by player number)
            let playerId = -1;
            for (const [idx, player] of Object.entries(room.membersID)) {
                if (player && player.subjectId === playerSocket.subjectID) {
                    playerId = parseInt(idx);
                    break;
                }
            }

            if (playerId === -1) {
                logger.warn('Player not found in membersID for network_update', {
                    subjectID: playerSocket.subjectID
                });
                continue;
            }

            // Get network state data
            const networkData = room.network ? room.network.serialize() : {};

            // Get player-specific status
            const playerConnections = room.network ? room.network.getDegree(playerId) : 0;
            const availablePartners = room.network ? room.network.getValidPartners(playerId) : [];
            const isIsolated = room.network ? room.network.isIsolated(playerId) : false;

            // Get edges removed this round from lastOstracismResults
            const lastOstracismResults = room.lastOstracismResults || {};
            const edgesRemovedThisRound = lastOstracismResults.edgesRemoved || [];

            // Find connections removed that affected this player
            const removedConnections = edgesRemovedThisRound
                .filter(e => e.player1 === playerId || e.player2 === playerId)
                .map(e => ({
                    number: e.player1 === playerId ? e.player2 : e.player1,
                    subjectId: room.membersID[e.player1 === playerId ? e.player2 : e.player1]?.subjectId
                }));

            // Get newly isolated players
            const newlyIsolated = lastOstracismResults.newlyIsolated || [];

            const networkUpdateData = {
                roundNumber: (room.gameRound || 0) + 1,
                totalRounds: room.totalGameRounds || config.experimentLoader?.gameConfig?.total_game_rounds || 3,
                edgesRemoved: edgesRemovedThisRound.length,
                totalEdgesRemaining: networkData.totalEdges || 0,
                networkDensity: networkData.density || 0,
                playerStatus: {
                    currentConnections: playerConnections,
                    availablePartners: availablePartners.map(p => ({
                        number: p,
                        subjectId: room.membersID[p]?.subjectId
                    })),
                    isIsolated: isIsolated
                },
                removedConnections: removedConnections,
                isolatedPlayers: newlyIsolated.map(p => ({
                    number: p,
                    subjectId: room.membersID[p]?.subjectId
                }))
            };

            playerSocket.emit('start_scene', {
                scene: nextScene.scene,
                sceneConfig: nextScene,
                sceneData: networkUpdateData,
                roomId: client.room,
                sessionId: playerSocket.sessionId,
                subjectId: playerSocket.subjectID
            });

            logger.debug('Emitted network_update data to player', {
                playerId: playerId,
                subjectID: playerSocket.subjectID,
                edgesRemoved: edgesRemovedThisRound.length,
                playerConnections: playerConnections,
                isIsolated: isIsolated
            });
        }

        // Clear lastOstracismResults after sending to all players (prevent stale data)
        delete room.lastOstracismResults;

        // Track current scene in room state
        if (config.roomStatus[client.room]) {
            config.roomStatus[client.room].currentScene = nextScene.scene;
        }

        // Early return - skip default broadcast for network_update
        return;
    } else if (nextScene.type === 'round_summary') {
        // Round summary scene - emit PERSONALIZED trial history for current round to each player
        const horizon = config.experimentLoader?.gameConfig?.horizon || config.horizon;
        const totalRounds = config.experimentLoader?.gameConfig?.total_game_rounds || 1;
        const currentRound = room.gameRound || 0;
        const isLastRound = (currentRound >= totalRounds - 1);

        // Determine if we should emit to all players or just the triggering player
        const shouldEmitToAll = requiresSync || room.n === 1;

        if (shouldEmitToAll) {
            // Synchronized mode OR individual - emit to ALL players
            const sockets = await io.in(client.room).fetchSockets();

            logger.info('Emitting personalized round summary to each player (synchronized)', {
                room: client.room,
                horizon: horizon,
                currentRound: currentRound,
                isLastRound: isLastRound,
                playerCount: sockets.length,
                synchronized: requiresSync
            });

            // Calculate payment
            const paymentCalculator = config.experimentLoader?.paymentCalculator;

            // Emit personalized data to EACH player individually
            for (const playerSocket of sockets) {
                // Find this player's subject number (supports both string and object membersID formats)
                const playerSubjectNumber = findPlayerIndex(room.membersID, playerSocket.subjectID) + 1;

                if (playerSubjectNumber === 0) {
                    logger.warn('Player not found in membersID for round summary', {
                        subjectID: playerSocket.subjectID,
                        membersID: room.membersID
                    });
                    continue;
                }

                // Build trial history for THIS player
                const trialHistory = [];
                let totalPoints = 0;

                for (let trialIndex = 0; trialIndex < horizon; trialIndex++) {
                    if (room.rewards && room.rewards[trialIndex]) {
                        const myChoice = room.playerChoices?.[trialIndex]?.[playerSubjectNumber];
                        const myPayoff = room.rewards[trialIndex][playerSubjectNumber] || 0;

                        // Get partner's data
                        const playerNumbers = Object.keys(room.playerChoices?.[trialIndex] || {}).map(n => parseInt(n));
                        const partnerNumber = playerNumbers.find(n => n !== playerSubjectNumber);
                        const partnerChoice = partnerNumber !== undefined ? room.playerChoices[trialIndex][partnerNumber] : null;

                        trialHistory.push({
                            trial: trialIndex + 1,
                            myChoice: myChoice !== undefined ? myChoice : null,
                            partnerChoice: partnerChoice !== null ? partnerChoice : null,
                            myPayoff: myPayoff
                        });

                        totalPoints += myPayoff;
                    }
                }

                // Calculate payment for THIS player
                let paymentData = null;
                if (paymentCalculator) {
                    try {
                        paymentData = paymentCalculator.calculateSessionPayment(
                            totalPoints,
                            0, // waiting bonus
                            true // completed
                        );

                        logger.info('Calculated payment for round summary', {
                            subjectID: playerSocket.subjectID,
                            totalPoints: totalPoints,
                            payment: paymentData.formatted
                        });
                    } catch (error) {
                        logger.error('Failed to calculate payment for round summary', { error: error.message });
                    }
                }

                // Build personalized sceneData for THIS player
                const personalizedSceneData = {
                    trialHistory: trialHistory,
                    totalPoints: totalPoints,
                    finalPayment: paymentData?.formatted || '£0.00',
                    totalTrials: horizon,
                    round: currentRound,
                    isLastRound: isLastRound
                };

                // Emit to THIS player only
                playerSocket.emit('start_scene', {
                    scene: nextScene.scene,
                    sceneConfig: nextScene,
                    sceneData: personalizedSceneData,
                    roomId: client.room,
                    sessionId: playerSocket.sessionId,
                    subjectId: playerSocket.subjectID
                });

                logger.debug('Emitted personalized round summary to player', {
                    subjectID: playerSocket.subjectID,
                    subjectNumber: playerSubjectNumber,
                    trialCount: trialHistory.length,
                    totalPoints,
                    payment: paymentData?.formatted
                });
            }
        } else {
            // Non-synchronized multiplayer - emit only to triggering player
            const playerSubjectNumber = findPlayerIndex(room.membersID, client.subjectID) + 1;

            logger.info('Emitting round summary to triggering player only (non-synchronized)', {
                room: client.room,
                subjectID: client.subjectID,
                playerNumber: playerSubjectNumber,
                horizon: horizon,
                currentRound: currentRound,
                isLastRound: isLastRound
            });

            if (playerSubjectNumber === 0) {
                logger.error('Triggering player not found in membersID for round summary', {
                    subjectID: client.subjectID,
                    membersID: room.membersID
                });
                return;
            }

            // Build trial history for triggering player
            const trialHistory = [];
            let totalPoints = 0;

            for (let trialIndex = 0; trialIndex < horizon; trialIndex++) {
                if (room.rewards && room.rewards[trialIndex]) {
                    const myChoice = room.playerChoices?.[trialIndex]?.[playerSubjectNumber];
                    const myPayoff = room.rewards[trialIndex][playerSubjectNumber] || 0;

                    // Get partner's data
                    const playerNumbers = Object.keys(room.playerChoices?.[trialIndex] || {}).map(n => parseInt(n));
                    const partnerNumber = playerNumbers.find(n => n !== playerSubjectNumber);
                    const partnerChoice = partnerNumber !== undefined ? room.playerChoices[trialIndex][partnerNumber] : null;

                    trialHistory.push({
                        trial: trialIndex + 1,
                        myChoice: myChoice !== undefined ? myChoice : null,
                        partnerChoice: partnerChoice !== null ? partnerChoice : null,
                        myPayoff: myPayoff
                    });

                    totalPoints += myPayoff;
                }
            }

            // Calculate payment for triggering player
            const paymentCalculator = config.experimentLoader?.paymentCalculator;
            let paymentData = null;
            if (paymentCalculator) {
                try {
                    paymentData = paymentCalculator.calculateSessionPayment(
                        totalPoints,
                        0, // waiting bonus
                        true // completed
                    );

                    logger.info('Calculated payment for round summary', {
                        subjectID: client.subjectID,
                        totalPoints: totalPoints,
                        payment: paymentData.formatted
                    });
                } catch (error) {
                    logger.error('Failed to calculate payment for round summary', { error: error.message });
                }
            }

            // Build personalized sceneData for triggering player
            const personalizedSceneData = {
                trialHistory: trialHistory,
                totalPoints: totalPoints,
                finalPayment: paymentData?.formatted || '£0.00',
                totalTrials: horizon,
                round: currentRound,
                isLastRound: isLastRound
            };

            // Emit to triggering player only
            client.emit('start_scene', {
                scene: nextScene.scene,
                sceneConfig: nextScene,
                sceneData: personalizedSceneData,
                roomId: client.room,
                sessionId: client.sessionId,
                subjectId: client.subjectID
            });

            logger.debug('Emitted personalized round summary to triggering player', {
                subjectID: client.subjectID,
                subjectNumber: playerSubjectNumber,
                trialCount: trialHistory.length,
                totalPoints,
                payment: paymentData?.formatted
            });
        }

        // Track current scene in room state
        if (config.roomStatus[client.room]) {
            config.roomStatus[client.room].currentScene = nextScene.scene;
        }

        // Early return - skip default broadcast for round_summary
        return;
    } else if (nextScene.type === 'final_summary') {
        // Final summary scene - emit PERSONALIZED per-round totals to each player
        const totalRounds = config.experimentLoader?.gameConfig?.total_game_rounds || 1;
        const horizon = config.experimentLoader?.gameConfig?.horizon || config.horizon;

        // Determine if we should emit to all players or just the triggering player
        const shouldEmitToAll = requiresSync || room.n === 1;

        if (shouldEmitToAll) {
            // Synchronized mode OR individual - emit to ALL players
            const sockets = await io.in(client.room).fetchSockets();

            logger.info('Emitting personalized final summary to each player (synchronized)', {
                room: client.room,
                totalRounds: totalRounds,
                horizon: horizon,
                playerCount: sockets.length,
                synchronized: requiresSync
            });

            const paymentCalculator = config.experimentLoader?.paymentCalculator;

            // Emit personalized data to EACH player individually
            for (const playerSocket of sockets) {
                // Find this player's subject number (supports both string and object membersID formats)
                const playerSubjectNumber = findPlayerIndex(room.membersID, playerSocket.subjectID) + 1;

                if (playerSubjectNumber === 0) {
                    logger.warn('Player not found in membersID for final summary', {
                        subjectID: playerSocket.subjectID,
                        membersID: room.membersID
                    });
                    continue;
                }

                // Build per-round breakdown for THIS player
                const roundBreakdown = [];
                let totalPoints = 0;

                for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
                    let roundPoints = 0;

                    // Sum all trials in this round for this player
                    const startTrial = roundIndex * horizon;
                    const endTrial = startTrial + horizon;

                    for (let trialIndex = startTrial; trialIndex < endTrial; trialIndex++) {
                        if (room.rewards && room.rewards[trialIndex]) {
                            roundPoints += room.rewards[trialIndex][playerSubjectNumber] || 0;
                        }
                    }

                    roundBreakdown.push({
                        round: roundIndex + 1,
                        points: roundPoints
                    });
                    totalPoints += roundPoints;
                }

                // Calculate final payment for THIS player
                let paymentData = null;
                if (paymentCalculator) {
                    try {
                        paymentData = paymentCalculator.calculateSessionPayment(
                            totalPoints,
                            0, // waiting bonus
                            true // completed
                        );

                        logger.info('Calculated final payment for experiment summary', {
                            subjectID: playerSocket.subjectID,
                            totalPoints: totalPoints,
                            payment: paymentData.formatted
                        });
                    } catch (error) {
                        logger.error('Failed to calculate payment for experiment summary', { error: error.message });
                    }
                }

                // Build personalized sceneData for THIS player (shows ONLY their payment, not others)
                const personalizedSceneData = {
                    roundBreakdown: roundBreakdown,
                    totalPoints: totalPoints,
                    finalPayment: paymentData?.formatted || '£0.00',
                    totalRounds: totalRounds
                };

                // Emit to THIS player only
                playerSocket.emit('start_scene', {
                    scene: nextScene.scene,
                    sceneConfig: nextScene,
                    sceneData: personalizedSceneData,
                    roomId: client.room,
                    sessionId: playerSocket.sessionId,
                    subjectId: playerSocket.subjectID
                });

                logger.debug('Emitted personalized final summary to player', {
                    subjectID: playerSocket.subjectID,
                    subjectNumber: playerSubjectNumber,
                    roundCount: roundBreakdown.length,
                    totalPoints,
                    payment: paymentData?.formatted
                });
            }
        } else {
            // Non-synchronized multiplayer - emit only to triggering player
            const playerSubjectNumber = findPlayerIndex(room.membersID, client.subjectID) + 1;

            logger.info('Emitting final summary to triggering player only (non-synchronized)', {
                room: client.room,
                subjectID: client.subjectID,
                playerNumber: playerSubjectNumber,
                totalRounds: totalRounds,
                horizon: horizon
            });

            if (playerSubjectNumber === 0) {
                logger.error('Triggering player not found in membersID for final summary', {
                    subjectID: client.subjectID,
                    membersID: room.membersID
                });
                return;
            }

            // Build per-round breakdown for triggering player
            const roundBreakdown = [];
            let totalPoints = 0;

            for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
                let roundPoints = 0;

                // Sum all trials in this round for this player
                const startTrial = roundIndex * horizon;
                const endTrial = startTrial + horizon;

                for (let trialIndex = startTrial; trialIndex < endTrial; trialIndex++) {
                    if (room.rewards && room.rewards[trialIndex]) {
                        roundPoints += room.rewards[trialIndex][playerSubjectNumber] || 0;
                    }
                }

                roundBreakdown.push({
                    round: roundIndex + 1,
                    points: roundPoints
                });
                totalPoints += roundPoints;
            }

            // Calculate final payment for triggering player
            const paymentCalculator = config.experimentLoader?.paymentCalculator;
            let paymentData = null;
            if (paymentCalculator) {
                try {
                    paymentData = paymentCalculator.calculateSessionPayment(
                        totalPoints,
                        0, // waiting bonus
                        true // completed
                    );

                    logger.info('Calculated final payment for experiment summary', {
                        subjectID: client.subjectID,
                        totalPoints: totalPoints,
                        payment: paymentData.formatted
                    });
                } catch (error) {
                    logger.error('Failed to calculate payment for experiment summary', { error: error.message });
                }
            }

            // Build personalized sceneData for triggering player
            const personalizedSceneData = {
                roundBreakdown: roundBreakdown,
                totalPoints: totalPoints,
                finalPayment: paymentData?.formatted || '£0.00',
                totalRounds: totalRounds
            };

            // Emit to triggering player only
            client.emit('start_scene', {
                scene: nextScene.scene,
                sceneConfig: nextScene,
                sceneData: personalizedSceneData,
                roomId: client.room,
                sessionId: client.sessionId,
                subjectId: client.subjectID
            });

            logger.debug('Emitted personalized final summary to triggering player', {
                subjectID: client.subjectID,
                subjectNumber: playerSubjectNumber,
                roundCount: roundBreakdown.length,
                totalPoints,
                payment: paymentData?.formatted
            });
        }

        // Track current scene in room state
        if (config.roomStatus[client.room]) {
            config.roomStatus[client.room].currentScene = nextScene.scene;
        }

        // Early return - skip default broadcast for final_summary
        return;
    } else if (nextScene.type === 'questionnaire') {
        // Calculate totals across all rounds for summary display
        const totalPointsAllRounds = room.groupCumulativePayoff?.reduce((sum, val) => sum + (val || 0), 0) || 0;
        const roundBreakdown = room.groupCumulativePayoff || [0];
        const totalGameRounds = config.experimentLoader?.gameConfig?.total_game_rounds || 1;
        const horizon = config.experimentLoader?.gameConfig?.horizon || config.horizon;

        // Get prob_means for machine probability display
        let prob_means_summary = null;
        if (config.experimentLoader) {
            try {
                const envKey = nextScene.environment || 'static';
                const probArray = config.experimentLoader.getEnvironmentProbs(envKey);
                prob_means_summary = probArray.map(prob => Array(horizon).fill(prob));

                logger.debug('Built prob_means for questionnaire summary', {
                    envKey,
                    probabilities: probArray,
                    prob_means: prob_means_summary
                });
            } catch (error) {
                logger.warn('Could not get prob_means for summary', { error: error.message });
            }
        }

        // Calculate payment for each client in the room
        const paymentCalculator = config.experimentLoader?.paymentCalculator;
        let paymentData = null;

        if (paymentCalculator) {
            // Create a temporary client object with cumulative points
            const tempClient = {
                waitingBonus: 0 // TODO: Track waiting bonus per client
            };

            // Create a temporary room object with total points
            const tempRoom = {
                totalPayoff_perIndiv: [totalPointsAllRounds],
                n: room.n
            };

            try {
                paymentData = paymentCalculator.calculateSessionPayment(
                    totalPointsAllRounds,
                    tempClient.waitingBonus,
                    true // completed
                );

                logger.info('Calculated payment for questionnaire', {
                    totalPoints: totalPointsAllRounds,
                    payment: paymentData.formatted
                });
            } catch (error) {
                logger.error('Failed to calculate payment', { error: error.message });
            }
        }

        sceneData = {
            gameRound: currentGameRound,
            totalPointsAllRounds: totalPointsAllRounds,
            roundBreakdown: roundBreakdown,
            totalGameRounds: totalGameRounds,
            optionOrder: room.optionOrder || [1, 2, 3],
            horizon: horizon,
            n: room.n,
            prob_means: prob_means_summary,
            payment: paymentData // Add payment data to scene data
        };

        logger.info('Preparing questionnaire with summary data', {
            totalPointsAllRounds,
            roundBreakdown,
            totalGameRounds,
            payment: paymentData?.formatted
        });
    } else if (nextScene.type === 'warning') {
        const horizon = config.experimentLoader?.gameConfig?.horizon || config.horizon;
        const currentTrial = room.trial || 1;

        const didMiss = (triggerType === 'miss');
        const flag = -1;

        let probArray = [0.9, 0.1];
        if (config.experimentLoader && config.experimentLoader.gameConfig.reward_system?.type === 'probabilistic') {
            probArray = config.experimentLoader.getEnvironmentProbs('static');
        }
        const prob_means_current = probArray.map(prob => prob);

        sceneData = {
            gameRound: currentGameRound,
            trial: currentTrial,
            horizon: horizon,
            n: room.n,
            didMiss: didMiss,
            flag: flag,
            prob_means: prob_means_current
        };

        logger.info('Preparing warning scene', {
            didMiss,
            triggerType,
            trial: currentTrial
        });
    } else if (nextScene.type === 'waiting') {
        const maxWaitingTime = config.experimentLoader?.gameConfig?.max_lobby_wait_time || 120000;
        const maxGroupSize = config.experimentLoader?.gameConfig?.max_group_size || 4;

        sceneData = {
            restTime: room.restTime || maxWaitingTime,
            maxWaitingTime: maxWaitingTime,
            maxGroupSize: maxGroupSize,
            currentGroupSize: room.n,
            horizon: config.experimentLoader?.gameConfig?.horizon || config.horizon,
            waitingBonusRate: config.experimentLoader?.gameConfig?.payment?.waiting_bonus_per_minute || 10,
            roomReady: room.readyToStart || false
        };

        logger.info('Preparing waiting room scene', {
            restTime: sceneData.restTime,
            currentPlayers: room.n,
            maxPlayers: maxGroupSize,
            roomReady: sceneData.roomReady
        });
    } else if (nextScene.type === 'pairing') {
        // Server-initiated pairing for networked experiments
        // Generate pairings ONCE here instead of each client requesting them
        const { generatePairingsForRoom } = require('./handlePairingStart');

        // Handle round progression when coming from network_update scene
        // This implements the round loop: after each round's ostracism/network update,
        // increment gameRound and check if all rounds are complete
        if (currentSceneConfig?.type === 'network_update') {
            // Increment game round after network update (end of round)
            room.gameRound = (room.gameRound || 0) + 1;
            room.turnWithinRound = 1;  // Reset turn counter for new round
            room.currentRoundPartner = {};  // Clear partner assignments

            const totalGameRounds = room.totalGameRounds || config.experimentLoader?.gameConfig?.total_game_rounds || 3;

            logger.info('Round progression after network_update', {
                room: client.room,
                newGameRound: room.gameRound,
                totalGameRounds: totalGameRounds,
                turnWithinRound: room.turnWithinRound
            });

            // Check if all rounds are complete
            if (room.gameRound >= totalGameRounds) {
                // All rounds complete - redirect to questionnaire instead of pairing
                const questionnaireScene = sequence.find(s => s.type === 'questionnaire');

                if (questionnaireScene) {
                    logger.info('All rounds complete, transitioning to questionnaire', {
                        room: client.room,
                        completedRounds: room.gameRound,
                        totalGameRounds: totalGameRounds
                    });

                    // Emit questionnaire scene to all players
                    io.to(client.room).emit('start_scene', {
                        scene: questionnaireScene.scene,
                        sceneConfig: questionnaireScene,
                        sceneData: {
                            gameRound: room.gameRound,
                            totalRounds: totalGameRounds,
                            experimentComplete: true
                        },
                        roomId: client.room
                    });

                    if (config.roomStatus[client.room]) {
                        config.roomStatus[client.room].currentScene = questionnaireScene.scene;
                    }

                    return; // Skip pairing - experiment complete
                }
            }
        }

        const roundNumber = room.gameRound !== undefined ? room.gameRound + 1 : (nextScene.params?.roundNumber || 1);
        const totalRounds = room.totalGameRounds || nextScene.params?.totalRounds || 3;

        logger.info('Server-initiated pairing generation', {
            room: client.room,
            roundNumber,
            totalRounds,
            playerCount: room.n
        });

        // Generate pairings (without emitting events - we'll send data with start_scene)
        const pairingResult = await generatePairingsForRoom(room, roundNumber, null);

        if (!pairingResult.success) {
            if (pairingResult.alreadyProcessed) {
                logger.debug('Pairing already processed for this round', {
                    room: client.room,
                    roundNumber
                });
            } else {
                logger.error('Failed to generate pairings', {
                    room: client.room,
                    roundNumber,
                    error: pairingResult.error
                });
                io.to(client.room).emit('error', {
                    message: 'Failed to generate pairings',
                    details: pairingResult.error
                });
                return;
            }
        }

        // Get all sockets in room for personalized emission
        const sockets = await io.in(client.room).fetchSockets();

        logger.info('Emitting personalized pairing data to each player', {
            room: client.room,
            roundNumber,
            playerCount: sockets.length,
            pairsGenerated: pairingResult.pairs?.length || 0
        });

        // Emit personalized pairing data to EACH player individually
        for (const playerSocket of sockets) {
            // Find this player's index (0-indexed in membersID, supports both string and object formats)
            const playerIndex = findPlayerIndex(room.membersID, playerSocket.subjectID);

            if (playerIndex === -1) {
                logger.warn('Player not found in membersID for pairing', {
                    subjectID: playerSocket.subjectID,
                    membersID: room.membersID.map(m => m?.subjectId || m)
                });
                continue;
            }

            // Get this player's pairing data
            const playerPairingData = pairingResult.playerPairings?.[playerIndex] || {
                roundNumber,
                isUnpaired: true,
                reason: 'No pairing data found'
            };

            // Build personalized sceneData for THIS player
            const turnsPerRound = room.turnsPerRound || config.experimentLoader?.gameConfig?.horizon || 2;
            const personalizedSceneData = {
                roundNumber,
                totalRounds,
                turnsPerRound,
                pairingData: playerPairingData
            };

            // Emit to THIS player only
            playerSocket.emit('start_scene', {
                scene: nextScene.scene,
                sceneConfig: nextScene,
                sceneData: personalizedSceneData,
                roomId: client.room,
                sessionId: playerSocket.sessionId,
                subjectId: playerSocket.subjectID
            });

            logger.debug('Emitted pairing data to player', {
                subjectID: playerSocket.subjectID,
                playerIndex,
                hasPairing: !playerPairingData.isIsolated && !playerPairingData.isUnpaired,
                partnerId: playerPairingData.partnerId
            });
        }

        // Track current scene in room state
        if (config.roomStatus[client.room]) {
            config.roomStatus[client.room].currentScene = nextScene.scene;
        }

        // Early return - skip default broadcast for pairing scene
        return;
    }

    // Broadcast next scene to all players in room
    logger.info('Starting next scene', {
        room: client.room,
        previousScene: sceneKey,
        nextScene: nextScene.scene,
        type: nextScene.type,
        sceneData: sceneData
    });

    logger.debug('Emitting start_scene with sceneData', {
        scene: nextScene.scene,
        sceneData: sceneData,
        room: client.room
    });

    io.to(client.room).emit('start_scene', {
        scene: nextScene.scene,
        sceneConfig: nextScene,
        sceneData: sceneData,
        roomId: client.room,
        sessionId: client.session,
        subjectId: client.subjectID
    });

    // Track current scene in room state for flow control
    if (config.roomStatus[client.room]) {
        config.roomStatus[client.room].currentScene = nextScene.scene;
        logger.debug('Updated room.currentScene', {
            room: client.room,
            currentScene: nextScene.scene
        });
    }
}

module.exports = handleSceneComplete;

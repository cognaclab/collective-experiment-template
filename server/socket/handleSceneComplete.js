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
 * Get next scene from sequence
 * @param {string} currentSceneKey - Current scene identifier
 * @param {Array} sequence - Experiment sequence from YAML
 * @returns {Object|null} Next scene config or null if experiment complete
 */
function getNextScene(currentSceneKey, sequence) {
    // Find current scene in sequence
    const currentScene = sequence.find(s => s.scene === currentSceneKey);

    if (!currentScene) {
        logger.warn('Current scene not found in sequence', { currentSceneKey });
        return null;
    }

    // Get next scene identifier
    const nextSceneId = currentScene.next;

    if (!nextSceneId) {
        logger.info('No next scene - experiment complete', { currentSceneKey });
        return null;
    }

    // Find next scene config
    const nextScene = sequence.find(s => s.scene === nextSceneId);

    if (!nextScene) {
        logger.warn('Next scene not found in sequence', {
            currentSceneKey,
            nextSceneId
        });
        return null;
    }

    return nextScene;
}

/**
 * Handle scene completion event
 * @param {Object} client - Socket.io client
 * @param {Object} data - Event data { scene: string, sequence: Array }
 * @param {Object} config - Game configuration
 * @param {Object} io - Socket.io server instance
 */
function handleSceneComplete(client, data, config, io) {
    const room = config.roomStatus[client.room];
    const sceneKey = data.scene;

    if (!room) {
        logger.error('Room not found for scene completion', {
            room: client.room,
            scene: sceneKey
        });
        return;
    }

    // Initialize scene ready counter if not exists
    if (!room.sceneReadyCount) {
        room.sceneReadyCount = {};
    }

    // Increment ready count for this scene
    room.sceneReadyCount[sceneKey] = (room.sceneReadyCount[sceneKey] || 0) + 1;

    logger.debug('Scene completion tracked', {
        room: client.room,
        scene: sceneKey,
        ready: room.sceneReadyCount[sceneKey],
        required: room.n,
        mode: room.indivOrGroup === 1 ? 'group' : 'individual'
    });

    // Check if all players in room are ready
    const allReady = room.sceneReadyCount[sceneKey] >= room.n;

    if (!allReady) {
        logger.debug('Waiting for other players', {
            room: client.room,
            scene: sceneKey,
            ready: room.sceneReadyCount[sceneKey],
            required: room.n
        });
        return; // Wait for other players
    }

    // Reset ready counter for this scene
    room.sceneReadyCount[sceneKey] = 0;

    // Get sequence from experimentLoader (loaded at server startup)
    let sequence;

    if (config.experimentLoader && config.experimentLoader.sequence) {
        sequence = config.experimentLoader.sequence.sequence;
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

    // Handle trial progression - increment AFTER feedback, not after main scene
    if (sceneKey === 'SceneResultFeedback') {
        // Increment trial counter after showing feedback for completed trial
        room.trial = (room.trial || 0) + 1;

        // Reset groupTotalPayoff for next trial and increment pointer (matching legacy behavior)
        const currentPointer = (room.pointer || 1);
        room.pointer = currentPointer + 1;
        const nextPointer = room.pointer - 1;
        room.groupTotalPayoff[nextPointer] = 0;

        // Also reset doneNo for next trial to track readiness
        room.doneNo[nextPointer] = 0;
    }

    // Determine next scene based on trial progression
    let nextScene;
    const currentSceneConfig = sequence.find(s => s.scene === sceneKey);

    if (sceneKey === 'SceneResultFeedback' && currentSceneConfig) {
        // After feedback, check if we should loop back to SceneMain or proceed
        const gameScene = sequence.find(s => s.scene === 'SceneMain');
        const horizon = config.experimentLoader?.gameConfig?.horizon || config.horizon;

        if (room.trial <= horizon) {
            // Continue to next trial
            nextScene = gameScene;
        } else {
            // All trials completed, find the scene that should come after the game loop
            const questionnaireScene = sequence.find(s => s.type === 'questionnaire');
            nextScene = questionnaireScene || getNextScene(sceneKey, sequence);
        }
    } else {
        nextScene = getNextScene(sceneKey, sequence);
    }

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
        logger.info('Scene redirecting to page', {
            room: client.room,
            scene: nextScene.scene,
            redirect: nextScene.redirect
        });

        io.to(client.room).emit('redirect', {
            url: nextScene.redirect,
            scene: nextScene.scene
        });
        return;
    }

    // For game-type scenes, initialize parameters if not already done
    if (nextScene.type === 'game' && !room.parametersInitialized) {
        logger.info('Initializing experiment parameters for game scene', {
            room: client.room,
            scene: nextScene.scene
        });

        // Get environment probabilities from config
        const numOptions = config.experimentLoader?.gameConfig?.k_armed_bandit || config.numOptions;
        const horizon = config.experimentLoader?.gameConfig?.horizon || config.horizon;
        const envKey = nextScene.environment || 'static';

        // Build prob_means array from environment probabilities
        let prob_means;
        if (config.experimentLoader) {
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
            } catch (error) {
                logger.error('Failed to get environment probabilities', {
                    envKey,
                    error: error.message
                });
                throw error;
            }
        } else {
            // Fallback to legacy config format
            prob_means = [config.prob_0, config.prob_1, config.prob_2, config.prob_3, config.prob_4].slice(0, numOptions);
            logger.info('Using legacy prob_means', { prob_means });
        }

        // Build vals array (payoff values - typically 100 for all options)
        const vals = Array(numOptions).fill(null).map(() => Array(horizon).fill(100));

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
            horizon: horizon
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

        sceneData = {
            gameRound: currentGameRound,
            totalPointsAllRounds: totalPointsAllRounds,
            roundBreakdown: roundBreakdown,
            totalGameRounds: totalGameRounds,
            optionOrder: room.optionOrder || [1, 2, 3],
            horizon: horizon,
            n: room.n,
            prob_means: prob_means_summary
        };

        logger.info('Preparing questionnaire with summary data', {
            totalPointsAllRounds,
            roundBreakdown,
            totalGameRounds
        });
    }

    // Broadcast next scene to all players in room
    logger.info('Starting next scene', {
        room: client.room,
        previousScene: sceneKey,
        nextScene: nextScene.scene,
        type: nextScene.type
    });

    io.to(client.room).emit('start_scene', {
        scene: nextScene.scene,
        sceneConfig: nextScene,
        sceneData: sceneData
    });
}

module.exports = handleSceneComplete;

/**
 * IndividualStrategy
 * Strategy for individual (solo) experiments
 *
 * Characteristics:
 * - No waiting for other players
 * - Each participant gets their own room
 * - Start immediately upon connection
 * - No multiplayer UI elements
 * - Collective payoff = individual payoff
 */

const ExperimentStrategy = require('./ExperimentStrategy');
const logger = require('../utils/logger');

class IndividualStrategy extends ExperimentStrategy {
    /**
     * Never wait for players in individual mode
     */
    shouldWaitForPlayers(room, config) {
        return false;
    }

    /**
     * Handle player ready - start game immediately for individual player
     */
    handlePlayerReady(room, client, config, io) {
        // In individual mode, each player gets their own room
        // Game starts immediately without waiting
        logger.debug('Individual player ready', {
            room: room.name,
            subjectID: client.subjectID
        });

        // Player is ready to start (no waiting needed)
        return {
            action: 'start_immediately',
            message: 'Starting individual experiment'
        };
    }

    /**
     * Don't show multiplayer UI in individual mode
     */
    shouldShowMultiplayerUI() {
        return false;
    }

    /**
     * Individual mode requires exactly 1 player
     */
    getMinimumPlayers(config) {
        return 1;
    }

    /**
     * Individual mode allows exactly 1 player per room
     */
    getMaximumPlayers(config) {
        return 1;
    }

    /**
     * Always create a new room for each player in individual mode
     */
    shouldCreateNewRoom(room, config) {
        // If current room has 1 player, create new room for next player
        return room.n >= 1;
    }

    /**
     * Handle disconnect in individual mode
     * Since there's only one player, end the session
     */
    handlePlayerDisconnect(room, client, config, io) {
        logger.info('Individual player disconnected', {
            room: room.name,
            subjectID: client.subjectID
        });

        return {
            action: 'end',
            reason: 'solo_player_disconnected'
        };
    }

    /**
     * For individual mode, collective payoff is just the individual payoff
     */
    calculateCollectivePayoff(playerPayoffs, config) {
        // In individual mode, there's only one player
        return playerPayoffs[0] || 0;
    }

    /**
     * Never start waiting timer in individual mode
     */
    shouldStartWaitingTimer(room, config) {
        return false;
    }

    /**
     * Get strategy name
     */
    getStrategyName() {
        return 'individual';
    }

    /**
     * Check if room is ready to start (has minimum players)
     */
    isRoomReady(room, config) {
        return room.n >= 1;
    }

    /**
     * Check if room is full
     */
    isRoomFull(room, config) {
        return room.n >= 1;
    }

    /**
     * Get UI configuration for clients
     */
    getClientConfig(room, config) {
        return {
            showMultiplayerUI: false,
            showWaitingRoom: false,
            showGroupSize: false,
            showOtherPlayers: false,
            mode: 'individual',
            minPlayers: 1,
            maxPlayers: 1
        };
    }
}

module.exports = IndividualStrategy;

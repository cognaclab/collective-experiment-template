/**
 * MultiplayerStrategy
 * Strategy for multiplayer (group) experiments
 *
 * Characteristics:
 * - Wait for minimum number of players
 * - Players share a room
 * - Show waiting room UI
 * - Show multiplayer UI elements (group size, other players, etc.)
 * - Collective payoff = sum or average of player payoffs
 */

const ExperimentStrategy = require('./ExperimentStrategy');
const logger = require('../utils/logger');

class MultiplayerStrategy extends ExperimentStrategy {
    /**
     * Wait for players if below minimum group size
     */
    shouldWaitForPlayers(room, config) {
        return room.n < config.min_group_size;
    }

    /**
     * Handle player ready - add to waiting room or start if enough players
     */
    handlePlayerReady(room, client, config, io) {
        logger.debug('Multiplayer player ready', {
            room: room.name,
            subjectID: client.subjectID,
            currentPlayers: room.n,
            minPlayers: config.min_group_size,
            maxPlayers: config.max_group_size
        });

        if (room.n < config.min_group_size) {
            // Not enough players yet - wait
            return {
                action: 'wait',
                message: `Waiting for ${config.min_group_size - room.n} more player(s)`,
                playersNeeded: config.min_group_size - room.n
            };
        } else {
            // Enough players - can start
            return {
                action: 'ready_to_start',
                message: 'Enough players ready - starting soon',
                playersReady: room.n
            };
        }
    }

    /**
     * Show multiplayer UI in group mode
     */
    shouldShowMultiplayerUI() {
        return true;
    }

    /**
     * Get minimum players from config
     */
    getMinimumPlayers(config) {
        return config.min_group_size;
    }

    /**
     * Get maximum players from config
     */
    getMaximumPlayers(config) {
        return config.max_group_size;
    }

    /**
     * Create new room when current room reaches max size
     */
    shouldCreateNewRoom(room, config) {
        return room.n >= config.max_group_size;
    }

    /**
     * Handle disconnect in multiplayer mode
     * Depends on how many players remain and game state
     */
    handlePlayerDisconnect(room, client, config, io) {
        logger.info('Multiplayer player disconnected', {
            room: room.name,
            subjectID: client.subjectID,
            remainingPlayers: room.n,
            minRequired: config.min_group_size
        });

        if (room.n < config.min_group_size) {
            // Below minimum - may need to end or wait
            if (room.stage === 'playing' || room.trial > 1) {
                // Game already started - continue if any players remain
                return {
                    action: room.n > 0 ? 'continue' : 'end',
                    reason: 'below_minimum_during_game',
                    notify_players: true
                };
            } else {
                // Game hasn't started - just wait for more players
                return {
                    action: 'wait',
                    reason: 'below_minimum_before_start'
                };
            }
        } else {
            // Still above minimum - continue normally
            return {
                action: 'continue',
                reason: 'above_minimum_threshold'
            };
        }
    }

    /**
     * Calculate collective payoff as sum of all player payoffs
     * Can be modified to use average or other aggregation methods
     */
    calculateCollectivePayoff(playerPayoffs, config) {
        // Sum all player payoffs
        return playerPayoffs.reduce((sum, payoff) => sum + payoff, 0);
    }

    /**
     * Start waiting timer when at least one player joins
     */
    shouldStartWaitingTimer(room, config) {
        return room.n > 0 && room.n < config.max_group_size;
    }

    /**
     * Get strategy name
     */
    getStrategyName() {
        return 'multiplayer';
    }

    /**
     * Check if room is ready to start (has minimum players)
     */
    isRoomReady(room, config) {
        return room.n >= config.min_group_size;
    }

    /**
     * Check if room is full
     */
    isRoomFull(room, config) {
        return room.n >= config.max_group_size;
    }

    /**
     * Get UI configuration for clients
     */
    getClientConfig(room, config) {
        return {
            showMultiplayerUI: true,
            showWaitingRoom: room.n < config.min_group_size,
            showGroupSize: true,
            showOtherPlayers: true,
            mode: 'multiplayer',
            minPlayers: config.min_group_size,
            maxPlayers: config.max_group_size,
            currentPlayers: room.n
        };
    }

    /**
     * Determine if we should broadcast to all players in room
     * (vs individual messages)
     */
    shouldBroadcastToRoom() {
        return true;
    }
}

module.exports = MultiplayerStrategy;

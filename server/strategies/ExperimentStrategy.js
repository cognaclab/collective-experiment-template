/**
 * Base ExperimentStrategy Class
 * Defines the interface that all experiment strategies must implement
 *
 * This uses the Strategy Pattern to encapsulate different experiment behaviors
 * (individual vs multiplayer) into interchangeable strategy classes.
 */

class ExperimentStrategy {
    /**
     * Determine if the system should wait for more players before starting
     * @param {Object} room - The room object
     * @param {Object} config - Game configuration
     * @returns {boolean} - True if should wait, false if should start immediately
     */
    shouldWaitForPlayers(room, config) {
        throw new Error('ExperimentStrategy.shouldWaitForPlayers() must be implemented by subclass');
    }

    /**
     * Handle when a player is ready to start
     * @param {Object} room - The room object
     * @param {Object} client - The socket client
     * @param {Object} config - Game configuration
     * @param {Object} io - Socket.io instance
     * @returns {void}
     */
    handlePlayerReady(room, client, config, io) {
        throw new Error('ExperimentStrategy.handlePlayerReady() must be implemented by subclass');
    }

    /**
     * Determine if multiplayer UI elements should be shown to clients
     * @returns {boolean} - True if should show multiplayer UI, false otherwise
     */
    shouldShowMultiplayerUI() {
        throw new Error('ExperimentStrategy.shouldShowMultiplayerUI() must be implemented by subclass');
    }

    /**
     * Get the minimum number of players required to start
     * @param {Object} config - Game configuration
     * @returns {number} - Minimum players needed
     */
    getMinimumPlayers(config) {
        throw new Error('ExperimentStrategy.getMinimumPlayers() must be implemented by subclass');
    }

    /**
     * Get the maximum number of players allowed in a room
     * @param {Object} config - Game configuration
     * @returns {number} - Maximum players allowed
     */
    getMaximumPlayers(config) {
        throw new Error('ExperimentStrategy.getMaximumPlayers() must be implemented by subclass');
    }

    /**
     * Determine if a new room should be created when current room is full
     * @param {Object} room - The room object
     * @param {Object} config - Game configuration
     * @returns {boolean} - True if should create new room, false otherwise
     */
    shouldCreateNewRoom(room, config) {
        throw new Error('ExperimentStrategy.shouldCreateNewRoom() must be implemented by subclass');
    }

    /**
     * Handle player disconnect
     * @param {Object} room - The room object
     * @param {Object} client - The socket client
     * @param {Object} config - Game configuration
     * @param {Object} io - Socket.io instance
     * @returns {Object} - Action to take (e.g., { action: 'continue' | 'end' | 'wait' })
     */
    handlePlayerDisconnect(room, client, config, io) {
        throw new Error('ExperimentStrategy.handlePlayerDisconnect() must be implemented by subclass');
    }

    /**
     * Calculate how collective payoff should be computed
     * @param {Array} playerPayoffs - Array of individual player payoffs
     * @param {Object} config - Game configuration
     * @returns {number} - Collective payoff value
     */
    calculateCollectivePayoff(playerPayoffs, config) {
        throw new Error('ExperimentStrategy.calculateCollectivePayoff() must be implemented by subclass');
    }

    /**
     * Determine if the waiting room timer should be started
     * @param {Object} room - The room object
     * @param {Object} config - Game configuration
     * @returns {boolean} - True if should start timer, false otherwise
     */
    shouldStartWaitingTimer(room, config) {
        throw new Error('ExperimentStrategy.shouldStartWaitingTimer() must be implemented by subclass');
    }

    /**
     * Get strategy type name
     * @returns {string} - Strategy name (e.g., 'individual', 'multiplayer')
     */
    getStrategyName() {
        throw new Error('ExperimentStrategy.getStrategyName() must be implemented by subclass');
    }
}

module.exports = ExperimentStrategy;

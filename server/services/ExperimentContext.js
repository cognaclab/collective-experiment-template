/**
 * ExperimentContext
 * Manages the current experiment's state and strategy
 *
 * This class acts as the "Context" in the Strategy Pattern, holding
 * a reference to the current strategy and delegating strategy-specific
 * operations to it.
 */

const IndividualStrategy = require('../strategies/IndividualStrategy');
const MultiplayerStrategy = require('../strategies/MultiplayerStrategy');
const logger = require('../utils/logger');

class ExperimentContext {
    constructor(experimentLoader) {
        if (!experimentLoader || !experimentLoader.gameConfig) {
            throw new Error('ExperimentContext requires a loaded ExperimentLoader');
        }

        this.loader = experimentLoader;
        this.config = experimentLoader.gameConfig;
        this.strategy = this.selectStrategy();

        logger.info('Experiment context initialized', {
            mode: this.config.mode,
            strategy: this.strategy.getStrategyName(),
            experiment: experimentLoader.getMetadata().name
        });
    }

    /**
     * Select the appropriate strategy based on experiment mode
     */
    selectStrategy() {
        if (this.config.mode === 'individual') {
            return new IndividualStrategy();
        } else if (this.config.mode === 'group') {
            return new MultiplayerStrategy();
        } else {
            throw new Error(`Unknown experiment mode: ${this.config.mode}. Must be 'individual' or 'group'`);
        }
    }

    /**
     * Change strategy at runtime (if needed)
     */
    setStrategy(strategy) {
        this.strategy = strategy;
        logger.info('Strategy changed', {
            newStrategy: strategy.getStrategyName()
        });
    }

    // ===== Delegate methods to strategy =====

    shouldWaitForPlayers(room) {
        return this.strategy.shouldWaitForPlayers(room, this.config);
    }

    handlePlayerReady(room, client, io) {
        return this.strategy.handlePlayerReady(room, client, this.config, io);
    }

    shouldShowMultiplayerUI() {
        return this.strategy.shouldShowMultiplayerUI();
    }

    getMinimumPlayers() {
        return this.strategy.getMinimumPlayers(this.config);
    }

    getMaximumPlayers() {
        return this.strategy.getMaximumPlayers(this.config);
    }

    shouldCreateNewRoom(room) {
        return this.strategy.shouldCreateNewRoom(room, this.config);
    }

    handlePlayerDisconnect(room, client, io) {
        return this.strategy.handlePlayerDisconnect(room, client, this.config, io);
    }

    calculateCollectivePayoff(playerPayoffs) {
        return this.strategy.calculateCollectivePayoff(playerPayoffs, this.config);
    }

    shouldStartWaitingTimer(room) {
        return this.strategy.shouldStartWaitingTimer(room, this.config);
    }

    isRoomReady(room) {
        return this.strategy.isRoomReady(room, this.config);
    }

    isRoomFull(room) {
        return this.strategy.isRoomFull(room, this.config);
    }

    getClientConfig(room) {
        return this.strategy.getClientConfig(room, this.config);
    }

    // ===== Context-specific methods =====

    /**
     * Get the current strategy name
     */
    getStrategyName() {
        return this.strategy.getStrategyName();
    }

    /**
     * Get the full game configuration
     */
    getGameConfig() {
        return this.config;
    }

    /**
     * Get experiment metadata
     */
    getMetadata() {
        return this.loader.getMetadata();
    }

    /**
     * Check if experiment is individual mode
     */
    isIndividual() {
        return this.loader.isIndividual();
    }

    /**
     * Check if experiment is multiplayer mode
     */
    isMultiplayer() {
        return this.loader.isMultiplayer();
    }

    /**
     * Get environment probabilities
     */
    getEnvironmentProbs(envName) {
        return this.loader.getEnvironmentProbs(envName);
    }

    /**
     * Get all environment names
     */
    getEnvironmentNames() {
        return this.loader.getEnvironmentNames();
    }
}

module.exports = ExperimentContext;

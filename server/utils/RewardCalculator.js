/**
 * RewardCalculator
 *
 * Generic reward/payoff calculation system supporting multiple game types:
 * - payoff_matrix: Strategic games (Prisoner's Dilemma, coordination games, etc.)
 * - probabilistic: Multi-armed bandit tasks with probability distributions
 * - deterministic: Fixed rewards per choice
 * - function: Custom reward functions (future extension)
 */

const logger = require('./logger');

class RewardCalculator {
    constructor(config) {
        this.config = config;
        this.type = config.reward_system?.type || 'probabilistic';
        this.validateConfig();
    }

    /**
     * Main entry point for reward calculation
     * Routes to appropriate calculation method based on reward type
     *
     * @param {Array} choices - Array of player choices [choice1, choice2, ...]
     * @param {Object} context - Additional context (trial number, environment, etc.)
     * @returns {Array|Number} Payoffs for each player or single payoff for individual
     */
    calculateReward(choices, context = {}) {
        try {
            switch (this.type) {
                case 'payoff_matrix':
                    return this.calculateMatrixPayoff(choices, context);

                case 'probabilistic':
                    return this.calculateProbabilisticReward(choices, context);

                case 'deterministic':
                    return this.calculateDeterministicReward(choices, context);

                case 'function':
                    return this.calculateFunctionReward(choices, context);

                default:
                    logger.error(`Unknown reward type: ${this.type}`);
                    return Array.isArray(choices) ? choices.map(() => 0) : 0;
            }
        } catch (error) {
            logger.error('Error calculating reward:', { error: error.message, choices, context });
            return Array.isArray(choices) ? choices.map(() => 0) : 0;
        }
    }

    /**
     * Calculate payoffs for matrix games (N-player strategic interactions)
     * Works for any number of players based on matrix dimensions
     *
     * @param {Array} choices - Array of player choices [choice1, choice2, ...]
     * @param {Object} context - Additional context
     * @returns {Array} Array of payoffs for each player [payoff1, payoff2, ...]
     */
    calculateMatrixPayoff(choices, context = {}) {
        const payoffs = this.config.reward_system.payoffs;

        if (!payoffs) {
            logger.error('No payoffs defined in reward_system config');
            return choices.map(() => 0);
        }

        // Construct lookup key from choices array
        const choiceKey = JSON.stringify(choices);
        const payoffArray = payoffs[choiceKey];

        if (!payoffArray) {
            logger.warn(`No payoff found for choice combination: ${choiceKey}`);
            return choices.map(() => 0);
        }

        if (payoffArray.length !== choices.length) {
            logger.error(`Payoff array length (${payoffArray.length}) does not match number of players (${choices.length})`);
            return choices.map(() => 0);
        }

        logger.debug('Matrix payoff calculated:', { choices, payoffs: payoffArray });
        return payoffArray;
    }

    /**
     * Calculate probabilistic rewards for bandit tasks
     * Each choice has a probability of returning reward
     *
     * @param {Array|Number} choices - Single choice or array of choices
     * @param {Object} context - Must contain environment type and probabilities
     * @returns {Array|Number} Reward(s) based on probability (0 or 1)
     */
    calculateProbabilisticReward(choices, context = {}) {
        const probabilities = this.getProbabilities(context);

        if (!probabilities) {
            logger.error('No probabilities found for probabilistic reward');
            return Array.isArray(choices) ? choices.map(() => 0) : 0;
        }

        // Handle single choice (individual task)
        if (typeof choices === 'number') {
            const prob = probabilities[choices];
            if (prob === undefined) {
                logger.warn(`No probability defined for choice ${choices}`);
                return 0;
            }
            const reward = Math.random() < prob ? 1 : 0;
            logger.debug('Probabilistic reward calculated:', { choice: choices, probability: prob, reward });
            return reward;
        }

        // Handle multiple choices (group task with independent rewards)
        if (Array.isArray(choices)) {
            return choices.map(choice => {
                const prob = probabilities[choice];
                if (prob === undefined) {
                    logger.warn(`No probability defined for choice ${choice}`);
                    return 0;
                }
                return Math.random() < prob ? 1 : 0;
            });
        }

        logger.error('Invalid choices format for probabilistic reward:', choices);
        return 0;
    }

    /**
     * Calculate deterministic rewards
     * Each choice always returns a fixed reward value
     *
     * @param {Array|Number} choices - Single choice or array of choices
     * @param {Object} context - Additional context
     * @returns {Array|Number} Fixed reward(s)
     */
    calculateDeterministicReward(choices, context = {}) {
        const rewards = this.config.reward_system.rewards;

        if (!rewards) {
            logger.error('No rewards defined in reward_system config');
            return Array.isArray(choices) ? choices.map(() => 0) : 0;
        }

        // Handle single choice
        if (typeof choices === 'number') {
            const reward = rewards[choices];
            if (reward === undefined) {
                logger.warn(`No reward defined for choice ${choices}`);
                return 0;
            }
            logger.debug('Deterministic reward calculated:', { choice: choices, reward });
            return reward;
        }

        // Handle multiple choices
        if (Array.isArray(choices)) {
            return choices.map(choice => {
                const reward = rewards[choice];
                if (reward === undefined) {
                    logger.warn(`No reward defined for choice ${choice}`);
                    return 0;
                }
                return reward;
            });
        }

        logger.error('Invalid choices format for deterministic reward:', choices);
        return 0;
    }

    /**
     * Calculate rewards using custom function
     * Placeholder for future custom reward function support
     *
     * @param {Array|Number} choices - Single choice or array of choices
     * @param {Object} context - Additional context for function evaluation
     * @returns {Array|Number} Calculated reward(s)
     */
    calculateFunctionReward(choices, context = {}) {
        logger.warn('Function-based rewards not yet implemented');
        return Array.isArray(choices) ? choices.map(() => 0) : 0;
    }

    /**
     * Get probabilities for current context
     * Supports both static and dynamic environments
     *
     * @param {Object} context - Must contain environment type
     * @returns {Array} Probability array
     */
    getProbabilities(context) {
        const envType = context.environment || context.taskType || 'static';
        const environments = this.config.environments;

        if (!environments || !environments[envType]) {
            logger.error(`No environment defined for type: ${envType}`);
            return null;
        }

        return environments[envType].probabilities;
    }

    /**
     * Validate reward_system configuration at load time
     * Ensures required fields are present for each reward type
     */
    validateConfig() {
        const rewardSystem = this.config.reward_system;

        // If no reward_system specified, check for legacy environments (backward compatibility)
        if (!rewardSystem) {
            if (this.config.environments) {
                logger.info('Using legacy environments config for probabilistic rewards');
                this.type = 'probabilistic';
                return;
            }
            logger.error('No reward_system or environments config found');
            throw new Error('Reward system configuration missing');
        }

        // Validate based on type
        switch (this.type) {
            case 'payoff_matrix':
                if (!rewardSystem.payoffs) {
                    throw new Error('payoff_matrix type requires "payoffs" field');
                }
                if (typeof rewardSystem.payoffs !== 'object') {
                    throw new Error('payoffs must be an object mapping choice combinations to payoff arrays');
                }
                this.validateMatrixPayoffs(rewardSystem.payoffs);
                break;

            case 'probabilistic':
                if (!this.config.environments) {
                    throw new Error('probabilistic type requires "environments" field in config');
                }
                break;

            case 'deterministic':
                if (!rewardSystem.rewards) {
                    throw new Error('deterministic type requires "rewards" field');
                }
                if (!Array.isArray(rewardSystem.rewards)) {
                    throw new Error('rewards must be an array of fixed reward values');
                }
                break;

            case 'function':
                logger.warn('Function-based rewards not yet fully implemented');
                break;

            default:
                throw new Error(`Unknown reward type: ${this.type}`);
        }

        logger.info('Reward system config validated:', { type: this.type });
    }

    /**
     * Validate that payoff matrix is properly structured
     * Checks that all choice combinations have matching payoff array lengths
     *
     * @param {Object} payoffs - Payoff matrix object
     */
    validateMatrixPayoffs(payoffs) {
        const entries = Object.entries(payoffs);

        if (entries.length === 0) {
            throw new Error('Payoff matrix is empty');
        }

        let numPlayers = null;

        for (const [choiceKey, payoffArray] of entries) {
            try {
                const choices = JSON.parse(choiceKey);

                if (!Array.isArray(choices)) {
                    throw new Error(`Invalid choice key format: ${choiceKey} (must be JSON array)`);
                }

                if (!Array.isArray(payoffArray)) {
                    throw new Error(`Payoffs for ${choiceKey} must be an array`);
                }

                if (choices.length !== payoffArray.length) {
                    throw new Error(`Choice combination ${choiceKey} has ${choices.length} players but ${payoffArray.length} payoffs`);
                }

                // Verify consistent number of players across all entries
                if (numPlayers === null) {
                    numPlayers = choices.length;
                } else if (choices.length !== numPlayers) {
                    throw new Error(`Inconsistent number of players: expected ${numPlayers}, got ${choices.length} for ${choiceKey}`);
                }

            } catch (error) {
                throw new Error(`Invalid payoff matrix entry: ${error.message}`);
            }
        }

        logger.info(`Payoff matrix validated: ${numPlayers} players, ${entries.length} choice combinations`);
    }
}

module.exports = RewardCalculator;

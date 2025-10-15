/**
 * ExperimentLoader Service
 * Loads experiment configuration from YAML files and provides structured config to the game server
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../utils/logger');

class ExperimentLoader {
    constructor(experimentPath = null) {
        // Default to 'deployed' directory or use environment variable
        this.experimentPath = experimentPath ||
                              process.env.EXPERIMENT_PATH ||
                              path.join(__dirname, '../../deployed');

        this.config = null;
        this.gameConfig = null;
    }

    /**
     * Load experiment configuration from config.yaml
     */
    loadConfig() {
        try {
            const configPath = path.join(this.experimentPath, 'config.yaml');

            if (!fs.existsSync(configPath)) {
                throw new Error(`Config file not found at: ${configPath}`);
            }

            const configContent = fs.readFileSync(configPath, 'utf8');
            this.config = yaml.load(configContent);

            // Validate required fields
            this.validateConfig();

            // Build game configuration object
            this.gameConfig = this.buildGameConfig();

            logger.info('Experiment configuration loaded successfully', {
                name: this.config.experiment.name,
                mode: this.getMode(),
                horizon: this.gameConfig.horizon,
                numOptions: this.gameConfig.k_armed_bandit,
                groupSize: `${this.gameConfig.min_group_size}-${this.gameConfig.max_group_size}`
            });

            return this.config;
        } catch (error) {
            logger.error('Failed to load experiment configuration', {
                path: this.experimentPath,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Validate that config has all required fields
     */
    validateConfig() {
        const required = [
            'experiment',
            'game',
            'groups',
            'conditions',
            'environments'
        ];

        for (const field of required) {
            if (!this.config[field]) {
                throw new Error(`Missing required config field: ${field}`);
            }
        }

        // Validate game fields
        const gameRequired = ['horizon', 'k_armed_bandit', 'max_choice_time', 'max_waiting_time'];
        for (const field of gameRequired) {
            if (this.config.game[field] === undefined) {
                throw new Error(`Missing required game config field: ${field}`);
            }
        }
    }

    /**
     * Build structured game configuration from loaded config
     */
    buildGameConfig() {
        return {
            // Basic game settings
            horizon: this.config.game.horizon,
            total_game_rounds: this.config.game.total_game_rounds || 1,
            k_armed_bandit: this.config.game.k_armed_bandit,
            max_choice_time: this.config.game.max_choice_time,
            max_waiting_time: this.config.game.max_waiting_time,

            // Group settings
            max_group_size: this.config.groups.max_group_size,
            min_group_size: this.config.groups.min_group_size,

            // Experiment conditions
            mode: this.config.conditions.indivOrGroup, // 'individual' | 'group'
            task_type: this.config.conditions.taskType, // 'static' | 'dynamic'
            exp_condition: this.config.conditions.exp_condition,

            // Environments (bandit probabilities)
            environments: this.config.environments,

            // Payment settings
            payment: this.config.payment || {
                flat_fee: 2.0,
                completion_fee: 0
            },

            // Debug settings
            debug_exceptions: this.config.debug?.subject_exceptions || []
        };
    }

    /**
     * Check if experiment is individual mode
     */
    isIndividual() {
        return this.gameConfig.mode === 'individual';
    }

    /**
     * Check if experiment is multiplayer mode
     */
    isMultiplayer() {
        return this.gameConfig.mode === 'group';
    }

    /**
     * Get experiment mode
     */
    getMode() {
        return this.gameConfig.mode;
    }

    /**
     * Get number of bandit arms
     */
    getNumOptions() {
        return this.gameConfig.k_armed_bandit;
    }

    /**
     * Get environment probabilities for a specific environment
     */
    getEnvironmentProbs(envName) {
        const env = this.config.environments[envName];
        if (!env) {
            throw new Error(`Environment not found: ${envName}`);
        }
        return env;
    }

    /**
     * Get all environment names
     */
    getEnvironmentNames() {
        return Object.keys(this.config.environments);
    }

    /**
     * Get experiment metadata
     */
    getMetadata() {
        return {
            name: this.config.experiment.name,
            description: this.config.experiment.description,
            author: this.config.experiment.author
        };
    }
}

module.exports = ExperimentLoader;

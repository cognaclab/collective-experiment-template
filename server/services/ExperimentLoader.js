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
        // Default to 'generated' directory or use environment variable
        this.experimentPath = experimentPath ||
                              process.env.EXPERIMENT_PATH ||
                              path.join(__dirname, '../../client/public/src/generated');

        this.config = null;
        this.gameConfig = null;
        this.sequence = null;
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

        // Validate conditions.indivOrGroup
        if (!this.config.conditions.indivOrGroup) {
            throw new Error(
                `\n❌ EXPERIMENT CONFIGURATION ERROR\n\n` +
                `Missing required field: conditions.indivOrGroup\n` +
                `  This field specifies whether the experiment is individual or group-based\n` +
                `  Allowed values: 'individual' or 'group'\n` +
                `  Example:\n` +
                `    conditions:\n` +
                `      indivOrGroup: individual\n\n` +
                `Location: config.yaml\n` +
                `Section: conditions`
            );
        }

        const validModes = ['individual', 'group'];
        if (!validModes.includes(this.config.conditions.indivOrGroup)) {
            throw new Error(
                `\n❌ EXPERIMENT CONFIGURATION ERROR\n\n` +
                `Invalid value for conditions.indivOrGroup: '${this.config.conditions.indivOrGroup}'\n` +
                `  Allowed values: 'individual' or 'group'\n` +
                `  Got: '${this.config.conditions.indivOrGroup}'\n` +
                `  Fix: Set to either 'individual' or 'group'\n\n` +
                `Location: config.yaml\n` +
                `Section: conditions.indivOrGroup`
            );
        }

        // Validate environment probabilities
        this.validateEnvironmentProbabilities();
    }

    /**
     * Validate environment probability configurations
     * Checks that probability arrays match the number of machines (k_armed_bandit)
     */
    validateEnvironmentProbabilities() {
        const numMachines = this.config.game.k_armed_bandit;
        const environments = this.config.environments;

        if (!environments) {
            throw new Error('No environments defined in configuration');
        }

        for (const [envName, envConfig] of Object.entries(environments)) {
            // Check if using new array format
            if (envConfig.probabilities) {
                if (!Array.isArray(envConfig.probabilities)) {
                    throw new Error(
                        `\n❌ EXPERIMENT CONFIGURATION ERROR\n\n` +
                        `Environment '${envName}': 'probabilities' must be an array!\n` +
                        `  Got: ${typeof envConfig.probabilities}\n` +
                        `  Expected: Array of ${numMachines} probabilities\n` +
                        `  Example: probabilities: [0.9, 0.1]\n\n` +
                        `Location: config.yaml\n` +
                        `Section: environments.${envName}`
                    );
                }

                if (envConfig.probabilities.length !== numMachines) {
                    throw new Error(
                        `\n❌ EXPERIMENT CONFIGURATION ERROR\n\n` +
                        `Environment '${envName}': Probability length mismatch!\n` +
                        `  Expected: ${numMachines} probabilities (k_armed_bandit: ${numMachines})\n` +
                        `  Got: ${envConfig.probabilities.length} probabilities: [${envConfig.probabilities.join(', ')}]\n` +
                        `  Fix: Adjust array length to match k_armed_bandit setting\n\n` +
                        `Location: config.yaml\n` +
                        `Section: environments.${envName}`
                    );
                }

                // Validate each probability is between 0 and 1
                for (let i = 0; i < envConfig.probabilities.length; i++) {
                    const prob = envConfig.probabilities[i];
                    if (typeof prob !== 'number' || prob < 0 || prob > 1) {
                        throw new Error(
                            `\n❌ EXPERIMENT CONFIGURATION ERROR\n\n` +
                            `Environment '${envName}': Invalid probability value!\n` +
                            `  Machine ${i}: ${prob}\n` +
                            `  Probabilities must be numbers between 0 and 1\n` +
                            `  Example: 0.9 means 90% chance of reward\n\n` +
                            `Location: config.yaml\n` +
                            `Section: environments.${envName}.probabilities[${i}]`
                        );
                    }
                }
            }
            // Check if using old prob_0, prob_1 format
            else {
                // Count how many prob_X keys exist
                const probKeys = Object.keys(envConfig).filter(key => key.startsWith('prob_'));

                if (probKeys.length === 0) {
                    throw new Error(
                        `\n❌ EXPERIMENT CONFIGURATION ERROR\n\n` +
                        `Environment '${envName}': No probabilities defined!\n` +
                        `  Please use one of these formats:\n\n` +
                        `  New format (recommended):\n` +
                        `    probabilities: [0.9, 0.1]\n\n` +
                        `  Old format (legacy):\n` +
                        `    prob_0: 0.9\n` +
                        `    prob_1: 0.1\n\n` +
                        `Location: config.yaml\n` +
                        `Section: environments.${envName}`
                    );
                }

                if (probKeys.length !== numMachines) {
                    throw new Error(
                        `\n❌ EXPERIMENT CONFIGURATION ERROR\n\n` +
                        `Environment '${envName}': Probability count mismatch!\n` +
                        `  Expected: ${numMachines} probabilities (k_armed_bandit: ${numMachines})\n` +
                        `  Got: ${probKeys.length} probabilities: ${probKeys.join(', ')}\n` +
                        `  Fix: Add/remove prob_X entries to match k_armed_bandit\n\n` +
                        `  Consider using new format:\n` +
                        `    probabilities: [0.9, 0.1]\n\n` +
                        `Location: config.yaml\n` +
                        `Section: environments.${envName}`
                    );
                }

                // Validate each prob_X value
                for (let i = 0; i < numMachines; i++) {
                    const probKey = `prob_${i}`;
                    const prob = envConfig[probKey];

                    if (prob === undefined) {
                        throw new Error(
                            `\n❌ EXPERIMENT CONFIGURATION ERROR\n\n` +
                            `Environment '${envName}': Missing probability!\n` +
                            `  Missing: ${probKey}\n` +
                            `  Found: ${probKeys.join(', ')}\n` +
                            `  All prob_X keys must be sequential (prob_0, prob_1, ...)\n\n` +
                            `Location: config.yaml\n` +
                            `Section: environments.${envName}`
                        );
                    }

                    if (typeof prob !== 'number' || prob < 0 || prob > 1) {
                        throw new Error(
                            `\n❌ EXPERIMENT CONFIGURATION ERROR\n\n` +
                            `Environment '${envName}': Invalid probability value!\n` +
                            `  ${probKey}: ${prob}\n` +
                            `  Probabilities must be numbers between 0 and 1\n` +
                            `  Example: 0.9 means 90% chance of reward\n\n` +
                            `Location: config.yaml\n` +
                            `Section: environments.${envName}.${probKey}`
                        );
                    }
                }
            }
        }

        logger.info('Environment probability validation passed', {
            environments: Object.keys(environments).length,
            numMachines
        });
    }

    /**
     * Normalize environment probabilities to consistent array format
     * Supports both old (prob_0, prob_1) and new (probabilities: []) formats
     */
    normalizeEnvironmentProbabilities(envConfig) {
        const numMachines = this.config.game.k_armed_bandit;

        // If already using new format, return as-is
        if (envConfig.probabilities) {
            return envConfig.probabilities;
        }

        // Convert old format to array
        const probArray = [];
        for (let i = 0; i < numMachines; i++) {
            probArray.push(envConfig[`prob_${i}`]);
        }

        return probArray;
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
     * Returns normalized array format regardless of config format
     */
    getEnvironmentProbs(envName) {
        const env = this.config.environments[envName];
        if (!env) {
            throw new Error(`Environment not found: ${envName}`);
        }
        return this.normalizeEnvironmentProbabilities(env);
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

    /**
     * Load experiment sequence from sequences/main.yaml
     * This is needed for server-controlled flow
     */
    loadSequence() {
        try {
            const sequencePath = path.join(this.experimentPath, 'sequences', 'main.yaml');

            if (!fs.existsSync(sequencePath)) {
                throw new Error(`Sequence file not found at: ${sequencePath}`);
            }

            const sequenceContent = fs.readFileSync(sequencePath, 'utf8');
            this.sequence = yaml.load(sequenceContent);

            this.validateSequenceConditionalRouting();

            logger.info('Experiment sequence loaded successfully', {
                scenes: this.sequence.sequence ? this.sequence.sequence.length : 0
            });

            return this.sequence;
        } catch (error) {
            logger.error('Failed to load experiment sequence', {
                path: this.experimentPath,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get the sequence array
     */
    getSequence() {
        if (!this.sequence) {
            throw new Error('Sequence not loaded. Call loadSequence() first.');
        }
        return this.sequence.sequence;
    }

    validateSequenceConditionalRouting() {
        if (!this.sequence) {
            throw new Error('Sequence not loaded. Call loadSequence() first.');
        }

        const sequence = this.sequence.sequence;
        const sceneNames = sequence.map(s => s.scene);

        for (const scene of sequence) {
            const conditionalFields = ['next_on_timeout', 'next_on_miss', 'next_on_error'];

            for (const field of conditionalFields) {
                if (scene[field]) {
                    if (!sceneNames.includes(scene[field])) {
                        logger.warn(
                            `Scene '${scene.scene}' references non-existent scene in ${field}: ${scene[field]}`
                        );
                    }
                }
            }
        }

        logger.info('Sequence conditional routing validation passed', {
            scenes: sequence.length
        });
    }
}

module.exports = ExperimentLoader;

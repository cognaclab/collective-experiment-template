const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../utils/logger');

class ContentLoader {
    constructor(experimentName = 'default') {
        this.experimentName = experimentName;
        this.contentPath = path.join(__dirname, '../../content/experiments', experimentName);
        this.config = null;
        this.sequence = null;
    }
    
    async loadConfig() {
        try {
            const configPath = path.join(this.contentPath, 'config.yaml');
            const configContent = fs.readFileSync(configPath, 'utf8');
            this.config = yaml.load(configContent);
            
            logger.info('Experiment config loaded', {
                experiment: this.experimentName,
                config: this.config.experiment
            });
            
            return this.config;
        } catch (error) {
            logger.error('Failed to load experiment config', {
                experiment: this.experimentName,
                error: error.message
            });
            throw error;
        }
    }
    
    async loadSequence() {
        try {
            const sequencePath = path.join(this.contentPath, 'sequences/main.yaml');
            const sequenceContent = fs.readFileSync(sequencePath, 'utf8');
            this.sequence = yaml.load(sequenceContent);
            
            logger.info('Experiment sequence loaded', {
                experiment: this.experimentName,
                scenes: this.sequence.sequence.length
            });
            
            return this.sequence;
        } catch (error) {
            logger.error('Failed to load experiment sequence', {
                experiment: this.experimentName,
                error: error.message
            });
            throw error;
        }
    }
    
    loadInstruction(filename) {
        try {
            const instructionPath = path.join(this.contentPath, 'instructions', filename);
            const content = fs.readFileSync(instructionPath, 'utf8');
            
            logger.debug('Instruction loaded', {
                experiment: this.experimentName,
                file: filename
            });
            
            return content;
        } catch (error) {
            logger.error('Failed to load instruction', {
                experiment: this.experimentName,
                file: filename,
                error: error.message
            });
            throw error;
        }
    }
    
    getGameConfig() {
        if (!this.config) {
            throw new Error('Config not loaded. Call loadConfig() first.');
        }
        
        return {
            horizon: this.config.game.horizon,
            totalGameRounds: this.config.game.total_game_rounds,
            kArmedBandit: this.config.game.k_armed_bandit,
            maxChoiceTime: this.config.game.max_choice_time,
            maxWaitingTime: this.config.game.max_waiting_time,
            maxGroupSize: this.config.groups.max_group_size,
            minGroupSize: this.config.groups.min_group_size,
            environments: this.config.environments,
            taskOrder: this.config.task_order,
            debugExceptions: this.config.debug.subject_exceptions
        };
    }
}

module.exports = ContentLoader;
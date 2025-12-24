/**
 * MFQScoreLoader Service
 *
 * Loads Moral Foundations Questionnaire scores from MongoDB.
 * Used to fetch pre-collected MFQ scores for display in transparent condition.
 */

const MFQScore = require('../database/models/MFQScore');
const logger = require('../utils/logger');

class MFQScoreLoader {
    constructor(config = {}) {
        this.config = config;
        this.fallbackToRandom = config.fallback_to_random !== false;

        // Default thresholds for random score generation
        this.thresholds = config.thresholds || {
            low: [1, 2.5],
            medium: [2.5, 3.5],
            high: [3.5, 5]
        };
    }

    /**
     * Load MFQ scores for multiple subjects at once
     * Used during room formation to load all players' scores
     *
     * @param {string[]} subjectIds - Array of subject IDs to load
     * @returns {Promise<Object>} - Map of subjectId -> { scores, levels }
     */
    async loadScoresForSubjects(subjectIds) {
        const scoresMap = {};

        try {
            // Fetch all scores in one query
            const records = await MFQScore.find({
                subjectId: { $in: subjectIds }
            }).lean();

            // Build map from results
            for (const record of records) {
                scoresMap[record.subjectId] = {
                    scores: record.scores,
                    levels: record.levels
                };
            }

            // Handle missing subjects
            for (const subjectId of subjectIds) {
                if (!scoresMap[subjectId]) {
                    if (this.fallbackToRandom) {
                        logger.warn(`MFQ scores not found for ${subjectId}, generating random scores`);
                        scoresMap[subjectId] = this.generateRandomScores();
                    } else {
                        logger.warn(`MFQ scores not found for ${subjectId}, no fallback enabled`);
                        scoresMap[subjectId] = null;
                    }
                }
            }

            logger.info(`Loaded MFQ scores for ${records.length}/${subjectIds.length} subjects`);

        } catch (error) {
            logger.error('Error loading MFQ scores:', error);

            // If database error and fallback enabled, generate random for all
            if (this.fallbackToRandom) {
                for (const subjectId of subjectIds) {
                    scoresMap[subjectId] = this.generateRandomScores();
                }
            }
        }

        return scoresMap;
    }

    /**
     * Get MFQ scores for a single subject
     *
     * @param {string} subjectId - Subject ID to look up
     * @returns {Promise<Object|null>} - { scores, levels } or null if not found
     */
    async getScores(subjectId) {
        try {
            const record = await MFQScore.findOne({ subjectId }).lean();

            if (record) {
                return {
                    scores: record.scores,
                    levels: record.levels
                };
            }

            if (this.fallbackToRandom) {
                logger.warn(`MFQ scores not found for ${subjectId}, generating random`);
                return this.generateRandomScores();
            }

            return null;

        } catch (error) {
            logger.error(`Error loading MFQ scores for ${subjectId}:`, error);

            if (this.fallbackToRandom) {
                return this.generateRandomScores();
            }

            return null;
        }
    }

    /**
     * Generate random MFQ scores for testing
     * Creates plausible-looking scores with some variation
     *
     * @returns {Object} - { scores, levels }
     */
    generateRandomScores() {
        const categories = ['harm', 'fairness', 'loyalty', 'authority', 'purity'];
        const scores = {};
        const levels = {};

        for (const category of categories) {
            // Generate score between 1.5 and 4.5 (avoiding extremes)
            const score = 1.5 + Math.random() * 3;
            scores[category] = Math.round(score * 10) / 10; // Round to 1 decimal

            // Compute level
            levels[category] = this.scoreToLevel(scores[category]);
        }

        return { scores, levels };
    }

    /**
     * Convert a raw score to a level string
     *
     * @param {number} score - Raw MFQ score
     * @returns {string} - 'low', 'medium', or 'high'
     */
    scoreToLevel(score) {
        const { low, medium, high } = this.thresholds;

        if (score < medium[0]) return 'low';
        if (score < high[0]) return 'medium';
        return 'high';
    }

    /**
     * Check if MFQ scores exist for a subject
     *
     * @param {string} subjectId - Subject ID to check
     * @returns {Promise<boolean>}
     */
    async hasScores(subjectId) {
        try {
            const count = await MFQScore.countDocuments({ subjectId });
            return count > 0;
        } catch (error) {
            logger.error(`Error checking MFQ scores for ${subjectId}:`, error);
            return false;
        }
    }

    /**
     * Get display configuration for MFQ categories
     * Filters based on enabled categories in config
     *
     * @returns {Array} - Array of { id, label, enabled } for each category
     */
    getDisplayCategories() {
        const defaultCategories = [
            { id: 'harm', label: 'Harm/Care', enabled: true },
            { id: 'fairness', label: 'Fairness', enabled: true },
            { id: 'loyalty', label: 'Loyalty', enabled: true },
            { id: 'authority', label: 'Authority', enabled: true },
            { id: 'purity', label: 'Purity', enabled: true }
        ];

        // Use config if available, otherwise defaults
        return this.config.display_categories || defaultCategories;
    }

    /**
     * Get enabled categories only
     *
     * @returns {Array} - Array of enabled category objects
     */
    getEnabledCategories() {
        return this.getDisplayCategories().filter(c => c.enabled);
    }
}

module.exports = MFQScoreLoader;

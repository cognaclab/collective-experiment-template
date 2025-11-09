/**
 * Data Builder Utilities
 *
 * Functions to build flexible trial data structures for the new database schema.
 * Supports any number of options and experiment-specific custom data.
 */

const logger = require('./logger');

/**
 * Build complete trial data for database storage
 * @param {Object} client - Socket client object
 * @param {Object} room - Room object with experiment state
 * @param {Object} choiceData - Choice event data from client
 * @param {Object} config - Experiment configuration
 * @returns {Object} Trial data ready for database
 */
function buildTrialData(client, room, choiceData, config) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS

    const pointer = room.pointer || 0;
    const currentGameRound = room.gameRound || 0;

    // Build base trial data
    const trialData = {
        // ==========================================
        // EXPERIMENT & SESSION IDENTIFICATION
        // ==========================================
        experimentName: config.experimentName || 'unknown',
        experimentVersion: config.version || '1.0',
        sessionId: client.sessionId,
        roomId: room.roomId, // Now set by roomFactory

        // ==========================================
        // PARTICIPANT IDENTIFICATION
        // ==========================================
        subjectId: client.subjectID || client.subjectId, // Try uppercase first (actual property name)
        subjectNumber: client.subjectNumber,

        // ==========================================
        // TEMPORAL DATA
        // ==========================================
        timestamp: now,
        date: dateStr,
        time: timeStr,

        // ==========================================
        // TRIAL/ROUND IDENTIFICATION
        // ==========================================
        gameRound: currentGameRound,
        trial: pointer + 1, // 1-indexed for display
        pointer: pointer,   // 0-indexed for array access

        // ==========================================
        // EXPERIMENT CONFIGURATION
        // ==========================================
        experimentConfig: buildExperimentConfig(room, config),

        // ==========================================
        // CHOICE DATA
        // ==========================================
        choice: buildChoiceData(choiceData, client, room),

        // ==========================================
        // MACHINE/OPTION CONFIGURATION
        // ==========================================
        machineConfig: buildMachineConfig(room, config, pointer),

        // ==========================================
        // GROUP/SOCIAL DATA (for multiplayer)
        // ==========================================
        groupData: buildGroupData(room, client, pointer),

        // ==========================================
        // PAYMENT/BONUS DATA
        // ==========================================
        payment: buildPaymentData(client, room, choiceData, config),

        // ==========================================
        // TECHNICAL METADATA
        // ==========================================
        technical: buildTechnicalData(client, choiceData),

        // ==========================================
        // CUSTOM EXPERIMENT DATA
        // ==========================================
        customData: choiceData.customData || {}
    };

    return trialData;
}

/**
 * Build experiment configuration snapshot
 */
function buildExperimentConfig(room, config) {
    const gameConfig = config.experimentLoader?.gameConfig || config.game || {};

    return {
        mode: room.mode || gameConfig.mode || 'individual',
        taskType: gameConfig.task_type || 'static',
        expCondition: gameConfig.experimental_condition || 'standard',
        groupSize: room.n || 1,
        maxGroupSize: gameConfig.max_group_size || room.n || 1,
        horizon: gameConfig.horizon || config.horizon || 10,
        totalGameRounds: gameConfig.total_game_rounds || 1,
        kArmedBandit: gameConfig.k_armed_bandit || 2,
        environment: room.currentEnvironment || 'static'
    };
}

/**
 * Build choice data from choice event
 */
function buildChoiceData(choiceData, client, room) {
    const pointer = room.pointer || 0;

    return {
        optionId: choiceData.thisChoice, // Which machine chosen (1-indexed)
        screenPosition: choiceData.optionLocation, // Screen position clicked (1-indexed)
        payoff: choiceData.payoff || 0,
        reactionTime: choiceData.reactionTime || null,
        timeElapsed: choiceData.timeElapsed || null,
        wasTimeout: choiceData.wasTimeout || false,
        wasMiss: choiceData.wasMiss || false
    };
}

/**
 * Build machine configuration with flexible arrays
 * Supports any number of options
 */
function buildMachineConfig(room, config, pointer) {
    const machineConfig = {
        optionOrder: room.optionOrder || [],
        probabilities: [],
        payoffValues: []
    };

    // Get probabilities for this trial
    if (room.prob_means && Array.isArray(room.prob_means)) {
        machineConfig.probabilities = room.prob_means.map(machineProbs => {
            if (Array.isArray(machineProbs) && machineProbs.length > pointer) {
                return machineProbs[pointer];
            }
            return 0;
        });
    }

    // Get payoff values (usually all the same, e.g., [100, 100, 100])
    if (room.vals && Array.isArray(room.vals)) {
        machineConfig.payoffValues = room.vals.map(machineVals => {
            if (Array.isArray(machineVals) && machineVals.length > pointer) {
                return machineVals[pointer];
            }
            return 0;
        });
    }

    return machineConfig;
}

/**
 * Build group/social data for multiplayer experiments
 * Returns null for individual experiments
 */
function buildGroupData(room, client, pointer) {
    // Individual experiments don't have group data
    if (!room.mode || room.mode === 'individual' || room.n === 1) {
        return null;
    }

    const groupData = {
        groupTotalPayoff: null,
        groupCumulativePayoff: null,
        socialInformation: buildSocialInformation(room, pointer),
        informationSharing: buildInformationSharing(room, client, pointer),
        synchronization: buildSynchronizationData(room, client)
    };

    // Calculate group payoffs
    if (room.payoff_perIndiv && Array.isArray(room.payoff_perIndiv[pointer])) {
        groupData.groupTotalPayoff = room.payoff_perIndiv[pointer].reduce((sum, p) => sum + p, 0);
    }

    if (room.groupCumulativePayoff && Array.isArray(room.groupCumulativePayoff)) {
        const currentRound = room.gameRound || 0;
        groupData.groupCumulativePayoff = room.groupCumulativePayoff[currentRound] || 0;
    }

    return groupData;
}

/**
 * Build social information about other players' choices
 */
function buildSocialInformation(room, pointer) {
    if (!room.socialFreq || !room.socialInfo || !room.choiceOrder) {
        return null;
    }

    const socialInfo = {
        choiceFrequencies: room.socialFreq[pointer] || [],
        choiceOrder: room.choiceOrder[pointer] || [],
        individualChoices: []
    };

    // Build detailed information about each player's choice
    if (room.socialInfo[pointer] && Array.isArray(room.socialInfo[pointer])) {
        socialInfo.individualChoices = room.socialInfo[pointer].map((choice, idx) => ({
            subjectNumber: idx + 1,
            optionChosen: choice,
            payoffReceived: room.payoff_perIndiv?.[pointer]?.[idx] || 0,
            wasShared: room.whoShared?.[pointer]?.includes(idx + 1) || false
        }));
    }

    return socialInfo;
}

/**
 * Build information sharing data
 */
function buildInformationSharing(room, client, pointer) {
    if (!room.share_decision) {
        return null;
    }

    const clientIdx = client.subjectNumber - 1;

    return {
        didShare: room.share_decision[pointer]?.[clientIdx] === 1,
        shareCost: room.shareCost || 0,
        totalShareCostPaid: room.totalShareCostPaid?.[clientIdx] || 0,
        whoShared: room.whoShared?.[pointer] || []
    };
}

/**
 * Build synchronization data (completion order, wait times)
 */
function buildSynchronizationData(room, client) {
    // TODO: Implement when we add synchronization tracking
    // This would track who finished first, who waited, etc.
    return {
        completionOrder: null,
        waitedForSubjects: [],
        waitTime: null
    };
}

/**
 * Build payment/bonus data
 */
function buildPaymentData(client, room, choiceData, config) {
    const pointer = room.pointer || 0;
    const clientIdx = client.subjectNumber - 1;

    // Get PaymentCalculator if available
    const paymentCalculator = config?.experimentLoader?.paymentCalculator;

    const paymentData = {
        individualPayoff: choiceData.payoff || 0,
        cumulativePayoff: room.totalPayoff_perIndiv?.[clientIdx] || 0,
        waitingBonus: client.waitingBonus || 0,
        informationCost: room.totalShareCostPaid?.[clientIdx] || 0
    };

    // Add formatted currency amounts if PaymentCalculator is available
    if (paymentCalculator) {
        paymentData.trialPaymentFormatted = paymentCalculator.formatCurrency(
            paymentCalculator.pointsToAmount(choiceData.payoff || 0)
        );
        paymentData.cumulativePaymentFormatted = paymentCalculator.formatCurrency(
            paymentCalculator.pointsToAmount(room.totalPayoff_perIndiv?.[clientIdx] || 0)
        );
    }

    return paymentData;
}

/**
 * Build technical metadata
 */
function buildTechnicalData(client, choiceData) {
    return {
        latency: choiceData.latency || null,
        clientTimestamp: choiceData.clientTimestamp || null,
        userAgent: client.userAgent || null,
        screenResolution: client.screenResolution || null,
        ipHash: client.ipHash || null
    };
}

/**
 * Build session data for database storage
 * @param {Object} client - Socket client object
 * @param {Object} room - Room object with experiment state
 * @param {Object} config - Experiment configuration
 * @returns {Object} Session data
 */
function buildSessionData(client, room, config) {
    const now = new Date();
    const gameConfig = config.experimentLoader?.gameConfig || config.game || {};

    return {
        sessionId: client.sessionId,
        experimentName: config.experimentName || 'unknown',
        subjectId: client.subjectID || client.subjectId, // Try uppercase first (actual property name)
        subjectNumber: client.subjectNumber,
        roomId: room.roomId, // Now set by roomFactory

        startTime: client.startTime || now,
        endTime: null, // Set when session completes
        duration: null,

        experimentConfig: {
            mode: room.mode || gameConfig.mode || 'individual',
            groupSize: room.n || 1,
            horizon: gameConfig.horizon || config.horizon || 10,
            totalGameRounds: gameConfig.total_game_rounds || 1,
            kArmedBandit: gameConfig.k_armed_bandit || 2,
            taskType: gameConfig.task_type || 'static',
            expCondition: gameConfig.experimental_condition || 'standard'
        },

        performance: {
            totalPoints: 0,
            totalPayoff: 0,
            waitingBonus: client.waitingBonus || 0,
            informationCosts: 0,
            finalPayment: 0,
            trialsCompleted: 0,
            trialsMissed: 0
        },

        comprehension: {
            testScore: null,
            testPassed: null,
            testAttempts: null,
            practiceTrialsCompleted: null
        },

        questionnaire: {},

        demographics: {
            customFields: {}
        },

        technical: {
            userAgent: client.userAgent || null,
            ipHash: client.ipHash || null,
            referrer: client.referrer || null,
            dropouts: [],
            reconnections: [],
            screenResolution: client.screenResolution || null,
            platform: client.platform || null
        },

        status: 'active',
        notes: '',
        flags: [],
        customData: {}
    };
}

/**
 * Update session performance data
 * @param {Object} sessionData - Current session data
 * @param {Object} client - Socket client object
 * @param {Object} room - Room object with experiment state
 * @param {Object} config - Experiment configuration
 * @returns {Object} Updated performance object
 */
function updateSessionPerformance(sessionData, client, room, config) {
    const clientIdx = client.subjectNumber - 1;
    const finalPaymentData = calculateFinalPayment(client, room, config);

    // Handle both old (number) and new (object) return types
    const finalPaymentAmount = typeof finalPaymentData === 'number'
        ? finalPaymentData
        : finalPaymentData.total;

    return {
        totalPoints: room.totalPayoff_perIndiv?.[clientIdx] || 0,
        totalPayoff: room.totalPayoff_perIndiv?.[clientIdx] || 0,
        waitingBonus: client.waitingBonus || 0,
        informationCosts: room.totalShareCostPaid?.[clientIdx] || 0,
        finalPayment: finalPaymentAmount,
        finalPaymentBreakdown: typeof finalPaymentData === 'object' ? finalPaymentData : null,
        trialsCompleted: (room.pointer || 0) + 1,
        trialsMissed: sessionData.performance.trialsMissed || 0
    };
}

/**
 * Calculate final payment in currency using PaymentCalculator
 * @param {Object} client - Socket client object
 * @param {Object} room - Room object with experiment state
 * @param {Object} config - Experiment configuration
 * @returns {number|Object} Payment amount (number for legacy, object with breakdown if PaymentCalculator available)
 */
function calculateFinalPayment(client, room, config) {
    const paymentCalculator = config?.experimentLoader?.paymentCalculator;

    if (paymentCalculator) {
        // Use PaymentCalculator for proper calculation
        return paymentCalculator.calculateFinalPayment(client, room);
    }

    // Legacy fallback (shouldn't be reached with new config system)
    const clientIdx = client.subjectNumber - 1;
    const totalPoints = room.totalPayoff_perIndiv?.[clientIdx] || 0;
    const centPerPoint = global.cent_per_point || 1;
    const pointsPayment = (totalPoints * centPerPoint) / 100;
    const waitingBonus = (client.waitingBonus || 0) / 100;

    return pointsPayment + waitingBonus;
}

/**
 * Build experiment metadata for database storage
 * @param {Object} config - Experiment configuration
 * @returns {Object} Experiment data
 */
function buildExperimentData(config) {
    const gameConfig = config.experimentLoader?.gameConfig || config.game || {};

    return {
        experimentName: config.experimentName || 'unknown',
        experimentVersion: config.version || '1.0',
        title: config.title || config.experimentName || 'Untitled Experiment',
        description: config.description || '',
        author: config.author || '',
        created: new Date(),

        config: config, // Store full config snapshot

        statistics: {
            totalSessions: 0,
            completedSessions: 0,
            abandonedSessions: 0,
            averageDuration: null,
            totalTrials: 0,
            averagePayment: null,
            lastUpdated: new Date()
        },

        status: 'development',

        deployment: {
            deployedAt: null,
            url: null,
            recruitmentPlatform: null,
            studyId: null,
            completionCode: null
        },

        ethics: {
            irbApprovalNumber: null,
            irbApprovalDate: null,
            consentForm: null,
            dataRetentionYears: null
        },

        notes: '',
        changelog: []
    };
}

module.exports = {
    buildTrialData,
    buildExperimentConfig,
    buildChoiceData,
    buildMachineConfig,
    buildGroupData,
    buildSocialInformation,
    buildInformationSharing,
    buildSynchronizationData,
    buildPaymentData,
    buildTechnicalData,
    buildSessionData,
    updateSessionPerformance,
    buildExperimentData,
    calculateFinalPayment
};

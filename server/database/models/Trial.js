/**
 * Trial Model - Clean, forward-looking schema for experiment data
 * Supports both individual and multiplayer experiments
 * Flexible for any number of options
 */

const { mongoose } = require('../connection');

const trialSchema = new mongoose.Schema({
  // ==========================================
  // EXPERIMENT & SESSION IDENTIFICATION
  // ==========================================
  experimentName: { type: String, required: true, index: true },
  experimentVersion: { type: String },

  sessionId: { type: String, required: true, index: true },      // Unique session ID
  roomId: { type: String, required: true, index: true },         // Room/group ID

  // ==========================================
  // PARTICIPANT IDENTIFICATION
  // ==========================================
  subjectId: { type: String, required: true, index: true },      // Participant prolific ID, etc.
  subjectNumber: { type: Number, required: true },               // Position in room (1, 2, 3...)

  // ==========================================
  // TEMPORAL DATA
  // ==========================================
  timestamp: { type: Date, required: true, index: true },        // When choice was made
  date: { type: String, required: true },                        // YYYY-MM-DD
  time: { type: String, required: true },                        // HH:MM:SS

  // ==========================================
  // TRIAL/ROUND IDENTIFICATION
  // ==========================================
  gameRound: { type: Number, required: true, default: 0 },       // Which game round (0-indexed)
  trial: { type: Number, required: true },                       // Trial number (1-indexed)
  pointer: { type: Number },                                     // Environment/horizon pointer

  // ==========================================
  // EXPERIMENT CONFIGURATION
  // ==========================================
  experimentConfig: {
    mode: { type: String, enum: ['individual', 'group'] },      // Experiment mode
    taskType: { type: String, enum: ['static', 'dynamic'] },    // Environment type
    expCondition: { type: String },                              // Experimental condition
    groupSize: { type: Number, required: true },                 // n (1 for individual)
    maxGroupSize: { type: Number },                              // Max possible group size
    horizon: { type: Number },                                   // Trials per round
    totalGameRounds: { type: Number },                           // Total rounds
    kArmedBandit: { type: Number },                              // Number of options
    environment: { type: String }                                // Environment name
  },

  // ==========================================
  // CHOICE DATA
  // ==========================================
  choice: {
    optionId: { type: Number, required: true },                  // Which option chosen (0-indexed)
    screenPosition: { type: Number, required: true },            // Screen position clicked (0-indexed)
    payoff: { type: Number, required: true },                    // Points earned this trial
    reactionTime: { type: Number },                              // Milliseconds to make choice
    timeElapsed: { type: Number },                               // Total time since experiment start
    wasTimeout: { type: Boolean, default: false },               // True if missed deadline
    wasMiss: { type: Boolean, default: false }                   // True if no choice made
  },

  // ==========================================
  // MACHINE/OPTION CONFIGURATION
  // ==========================================
  machineConfig: {
    optionOrder: [{ type: Number }],                             // Shuffled machine order [2, 1, 3, 4...]
    probabilities: [{ type: Number }],                           // True probabilities [0.9, 0.1, 0.3...]
    payoffValues: [{ type: Number }]                             // Payoff amounts [100, 100, 100...]
  },

  // ==========================================
  // GROUP/SOCIAL DATA (for multiplayer)
  // ==========================================
  groupData: {
    groupTotalPayoff: { type: Number },                          // Sum of all group members' payoffs
    groupCumulativePayoff: { type: Number },                     // Cumulative over all trials

    // What this participant saw about others
    socialInformation: {
      choiceFrequencies: [{ type: Number }],                     // [2, 1, 0] = 2 chose opt 0, 1 chose opt 1
      choiceOrder: [{ type: Number }],                           // [3, 1, 2] = subject 3 first, 1 second...
      individualChoices: [{                                      // Array of what each person chose
        subjectNumber: { type: Number },
        optionChosen: { type: Number },
        payoffReceived: { type: Number },
        wasShared: { type: Boolean }                             // Did they share this info?
      }]
    },

    // Information sharing
    informationSharing: {
      didShare: { type: Boolean },                               // Did this participant share?
      shareCost: { type: Number },                               // Cost to share
      totalShareCostPaid: { type: Number },                      // Cumulative cost
      whoShared: [{ type: Number }]                              // Subject numbers who shared
    },

    // Synchronization
    synchronization: {
      completionOrder: { type: Number },                         // 1st, 2nd, 3rd to complete
      waitedForSubjects: [{ type: Number }],                     // Who was still deciding
      waitTime: { type: Number }                                 // How long waited for others (ms)
    }
  },

  // ==========================================
  // PAYMENT/BONUS DATA
  // ==========================================
  payment: {
    individualPayoff: { type: Number },                          // This trial's payoff
    cumulativePayoff: { type: Number },                          // Running total
    waitingBonus: { type: Number },                              // Bonus from waiting
    informationCost: { type: Number }                            // Cost of sharing info
  },

  // ==========================================
  // TECHNICAL METADATA
  // ==========================================
  technical: {
    latency: { type: Number },                                   // Network latency
    clientTimestamp: { type: Date },                             // Client-side timestamp
    userAgent: { type: String },                                 // Browser info
    screenResolution: { type: String },                          // Display size
    ipHash: { type: String }                                     // Hashed IP for geo (privacy)
  },

  // ==========================================
  // NETWORK DATA (for networked experiments like NEDPD)
  // ==========================================
  networkData: {
    // Current partner information
    partnerId: { type: Number },                                 // Partner's subject number
    partnerSubjectId: { type: String },                          // Partner's session/subject ID

    // Pairing history
    pairingHistory: [{                                           // Recent partners
      partnerId: { type: Number },
      roundNumber: { type: Number }
    }],

    timesPlayedWithPartner: { type: Number },                    // How many times paired with this partner

    // Partner's choice (for strategic games like PD)
    partnerChoice: {
      optionId: { type: Number },                                // Partner's choice (0=cooperate, 1=defect)
      payoff: { type: Number }                                   // Partner's payoff this round
    },

    // Cooperation tracking
    cooperationHistory: {
      playerCooperated: { type: Boolean },                       // Did this player cooperate?
      partnerCooperated: { type: Boolean },                      // Did partner cooperate?
      mutualCooperation: { type: Boolean },                      // Both cooperated
      mutualDefection: { type: Boolean },                        // Both defected
      wasExploited: { type: Boolean },                           // Player cooperated, partner defected
      exploitedPartner: { type: Boolean }                        // Player defected, partner cooperated
    },

    // Ostracism/exclusion data
    ostracismData: {
      wasOstracismRound: { type: Boolean, default: false },      // Was this an ostracism voting round?
      playerVote: {                                              // This player's vote
        type: String,
        enum: ['continue', 'break', null],
        default: null
      },
      partnerVote: {                                             // Partner's vote (revealed later)
        type: String,
        enum: ['continue', 'break', null],
        default: null
      },
      linkBroken: { type: Boolean },                             // Was the link severed?
      breakInitiator: {                                          // Who initiated the break
        type: String,
        enum: ['player', 'partner', 'both', 'neither', null],
        default: null
      }
    },

    // Network state snapshot
    networkSnapshot: {
      totalEdges: { type: Number },                              // Total edges in network
      playerDegree: { type: Number },                            // This player's number of connections
      partnerDegree: { type: Number },                           // Partner's number of connections
      isolatedCount: { type: Number },                           // Number of isolated players
      networkDensity: { type: Number },                          // Network density (0-1)
      isNetworkConnected: { type: Boolean }                      // Is network fully connected?
    },

    // Player status
    playerStatus: {
      isIsolated: { type: Boolean, default: false },             // Has no valid partners
      canStillPlay: { type: Boolean, default: true },            // Can participate in future rounds
      validPartnerCount: { type: Number }                        // How many partners available
    }
  },

  // ==========================================
  // CUSTOM EXPERIMENT DATA
  // ==========================================
  customData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }

}, {
  timestamps: true,    // Auto-adds createdAt, updatedAt
  strict: false        // Allow additional fields
});

// Compound indexes for common queries
trialSchema.index({ experimentName: 1, subjectId: 1, trial: 1 });
trialSchema.index({ roomId: 1, trial: 1 });
trialSchema.index({ timestamp: -1 });
trialSchema.index({ experimentName: 1, gameRound: 1, trial: 1 });

module.exports = mongoose.model('Trial', trialSchema);

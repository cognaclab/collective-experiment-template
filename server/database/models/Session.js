/**
 * Session Model - Store session-level data
 * One record per participant per experiment session
 */

const { mongoose } = require('../connection');

const sessionSchema = new mongoose.Schema({
  // ==========================================
  // IDENTIFICATION
  // ==========================================
  sessionId: { type: String, required: true, unique: true, index: true },
  experimentName: { type: String, required: true, index: true },
  subjectId: { type: String, required: true, index: true },
  subjectNumber: { type: Number },
  roomId: { type: String, index: true },

  // ==========================================
  // TIMING
  // ==========================================
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  duration: { type: Number },                    // Milliseconds

  // ==========================================
  // CONFIGURATION
  // ==========================================
  experimentConfig: {
    mode: { type: String },
    groupSize: { type: Number },
    horizon: { type: Number },
    totalGameRounds: { type: Number },
    kArmedBandit: { type: Number },
    taskType: { type: String },
    expCondition: { type: String }
  },

  // ==========================================
  // PERFORMANCE
  // ==========================================
  performance: {
    totalPoints: { type: Number },
    totalPayoff: { type: Number },               // In currency
    waitingBonus: { type: Number },
    informationCosts: { type: Number },
    finalPayment: { type: Number },
    trialsCompleted: { type: Number },
    trialsMissed: { type: Number }
  },

  // ==========================================
  // COMPREHENSION/PRACTICE
  // ==========================================
  comprehension: {
    testScore: { type: Number },
    testPassed: { type: Boolean },
    testAttempts: { type: Number },
    practiceTrialsCompleted: { type: Number }
  },

  // ==========================================
  // QUESTIONNAIRE RESPONSES
  // ==========================================
  questionnaire: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // ==========================================
  // DEMOGRAPHICS (if collected)
  // ==========================================
  demographics: {
    age: { type: Number },
    gender: { type: String },
    education: { type: String },
    customFields: { type: mongoose.Schema.Types.Mixed }
  },

  // ==========================================
  // TECHNICAL
  // ==========================================
  technical: {
    userAgent: { type: String },
    ipHash: { type: String },
    referrer: { type: String },
    dropouts: [{ type: Date }],                  // Disconnection timestamps
    reconnections: [{ type: Date }],
    screenResolution: { type: String },
    platform: { type: String }
  },

  // ==========================================
  // STATUS
  // ==========================================
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned', 'timeout', 'excluded'],
    default: 'active',
    index: true
  },

  // ==========================================
  // NOTES/FLAGS
  // ==========================================
  notes: { type: String },
  flags: {
    type: [String],
    default: []                                  // ['attention_check_failed', 'suspicious_timing', etc.]
  },

  // ==========================================
  // CUSTOM DATA
  // ==========================================
  customData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }

}, {
  timestamps: true    // Auto-adds createdAt, updatedAt
});

// Indexes for common queries
sessionSchema.index({ experimentName: 1, status: 1 });
sessionSchema.index({ startTime: -1 });
sessionSchema.index({ subjectId: 1, experimentName: 1 });

module.exports = mongoose.model('Session', sessionSchema);

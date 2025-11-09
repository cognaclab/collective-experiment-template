/**
 * Experiment Model - Store experiment metadata and configuration snapshots
 * One record per experiment
 */

const { mongoose } = require('../connection');

const experimentSchema = new mongoose.Schema({
  // ==========================================
  // IDENTIFICATION
  // ==========================================
  experimentName: { type: String, required: true, unique: true, index: true },
  experimentVersion: { type: String },

  // ==========================================
  // DESCRIPTIVE
  // ==========================================
  title: { type: String },
  description: { type: String },
  author: { type: String },
  created: { type: Date, default: Date.now },

  // ==========================================
  // CONFIGURATION SNAPSHOT
  // ==========================================
  config: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // ==========================================
  // STATISTICS
  // ==========================================
  statistics: {
    totalSessions: { type: Number, default: 0 },
    completedSessions: { type: Number, default: 0 },
    abandonedSessions: { type: Number, default: 0 },
    averageDuration: { type: Number },
    totalTrials: { type: Number, default: 0 },
    averagePayment: { type: Number },
    lastUpdated: { type: Date }
  },

  // ==========================================
  // STATUS
  // ==========================================
  status: {
    type: String,
    enum: ['development', 'testing', 'pilot', 'active', 'paused', 'completed', 'archived'],
    default: 'development',
    index: true
  },

  // ==========================================
  // DEPLOYMENT INFO
  // ==========================================
  deployment: {
    deployedAt: { type: Date },
    url: { type: String },
    recruitmentPlatform: { type: String },       // 'prolific', 'mturk', 'sona', etc.
    studyId: { type: String },                   // External platform study ID
    completionCode: { type: String }             // Code for participants
  },

  // ==========================================
  // ETHICS/IRB
  // ==========================================
  ethics: {
    irbApprovalNumber: { type: String },
    irbApprovalDate: { type: Date },
    consentForm: { type: String },
    dataRetentionYears: { type: Number }
  },

  // ==========================================
  // NOTES
  // ==========================================
  notes: { type: String },
  changelog: [{
    date: { type: Date, default: Date.now },
    version: { type: String },
    changes: { type: String },
    author: { type: String }
  }]

}, {
  timestamps: true    // Auto-adds createdAt, updatedAt
});

// Indexes
experimentSchema.index({ status: 1, created: -1 });
experimentSchema.index({ 'deployment.recruitmentPlatform': 1 });

module.exports = mongoose.model('Experiment', experimentSchema);

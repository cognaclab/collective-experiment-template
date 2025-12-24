/**
 * MFQScore Model - Store Moral Foundations Questionnaire scores
 * Pre-collected scores imported from external questionnaire studies
 * Used in transparent condition to display partner personality information
 */

const { mongoose } = require('../connection');

const mfqScoreSchema = new mongoose.Schema({
  // ==========================================
  // IDENTIFICATION
  // ==========================================
  subjectId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // ==========================================
  // RAW SCORES (typically 1-5 or 1-6 scale)
  // ==========================================
  scores: {
    harm: { type: Number, required: true },
    fairness: { type: Number, required: true },
    loyalty: { type: Number, required: true },
    authority: { type: Number, required: true },
    purity: { type: Number, required: true }
  },

  // ==========================================
  // PRE-COMPUTED LEVELS (for display)
  // ==========================================
  levels: {
    harm: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true
    },
    fairness: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true
    },
    loyalty: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true
    },
    authority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true
    },
    purity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true
    }
  },

  // ==========================================
  // METADATA
  // ==========================================
  importedAt: {
    type: Date,
    default: Date.now
  },
  sourceFile: {
    type: String
  },
  sourceStudy: {
    type: String
  }

}, {
  timestamps: true
});

// Index for bulk lookups during room formation
mfqScoreSchema.index({ subjectId: 1 });

module.exports = mongoose.model('MFQScore', mfqScoreSchema);

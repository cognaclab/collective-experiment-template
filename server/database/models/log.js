'use strict';

const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  text: String,
  tags: { type: Array },
  timestamp: { type: Date, default: Date.now }
});

// Define indexes explicitly using createIndexes() internally
logSchema.index({ tags: 1 });
logSchema.index({ timestamp: 1 });

module.exports = mongoose.model("Logs", logSchema);
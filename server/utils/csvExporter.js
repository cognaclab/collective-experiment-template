'use strict';

const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const logger = require('./logger');

const csvDir = path.resolve(process.env.CSV_OUTPUT_DIR || './data/csv/');

const TRIAL_COLUMNS = [
    'experimentName',
    'sessionId',
    'subjectId',
    'roomId',
    'gameRound',
    'trial',
    'choice.optionId',
    'choice.payoff',
    'choice.reactionTime',
    'choice.wasTimeout',
    'choice.wasMiss',
    'timestamp'
];

const SESSION_COLUMNS = [
    'experimentName',
    'sessionId',
    'subjectId',
    'roomId',
    'startTime',
    'endTime',
    'status',
    'performance.totalPoints',
    'performance.finalPayment'
];

/**
 * Resolve a dotted key path on an object (e.g. "choice.optionId")
 */
function resolve(obj, keyPath) {
    return keyPath.split('.').reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
}

/**
 * Flatten a data object according to column definitions
 */
function flattenRow(data, columns) {
    const row = {};
    for (const col of columns) {
        const value = resolve(data, col);
        row[col] = value !== undefined ? value : '';
    }
    return row;
}

/**
 * Append a single row to a CSV file, creating headers if the file does not exist
 */
function appendRow(filePath, data, columns) {
    if (!fs.existsSync(csvDir)) {
        fs.mkdirSync(csvDir, { recursive: true });
    }

    const fileExists = fs.existsSync(filePath);
    const row = flattenRow(data, columns);

    const stream = csv.format({ headers: !fileExists, quoteColumns: true });
    stream.pipe(fs.createWriteStream(filePath, { flags: 'a' }));
    stream.write(row);
    stream.end();
}

/**
 * Append a trial row to data/csv/trials.csv
 * @param {Object} trialData - Trial data object from buildTrialData
 */
function appendTrialRow(trialData) {
    try {
        const filePath = path.join(csvDir, 'trials.csv');
        appendRow(filePath, trialData, TRIAL_COLUMNS);
    } catch (error) {
        logger.error('Failed to append trial row to CSV', {
            error: error.message,
            sessionId: trialData.sessionId
        });
    }
}

/**
 * Append a session row to data/csv/sessions.csv
 * @param {Object} sessionData - Session data object from buildSessionData
 */
function appendSessionRow(sessionData) {
    try {
        const filePath = path.join(csvDir, 'sessions.csv');
        appendRow(filePath, sessionData, SESSION_COLUMNS);
    } catch (error) {
        logger.error('Failed to append session row to CSV', {
            error: error.message,
            sessionId: sessionData.sessionId
        });
    }
}

module.exports = {
    appendTrialRow,
    appendSessionRow
};

'use strict';

// Prolific sends participant parameters under various query key aliases.
// This module normalises them into a single canonical set so that every
// route handler resolves them identically.

const SUBJECT_ID_ALIASES = ['subjectID', 'PROLIFIC_PID', 'prolific_pid', 'prolificId', 'pid'];
const STUDY_ID_ALIASES   = ['studyID', 'STUDY_ID', 'study_id'];
const SESSION_ID_ALIASES = ['prolificSessionID', 'SESSION_ID', 'session_id'];

/**
 * Extracts the first matching value from a query object for a list of aliases.
 * @param {object} query - Express req.query (or any key-value object)
 * @param {string[]} aliases - Ordered list of query keys to try
 * @returns {string} The first truthy value found, or empty string
 */
function resolveAlias(query, aliases) {
    for (const key of aliases) {
        if (query[key]) return query[key];
    }
    return '';
}

/**
 * Extracts canonical Prolific parameters from a request query object.
 * @param {object} query - Express req.query (or any key-value object)
 * @returns {{ subjectID: string, studyID: string, prolificSessionID: string }}
 */
function extractProlificParams(query) {
    return {
        subjectID:         resolveAlias(query, SUBJECT_ID_ALIASES),
        studyID:           resolveAlias(query, STUDY_ID_ALIASES),
        prolificSessionID: resolveAlias(query, SESSION_ID_ALIASES)
    };
}

module.exports = { extractProlificParams };

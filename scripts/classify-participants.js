#!/usr/bin/env node
/**
 * Participant Classification Script
 *
 * Classifies participants into moral types (binding/individualizing/intermediate)
 * based on Moral Foundations Questionnaire scores. Classifications are stored
 * as ParticipantClassification records in MongoDB for use by GroupFormationService.
 *
 * Supports two input modes:
 *   Mode A (file):  Read classifications from a CSV/TSV file
 *   Mode B (db):    Compute classifications from MFQScore records in MongoDB
 *
 * Usage:
 *   node scripts/classify-participants.js --file data/mfq_session2_prod_completed.csv
 *   node scripts/classify-participants.js --file data/mfq_scores.csv --participants-file data/participants.tsv
 *   node scripts/classify-participants.js --source db
 *   node scripts/classify-participants.js --source db --batch "pilot-2026-02"
 *   node scripts/classify-participants.js --file data/scores.csv --dry-run
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

require('dotenv').config();
const { mongoose, connect } = require('../server/database/connection');
const ParticipantClassification = require('../server/database/models/ParticipantClassification');
const MFQScore = require('../server/database/models/MFQScore');

const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Compute binding score as mean of loyalty, authority, purity
 */
function computeBindingScore(scores) {
    return (scores.loyalty + scores.authority + scores.purity) / 3;
}

/**
 * Compute individualizing score as mean of harm, fairness
 */
function computeIndividualizingScore(scores) {
    return (scores.harm + scores.fairness) / 2;
}

/**
 * Compute the binding index (binding minus individualizing)
 */
function computeBindingIndex(bindingScore, individualizingScore) {
    return bindingScore - individualizingScore;
}

/**
 * Determine quartile-based classification cutoffs from a sorted array of values.
 * Returns { q25, q75 } thresholds where:
 *   bottom 25% (value <= q25) -> individualizing
 *   top 25% (value >= q75) -> binding
 *   middle 50% -> intermediate
 */
function computeQuartileCutoffs(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const q25Index = Math.floor(n * 0.25);
    const q75Index = Math.floor(n * 0.75);

    return {
        q25: sorted[q25Index],
        q75: sorted[q75Index]
    };
}

/**
 * Classify a participant based on their binding index relative to quartile cutoffs.
 * Higher binding index means more binding-oriented.
 */
function classifyByQuartile(bindingIndex, cutoffs) {
    if (bindingIndex >= cutoffs.q75) return 'binding';
    if (bindingIndex <= cutoffs.q25) return 'individualizing';
    return 'intermediate';
}

/**
 * Parse a participants manifest file to build a sessionId -> prolificId map.
 * Used to cross-reference files that use sessionId with the actual prolificId
 * needed for game server matching.
 */
function loadParticipantsMap(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const delimiter = filePath.endsWith('.tsv') ? '\t' : ',';
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: delimiter
    });

    const map = {};
    for (const row of records) {
        const sessionKey = row.sessionKey || row.sessionId || row.subjectId;
        const prolificId = row.prolificId || row.prolific_id || row.PROLIFIC_PID;
        if (sessionKey && prolificId && prolificId !== '' && !prolificId.startsWith('NO_PROLIFIC_ID')) {
            map[sessionKey] = prolificId;
        }
    }
    return map;
}

/**
 * Parse a delimited file (CSV or TSV) and return classification records.
 * Supports two paths:
 *   1) Pre-computed classifications via mfq_profile_quartile3 column
 *   2) Raw scores requiring binding index computation
 */
function parseDelimited(filePath, delimiter, participantsMap) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: delimiter
    });

    if (records.length === 0) {
        return [];
    }

    const hasPrecomputedClassification = 'mfq_profile_quartile3' in records[0];
    const hasBindingMean = 'binding_mean' in records[0];
    const hasRawScores = 'harm' in records[0] || 'care' in records[0] || 'Care' in records[0];

    if (hasPrecomputedClassification) {
        return parsePrecomputedClassifications(records, participantsMap);
    }

    if (hasBindingMean || hasRawScores) {
        return parseAndComputeClassifications(records, participantsMap);
    }

    throw new Error(
        'File must contain either mfq_profile_quartile3 column, '
        + 'binding_mean/individualizing_mean columns, '
        + 'or raw foundation scores (harm, fairness, loyalty, authority, purity)'
    );
}

/**
 * Extract classifications from pre-computed mfq_profile_quartile3 column.
 * Maps the Python notebook's "mixed" label to "intermediate".
 */
function parsePrecomputedClassifications(records, participantsMap) {
    const LABEL_MAP = {
        'binding': 'binding',
        'individualizing': 'individualizing',
        'intermediate': 'intermediate',
        'mixed': 'intermediate'
    };

    return records.map(row => {
        const subjectId = resolveSubjectId(row, participantsMap);
        const rawLabel = (row.mfq_profile_quartile3 || '').toLowerCase().trim();
        const moralType = LABEL_MAP[rawLabel];

        if (!moralType) {
            throw new Error(
                `Unknown classification label "${row.mfq_profile_quartile3}" for subject ${subjectId}`
            );
        }

        const bindingScore = parseFloat(row.binding_mean || 0);
        const individualizingScore = parseFloat(row.individualizing_mean || 0);
        const bindingIndex = bindingScore && individualizingScore
            ? computeBindingIndex(bindingScore, individualizingScore)
            : null;

        return {
            subjectId,
            moralType,
            bindingIndex,
            bindingScore: bindingScore || null,
            individualizingScore: individualizingScore || null
        };
    });
}

/**
 * Compute classifications from raw scores or pre-computed means.
 * Uses quartile-based cutoffs on the binding index.
 */
function parseAndComputeClassifications(records, participantsMap) {
    const participants = records.map(row => {
        const subjectId = resolveSubjectId(row, participantsMap);

        let bindingScore, individualizingScore;

        if (row.binding_mean && row.individualizing_mean) {
            bindingScore = parseFloat(row.binding_mean);
            individualizingScore = parseFloat(row.individualizing_mean);
        } else {
            const scores = {
                harm: parseFloat(row.harm || row.Harm || row.care || row.Care || row.harm_care || row.mfq_foundation_mean_Harm || 0),
                fairness: parseFloat(row.fairness || row.Fairness || row.fairness_reciprocity || row.mfq_foundation_mean_Fairness || 0),
                loyalty: parseFloat(row.loyalty || row.Loyalty || row.ingroup_loyalty || row.Ingroup || row.mfq_foundation_mean_Ingroup || 0),
                authority: parseFloat(row.authority || row.Authority || row.authority_respect || row.mfq_foundation_mean_Authority || 0),
                purity: parseFloat(row.purity || row.Purity || row.purity_sanctity || row.mfq_foundation_mean_Purity || 0)
            };
            bindingScore = computeBindingScore(scores);
            individualizingScore = computeIndividualizingScore(scores);
        }

        const bindingIndex = computeBindingIndex(bindingScore, individualizingScore);

        return { subjectId, bindingScore, individualizingScore, bindingIndex };
    });

    const bindingIndices = participants.map(p => p.bindingIndex);
    const cutoffs = computeQuartileCutoffs(bindingIndices);

    log(`  Quartile cutoffs: Q25=${cutoffs.q25.toFixed(4)}, Q75=${cutoffs.q75.toFixed(4)}`, 'cyan');

    return participants.map(p => ({
        subjectId: p.subjectId,
        moralType: classifyByQuartile(p.bindingIndex, cutoffs),
        bindingIndex: p.bindingIndex,
        bindingScore: p.bindingScore,
        individualizingScore: p.individualizingScore
    }));
}

/**
 * Resolve the subject ID from a row, using cross-reference map if available.
 */
function resolveSubjectId(row, participantsMap) {
    let subjectId = row.prolificId || row.prolific_id
        || row.subjectId || row.subject_id
        || row.participantId || row.participant_id;

    if (participantsMap && (!subjectId || subjectId === row.subjectId)) {
        const sessionKey = row.subjectId || row.sessionKey;
        if (sessionKey && participantsMap[sessionKey]) {
            subjectId = participantsMap[sessionKey];
        }
    }

    if (!subjectId) {
        throw new Error(`Row missing subject ID: ${JSON.stringify(row)}`);
    }

    return subjectId;
}

/**
 * Load MFQScore records from MongoDB and compute quartile-based classifications.
 */
async function classifyFromDatabase() {
    const mfqScores = await MFQScore.find({}).lean();

    if (mfqScores.length === 0) {
        throw new Error('No MFQScore records found in database');
    }

    log(`  Found ${mfqScores.length} MFQScore records in database`, 'cyan');

    const participants = mfqScores.map(doc => {
        const bindingScore = computeBindingScore(doc.scores);
        const individualizingScore = computeIndividualizingScore(doc.scores);
        const bindingIndex = computeBindingIndex(bindingScore, individualizingScore);

        return {
            subjectId: doc.subjectId,
            bindingScore,
            individualizingScore,
            bindingIndex
        };
    });

    const bindingIndices = participants.map(p => p.bindingIndex);
    const cutoffs = computeQuartileCutoffs(bindingIndices);

    log(`  Quartile cutoffs: Q25=${cutoffs.q25.toFixed(4)}, Q75=${cutoffs.q75.toFixed(4)}`, 'cyan');

    return participants.map(p => ({
        subjectId: p.subjectId,
        moralType: classifyByQuartile(p.bindingIndex, cutoffs),
        bindingIndex: p.bindingIndex,
        bindingScore: p.bindingScore,
        individualizingScore: p.individualizingScore
    }));
}

/**
 * Write classification records to MongoDB (upsert by subjectId).
 */
async function saveClassifications(records, batch) {
    const results = {
        created: 0,
        updated: 0,
        errors: []
    };

    for (const record of records) {
        try {
            const updateData = {
                subjectId: record.subjectId,
                moralType: record.moralType,
                bindingIndex: record.bindingIndex,
                bindingScore: record.bindingScore,
                individualizingScore: record.individualizingScore,
                classifiedAt: new Date()
            };

            if (batch) {
                updateData.classificationBatch = batch;
            }

            const result = await ParticipantClassification.findOneAndUpdate(
                { subjectId: record.subjectId },
                updateData,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            if (result.createdAt && result.updatedAt &&
                result.createdAt.getTime() === result.updatedAt.getTime()) {
                results.created++;
            } else {
                results.updated++;
            }
        } catch (error) {
            results.errors.push({
                subjectId: record.subjectId,
                error: error.message
            });
        }
    }

    return results;
}

/**
 * Print a summary report of classification counts.
 */
function printSummary(records) {
    const counts = { binding: 0, individualizing: 0, intermediate: 0 };
    for (const r of records) {
        counts[r.moralType]++;
    }

    log('\nClassification Summary:', 'blue');
    log('='.repeat(40), 'blue');
    log(`  Binding:          ${counts.binding} (${(counts.binding / records.length * 100).toFixed(1)}%)`, 'green');
    log(`  Individualizing:  ${counts.individualizing} (${(counts.individualizing / records.length * 100).toFixed(1)}%)`, 'green');
    log(`  Intermediate:     ${counts.intermediate} (${(counts.intermediate / records.length * 100).toFixed(1)}%)`, 'green');
    log(`  Total:            ${records.length}`, 'cyan');

    const bindingIndices = records.filter(r => r.bindingIndex != null).map(r => r.bindingIndex);
    if (bindingIndices.length > 0) {
        const mean = bindingIndices.reduce((a, b) => a + b, 0) / bindingIndices.length;
        const min = Math.min(...bindingIndices);
        const max = Math.max(...bindingIndices);
        log(`\n  Binding Index: mean=${mean.toFixed(4)}, min=${min.toFixed(4)}, max=${max.toFixed(4)}`, 'cyan');
    }
}

function showUsage() {
    log('\nParticipant Classification Script', 'blue');
    log('='.repeat(50), 'blue');
    log('\nClassifies participants into moral types (binding/individualizing/intermediate)', 'cyan');
    log('for use by GroupFormationService.', 'cyan');
    log('\nUsage:', 'yellow');
    log('  node scripts/classify-participants.js --file <path> [options]');
    log('  node scripts/classify-participants.js --source db [options]');
    log('\nInput Modes:', 'yellow');
    log('  --file, -f <path>           Read from CSV/TSV file');
    log('  --source db                 Compute from MFQScore records in MongoDB');
    log('\nFile Mode Options:', 'yellow');
    log('  --participants-file <path>  Cross-reference file to map sessionId to prolificId');
    log('\nGeneral Options:', 'yellow');
    log('  --batch <name>              Tag classifications with a batch name');
    log('  --dry-run                   Parse and classify but do not write to database');
    log('  --help, -h                  Show this help message');
    log('\nFile Format:', 'yellow');
    log('  If the file has a mfq_profile_quartile3 column, those labels are used directly.');
    log('  Otherwise, classifications are computed from binding_mean/individualizing_mean');
    log('  or from raw scores (harm, fairness, loyalty, authority, purity) using quartile cutoffs.');
    log('');
}

async function main() {
    const args = process.argv.slice(2);

    let filePath = null;
    let participantsFile = null;
    let source = null;
    let batch = null;
    let dryRun = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            showUsage();
            process.exit(0);
        } else if (arg === '--file' || arg === '-f') {
            filePath = args[++i];
        } else if (arg === '--participants-file') {
            participantsFile = args[++i];
        } else if (arg === '--source') {
            source = args[++i];
        } else if (arg === '--batch') {
            batch = args[++i];
        } else if (arg === '--dry-run') {
            dryRun = true;
        }
    }

    if (!filePath && source !== 'db') {
        log('Error: must specify --file <path> or --source db', 'red');
        showUsage();
        process.exit(1);
    }

    if (filePath && source === 'db') {
        log('Error: cannot specify both --file and --source db', 'red');
        process.exit(1);
    }

    log('\nParticipant Classification', 'blue');
    log('='.repeat(50), 'blue');
    log(`Mode: ${filePath ? 'File' : 'Database'}`, 'cyan');
    if (filePath) log(`File: ${path.resolve(filePath)}`, 'cyan');
    if (participantsFile) log(`Participants file: ${path.resolve(participantsFile)}`, 'cyan');
    if (batch) log(`Batch: ${batch}`, 'cyan');
    log(`Execution: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`, dryRun ? 'yellow' : 'green');
    log('');

    let classifications;

    if (filePath) {
        const resolvedPath = path.resolve(filePath);

        if (!fs.existsSync(resolvedPath)) {
            log(`Error: File not found: ${resolvedPath}`, 'red');
            process.exit(1);
        }

        let participantsMap = null;
        if (participantsFile) {
            const resolvedParticipants = path.resolve(participantsFile);
            if (!fs.existsSync(resolvedParticipants)) {
                log(`Error: Participants file not found: ${resolvedParticipants}`, 'red');
                process.exit(1);
            }
            participantsMap = loadParticipantsMap(resolvedParticipants);
            log(`Loaded ${Object.keys(participantsMap).length} session-to-prolificId mappings`, 'green');
        }

        try {
            const ext = path.extname(resolvedPath).toLowerCase();
            const delimiter = ext === '.tsv' ? '\t' : ',';

            if (ext !== '.csv' && ext !== '.tsv') {
                log(`Error: Unsupported file format: ${ext}. Use .csv or .tsv`, 'red');
                process.exit(1);
            }

            log('Parsing file...', 'cyan');
            classifications = parseDelimited(resolvedPath, delimiter, participantsMap);
            log(`Classified ${classifications.length} participants from file`, 'green');
        } catch (error) {
            log(`Error parsing file: ${error.message}`, 'red');
            process.exit(1);
        }

    } else {
        try {
            log('Connecting to database...', 'cyan');
            await connect();
            log('Connected to MongoDB', 'green');

            log('Computing classifications from MFQScore records...', 'cyan');
            classifications = await classifyFromDatabase();
            log(`Classified ${classifications.length} participants from database`, 'green');
        } catch (error) {
            log(`Error: ${error.message}`, 'red');
            process.exit(1);
        }
    }

    if (classifications.length === 0) {
        log('No participants to classify.', 'yellow');
        process.exit(0);
    }

    log('\nSample record:', 'cyan');
    const sample = classifications[0];
    log(`  Subject: ${sample.subjectId}`);
    log(`  Type: ${sample.moralType}`);
    if (sample.bindingIndex != null) log(`  Binding Index: ${sample.bindingIndex.toFixed(4)}`);
    if (sample.bindingScore != null) log(`  Binding Score: ${sample.bindingScore.toFixed(4)}`);
    if (sample.individualizingScore != null) log(`  Individualizing Score: ${sample.individualizingScore.toFixed(4)}`);

    printSummary(classifications);

    if (dryRun) {
        log('\nDry run complete. No changes made to database.', 'green');
        process.exit(0);
    }

    try {
        if (source !== 'db') {
            log('\nConnecting to database...', 'cyan');
            await connect();
            log('Connected to MongoDB', 'green');
        }

        log('\nSaving classifications...', 'cyan');
        const results = await saveClassifications(classifications, batch);

        log('\nImport Results:', 'blue');
        log(`  Created: ${results.created}`, 'green');
        log(`  Updated: ${results.updated}`, 'yellow');
        log(`  Errors:  ${results.errors.length}`, results.errors.length > 0 ? 'red' : 'green');

        if (results.errors.length > 0) {
            log('\nErrors:', 'red');
            results.errors.forEach(err => {
                log(`  ${err.subjectId}: ${err.error}`, 'red');
            });
        }

        log('\nClassification complete!', 'green');

    } catch (error) {
        log(`\nDatabase error: ${error.message}`, 'red');
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

main().catch(error => {
    log(`Fatal error: ${error.message}`, 'red');
    process.exit(1);
});

#!/usr/bin/env node
/**
 * MFQ Score Import Script
 *
 * Imports Moral Foundations Questionnaire scores from CSV/JSON files
 * into the MongoDB database for use in transparent condition experiments.
 *
 * Usage:
 *   node scripts/import-mfq-scores.js --file data/mfq_scores.csv
 *   node scripts/import-mfq-scores.js --file data/mfq_scores.json
 *   node scripts/import-mfq-scores.js --file data/mfq_scores.csv --thresholds 2.5,3.5
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Database connection
require('dotenv').config();
const { mongoose, connectDB } = require('../server/database/connection');
const MFQScore = require('../server/database/models/MFQScore');

// Color codes for terminal output
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

// Default thresholds for converting raw scores to levels
// Assumes a 1-5 scale (adjust if your questionnaire uses different scale)
const DEFAULT_THRESHOLDS = {
    low: { min: 1, max: 2.5 },
    medium: { min: 2.5, max: 3.5 },
    high: { min: 3.5, max: 5 }
};

/**
 * Convert a raw score to a level (low/medium/high)
 */
function scoreToLevel(score, thresholds = DEFAULT_THRESHOLDS) {
    if (score < thresholds.medium.min) return 'low';
    if (score < thresholds.high.min) return 'medium';
    return 'high';
}

/**
 * Parse CSV file and return array of score objects
 */
function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });

    return records.map(row => {
        // Support various column naming conventions
        const subjectId = row.subjectId || row.subject_id || row.prolificId || row.prolific_id || row.participantId || row.participant_id;

        if (!subjectId) {
            throw new Error(`Row missing subject ID: ${JSON.stringify(row)}`);
        }

        // Extract scores (support different column names)
        const scores = {
            harm: parseFloat(row.harm || row.Harm || row.harm_care || row.HarmCare || 0),
            fairness: parseFloat(row.fairness || row.Fairness || row.fairness_reciprocity || row.FairnessReciprocity || 0),
            loyalty: parseFloat(row.loyalty || row.Loyalty || row.ingroup_loyalty || row.IngroupLoyalty || 0),
            authority: parseFloat(row.authority || row.Authority || row.authority_respect || row.AuthorityRespect || 0),
            purity: parseFloat(row.purity || row.Purity || row.purity_sanctity || row.PuritySanctity || 0)
        };

        return { subjectId, scores };
    });
}

/**
 * Parse JSON file and return array of score objects
 */
function parseJSON(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Handle both array format and object with array
    const records = Array.isArray(data) ? data : (data.scores || data.participants || []);

    return records.map(row => {
        const subjectId = row.subjectId || row.subject_id || row.prolificId || row.participantId;

        if (!subjectId) {
            throw new Error(`Row missing subject ID: ${JSON.stringify(row)}`);
        }

        const scores = row.scores || {
            harm: row.harm || 0,
            fairness: row.fairness || 0,
            loyalty: row.loyalty || 0,
            authority: row.authority || 0,
            purity: row.purity || 0
        };

        return { subjectId, scores };
    });
}

/**
 * Import scores into MongoDB
 */
async function importScores(records, sourceFile, thresholds) {
    const results = {
        created: 0,
        updated: 0,
        errors: []
    };

    for (const record of records) {
        try {
            // Compute levels from scores
            const levels = {
                harm: scoreToLevel(record.scores.harm, thresholds),
                fairness: scoreToLevel(record.scores.fairness, thresholds),
                loyalty: scoreToLevel(record.scores.loyalty, thresholds),
                authority: scoreToLevel(record.scores.authority, thresholds),
                purity: scoreToLevel(record.scores.purity, thresholds)
            };

            // Upsert (update if exists, create if not)
            const result = await MFQScore.findOneAndUpdate(
                { subjectId: record.subjectId },
                {
                    subjectId: record.subjectId,
                    scores: record.scores,
                    levels: levels,
                    sourceFile: path.basename(sourceFile),
                    importedAt: new Date()
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // Check if it was an update or create
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

function showUsage() {
    log('\n📊 MFQ Score Import Script', 'blue');
    log('='.repeat(50), 'blue');
    log('\nImports Moral Foundations Questionnaire scores into MongoDB.', 'cyan');
    log('\nUsage:', 'yellow');
    log('  node scripts/import-mfq-scores.js --file <path> [options]');
    log('\nRequired:', 'yellow');
    log('  --file, -f <path>       Path to CSV or JSON file with MFQ scores');
    log('\nOptional:', 'yellow');
    log('  --thresholds <low,high> Custom thresholds for low/medium/high (default: 2.5,3.5)');
    log('  --dry-run               Parse file but don\'t import to database');
    log('  --help, -h              Show this help message');
    log('\nCSV Format:', 'yellow');
    log('  subjectId,harm,fairness,loyalty,authority,purity');
    log('  player1,4.2,3.8,2.1,3.5,2.9');
    log('  player2,3.1,4.5,3.9,2.8,3.2');
    log('\nJSON Format:', 'yellow');
    log('  [');
    log('    { "subjectId": "player1", "scores": { "harm": 4.2, ... } },');
    log('    { "subjectId": "player2", "harm": 3.1, "fairness": 4.5, ... }');
    log('  ]');
    log('');
}

async function main() {
    const args = process.argv.slice(2);

    // Parse arguments
    let filePath = null;
    let dryRun = false;
    let thresholds = DEFAULT_THRESHOLDS;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            showUsage();
            process.exit(0);
        } else if (arg === '--file' || arg === '-f') {
            filePath = args[++i];
        } else if (arg === '--dry-run') {
            dryRun = true;
        } else if (arg === '--thresholds') {
            const [low, high] = args[++i].split(',').map(Number);
            thresholds = {
                low: { min: 1, max: low },
                medium: { min: low, max: high },
                high: { min: high, max: 5 }
            };
        }
    }

    // Validate required arguments
    if (!filePath) {
        log('Error: --file argument is required', 'red');
        showUsage();
        process.exit(1);
    }

    // Resolve file path
    const resolvedPath = path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
        log(`Error: File not found: ${resolvedPath}`, 'red');
        process.exit(1);
    }

    log('\n📊 MFQ Score Import', 'blue');
    log('='.repeat(50), 'blue');
    log(`File: ${resolvedPath}`, 'cyan');
    log(`Thresholds: low < ${thresholds.medium.min}, medium < ${thresholds.high.min}, high >= ${thresholds.high.min}`, 'cyan');
    log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE IMPORT'}`, dryRun ? 'yellow' : 'green');
    log('');

    // Parse file based on extension
    let records;
    const ext = path.extname(resolvedPath).toLowerCase();

    try {
        if (ext === '.csv') {
            records = parseCSV(resolvedPath);
        } else if (ext === '.json') {
            records = parseJSON(resolvedPath);
        } else {
            log(`Error: Unsupported file format: ${ext}. Use .csv or .json`, 'red');
            process.exit(1);
        }

        log(`Parsed ${records.length} records from file`, 'green');

        // Show sample record
        if (records.length > 0) {
            log('\nSample record:', 'cyan');
            const sample = records[0];
            log(`  Subject: ${sample.subjectId}`);
            log(`  Scores: harm=${sample.scores.harm}, fairness=${sample.scores.fairness}, loyalty=${sample.scores.loyalty}, authority=${sample.scores.authority}, purity=${sample.scores.purity}`);
            log(`  Levels: harm=${scoreToLevel(sample.scores.harm, thresholds)}, fairness=${scoreToLevel(sample.scores.fairness, thresholds)}, ...`);
        }

    } catch (error) {
        log(`Error parsing file: ${error.message}`, 'red');
        process.exit(1);
    }

    // If dry run, stop here
    if (dryRun) {
        log('\n✅ Dry run complete. No changes made to database.', 'green');
        process.exit(0);
    }

    // Connect to database and import
    try {
        log('\nConnecting to database...', 'cyan');
        await connectDB();
        log('Connected to MongoDB', 'green');

        log('\nImporting scores...', 'cyan');
        const results = await importScores(records, resolvedPath, thresholds);

        log('\n📊 Import Results:', 'blue');
        log(`  Created: ${results.created}`, 'green');
        log(`  Updated: ${results.updated}`, 'yellow');
        log(`  Errors:  ${results.errors.length}`, results.errors.length > 0 ? 'red' : 'green');

        if (results.errors.length > 0) {
            log('\nErrors:', 'red');
            results.errors.forEach(err => {
                log(`  ${err.subjectId}: ${err.error}`, 'red');
            });
        }

        log('\n✅ Import complete!', 'green');

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

#!/usr/bin/env node
/**
 * Database Cleanup Script
 *
 * Cleans test data from MongoDB collections.
 * Use with caution - this permanently deletes data!
 */

const { execSync } = require('child_process');
const readline = require('readline');

// Get database name from environment or use default
const DB_NAME = process.env.MONGODB_URI?.split('/').pop() || 'collective_reward_exp';
const CONTAINER_NAME = 'collective-bandit-mongodb';

// Get command line arguments
const args = process.argv.slice(2);

// Parse arguments
let experimentName = null;
let allFlag = false;
let confirmFlag = false;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--all' || arg === '-a') {
        allFlag = true;
    } else if (arg === '--confirm' || arg === '-y') {
        confirmFlag = true;
    } else if (arg === '--exp' || arg === '-e') {
        experimentName = args[i + 1];
        i++; // Skip next argument (the experiment name)
    } else if (arg === '--help' || arg === '-h') {
        // Help flag handled later
    } else if (!arg.startsWith('--') && !arg.startsWith('-')) {
        // Positional argument (experiment name)
        experimentName = arg;
    }
}

// Color codes for terminal output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Prompt user for confirmation
 * @param {string} question - The question to ask
 * @returns {Promise<boolean>} - True if user confirmed (y), false otherwise
 */
function askConfirmation(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${colors.yellow}${question} (y/N): ${colors.reset}`, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
}

function showUsage() {
    log('\n📚 Database Cleanup Script', 'blue');
    log('='.repeat(50), 'blue');
    log(`\nDatabase: ${DB_NAME}`, 'blue');
    log('\nUsage:', 'yellow');
    log('  npm run db:clean --exp "experiment-name" [--confirm]');
    log('  npm run db:clean --all [--confirm]');
    log('  npm run db:clean "experiment-name" [--confirm]  # Positional argument');
    log('\nExamples:', 'yellow');
    log('  npm run db:clean --exp "Quick Test" --confirm   # Clean specific experiment');
    log('  npm run db:clean "Quick Test" --confirm         # Same, using positional arg');
    log('  npm run db:clean --all --confirm                # Clean all data');
    log('  npm run db:clean "Quick Test"                   # Interactive confirmation');
    log('\nOptions:', 'yellow');
    log('  --exp, -e       Experiment name to clean');
    log('  --all, -a       Clean all experiments (use with caution!)');
    log('  --confirm, -y   Skip interactive confirmation');
    log('  --help, -h      Show this help message');
    log('\nCollections cleaned:', 'yellow');
    log('  • trials        Trial-level data');
    log('  • sessions      Session records');
    log('  • experiments   Experiment metadata (when using --all)');
    log('\n⚠️  WARNING: This permanently deletes data!\n', 'red');
}

async function cleanExperiment(expName) {
    log(`\n🧹 Cleaning data for experiment: "${expName}"`, 'yellow');

    try {
        // Count documents before deletion
        const trialsCount = execSync(
            `docker exec ${CONTAINER_NAME} mongosh ${DB_NAME} --quiet --eval "db.trials.countDocuments({experimentName: '${expName}'})"`,
            { encoding: 'utf-8' }
        ).trim();

        const sessionsCount = execSync(
            `docker exec ${CONTAINER_NAME} mongosh ${DB_NAME} --quiet --eval "db.sessions.countDocuments({experimentName: '${expName}'})"`,
            { encoding: 'utf-8' }
        ).trim();

        log(`\nFound:`, 'blue');
        log(`  • ${trialsCount} trials`);
        log(`  • ${sessionsCount} sessions`);

        if (trialsCount === '0' && sessionsCount === '0') {
            log('\n✅ No data to clean!', 'green');
            return;
        }

        // Ask for confirmation if not using --confirm flag
        if (!confirmFlag) {
            const confirmed = await askConfirmation('\nAre you sure you want to delete this data?');
            if (!confirmed) {
                log('\n❌ Operation cancelled', 'red');
                return;
            }
        }

        // Delete trials
        log('\n🗑️  Deleting trials...', 'yellow');
        execSync(
            `docker exec ${CONTAINER_NAME} mongosh ${DB_NAME} --quiet --eval "db.trials.deleteMany({experimentName: '${expName}'})"`,
            { stdio: 'inherit' }
        );

        // Delete sessions
        log('🗑️  Deleting sessions...', 'yellow');
        execSync(
            `docker exec ${CONTAINER_NAME} mongosh ${DB_NAME} --quiet --eval "db.sessions.deleteMany({experimentName: '${expName}'})"`,
            { stdio: 'inherit' }
        );

        log(`\n✅ Successfully cleaned data for "${expName}"`, 'green');
    } catch (error) {
        log(`\n❌ Error cleaning database: ${error.message}`, 'red');
        log('\nMake sure Docker is running and the MongoDB container is up:', 'yellow');
        log('  npm run docker:up\n', 'yellow');
        process.exit(1);
    }
}

async function cleanAll() {
    log('\n🧹 Cleaning ALL experiment data', 'red');
    log('⚠️  This will delete EVERYTHING!', 'red');

    try {
        // Count all documents
        const trialsCount = execSync(
            `docker exec ${CONTAINER_NAME} mongosh ${DB_NAME} --quiet --eval "db.trials.countDocuments({})"`,
            { encoding: 'utf-8' }
        ).trim();

        const sessionsCount = execSync(
            `docker exec ${CONTAINER_NAME} mongosh ${DB_NAME} --quiet --eval "db.sessions.countDocuments({})"`,
            { encoding: 'utf-8' }
        ).trim();

        const experimentsCount = execSync(
            `docker exec ${CONTAINER_NAME} mongosh ${DB_NAME} --quiet --eval "db.experiments.countDocuments({})"`,
            { encoding: 'utf-8' }
        ).trim();

        log(`\nFound:`, 'blue');
        log(`  • ${trialsCount} trials`);
        log(`  • ${sessionsCount} sessions`);
        log(`  • ${experimentsCount} experiments`);

        if (trialsCount === '0' && sessionsCount === '0' && experimentsCount === '0') {
            log('\n✅ Database is already empty!', 'green');
            return;
        }

        // Ask for confirmation if not using --confirm flag
        if (!confirmFlag) {
            log('\n⚠️  WARNING: This will permanently delete ALL data from ALL experiments!', 'red');
            const confirmed = await askConfirmation('Are you sure you want to delete EVERYTHING?');
            if (!confirmed) {
                log('\n❌ Operation cancelled', 'red');
                return;
            }
        }

        // Drop all collections
        log('\n🗑️  Dropping all collections...', 'yellow');
        execSync(
            `docker exec ${CONTAINER_NAME} mongosh ${DB_NAME} --quiet --eval "db.trials.deleteMany({})"`,
            { stdio: 'inherit' }
        );
        execSync(
            `docker exec ${CONTAINER_NAME} mongosh ${DB_NAME} --quiet --eval "db.sessions.deleteMany({})"`,
            { stdio: 'inherit' }
        );
        execSync(
            `docker exec ${CONTAINER_NAME} mongosh ${DB_NAME} --quiet --eval "db.experiments.deleteMany({})"`,
            { stdio: 'inherit' }
        );

        log('\n✅ Successfully cleaned all data', 'green');
    } catch (error) {
        log(`\n❌ Error cleaning database: ${error.message}`, 'red');
        log('\nMake sure Docker is running and the MongoDB container is up:', 'yellow');
        log('  npm run docker:up\n', 'yellow');
        process.exit(1);
    }
}

// Main execution
(async function main() {
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        showUsage();
        process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
    }

    if (!allFlag && !experimentName) {
        log('\n❌ Missing experiment name or --all flag', 'red');
        showUsage();
        process.exit(1);
    }

    if (allFlag) {
        await cleanAll();
    } else if (experimentName) {
        await cleanExperiment(experimentName);
    }
})();

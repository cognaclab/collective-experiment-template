/**
 * MongoDB Connection Manager
 *
 * Provides centralized database connection for the application.
 * Automatically connects on first import.
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Get MongoDB URI from environment or use default
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/collective_reward_exp';

// Connection state
let isConnected = false;
let isConnecting = false;

/**
 * Connect to MongoDB
 * @returns {Promise<mongoose.Connection>}
 */
async function connect() {
    if (isConnected) {
        return mongoose.connection;
    }

    if (isConnecting) {
        // Wait for existing connection attempt
        return new Promise((resolve, reject) => {
            const checkConnection = setInterval(() => {
                if (isConnected) {
                    clearInterval(checkConnection);
                    resolve(mongoose.connection);
                } else if (!isConnecting) {
                    clearInterval(checkConnection);
                    reject(new Error('Connection attempt failed'));
                }
            }, 100);

            // Timeout after 30 seconds
            setTimeout(() => {
                clearInterval(checkConnection);
                reject(new Error('Connection timeout'));
            }, 30000);
        });
    }

    isConnecting = true;

    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        isConnected = true;
        isConnecting = false;

        logger.info('MongoDB connected successfully', {
            uri: MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'), // Hide password in logs
            database: mongoose.connection.name
        });

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB connection error', { error: err.message });
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
            isConnected = false;
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected');
            isConnected = true;
        });

        return mongoose.connection;
    } catch (error) {
        isConnecting = false;
        isConnected = false;

        logger.error('Failed to connect to MongoDB', {
            error: error.message,
            uri: MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')
        });

        throw error;
    }
}

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
async function disconnect() {
    if (!isConnected) {
        return;
    }

    try {
        await mongoose.disconnect();
        isConnected = false;
        logger.info('MongoDB disconnected gracefully');
    } catch (error) {
        logger.error('Error disconnecting from MongoDB', { error: error.message });
        throw error;
    }
}

/**
 * Get connection status
 * @returns {boolean}
 */
function getConnectionStatus() {
    return isConnected;
}

// Auto-connect on module load
connect().catch((error) => {
    logger.error('Auto-connect failed', { error: error.message });
});

module.exports = {
    connect,
    disconnect,
    getConnectionStatus,
    mongoose
};

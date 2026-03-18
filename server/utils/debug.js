/**
 * Debug logging utility
 * 
 * Provides controlled debug output that can be toggled via LOG_LEVEL environment variable.
 * Set LOG_LEVEL=debug to see all debug messages, or LOG_LEVEL=info to suppress them.
 */

const isDebugEnabled = process.env.LOG_LEVEL === 'debug';

/**
 * Log debug message - only shows if LOG_LEVEL=debug
 * @param  {...any} args - Arguments to log
 */
function debug(...args) {
    if (isDebugEnabled) {
        console.log(...args);
    }
}

/**
 * Log important message - always shows on console
 * Use for: user connections, room assignments, game starts, completions
 * @param  {...any} args - Arguments to log
 */
function important(...args) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${timestamp} [OK]`, ...args);
}

/**
 * Log player event - shows room, player info in clean format
 * @param {string} action - What happened (e.g., 'joined', 'chose', 'disconnected')
 * @param {object} details - Event details
 */
function playerEvent(action, details) {
    const timestamp = new Date().toLocaleTimeString();
    const { player, room, ...rest } = details;
    const extras = Object.keys(rest).length > 0 ? ` | ${JSON.stringify(rest)}` : '';
    console.log(`${timestamp} [PLAYER] [${room || 'unknown'}] ${player || 'unknown'} ${action}${extras}`);
}

/**
 * Log game event - shows room, trial info in clean format
 * @param {string} action - What happened (e.g., 'started', 'trial complete')
 * @param {object} details - Event details
 */
function gameEvent(action, details) {
    const timestamp = new Date().toLocaleTimeString();
    const { room, trial, ...rest } = details;
    const extras = Object.keys(rest).length > 0 ? ` | ${JSON.stringify(rest)}` : '';
    console.log(`${timestamp} [GAME] [${room || 'unknown'}] ${action}${trial ? ` (trial ${trial})` : ''}${extras}`);
}

module.exports = {
    debug,
    important,
    playerEvent,
    gameEvent,
    isDebugEnabled
};

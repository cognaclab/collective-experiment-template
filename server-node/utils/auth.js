/**
 * Admin authentication utilities
 */

const crypto = require('crypto');

// Auto-generate token if not set in environment
const ENV_TOKEN = process.env.RIKEN_ADMIN_TOKEN;
const TOKEN_AUTO = ENV_TOKEN === undefined;
const ADMIN_TOKEN = TOKEN_AUTO
    ? crypto.randomBytes(24).toString('base64url')
    : (ENV_TOKEN || '').trim();

/**
 * Get the current admin token
 */
function getAdminToken() {
    return ADMIN_TOKEN;
}

/**
 * Check if token was auto-generated
 */
function isTokenAuto() {
    return TOKEN_AUTO;
}

/**
 * Check if a request is authorized for admin operations
 */
function isAdminAuthorized(headers, query) {
    const required = getAdminToken();
    if (!required) return true; // Token disabled

    // Check header first
    const headerToken = headers['x-admin-token'];
    if (headerToken && headerToken.trim() === required) {
        return true;
    }

    // Check query param fallback
    const queryToken = query.token?.[0] || '';
    return queryToken.trim() === required;
}

module.exports = {
    getAdminToken,
    isTokenAuto,
    isAdminAuthorized
};

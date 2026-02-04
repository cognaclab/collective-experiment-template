/**
 * Config endpoint handlers
 * GET /api/config - Read runtime config
 * POST /api/config - Write runtime config
 * POST /api/config/reset - Reset runtime config
 */

const fs = require('fs');
const path = require('path');
const { nowIso, atomicWrite, ensureDir } = require('../utils/file');
const { isAdminAuthorized, getAdminToken } = require('../utils/auth');

const RUNTIME_CONFIG_PATH = path.join('server', 'runtime_config.json');

/**
 * Read runtime config from disk
 */
function readRuntimeConfig() {
    try {
        if (!fs.existsSync(RUNTIME_CONFIG_PATH)) {
            return {};
        }
        const content = fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf8');
        const cfg = JSON.parse(content);
        return typeof cfg === 'object' && cfg !== null ? cfg : {};
    } catch (e) {
        return {};
    }
}

/**
 * Write runtime config to disk
 */
function writeRuntimeConfig(cfg) {
    try {
        ensureDir(path.dirname(RUNTIME_CONFIG_PATH));
        const data = JSON.stringify(cfg, null, 2);
        atomicWrite(RUNTIME_CONFIG_PATH, data);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

/**
 * Reset (delete) runtime config
 */
function resetRuntimeConfig() {
    try {
        if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
            fs.unlinkSync(RUNTIME_CONFIG_PATH);
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

/**
 * GET /api/config
 */
function handleConfigGet(req, res) {
    const cfg = readRuntimeConfig();

    let updatedAt = null;
    try {
        if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
            const stats = fs.statSync(RUNTIME_CONFIG_PATH);
            updatedAt = stats.mtime.toISOString().replace(/\.\d{3}Z$/, 'Z');
        }
    } catch (e) {
        // ignore
    }

    return {
        ok: true,
        config: cfg,
        updatedAt,
        tokenRequired: Boolean(getAdminToken())
    };
}

/**
 * POST /api/config
 */
function handleConfigPost(req, res, body, query) {
    if (!isAdminAuthorized(req.headers, query)) {
        return { status: 403, body: { ok: false, error: 'forbidden' } };
    }

    let payload;
    try {
        payload = JSON.parse(body);
    } catch (e) {
        return { status: 400, body: { ok: false, error: 'invalid json' } };
    }

    // Accept either { config: {...} } or {...} directly
    let cfg = payload.config !== undefined ? payload.config : payload;
    if (typeof cfg !== 'object' || cfg === null) {
        return { status: 400, body: { ok: false, error: 'invalid config' } };
    }

    const result = writeRuntimeConfig(cfg);
    if (!result.ok) {
        return { status: 500, body: { ok: false, error: result.error } };
    }

    return { status: 200, body: { ok: true, saved: true, updatedAt: nowIso() } };
}

/**
 * POST /api/config/reset
 */
function handleConfigReset(req, res, query) {
    if (!isAdminAuthorized(req.headers, query)) {
        return { status: 403, body: { ok: false, error: 'forbidden' } };
    }

    const result = resetRuntimeConfig();
    if (!result.ok) {
        return { status: 500, body: { ok: false, error: result.error } };
    }

    return { status: 200, body: { ok: true, reset: true, updatedAt: nowIso() } };
}

module.exports = {
    handleConfigGet,
    handleConfigPost,
    handleConfigReset
};

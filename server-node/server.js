#!/usr/bin/env node
/**
 * RIKEN Survey — Node.js Server
 * ==============================
 * 
 * A Node.js port of the Python survey server.
 * No external dependencies required (uses only Node.js built-in modules).
 * 
 * Usage:
 *   node server.js [--host 0.0.0.0] [--port 8000]
 * 
 * Environment variables:
 *   RIKEN_HOST - Host to bind to (default: 0.0.0.0)
 *   RIKEN_PORT - Port to listen on (default: 8000)
 *   RIKEN_OUTPUT_DIR - Output directory (default: output)
 *   RIKEN_BACKUP_DIR - Backup directory (default: output_backup)
 *   RIKEN_ADMIN_TOKEN - Admin token for privileged endpoints
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Handlers
const { handleStatus } = require('./handlers/status');
const { handleConfigGet, handleConfigPost, handleConfigReset } = require('./handlers/config');
const { handleExportList, handleExportDownload, handleExportZip } = require('./handlers/export');
const { handleSave } = require('./handlers/save');

// Utils
const { nowIso, ensureDir, atomicWrite, dirWritable } = require('./utils/file');
const { getAdminToken, isTokenAuto } = require('./utils/auth');

// MIME type mapping
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

// Blocked paths (directories and extensions)
const BLOCKED_PATHS = ['/output', '/output_backup', '/server', '/server-node'];
const BLOCKED_EXTENSIONS = ['.py', '.jsonl', '.tsv', '.zip'];

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {
        host: process.env.RIKEN_HOST || '0.0.0.0',
        port: parseInt(process.env.RIKEN_PORT || '8000', 10)
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--host' && args[i + 1]) {
            result.host = args[++i];
        } else if (args[i] === '--port' && args[i + 1]) {
            result.port = parseInt(args[++i], 10);
        }
    }

    return result;
}

/**
 * Parse query string into object
 */
function parseQuery(queryString) {
    const result = {};
    if (!queryString) return result;

    for (const pair of queryString.split('&')) {
        const [key, value] = pair.split('=').map(decodeURIComponent);
        if (!result[key]) result[key] = [];
        result[key].push(value || '');
    }

    return result;
}

/**
 * Send JSON response
 */
function sendJson(res, obj, status = 200) {
    const body = JSON.stringify(obj, null, 2);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token'
    });
    res.end(body);
}

/**
 * Send binary response
 */
function sendBinary(res, content, contentType, filename, status = 200) {
    const headers = {
        'Content-Type': contentType,
        'Content-Length': content.length,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token'
    };
    if (filename) {
        headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    }
    res.writeHead(status, headers);
    res.end(content);
}

/**
 * Send 404 Not Found
 */
function send404(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
}

/**
 * Read request body
 */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

/**
 * Serve static file
 */
function serveStatic(req, res, filePath, surveyRoot) {
    const absPath = path.join(surveyRoot, filePath);
    const realPath = path.resolve(absPath);

    // Ensure we're within the survey root
    if (!realPath.startsWith(surveyRoot + path.sep) && realPath !== surveyRoot) {
        send404(res);
        return;
    }

    if (!fs.existsSync(realPath)) {
        send404(res);
        return;
    }

    const stats = fs.statSync(realPath);

    // If it's a directory, try index.html
    if (stats.isDirectory()) {
        const indexPath = path.join(realPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(content);
            return;
        }
        send404(res);
        return;
    }

    // Serve the file
    const ext = path.extname(realPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const content = fs.readFileSync(realPath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
}

/**
 * Main request handler
 */
async function handleRequest(req, res, config, surveyRoot) {
    const parsed = url.parse(req.url || '');
    let pathname = (parsed.pathname || '/').replace(/\/+$/, '') || '/';
    const query = parseQuery(parsed.query);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token'
        });
        res.end();
        return;
    }

    // API routes
    if (pathname.startsWith('/api/')) {
        // GET endpoints
        if (req.method === 'GET') {
            if (pathname === '/api/status') {
                const result = handleStatus(req, res, config);
                sendJson(res, result);
                return;
            }

            if (pathname === '/api/ping') {
                sendJson(res, { ok: true, pong: true, serverTime: nowIso() });
                return;
            }

            if (pathname === '/api/config') {
                const result = handleConfigGet(req, res);
                sendJson(res, result);
                return;
            }

            if (pathname === '/api/export/list') {
                const result = handleExportList(req, res, query, config);
                if (result.binary) {
                    sendBinary(res, result.content, result.contentType, result.filename, result.status);
                } else {
                    sendJson(res, result.body, result.status);
                }
                return;
            }

            if (pathname === '/api/export/download') {
                const result = handleExportDownload(req, res, query, config);
                if (result.binary) {
                    sendBinary(res, result.content, result.contentType, result.filename, result.status);
                } else {
                    sendJson(res, result.body, result.status);
                }
                return;
            }

            if (pathname === '/api/export/zip') {
                const result = handleExportZip(req, res, query, config);
                if (result.binary) {
                    sendBinary(res, result.content, result.contentType, result.filename, result.status);
                } else {
                    sendJson(res, result.body, result.status);
                }
                return;
            }
        }

        // POST endpoints
        if (req.method === 'POST') {
            const body = await readBody(req);

            if (pathname === '/api/config') {
                const result = handleConfigPost(req, res, body, query);
                sendJson(res, result.body, result.status);
                return;
            }

            if (pathname === '/api/config/reset') {
                const result = handleConfigReset(req, res, query);
                sendJson(res, result.body, result.status);
                return;
            }

            if (pathname === '/api/save') {
                const result = handleSave(req, res, body, config);
                sendJson(res, result.body, result.status);
                return;
            }
        }

        send404(res);
        return;
    }

    // Block protected paths
    for (const blocked of BLOCKED_PATHS) {
        if (pathname.startsWith(blocked)) {
            send404(res);
            return;
        }
    }

    // Block protected extensions
    for (const ext of BLOCKED_EXTENSIONS) {
        if (pathname.endsWith(ext)) {
            send404(res);
            return;
        }
    }

    // Serve static files (only GET)
    if (req.method !== 'GET') {
        send404(res);
        return;
    }

    // Default to index.html for root
    let filePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    serveStatic(req, res, filePath, surveyRoot);
}

/**
 * Main function
 */
function main() {
    const args = parseArgs();

    // Survey root is parent of server-node directory
    const surveyRoot = path.resolve(__dirname, '..');
    process.chdir(surveyRoot);

    const config = {
        host: args.host,
        port: args.port,
        outputDir: process.env.RIKEN_OUTPUT_DIR || 'output',
        backupDir: process.env.RIKEN_BACKUP_DIR || 'output_backup'
    };

    const outAbs = path.resolve(config.outputDir);
    const bakAbs = path.resolve(config.backupDir);

    // Check directories are writable
    const outCheck = dirWritable(outAbs);
    const bakCheck = dirWritable(bakAbs);

    if (!outCheck.ok || !bakCheck.ok) {
        console.error('\nERROR: Output directories are not writable.');
        console.error(`  output: ${outAbs}  writable=${outCheck.ok}  err=${outCheck.error}`);
        console.error(`  backup: ${bakAbs}  writable=${bakCheck.ok}  err=${bakCheck.error}`);
        console.error('Fix permissions or set RIKEN_OUTPUT_DIR / RIKEN_BACKUP_DIR.');
        process.exit(1);
    }

    // Write startup marker
    try {
        atomicWrite(path.join(config.outputDir, '_SERVER_STARTED.txt'), `startedAt\t${nowIso()}\n`);
        atomicWrite(path.join(config.backupDir, '_SERVER_STARTED.txt'), `startedAt\t${nowIso()}\n`);
    } catch (e) {
        // ignore
    }

    // Create server
    const server = http.createServer((req, res) => {
        handleRequest(req, res, config, surveyRoot).catch(err => {
            console.error('Request error:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        });
    });

    server.listen(config.port, config.host, () => {
        console.log(`Serving RIKEN survey from: ${surveyRoot}`);
        console.log(`Open: http://localhost:${config.port}/`);
        console.log(`Autosaving to: ${outAbs}/ and backup to ${bakAbs}/`);

        if (getAdminToken() && isTokenAuto()) {
            console.log(`Admin token (auto-generated): ${getAdminToken()}`);
            console.log('  - Enter this token in launcher.html to save settings / download exports');
            console.log('  - To set a fixed token: export RIKEN_ADMIN_TOKEN=...');
            console.log('  - To disable token (NOT recommended): export RIKEN_ADMIN_TOKEN=');
        }

        console.log(`Health check: http://localhost:${config.port}/api/status`);
    });

    // Handle shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down');
        server.close();
        process.exit(0);
    });
}

main();

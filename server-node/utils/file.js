/**
 * File utilities for the RIKEN survey server
 * Provides atomic writes, locked appends, and TSV helpers
 */

const fs = require('fs');
const path = require('path');

/**
 * Get current ISO timestamp in UTC
 */
function nowIso() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Ensure a directory exists (creates recursively if needed)
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Sanitize an ID string (alphanumeric, dash, underscore only)
 */
function safeId(raw) {
    const str = String(raw || '');
    return str.replace(/[^a-zA-Z0-9_-]/g, '') || 'unknown';
}

/**
 * Escape a value for TSV format
 */
function tsvEscape(v) {
    if (v === null || v === undefined) return '';
    return String(v)
        .replace(/\t/g, ' ')
        .replace(/\r\n/g, '\\n')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\n');
}

/**
 * Write data atomically (write to temp, then rename)
 */
function atomicWrite(filePath, data) {
    const tmpPath = filePath + '.tmp';
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(tmpPath, data);
    fs.renameSync(tmpPath, filePath);
}

/**
 * Append to a file with best-effort locking
 * Node.js doesn't have flock, but we use writeFileSync which is generally safe
 */
function lockedAppend(filePath, text) {
    ensureDir(path.dirname(filePath));
    fs.appendFileSync(filePath, text, 'utf8');
}

/**
 * Read a TSV file into headers and rows keyed by a column
 */
function readTsvTable(filePath, keyCol) {
    if (!fs.existsSync(filePath)) {
        return { headers: [], rowsByKey: {} };
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(ln => ln.trim());

        if (!lines.length) {
            return { headers: [], rowsByKey: {} };
        }

        const headers = lines[0].split('\t');
        const keyIdx = headers.indexOf(keyCol);

        if (keyIdx === -1) {
            return { headers, rowsByKey: {} };
        }

        const rowsByKey = {};
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split('\t');
            const row = {};
            headers.forEach((h, idx) => {
                row[h] = idx < parts.length ? parts[idx] : '';
            });
            const key = row[keyCol];
            if (key) {
                rowsByKey[key] = row;
            }
        }

        return { headers, rowsByKey };
    } catch (e) {
        return { headers: [], rowsByKey: {} };
    }
}

/**
 * Write a TSV table to a file
 */
function writeTsvTable(filePath, headers, rows) {
    ensureDir(path.dirname(filePath));
    const headerLine = headers.join('\t') + '\n';
    const body = rows.map(row => {
        return headers.map(h => tsvEscape(row[h])).join('\t');
    }).join('\n') + (rows.length ? '\n' : '');
    atomicWrite(filePath, headerLine + body);
}

/**
 * Convert row to TSV line
 */
function toTsvLine(headers, row) {
    return headers.map(h => tsvEscape(row[h])).join('\t') + '\n';
}

/**
 * Check if a directory is writable
 */
function dirWritable(dirPath) {
    try {
        ensureDir(dirPath);
        const testPath = path.join(dirPath, '.__write_test__');
        fs.writeFileSync(testPath, 'ok');
        fs.unlinkSync(testPath);
        return { ok: true, error: null };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

/**
 * Try to create a flag file (returns true only if newly created)
 */
function tryCreateFlag(flagPath) {
    ensureDir(path.dirname(flagPath));
    try {
        fs.writeFileSync(flagPath, '', { flag: 'wx' });
        return true;
    } catch (e) {
        if (e.code === 'EEXIST') return false;
        return false;
    }
}

/**
 * Read the last JSON object from a JSONL file
 */
function tailLastJsonl(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(ln => ln.trim());
        if (!lines.length) return null;
        return JSON.parse(lines[lines.length - 1]);
    } catch (e) {
        return null;
    }
}

/**
 * Get file stats safely
 */
function safeStats(filePath) {
    try {
        return fs.statSync(filePath);
    } catch (e) {
        return null;
    }
}

/**
 * Inject/overwrite columns in a TSV string
 */
function injectTsvColumns(tsvText, cols) {
    if (!tsvText) return tsvText;

    const lines = tsvText.split('\n').filter(ln => ln.trim());
    if (!lines.length) return tsvText;

    const header = lines[0].split('\t');
    const colNames = Object.keys(cols);
    const missing = colNames.filter(c => !header.includes(c));
    const newHeader = [...missing, ...header];

    const idxExisting = {};
    colNames.forEach(c => {
        if (header.includes(c)) {
            idxExisting[c] = header.indexOf(c);
        }
    });

    const outLines = [newHeader.join('\t')];

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split('\t');
        // Pad to original header length
        while (parts.length < header.length) parts.push('');

        // Overwrite existing cols in-place
        for (const [c, idx] of Object.entries(idxExisting)) {
            parts[idx] = tsvEscape(cols[c]);
        }

        // Prefix missing cols
        const prefixVals = missing.map(c => tsvEscape(cols[c]));
        outLines.push([...prefixVals, ...parts].join('\t'));
    }

    return outLines.join('\n') + '\n';
}

module.exports = {
    nowIso,
    ensureDir,
    safeId,
    tsvEscape,
    atomicWrite,
    lockedAppend,
    readTsvTable,
    writeTsvTable,
    toTsvLine,
    dirWritable,
    tryCreateFlag,
    tailLastJsonl,
    safeStats,
    injectTsvColumns
};

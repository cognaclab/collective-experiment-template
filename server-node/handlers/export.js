/**
 * Export endpoint handlers
 * GET /api/export/list - List exportable files
 * GET /api/export/download - Download a single file
 * GET /api/export/zip - Download a ZIP archive
 */

const fs = require('fs');
const path = require('path');
const { isAdminAuthorized } = require('../utils/auth');

// We'll use Node.js built-in zlib for compression
const zlib = require('zlib');

/**
 * List exportable files in output directory
 */
function listExportFiles(outDir) {
    const baseAbs = path.resolve(outDir);
    const files = [];

    function addFromDir(relDir) {
        const absDir = relDir ? path.join(baseAbs, relDir) : baseAbs;
        if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
            return;
        }

        for (const name of fs.readdirSync(absDir).sort()) {
            const absPath = path.join(absDir, name);
            if (fs.statSync(absPath).isDirectory()) continue;
            if (name.startsWith('.')) continue;
            if (!name.endsWith('.tsv') && !name.endsWith('.json') && !name.endsWith('.jsonl')) {
                continue;
            }

            const relPath = relDir ? `${relDir}/${name}` : name;
            try {
                const stats = fs.statSync(absPath);
                files.push({
                    path: relPath,
                    size: stats.size,
                    modifiedAt: stats.mtime.toISOString().replace(/\.\d{3}Z$/, 'Z')
                });
            } catch (e) {
                files.push({ path: relPath, size: null, modifiedAt: null });
            }
        }
    }

    addFromDir('');
    addFromDir('group');

    // Remove server startup markers
    const filtered = files.filter(f => !f.path.startsWith('_SERVER_STARTED'));

    // Sort: group first, then root
    filtered.sort((a, b) => {
        const aGroup = a.path.startsWith('group/') ? 0 : 1;
        const bGroup = b.path.startsWith('group/') ? 0 : 1;
        if (aGroup !== bGroup) return aGroup - bGroup;
        return a.path.localeCompare(b.path);
    });

    return filtered;
}

/**
 * Validate and resolve an export path (prevent directory traversal)
 */
function safeExportPath(relPath, outDir) {
    if (!relPath) return null;

    relPath = relPath.replace(/\\/g, '/');
    if (relPath.startsWith('/')) return null;

    const norm = path.normalize(relPath);
    if (norm.startsWith('..')) return null;

    const baseAbs = path.resolve(outDir);
    const absPath = path.resolve(path.join(baseAbs, norm));

    if (!absPath.startsWith(baseAbs + path.sep)) return null;
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) return null;

    return absPath;
}

/**
 * GET /api/export/list
 */
function handleExportList(req, res, query, config) {
    if (!isAdminAuthorized(req.headers, query)) {
        return { status: 403, body: { ok: false, error: 'forbidden' } };
    }

    const outDir = config.outputDir;
    return {
        status: 200,
        body: {
            ok: true,
            outputDir: outDir,
            outputDirAbs: path.resolve(outDir),
            files: listExportFiles(outDir)
        }
    };
}

/**
 * GET /api/export/download
 */
function handleExportDownload(req, res, query, config) {
    if (!isAdminAuthorized(req.headers, query)) {
        return { status: 403, body: { ok: false, error: 'forbidden' } };
    }

    const relPath = (query.path || [''])[0];
    const absPath = safeExportPath(relPath, config.outputDir);

    if (!absPath) {
        return { status: 404, body: { ok: false, error: 'not found' } };
    }

    try {
        const content = fs.readFileSync(absPath);
        const name = path.basename(absPath);

        let contentType = 'application/octet-stream';
        if (name.endsWith('.tsv')) {
            contentType = 'text/tab-separated-values; charset=utf-8';
        } else if (name.endsWith('.json') || name.endsWith('.jsonl')) {
            contentType = 'application/json; charset=utf-8';
        }

        return {
            status: 200,
            binary: true,
            content,
            contentType,
            filename: name
        };
    } catch (e) {
        return { status: 500, body: { ok: false, error: e.message } };
    }
}

/**
 * Create a ZIP archive of files
 * Uses a simple ZIP format implementation (no external dependencies)
 */
function createZipBuffer(rootAbs, arcPrefix) {
    // Simple ZIP creation - we'll collect files and create a basic uncompressed ZIP
    // For a production system, you might want to use a proper library

    const files = [];

    function walkDir(dir, relBase) {
        if (!fs.existsSync(dir)) return;

        for (const name of fs.readdirSync(dir)) {
            const absPath = path.join(dir, name);
            const relPath = relBase ? `${relBase}/${name}` : name;
            const stats = fs.statSync(absPath);

            if (stats.isDirectory()) {
                walkDir(absPath, relPath);
            } else {
                files.push({
                    path: arcPrefix ? `${arcPrefix}/${relPath}` : relPath,
                    content: fs.readFileSync(absPath)
                });
            }
        }
    }

    walkDir(rootAbs, '');

    // Build ZIP file manually (store method, no compression for simplicity)
    const parts = [];
    const centralDirectory = [];
    let offset = 0;

    for (const file of files) {
        const nameBuffer = Buffer.from(file.path, 'utf8');
        const content = file.content;
        const crc = crc32(content);

        // Local file header
        const localHeader = Buffer.alloc(30 + nameBuffer.length);
        localHeader.writeUInt32LE(0x04034b50, 0); // signature
        localHeader.writeUInt16LE(20, 4); // version needed
        localHeader.writeUInt16LE(0, 6); // flags
        localHeader.writeUInt16LE(0, 8); // compression (store)
        localHeader.writeUInt16LE(0, 10); // mod time
        localHeader.writeUInt16LE(0, 12); // mod date
        localHeader.writeUInt32LE(crc, 14); // crc32
        localHeader.writeUInt32LE(content.length, 18); // compressed size
        localHeader.writeUInt32LE(content.length, 22); // uncompressed size
        localHeader.writeUInt16LE(nameBuffer.length, 26); // filename length
        localHeader.writeUInt16LE(0, 28); // extra field length
        nameBuffer.copy(localHeader, 30);

        parts.push(localHeader);
        parts.push(content);

        // Central directory entry
        const cdEntry = Buffer.alloc(46 + nameBuffer.length);
        cdEntry.writeUInt32LE(0x02014b50, 0); // signature
        cdEntry.writeUInt16LE(20, 4); // version made by
        cdEntry.writeUInt16LE(20, 6); // version needed
        cdEntry.writeUInt16LE(0, 8); // flags
        cdEntry.writeUInt16LE(0, 10); // compression
        cdEntry.writeUInt16LE(0, 12); // mod time
        cdEntry.writeUInt16LE(0, 14); // mod date
        cdEntry.writeUInt32LE(crc, 16); // crc32
        cdEntry.writeUInt32LE(content.length, 20); // compressed size
        cdEntry.writeUInt32LE(content.length, 24); // uncompressed size
        cdEntry.writeUInt16LE(nameBuffer.length, 28); // filename length
        cdEntry.writeUInt16LE(0, 30); // extra field length
        cdEntry.writeUInt16LE(0, 32); // comment length
        cdEntry.writeUInt16LE(0, 34); // disk number
        cdEntry.writeUInt16LE(0, 36); // internal file attrs
        cdEntry.writeUInt32LE(0, 38); // external file attrs
        cdEntry.writeUInt32LE(offset, 42); // relative offset
        nameBuffer.copy(cdEntry, 46);

        centralDirectory.push(cdEntry);
        offset += localHeader.length + content.length;
    }

    // Central directory
    const cdStart = offset;
    for (const cd of centralDirectory) {
        parts.push(cd);
        offset += cd.length;
    }
    const cdSize = offset - cdStart;

    // End of central directory
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // signature
    eocd.writeUInt16LE(0, 4); // disk number
    eocd.writeUInt16LE(0, 6); // cd disk number
    eocd.writeUInt16LE(files.length, 8); // entries on disk
    eocd.writeUInt16LE(files.length, 10); // total entries
    eocd.writeUInt32LE(cdSize, 12); // cd size
    eocd.writeUInt32LE(cdStart, 16); // cd offset
    eocd.writeUInt16LE(0, 20); // comment length
    parts.push(eocd);

    return Buffer.concat(parts);
}

// Simple CRC32 implementation
function crc32(buffer) {
    let crc = 0xffffffff;
    const table = getCrc32Table();
    for (let i = 0; i < buffer.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
}

let crc32Table = null;
function getCrc32Table() {
    if (crc32Table) return crc32Table;
    crc32Table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        crc32Table[i] = c;
    }
    return crc32Table;
}

/**
 * GET /api/export/zip
 */
function handleExportZip(req, res, query, config) {
    if (!isAdminAuthorized(req.headers, query)) {
        return { status: 403, body: { ok: false, error: 'forbidden' } };
    }

    let scope = (query.scope || ['group'])[0];
    if (scope !== 'group' && scope !== 'all') {
        scope = 'group';
    }

    const outDir = config.outputDir;
    const baseAbs = path.resolve(outDir);

    let rootAbs, arcPrefix, zipName;
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    if (scope === 'group') {
        rootAbs = path.join(baseAbs, 'group');
        arcPrefix = 'group';
        zipName = `riken_group_outputs_${timestamp}.zip`;
    } else {
        rootAbs = baseAbs;
        arcPrefix = 'output';
        zipName = `riken_all_outputs_${timestamp}.zip`;
    }

    try {
        const zipBuffer = createZipBuffer(rootAbs, arcPrefix);
        return {
            status: 200,
            binary: true,
            content: zipBuffer,
            contentType: 'application/zip',
            filename: zipName
        };
    } catch (e) {
        return { status: 500, body: { ok: false, error: e.message } };
    }
}

module.exports = {
    handleExportList,
    handleExportDownload,
    handleExportZip
};

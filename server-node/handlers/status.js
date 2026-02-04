/**
 * Status endpoint handler
 * GET /api/status - Server health check
 */

const path = require('path');
const { nowIso, dirWritable, tailLastJsonl } = require('../utils/file');

function handleStatus(req, res, config) {
    const outDir = config.outputDir;
    const bakDir = config.backupDir;

    const outAbs = path.resolve(outDir);
    const bakAbs = path.resolve(bakDir);

    const outCheck = dirWritable(outAbs);
    const bakCheck = dirWritable(bakAbs);

    // Count sessions
    let sessionCount = 0;
    try {
        const fs = require('fs');
        const sessDir = path.join(outAbs, 'sessions');
        if (fs.existsSync(sessDir)) {
            sessionCount = fs.readdirSync(sessDir).filter(d => {
                return fs.statSync(path.join(sessDir, d)).isDirectory();
            }).length;
        }
    } catch (e) {
        // ignore
    }

    const lastSave = tailLastJsonl(path.join(outAbs, 'save_log.jsonl'));

    return {
        ok: true,
        serverTime: nowIso(),
        cwd: process.cwd(),
        outputDir: outDir,
        outputDirAbs: outAbs,
        outputWritable: outCheck.ok,
        outputWritableError: outCheck.error,
        backupDir: bakDir,
        backupDirAbs: bakAbs,
        backupWritable: bakCheck.ok,
        backupWritableError: bakCheck.error,
        sessionCount,
        lastSave
    };
}

module.exports = { handleStatus };

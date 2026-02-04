/**
 * Save endpoint handler
 * POST /api/save - Save survey data
 * 
 * This is the main data saving endpoint that handles:
 * - Participant index assignment
 * - Session snapshots (JSON + TSV)
 * - Group-level tables (manifest, participants, scores)
 * - Final append-only exports (participants.tsv, responses_long.tsv, etc.)
 */

const fs = require('fs');
const path = require('path');
const {
    nowIso,
    safeId,
    ensureDir,
    atomicWrite,
    lockedAppend,
    readTsvTable,
    writeTsvTable,
    toTsvLine,
    tryCreateFlag,
    injectTsvColumns
} = require('../utils/file');
const {
    sessionStatus,
    isFinalOutput,
    buildParticipantsRow,
    flattenScoresWide,
    updateLatestTable
} = require('../utils/tsv');

// Participant index table headers
const PARTICIPANT_INDEX_HEADERS = ['sessionKey', 'mode', 'participantIndex', 'assignedAt'];

// Manifest headers
const MANIFEST_HEADERS = [
    'serverReceivedAt', 'sessionKey', 'participantIndex', 'sessionId', 'mode',
    'status', 'final', 'autosaveSeq', 'lastAutosaveAt', 'startedAt',
    'completedAt', 'terminatedReason', 'flow_order', 'flow_source',
    'sessionDir', 'latestJson', 'latestResponsesTsv', 'latestScoresTsv',
    'latestParticipantTsv', 'latestScoresWideTsv', 'error'
];

/**
 * Get or assign a participant index for a session
 */
function getOrAssignParticipantIndex(groupDir, groupBakDir, sessionKey, mode, assignedAt) {
    ensureDir(groupDir);
    ensureDir(groupBakDir);

    const indexPath = path.join(groupDir, 'participant_index.tsv');
    const bakPath = path.join(groupBakDir, 'participant_index.tsv');

    let { headers, rowsByKey } = readTsvTable(indexPath, 'sessionKey');

    // Check if already assigned
    if (rowsByKey[sessionKey]) {
        const existing = parseInt(rowsByKey[sessionKey].participantIndex, 10);
        if (!isNaN(existing)) return existing;
    }

    // Find max index for this mode
    let maxIdx = 0;
    for (const row of Object.values(rowsByKey)) {
        if (row.mode !== mode) continue;
        const idx = parseInt(row.participantIndex, 10);
        if (!isNaN(idx) && idx > maxIdx) maxIdx = idx;
    }

    const newIdx = maxIdx + 1;
    rowsByKey[sessionKey] = {
        sessionKey,
        mode,
        participantIndex: newIdx,
        assignedAt
    };

    // Sort and write
    const allRows = Object.values(rowsByKey).sort((a, b) => {
        const modeCompare = String(a.mode || '').localeCompare(String(b.mode || ''));
        if (modeCompare !== 0) return modeCompare;
        const idxA = parseInt(a.participantIndex, 10) || 0;
        const idxB = parseInt(b.participantIndex, 10) || 0;
        return idxA - idxB;
    });

    writeTsvTable(indexPath, PARTICIPANT_INDEX_HEADERS, allRows);
    writeTsvTable(bakPath, PARTICIPANT_INDEX_HEADERS, allRows);

    return newIdx;
}

/**
 * Write IPIP-120 order file (study-level)
 */
function maybeWriteIpip120Order(output, groupDir, groupBakDir) {
    const meta = output.meta || {};
    const rand = meta.randomization?.ipip120;

    if (!rand || !rand.enabled) return;
    if (rand.orderMode !== 'global') return;
    if (!rand.randomized) return;

    const responses = output.responses || {};
    const items = responses.ipip120;
    if (!Array.isArray(items) || !items.length) return;

    const headers = [
        'presented_index', 'presented_num', 'item_id', 'original_item_num',
        'reverse_keyed', 'item_text', 'order_mode', 'global_seed',
        'seed_salt', 'seed', 'renumber_display'
    ];

    const rows = items.filter(it => it && typeof it === 'object').map(it => ({
        presented_index: it.presentedIndex,
        presented_num: it.presentedNum,
        item_id: it.id,
        original_item_num: it.num,
        reverse_keyed: it.reverseKeyed,
        item_text: it.text,
        order_mode: rand.orderMode,
        global_seed: rand.globalSeed,
        seed_salt: rand.seedSalt,
        seed: rand.seed,
        renumber_display: rand.renumberDisplay
    }));

    rows.sort((a, b) => (parseInt(a.presented_index, 10) || 0) - (parseInt(b.presented_index, 10) || 0));

    writeTsvTable(path.join(groupDir, 'ipip120_order.tsv'), headers, rows);
    writeTsvTable(path.join(groupBakDir, 'ipip120_order.tsv'), headers, rows);
}

/**
 * Handle POST /api/save
 */
function handleSave(req, res, body, config) {
    let payload;
    try {
        payload = JSON.parse(body);
    } catch (e) {
        return { status: 400, body: { ok: false, error: 'invalid json' } };
    }

    let output = payload.output || {};
    if (typeof output !== 'object') output = {};

    let meta = output.meta || {};
    if (typeof meta !== 'object') meta = {};
    output.meta = meta;

    const sessionId = safeId(String(meta.sessionId || 'unknown'));
    const mode = safeId(String(meta.mode || 'unknown'));
    const sessionKey = `${sessionId}__${mode}`;

    const serverReceivedAt = nowIso();

    const outDir = config.outputDir;
    const bakDir = config.backupDir;

    ensureDir(outDir);
    ensureDir(bakDir);

    // Per-session snapshot directories
    const sessDir = path.join(outDir, 'sessions', sessionKey);
    const sessBakDir = path.join(bakDir, 'sessions', sessionKey);
    ensureDir(sessDir);
    ensureDir(sessBakDir);

    // Group directories
    const groupDir = path.join(outDir, 'group');
    const groupBakDir = path.join(bakDir, 'group');
    ensureDir(groupDir);
    ensureDir(groupBakDir);

    // Assign participant index
    const participantIndex = getOrAssignParticipantIndex(
        groupDir, groupBakDir, sessionKey, mode, serverReceivedAt
    );

    meta.participantIndex = participantIndex;
    meta.sessionKey = sessionKey;

    // Write latest snapshot JSON
    try {
        const jsonBytes = JSON.stringify(output, null, 2);
        atomicWrite(path.join(sessDir, 'latest.json'), jsonBytes);
        atomicWrite(path.join(sessBakDir, 'latest.json'), jsonBytes);
    } catch (e) {
        return { status: 500, body: { ok: false, error: `json write failed: ${e.message}` } };
    }

    // Get TSV data from payload
    const tsvObj = payload.tsv || {};
    let responsesTsv = tsvObj.responses || '';
    let scoresTsv = tsvObj.scores || '';

    // Inject server-side columns
    if (responsesTsv) {
        responsesTsv = injectTsvColumns(responsesTsv, { participantIndex, sessionKey });
    }
    if (scoresTsv) {
        scoresTsv = injectTsvColumns(scoresTsv, { participantIndex, sessionKey });
    }

    // Write latest TSV snapshots
    try {
        if (responsesTsv) {
            atomicWrite(path.join(sessDir, 'latest_responses.tsv'), responsesTsv);
            atomicWrite(path.join(sessBakDir, 'latest_responses.tsv'), responsesTsv);
        }
        if (scoresTsv) {
            atomicWrite(path.join(sessDir, 'latest_scores.tsv'), scoresTsv);
            atomicWrite(path.join(sessBakDir, 'latest_scores.tsv'), scoresTsv);
        }
    } catch (e) {
        // Non-fatal
    }

    // Build manifest row
    const manifestRow = {
        serverReceivedAt,
        sessionKey,
        participantIndex: meta.participantIndex,
        sessionId: meta.sessionId,
        mode: meta.mode,
        status: sessionStatus(meta),
        final: isFinalOutput(output),
        autosaveSeq: meta.autosaveSeq,
        lastAutosaveAt: meta.lastAutosaveAt,
        startedAt: meta.startedAt,
        completedAt: meta.completedAt,
        terminatedReason: meta.terminatedReason,
        flow_order: Array.isArray(meta.flow?.order) ? meta.flow.order.join(',') : null,
        flow_source: meta.flow?.source,
        sessionDir: `sessions/${sessionKey}`,
        latestJson: `sessions/${sessionKey}/latest.json`,
        latestResponsesTsv: `sessions/${sessionKey}/latest_responses.tsv`,
        latestScoresTsv: `sessions/${sessionKey}/latest_scores.tsv`,
        latestParticipantTsv: `sessions/${sessionKey}/latest_participant.tsv`,
        latestScoresWideTsv: `sessions/${sessionKey}/latest_scores_wide.tsv`,
        error: null
    };

    // Update group-level tables
    updateLatestTable(
        path.join(groupDir, 'sessions_manifest.tsv'),
        path.join(groupBakDir, 'sessions_manifest.tsv'),
        'sessionKey', manifestRow, MANIFEST_HEADERS, 'serverReceivedAt',
        readTsvTable, writeTsvTable
    );

    // Participants table
    const { headers: pHeaders, row: pRow } = buildParticipantsRow(output, serverReceivedAt, sessionKey);
    updateLatestTable(
        path.join(groupDir, 'participants_latest.tsv'),
        path.join(groupBakDir, 'participants_latest.tsv'),
        'sessionKey', pRow, pHeaders, 'serverReceivedAt',
        readTsvTable, writeTsvTable
    );

    // Write per-session participant snapshot
    try {
        writeTsvTable(path.join(sessDir, 'latest_participant.tsv'), pHeaders, [pRow]);
        writeTsvTable(path.join(sessBakDir, 'latest_participant.tsv'), pHeaders, [pRow]);
    } catch (e) {
        // Non-fatal
    }

    // Scores wide table
    const { headers: wHeaders, row: wRow } = flattenScoresWide(output, serverReceivedAt, sessionKey);
    updateLatestTable(
        path.join(groupDir, 'scores_wide_latest.tsv'),
        path.join(groupBakDir, 'scores_wide_latest.tsv'),
        'sessionKey', wRow, wHeaders, 'serverReceivedAt',
        readTsvTable, writeTsvTable
    );

    // Write per-session scores wide snapshot
    try {
        writeTsvTable(path.join(sessDir, 'latest_scores_wide.tsv'), wHeaders, [wRow]);
        writeTsvTable(path.join(sessBakDir, 'latest_scores_wide.tsv'), wHeaders, [wRow]);
    } catch (e) {
        // Non-fatal
    }

    // Write IPIP-120 order if applicable
    try {
        maybeWriteIpip120Order(output, groupDir, groupBakDir);
    } catch (e) {
        // Non-fatal
    }

    // Save log (append-only)
    const logObj = {
        ts: serverReceivedAt,
        sessionId,
        mode,
        sessionKey,
        participantIndex: meta.participantIndex,
        status: sessionStatus(meta),
        final: isFinalOutput(output),
        autosaveSeq: meta.autosaveSeq,
        lastAutosaveAt: meta.lastAutosaveAt
    };
    lockedAppend(path.join(outDir, 'save_log.jsonl'), JSON.stringify(logObj) + '\n');
    lockedAppend(path.join(bakDir, 'save_log.jsonl'), JSON.stringify(logObj) + '\n');

    // Handle final session (append-only exports)
    let appended = false;
    if (isFinalOutput(output)) {
        const flagPath = path.join(outDir, 'finalized', `${sessionKey}.done`);
        const flagBakPath = path.join(bakDir, 'finalized', `${sessionKey}.done`);

        if (tryCreateFlag(flagPath)) {
            tryCreateFlag(flagBakPath);
            appended = true;

            // 1) participants.tsv
            const participantsPath = path.join(outDir, 'participants.tsv');
            const participantsBakPath = path.join(bakDir, 'participants.tsv');

            if (!fs.existsSync(participantsPath)) {
                lockedAppend(participantsPath, pHeaders.join('\t') + '\n');
            }
            if (!fs.existsSync(participantsBakPath)) {
                lockedAppend(participantsBakPath, pHeaders.join('\t') + '\n');
            }
            lockedAppend(participantsPath, toTsvLine(pHeaders, pRow));
            lockedAppend(participantsBakPath, toTsvLine(pHeaders, pRow));

            // 2) responses_long.tsv
            if (responsesTsv) {
                const rLines = responsesTsv.split('\n').filter(ln => ln.trim());
                if (rLines.length > 1) {
                    const rHeader = rLines[0];
                    const rBody = rLines.slice(1).join('\n');

                    const responsesPath = path.join(outDir, 'responses_long.tsv');
                    const responsesBakPath = path.join(bakDir, 'responses_long.tsv');

                    if (!fs.existsSync(responsesPath)) {
                        lockedAppend(responsesPath, rHeader + '\n');
                    }
                    if (!fs.existsSync(responsesBakPath)) {
                        lockedAppend(responsesBakPath, rHeader + '\n');
                    }
                    lockedAppend(responsesPath, rBody + '\n');
                    lockedAppend(responsesBakPath, rBody + '\n');
                }
            }

            // 3) scores_long.tsv
            if (scoresTsv) {
                const sLines = scoresTsv.split('\n').filter(ln => ln.trim());
                if (sLines.length > 1) {
                    const sHeader = sLines[0];
                    const sBody = sLines.slice(1).join('\n');

                    const scoresPath = path.join(outDir, 'scores_long.tsv');
                    const scoresBakPath = path.join(bakDir, 'scores_long.tsv');

                    if (!fs.existsSync(scoresPath)) {
                        lockedAppend(scoresPath, sHeader + '\n');
                    }
                    if (!fs.existsSync(scoresBakPath)) {
                        lockedAppend(scoresBakPath, sHeader + '\n');
                    }
                    lockedAppend(scoresPath, sBody + '\n');
                    lockedAppend(scoresBakPath, sBody + '\n');
                }
            }

            // 4) scores_wide.tsv
            const widePath = path.join(outDir, 'scores_wide.tsv');
            const wideBakPath = path.join(bakDir, 'scores_wide.tsv');

            if (!fs.existsSync(widePath)) {
                lockedAppend(widePath, wHeaders.join('\t') + '\n');
            }
            if (!fs.existsSync(wideBakPath)) {
                lockedAppend(wideBakPath, wHeaders.join('\t') + '\n');
            }
            lockedAppend(widePath, toTsvLine(wHeaders, wRow));
            lockedAppend(wideBakPath, toTsvLine(wHeaders, wRow));
        }
    }

    return {
        status: 200,
        body: {
            ok: true,
            sessionId,
            mode,
            sessionKey,
            participantIndex: meta.participantIndex,
            receivedAt: serverReceivedAt,
            appendedFinal: appended
        }
    };
}

module.exports = { handleSave };

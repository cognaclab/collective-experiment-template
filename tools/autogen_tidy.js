#!/usr/bin/env node
/**
 * Auto-generate tidy (analysis-ready) exports from append-only long files.
 *
 * Node.js replacement for autogen_tidy.py (no external dependencies).
 *
 * Design goals:
 *   - Do NOT modify "raw" ground-truth files; only read them as inputs.
 *   - Rebuild outputs deterministically on each run (safe under concurrency).
 *   - Completed sessions only for tidy exports.
 *   - Produce both TSV and CSV.
 *   - Produce both long and wide formats.
 *
 * Usage:
 *   RIKEN_OUTPUT_DIR=output node tools/autogen_tidy.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// TSV / CSV helpers
// ---------------------------------------------------------------------------

function parseTsv(text) {
    if (!text || !text.trim()) return [];
    const lines = text.split('\n').filter(ln => ln.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split('\t');
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split('\t');
        const row = {};
        for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = vals[j] !== undefined ? vals[j] : '';
        }
        rows.push(row);
    }
    return rows;
}

function rowsToTsv(headers, rows) {
    const lines = [headers.join('\t')];
    for (const row of rows) {
        lines.push(headers.map(h => String(row[h] ?? '')).join('\t'));
    }
    return lines.join('\n') + '\n';
}

function csvEscape(val) {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function rowsToCsv(headers, rows) {
    const lines = [headers.map(csvEscape).join(',')];
    for (const row of rows) {
        lines.push(headers.map(h => csvEscape(row[h] ?? '')).join(','));
    }
    return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function readTsvFile(filePath) {
    try {
        return parseTsv(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return [];
    }
}

function atomicWrite(filePath, data) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// Filtering: completed sessions only
// ---------------------------------------------------------------------------

function isCompleted(row) {
    // Check explicit completion flags
    for (const col of ['completed_all', 'completedAll', 'completed_all_bool', 'completedAllBool', 'completedAllFlag']) {
        if (row[col] !== undefined && row[col] !== '') {
            const v = String(row[col]).toLowerCase();
            return ['1', 'true', 't', 'yes', 'y'].includes(v);
        }
    }
    // Fallback: completedAt present and terminatedReason empty
    if (row.completedAt && String(row.completedAt).length > 0) {
        if (row.terminatedReason && String(row.terminatedReason).length > 0) {
            return false;
        }
        return true;
    }
    return true; // if no completion info, include by default
}

// ---------------------------------------------------------------------------
// Ensure ID columns are present and ordered first
// ---------------------------------------------------------------------------

function ensureIdCols(rows) {
    for (const row of rows) {
        if (!row.prolificId) {
            if (row.prolific_id) row.prolificId = row.prolific_id;
            else if (row.PROLIFIC_PID) row.prolificId = row.PROLIFIC_PID;
        }
        if (!row.sessionKey && row.sessionId && row.mode) {
            row.sessionKey = `${row.sessionId}__${row.mode}`;
        }
    }
    return rows;
}

function reorderHeaders(rows) {
    if (!rows.length) return [];
    const allCols = Object.keys(rows[0]);
    const front = ['prolificId', 'participantIndex', 'sessionKey'].filter(c => allCols.includes(c));
    const rest = allCols.filter(c => !front.includes(c));
    return front.concat(rest);
}

// ---------------------------------------------------------------------------
// Pivot long → wide
// ---------------------------------------------------------------------------

function pivotWide(rows, indexCols, columnKey, valueCandidates) {
    if (!rows.length) return { headers: [], rows: [] };

    // Find which value column exists
    let valueCol = null;
    for (const c of valueCandidates) {
        if (rows[0][c] !== undefined) { valueCol = c; break; }
    }
    if (!valueCol) return { headers: [], rows: [] };

    // Sort by serverReceivedAt if present (so "last" wins)
    if (rows[0].serverReceivedAt !== undefined) {
        rows.sort((a, b) => String(a.serverReceivedAt || '').localeCompare(String(b.serverReceivedAt || '')));
    }

    // Collect unique pivot column values (in order of appearance)
    const pivotVals = [];
    const pivotSet = new Set();
    for (const row of rows) {
        const pv = String(row[columnKey] || '');
        if (!pivotSet.has(pv)) { pivotSet.add(pv); pivotVals.push(pv); }
    }

    // Group by index columns
    const groups = {};
    for (const row of rows) {
        const key = indexCols.map(c => String(row[c] || '')).join('\x00');
        if (!groups[key]) {
            groups[key] = {};
            for (const c of indexCols) groups[key][c] = row[c] || '';
        }
        // Last value wins
        groups[key][String(row[columnKey] || '')] = row[valueCol] || '';
    }

    const headers = indexCols.concat(pivotVals);
    const wideRows = Object.values(groups);

    return { headers, rows: wideRows };
}

// ---------------------------------------------------------------------------
// Sanitize column names for fulltext wide columns
// ---------------------------------------------------------------------------

function sanitizeCol(s, maxLen = 140) {
    s = String(s).replace(/\s+/g, ' ').trim();
    s = s.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');
    s = s.replace(/[^\w\s\-.,;:!?()'"\/]/g, '');
    s = s.trim();
    if (s.length > maxLen) {
        // Simple hash suffix using character codes
        let hash = 0;
        for (let i = 0; i < s.length; i++) {
            hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
        }
        const h = Math.abs(hash).toString(16).slice(0, 8);
        s = s.slice(0, maxLen - 9).trimEnd() + '_' + h;
    }
    return s;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
    const outDir = process.env.RIKEN_OUTPUT_DIR || 'output';
    const tidyDir = path.join(outDir, 'tidy');

    // Read raw append-only long files
    const rlong = readTsvFile(path.join(outDir, 'responses_long.tsv'));
    const slong = readTsvFile(path.join(outDir, 'scores_long.tsv'));

    // Ensure tidy dir exists
    fs.mkdirSync(tidyDir, { recursive: true });

    if (!rlong.length && !slong.length) {
        return 0;
    }

    // Filter to completed sessions
    const rlongCompleted = ensureIdCols(rlong.filter(isCompleted));
    const slongCompleted = ensureIdCols(slong.filter(isCompleted));

    // ID columns for pivoting
    const idCols = ['prolificId', 'participantIndex', 'sessionKey'];

    // --- Write completed-only long files ---

    if (rlongCompleted.length) {
        const rHeaders = reorderHeaders(rlongCompleted);
        atomicWrite(path.join(tidyDir, 'responses_long.tsv'), rowsToTsv(rHeaders, rlongCompleted));
        atomicWrite(path.join(tidyDir, 'responses_long.csv'), rowsToCsv(rHeaders, rlongCompleted));
    }

    if (slongCompleted.length) {
        const sHeaders = reorderHeaders(slongCompleted);
        atomicWrite(path.join(tidyDir, 'scores_long.tsv'), rowsToTsv(sHeaders, slongCompleted));
        atomicWrite(path.join(tidyDir, 'scores_long.csv'), rowsToCsv(sHeaders, slongCompleted));
    }

    // --- Responses wide ---

    if (rlongCompleted.length) {
        // Find item ID column
        let itemIdCol = null;
        for (const c of ['item_id', 'itemId', 'questionId', 'variable', 'qid']) {
            if (rlongCompleted[0][c] !== undefined) { itemIdCol = c; break; }
        }

        if (itemIdCol) {
            // Compact wide (columns = itemId)
            const wideCompact = pivotWide(
                rlongCompleted,
                idCols.filter(c => rlongCompleted[0][c] !== undefined),
                itemIdCol,
                ['response_value', 'responseValue', 'response', 'value', 'raw_value', 'rawValue']
            );
            if (wideCompact.rows.length) {
                atomicWrite(path.join(tidyDir, 'responses_wide_compact.tsv'), rowsToTsv(wideCompact.headers, wideCompact.rows));
                atomicWrite(path.join(tidyDir, 'responses_wide_compact.csv'), rowsToCsv(wideCompact.headers, wideCompact.rows));
            }

            // Fulltext wide (columns include item number + text)
            let itemTextCol = null;
            for (const c of ['item_text', 'itemText', 'questionText', 'question', 'prompt', 'text']) {
                if (rlongCompleted[0][c] !== undefined) { itemTextCol = c; break; }
            }
            let itemNumCol = null;
            for (const c of ['item_num', 'itemNumber', 'itemNo', 'qnum']) {
                if (rlongCompleted[0][c] !== undefined) { itemNumCol = c; break; }
            }

            if (itemTextCol) {
                // Build fulltext column key for each row
                const ftRows = rlongCompleted.map(row => {
                    const parts = [];
                    if (itemNumCol && String(row[itemNumCol] || '').trim()) parts.push(String(row[itemNumCol]).trim());
                    if (String(row[itemIdCol] || '').trim()) parts.push(String(row[itemIdCol]).trim());
                    parts.push(sanitizeCol(row[itemTextCol] || ''));
                    return { ...row, _wideColFullText: parts.filter(Boolean).join('__') };
                });

                const wideFull = pivotWide(
                    ftRows,
                    idCols.filter(c => ftRows[0][c] !== undefined),
                    '_wideColFullText',
                    ['response_value', 'responseValue', 'response', 'value', 'raw_value', 'rawValue'],
                );
                if (wideFull.rows.length) {
                    atomicWrite(path.join(tidyDir, 'responses_wide_fulltext.tsv'), rowsToTsv(wideFull.headers, wideFull.rows));
                    atomicWrite(path.join(tidyDir, 'responses_wide_fulltext.csv'), rowsToCsv(wideFull.headers, wideFull.rows));
                }
            }
        }
    }

    // --- Scores wide ---

    if (slongCompleted.length) {
        let scaleCol = null;
        for (const c of ['name', 'scoreName', 'scale', 'facet', 'variable', 'score_id']) {
            if (slongCompleted[0][c] !== undefined) { scaleCol = c; break; }
        }

        if (scaleCol) {
            const wideScores = pivotWide(
                slongCompleted,
                idCols.filter(c => slongCompleted[0][c] !== undefined),
                scaleCol,
                ['value', 'scoreValue', 'score', 'scoredValue']
            );
            if (wideScores.rows.length) {
                atomicWrite(path.join(tidyDir, 'scores_wide.tsv'), rowsToTsv(wideScores.headers, wideScores.rows));
                atomicWrite(path.join(tidyDir, 'scores_wide.csv'), rowsToCsv(wideScores.headers, wideScores.rows));
            }
        }
    }

    return 0;
}

try {
    process.exit(main());
} catch (e) {
    console.error('autogen_tidy error:', e.message);
    process.exit(1);
}

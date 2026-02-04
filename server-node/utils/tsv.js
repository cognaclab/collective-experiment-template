/**
 * TSV data processing utilities
 * Handles building participant rows, flattening scores, etc.
 */

const { tsvEscape } = require('./file');

/**
 * Determine session status from metadata
 */
function sessionStatus(meta) {
    if (!meta || typeof meta !== 'object') return 'unknown';
    if (meta.terminatedReason) return 'terminated';
    if (meta.completedAt) return 'completed';
    return 'in_progress';
}

/**
 * Check if output is final (completed or terminated)
 */
function isFinalOutput(output) {
    const meta = output?.meta || {};
    return Boolean(meta.completedAt) || Boolean(meta.terminatedReason);
}

/**
 * Make a safe column name (alphanumeric and underscore only)
 */
function safeCol(name) {
    const s = String(name).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return s || 'NA';
}

/**
 * Build a participants summary row
 */
function buildParticipantsRow(output, serverReceivedAt, sessionKey) {
    const meta = output?.meta || {};
    const responses = output?.responses || {};

    // Demographics
    const demoList = responses.demographics || [];
    const demoMap = {};
    const demoExtra = {};
    if (Array.isArray(demoList)) {
        for (const q of demoList) {
            const qid = String(q?.id || '');
            demoMap[qid] = q?.response;
            demoExtra[qid] = q?.extraText;
        }
    }

    // Math checks QC
    const mathList = responses.math_checks || [];
    let nMath = 0, nMathFirstCorrect = 0;
    const firstRts = [];
    if (Array.isArray(mathList)) {
        nMath = mathList.length;
        for (const m of mathList) {
            const attempts = m?.attempts || [];
            if (!attempts.length) continue;
            const first = attempts[0];
            if (first?.correct === true) nMathFirstCorrect++;
            const rt = first?.rtMs;
            if (typeof rt === 'number') firstRts.push(rt);
        }
    }
    const mathFirstRtMean = firstRts.length
        ? firstRts.reduce((a, b) => a + b, 0) / firstRts.length
        : null;

    // SVO summary
    const scores = output?.scores || {};
    const svo = scores.svo || {};
    const svoPrimary = svo.primary || {};
    const svoQc = svo.qc || {};

    // IPIP presentation info
    const ipipPresentation = meta.presentation?.ipip120;

    const row = {
        serverReceivedAt,
        sessionKey,
        participantIndex: meta.participantIndex,
        sessionId: meta.sessionId,
        mode: meta.mode,
        status: sessionStatus(meta),
        startedAt: meta.startedAt,
        completedAt: meta.completedAt,
        terminatedReason: meta.terminatedReason,
        lastAutosaveAt: meta.lastAutosaveAt,
        autosaveSeq: meta.autosaveSeq,
        language: meta.language,
        platform: meta.platform,
        timezoneOffsetMinutes: meta.timezoneOffsetMinutes,
        screen_w: meta.screen?.w,
        screen_h: meta.screen?.h,
        flow_order: Array.isArray(meta.flow?.order) ? meta.flow.order.join(',') : null,
        flow_source: meta.flow?.source,
        ipip_seed: ipipPresentation?.seed,
        ipip_seedSalt: ipipPresentation?.seedSalt,
        ipip_randomized: ipipPresentation?.randomized,
        math_n_checks: nMath,
        math_first_try_correct: nMathFirstCorrect,
        math_first_try_rt_mean_ms: mathFirstRtMean,
        svo_primary_angle_deg: svoPrimary.angleDeg,
        svo_primary_category: svoPrimary.category,
        svo_qc_written_mismatch: svoQc.nWrittenMismatch
    };

    // Add demographics columns
    for (let n = 1; n <= 18; n++) {
        const qid = `demo_q${String(n).padStart(2, '0')}`;
        row[`${qid}_response`] = demoMap[qid];
        row[`${qid}_extra`] = demoExtra[qid];
    }

    const headers = Object.keys(row);
    return { headers, row };
}

/**
 * Flatten scores to wide format
 */
function flattenScoresWide(output, serverReceivedAt, sessionKey) {
    const meta = output?.meta || {};
    const scores = output?.scores || {};

    const row = {
        serverReceivedAt,
        sessionKey,
        participantIndex: meta.participantIndex,
        sessionId: meta.sessionId,
        mode: meta.mode,
        status: sessionStatus(meta),
        startedAt: meta.startedAt,
        completedAt: meta.completedAt,
        terminatedReason: meta.terminatedReason,
        lastAutosaveAt: meta.lastAutosaveAt,
        autosaveSeq: meta.autosaveSeq
    };

    // HEXACO
    const hx = scores.hexaco100;
    if (hx && typeof hx === 'object') {
        for (const [facName, fac] of Object.entries(hx.factors || {})) {
            if (fac && typeof fac === 'object') {
                const k = safeCol(facName);
                row[`hexaco_factor_mean_${k}`] = fac.mean;
                row[`hexaco_factor_sum_${k}`] = fac.sum;
            }
        }
        for (const [facetName, facet] of Object.entries(hx.facets || {})) {
            if (facet && typeof facet === 'object') {
                const k = safeCol(facetName);
                row[`hexaco_facet_mean_${k}`] = facet.mean;
                row[`hexaco_facet_sum_${k}`] = facet.sum;
            }
        }
    }

    // IPIP-NEO-120
    const ip = scores.ipip120;
    if (ip && typeof ip === 'object') {
        for (const [domName, dom] of Object.entries(ip.domains || {})) {
            if (dom && typeof dom === 'object') {
                const k = safeCol(domName);
                row[`ipip_domain_mean_${k}`] = dom.mean;
                row[`ipip_domain_sum_${k}`] = dom.sum;
            }
        }
        for (const [facetName, facet] of Object.entries(ip.facets || {})) {
            if (facet && typeof facet === 'object') {
                const k = safeCol(facetName);
                row[`ipip_facet_mean_${k}`] = facet.mean;
                row[`ipip_facet_sum_${k}`] = facet.sum;
            }
        }
    }

    // MFQ30
    const mfq = scores.mfq30;
    if (mfq && typeof mfq === 'object') {
        for (const [fName, f] of Object.entries(mfq.foundations || {})) {
            if (f && typeof f === 'object') {
                const k = safeCol(fName);
                const combined = f.combined || {};
                row[`mfq_foundation_mean_${k}`] = combined.mean;
                row[`mfq_foundation_sum_${k}`] = combined.sum;
            }
        }
    }

    // D70
    const d70 = scores.d70;
    if (d70 && typeof d70 === 'object') {
        row.d70_mean = d70.mean;
        row.d70_sum = d70.sum;
    }

    // SVO
    const svo = scores.svo;
    if (svo && typeof svo === 'object') {
        const primary = svo.primary || {};
        const qc = svo.qc || {};
        row.svo_primary_mean_you = primary.meanYou;
        row.svo_primary_mean_other = primary.meanOther;
        row.svo_angle_deg = primary.angleDeg;
        row.svo_category = primary.category;
        row.svo_written_mismatch = qc.nWrittenMismatch;
    }

    const headers = Object.keys(row);
    return { headers, row };
}

/**
 * Update a "latest" table (upsert by key column)
 */
function updateLatestTable(filePath, bakPath, keyCol, newRow, preferredHeader, sortCol = 'serverReceivedAt', readTsvTable, writeTsvTable) {
    let { headers, rowsByKey } = readTsvTable(filePath, keyCol);

    // Use preferred header if provided
    if (preferredHeader) {
        headers = [...preferredHeader];
    }

    // Ensure key column exists
    if (!headers.includes(keyCol)) {
        headers = [keyCol, ...headers];
    }

    // Add any new columns from the row
    for (const k of Object.keys(newRow)) {
        if (!headers.includes(k)) {
            headers.push(k);
        }
    }

    // Upsert the row
    const key = String(newRow[keyCol] || '');
    if (key) {
        rowsByKey[key] = newRow;
    }

    // Sort by sortCol (newest first)
    const rowsSorted = Object.values(rowsByKey).sort((a, b) => {
        const va = a[sortCol] || '';
        const vb = b[sortCol] || '';
        return vb.localeCompare(va);
    });

    writeTsvTable(filePath, headers, rowsSorted);
    writeTsvTable(bakPath, headers, rowsSorted);
}

module.exports = {
    sessionStatus,
    isFinalOutput,
    safeCol,
    buildParticipantsRow,
    flattenScoresWide,
    updateLatestTable
};

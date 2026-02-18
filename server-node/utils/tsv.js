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

/**
 * Summarize bot-check arithmetic items (per session).
 * Returns { headers, row } with per-check fields and aggregate metrics.
 */
function flattenMathChecksMetrics(output, serverReceivedAt, sessionKey) {
    const meta = output?.meta || {};
    const responses = output?.responses || {};

    let mathList = responses.math_checks || [];
    if (!Array.isArray(mathList)) mathList = [];

    const firstRts = [];
    const lastRts = [];
    let nChecks = 0;
    let nAttemptsTotal = 0;
    let nFirstCorrect = 0;
    let nFinalCorrect = 0;

    const row = {
        serverReceivedAt,
        sessionKey,
        participantIndex: meta.participantIndex,
        sessionId: meta.sessionId,
        mode: meta.mode,
        status: sessionStatus(meta),
        final: isFinalOutput(output),
        startedAt: meta.startedAt,
        completedAt: meta.completedAt,
        terminatedReason: meta.terminatedReason,
    };

    const sorted = mathList
        .filter(x => x && typeof x === 'object')
        .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));

    for (const m of sorted) {
        const mid = safeCol(String(m.id || ''));
        if (!mid) continue;

        nChecks++;

        let attempts = m.attempts || [];
        if (!Array.isArray(attempts)) attempts = [];

        nAttemptsTotal += attempts.length;

        const first = attempts[0] || null;
        const last = attempts.length ? attempts[attempts.length - 1] : null;

        const firstRt = (first && typeof first.rtMs === 'number') ? first.rtMs : null;
        const lastRt = (last && typeof last.rtMs === 'number') ? last.rtMs : null;

        const firstCorrect = first ? Boolean(first.correct) : false;
        const lastCorrect = last ? Boolean(last.correct) : false;

        if (firstCorrect) nFirstCorrect++;
        if (lastCorrect && attempts.length) nFinalCorrect++;

        if (typeof firstRt === 'number') firstRts.push(firstRt);
        if (typeof lastRt === 'number') lastRts.push(lastRt);

        row[`${mid}__between`] = m.between;
        row[`${mid}__kind`] = m.kind;
        row[`${mid}__expression`] = m.expression;
        row[`${mid}__correct_answer`] = m.correctAnswer;
        row[`${mid}__response`] = m.response;
        row[`${mid}__attempts_n`] = attempts.length;

        row[`${mid}__first_rt_ms`] = firstRt;
        row[`${mid}__first_correct`] = firstCorrect;
        row[`${mid}__first_response_raw`] = first ? first.responseRaw : null;
        row[`${mid}__first_response_num`] = first ? first.responseNum : null;

        row[`${mid}__final_rt_ms`] = lastRt;
        row[`${mid}__final_correct`] = attempts.length ? lastCorrect : null;
        row[`${mid}__final_response_raw`] = last ? last.responseRaw : null;
        row[`${mid}__final_response_num`] = last ? last.responseNum : null;
    }

    row.math_n_checks = nChecks;
    row.math_n_attempts_total = nAttemptsTotal;
    row.math_first_try_correct_n = nFirstCorrect;
    row.math_final_correct_n = nFinalCorrect;
    row.math_first_try_accuracy = nChecks ? nFirstCorrect / nChecks : null;
    row.math_final_accuracy = nChecks ? nFinalCorrect / nChecks : null;

    row.math_first_rt_mean_ms = firstRts.length ? firstRts.reduce((a, b) => a + b, 0) / firstRts.length : null;
    row.math_first_rt_median_ms = percentile(firstRts, 50);
    row.math_first_rt_min_ms = firstRts.length ? Math.min(...firstRts) : null;
    row.math_first_rt_max_ms = firstRts.length ? Math.max(...firstRts) : null;

    row.math_final_rt_mean_ms = lastRts.length ? lastRts.reduce((a, b) => a + b, 0) / lastRts.length : null;
    row.math_final_rt_median_ms = percentile(lastRts, 50);
    row.math_final_rt_min_ms = lastRts.length ? Math.min(...lastRts) : null;
    row.math_final_rt_max_ms = lastRts.length ? Math.max(...lastRts) : null;

    return { headers: Object.keys(row), row };
}

/**
 * Flatten MFQ scores for session-2 imports.
 * Includes foundation means, level labels, and composite indices.
 */
function flattenMfqSession2(output, serverReceivedAt, sessionKey) {
    const meta = output?.meta || {};
    const scores = output?.scores || {};

    const mfq = (scores.mfq30 && typeof scores.mfq30 === 'object') ? scores.mfq30 : {};
    const foundations = mfq.foundations || {};

    function getFoundationMean(name) {
        const f = foundations[name] || {};
        const combined = f.combined || {};
        return (typeof combined.mean === 'number') ? combined.mean : null;
    }

    const harm = getFoundationMean('Harm');
    const fairness = getFoundationMean('Fairness');
    const loyalty = getFoundationMean('Ingroup');
    const authority = getFoundationMean('Authority');
    const purity = getFoundationMean('Purity');

    function meanFinite(vals) {
        const finite = vals.filter(v => typeof v === 'number' && Number.isFinite(v));
        if (!finite.length) return null;
        return finite.reduce((a, b) => a + b, 0) / finite.length;
    }

    const bindingMean = meanFinite([loyalty, authority, purity]);
    const individualizingMean = meanFinite([harm, fairness]);

    const diff = (bindingMean !== null && individualizingMean !== null)
        ? bindingMean - individualizingMean : null;
    const absDiff = (diff !== null) ? Math.abs(diff) : null;

    const row = {
        serverReceivedAt,
        sessionKey,
        participantIndex: meta.participantIndex,
        subjectId: meta.sessionId,
        sessionId: meta.sessionId,
        mode: meta.mode,
        status: sessionStatus(meta),
        final: isFinalOutput(output),
        startedAt: meta.startedAt,
        completedAt: meta.completedAt,
        terminatedReason: meta.terminatedReason,

        harm,
        fairness,
        loyalty,
        authority,
        purity,

        harm_level: mfqLevelFromMean(harm),
        fairness_level: mfqLevelFromMean(fairness),
        loyalty_level: mfqLevelFromMean(loyalty),
        authority_level: mfqLevelFromMean(authority),
        purity_level: mfqLevelFromMean(purity),

        binding_mean: bindingMean,
        individualizing_mean: individualizingMean,
        binding_minus_individualizing: diff,
        abs_binding_minus_individualizing: absDiff,

        harm_quartile: '',
        fairness_quartile: '',
        loyalty_quartile: '',
        authority_quartile: '',
        purity_quartile: '',
        binding_mean_quartile: '',
        individualizing_mean_quartile: '',
        binding_minus_individualizing_quartile: '',
        abs_binding_minus_individualizing_quartile: '',
        mfq_profile_quartile3: '',
        mfq_profile_quartile3_code: '',
    };

    return { headers: Object.keys(row), row };
}

const RESPONSES_COMPACT_HEADERS = [
    'participantIndex', 'sessionKey', 'sessionId', 'mode',
    'instrument', 'item_id', 'item_num', 'presented_num',
    'raw_value', 'scored_value', 'rt_first_ms', 'rt_last_ms',
    'svo_expected_you', 'svo_expected_other',
    'svo_written_you_num', 'svo_written_other_num',
    'svo_written_matches_expected', 'extra'
];

/**
 * Append a compact subset of response columns to responses_compact.tsv.
 * Projects responses_long TSV to a minimal column set.
 */
function appendResponsesCompact(responsesTsv, outDir, bakDir, fs, path, lockedAppend) {
    if (!responsesTsv) return;

    const lines = responsesTsv.split('\n');
    if (!lines.length) return;

    const header = lines[0].split('\t');
    const colIndex = {};
    for (let i = 0; i < header.length; i++) {
        colIndex[header[i]] = i;
    }

    function get(col, parts) {
        const i = colIndex[col];
        return (i !== undefined && i < parts.length) ? parts[i] : '';
    }

    const bodyLines = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const parts = lines[i].split('\t');
        const outParts = RESPONSES_COMPACT_HEADERS.map(col => get(col, parts));
        bodyLines.push(outParts.join('\t'));
    }

    if (!bodyLines.length) return;

    const compactPath = path.join(outDir, 'responses_compact.tsv');
    const compactBakPath = path.join(bakDir, 'responses_compact.tsv');

    if (!fs.existsSync(compactPath)) lockedAppend(compactPath, RESPONSES_COMPACT_HEADERS.join('\t') + '\n');
    if (!fs.existsSync(compactBakPath)) lockedAppend(compactBakPath, RESPONSES_COMPACT_HEADERS.join('\t') + '\n');

    lockedAppend(compactPath, bodyLines.join('\n') + '\n');
    lockedAppend(compactBakPath, bodyLines.join('\n') + '\n');
}

/**
 * Extremely wide single-row table: scores + raw/scored item values + RTs.
 * Combines participants, scores_wide, and per-item response data.
 */
function flattenAllDataWide(output, serverReceivedAt, sessionKey) {
    const responses = output?.responses || {};

    // Start with participant/meta columns
    const { headers: pH, row: pR } = buildParticipantsRow(output, serverReceivedAt, sessionKey);
    const { headers: wH, row: wR } = flattenScoresWide(output, serverReceivedAt, sessionKey);

    const row = {};
    for (const h of pH) row[h] = pR[h];
    for (const h of wH) { if (!(h in row)) row[h] = wR[h]; }

    // Demographics (raw item-id columns)
    const demoList = responses.demographics;
    if (Array.isArray(demoList)) {
        for (const q of demoList) {
            if (!q || typeof q !== 'object') continue;
            const qid = safeCol(String(q.id || ''));
            if (!qid) continue;
            row[`${qid}__raw`] = q.response;
            row[`${qid}__extra_text`] = q.extraText;
            const t = q.timing || {};
            if (t && typeof t === 'object') {
                row[`${qid}__rt_first_ms`] = t.firstRtMs;
                row[`${qid}__rt_last_ms`] = t.lastRtMs;
            }
        }
    }

    // Likert instruments
    function addLikert(instKey) {
        const items = responses[instKey];
        if (!Array.isArray(items)) return;
        for (const it of items) {
            if (!it || typeof it !== 'object') continue;
            const iid = safeCol(String(it.id || ''));
            if (!iid) continue;
            const resp = it.response || {};
            const scored = it.scored || {};
            const t = it.timing || {};
            row[`${iid}__raw`] = (resp && typeof resp === 'object') ? resp.value : null;
            row[`${iid}__scored`] = (scored && typeof scored === 'object') ? scored.value : null;
            if (t && typeof t === 'object') {
                row[`${iid}__rt_first_ms`] = t.firstRtMs;
                row[`${iid}__rt_last_ms`] = t.lastRtMs;
            }
        }
    }
    addLikert('hexaco100');
    addLikert('ipip120');
    addLikert('d70');

    // MFQ (part1 + part2; scored == raw)
    const mfq = responses.mfq30;
    if (mfq && typeof mfq === 'object') {
        for (const partKey of ['part1', 'part2']) {
            const part = mfq[partKey];
            if (!part || typeof part !== 'object') continue;
            const items = part.items;
            if (!Array.isArray(items)) continue;
            for (const it of items) {
                if (!it || typeof it !== 'object') continue;
                const iid = safeCol(String(it.id || ''));
                if (!iid) continue;
                const resp = it.response || {};
                const t = it.timing || {};
                const rawVal = (resp && typeof resp === 'object') ? resp.value : null;
                row[`${iid}__raw`] = rawVal;
                row[`${iid}__scored`] = rawVal;
                if (t && typeof t === 'object') {
                    row[`${iid}__rt_first_ms`] = t.firstRtMs;
                    row[`${iid}__rt_last_ms`] = t.lastRtMs;
                }
            }
        }
    }

    // Math checks (per-check fields)
    const { headers: mH, row: mR } = flattenMathChecksMetrics(output, serverReceivedAt, sessionKey);
    for (const h of mH) { if (!(h in row)) row[h] = mR[h]; }

    // SVO (slider + written; strict-match QC)
    const svoList = responses.svo;
    if (Array.isArray(svoList)) {
        for (const it of svoList) {
            if (!it || typeof it !== 'object') continue;
            const iid = safeCol(String(it.id || ''));
            if (!iid) continue;

            row[`${iid}__choice_index`] = it.choiceIndex;
            row[`${iid}__expected_you`] = it.youReceive;
            row[`${iid}__expected_other`] = it.otherReceives;

            const w = it.written || {};
            if (w && typeof w === 'object') {
                row[`${iid}__written_you_raw`] = w.youRaw;
                row[`${iid}__written_other_raw`] = w.otherRaw;
                row[`${iid}__written_you_num`] = w.youNum;
                row[`${iid}__written_other_num`] = w.otherNum;
                row[`${iid}__written_matches_expected`] = w.matchesExpected;
                row[`${iid}__written_edited_at`] = w.editedAt;
            }

            const t = it.timing || {};
            if (t && typeof t === 'object') {
                const tg = t.generic || {};
                const ts = t.slider || {};
                const tw = t.written || {};
                if (tg && typeof tg === 'object') {
                    row[`${iid}__rt_first_ms`] = tg.firstRtMs;
                    row[`${iid}__rt_last_ms`] = tg.lastRtMs;
                }
                if (ts && typeof ts === 'object') {
                    row[`${iid}__slider_rt_first_ms`] = ts.firstRtMs;
                    row[`${iid}__slider_rt_last_ms`] = ts.lastRtMs;
                    row[`${iid}__slider_change_count`] = ts.changeCount;
                }
                if (tw && typeof tw === 'object') {
                    row[`${iid}__written_rt_first_ms`] = tw.firstRtMs;
                    row[`${iid}__written_rt_last_ms`] = tw.lastRtMs;
                    row[`${iid}__written_change_count`] = tw.changeCount;
                }
            }
        }
    }

    return { headers: Object.keys(row), row };
}

const ITEM_DICT_HEADERS = [
    'instrument', 'item_id', 'item_num', 'facet', 'key',
    'mfq_var', 'mfq_scoredItem', 'item_text',
    'reverseKeyed', 'reverseFormula', 'options_json'
];

/**
 * Build a stable item dictionary from the structured JSON output.
 * Returns array of row objects with item metadata.
 */
function extractItemDictionaryRows(output) {
    const responses = output?.responses || {};
    const rows = [];

    function addRow(data) {
        const row = {};
        for (const h of ITEM_DICT_HEADERS) row[h] = null;
        Object.assign(row, data);
        rows.push(row);
    }

    // Likert instruments
    for (const instId of ['hexaco100', 'ipip120', 'd70']) {
        const items = responses[instId];
        if (!Array.isArray(items)) continue;
        for (const it of items) {
            if (!it || typeof it !== 'object') continue;
            addRow({
                instrument: instId,
                item_id: it.id,
                item_num: it.num,
                facet: it.facet,
                key: it.key,
                item_text: it.text,
                reverseKeyed: it.reverseKeyed,
                reverseFormula: it.reverseFormula,
            });
        }
    }

    // MFQ (two parts)
    const mfq = responses.mfq30;
    if (mfq && typeof mfq === 'object') {
        for (const partName of ['part1', 'part2']) {
            const part = mfq[partName];
            if (!part || typeof part !== 'object') continue;
            const items = part.items;
            if (!Array.isArray(items)) continue;
            for (const it of items) {
                if (!it || typeof it !== 'object') continue;
                addRow({
                    instrument: `mfq30_${partName}`,
                    item_id: it.id,
                    item_num: it.num,
                    mfq_var: it.var,
                    mfq_scoredItem: it.scoredItem,
                    item_text: it.text,
                    reverseKeyed: false,
                });
            }
        }
    }

    // SVO
    const svoItems = responses.svo;
    if (Array.isArray(svoItems)) {
        for (const it of svoItems) {
            if (!it || typeof it !== 'object') continue;
            const options = it.options || {};
            let optionsJson = null;
            if (options && typeof options === 'object') {
                optionsJson = JSON.stringify({
                    youReceive: options.youReceive,
                    otherReceives: options.otherReceives
                });
            }
            addRow({
                instrument: 'svo',
                item_id: it.id,
                item_num: it.num,
                reverseKeyed: false,
                options_json: optionsJson,
            });
        }
    }

    return rows;
}

/**
 * Write item_dictionary.tsv once (skip if file already exists).
 */
function maybeWriteItemDictionary(output, outDir, bakDir, fs, path, atomicWrite, toTsvLine) {
    const outPath = path.join(outDir, 'item_dictionary.tsv');
    const bakPath = path.join(bakDir, 'item_dictionary.tsv');

    if (fs.existsSync(outPath) && fs.existsSync(bakPath)) return;

    const rows = extractItemDictionaryRows(output);
    if (!rows.length) return;

    const headerLine = ITEM_DICT_HEADERS.join('\t') + '\n';
    const body = rows.map(r => toTsvLine(ITEM_DICT_HEADERS, r)).join('');
    const content = headerLine + body;

    if (!fs.existsSync(outPath)) atomicWrite(outPath, content);
    if (!fs.existsSync(bakPath)) atomicWrite(bakPath, content);
}

/**
 * Compute percentile (0-100) using linear interpolation.
 * Returns null for empty array.
 */
function percentile(values, p) {
    if (!values || !values.length) return null;
    const vals = [...values].sort((a, b) => a - b);
    if (vals.length === 1) return vals[0];
    p = Math.max(0, Math.min(100, p));
    const k = (vals.length - 1) * (p / 100);
    const f = Math.floor(k);
    const c = Math.min(f + 1, vals.length - 1);
    if (f === c) return vals[f];
    return vals[f] * (c - k) + vals[c] * (k - f);
}

/**
 * Convert an MFQ foundation mean to a coarse level label.
 * Thresholds: low < 2.5, medium < 3.5, high >= 3.5 (on 0-5 scale).
 */
function mfqLevelFromMean(meanVal, lowToMedium = 2.5, mediumToHigh = 3.5) {
    const x = Number(meanVal);
    if (!Number.isFinite(x)) return '';
    if (x < lowToMedium) return 'low';
    if (x < mediumToHigh) return 'medium';
    return 'high';
}

/**
 * Escape a single value for CSV output.
 * Quotes fields containing commas, double-quotes, or newlines.
 */
function csvEscape(val) {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

/**
 * Convert a row object to a CSV line (with trailing newline).
 */
function toCsvLine(headers, row) {
    return headers.map(h => csvEscape(row[h])).join(',') + '\n';
}

module.exports = {
    sessionStatus,
    isFinalOutput,
    safeCol,
    buildParticipantsRow,
    flattenScoresWide,
    flattenMathChecksMetrics,
    flattenMfqSession2,
    flattenAllDataWide,
    appendResponsesCompact,
    extractItemDictionaryRows,
    maybeWriteItemDictionary,
    updateLatestTable,
    percentile,
    mfqLevelFromMean,
    csvEscape,
    toCsvLine
};

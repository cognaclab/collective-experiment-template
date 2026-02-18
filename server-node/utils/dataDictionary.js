/**
 * Data dictionary generator.
 * Produces a schema description TSV for all exported output files.
 * Written once at server startup.
 */

const fs = require('fs');
const path = require('path');
const { tsvEscape } = require('./file');

const DATA_DICTIONARY_HEADERS = ['table', 'column', 'type', 'description', 'example', 'notes'];

function buildDataDictionaryRows() {
    const rows = [];

    function add(table, column, type, description, example, notes) {
        rows.push({
            table,
            column,
            type,
            description,
            example: example || '',
            notes: notes || '',
        });
    }

    // sessions_manifest.tsv
    const manifest = 'group/sessions_manifest.tsv';
    add(manifest, 'serverReceivedAt', 'iso_datetime', 'When the server processed the latest save for this session.', '2026-01-05T14:42:47.395Z');
    add(manifest, 'sessionKey', 'string', 'Primary unique session key: <sessionId>__<mode>.', '7b9e...__prod');
    add(manifest, 'participantIndex', 'int', 'Server-assigned sequential participant index (separate sequences per mode).', '12');
    add(manifest, 'sessionId', 'string', 'Client-generated session UUID.', '7b9e3462-0f68-4b9a-81f1-a7904bb53dd5');
    add(manifest, 'mode', 'string', 'Collection mode: prod or trial.', 'prod');
    add(manifest, 'status', 'string', 'Session status derived from meta fields.', 'in_progress', 'Values: in_progress | completed | terminated');
    add(manifest, 'final', 'bool', 'True if the session was finalized (completed/terminated) when recorded.', 'true');
    add(manifest, 'autosaveSeq', 'int', 'Client-side autosave sequence counter.', '5');
    add(manifest, 'lastAutosaveAt', 'iso_datetime', 'Client timestamp for last autosave.', '2026-01-05T14:42:46.000Z');
    add(manifest, 'startedAt', 'iso_datetime', 'Client timestamp when session started.', '2026-01-05T14:40:00.000Z');
    add(manifest, 'completedAt', 'iso_datetime', 'Client timestamp when fully completed (empty if not completed).');
    add(manifest, 'terminatedReason', 'string', 'If terminated early, reason string (e.g., no_consent).');
    add(manifest, 'flow_order', 'string', 'Comma-separated questionnaire order used for this session.', 'hexaco100,ipip120,mfq30,d70,svo');
    add(manifest, 'flow_source', 'string', 'Where the flow order came from.', 'launcher', 'Values typically: launcher | url | default');
    add(manifest, 'sessionDir', 'string', 'Relative path to the per-session snapshot directory.', 'sessions/7b9e...__prod');
    add(manifest, 'latestJson', 'string', 'Relative path to the per-session JSON snapshot.', 'sessions/.../latest.json');
    add(manifest, 'latestResponsesTsv', 'string', 'Relative path to per-session item-level TSV.');
    add(manifest, 'latestScoresTsv', 'string', 'Relative path to per-session score TSV.');
    add(manifest, 'latestParticipantTsv', 'string', 'Relative path to per-session one-row participant/meta TSV.');
    add(manifest, 'latestScoresWideTsv', 'string', 'Relative path to per-session one-row wide scores TSV.');
    add(manifest, 'error', 'string', 'Reserved for server-side error reporting (usually empty).');

    // participant_index.tsv
    const idx = 'group/participant_index.tsv';
    add(idx, 'sessionKey', 'string', 'Session key.');
    add(idx, 'mode', 'string', 'prod or trial.');
    add(idx, 'participantIndex', 'int', 'Sequential participant index within the mode.');
    add(idx, 'assignedAt', 'iso_datetime', 'When the server assigned the participant index.');

    // ipip120_order.tsv
    const ipip = 'group/ipip120_order.tsv';
    add(ipip, 'presented_index', 'int', '0-based index in the presented order.', '0');
    add(ipip, 'presented_num', 'int', '1-based display number shown to participants (if renumbering enabled).', '1');
    add(ipip, 'item_id', 'string', 'Stable item id.');
    add(ipip, 'original_item_num', 'int', 'Original item number from the source document.');
    add(ipip, 'reverse_keyed', 'bool', 'Whether the item is reverse-keyed for scoring.');
    add(ipip, 'item_text', 'string', 'Exact presented item wording.');
    add(ipip, 'order_mode', 'string', 'Randomization mode (global or perSession).', 'global');
    add(ipip, 'global_seed', 'string', 'Seed string used when order_mode=global.', 'ipip120_global_v1');
    add(ipip, 'seed_salt', 'string', 'Salt used when order_mode=perSession.');
    add(ipip, 'seed', 'string', 'Concrete seed used for this order (debug/audit).');
    add(ipip, 'renumber_display', 'bool', 'Whether displayed numbers are renumbered 1..N in presented order.');

    // item_dictionary.tsv
    const item = 'item_dictionary.tsv';
    add(item, 'instrument', 'string', 'Instrument id.', 'hexaco100');
    add(item, 'item_id', 'string', 'Stable item id used in responses.');
    add(item, 'item_num', 'int', 'Original item number from document.');
    add(item, 'facet', 'string', 'Facet/domain tag (instrument-specific).');
    add(item, 'key', 'string', 'Facet key / scoring key (instrument-specific).');
    add(item, 'mfq_var', 'string', 'MFQ foundation variable name (mfq30 only).');
    add(item, 'mfq_scoredItem', 'bool', 'MFQ: whether this item is included in scoring (vs catch/attention item).');
    add(item, 'item_text', 'string', 'Exact item wording (blank for SVO; see options_json).');
    add(item, 'reverseKeyed', 'bool', 'Whether this item is reverse-keyed.');
    add(item, 'reverseFormula', 'string', 'Reverse scoring formula (e.g., 6 - raw) when applicable.');
    add(item, 'options_json', 'json', 'For SVO: JSON of youReceive/otherReceives arrays for each column.');

    // responses_compact.tsv
    const compact = 'responses_compact.tsv';
    add(compact, 'participantIndex', 'int', 'Participant index (per mode).');
    add(compact, 'sessionKey', 'string', 'Session key.');
    add(compact, 'sessionId', 'string', 'Session id.');
    add(compact, 'mode', 'string', 'prod or trial.');
    add(compact, 'instrument', 'string', 'Instrument id.');
    add(compact, 'item_id', 'string', 'Stable item id.');
    add(compact, 'item_num', 'int', 'Original item number.');
    add(compact, 'presented_num', 'int', 'Displayed number in presented order (IPIP uses randomized numbering).');
    add(compact, 'raw_value', 'number', 'Raw recorded response value (e.g., Likert 1..5).');
    add(compact, 'scored_value', 'number', 'Scored value after reverse-keying where applicable.');
    add(compact, 'rt_first_ms', 'int', 'First-response reaction time in milliseconds.');
    add(compact, 'rt_last_ms', 'int', 'Last-change reaction time in milliseconds.');
    add(compact, 'svo_expected_you', 'int', 'SVO: expected YOU payoff based on slider choice.');
    add(compact, 'svo_expected_other', 'int', 'SVO: expected OTHER payoff based on slider choice.');
    add(compact, 'svo_written_you_num', 'int', 'SVO: typed YOU value (parsed number).');
    add(compact, 'svo_written_other_num', 'int', 'SVO: typed OTHER value (parsed number).');
    add(compact, 'svo_written_matches_expected', 'bool', 'SVO: whether typed values match the selected column.');
    add(compact, 'extra', 'string', 'Instrument-specific extra field (e.g., math attempt JSON).');

    // responses_long.tsv
    const longResp = 'responses_long.tsv';
    add(longResp, 'participantIndex', 'id', 'Participant/session identifier.');
    add(longResp, 'sessionKey', 'id', 'Session key.');
    add(longResp, 'sessionId', 'id', 'Session id.');
    add(longResp, 'mode', 'id', 'prod or trial.');
    add(longResp, 'raw_value', 'number', 'Raw answer as selected/typed by participant.', '4', 'For Likert items: usually 1..5. For SVO: choiceIndex 0..8.');
    add(longResp, 'scored_value', 'number', 'Value used for scoring (after reverse-keying).', '2', 'For non-reverse items, scored_value == raw_value.');
    add(longResp, 'reverseKeyed', 'bool', 'Whether the item was reverse-keyed.', 'true');
    add(longResp, 'extra', 'string', 'Extra audit payload. Often blank, but may contain JSON.', '{"attempts":[...]}', 'Math checks store full attempt history here.');

    // scores_long.tsv
    const longScore = 'scores_long.tsv';
    add(longScore, 'participantIndex', 'id', 'Participant/session identifier.');
    add(longScore, 'sessionKey', 'id', 'Session key.');
    add(longScore, 'sessionId', 'id', 'Session id.');
    add(longScore, 'mode', 'id', 'prod or trial.');
    add(longScore, 'score_type', 'string', 'What the row represents (facet_sum, facet_mean, domain_sum, etc.).');
    add(longScore, 'value', 'number', 'Numeric score value (sum/mean/etc.).');
    add(longScore, 'detail', 'json', 'Audit payload (items, sums, nItems, etc.).', '{"nItems":10,"items":[...]}');

    // scores_wide.tsv
    const wide = 'scores_wide.tsv (and group/scores_wide_latest.tsv)';
    add(wide, 'serverReceivedAt', 'iso_datetime', 'When server wrote/updated the wide row.');
    add(wide, 'sessionKey', 'string', 'Session key.');
    add(wide, 'participantIndex', 'int', 'Participant index.');
    add(wide, 'mode', 'string', 'prod or trial.');
    add(wide, 'status', 'string', 'in_progress/completed/terminated.');
    add(wide, 'hexaco_factor_mean_<FACTOR>', 'float', 'HEXACO factor mean score.', '3.4', '<FACTOR> is sanitized factor name.');
    add(wide, 'hexaco_factor_sum_<FACTOR>', 'float', 'HEXACO factor sum score.');
    add(wide, 'hexaco_facet_mean_<FACET>', 'float', 'HEXACO facet mean score.');
    add(wide, 'hexaco_facet_sum_<FACET>', 'float', 'HEXACO facet sum score.');
    add(wide, 'ipip_domain_mean_<DOMAIN>', 'float', 'IPIP-NEO domain mean score.');
    add(wide, 'ipip_domain_sum_<DOMAIN>', 'float', 'IPIP-NEO domain sum score.');
    add(wide, 'ipip_facet_mean_<FACET>', 'float', 'IPIP-NEO facet mean score.');
    add(wide, 'ipip_facet_sum_<FACET>', 'float', 'IPIP-NEO facet sum score.');
    add(wide, 'mfq_foundation_mean_<FOUNDATION>', 'float', 'MFQ foundation mean score (combined parts).');
    add(wide, 'mfq_foundation_sum_<FOUNDATION>', 'float', 'MFQ foundation sum score (combined parts).');
    add(wide, 'd70_mean', 'float', 'D70 mean score.');
    add(wide, 'd70_sum', 'float', 'D70 sum score.');
    add(wide, 'svo_angle_deg', 'float', 'SVO angle in degrees.');
    add(wide, 'svo_category', 'string', 'SVO categorical type based on angle.');

    // mfq_session2.tsv
    const mfq2 = 'mfq_session2.tsv (and mfq_session2.csv)';
    add(mfq2, 'serverReceivedAt', 'iso_datetime', 'When the server wrote this derived MFQ row.');
    add(mfq2, 'subjectId', 'string', 'ID used for downstream Session 2 imports. Currently equals sessionId.');
    add(mfq2, 'sessionId', 'string', 'Survey-generated session ID.');
    add(mfq2, 'sessionKey', 'string', 'Session key (sessionId__mode).');
    add(mfq2, 'participantIndex', 'int', 'Per-mode participant index.');
    add(mfq2, 'mode', 'string', 'prod or trial.');
    add(mfq2, 'status', 'string', 'in_progress/completed/terminated.');
    add(mfq2, 'harm', 'float', 'MFQ foundation mean (combined parts), 0-5 scale.');
    add(mfq2, 'fairness', 'float', 'MFQ foundation mean (combined parts), 0-5 scale.');
    add(mfq2, 'loyalty', 'float', 'MFQ foundation mean for Ingroup/Loyalty (combined parts), 0-5 scale.');
    add(mfq2, 'authority', 'float', 'MFQ foundation mean (combined parts), 0-5 scale.');
    add(mfq2, 'purity', 'float', 'MFQ foundation mean (combined parts), 0-5 scale.');
    add(mfq2, '<foundation>_level', 'string', 'Low/medium/high label computed from default thresholds (2.5, 3.5).');
    add(mfq2, 'binding_mean', 'float', 'Mean of loyalty, authority, purity (if all present).');
    add(mfq2, 'individualizing_mean', 'float', 'Mean of harm and fairness (if both present).');
    add(mfq2, 'binding_minus_individualizing', 'float', 'binding_mean - individualizing_mean.');
    add(mfq2, 'abs_binding_minus_individualizing', 'float', 'Absolute value of binding_minus_individualizing (balance metric).', '', 'Smaller values mean more balanced/mixed.');
    add(mfq2, '<metric>_quartile', 'int', 'Quartile label (1..4) computed per MODE across COMPLETED rows.', '3', 'Boundary rule: Q1=value<=q25, Q2<=q50, Q3<=q75, Q4>q75');
    add(mfq2, 'mfq_profile_quartile3', 'string', '3-way moral profile label: binding / mixed / individualizing.', 'mixed');
    add(mfq2, 'mfq_profile_quartile3_code', 'int', 'Numeric code (1=binding, 2=mixed, 3=individualizing).', '2');

    // math_checks_metrics.tsv
    const math = 'math_checks_metrics.tsv (and group/math_checks_metrics_latest.tsv)';
    add(math, 'serverReceivedAt', 'iso_datetime', 'When the server wrote this derived math metrics row.');
    add(math, 'sessionKey', 'string', 'Session key.');
    add(math, 'participantIndex', 'int', 'Per-mode participant index.');
    add(math, 'mode', 'string', 'prod or trial.');
    add(math, 'status', 'string', 'in_progress/completed/terminated.');
    add(math, 'math_n_checks', 'int', 'Number of math check items.');
    add(math, 'math_n_attempts_total', 'int', 'Total attempts across all math checks.');
    add(math, 'math_first_try_correct_n', 'int', 'How many checks were correct on first try.');
    add(math, 'math_first_try_accuracy', 'float', 'math_first_try_correct_n / math_n_checks.');
    add(math, 'math_final_correct_n', 'int', 'How many checks ended correct on the last attempt.');
    add(math, 'math_final_accuracy', 'float', 'math_final_correct_n / math_n_checks.');
    add(math, 'math_first_rt_mean_ms', 'float', 'Mean RT (ms) on first attempt per check.');
    add(math, 'math_final_rt_mean_ms', 'float', 'Mean RT (ms) on final attempt per check.');
    add(math, '<math_check_id>__*', 'mixed', 'Per-check detail columns (expression, correct answer, final response, attempts_n, first_rt_ms, first_correct, final_rt_ms, final_correct, etc.).');

    // all_data_wide.tsv
    const allWide = 'all_data_wide.tsv';
    add(allWide, '(many columns)', 'n/a', 'One row per FINAL session. Includes: participants.tsv columns + scores_wide.tsv columns + item-level raw/scored values and RTs with item-id-based column names.');
    add(allWide, '<item_id>__raw', 'mixed', 'Raw response value for that item (numeric for Likert, string for free text).');
    add(allWide, '<item_id>__scored', 'float', 'Reverse-scored value when applicable (Likert items). For MFQ items, equals raw.');
    add(allWide, '<item_id>__rt_first_ms', 'float', 'First-response RT in ms for that item.');
    add(allWide, '<item_id>__rt_last_ms', 'float', 'Last-change RT in ms for that item.');
    add(allWide, 'svo_XX__choice_index', 'int', 'SVO slider column index (0-8).');
    add(allWide, '<math_check_id>__*', 'mixed', 'Per-math-check detail fields (expression, correct, response, attempts, RTs, correctness).');

    return rows;
}

function writeDataDictionary(outDir, bakDir, atomicWrite, ensureDir) {
    const groupDir = path.join(outDir, 'group');
    const groupBakDir = path.join(bakDir, 'group');
    ensureDir(groupDir);
    ensureDir(groupBakDir);

    const rows = buildDataDictionaryRows();
    const headerLine = DATA_DICTIONARY_HEADERS.join('\t') + '\n';
    const body = rows.map(r =>
        DATA_DICTIONARY_HEADERS.map(h => tsvEscape(r[h])).join('\t') + '\n'
    ).join('');
    const content = headerLine + body;

    atomicWrite(path.join(groupDir, 'data_dictionary.tsv'), content);
    atomicWrite(path.join(groupBakDir, 'data_dictionary.tsv'), content);
}

module.exports = { buildDataDictionaryRows, writeDataDictionary };

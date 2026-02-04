# # 01 — Build tidy outputs from raw session snapshots
# 
# This notebook converts the per-session snapshots written by the server (in `output/raw_sessions/`) into **tidy** (analysis-ready) files.
# 
# **Key requirements implemented here**
# 
# - Uses **Prolific ID** (`prolificId`) for participant syncing across sessions.
# - Writes **tidy data** tables (long + wide) following the tidy-data principles (variables=columns, observations=rows, one table per entity).
# - Filters to **completed sessions only** when generating analysis-ready combined outputs.
# 
# ## Inputs
# 
# - `../output/raw_sessions/<sessionKey>.json`
# - `../output/raw_sessions/<sessionKey>_responses.tsv`
# - `../output/raw_sessions/<sessionKey>_scores.tsv`
# 
# ## Outputs
# 
# Written to `../output/tidy/`:
# 
# - `participants.tsv` / `participants.csv`
# - `responses_long.tsv` / `responses_long.csv`
# - `scores_long.tsv` / `scores_long.csv`
# - `scores_wide.tsv` / `scores_wide.csv`
# 
# Optionally (toggle in code): per-session tidy copies in `../output/tidy/sessions/<sessionKey>/`.

# ## 0) Setup
# 
# We keep all paths relative to this notebook so it can be run on any machine after cloning / unzipping the project.

from __future__ import annotations

from pathlib import Path
import json
import re

import pandas as pd

# Notebook-relative paths
PROJECT_ROOT = Path('..').resolve()
RAW_DIR = PROJECT_ROOT / 'output' / 'raw_sessions'
TIDY_DIR = PROJECT_ROOT / 'output' / 'tidy'
GROUP_DIR = PROJECT_ROOT / 'output' / 'group'

TIDY_DIR.mkdir(parents=True, exist_ok=True)
GROUP_DIR.mkdir(parents=True, exist_ok=True)

print('PROJECT_ROOT:', PROJECT_ROOT)
print('RAW_DIR:', RAW_DIR)
print('TIDY_DIR:', TIDY_DIR)


# ## 1) Helper: read the Demographics spec (to determine which questions are required)
# 
# The raw JSON output contains demographic responses, but not the `required` flag. The spec in `data/demographics.js` *does* include it, so we parse it once here.
# 
# This keeps the **definition of “completed session”** consistent with the instrument definition.

def load_demographics_spec() -> dict:
    js_path = PROJECT_ROOT / 'data' / 'demographics.js'
    txt = js_path.read_text(encoding='utf-8')

    # Extract the JSON object assigned to window.RIKEN_SURVEY_DATA["demographics"]
    # This file is valid JSON embedded in a JS assignment.
    m = re.search(r'window\.RIKEN_SURVEY_DATA\["demographics"\]\s*=\s*(\{.*?\});\s*$', txt, flags=re.S | re.M)
    if not m:
        raise ValueError('Could not locate demographics JSON block in demographics.js')

    obj = json.loads(m.group(1))
    return obj


demo_spec = load_demographics_spec()
required_demo_ids = [q['id'] for q in demo_spec.get('questions', []) if q.get('required')]

print('Required demographics question IDs:')
print(required_demo_ids)
print('n_required =', len(required_demo_ids))


# ## 2) Load per-session JSON snapshots
# 
# We use these JSON snapshots to build a **participants/session table** and to identify which sessions are *completed*.
# 
# ### Definition: completed session
# 
# A session is treated as **completed** if:
# 
# 1. `meta.completedAt` is present
# 2. `meta.terminatedReason` is empty/null
# 3. All required items across all instruments in this build are answered (no missing values)
# 
# (We enforce rule #3 to guard against edge-cases like browser crashes or manual tampering.)

def is_blank(x) -> bool:
    return x is None or (isinstance(x, str) and x.strip() == '')


def session_completed_all(out: dict) -> bool:
    meta = out.get('meta', {}) or {}
    if is_blank(meta.get('completedAt')):
        return False
    if not is_blank(meta.get('terminatedReason')):
        return False

    # --- Demographics (only required questions) ---
    demo_rows = ((out.get('responses', {}) or {}).get('demographics') or [])
    demo_map = {r.get('id'): r for r in demo_rows if isinstance(r, dict)}
    for qid in required_demo_ids:
        row = demo_map.get(qid, {})
        if is_blank(row.get('response')):
            return False

    # Determine which blocks were actually shown in this session.
    flow = meta.get('flow') or {}
    shown_blocks = flow.get('order') or []
    shown_blocks = [str(b) for b in shown_blocks] if isinstance(shown_blocks, (list, tuple)) else []

    # --- Likert instruments (all items must be answered) ---
    for inst_id in ['mfq30', 'hexaco100', 'svo', 'ipip120', 'd70']:
        if shown_blocks and inst_id not in shown_blocks:
            continue
        if inst_id in ['hexaco100', 'ipip120', 'd70']:
            items = ((out.get('responses', {}) or {}).get(inst_id) or [])
            for it in items:
                if not isinstance(it, dict):
                    continue
                resp = it.get('response') or {}
                if is_blank(resp.get('value')):
                    return False


    # --- MFQ (both parts, all items must be answered) ---
    if not (shown_blocks and 'mfq30' not in shown_blocks):
        mfq = ((out.get('responses', {}) or {}).get('mfq30') or {})
        for part_key in ['part1', 'part2']:
            part = mfq.get(part_key) or {}
            for it in part.get('items', []) or []:
                resp = it.get('response') or {}
                if is_blank(resp.get('value')):
                    return False


    # --- SVO (all items must have a slider choice AND written values) ---
    if not (shown_blocks and 'svo' not in shown_blocks):
        for it in ((out.get('responses', {}) or {}).get('svo') or []):
            if not isinstance(it, dict):
                continue
            if it.get('choiceIndex') is None:
                return False
            w = it.get('written') or {}
            if w.get('youNum') is None or w.get('otherNum') is None:
                return False

    # --- Math checks (only if enabled for this session) ---
    math_enabled = bool(flow.get('enableMathChecks'))
    if math_enabled:
        for it in ((out.get('responses', {}) or {}).get('math_checks') or []):
            if not isinstance(it, dict):
                continue
            if is_blank(it.get('response')):
                return False

    return True


def load_all_sessions() -> list[dict]:
    outs = []
    if not RAW_DIR.exists():
        return outs

    for json_path in sorted(RAW_DIR.glob('*.json')):
        try:
            out = json.loads(json_path.read_text(encoding='utf-8'))
            out['_file'] = str(json_path)
            outs.append(out)
        except Exception as e:
            print('Failed to read', json_path, ':', e)

    return outs


sessions = load_all_sessions()
print('Loaded session JSON files:', len(sessions))


# ## 3) Build the `participants` (session-level) tidy table
# 
# One row = one **session**.
# 
# This table is the *join key* for all other outputs.

def extract_demographics_wide(out: dict) -> dict:
    rows = ((out.get('responses', {}) or {}).get('demographics') or [])
    demo = {}
    for r in rows:
        if not isinstance(r, dict):
            continue
        qid = r.get('id')
        if not qid:
            continue
        demo[qid] = r.get('response')
        if r.get('extraText') is not None:
            demo[qid + '__extraText'] = r.get('extraText')
    return demo


def build_participants_df(sessions: list[dict]) -> pd.DataFrame:
    rows = []
    for out in sessions:
        meta = out.get('meta', {}) or {}
        demo = extract_demographics_wide(out)

        # Canonical IDs
        prolific_id_from_demo = demo.get('prolific_id')
        prolific_id_from_meta = meta.get('prolificId')

        row = {
            'prolificId': prolific_id_from_meta or prolific_id_from_demo or None,
            'participantIndex': meta.get('participantIndex'),
            'sessionKey': meta.get('sessionKey') or f"{meta.get('sessionId')}__{meta.get('mode')}",
            'sessionId': meta.get('sessionId'),
            'mode': meta.get('mode'),
            'startedAt': meta.get('startedAt'),
            'completedAt': meta.get('completedAt'),
            'terminatedReason': meta.get('terminatedReason'),
            'serverReceivedAt': meta.get('serverReceivedAt'),
            'flow_order': ','.join((meta.get('flow') or {}).get('order') or []),
            'flow_enable_math': (meta.get('flow') or {}).get('enableMathChecks'),
            'completed_all': session_completed_all(out),
            '_source_file': out.get('_file'),
        }

        # Add demographics as additional columns (still tidy for a participant/session table)
        row.update(demo)
        rows.append(row)

    df = pd.DataFrame(rows)

    # Best-effort stable ordering
    if 'participantIndex' in df.columns:
        df = df.sort_values(['mode', 'participantIndex'], kind='stable', na_position='last')

    return df


participants = build_participants_df(sessions)
participants.head(3)


# ### Quick QA summaries

if len(participants):
    print('Sessions:', len(participants))
    print('Completed (completed_all=True):', int(participants['completed_all'].sum()))
    print('By mode:')
    print(participants.groupby('mode')['completed_all'].sum())
else:
    print('No session files found yet. Run the survey once, then re-run this notebook.')


# ## 4) Load and combine the client-generated TSV exports
# 
# The frontend already exports:
# 
# - `*_responses.tsv`  (item-level tidy/long table)
# - `*_scores.tsv`     (score-level tidy/long table)
# 
# We concatenate these across sessions and then filter to **completed sessions only**.

def read_many_tsv(pattern: str) -> pd.DataFrame:
    files = sorted(RAW_DIR.glob(pattern))
    if not files:
        return pd.DataFrame()

    dfs = []
    for p in files:
        try:
            df = pd.read_csv(p, sep='	', dtype=str)
            df['_source_file'] = str(p)
            dfs.append(df)
        except Exception as e:
            print('Failed to read', p, ':', e)

    return pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()


responses_long = read_many_tsv('*_responses.tsv')
scores_long = read_many_tsv('*_scores.tsv')

print('responses_long rows:', len(responses_long))
print('scores_long rows:', len(scores_long))


# ## 5) Filter to completed sessions and write tidy outputs
# 
# We use `participants.completed_all` as the ground-truth completion flag.
# 
# We also create a standard wide score file (`scores_wide`) by pivoting `scores_long`.

def write_tsv_and_csv(df: pd.DataFrame, stem: str, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    tsv_path = out_dir / f'{stem}.tsv'
    csv_path = out_dir / f'{stem}.csv'

    df.to_csv(tsv_path, sep='	', index=False)
    df.to_csv(csv_path, index=False)


# --- completed session keys ---
completed_keys = set(participants.loc[participants['completed_all'] == True, 'sessionKey'].dropna().astype(str))

# Filter long tables
responses_long_completed = responses_long[responses_long['sessionKey'].astype(str).isin(completed_keys)].copy() if len(responses_long) else pd.DataFrame()
scores_long_completed = scores_long[scores_long['sessionKey'].astype(str).isin(completed_keys)].copy() if len(scores_long) else pd.DataFrame()

# Write participants table (includes both completed & non-completed; you can filter later)
write_tsv_and_csv(participants, 'participants', TIDY_DIR)

# Write analysis-ready long tables (completed only)
write_tsv_and_csv(responses_long_completed, 'responses_long', TIDY_DIR)
write_tsv_and_csv(scores_long_completed, 'scores_long', TIDY_DIR)


# --- Build responses_wide (raw + scored) ---
def make_item_key(df: pd.DataFrame) -> pd.Series:
    # Keep full question text + item number in the column name (as requested)
    num = df.get('item_num', '').astype(str).str.zfill(3)
    iid = df.get('item_id', '').astype(str)
    txt = df.get('item_text', '').astype(str)
    inst = df.get('instrument', '').astype(str)
    return inst + '__' + num + '__' + iid + '__' + txt

def make_score_key(df: pd.DataFrame) -> pd.Series:
    inst = df.get('instrument', '').astype(str)
    stype = df.get('score_type', '').astype(str)
    name = df.get('name', '').astype(str)
    return inst + '__' + stype + '__' + name

if len(responses_long_completed):
    responses_long_completed = responses_long_completed.copy()
    responses_long_completed['item_key'] = make_item_key(responses_long_completed)

    # Raw value wide
    wide_raw = responses_long_completed.pivot_table(
        index=['prolificId', 'participantIndex', 'sessionKey', 'sessionId', 'mode'],
        columns='item_key',
        values='response_value',
        aggfunc='first'
    ).reset_index()
    wide_raw.columns = [c if isinstance(c, str) else str(c) for c in wide_raw.columns]
    write_tsv_and_csv(wide_raw, 'responses_wide_raw', TIDY_DIR)

    # Scored value wide (reverse-scored etc.)
    wide_scored = responses_long_completed.pivot_table(
        index=['prolificId', 'participantIndex', 'sessionKey', 'sessionId', 'mode'],
        columns='item_key',
        values='scored_value',
        aggfunc='first'
    ).reset_index()
    wide_scored.columns = [c if isinstance(c, str) else str(c) for c in wide_scored.columns]
    write_tsv_and_csv(wide_scored, 'responses_wide_scored', TIDY_DIR)

# --- Build scores_wide (completed only) ---
if len(scores_long_completed):
    scores_long_completed = scores_long_completed.copy()
    scores_long_completed['score_key'] = make_score_key(scores_long_completed)

    wide = scores_long_completed.pivot_table(
        index=['prolificId', 'participantIndex', 'sessionKey', 'sessionId', 'mode'],
        columns='score_key',
        values='value',
        aggfunc='first'
    ).reset_index()

    wide.columns = [c if isinstance(c, str) else str(c) for c in wide.columns]
    write_tsv_and_csv(wide, 'scores_wide', TIDY_DIR)

print('Wrote tidy outputs to:', TIDY_DIR)


# ## 6) (Optional) Write per-session tidy copies
# 
# If you need **individual** tidy files for each session (e.g., for audits), enable the flag below.
# 
# > Warning: for large N this can create many small files.

WRITE_PER_SESSION_TIDY = False

if WRITE_PER_SESSION_TIDY and len(completed_keys):
    sess_dir = TIDY_DIR / 'sessions'
    sess_dir.mkdir(exist_ok=True)

    for sk in sorted(completed_keys):
        ssub = sess_dir / sk
        ssub.mkdir(parents=True, exist_ok=True)

        # Participants row
        write_tsv_and_csv(participants[participants['sessionKey'].astype(str) == sk], 'participants', ssub)

        # Responses and scores
        if len(responses_long_completed):
            write_tsv_and_csv(responses_long_completed[responses_long_completed['sessionKey'].astype(str) == sk], 'responses_long', ssub)
        if len(scores_long_completed):
            write_tsv_and_csv(scores_long_completed[scores_long_completed['sessionKey'].astype(str) == sk], 'scores_long', ssub)

    print('Per-session tidy files written under:', sess_dir)
else:
    print('WRITE_PER_SESSION_TIDY is False (no per-session tidy files written).')


# Port V20 Save Logic to Node.js

## Problem

The current Node.js server uses `sessions/<sessionId>/` for file storage. The v20 Python server uses `raw_sessions/<prolificId>__<sessionKey>.json` which is required for proper data organization with Prolific IDs.

## Key Differences

| Feature | Current Node.js | V20 Python (Required) |
|---------|----------------|----------------------|
| File naming | `sessions/<sessionKey>/latest.json` | `raw_sessions/<prolificId>__<sessionKey>.json` |
| Prolific ID | Not used | Primary identifier in filenames |
| Completed sessions | Same location | Copied to `raw_final/` |
| Session dirs | Always created | Optional (env flag) |

---

## Proposed Changes to `handlers/save.js`

### 1. Extract prolificId from meta (~line 154)

```javascript
// Extract prolificId (used for cross-session syncing + file naming)
let prolificRaw = '';
for (const k of ['prolificId', 'prolificID', 'prolific_id', 'PROLIFIC_PID']) {
    if (meta[k]) {
        prolificRaw = String(meta[k]);
        break;
    }
}
const prolificSanitized = prolificRaw ? safeId(prolificRaw) : '';
const prolificId = prolificSanitized || `NO_PROLIFIC_ID_p${participantIndex}`;

// Store back into meta
meta.prolificId = prolificRaw || prolificId;

// File key: prolificId first, then sessionKey
const fileKey = `${prolificId}__${sessionKey}`;
```

### 2. Change directory structure

**Before:**
```javascript
const sessDir = path.join(outDir, 'sessions', sessionKey);
```

**After:**
```javascript
// Raw sessions directory (always used)
const rawDir = path.join(outDir, 'raw_sessions');
const rawBakDir = path.join(bakDir, 'raw_sessions');
ensureDir(rawDir);
ensureDir(rawBakDir);

// Optional per-session snapshot dirs (dev/debug only)
const writeSessionDir = process.env.RIKEN_WRITE_SESSION_DIR === '1';
if (writeSessionDir) {
    const sessDir = path.join(outDir, 'sessions', sessionKey);
    const sessBakDir = path.join(bakDir, 'sessions', sessionKey);
    ensureDir(sessDir);
    ensureDir(sessBakDir);
}
```

### 3. Write to raw_sessions with fileKey

**Before:**
```javascript
atomicWrite(path.join(sessDir, 'latest.json'), jsonBytes);
```

**After:**
```javascript
// Write per-session raw JSON snapshot (OVERWRITTEN on every autosave)
atomicWrite(path.join(rawDir, `${fileKey}.json`), jsonBytes);
atomicWrite(path.join(rawBakDir, `${fileKey}.json`), jsonBytes);

// Write TSV files
if (responsesTsv) {
    atomicWrite(path.join(rawDir, `${fileKey}_responses.tsv`), responsesTsv);
    atomicWrite(path.join(rawBakDir, `${fileKey}_responses.tsv`), responsesTsv);
}
if (scoresTsv) {
    atomicWrite(path.join(rawDir, `${fileKey}_scores.tsv`), scoresTsv);
    atomicWrite(path.join(rawBakDir, `${fileKey}_scores.tsv`), scoresTsv);
}
```

### 4. Add raw_final for completed sessions

```javascript
// Write immutable FINAL copies for completed sessions only
const completedAt = meta.completedAt || '';
const terminatedReason = meta.terminatedReason || '';

if (completedAt && !terminatedReason) {
    const rawFinalDir = path.join(outDir, 'raw_final');
    const rawFinalBakDir = path.join(bakDir, 'raw_final');
    ensureDir(rawFinalDir);
    ensureDir(rawFinalBakDir);

    const ts = serverReceivedAt.replace(/:/g, '-').replace(/\./g, '-');
    const finalKey = `${fileKey}__final__${ts}`;

    atomicWrite(path.join(rawFinalDir, `${finalKey}.json`), jsonBytes);
    atomicWrite(path.join(rawFinalBakDir, `${finalKey}.json`), jsonBytes);

    if (responsesTsv) {
        atomicWrite(path.join(rawFinalDir, `${finalKey}_responses.tsv`), responsesTsv);
        atomicWrite(path.join(rawFinalBakDir, `${finalKey}_responses.tsv`), responsesTsv);
    }
    if (scoresTsv) {
        atomicWrite(path.join(rawFinalDir, `${finalKey}_scores.tsv`), scoresTsv);
        atomicWrite(path.join(rawFinalBakDir, `${finalKey}_scores.tsv`), scoresTsv);
    }
}
```

### 5. Update manifest row paths

```javascript
const manifestRow = {
    // ...existing fields...
    rawJson: `raw_sessions/${fileKey}.json`,
    rawResponsesTsv: `raw_sessions/${fileKey}_responses.tsv`,
    rawScoresTsv: `raw_sessions/${fileKey}_scores.tsv`,
    // Optional dev/debug per-session directory (may be blank)
    sessionDir: writeSessionDir ? `sessions/${sessionKey}` : '',
    // ...
};
```

---

## Output Directory Structure After Changes

```
output/
├── raw_sessions/           # Per-session snapshots (overwritten on save)
│   ├── <prolificId>__<sessionKey>.json
│   ├── <prolificId>__<sessionKey>_responses.tsv
│   └── <prolificId>__<sessionKey>_scores.tsv
├── raw_final/              # Immutable copies for completed sessions
│   └── <prolificId>__<sessionKey>__final__<timestamp>.json
├── group/                  # Study-level aggregate tables
│   ├── participant_index.tsv
│   ├── sessions_manifest.tsv
│   ├── participants_latest.tsv
│   └── scores_wide_latest.tsv
├── finalized/              # Completion flags
├── participants.tsv        # Append-only final data
├── responses_long.tsv
├── scores_long.tsv
├── scores_wide.tsv
└── save_log.jsonl
```

---

## Verification

1. Restart server after changes
2. Run a test survey (trial mode)
3. Verify files appear in `output/raw_sessions/` with format:
   - `NO_PROLIFIC_ID_p1__<sessionId>__trial.json`
4. Complete the survey and verify `raw_final/` gets populated

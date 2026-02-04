# RIKEN Survey (paper–pencil style, HTML/CSS/JS) — v19

This package implements the provided questionnaires in a **paper/pencil-like** web interface with:

- **Participant ID (Prolific ID) field at the very start** (`prolificId`)
  - used to sync the same person across Session 1 ↔ Session 2 (and across browser sessions)
  - supports Prolific’s standard URL parameter: `PROLIFIC_PID`
- **Consent + age gate** (immediate termination on NO consent)
- **Demographics at the end** (except Prolific ID + age + consent)
- **One page per questionnaire** (each instrument is a single page)
- **Timed arithmetic checks between questionnaires** (focus-in → Enter; no feedback)
- **Progress bar**
- **Background autosave**
  - localStorage backup in the browser
  - server-side saving via `POST /api/save`
- **Transparent scoring outputs**
  - per-item raw value + label
  - reverse-keyed flag + reverse formula (where applicable)
  - per-item scored value + label
  - scale totals (means and sums) with explicit item lists
  - SVO scoring (angle + category) + QC metrics
- **Per-item response timing** (saved, never shown to participants)

---

## Questionnaire order (default)

Participant-facing default order is:

1) **MFQ-30**
2) **HEXACO-100**
3) **SVO slider measure**
4) Others (currently: **IPIP-NEO-120**, **D70**)

This default can still be changed from `launcher.html` (runtime config).

---

## No `.py` files

This iteration removes Python scripts from the package.

- The web server is implemented in **Node.js** (`server/server.js`).
- Data processing and clustering are implemented in **modular Jupyter notebooks** (`notebooks/*.ipynb`).

---

## Quick start (Ubuntu/Linux/macOS)

### 1) Run the server

```bash
cd riken_survey_v19
node server/server.js
```

Open:

- **Launcher / Control Panel (researcher/admin):** `http://127.0.0.1:8000/launcher.html`
- **Production (participants):** `http://127.0.0.1:8000/` (or `/index.html`)
- **Trial / verification:** `http://127.0.0.1:8000/trial.html`

### 2) Generate tidy outputs + MFQ clusters

After you have collected data (or at any time during collection):

1. Run `notebooks/01_extract_tidy_outputs.ipynb`
2. Run `notebooks/02_mfq_clustering.ipynb`

Outputs are written to `output/tidy/` (and can be downloaded from the launcher via the export endpoints).

---

## Prolific integration

If you recruit using Prolific, the recommended participant URL is:

- `http://YOUR_SERVER/?PROLIFIC_PID={{PROLIFIC_PID}}`

The survey will prefill and lock the Prolific ID field to prevent accidental edits.

---

## Output files

See:

- `output/README.md` (folder + file overview)
- `output/tidy/README.md` (tidy tables)
- `output/raw_sessions/README.md` (raw per-session snapshots)

---

## MFQ clustering requirements (Session 2)

The MFQ clustering notebook implements:

- **Quartile-based 3-way profile** (`binding` / `mixed` / `individualizing`)
- **K-means clustering** (k=3) on:
  - raw MFQ foundations (5D)
  - factor composites (2D: binding_mean + individualizing_mean)
- **Algorithmic diagnostics** for candidate k values (silhouette, Calinski–Harabasz, Davies–Bouldin), while still producing the required **k=3** solution.

The Session 2 import convenience file is:

- `output/tidy/mfq_session2_prod_completed.csv`

This file is restricted to **production + completed** sessions only.

---

## Admin token (recommended)

The launcher uses privileged endpoints:

- writing runtime config: `POST /api/config`
- exporting files: `GET /api/export/*`

Set a stable token:

```bash
export RIKEN_ADMIN_TOKEN='your-long-random-token'
node server/server.js
```

If you do not set a token, the server auto-generates one and prints it on startup.

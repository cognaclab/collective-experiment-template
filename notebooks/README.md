# Notebooks (modular, fully explained)

This folder contains modular `.ipynb` notebooks.

Design principles:
- Each notebook is self-contained and has **markdown explanation cells** before each major code block.
- No `.py` scripts are used; all analysis logic lives in notebooks.
- All outputs are written as **tidy** tables (TSV + CSV) under `../output/tidy/`.

---

## 01_extract_tidy_outputs.ipynb

**Purpose:** Convert per-session snapshots into tidy combined datasets.

**Reads:**
- `../output/raw_sessions/*.json`
- `../output/raw_sessions/*_responses.tsv`
- `../output/raw_sessions/*_scores.tsv`

**Writes:**
- `../output/tidy/participants.tsv/csv`
- `../output/tidy/responses_long.tsv/csv`
- `../output/tidy/scores_long.tsv/csv`
- `../output/tidy/scores_wide.tsv/csv`

Also implements the project’s strict **completed session** rule (`completed_all`).

---

## 02_mfq_clustering.ipynb

**Purpose:** Create MFQ-30 moral-profile clusters for Session 2.

Implements:
- Quartile 3-way profile (binding / mixed / individualizing)
- K-means (k=3) clustering on:
  - raw 5D foundations
  - factor 2D composites
- Algorithmic diagnostics (silhouette, Calinski–Harabasz, Davies–Bouldin) across candidate k

**Reads:**
- `../output/tidy/participants.tsv`
- `../output/tidy/scores_long.tsv`

**Writes:**
- `../output/tidy/mfq_features.tsv/csv`
- `../output/tidy/mfq_cluster_assignments.tsv/csv`
- `../output/tidy/mfq_k_diagnostics.tsv/csv`
- `../output/tidy/mfq_session2_prod_completed.csv`

All clustering is restricted to **completed sessions only**.

---

## 03_sync_across_sessions_by_prolific_id.ipynb

**Purpose:** Demonstrate how to join multiple sessions per person using `prolificId`.

This is useful if you run a separate Session 2 app and later need to merge Session 1 + Session 2 datasets.

**Reads:**
- `../output/tidy/participants.tsv`
- optionally `../output/tidy/scores_wide.tsv` and `../output/tidy/mfq_cluster_assignments.tsv`

**Writes:**
- `../output/tidy/participants_by_prolific_id.tsv/csv`
- `../output/tidy/session_index_by_prolific_id.tsv/csv`


## Python script exports

For environments where you prefer running plain scripts, we also provide:

- `notebooks_py/*.py` — direct exports of the notebooks (markdown as comments).

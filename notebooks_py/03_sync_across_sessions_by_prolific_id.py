# # 03 — Syncing across sessions using `prolificId`
# 
# This notebook shows how to **join multiple sessions per person** using the Prolific ID field that is collected at the beginning of the survey.
# 
# Typical use cases:
# - **Session 1 → Session 2 linking** (same Prolific participant returns on another day)
# - Detecting accidental duplicate submissions
# - Building a participant-level dataset with one row per person
# 
# ## Inputs
# - `../output/tidy/participants.tsv`
# - `../output/tidy/scores_wide.tsv` (optional)
# - `../output/tidy/mfq_cluster_assignments.tsv` (optional)
# 
# ## Outputs
# Written to `../output/tidy/`:
# - `sessions_by_prolificId.tsv` / `.csv` — one row per (prolificId × session)
# - `participants_by_prolificId.tsv` / `.csv` — one row per prolificId with session counts and a simple session-ordering

from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path('..').resolve()
TIDY_DIR = PROJECT_ROOT / 'output' / 'tidy'

participants = pd.read_csv(TIDY_DIR / 'participants.tsv', sep='	', dtype=str)
participants['startedAt'] = pd.to_datetime(participants['startedAt'], errors='coerce')
participants['completedAt'] = pd.to_datetime(participants['completedAt'], errors='coerce')
participants['completed_all'] = participants['completed_all'].astype(str).str.lower().isin(['true','1','yes'])

# Optional enrichments
scores_wide = None
mfq_clusters = None
if (TIDY_DIR / 'scores_wide.tsv').exists():
    scores_wide = pd.read_csv(TIDY_DIR / 'scores_wide.tsv', sep='	', dtype=str)
if (TIDY_DIR / 'mfq_cluster_assignments.tsv').exists():
    mfq_clusters = pd.read_csv(TIDY_DIR / 'mfq_cluster_assignments.tsv', sep='	', dtype=str)

participants.head()

# ## Build a session-level table keyed by prolificId
# 
# We keep one row per session (per `sessionKey`) and then compute a simple session ordering (`session_n`) within each person based on `startedAt`.

sess = participants.copy()

# Basic QC: prolificId is the cross-session join key.
sess['prolificId'] = sess['prolificId'].fillna('').astype(str).str.strip()

# Drop rows without a prolificId (cannot sync across sessions)
sess = sess[sess['prolificId'] != ''].copy()

# Add session order per person
sess = sess.sort_values(['prolificId','startedAt'])
sess['session_n'] = sess.groupby('prolificId').cumcount() + 1

# Attach wide scores if available
if scores_wide is not None:
    sess = sess.merge(scores_wide, on='sessionKey', how='left', suffixes=('','_score'))

# Attach MFQ clusters if available
if mfq_clusters is not None:
    sess = sess.merge(mfq_clusters[['sessionKey','mfq_profile_quartile3','kmeans_raw_cluster_label','kmeans_factor_cluster_label']], on='sessionKey', how='left')

sess_out = sess

# Write
sess_out.to_csv(TIDY_DIR / 'sessions_by_prolificId.tsv', sep='	', index=False)
sess_out.to_csv(TIDY_DIR / 'sessions_by_prolificId.csv', index=False)

print('Rows:', len(sess_out), 'unique prolificId:', sess_out['prolificId'].nunique())
sess_out.head(10)

# ## Build a person-level table (one row per prolificId)
# 
# This produces a compact participant table with:
# - number of sessions observed
# - whether they have at least one fully completed session
# - first/last session timestamps
# 
# You can extend this to create `session1_*` and `session2_*` columns if your two sessions have a well-defined structure.

agg = sess_out.groupby('prolificId').agg(
    n_sessions=('sessionKey','nunique'),
    n_completed_all=('completed_all','sum'),
    first_startedAt=('startedAt','min'),
    last_startedAt=('startedAt','max'),
).reset_index()

agg['has_completed_all'] = agg['n_completed_all'] > 0

agg.to_csv(TIDY_DIR / 'participants_by_prolificId.tsv', sep='	', index=False)
agg.to_csv(TIDY_DIR / 'participants_by_prolificId.csv', index=False)

agg.sort_values(['n_sessions','n_completed_all'], ascending=False).head(20)

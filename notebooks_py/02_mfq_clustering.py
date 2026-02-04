# # 02 — MFQ clustering (Quartile + K-means; raw + factor)
# 
# This notebook creates **3-way moral-profile clusters** from MFQ-30 scores using **two methods**:
# 
# 1. **Quartile rule** (transparent, deterministic)
# 2. **K-means** (data-driven clustering)
# 
# Both methods are computed in two feature spaces:
# 
# - **Raw (5D)**: Care, Fairness, Loyalty, Authority, Purity
# - **Factor / composite (2D)**: Individualizing mean vs Binding mean
# 
# ## Completed-session rule
# 
# All clustering is restricted to **completed sessions only**, where *completed* is defined as:
# 
# - `meta.completedAt` is present
# - `meta.terminatedReason` is empty
# - all required items were answered (as checked in Notebook 01)
# 
# ## Outputs
# 
# Written to `../output/tidy/`:
# 
# - `mfq_features.tsv` / `.csv` — MFQ foundation means + composites
# - `mfq_cluster_assignments.tsv` / `.csv` — per-session cluster labels (quartile + k-means)
# - `mfq_k_diagnostics.tsv` / `.csv` — silhouette / CH / DB for k=2..8 (raw + factor)
# - `mfq_session2_prod_completed.csv` — convenience file for Session 2 import (prod + completed only)

from __future__ import annotations

from pathlib import Path
import pandas as pd
import numpy as np

from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score

PROJECT_ROOT = Path('..').resolve()
TIDY_DIR = PROJECT_ROOT / 'output' / 'tidy'
TIDY_DIR.mkdir(parents=True, exist_ok=True)

participants_path = TIDY_DIR / 'participants.tsv'
scores_long_path = TIDY_DIR / 'scores_long.tsv'

if not participants_path.exists() or not scores_long_path.exists():
    raise FileNotFoundError(
        'Missing tidy inputs. Run notebooks/01_extract_tidy_outputs.ipynb first.'
    )

participants = pd.read_csv(participants_path, sep='	', dtype=str)
scores_long = pd.read_csv(scores_long_path, sep='	', dtype=str)

# Completed sessions only (per Notebook 01 definition)
participants['completed_all'] = participants['completed_all'].astype(str).str.lower().isin(['true','1','yes'])
completed = participants[participants['completed_all']].copy()

print('Completed sessions:', len(completed), 'of', len(participants))


# ## 1) Build MFQ feature table
# 
# We use **MFQ foundation means** computed by the frontend:
# 
# - `instrument == 'mfq30'`
# - `score_type == 'foundation_mean_combined'`
# 
# We then compute composites:
# 
# - `individualizing_mean = mean(Care, Fairness)`
# - `binding_mean = mean(Loyalty, Authority, Purity)`
# - `binding_minus_individualizing = binding_mean - individualizing_mean`

mfq = scores_long[(scores_long['instrument'] == 'mfq30') & (scores_long['score_type'] == 'foundation_mean_combined')].copy()

# Ensure numeric
mfq['value'] = pd.to_numeric(mfq['value'], errors='coerce')

# Only completed sessions
mfq = mfq.merge(
    completed[['sessionKey', 'prolificId', 'participantIndex', 'mode']],
    on='sessionKey',
    how='inner'
)

# Wide: one row per sessionKey
mfq_wide = mfq.pivot_table(index=['sessionKey','prolificId','participantIndex','mode'], columns='name', values='value', aggfunc='first').reset_index()

# Normalize column names
col_map = {
    'Care': 'care',
    'Fairness': 'fairness',
    'Loyalty': 'loyalty',
    'Authority': 'authority',
    'Purity': 'purity'
}
for k,v in col_map.items():
    if k in mfq_wide.columns:
        mfq_wide = mfq_wide.rename(columns={k: v})

# Compute composites
mfq_wide['individualizing_mean'] = mfq_wide[['care','fairness']].mean(axis=1)
mfq_wide['binding_mean'] = mfq_wide[['loyalty','authority','purity']].mean(axis=1)
mfq_wide['binding_minus_individualizing'] = mfq_wide['binding_mean'] - mfq_wide['individualizing_mean']

# Sanity checks
missing = mfq_wide[['care','fairness','loyalty','authority','purity']].isna().sum()
print('Missing foundation means (should be 0 for completed sessions):')
print(missing)

# Save features
mfq_features = mfq_wide.copy()
mfq_features.to_csv(TIDY_DIR / 'mfq_features.tsv', sep='	', index=False)
mfq_features.to_csv(TIDY_DIR / 'mfq_features.csv', index=False)

mfq_features.head()


# ## 2) Quartile-based 3-way profile (deterministic)
# 
# We compute quartiles of `binding_minus_individualizing` **among completed sessions only**.
# 
# Rule:
# 
# - bottom quartile (most negative) → **individualizing**
# - top quartile (most positive) → **binding**
# - middle 50% → **mixed**
# 
# This directly implements the 3 conceptual profiles:
# 
# - **Ingroup-biased (Binding)**
# - **Outgroup-biased (Individualizing)**
# - **Mixed**

def quartile3_labels(x: pd.Series) -> tuple[pd.Series, dict]:
    x = x.astype(float)
    q25 = x.quantile(0.25)
    q75 = x.quantile(0.75)

    def label(v):
        if pd.isna(v):
            return np.nan
        if v <= q25:
            return 'individualizing'
        if v >= q75:
            return 'binding'
        return 'mixed'

    labels = x.apply(label)
    info = {'q25': float(q25), 'q75': float(q75)}
    return labels, info

mfq_features['mfq_profile_quartile3'] , qinfo_all = quartile3_labels(mfq_features['binding_minus_individualizing'])
print('Quartile cutpoints (all completed):', qinfo_all)
print(mfq_features['mfq_profile_quartile3'].value_counts(dropna=False))

# Often Session 2 imports are for production only. We also compute prod-only cutpoints.
prod = mfq_features[mfq_features['mode'] == 'prod'].copy()
if len(prod) >= 10:
    prod['mfq_profile_quartile3_prod'], qinfo_prod = quartile3_labels(prod['binding_minus_individualizing'])
    print('Quartile cutpoints (prod completed):', qinfo_prod)
    print(prod['mfq_profile_quartile3_prod'].value_counts(dropna=False))
else:
    qinfo_prod = None
    print('Not enough prod completed sessions to compute stable prod-only quartiles.')


# ## 3) K-means clustering (k=3) + diagnostic k search
# 
# We run K-means in two feature spaces:
# 
# - **Raw 5D**: Care/Fairness/Loyalty/Authority/Purity
# - **Factor 2D**: Binding mean vs Individualizing mean
# 
# ### “Optimal k” diagnostics
# 
# Even though we **fix k=3** for the study design, we also compute objective diagnostics for k=2..8:
# 
# - Silhouette (higher is better)
# - Calinski–Harabasz (higher is better)
# - Davies–Bouldin (lower is better)
# 
# These diagnostics are written to `mfq_k_diagnostics.*`.
# 
# ### Naming clusters (binding / individualizing / mixed)
# 
# K-means produces numeric cluster IDs; we label them by comparing each cluster’s average:
# 
# - `binding_mean`
# - `individualizing_mean`
# - `binding_minus_individualizing`
# 
# Heuristic used:
# 
# - cluster with **highest** `binding_minus_individualizing` → `binding`
# - cluster with **lowest** `binding_minus_individualizing` → `individualizing`
# - remaining cluster → `mixed`

from sklearn.preprocessing import StandardScaler

def k_diagnostics(X: np.ndarray, k_values=range(2,9), random_state=42, n_init=20):
    rows = []
    for k in k_values:
        km = KMeans(n_clusters=k, random_state=random_state, n_init=n_init)
        labels = km.fit_predict(X)
        # For k=1 silhouette is undefined, so we start from 2.
        sil = silhouette_score(X, labels)
        ch = calinski_harabasz_score(X, labels)
        db = davies_bouldin_score(X, labels)
        rows.append({'k': k, 'silhouette': sil, 'calinski_harabasz': ch, 'davies_bouldin': db})
    return pd.DataFrame(rows)


def kmeans_with_named_clusters(df: pd.DataFrame, feature_cols: list[str], label_prefix: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    work = df[['sessionKey','prolificId','participantIndex','mode'] + feature_cols].dropna().copy()

    X = work[feature_cols].to_numpy(dtype=float)
    Xs = StandardScaler().fit_transform(X)

    diag = k_diagnostics(Xs)

    # Study uses k=3
    km = KMeans(n_clusters=3, random_state=42, n_init=50)
    work[f'{label_prefix}_cluster_id'] = km.fit_predict(Xs)

    # Cluster summaries for naming
    tmp = work.copy()
    # Compute composites even if feature space is raw
    tmp['individualizing_mean'] = tmp[['care','fairness']].mean(axis=1) if {'care','fairness'}.issubset(tmp.columns) else tmp.get('individualizing_mean')
    tmp['binding_mean'] = tmp[['loyalty','authority','purity']].mean(axis=1) if {'loyalty','authority','purity'}.issubset(tmp.columns) else tmp.get('binding_mean')
    tmp['binding_minus_individualizing'] = tmp['binding_mean'] - tmp['individualizing_mean']

    cluster_means = tmp.groupby(f'{label_prefix}_cluster_id')[['binding_mean','individualizing_mean','binding_minus_individualizing']].mean().reset_index()

    # Map cluster IDs -> conceptual labels
    cid_binding = int(cluster_means.sort_values('binding_minus_individualizing', ascending=False).iloc[0][f'{label_prefix}_cluster_id'])
    cid_indiv = int(cluster_means.sort_values('binding_minus_individualizing', ascending=True).iloc[0][f'{label_prefix}_cluster_id'])
    cids = set(cluster_means[f'{label_prefix}_cluster_id'].tolist())
    cid_mixed = int(list(cids - {cid_binding, cid_indiv})[0])

    label_map = {cid_binding: 'binding', cid_indiv: 'individualizing', cid_mixed: 'mixed'}
    work[f'{label_prefix}_cluster_label'] = work[f'{label_prefix}_cluster_id'].map(label_map)

    return work[['sessionKey','prolificId','participantIndex','mode', f'{label_prefix}_cluster_id', f'{label_prefix}_cluster_label']], diag


# RAW 5D k-means
raw_cols = ['care','fairness','loyalty','authority','purity']
k_raw, diag_raw = kmeans_with_named_clusters(mfq_features, raw_cols, 'kmeans_raw')

# FACTOR 2D k-means
factor_cols = ['binding_mean','individualizing_mean']
k_fac, diag_fac = kmeans_with_named_clusters(mfq_features, factor_cols, 'kmeans_factor')

# Combine diagnostics
kdiag = pd.concat([diag_raw.assign(space='raw_5d'), diag_fac.assign(space='factor_2d')], ignore_index=True)
kdiag.to_csv(TIDY_DIR / 'mfq_k_diagnostics.tsv', sep='	', index=False)
kdiag.to_csv(TIDY_DIR / 'mfq_k_diagnostics.csv', index=False)

def suggest_k(diag: pd.DataFrame) -> dict:
    diag = diag.copy()
    for c in ['silhouette','calinski_harabasz','davies_bouldin']:
        diag[c] = pd.to_numeric(diag[c], errors='coerce')
    return {
        'best_silhouette_k': int(diag.loc[diag['silhouette'].idxmax(), 'k']),
        'best_calinski_harabasz_k': int(diag.loc[diag['calinski_harabasz'].idxmax(), 'k']),
        'best_davies_bouldin_k': int(diag.loc[diag['davies_bouldin'].idxmin(), 'k']),
    }

print('Suggested k (raw 5D):', suggest_k(diag_raw))
print('Suggested k (factor 2D):', suggest_k(diag_fac))


print('k-means raw labels:')
print(k_raw['kmeans_raw_cluster_label'].value_counts())
print('\nk-means factor labels:')
print(k_fac['kmeans_factor_cluster_label'].value_counts())


# ## 4) Combine all MFQ cluster outputs into one tidy table
# 
# We combine:
# 
# - MFQ features
# - quartile3 labels
# - k-means raw labels
# - k-means factor labels
# 
# Then we write:
# 
# - `mfq_cluster_assignments.*`
# - `mfq_session2_prod_completed.csv` (prod + completed sessions only)

assign = mfq_features[['sessionKey','prolificId','participantIndex','mode',
                       'care','fairness','loyalty','authority','purity',
                       'individualizing_mean','binding_mean','binding_minus_individualizing',
                       'mfq_profile_quartile3']].copy()

assign = assign.merge(k_raw[['sessionKey','kmeans_raw_cluster_id','kmeans_raw_cluster_label']], on='sessionKey', how='left')
assign = assign.merge(k_fac[['sessionKey','kmeans_factor_cluster_id','kmeans_factor_cluster_label']], on='sessionKey', how='left')

# Write combined tidy
assign.to_csv(TIDY_DIR / 'mfq_cluster_assignments.tsv', sep='	', index=False)
assign.to_csv(TIDY_DIR / 'mfq_cluster_assignments.csv', index=False)

# Session 2 convenience file: prod + completed only
sess2 = assign[assign['mode'] == 'prod'].copy()

# The downstream system often expects a stable 'subjectId'. We provide BOTH.
# - subjectId: participantIndex (server-assigned sequential)
# - prolificId: Prolific participant identifier
sess2 = sess2.rename(columns={'participantIndex': 'subjectId'})

sess2_out = sess2[[
    'subjectId','prolificId','sessionKey',
    'care','fairness','loyalty','authority','purity',
    'individualizing_mean','binding_mean','binding_minus_individualizing',
    'mfq_profile_quartile3',
    'kmeans_raw_cluster_label','kmeans_factor_cluster_label'
]].copy()

sess2_out.to_csv(TIDY_DIR / 'mfq_session2_prod_completed.csv', index=False)

print('Wrote:', (TIDY_DIR / 'mfq_session2_prod_completed.csv'))
print('Rows:', len(sess2_out))

assign.head()



# --- Latent Profile Analysis (LPA) via Gaussian Mixture Model ---
# See the matching notebook cell for details.

# NOTE: This section expects `mfq_foundations` (completed sessions only) and `OUTPUT_DIR` to exist.

try:
    from sklearn.mixture import GaussianMixture
    from sklearn.preprocessing import StandardScaler

    col_l = {c.lower(): c for c in mfq_foundations.columns}
    raw_cols = [col_l.get(k) for k in ['care','fairness','loyalty','authority','purity'] if col_l.get(k) is not None]
    if len(raw_cols) < 5:
        raise ValueError(f"Could not find all 5 MFQ foundations. Found: {raw_cols}")

    X = mfq_foundations[raw_cols].astype(float).values
    Xz = StandardScaler().fit_transform(X)

    cand_k = list(range(2, 7))
    lpa_fits = []
    for k in cand_k:
        gmm = GaussianMixture(n_components=k, covariance_type='full', random_state=42, n_init=25)
        gmm.fit(Xz)
        lpa_fits.append({'k': k, 'aic': gmm.aic(Xz), 'bic': gmm.bic(Xz)})

    lpa_fits_df = pd.DataFrame(lpa_fits).sort_values('k')
    print(lpa_fits_df)

    gmm3 = GaussianMixture(n_components=3, covariance_type='full', random_state=42, n_init=50)
    gmm3.fit(Xz)
    mfq_lpa = mfq_foundations.copy()
    mfq_lpa['lpa_k3'] = gmm3.predict(Xz) + 1

    out_lpa = OUTPUT_DIR / 'mfq_lpa_k3_completed.tsv'
    mfq_lpa.to_csv(out_lpa, sep='\t', index=False)
    mfq_lpa.to_csv(str(out_lpa).replace('.tsv', '.csv'), index=False)
    print('Saved:', out_lpa)
except Exception as _e:
    print('LPA skipped:', _e)

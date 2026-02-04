#!/usr/bin/env python3
"""
Auto-generate tidy (analysis-ready) exports from append-only group long files.

Design goals
- Do NOT modify or rely on "raw" ground-truth files except as inputs.
- Rebuild outputs deterministically on each run (safe under concurrency).
- Completed sessions only for tidy exports.
- Produce both TSV and CSV.
- Produce both long and wide:
  - Long: one row per participant x item (responses) / participant x scale (scores)
  - Wide (compact): columns by itemId
  - Wide (fulltext): columns include item number + full question text (separate file set)
"""

from __future__ import annotations

import os
import re
import csv
import json
import time
import hashlib
from pathlib import Path

import pandas as pd


def _read_tsv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, sep="\t", dtype=str, keep_default_na=False, na_values=[])

def _write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)

def _df_to_tsv_bytes(df: pd.DataFrame) -> bytes:
    return df.to_csv(sep="\t", index=False, lineterminator="\n").encode("utf-8")

def _df_to_csv_bytes(df: pd.DataFrame) -> bytes:
    return df.to_csv(index=False, lineterminator="\n").encode("utf-8")

def _sanitize_col(s: str, max_len: int = 140) -> str:
    s = re.sub(r"\s+", " ", str(s)).strip()
    s = s.replace("\t", " ").replace("\n", " ").replace("\r", " ")
    s = re.sub(r"[^\w\s\-\.,:;!?()'\"/]", "", s)
    s = s.strip()
    if len(s) > max_len:
        h = hashlib.sha1(s.encode("utf-8")).hexdigest()[:8]
        s = s[: max_len - 9].rstrip() + "_" + h
    return s

def main() -> int:
    out_dir = Path(os.environ.get("RIKEN_OUTPUT_DIR", "output"))
    group_dir = out_dir / "group"
    tidy_dir = out_dir / "tidy"
    tidy_live_dir = tidy_dir / "live"

    # Inputs from server append-only outputs
    responses_long_path = group_dir / "responses_long.tsv"
    scores_long_path = group_dir / "scores_long.tsv"

    rlong = _read_tsv(responses_long_path)
    slong = _read_tsv(scores_long_path)

    # If nothing yet, still ensure folders exist.
    tidy_dir.mkdir(parents=True, exist_ok=True)
    tidy_live_dir.mkdir(parents=True, exist_ok=True)

    if rlong.empty and slong.empty:
        return 0

    # Completed sessions only
    # Server outputs may use completedAll or completed_all or completedAllBool etc. Handle robustly.
    def _is_completed(df: pd.DataFrame) -> pd.Series:
        for col in ["completed_all", "completedAll", "completed_all_bool", "completedAllBool", "completedAllFlag"]:
            if col in df.columns:
                v = df[col].astype(str).str.lower()
                return v.isin(["1", "true", "t", "yes", "y"])
        # fallback: completedAt present and terminatedReason empty
        if "completedAt" in df.columns:
            ok = df["completedAt"].astype(str).str.len() > 0
            if "terminatedReason" in df.columns:
                ok = ok & (df["terminatedReason"].astype(str).str.len() == 0)
            return ok
        return pd.Series([True] * len(df), index=df.index)

    if not rlong.empty:
        rlong_completed = rlong[_is_completed(rlong)].copy()
    else:
        rlong_completed = rlong

    if not slong.empty:
        slong_completed = slong[_is_completed(slong)].copy()
    else:
        slong_completed = slong

    # Normalize ID columns (make sure prolificId is first in outputs)
    def _ensure_id_cols(df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df
        # known aliases
        if "prolific_id" in df.columns and "prolificId" not in df.columns:
            df["prolificId"] = df["prolific_id"]
        if "PROLIFIC_PID" in df.columns and "prolificId" not in df.columns:
            df["prolificId"] = df["PROLIFIC_PID"]
        if "sessionKey" not in df.columns:
            # try reconstruct from sessionId+mode
            if "sessionId" in df.columns and "mode" in df.columns:
                df["sessionKey"] = df["sessionId"].astype(str) + "__" + df["mode"].astype(str)
        # reorder
        front = [c for c in ["prolificId", "participantIndex", "sessionKey"] if c in df.columns]
        rest = [c for c in df.columns if c not in front]
        return df[front + rest]

    rlong_completed = _ensure_id_cols(rlong_completed)
    slong_completed = _ensure_id_cols(slong_completed)

    # Write completed-only long tidy
    if not rlong_completed.empty:
        _write_atomic(tidy_dir / "responses_long.tsv", _df_to_tsv_bytes(rlong_completed))
        _write_atomic(tidy_dir / "responses_long.csv", _df_to_csv_bytes(rlong_completed))

    if not slong_completed.empty:
        _write_atomic(tidy_dir / "scores_long.tsv", _df_to_tsv_bytes(slong_completed))
        _write_atomic(tidy_dir / "scores_long.csv", _df_to_csv_bytes(slong_completed))

    # Wide exports (responses)
    # Expect columns:
    # - itemId (or variable), itemNumber (optional), itemText/questionText (optional), responseValue (or value/scoredValue)
    # We will create:
    # 1) responses_wide_raw_compact: columns by itemId, values from responseValue
    # 2) responses_wide_raw_fulltext: columns include itemNumber + full text (separate file set)

    def _wide_from_long(df: pd.DataFrame, value_col_candidates: list[str], col_key: str) -> pd.DataFrame:
        if df.empty:
            return df
        value_col = None
        for c in value_col_candidates:
            if c in df.columns:
                value_col = c
                break
        if value_col is None:
            return pd.DataFrame()

        idx_cols = [c for c in ["prolificId", "participantIndex", "sessionKey"] if c in df.columns]
        # Keep one row per participant; if duplicates exist, keep the latest by serverReceivedAt if present.
        if "serverReceivedAt" in df.columns:
            df = df.sort_values("serverReceivedAt")
        w = df.pivot_table(index=idx_cols, columns=col_key, values=value_col, aggfunc="last")
        w = w.reset_index()
        # Flatten columns
        w.columns = [str(c) for c in w.columns]
        return w

    # Determine response item id and text columns
    if not rlong_completed.empty:
        # Find item id column
        item_id_col = None
        for c in ["itemId", "questionId", "variable", "item_id", "qid"]:
            if c in rlong_completed.columns:
                item_id_col = c
                break

        # Find item number and text columns
        item_num_col = None
        for c in ["itemNumber", "itemNo", "item_num", "qnum"]:
            if c in rlong_completed.columns:
                item_num_col = c
                break

        item_text_col = None
        for c in ["itemText", "questionText", "question", "prompt", "text"]:
            if c in rlong_completed.columns:
                item_text_col = c
                break

        if item_id_col:
            # compact wide (raw)
            wide_compact = _wide_from_long(
                rlong_completed,
                value_col_candidates=["responseValue", "response", "value", "rawValue"],
                col_key=item_id_col,
            )
            if not wide_compact.empty:
                _write_atomic(tidy_dir / "responses_wide_compact.tsv", _df_to_tsv_bytes(wide_compact))
                _write_atomic(tidy_dir / "responses_wide_compact.csv", _df_to_csv_bytes(wide_compact))

            # fulltext wide (raw) — separate file set
            if item_text_col:
                df_ft = rlong_completed.copy()
                def make_col(row):
                    num = row.get(item_num_col, "") if item_num_col else ""
                    txt = row.get(item_text_col, "")
                    iid = row.get(item_id_col, "")
                    parts = []
                    if str(num).strip():
                        parts.append(str(num).strip())
                    if str(iid).strip():
                        parts.append(str(iid).strip())
                    parts.append(_sanitize_col(txt))
                    return "__".join([p for p in parts if p])
                df_ft["_wideColFullText"] = df_ft.apply(make_col, axis=1)
                wide_fulltext = _wide_from_long(
                    df_ft,
                    value_col_candidates=["responseValue", "response", "value", "rawValue"],
                    col_key="_wideColFullText",
                )
                if not wide_fulltext.empty:
                    _write_atomic(tidy_dir / "responses_wide_fulltext.tsv", _df_to_tsv_bytes(wide_fulltext))
                    _write_atomic(tidy_dir / "responses_wide_fulltext.csv", _df_to_csv_bytes(wide_fulltext))

    # Wide exports (scores) — scales/facets in columns
    if not slong_completed.empty:
        scale_col = None
        for c in ["scoreName", "scale", "facet", "variable", "score_id"]:
            if c in slong_completed.columns:
                scale_col = c
                break

        if scale_col:
            wide_scores = _wide_from_long(
                slong_completed,
                value_col_candidates=["scoreValue", "value", "score", "scoredValue"],
                col_key=scale_col,
            )
            if not wide_scores.empty:
                _write_atomic(tidy_dir / "scores_wide.tsv", _df_to_tsv_bytes(wide_scores))
                _write_atomic(tidy_dir / "scores_wide.csv", _df_to_csv_bytes(wide_scores))

    # Also refresh "live" mirror (for convenience; identical to tidy currently)
    # (kept separate so older tooling that expects output/tidy/live/* still works)
    for name in [
        "responses_long.tsv","responses_long.csv",
        "scores_long.tsv","scores_long.csv",
        "responses_wide_compact.tsv","responses_wide_compact.csv",
        "responses_wide_fulltext.tsv","responses_wide_fulltext.csv",
        "scores_wide.tsv","scores_wide.csv",
    ]:
        src = tidy_dir / name
        if src.exists():
            _write_atomic(tidy_live_dir / name, src.read_bytes())

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

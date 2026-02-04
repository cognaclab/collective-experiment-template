#!/usr/bin/env python3
"""
RIKEN Survey — Minimal Python server (no dependencies)
=====================================================

Why this exists
---------------
Browsers cannot write files directly to a server's disk without a backend endpoint.
This server provides that endpoint:

  POST /api/save

The frontend (app.js) calls this endpoint automatically (background autosave),
so participants never see download buttons in production.

Security note (IMPORTANT)
-------------------------
To prevent participants from downloading study outputs, this server **blocks**
HTTP access to the output directories (output/, output_backup/).

What gets written (autosave + final)
-------------------------------------

Per-session "raw snapshot" (OVERWRITTEN on every autosave; includes incomplete sessions):
  output/raw_sessions/<SESSIONKEY>.json
  output_backup/raw_sessions/<SESSIONKEY>.json

Per-session "wide snapshot" (ONE ROW; written when a session becomes FINAL):
  output/raw_sessions/<SESSIONKEY>_wide.tsv
  output/raw_sessions/<SESSIONKEY>_wide.csv
  (and the same paths under output_backup/)

Group-level "latest" tables (UPDATED on every autosave — includes INCOMPLETE sessions):
  output/group/sessions_manifest.tsv
  output/group/participants_latest.tsv
  output/group/scores_wide_latest.tsv
  output/group/mfq_scores_latest.tsv
  output/group/math_checks_metrics_latest.tsv
  (and the same paths under output_backup/)

Final append-only files (written once per session when completed/terminated):
  output/participants.tsv (+ participants.csv)
  output/responses_long.tsv (+ responses_long.csv)
  output/responses_compact.tsv (+ responses_compact.csv)
  output/scores_long.tsv (+ scores_long.csv)
  output/scores_wide.tsv (+ scores_wide.csv)
  output/mfq_scores.tsv (+ mfq_scores.csv)
  output/math_checks_metrics.tsv (+ math_checks_metrics.csv)
  output/all_data_wide.tsv (+ all_data_wide.csv)
  output/item_dictionary.tsv
  (and backup copies in output_backup/)

Optional (dev/debug only; OFF by default):
  output/sessions/<SESSIONKEY>/latest.json
  output/sessions/<SESSIONKEY>/latest_responses.tsv
  output/sessions/<SESSIONKEY>/latest_scores.tsv
  (enable with: export RIKEN_WRITE_SESSION_DIR=1)

Run (dev / simple deployment)
-----------------------------
  cd riken_survey_v13
  python3 server/server.py
  open http://localhost:8000/

Environment variables
---------------------
  RIKEN_HOST=0.0.0.0
  RIKEN_PORT=8000
  RIKEN_OUTPUT_DIR=output
  RIKEN_BACKUP_DIR=output_backup

Notes for larger deployments
----------------------------
- This uses ThreadingHTTPServer (multi-threaded). Writes are guarded with a file lock.
- For TLS/HTTPS, put nginx/apache in front and proxy /api/save to this server.
"""

from __future__ import annotations

import json
import csv
import os
import secrets
import re
import time
import io
import zipfile
from urllib.parse import parse_qs, urlparse
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from typing import Any, Dict, Iterable, List, Tuple, Optional

try:
    import fcntl  # Unix-only (Linux server assumed)
except Exception:  # pragma: no cover
    fcntl = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def dir_writable(path: str) -> Tuple[bool, str | None]:
    """Return (is_writable, error_message). Creates dir if missing."""
    try:
        ensure_dir(path)
        test_path = os.path.join(path, ".__write_test__")
        with open(test_path, "w", encoding="utf-8") as f:
            f.write("ok")
            f.flush()
            try:
                os.fsync(f.fileno())
            except Exception:
                pass
        os.remove(test_path)
        return True, None
    except Exception as e:
        return False, str(e)


def tail_last_jsonl(path: str) -> Dict[str, Any] | None:
    """Read the last JSON object from a jsonl file (best-effort)."""
    if not os.path.exists(path):
        return None
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            if size == 0:
                return None

            # Read backwards to find the last newline
            chunk = 4096
            offset = min(size, chunk)
            f.seek(-offset, os.SEEK_END)
            data = f.read(offset)
            # If file is large and last newline isn't in this chunk, expand once
            if b"\n" not in data and size > chunk:
                offset = min(size, chunk * 8)
                f.seek(-offset, os.SEEK_END)
                data = f.read(offset)

            lines = [ln for ln in data.splitlines() if ln.strip()]
            if not lines:
                return None
            last = lines[-1]
            try:
                return json.loads(last.decode("utf-8"))
            except Exception:
                try:
                    return json.loads(last.decode("latin-1"))
                except Exception:
                    return None
    except Exception:
        return None


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def safe_id(raw: str) -> str:
    # Avoid path traversal / weird chars (keep alnum, dash, underscore)
    return "".join(ch for ch in (raw or "") if ch.isalnum() or ch in ("-", "_")) or "unknown"


def tsv_escape(v: Any) -> str:
    if v is None:
        return ""
    s = str(v)
    return s.replace("\t", " ").replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n")


def atomic_write(path: str, data: bytes) -> None:
    tmp = f"{path}.tmp"
    with open(tmp, "wb") as f:
        f.write(data)
        f.flush()
        try:
            os.fsync(f.fileno())
        except Exception:
            pass
    os.replace(tmp, path)


def locked_append(path: str, text: str) -> None:
    """
    Append text to a file with an OS-level lock (best-effort).
    """
    ensure_dir(os.path.dirname(path))
    with open(path, "a", encoding="utf-8") as f:
        if fcntl is not None:
            try:
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            except Exception:
                pass
        f.write(text)
        f.flush()
        try:
            os.fsync(f.fileno())
        except Exception:
            pass
        if fcntl is not None:
            try:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
            except Exception:
                pass


class FileLock:
    """A simple cross-thread/process lock using fcntl.flock (Linux server assumed)."""

    def __init__(self, lock_path: str):
        self.lock_path = lock_path
        self._fh = None

    def __enter__(self):
        ensure_dir(os.path.dirname(self.lock_path))
        self._fh = open(self.lock_path, "a+", encoding="utf-8")
        if fcntl is not None:
            try:
                fcntl.flock(self._fh.fileno(), fcntl.LOCK_EX)
            except Exception:
                pass
        return self

    def __exit__(self, exc_type, exc, tb):
        if self._fh and fcntl is not None:
            try:
                fcntl.flock(self._fh.fileno(), fcntl.LOCK_UN)
            except Exception:
                pass
        if self._fh:
            try:
                self._fh.close()
            except Exception:
                pass
        self._fh = None


def safe_json_loads(raw: bytes) -> Dict[str, Any]:
    if not raw:
        return {}
    for enc in ("utf-8", "latin-1"):
        try:
            return json.loads(raw.decode(enc))
        except Exception:
            continue
    return {}


def is_final_output(output: Dict[str, Any]) -> bool:
    meta = output.get("meta") or {}
    return bool(meta.get("completedAt")) or bool(meta.get("terminatedReason"))


def session_status(meta: Dict[str, Any]) -> str:
    """Return a human-friendly status for the latest snapshot."""
    if not isinstance(meta, dict):
        return "unknown"
    if meta.get("terminatedReason"):
        return "terminated"
    if meta.get("completedAt"):
        return "completed"
    return "in_progress"




# ============================================================
# Admin / runtime-config helpers
# ============================================================

RUNTIME_CONFIG_PATH = os.environ.get(
    "RIKEN_RUNTIME_CONFIG",
    os.path.join("server", "runtime_config.json"),
)


# Admin token for privileged endpoints (exports + config writes)
#
# Default behaviour:
#   - If the environment variable RIKEN_ADMIN_TOKEN is NOT set, the server
#     generates a random token at startup. This token is printed in the server
#     console and is required to:
#       * POST /api/config
#       * POST /api/config/reset
#       * GET  /api/export/*
#
#   - If RIKEN_ADMIN_TOKEN is set (even to an empty string), that value is used.
#
# Recommended:
#   export RIKEN_ADMIN_TOKEN="your_shared_secret"
#
# Disable token checks (NOT recommended):
#   export RIKEN_ADMIN_TOKEN=""
#
_ADMIN_TOKEN_ENV = os.environ.get("RIKEN_ADMIN_TOKEN")
_ADMIN_TOKEN_AUTO = _ADMIN_TOKEN_ENV is None
ADMIN_TOKEN = secrets.token_urlsafe(24) if _ADMIN_TOKEN_AUTO else (_ADMIN_TOKEN_ENV or "").strip()


def get_admin_token() -> str:
    return ADMIN_TOKEN


def is_admin_authorized(handler_headers, query: dict[str, list[str]]) -> bool:
    """Lightweight token check for admin-only endpoints."""

    required = get_admin_token()
    if not required:
        return True

    # Header-based auth (preferred, avoids leaking the token in URLs)
    hdr = handler_headers.get("X-Admin-Token") if handler_headers else None
    if hdr and hdr.strip() == required:
        return True

    # Query param fallback (useful for manual testing)
    tok = (query.get("token", [""])[0] if query else "").strip()
    return tok == required


def read_runtime_config() -> Dict[str, Any]:
    """Load server/runtime_config.json if present."""
    try:
        if not os.path.exists(RUNTIME_CONFIG_PATH):
            return {}
        with open(RUNTIME_CONFIG_PATH, "rb") as f:
            raw = f.read()
        cfg = safe_json_loads(raw)
        return cfg if isinstance(cfg, dict) else {}
    except Exception:
        return {}


def write_runtime_config(cfg: Dict[str, Any]) -> Tuple[bool, str | None]:
    """Write runtime config atomically."""
    try:
        ensure_dir(os.path.dirname(RUNTIME_CONFIG_PATH))
        b = json.dumps(cfg, ensure_ascii=False, indent=2).encode("utf-8")
        atomic_write(RUNTIME_CONFIG_PATH, b)
        return True, None
    except Exception as e:
        return False, str(e)


def reset_runtime_config() -> Tuple[bool, str | None]:
    try:
        if os.path.exists(RUNTIME_CONFIG_PATH):
            os.remove(RUNTIME_CONFIG_PATH)
        return True, None
    except Exception as e:
        return False, str(e)

def try_create_flag(path: str) -> bool:
    """
    Create an empty file atomically. Returns True only if newly created.
    """
    ensure_dir(os.path.dirname(path))
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.close(fd)
        return True
    except FileExistsError:
        return False
    except Exception:
        # If we cannot create it, be conservative and do not append again.
        return False


def build_participants_row(
    output: Dict[str, Any],
    server_received_at: str,
    session_key: str | None = None,
) -> Tuple[List[str], Dict[str, Any]]:
    meta = output.get("meta") or {}
    responses = output.get("responses") or {}

    demo_list = responses.get("demographics") or []
    demo_map: Dict[str, Any] = {}
    demo_extra: Dict[str, Any] = {}
    if isinstance(demo_list, list):
        for q in demo_list:
            qid = str(q.get("id") or "")
            demo_map[qid] = q.get("response")
            demo_extra[qid] = q.get("extraText")

    math_list = responses.get("math_checks") or []
    # QC summary: correct on FIRST attempt & first-attempt RT
    n_math = 0
    n_math_first_correct = 0
    first_rts: List[float] = []
    if isinstance(math_list, list):
        n_math = len(math_list)
        for m in math_list:
            attempts = (m.get("attempts") or []) if isinstance(m, dict) else []
            if not attempts:
                continue
            first = attempts[0]
            if isinstance(first, dict) and first.get("correct") is True:
                n_math_first_correct += 1
            rt = first.get("rtMs") if isinstance(first, dict) else None
            if isinstance(rt, (int, float)):
                first_rts.append(float(rt))
    math_first_rt_mean = (sum(first_rts) / len(first_rts)) if first_rts else None

    # SVO summary (from output.scores.svo if present)
    scores = output.get("scores") or {}
    svo = (scores.get("svo") or {}) if isinstance(scores, dict) else {}
    svo_primary = (svo.get("primary") or {}) if isinstance(svo, dict) else {}
    svo_qc = (svo.get("qc") or {}) if isinstance(svo, dict) else {}

    ipip_presentation = (meta.get("presentation") or {}).get("ipip120") if isinstance(meta.get("presentation"), dict) else None

    session_key_val = session_key or f"{safe_id(str(meta.get('sessionId') or 'unknown'))}__{safe_id(str(meta.get('mode') or 'unknown'))}"
    base: Dict[str, Any] = {
        "serverReceivedAt": server_received_at,
        "sessionKey": session_key_val,
        "participantIndex": meta.get("participantIndex"),
        "sessionId": meta.get("sessionId"),
        "mode": meta.get("mode"),
        "status": session_status(meta),
        "startedAt": meta.get("startedAt"),
        "completedAt": meta.get("completedAt"),
        "terminatedReason": meta.get("terminatedReason"),
        "lastAutosaveAt": meta.get("lastAutosaveAt"),
        "autosaveSeq": meta.get("autosaveSeq"),
        "language": meta.get("language"),
        "platform": meta.get("platform"),
        "timezoneOffsetMinutes": meta.get("timezoneOffsetMinutes"),
        "screen_w": (meta.get("screen") or {}).get("w") if isinstance(meta.get("screen"), dict) else None,
        "screen_h": (meta.get("screen") or {}).get("h") if isinstance(meta.get("screen"), dict) else None,
        "flow_order": ",".join((meta.get("flow") or {}).get("order") or []) if isinstance(meta.get("flow"), dict) else None,
        "flow_source": (meta.get("flow") or {}).get("source") if isinstance(meta.get("flow"), dict) else None,
        "ipip_seed": ipip_presentation.get("seed") if isinstance(ipip_presentation, dict) else None,
        "ipip_seedSalt": ipip_presentation.get("seedSalt") if isinstance(ipip_presentation, dict) else None,
        "ipip_randomized": ipip_presentation.get("randomized") if isinstance(ipip_presentation, dict) else None,
        "math_n_checks": n_math,
        "math_first_try_correct": n_math_first_correct,
        "math_first_try_rt_mean_ms": math_first_rt_mean,
        "svo_primary_angle_deg": svo_primary.get("angleDeg"),
        "svo_primary_category": svo_primary.get("category"),
        "svo_qc_written_mismatch": svo_qc.get("nWrittenMismatch"),
    }

    # Demographics as columns (response + optional extra free-text)
    demo_ids = [f"demo_q{n:02d}" for n in range(1, 19)]
    for qid in demo_ids:
        base[f"{qid}_response"] = demo_map.get(qid)
        base[f"{qid}_extra"] = demo_extra.get(qid)

    headers = list(base.keys())
    return headers, base


def safe_col(name: str) -> str:
    # Make a stable, TSV-friendly column name
    s = re.sub(r"[^A-Za-z0-9]+", "_", str(name)).strip("_")
    return s or "NA"


def flatten_scores_wide(
    output: Dict[str, Any],
    server_received_at: str,
    session_key: str | None = None,
) -> Tuple[List[str], Dict[str, Any]]:
    meta = output.get("meta") or {}
    scores = output.get("scores") or {}

    session_key_val = session_key or f"{safe_id(str(meta.get('sessionId') or 'unknown'))}__{safe_id(str(meta.get('mode') or 'unknown'))}"

    row: Dict[str, Any] = {
        "serverReceivedAt": server_received_at,
        "sessionKey": session_key_val,
        "participantIndex": meta.get("participantIndex"),
        "sessionId": meta.get("sessionId"),
        "mode": meta.get("mode"),
        "status": session_status(meta),
        "startedAt": meta.get("startedAt"),
        "completedAt": meta.get("completedAt"),
        "terminatedReason": meta.get("terminatedReason"),
        "lastAutosaveAt": meta.get("lastAutosaveAt"),
        "autosaveSeq": meta.get("autosaveSeq"),
    }

    # HEXACO
    hx = scores.get("hexaco100") if isinstance(scores, dict) else None
    if isinstance(hx, dict):
        for fac_name, fac in (hx.get("factors") or {}).items():
            if not isinstance(fac, dict):
                continue
            k = safe_col(fac_name)
            row[f"hexaco_factor_mean_{k}"] = fac.get("mean")
            row[f"hexaco_factor_sum_{k}"] = fac.get("sum")
        for facet_name, facet in (hx.get("facets") or {}).items():
            if not isinstance(facet, dict):
                continue
            k = safe_col(facet_name)
            row[f"hexaco_facet_mean_{k}"] = facet.get("mean")
            row[f"hexaco_facet_sum_{k}"] = facet.get("sum")

    # IPIP-NEO-120
    ip = scores.get("ipip120") if isinstance(scores, dict) else None
    if isinstance(ip, dict):
        for dom_name, dom in (ip.get("domains") or {}).items():
            if not isinstance(dom, dict):
                continue
            k = safe_col(dom_name)
            row[f"ipip_domain_mean_{k}"] = dom.get("mean")
            row[f"ipip_domain_sum_{k}"] = dom.get("sum")
        for facet_name, facet in (ip.get("facets") or {}).items():
            if not isinstance(facet, dict):
                continue
            k = safe_col(facet_name)
            row[f"ipip_facet_mean_{k}"] = facet.get("mean")
            row[f"ipip_facet_sum_{k}"] = facet.get("sum")

    # MFQ30
    mfq = scores.get("mfq30") if isinstance(scores, dict) else None
    if isinstance(mfq, dict):
        for f_name, f in (mfq.get("foundations") or {}).items():
            if not isinstance(f, dict):
                continue
            k = safe_col(f_name)
            combined = f.get("combined") or {}
            if isinstance(combined, dict):
                row[f"mfq_foundation_mean_{k}"] = combined.get("mean")
                row[f"mfq_foundation_sum_{k}"] = combined.get("sum")

    # D70
    d70 = scores.get("d70") if isinstance(scores, dict) else None
    if isinstance(d70, dict):
        row["d70_mean"] = d70.get("mean")
        row["d70_sum"] = d70.get("sum")

    # SVO
    svo = scores.get("svo") if isinstance(scores, dict) else None
    if isinstance(svo, dict):
        primary = svo.get("primary") or {}
        qc = svo.get("qc") or {}
        if isinstance(primary, dict):
            row["svo_primary_mean_you"] = primary.get("meanYou")
            row["svo_primary_mean_other"] = primary.get("meanOther")
            row["svo_angle_deg"] = primary.get("angleDeg")
            row["svo_category"] = primary.get("category")
        if isinstance(qc, dict):
            row["svo_written_mismatch"] = qc.get("nWrittenMismatch")

    headers = list(row.keys())
    return headers, row


# -------- Additional wide/derived exports (v16) --------

def mfq_level_from_mean(mean_val: Any, low_to_medium: float = 2.5, medium_to_high: float = 3.5) -> str:
    """Convert an MFQ foundation mean into a coarse level label.

    Default thresholds mirror the companion Node script's defaults used in the
    session-2 experiment pipeline:
      - low:    < 2.5
      - medium: < 3.5
      - high:   >= 3.5

    NOTE: This survey records MFQ on a 0–5 scale. These thresholds still work
    (0 will be labeled 'low').
    """
    try:
        x = float(mean_val)
    except Exception:
        return ""

    if x < low_to_medium:
        return "low"
    if x < medium_to_high:
        return "medium"
    return "high"


def flatten_mfq_session2(
    output: Dict[str, Any],
    server_received_at: str,
    session_key: str | None = None,
) -> Tuple[List[str], Dict[str, Any]]:
    """Return a compact per-session MFQ table for session-2 imports.

    Columns include:
      - subject identifiers
      - MFQ combined foundation means
      - categorical level labels (low/medium/high)

    This file is intended to be easy to pipe into the game/session-2 codebase.
    """
    meta = output.get("meta") or {}
    scores = output.get("scores") or {}

    session_key_val = session_key or f"{safe_id(str(meta.get('sessionId') or 'unknown'))}__{safe_id(str(meta.get('mode') or 'unknown'))}"

    mfq = scores.get("mfq30") if isinstance(scores, dict) else None
    foundations = (mfq.get("foundations") or {}) if isinstance(mfq, dict) else {}

    def _get_foundation_mean(name: str) -> Any:
        f = foundations.get(name) or {}
        combined = f.get("combined") or {}
        return combined.get("mean") if isinstance(combined, dict) else None

    harm = _get_foundation_mean("Harm")
    fairness = _get_foundation_mean("Fairness")
    loyalty = _get_foundation_mean("Ingroup")
    authority = _get_foundation_mean("Authority")
    purity = _get_foundation_mean("Purity")

    # Derived indices (often useful in analysis)
    def _mean_finite(vals: List[Any]) -> float | None:
        finite: List[float] = []
        for v in vals:
            if isinstance(v, (int, float)):
                finite.append(float(v))
        if not finite:
            return None
        return sum(finite) / len(finite)

    binding_mean = _mean_finite([loyalty, authority, purity])
    individualizing_mean = _mean_finite([harm, fairness])

    # Difference score used for quartile-based moral-profile assignment.
    #   diff > 0  => more "binding" (ingroup-biased)
    #   diff < 0  => more "individualizing" (outgroup-biased)
    diff = (binding_mean - individualizing_mean) if (binding_mean is not None and individualizing_mean is not None) else None
    # Absolute difference is a "balance" measure: smaller values mean more mixed/balanced.
    abs_diff = abs(diff) if diff is not None else None

    row: Dict[str, Any] = {
        "serverReceivedAt": server_received_at,
        "sessionKey": session_key_val,
        "participantIndex": meta.get("participantIndex"),
        "subjectId": meta.get("sessionId"),
        "sessionId": meta.get("sessionId"),
        "mode": meta.get("mode"),
        "status": session_status(meta),
        "final": is_final_output(output),
        "startedAt": meta.get("startedAt"),
        "completedAt": meta.get("completedAt"),
        "terminatedReason": meta.get("terminatedReason"),

        # Foundation means (0–5)
        "harm": harm,
        "fairness": fairness,
        "loyalty": loyalty,
        "authority": authority,
        "purity": purity,

        # Level labels (low/medium/high)
        "harm_level": mfq_level_from_mean(harm),
        "fairness_level": mfq_level_from_mean(fairness),
        "loyalty_level": mfq_level_from_mean(loyalty),
        "authority_level": mfq_level_from_mean(authority),
        "purity_level": mfq_level_from_mean(purity),

        # Common composites
        "binding_mean": binding_mean,
        "individualizing_mean": individualizing_mean,
        "binding_minus_individualizing": diff,
        "abs_binding_minus_individualizing": abs_diff,

        # --- Quartiles + moral-profile label (filled server-side in group/*latest files) ---
        # NOTE: These start blank in the per-save row and are recomputed across all
        # participants (per-mode) whenever mfq_session2_latest.tsv is updated.
        "harm_quartile": "",
        "fairness_quartile": "",
        "loyalty_quartile": "",
        "authority_quartile": "",
        "purity_quartile": "",
        "binding_mean_quartile": "",
        "individualizing_mean_quartile": "",
        "binding_minus_individualizing_quartile": "",
        "abs_binding_minus_individualizing_quartile": "",
        "mfq_profile_quartile3": "",  # binding / mixed / individualizing
        "mfq_profile_quartile3_code": "",  # 1=binding, 2=mixed, 3=individualizing
    }

    headers = list(row.keys())
    return headers, row


def percentile(values: List[float], p: float) -> float | None:
    """Compute percentile p (0-100) using linear interpolation."""
    if not values:
        return None
    vals = sorted(values)
    if len(vals) == 1:
        return vals[0]
    # Clamp
    p = max(0.0, min(100.0, p))
    k = (len(vals) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(vals) - 1)
    if f == c:
        return vals[f]
    d0 = vals[f] * (c - k)
    d1 = vals[c] * (k - f)
    return d0 + d1


"""NOTE (v18+):

MFQ grouping (quartiles / clustering / maximizing binding-vs-individualizing separation)
is intentionally handled **offline** after Session 1 data collection is complete.

See:
  - analysis/python/01_mfq_grouping_and_clustering.py
  - analysis/r/mfq_grouping_and_clustering.R
"""


def flatten_math_checks_metrics(
    output: Dict[str, Any],
    server_received_at: str,
    session_key: str | None = None,
) -> Tuple[List[str], Dict[str, Any]]:
    """Summarize bot-check arithmetic items (per session).

    Includes both aggregate metrics and per-check fields.
    """
    meta = output.get("meta") or {}
    responses = output.get("responses") or {}

    session_key_val = session_key or f"{safe_id(str(meta.get('sessionId') or 'unknown'))}__{safe_id(str(meta.get('mode') or 'unknown'))}"

    math_list = responses.get("math_checks") or []
    if not isinstance(math_list, list):
        math_list = []

    first_rts: List[float] = []
    last_rts: List[float] = []
    n_checks = 0
    n_attempts_total = 0
    n_first_correct = 0
    n_final_correct = 0

    # Base row (session identifiers)
    row: Dict[str, Any] = {
        "serverReceivedAt": server_received_at,
        "sessionKey": session_key_val,
        "participantIndex": meta.get("participantIndex"),
        "sessionId": meta.get("sessionId"),
        "mode": meta.get("mode"),
        "status": session_status(meta),
        "final": is_final_output(output),
        "startedAt": meta.get("startedAt"),
        "completedAt": meta.get("completedAt"),
        "terminatedReason": meta.get("terminatedReason"),
    }

    # Per-check details (stable order by id)
    def _math_sort_key(m: Dict[str, Any]) -> str:
        return str(m.get("id") or "")

    for m in sorted([x for x in math_list if isinstance(x, dict)], key=_math_sort_key):
        mid = safe_col(str(m.get("id") or ""))
        if not mid:
            continue

        n_checks += 1

        attempts = m.get("attempts") or []
        if not isinstance(attempts, list):
            attempts = []

        n_attempts_total += len(attempts)

        first = attempts[0] if attempts else None
        last = attempts[-1] if attempts else None

        first_rt = first.get("rtMs") if isinstance(first, dict) else None
        last_rt = last.get("rtMs") if isinstance(last, dict) else None

        first_correct = bool(first.get("correct")) if isinstance(first, dict) else False
        last_correct = bool(last.get("correct")) if isinstance(last, dict) else False

        if first_correct:
            n_first_correct += 1
        if last_correct and attempts:
            n_final_correct += 1

        if isinstance(first_rt, (int, float)):
            first_rts.append(float(first_rt))
        if isinstance(last_rt, (int, float)):
            last_rts.append(float(last_rt))

        row[f"{mid}__between"] = m.get("between")
        row[f"{mid}__kind"] = m.get("kind")
        row[f"{mid}__expression"] = m.get("expression")
        row[f"{mid}__correct_answer"] = m.get("correctAnswer")
        row[f"{mid}__response"] = m.get("response")
        row[f"{mid}__attempts_n"] = len(attempts)

        row[f"{mid}__first_rt_ms"] = first_rt
        row[f"{mid}__first_correct"] = first_correct
        row[f"{mid}__first_response_raw"] = first.get("responseRaw") if isinstance(first, dict) else None
        row[f"{mid}__first_response_num"] = first.get("responseNum") if isinstance(first, dict) else None

        row[f"{mid}__final_rt_ms"] = last_rt
        row[f"{mid}__final_correct"] = last_correct if attempts else None
        row[f"{mid}__final_response_raw"] = last.get("responseRaw") if isinstance(last, dict) else None
        row[f"{mid}__final_response_num"] = last.get("responseNum") if isinstance(last, dict) else None

    # Aggregate metrics
    row["math_n_checks"] = n_checks
    row["math_n_attempts_total"] = n_attempts_total
    row["math_first_try_correct_n"] = n_first_correct
    row["math_final_correct_n"] = n_final_correct
    row["math_first_try_accuracy"] = (n_first_correct / n_checks) if n_checks else None
    row["math_final_accuracy"] = (n_final_correct / n_checks) if n_checks else None

    row["math_first_rt_mean_ms"] = (sum(first_rts) / len(first_rts)) if first_rts else None
    row["math_first_rt_median_ms"] = percentile(first_rts, 50.0)
    row["math_first_rt_min_ms"] = min(first_rts) if first_rts else None
    row["math_first_rt_max_ms"] = max(first_rts) if first_rts else None

    row["math_final_rt_mean_ms"] = (sum(last_rts) / len(last_rts)) if last_rts else None
    row["math_final_rt_median_ms"] = percentile(last_rts, 50.0)
    row["math_final_rt_min_ms"] = min(last_rts) if last_rts else None
    row["math_final_rt_max_ms"] = max(last_rts) if last_rts else None

    headers = list(row.keys())
    return headers, row


def flatten_all_data_wide(
    output: Dict[str, Any],
    server_received_at: str,
    session_key: str | None = None,
) -> Tuple[List[str], Dict[str, Any]]:
    """A *single-row* extremely wide table: scores + raw/scored item values + RTs.

    This is intended as an "all-in-one" analysis file for large sample sizes.
    It is written **only for FINAL sessions** (completed or terminated).

    Notes:
      - Column names are stable item IDs from the original instruments.
      - Likert items get *_raw, *_scored, *_rt_first_ms, *_rt_last_ms.
      - MFQ items have no reverse scoring; *_scored equals *_raw.
      - SVO and math checks have instrument-specific columns.
    """
    meta = output.get("meta") or {}
    responses = output.get("responses") or {}

    session_key_val = session_key or f"{safe_id(str(meta.get('sessionId') or 'unknown'))}__{safe_id(str(meta.get('mode') or 'unknown'))}"

    # Start with participant/meta + demographics + QC (friendly columns)
    p_headers, p_row = build_participants_row(output, server_received_at, session_key=session_key_val)
    w_headers, w_row = flatten_scores_wide(output, server_received_at, session_key=session_key_val)

    row: Dict[str, Any] = {}
    for h in p_headers:
        row[h] = p_row.get(h)

    # Add score columns (avoid overwriting shared meta fields)
    for h in w_headers:
        if h in row:
            continue
        row[h] = w_row.get(h)

    # ---- Demographics (raw item-id columns) ----
    demo_list = responses.get("demographics") or []
    if isinstance(demo_list, list):
        for q in demo_list:
            if not isinstance(q, dict):
                continue
            qid = safe_col(str(q.get("id") or ""))
            if not qid:
                continue
            row[f"{qid}__raw"] = q.get("response")
            row[f"{qid}__extra_text"] = q.get("extraText")
            t = q.get("timing") or {}
            if isinstance(t, dict):
                row[f"{qid}__rt_first_ms"] = t.get("firstRtMs")
                row[f"{qid}__rt_last_ms"] = t.get("lastRtMs")

    # ---- Likert instruments ----
    def add_likert(inst_key: str) -> None:
        items = responses.get(inst_key) or []
        if not isinstance(items, list):
            return
        for it in items:
            if not isinstance(it, dict):
                continue
            iid = safe_col(str(it.get("id") or ""))
            if not iid:
                continue
            resp = it.get("response") or {}
            scored = it.get("scored") or {}
            t = it.get("timing") or {}

            row[f"{iid}__raw"] = resp.get("value") if isinstance(resp, dict) else None
            row[f"{iid}__scored"] = scored.get("value") if isinstance(scored, dict) else None
            if isinstance(t, dict):
                row[f"{iid}__rt_first_ms"] = t.get("firstRtMs")
                row[f"{iid}__rt_last_ms"] = t.get("lastRtMs")

    add_likert("hexaco100")
    add_likert("ipip120")
    add_likert("d70")

    # ---- MFQ (part1 + part2; scored==raw) ----
    mfq = responses.get("mfq30") or {}
    if isinstance(mfq, dict):
        for part_key in ["part1", "part2"]:
            part = mfq.get(part_key) or {}
            if not isinstance(part, dict):
                continue
            items = part.get("items") or []
            if not isinstance(items, list):
                continue
            for it in items:
                if not isinstance(it, dict):
                    continue
                iid = safe_col(str(it.get("id") or ""))
                if not iid:
                    continue
                resp = it.get("response") or {}
                t = it.get("timing") or {}

                raw_val = resp.get("value") if isinstance(resp, dict) else None
                row[f"{iid}__raw"] = raw_val
                row[f"{iid}__scored"] = raw_val
                if isinstance(t, dict):
                    row[f"{iid}__rt_first_ms"] = t.get("firstRtMs")
                    row[f"{iid}__rt_last_ms"] = t.get("lastRtMs")

    # ---- Math checks (per-check fields) ----
    m_headers, m_row = flatten_math_checks_metrics(output, server_received_at, session_key=session_key_val)
    for h in m_headers:
        # Keep the core session identifier fields from the participant row.
        if h in row:
            continue
        row[h] = m_row.get(h)

    # ---- SVO (slider + written; strict-match QC) ----
    svo_list = responses.get("svo") or []
    if isinstance(svo_list, list):
        for it in svo_list:
            if not isinstance(it, dict):
                continue
            iid = safe_col(str(it.get("id") or ""))
            if not iid:
                continue

            row[f"{iid}__choice_index"] = it.get("choiceIndex")
            row[f"{iid}__expected_you"] = it.get("youReceive")
            row[f"{iid}__expected_other"] = it.get("otherReceives")

            w = it.get("written") or {}
            if isinstance(w, dict):
                row[f"{iid}__written_you_raw"] = w.get("youRaw")
                row[f"{iid}__written_other_raw"] = w.get("otherRaw")
                row[f"{iid}__written_you_num"] = w.get("youNum")
                row[f"{iid}__written_other_num"] = w.get("otherNum")
                row[f"{iid}__written_matches_expected"] = w.get("matchesExpected")
                row[f"{iid}__written_edited_at"] = w.get("editedAt")

            t = it.get("timing") or {}
            if isinstance(t, dict):
                tg = t.get("generic") or {}
                ts = t.get("slider") or {}
                tw = t.get("written") or {}
                if isinstance(tg, dict):
                    row[f"{iid}__rt_first_ms"] = tg.get("firstRtMs")
                    row[f"{iid}__rt_last_ms"] = tg.get("lastRtMs")
                if isinstance(ts, dict):
                    row[f"{iid}__slider_rt_first_ms"] = ts.get("firstRtMs")
                    row[f"{iid}__slider_rt_last_ms"] = ts.get("lastRtMs")
                    row[f"{iid}__slider_change_count"] = ts.get("changeCount")
                if isinstance(tw, dict):
                    row[f"{iid}__written_rt_first_ms"] = tw.get("firstRtMs")
                    row[f"{iid}__written_rt_last_ms"] = tw.get("lastRtMs")
                    row[f"{iid}__written_change_count"] = tw.get("changeCount")

    headers = list(row.keys())
    return headers, row


def to_tsv_line(headers: List[str], row: Dict[str, Any]) -> str:
    return "\t".join(tsv_escape(row.get(h)) for h in headers) + "\n"


def to_csv_line(headers: List[str], row: Dict[str, Any]) -> str:
    """Render a single CSV row line for append-only CSV exports."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["" if row.get(h) is None else row.get(h) for h in headers])
    return buf.getvalue()


# -------- "latest" group-level tables (include incomplete sessions) --------

def read_tsv_table(path: str, key_col: str) -> Tuple[List[str], Dict[str, Dict[str, Any]]]:
    """Read a TSV into (headers, rows_by_key). Missing/empty files return empty."""
    if not os.path.exists(path):
        return [], {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = [ln.rstrip("\n") for ln in f if ln.strip()]
    except Exception:
        return [], {}

    if not lines:
        return [], {}

    headers = lines[0].split("\t")
    if key_col not in headers:
        # Cannot safely index without a key
        return headers, {}

    idx = headers.index(key_col)
    rows: Dict[str, Dict[str, Any]] = {}
    for ln in lines[1:]:
        parts = ln.split("\t")
        row = {headers[i]: (parts[i] if i < len(parts) else "") for i in range(len(headers))}
        key = row.get(key_col, "")
        if key:
            rows[key] = row
    return headers, rows


def write_tsv_table(path: str, headers: List[str], rows: List[Dict[str, Any]]) -> None:
    ensure_dir(os.path.dirname(path))
    header_line = "\t".join(headers) + "\n"
    body = "".join(to_tsv_line(headers, r) for r in rows)
    atomic_write(path, (header_line + body).encode("utf-8"))


def write_csv_table(path: str, headers: List[str], rows: List[Dict[str, Any]]) -> None:
    """Write a small CSV file (UTF-8) using python's csv module.

    We keep CSVs only for files that are likely to be imported by external tooling
    (e.g., the Session 2 MFQ file used by the moral-foundations-experiment codebase).
    For large/wide exports, TSV is the primary format.
    """
    ensure_dir(os.path.dirname(path))
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    for r in rows:
        w.writerow(["" if r.get(h) is None else str(r.get(h)) for h in headers])
    atomic_write(path, buf.getvalue().encode("utf-8"))


def write_csv_from_tsv(tsv_path: str, csv_path: str) -> None:
    """Convenience: mirror a TSV file as CSV (same rows/columns).

    This is useful when another tool expects comma-separated values.
    """
    if not os.path.exists(tsv_path):
        return
    try:
        with open(tsv_path, "r", encoding="utf-8") as f:
            rows = [ln.rstrip("\n").split("\t") for ln in f]
    except Exception:
        return

    ensure_dir(os.path.dirname(csv_path))
    buf = io.StringIO()
    w = csv.writer(buf)
    for parts in rows:
        w.writerow(parts)
    atomic_write(csv_path, buf.getvalue().encode("utf-8"))


# -------- participant indexing (sequential IDs) --------

PARTICIPANT_INDEX_HEADERS = ["sessionKey", "mode", "participantIndex", "assignedAt"]


def get_or_assign_participant_index(
    *,
    group_dir: str,
    group_bak_dir: str,
    session_key: str,
    mode: str,
    assigned_at: str,
) -> int:
    """
    Assign a sequential participantIndex per MODE ("prod" and "trial" get separate sequences).
    The mapping is stored in:
      output/group/participant_index.tsv
      output_backup/group/participant_index.tsv

    This makes it easy to reference participants by a stable integer index in analysis,
    while sessionKey/sessionId remains the primary unique identifier.
    """
    ensure_dir(group_dir)
    ensure_dir(group_bak_dir)

    path = os.path.join(group_dir, "participant_index.tsv")
    bak_path = os.path.join(group_bak_dir, "participant_index.tsv")

    headers, rows_by_key = read_tsv_table(path, "sessionKey")

    if session_key in rows_by_key:
        try:
            return int(str(rows_by_key[session_key].get("participantIndex") or "").strip())
        except Exception:
            # fall through to re-assign
            pass

    # Find current max within this mode
    max_idx = 0
    for r in rows_by_key.values():
        if (r.get("mode") or "") != mode:
            continue
        try:
            v = int(str(r.get("participantIndex") or "").strip())
            if v > max_idx:
                max_idx = v
        except Exception:
            continue

    new_idx = max_idx + 1
    rows_by_key[session_key] = {
        "sessionKey": session_key,
        "mode": mode,
        "participantIndex": new_idx,
        "assignedAt": assigned_at,
    }

    # Write sorted by (mode, participantIndex) for readability
    all_rows = list(rows_by_key.values())

    def _sort(r: Dict[str, Any]) -> Tuple[str, int, str]:
        mm = str(r.get("mode") or "")
        try:
            ii = int(str(r.get("participantIndex") or 0))
        except Exception:
            ii = 0
        sk = str(r.get("sessionKey") or "")
        return (mm, ii, sk)

    all_rows.sort(key=_sort)

    write_tsv_table(path, PARTICIPANT_INDEX_HEADERS, all_rows)
    write_tsv_table(bak_path, PARTICIPANT_INDEX_HEADERS, all_rows)

    return new_idx


# -------- TSV helpers (inject server-side columns) --------

def inject_tsv_columns(tsv_text: str, cols: Dict[str, Any]) -> str:
    """
    Ensure TSV contains the given columns and set their values on every data row.
    - If a column doesn't exist, it's inserted at the front (in the order of `cols`).
    - If it exists, values are overwritten.
    """
    if not tsv_text:
        return tsv_text

    lines = [ln.rstrip("\n") for ln in tsv_text.splitlines() if ln.strip()]
    if not lines:
        return tsv_text

    header = lines[0].split("\t")
    missing = [c for c in cols.keys() if c not in header]
    new_header = missing + header

    # Map existing column indexes (in original header)
    idx_existing = {c: header.index(c) for c in cols.keys() if c in header}

    out_lines = ["\t".join(new_header)]

    for ln in lines[1:]:
        parts = ln.split("\t")
        # pad to original header length
        if len(parts) < len(header):
            parts.extend([""] * (len(header) - len(parts)))

        # overwrite existing cols in-place
        for c, idx in idx_existing.items():
            parts[idx] = tsv_escape(cols[c])

        # prefix missing cols
        prefix_vals = [tsv_escape(cols[c]) for c in missing]
        out_parts = prefix_vals + parts
        out_lines.append("\t".join(out_parts))

    return "\n".join(out_lines) + "\n"


def update_latest_table(
    path: str,
    bak_path: str,
    key_col: str,
    new_row: Dict[str, Any],
    preferred_header: List[str] | None = None,
    sort_col: str = "serverReceivedAt",
) -> None:
    """Upsert a row into a TSV file, rewriting the whole file (small, ~800 rows)."""

    headers, rows_by_key = read_tsv_table(path, key_col)

    # Header strategy:
    # - If caller provides a preferred header (stable), use it.
    # - Otherwise keep existing order, then append new columns.
    if preferred_header:
        headers = preferred_header[:]

    # Ensure key column exists
    if key_col not in headers:
        headers = [key_col] + headers

    # Merge in any new keys not yet present
    for k in new_row.keys():
        if k not in headers:
            headers.append(k)

    key = str(new_row.get(key_col) or "")
    if key:
        rows_by_key[key] = new_row

    # Sort for readability (newest first)
    def sort_key(r: Dict[str, Any]) -> Tuple[str, str]:
        v = r.get(sort_col) or ""
        # Secondary sort: sessionKey
        sk = str(r.get(key_col) or "")
        return (str(v), sk)

    rows_sorted = sorted(rows_by_key.values(), key=sort_key, reverse=True)

    write_tsv_table(path, headers, rows_sorted)
    write_tsv_table(bak_path, headers, rows_sorted)


# -------- Additional "large-N friendly" exports --------

ITEM_DICT_HEADERS = [
    "instrument",
    "item_id",
    "item_num",
    "facet",
    "key",
    "mfq_var",
    "mfq_scoredItem",
    "item_text",
    "reverseKeyed",
    "reverseFormula",
    "options_json",
]

RESPONSES_COMPACT_HEADERS = [
    "participantIndex",
    "sessionKey",
    "sessionId",
    "mode",
    "instrument",
    "item_id",
    "item_num",
    "presented_num",
    "raw_value",
    "scored_value",
    "rt_first_ms",
    "rt_last_ms",
    "svo_expected_you",
    "svo_expected_other",
    "svo_written_you_num",
    "svo_written_other_num",
    "svo_written_matches_expected",
    "extra",
]


# ------------------------------------------------------------
# Data dictionary (human-readable column definitions)
# ------------------------------------------------------------
#
# Studies become much easier to audit and analyse when every exported file
# has a clear explanation of what each column means.
#
# This server writes:
#   output/group/data_dictionary.tsv
#   output_backup/group/data_dictionary.tsv
#
# The dictionary is intentionally TSV (not JSON) so it can be opened quickly
# in Excel / LibreOffice or loaded in R/Python without extra tooling.

DATA_DICTIONARY_HEADERS = [
    "table",
    "column",
    "type",
    "description",
    "example",
    "notes",
]


def _parse_js_array_literals(js_text: str, const_name: str) -> List[str]:
    """Extract a JS string array literal like: const NAME = ["a", "b"];"""
    # This is intentionally simple: we only parse the arrays we control.
    m = re.search(rf"const\s+{re.escape(const_name)}\s*=\s*\[(.*?)\];", js_text, re.S)
    if not m:
        return []
    inside = m.group(1)
    # Capture double-quoted strings; the headers in app.js use double quotes.
    return re.findall(r'"([^"]+)"', inside)


def get_frontend_tsv_headers(survey_root: str) -> Tuple[List[str], List[str]]:
    """Best-effort: read TSV header arrays from app.js so the dictionary stays in sync."""
    app_path = os.path.join(survey_root, "app.js")
    try:
        with open(app_path, "r", encoding="utf-8") as f:
            js = f.read()
        resp = _parse_js_array_literals(js, "TSV_HEADERS_RESPONSES")
        sc = _parse_js_array_literals(js, "TSV_HEADERS_SCORES")
        return resp, sc
    except Exception:
        return [], []


def build_data_dictionary_rows(survey_root: str) -> List[Dict[str, Any]]:
    """Return a list of TSV rows describing all exported outputs."""
    rows: List[Dict[str, Any]] = []

    def add(table: str, column: str, typ: str, desc: str, example: str = "", notes: str = "") -> None:
        rows.append({
            "table": table,
            "column": column,
            "type": typ,
            "description": desc,
            "example": example,
            "notes": notes,
        })

    # --------------------------------------------------------
    # sessions_manifest.tsv (group index of all sessions)
    # --------------------------------------------------------
    manifest_table = "group/sessions_manifest.tsv"
    add(manifest_table, "serverReceivedAt", "iso_datetime", "When the server processed the latest save for this session.", "2026-01-05T14:42:47.395Z")
    add(manifest_table, "sessionKey", "string", "Primary unique session key: <sessionId>__<mode>.", "7b9e...__prod")
    add(manifest_table, "participantIndex", "int", "Server-assigned sequential participant index (separate sequences per mode).", "12")
    add(manifest_table, "sessionId", "string", "Client-generated session UUID.", "7b9e3462-0f68-4b9a-81f1-a7904bb53dd5")
    add(manifest_table, "mode", "string", "Collection mode: prod or trial.", "prod")
    add(manifest_table, "status", "string", "Session status derived from meta fields.", "in_progress", "Values: in_progress | completed | terminated")
    add(manifest_table, "final", "bool", "True if the session was finalized (completed/terminated) when recorded.", "true")
    add(manifest_table, "autosaveSeq", "int", "Client-side autosave sequence counter.", "5")
    add(manifest_table, "lastAutosaveAt", "iso_datetime", "Client timestamp for last autosave.", "2026-01-05T14:42:46.000Z")
    add(manifest_table, "startedAt", "iso_datetime", "Client timestamp when session started.", "2026-01-05T14:40:00.000Z")
    add(manifest_table, "completedAt", "iso_datetime", "Client timestamp when fully completed (empty if not completed).")
    add(manifest_table, "terminatedReason", "string", "If terminated early, reason string (e.g., no_consent).")
    add(manifest_table, "flow_order", "string", "Comma-separated questionnaire order used for this session.", "hexaco100,ipip120,mfq30,d70,svo")
    add(manifest_table, "flow_source", "string", "Where the flow order came from.", "launcher", "Values typically: launcher | url | default")
    add(manifest_table, "sessionDir", "string", "Relative path to the per-session snapshot directory.", "sessions/7b9e...__prod")
    add(manifest_table, "latestJson", "string", "Relative path to the per-session JSON snapshot.", "sessions/.../latest.json")
    add(manifest_table, "latestResponsesTsv", "string", "Relative path to per-session item-level TSV.")
    add(manifest_table, "latestScoresTsv", "string", "Relative path to per-session score TSV.")
    add(manifest_table, "latestParticipantTsv", "string", "Relative path to per-session one-row participant/meta TSV.")
    add(manifest_table, "latestScoresWideTsv", "string", "Relative path to per-session one-row wide scores TSV.")
    add(manifest_table, "error", "string", "Reserved for server-side error reporting (usually empty).")

    # --------------------------------------------------------
    # participant_index.tsv (stable integer indices)
    # --------------------------------------------------------
    idx_table = "group/participant_index.tsv"
    add(idx_table, "sessionKey", "string", "Session key.")
    add(idx_table, "mode", "string", "prod or trial.")
    add(idx_table, "participantIndex", "int", "Sequential participant index within the mode.")
    add(idx_table, "assignedAt", "iso_datetime", "When the server assigned the participant index.")

    # --------------------------------------------------------
    # ipip120_order.tsv (audit: constant shuffled order)
    # --------------------------------------------------------
    ipip_table = "group/ipip120_order.tsv"
    add(ipip_table, "presented_index", "int", "0-based index in the presented order.", "0")
    add(ipip_table, "presented_num", "int", "1-based display number shown to participants (if renumbering enabled).", "1")
    add(ipip_table, "item_id", "string", "Stable item id.")
    add(ipip_table, "original_item_num", "int", "Original item number from the source document.")
    add(ipip_table, "reverse_keyed", "bool", "Whether the item is reverse-keyed for scoring.")
    add(ipip_table, "item_text", "string", "Exact presented item wording.")
    add(ipip_table, "order_mode", "string", "Randomization mode (global or perSession).", "global")
    add(ipip_table, "global_seed", "string", "Seed string used when order_mode=global.", "ipip120_global_v1")
    add(ipip_table, "seed_salt", "string", "Salt used when order_mode=perSession.")
    add(ipip_table, "seed", "string", "Concrete seed used for this order (debug/audit).")
    add(ipip_table, "renumber_display", "bool", "Whether displayed numbers are renumbered 1..N in presented order.")

    # --------------------------------------------------------
    # item_dictionary.tsv (join helper for compact exports)
    # --------------------------------------------------------
    item_table = "item_dictionary.tsv"
    add(item_table, "instrument", "string", "Instrument id.", "hexaco100")
    add(item_table, "item_id", "string", "Stable item id used in responses.")
    add(item_table, "item_num", "int", "Original item number from document.")
    add(item_table, "facet", "string", "Facet/domain tag (instrument-specific).")
    add(item_table, "key", "string", "Facet key / scoring key (instrument-specific).")
    add(item_table, "mfq_var", "string", "MFQ foundation variable name (mfq30 only).")
    add(item_table, "mfq_scoredItem", "bool", "MFQ: whether this item is included in scoring (vs catch/attention item).")
    add(item_table, "item_text", "string", "Exact item wording (blank for SVO; see options_json).")
    add(item_table, "reverseKeyed", "bool", "Whether this item is reverse-keyed.")
    add(item_table, "reverseFormula", "string", "Reverse scoring formula (e.g., 6 - raw) when applicable.")
    add(item_table, "options_json", "json", "For SVO: JSON of youReceive/otherReceives arrays for each column.")

    # --------------------------------------------------------
    # responses_compact.tsv (large-N friendly, minimal)
    # --------------------------------------------------------
    compact_table = "responses_compact.tsv"
    add(compact_table, "participantIndex", "int", "Participant index (per mode).")
    add(compact_table, "sessionKey", "string", "Session key.")
    add(compact_table, "sessionId", "string", "Session id.")
    add(compact_table, "mode", "string", "prod or trial.")
    add(compact_table, "instrument", "string", "Instrument id.")
    add(compact_table, "item_id", "string", "Stable item id.")
    add(compact_table, "item_num", "int", "Original item number.")
    add(compact_table, "presented_num", "int", "Displayed number in presented order (IPIP uses randomized numbering).")
    add(compact_table, "raw_value", "number", "Raw recorded response value (e.g., Likert 1..5).")
    add(compact_table, "scored_value", "number", "Scored value after reverse-keying where applicable.")
    add(compact_table, "rt_first_ms", "int", "First-response reaction time in milliseconds.")
    add(compact_table, "rt_last_ms", "int", "Last-change reaction time in milliseconds.")
    add(compact_table, "svo_expected_you", "int", "SVO: expected YOU payoff based on slider choice.")
    add(compact_table, "svo_expected_other", "int", "SVO: expected OTHER payoff based on slider choice.")
    add(compact_table, "svo_written_you_num", "int", "SVO: typed YOU value (parsed number).")
    add(compact_table, "svo_written_other_num", "int", "SVO: typed OTHER value (parsed number).")
    add(compact_table, "svo_written_matches_expected", "bool", "SVO: whether typed values match the selected column.")
    add(compact_table, "extra", "string", "Instrument-specific extra field (e.g., math attempt JSON).")

    # --------------------------------------------------------
    # Frontend-generated TSVs (responses_long.tsv and scores_long.tsv)
    # --------------------------------------------------------
    resp_headers, score_headers = get_frontend_tsv_headers(survey_root)

    # responses_long.tsv
    long_resp_table = "responses_long.tsv (and sessions/*/latest_responses.tsv)"
    if resp_headers:
        for c in resp_headers:
            # Minimal per-column descriptions (detailed notes for key columns below)
            if c in ("participantIndex", "sessionKey", "sessionId", "mode"):
                add(long_resp_table, c, "id", "Participant/session identifiers.")
            elif c.endswith("At"):
                add(long_resp_table, c, "iso_datetime", "Timestamp (ISO 8601, UTC when server-generated).")
            elif c.startswith("rt_") or c.endswith("_ms"):
                add(long_resp_table, c, "int", "Time duration in milliseconds.")
            elif c in ("raw_value", "scored_value", "response_value", "item_score_value"):
                add(long_resp_table, c, "number", "Numeric response/scored value.")
            elif c in ("raw_label", "scored_label", "response_label", "item_score_label"):
                add(long_resp_table, c, "string", "Human-readable label for the corresponding value.")
            elif c == "extra":
                add(long_resp_table, c, "string", "Instrument-specific extra field. For math_check and SVO this is JSON.", "{...}")
            else:
                add(long_resp_table, c, "string", "Column used for audit / analysis.")

        # Add a few detailed notes for the most important columns
        add(long_resp_table, "raw_value", "number", "Raw answer as selected/typed by participant.", "4", "For Likert items: usually 1..5. For SVO: choiceIndex 0..8.")
        add(long_resp_table, "scored_value", "number", "Value used for scoring (after reverse-keying).", "2", "For non-reverse items, scored_value == raw_value.")
        add(long_resp_table, "reverseKeyed", "bool", "Whether the item was reverse-keyed.", "true")
        add(long_resp_table, "extra", "string", "Extra audit payload. Often blank, but may contain JSON.", "{\"attempts\":[...]}", "Math checks store full attempt history here.")
    else:
        add(long_resp_table, "(all columns)", "n/a", "Could not parse TSV headers from app.js. Open app.js and search for TSV_HEADERS_RESPONSES.")

    # scores_long.tsv
    long_score_table = "scores_long.tsv (and sessions/*/latest_scores.tsv)"
    if score_headers:
        for c in score_headers:
            if c in ("participantIndex", "sessionKey", "sessionId", "mode"):
                add(long_score_table, c, "id", "Participant/session identifiers.")
            elif c.endswith("At"):
                add(long_score_table, c, "iso_datetime", "Timestamp.")
            elif c == "value":
                add(long_score_table, c, "number", "Numeric score value (sum/mean/etc.).")
            elif c == "detail":
                add(long_score_table, c, "json", "JSON string containing audit details (items used, nItems, etc.).")
            else:
                add(long_score_table, c, "string", "Column used for audit / analysis.")

        add(long_score_table, "score_type", "string", "What the row represents (facet_sum, facet_mean, domain_sum, etc.).")
        add(long_score_table, "detail", "json", "Audit payload (items, sums, nItems, etc.).", "{\"nItems\":10,\"items\":[...]}" )
    else:
        add(long_score_table, "(all columns)", "n/a", "Could not parse TSV headers from app.js. Open app.js and search for TSV_HEADERS_SCORES.")

    # --------------------------------------------------------
    # scores_wide.tsv (one row per session; many dynamic columns)
    # --------------------------------------------------------
    wide_table = "scores_wide.tsv (and group/scores_wide_latest.tsv)"
    add(wide_table, "serverReceivedAt", "iso_datetime", "When server wrote/updated the wide row.")
    add(wide_table, "sessionKey", "string", "Session key.")
    add(wide_table, "participantIndex", "int", "Participant index.")
    add(wide_table, "mode", "string", "prod or trial.")
    add(wide_table, "status", "string", "in_progress/completed/terminated.")
    add(wide_table, "hexaco_factor_mean_<FACTOR>", "float", "HEXACO factor mean score.", "3.4", "<FACTOR> is sanitized factor name.")
    add(wide_table, "hexaco_factor_sum_<FACTOR>", "float", "HEXACO factor sum score.")
    add(wide_table, "hexaco_facet_mean_<FACET>", "float", "HEXACO facet mean score.")
    add(wide_table, "hexaco_facet_sum_<FACET>", "float", "HEXACO facet sum score.")
    add(wide_table, "ipip_domain_mean_<DOMAIN>", "float", "IPIP-NEO domain mean score.")
    add(wide_table, "ipip_domain_sum_<DOMAIN>", "float", "IPIP-NEO domain sum score.")
    add(wide_table, "ipip_facet_mean_<FACET>", "float", "IPIP-NEO facet mean score.")
    add(wide_table, "ipip_facet_sum_<FACET>", "float", "IPIP-NEO facet sum score.")
    add(wide_table, "mfq_foundation_mean_<FOUNDATION>", "float", "MFQ foundation mean score (combined parts).")
    add(wide_table, "mfq_foundation_sum_<FOUNDATION>", "float", "MFQ foundation sum score (combined parts).")
    add(wide_table, "d70_mean", "float", "D70 mean score.")
    add(wide_table, "d70_sum", "float", "D70 sum score.")
    add(wide_table, "svo_angle_deg", "float", "SVO angle in degrees.")
    add(wide_table, "svo_category", "string", "SVO categorical type based on angle.")

    # --------------------------------------------------------
    # mfq_session2.tsv / mfq_session2.csv
    # --------------------------------------------------------
    mfq2_table = "mfq_session2.tsv (and mfq_session2.csv, group/mfq_session2_latest.tsv, group/mfq_session2_latest.csv)"
    add(mfq2_table, "serverReceivedAt", "iso_datetime", "When the server wrote/updated this derived MFQ row.")
    add(mfq2_table, "subjectId", "string", "ID used for downstream Session 2 imports. Currently equals sessionId.")
    add(mfq2_table, "sessionId", "string", "Survey-generated session ID.")
    add(mfq2_table, "sessionKey", "string", "Session key (sessionId__mode).")
    add(mfq2_table, "participantIndex", "int", "Per-mode participant index.")
    add(mfq2_table, "mode", "string", "prod or trial.")
    add(mfq2_table, "status", "string", "in_progress/completed/terminated.")
    add(mfq2_table, "harm", "float", "MFQ foundation mean (combined parts), 0-5 scale.")
    add(mfq2_table, "fairness", "float", "MFQ foundation mean (combined parts), 0-5 scale.")
    add(mfq2_table, "loyalty", "float", "MFQ foundation mean for Ingroup/Loyalty (combined parts), 0-5 scale.")
    add(mfq2_table, "authority", "float", "MFQ foundation mean (combined parts), 0-5 scale.")
    add(mfq2_table, "purity", "float", "MFQ foundation mean (combined parts), 0-5 scale.")
    add(mfq2_table, "<foundation>_level", "string", "Low/medium/high label computed from default thresholds (2.5, 3.5).")
    add(mfq2_table, "binding_mean", "float", "Mean of loyalty, authority, purity (if all present).")
    add(mfq2_table, "individualizing_mean", "float", "Mean of harm and fairness (if both present).")
    add(mfq2_table, "binding_minus_individualizing", "float", "binding_mean - individualizing_mean.")

    add(mfq2_table, "abs_binding_minus_individualizing", "float", "Absolute value of binding_minus_individualizing (balance metric). Smaller values mean more balanced/mixed.")
    add(mfq2_table, "<metric>_quartile", "int", "Quartile label (1..4) computed per MODE across COMPLETED rows. See group/mfq_quartiles.tsv for cutpoints.", "3", "Boundary rule: Q1=value<=q25, Q2<=q50, Q3<=q75, Q4>q75")
    add(mfq2_table, "mfq_profile_quartile3", "string", "3-way moral profile label derived from quartiles of binding_minus_individualizing: binding / mixed / individualizing.", "mixed")
    add(mfq2_table, "mfq_profile_quartile3_code", "int", "Numeric code for mfq_profile_quartile3 (1=binding, 2=mixed, 3=individualizing).", "2")

    # mfq_quartiles.tsv
    q_table = "group/mfq_quartiles.tsv (and group/mfq_quartiles.csv)"
    add(q_table, "serverComputedAt", "iso_datetime", "When the server recomputed quartile cutpoints.")
    add(q_table, "mode", "string", "prod or trial. Quartiles are computed separately per mode.")
    add(q_table, "metric", "string", "Metric name (column) from mfq_session2_latest.tsv.")
    add(q_table, "n", "int", "Number of COMPLETED sessions used to compute cutpoints.")
    add(q_table, "q25", "float", "25th percentile cutpoint.")
    add(q_table, "q50", "float", "Median cutpoint.")
    add(q_table, "q75", "float", "75th percentile cutpoint.")

    # --------------------------------------------------------
    # math_checks_metrics.tsv
    # --------------------------------------------------------
    math_table = "math_checks_metrics.tsv (and group/math_checks_metrics_latest.tsv)"
    add(math_table, "serverReceivedAt", "iso_datetime", "When the server wrote/updated this derived math metrics row.")
    add(math_table, "sessionKey", "string", "Session key.")
    add(math_table, "participantIndex", "int", "Per-mode participant index.")
    add(math_table, "mode", "string", "prod or trial.")
    add(math_table, "status", "string", "in_progress/completed/terminated.")
    add(math_table, "math_n_checks", "int", "Number of math check items.")
    add(math_table, "math_n_attempts_total", "int", "Total attempts across all math checks.")
    add(math_table, "math_first_try_correct_n", "int", "How many checks were correct on first try.")
    add(math_table, "math_first_try_accuracy", "float", "math_first_try_correct_n / math_n_checks.")
    add(math_table, "math_final_correct_n", "int", "How many checks ended correct on the last attempt.")
    add(math_table, "math_final_accuracy", "float", "math_final_correct_n / math_n_checks.")
    add(math_table, "math_first_rt_mean_ms", "float", "Mean RT (ms) on first attempt per check.")
    add(math_table, "math_final_rt_mean_ms", "float", "Mean RT (ms) on final attempt per check.")
    add(math_table, "<math_check_id>__*", "mixed", "Per-check detail columns (expression, correct answer, final response, attempts_n, first_rt_ms, first_correct, final_rt_ms, final_correct, etc.).")

    # --------------------------------------------------------
    # all_data_wide.tsv
    # --------------------------------------------------------
    all_table = "all_data_wide.tsv"
    add(all_table, "(many columns)", "n/a", "One row per FINAL session. Includes: participants.tsv columns + scores_wide.tsv columns + item-level raw/scored values and RTs with item-id-based column names.")
    add(all_table, "<item_id>_raw", "mixed", "Raw response value for that item (numeric for Likert, string for free text).")
    add(all_table, "<item_id>_scored", "float", "Reverse-scored value when applicable (Likert items). For MFQ items, equals raw.")
    add(all_table, "<item_id>_rt_first_ms", "float", "First-response RT in ms for that item.")
    add(all_table, "<item_id>_rt_last_ms", "float", "Last-change RT in ms for that item.")
    add(all_table, "svo_XX_choice_index", "int", "SVO slider column index (0-8).")
    add(all_table, "<math_check_id>_*", "mixed", "Per-math-check detail fields (expression, correct, response, attempts, RTs, correctness).")

    return rows


def write_data_dictionary(out_dir: str, bak_dir: str, survey_root: str) -> None:
    """Write the data_dictionary.tsv files (main + backup)."""
    group_dir = os.path.join(out_dir, "group")
    group_bak_dir = os.path.join(bak_dir, "group")
    ensure_dir(group_dir)
    ensure_dir(group_bak_dir)

    rows = build_data_dictionary_rows(survey_root)
    header_line = "\t".join(DATA_DICTIONARY_HEADERS) + "\n"
    body = "".join(to_tsv_line(DATA_DICTIONARY_HEADERS, r) for r in rows)
    b = (header_line + body).encode("utf-8")

    atomic_write(os.path.join(group_dir, "data_dictionary.tsv"), b)
    atomic_write(os.path.join(group_bak_dir, "data_dictionary.tsv"), b)


def extract_item_dictionary_rows(output: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Build a stable item dictionary from the structured JSON output.
    This is useful to avoid duplicating full item text in large-N response tables.
    """
    responses = output.get("responses") or {}
    rows: List[Dict[str, Any]] = []

    def add_row(**kwargs: Any) -> None:
        row = {h: None for h in ITEM_DICT_HEADERS}
        row.update(kwargs)
        rows.append(row)

    # Likert instruments
    for inst_id in ("hexaco100", "ipip120", "d70"):
        items = responses.get(inst_id) or []
        if not isinstance(items, list):
            continue
        for it in items:
            if not isinstance(it, dict):
                continue
            add_row(
                instrument=inst_id,
                item_id=it.get("id"),
                item_num=it.get("num"),
                facet=it.get("facet"),
                key=it.get("key"),
                mfq_var=None,
                mfq_scoredItem=None,
                item_text=it.get("text"),
                reverseKeyed=it.get("reverseKeyed"),
                reverseFormula=it.get("reverseFormula"),
                options_json=None,
            )

    # MFQ (two parts, keep part in instrument name to match responses_long.tsv)
    mfq = responses.get("mfq30") or {}
    if isinstance(mfq, dict):
        for part_name in ("part1", "part2"):
            part = mfq.get(part_name) or {}
            if not isinstance(part, dict):
                continue
            for it in (part.get("items") or []):
                if not isinstance(it, dict):
                    continue
                add_row(
                    instrument=f"mfq30_{part_name}",
                    item_id=it.get("id"),
                    item_num=it.get("num"),
                    facet=None,
                    key=None,
                    mfq_var=it.get("var"),
                    mfq_scoredItem=it.get("scoredItem"),
                    item_text=it.get("text"),
                    reverseKeyed=False,
                    reverseFormula=None,
                    options_json=None,
                )

    # SVO
    svo_items = responses.get("svo") or []
    if isinstance(svo_items, list):
        for it in svo_items:
            if not isinstance(it, dict):
                continue
            options = it.get("options") or {}
            if isinstance(options, dict):
                you = options.get("youReceive")
                other = options.get("otherReceives")
                options_json = json.dumps({"youReceive": you, "otherReceives": other}, ensure_ascii=False)
            else:
                options_json = None

            add_row(
                instrument="svo",
                item_id=it.get("id"),
                item_num=it.get("num"),
                facet=None,
                key=None,
                mfq_var=None,
                mfq_scoredItem=None,
                item_text=None,
                reverseKeyed=False,
                reverseFormula=None,
                options_json=options_json,
            )

    return rows


def maybe_write_item_dictionary(output: Dict[str, Any], out_dir: str, bak_dir: str) -> None:
    """
    Write item_dictionary.tsv once (if it doesn't exist yet), using the first FINAL session as source.
    """
    out_path = os.path.join(out_dir, "item_dictionary.tsv")
    bak_path = os.path.join(bak_dir, "item_dictionary.tsv")

    if os.path.exists(out_path) and os.path.exists(bak_path):
        return

    rows = extract_item_dictionary_rows(output)
    if not rows:
        return

    header_line = "\t".join(ITEM_DICT_HEADERS) + "\n"
    body = "".join(to_tsv_line(ITEM_DICT_HEADERS, r) for r in rows)

    if not os.path.exists(out_path):
        atomic_write(out_path, (header_line + body).encode("utf-8"))
    if not os.path.exists(bak_path):
        atomic_write(bak_path, (header_line + body).encode("utf-8"))


def append_responses_compact(responses_tsv: str, out_dir: str, bak_dir: str) -> None:
    """
    Append a compact subset of response columns to responses_compact.tsv.

    This avoids repeating long item texts/labels for large-N studies while keeping
    enough information for analysis and SVO verification.
    """
    if not responses_tsv:
        return

    lines = responses_tsv.splitlines()
    if not lines:
        return

    header = lines[0].split("\t")
    col_index = {name: i for i, name in enumerate(header)}

    def get(col: str, parts: List[str]) -> str:
        i = col_index.get(col)
        return parts[i] if (i is not None and i < len(parts)) else ""

    body_lines: List[str] = []
    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.split("\t")
        out_parts = [
            get("participantIndex", parts),
            get("sessionKey", parts),
            get("sessionId", parts),
            get("mode", parts),
            get("instrument", parts),
            get("item_id", parts),
            get("item_num", parts),
            get("presented_num", parts),
            get("raw_value", parts),
            get("scored_value", parts),
            get("rt_first_ms", parts),
            get("rt_last_ms", parts),
            get("svo_expected_you", parts),
            get("svo_expected_other", parts),
            get("svo_written_you_num", parts),
            get("svo_written_other_num", parts),
            get("svo_written_matches_expected", parts),
            get("extra", parts),
        ]
        body_lines.append("\t".join(out_parts))

    if not body_lines:
        return

    compact_path = os.path.join(out_dir, "responses_compact.tsv")
    compact_bak_path = os.path.join(bak_dir, "responses_compact.tsv")

    if not os.path.exists(compact_path):
        locked_append(compact_path, "\t".join(RESPONSES_COMPACT_HEADERS) + "\n")
    if not os.path.exists(compact_bak_path):
        locked_append(compact_bak_path, "\t".join(RESPONSES_COMPACT_HEADERS) + "\n")

    locked_append(compact_path, "\n".join(body_lines) + "\n")
    locked_append(compact_bak_path, "\n".join(body_lines) + "\n")

# ------------------------------------------------------------
# IPIP-120 presented order export (global, constant across subjects)
# ------------------------------------------------------------

IPIP120_ORDER_HEADERS = [
    "presented_index",
    "presented_num",
    "item_id",
    "original_item_num",
    "reverse_keyed",
    "item_text",
    "order_mode",
    "global_seed",
    "seed_salt",
    "seed",
    "renumber_display",
]


def maybe_write_ipip120_order(output: Dict[str, Any], group_dir: str, group_bak_dir: str) -> None:
    """Write a single study-level IPIP-120 order file.

    This is only written when:
      - IPIP-120 randomization is enabled
      - orderMode == 'global'

    It produces:
      output/group/ipip120_order.tsv

    The file is overwritten if called again (small, 120 rows).
    """

    # NOTE (v16): The front-end records deterministic presentation metadata
    # under meta.presentation.ipip120.
    # Earlier versions stored partial data under meta.randomization.ipip120.
    meta = output.get("meta") or {}
    pres = meta.get("presentation") or {}
    ipip_pres = pres.get("ipip120") or {}
    rand = meta.get("randomization") or {}
    ipip_rand = rand.get("ipip120") or {}

    if not isinstance(ipip_pres, dict):
        ipip_pres = {}
    if not isinstance(ipip_rand, dict):
        ipip_rand = {}

    enabled = bool(ipip_rand.get("enabled"))
    order_mode = str(ipip_pres.get("orderMode") or ipip_rand.get("orderMode") or "")
    randomized = bool(ipip_pres.get("randomized"))

    if not enabled:
        return

    # Only write a single global order if the study uses a fixed global seed.
    if order_mode != "global":
        return

    if not randomized:
        return

    responses = output.get("responses") or {}
    items = responses.get("ipip120") or []
    if not isinstance(items, list) or not items:
        return

    rows = []
    for it in items:
        if not isinstance(it, dict):
            continue
        rows.append({
            "presented_index": it.get("presentedIndex"),
            "presented_num": it.get("presentedNum"),
            "item_id": it.get("id"),
            "original_item_num": it.get("num"),
            "reverse_keyed": it.get("reverseKeyed"),
            "item_text": it.get("text"),
            "order_mode": order_mode,
            "global_seed": ipip_pres.get("globalSeed"),
            "seed_salt": ipip_pres.get("seedSalt"),
            "seed": ipip_pres.get("seed"),
            "renumber_display": ipip_pres.get("renumberDisplay"),
        })

    def k(r):
        try:
            return int(r.get("presented_index") or 0)
        except Exception:
            return 0

    rows.sort(key=k)

    path_main = os.path.join(group_dir, "ipip120_order.tsv")
    path_bak = os.path.join(group_bak_dir, "ipip120_order.tsv")

    write_tsv_table(path_main, IPIP120_ORDER_HEADERS, rows)
    write_tsv_table(path_bak, IPIP120_ORDER_HEADERS, rows)



class SurveyHandler(SimpleHTTPRequestHandler):
    """
    Static file server + /api/save.

    We deny web access to outputs so participants cannot download files.
    """

    # Make paths relative to survey root (we chdir into it in main()).

    def list_directory(self, path: str):
        # Disable directory listing
        self.send_error(404, "Not Found")
        return None

    def _send_json(self, obj: Dict[str, Any], status: int = 200) -> None:
        body = json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        # CORS: allow hosting the frontend on a different origin/proxy during deployment.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token")
        self.end_headers()
        self.wfile.write(body)

    def _handle_status(self) -> None:
        out_dir = os.environ.get("RIKEN_OUTPUT_DIR", "output")
        bak_dir = os.environ.get("RIKEN_BACKUP_DIR", "output_backup")

        out_abs = os.path.abspath(out_dir)
        bak_abs = os.path.abspath(bak_dir)

        out_ok, out_err = dir_writable(out_abs)
        bak_ok, bak_err = dir_writable(bak_abs)

        # Best-effort counts
        def count_sessions(root: str) -> int:
            try:
                p = os.path.join(root, "sessions")
                if not os.path.isdir(p):
                    return 0
                return len([d for d in os.listdir(p) if os.path.isdir(os.path.join(p, d))])
            except Exception:
                return 0

        last_save = tail_last_jsonl(os.path.join(out_abs, "save_log.jsonl"))

        self._send_json({
            "ok": True,
            "serverTime": now_iso(),
            "cwd": os.getcwd(),
            "outputDir": out_dir,
            "outputDirAbs": out_abs,
            "outputWritable": out_ok,
            "outputWritableError": out_err,
            "backupDir": bak_dir,
            "backupDirAbs": bak_abs,
            "backupWritable": bak_ok,
            "backupWritableError": bak_err,
            "sessionCount": count_sessions(out_abs),
            "lastSave": last_save,
        })


    # -------------------------
    # Runtime config endpoints
    # -------------------------

    def _send_bytes(self, b: bytes, content_type: str, filename: str | None = None, status: int = 200) -> None:
        # Send a binary response (used for file downloads).
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token")
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _handle_config_get(self) -> None:
        cfg = read_runtime_config()
        updated_at = None
        try:
            if os.path.exists(RUNTIME_CONFIG_PATH):
                updated_at = datetime.fromtimestamp(os.path.getmtime(RUNTIME_CONFIG_PATH), tz=timezone.utc).isoformat().replace("+00:00", "Z")
        except Exception:
            updated_at = None

        self._send_json({
            "ok": True,
            "config": cfg,
            "updatedAt": updated_at,
            "tokenRequired": bool(get_admin_token()),
        })

    def _handle_config_post(self, query: Dict[str, list[str]]) -> None:
        # Admin token check (if configured)
        if not is_admin_authorized(self.headers, query=query):
            self._send_json({"ok": False, "error": "forbidden"}, status=403)
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length > 0 else b""
        payload = safe_json_loads(raw)

        cfg = payload.get("config") if isinstance(payload, dict) else None
        if cfg is None and isinstance(payload, dict):
            cfg = payload
        if not isinstance(cfg, dict):
            self._send_json({"ok": False, "error": "invalid config"}, status=400)
            return

        ok, err = write_runtime_config(cfg)
        if not ok:
            self._send_json({"ok": False, "error": err or "write failed"}, status=500)
            return

        self._send_json({"ok": True, "saved": True, "updatedAt": now_iso()})

    def _handle_config_reset_post(self, query: Dict[str, list[str]]) -> None:
        if not is_admin_authorized(self.headers, query=query):
            self._send_json({"ok": False, "error": "forbidden"}, status=403)
            return

        ok, err = reset_runtime_config()
        if not ok:
            self._send_json({"ok": False, "error": err or "reset failed"}, status=500)
            return

        self._send_json({"ok": True, "reset": True, "updatedAt": now_iso()})

    # -------------------------
    # Export endpoints
    # -------------------------

    def _export_base_dir(self) -> str:
        return os.environ.get("RIKEN_OUTPUT_DIR", "output")

    def _list_export_files(self) -> List[Dict[str, Any]]:
        out_dir = self._export_base_dir()
        base_abs = os.path.abspath(out_dir)

        files: List[Dict[str, Any]] = []

        def add_from_dir(rel_dir: str) -> None:
            abs_dir = os.path.join(base_abs, rel_dir) if rel_dir else base_abs
            if not os.path.isdir(abs_dir):
                return
            for name in sorted(os.listdir(abs_dir)):
                abs_p = os.path.join(abs_dir, name)
                if os.path.isdir(abs_p):
                    continue
                if name.startswith("."):
                    continue
                if not (name.endswith(".tsv") or name.endswith(".csv") or name.endswith(".json") or name.endswith(".jsonl")):
                    continue
                rel_p = os.path.relpath(abs_p, base_abs)
                try:
                    st = os.stat(abs_p)
                    size = st.st_size
                    mtime = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat().replace("+00:00", "Z")
                except Exception:
                    size = None
                    mtime = None
                files.append({"path": rel_p.replace("\\", "/"), "size": size, "modifiedAt": mtime})

        # Small + useful exports by default:
        add_from_dir("")
        add_from_dir("group")

        # Remove noisy internal markers
        files = [f for f in files if not f["path"].startswith("_SERVER_STARTED")]
        # Sort group first, then root
        files.sort(key=lambda x: (0 if x["path"].startswith("group/") else 1, x["path"]))
        return files

    def _handle_export_list_get(self, query: Dict[str, list[str]]) -> None:
        if not is_admin_authorized(self.headers, query=query):
            self._send_json({"ok": False, "error": "forbidden"}, status=403)
            return
        out_dir = self._export_base_dir()
        self._send_json({
            "ok": True,
            "outputDir": out_dir,
            "outputDirAbs": os.path.abspath(out_dir),
            "files": self._list_export_files(),
        })

    def _safe_export_path(self, rel_path: str) -> str | None:
        # Prevent directory traversal
        rel_path = (rel_path or "").replace("\\", "/")
        if rel_path.startswith("/"):
            return None
        norm = os.path.normpath(rel_path)
        if norm.startswith(".."):
            return None
        out_dir = self._export_base_dir()
        base_abs = os.path.abspath(out_dir)
        abs_path = os.path.abspath(os.path.join(base_abs, norm))
        if not abs_path.startswith(base_abs + os.sep):
            return None
        if not os.path.isfile(abs_path):
            return None
        return abs_path

    def _handle_export_download_get(self, query: Dict[str, list[str]]) -> None:
        if not is_admin_authorized(self.headers, query=query):
            self._send_json({"ok": False, "error": "forbidden"}, status=403)
            return

        rel_path = (query.get("path") or [""])[0]
        abs_path = self._safe_export_path(rel_path)
        if not abs_path:
            self._send_json({"ok": False, "error": "not found"}, status=404)
            return

        try:
            with open(abs_path, "rb") as f:
                b = f.read()
        except Exception as e:
            self._send_json({"ok": False, "error": str(e)}, status=500)
            return

        name = os.path.basename(abs_path)
        if name.endswith(".tsv"):
            ctype = "text/tab-separated-values; charset=utf-8"
        elif name.endswith(".csv"):
            ctype = "text/csv; charset=utf-8"
        elif name.endswith(".json") or name.endswith(".jsonl"):
            ctype = "application/json; charset=utf-8"
        else:
            ctype = "application/octet-stream"

        self._send_bytes(b, ctype, filename=name, status=200)

    def _zip_bytes_for_scope(self, scope: str) -> Tuple[bytes, str]:
        out_dir = self._export_base_dir()
        base_abs = os.path.abspath(out_dir)

        if scope == "group":
            root_abs = os.path.join(base_abs, "group")
            arc_prefix = "group"
            zip_name = f"riken_group_outputs_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.zip"
        else:
            root_abs = base_abs
            arc_prefix = "output"
            zip_name = f"riken_all_outputs_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.zip"

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as z:
            if os.path.isdir(root_abs):
                for dirpath, _dirs, files in os.walk(root_abs):
                    for fn in files:
                        abs_p = os.path.join(dirpath, fn)
                        rel = os.path.relpath(abs_p, root_abs).replace("\\", "/")
                        arc = f"{arc_prefix}/{rel}" if arc_prefix else rel
                        z.write(abs_p, arcname=arc)
        return buf.getvalue(), zip_name

    def _handle_export_zip_get(self, query: Dict[str, list[str]]) -> None:
        if not is_admin_authorized(self.headers, query=query):
            self._send_json({"ok": False, "error": "forbidden"}, status=403)
            return

        scope = (query.get("scope") or ["group"])[0]
        scope = scope if scope in ("group", "all") else "group"

        try:
            b, name = self._zip_bytes_for_scope(scope)
        except Exception as e:
            self._send_json({"ok": False, "error": str(e)}, status=500)
            return

        self._send_bytes(b, "application/zip", filename=name, status=200)




    def do_GET(self) -> None:
        parsed = urlparse(self.path or "")
        p = (parsed.path or "").rstrip("/") or "/"
        query = parse_qs(parsed.query or "")

        # Diagnostics endpoints (for troubleshooting only)
        if p == "/api/status":
            self._handle_status()
            return
        if p == "/api/ping":
            self._send_json({"ok": True, "pong": True, "serverTime": now_iso()})
            return

        # Runtime config (read-only in the browser; writes are token-protected)
        if p == "/api/config":
            self._handle_config_get()
            return

        # Export endpoints (token-protected)
        if p == "/api/export/list":
            self._handle_export_list_get(query)
            return
        if p == "/api/export/download":
            self._handle_export_download_get(query)
            return
        if p == "/api/export/zip":
            self._handle_export_zip_get(query)
            return

        # Block access to server code and output folders
        if p.startswith("/output") or p.startswith("/output_backup") or p.startswith("/server"):
            self.send_error(404, "Not Found")
            return
        if p.endswith(".py") or p.endswith(".jsonl") or p.endswith(".tsv") or p.endswith(".zip"):
            # Conservative: do not serve raw data files even if placed elsewhere.
            self.send_error(404, "Not Found")
            return

        super().do_GET()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token")
        self.end_headers()

    def do_POST(self) -> None:
        parsed = urlparse(self.path or "")
        p = (parsed.path or "").rstrip("/") or "/"
        query = parse_qs(parsed.query or "")

        # Runtime config (admin-only writes)
        if p == "/api/config":
            self._handle_config_post(query)
            return
        if p == "/api/config/reset":
            self._handle_config_reset_post(query)
            return

        # Main save endpoint
        if p != "/api/save":
            self.send_error(404, "Not Found")
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length > 0 else b""
        payload = safe_json_loads(raw)

        output = payload.get("output") or {}
        if not isinstance(output, dict):
            output = {}

        meta = output.get("meta") or {}
        if not isinstance(meta, dict):
            meta = {}
            output["meta"] = meta
        else:
            # Ensure we can mutate meta in-place and have it reflected in `output`
            output["meta"] = meta

        session_id = safe_id(str(meta.get("sessionId") or "unknown"))
        mode = safe_id(str(meta.get("mode") or "unknown"))
        session_key = f"{session_id}__{mode}"

        server_received_at = now_iso()

        out_dir = os.environ.get("RIKEN_OUTPUT_DIR", "output")
        bak_dir = os.environ.get("RIKEN_BACKUP_DIR", "output_backup")

        # Ensure dirs exist
        ensure_dir(out_dir)
        ensure_dir(bak_dir)

        # --------------------------------------------------------------
        # Output structure (large-N friendly)
        # --------------------------------------------------------------
        # By default we do NOT create a per-session folder with multiple files
        # (too noisy for 800+ participants).
        #
        # Instead we always write ONE per-session raw JSON snapshot to:
        #   output/raw_sessions/<sessionKey>.json
        #
        # You can enable the older per-session directory snapshots (debug/dev) via:
        #   export RIKEN_WRITE_SESSION_DIR=1
        write_session_dir = str(os.environ.get("RIKEN_WRITE_SESSION_DIR", "0") or "0").strip().lower() in (
            "1",
            "true",
            "yes",
            "y",
        )

        raw_dir = os.path.join(out_dir, "raw_sessions")
        raw_bak_dir = os.path.join(bak_dir, "raw_sessions")
        ensure_dir(raw_dir)
        ensure_dir(raw_bak_dir)

        # Optional per-session snapshot dirs (dev/debug only)
        sess_dir = os.path.join(out_dir, "sessions", session_key)
        sess_bak_dir = os.path.join(bak_dir, "sessions", session_key)
        if write_session_dir:
            ensure_dir(sess_dir)
            ensure_dir(sess_bak_dir)

        # ------------------------------------------------------------------
        # Assign participantIndex (server-side; sequential per mode)
        # ------------------------------------------------------------------
        group_dir = os.path.join(out_dir, "group")
        group_bak_dir = os.path.join(bak_dir, "group")
        ensure_dir(group_dir)
        ensure_dir(group_bak_dir)

        lock_path = os.path.join(out_dir, ".write_lock")
        with FileLock(lock_path):
            participant_index = get_or_assign_participant_index(
                group_dir=group_dir,
                group_bak_dir=group_bak_dir,
                session_key=session_key,
                mode=mode,
                assigned_at=server_received_at,
            )

        # Persist in output JSON meta for downstream analysis
        meta["participantIndex"] = participant_index
        meta["sessionKey"] = session_key
        meta["serverReceivedAt"] = server_received_at

        
        # Prolific ID (used for cross-session syncing + file naming)
        prolific_raw = ""
        for k in ("prolificId", "prolificID", "prolific_id", "PROLIFIC_PID"):
            if k in meta and meta.get(k):
                prolific_raw = str(meta.get(k))
                break

        prolific_sanitized = safe_id(prolific_raw) if prolific_raw else ""
        prolific_id = prolific_sanitized or f"NO_PROLIFIC_ID_p{participant_index}"

        # Store back into meta (preserve raw if provided; otherwise store derived)
        meta["prolificId"] = prolific_raw or prolific_id

        # File key: prolificId first, then sessionKey
        file_key = f"{prolific_id}__{session_key}"

        # Ensure final dirs exist
        raw_final_dir = os.path.join(out_dir, "raw_final")
        raw_final_bak_dir = os.path.join(bak_dir, "raw_final")
        ensure_dir(raw_final_dir)
        ensure_dir(raw_final_bak_dir)

# Write per-session raw JSON snapshot (OVERWRITTEN on every autosave).
        # This includes incomplete sessions and is the primary "raw" record.
        try:
            json_bytes = json.dumps(output, ensure_ascii=False, indent=2).encode("utf-8")
            atomic_write(os.path.join(raw_dir, f"{file_key}.json"), json_bytes)
            atomic_write(os.path.join(raw_bak_dir, f"{file_key}.json"), json_bytes)

            # Optional dev/debug snapshot directory
            if write_session_dir:
                atomic_write(os.path.join(sess_dir, "latest.json"), json_bytes)
                atomic_write(os.path.join(sess_bak_dir, "latest.json"), json_bytes)
        except Exception as e:
            self._send_json({"ok": False, "error": f"json write failed: {e}"}, status=500)
            return

        
        # Write per-session TSV snapshots into raw_sessions (overwrite; best-effort)
        try:
            if responses_tsv:
                atomic_write(os.path.join(raw_dir, f"{file_key}_responses.tsv"), responses_tsv.encode("utf-8"))
                atomic_write(os.path.join(raw_bak_dir, f"{file_key}_responses.tsv"), responses_tsv.encode("utf-8"))
            if scores_tsv:
                atomic_write(os.path.join(raw_dir, f"{file_key}_scores.tsv"), scores_tsv.encode("utf-8"))
                atomic_write(os.path.join(raw_bak_dir, f"{file_key}_scores.tsv"), scores_tsv.encode("utf-8"))
        except Exception:
            pass

        # Write immutable FINAL copies (never overwritten) for completed sessions only
        try:
            completed_at = meta.get("completedAt") or ""
            terminated_reason = meta.get("terminatedReason") or ""
            if completed_at and not terminated_reason:
                ts = server_received_at.replace(":", "-").replace(".", "-")
                final_key = f"{file_key}__final__{ts}"
                atomic_write(os.path.join(raw_final_dir, f"{final_key}.json"), json_bytes)
                atomic_write(os.path.join(raw_final_bak_dir, f"{final_key}.json"), json_bytes)
                if responses_tsv:
                    atomic_write(os.path.join(raw_final_dir, f"{final_key}_responses.tsv"), responses_tsv.encode("utf-8"))
                    atomic_write(os.path.join(raw_final_bak_dir, f"{final_key}_responses.tsv"), responses_tsv.encode("utf-8"))
                if scores_tsv:
                    atomic_write(os.path.join(raw_final_dir, f"{final_key}_scores.tsv"), scores_tsv.encode("utf-8"))
                    atomic_write(os.path.join(raw_final_bak_dir, f"{final_key}_scores.tsv"), scores_tsv.encode("utf-8"))
        except Exception:
            pass

        # Kick off tidy regeneration (non-blocking; best-effort)
        try:
            import subprocess
            script = os.path.join(os.path.dirname(__file__), "..", "tools", "autogen_tidy.py")
            subprocess.Popen(
                [os.environ.get("RIKEN_PYTHON", "python3"), script],
                cwd=os.path.join(os.path.dirname(__file__), ".."),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        except Exception:
            pass

# Write latest TSV snapshots (overwrite; best-effort)
        tsv_obj = payload.get("tsv") or {}
        if not isinstance(tsv_obj, dict):
            tsv_obj = {}
        responses_tsv = tsv_obj.get("responses") or ""
        scores_tsv = tsv_obj.get("scores") or ""

        # Ensure participantIndex + sessionKey exist in TSVs (server is source of truth)
        if responses_tsv:
            responses_tsv = inject_tsv_columns(
                responses_tsv, {"participantIndex": participant_index, "sessionKey": session_key}
            )
        if scores_tsv:
            scores_tsv = inject_tsv_columns(
                scores_tsv, {"participantIndex": participant_index, "sessionKey": session_key}
            )

        if write_session_dir:
            try:
                if responses_tsv:
                    atomic_write(os.path.join(sess_dir, "latest_responses.tsv"), responses_tsv.encode("utf-8"))
                    atomic_write(os.path.join(sess_bak_dir, "latest_responses.tsv"), responses_tsv.encode("utf-8"))
                if scores_tsv:
                    atomic_write(os.path.join(sess_dir, "latest_scores.tsv"), scores_tsv.encode("utf-8"))
                    atomic_write(os.path.join(sess_bak_dir, "latest_scores.tsv"), scores_tsv.encode("utf-8"))
            except Exception:
                pass

        # ------------------------------------------------------------------
        # Group-level "latest" files (includes incomplete sessions)
        # ------------------------------------------------------------------
        group_dir = os.path.join(out_dir, "group")
        group_bak_dir = os.path.join(bak_dir, "group")
        ensure_dir(group_dir)
        ensure_dir(group_bak_dir)

        manifest_row = {
            "serverReceivedAt": server_received_at,
            "sessionKey": session_key,
            "participantIndex": meta.get("participantIndex"),
            "sessionId": meta.get("sessionId"),
            "mode": meta.get("mode"),
            "status": session_status(meta),
            "startedAt": meta.get("startedAt"),
            "lastAutosaveAt": meta.get("lastAutosaveAt"),
            "autosaveSeq": meta.get("autosaveSeq"),
            "completedAt": meta.get("completedAt"),
            "terminatedReason": meta.get("terminatedReason"),
            "flow_order": ",".join((meta.get("flow") or {}).get("order") or []) if isinstance(meta.get("flow"), dict) else None,
            "flow_source": (meta.get("flow") or {}).get("source") if isinstance(meta.get("flow"), dict) else None,
            "flow_enable_math": (meta.get("flow") or {}).get("enableMathChecks") if isinstance(meta.get("flow"), dict) else None,

            # Primary per-session raw outputs
            "rawJson": f"raw_sessions/{session_key}.json",
            "rawWideTsv": f"raw_sessions/{session_key}_wide.tsv",
            "rawWideCsv": f"raw_sessions/{session_key}_wide.csv",

            # Optional dev/debug per-session snapshot directory (may be blank)
            "sessionDir": f"sessions/{session_key}" if write_session_dir else "",
            "latestJson": f"sessions/{session_key}/latest.json" if write_session_dir else "",
            "latestResponsesTsv": f"sessions/{session_key}/latest_responses.tsv" if write_session_dir else "",
            "latestScoresTsv": f"sessions/{session_key}/latest_scores.tsv" if write_session_dir else "",
            "latestParticipantTsv": f"sessions/{session_key}/latest_participant.tsv" if write_session_dir else "",
            "latestScoresWideTsv": f"sessions/{session_key}/latest_scores_wide.tsv" if write_session_dir else "",
            "final": bool(meta.get("final")),
            "error": None,
        }

        MANIFEST_HEADERS = [
            "serverReceivedAt",
            "sessionKey",
            "participantIndex",
            "sessionId",
            "mode",
            "status",
            "final",
            "autosaveSeq",
            "lastAutosaveAt",
            "startedAt",
            "completedAt",
            "terminatedReason",
            "flow_order",
            "flow_source",
            "flow_enable_math",

            "rawJson",
            "rawWideTsv",
            "rawWideCsv",

            "sessionDir",
            "latestJson",
            "latestResponsesTsv",
            "latestScoresTsv",
            "latestParticipantTsv",
            "latestScoresWideTsv",
            "error",
        ]

        # Use a single lock for the multi-step read-modify-write operations.
        lock_path = os.path.join(out_dir, ".write_lock")
        with FileLock(lock_path):
            # sessions_manifest.tsv (one row per session, updated)
            update_latest_table(
                path=os.path.join(group_dir, "sessions_manifest.tsv"),
                bak_path=os.path.join(group_bak_dir, "sessions_manifest.tsv"),
                key_col="sessionKey",
                new_row=manifest_row,
                preferred_header=MANIFEST_HEADERS,
                sort_col="serverReceivedAt",
            )

            # participants_latest.tsv (wide; includes demographics & QC summary)
            p_headers, p_row = build_participants_row(output, server_received_at, session_key=session_key)
            update_latest_table(
                path=os.path.join(group_dir, "participants_latest.tsv"),
                bak_path=os.path.join(group_bak_dir, "participants_latest.tsv"),
                key_col="sessionKey",
                new_row=p_row,
                preferred_header=p_headers,
                sort_col="serverReceivedAt",
            )

            # Optional per-session convenience snapshots (dev/debug only)
            if write_session_dir:
                try:
                    write_tsv_table(os.path.join(sess_dir, "latest_participant.tsv"), p_headers, [p_row])
                    write_tsv_table(os.path.join(sess_bak_dir, "latest_participant.tsv"), p_headers, [p_row])
                except Exception:
                    pass

            # scores_wide_latest.tsv (wide; includes partial scores for in-progress sessions)
            w_headers, w_row = flatten_scores_wide(output, server_received_at, session_key=session_key)
            update_latest_table(
                path=os.path.join(group_dir, "scores_wide_latest.tsv"),
                bak_path=os.path.join(group_bak_dir, "scores_wide_latest.tsv"),
                key_col="sessionKey",
                new_row=w_row,
                preferred_header=w_headers,
                sort_col="serverReceivedAt",
            )

            # Optional per-session wide score snapshot (dev/debug only)
            if write_session_dir:
                try:
                    write_tsv_table(os.path.join(sess_dir, "latest_scores_wide.tsv"), w_headers, [w_row])
                    write_tsv_table(os.path.join(sess_bak_dir, "latest_scores_wide.tsv"), w_headers, [w_row])
                except Exception:
                    pass

            # --- MFQ scores (foundation means + composites) ---
            # Grouping/clustering should be done OFFLINE after Session 1 completes.
            try:
                mfq_headers, mfq_row = flatten_mfq_scores(output, server_received_at, session_key=session_key)
                update_latest_table(
                    path=os.path.join(group_dir, "mfq_scores_latest.tsv"),
                    bak_path=os.path.join(group_bak_dir, "mfq_scores_latest.tsv"),
                    key_col="sessionKey",
                    new_row=mfq_row,
                    preferred_header=mfq_headers,
                    sort_col="serverReceivedAt",
                )

                # Optional per-session convenience snapshot (dev/debug only)
                if write_session_dir:
                    write_tsv_table(os.path.join(sess_dir, "latest_mfq_scores.tsv"), mfq_headers, [mfq_row])
                    write_tsv_table(os.path.join(sess_bak_dir, "latest_mfq_scores.tsv"), mfq_headers, [mfq_row])
            except Exception:
                pass

            # --- Math checks metrics export (small; QC-friendly) ---
            try:
                m_headers, m_row = flatten_math_checks_metrics(output, server_received_at, session_key=session_key)
                update_latest_table(
                    path=os.path.join(group_dir, "math_checks_metrics_latest.tsv"),
                    bak_path=os.path.join(group_bak_dir, "math_checks_metrics_latest.tsv"),
                    key_col="sessionKey",
                    new_row=m_row,
                    preferred_header=m_headers,
                    sort_col="serverReceivedAt",
                )

                # Optional per-session convenience snapshot (dev/debug only)
                if write_session_dir:
                    write_tsv_table(os.path.join(sess_dir, "latest_math_checks_metrics.tsv"), m_headers, [m_row])
                    write_tsv_table(os.path.join(sess_bak_dir, "latest_math_checks_metrics.tsv"), m_headers, [m_row])
            except Exception:
                pass

            

            # IPIP-120 presented order (study-level).
            # When orderMode == 'global' this should be identical for every subject.
            # We write this file so you can audit the exact order used.
            try:
                maybe_write_ipip120_order(output, group_dir, group_bak_dir)
            except Exception:
                pass

            # Save log (append-only) for every autosave (includes incomplete)
            log_obj = {
                "ts": server_received_at,
                "sessionId": session_id,
                "mode": mode,
                "sessionKey": session_key,
                "participantIndex": meta.get("participantIndex"),
                "status": session_status(meta),
                "final": is_final_output(output),
                "autosaveSeq": meta.get("autosaveSeq"),
                "lastAutosaveAt": meta.get("lastAutosaveAt"),
            }
            locked_append(os.path.join(out_dir, "save_log.jsonl"), json.dumps(log_obj, ensure_ascii=False) + "\n")
            locked_append(os.path.join(bak_dir, "save_log.jsonl"), json.dumps(log_obj, ensure_ascii=False) + "\n")

        # Append-only exports when a session is FINAL (completed or terminated) — once per session_key.
        appended = False
        if is_final_output(output):
            flag = os.path.join(out_dir, "finalized", f"{session_key}.done")
            flag_bak = os.path.join(bak_dir, "finalized", f"{session_key}.done")

            if try_create_flag(flag):
                try_create_flag(flag_bak)

                appended = True

                # 1) participants.tsv
                p_headers, p_row = build_participants_row(output, server_received_at, session_key=session_key)
                participants_path = os.path.join(out_dir, "participants.tsv")
                participants_bak_path = os.path.join(bak_dir, "participants.tsv")

                if not os.path.exists(participants_path):
                    locked_append(participants_path, "\t".join(p_headers) + "\n")
                if not os.path.exists(participants_bak_path):
                    locked_append(participants_bak_path, "\t".join(p_headers) + "\n")

                locked_append(participants_path, to_tsv_line(p_headers, p_row))
                locked_append(participants_bak_path, to_tsv_line(p_headers, p_row))

                # CSV mirror (participants.csv)
                # Useful for quick inspection in spreadsheet tools.
                try:
                    participants_csv_path = os.path.join(out_dir, "participants.csv")
                    participants_csv_bak_path = os.path.join(bak_dir, "participants.csv")
                    if not os.path.exists(participants_csv_path):
                        write_csv_table(participants_csv_path, p_headers, [])
                    if not os.path.exists(participants_csv_bak_path):
                        write_csv_table(participants_csv_bak_path, p_headers, [])
                    locked_append(participants_csv_path, to_csv_line(p_headers, p_row))
                    locked_append(participants_csv_bak_path, to_csv_line(p_headers, p_row))
                except Exception:
                    pass

                # 2) responses_long.tsv (append rows, header once)
                if responses_tsv:
                    r_lines = responses_tsv.splitlines()
                    if r_lines:
                        r_header = r_lines[0].strip("\n")
                        r_body = "\n".join(r_lines[1:]).strip("\n")
                        if r_body:
                            responses_path = os.path.join(out_dir, "responses_long.tsv")
                            responses_bak_path = os.path.join(bak_dir, "responses_long.tsv")

                            if not os.path.exists(responses_path):
                                locked_append(responses_path, r_header + "\n")
                            if not os.path.exists(responses_bak_path):
                                locked_append(responses_bak_path, r_header + "\n")

                            locked_append(responses_path, r_body + "\n")
                            locked_append(responses_bak_path, r_body + "\n")

                            # CSV mirror (responses_long.csv)
                            # NOTE: This file can become large (many rows). TSV is the primary format,
                            # but CSV is convenient for some spreadsheet workflows.
                            try:
                                r_cols = r_header.split("\t")
                                r_csv_path = os.path.join(out_dir, "responses_long.csv")
                                r_csv_bak_path = os.path.join(bak_dir, "responses_long.csv")
                                if not os.path.exists(r_csv_path):
                                    write_csv_table(r_csv_path, r_cols, [])
                                if not os.path.exists(r_csv_bak_path):
                                    write_csv_table(r_csv_bak_path, r_cols, [])

                                buf = io.StringIO()
                                writer = csv.writer(buf, lineterminator="\n")
                                for tsv_line in r_body.splitlines():
                                    if not tsv_line.strip():
                                        continue
                                    writer.writerow(tsv_line.split("\t"))
                                csv_block = buf.getvalue()
                                if csv_block:
                                    locked_append(r_csv_path, csv_block)
                                    locked_append(r_csv_bak_path, csv_block)
                            except Exception:
                                pass

                # 2b) responses_compact.tsv (subset of columns for large-N)
                try:
                    append_responses_compact(responses_tsv, out_dir, bak_dir)
                except Exception:
                    pass

                # 3) scores_long.tsv
                if scores_tsv:
                    s_lines = scores_tsv.splitlines()
                    if s_lines:
                        s_header = s_lines[0].strip("\n")
                        s_body = "\n".join(s_lines[1:]).strip("\n")
                        if s_body:
                            scores_path = os.path.join(out_dir, "scores_long.tsv")
                            scores_bak_path = os.path.join(bak_dir, "scores_long.tsv")

                            if not os.path.exists(scores_path):
                                locked_append(scores_path, s_header + "\n")
                            if not os.path.exists(scores_bak_path):
                                locked_append(scores_bak_path, s_header + "\n")

                            locked_append(scores_path, s_body + "\n")
                            locked_append(scores_bak_path, s_body + "\n")

                # 4) scores_wide.tsv
                w_headers, w_row = flatten_scores_wide(output, server_received_at, session_key=session_key)
                wide_path = os.path.join(out_dir, "scores_wide.tsv")
                wide_bak_path = os.path.join(bak_dir, "scores_wide.tsv")

                if not os.path.exists(wide_path):
                    locked_append(wide_path, "\t".join(w_headers) + "\n")
                if not os.path.exists(wide_bak_path):
                    locked_append(wide_bak_path, "\t".join(w_headers) + "\n")

                locked_append(wide_path, to_tsv_line(w_headers, w_row))
                locked_append(wide_bak_path, to_tsv_line(w_headers, w_row))

                # 4b) mfq_session2.tsv / mfq_session2.csv (ready for Session 2 import)
                try:
                    mfq2_headers, mfq2_row = flatten_mfq_session2(output, server_received_at, session_key=session_key)
                    mfq2_tsv_path = os.path.join(out_dir, "mfq_session2.tsv")
                    mfq2_tsv_bak_path = os.path.join(bak_dir, "mfq_session2.tsv")

                    if not os.path.exists(mfq2_tsv_path):
                        locked_append(mfq2_tsv_path, "\t".join(mfq2_headers) + "\n")
                    if not os.path.exists(mfq2_tsv_bak_path):
                        locked_append(mfq2_tsv_bak_path, "\t".join(mfq2_headers) + "\n")

                    locked_append(mfq2_tsv_path, to_tsv_line(mfq2_headers, mfq2_row))
                    locked_append(mfq2_tsv_bak_path, to_tsv_line(mfq2_headers, mfq2_row))

                    # CSV version (convenient for the Moral Foundations game repo scripts)
                    mfq2_csv_path = os.path.join(out_dir, "mfq_session2.csv")
                    mfq2_csv_bak_path = os.path.join(bak_dir, "mfq_session2.csv")
                    if not os.path.exists(mfq2_csv_path):
                        write_csv_table(mfq2_csv_path, mfq2_headers, [])
                    if not os.path.exists(mfq2_csv_bak_path):
                        write_csv_table(mfq2_csv_bak_path, mfq2_headers, [])
                    locked_append(mfq2_csv_path, to_csv_line(mfq2_headers, mfq2_row))
                    locked_append(mfq2_csv_bak_path, to_csv_line(mfq2_headers, mfq2_row))
                except Exception:
                    pass

                # 4c) math_checks_metrics.tsv (summary + per-check QC metrics)
                try:
                    m_headers, m_row = flatten_math_checks_metrics(output, server_received_at, session_key=session_key)
                    m_path = os.path.join(out_dir, "math_checks_metrics.tsv")
                    m_bak_path = os.path.join(bak_dir, "math_checks_metrics.tsv")
                    if not os.path.exists(m_path):
                        locked_append(m_path, "\t".join(m_headers) + "\n")
                    if not os.path.exists(m_bak_path):
                        locked_append(m_bak_path, "\t".join(m_headers) + "\n")
                    locked_append(m_path, to_tsv_line(m_headers, m_row))
                    locked_append(m_bak_path, to_tsv_line(m_headers, m_row))
                except Exception:
                    pass

                # 4d) all_data_wide.tsv (ONE row per participant/session with ALL responses + ALL scores)
                try:
                    a_headers, a_row = flatten_all_data_wide(output, server_received_at, session_key=session_key)
                    a_path = os.path.join(out_dir, "all_data_wide.tsv")
                    a_bak_path = os.path.join(bak_dir, "all_data_wide.tsv")
                    if not os.path.exists(a_path):
                        locked_append(a_path, "\t".join(a_headers) + "\n")
                    if not os.path.exists(a_bak_path):
                        locked_append(a_bak_path, "\t".join(a_headers) + "\n")
                    locked_append(a_path, to_tsv_line(a_headers, a_row))
                    locked_append(a_bak_path, to_tsv_line(a_headers, a_row))
                except Exception:
                    pass

                # 5) item_dictionary.tsv (write once; helps compact exports)
                try:
                    maybe_write_item_dictionary(output, out_dir, bak_dir)
                except Exception:
                    pass

        # Always respond OK (if we got here)
        self._send_json({"ok": True, "sessionId": session_id, "mode": mode, "sessionKey": session_key, "participantIndex": meta.get("participantIndex"), "receivedAt": server_received_at, "appendedFinal": appended})


def main() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    survey_root = os.path.abspath(os.path.join(here, ".."))
    os.chdir(survey_root)

    host = os.environ.get("RIKEN_HOST", "0.0.0.0")
    port = int(os.environ.get("RIKEN_PORT", "8000"))

    out_dir = os.environ.get("RIKEN_OUTPUT_DIR", "output")
    bak_dir = os.environ.get("RIKEN_BACKUP_DIR", "output_backup")

    out_abs = os.path.abspath(out_dir)
    bak_abs = os.path.abspath(bak_dir)

    out_ok, out_err = dir_writable(out_abs)
    bak_ok, bak_err = dir_writable(bak_abs)

    if not out_ok or not bak_ok:
        print("\nERROR: Output directories are not writable.")
        print(f"  output: {out_abs}  writable={out_ok}  err={out_err}")
        print(f"  backup: {bak_abs}  writable={bak_ok}  err={bak_err}")
        print("Fix permissions (chmod/chown) or set RIKEN_OUTPUT_DIR / RIKEN_BACKUP_DIR.")
        raise SystemExit(1)

    # Write a small startup marker so you can confirm the server can write to disk.
    try:
        atomic_write(os.path.join(out_dir, "_SERVER_STARTED.txt"), f"startedAt\t{now_iso()}\n".encode("utf-8"))
        atomic_write(os.path.join(bak_dir, "_SERVER_STARTED.txt"), f"startedAt\t{now_iso()}\n".encode("utf-8"))
    except Exception:
        pass

    # Write/refresh the data dictionary at server start.
    # This is safe to overwrite because it describes the *schema* of outputs.
    try:
        write_data_dictionary(out_dir=out_dir, bak_dir=bak_dir, survey_root=survey_root)
    except Exception:
        pass

    httpd = ThreadingHTTPServer((host, port), SurveyHandler)
    print(f"Serving RIKEN survey from: {survey_root}")
    print(f"Open: http://localhost:{port}/")
    print(f"Autosaving to: {out_abs}/ and backup to {bak_abs}/")
    if get_admin_token() and _ADMIN_TOKEN_AUTO:
        print(f"Admin token (auto-generated): {get_admin_token()}")
        print("  - Enter this token in launcher.html to save settings / download exports")
        print("  - To set a fixed token: export RIKEN_ADMIN_TOKEN=...")
        print("  - To disable token (NOT recommended): export RIKEN_ADMIN_TOKEN=")

    print(f"Health check: http://localhost:{port}/api/status")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down")
        httpd.server_close()


if __name__ == "__main__":
    main()

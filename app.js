/* ============================================================
   RIKEN Questionnaire (SPA, paper-pencil styling) - v13
   ----------------------------------------------------
   Fixes / additions:
   - Fixes "Next" failures when localStorage is blocked by wrapping
     all storage operations in try/catch.
   - Adds deterministic arithmetic "Calculation Check" pages between
     questionnaires, timed from focus -> Enter.
   - Autosaves state to localStorage and also caches the latest
     full output (JSON + TSV) in localStorage.
   - Sends autosave snapshots to the server in the background
     (POST /api/save) when enabled in config.js.
   - Scoring is transparent:
       - per-item raw + scored values (incl. reverse scoring)
       - scale score summaries + item lists used for each score

   v5+ changes:
   - Adds an optional "launcher" menu page (launcher.html) to choose
     Trial vs Production (easy to remove for final deployment).
   - Randomizes the IPIP-NEO-120 *presentation order* deterministically
     and (by default) keeps that randomized order CONSTANT across all
     subjects (global seed), while keeping item IDs/scoring stable.
   - Production navigation is "Next" only (no Previous button).

   To modify questions/scales:
   - Edit files in ./data/
   - Reload index.html

   IMPORTANT: Keep item wording EXACT when modifying established
   instruments.

   ============================================================ */

(function () {
  "use strict";

  /* =========================
     CONFIG
     ========================= */

  // NOTE: Versioned keys to avoid collisions with earlier builds.
  // If you deploy a new version, bump this and previous sessions won't
  // be resumed accidentally from old browser storage.
  // Increment this when you make output/schema changes.
  // It is used for localStorage key versioning (so old drafts don't collide).
  // Build version used for localStorage key versioning.
  // Bump this when you make output/schema or autosave logic changes.
  // (Also helps ensure old local drafts don't interfere with new builds.)
  // Increment this when you make output/schema changes.
  // v16: adds prolificId to outputs (participant syncing across sessions)
  //      and changes default questionnaire order.
  const BUILD_VERSION = 16;
  const STORAGE_KEYS = {
    STATE: `riken_questionnaire_state_v${BUILD_VERSION}`,
    STATE_BACKUP: `riken_questionnaire_state_backup_v${BUILD_VERSION}`,

    // Local output cache (for resilience if server saving is interrupted).
    OUTPUT_JSON: `riken_questionnaire_output_json_v${BUILD_VERSION}`,
    OUTPUT_TSV_RESPONSES: `riken_questionnaire_output_responses_tsv_v${BUILD_VERSION}`,
    OUTPUT_TSV_SCORES: `riken_questionnaire_output_scores_tsv_v${BUILD_VERSION}`
  };

  // App config override (loaded from config.js)
  const USER_CFG = window.RIKEN_APP_CONFIG || {};
  const URL_PARAMS = new URLSearchParams(window.location.search || "");

  // Prolific integration
  // -------------------
  // Prolific passes three IDs via URL params:
  //   PROLIFIC_PID  — participant ID
  //   STUDY_ID      — study ID
  //   SESSION_ID    — Prolific session ID (not our internal sessionId)
  const URL_PROLIFIC_ID = (() => {
    const keys = ["PROLIFIC_PID", "prolific_pid", "prolificId", "prolific_id", "pid"];
    for (const k of keys) {
      const v = String(URL_PARAMS.get(k) || "").trim();
      if (v) return v;
    }
    return "";
  })();
  const URL_STUDY_ID = String(URL_PARAMS.get("STUDY_ID") || URL_PARAMS.get("study_id") || "").trim();
  const URL_SESSION_ID = String(URL_PARAMS.get("SESSION_ID") || URL_PARAMS.get("session_id") || "").trim();

  // Admin-only URL toggles (used from launcher.html; not shown to respondents)
  // Examples:
  //   index.html?admin=1&fresh=1&autofill=1&finish=1&autoSpeed=20
  const ADMIN_MODE = String(URL_PARAMS.get("admin") || "").trim() === "1";
  const ADMIN_FRESH = ADMIN_MODE && String(URL_PARAMS.get("fresh") || "").trim() === "1";
  const ADMIN_AUTOFILL = ADMIN_MODE && String(URL_PARAMS.get("autofill") || "").trim() === "1";
  const ADMIN_AUTOFILL_FINISH = ADMIN_MODE && String(URL_PARAMS.get("finish") || "").trim() === "1";
  const ADMIN_AUTOFILL_SPEED_MS = (() => {
    const raw = String(URL_PARAMS.get("autoSpeed") || "").trim();
    const n = Number.parseInt(raw || "35", 10);
    return Number.isFinite(n) ? Math.max(0, Math.min(2000, n)) : 35;
  })();

  const urlModeRaw = String(URL_PARAMS.get("mode") || "").toLowerCase();
  const urlMode = urlModeRaw === "trial" ? "trial" : "prod";
  const MODE = (USER_CFG.forceMode === "trial" || USER_CFG.forceMode === "prod")
    ? USER_CFG.forceMode
    : urlMode;

  const IS_TRIAL = MODE === "trial";

  // Extra troubleshooting tools (researchers only)
  const DEBUG_MODE = IS_TRIAL && (
    String(URL_PARAMS.get("debug") || "").trim() === "1" ||
    String(URL_PARAMS.get("debug") || "").trim().toLowerCase() === "true" ||
    USER_CFG.debug === true
  );

  /* -------------------------
     API base (autosave endpoint)
     -------------------------
     By default the app posts to a same-origin endpoint (e.g. /api/save).

     Common causes of 'Failed to fetch':
       - Opening index.html via file:// (no origin).
       - Serving the frontend from a different host/port than the backend.
       - Using localhost from a different computer than the server.

     Fixes:
       - Serve the app from the included server (recommended).
       - Or pass ?apiBase=http://HOST:PORT to force the backend base URL.

     Examples:
       - http://localhost:8000/?mode=trial&debug=1
       - file:///.../index.html?apiBase=http://localhost:8000
       - http://SERVER:8000/?apiBase=http://SERVER:8000
  */

  const apiBaseFromUrl = String(URL_PARAMS.get("apiBase") || "").trim();
  const apiBaseFromCfg = (USER_CFG.serverSave && USER_CFG.serverSave.apiBase) ? String(USER_CFG.serverSave.apiBase).trim() : "";

  const API_BASE = (apiBaseFromUrl || apiBaseFromCfg)
    ? (apiBaseFromUrl || apiBaseFromCfg).replace(/\/+$/, "")
    : null;

  function resolveApiUrl(pathOrUrl) {
    const s = String(pathOrUrl || "");
    if (!s) return s;
    if (s.startsWith('http://') || s.startsWith('https://')) return s;

    // If user provided an explicit API base, use it.
    if (API_BASE) {
      const path = s.startsWith('/') ? s : '/' + s;
      return API_BASE + path;
    }

    // If the page was opened via file://, default to localhost backend for testing.
    if (window.location && window.location.protocol === 'file:') {
      const path = s.startsWith('/') ? s : '/' + s;
      return 'http://localhost:8000' + path;
    }

    // Same-origin (recommended).
    return s;
  }

  /* -------------------------
     Flow / order (launcher)
     -------------------------
     The launcher can pass:
       index.html?mode=prod&order=hexaco100,ipip120,mfq30,d70,svo&math=1

     Consent/Age is always first; Demographics is always last.
  */

  const FLOW_ALLOWED = (USER_CFG.flow && Array.isArray(USER_CFG.flow.allowedBlocks))
    ? USER_CFG.flow.allowedBlocks.map(String)
    : ["mfq30", "hexaco100", "svo", "ipip120", "d70"];

  // Default questionnaire order (participant-facing):
  // MFQ -> HEXACO -> SVO -> others
  const FLOW_DEFAULT = (USER_CFG.flow && Array.isArray(USER_CFG.flow.defaultOrder))
    ? USER_CFG.flow.defaultOrder.map(String)
    : ["mfq30", "hexaco100", "svo", "ipip120", "d70"];

  function normalizeFlowOrder(list) {
    const out = [];
    const seen = new Set();
    for (const raw of (Array.isArray(list) ? list : [])) {
      const id = String(raw).trim();
      if (!id) continue;
      if (!FLOW_ALLOWED.includes(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    // Append any missing allowed blocks to avoid accidental omission.
    for (const id of FLOW_ALLOWED) {
      if (!seen.has(id)) out.push(id);
    }
    return out;
  }

  const allowUrlOrderOverride = (USER_CFG.flow && typeof USER_CFG.flow.allowUrlOrderOverride === "boolean")
    ? USER_CFG.flow.allowUrlOrderOverride
    : true;

  const urlOrderRaw = String(URL_PARAMS.get("order") || "").trim();
  const urlOrderList = urlOrderRaw ? urlOrderRaw.split(",").map((s) => String(s).trim()) : null;

  const flowOrder = normalizeFlowOrder(
    (allowUrlOrderOverride && urlOrderList && urlOrderList.length) ? urlOrderList : FLOW_DEFAULT
  );

  // Math checks can be toggled via the launcher (math=0/1). Default is true.
  const cfgMathEnabled = (USER_CFG.flow && typeof USER_CFG.flow.enableMathChecks === "boolean")
    ? USER_CFG.flow.enableMathChecks
    : true;
  const urlMathRaw = String(URL_PARAMS.get("math") || "").trim();
  const enableMathChecks = (urlMathRaw === "0") ? false : (urlMathRaw === "1") ? true : cfgMathEnabled;

  // SVO strict matching (trial requested)
  const enforceSvoWrittenMatchInTrial = (USER_CFG.svo && typeof USER_CFG.svo.enforceWrittenMatchInTrial === "boolean")
    ? USER_CFG.svo.enforceWrittenMatchInTrial
    : true;
  const enforceSvoWrittenMatchInProd = (USER_CFG.svo && typeof USER_CFG.svo.enforceWrittenMatchInProd === "boolean")
    ? USER_CFG.svo.enforceWrittenMatchInProd
    : true;
  const enforceSvoWrittenMatch = IS_TRIAL ? enforceSvoWrittenMatchInTrial : enforceSvoWrittenMatchInProd;

  const CONFIG = {
    mode: MODE,
    allowSkip: IS_TRIAL ? (USER_CFG.allowSkipInTrial !== false) : false,
    progressMode: IS_TRIAL
      ? (USER_CFG.progressModeTrial || "answered")
      : (USER_CFG.progressModeProd || "pages"),

    // UI / navigation
    ui: {
      // IMPORTANT: participant-facing production mode should be "Next" only.
      // In trial mode we keep Previous enabled for easier debugging.
      showPrev: IS_TRIAL
        ? (USER_CFG.ui && typeof USER_CFG.ui.showPrevInTrial === "boolean" ? USER_CFG.ui.showPrevInTrial : true)
        : (USER_CFG.ui && typeof USER_CFG.ui.showPrevInProd === "boolean" ? USER_CFG.ui.showPrevInProd : false)
    },

    // Randomization settings
    // ----------------------
    // Requested change (2026-01): IPIP-NEO-120 must be randomized but the
    // randomized order must be CONSTANT across all subjects.
    //
    // We support both modes:
    //   - orderMode: 'global'   → same deterministic order for everyone
    //   - orderMode: 'perSession' → deterministic order depends on sessionId
    randomization: {
      ipip120: {
        // Default: enabled (requested)
        enabled: (USER_CFG.randomization && typeof USER_CFG.randomization.ipip120Enabled === "boolean")
          ? USER_CFG.randomization.ipip120Enabled
          : true,
        // Which strategy to use.
        // Default: 'global' (same order for all participants).
        orderMode: (USER_CFG.randomization && USER_CFG.randomization.ipip120OrderMode)
          ? String(USER_CFG.randomization.ipip120OrderMode)
          : "global",

        // Used when orderMode === 'global'
        // Change this string if you want a DIFFERENT global randomized order.
        globalSeed: (USER_CFG.randomization && USER_CFG.randomization.ipip120GlobalSeed)
          ? String(USER_CFG.randomization.ipip120GlobalSeed)
          : "ipip120_global_v1",

        // Used when orderMode === 'perSession'
        // Change this salt if you want a new order for the same sessionId.
        seedSalt: (USER_CFG.randomization && USER_CFG.randomization.ipip120SeedSalt)
          ? String(USER_CFG.randomization.ipip120SeedSalt)
          : "ipip120_v1",
        // Renumber items 1..N in the *displayed* order (recommended so
        // randomized presentation doesn't show out-of-order numbers).
        renumberDisplay: (USER_CFG.randomization && typeof USER_CFG.randomization.ipip120RenumberDisplay === "boolean")
          ? USER_CFG.randomization.ipip120RenumberDisplay
          : true
      }
    },

    // Questionnaire order / flow (used by buildPages)
    flow: {
      allowedBlocks: FLOW_ALLOWED.slice(),
      defaultOrder: normalizeFlowOrder(FLOW_DEFAULT),
      order: flowOrder.slice(),
      enableMathChecks: !!enableMathChecks,
      allowUrlOrderOverride: !!allowUrlOrderOverride
    },

    // SVO strict matching (trial requested)
    svo: {
      enforceWrittenMatch: !!enforceSvoWrittenMatch,
      enforceWrittenMatchInTrial: !!enforceSvoWrittenMatchInTrial,
      enforceWrittenMatchInProd: !!enforceSvoWrittenMatchInProd
    },

    serverSave: {
      // default: on (required to save to server without participant downloads)
      enabled: (USER_CFG.serverSave && typeof USER_CFG.serverSave.enabled === "boolean")
        ? USER_CFG.serverSave.enabled
        : true,
      endpoint: (USER_CFG.serverSave && USER_CFG.serverSave.endpoint) ? USER_CFG.serverSave.endpoint : "/api/save",
      debounceMs: (USER_CFG.serverSave && Number.isFinite(Number(USER_CFG.serverSave.debounceMs)))
        ? Number(USER_CFG.serverSave.debounceMs)
        : 1200,
      useSendBeaconOnUnload: !!(USER_CFG.serverSave && USER_CFG.serverSave.useSendBeaconOnUnload)
    }
  };

  // Body mode class controls trial-only UI via CSS.
  document.body.classList.add(IS_TRIAL ? "mode-trial" : "mode-prod");

  /*
    Paging model
    ------------
    The user requested "one page per questionnaire".
    Therefore we do not split long questionnaires across multiple pages.
  */

  /* =========================
     DATA LOADING
     ========================= */

  const DATA = window.RIKEN_SURVEY_DATA || null;
  if (!DATA) {
    alert("Survey data not loaded. Make sure ./data/*.js files are present.");
    return;
  }

  /* =========================
     DOM REFS
     ========================= */

  const elApp = document.getElementById("app");
  const elPageMeta = document.getElementById("pageMeta");
  const elProgressFill = document.getElementById("progressFill");
  const elProgressText = document.getElementById("progressText");
  const elAutosaveText = document.getElementById("autosaveText");
  const elTrialBadge = document.getElementById("trialBadge");
  const elTrialControls = document.getElementById("trialControls");

  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");

  // Production mode should be "Next" only unless explicitly overridden.
  if (btnPrev && !CONFIG.ui.showPrev) {
    btnPrev.style.display = "none";
    btnPrev.setAttribute("aria-hidden", "true");
  }

  // Accessibility: if we're in trial mode, un-hide the trial-only UI.
  if (elTrialBadge) elTrialBadge.setAttribute("aria-hidden", IS_TRIAL ? "false" : "true");
  if (elTrialControls) elTrialControls.setAttribute("aria-hidden", IS_TRIAL ? "false" : "true");

  // In debug mode, show extra tools to quickly verify server saving.
  let DEBUG_LOG_PRE = null;
  function debugLog(msg, obj) {
    if (!DEBUG_MODE) return;
    const ts = new Date().toISOString();
    const line = obj ? `${msg}\n${JSON.stringify(obj, null, 2)}` : msg;
    if (DEBUG_LOG_PRE) {
      const prefix = `${ts}  ${line}\n\n`;
      DEBUG_LOG_PRE.textContent = prefix + (DEBUG_LOG_PRE.textContent || "");
    } else {
      // fallback: console
      console.log(`[DEBUG] ${ts} ${msg}`, obj || "");
    }
  }

  async function fetchServerStatus() {
    const res = await fetch(resolveApiUrl("/api/status"), { method: "GET" });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  // Helpful warning if opened via file:// (server saving cannot work)
  if (DEBUG_MODE && window.location && window.location.protocol === "file:") {
    alert(
      "DEBUG: You opened the survey using file://\n\n" +
      "For local testing, the app will try to save to http://localhost:8000/api/save.\n" +
      "Make sure the server is running:\n\n" +
      "  node server/server.js\n\n" +
      "If your backend is on a different host/port, add ?apiBase=http://HOST:PORT\n" +
      "or open the survey from the server URL (recommended)."
    );
  }

  if (DEBUG_MODE && elTrialControls) {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.gap = "8px";
    wrap.style.flexWrap = "wrap";
    wrap.style.alignItems = "center";
    wrap.style.marginLeft = "10px";

    const mkBtn = (id, text, kind) => {
      const b = document.createElement("button");
      b.type = "button";
      b.id = id;
      b.className = `btn ${kind || "btn--secondary"}`;
      b.textContent = text;
      return b;
    };

    const btnStatus = mkBtn("btnDbgStatus", "Debug: Server status", "btn--secondary");
    const btnSaveNow = mkBtn("btnDbgSave", "Debug: Force server save", "btn--secondary");
    const btnFillPage = mkBtn("btnDbgFillPage", "Debug: Autofill this page", "btn--secondary");
    const btnFillAll = mkBtn("btnDbgFillAll", "Debug: Autofill all & finish", "btn--primary");

    wrap.appendChild(btnStatus);
    wrap.appendChild(btnSaveNow);
    wrap.appendChild(btnFillPage);
    wrap.appendChild(btnFillAll);

    const details = document.createElement("details");
    details.style.marginTop = "10px";
    const summary = document.createElement("summary");
    summary.textContent = "Debug log (autosave/server)";
    details.appendChild(summary);
    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.style.maxHeight = "200px";
    pre.style.overflow = "auto";
    pre.style.marginTop = "8px";
    pre.style.padding = "10px";
    pre.style.borderRadius = "12px";
    pre.style.background = "#0b1220";
    pre.style.color = "#e5e7eb";
    pre.textContent = "";
    details.appendChild(pre);
    DEBUG_LOG_PRE = pre;

    elTrialControls.appendChild(wrap);
    elTrialControls.appendChild(details);

    btnStatus.addEventListener("click", async () => {
      try {
        const s = await fetchServerStatus();
        debugLog(`GET /api/status → ${s.status}`, s.data);
        alert(`Server status: ${s.ok ? "OK" : "ERROR"}\n\nOutputDirAbs: ${s.data.outputDirAbs || "?"}\nWritable: ${s.data.outputWritable}`);
      } catch (e) {
        debugLog("Status error", { error: String(e && e.message ? e.message : e) });
        alert("Could not reach /api/status. Is the server running?");
      }
    });

    btnSaveNow.addEventListener("click", async () => {
      try {
        await serverSaveNow("debug");
        debugLog("Forced server save", {
          lastServerSavedAt: state.autosave.lastServerSavedAt,
          lastServerSaveOk: state.autosave.lastServerSaveOk,
          lastServerSaveError: state.autosave.lastServerSaveError
        });
        if (!state.autosave.lastServerSaveOk) {
          alert(`Server save failed: ${state.autosave.lastServerSaveError || "unknown error"}`);
        }
      } catch (e) {
        debugLog("Forced save error", { error: String(e && e.message ? e.message : e) });
      }
    });

    // Autofill helpers are defined later (after page model + setResponse functions exist).
    // We wire the click handlers near the end of init.
    window.__RIKEN_DEBUG = window.__RIKEN_DEBUG || {};
    window.__RIKEN_DEBUG._btnFillPage = btnFillPage;
    window.__RIKEN_DEBUG._btnFillAll = btnFillAll;
  }

  /* =========================
     HELPERS
     ========================= */

  function nowIso() {
    return new Date().toISOString();
  }

  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  }

  function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function safeJsonParse(s) {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  function optionLabel(scale, value) {
    if (!scale || !Array.isArray(scale.options)) return "";
    const opt = scale.options.find((o) => String(o.value) === String(value));
    return opt ? opt.label : "";
  }

  function reverseScore_1to5(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return null;
    return 6 - v;
  }

  function setProgress(percent) {
    const p = clamp(percent, 0, 100);
    elProgressFill.style.width = `${p}%`;
    elProgressText.textContent = `${Math.round(p)}%`;
    const track = document.querySelector(".progress__track");
    if (track) track.setAttribute("aria-valuenow", String(Math.round(p)));
  }

  /* =========================
     STORAGE (robust)
     ========================= */

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function storageRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* =========================
     STATE
     ========================= */

  function createNewState() {
    const st = {
      // Schema/build version recorded into outputs for traceability.
      version: BUILD_VERSION,
      sessionId: uuid(),
      startedAt: nowIso(),
      completedAt: null,

      pageIndex: 0,
      pageEnterAtMs: Date.now(),
      pageMs: {}, // { [pageId]: ms }

      // responses: { [questionId]: { value, extraText?, meta? } }
      responses: {},

      autosave: {
        seq: 0,
        lastSavedAt: null,
        lastOutputCacheAt: null,
        lastServerSavedAt: null,
        lastServerSaveOk: null,
        lastServerSaveError: null
      },

      meta: {
        userAgent: navigator.userAgent || "",
        language: navigator.language || "",
        platform: navigator.platform || "",
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        screen: {
          width: window.screen ? window.screen.width : null,
          height: window.screen ? window.screen.height : null
        },
        storageOk: true,

        // Prolific/session syncing
        // ----------------------
        // Stored both in meta (for easy joining) and as a demographic response item.
        prolificId: URL_PROLIFIC_ID || null,
        prolificIdSource: URL_PROLIFIC_ID ? "url" : null,
        prolificStudyId: URL_STUDY_ID || null,
        prolificSessionId: URL_SESSION_ID || null,

        // Assigned by the server on first save (for convenient indexing)
        participantIndex: null,
        sessionKey: null,

        // Flow / order chosen at launch (stored so resuming is stable
        // even if the URL changes later).
        flow: {
          order: (CONFIG.flow && Array.isArray(CONFIG.flow.order)) ? CONFIG.flow.order.slice() : flowOrder.slice(),
          enableMathChecks: (CONFIG.flow && typeof CONFIG.flow.enableMathChecks === "boolean") ? !!CONFIG.flow.enableMathChecks : !!enableMathChecks,
          source: (allowUrlOrderOverride && urlOrderRaw) ? "url" : "default",
          urlOrderRaw: urlOrderRaw || null,
          urlMathRaw: urlMathRaw || null,
          chosenAt: nowIso()
        },

        // App-side scoring/validation settings for auditability
        settings: {
          mode: MODE,
          enforceSvoWrittenMatch: !!enforceSvoWrittenMatch
        },

        // Deterministic randomization metadata (filled during page-build).
        // Stored in output for auditability.
        randomization: {}
      }
    };

    // If Prolific passed PROLIFIC_PID in the URL, prefill the first field.
    if (URL_PROLIFIC_ID) {
      st.responses["prolific_id"] = {
        value: URL_PROLIFIC_ID,
        extraText: null,
        meta: {
          pageId: "demographics_start",
          pageIndex: 0,
          firstAnsweredAt: nowIso(),
          firstRtMs: null,
          lastChangedAt: nowIso(),
          lastRtMs: null,
          changedCount: 0,
          lastInteractionType: "prefill_url",
          lastInteractionDetail: null
        }
      };
    }

    return st;
  }

  function loadState() {
    const raw = storageGet(STORAGE_KEYS.STATE);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.sessionId) return null;
    return parsed;
  }

  function persistState(reason) {
    state.autosave.seq += 1;
    state.autosave.lastSavedAt = nowIso();

    const payload = JSON.stringify(state);
    const ok1 = storageSet(STORAGE_KEYS.STATE, payload);
    const ok2 = storageSet(STORAGE_KEYS.STATE_BACKUP, payload);

    const ok = ok1 && ok2;
    state.meta.storageOk = ok;

    // Update UI text (local + server)
    const why = reason ? `(${reason})` : "";
    const localText = ok
      ? `Local: ${state.autosave.lastSavedAt} ${why}`
      : `Local: blocked (storage unavailable) ${why}`;

    if (IS_TRIAL) {
      if (CONFIG.serverSave.enabled) {
        const serverText = state.autosave.lastServerSavedAt
          ? (state.autosave.lastServerSaveOk
            ? `Server: ${state.autosave.lastServerSavedAt}`
            : (DEBUG_MODE
              ? `Server: ERROR — ${String(state.autosave.lastServerSaveError || "unknown").slice(0, 120)}`
              : `Server: error`))
          : `Server: pending`;
        elAutosaveText.textContent = `Autosave — ${localText} • ${serverText}`;
      } else {
        elAutosaveText.textContent = `Autosave — ${localText}`;
      }
    } else {
      // Production: keep autosave display discreet
      elAutosaveText.textContent = ok
        ? `Autosave: ${state.autosave.lastSavedAt}`
        : `Autosave: unavailable`;
    }

    // "Output autosave" cache (throttled):
    if (reason === "page" || reason === "export" || reason === "unload" || state.autosave.seq % 10 === 0) {
      updateOutputCache();
    }

    // Background server save (debounced)
    scheduleServerSave(reason || "autosave");
  }

  function clearState() {
    storageRemove(STORAGE_KEYS.STATE);
    storageRemove(STORAGE_KEYS.STATE_BACKUP);

    storageRemove(STORAGE_KEYS.OUTPUT_JSON);
    storageRemove(STORAGE_KEYS.OUTPUT_TSV_RESPONSES);
    storageRemove(STORAGE_KEYS.OUTPUT_TSV_SCORES);
  }

  /* =========================
     BACKGROUND SERVER SAVE
     ========================= */

  let _serverSaveTimer = null;
  let _serverSaveInFlight = false;
  let _serverSaveQueued = false;

  function scheduleServerSave(trigger) {
    if (!CONFIG.serverSave.enabled) return;
    if (trigger === "serverAck") return; // prevent loops

    // Debounced: collapse many rapid edits into one save.
    if (_serverSaveTimer) {
      clearTimeout(_serverSaveTimer);
      _serverSaveTimer = null;
    }

    _serverSaveTimer = setTimeout(() => {
      _serverSaveTimer = null;
      serverSaveNow(trigger || "autosave");
    }, CONFIG.serverSave.debounceMs);
  }

  async function serverSaveNow(trigger) {
    if (!CONFIG.serverSave.enabled) return;

    if (_serverSaveInFlight) {
      _serverSaveQueued = true;
      return;
    }

    _serverSaveInFlight = true;

    try {
      // Build a full output snapshot (includes reverse-scored values)
      const output = buildOutput();
      const payload = {
        kind: "autosave",
        trigger: trigger || "autosave",
        clientSavedAt: nowIso(),
        output,
        tsv: {
          responses: exportResponsesToTsv(output),
          scores: exportScoresToTsv(output)
        }
      };

      // IMPORTANT:
      // Do NOT use `keepalive: true` for large autosave payloads.
      // Browsers impose a strict request body limit (commonly ~64KB) on
      // keepalive requests. Our payload includes full item texts + TSVs,
      // and will exceed that size, causing the request to fail *before*
      // it reaches the server (no POST in server logs).
      //
      // We already have a best-effort `sendBeacon` path for unload events,
      // so regular autosaves should be normal POST requests.
      const res = await fetch(resolveApiUrl(CONFIG.serverSave.endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Server responded ${res.status}`);

      // Server can return assigned participantIndex (and sessionKey) for stable labeling.
      try {
        const data = await res.json();
        if (data && data.sessionKey) state.meta.sessionKey = String(data.sessionKey);
        if (data && data.fileKey) state.meta.fileKey = String(data.fileKey);
        if (data && data.prolificId && !state.meta.prolificId) state.meta.prolificId = String(data.prolificId);
        if (data && (data.participantIndex !== undefined) && (data.participantIndex !== null)) {
          state.meta.participantIndex = data.participantIndex;
        }
      } catch {
        // ignore non-JSON responses
      }

      state.autosave.lastServerSavedAt = nowIso();
      state.autosave.lastServerSaveOk = true;
      state.autosave.lastServerSaveError = null;
    } catch (err) {
      state.autosave.lastServerSaveOk = false;
      state.autosave.lastServerSaveError = String(err && err.message ? err.message : err);
    } finally {
      _serverSaveInFlight = false;
      // refresh autosave banner
      persistState("serverAck");

      if (_serverSaveQueued) {
        _serverSaveQueued = false;
        scheduleServerSave("queued");
      }
    }
  }

  function trySendBeaconSave(trigger) {
    if (!CONFIG.serverSave.enabled) return false;
    if (!CONFIG.serverSave.useSendBeaconOnUnload) return false;
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return false;

    try {
      const output = buildOutput();
      const payload = JSON.stringify({
        kind: "beacon",
        trigger: trigger || "unload",
        clientSavedAt: nowIso(),
        output,
        tsv: {
          responses: exportResponsesToTsv(output),
          scores: exportScoresToTsv(output)
        }
      });
      return navigator.sendBeacon(resolveApiUrl(CONFIG.serverSave.endpoint), payload);
    } catch {
      return false;
    }
  }

  function setResponse(qid, value, extraText, meta) {
    state.responses[qid] = {
      value: value,
      extraText: extraText ?? null,
      meta: meta ?? (state.responses[qid] ? state.responses[qid].meta : null)
    };

    // Keep a canonical prolificId in state.meta for easy downstream joins.
    if (qid === "prolific_id") {
      const v = String(value || "").trim();
      state.meta.prolificId = v || null;
      if (!state.meta.prolificIdSource) state.meta.prolificIdSource = "manual";
    }
  }

  function setResponseMeta(qid, meta) {
    const prev = state.responses[qid] || { value: null, extraText: null, meta: null };
    state.responses[qid] = { ...prev, meta };
  }

  function getResponseValue(qid) {
    return state.responses[qid] ? state.responses[qid].value : null;
  }

  function getResponseExtra(qid) {
    return state.responses[qid] ? state.responses[qid].extraText : null;
  }

  function getResponseMeta(qid) {
    return state.responses[qid] ? state.responses[qid].meta : null;
  }

  /* =========================
     RESPONSE TIMING META (per item)
     =========================
     For quality control / downstream analysis we store response-time metadata
     for each item. RT is measured as milliseconds from the moment the current
     page was entered (state.pageEnterAtMs) to the moment the response was set.

     These fields are saved to:
       - output JSON (per item)
       - responses TSV (per item)
  */

  function recordGenericInteraction(qid, interactionType, detail) {
    const nowMs = Date.now();
    const baseMs = Number.isFinite(Number(state.pageEnterAtMs)) ? Number(state.pageEnterAtMs) : nowMs;
    const rtMs = Math.max(0, nowMs - baseMs);
    const iso = nowIso();

    const prev = getResponseMeta(qid);
    const meta = (prev && typeof prev === "object") ? { ...prev } : {};

    if (!meta.firstAnsweredAt) meta.firstAnsweredAt = iso;
    if (!Number.isFinite(Number(meta.firstRtMs))) meta.firstRtMs = rtMs;

    meta.lastChangedAt = iso;
    meta.lastRtMs = rtMs;
    meta.changedCount = (Number.isFinite(Number(meta.changedCount)) ? Number(meta.changedCount) : 0) + 1;

    // Context: which page this response was entered on
    try {
      meta.pageId = (Array.isArray(PAGES) && PAGES[state.pageIndex]) ? PAGES[state.pageIndex].id : (meta.pageId || null);
      meta.pageIndex = Number.isFinite(Number(state.pageIndex)) ? Number(state.pageIndex) : (meta.pageIndex || null);
    } catch { /* ignore */ }

    if (interactionType) meta.lastInteractionType = String(interactionType);
    if (detail !== undefined) meta.lastInteractionDetail = detail;

    setResponseMeta(qid, meta);
    return meta;
  }

  // SVO: keep separate timing for slider vs written input (requested)
  function recordSvoInteraction(qid, which) {
    const nowMs = Date.now();
    const baseMs = Number.isFinite(Number(state.pageEnterAtMs)) ? Number(state.pageEnterAtMs) : nowMs;
    const rtMs = Math.max(0, nowMs - baseMs);
    const iso = nowIso();

    const prev = getResponseMeta(qid);
    const meta = (prev && typeof prev === "object") ? { ...prev } : {};

    meta.svoTiming = (meta.svoTiming && typeof meta.svoTiming === "object") ? meta.svoTiming : {};
    const key = (which === "written") ? "written" : "slider";
    const prevT = meta.svoTiming[key];
    const t = (prevT && typeof prevT === "object") ? { ...prevT } : {};

    if (!t.firstAt) t.firstAt = iso;
    if (!Number.isFinite(Number(t.firstRtMs))) t.firstRtMs = rtMs;

    t.lastAt = iso;
    t.lastRtMs = rtMs;
    t.changeCount = (Number.isFinite(Number(t.changeCount)) ? Number(t.changeCount) : 0) + 1;

    meta.svoTiming[key] = t;

    // Also update generic timing so every question has one consistent set of RT fields.
    if (!meta.firstAnsweredAt) meta.firstAnsweredAt = iso;
    if (!Number.isFinite(Number(meta.firstRtMs))) meta.firstRtMs = rtMs;
    meta.lastChangedAt = iso;
    meta.lastRtMs = rtMs;
    meta.changedCount = (Number.isFinite(Number(meta.changedCount)) ? Number(meta.changedCount) : 0) + 1;

    try {
      meta.pageId = (Array.isArray(PAGES) && PAGES[state.pageIndex]) ? PAGES[state.pageIndex].id : (meta.pageId || null);
      meta.pageIndex = Number.isFinite(Number(state.pageIndex)) ? Number(state.pageIndex) : (meta.pageIndex || null);
    } catch { /* ignore */ }

    setResponseMeta(qid, meta);
    return meta;
  }

  /* =========================
     DETERMINISTIC RNG (for math checks)
     ========================= */

  function hashStringToSeed(str) {
    // FNV-1a 32-bit
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(rng, minInclusive, maxInclusive) {
    const r = rng();
    return Math.floor(r * (maxInclusive - minInclusive + 1)) + minInclusive;
  }

  function shuffleInPlace(arr, rng) {
    // Fisher-Yates
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }

  /* =========================
     PAGE MODEL
     ========================= */

  const TERMINATED_PAGE_ID = "terminated";

  function scaleLegend(scale) {
    if (!scale || !Array.isArray(scale.options)) return "";
    return scale.options.map((o) => `[${o.value}] = ${o.label}`).join("\n");
  }

  function makeLikertPages(instrument, opts) {
    const o = opts || {};
    const showFacetHeadings = !!o.showFacetHeadings;
    const randomizeOrder = !!o.randomizeOrder;
    const rng = o.rng || null;
    const renumberDisplay = !!o.renumberDisplay;
    // Optional audit metadata for deterministic shuffles.
    // Example:
    //   { orderMode: 'global', globalSeed: 'ipip120_global_v1', seed: 12345 }
    // or (legacy per-session):
    //   { orderMode: 'perSession', seedSalt: 'ipip120_v1', seed: 12345 }
    const randomizationMeta = o.randomizationMeta || null;

    // v5: one page per questionnaire (do not chunk long questionnaires)
    const items = instrument.items.map((it) => ({
      id: it.id,
      num: it.num, // original number
      text: it.text,
      reverse: !!it.reverse,
      facet: it.facet || null,
      meta: { key: it.key || null }
    }));

    if (randomizeOrder && rng) {
      shuffleInPlace(items, rng);
    }

    // Add presentation-only numbering/indexing.
    for (let i = 0; i < items.length; i++) {
      items[i].presentedIndex = i + 1;
      items[i].displayNum = renumberDisplay ? (i + 1) : items[i].num;
    }

    return [
      {
        id: instrument.id,
        type: "likert",
        instrumentId: instrument.id,
        title: instrument.title,
        intro: instrument.intro || "",
        scale: instrument.scale,
        items,
        showFacetHeadings: showFacetHeadings,

        // Deterministic presentation metadata (useful for auditability).
        presentation: {
          randomized: randomizeOrder,
          renumberDisplay: renumberDisplay,
          // NOTE: we keep seedSalt for backwards compatibility.
          orderMode: randomizationMeta ? (randomizationMeta.orderMode || null) : null,
          globalSeed: randomizationMeta ? (randomizationMeta.globalSeed || null) : null,
          seedSalt: randomizationMeta ? (randomizationMeta.seedSalt || null) : null,
          seed: randomizationMeta ? (randomizationMeta.seed !== undefined ? randomizationMeta.seed : null) : null,
          order: items.map((it) => it.id)
        }
      }
    ];
  }

  function generateMathTask(rng, spec) {
    // Returns { expression, promptLine, correctAnswer }
    // Expressions intentionally simple ASCII for copy-safe output.

    const kind = spec.kind;

    if (kind === "add_sub") {
      const a = randInt(rng, 20000, 99999);
      const b = randInt(rng, 20000, 99999);
      const c = randInt(rng, 1000, 9999);
      const expression = `${a} + ${b} - ${c}`;
      const correctAnswer = a + b - c;
      return { kind, expression, correctAnswer };
    }

    if (kind === "mul") {
      const a = randInt(rng, 400, 9999);
      const b = randInt(rng, 20, 999);
      const expression = `${a} * ${b}`;
      const correctAnswer = a * b;
      return { kind, expression, correctAnswer };
    }

    if (kind === "div") {
      const divisor = randInt(rng, 12, 199);
      const quotient = randInt(rng, 200, 999);
      const dividend = divisor * quotient;
      const expression = `${dividend} / ${divisor}`;
      const correctAnswer = quotient;
      return { kind, expression, correctAnswer };
    }

    if (kind === "mul_add") {
      const a = randInt(rng, 200, 9999);
      const b = randInt(rng, 20, 199);
      const c = randInt(rng, 1000, 99999);
      const expression = `${a} * ${b} + ${c}`;
      const correctAnswer = a * b + c;
      return { kind, expression, correctAnswer };
    }

    if (kind === "div_sub") {
      const divisor = randInt(rng, 12, 199);
      const quotient = randInt(rng, 400, 9999);
      const dividend = divisor * quotient;
      const c = randInt(rng, 100, 9999);
      const expression = `${dividend} / ${divisor} - ${c}`;
      const correctAnswer = quotient - c;
      return { kind, expression, correctAnswer };
    }

    // Fallback
    const a = randInt(rng, 10000, 99999);
    const b = randInt(rng, 1000, 9999);
    const expression = `${a} + ${b}`;
    const correctAnswer = a + b;
    return { kind: "add", expression, correctAnswer };
  }

  function buildPages(rng, sessionId, flow) {
    const pages = [];

    // -------------------------------
    // Consent + age gate (BEGINNING)
    // -------------------------------
    // Keep question wording EXACT (from Demographics questionnaire)
    const demo = DATA.demographics;
    const prolificQ = demo.questions.find((q) => q.id === "prolific_id") || demo.questions.find((q) => q.num === 0) || null;
    const ageQ = demo.questions.find((q) => q.num === 1) || demo.questions.find((q) => q.title === "Age");
    const consentQ = demo.questions.find((q) => q.num === 18) || demo.questions.find((q) => q.title === "Consent Confirmation");

    pages.push({
      id: "consent_age",
      type: "demographics",
      title: IS_TRIAL ? "Trial — Participant ID & Consent" : "Participant ID & Consent",
      description: IS_TRIAL
        ? "Trial mode: skipping is allowed later, but participant ID + consent/age gating is still enforced."
        : "Please enter your participant ID, then confirm consent and age.",
      questions: [prolificQ, ageQ, consentQ].filter(Boolean),
      forceConsentGate: true,
      ageGateMin: 18
    });

    // Effective flow (order + math toggle)
    const effectiveFlow = flow || CONFIG.flow || { order: FLOW_DEFAULT, enableMathChecks: true };
    const blockOrder = normalizeFlowOrder(effectiveFlow.order || FLOW_DEFAULT);
    const includeMath = !!effectiveFlow.enableMathChecks;

    // Calculation checks spec (from data/math_checks.js)
    const mathConfig = DATA.math_checks || null;
    const checks = (mathConfig && Array.isArray(mathConfig.checks)) ? mathConfig.checks : [];
    const maxAttempts = (mathConfig && Number.isFinite(Number(mathConfig.maxAttempts))) ? Number(mathConfig.maxAttempts) : 3;
    let mathIdx = 0;

    const BLOCK_TITLES = {
      hexaco100: (DATA.hexaco100 && DATA.hexaco100.title) ? DATA.hexaco100.title : "HEXACO",
      ipip120: (DATA.ipip120 && DATA.ipip120.title) ? DATA.ipip120.title : "IPIP-NEO",
      mfq30: (DATA.mfq30 && DATA.mfq30.title) ? DATA.mfq30.title : "MFQ",
      d70: (DATA.d70 && DATA.d70.title) ? DATA.d70.title : "D70",
      svo: (DATA.svo && DATA.svo.title) ? DATA.svo.title : "SVO"
    };

    function labelForBlock(blockId) {
      return BLOCK_TITLES[blockId] || String(blockId);
    }

    function addMathTransition(prevLabel, nextLabel) {
      if (!includeMath) return;
      const spec = checks[mathIdx] || null;
      if (!spec) return;
      mathIdx += 1;

      const task = generateMathTask(rng, spec);
      const between = `${prevLabel} → ${nextLabel}`;

      pages.push({
        id: spec.id,
        type: "math",
        title: IS_TRIAL ? `${spec.title} — ${between}` : "Short task",
        description: IS_TRIAL
          ? spec.prompt
          : "Please solve the following arithmetic problem. Type your answer and press Enter.",
        task: {
          id: spec.id,
          between,
          kind: task.kind,
          expression: task.expression,
          correctAnswer: task.correctAnswer,
          maxAttempts
        }
      });
    }

    // Add blocks in the chosen order, inserting math checks between them.
    let prevLabel = "Consent/Age";

    for (let i = 0; i < blockOrder.length; i++) {
      const blockId = blockOrder[i];
      const nextLabel = labelForBlock(blockId);

      // One math check at each transition:
      //   Consent/Age -> first block
      //   block(i-1) -> block(i)
      addMathTransition(prevLabel, nextLabel);

      // Add the block page(s)
      if (blockId === "hexaco100") {
        pages.push(...makeLikertPages(DATA.hexaco100));
      } else if (blockId === "ipip120") {
        // IPIP (randomized presentation order)
        // -----------------------------------
        // Requested: keep the randomized order CONSTANT across all subjects.
        // We do this by default with cfg.orderMode === 'global'.
        (function addIpipPages() {
          const inst = DATA.ipip120;
          const cfg = CONFIG.randomization && CONFIG.randomization.ipip120 ? CONFIG.randomization.ipip120 : { enabled: false };
          const enabled = !!cfg.enabled;

          // Ensure state meta containers exist
          state.meta.randomization = state.meta.randomization || {};

          if (enabled) {
            // v16 requirement: IPIP order must be the SAME for all participants.
            // We therefore FORCE the deterministic shuffle to use the GLOBAL seed
            // regardless of any runtime config.
            const requestedOrderMode = String(cfg.orderMode || "global");
            const orderMode = "global";

            // Deterministic global seed (does NOT depend on sessionId)
            const globalSeed = String(cfg.globalSeed || "ipip120_global_v1");
            const seed = hashStringToSeed("GLOBAL|" + globalSeed);
            const rngIpip = mulberry32(seed);

            const meta = {
              enabled: true,
              orderMode,
              globalSeed,
              seed,

              // Auditability: record if a non-global mode was requested.
              requestedOrderMode,
              forcedGlobal: requestedOrderMode !== "global"
            };

            // Record for auditability
            state.meta.randomization.ipip120 = meta;

            pages.push(
              ...makeLikertPages(inst, {
                showFacetHeadings: false,
                randomizeOrder: true,
                rng: rngIpip,
                renumberDisplay: !!cfg.renumberDisplay,
                randomizationMeta: meta
              })
            );
          } else {
            state.meta.randomization.ipip120 = { enabled: false };
            pages.push(...makeLikertPages(inst, { showFacetHeadings: true }));
          }
        })();
      } else if (blockId === "mfq30") {
        pages.push({
          id: "mfq30",
          type: "mfq",
          instrumentId: "mfq30",
          title: DATA.mfq30.title,
          part1: {
            title: `${DATA.mfq30.title} — Part 1`,
            intro: `${DATA.mfq30.part1.prompt}\n\n${scaleLegend(DATA.mfq30.part1.scale)}`,
            scale: DATA.mfq30.part1.scale,
            items: DATA.mfq30.part1.items.map((it) => ({
              id: it.id,
              num: it.num,
              text: it.text,
              meta: { var: it.var, scored: it.scored }
            }))
          },
          part2: {
            title: `${DATA.mfq30.title} — Part 2`,
            intro: `${DATA.mfq30.part2.prompt}\n\n${scaleLegend(DATA.mfq30.part2.scale)}`,
            scale: DATA.mfq30.part2.scale,
            items: DATA.mfq30.part2.items.map((it) => ({
              id: it.id,
              num: it.num,
              text: it.text,
              meta: { var: it.var, scored: it.scored }
            }))
          }
        });
      } else if (blockId === "d70") {
        pages.push(...makeLikertPages(DATA.d70));
      } else if (blockId === "svo") {
        pages.push({
          type: "svo",
          instrumentId: "svo",
          id: "svo",
          title: DATA.svo.title,
          intro: DATA.svo.intro,
          example: DATA.svo.example,
          items: DATA.svo.items.slice()
        });
      }

      prevLabel = nextLabel;
    }

    // -------------------------------
    // Demographics (END)
    // -------------------------------
    // Everything except Prolific ID, age, and consent.
    const demoRest = demo.questions.filter((q) => q.num !== 0 && q.num !== 1 && q.num !== 18);
    pages.push({
      id: "demographics_end",
      type: "demographics",
      title: demo.title,
      description: "",
      questions: demoRest
    });

    // Finish (no participant downloads)
    pages.push({
      id: "finish",
      type: "finish",
      title: "Finish",
      description: "Thank you. Your responses have been saved."
    });

    // Terminated
    pages.push({
      id: TERMINATED_PAGE_ID,
      type: "terminated",
      title: "Survey ended",
      description: "You selected NO consent. The survey has ended."
    });

    return pages;
  }

  /* =========================
     PROGRESS CALC
     ========================= */

  function computeAllRequiredQuestionIds(pages) {
    const ids = [];
    for (const page of pages) {
      if (page.type === "demographics") {
        for (const q of page.questions) {
          if (q && q.required) ids.push(q.id);
        }
      } else if (page.type === "likert") {
        for (const it of page.items) ids.push(it.id);
      } else if (page.type === "svo") {
        for (const it of page.items) ids.push(it.id);
      } else if (page.type === "mfq") {
        for (const it of page.part1.items) ids.push(it.id);
        for (const it of page.part2.items) ids.push(it.id);
      } else if (page.type === "math") {
        ids.push(page.task.id);
      }
    }
    return ids;
  }

  function computePresentationMap(pages) {
    // instrumentId -> presentation details
    const out = {};

    for (const page of pages) {
      if (page.type === "likert" && page.instrumentId) {
        const instId = String(page.instrumentId);
        const order = Array.isArray(page.items) ? page.items.map((it) => it.id) : [];
        const itemMap = {};

        if (Array.isArray(page.items)) {
          for (let i = 0; i < page.items.length; i++) {
            const it = page.items[i];
            if (!it || !it.id) continue;
            itemMap[it.id] = {
              presentedIndex: i + 1,
              presentedNum: (it.displayNum !== undefined && it.displayNum !== null) ? it.displayNum : it.num,
              originalNum: it.num
            };
          }
        }

        out[instId] = {
          instrumentId: instId,
          randomized: !!(page.presentation && page.presentation.randomized),
          renumberDisplay: !!(page.presentation && page.presentation.renumberDisplay),
          orderMode: (page.presentation && page.presentation.orderMode) ? page.presentation.orderMode : null,
          globalSeed: (page.presentation && page.presentation.globalSeed) ? page.presentation.globalSeed : null,
          seedSalt: (page.presentation && page.presentation.seedSalt) ? page.presentation.seedSalt : null,
          seed: (page.presentation && (page.presentation.seed !== undefined)) ? page.presentation.seed : null,
          order,
          map: itemMap
        };
      }
    }

    return out;
  }

  function computeProgress(requiredIds) {
    const total = requiredIds.length;
    let answered = 0;

    for (const qid of requiredIds) {
      const v = getResponseValue(qid);
      if (v !== null && v !== undefined && String(v).trim() !== "") answered += 1;
    }

    return { total, answered, pct: total ? (answered / total) * 100 : 0 };
  }

  /* =========================
     VALIDATION
     ========================= */

  function validatePage(page) {
    const missing = [];

    // Trial mode: allow skipping everything except the initial gate.
    // HOWEVER, for SVO we still enforce "strict matching" if configured
    // (so trial data can be verified while still allowing blank skips).
    const trialSkipMode = !!(CONFIG.allowSkip && page.id !== "consent_age");
    if (trialSkipMode && page.type !== "svo") {
      return missing;
    }

    if (page.type === "demographics") {
      for (const q of page.questions) {
        if (!q || !q.required) continue;
        const v = getResponseValue(q.id);
        if (v === null || String(v).trim() === "") missing.push(q);

        // If option has free text, require it when selected
        if (q.type === "radio" && Array.isArray(q.options)) {
          const selected = String(v || "");
          const opt = q.options.find((o) => String(o.value) === selected);
          if (opt && opt.freeText) {
            const extra = getResponseExtra(q.id);
            if (!extra || !String(extra).trim()) missing.push({ ...q, _needsExtra: true });
          }
        }
      }
    }

    if (page.type === "likert") {
      for (const it of page.items) {
        const v = getResponseValue(it.id);
        if (v === null || v === undefined || String(v).trim() === "") missing.push(it);
      }
    }

    if (page.type === "svo") {
      for (const it of page.items) {
        const v = getResponseValue(it.id);
        const sliderMissing = (v === null || v === undefined || String(v).trim() === "");

        const meta = getResponseMeta(it.id);
        const w = (meta && meta.svoWritten) ? meta.svoWritten : null;
        const strict = !!(CONFIG.svo && CONFIG.svo.enforceWrittenMatch);
        const writtenProvided = !!w && (!!String(w.youRaw || "").trim() || !!String(w.otherRaw || "").trim());
        const anyAnswered = (!sliderMissing) || writtenProvided;
        const writtenMissing = !w || !String(w.youRaw || "").trim() || !String(w.otherRaw || "").trim() ||
          !Number.isFinite(Number(w.youNum)) || !Number.isFinite(Number(w.otherNum));

        if (sliderMissing || writtenMissing) {
          // In trial skip mode, allow fully blank SVO items.
          // If strict matching is enabled and the participant started answering (mark or typing),
          // require the full response so trial verification is meaningful.
          if (!trialSkipMode || (trialSkipMode && strict && anyAnswered)) {
            missing.push({ ...it, _partial: anyAnswered && (sliderMissing || writtenMissing) });
          }
          continue;
        }

        // Strict match enforcement (requested for TRIAL; configurable for PROD)
        if (strict) {
          const idx = Number(v);
          const expectedYou = (Array.isArray(it.you) && Number.isFinite(idx)) ? it.you[idx] : null;
          const expectedOther = (Array.isArray(it.other) && Number.isFinite(idx)) ? it.other[idx] : null;

          const matches = (Number.isFinite(Number(expectedYou)) && Number.isFinite(Number(expectedOther)))
            ? (Number(w.youNum) === Number(expectedYou) && Number(w.otherNum) === Number(expectedOther))
            : false;

          if (!matches) {
            missing.push({
              ...it,
              _mismatch: true,
              _expected: { you: expectedYou, other: expectedOther },
              _written: { you: w.youNum, other: w.otherNum }
            });
          }
        }
      }
    }

    if (page.type === "mfq") {
      for (const it of page.part1.items) {
        const v = getResponseValue(it.id);
        if (v === null || v === undefined || String(v).trim() === "") missing.push(it);
      }
      for (const it of page.part2.items) {
        const v = getResponseValue(it.id);
        if (v === null || v === undefined || String(v).trim() === "") missing.push(it);
      }
    }

    if (page.type === "math") {
      const v = getResponseValue(page.task.id);
      const meta = getResponseMeta(page.task.id);
      const attempts = meta && Array.isArray(meta.attempts) ? meta.attempts : [];

      // Require at least one Enter submission (attempt), not necessarily correctness.
      if (v === null || String(v).trim() === "" || attempts.length < 1) missing.push(page.task);
    }

    return missing;
  }

  /* =========================
     DEBUG AUTOFILL (trial + ?debug=1)
     ========================= */

  function pickMidScaleValue(scale) {
    if (!scale || !Array.isArray(scale.options) || scale.options.length === 0) return 3;
    const mid = Math.floor((scale.options.length - 1) / 2);
    return scale.options[mid].value;
  }

  function pickFirstRadioValue(q) {
    const opts = (q && Array.isArray(q.options)) ? q.options : [];
    // Prefer a non-freeText option if possible
    const nonFree = opts.find((o) => o && !o.freeText);
    return (nonFree && nonFree.value !== undefined) ? String(nonFree.value) : (opts[0] ? String(opts[0].value) : "");
  }


  /* =========================
     ADMIN / DEBUG AUTOFILL HELPERS
     ========================= */

  // Fill the current page with valid answers.
  // Used by:
  //   - Trial debug buttons (when DEBUG_MODE)
  //   - Launcher-driven automated runs (when ?admin=1&autofill=1)
  // Notes:
  //   - We write into the in-memory state (not DOM) so it is fast.
  //   - We also stamp basic timing metadata so the export columns are populated.
  function autofillPageForAutomation(page, opts = {}) {
    if (!page) return;

    const nowMs = Date.now();
    const nowIso = new Date().toISOString();

    const recordTiming = opts.recordTiming !== false; // default true
    const interactionType = opts.interactionType || "autofill";

    const chooseLikertValue = (min, max) => {
      // Deterministic, easy-to-spot value (middle of scale)
      const mid = Math.round((min + max) / 2);
      return Math.max(min, Math.min(max, mid));
    };

    const chooseFrom = (arr) => {
      if (!arr || arr.length === 0) return null;
      // Use the first option to keep outputs stable/reproducible.
      return arr[0];
    };

    const setAndRecord = (qid, value, extra = null) => {
      setResponse(qid, value, extra);
      if (recordTiming) {
        recordGenericInteraction(qid, interactionType);
      }
    };

    // DEMOGRAPHICS (also used for consent+age)
    if (page.type === "demographics") {
      for (const q of page.questions || []) {
        if (q.type === "number") {
          // Consent gate expects age >= 18.
          // NOTE: In this build the age question ID is demo_q01 (from demographics.js),
          // not a generic "age". So detect age by question number/title.
          const isAge = (Number(q.num) === 1) || String(q.title || "").toLowerCase().includes("age");
          const v = isAge ? 25 : 1;
          setAndRecord(q.id, v);
          continue;
        }
        if (q.type === "text") {
          setAndRecord(q.id, "test");
          continue;
        }
        if (q.type === "radio") {
          // Consent confirmation must be "Yes" to continue.
          const isConsent = (Number(q.num) === 18) || String(q.title || "").toLowerCase().includes("consent");
          const opt = isConsent
            ? (q.options || []).find((o) => String(o && o.value).trim() === "Yes")
            : chooseFrom(q.options || []);
          if (!opt) {
            // No options configured — leave blank.
            continue;
          }
          const extra = opt.freeText ? "test" : null;
          setAndRecord(q.id, opt.value, extra);
          continue;
        }
      }
      return;
    }

    // LIKERT INSTRUMENT PAGES (HEXACO / IPIP / D70)
    if (page.type === "likert") {
      const min = page.scale?.min ?? 1;
      const max = page.scale?.max ?? 5;
      for (const it of page.items || []) {
        setAndRecord(it.id, chooseLikertValue(min, max));
      }
      return;
    }

    // MFQ PAGES
    if (page.type === "mfq") {
      const min = page.scale?.min ?? 1;
      const max = page.scale?.max ?? 6;
      for (const it of page.items || []) {
        setAndRecord(it.id, chooseLikertValue(min, max));
      }
      return;
    }

    // SVO SLIDER PAGES
    if (page.type === "svo") {
      for (const it of page.items || []) {
        const idx = 4; // center column (0..8)
        setResponse(it.id, idx);
        if (recordTiming) recordSvoInteraction(it.id, "slider");

        const col = (it.columns || [])[idx];
        if (col) {
          setResponseMeta(it.id, {
            svoWritten: { self: col.self, other: col.other },
            svoWrittenValid: true,
            svoWrittenValidatedAt: nowIso,
          });
          if (recordTiming) recordSvoInteraction(it.id, "written");
        }
      }
      return;
    }

    // MATH CHECK PAGES
    if (page.type === "math") {
      const t = page.task;
      if (t?.id) {
        const entered = String(t.correctAnswer ?? "0");
        setResponse(t.id, entered);

        // Provide the minimum metadata required by validatePage() (attempts >= 1).
        setResponseMeta(t.id, {
          attempts: [
            {
              entered,
              correct: true,
              tFocusMs: nowMs,
              tEnterMs: nowMs + 50,
              rtMs: 50,
            },
          ],
          startedAtIso: nowIso,
          firstFocusAtMs: nowMs,
          lastEnterAtMs: nowMs + 50,
        });

        if (recordTiming) {
          recordGenericInteraction(t.id, "autofill_math");
        }
      }
      return;
    }
  }

  function debugAutofillPage(page) {
    if (!DEBUG_MODE) return;
    if (!page) return;

    try {
      if (page.type === "demographics") {
        for (const q of page.questions || []) {
          if (!q) continue;
          if (q.type === "number") {
            // Consent/Age gate page uses age question; keep >= 18
            const n = (q.title === "Age" || q.num === 1) ? 25 : 1;
            setResponse(q.id, String(n));
          } else if (q.type === "text") {
            setResponse(q.id, "TEST");
          } else if (q.type === "textarea") {
            setResponse(q.id, "TEST");
          } else if (q.type === "radio") {
            // Consent confirmation must be Yes to continue
            let v = pickFirstRadioValue(q);
            if (q.title === "Consent Confirmation") v = "Yes";
            setResponse(q.id, v, null);
          }
        }
      } else if (page.type === "likert") {
        const v = pickMidScaleValue(page.scale);
        for (const it of page.items || []) {
          if (!it || !it.id) continue;
          setResponse(it.id, v);
        }
      } else if (page.type === "mfq") {
        const v1 = pickMidScaleValue(page.part1.scale);
        const v2 = pickMidScaleValue(page.part2.scale);
        for (const it of page.part1.items || []) {
          if (!it || !it.id) continue;
          setResponse(it.id, v1);
        }
        for (const it of page.part2.items || []) {
          if (!it || !it.id) continue;
          setResponse(it.id, v2);
        }
      } else if (page.type === "svo") {
        for (const it of page.items || []) {
          if (!it || !it.id) continue;
          const idx = 4; // center column
          setResponse(it.id, idx);
          const youVal = Array.isArray(it.you) ? it.you[idx] : null;
          const otherVal = Array.isArray(it.other) ? it.other[idx] : null;
          const meta = getResponseMeta(it.id) || {};
          meta.svoWritten = {
            youRaw: (youVal === null || youVal === undefined) ? "" : String(youVal),
            otherRaw: (otherVal === null || otherVal === undefined) ? "" : String(otherVal),
            youNum: Number.isFinite(Number(youVal)) ? Number(youVal) : null,
            otherNum: Number.isFinite(Number(otherVal)) ? Number(otherVal) : null,
            editedAt: nowIso()
          };
          setResponseMeta(it.id, meta);
        }
      } else if (page.type === "math") {
        const t = page.task;
        const meta = {
          task: {
            kind: t.kind,
            expression: t.expression,
            correctAnswer: t.correctAnswer,
            between: t.between || null
          },
          attempts: [
            {
              attemptNo: 1,
              focusAt: nowIso(),
              submitAt: nowIso(),
              rtMs: 1200,
              answerRaw: String(t.correctAnswer),
              answerNumeric: t.correctAnswer,
              correct: true
            }
          ],
          currentFocusAtIso: null,
          currentFocusAtMs: null,
          locked: false
        };
        setResponse(t.id, String(t.correctAnswer), null, meta);
      }
    } catch (e) {
      debugLog("Autofill error", { error: String(e && e.message ? e.message : e) });
    }
  }

  async function debugAutofillAllAndFinish() {
    if (!DEBUG_MODE) return;

    for (const page of PAGES) {
      if (!page) continue;
      if (page.id === TERMINATED_PAGE_ID) continue;
      if (page.type === "finish") continue;
      debugAutofillPage(page);
    }

    // Mark completed and save immediately
    if (!state.completedAt) state.completedAt = nowIso();
    persistState("debug_autofill");
    try {
      await serverSaveNow("debug_autofill");
    } catch (e) {
      debugLog("debug_autofill server save error", { error: String(e && e.message ? e.message : e) });
    }

    gotoPageById("finish");
  }

  /* =========================
     PAGE TIMING
     ========================= */

  function recordTimeOnCurrentPage(pageId) {
    const now = Date.now();
    const entered = Number(state.pageEnterAtMs);
    if (Number.isFinite(entered)) {
      const delta = Math.max(0, now - entered);
      state.pageMs[pageId] = (state.pageMs[pageId] || 0) + delta;
    }
    state.pageEnterAtMs = now;
  }

  /* =========================
     RENDERING
     ========================= */

  let PAGES = [];
  let REQUIRED_QUESTION_IDS = [];
  let PRESENTATION = {};

  function setPageMeta(page) {
    const mainPages = PAGES.filter((p) => p.id !== TERMINATED_PAGE_ID);
    const mainIndex = mainPages.findIndex((p) => p.id === page.id);
    const i = mainIndex >= 0 ? (mainIndex + 1) : (state.pageIndex + 1);
    const n = mainPages.length || PAGES.length;

    const answeredProgress = computeProgress(REQUIRED_QUESTION_IDS);

    if (page.id === TERMINATED_PAGE_ID) {
      elPageMeta.textContent = `Survey ended`;
      setProgress(0);
      return;
    }

    if (CONFIG.progressMode === "answered") {
      elPageMeta.textContent = `Page ${i} of ${n} • Answered ${answeredProgress.answered} of ${answeredProgress.total}`;
      setProgress(answeredProgress.pct);
      return;
    }

    // page-based progress
    const pct = (n > 1) ? ((i - 1) / (n - 1)) * 100 : 0;
    elPageMeta.textContent = `Page ${i} of ${n}`;
    setProgress(pct);
  }

  function render() {
    const page = PAGES[state.pageIndex];
    if (!page) return;

    // Nav state (guarded so UI blocks can be safely removed)
    if (btnPrev && CONFIG.ui.showPrev) {
      btnPrev.disabled = state.pageIndex <= 0 || page.type === "terminated";
    }
    if (btnNext) {
      btnNext.disabled = page.type === "finish" || page.type === "terminated";
    }

    // Clear
    elApp.innerHTML = "";

    // Title
    const h = document.createElement("h2");
    h.textContent = page.title;
    elApp.appendChild(h);

    if (page.description) {
      const p = document.createElement("p");
      p.textContent = page.description;
      elApp.appendChild(p);
    }

    // Storage warning (non-blocking)
    if (!state.meta.storageOk) {
      const warn = document.createElement("div");
      warn.className = "error";
      warn.textContent =
        "Warning: Browser storage (localStorage) appears to be blocked. " +
        "Autosave may not work. If possible, open this page from a regular browser profile " +
        "(not a restricted sandbox/incognito), or enable local storage.";
      elApp.appendChild(warn);
    }

    // Render page type
    if (page.type === "demographics") renderDemographics(page);
    else if (page.type === "likert") renderLikert(page);
    else if (page.type === "mfq") renderMfq(page);
    else if (page.type === "svo") renderSvo(page);
    else if (page.type === "math") renderMath(page);
    else if (page.type === "finish") renderFinish(page);
    else if (page.type === "terminated") renderTerminated(page);

    setPageMeta(page);
    window.scrollTo(0, 0);
  }

  function renderDemographics(page) {
    if (page.forceConsentGate) {
      const note = document.createElement("div");
      note.className = "note";
      note.textContent =
        "This survey saves your responses automatically as you work. " +
        "If you select NO consent, the survey ends immediately.";
      elApp.appendChild(note);
    }

    const form = document.createElement("div");
    form.className = "formGrid";

    for (const q of page.questions) {
      const field = document.createElement("div");
      field.className = "field";

      const lab = document.createElement("div");
      lab.className = "field__label";
      const qnum = Number(q.num);
      lab.textContent = (Number.isFinite(qnum) && qnum > 0)
        ? `${q.num}. ${q.title}`
        : `${q.title}`;
      field.appendChild(lab);

      const prompt = document.createElement("p");
      prompt.className = "field__prompt";
      prompt.textContent = q.text;
      field.appendChild(prompt);

      if (q.type === "number") {
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = "1";
        input.value = getResponseValue(q.id) || "";
        input.addEventListener("input", () => {
          recordGenericInteraction(q.id, "demographics_input");
          setResponse(q.id, input.value);
          persistState("autosave");
          setPageMeta(PAGES[state.pageIndex]);
        });
        field.appendChild(input);
      } else if (q.type === "text") {
        const input = document.createElement("input");
        input.type = "text";
        input.value = getResponseValue(q.id) || "";

        // If the Prolific ID came from the URL (PROLIFIC_PID), keep it locked
        // to prevent accidental edits/mismatches.
        if (q.id === "prolific_id" && URL_PROLIFIC_ID) {
          input.readOnly = true;
          input.setAttribute("aria-readonly", "true");
        }

        input.addEventListener("input", () => {
          recordGenericInteraction(q.id, "demographics_input");
          setResponse(q.id, input.value);
          persistState("autosave");
          setPageMeta(PAGES[state.pageIndex]);
        });
        field.appendChild(input);
      } else if (q.type === "textarea") {
        const input = document.createElement("textarea");
        input.value = getResponseValue(q.id) || "";
        input.addEventListener("input", () => {
          recordGenericInteraction(q.id, "demographics_input");
          setResponse(q.id, input.value);
          persistState("autosave");
          setPageMeta(PAGES[state.pageIndex]);
        });
        field.appendChild(input);
      } else if (q.type === "radio") {
        const list = document.createElement("div");
        list.className = "radioList";

        const current = getResponseValue(q.id);

        for (const opt of q.options || []) {
          const line = document.createElement("div");
          line.className = "radioLine";

          const inp = document.createElement("input");
          inp.type = "radio";
          inp.name = q.id;
          inp.value = String(opt.value);
          inp.checked = String(current) === String(opt.value);

          const lbl = document.createElement("label");
          lbl.appendChild(inp);
          lbl.appendChild(document.createTextNode(" " + opt.label));
          line.appendChild(lbl);

          if (opt.freeText) {
            const extra = document.createElement("input");
            extra.type = "text";
            extra.className = "inlineInput";
            extra.placeholder = "Please specify";
            extra.value = getResponseExtra(q.id) || "";
            extra.disabled = !inp.checked;

            inp.addEventListener("change", () => {
              extra.disabled = !inp.checked;
              if (inp.checked) {
                recordGenericInteraction(q.id, "demographics_radio");
                setResponse(q.id, inp.value, extra.value);
                handleConsentGateIfNeeded(page, q, inp.value);
              }
              persistState("autosave");
              setPageMeta(PAGES[state.pageIndex]);
              render();
            });

            extra.addEventListener("input", () => {
              const selected = document.querySelector(`input[name="${q.id}"]:checked`);
              if (selected) {
                recordGenericInteraction(q.id, "demographics_extra");
                setResponse(q.id, selected.value, extra.value);
                persistState("autosave");
                setPageMeta(PAGES[state.pageIndex]);
              }
            });

            line.appendChild(extra);
          } else {
            inp.addEventListener("change", () => {
              if (inp.checked) {
                recordGenericInteraction(q.id, "demographics_radio");
                setResponse(q.id, inp.value, null);
                handleConsentGateIfNeeded(page, q, inp.value);
                persistState("autosave");
                setPageMeta(PAGES[state.pageIndex]);
              }
            });
          }

          list.appendChild(line);
        }

        field.appendChild(list);
      }

      if (q.help) {
        const help = document.createElement("div");
        help.className = "field__help";
        help.textContent = q.help;
        field.appendChild(help);
      }

      form.appendChild(field);
    }

    elApp.appendChild(form);
  }

  function handleConsentGateIfNeeded(page, q, value) {
    if (!page.forceConsentGate) return;
    if (!q || q.title !== "Consent Confirmation") return;

    const v = String(value);
    if (v === "No" || v.startsWith("No")) {
      state.meta.terminatedReason = "no_consent";
      gotoPageById(TERMINATED_PAGE_ID);
    }
  }

  function renderLikert(page) {
    if (page.intro) {
      const intro = document.createElement("div");
      intro.className = "likertIntro";
      intro.textContent = page.intro;
      elApp.appendChild(intro);
    }

    const list = document.createElement("div");
    list.className = "likertList";

    let lastFacet = null;

    for (const item of page.items) {
      if (page.showFacetHeadings && item.facet && item.facet !== lastFacet) {
        lastFacet = item.facet;
        const fh = document.createElement("div");
        fh.className = "facetHeading";
        fh.textContent = item.facet;
        list.appendChild(fh);
      }

      const wrap = document.createElement("div");
      wrap.className = "likertItem";

      const top = document.createElement("div");
      top.className = "likertItem__top";

      const num = document.createElement("div");
      num.className = "likertNum";
      const displayNum = (item.displayNum !== undefined && item.displayNum !== null)
        ? item.displayNum
        : item.num;
      num.textContent = String(displayNum);

      const prompt = document.createElement("div");
      prompt.className = "likertPrompt";
      prompt.textContent = item.text;

      top.appendChild(num);
      top.appendChild(prompt);
      wrap.appendChild(top);

      // Trial transparency: show reverse-keying / item keys (and original numbering if randomized)
      if (IS_TRIAL) {
        const parts = [];
        if (item.displayNum !== undefined && item.displayNum !== null && String(item.displayNum) !== String(item.num)) {
          parts.push(`Presented #${item.displayNum} • Original #${item.num}`);
        }
        if (item.meta && item.meta.key) parts.push(`Key: ${item.meta.key}`);
        if (item.reverse) parts.push("Reverse-keyed (scored = 6 - response)");
        if (parts.length > 0) {
          const meta = document.createElement("div");
          meta.className = "trialMeta";
          meta.textContent = parts.join(" • ");
          wrap.appendChild(meta);
        }
      }

      const optionsWrap = document.createElement("div");
      optionsWrap.className = "likertOptions";

      const grid = document.createElement("div");
      grid.className = "likertOptions__grid";

      const current = getResponseValue(item.id);

      for (const opt of page.scale.options) {
        const choice = document.createElement("label");
        choice.className = "likertChoice";

        const inp = document.createElement("input");
        inp.type = "radio";
        inp.name = item.id;
        inp.value = String(opt.value);
        inp.checked = String(current) === String(opt.value);

        inp.addEventListener("change", () => {
          if (inp.checked) {
            recordGenericInteraction(item.id, "likert_choice", Number(inp.value));
            setResponse(item.id, Number(inp.value));
            persistState("autosave");
            setPageMeta(PAGES[state.pageIndex]);
          }
        });

        const lab = document.createElement("div");
        lab.className = "likertChoice__label";

        const n = document.createElement("span");
        n.className = "num";
        n.textContent = String(opt.value);

        const t = document.createElement("span");
        t.className = "txt";
        t.textContent = opt.label;

        lab.appendChild(n);
        lab.appendChild(t);

        choice.appendChild(inp);
        choice.appendChild(lab);
        grid.appendChild(choice);
      }

      optionsWrap.appendChild(grid);
      wrap.appendChild(optionsWrap);

      list.appendChild(wrap);
    }

    elApp.appendChild(list);
  }

  function renderMfq(page) {
    // MFQ30 contains Part 1 (relevance) and Part 2 (agreement).
    // Requirement: keep the whole MFQ on a single page.

    if (IS_TRIAL) {
      const note = document.createElement("div");
      note.className = "note";
      note.textContent =
        "Trial mode: MFQ is shown as Part 1 + Part 2 on a single page. " +
        "MFQ catch items are included (e.g., 'Whether or not someone was good at math.').";
      elApp.appendChild(note);
    }

    function renderPart(part) {
      const h3 = document.createElement("h3");
      h3.textContent = part.title;
      elApp.appendChild(h3);

      if (part.intro) {
        const intro = document.createElement("div");
        intro.className = "likertIntro";
        intro.textContent = part.intro;
        elApp.appendChild(intro);
      }

      const list = document.createElement("div");
      list.className = "likertList";

      for (const item of part.items) {
        const wrap = document.createElement("div");
        wrap.className = "likertItem";

        const top = document.createElement("div");
        top.className = "likertItem__top";

        const num = document.createElement("div");
        num.className = "likertNum";
        num.textContent = String(item.num);

        const prompt = document.createElement("div");
        prompt.className = "likertPrompt";
        prompt.textContent = item.text;

        top.appendChild(num);
        top.appendChild(prompt);
        wrap.appendChild(top);

        if (IS_TRIAL && item.meta && item.meta.var) {
          const meta = document.createElement("div");
          meta.className = "trialMeta";
          meta.textContent = `VAR: ${item.meta.var} • ${item.meta.scored ? "scored" : "catch"}`;
          wrap.appendChild(meta);
        }

        const optionsWrap = document.createElement("div");
        optionsWrap.className = "likertOptions";
        const grid = document.createElement("div");
        grid.className = "likertOptions__grid";

        const current = getResponseValue(item.id);

        for (const opt of part.scale.options) {
          const choice = document.createElement("label");
          choice.className = "likertChoice";

          const inp = document.createElement("input");
          inp.type = "radio";
          inp.name = item.id;
          inp.value = String(opt.value);
          inp.checked = String(current) === String(opt.value);

          inp.addEventListener("change", () => {
            if (inp.checked) {
              recordGenericInteraction(item.id, "likert_choice", Number(inp.value));
              setResponse(item.id, Number(inp.value));
              persistState("autosave");
              setPageMeta(PAGES[state.pageIndex]);
            }
          });

          const lab = document.createElement("div");
          lab.className = "likertChoice__label";

          const n = document.createElement("span");
          n.className = "num";
          n.textContent = String(opt.value);

          const t = document.createElement("span");
          t.className = "txt";
          t.textContent = opt.label;

          lab.appendChild(n);
          lab.appendChild(t);

          choice.appendChild(inp);
          choice.appendChild(lab);
          grid.appendChild(choice);
        }

        optionsWrap.appendChild(grid);
        wrap.appendChild(optionsWrap);
        list.appendChild(wrap);
      }

      elApp.appendChild(list);
    }

    renderPart(page.part1);
    renderPart(page.part2);
  }

  function renderMath(page) {
    if (IS_TRIAL) {
      const note = document.createElement("div");
      note.className = "note";
      note.innerHTML =
        "<b>Trial: timed calculation check (quality control).</b> " +
        "Click the answer field to start timing, type your answer, then press <b>Enter</b> to submit. " +
        "(Timing and attempts are recorded. In production this page is labeled more discreetly.)";
      elApp.appendChild(note);
    }

    const task = page.task;

    // If participant already started this math check, prefer the stored task
    // so the displayed expression cannot change on resume.
    const existingMeta = getResponseMeta(task.id) || {};
    const effectiveTask = (existingMeta && existingMeta.task)
      ? { ...task, ...existingMeta.task }
      : task;
    const attempts = Array.isArray(existingMeta.attempts) ? existingMeta.attempts : [];
    const locked = !!existingMeta.locked;

    const box = document.createElement("div");
    box.className = "fieldset"; // reuse CSS look

    const expr = document.createElement("div");
    expr.style.fontSize = "18px";
    expr.style.fontWeight = "700";
    expr.style.marginBottom = "10px";
    expr.textContent = `Compute: ${effectiveTask.expression}`;
    box.appendChild(expr);

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.placeholder = "Type the answer and press Enter";
    input.value = getResponseValue(task.id) || "";
    input.disabled = locked;
    box.appendChild(input);
    // IMPORTANT: do not provide RT/correctness feedback to respondents.
    // All timing + attempts are saved in output files for QC, but the UI stays neutral.

    function ensureMeta() {
      const cur = getResponseMeta(task.id) || {};
      return {
        // Store the generated task in meta for transparency + resume safety
        task: {
          kind: effectiveTask.kind,
          expression: effectiveTask.expression,
          correctAnswer: effectiveTask.correctAnswer,
          between: effectiveTask.between || null
        },
        attempts: Array.isArray(cur.attempts) ? cur.attempts : [],
        currentFocusAtIso: cur.currentFocusAtIso || null,
        currentFocusAtMs: cur.currentFocusAtMs || null,
        locked: !!cur.locked
      };
    }

    input.addEventListener("focus", () => {
      const meta = ensureMeta();
      // Start timing for this attempt.
      meta.currentFocusAtIso = nowIso();
      meta.currentFocusAtMs = Date.now();
      setResponseMeta(task.id, meta);
      persistState("autosave");
    });

    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();

      const answerRaw = String(input.value || "").trim();
      if (!answerRaw) return;

      const meta = ensureMeta();
      const submitAtMs = Date.now();

      const rtMs = meta.currentFocusAtMs ? Math.max(0, submitAtMs - meta.currentFocusAtMs) : null;
      const parsed = Number(answerRaw);
      const answerNumeric = Number.isFinite(parsed) ? parsed : null;
      const correct = answerNumeric !== null && answerNumeric === effectiveTask.correctAnswer;

      const attemptNo = meta.attempts.length + 1;
      meta.attempts.push({
        attemptNo,
        focusAt: meta.currentFocusAtIso,
        submitAt: nowIso(),
        rtMs,
        answerRaw,
        answerNumeric,
        correct
      });

      // After an Enter, force a new focus to start timing again
      meta.currentFocusAtIso = null;
      meta.currentFocusAtMs = null;

      // Lock after max attempts
      if (meta.attempts.length >= effectiveTask.maxAttempts) meta.locked = true;

      setResponse(task.id, answerRaw, null, meta);
      persistState("autosave");

      // Force blur so next attempt must start with a focus
      try { input.blur(); } catch { }

      render();
    });

    // If already max attempts, lock.
    const metaNow = ensureMeta();
    if (metaNow.attempts.length >= task.maxAttempts && !metaNow.locked) {
      metaNow.locked = true;
      setResponseMeta(task.id, metaNow);
      persistState("autosave");
    }

    elApp.appendChild(box);
  }

  function renderSvo(page) {
    const intro = document.createElement("div");
    intro.className = "svoIntro";
    intro.textContent = page.intro;
    elApp.appendChild(intro);

    if (page.example) {
      const box = document.createElement("div");
      box.className = "svoExampleBox";

      const t = document.createElement("div");
      t.className = "svoExampleTitle";
      t.textContent = "Example:";
      box.appendChild(t);

      const ex = renderSvoSlider({
        id: "svo_example",
        num: "Example",
        you: page.example.you,
        other: page.example.other,
        readonly: true,
        presetIndex: page.example.chosenIndex
      });
      box.appendChild(ex);

      elApp.appendChild(box);
    }

    const list = document.createElement("div");

    for (const it of page.items) {
      const slider = renderSvoSlider({
        id: it.id,
        num: it.num,
        you: it.you,
        other: it.other,
        readonly: false,
        presetIndex: getResponseValue(it.id)
      });
      list.appendChild(slider);
    }

    elApp.appendChild(list);
  }

  function renderSvoSlider({ id, num, you, other, readonly, presetIndex }) {
    const wrap = document.createElement("div");
    wrap.className = "svoItem";
    wrap.dataset.qid = String(id);

    const arrow = document.createElement("div");
    arrow.className = "svoArrow";
    arrow.textContent = String(num);
    wrap.appendChild(arrow);

    const card = document.createElement("div");
    card.className = "svoCard";

    const row1 = document.createElement("div");
    row1.className = "svoRow";
    const lab1 = document.createElement("div");
    lab1.className = "svoRowLabel";
    lab1.textContent = "You receive";
    const boxes1 = document.createElement("div");
    boxes1.className = "svoBoxes";
    you.forEach((v) => {
      const b = document.createElement("div");
      b.className = "svoBox";
      b.textContent = String(v);
      boxes1.appendChild(b);
    });
    row1.appendChild(lab1);
    row1.appendChild(boxes1);

    const mid = document.createElement("div");
    mid.className = "svoMidline";

    const line = document.createElement("div");
    line.className = "svoLine";

    const ticks = document.createElement("div");
    ticks.className = "svoTicks";
    const tickEls = [];
    for (let i = 0; i < 9; i++) {
      const tk = document.createElement("div");
      tk.className = "svoTick";
      ticks.appendChild(tk);
      tickEls.push(tk);
    }

    const knob = document.createElement("div");
    knob.className = "svoKnob";

    const range = document.createElement("input");
    range.type = "range";
    range.className = "svoRange";
    range.min = "0";
    range.max = "8";
    range.step = "1";
    range.disabled = !!readonly;

    mid.appendChild(line);
    mid.appendChild(ticks);
    mid.appendChild(knob);
    mid.appendChild(range);

    const row2 = document.createElement("div");
    row2.className = "svoRow";
    const lab2 = document.createElement("div");
    lab2.className = "svoRowLabel";
    lab2.textContent = "Other receives";
    const boxes2 = document.createElement("div");
    boxes2.className = "svoBoxes";
    other.forEach((v) => {
      const b = document.createElement("div");
      b.className = "svoBox";
      b.textContent = String(v);
      boxes2.appendChild(b);
    });
    row2.appendChild(lab2);
    row2.appendChild(boxes2);

    card.appendChild(row1);
    card.appendChild(mid);
    card.appendChild(row2);

    wrap.appendChild(card);

    const write = document.createElement("div");
    write.className = "svoWrite";

    const outYou = document.createElement("input");
    outYou.type = "text";
    outYou.className = "svoWriteLine";
    outYou.inputMode = "numeric";
    outYou.autocomplete = "off";

    const outOther = document.createElement("input");
    outOther.type = "text";
    outOther.className = "svoWriteLine";
    outOther.inputMode = "numeric";
    outOther.autocomplete = "off";

    // PDF instruction: participant writes the resulting distribution on the right.
    // We store BOTH the slider choice AND the typed values.
    const r1 = document.createElement("div");
    r1.className = "svoWriteRow";
    r1.appendChild(document.createTextNode("You"));
    r1.appendChild(outYou);

    const r2 = document.createElement("div");
    r2.className = "svoWriteRow";
    r2.appendChild(document.createTextNode("Other"));
    r2.appendChild(outOther);

    write.appendChild(r1);
    write.appendChild(r2);

    // Trial-only verification line (clearly marked)
    const trialLine = IS_TRIAL ? document.createElement("div") : null;
    if (trialLine) {
      trialLine.className = "small";
      trialLine.style.marginTop = "6px";
      trialLine.style.whiteSpace = "pre-wrap";
      trialLine.style.opacity = "0.9";
      write.appendChild(trialLine);
    }

    wrap.appendChild(write);

    // Determine initial slider index from saved response
    const initial =
      presetIndex !== null && presetIndex !== undefined && String(presetIndex).trim() !== ""
        ? Number(presetIndex)
        : null;

    // Range must always have a value, but we only consider it "answered" when we commit (setResponse).
    range.value = initial !== null && Number.isFinite(initial) ? String(clamp(initial, 0, 8)) : "0";

    // Load typed values from meta
    function getWritten() {
      const meta = getResponseMeta(id);
      return meta && meta.svoWritten ? meta.svoWritten : null;
    }

    function setWrittenMeta() {
      if (readonly) return;

      const youRaw = String(outYou.value || "").trim();
      const otherRaw = String(outOther.value || "").trim();

      // Strict numeric parsing (v16): SVO written values must be integers.
      // This avoids edge cases like "50.0" or " 50 " silently passing.
      function parseStrictInt(raw) {
        const s = String(raw || "").trim();
        if (!s) return null;
        if (!/^\d+$/.test(s)) return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
      }

      const youNum = parseStrictInt(youRaw);
      const otherNum = parseStrictInt(otherRaw);

      const meta = recordSvoInteraction(id, "written") || (getResponseMeta(id) || {});
      meta.svoWritten = {
        youRaw,
        otherRaw,
        youNum,
        otherNum,
        editedAt: nowIso()
      };

      setResponseMeta(id, meta);
      persistState("autosave");
      setPageMeta(PAGES[state.pageIndex]);

      // Update trial helper
      if (trialLine) refreshTrialLine();
    }

    if (!readonly) {
      const w = getWritten();
      if (w) {
        outYou.value = w.youRaw || "";
        outOther.value = w.otherRaw || "";
      }

      outYou.addEventListener("input", setWrittenMeta);
      outOther.addEventListener("input", setWrittenMeta);
    }

    // Helper: precise knob position aligned to tick centers
    function knobLeftForIndex(idx) {
      const i = clamp(idx, 0, 8);
      const t = tickEls[i];
      const midRect = mid.getBoundingClientRect();
      const tRect = t.getBoundingClientRect();
      return (tRect.left - midRect.left) + (tRect.width / 2);
    }

    let currentIdx = null;
    let committed = false;

    function setSelectedColumn(idx, isCommitted) {
      currentIdx = clamp(idx, 0, 8);
      committed = !!isCommitted;

      // Highlight selected number boxes + tick
      [...boxes1.children].forEach((el, i) => el.classList.toggle("selected", committed && i === currentIdx));
      [...boxes2.children].forEach((el, i) => el.classList.toggle("selected", committed && i === currentIdx));
      tickEls.forEach((el, i) => el.classList.toggle("selected", committed && i === currentIdx));

      // Dot visibility
      knob.style.display = committed ? "block" : "none";

      // Position the dot AFTER layout (needed for exact alignment)
      const place = () => {
        if (!mid.isConnected || mid.offsetWidth === 0) {
          requestAnimationFrame(place);
          return;
        }
        knob.style.left = `${knobLeftForIndex(currentIdx)}px`;
      };
      place();

      // Trial helper
      if (trialLine) refreshTrialLine();
    }

    function refreshTrialLine() {
      if (!trialLine) return;
      if (currentIdx === null || !committed) {
        trialLine.textContent = "TRIAL VERIFICATION: (no slider choice yet)";
        return;
      }

      const expectedYou = you[currentIdx];
      const expectedOther = other[currentIdx];

      const w = getWritten() || {};
      const wy = (w.youRaw !== undefined) ? w.youRaw : "";
      const wo = (w.otherRaw !== undefined) ? w.otherRaw : "";
      const matches = (Number.isFinite(w.youNum) && Number.isFinite(w.otherNum))
        ? (w.youNum === expectedYou && w.otherNum === expectedOther)
        : false;

      trialLine.textContent =
        `TRIAL VERIFICATION:\n` +
        `  sliderIndex: ${currentIdx} (column ${currentIdx + 1} of 9)\n` +
        `  expected:    You=${expectedYou}, Other=${expectedOther}\n` +
        `  written:     You=${wy || "(blank)"}, Other=${wo || "(blank)"}\n` +
        `  match:       ${matches}`;
    }

    // Read-only example: show chosen distribution on the right
    if (readonly) {
      outYou.readOnly = true;
      outOther.readOnly = true;

      const idx = Number.isFinite(Number(initial)) ? clamp(Number(initial), 0, 8) : 0;
      outYou.value = String(you[idx]);
      outOther.value = String(other[idx]);

      setSelectedColumn(idx, true);
      range.value = String(idx);
      return wrap;
    }

    // Interactive items
    if (initial !== null && Number.isFinite(initial)) {
      setSelectedColumn(initial, true);
    } else {
      // No answer yet: keep dot hidden until committed.
      setSelectedColumn(0, false);
    }

    function commitIndex(idx) {
      const clamped = clamp(idx, 0, 8);
      range.value = String(clamped);
      setSelectedColumn(clamped, true);
      recordSvoInteraction(id, "slider");
      setResponse(id, clamped);
      persistState("autosave");
      setPageMeta(PAGES[state.pageIndex]);
    }

    range.addEventListener("input", () => {
      const idx = Number(range.value);
      // Visual feedback while dragging, but do not commit until change.
      setSelectedColumn(idx, true);
    });

    range.addEventListener("change", () => {
      commitIndex(Number(range.value));
    });

    // Click-to-select boxes (top and bottom)
    [...boxes1.children].forEach((boxEl, idx) => {
      boxEl.style.cursor = "pointer";
      boxEl.addEventListener("click", () => commitIndex(idx));
    });
    [...boxes2.children].forEach((boxEl, idx) => {
      boxEl.style.cursor = "pointer";
      boxEl.addEventListener("click", () => commitIndex(idx));
    });

    // Re-align dots on resize (important for exact tick alignment)
    window.addEventListener("resize", () => {
      if (currentIdx !== null && committed) {
        // Just re-place; keep highlights.
        const place = () => {
          if (!mid.isConnected || mid.offsetWidth === 0) {
            requestAnimationFrame(place);
            return;
          }
          knob.style.left = `${knobLeftForIndex(currentIdx)}px`;
        };
        place();
      }
    });

    // Initial trial hint
    if (trialLine) refreshTrialLine();

    return wrap;
  }

  function renderFinish(page) {
    const note = document.createElement("div");
    note.className = "note";
    note.textContent =
      "Thank you. Your responses have been saved automatically.";
    elApp.appendChild(note);

    // Prolific return link (configurable via config.js → prolificReturnUrl)
    const prolificReturnUrl = (USER_CFG.prolificReturnUrl)
      ? String(USER_CFG.prolificReturnUrl).trim()
      : "";

    if (prolificReturnUrl) {
      const wrap = document.createElement("div");
      wrap.style.margin = "24px 0";
      wrap.style.textAlign = "center";

      const msg = document.createElement("p");
      msg.style.marginBottom = "12px";
      msg.textContent = "Please click the button below to return to Prolific and confirm your submission:";
      wrap.appendChild(msg);

      const link = document.createElement("a");
      link.href = prolificReturnUrl;
      link.textContent = "Return to Prolific";
      link.className = "btn btn--primary";
      link.style.display = "inline-block";
      link.style.padding = "12px 32px";
      link.style.fontSize = "1.1em";
      link.style.textDecoration = "none";
      wrap.appendChild(link);

      elApp.appendChild(wrap);
    } else {
      const p = document.createElement("p");
      p.textContent = "You can close this tab/window now.";
      elApp.appendChild(p);
    }

    if (IS_TRIAL) {
      const p2 = document.createElement("p");
      p2.className = "small";
      p2.textContent =
        "Trial mode: your responses are still saved automatically to the server. " +
        "(If you enabled ?debug=1, you can also use the debug tools in the footer to check server saving.)";
      elApp.appendChild(p2);
    }
  }

  function renderTerminated(page) {
    const err = document.createElement("div");
    err.className = "error";
    const reason = String(state.meta.terminatedReason || "");
    if (reason === "underage") {
      err.textContent = "You are not eligible to participate. The survey has ended.";
    } else {
      err.textContent = "You selected NO consent. The survey has ended.";
    }
    elApp.appendChild(err);

    const p = document.createElement("p");
    p.textContent = "You can close this tab/window now.";
    elApp.appendChild(p);
  }

  /* =========================
     NAVIGATION
     ========================= */

  function gotoPageIndex(newIndex) {
    const currentPage = PAGES[state.pageIndex];
    if (currentPage) recordTimeOnCurrentPage(currentPage.id);

    const nextIndex = clamp(newIndex, 0, PAGES.length - 1);
    const nextPage = PAGES[nextIndex] || null;

    // Mark completion when reaching the finish page.
    if (nextPage && nextPage.type === "finish" && !state.completedAt) {
      state.completedAt = nowIso();
    }

    state.pageIndex = nextIndex;
    persistState("page");
    render();
  }

  function gotoPageById(id) {
    const idx = PAGES.findIndex((p) => p.id === id);
    if (idx >= 0) gotoPageIndex(idx);
  }

  if (btnPrev && CONFIG.ui.showPrev) {
    btnPrev.addEventListener("click", () => {
      gotoPageIndex(state.pageIndex - 1);
    });
  }

  if (btnNext) btnNext.addEventListener("click", () => {
    const page = PAGES[state.pageIndex];
    if (!page) return;

    const missing = validatePage(page);
    if (missing.length > 0) {
      showValidationError(page, missing);
      return;
    }

    // Consent + age gate (redundant safety)
    if (page.id === "consent_age") {
      const consent = String(getResponseValue("demo_q18") || "");
      if (consent !== "Yes") {
        state.meta.terminatedReason = "no_consent";
        persistState("autosave");
        gotoPageById(TERMINATED_PAGE_ID);
        return;
      }

      const ageRaw = getResponseValue("demo_q01");
      const age = Number(String(ageRaw || "").trim());
      const minAge = Number(page.ageGateMin || 18);
      if (!Number.isFinite(age) || age < minAge) {
        state.meta.terminatedReason = "underage";
        persistState("autosave");
        gotoPageById(TERMINATED_PAGE_ID);
        return;
      }
    }

    gotoPageIndex(state.pageIndex + 1);
  });

  function showValidationError(page, missing) {
    const old = elApp.querySelector(".error");
    if (old) old.remove();

    const err = document.createElement("div");
    err.className = "error";

    if (page.type === "likert") {
      const nums = missing
        .slice(0, 12)
        .map((it) => (it.displayNum !== undefined && it.displayNum !== null) ? it.displayNum : it.num);
      const more = missing.length > 12 ? ` (+${missing.length - 12} more)` : "";
      err.textContent = `Please answer every statement on this page before continuing. Missing item(s): ${nums.join(", ")}${more}`;
    } else if (page.type === "svo") {
      // Clear previous highlights
      elApp.querySelectorAll(".svoItem").forEach((el) => el.classList.remove("mismatch"));

      // Highlight all problematic items (missing or mismatch)
      for (const it of missing) {
        const qid = it && it.id ? it.id : null;
        if (!qid) continue;
        const row = elApp.querySelector(`.svoItem[data-qid="${CSS.escape(String(qid))}"]`);
        if (row) row.classList.add("mismatch");
      }

      const mismatches = missing.filter((it) => !!it._mismatch);
      const missingOnly = missing.filter((it) => !it._mismatch);

      const parts = [];
      if (missingOnly.length) {
        const nums = missingOnly.slice(0, 12).map((it) => it.num);
        const more = missingOnly.length > 12 ? ` (+${missingOnly.length - 12} more)` : "";
        parts.push(`Missing mark/entry: ${nums.join(", ")}${more}`);
      }
      if (mismatches.length) {
        const nums = mismatches.slice(0, 12).map((it) => it.num);
        const more = mismatches.length > 12 ? ` (+${mismatches.length - 12} more)` : "";
        parts.push(`Written numbers do not match the marked column: ${nums.join(", ")}${more}`);
      }

      err.textContent =
        "For each SVO question, please mark one column AND write the resulting distribution (You and Other). " +
        (parts.length ? parts.join(" • ") : "");
    } else if (page.type === "demographics") {
      const labels = missing
        .slice(0, 10)
        .map((q) => `${q.num}. ${q.title}${q._needsExtra ? " (please specify)" : ""}`);
      const more = missing.length > 10 ? ` (+${missing.length - 10} more)` : "";
      err.textContent = `Please complete the required field(s): ${labels.join("; ")}${more}`;
    } else if (page.type === "mfq") {
      const nums = missing.slice(0, 12).map((it) => it.num);
      const more = missing.length > 12 ? ` (+${missing.length - 12} more)` : "";
      err.textContent = `Please answer every item on this page before continuing. Missing item(s): ${nums.join(", ")}${more}`;
    } else if (page.type === "math") {
      err.textContent = "Please submit your answer by pressing Enter before continuing.";
    } else {
      err.textContent = "Please complete required items on this page.";
    }

    elApp.prepend(err);
    window.scrollTo(0, 0);
  }

  /* =========================
     SCORING MAPS (transparent)
     ========================= */

  // HEXACO 100 scoring keys from ScoringKeys_100 HEXACO.pdf
  const HEXACO_KEYS = {
    "Honesty-Humility": {
      Sincerity: [6, 30, 54, 78],
      Fairness: [12, 36, 60, 84],
      "Greed-Avoidance": [18, 42, 66, 90],
      Modesty: [24, 48, 72, 96]
    },
    Emotionality: {
      Fearfulness: [5, 29, 53, 77],
      Anxiety: [11, 35, 59, 83],
      Dependence: [17, 41, 65, 89],
      Sentimentality: [23, 47, 71, 95]
    },
    Extraversion: {
      "Social Self-Esteem": [4, 28, 52, 76],
      "Social Boldness": [10, 34, 58, 82],
      Sociability: [16, 40, 64, 88],
      Liveliness: [22, 46, 70, 94]
    },
    Agreeableness: {
      Forgiveness: [3, 27, 51, 75],
      Gentleness: [9, 33, 57, 81],
      Flexibility: [15, 39, 63, 87],
      Patience: [21, 45, 69, 93]
    },
    Conscientiousness: {
      Organization: [2, 26, 50, 74],
      Diligence: [8, 32, 56, 80],
      Perfectionism: [14, 38, 62, 86],
      Prudence: [20, 44, 68, 92]
    },
    "Openness to Experience": {
      "Aesthetic Appreciation": [1, 25, 49, 73],
      Inquisitiveness: [7, 31, 55, 79],
      Creativity: [13, 37, 61, 85],
      Unconventionality: [19, 43, 67, 91]
    },
    "(interstitial) Altruism": {
      Altruism: [97, 98, 99, 100]
    }
  };

  // MFQ foundation mapping from MFQ30.item-key.doc
  const MFQ_KEYS = {
    Harm: {
      part1: ["EMOTIONALLY", "WEAK", "CRUEL"],
      part2: ["COMPASSION", "ANIMAL", "KILL"]
    },
    Fairness: {
      part1: ["TREATED", "UNFAIRLY", "RIGHTS"],
      part2: ["FAIRLY", "JUSTICE", "RICH"]
    },
    Ingroup: {
      part1: ["LOVECOUNTRY", "BETRAY", "LOYALTY"],
      part2: ["HISTORY", "FAMILY", "TEAM"]
    },
    Authority: {
      part1: ["RESPECT", "TRADITIONS", "CHAOS"],
      part2: ["KIDRESPECT", "SEXROLES", "SOLDIER"]
    },
    Purity: {
      part1: ["DECENCY", "DISGUSTING", "GOD"],
      part2: ["HARMLESSDG", "UNNATURAL", "CHASTITY"]
    }
  };

  /* =========================
     EXPORT (JSON + TSV + ZIP)
     ========================= */

  function buildOutput() {
    const output = {
      meta: {
        version: state.version,
        mode: CONFIG.mode,
        sessionId: state.sessionId,
        sessionKey: (state.meta && state.meta.sessionKey) ? state.meta.sessionKey : `${state.sessionId}__${CONFIG.mode}`,
        prolificId: (state.meta && state.meta.prolificId) ? state.meta.prolificId : null,
        prolificIdSource: (state.meta && state.meta.prolificIdSource) ? state.meta.prolificIdSource : null,
        prolificStudyId: (state.meta && state.meta.prolificStudyId) ? state.meta.prolificStudyId : null,
        prolificSessionId: (state.meta && state.meta.prolificSessionId) ? state.meta.prolificSessionId : null,
        participantIndex: (state.meta && state.meta.participantIndex !== undefined) ? state.meta.participantIndex : null,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        lastAutosaveAt: state.autosave.lastSavedAt,
        autosaveSeq: state.autosave.seq,
        storageOk: state.meta.storageOk,
        terminatedReason: state.meta.terminatedReason || null,
        serverLastSavedAt: state.autosave.lastServerSavedAt || null,
        serverLastSaveOk: (typeof state.autosave.lastServerSaveOk === "boolean") ? state.autosave.lastServerSaveOk : null,
        serverLastSaveError: state.autosave.lastServerSaveError || null,
        pageMs: state.pageMs,

        userAgent: state.meta.userAgent,
        language: state.meta.language,
        platform: state.meta.platform,
        timezoneOffsetMinutes: state.meta.timezoneOffsetMinutes,
        screen: state.meta.screen,

        // Deterministic randomization/presentation info (audit-friendly)
        randomization: state.meta.randomization || {},
        flow: state.meta.flow || null,
        settings: state.meta.settings || null,
        presentation: {
          ipip120: (PRESENTATION && DATA.ipip120 && PRESENTATION[DATA.ipip120.id])
            ? {
              instrumentId: PRESENTATION[DATA.ipip120.id].instrumentId,
              randomized: PRESENTATION[DATA.ipip120.id].randomized,
              renumberDisplay: PRESENTATION[DATA.ipip120.id].renumberDisplay,
              orderMode: PRESENTATION[DATA.ipip120.id].orderMode,
              globalSeed: PRESENTATION[DATA.ipip120.id].globalSeed,
              seedSalt: PRESENTATION[DATA.ipip120.id].seedSalt,
              seed: PRESENTATION[DATA.ipip120.id].seed,
              order: PRESENTATION[DATA.ipip120.id].order
            }
            : null
        }
      },
      responses: {
        demographics: exportDemographics(),
        math_checks: exportMathChecks(),
        hexaco100: exportLikertInstrument(DATA.hexaco100),
        ipip120: exportLikertInstrument(DATA.ipip120),
        mfq30: exportMfq(),
        d70: exportLikertInstrument(DATA.d70),
        svo: exportSvo()
      },
      scores: computeAllScores()
    };

    return output;
  }

  function extractTiming(meta) {
    if (!meta || typeof meta !== "object") return null;
    return {
      firstAnsweredAt: meta.firstAnsweredAt || null,
      firstRtMs: Number.isFinite(Number(meta.firstRtMs)) ? Number(meta.firstRtMs) : null,
      lastChangedAt: meta.lastChangedAt || null,
      lastRtMs: Number.isFinite(Number(meta.lastRtMs)) ? Number(meta.lastRtMs) : null,
      changedCount: Number.isFinite(Number(meta.changedCount)) ? Number(meta.changedCount) : null,
      pageId: meta.pageId || null,
      pageIndex: Number.isFinite(Number(meta.pageIndex)) ? Number(meta.pageIndex) : null,
      lastInteractionType: meta.lastInteractionType || null,
      lastInteractionDetail: (meta.lastInteractionDetail !== undefined) ? meta.lastInteractionDetail : null
    };
  }

  function exportDemographics() {
    const demo = DATA.demographics;
    const out = [];

    for (const q of demo.questions) {
      const resp = state.responses[q.id] || null;
      out.push({
        id: q.id,
        num: q.num,
        title: q.title,
        question: q.text,
        response: resp ? resp.value : null,
        extraText: resp ? resp.extraText : null,
        timing: extractTiming(resp ? resp.meta : null)
      });
    }

    return out;
  }

  function exportMathChecks() {
    // Export ONLY the math pages that were actually included in this run
    // (because math checks can be toggled in the launcher).
    const mathPages = Array.isArray(PAGES) ? PAGES.filter((p) => p && p.type === "math") : [];

    return mathPages.map((p) => {
      const qid = p.task && p.task.id ? p.task.id : p.id;
      const resp = state.responses[qid] || null;
      const meta = resp && resp.meta ? resp.meta : null;
      const attempts = meta && Array.isArray(meta.attempts) ? meta.attempts : [];
      const taskMeta = meta && meta.task ? meta.task : null;

      const task = taskMeta || p.task || {};

      return {
        id: qid,
        between: task.between || (p.task ? p.task.between : null) || null,
        kind: task.kind || null,
        expression: task.expression || null,
        correctAnswer: (typeof task.correctAnswer === "number") ? task.correctAnswer : null,
        response: resp ? resp.value : null,
        attempts
      };
    });
  }

  function exportLikertInstrument(instrument) {
    const scale = instrument.scale;
    const out = [];

    const pres = PRESENTATION && PRESENTATION[instrument.id] ? PRESENTATION[instrument.id] : null;
    const presMap = pres && pres.map ? pres.map : null;

    for (const it of instrument.items) {
      const resp = state.responses[it.id] || null;
      const raw = resp ? resp.value : null;
      const rawLabel = raw === null ? null : optionLabel(scale, raw);

      const reverseKeyed = !!it.reverse;
      const scored = raw === null || raw === undefined || raw === "" ? null : (reverseKeyed ? reverseScore_1to5(raw) : Number(raw));
      const scoredLabel = scored === null ? null : optionLabel(scale, scored);

      const presEntry = presMap && presMap[it.id] ? presMap[it.id] : null;
      const presentedIndex = presEntry ? presEntry.presentedIndex : null;
      const presentedNum = presEntry ? presEntry.presentedNum : it.num;

      out.push({
        id: it.id,
        num: it.num,
        presentedIndex,
        presentedNum,
        text: it.text,
        facet: it.facet || null,
        key: it.key || null,

        response: {
          value: raw,
          label: rawLabel
        },

        reverseKeyed,
        reverseFormula: reverseKeyed ? (scale.reverseFormula || "6 - value") : null,

        scored: {
          value: scored,
          label: scoredLabel
        },

        timing: extractTiming(resp ? resp.meta : null)
      });
    }

    return out;
  }

  function exportMfq() {
    const p1 = DATA.mfq30.part1;
    const p2 = DATA.mfq30.part2;

    function exportPart(part) {
      const scale = part.scale;
      const items = [];
      for (const it of part.items) {
        const resp = state.responses[it.id] || null;
        const raw = resp ? resp.value : null;
        const rawLabel = raw === null ? null : optionLabel(scale, raw);

        items.push({
          id: it.id,
          num: it.num,
          var: it.var,
          text: it.text,
          scoredItem: !!it.scored,
          response: { value: raw, label: rawLabel },
          timing: extractTiming(resp ? resp.meta : null)
        });
      }
      return {
        title: part.title,
        scale: part.scale,
        items
      };
    }

    return {
      part1: exportPart(p1),
      part2: exportPart(p2)
    };
  }


  function exportSvo() {
    const out = [];

    for (const it of DATA.svo.items) {
      const resp = state.responses[it.id] || null;
      const idx = resp ? Number(resp.value) : null;
      const chosen = idx === null || !Number.isFinite(idx) ? null : clamp(idx, 0, 8);

      const expectedYou = chosen === null ? null : it.you[chosen];
      const expectedOther = chosen === null ? null : it.other[chosen];

      const meta = resp && resp.meta ? resp.meta : null;
      const w = (meta && meta.svoWritten) ? meta.svoWritten : null;

      const youWrittenRaw = w ? (w.youRaw ?? null) : null;
      const otherWrittenRaw = w ? (w.otherRaw ?? null) : null;
      const youWrittenNum = w && Number.isFinite(Number(w.youNum)) ? Number(w.youNum) : null;
      const otherWrittenNum = w && Number.isFinite(Number(w.otherNum)) ? Number(w.otherNum) : null;

      const writtenMatchesExpected = (
        expectedYou !== null && expectedOther !== null &&
        youWrittenNum !== null && otherWrittenNum !== null &&
        youWrittenNum === expectedYou && otherWrittenNum === expectedOther
      );

      out.push({
        id: it.id,
        num: it.num,

        // Slider choice
        choiceIndex: chosen,
        youReceive: expectedYou,
        otherReceives: expectedOther,

        // Written amounts (participant)
        written: {
          youRaw: youWrittenRaw,
          otherRaw: otherWrittenRaw,
          youNum: youWrittenNum,
          otherNum: otherWrittenNum,
          matchesExpected: writtenMatchesExpected,
          editedAt: w ? (w.editedAt ?? null) : null
        },

        // Full option set (audit-friendly)
        options: {
          youReceive: it.you,
          otherReceives: it.other
        },

        timing: {
          generic: extractTiming(meta),
          slider: (meta && meta.svoTiming && meta.svoTiming.slider) ? meta.svoTiming.slider : null,
          written: (meta && meta.svoTiming && meta.svoTiming.written) ? meta.svoTiming.written : null
        }
      });
    }

    return out;
  }

  /* ---------- Scores (transparent & checkable) ---------- */

  function mean(nums) {
    const finite = nums.filter((x) => Number.isFinite(x));
    if (finite.length === 0) return null;
    return finite.reduce((a, b) => a + b, 0) / finite.length;
  }

  function sum(nums) {
    const finite = nums.filter((x) => Number.isFinite(x));
    if (finite.length === 0) return null;
    return finite.reduce((a, b) => a + b, 0);
  }

  function scoredValueForInstrumentItem(instrument, item) {
    const raw = getResponseValue(item.id);
    if (raw === null || raw === undefined || raw === "") return null;
    if (item.reverse) return reverseScore_1to5(raw);
    return Number(raw);
  }

  function computeHexacoScores() {
    const inst = DATA.hexaco100;

    // map num -> item
    const numToItem = new Map(inst.items.map((it) => [it.num, it]));

    const facets = {};
    const factors = {};

    for (const factorName of Object.keys(HEXACO_KEYS)) {
      factors[factorName] = { facets: {}, mean: null, sum: null, nItems: 0, items: [] };

      const facetObj = HEXACO_KEYS[factorName];
      for (const facetName of Object.keys(facetObj)) {
        const nums = facetObj[facetName];
        const itemDetails = nums.map((n) => {
          const it = numToItem.get(n);
          if (!it) return { num: n, id: null, scoredValue: null, reverseKeyed: null };
          const scored = scoredValueForInstrumentItem(inst, it);
          return {
            num: it.num,
            id: it.id,
            reverseKeyed: !!it.reverse,
            rawValue: getResponseValue(it.id),
            scoredValue: scored
          };
        });

        const facetVals = itemDetails.map((d) => d.scoredValue);
        const facetSum = sum(facetVals);
        const facetMean = mean(facetVals);

        facets[facetName] = {
          factor: factorName,
          sum: facetSum,
          mean: facetMean,
          nItems: itemDetails.length,
          items: itemDetails
        };

        factors[factorName].facets[facetName] = facetMean;
        factors[factorName].items.push(...itemDetails);
      }

      // Factor mean across all item scored values (excluding altruism is handled by key structure)
      const factorVals = factors[factorName].items.map((d) => d.scoredValue);
      factors[factorName].sum = sum(factorVals);
      factors[factorName].mean = mean(factorVals);
      factors[factorName].nItems = factors[factorName].items.length;
    }

    return { facets, factors };
  }

  function computeIpipScores() {
    const inst = DATA.ipip120;

    const facets = {};
    const domains = {};

    // group by facet label
    for (const it of inst.items) {
      const facet = it.facet || "(unknown facet)";
      facets[facet] = facets[facet] || { items: [], sum: null, mean: null };

      const scored = scoredValueForInstrumentItem(inst, it);
      facets[facet].items.push({
        id: it.id,
        num: it.num,
        key: it.key || null,
        reverseKeyed: !!it.reverse,
        rawValue: getResponseValue(it.id),
        scoredValue: scored
      });
    }

    for (const facetName of Object.keys(facets)) {
      const vals = facets[facetName].items.map((d) => d.scoredValue);
      facets[facetName].sum = sum(vals);
      facets[facetName].mean = mean(vals);

      // domain = leading letter before digit (N, E, O, A, C)
      const m = facetName.match(/^([NEOAC])\d/);
      const dom = m ? m[1] : "?";
      domains[dom] = domains[dom] || { facets: {}, mean: null, sum: null, nItems: 0, items: [] };
      domains[dom].facets[facetName] = facets[facetName].mean;
      domains[dom].items.push(...facets[facetName].items);
    }

    for (const dom of Object.keys(domains)) {
      const vals = domains[dom].items.map((d) => d.scoredValue);
      domains[dom].sum = sum(vals);
      domains[dom].mean = mean(vals);
      domains[dom].nItems = domains[dom].items.length;
    }

    return { facets, domains };
  }

  function computeMfqScores() {
    const p1 = DATA.mfq30.part1;
    const p2 = DATA.mfq30.part2;

    // var -> scored value
    const mapVarToValue = (part) => {
      const out = {};
      for (const it of part.items) {
        const raw = getResponseValue(it.id);
        const val = raw === null || raw === undefined || raw === "" ? null : Number(raw);
        out[it.var] = {
          id: it.id,
          num: it.num,
          scoredItem: !!it.scored,
          value: Number.isFinite(val) ? val : null
        };
      }
      return out;
    };

    const p1v = mapVarToValue(p1);
    const p2v = mapVarToValue(p2);

    const foundations = {};

    for (const foundation of Object.keys(MFQ_KEYS)) {
      const vars1 = MFQ_KEYS[foundation].part1;
      const vars2 = MFQ_KEYS[foundation].part2;

      const items1 = vars1.map((v) => ({ var: v, ...(p1v[v] || {}) }));
      const items2 = vars2.map((v) => ({ var: v, ...(p2v[v] || {}) }));

      const vals1 = items1.map((x) => x.value);
      const vals2 = items2.map((x) => x.value);
      const combinedVals = [...vals1, ...vals2];

      foundations[foundation] = {
        part1: {
          sum: sum(vals1),
          mean: mean(vals1),
          nItems: items1.length,
          items: items1
        },
        part2: {
          sum: sum(vals2),
          mean: mean(vals2),
          nItems: items2.length,
          items: items2
        },
        combined: {
          sum: sum(combinedVals),
          mean: mean(combinedVals),
          nItems: items1.length + items2.length,
          items: [...items1, ...items2]
        }
      };
    }

    return {
      foundations,
      catchItems: {
        MATH: p1v.MATH || null,
        GOOD: p2v.GOOD || null
      }
    };
  }

  function computeD70Scores() {
    const inst = DATA.d70;
    const vals = inst.items.map((it) => scoredValueForInstrumentItem(inst, it));
    return {
      mean: mean(vals),
      sum: sum(vals),
      nItems: inst.items.length,
      reverseFormula: inst.scale && inst.scale.reverseFormula ? inst.scale.reverseFormula : "6 - value",
      reverseKeyedItems: inst.items.filter((it) => it.reverse).map((it) => ({ num: it.num, id: it.id }))
    };
  }


  function computeSvoScores() {
    const items = (DATA.svo && Array.isArray(DATA.svo.items)) ? DATA.svo.items : [];

    // SVO Slider Measure: primary items are typically the first 6 items (1–6).
    // We compute the SVO angle from the mean (You, Other) allocations of these primary items.
    const primaryItems = items.filter((it) => Number(it.num) >= 1 && Number(it.num) <= 6);

    const primaryAllocations = [];
    for (const it of primaryItems) {
      const resp = state.responses[it.id] || null;
      const idx = resp ? Number(resp.value) : null;
      if (idx === null || !Number.isFinite(idx)) continue;

      const choice = clamp(idx, 0, 8);
      const you = it.you[choice];
      const other = it.other[choice];

      primaryAllocations.push({
        id: it.id,
        num: it.num,
        choiceIndex: choice,
        youReceive: you,
        otherReceives: other
      });
    }

    const meanYou = mean(primaryAllocations.map((x) => x.youReceive));
    const meanOther = mean(primaryAllocations.map((x) => x.otherReceives));

    let angleDeg = null;
    if (Number.isFinite(meanYou) && Number.isFinite(meanOther)) {
      // Center point is (50, 50) in the SVO Slider Measure.
      const dx = meanYou - 50;
      const dy = meanOther - 50;
      angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    }

    function classifyAngle(angle) {
      if (!Number.isFinite(angle)) return null;

      // Common SVO category cutoffs (degrees):
      // competitive:      < -12.04
      // individualistic: [-12.04, 22.45)
      // prosocial:       [22.45, 57.15)
      // altruistic:      >= 57.15
      if (angle >= 57.15) return "altruistic";
      if (angle >= 22.45) return "prosocial";
      if (angle >= -12.04) return "individualistic";
      return "competitive";
    }

    const category = classifyAngle(angleDeg);

    // QC: check whether written amounts match the marked column (across all 15 items)
    let nChosen = 0;
    let nWrittenComplete = 0;
    let nWrittenMatches = 0;
    let nWrittenMismatch = 0;

    const qcItems = [];

    for (const it of items) {
      const resp = state.responses[it.id] || null;
      const idx = resp ? Number(resp.value) : null;
      const chosen = (idx === null || !Number.isFinite(idx)) ? null : clamp(idx, 0, 8);

      if (chosen !== null) nChosen += 1;

      const expectedYou = chosen === null ? null : it.you[chosen];
      const expectedOther = chosen === null ? null : it.other[chosen];

      const meta = resp && resp.meta ? resp.meta : null;
      const w = (meta && meta.svoWritten) ? meta.svoWritten : null;

      const youNum = (w && Number.isFinite(Number(w.youNum))) ? Number(w.youNum) : null;
      const otherNum = (w && Number.isFinite(Number(w.otherNum))) ? Number(w.otherNum) : null;

      const writtenComplete = (youNum !== null && otherNum !== null);
      if (writtenComplete) nWrittenComplete += 1;

      const matches = (
        expectedYou !== null && expectedOther !== null &&
        writtenComplete &&
        youNum === expectedYou &&
        otherNum === expectedOther
      );

      if (matches) nWrittenMatches += 1;
      if (writtenComplete && expectedYou !== null && expectedOther !== null && !matches) nWrittenMismatch += 1;

      qcItems.push({
        id: it.id,
        num: it.num,
        choiceIndex: chosen,
        expectedYou,
        expectedOther,
        writtenYou: youNum,
        writtenOther: otherNum,
        writtenMatchesExpected: matches
      });
    }

    return {
      primary: {
        nItems: primaryItems.length,
        nAnswered: primaryAllocations.length,
        meanYou,
        meanOther,
        angleDeg,
        category,
        items: primaryAllocations
      },
      qc: {
        nItems: items.length,
        nChosen,
        nWrittenComplete,
        nWrittenMatches,
        nWrittenMismatch,
        items: qcItems
      }
    };
  }

  function computeAllScores() {
    return {
      hexaco100: computeHexacoScores(),
      ipip120: computeIpipScores(),
      mfq30: computeMfqScores(),
      d70: computeD70Scores(),
      svo: computeSvoScores()
    };
  }

  /* ---------- TSV builders ---------- */

  function tsvEscape(v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/\t/g, " ").replace(/\r?\n/g, "\\n");
  }

  function toTsv(rows, headers) {
    const lines = [];
    lines.push(headers.join("\t"));
    for (const r of rows) {
      lines.push(headers.map((h) => tsvEscape(r[h])).join("\t"));
    }
    return lines.join("\n");
  }

  // TSV schema (add columns here if you need more audit fields)
  const TSV_HEADERS_RESPONSES = [
    // Participant labeling
    "prolificId",
    "participantIndex",
    "sessionKey",

    // Core session meta
    "sessionId",
    "mode",
    "startedAt",
    "completedAt",
    "terminatedReason",

    // Save/audit meta (helps troubleshooting + large-N data handling)
    "lastAutosaveAt",
    "autosaveSeq",
    "serverLastSavedAt",
    "serverLastSaveOk",
    "serverLastSaveError",

    // Questionnaire order / flow meta (parameterised in launcher)
    "flow_order",
    "flow_source",
    "flow_enable_math",
    "block_id",
    "block_order_index",

    // Context
    "instrument",
    "page_id",
    "page_index",
    "page_duration_ms",

    // Item identity
    "item_id",
    "item_num",
    "presented_index",
    "presented_num",
    "facet",
    "key",

    // Item text + response/scoring
    "item_text",
    "raw_value",
    "raw_label",
    "response_value",
    "response_label",
    "reverseKeyed",
    "scored_value",
    "scored_label",
    "item_score_value",
    "item_score_label",

    // Per-item timing
    "rt_first_ms",
    "rt_last_ms",
    "first_answered_at",
    "last_changed_at",
    "changed_count",

    // SVO verification fields (empty for other instruments)
    "svo_expected_you",
    "svo_expected_other",
    "svo_written_you_raw",
    "svo_written_other_raw",
    "svo_written_you_num",
    "svo_written_other_num",
    "svo_written_matches_expected",

    // SVO timing (slider vs written; empty for other instruments)
    "svo_slider_first_rt_ms",
    "svo_slider_last_rt_ms",
    "svo_slider_change_count",
    "svo_written_first_rt_ms",
    "svo_written_last_rt_ms",
    "svo_written_change_count",

    "extra"
  ];

  const TSV_HEADERS_SCORES = [
    "prolificId",
    "participantIndex",
    "sessionKey",
    "sessionId",
    "mode",
    "startedAt",
    "completedAt",
    "terminatedReason",
    "lastAutosaveAt",
    "autosaveSeq",
    "serverLastSavedAt",
    "serverLastSaveOk",
    "serverLastSaveError",
    "flow_order",
    "flow_source",
    "flow_enable_math",
    "instrument",
    "score_type",
    "name",
    "value",
    "detail"
  ];

  function exportResponsesToTsv(output) {
    return toTsv(buildResponsesRows(output), TSV_HEADERS_RESPONSES);
  }

  function exportScoresToTsv(output) {
    return toTsv(buildScoresRows(output), TSV_HEADERS_SCORES);
  }


  function buildResponsesRows(output) {
    const sid = output.meta.sessionId;
    const mode = output.meta.mode;
    const startedAt = output.meta.startedAt;
    const completedAt = output.meta.completedAt;
    const terminatedReason = output.meta.terminatedReason;

    // Session-level save/audit metadata (same for every row in the TSV)
    const lastAutosaveAt = output.meta.lastAutosaveAt || "";
    const autosaveSeq = (output.meta.autosaveSeq !== undefined && output.meta.autosaveSeq !== null) ? output.meta.autosaveSeq : "";
    const serverLastSavedAt = output.meta.serverLastSavedAt || "";
    const serverLastSaveOk = (output.meta.serverLastSaveOk !== undefined && output.meta.serverLastSaveOk !== null)
      ? output.meta.serverLastSaveOk
      : "";
    const serverLastSaveError = output.meta.serverLastSaveError || "";

    // Flow/order metadata (set when the session starts; stable on resume)
    const flowObj = (output.meta && output.meta.flow && typeof output.meta.flow === "object") ? output.meta.flow : null;
    const flowOrderArr = flowObj && Array.isArray(flowObj.order) ? flowObj.order.slice() : [];
    const flow_order = flowOrderArr.length ? flowOrderArr.join(",") : "";
    const flow_source = flowObj && flowObj.source ? String(flowObj.source) : "";
    const flow_enable_math = (flowObj && typeof flowObj.enableMathChecks === "boolean") ? flowObj.enableMathChecks : "";

    // Page duration (ms) accumulated while navigating (per page id)
    const pageMsMap = (output.meta && output.meta.pageMs && typeof output.meta.pageMs === "object") ? output.meta.pageMs : {};

    const participantIndex = (output.meta && output.meta.participantIndex !== undefined && output.meta.participantIndex !== null)
      ? output.meta.participantIndex
      : "";
    const prolificId = (output.meta && output.meta.prolificId) ? String(output.meta.prolificId) : "";
    const sessionKey = (output.meta && output.meta.sessionKey)
      ? output.meta.sessionKey
      : `${sid}__${mode}`;

    const base = {
      prolificId,
      participantIndex,
      sessionKey,
      sessionId: sid,
      mode,
      startedAt,
      completedAt,
      terminatedReason,

      // Save/audit
      lastAutosaveAt,
      autosaveSeq,
      serverLastSavedAt,
      serverLastSaveOk,
      serverLastSaveError,

      // Flow/order
      flow_order,
      flow_source,
      flow_enable_math
    };

    const SVO_BLANKS = {
      svo_expected_you: "",
      svo_expected_other: "",
      svo_written_you_raw: "",
      svo_written_other_raw: "",
      svo_written_you_num: "",
      svo_written_other_num: "",
      svo_written_matches_expected: "",
      svo_slider_first_rt_ms: "",
      svo_slider_last_rt_ms: "",
      svo_slider_change_count: "",
      svo_written_first_rt_ms: "",
      svo_written_last_rt_ms: "",
      svo_written_change_count: ""
    };

    function timingFields(t) {
      const timing = t || null;
      const pageId = timing ? (timing.pageId || "") : "";
      const pageDurationMs = pageId && (pageMsMap[pageId] !== undefined) ? Number(pageMsMap[pageId]) : "";
      return {
        page_id: pageId,
        page_index: timing && Number.isFinite(Number(timing.pageIndex)) ? Number(timing.pageIndex) : "",
        page_duration_ms: Number.isFinite(pageDurationMs) ? pageDurationMs : (pageDurationMs === 0 ? 0 : ""),
        rt_first_ms: timing && Number.isFinite(Number(timing.firstRtMs)) ? Number(timing.firstRtMs) : "",
        rt_last_ms: timing && Number.isFinite(Number(timing.lastRtMs)) ? Number(timing.lastRtMs) : "",
        first_answered_at: timing ? (timing.firstAnsweredAt || "") : "",
        last_changed_at: timing ? (timing.lastChangedAt || "") : "",
        changed_count: timing && Number.isFinite(Number(timing.changedCount)) ? Number(timing.changedCount) : ""
      };
    }

    // Block order index: a stable "questionnaire order" number for analysis.
    // - 0 = Consent/Age gate
    // - 1..N = the main questionnaire blocks in `flow_order`
    // - N+1 = Demographics (fixed at the end)
    function blockFields(blockId) {
      const bid = String(blockId || "");

      if (bid === "consent_age") {
        return { block_id: "consent_age", block_order_index: 0 };
      }

      if (bid === "demographics") {
        return { block_id: "demographics", block_order_index: flowOrderArr.length + 1 };
      }

      const lookup = (bid === "mfq30_part1" || bid === "mfq30_part2") ? "mfq30" : bid;
      const idx = flowOrderArr.indexOf(lookup);
      return {
        block_id: lookup,
        block_order_index: idx >= 0 ? (idx + 1) : ""
      };
    }

    const rows = [];

    // ------------------------
    // Demographics
    // ------------------------
    for (const q of output.responses.demographics) {
      const qPageId = (q.timing && q.timing.pageId) ? String(q.timing.pageId) : "";
      const demoBlock = (qPageId === "consent_age") ? "consent_age" : "demographics";
      rows.push({
        ...base,
        ...blockFields(demoBlock),
        instrument: "demographics",
        ...timingFields(q.timing),

        item_id: q.id,
        item_num: q.num,
        presented_index: "",
        presented_num: "",
        facet: "",
        key: "",
        item_text: q.question,

        raw_value: q.response,
        raw_label: "",
        response_value: q.response,
        response_label: "",
        reverseKeyed: "",
        scored_value: "",
        scored_label: "",
        item_score_value: "",
        item_score_label: "",
        item_score_value: "",
        item_score_label: "",

        ...SVO_BLANKS,

        extra: q.extraText || ""
      });
    }

    // ------------------------
    // Math checks (timed tasks)
    // ------------------------
    for (const m of output.responses.math_checks) {
      const attempts = Array.isArray(m.attempts) ? m.attempts : [];
      const first = attempts.length > 0 ? attempts[0] : null;
      const last = attempts.length > 0 ? attempts[attempts.length - 1] : null;

      const mathPageId = m.id || "";
      const mathPageDurationMs = mathPageId && (pageMsMap[mathPageId] !== undefined)
        ? Number(pageMsMap[mathPageId])
        : "";

      rows.push({
        ...base,
        ...blockFields("math_check"),
        instrument: "math_check",

        // math pages use their id as the page id
        page_id: mathPageId,
        page_index: "",
        page_duration_ms: Number.isFinite(Number(mathPageDurationMs)) ? Number(mathPageDurationMs) : (mathPageDurationMs === 0 ? 0 : ""),

        item_id: m.id,
        item_num: "",
        presented_index: "",
        presented_num: "",
        facet: m.between || "",
        key: m.kind || "",
        item_text: m.expression || "",

        raw_value: m.response,
        raw_label: "",
        response_value: m.response,
        response_label: "",
        reverseKeyed: "",
        scored_value: m.correctAnswer,
        scored_label: "",
        item_score_value: m.correctAnswer,
        item_score_label: "",

        // Use attempt RTs as item RTs (first + last). Full attempts remain in `extra`.
        rt_first_ms: first && Number.isFinite(Number(first.rtMs)) ? Number(first.rtMs) : "",
        rt_last_ms: last && Number.isFinite(Number(last.rtMs)) ? Number(last.rtMs) : "",
        first_answered_at: first ? (first.submitAt || "") : "",
        last_changed_at: last ? (last.submitAt || "") : "",
        changed_count: attempts.length,

        ...SVO_BLANKS,

        extra: JSON.stringify({ attempts }, null, 0)
      });
    }

    // ------------------------
    // Likert instruments (HEXACO / IPIP / D70)
    // ------------------------
    function addLikertRows(instId, items) {
      for (const it of items) {
        rows.push({
          ...base,
          ...blockFields(instId),
          instrument: instId,
          ...timingFields(it.timing),

          item_id: it.id,
          item_num: it.num,
          presented_index: it.presentedIndex || "",
          presented_num: (it.presentedNum !== undefined && it.presentedNum !== null) ? it.presentedNum : "",
          facet: it.facet || "",
          key: it.key || "",
          item_text: it.text,

          raw_value: it.response.value,
          raw_label: it.response.label,
          response_value: it.response.value,
          response_label: it.response.label,
          reverseKeyed: it.reverseKeyed,
          scored_value: it.scored.value,
          scored_label: it.scored.label,
          item_score_value: it.scored.value,
          item_score_label: it.scored.label,

          ...SVO_BLANKS,

          // Put reverse formula into `extra` for quick audit
          extra: it.reverseKeyed ? it.reverseFormula : ""
        });
      }
    }

    addLikertRows("hexaco100", output.responses.hexaco100);
    addLikertRows("ipip120", output.responses.ipip120);
    addLikertRows("d70", output.responses.d70);

    // ------------------------
    // MFQ (Part 1 + Part 2)
    // ------------------------
    for (const partName of ["part1", "part2"]) {
      const part = output.responses.mfq30[partName];
      const scale = part.scale;

      for (const it of part.items) {
        rows.push({
          ...base,
          ...blockFields(`mfq30_${partName}`),
          instrument: `mfq30_${partName}`,
          ...timingFields(it.timing),

          item_id: it.id,
          item_num: it.num,
          presented_index: "",
          presented_num: "",
          facet: it.var,
          key: it.scoredItem ? "scored" : "catch",
          item_text: it.text,

          raw_value: it.response.value,
          raw_label: it.response.label,
          response_value: it.response.value,
          response_label: it.response.label,
          reverseKeyed: "",
          scored_value: it.response.value,
          scored_label: optionLabel(scale, it.response.value),
          item_score_value: it.response.value,
          item_score_label: optionLabel(scale, it.response.value),
          item_score_value: it.response.value,
          item_score_label: optionLabel(scale, it.response.value),

          ...SVO_BLANKS,

          extra: ""
        });
      }
    }

    // ------------------------
    // SVO (store both slider choice and written amounts, plus separate timing)
    // ------------------------
    for (const it of output.responses.svo) {
      const g = it.timing && it.timing.generic ? it.timing.generic : null;
      const slider = it.timing && it.timing.slider ? it.timing.slider : null;
      const written = it.timing && it.timing.written ? it.timing.written : null;

      rows.push({
        ...base,
        ...blockFields("svo"),
        instrument: "svo",
        ...timingFields(g),

        item_id: it.id,
        item_num: it.num,
        presented_index: "",
        presented_num: "",
        facet: "",
        key: "",
        item_text: "SVO allocation",

        raw_value: it.choiceIndex,
        raw_label: "",
        response_value: it.choiceIndex,
        response_label: "",
        reverseKeyed: "",
        scored_value: "",
        scored_label: "",
        item_score_value: "",
        item_score_label: "",

        svo_expected_you: it.youReceive,
        svo_expected_other: it.otherReceives,
        svo_written_you_raw: it.written ? it.written.youRaw : "",
        svo_written_other_raw: it.written ? it.written.otherRaw : "",
        svo_written_you_num: it.written ? it.written.youNum : "",
        svo_written_other_num: it.written ? it.written.otherNum : "",
        svo_written_matches_expected: it.written ? it.written.matchesExpected : "",

        svo_slider_first_rt_ms: slider && Number.isFinite(Number(slider.firstRtMs)) ? Number(slider.firstRtMs) : "",
        svo_slider_last_rt_ms: slider && Number.isFinite(Number(slider.lastRtMs)) ? Number(slider.lastRtMs) : "",
        svo_slider_change_count: slider && Number.isFinite(Number(slider.changeCount)) ? Number(slider.changeCount) : "",

        svo_written_first_rt_ms: written && Number.isFinite(Number(written.firstRtMs)) ? Number(written.firstRtMs) : "",
        svo_written_last_rt_ms: written && Number.isFinite(Number(written.lastRtMs)) ? Number(written.lastRtMs) : "",
        svo_written_change_count: written && Number.isFinite(Number(written.changeCount)) ? Number(written.changeCount) : "",

        extra: JSON.stringify(
          {
            options: it.options,
            writtenEditedAt: (it.written && it.written.editedAt) ? it.written.editedAt : null
          },
          null,
          0
        )
      });
    }

    return rows;
  }

  function buildScoresRows(output) {
    const sid = output.meta.sessionId;
    const mode = output.meta.mode;
    const startedAt = output.meta.startedAt;
    const completedAt = output.meta.completedAt;
    const terminatedReason = output.meta.terminatedReason;

    // Session-level save/audit metadata (same for every row)
    const lastAutosaveAt = output.meta.lastAutosaveAt || "";
    const autosaveSeq = (output.meta.autosaveSeq !== undefined && output.meta.autosaveSeq !== null)
      ? output.meta.autosaveSeq
      : "";
    const serverLastSavedAt = output.meta.serverLastSavedAt || "";
    const serverLastSaveOk = (output.meta.serverLastSaveOk !== undefined && output.meta.serverLastSaveOk !== null)
      ? output.meta.serverLastSaveOk
      : "";
    const serverLastSaveError = output.meta.serverLastSaveError || "";

    // Flow/order metadata
    const flowObj = (output.meta && output.meta.flow && typeof output.meta.flow === "object") ? output.meta.flow : null;
    const flowOrderArr = flowObj && Array.isArray(flowObj.order) ? flowObj.order.slice() : [];
    const flow_order = flowOrderArr.length ? flowOrderArr.join(",") : "";
    const flow_source = flowObj && flowObj.source ? String(flowObj.source) : "";
    const flow_enable_math = (flowObj && typeof flowObj.enableMathChecks === "boolean") ? flowObj.enableMathChecks : "";

    const participantIndex = (output.meta && output.meta.participantIndex !== undefined && output.meta.participantIndex !== null)
      ? output.meta.participantIndex
      : "";
    const prolificId = (output.meta && output.meta.prolificId) ? String(output.meta.prolificId) : "";
    const sessionKey = (output.meta && output.meta.sessionKey)
      ? output.meta.sessionKey
      : `${sid}__${mode}`;

    const base = {
      prolificId,
      participantIndex,
      sessionKey,
      sessionId: sid,
      mode,
      startedAt,
      completedAt,
      terminatedReason,

      // Save/audit
      lastAutosaveAt,
      autosaveSeq,
      serverLastSavedAt,
      serverLastSaveOk,
      serverLastSaveError,

      // Flow/order
      flow_order,
      flow_source,
      flow_enable_math
    };

    const rows = [];

    // HEXACO facets + factors
    for (const facetName of Object.keys(output.scores.hexaco100.facets)) {
      const f = output.scores.hexaco100.facets[facetName];
      rows.push({
        ...base,
        instrument: "hexaco100",
        score_type: "facet_sum",
        name: facetName,
        value: f.sum,
        detail: JSON.stringify({ factor: f.factor, nItems: f.nItems, items: f.items }, null, 0)
      });
      rows.push({
        ...base,
        instrument: "hexaco100",
        score_type: "facet_mean",
        name: facetName,
        value: f.mean,
        detail: JSON.stringify({ factor: f.factor, sum: f.sum, nItems: f.nItems, items: f.items }, null, 0)
      });
    }

    for (const factorName of Object.keys(output.scores.hexaco100.factors)) {
      const f = output.scores.hexaco100.factors[factorName];
      rows.push({
        ...base,
        instrument: "hexaco100",
        score_type: "factor_sum",
        name: factorName,
        value: f.sum,
        detail: JSON.stringify({ nItems: f.nItems, facets: f.facets }, null, 0)
      });
      rows.push({
        ...base,
        instrument: "hexaco100",
        score_type: "factor_mean",
        name: factorName,
        value: f.mean,
        detail: JSON.stringify({ sum: f.sum, nItems: f.nItems, facets: f.facets }, null, 0)
      });
    }

    // IPIP facets + domains
    for (const facetName of Object.keys(output.scores.ipip120.facets)) {
      const f = output.scores.ipip120.facets[facetName];
      rows.push({
        ...base,
        instrument: "ipip120",
        score_type: "facet_sum",
        name: facetName,
        value: f.sum,
        detail: JSON.stringify({ mean: f.mean, items: f.items }, null, 0)
      });
      rows.push({
        ...base,
        instrument: "ipip120",
        score_type: "facet_mean",
        name: facetName,
        value: f.mean,
        detail: JSON.stringify({ sum: f.sum, items: f.items }, null, 0)
      });
    }

    for (const dom of Object.keys(output.scores.ipip120.domains)) {
      const d = output.scores.ipip120.domains[dom];
      rows.push({
        ...base,
        instrument: "ipip120",
        score_type: "domain_sum",
        name: dom,
        value: d.sum,
        detail: JSON.stringify({ mean: d.mean, nItems: d.nItems, facets: d.facets }, null, 0)
      });
      rows.push({
        ...base,
        instrument: "ipip120",
        score_type: "domain_mean",
        name: dom,
        value: d.mean,
        detail: JSON.stringify({ sum: d.sum, nItems: d.nItems, facets: d.facets }, null, 0)
      });
    }

    // MFQ foundations
    for (const foundation of Object.keys(output.scores.mfq30.foundations)) {
      const f = output.scores.mfq30.foundations[foundation];
      rows.push({
        ...base,
        instrument: "mfq30",
        score_type: "foundation_sum_combined",
        name: foundation,
        value: f.combined.sum,
        detail: JSON.stringify(
          {
            part1_sum: f.part1.sum,
            part2_sum: f.part2.sum,
            part1_mean: f.part1.mean,
            part2_mean: f.part2.mean,
            items: f.combined.items
          },
          null,
          0
        )
      });
      rows.push({
        ...base,
        instrument: "mfq30",
        score_type: "foundation_mean_combined",
        name: foundation,
        value: f.combined.mean,
        detail: JSON.stringify(
          {
            part1_mean: f.part1.mean,
            part2_mean: f.part2.mean,
            part1_sum: f.part1.sum,
            part2_sum: f.part2.sum,
            items: f.combined.items
          },
          null,
          0
        )
      });
    }

    // D70 total
    rows.push({
      ...base,
      instrument: "d70",
      score_type: "total_sum",
      name: "D70",
      value: output.scores.d70.sum,
      detail: JSON.stringify(output.scores.d70, null, 0)
    });

    rows.push({
      ...base,
      instrument: "d70",
      score_type: "total_mean",
      name: "D70",
      value: output.scores.d70.mean,
      detail: JSON.stringify(output.scores.d70, null, 0)
    });

    // SVO Slider Measure summary (primary items 1–6)
    if (output.scores.svo && output.scores.svo.primary) {
      const s = output.scores.svo;

      rows.push({
        ...base,
        instrument: "svo",
        score_type: "primary_mean_you",
        name: "SVO primary mean (You)",
        value: s.primary.meanYou,
        detail: JSON.stringify(s.primary, null, 0)
      });

      rows.push({
        ...base,
        instrument: "svo",
        score_type: "primary_mean_other",
        name: "SVO primary mean (Other)",
        value: s.primary.meanOther,
        detail: JSON.stringify(s.primary, null, 0)
      });

      rows.push({
        ...base,
        instrument: "svo",
        score_type: "angle_deg",
        name: "SVO angle (degrees)",
        value: s.primary.angleDeg,
        detail: JSON.stringify(s.primary, null, 0)
      });

      rows.push({
        ...base,
        instrument: "svo",
        score_type: "category",
        name: "SVO category",
        value: s.primary.category,
        detail: JSON.stringify(s.primary, null, 0)
      });

      rows.push({
        ...base,
        instrument: "svo",
        score_type: "qc_written_mismatch",
        name: "SVO written mismatch count",
        value: s.qc ? s.qc.nWrittenMismatch : null,
        detail: JSON.stringify(s.qc || null, null, 0)
      });
    }

    return rows;
  }

  function updateOutputCache() {
    const output = buildOutput();

    const responsesRows = buildResponsesRows(output);
    const scoresRows = buildScoresRows(output);

    const responsesTsv = exportResponsesToTsv(output);

    const scoresTsv = exportScoresToTsv(output);

    const ok1 = storageSet(STORAGE_KEYS.OUTPUT_JSON, JSON.stringify(output));
    const ok2 = storageSet(STORAGE_KEYS.OUTPUT_TSV_RESPONSES, responsesTsv);
    const ok3 = storageSet(STORAGE_KEYS.OUTPUT_TSV_SCORES, scoresTsv);

    if (ok1 && ok2 && ok3) {
      state.autosave.lastOutputCacheAt = nowIso();
      // Persist state (without recursion) not needed; state cache timestamp is non-critical.
    }
  }

  // NOTE: There is intentionally NO "reset" button in the UI.
  // This reduces the chance of accidental data loss during real data collection.


  /* =========================
     ADMIN AUTOMATED WALKTHROUGH
     ========================= */

  async function maybeStartAdminAutofillWalkthrough() {
    // Only run when explicitly requested via URL (launcher button).
    if (!ADMIN_AUTOFILL) return;

    const speed = ADMIN_AUTOFILL_SPEED_MS;
    const maxSteps = 1000;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // Small delay so the initial page renders before we start clicking.
    await sleep(50);

    for (let step = 0; step < maxSteps; step++) {
      const page = PAGES[state.pageIndex];
      if (!page) break;
      if (page.type === "finish" || page.type === "terminated") break;

      // Fill current page with valid values.
      autofillPageForAutomation(page, { recordTiming: true });

      // Re-render so you can visually confirm what is being filled.
      render();
      await sleep(speed);

      // Use the real Next button handler (ensures we exercise validation logic).
      btnNext.click();
      await sleep(speed);

      if (state.completedAt) break;
    }

    // Force an immediate save so you can inspect outputs without waiting
    // for the debounce timer.
    try {
      await serverSaveNow("admin_autofill_walkthrough");
    } catch (e) {
      // If the server is down, the local autosave still contains the full state.
      console.warn("[ADMIN_AUTOFILL] serverSaveNow failed", e);
    }
  }

  /* =========================
       INIT
       ========================= */

  // Admin convenience: start a fresh session by ignoring any existing local autosave.
  // Used by the launcher for rapid end-to-end testing.
  if (ADMIN_FRESH) {
    clearState();
  }

  let state = loadState();
  let resumed = false;

  if (!state) {
    state = createNewState();
    persistState("init");
  } else {
    resumed = true;
    // Backwards/robust defaults
    if (!Number.isFinite(Number(state.version))) state.version = 11;
    if (!state.autosave) state.autosave = { seq: 0, lastSavedAt: null, lastOutputCacheAt: null };
    if (!state.responses) state.responses = {};
    if (!state.pageMs) state.pageMs = {};
    if (!Number.isFinite(Number(state.pageIndex))) state.pageIndex = 0;
    if (!Number.isFinite(Number(state.pageEnterAtMs))) state.pageEnterAtMs = Date.now();
    if (!state.meta) state.meta = {};
    if (typeof state.meta.storageOk !== "boolean") state.meta.storageOk = true;
    if (state.meta.participantIndex === undefined) state.meta.participantIndex = null;
    if (!state.meta.sessionKey) state.meta.sessionKey = null;
    if (!state.meta.randomization || typeof state.meta.randomization !== "object") state.meta.randomization = {};

    // Flow stability on resume
    if (!state.meta.flow || typeof state.meta.flow !== "object") {
      state.meta.flow = {
        order: (CONFIG.flow && Array.isArray(CONFIG.flow.order)) ? CONFIG.flow.order.slice() : flowOrder.slice(),
        enableMathChecks: (CONFIG.flow && typeof CONFIG.flow.enableMathChecks === "boolean") ? !!CONFIG.flow.enableMathChecks : !!enableMathChecks,
        source: "resume_default",
        urlOrderRaw: urlOrderRaw || null,
        urlMathRaw: urlMathRaw || null,
        chosenAt: nowIso()
      };
    }

    if (!state.meta.settings || typeof state.meta.settings !== "object") {
      state.meta.settings = {
        mode: MODE,
        enforceSvoWrittenMatch: !!enforceSvoWrittenMatch
      };
    }
  }

  function initPages() {
    const seed = hashStringToSeed(String(state.sessionId));
    const rng = mulberry32(seed);

    const effFlow = (state.meta && state.meta.flow && typeof state.meta.flow === "object")
      ? {
        order: Array.isArray(state.meta.flow.order) ? state.meta.flow.order.slice() : (CONFIG.flow.order || flowOrder).slice(),
        enableMathChecks: (state.meta.flow.enableMathChecks !== undefined) ? !!state.meta.flow.enableMathChecks : !!CONFIG.flow.enableMathChecks
      }
      : {
        order: (CONFIG.flow && Array.isArray(CONFIG.flow.order)) ? CONFIG.flow.order.slice() : flowOrder.slice(),
        enableMathChecks: !!(CONFIG.flow && CONFIG.flow.enableMathChecks)
      };

    PAGES = buildPages(rng, state.sessionId, effFlow);
    REQUIRED_QUESTION_IDS = computeAllRequiredQuestionIds(PAGES);
    PRESENTATION = computePresentationMap(PAGES);

    state.pageIndex = clamp(state.pageIndex, 0, PAGES.length - 1);
  }

  initPages();

  // Wire debug-only autofill buttons (created earlier in trial debug mode)
  if (DEBUG_MODE && window.__RIKEN_DEBUG) {
    const bPage = window.__RIKEN_DEBUG._btnFillPage;
    const bAll = window.__RIKEN_DEBUG._btnFillAll;

    if (bPage) {
      bPage.addEventListener("click", () => {
        const page = PAGES[state.pageIndex];
        debugAutofillPage(page);
        persistState("debug_autofill_page");
        render();
      });
    }

    if (bAll) {
      bAll.addEventListener("click", () => {
        debugAutofillAllAndFinish();
      });
    }
  }

  if (resumed) {
    elAutosaveText.textContent = `Autosave: resumed (${state.autosave.lastSavedAt || "unknown"})`;
  }

  // Background retry: if server autosave fails (e.g., temporary network issue), keep retrying.
  if (CONFIG.serverSave.enabled) {
    const retryMs = (CONFIG.serverSave.retryMs && Number.isFinite(Number(CONFIG.serverSave.retryMs)))
      ? Number(CONFIG.serverSave.retryMs)
      : 15000;
    setInterval(() => {
      try {
        if (_serverSaveInFlight) return;
        const ok = (typeof state.autosave.lastServerSaveOk === "boolean") ? state.autosave.lastServerSaveOk : null;
        if (ok === false) {
          serverSaveNow("retry");
        }
      } catch {
        // ignore
      }
    }, retryMs);
  }

  // Save on unload (best-effort)
  window.addEventListener("beforeunload", () => {
    const page = PAGES[state.pageIndex];
    if (page) recordTimeOnCurrentPage(page.id);
    persistState("unload");
    // Best-effort server save on unload
    trySendBeaconSave("unload");
  });

  render();

  // Admin-only automated walk-through (launcher uses ?admin=1&autofill=1)
  maybeStartAdminAutofillWalkthrough();
})();

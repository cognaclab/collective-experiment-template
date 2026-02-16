/*
  RIKEN Survey — Config (defaults)
  -------------------------------
  This file contains DEFAULT settings for the survey.

  IMPORTANT (v13+)
  ---------------
  The survey can also load a **runtime config** from the server:

      GET /api/config

  If a runtime config exists (edited from launcher.html), it is merged
  into these defaults **before** app.js runs.

  This lets you change questionnaire order, enable/disable math checks,
  change IPIP randomization seed, etc. without editing files.

  Modes:
    - Production (default): professional participant-facing UI
    - Trial: clearly marked TRIAL, skip allowed, reverse-keying shown

  Switching modes:
    - Production: open index.html (or /)
    - Trial: open trial.html

  IMPORTANT
  ---------
  Keep item wording EXACT when modifying established instruments.
*/

window.RIKEN_APP_CONFIG = {
  // Set to 'trial' or 'prod' to override the URL.
  // Leave null to use URL param (?mode=trial) with prod as default.
  // NOTE: trial.html sets window.__RIKEN_FORCE_MODE = 'trial' before loading this file.
  forceMode: window.__RIKEN_FORCE_MODE || null,

  // Prolific integration
  // --------------------
  // Return URL shown on the survey completion page.
  // Participants click this to return to Prolific and confirm submission.
  // Set to null or '' to disable (shows "You can close this tab" instead).
  prolificReturnUrl: 'https://app.prolific.com/submissions/complete?cc=CEH0Y610',

  // Validation behavior
  allowSkipInTrial: true,

  // Progress bar behavior: 'pages' or 'answered'
  progressModeProd: 'pages',
  progressModeTrial: 'answered',

  // Navigation / UI
  ui: {
    // Production should be "Next" only (recommended)
    showPrevInProd: false,
    // Trial can show Previous to help debugging
    showPrevInTrial: true
  },

  // Deterministic randomization
  randomization: {
    // IPIP-NEO-120 presentation order
    // --------------------------------
    // Requested: keep the randomized IPIP order CONSTANT across all subjects.
    // We do that by using a GLOBAL deterministic seed (same for everyone).
    //
    // NOTE (v16): The frontend ENFORCES GLOBAL IPIP order for all participants.
    // (Even if you change ipip120OrderMode to 'perSession' here.)
    // To enable per-session randomization later, modify addIpipPages() in app.js.
    ipip120Enabled: true,

    // 'global' = everyone gets the same randomized order
    // 'perSession' is currently not supported (ignored by frontend in v16).
    ipip120OrderMode: 'global',

    // Used when ipip120OrderMode === 'global'
    // Change this string to generate a DIFFERENT global randomized order.
    ipip120GlobalSeed: 'ipip120_global_v1',

    // (Reserved for future) ipip120SeedSalt (per-session mode) is ignored in v16.
    ipip120SeedSalt: 'ipip120_v1',

    // Renumber displayed items 1..N in the randomized order (recommended)
    ipip120RenumberDisplay: true
  },

  // Questionnaire flow / order
  flow: {
    // Blocks that can be re-ordered (Consent/Age always first; Demographics always last)
    allowedBlocks: ['mfq30', 'hexaco100', 'svo', 'ipip120', 'd70'],

    // Default order if no launcher/order param is provided
    defaultOrder: ['mfq30', 'hexaco100', 'svo', 'ipip120', 'd70'],

    // If true, an ?order=... URL parameter will override defaultOrder
    allowUrlOrderOverride: true,

    // Insert anti-bot arithmetic tasks between blocks
    enableMathChecks: true
  },

  // SVO validation
  svo: {
    // TRIAL: require written (You/Other) to STRICTLY match the chosen slider column.
    enforceWrittenMatchInTrial: true,

    // PROD: enforce strict match between (a) the selected slider column and
    // (b) the typed "You" / "Other" amounts.
    // Requested (v16): strict matching in BOTH trial and production.
    enforceWrittenMatchInProd: true
  },

  // Background saving
  serverSave: {
    // If true, the browser will POST data to `endpoint` in the background.
    // NOTE: For this to work you must host the survey from a server that
    // provides this endpoint (see server/server.js).
    enabled: true,

    // Same-origin default endpoint (works when using the included server).
    endpoint: '/api/save',

    // Debounce for background saves (ms)
    debounceMs: 1200,

    // Best-effort save on unload
    useSendBeaconOnUnload: true
  }
};

/* =========================================================
   RUNTIME CONFIG MERGE
   ---------------------------------------------------------
   - The launcher (launcher.html) can save overrides on the server.
   - The server serves them at /api/config.
   - We synchronously fetch them here so app.js sees the merged config.

   Notes:
     - If the server is not running (or you opened file://), this will fail
       and the defaults above will be used.
     - No participant data is ever served from /api/config.
   ========================================================= */

(function () {
  'use strict';

  function isObj(x) {
    return !!x && typeof x === 'object' && !Array.isArray(x);
  }

  // Deep merge: source overrides target.
  function deepMerge(target, source) {
    if (!isObj(target) || !isObj(source)) return target;

    for (const key of Object.keys(source)) {
      const sv = source[key];
      const tv = target[key];

      // Arrays: replace (do not merge index-by-index)
      if (Array.isArray(sv)) {
        target[key] = sv.slice();
        continue;
      }

      // Objects: recurse
      if (isObj(sv) && isObj(tv)) {
        deepMerge(tv, sv);
        continue;
      }

      // Primitives / null: replace
      target[key] = sv;
    }

    return target;
  }

  function resolveConfigUrl() {
    try {
      const params = new URLSearchParams((window.location && window.location.search) ? window.location.search : '');
      const apiBase = String(params.get('apiBase') || '').trim().replace(/\/+$/, '');

      if (apiBase) return apiBase + '/api/config';

      // If opened via file:// (not recommended), fall back to localhost.
      if (window.location && window.location.protocol === 'file:') {
        return 'http://localhost:8000/api/config';
      }

      // Same-origin (recommended)
      return '/api/config';
    } catch {
      return '/api/config';
    }
  }

  // Synchronous load to ensure config is ready before app.js executes.
  // This is intentional for reliability on a simple private server.
  try {
    const url = resolveConfigUrl();
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);

    if (xhr.status >= 200 && xhr.status < 300) {
      const data = JSON.parse(xhr.responseText || '{}');
      const cfg = (data && typeof data === 'object')
        ? (data.config && typeof data.config === 'object' ? data.config : data)
        : null;

      if (cfg && typeof cfg === 'object') {
        // Expose runtime config for debugging (launcher can also read it).
        window.RIKEN_RUNTIME_CONFIG = cfg;
        deepMerge(window.RIKEN_APP_CONFIG, cfg);
      }
    }
  } catch {
    // If config load fails, proceed with defaults.
  }
})();

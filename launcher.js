/* ============================================================
   RIKEN Survey — Launcher / Control Panel
   ============================================================

   This file powers launcher.html.

   What it does:
     1) Shows production + trial links
     2) Displays server status (GET /api/status)
     3) Loads/saves runtime config (GET/POST /api/config)
     4) Lists and downloads export files (GET /api/export/...)
     5) Provides local autosave troubleshoot tools (localStorage)

   Participants should NOT be sent to launcher.html.
*/

(function () {
  'use strict';

  /* =========================
     DOM helpers
     ========================= */

  const $ = (id) => document.getElementById(id);

  function setMsg(el, text, isError) {
    if (!el) return;
    el.textContent = text || '';
    el.style.color = isError ? '#b91c1c' : '#0f172a';
  }

  function prettyJson(obj) {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  /* =========================
     Admin token storage
     ========================= */

  const LS_ADMIN_TOKEN = 'riken_launcher_admin_token_v1';

  function getAdminToken() {
    const el = $('adminToken');
    const fromInput = el ? String(el.value || '').trim() : '';
    if (fromInput) return fromInput;
    const fromLs = String(localStorage.getItem(LS_ADMIN_TOKEN) || '').trim();
    return fromLs;
  }

  function rememberToken() {
    const el = $('adminToken');
    const v = el ? String(el.value || '').trim() : '';
    if (!v) {
      setMsg($('tokenMsg'), 'Nothing to remember (token is empty).', true);
      return;
    }
    localStorage.setItem(LS_ADMIN_TOKEN, v);
    setMsg($('tokenMsg'), 'Token saved in this browser (localStorage).', false);
  }

  function forgetToken() {
    localStorage.removeItem(LS_ADMIN_TOKEN);
    const el = $('adminToken');
    if (el) el.value = '';
    setMsg($('tokenMsg'), 'Token removed from this browser.', false);
  }

  function loadRememberedTokenIntoInput() {
    const v = String(localStorage.getItem(LS_ADMIN_TOKEN) || '').trim();
    const el = $('adminToken');
    if (el && v) el.value = v;
  }

  /* =========================
     API helpers
     ========================= */

  function baseUrl() {
    // Directory that contains launcher.html
    return new URL('.', window.location.href);
  }

  function apiUrl(path) {
    // Same-origin API
    return new URL(path.replace(/^\//, ''), baseUrl()).pathname.startsWith('/')
      ? path
      : ('/' + path);
  }

  async function fetchJson(path, opts) {
    const o = opts || {};
    const headers = Object.assign({}, o.headers || {});

    // Admin token (if required by server)
    const token = getAdminToken();
    if (token) headers['X-Admin-Token'] = token;

    const res = await fetch(path, {
      method: o.method || 'GET',
      headers,
      body: o.body || undefined
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { _raw: text };
    }

    if (!res.ok) {
      const msg = (data && data.error) ? String(data.error) : `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  async function downloadBinary(path, filename) {
    const headers = {};
    const token = getAdminToken();
    if (token) headers['X-Admin-Token'] = token;

    const res = await fetch(path, { headers });
    if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* =========================
     Runtime config model
     ========================= */

  // Default participant-facing order:
  // MFQ -> HEXACO -> SVO -> others
  const BLOCKS = ['mfq30', 'hexaco100', 'svo', 'ipip120', 'd70'];
  const BLOCK_LABEL = {
    hexaco100: 'HEXACO-PI-R (100 items)',
    ipip120: 'IPIP-NEO-120 (randomized)',
    mfq30: 'Moral Foundations Questionnaire (MFQ30)',
    d70: 'D70',
    svo: 'SVO Slider Measure'
  };

  // Local in-memory copy of the CURRENT editable config
  // (what will be saved to the server).
  let runtimeConfig = {};

  // Order is edited via the UI list.
  let flowOrder = BLOCKS.slice();

  function boolFromSelect(selectEl) {
    if (!selectEl) return false;
    const v = String(selectEl.value || '').trim();
    return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
  }

  function setSelectBool(selectEl, boolVal) {
    if (!selectEl) return;
    selectEl.value = boolVal ? '1' : '0';
  }

  function setSelectValue(selectEl, v) {
    if (!selectEl) return;
    selectEl.value = String(v);
  }

  function deepClone(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return {};
    }
  }

  function isObj(x) {
    return !!x && typeof x === 'object' && !Array.isArray(x);
  }

  function deepMerge(target, source) {
    if (!isObj(target) || !isObj(source)) return target;

    for (const key of Object.keys(source)) {
      const sv = source[key];
      const tv = target[key];

      if (Array.isArray(sv)) {
        target[key] = sv.slice();
        continue;
      }

      if (isObj(sv) && isObj(tv)) {
        deepMerge(tv, sv);
        continue;
      }

      target[key] = sv;
    }

    return target;
  }

  function buildConfigFromForm() {
    // NOTE: We only store a well-defined subset of the full config.
    // If you add new config fields in config.js/app.js, you can add them here.

    const cfg = {
      flow: {
        allowedBlocks: BLOCKS.slice(),
        defaultOrder: flowOrder.slice(),
        allowUrlOrderOverride: boolFromSelect($('cfgAllowUrlOrder')),
        enableMathChecks: boolFromSelect($('cfgMath'))
      },
      randomization: {
        ipip120Enabled: boolFromSelect($('cfgIpipEnabled')),
        ipip120OrderMode: String(($('cfgIpipMode') && $('cfgIpipMode').value) || 'global'),
        ipip120GlobalSeed: String(($('cfgIpipGlobalSeed') && $('cfgIpipGlobalSeed').value) || 'ipip120_global_v1'),
        ipip120RenumberDisplay: boolFromSelect($('cfgIpipRenumber')),
        // Keep the existing default salt if present
        ipip120SeedSalt: (runtimeConfig.randomization && runtimeConfig.randomization.ipip120SeedSalt)
          ? String(runtimeConfig.randomization.ipip120SeedSalt)
          : 'ipip120_v1'
      },
      svo: {
        enforceWrittenMatchInTrial: boolFromSelect($('cfgSvoTrial')),
        enforceWrittenMatchInProd: boolFromSelect($('cfgSvoProd'))
      },
      serverSave: {
        enabled: boolFromSelect($('cfgSaveEnabled')),
        debounceMs: Number(($('cfgSaveDebounce') && $('cfgSaveDebounce').value) || 1200),
        endpoint: String(($('cfgSaveEndpoint') && $('cfgSaveEndpoint').value) || '/api/save'),
        useSendBeaconOnUnload: boolFromSelect($('cfgSaveBeacon'))
      }
    };

    return cfg;
  }

  function applyConfigToForm(cfg) {
    const c = cfg || {};

    // Flow
    const order = (c.flow && Array.isArray(c.flow.defaultOrder)) ? c.flow.defaultOrder : null;
    flowOrder = Array.isArray(order) && order.length
      ? order.filter((b) => BLOCKS.includes(b))
      : BLOCKS.slice();

    renderOrderList();

    setSelectBool($('cfgMath'), !!(c.flow && c.flow.enableMathChecks));
    setSelectBool($('cfgAllowUrlOrder'), !!(c.flow && c.flow.allowUrlOrderOverride));

    // Randomization
    setSelectBool($('cfgIpipEnabled'), !!(c.randomization && c.randomization.ipip120Enabled));
    setSelectValue($('cfgIpipMode'), (c.randomization && c.randomization.ipip120OrderMode) ? c.randomization.ipip120OrderMode : 'global');
    if ($('cfgIpipGlobalSeed')) $('cfgIpipGlobalSeed').value = (c.randomization && c.randomization.ipip120GlobalSeed)
      ? String(c.randomization.ipip120GlobalSeed)
      : 'ipip120_global_v1';
    setSelectBool($('cfgIpipRenumber'), !!(c.randomization && c.randomization.ipip120RenumberDisplay));

    // SVO
    setSelectBool($('cfgSvoTrial'), !!(c.svo && c.svo.enforceWrittenMatchInTrial));
    setSelectBool($('cfgSvoProd'), !!(c.svo && c.svo.enforceWrittenMatchInProd));

    // Saving
    setSelectBool($('cfgSaveEnabled'), (c.serverSave && typeof c.serverSave.enabled === 'boolean') ? !!c.serverSave.enabled : true);
    if ($('cfgSaveDebounce')) $('cfgSaveDebounce').value = (c.serverSave && Number.isFinite(Number(c.serverSave.debounceMs)))
      ? Number(c.serverSave.debounceMs)
      : 1200;
    if ($('cfgSaveEndpoint')) $('cfgSaveEndpoint').value = (c.serverSave && c.serverSave.endpoint)
      ? String(c.serverSave.endpoint)
      : '/api/save';
    setSelectBool($('cfgSaveBeacon'), (c.serverSave && typeof c.serverSave.useSendBeaconOnUnload === 'boolean')
      ? !!c.serverSave.useSendBeaconOnUnload
      : true);

    // Raw JSON textarea
    const rawEl = $('cfgRaw');
    if (rawEl) rawEl.value = prettyJson(c);
  }

  /* =========================
     Order list UI
     ========================= */

  function renderOrderList() {
    const elList = $('orderList');
    if (!elList) return;

    elList.innerHTML = '';

    flowOrder.forEach((block, idx) => {
      const row = document.createElement('div');
      row.className = 'launcherOrderRow';
      row.dataset.block = block;

      const name = document.createElement('div');
      name.className = 'launcherOrderName';
      name.textContent = `${idx + 1}. ${BLOCK_LABEL[block] || block}`;

      const btns = document.createElement('div');
      btns.className = 'launcherOrderBtns';

      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'btn btn--secondary';
      up.textContent = '↑';
      up.title = 'Move up';
      up.disabled = idx === 0;
      up.addEventListener('click', () => {
        const tmp = flowOrder[idx - 1];
        flowOrder[idx - 1] = flowOrder[idx];
        flowOrder[idx] = tmp;
        renderOrderList();
        syncRawConfigTextarea();
      });

      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'btn btn--secondary';
      down.textContent = '↓';
      down.title = 'Move down';
      down.disabled = idx === flowOrder.length - 1;
      down.addEventListener('click', () => {
        const tmp = flowOrder[idx + 1];
        flowOrder[idx + 1] = flowOrder[idx];
        flowOrder[idx] = tmp;
        renderOrderList();
        syncRawConfigTextarea();
      });

      btns.appendChild(up);
      btns.appendChild(down);

      row.appendChild(name);
      row.appendChild(btns);
      elList.appendChild(row);
    });
  }

  function syncRawConfigTextarea() {
    // Keep the raw JSON textarea roughly in sync with UI edits.
    // (This is only a convenience; the authoritative save uses buildConfigFromForm().)
    try {
      const c = buildConfigFromForm();
      const el = $('cfgRaw');
      if (el) el.value = prettyJson(c);
    } catch {
      // ignore
    }
  }

  /* =========================
     Links / start buttons
     ========================= */

  function computeLinks() {
    const base = baseUrl();

    // Directory URL usually ends with '/', and the server serves index.html at '/'.
    const prod = new URL('./', base).href;
    const trial = new URL('trial.html', base).href;

    return { prod, trial };
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return true;
      } catch {
        return false;
      }
    }
  }

  /* =========================
     Server status
     ========================= */

  async function refreshStatus() {
    try {
      const data = await fetchJson('/api/status');
      const box = $('statusBox');
      if (box) box.textContent = prettyJson(data);
    } catch (e) {
      const box = $('statusBox');
      if (box) box.textContent = `ERROR: ${String(e && e.message ? e.message : e)}`;
    }
  }

  /* =========================
     Runtime config (server)
     ========================= */

  async function loadRuntimeConfig() {
    try {
      const data = await fetchJson('/api/config');
      const cfg = (data && typeof data === 'object')
        ? (data.config && typeof data.config === 'object' ? data.config : data)
        : {};

      runtimeConfig = deepClone(cfg || {});
      applyConfigToForm(runtimeConfig);

      setMsg($('configMsg'), 'Loaded runtime config from server.', false);
    } catch (e) {
      setMsg($('configMsg'), `Failed to load runtime config: ${String(e && e.message ? e.message : e)}`, true);
    }
  }

  async function saveRuntimeConfig() {
    // Two ways to save:
    //   - Normal: use the UI form controls
    //   - Advanced: if the raw JSON textarea is edited, parse + save that instead

    let cfg = null;

    const rawEl = $('cfgRaw');
    const rawText = rawEl ? String(rawEl.value || '').trim() : '';

    if (rawText) {
      try {
        cfg = JSON.parse(rawText);
      } catch (e) {
        setMsg($('configMsg'), 'Raw JSON is not valid. Fix JSON or clear the raw editor.', true);
        return;
      }
    } else {
      cfg = buildConfigFromForm();
    }

    try {
      const payload = { config: cfg };
      const data = await fetchJson('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      runtimeConfig = deepClone(cfg);
      applyConfigToForm(runtimeConfig);

      setMsg($('configMsg'), data && data.ok ? 'Saved runtime config to server.' : 'Saved (no ok flag).', false);
      await refreshStatus();
    } catch (e) {
      setMsg($('configMsg'), `Failed to save runtime config: ${String(e && e.message ? e.message : e)}`, true);
    }
  }

  async function resetRuntimeConfig() {
    try {
      const data = await fetchJson('/api/config/reset', { method: 'POST' });
      setMsg($('configMsg'), (data && data.ok) ? 'Server runtime config reset (defaults will be used).' : 'Reset done.', false);
      await loadRuntimeConfig();
      await refreshStatus();
    } catch (e) {
      setMsg($('configMsg'), `Failed to reset runtime config: ${String(e && e.message ? e.message : e)}`, true);
    }
  }

  /* =========================
     Export list + downloads
     ========================= */

  async function refreshExportList() {
    setMsg($('exportMsg'), 'Loading export file list…', false);

    try {
      const data = await fetchJson('/api/export/list');
      const files = (data && Array.isArray(data.files)) ? data.files : [];
      renderExportList(files);

      setMsg($('exportMsg'), `Found ${files.length} export files.`, false);
    } catch (e) {
      setMsg($('exportMsg'), `Failed to list export files: ${String(e && e.message ? e.message : e)}`, true);
      renderExportList([]);
    }
  }

  function renderExportList(files) {
    const el = $('exportList');
    if (!el) return;

    el.innerHTML = '';

    if (!files || files.length === 0) {
      const p = document.createElement('div');
      p.className = 'small';
      p.textContent = 'No export files found yet (run at least one session, or check server output permissions).';
      el.appendChild(p);
      return;
    }

    files.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'launcherExportRow';

      const left = document.createElement('div');
      left.className = 'launcherExportLeft';

      const name = document.createElement('div');
      name.className = 'launcherExportName';
      name.textContent = f.path || '(unknown)';

      const meta = document.createElement('div');
      meta.className = 'small';
      meta.style.opacity = '0.85';
      meta.textContent = `size=${f.size || 0} bytes • modified=${f.modifiedAt || 'unknown'}`;

      left.appendChild(name);
      left.appendChild(meta);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--secondary';
      btn.textContent = 'Download';
      btn.addEventListener('click', async () => {
        try {
          const filename = String((f.path || 'export').split('/').pop() || 'export');
          await downloadBinary(`/api/export/download?path=${encodeURIComponent(f.path)}`, filename);
        } catch (e) {
          setMsg($('exportMsg'), `Download error: ${String(e && e.message ? e.message : e)}`, true);
        }
      });

      row.appendChild(left);
      row.appendChild(btn);
      el.appendChild(row);
    });
  }

  async function downloadZip(scope) {
    const sc = scope || 'group';
    const filename = sc === 'all' ? 'riken_outputs_all.zip' : 'riken_outputs_group.zip';
    await downloadBinary(`/api/export/zip?scope=${encodeURIComponent(sc)}`, filename);
  }

  /* =========================
     Local autosave tools
     ========================= */

  const LOCAL_PREFIX = 'riken_questionnaire_';

  function getLocalAutosaveDump() {
    const out = {
      exportedAt: new Date().toISOString(),
      origin: String(window.location.origin || ''),
      href: String(window.location.href || ''),
      keys: {}
    };

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith(LOCAL_PREFIX)) continue;
      out.keys[k] = localStorage.getItem(k);
    }

    return out;
  }

  function refreshLocalBox() {
    const dump = getLocalAutosaveDump();
    const keys = Object.keys(dump.keys);

    const summary = {
      keyCount: keys.length,
      keys,
      approxBytes: keys.reduce((acc, k) => acc + String(dump.keys[k] || '').length, 0)
    };

    const box = $('localBox');
    if (box) box.textContent = prettyJson(summary);
  }

  async function exportLocalAutosave() {
    const dump = getLocalAutosaveDump();
    const blob = new Blob([prettyJson(dump)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `riken_local_autosave_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function clearLocalAutosave() {
    const ok = window.confirm('Clear ALL local autosave keys in this browser? This cannot be undone.');
    if (!ok) return;

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith(LOCAL_PREFIX)) continue;
      keysToRemove.push(k);
    }

    keysToRemove.forEach((k) => localStorage.removeItem(k));
    refreshLocalBox();
  }

  /* =========================
     Automated production test run
     ========================= */

  function startAutomatedProdRun() {
    // Opens production with:
    //   - admin=1 : enables admin-only helper behavior
    //   - fresh=1 : clears local autosave at start (avoids resuming old session)
    //   - autofill=1 : automatically answers and moves through pages
    //   - finish=1 : ensures a final server save

    const base = baseUrl();
    const url = new URL('index.html', base);
    url.searchParams.set('admin', '1');
    url.searchParams.set('fresh', '1');
    url.searchParams.set('autofill', '1');
    url.searchParams.set('finish', '1');
    url.searchParams.set('autoSpeed', '20'); // ms between pages

    window.open(url.href, '_blank');
  }

  /* =========================
     Init / wire events
     ========================= */

  async function init() {
    loadRememberedTokenIntoInput();

    // Links
    const links = computeLinks();
    if ($('prodLink')) $('prodLink').textContent = links.prod;
    if ($('trialLink')) $('trialLink').textContent = links.trial;

    // Copy buttons
    if ($('btnCopyProd')) {
      $('btnCopyProd').addEventListener('click', async () => {
        const ok = await copyToClipboard(links.prod);
        setMsg($('tokenMsg'), ok ? 'Copied production link.' : 'Copy failed (browser blocked).', !ok);
      });
    }

    if ($('btnCopyTrial')) {
      $('btnCopyTrial').addEventListener('click', async () => {
        const ok = await copyToClipboard(links.trial);
        setMsg($('tokenMsg'), ok ? 'Copied trial link.' : 'Copy failed (browser blocked).', !ok);
      });
    }

    // Start buttons
    if ($('btnStartProd')) $('btnStartProd').addEventListener('click', () => { window.location.href = links.prod; });
    if ($('btnStartTrial')) $('btnStartTrial').addEventListener('click', () => { window.location.href = links.trial; });

    if ($('btnAutoRun')) $('btnAutoRun').addEventListener('click', () => startAutomatedProdRun());

    // Admin token
    if ($('btnRememberToken')) $('btnRememberToken').addEventListener('click', rememberToken);
    if ($('btnForgetToken')) $('btnForgetToken').addEventListener('click', forgetToken);

    // Status
    if ($('btnRefreshStatus')) $('btnRefreshStatus').addEventListener('click', refreshStatus);

    // Config
    if ($('btnLoadConfig')) $('btnLoadConfig').addEventListener('click', loadRuntimeConfig);
    if ($('btnSaveConfig')) $('btnSaveConfig').addEventListener('click', saveRuntimeConfig);
    if ($('btnResetConfig')) $('btnResetConfig').addEventListener('click', resetRuntimeConfig);

    // Keep raw textarea in sync when user changes selects/inputs
    ['cfgMath','cfgAllowUrlOrder','cfgIpipEnabled','cfgIpipMode','cfgIpipGlobalSeed','cfgIpipRenumber','cfgSvoTrial','cfgSvoProd','cfgSaveEnabled','cfgSaveDebounce','cfgSaveEndpoint','cfgSaveBeacon']
      .forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener('change', () => syncRawConfigTextarea());
        el.addEventListener('input', () => syncRawConfigTextarea());
      });

    // Export
    if ($('btnRefreshExports')) $('btnRefreshExports').addEventListener('click', refreshExportList);
    if ($('btnDownloadGroupZip')) $('btnDownloadGroupZip').addEventListener('click', async () => {
      try {
        await downloadZip('group');
      } catch (e) {
        setMsg($('exportMsg'), `Download error: ${String(e && e.message ? e.message : e)}`, true);
      }
    });
    if ($('btnDownloadAllZip')) $('btnDownloadAllZip').addEventListener('click', async () => {
      try {
        await downloadZip('all');
      } catch (e) {
        setMsg($('exportMsg'), `Download error: ${String(e && e.message ? e.message : e)}`, true);
      }
    });

    // Local autosave tools
    if ($('btnExportLocal')) $('btnExportLocal').addEventListener('click', exportLocalAutosave);
    if ($('btnClearLocal')) $('btnClearLocal').addEventListener('click', clearLocalAutosave);

    // Initial loads
    await refreshStatus();
    await loadRuntimeConfig();
    await refreshExportList();
    refreshLocalBox();
  }

  // Run
  init();
})();

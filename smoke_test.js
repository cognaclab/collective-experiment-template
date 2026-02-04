(() => {
  const logEl = document.getElementById('log');
  const btnStatus = document.getElementById('btnStatus');
  const btnSave = document.getElementById('btnSave');
  const btnClear = document.getElementById('btnClear');

  function log(msg, obj) {
    const ts = new Date().toISOString();
    const text = obj ? `${msg}\n${JSON.stringify(obj, null, 2)}` : msg;
    logEl.textContent = `${ts}  ${text}\n\n` + (logEl.textContent === 'Loading…' ? '' : logEl.textContent);
  }

  // Resolve API URLs (supports ?apiBase=... and file:// testing)
  const params = new URLSearchParams(window.location.search || '');
  const apiBaseRaw = String(params.get('apiBase') || '').trim();
  const API_BASE = apiBaseRaw ? apiBaseRaw.replace(/\/+$/, '') : null;

  function resolveApiUrl(pathOrUrl) {
    const s = String(pathOrUrl || '');
    if (!s) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (API_BASE) {
      return API_BASE + (s.startsWith('/') ? s : '/' + s);
    }
    if (window.location && window.location.protocol === 'file:') {
      return 'http://localhost:8000' + (s.startsWith('/') ? s : '/' + s);
    }
    return s;
  }

  // Log environment so it's obvious when the page is opened via file://
  log('Page environment', {
    href: window.location.href,
    protocol: window.location.protocol,
    origin: window.location.origin || null,
    apiBase: API_BASE,
    resolvedStatus: resolveApiUrl('/api/status'),
    resolvedSave: resolveApiUrl('/api/save')
  });


  async function getStatus() {
    const res = await fetch(resolveApiUrl('/api/status'), { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    log(`GET /api/status  → ${res.status}`, data);
    return { res, data };
  }

  async function postSave() {
    const sid = `SMOKETEST_${Date.now()}`;
    const output = {
      meta: {
        sessionId: sid,
        mode: 'trial',
        startedAt: new Date().toISOString(),
        lastAutosaveAt: new Date().toISOString(),
        autosaveSeq: 1,
        terminatedReason: 'smoke_test'
      },
      responses: {
        consent: [{ id: 'consent', response: true }]
      },
      scores: {}
    };

    const payload = {
      kind: 'smoke_test',
      trigger: 'manual',
      clientSavedAt: new Date().toISOString(),
      output,
      tsv: {
        responses: 'sessionId\tmode\tinstrument\titem_id\traw_value\n' + `${sid}\ttrial\tsmoke\ttest\t1\n`,
        scores: 'sessionId\tmode\tinstrument\tscore_type\tvalue\n' + `${sid}\ttrial\tsmoke\tping\t1\n`
      }
    };

    const res = await fetch(resolveApiUrl('/api/save'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    log(`POST /api/save  → ${res.status}`, data);
    return { res, data, sid };
  }

  btnClear?.addEventListener('click', () => {
    logEl.textContent = '';
  });

  btnStatus?.addEventListener('click', () => {
    getStatus().catch((e) => log('ERROR (status): ' + String(e && e.message ? e.message : e)));
  });

  btnSave?.addEventListener('click', async () => {
    try {
      await getStatus();
      await postSave();
      await getStatus();
    } catch (e) {
      log('ERROR (save): ' + String(e && e.message ? e.message : e));
    }
  });

  // Auto-run once
  getStatus().catch((e) => log('ERROR (status): ' + String(e && e.message ? e.message : e)));
})();

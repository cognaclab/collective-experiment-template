#!/usr/bin/env node
/*
RIKEN Survey — Minimal Node.js server (no npm dependencies)
=========================================================

Why this exists
--------------
Browsers cannot write participant data to disk without a backend.
This server provides:

  POST /api/save

The frontend (app.js) autosaves in the background, so participants never
see download buttons in production.

Key goals
---------
1) Keep deployment simple: **Node.js only**, no third-party packages.
2) Keep participants from downloading outputs:
   - output folders are NEVER served by the static file server
   - export endpoints are protected by an admin token

What gets written
-----------------

Per-session snapshots (overwritten on every autosave):
  output/raw_sessions/<prolificId>__<sessionKey>.json
  output/raw_sessions/<prolificId>__<sessionKey>_responses.tsv
  output/raw_sessions/<prolificId>__<sessionKey>_scores.tsv

Backups (mirror):
  output_backup/raw_sessions/...

Runtime config (launcher):
  output/runtime_config.json

Exports (launcher, admin-only):
  GET /api/export/list
  GET /api/export/download?path=...
  GET /api/export/zip?scope=group|all

Run
---
  node server/server.js

Environment variables
---------------------
  RIKEN_HOST=0.0.0.0
  RIKEN_PORT=8000
  RIKEN_OUTPUT_DIR=output
  RIKEN_BACKUP_DIR=output_backup
  RIKEN_ADMIN_TOKEN='your-long-random-token'  (optional)

If RIKEN_ADMIN_TOKEN is not set (or is empty), a random token is generated
and printed on startup.
*/

"use strict";

const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const url = require("url");
const crypto = require("crypto");
const { spawn } = require("child_process");

const HOST = process.env.RIKEN_HOST || "0.0.0.0";
const PORT = Number.parseInt(process.env.RIKEN_PORT || "8000", 10);
const OUTPUT_DIR = process.env.RIKEN_OUTPUT_DIR || "output";
const BACKUP_DIR = process.env.RIKEN_BACKUP_DIR || "output_backup";

const ROOT_DIR = path.resolve(path.join(__dirname, ".."));
const OUT_DIR = path.resolve(path.join(ROOT_DIR, OUTPUT_DIR));
const BAK_DIR = path.resolve(path.join(ROOT_DIR, BACKUP_DIR));

// Admin token
let ADMIN_TOKEN = (process.env.RIKEN_ADMIN_TOKEN ?? "").trim();
if (!ADMIN_TOKEN) {
  ADMIN_TOKEN = crypto.randomBytes(24).toString("hex");
}

// Paths
const LOCK_PATH = path.join(OUT_DIR, ".write_lock");
const INDEX_MAP_PATH = path.join(OUT_DIR, "group", "participant_index_map.json");
const RUNTIME_CONFIG_PATH = path.join(OUT_DIR, "runtime_config.json");

function nowIso() {
  return new Date().toISOString();
}

function ensureDirSync(p) {
  fs.mkdirSync(p, { recursive: true });
}

function atomicWriteSync(p, data) {
  ensureDirSync(path.dirname(p));
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, p);
}


// ---------------------------------------------------------------------------
// Live combined tidy outputs (auto-updated)
// ---------------------------------------------------------------------------

const LIVE_DIR = path.join(__dirname, "..", "output", "tidy", "live");
const LIVE_INDEX_PATH = path.join(LIVE_DIR, "_included_sessions.json");

function ensureLiveDir() {
  ensureDirSync(LIVE_DIR);
  if (!fs.existsSync(LIVE_INDEX_PATH)) {
    fs.writeFileSync(LIVE_INDEX_PATH, JSON.stringify({ included: [] }, null, 2), "utf-8");
  }
}

function readLiveIndex() {
  ensureLiveDir();
  try {
    const obj = JSON.parse(fs.readFileSync(LIVE_INDEX_PATH, "utf-8"));
    const inc = Array.isArray(obj.included) ? obj.included : [];
    return new Set(inc.map(String));
  } catch {
    return new Set();
  }
}

function writeLiveIndex(set) {
  ensureLiveDir();
  fs.writeFileSync(LIVE_INDEX_PATH, JSON.stringify({ included: Array.from(set).sort() }, null, 2), "utf-8");
}

function tsvToRows(tsvText) {
  const lines = String(tsvText || "").split(/\r?\n/).filter(l => l.length);
  if (!lines.length) return { header: null, rows: [] };
  const header = lines[0].split("\t");
  const rows = lines.slice(1).map(l => l.split("\t"));
  return { header, rows };
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}


function runAutogenTidy() {
  // Rebuild tidy exports (wide+long, TSV+CSV) from group append-only long files.
  // This runs out-of-band so the participant save response is never blocked.
  try {
    const py = process.env.RIKEN_PYTHON || "python3";
    const script = path.join(__dirname, "..", "tools", "autogen_tidy.py");
    const child = require("child_process").spawn(py, [script], {
      cwd: path.join(__dirname, ".."),
      detached: true,
      stdio: "ignore",
      env: { ...process.env, RIKEN_OUTPUT_DIR: OUT_DIR },
    });
    child.unref();
  } catch {}
}

function appendLiveTable(stem, tsvText) {
  ensureLiveDir();
  const { header, rows } = tsvToRows(tsvText);
  if (!header || !rows.length) return;

  const tsvPath = path.join(LIVE_DIR, `${stem}.tsv`);
  const csvPath = path.join(LIVE_DIR, `${stem}.csv`);

  const hasFile = fs.existsSync(tsvPath);

  // TSV append
  const tsvLines = [];
  if (!hasFile) tsvLines.push(header.join("\t"));
  for (const r of rows) tsvLines.push(r.join("\t"));
  fs.appendFileSync(tsvPath, tsvLines.join("\n") + "\n", "utf-8");

  // CSV append
  const csvLines = [];
  if (!fs.existsSync(csvPath)) csvLines.push(header.map(csvEscape).join(","));
  for (const r of rows) csvLines.push(r.map(csvEscape).join(","));
  fs.appendFileSync(csvPath, csvLines.join("\n") + "\n", "utf-8");
}

async function maybeUpdateLiveCombined(fileKey, output, tsvResponses, tsvScores) {
  const meta = (output && output.meta) ? output.meta : {};
  const completedAt = meta.completedAt;
  const terminatedReason = meta.terminatedReason;

  // Only include fully completed sessions
  if (!completedAt || terminatedReason) return;

  await withFileLock(async () => {
    const included = readLiveIndex();
    if (included.has(fileKey)) return;

    // Append to live combined tables
    appendLiveTable("responses_long", tsvResponses);
    appendLiveTable("scores_long", tsvScores);

    included.add(fileKey);
    writeLiveIndex(included);
  });

  // Rebuild tidy outputs (wide+long, TSV+CSV), including full-text wide files.
  runAutogenTidy();

}

function safeId(raw) {
  const s = String(raw || "");
  const out = s.replace(/[^a-zA-Z0-9_-]/g, "");
  return out || "unknown";
}

async function readJsonIfExists(p, fallback) {
  try {
    const txt = await fsp.readFile(p, "utf-8");
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}

async function withFileLock(fn, opts = {}) {
  const maxWaitMs = opts.maxWaitMs ?? 8000;
  const pollMs = opts.pollMs ?? 40;

  ensureDirSync(path.dirname(LOCK_PATH));
  const started = Date.now();

  while (true) {
    try {
      const fd = fs.openSync(LOCK_PATH, "wx");
      try {
        fs.writeFileSync(fd, String(process.pid));
      } catch {}
      try {
        const res = await fn();
        return res;
      } finally {
        try {
          fs.closeSync(fd);
        } catch {}
        try {
          fs.unlinkSync(LOCK_PATH);
        } catch {}
      }
    } catch (e) {
      // If the lock exists, wait. If it's a different filesystem error, fail fast.
      if (e && e.code && e.code !== "EEXIST") {
        throw e;
      }
      if (Date.now() - started > maxWaitMs) throw new Error("Timed out waiting for write lock");
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }
}

function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj, null, 2), "utf-8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
  });
  res.end(body);
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  const body = Buffer.from(String(text || ""), "utf-8");
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
  });
  res.end(body);
}

async function readRequestBody(req, maxBytes = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (c) => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error("Request too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function requireAdmin(req) {
  const hdr = String(req.headers["x-admin-token"] || "").trim();
  if (!ADMIN_TOKEN) return true;
  return hdr && hdr === ADMIN_TOKEN;
}

function forbidOutputPaths(p) {
  const norm = String(p || "");
  return (
    norm.startsWith("/output") ||
    norm.startsWith("/output_backup") ||
    norm.startsWith("/server") ||
    norm.endsWith(".tsv") ||
    norm.endsWith(".csv") ||
    norm.endsWith(".jsonl") ||
    norm.endsWith(".zip")
  );
}

function guessMime(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

async function serveStatic(req, res, pathname) {
  // Default document
  let p = pathname === "/" ? "/index.html" : pathname;
  if (forbidOutputPaths(p)) {
    sendText(res, 404, "Not Found");
    return;
  }

  // Prevent path traversal
  p = path.posix.normalize(p);
  if (p.includes("..")) {
    sendText(res, 400, "Bad Request");
    return;
  }

  const fsPath = path.resolve(path.join(ROOT_DIR, p.replace(/^\//, "")));
  if (!fsPath.startsWith(ROOT_DIR)) {
    sendText(res, 400, "Bad Request");
    return;
  }

  try {
    const st = await fsp.stat(fsPath);
    if (!st.isFile()) {
      sendText(res, 404, "Not Found");
      return;
    }
    const data = await fsp.readFile(fsPath);
    res.writeHead(200, {
      "Content-Type": guessMime(fsPath),
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch {
    sendText(res, 404, "Not Found");
  }
}

function tsvInjectColumns(tsv, updates) {
  const text = String(tsv || "").trim();
  if (!text) return "";

  const lines = text.split(/\r?\n/);
  if (!lines.length) return "";

  const header = lines[0].split("\t");
  const idx = {};
  header.forEach((h, i) => (idx[h] = i));

  // Only update columns that exist.
  const cols = Object.keys(updates || {}).filter((k) => idx[k] !== undefined);
  if (!cols.length) return text;

  const out = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln) continue;
    const parts = ln.split("\t");
    for (const c of cols) {
      parts[idx[c]] = String(updates[c] ?? "");
    }
    out.push(parts.join("\t"));
  }
  return out.join("\n") + "\n";
}

async function assignParticipantIndex(sessionKey, mode) {
  return withFileLock(async () => {
    const data = await readJsonIfExists(INDEX_MAP_PATH, { modes: {} });
    if (!data.modes) data.modes = {};
    if (!data.modes[mode]) data.modes[mode] = { counter: 0, map: {} };

    const m = data.modes[mode];
    if (m.map && m.map[sessionKey] !== undefined && m.map[sessionKey] !== null) {
      return m.map[sessionKey];
    }

    m.counter = Number.isFinite(Number(m.counter)) ? Number(m.counter) : 0;
    m.counter += 1;
    if (!m.map) m.map = {};
    m.map[sessionKey] = m.counter;

    atomicWriteSync(INDEX_MAP_PATH, Buffer.from(JSON.stringify(data, null, 2), "utf-8"));
    return m.counter;
  });
}

async function listExportFiles() {
  // Admin-only: list output files (excluding large raw session dumps by default).
  const base = OUT_DIR;
  const files = [];

  async function walk(dirRel) {
    const abs = path.join(base, dirRel);
    let ents = [];
    try {
      ents = await fsp.readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of ents) {
      const rel = path.join(dirRel, ent.name);
      const absPath = path.join(base, rel);
      if (ent.isDirectory()) {
        // Skip raw_sessions by default (can be large). Still included in "all" zip.
        if (rel.replace(/\\/g, "/") === "raw_sessions") continue;
        await walk(rel);
      } else if (ent.isFile()) {
        const st = await fsp.stat(absPath);
        files.push({
          path: rel.replace(/\\/g, "/"),
          bytes: st.size,
          modifiedAt: new Date(st.mtimeMs).toISOString(),
        });
      }
    }
  }

  await walk("");
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

function isSafeRelPath(p) {
  const s = String(p || "");
  if (!s) return false;
  if (s.includes("..")) return false;
  if (s.startsWith("/")) return false;
  return true;
}

async function handleExportDownload(req, res, query) {
  if (!requireAdmin(req)) {
    sendJson(res, 401, { ok: false, error: "admin token required" });
    return;
  }

  const rel = String(query.path || "");
  if (!isSafeRelPath(rel)) {
    sendJson(res, 400, { ok: false, error: "invalid path" });
    return;
  }

  const abs = path.resolve(path.join(OUT_DIR, rel));
  if (!abs.startsWith(OUT_DIR)) {
    sendJson(res, 400, { ok: false, error: "invalid path" });
    return;
  }

  try {
    const st = await fsp.stat(abs);
    if (!st.isFile()) throw new Error("not a file");
    const data = await fsp.readFile(abs);
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${path.basename(rel)}"`,
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch {
    sendJson(res, 404, { ok: false, error: "file not found" });
  }
}

async function handleExportZip(req, res, query) {
  if (!requireAdmin(req)) {
    sendJson(res, 401, { ok: false, error: "admin token required" });
    return;
  }

  const scope = String(query.scope || "group");
  const tmpName = `riken_export_${scope}_${Date.now()}_${Math.random().toString(16).slice(2)}.zip`;
  const tmpPath = path.join(OUT_DIR, tmpName);

  // Decide which folders/files to include.
  // group: output/group + output/tidy + top-level output readmes
  // all:   everything under output (including raw_sessions)
  const includes = [];
  if (scope === "all") {
    includes.push(".");
  } else {
    includes.push("group");
    includes.push("tidy");
    includes.push("README.md");
    includes.push("README.txt");
  }

  // Build zip using system "zip" (Info-ZIP).
  await new Promise((resolve, reject) => {
    const args = ["-r", "-q", tmpPath, ...includes];
    const child = spawn("zip", args, { cwd: OUT_DIR });
    let err = "";
    child.stderr.on("data", (d) => (err += d.toString("utf-8")));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `zip failed with code ${code}`));
    });
  });

  try {
    const data = await fsp.readFile(tmpPath);
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="riken_outputs_${scope}.zip"`,
      "Cache-Control": "no-store",
    });
    res.end(data);
  } finally {
    try {
      await fsp.unlink(tmpPath);
    } catch {}
  }
}

async function handleSave(req, res) {
  // Make sure output folders exist
  ensureDirSync(OUT_DIR);
  ensureDirSync(BAK_DIR);
  ensureDirSync(path.join(OUT_DIR, "raw_sessions"));
  ensureDirSync(path.join(BAK_DIR, "raw_sessions"));
  ensureDirSync(path.join(OUT_DIR, "raw_final"));
  ensureDirSync(path.join(BAK_DIR, "raw_final"));
  ensureDirSync(path.join(OUT_DIR, "tidy"));
  ensureDirSync(path.join(OUT_DIR, "tidy", "live"));
  ensureDirSync(path.join(OUT_DIR, "group"));
  ensureDirSync(path.join(BAK_DIR, "group"));

  let payload = null;
  try {
    const body = await readRequestBody(req);
    payload = JSON.parse(body.toString("utf-8") || "{}");
  } catch (e) {
    sendJson(res, 400, { ok: false, error: `invalid JSON: ${String(e.message || e)}` });
    return;
  }

  const output = (payload && typeof payload.output === "object" && payload.output) ? payload.output : {};
  const meta = (output && typeof output.meta === "object" && output.meta) ? output.meta : {};
  output.meta = meta;

  const sessionId = safeId(meta.sessionId || "unknown");
  const mode = safeId(meta.mode || "unknown");
  const sessionKey = `${sessionId}__${mode}`;

// Prolific ID (used for cross-session syncing + file naming)
  const prolificIdRaw = (meta && (meta.prolificId || meta.prolificID || meta.prolific_id)) ? String(meta.prolificId || meta.prolificID || meta.prolific_id) : "";
  const prolificIdSanitized = sanitizeId(prolificIdRaw);

  const serverReceivedAt = nowIso();

  // Assign stable participantIndex (separate sequences per mode)
  let participantIndex = null;
  try {
    participantIndex = await assignParticipantIndex(sessionKey, mode);
  } catch (e) {
    sendJson(res, 500, { ok: false, error: `participantIndex assign failed: ${String(e.message || e)}` });
    return;
  }

  // If Prolific ID is missing, make the raw file key collision-proof while still starting with a clear token.
  const prolificId = prolificIdSanitized || `NO_PROLIFIC_ID_p${participantIndex}`;

  // File key: prolificId first, then sessionKey
  const fileKey = `${prolificId}__${sessionKey}`;

  meta.participantIndex = participantIndex;
  meta.sessionKey = sessionKey;
  meta.serverReceivedAt = serverReceivedAt;
  meta.prolificId = prolificIdRaw || prolificId; // preserve raw if provided; otherwise store derived
  const serverReceivedAt = nowIso();

  // Write JSON snapshot
  try {
    const jsonBytes = Buffer.from(JSON.stringify(output, null, 2), "utf-8");
    const p1 = path.join(OUT_DIR, "raw_sessions", `${fileKey}.json`);
    const p2 = path.join(BAK_DIR, "raw_sessions", `${fileKey}.json`);
    atomicWriteSync(p1, jsonBytes);
    atomicWriteSync(p2, jsonBytes);
  } catch (e) {
    sendJson(res, 500, { ok: false, error: `json write failed: ${String(e.message || e)}` });
    return;
  }

  // TSV snapshots (client-generated). We inject server-truth participantIndex + sessionKey.
  const tsv = (payload && typeof payload.tsv === "object" && payload.tsv) ? payload.tsv : {};
  const responsesTsv = tsvInjectColumns(tsv.responses || "", {
    participantIndex,
    sessionKey,
  });
  const scoresTsv = tsvInjectColumns(tsv.scores || "", {
    participantIndex,
    sessionKey,
  });

  try {
    if (responsesTsv) {
      const p1 = path.join(OUT_DIR, "raw_sessions", `${fileKey}_responses.tsv`);
      const p2 = path.join(BAK_DIR, "raw_sessions", `${fileKey}_responses.tsv`);
      atomicWriteSync(p1, Buffer.from(responsesTsv, "utf-8"));
      atomicWriteSync(p2, Buffer.from(responsesTsv, "utf-8"));
    }
    if (scoresTsv) {
      const p1 = path.join(OUT_DIR, "raw_sessions", `${fileKey}_scores.tsv`);
      const p2 = path.join(BAK_DIR, "raw_sessions", `${fileKey}_scores.tsv`);
      atomicWriteSync(p1, Buffer.from(scoresTsv, "utf-8"));
      atomicWriteSync(p2, Buffer.from(scoresTsv, "utf-8"));
    }
  } catch {
    // Best-effort: JSON snapshot is the source of truth.
  }


  // Write immutable "ground truth" FINAL copies (never overwritten), for completed sessions only.
  try {
    const completedAt = meta.completedAt;
    const terminatedReason = meta.terminatedReason;
    if (completedAt && !terminatedReason) {
      const ts = serverReceivedAt.replace(/[:.]/g, "-");
      const finalKey = `${fileKey}__final__${ts}`;

      // JSON final copy (from current in-memory output)
      const jsonBytes = Buffer.from(JSON.stringify(output, null, 2), "utf-8");
      atomicWriteSync(path.join(OUT_DIR, "raw_final", `${finalKey}.json`), jsonBytes);
      atomicWriteSync(path.join(BAK_DIR, "raw_final", `${finalKey}.json`), jsonBytes);

      // Also preserve the TSV snapshots if present
      if (responsesTsv) {
        const b = Buffer.from(String(responsesTsv), "utf-8");
        atomicWriteSync(path.join(OUT_DIR, "raw_final", `${finalKey}_responses.tsv`), b);
        atomicWriteSync(path.join(BAK_DIR, "raw_final", `${finalKey}_responses.tsv`), b);
      }
      if (scoresTsv) {
        const b = Buffer.from(String(scoresTsv), "utf-8");
        atomicWriteSync(path.join(OUT_DIR, "raw_final", `${finalKey}_scores.tsv`), b);
        atomicWriteSync(path.join(BAK_DIR, "raw_final", `${finalKey}_scores.tsv`), b);
      }
    }
  } catch {
    // Best-effort: raw_sessions is still available.
  }

  // Auto-update live combined tidy outputs (completed sessions only)
  try { await maybeUpdateLiveCombined(fileKey, output, responsesTsv, scoresTsv); } catch {}


  sendJson(res, 200, {
    ok: true,
    sessionKey,
    fileKey,
    prolificId,
    participantIndex,
    serverReceivedAt,
  });
}

async function handleConfigGet(_req, res) {
  const cfg = await readJsonIfExists(RUNTIME_CONFIG_PATH, {});
  sendJson(res, 200, { ok: true, config: cfg || {} });
}

async function handleConfigPost(req, res) {
  if (!requireAdmin(req)) {
    sendJson(res, 401, { ok: false, error: "admin token required" });
    return;
  }
  let payload = null;
  try {
    const body = await readRequestBody(req, 256 * 1024);
    payload = JSON.parse(body.toString("utf-8") || "{}");
  } catch (e) {
    sendJson(res, 400, { ok: false, error: `invalid JSON: ${String(e.message || e)}` });
    return;
  }
  const cfg = (payload && typeof payload.config === "object" && payload.config) ? payload.config : payload;
  try {
    atomicWriteSync(RUNTIME_CONFIG_PATH, Buffer.from(JSON.stringify(cfg, null, 2), "utf-8"));
    sendJson(res, 200, { ok: true, config: cfg });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: `write failed: ${String(e.message || e)}` });
  }
}

async function handleConfigReset(req, res) {
  if (!requireAdmin(req)) {
    sendJson(res, 401, { ok: false, error: "admin token required" });
    return;
  }
  try {
    await fsp.unlink(RUNTIME_CONFIG_PATH);
  } catch {}
  sendJson(res, 200, { ok: true, config: {} });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = url.parse(req.url || "/", true);
    const pathname = (parsed.pathname || "/").replace(/\/+$/, "") || "/";

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
      });
      res.end();
      return;
    }

    // API
    if (pathname === "/api/status" && req.method === "GET") {
      sendJson(res, 200, {
        ok: true,
        serverTime: nowIso(),
        host: HOST,
        port: PORT,
        outputDir: OUTPUT_DIR,
        backupDir: BACKUP_DIR,
      });
      return;
    }
    if (pathname === "/api/ping" && req.method === "GET") {
      sendJson(res, 200, { ok: true, pong: true, serverTime: nowIso() });
      return;
    }
    if (pathname === "/api/config" && req.method === "GET") {
      await handleConfigGet(req, res);
      return;
    }
    if (pathname === "/api/config" && req.method === "POST") {
      await handleConfigPost(req, res);
      return;
    }
    if (pathname === "/api/config/reset" && req.method === "POST") {
      await handleConfigReset(req, res);
      return;
    }
    if (pathname === "/api/save" && req.method === "POST") {
      await handleSave(req, res);
      return;
    }
    if (pathname === "/api/export/list" && req.method === "GET") {
      if (!requireAdmin(req)) {
        sendJson(res, 401, { ok: false, error: "admin token required" });
        return;
      }
      const files = await listExportFiles();
      sendJson(res, 200, { ok: true, files });
      return;
    }
    if (pathname === "/api/export/download" && req.method === "GET") {
      await handleExportDownload(req, res, parsed.query || {});
      return;
    }
    if (pathname === "/api/export/zip" && req.method === "GET") {
      await handleExportZip(req, res, parsed.query || {});
      return;
    }

    // Static
    await serveStatic(req, res, pathname);
  } catch (e) {
    sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`RIKEN server running: http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}/`);
  console.log(`Output: ${OUT_DIR}`);
  console.log(`Backup: ${BAK_DIR}`);
  console.log(`Admin token: ${ADMIN_TOKEN}`);
});

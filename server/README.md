# Server (Node.js, no dependencies)

The survey uses a small Node.js server (`server/server.js`) to:

- serve the static frontend files (`index.html`, `app.js`, etc.)
- receive autosave payloads from the browser (`POST /api/save`)
- store those payloads as files under `output/` and `output_backup/`

## Running

From the project root:

```bash
node server/server.js
```

Environment variables (optional):

- `RIKEN_HOST` (default: `0.0.0.0`)
- `RIKEN_PORT` (default: `8000`)
- `RIKEN_OUTPUT_DIR` (default: `output`)
- `RIKEN_BACKUP_DIR` (default: `output_backup`)
- `RIKEN_ADMIN_TOKEN` (recommended)

## Security model (important)

- The server **never serves** `output/` or `output_backup/` over HTTP.
- Admin-only endpoints (`/api/config`, `/api/export/*`) require `X-Admin-Token`.
  - If you don’t set `RIKEN_ADMIN_TOKEN`, the server auto-generates one and prints it on startup.

## API endpoints

Participant-facing:
- `POST /api/save` — autosave endpoint used by the survey
- `GET /api/status` — health check

Researcher/admin:
- `GET /api/config` — read runtime config
- `POST /api/config` — write runtime config (token required)
- `POST /api/config/reset` — reset runtime config (token required)
- `GET /api/export/list` — list export files (token required)
- `GET /api/export/download?path=...` — download a single file (token required)
- `GET /api/export/zip?scope=group|all` — download a zip (token required)

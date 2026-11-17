# B1 — Backend: server, data readers, state builder

## Objective
`node server.js` serves `GET /api/state` exactly as `docs/SPEC.md` section 2 defines,
built from opencode's SQLite DB and Claude Code's transcripts, plus static files
from `public/`. `bin/aw.js` sets and clears the review flag.

## Read first
- `AGENTS.md`
- `docs/SPEC.md` sections 1, 2, 3, 4, 5
- `config/roster.json` (the real roster; do not edit it)

## Files you may change
- `server.js`, `lib/opencode.js`, `lib/claude.js`, `lib/state.js`, `bin/aw.js`
- `test/state.test.js`, `test/claude.test.js`, `test/opencode.test.js`, `test/fixtures/**`
- `package.json` (only: `"name"`, `"private": true`, `"scripts": {"start": "node server.js", "test": "node --test"}`; no dependencies)

## Constraints
- Node 24 built-ins only (`node:http`, `node:fs`, `node:path`, `node:os`, `node:sqlite`, `node:test`). CommonJS.
- The opencode DB is opened read-only and never written. A locked or missing DB must
  not crash the server: catch, log one line, return empty opencode data.
- Suppress the `ExperimentalWarning` for `node:sqlite` so the console stays clean.
- `lib/state.js` `buildState(...)` is pure: no `fs`, no DB, no `Date.now()` inside
  (take `now` as an argument).
- `lib/claude.js` must deduplicate by `message.id` and cache per file as SPEC section 3
  says. Export something testable, for example `parseTranscriptChunk(text, acc)`.
- Tests use small fixtures you write under `test/fixtures/` (a few JSONL lines; for
  opencode build a temporary SQLite DB inside the test with `node:sqlite` in
  `os.tmpdir()`), never the user's real data. Tests must be deterministic: pass `now`.
- Never print the text content of transcripts or messages; only numbers and names.

## Done when
1. `node --test` passes, covering at least: usage sums per model; `today` split at
   local midnight; dedupe of repeated `message.id`; truncated JSONL line skipped;
   working/idle thresholds for both groups; review flag overriding `working`; expired
   review flag ignored; unknown model appended as `guest`; missing DB gives idle agents.
2. Start `node server.js` with `PORT=4791`, then `curl -s http://127.0.0.1:4791/api/state`
   returns JSON with every roster agent, and real non-zero usage for at least one
   opencode model and one Claude model (this machine has both data sources). Print the
   number of agents and, for each agent, `id state usage.total`. Then
   `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4791/` for the static route
   (404 is acceptable if `public/index.html` does not exist yet; create nothing in
   `public/`). A second `/api/state` call within the same second must answer in under
   50 ms. **Stop the server before you finish.**
3. `node bin/aw.js review byteplus/glm-5-2-260617 test note`, then `/api/state` shows
   `review` set and the reviewer `reviewing`; `node bin/aw.js review --done` clears it.

## Return
The report block from `AGENTS.md`, with the real output of the three checks.

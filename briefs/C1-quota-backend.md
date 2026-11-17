# C1 — Backend: quota limits and reset times

## Objective
`/api/state` reports which providers have hit a usage limit and when the limit
lifts, exactly as `docs/SPEC.md` section 9.1 defines.

## Read first
- `AGENTS.md`
- `docs/SPEC.md` sections 2, 3 and 9.1
- `lib/state.js`, `lib/opencode.js`, `lib/claude.js`, `server.js`, `bin/aw.js`, `test/*.test.js` (all exist, tests pass)

## Files you may change
- `lib/quota.js` (new: pure parsing functions)
- `lib/opencode.js`, `lib/claude.js`, `lib/state.js`, `bin/aw.js`
- `test/quota.test.js` (new), `test/state.test.js`, `test/claude.test.js`, `test/opencode.test.js`, `test/fixtures/**`
- Not `server.js` unless a new field cannot reach the response otherwise; say so if you touch it.

## Constraints
- Node 24 built-ins only, CommonJS, no dependencies.
- `lib/quota.js` exports pure functions, for example
  `parseOpencodeQuota(message, statusCode)` → `{ resetAt, text } | null` and
  `parseClaudeLimit(text, timestampMs)` → `{ resetAt, text } | null`. No `Date.now()`
  inside; everything takes its inputs as arguments.
- Claude reset times are wall-clock times in a named IANA zone, e.g.
  `resets 10am (Asia/Bangkok)`, `resets 1:50pm (Asia/Bangkok)`,
  `resets Nov 20, 9am (Asia/Bangkok)`. Compute the first matching instant **after**
  the line's timestamp. Find the zone offset with `Intl.DateTimeFormat` (`timeZone`,
  `hourCycle: 'h23'`, `formatToParts`); do not hard-code +7. If the zone is missing use
  the machine's local zone. If the text cannot be parsed return `resetAt: 0`.
- Claude limit lines (`isApiErrorMessage: true`) must not count as messages, usage or
  activity, and must not change which model a file's "newest assistant entry" is.
  Check how `lib/claude.js` treats them today and fix it if they are counted.
- `lib/claude.js` caches per file and parses appended bytes only: the limit lines you
  collect must survive that cache (keep them in the per-file accumulator).
- `lib/opencode.js` reads the DB every second: select error messages with SQL
  (`json_extract(data,'$.error.data.statusCode') = 429`), limited to the last 7 days;
  do not JSON-parse every row twice.
- `lib/state.js` `buildState` stays pure. It receives the raw limit events from the two
  readers and produces `quota` and each agent's `blockedUntil` (rule in SPEC 9.1,
  including "a newer successful message unblocks").
- `bin/aw.js`: the default reviewer when no Claude agent is active becomes
  `claude-opus-5-5` (it was `claude-fable-5-2`). `bin/aw.js status` prints a `quota`
  line per provider: `byteplus  BLOCKED until 13:37 (2h 15m)` or `byteplus  ok`.
- Keep every existing field of `/api/state` unchanged. All existing tests keep passing.

## Done when
1. `npm test` passes, with new tests for: the opencode message above → the right
   epoch (`Date.UTC(2026,10,17,6,37,43)`); Claude `resets 10am (Asia/Bangkok)` with
   timestamp `2026-11-17T02:02:53.622Z` → `2026-11-17T03:00:00Z`; `resets 1:50pm` with a
   timestamp after 1:50pm local → next day; a dated form; unparsable text → 0;
   `blocked` true before `resetAt`, false after, false when a newer successful message
   exists; `blockedUntil` set on every agent of the blocked provider and 0 elsewhere;
   Claude limit lines not counted as usage.
2. `PORT=4792 node server.js`, then `curl -s http://127.0.0.1:4792/api/state` and print
   only `quota` and, per agent, `id blockedUntil`. This machine has a real BytePlus
   quota error from today (reset 14:37:43 +0800) and real Claude limit lines; both must
   show up with sensible times. **Stop the server before you finish.**
3. `node bin/aw.js status` prints the quota lines.

## Return
The report block from `AGENTS.md`, with the real output of check 2.

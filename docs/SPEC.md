# AgentwatchUI — shared contract

A local dashboard that shows, as a pixel-art office, which AI models are working
right now. opencode worker models sit at computers when they work and on a waiting
bench when idle. Claude Code models sit in the manager corner; when the manager
reviews a worker's output, it walks to that worker's desk.

Everything here is a **contract between modules**. Do not change names, shapes or
file paths in this file; if something cannot work as written, say so in your report.

## 1. Layout of the repo

```
server.js                 Node HTTP server (no npm dependencies)      [backend]
lib/opencode.js           reads opencode's SQLite DB                  [backend]
lib/claude.js             reads Claude Code transcripts (*.jsonl)     [backend]
lib/state.js              merges everything into the /api/state JSON  [backend]
bin/aw.js                 tiny CLI to set the review flag             [backend]
config/roster.json        list of models, roles, colours              [orchestrator]
test/*.test.js            node:test tests                             [backend]
public/index.html         page shell, HUD markup                      [hud]
public/css/style.css      HUD styles                                  [hud]
public/js/hud.js          usage panels, event log                     [hud]
public/js/sprites.js      procedural pixel-art textures               [art]
public/js/office.js       three.js scene, characters, movement        [scene]
public/js/main.js         boot, polling loop                          [scene]
public/vendor/three.module.js   three.js r170+, already present, do not edit
start.bat                 launcher                                    [orchestrator]
```

Runtime: Node 24 (`node:sqlite`, `node:test`, `fetch` available). Browser: current
Chrome/Edge. Front-end is plain ES modules, no bundler, no CDN, no npm packages.
Import three.js only as `import * as THREE from '../vendor/three.module.js'`.

## 2. `GET /api/state` (backend produces, front-end consumes)

```jsonc
{
  "now": 1794880000000,              // server time, ms epoch
  "agents": [                        // one entry per roster model, roster order
    {
      "id": "byteplus/glm-5-2-260617",   // unique key
      "group": "opencode",               // "opencode" | "claude"
      "name": "GLM 5.2",                 // short display name
      "role": "coder",                   // key into roles below
      "roleLabel": "Lập trình logic",
      "color": "#4fb3ff",                // shirt colour, hex
      "state": "working",                // "working" | "idle" | "reviewing"
      "task": "S2a creature spec",       // title of the active session, "" if idle
      "tool": "edit",                    // last tool the model called, "" if none
      "activeSessions": 1,               // number of sessions active right now
      "lastActive": 1794879990000,       // ms epoch of last activity, 0 if never
      "usage": {                         // lifetime totals for this model
        "sessions": 3, "messages": 41,
        "input": 120000, "output": 9000, "reasoning": 2000,
        "cacheRead": 800000, "cacheWrite": 0,
        "total": 931000,                 // sum of the five token fields
        "cost": 0.0
      },
      "usageToday": { /* same shape, local-midnight to now */ }
    }
  ],
  "review": null,                    // or {"by": "<claude agent id>", "target": "<opencode agent id>", "note": "S2a", "since": 1794879990000}
  "totals": {
    "opencode": { "all": {/* usage shape */}, "today": {/* usage shape */} },
    "claude":   { "all": {/* usage shape */}, "today": {/* usage shape */} }
  },
  "events": [                        // newest first, at most 30
    { "t": 1794879990000, "agent": "byteplus/glm-5-2-260617", "text": "edit public/js/office.js" }
  ]
}
```

Rules:

- `agents` contains every model in `config/roster.json`, in roster order, **plus**
  any model found in the data that is not in the roster (appended, `role: "guest"`,
  `roleLabel: "Khách"`, `color: "#9aa0a6"`, name = the part after the last `/`).
- opencode agent `id` is `providerID + "/" + modelID`. Claude agent `id` is the
  transcript's `message.model` string (for example `claude-fable-5-2`).
- An opencode agent is `working` when one of its sessions had a message or part
  updated in the last `ACTIVE_WINDOW_MS` (25 000) **or** its newest assistant message
  has no `time.completed` and was updated in the last 10 minutes. Otherwise `idle`.
- A Claude agent is `working` when a transcript file whose newest assistant entry
  uses that model was modified in the last 90 000 ms. Otherwise `idle`.
- If `review` is set, the agent `review.by` has state `reviewing` (overrides `working`).
- `review` comes from the flag file `~/.agentwatch/review.json` written by `bin/aw.js`;
  it is ignored when older than 15 minutes or when `target` is not a known agent.

## 3. Data sources (backend)

### opencode
SQLite file `~/.local/share/opencode/opencode.db` (override: env `OPENCODE_DB`).
Open **read-only** (`new DatabaseSync(path, { readOnly: true })`); it is in WAL mode
and is being written while we read. Never write to it. Relevant tables:

- `session(id, directory, title, time_created, time_updated, ...)`
- `message(id, session_id, time_created, time_updated, data)` where `data` is JSON.
  Assistant messages look like
  `{"role":"assistant","modelID":"glm-5-2-260617","providerID":"byteplus","cost":0,"tokens":{"input":8162,"output":4,"reasoning":24,"cache":{"read":0,"write":0}},"time":{"created":1794880303136,"completed":1794880305651}}`.
  Sum `tokens` and `cost` over assistant messages, grouped by provider/model.
  `time.completed` is missing while the model is still answering.
- `part(id, message_id, session_id, time_created, time_updated, data)`; tool calls are
  `{"type":"tool","tool":"bash","state":{"status":"completed","input":{...}}}`.
  Use the newest tool part of an active session for `tool` and for `events`
  (text = tool name + a short hint from `state.input`: `filePath`, `command`,
  `pattern`, whichever exists, cut to 60 chars).

All times are ms epoch. The DB may not exist: then opencode agents are all idle
with zero usage, and the server must still answer.

### Claude Code
Transcripts: every `*.jsonl` under `~/.claude/projects/` (recursive; override root:
env `CLAUDE_PROJECTS_DIR`), only files modified in the last 30 days. One JSON object
per line. Use lines with `"type":"assistant"`:
`{"type":"assistant","timestamp":"2026-11-17T01:53:36.221Z","message":{"id":"msg_...","model":"claude-fable-5-2","usage":{"input_tokens":2,"cache_creation_input_tokens":1630,"cache_read_input_tokens":134127,"output_tokens":807}, "content":[{"type":"tool_use","name":"Bash",...}]}}`

- **Deduplicate by `message.id`**: the same message is written several times (one
  line per content block) with the same usage. Count each `message.id` once, taking
  the last line seen. Skip lines whose model is `<synthetic>` or missing.
- Mapping to the usage shape: `input` = `input_tokens`, `output` = `output_tokens`,
  `cacheRead` = `cache_read_input_tokens`, `cacheWrite` = `cache_creation_input_tokens`,
  `reasoning` = 0, `cost` = 0, `messages` = distinct message ids, `sessions` = distinct files.
- `tool` = name of the last `tool_use` block of the newest message; `task` = the
  project folder name of the file (last path segment of its project directory).
- Files are large and many. Cache per file by `(mtimeMs, size)` and re-read only
  changed files; for a file that only grew, parse only the appended bytes.
  A poll with nothing changed must cost under 50 ms.
- Lines can be truncated or invalid JSON: skip them, never throw.

## 4. Server

- `node server.js` listens on `127.0.0.1`, port from env `PORT` or 4780.
- `GET /api/state` → JSON above, `Cache-Control: no-store`.
- Everything else: static files from `public/` (correct MIME for html, css, js, png,
  json; path traversal blocked; `/` → `index.html`).
- State is rebuilt at most once per second (cache between requests).
- `bin/aw.js review <targetAgentId> [note...] [--by <claudeAgentId>]` writes the flag
  file (`by` default: the Claude agent with the newest activity, else `claude-fable-5-2`);
  `bin/aw.js review --done` deletes it; `bin/aw.js status` prints a one-line-per-agent table.
- `lib/state.js` exports `buildState({ now, roster, opencode, claude, review })` as a
  **pure function** (no file or DB access) so it can be unit tested with fixtures.

## 5. `config/roster.json`

```jsonc
{
  "roles": { "coder": "Lập trình logic", "...": "..." },
  "agents": [
    { "id": "byteplus/glm-5-2-260617", "group": "opencode", "name": "GLM 5.2", "role": "coder", "color": "#4fb3ff" }
  ]
}
```

## 6. Sprites (`public/js/sprites.js`, art module)

Pure canvas drawing, no three.js import, no image files. Pixel art, hard edges,
no anti-aliasing, limited palette, 1 px dark outline on characters.

```js
// All functions return an HTMLCanvasElement (transparent background unless noted).
export const PALETTE;                       // { name: '#rrggbb', ... } the colours used
export const CHAR_W = 16, CHAR_H = 24;      // one character frame, in pixels
export const CHAR_POSES = ['stand','walk1','walk2','sit','type1','type2','review1','review2','sleep'];
export function drawCharacter({ pose, shirt, hair, skin, facing });   // 16x24. facing: 'down' | 'up' | 'left' | 'right'
export function characterSheet({ shirt, hair, skin });                // (16*9) x (24*4): columns = CHAR_POSES order, rows = down, up, left, right
export function drawDesk({ screenOn });     // 32x24 desk with a computer, seen from the front; screen glows when screenOn
export function drawManagerDesk({ screenOn }); // 48x24 larger wooden desk
export function drawChair();                // 12x14
export function drawBench();                // 64x14 waiting bench, seats 4
export function drawFloorTile();            // 16x16, opaque, tiles seamlessly
export function drawWallTile();             // 16x24, opaque, tiles horizontally
export function drawPlant();                // 12x20
export function drawWindow();               // 24x20
export function drawRug();                  // 48x32 rug for the manager corner
export function drawBubble(kind);           // 12x12 speech bubble icon; kind: 'code' | 'review' | 'zzz' | 'ok' | 'alert'
export function drawNameplate(text, color); // variable width x 9, tiny 5px-high pixel font, used above heads (ASCII + digits)
```

- `sit` is the idle pose on the bench; `type1/type2` alternate while working at a desk
  (seen from behind when `facing:'up'`); `review1/review2` hold a clipboard or
  magnifying glass; `sleep` is slumped with closed eyes.
- `shirt` is any hex colour; derive a darker shade for shading yourself.

## 7. Scene (`public/js/office.js`, `main.js`)

```js
// office.js
export class Office {
  constructor(canvas);        // creates renderer, orthographic camera, static room
  setState(state);            // the /api/state object; called every poll
  update(dt);                 // seconds; advances walking and frame animation
  render();
  resize(width, height);
}
```

- Orthographic camera looking straight at a 2D room built from textured planes
  (`THREE.CanvasTexture`, `NearestFilter`, no mipmaps, `colorSpace = SRGBColorSpace`),
  integer pixel scale chosen so the room (480x270 art pixels) fits the window.
- Room zones: **work area** with a grid of desks (one desk per opencode agent, at least
  12), **waiting bench row** along the bottom, **manager corner** (top-right, rug,
  manager desk, a small sofa/bench for idle Claude models).
- opencode agent `working` → walks to its own desk, sits, typing animation, screen on,
  `code` bubble. `idle` → walks back to the bench, sits; after 60 s idle shows `zzz`.
- Claude agent `working` → at the manager desk (if several, extra ones stand beside
  it). `idle` → manager sofa. `reviewing` → walks to stand next to the desk of
  `review.target`, `review1/review2` animation, `review` bubble; the target shows `alert`.
  When the review ends it walks back.
- Walking: straight-line segments at 40 art px/s through a corridor (no walking
  through desks is nice to have, not required). Draw order by y so lower characters
  are in front.
- Nameplate above each character; hovering a character (raycast) calls
  `office.onHover(agentOrNull)` if set; clicking calls `office.onSelect(agent)`.
- `main.js`: creates `Office`, polls `/api/state` every 2 s, calls `hud.update(state)`,
  runs `requestAnimationFrame`. If the fetch fails, show the HUD's offline banner and
  keep animating. `?demo=1` in the URL uses a built-in fake state generator instead of
  fetching (agents randomly start/stop working, a review every ~20 s) so the scene can
  be checked without a backend.

## 8. HUD (`index.html`, `style.css`, `hud.js`)

```js
// hud.js
export function initHud(root);          // root = document.getElementById('hud')
export function update(state);          // re-render panels from /api/state
export function setOffline(isOffline);  // banner "Mất kết nối máy chủ"
export function showAgent(agentOrNull); // detail card for hovered/selected agent
```

- `index.html` contains `<canvas id="office">` filling the window and `<div id="hud">`
  overlay, and loads `js/main.js` as a module.
- Panels (Vietnamese labels, pixel font via CSS `font-family: "Courier New", monospace`
  with `image-rendering: pixelated` look, dark translucent panels, 2 px borders):
  - top bar: title "AGENTWATCH", clock, counts "Đang làm: N · Chờ: M".
  - left panel "OPENCODE": total today / all time (tokens, cost), then one row per
    opencode agent: colour dot, name, role label, state, tokens today, tokens all time,
    a small bar proportional to its share of all-time tokens.
  - right panel "CLAUDE CODE": same for Claude agents.
  - bottom-left: event log (last 8 events, time hh:mm:ss, agent name, text).
  - detail card on hover/select: name, id, role, state, task, tool, full usage numbers.
- Numbers formatted compactly: 931000 → `931K`, 1250000 → `1.25M`; cost `$0.00`.
- The HUD must not block mouse events on the canvas except on its own panels
  (`pointer-events: none` on the overlay, `auto` on panels). Panels are collapsible.

## 9. Round 2 additions (2026-11-17)

### 9.1 Quota (backend → front-end)

`/api/state` gains one top-level field and one field per agent:

```jsonc
"quota": [                      // one entry per provider that hit a limit in the last 7 days, newest first
  {
    "id": "byteplus",           // provider key: the part of an opencode agent id before "/", or "claude"
    "group": "opencode",        // "opencode" | "claude"
    "label": "BytePlus Coding Plan",   // "Claude Code" for claude; otherwise the provider key
    "hitAt": 1794884899341,     // ms epoch when the limit message was last seen
    "resetAt": 1794897463000,   // ms epoch when the limit lifts, 0 if it could not be parsed
    "blocked": true,            // see rule below
    "text": "5-hour usage quota" // short human text taken from the message, max 60 chars
  }
]
// and on every agent:
"blockedUntil": 1794897463000   // resetAt of its provider while that provider is blocked, else 0
```

- `blocked` is true when `now < resetAt` **and** no successful assistant message from
  that provider is newer than `hitAt`. With `resetAt` 0 it is true for 5 hours after `hitAt`.
- opencode source: `message.data` JSON with
  `"error":{"name":"APIError","data":{"message":"You have exceeded the 5-hour usage quota. It will reset at 2026-11-17 14:37:43 +0800 CST. ...","statusCode":429}}`
  and `providerID`. Only status 429 messages that contain `quota` or `limit` count.
  Parse the timestamp with its UTC offset (`+0800`).
- Claude source: assistant transcript lines with `"isApiErrorMessage":true,"error":"rate_limit"`
  and text like `You've hit your 5-hour limit · resets 10am (Asia/Bangkok)` or
  `You've hit your session limit · resets 1:50pm (Asia/Bangkok)` or with a date,
  `resets Nov 20, 9am (Asia/Bangkok)`. `resetAt` is the first such wall-clock time
  after the line's `timestamp`, in the named IANA zone (use `Intl.DateTimeFormat`
  with `timeZone`; no libraries). These lines carry no real usage: never count them
  as messages or as activity.
- An agent whose provider is blocked keeps its normal `state`; the front-end decides
  how to show it.

### 9.2 New sprites (art)

Added to `public/js/sprites.js`, same rules as section 6:

```js
export function drawSofa();         // 40x18 lounge sofa, front view, seats 3
export function drawBookshelf();    // 24x34 shelf with coloured book spines
export function drawWaterCooler();  // 10x24
export function drawWhiteboard();   // 44x22 wall-mounted, with a few marker scribbles
export function drawClock();        // 10x10 wall clock
export function drawDoor();         // 20x30
export function drawCoffeeTable();  // 20x12
export function drawPoster();       // 14x16 framed wall poster
export function drawShadow(w);      // w x 4 soft drop shadow (semi-transparent), default w = 12
// drawBubble gains kind 'quota': an hourglass
```

### 9.3 Scene changes

- Every Claude agent has **its own desk with a computer** in the manager corner: the
  first Claude agent in `state.agents` (the manager) gets the big manager desk, the
  others get ordinary desks. A working Claude agent sits **at its own computer**, in
  the same pose and position relative to the desk as an opencode worker at a worker
  desk, and its screen is on. Idle Claude agents sit on the lounge sofa.
- An agent with `blockedUntil > state.now` shows the `quota` bubble while idle
  (instead of `zzz`) and its nameplate is drawn at 55% opacity.
- Decor uses the round-2 sprites; shadows under characters and furniture.

### 9.4 HUD changes

- A line per `quota` entry in the matching panel, under the totals:
  blocked → `HẾT HẠN MỨC · hồi HH:MM (còn 2g 15p)` in amber;
  not blocked and `resetAt` in the past → `Đã hồi lúc HH:MM` in grey, shown for 6 hours after `resetAt` then hidden.
- Agent rows of a blocked provider show the state label `HẾT HẠN MỨC` (amber) when not working.

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { buildState } = require('./lib/state.js');
const { readOpencode } = require('./lib/opencode.js');
const { readClaude } = require('./lib/claude.js');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 4780;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ROSTER_PATH = path.join(__dirname, 'config', 'roster.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

function opencodeDbPath() {
  return process.env.OPENCODE_DB || path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db');
}

function claudeRoot() {
  return process.env.CLAUDE_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects');
}

function reviewPath() {
  return path.join(os.homedir(), '.agentwatch', 'review.json');
}

function readRoster() {
  try {
    return JSON.parse(fs.readFileSync(ROSTER_PATH, 'utf8'));
  } catch (err) {
    console.error('roster: ' + err.message);
    return { roles: {}, agents: [] };
  }
}

function readReview() {
  try {
    const r = JSON.parse(fs.readFileSync(reviewPath(), 'utf8'));
    return r && typeof r === 'object' ? r : null;
  } catch (_) {
    return null;
  }
}

let cachedBuild = null;

function getBuild(now) {
  if (cachedBuild && now - cachedBuild.at < 1000) return cachedBuild;
  const build = {
    at: now,
    roster: readRoster(),
    opencode: readOpencode(opencodeDbPath(), now),
    claude: readClaude(claudeRoot(), now),
  };
  cachedBuild = build;
  return build;
}

function getState() {
  const now = Date.now();
  const b = getBuild(now);
  return buildState({
    now,
    roster: b.roster,
    opencode: b.opencode,
    claude: b.claude,
    review: readReview(),
  });
}

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (_) {
    res.writeHead(400); res.end('Bad Request'); return;
  }
  if (pathname === '/') pathname = '/index.html';
  const full = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (full !== PUBLIC_DIR && !full.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404); res.end('Not Found'); return;
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch (_) {
    res.writeHead(400); res.end('Bad Request'); return;
  }
  if (req.method === 'GET' && pathname === '/api/state') {
    const body = JSON.stringify(getState());
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(body);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log('agentwatch listening on http://' + HOST + ':' + PORT);
});

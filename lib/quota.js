'use strict';

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function offsetFor(zone, ms) {
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch (_) {
    fmt = new Intl.DateTimeFormat('en-US', {
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  const parts = fmt.formatToParts(new Date(ms));
  const get = (t) => {
    const p = parts.find((x) => x.type === t);
    return p ? p.value : '0';
  };
  const wall = Date.UTC(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')),
    Number(get('minute')),
    Number(get('second')),
  );
  return wall - ms;
}

function wallToUtc(zone, y, mo, d, h, mi, s) {
  const naive = Date.UTC(y, mo - 1, d, h, mi, s || 0);
  let ms = naive;
  for (let i = 0; i < 4; i++) {
    const off = offsetFor(zone, ms);
    const next = naive - off;
    if (next === ms) break;
    ms = next;
  }
  return ms;
}

function zoneParts(ms, zone) {
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (_) {
    fmt = new Intl.DateTimeFormat('en-US', {
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  const parts = fmt.formatToParts(new Date(ms));
  const get = (t) => {
    const p = parts.find((x) => x.type === t);
    return p ? p.value : '0';
  };
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
  };
}

function parseOpencodeQuota(message, statusCode) {
  if (statusCode !== 429) return null;
  if (typeof message !== 'string') return null;
  const low = message.toLowerCase();
  if (low.indexOf('quota') === -1 && low.indexOf('limit') === -1) return null;

  let text = '';
  const m1 = message.match(/exceeded the (.+?)(?:\.|$)/i);
  if (m1) text = m1[1].trim();
  else {
    const m2 = message.match(/(\d+\s*[- ]?\s*(?:hour|minute|day|week|session)s?\s*(?:usage\s*)?(?:quota|limit))/i);
    if (m2) text = m2[1].trim();
    else text = message.trim().slice(0, 60);
  }
  text = text.replace(/[.\s]+$/, '').trim().slice(0, 60);

  const rm = message.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?\s*([+-]\d{2}:?\d{2})/);
  let resetAt = 0;
  if (rm) {
    const y = Number(rm[1]);
    const mo = Number(rm[2]);
    const d = Number(rm[3]);
    const h = Number(rm[4]);
    const mi = Number(rm[5]);
    const s = Number(rm[6]);
    const ms = rm[7] ? Number('0.' + rm[7]) * 1000 : 0;
    let off = rm[8];
    if (off.indexOf(':') === -1 && off.length === 5) off = off.slice(0, 3) + ':' + off.slice(3);
    const sign = off[0] === '-' ? -1 : 1;
    const oh = Number(off.slice(1, 3));
    const om = Number(off.slice(4, 6));
    const offsetMs = sign * (oh * 3600000 + om * 60000);
    resetAt = Date.UTC(y, mo - 1, d, h, mi, s, ms) - offsetMs;
  }

  return { resetAt, text };
}

function parseClaudeLimit(text, timestampMs) {
  const ts = num(timestampMs);
  const trimmed = (text == null ? '' : String(text)).trim();

  const re = new RegExp(
    'resets\\s+(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?,?\\s+)?(\\d{1,2})(?::(\\d{2}))?(?::(\\d{2}))?\\s*(am|pm)?\\s*(?:\\(([^)]*)\\))?',
    'i',
  );
  const m = trimmed.match(re);
  if (!m) {
    return { resetAt: 0, text: trimmed.slice(0, 60) };
  }

  const monthStr = m[1] ? m[1].toLowerCase().slice(0, 3) : null;
  const dayNum = m[2] ? Number(m[2]) : null;
  const yearGiven = m[3] ? Number(m[3]) : null;
  let hour = Number(m[4]);
  const minute = m[5] ? Number(m[5]) : 0;
  const second = m[6] ? Number(m[6]) : 0;
  const ap = m[7] ? m[7].toLowerCase() : '';
  let zone = m[8] ? m[8].trim() : '';
  if (!zone) zone = undefined;
  if (zone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone });
    } catch (_) {
      zone = undefined;
    }
  }

  if (ap === 'pm' && hour !== 12) hour += 12;
  if (ap === 'am' && hour === 12) hour = 0;

  if (monthStr === null) {
    const tp = zoneParts(ts, zone);
    const y = tp.year;
    const mo = tp.month;
    const d = tp.day;
    let dayOffset = 0;
    let candidate = 0;
    while (dayOffset < 366) {
      const base = new Date(Date.UTC(y, mo - 1, d + dayOffset));
      const cy = base.getUTCFullYear();
      const cmo = base.getUTCMonth() + 1;
      const cd = base.getUTCDate();
      candidate = wallToUtc(zone, cy, cmo, cd, hour, minute, second);
      if (candidate > ts) break;
      dayOffset += 1;
    }
    return { resetAt: candidate, text: trimmed.slice(0, 60) };
  }

  const month = MONTHS[monthStr];
  let year = yearGiven !== null ? yearGiven : zoneParts(ts, zone).year;
  let candidate = wallToUtc(zone, year, month + 1, dayNum, hour, minute, second);
  if (candidate <= ts) {
    year += 1;
    candidate = wallToUtc(zone, year, month + 1, dayNum, hour, minute, second);
  }
  return { resetAt: candidate, text: trimmed.slice(0, 60) };
}

module.exports = {
  parseOpencodeQuota,
  parseClaudeLimit,
};

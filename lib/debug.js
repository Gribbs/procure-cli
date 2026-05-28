'use strict';

let _enabled = process.env.PROCURE_DEBUG === '1';
let _logFormat = 'text';
let _sink = null;
let _logFileStream = null;

function enable() {
  _enabled = true;
}

function disable() {
  _enabled = false;
}

function isEnabled() {
  return _enabled;
}

function setLogFormat(fmt) {
  if (fmt !== 'text' && fmt !== 'json') {
    throw new Error(`Unknown log format: ${fmt}. Use 'text' or 'json'.`);
  }
  _logFormat = fmt;
}

function getLogFormat() {
  return _logFormat;
}

function setLogFileStream(stream) {
  _logFileStream = stream;
}

function setSink(fn) {
  _sink = fn;
}

function maskToken(token) {
  if (!token || typeof token !== 'string' || token.length < 12) return '***';
  return token.slice(0, 6) + '...' + token.slice(-6);
}

function maskSecret(secret) {
  if (!secret || typeof secret !== 'string') return '***';
  if (secret.length <= 4) return '***';
  return '***' + secret.slice(-4);
}

const SENSITIVE_KEY_RE = /(secret|password|token|key|authorization|bearer)/i;

function redactObject(value, depth = 0) {
  if (depth > 6) return '[Object too deep]';
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redactObject(v, depth + 1));
  if (typeof value !== 'object') return value;

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      if (typeof v === 'string') {
        out[k] = /^bearer\s+/i.test(v)
          ? `Bearer ${maskToken(v.replace(/^bearer\s+/i, ''))}`
          : maskSecret(v);
      } else {
        out[k] = '***';
      }
    } else if (typeof v === 'object' && v !== null) {
      out[k] = redactObject(v, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(event, fields = {}) {
  if (!_enabled) return;
  const safeFields = redactObject(fields);
  const record = {
    ts: new Date().toISOString(),
    schema: 'procure-cli/v1',
    level: safeFields.level || 'debug',
    event,
    ...safeFields,
  };
  delete record.level;
  record.level = safeFields.level || 'debug';

  if (_sink) {
    try {
      _sink(record);
    } catch (_err) {
      // sink should never throw the caller
    }
  }

  if (_logFormat === 'json') {
    const line = JSON.stringify(record);
    process.stderr.write(line + '\n');
    if (_logFileStream) _logFileStream.write(line + '\n');
  } else {
    const head = `[DEBUG] ${event}`;
    const rest = Object.entries(safeFields)
      .filter(([k]) => k !== 'level')
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' ');
    const line = rest ? `${head} ${rest}` : head;
    process.stderr.write(line + '\n');
    if (_logFileStream) _logFileStream.write(line + '\n');
  }
}

function log(...args) {
  if (!_enabled) return;
  if (_logFormat === 'json') {
    emit('debug.log', { message: args.map(stringify).join(' ') });
  } else {
    process.stderr.write('[DEBUG] ' + args.map(stringify).join(' ') + '\n');
    if (_logFileStream) {
      _logFileStream.write('[DEBUG] ' + args.map(stringify).join(' ') + '\n');
    }
  }
}

function stringify(v) {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

module.exports = {
  enable,
  disable,
  isEnabled,
  setLogFormat,
  getLogFormat,
  setLogFileStream,
  setSink,
  log,
  emit,
  maskToken,
  maskSecret,
  redactObject,
};

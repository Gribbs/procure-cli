'use strict';

const debug = require('./debug');

const RESERVED_LONG = new Set([
  'profile',
  'output',
  'query',
  'columns',
  'debug',
  'debug-har',
  'log-format',
  'log-file',
  'no-color',
  'quiet',
  'max-items',
  'page-size',
  'server-format',
  'api-version',
  'concurrency',
  'help',
  'version',
]);

function kebabToSnake(name) {
  return name.replace(/-/g, '_');
}

function parseUnknownArgs(argv, knownLongFlags = new Set()) {
  const out = {};
  const reserved = new Set([...RESERVED_LONG, ...knownLongFlags]);
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (typeof arg !== 'string' || !arg.startsWith('--')) {
      i += 1;
      continue;
    }
    let key = arg.slice(2);
    let value = null;

    const eqIdx = key.indexOf('=');
    if (eqIdx >= 0) {
      value = key.slice(eqIdx + 1);
      key = key.slice(0, eqIdx);
    }

    if (reserved.has(key)) {
      i += 1;
      if (value == null && i < argv.length && !argv[i].startsWith('--')) {
        i += 1;
      }
      continue;
    }

    const snakeKey = kebabToSnake(key);

    if (value == null) {
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        value = argv[i + 1];
        i += 2;
      } else {
        value = 'true';
        i += 1;
      }
    } else {
      i += 1;
    }

    if (snakeKey in out) {
      const prev = out[snakeKey];
      out[snakeKey] = Array.isArray(prev) ? [...prev, value] : [prev, value];
    } else {
      out[snakeKey] = value;
    }
  }

  if (Object.keys(out).length > 0) {
    debug.emit('filter.passthrough', { params: out });
  }

  return out;
}

function applyApiVersion(path, apiVersion) {
  if (!apiVersion) return path;
  return path.replace(/\/api\/(public\/)?v\d+\//, `/api/${apiVersion.replace(/^v/, 'v')}/`);
}

module.exports = {
  parseUnknownArgs,
  kebabToSnake,
  applyApiVersion,
  RESERVED_LONG,
};

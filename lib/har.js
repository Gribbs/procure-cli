'use strict';

const fs = require('fs');
const debug = require('./debug');

class HarRecorder {
  constructor() {
    this.entries = [];
  }

  record({ url, method, requestHeaders, requestBody, responseStatus, responseHeaders, responseBody, startedAt, durationMs }) {
    const safeReqHeaders = sanitiseHeaders(requestHeaders);
    const safeRespHeaders = sanitiseHeaders(responseHeaders);
    const safeReqBody = sanitiseBody(requestBody);
    const safeRespBody = sanitiseBody(responseBody);
    this.entries.push({
      startedDateTime: new Date(startedAt).toISOString(),
      time: durationMs,
      request: {
        method,
        url,
        httpVersion: 'HTTP/1.1',
        headers: safeReqHeaders,
        queryString: parseQueryString(url),
        cookies: [],
        headersSize: -1,
        bodySize: safeReqBody ? Buffer.byteLength(safeReqBody) : 0,
        ...(safeReqBody
          ? { postData: { mimeType: 'application/json', text: safeReqBody } }
          : {}),
      },
      response: {
        status: responseStatus,
        statusText: '',
        httpVersion: 'HTTP/1.1',
        headers: safeRespHeaders,
        cookies: [],
        content: {
          size: safeRespBody ? Buffer.byteLength(safeRespBody) : 0,
          mimeType: getContentType(responseHeaders) || 'application/json',
          text: safeRespBody || '',
        },
        redirectURL: '',
        headersSize: -1,
        bodySize: safeRespBody ? Buffer.byteLength(safeRespBody) : 0,
      },
      cache: {},
      timings: {
        send: 0,
        wait: durationMs,
        receive: 0,
      },
    });
  }

  toJSON() {
    return {
      log: {
        version: '1.2',
        creator: { name: 'procure-cli', version: require('../package.json').version },
        entries: this.entries,
      },
    };
  }

  writeFile(path) {
    fs.writeFileSync(path, JSON.stringify(this.toJSON(), null, 2), 'utf8');
  }
}

function sanitiseHeaders(headersLike) {
  if (!headersLike) return [];
  const out = [];
  const entries = typeof headersLike.entries === 'function' ? Array.from(headersLike.entries()) : Object.entries(headersLike);
  for (const [name, rawValue] of entries) {
    const value = String(rawValue);
    if (/^authorization$/i.test(name)) {
      const token = value.replace(/^Bearer\s+/i, '');
      out.push({ name, value: `Bearer ${debug.maskToken(token)}` });
    } else if (/^cookie$|^set-cookie$/i.test(name)) {
      out.push({ name, value: '***' });
    } else {
      out.push({ name, value });
    }
  }
  return out;
}

function sanitiseBody(body) {
  if (!body) return '';
  if (typeof body !== 'string') {
    try {
      body = JSON.stringify(body);
    } catch {
      return '';
    }
  }
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(debug.redactObject(parsed));
  } catch {
    return body;
  }
}

function getContentType(headersLike) {
  if (!headersLike) return null;
  if (typeof headersLike.get === 'function') return headersLike.get('content-type');
  for (const [k, v] of Object.entries(headersLike)) {
    if (/content-type/i.test(k)) return v;
  }
  return null;
}

function parseQueryString(url) {
  try {
    const u = new URL(url);
    const out = [];
    u.searchParams.forEach((value, name) => {
      out.push({ name, value });
    });
    return out;
  } catch {
    return [];
  }
}

module.exports = { HarRecorder };

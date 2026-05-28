'use strict';

const oauth = require('./oauth');
const debug = require('./debug');

const DEFAULT_RETRY_LIMIT = 3;
const DEFAULT_RETRY_BASE_MS = 500;
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

class ApiError extends Error {
  constructor(message, { status, requestId, body, url, method } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
    this.body = body;
    this.url = url;
    this.method = method;
  }
}

function buildUrl(domain, path, query) {
  const base = `https://${domain}.procurify.com`;
  let pathPart = path.startsWith('/') ? path : `/${path}`;
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v == null || v === '') continue;
      if (Array.isArray(v)) {
        v.forEach((item) => params.append(k, String(item)));
      } else {
        params.append(k, String(v));
      }
    }
    const qs = params.toString();
    if (qs) {
      pathPart += pathPart.includes('?') ? `&${qs}` : `?${qs}`;
    }
  }
  return base + pathPart;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoff(attempt, retryAfter) {
  if (retryAfter) {
    const num = Number(retryAfter);
    if (!Number.isNaN(num) && num >= 0) return num * 1000;
  }
  return DEFAULT_RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * 100;
}

function createClient({ profile, fetchImpl = fetch, harRecorder = null, retryLimit = DEFAULT_RETRY_LIMIT } = {}) {
  let cachedToken = null;
  let cachedDomain = null;

  async function ensureToken({ force = false } = {}) {
    if (!cachedToken || force) {
      const tok = await oauth.getValidToken(profile, { force, fetchImpl });
      cachedToken = tok.accessToken;
      cachedDomain = tok.domain;
    }
    return { accessToken: cachedToken, domain: cachedDomain };
  }

  async function request({ method, path, query = {}, body = null, headers = {}, parseJson = true, allowRetryAfterReauth = true } = {}) {
    if (!method) throw new Error('request: method is required');
    if (!path) throw new Error('request: path is required');

    const { accessToken, domain } = await ensureToken();
    const url = buildUrl(domain, path, query);
    const requestHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'X-Procurify-Client': 'api',
      Accept: 'application/json',
      ...headers,
    };

    let bodyText = null;
    if (body != null) {
      bodyText = typeof body === 'string' ? body : JSON.stringify(body);
      if (!requestHeaders['Content-Type']) requestHeaders['Content-Type'] = 'application/json';
    }

    let attempt = 1;
    let triedReauth = false;

    while (true) {
      debug.emit('http.request', {
        method,
        url,
        attempt,
      });

      const startedAt = Date.now();
      let res;
      try {
        res = await fetchImpl(url, {
          method,
          headers: requestHeaders,
          body: bodyText,
        });
      } catch (err) {
        const durationMs = Date.now() - startedAt;
        debug.emit('http.error', { method, url, durationMs, message: err.message });
        if (IDEMPOTENT_METHODS.has(method) && attempt < retryLimit) {
          const wait = computeBackoff(attempt);
          debug.emit('http.retry', { method, url, attempt, reason: 'network', waitMs: wait });
          await sleep(wait);
          attempt += 1;
          continue;
        }
        throw new ApiError(`Network error: ${err.message}`, { url, method });
      }

      const durationMs = Date.now() - startedAt;
      const responseText = await res.text();
      const requestId = res.headers.get('x-request-id') || res.headers.get('x-procurify-request-id') || null;

      debug.emit('http.response', {
        method,
        url,
        status: res.status,
        durationMs,
        bytes: responseText ? responseText.length : 0,
        requestId,
        attempt,
      });

      if (harRecorder) {
        harRecorder.record({
          url,
          method,
          requestHeaders,
          requestBody: bodyText,
          responseStatus: res.status,
          responseHeaders: res.headers,
          responseBody: responseText,
          startedAt,
          durationMs,
        });
      }

      if (res.status === 401 && !triedReauth && allowRetryAfterReauth) {
        triedReauth = true;
        debug.emit('http.retry', { method, url, attempt, reason: '401_reauth' });
        await ensureToken({ force: true });
        requestHeaders.Authorization = `Bearer ${cachedToken}`;
        attempt += 1;
        continue;
      }

      if (res.status === 429 && IDEMPOTENT_METHODS.has(method) && attempt < retryLimit) {
        const wait = computeBackoff(attempt, res.headers.get('retry-after'));
        debug.emit('http.retry', { method, url, attempt, reason: '429', waitMs: wait });
        await sleep(wait);
        attempt += 1;
        continue;
      }

      if (res.status >= 500 && IDEMPOTENT_METHODS.has(method) && attempt < retryLimit) {
        const wait = computeBackoff(attempt);
        debug.emit('http.retry', { method, url, attempt, reason: `${res.status}`, waitMs: wait });
        await sleep(wait);
        attempt += 1;
        continue;
      }

      let parsed = null;
      if (parseJson && responseText) {
        try {
          parsed = JSON.parse(responseText);
        } catch {
          parsed = null;
        }
      }

      if (!res.ok) {
        const message =
          parsed && (parsed.detail || parsed.message)
            ? `${res.status}: ${parsed.detail || parsed.message}`
            : `HTTP ${res.status}: ${responseText.slice(0, 800)}`;
        throw new ApiError(message, {
          status: res.status,
          requestId,
          body: parsed || responseText,
          url,
          method,
        });
      }

      return {
        status: res.status,
        requestId,
        url,
        text: responseText,
        body: parsed,
        headers: res.headers,
      };
    }
  }

  return {
    request,
    ensureToken,
  };
}

module.exports = { createClient, ApiError, buildUrl };

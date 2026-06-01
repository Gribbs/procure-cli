'use strict';

const config = require('./config');
const debug = require('./debug');

const PROCURIFY_AUDIENCE = 'https://api.procurify.com/';

class OAuthError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'OAuthError';
    this.status = status;
    this.body = body;
  }
}

function tokenUrl(domain) {
  return `https://${domain}.procurify.com/oauth/token`;
}

const SENSITIVE_BODY_KEY_RE = /(secret|password|token|client_id|assertion|authorization|bearer)/i;

function redactBodyObject(value, depth = 0) {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redactBodyObject(v, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_BODY_KEY_RE.test(k)) {
      out[k] = typeof v === 'string' ? debug.maskSecret(v) : '***';
    } else if (v && typeof v === 'object') {
      out[k] = redactBodyObject(v, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Procurify echoes the request (including client_id/client_secret) back in error
// bodies, so any response text surfaced in an error must be redacted first.
function sanitizeResponseText(text) {
  if (!text || typeof text !== 'string') return text;
  try {
    return JSON.stringify(redactBodyObject(JSON.parse(text)));
  } catch {
    return text.replace(
      /("?(?:client_secret|client_id|access_token|refresh_token|password|assertion)"?\s*[:=]\s*"?)([^"&,}\s]+)("?)/gi,
      (_m, prefix, val, suffix) => `${prefix}${debug.maskSecret(val)}${suffix}`
    );
  }
}

async function fetchToken({ domain, clientId, clientSecret }, fetchImpl = fetch) {
  const url = tokenUrl(domain);
  const requestBody = {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    audience: PROCURIFY_AUDIENCE,
  };

  debug.emit('oauth.request', {
    url,
    grant_type: 'client_credentials',
    audience: PROCURIFY_AUDIENCE,
    clientId: debug.maskSecret(clientId),
    clientSecret: debug.maskSecret(clientSecret),
  });

  const startedAt = Date.now();
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(requestBody),
  });
  const text = await res.text();
  const durationMs = Date.now() - startedAt;

  if (!res.ok) {
    const safeBody = sanitizeResponseText(text);
    debug.emit('oauth.token.failed', { status: res.status, durationMs });
    throw new OAuthError(
      `OAuth token request failed (HTTP ${res.status}): ${safeBody.slice(0, 500)}`,
      { status: res.status, body: safeBody }
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new OAuthError(`OAuth token response is not valid JSON: ${err.message}`, {
      status: res.status,
      body: sanitizeResponseText(text),
    });
  }
  if (!parsed.access_token) {
    throw new OAuthError('OAuth token response missing access_token', { status: res.status, body: text });
  }

  const expiresInMs = (Number(parsed.expires_in) || 86400) * 1000;
  const tokenExpiry = Date.now() + expiresInMs;

  debug.emit('oauth.token.fetched', {
    status: res.status,
    durationMs,
    expiresIn: Math.round(expiresInMs / 1000),
    accessToken: debug.maskToken(parsed.access_token),
  });

  return {
    accessToken: parsed.access_token,
    tokenExpiry,
    expiresIn: Math.round(expiresInMs / 1000),
  };
}

async function getValidToken(profileName, opts = {}) {
  const { force = false, fetchImpl = fetch } = opts;
  const creds = config.resolveCredentials(profileName);
  if (!creds || creds.source === null) {
    throw new OAuthError(
      `No credentials for profile '${creds ? creds.profile : profileName}'. ` +
        `Run: procure configure --profile ${creds ? creds.profile : profileName}`
    );
  }

  if (!force && creds.accessToken && creds.tokenExpiry) {
    const remainingMs = creds.tokenExpiry - Date.now();
    const buffer = 5 * 60 * 1000;
    if (remainingMs > buffer) {
      debug.emit('oauth.token.cache_hit', {
        profile: creds.profile,
        expiresInMs: remainingMs,
      });
      return {
        accessToken: creds.accessToken,
        tokenExpiry: creds.tokenExpiry,
        domain: creds.domain,
        cached: true,
      };
    }
    debug.emit('oauth.token.cache_miss', {
      profile: creds.profile,
      reason: 'expired_or_near_expiry',
    });
  } else if (!force) {
    debug.emit('oauth.token.cache_miss', { profile: creds.profile, reason: 'no_cached_token' });
  } else {
    debug.emit('oauth.token.cache_miss', { profile: creds.profile, reason: 'forced' });
  }

  const fresh = await fetchToken(
    {
      domain: creds.domain,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    },
    fetchImpl
  );

  if (creds.source === 'profile') {
    config.saveTokens(creds.profile, {
      accessToken: fresh.accessToken,
      tokenExpiry: fresh.tokenExpiry,
    });
  }

  return {
    accessToken: fresh.accessToken,
    tokenExpiry: fresh.tokenExpiry,
    domain: creds.domain,
    cached: false,
  };
}

module.exports = {
  PROCURIFY_AUDIENCE,
  OAuthError,
  tokenUrl,
  fetchToken,
  getValidToken,
  sanitizeResponseText,
};

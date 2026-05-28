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
    debug.emit('oauth.token.failed', { status: res.status, durationMs });
    throw new OAuthError(
      `OAuth token request failed (HTTP ${res.status}): ${text.slice(0, 500)}`,
      { status: res.status, body: text }
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new OAuthError(`OAuth token response is not valid JSON: ${err.message}`, { status: res.status, body: text });
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
};

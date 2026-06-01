'use strict';

const { setupTmpHome } = require('./helpers/tmpHome');

let oauth;
let config;

function mockResponse({ status = 200, body = {}, headers = {} }) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map(Object.entries(headers)),
    text: async () => text,
  };
}

describe('lib/oauth', () => {
  let home;

  beforeEach(() => {
    home = setupTmpHome();
    jest.resetModules();
    oauth = require('../lib/oauth');
    config = require('../lib/config');
  });

  afterEach(() => {
    home.cleanup();
  });

  describe('fetchToken', () => {
    it('POSTs grant_type=client_credentials with audience and parses access_token', async () => {
      let captured;
      const fakeFetch = jest.fn(async (url, opts) => {
        captured = { url, body: JSON.parse(opts.body), headers: opts.headers };
        return mockResponse({ status: 200, body: { access_token: 'tok-abcdef-123', expires_in: 86400 } });
      });

      const result = await oauth.fetchToken(
        { domain: 'acme', clientId: 'cid', clientSecret: 'sec' },
        fakeFetch
      );

      expect(captured.url).toBe('https://acme.procurify.com/oauth/token');
      expect(captured.body.grant_type).toBe('client_credentials');
      expect(captured.body.audience).toBe(oauth.PROCURIFY_AUDIENCE);
      expect(captured.body.client_id).toBe('cid');
      expect(captured.body.client_secret).toBe('sec');
      expect(result.accessToken).toBe('tok-abcdef-123');
      expect(result.expiresIn).toBe(86400);
      expect(result.tokenExpiry).toBeGreaterThan(Date.now());
    });

    it('throws on non-2xx response', async () => {
      const fakeFetch = async () => mockResponse({ status: 401, body: { error: 'invalid_client' } });
      await expect(
        oauth.fetchToken({ domain: 'acme', clientId: 'cid', clientSecret: 'sec' }, fakeFetch)
      ).rejects.toThrow(/HTTP 401/);
    });

    it('redacts client_id and client_secret echoed back in error bodies', async () => {
      const secret = 'supersecretvalue1234';
      const clientId = 'nIeayneGllGyilEeFkKhBzvgFZIwibAN';
      const fakeFetch = async () =>
        mockResponse({
          status: 401,
          body: {
            data: { grant_type: 'client_credentials', client_id: clientId, client_secret: secret },
            errors: { detail: { message: 'Unauthorized' } },
          },
        });

      let caught;
      try {
        await oauth.fetchToken({ domain: 'acme', clientId, clientSecret: secret }, fakeFetch);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(oauth.OAuthError);
      expect(caught.message).not.toContain(secret);
      expect(caught.message).not.toContain(clientId);
      expect(caught.body).not.toContain(secret);
      expect(caught.body).not.toContain(clientId);
      // Last 4 chars preserved for diagnosability.
      expect(caught.message).toContain('***ibAN');
      expect(caught.message).toContain('***1234');
    });

    it('throws when access_token missing', async () => {
      const fakeFetch = async () => mockResponse({ status: 200, body: {} });
      await expect(
        oauth.fetchToken({ domain: 'acme', clientId: 'cid', clientSecret: 'sec' }, fakeFetch)
      ).rejects.toThrow(/missing access_token/);
    });
  });

  describe('getValidToken', () => {
    beforeEach(() => {
      config.saveProfile('sb', {
        domain: 'acme',
        clientId: 'cid',
        clientSecret: 'sec',
      });
    });

    it('fetches and caches a fresh token when none cached', async () => {
      const fakeFetch = jest.fn(async () =>
        mockResponse({ status: 200, body: { access_token: 'fresh-token-xyz', expires_in: 86400 } })
      );

      const result = await oauth.getValidToken('sb', { fetchImpl: fakeFetch });
      expect(fakeFetch).toHaveBeenCalledTimes(1);
      expect(result.accessToken).toBe('fresh-token-xyz');
      expect(result.cached).toBe(false);

      const reloaded = config.decryptProfile(config.getProfile('sb'));
      expect(reloaded.accessToken).toBe('fresh-token-xyz');
      expect(reloaded.tokenExpiry).toBeGreaterThan(Date.now() + 86000 * 1000);
    });

    it('returns cached token when valid', async () => {
      config.saveTokens('sb', {
        accessToken: 'cached-token-value',
        tokenExpiry: Date.now() + 60 * 60 * 1000,
      });

      const fakeFetch = jest.fn();
      const result = await oauth.getValidToken('sb', { fetchImpl: fakeFetch });
      expect(fakeFetch).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('cached-token-value');
      expect(result.cached).toBe(true);
    });

    it('refetches when cached token within 5-min buffer', async () => {
      config.saveTokens('sb', {
        accessToken: 'about-to-expire',
        tokenExpiry: Date.now() + 60 * 1000,
      });

      const fakeFetch = jest.fn(async () =>
        mockResponse({ status: 200, body: { access_token: 'new-token-2', expires_in: 86400 } })
      );

      const result = await oauth.getValidToken('sb', { fetchImpl: fakeFetch });
      expect(fakeFetch).toHaveBeenCalledTimes(1);
      expect(result.accessToken).toBe('new-token-2');
    });

    it('refetches when force=true', async () => {
      config.saveTokens('sb', {
        accessToken: 'good-cached-token',
        tokenExpiry: Date.now() + 3600 * 1000,
      });

      const fakeFetch = jest.fn(async () =>
        mockResponse({ status: 200, body: { access_token: 'forced-new-token', expires_in: 86400 } })
      );

      const result = await oauth.getValidToken('sb', { force: true, fetchImpl: fakeFetch });
      expect(fakeFetch).toHaveBeenCalledTimes(1);
      expect(result.accessToken).toBe('forced-new-token');
    });

    it('throws when profile is missing', async () => {
      await expect(oauth.getValidToken('does-not-exist', { fetchImpl: jest.fn() })).rejects.toThrow(/configure/);
    });
  });
});

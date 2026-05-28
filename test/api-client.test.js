'use strict';

const { setupTmpHome } = require('./helpers/tmpHome');

let createClient;
let ApiError;
let buildUrl;
let config;

function mockResponse({ status = 200, body = null, text = null, headers = {} }) {
  const responseText = text != null ? text : body == null ? '' : JSON.stringify(body);
  const headerEntries = Object.entries(headers);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        const found = headerEntries.find(([k]) => k.toLowerCase() === name.toLowerCase());
        return found ? found[1] : null;
      },
      entries() {
        return headerEntries[Symbol.iterator]();
      },
      [Symbol.iterator]() {
        return headerEntries[Symbol.iterator]();
      },
    },
    text: async () => responseText,
  };
}

describe('lib/api-client', () => {
  let home;

  beforeEach(() => {
    home = setupTmpHome();
    jest.resetModules();
    ({ createClient, ApiError, buildUrl } = require('../lib/api-client'));
    config = require('../lib/config');
    config.saveProfile('sb', { domain: 'acme', clientId: 'cid', clientSecret: 'sec' });
    config.saveTokens('sb', { accessToken: 'cached-test-token', tokenExpiry: Date.now() + 3600 * 1000 });
  });

  afterEach(() => {
    home.cleanup();
  });

  describe('buildUrl', () => {
    it('builds URLs with the procurify host and merges query params', () => {
      const url = buildUrl('acme', '/api/v3/users/', { page_size: 50, search: 'foo' });
      expect(url).toBe('https://acme.procurify.com/api/v3/users/?page_size=50&search=foo');
    });

    it('handles paths that already contain a query string', () => {
      const url = buildUrl('acme', '/api/v3/users/?page=2', { page_size: 50 });
      expect(url).toBe('https://acme.procurify.com/api/v3/users/?page=2&page_size=50');
    });

    it('skips null/undefined/empty values', () => {
      const url = buildUrl('acme', '/api/v3/users/', { a: null, b: undefined, c: '', d: 'kept' });
      expect(url).toBe('https://acme.procurify.com/api/v3/users/?d=kept');
    });

    it('repeats array params', () => {
      const url = buildUrl('acme', '/api/v3/users/', { tag: ['a', 'b'] });
      expect(url).toBe('https://acme.procurify.com/api/v3/users/?tag=a&tag=b');
    });
  });

  describe('headers', () => {
    it('attaches Authorization, X-Procurify-Client, Accept', async () => {
      let captured;
      const fetchImpl = async (url, opts) => {
        captured = { url, opts };
        return mockResponse({ status: 200, body: { ok: true } });
      };
      const client = createClient({ profile: 'sb', fetchImpl });
      await client.request({ method: 'GET', path: '/api/v3/users/' });

      expect(captured.opts.headers.Authorization).toBe('Bearer cached-test-token');
      expect(captured.opts.headers['X-Procurify-Client']).toBe('api');
      expect(captured.opts.headers.Accept).toBe('application/json');
    });
  });

  describe('401 single retry', () => {
    it('retries once on 401 with a fresh token', async () => {
      let call = 0;
      let oauthCalls = 0;
      const fetchImpl = jest.fn(async (url) => {
        if (url.endsWith('/oauth/token')) {
          oauthCalls += 1;
          return mockResponse({ status: 200, body: { access_token: 'fresh-token-99', expires_in: 86400 } });
        }
        call += 1;
        if (call === 1) return mockResponse({ status: 401, body: { detail: 'expired' } });
        return mockResponse({ status: 200, body: { ok: true } });
      });

      const client = createClient({ profile: 'sb', fetchImpl });
      const res = await client.request({ method: 'GET', path: '/api/v3/users/' });
      expect(res.status).toBe(200);
      expect(call).toBe(2);
      expect(oauthCalls).toBe(1);
    });

    it('does NOT retry a second 401', async () => {
      let oauthCalls = 0;
      const fetchImpl = jest.fn(async (url) => {
        if (url.endsWith('/oauth/token')) {
          oauthCalls += 1;
          return mockResponse({ status: 200, body: { access_token: 'forced-token', expires_in: 86400 } });
        }
        return mockResponse({ status: 401, body: { detail: 'still bad' } });
      });

      const client = createClient({ profile: 'sb', fetchImpl });
      await expect(client.request({ method: 'GET', path: '/api/v3/users/' })).rejects.toThrow(/401/);
      expect(oauthCalls).toBe(1);
    });
  });

  describe('429 / 5xx retries (idempotent only)', () => {
    it('retries 429 with exponential backoff', async () => {
      let call = 0;
      const fetchImpl = jest.fn(async () => {
        call += 1;
        if (call < 3) return mockResponse({ status: 429, headers: { 'Retry-After': '0' } });
        return mockResponse({ status: 200, body: { ok: true } });
      });
      const client = createClient({ profile: 'sb', fetchImpl, retryLimit: 5 });
      const res = await client.request({ method: 'GET', path: '/x' });
      expect(res.status).toBe(200);
      expect(call).toBe(3);
    });

    it('retries 5xx', async () => {
      let call = 0;
      const fetchImpl = async () => {
        call += 1;
        if (call < 2) return mockResponse({ status: 503 });
        return mockResponse({ status: 200, body: {} });
      };
      const client = createClient({ profile: 'sb', fetchImpl });
      const res = await client.request({ method: 'GET', path: '/x' });
      expect(res.status).toBe(200);
    });

    it('does NOT retry 5xx for non-idempotent methods', async () => {
      let call = 0;
      const fetchImpl = async () => {
        call += 1;
        return mockResponse({ status: 503 });
      };
      const client = createClient({ profile: 'sb', fetchImpl });
      await expect(client.request({ method: 'POST', path: '/x' })).rejects.toThrow(/503/);
      expect(call).toBe(1);
    });
  });

  describe('error shape', () => {
    it('attaches status, requestId, body to ApiError', async () => {
      const fetchImpl = async () =>
        mockResponse({
          status: 400,
          body: { detail: 'bad input' },
          headers: { 'x-request-id': 'req-12345' },
        });
      const client = createClient({ profile: 'sb', fetchImpl });
      try {
        await client.request({ method: 'GET', path: '/x' });
        throw new Error('expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(400);
        expect(err.requestId).toBe('req-12345');
        expect(err.body).toEqual({ detail: 'bad input' });
      }
    });
  });
});

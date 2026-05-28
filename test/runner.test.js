'use strict';

const { setupTmpHome } = require('./helpers/tmpHome');

let runner;
let config;

describe('lib/runner', () => {
  let home;

  beforeEach(() => {
    home = setupTmpHome();
    jest.resetModules();
    runner = require('../lib/runner');
    config = require('../lib/config');
    config.saveProfile('sb', { domain: 'acme', clientId: 'cid', clientSecret: 'sec' });
    config.saveTokens('sb', { accessToken: 'cached-test-token', tokenExpiry: Date.now() + 3600 * 1000 });
  });

  afterEach(() => {
    home.cleanup();
  });

  describe('buildPathFromTemplate', () => {
    it('replaces single placeholder', () => {
      expect(runner.buildPathFromTemplate('/api/v2/ap/bills/{id}/', { id: 'abc-123' })).toBe('/api/v2/ap/bills/abc-123/');
    });

    it('replaces multiple placeholders', () => {
      expect(
        runner.buildPathFromTemplate('/api/v2/purchase_orders/{role}/{status}/', { role: 'approver', status: 'pending' })
      ).toBe('/api/v2/purchase_orders/approver/pending/');
    });

    it('throws when missing param', () => {
      expect(() => runner.buildPathFromTemplate('/x/{id}/', {})).toThrow(/Missing required path parameter/);
    });

    it('encodes special characters', () => {
      expect(runner.buildPathFromTemplate('/x/{id}/', { id: 'a/b' })).toBe('/x/a%2Fb/');
    });
  });

  describe('validateArg', () => {
    it('passes for matching enum', () => {
      expect(() => runner.validateArg('vendor_group', 'all', { enum: ['all', 'preferred'] })).not.toThrow();
    });

    it('throws on enum mismatch', () => {
      expect(() => runner.validateArg('vendor_group', 'oops', { enum: ['all'] })).toThrow(/Allowed values/);
    });

    it('throws on pattern mismatch', () => {
      expect(() => runner.validateArg('id', 'abc', { pattern: /^\d+$/ })).toThrow(/expected format/);
    });

    it('passes on pattern match', () => {
      expect(() => runner.validateArg('id', '123', { pattern: /^\d+$/ })).not.toThrow();
    });
  });

  describe('runAction integration (mocked HTTP)', () => {
    function captureStdout(fn) {
      return new Promise((resolve, reject) => {
        const original = process.stdout.write.bind(process.stdout);
        let buf = '';
        process.stdout.write = (chunk) => {
          buf += String(chunk);
          return true;
        };
        Promise.resolve(fn())
          .then(() => {
            process.stdout.write = original;
            resolve(buf);
          })
          .catch((err) => {
            process.stdout.write = original;
            reject(err);
          });
      });
    }

    it('list action collects all pages and prints json', async () => {
      let call = 0;
      const fakeFetch = async (_url) => {
        call += 1;
        const responses = [
          {
            data: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
            metadata: { pagination: { next: 'https://acme.procurify.com/api/v3/users/?page=2' } },
          },
          {
            data: [{ id: 3, name: 'c' }],
            metadata: { pagination: { next: null } },
          },
        ];
        return {
          ok: true,
          status: 200,
          headers: { get: () => null, entries: () => [][Symbol.iterator]() },
          text: async () => JSON.stringify(responses[call - 1]),
        };
      };

      const apiClient = require('../lib/api-client');
      const origCreate = apiClient.createClient;
      apiClient.createClient = (opts) => origCreate({ ...opts, fetchImpl: fakeFetch });

      const out = await captureStdout(() =>
        runner.runAction({
          serviceName: 'users',
          actionName: 'list-users',
          rawArgv: [],
          globalOpts: { profile: 'sb', output: 'json', maxItems: Infinity },
        })
      );

      apiClient.createClient = origCreate;

      const parsed = JSON.parse(out);
      expect(parsed).toEqual([{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }]);
      expect(call).toBe(2);
    });

    it('rejects invalid hex UUID for ap get-bill', async () => {
      await expect(
        runner.runAction({
          serviceName: 'ap',
          actionName: 'get-bill',
          positionalArgs: ['not-a-uuid-zzz!'],
          rawArgv: [],
          globalOpts: { profile: 'sb' },
        })
      ).rejects.toThrow(/expected format/);
    });

    it('positional and --id flag are equivalent', async () => {
      let captured;
      const fakeFetch = async (url) => {
        captured = url;
        return {
          ok: true,
          status: 200,
          headers: { get: () => null, entries: () => [][Symbol.iterator]() },
          text: async () => '{"id":"deadbeef"}',
        };
      };

      const apiClient = require('../lib/api-client');
      const origCreate = apiClient.createClient;
      apiClient.createClient = (opts) => origCreate({ ...opts, fetchImpl: fakeFetch });

      const captureStdout2 = (fn) =>
        new Promise((resolve, reject) => {
          const original = process.stdout.write.bind(process.stdout);
          process.stdout.write = () => true;
          Promise.resolve(fn())
            .then(() => {
              process.stdout.write = original;
              resolve();
            })
            .catch((err) => {
              process.stdout.write = original;
              reject(err);
            });
        });

      await captureStdout2(() =>
        runner.runAction({
          serviceName: 'ap',
          actionName: 'get-bill',
          positionalArgs: ['deadbeef0123456789abcdef'],
          rawArgv: [],
          globalOpts: { profile: 'sb' },
        })
      );
      const positionalUrl = captured;

      await captureStdout2(() =>
        runner.runAction({
          serviceName: 'ap',
          actionName: 'get-bill',
          positionalArgs: [],
          rawArgv: ['--id', 'deadbeef0123456789abcdef'],
          globalOpts: { profile: 'sb' },
        })
      );
      const flagUrl = captured;

      apiClient.createClient = origCreate;

      expect(positionalUrl).toBe(flagUrl);
      expect(positionalUrl).toContain('/api/v2/ap/bills/deadbeef0123456789abcdef/');
    });

    it('PATCH update-vendor sends body and method', async () => {
      let captured;
      const fakeFetch = async (url, init) => {
        captured = { url, method: init && init.method, body: init && init.body, headers: init && init.headers };
        return {
          ok: true,
          status: 200,
          headers: { get: () => null, entries: () => [][Symbol.iterator]() },
          text: async () => JSON.stringify({ data: { id: 42, comments: 'hello' } }),
        };
      };
      const apiClient = require('../lib/api-client');
      const origCreate = apiClient.createClient;
      apiClient.createClient = (opts) => origCreate({ ...opts, fetchImpl: fakeFetch });

      const captureStdout2 = (fn) =>
        new Promise((resolve, reject) => {
          const original = process.stdout.write.bind(process.stdout);
          process.stdout.write = () => true;
          Promise.resolve(fn()).then(() => { process.stdout.write = original; resolve(); }).catch((e) => { process.stdout.write = original; reject(e); });
        });

      await captureStdout2(() =>
        runner.runAction({
          serviceName: 'vendors',
          actionName: 'update-vendor',
          positionalArgs: ['42'],
          rawArgv: [],
          body: '{"comments":"hello"}',
          globalOpts: { profile: 'sb' },
        })
      );

      apiClient.createClient = origCreate;
      expect(captured.method).toBe('PATCH');
      expect(captured.url).toContain('/api/v3/vendors/42/');
      expect(captured.body).toBe('{"comments":"hello"}');
      expect(captured.headers['Content-Type']).toBe('application/json');
    });

    it('touch-vendor uses defaultBody {} when no --body provided', async () => {
      let captured;
      const fakeFetch = async (url, init) => {
        captured = { url, method: init && init.method, body: init && init.body };
        return {
          ok: true,
          status: 200,
          headers: { get: () => null, entries: () => [][Symbol.iterator]() },
          text: async () => '{"data":{"id":99,"dateModified":"2026-04-28T10:00:00+10:00"}}',
        };
      };
      const apiClient = require('../lib/api-client');
      const origCreate = apiClient.createClient;
      apiClient.createClient = (opts) => origCreate({ ...opts, fetchImpl: fakeFetch });

      const captureStdout2 = (fn) =>
        new Promise((resolve, reject) => {
          const original = process.stdout.write.bind(process.stdout);
          process.stdout.write = () => true;
          Promise.resolve(fn()).then(() => { process.stdout.write = original; resolve(); }).catch((e) => { process.stdout.write = original; reject(e); });
        });

      await captureStdout2(() =>
        runner.runAction({
          serviceName: 'vendors',
          actionName: 'touch-vendor',
          positionalArgs: ['99'],
          rawArgv: [],
          globalOpts: { profile: 'sb' },
        })
      );

      apiClient.createClient = origCreate;
      expect(captured.method).toBe('PATCH');
      expect(captured.url).toContain('/api/v3/vendors/99/');
      expect(captured.body).toBe('{}');
    });

    it('update-vendor without --body throws UsageError', async () => {
      await expect(
        runner.runAction({
          serviceName: 'vendors',
          actionName: 'update-vendor',
          positionalArgs: ['42'],
          rawArgv: [],
          globalOpts: { profile: 'sb' },
        })
      ).rejects.toThrow(/requires a request body/);
    });

    it('get-vendor with --body throws UsageError (action does not accept body)', async () => {
      await expect(
        runner.runAction({
          serviceName: 'vendors',
          actionName: 'get-vendor',
          positionalArgs: ['42'],
          rawArgv: [],
          body: '{"x":1}',
          globalOpts: { profile: 'sb' },
        })
      ).rejects.toThrow(/does not accept a request body/);
    });

    it('update-bill PATCHes v3 endpoint with body', async () => {
      let captured;
      const fakeFetch = async (url, init) => {
        captured = { url, method: init && init.method, body: init && init.body };
        return {
          ok: true,
          status: 200,
          headers: { get: () => null, entries: () => [][Symbol.iterator]() },
          text: async () => '{"data":{"vendor":1067}}',
        };
      };
      const apiClient = require('../lib/api-client');
      const origCreate = apiClient.createClient;
      apiClient.createClient = (opts) => origCreate({ ...opts, fetchImpl: fakeFetch });

      const captureStdout2 = (fn) =>
        new Promise((resolve, reject) => {
          const original = process.stdout.write.bind(process.stdout);
          process.stdout.write = () => true;
          Promise.resolve(fn()).then(() => { process.stdout.write = original; resolve(); }).catch((e) => { process.stdout.write = original; reject(e); });
        });

      await captureStdout2(() =>
        runner.runAction({
          serviceName: 'ap',
          actionName: 'update-bill',
          positionalArgs: ['847aae0ddda043e3be0b8a0203e4920b'],
          rawArgv: [],
          body: '{"note":"reset"}',
          globalOpts: { profile: 'sb' },
        })
      );

      apiClient.createClient = origCreate;
      expect(captured.method).toBe('PATCH');
      expect(captured.url).toContain('/api/v3/ap/bills/847aae0ddda043e3be0b8a0203e4920b/');
      expect(captured.body).toBe('{"note":"reset"}');
    });
  });

  describe('resolveBody', () => {
    it('returns body string verbatim when not @-prefixed', () => {
      expect(runner.resolveBody({ body: '{"a":1}' })).toBe('{"a":1}');
    });

    it('returns defaultBody when no body or bodyFile provided', () => {
      expect(runner.resolveBody({ defaultBody: '{}' })).toBe('{}');
    });

    it('body takes precedence over defaultBody', () => {
      expect(runner.resolveBody({ body: '{"x":1}', defaultBody: '{}' })).toBe('{"x":1}');
    });

    it('returns null when nothing provided', () => {
      expect(runner.resolveBody({})).toBeNull();
    });
  });

  describe('runAction unknown-filter passthrough (regression)', () => {
    it('passes through unknown filters as snake_case query params', async () => {
      let capturedUrl;
      const fakeFetch = async (url) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          headers: { get: () => null, entries: () => [][Symbol.iterator]() },
          text: async () => JSON.stringify({ data: [], metadata: { pagination: { next: null } } }),
        };
      };

      const apiClient = require('../lib/api-client');
      const origCreate = apiClient.createClient;
      apiClient.createClient = (opts) => origCreate({ ...opts, fetchImpl: fakeFetch });

      const captureStdout2 = (fn) =>
        new Promise((resolve, reject) => {
          const original = process.stdout.write.bind(process.stdout);
          process.stdout.write = () => true;
          Promise.resolve(fn()).then(() => { process.stdout.write = original; resolve(); }).catch((e) => { process.stdout.write = original; reject(e); });
        });

      await captureStdout2(() =>
        runner.runAction({
          serviceName: 'ap',
          actionName: 'list-bills',
          rawArgv: ['--vendor', '99', '--exported-only'],
          globalOpts: { profile: 'sb' },
        })
      );

      apiClient.createClient = origCreate;
      expect(capturedUrl).toContain('vendor=99');
      expect(capturedUrl).toContain('exported_only=true');
    });
  });
});

'use strict';

const { setupTmpHome } = require('./helpers/tmpHome');

describe('lib/configure', () => {
  let home;

  beforeEach(() => {
    home = setupTmpHome();
    jest.resetModules();
  });

  afterEach(() => {
    home.cleanup();
  });

  it('writes a profile after collecting answers', async () => {
    jest.doMock('inquirer', () => ({
      createPromptModule: () => async () => ({
        domain: 'acme',
        clientId: 'cid-from-prompt',
        clientSecret: 'sec-from-prompt',
      }),
    }));

    const { configure } = require('../lib/configure');
    const config = require('../lib/config');

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await configure('sandbox');
    logSpy.mockRestore();

    expect(config.profileExists('sandbox')).toBe(true);
    const decrypted = config.decryptProfile(config.getProfile('sandbox'));
    expect(decrypted.domain).toBe('acme');
    expect(decrypted.clientId).toBe('cid-from-prompt');
    expect(decrypted.clientSecret).toBe('sec-from-prompt');
  });

  describe('maskValue', () => {
    it('masks long values showing last 4 chars', () => {
      const { maskValue } = require('../lib/configure');
      expect(maskValue('verysecretvalue')).toMatch(/\*+alue$/);
      expect(maskValue('abc')).toBe('****');
      expect(maskValue('')).toBe('****');
    });
  });

  describe('normaliseSubdomain', () => {
    it('returns plain subdomains unchanged (lowercased)', () => {
      const { normaliseSubdomain } = require('../lib/configure');
      expect(normaliseSubdomain('acme')).toBe('acme');
      expect(normaliseSubdomain('  acme-sandbox  ')).toBe('acme-sandbox');
      expect(normaliseSubdomain('ACME')).toBe('acme');
    });

    it('strips .procurify.com suffix', () => {
      const { normaliseSubdomain } = require('../lib/configure');
      expect(normaliseSubdomain('acme-sandbox.procurify.com')).toBe('acme-sandbox');
      expect(normaliseSubdomain('acme.procurify.com/')).toBe('acme');
      expect(normaliseSubdomain('acme.procurify.com/integrations/api')).toBe('acme');
    });

    it('strips http(s):// prefix', () => {
      const { normaliseSubdomain } = require('../lib/configure');
      expect(normaliseSubdomain('https://acme-sandbox.procurify.com')).toBe('acme-sandbox');
      expect(normaliseSubdomain('http://acme.procurify.com/foo')).toBe('acme');
    });

    it('returns empty for empty / nullish input', () => {
      const { normaliseSubdomain } = require('../lib/configure');
      expect(normaliseSubdomain('')).toBe('');
      expect(normaliseSubdomain(null)).toBe('');
      expect(normaliseSubdomain(undefined)).toBe('');
    });
  });
});

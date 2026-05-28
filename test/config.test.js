'use strict';

const fs = require('fs');
const { setupTmpHome } = require('./helpers/tmpHome');

let config;

describe('lib/config', () => {
  let home;

  beforeEach(() => {
    home = setupTmpHome();
    jest.resetModules();
    config = require('../lib/config');
  });

  afterEach(() => {
    home.cleanup();
  });

  describe('encryption round-trip', () => {
    it('encrypts and decrypts strings', () => {
      const plain = 'super-secret-client-credential-value';
      const encrypted = config.encrypt(plain);
      expect(encrypted).not.toBe(plain);
      expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
      expect(config.decrypt(encrypted)).toBe(plain);
    });

    it('produces unique IVs for the same plaintext', () => {
      const plain = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const a = config.encrypt(plain);
      const b = config.encrypt(plain);
      expect(a).not.toBe(b);
      const ivA = a.split(':')[0];
      const ivB = b.split(':')[0];
      expect(ivA).not.toBe(ivB);
    });

    it('returns falsy values unchanged', () => {
      expect(config.encrypt('')).toBe('');
      expect(config.encrypt(null)).toBe(null);
      expect(config.decrypt('')).toBe('');
      expect(config.decrypt(null)).toBe(null);
      expect(config.decrypt('plaintext-no-colon')).toBe('plaintext-no-colon');
    });
  });

  describe('encryption key file permissions', () => {
    it('creates the key file with mode 0600', () => {
      config.getEncryptionKey();
      const stat = fs.statSync(config.KEY_FILE);
      expect(stat.mode & 0o777).toBe(0o600);
    });

    it('refuses to read the key file if mode is loosened', () => {
      config.getEncryptionKey();
      fs.chmodSync(config.KEY_FILE, 0o644);
      expect(() => config.getEncryptionKey()).toThrow(/insecure permissions/);
    });
  });

  describe('profile CRUD', () => {
    it('saves and retrieves a profile', () => {
      config.saveProfile('sandbox', {
        domain: 'acme',
        clientId: 'cid-abc-123',
        clientSecret: 'shh-very-secret',
      });

      expect(config.profileExists('sandbox')).toBe(true);
      expect(config.getAllProfiles()).toContain('sandbox');

      const raw = config.getProfile('sandbox');
      expect(raw.domain).toBe('acme');
      expect(raw.clientId).toBe('cid-abc-123');
      expect(raw.clientSecret).not.toBe('shh-very-secret');
      expect(raw.clientSecret).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);

      const decrypted = config.decryptProfile(raw);
      expect(decrypted.clientSecret).toBe('shh-very-secret');
    });

    it('rejects profiles missing required fields', () => {
      expect(() => config.saveProfile('bad', { domain: 'acme' })).toThrow(/clientId/);
    });

    it('deletes profiles cleanly', () => {
      config.saveProfile('throwaway', {
        domain: 'x',
        clientId: 'y',
        clientSecret: 'z',
      });
      expect(config.deleteProfile('throwaway')).toBe(true);
      expect(config.profileExists('throwaway')).toBe(false);
      expect(config.deleteProfile('throwaway')).toBe(false);
    });
  });

  describe('saveTokens', () => {
    it('attaches encrypted tokens to a saved profile', () => {
      config.saveProfile('sb', { domain: 'acme', clientId: 'cid', clientSecret: 'sec' });
      const expiry = Date.now() + 3600 * 1000;
      config.saveTokens('sb', { accessToken: 'eyJtoken-value', tokenExpiry: expiry });
      const decrypted = config.decryptProfile(config.getProfile('sb'));
      expect(decrypted.accessToken).toBe('eyJtoken-value');
      expect(decrypted.tokenExpiry).toBe(expiry);
    });

    it('throws if profile is missing', () => {
      expect(() => config.saveTokens('ghost', { accessToken: 't', tokenExpiry: 0 })).toThrow(/Profile 'ghost' not found/);
    });
  });

  describe('isTokenExpired', () => {
    it('returns true when no token is set', () => {
      expect(config.isTokenExpired({})).toBe(true);
      expect(config.isTokenExpired({ accessToken: 'abc' })).toBe(true);
      expect(config.isTokenExpired({ tokenExpiry: Date.now() + 10000 })).toBe(true);
    });

    it('returns true when within 5-minute buffer', () => {
      expect(config.isTokenExpired({ accessToken: 'abc', tokenExpiry: Date.now() + 30 * 1000 })).toBe(true);
    });

    it('returns false for tokens valid for >5 minutes', () => {
      expect(config.isTokenExpired({ accessToken: 'abc', tokenExpiry: Date.now() + 60 * 60 * 1000 })).toBe(false);
    });
  });

  describe('environment-variable override', () => {
    const original = {};

    beforeEach(() => {
      ['PROCURIFY_DOMAIN', 'PROCURIFY_CLIENT_ID', 'PROCURIFY_CLIENT_SECRET'].forEach((k) => {
        original[k] = process.env[k];
        delete process.env[k];
      });
    });

    afterEach(() => {
      for (const [k, v] of Object.entries(original)) {
        if (v == null) delete process.env[k];
        else process.env[k] = v;
      }
    });

    it('returns null when env vars are not all set', () => {
      expect(config.getEnvCredentials()).toBeNull();
      process.env.PROCURIFY_DOMAIN = 'acme';
      expect(config.getEnvCredentials()).toBeNull();
    });

    it('returns env credentials when all three are set', () => {
      process.env.PROCURIFY_DOMAIN = 'acme';
      process.env.PROCURIFY_CLIENT_ID = 'env-cid';
      process.env.PROCURIFY_CLIENT_SECRET = 'env-sec';
      const env = config.getEnvCredentials();
      expect(env).toEqual({ domain: 'acme', clientId: 'env-cid', clientSecret: 'env-sec' });
    });

    it('env vars take priority over the profile file', () => {
      config.saveProfile('default', {
        domain: 'profile-domain',
        clientId: 'profile-cid',
        clientSecret: 'profile-sec',
      });
      process.env.PROCURIFY_DOMAIN = 'env-domain';
      process.env.PROCURIFY_CLIENT_ID = 'env-cid';
      process.env.PROCURIFY_CLIENT_SECRET = 'env-sec';

      const resolved = config.resolveCredentials();
      expect(resolved.source).toBe('environment');
      expect(resolved.domain).toBe('env-domain');
      expect(resolved.clientId).toBe('env-cid');
      expect(resolved.clientSecret).toBe('env-sec');
    });

    it('falls back to profile when env vars are missing', () => {
      config.saveProfile('sb', {
        domain: 'profile-domain',
        clientId: 'profile-cid',
        clientSecret: 'profile-sec',
      });
      const resolved = config.resolveCredentials('sb');
      expect(resolved.source).toBe('profile');
      expect(resolved.clientSecret).toBe('profile-sec');
    });

    it('returns null source when no profile exists and no env vars', () => {
      const resolved = config.resolveCredentials('does-not-exist');
      expect(resolved.source).toBeNull();
      expect(resolved.error).toMatch(/not found/);
    });
  });

  it('writes config file with mode 0600', () => {
    config.saveProfile('sb', { domain: 'd', clientId: 'c', clientSecret: 's' });
    const stat = fs.statSync(config.CONFIG_FILE);
    expect(stat.mode & 0o777).toBe(0o600);
  });
});

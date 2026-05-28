'use strict';

const debug = require('../lib/debug');

describe('lib/debug', () => {
  beforeEach(() => {
    debug.disable();
    debug.setLogFormat('text');
    debug.setLogFileStream(null);
  });

  describe('maskToken', () => {
    it('masks tokens 12 characters or longer', () => {
      expect(debug.maskToken('abcdef0123456789ghijkl')).toBe('abcdef...ghijkl');
    });

    it('returns *** for short tokens', () => {
      expect(debug.maskToken('short')).toBe('***');
      expect(debug.maskToken('')).toBe('***');
      expect(debug.maskToken(null)).toBe('***');
      expect(debug.maskToken(undefined)).toBe('***');
    });

    it('returns *** for non-string values', () => {
      expect(debug.maskToken(12345)).toBe('***');
      expect(debug.maskToken({})).toBe('***');
    });
  });

  describe('maskSecret', () => {
    it('shows last 4 characters with leading ***', () => {
      expect(debug.maskSecret('verysecretclientcredential')).toBe('***tial');
    });

    it('returns *** for short values', () => {
      expect(debug.maskSecret('abc')).toBe('***');
      expect(debug.maskSecret('')).toBe('***');
      expect(debug.maskSecret(null)).toBe('***');
    });
  });

  describe('redactObject', () => {
    it('masks fields whose names match secret/password/token/key/authorization', () => {
      const input = {
        ok: 'visible',
        password: 'hidden',
        client_secret: 'shh-hidden',
        access_token: 'eyJtokentoken-token',
        api_key: 'akia-something',
        nested: {
          authorization: 'Bearer eyJabcdef0123456789xyz',
          something: 'kept',
        },
      };

      const out = debug.redactObject(input);
      expect(out.ok).toBe('visible');
      expect(out.password).toBe('***dden');
      expect(out.client_secret).toBe('***dden');
      expect(out.access_token).toBe('***oken');
      expect(out.nested.authorization).toMatch(/^Bearer eyJabc\.\.\.789xyz$/);
      expect(out.nested.something).toBe('kept');
    });

    it('handles arrays of objects', () => {
      const out = debug.redactObject([{ token: 'abcd' }, { token: 'longertokenvalueabcdef' }]);
      expect(out[0].token).toBe('***');
      expect(out[1].token).toBe('***cdef');
    });

    it('caps recursion depth gracefully', () => {
      const obj = { level: 0 };
      let cur = obj;
      for (let i = 0; i < 12; i += 1) {
        cur.next = { level: i + 1 };
        cur = cur.next;
      }
      const out = debug.redactObject(obj);
      expect(out).toBeDefined();
    });
  });

  describe('enable / isEnabled / log', () => {
    it('log() is a no-op when disabled', () => {
      debug.disable();
      const stderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      debug.log('hello');
      expect(stderrWrite).not.toHaveBeenCalled();
      stderrWrite.mockRestore();
    });

    it('log() writes to stderr (not stdout) when enabled', () => {
      debug.enable();
      const stderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const stdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      debug.log('hello');
      expect(stderrWrite).toHaveBeenCalled();
      expect(stdoutWrite).not.toHaveBeenCalled();
      stderrWrite.mockRestore();
      stdoutWrite.mockRestore();
    });

    it('emit() respects enable state', () => {
      debug.disable();
      const stderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      debug.emit('test.event', { foo: 'bar' });
      expect(stderrWrite).not.toHaveBeenCalled();

      debug.enable();
      debug.emit('test.event', { foo: 'bar' });
      expect(stderrWrite).toHaveBeenCalled();
      stderrWrite.mockRestore();
    });

    it('emit() in json format produces parseable NDJSON', () => {
      debug.enable();
      debug.setLogFormat('json');
      const lines = [];
      const stderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation((s) => {
        lines.push(s);
        return true;
      });
      debug.emit('http.response', { status: 200, durationMs: 12 });
      stderrWrite.mockRestore();
      const parsed = JSON.parse(lines.join('').trim());
      expect(parsed.event).toBe('http.response');
      expect(parsed.status).toBe(200);
      expect(parsed.schema).toBe('procure-cli/v1');
    });
  });

  describe('setLogFormat', () => {
    it('accepts text and json', () => {
      expect(() => debug.setLogFormat('text')).not.toThrow();
      expect(() => debug.setLogFormat('json')).not.toThrow();
    });

    it('throws on unknown format', () => {
      expect(() => debug.setLogFormat('xml')).toThrow(/Unknown log format/);
    });
  });
});

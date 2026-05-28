'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { HarRecorder } = require('../lib/har');

describe('lib/har', () => {
  it('records request/response with masked Authorization header', () => {
    const har = new HarRecorder();
    const headers = { entries: () => [['content-type', 'application/json']][Symbol.iterator]() };
    har.record({
      url: 'https://acme.procurify.com/api/v3/users/?page_size=50',
      method: 'GET',
      requestHeaders: { Authorization: 'Bearer eyJabcdef0123456789xyz', 'X-Procurify-Client': 'api' },
      requestBody: null,
      responseStatus: 200,
      responseHeaders: headers,
      responseBody: '{"data":[{"id":1,"client_secret":"hidden-value-here"}]}',
      startedAt: 1700000000000,
      durationMs: 123,
    });
    const json = har.toJSON();
    expect(json.log.version).toBe('1.2');
    expect(json.log.entries).toHaveLength(1);
    const entry = json.log.entries[0];
    expect(entry.request.method).toBe('GET');
    expect(entry.request.url).toContain('acme.procurify.com');
    const authHeader = entry.request.headers.find((h) => /^authorization$/i.test(h.name));
    expect(authHeader.value).toMatch(/^Bearer eyJabc\.\.\./);
    expect(entry.response.content.text).toContain('***');
    expect(entry.response.content.text).not.toContain('hidden-value-here');
  });

  it('writes a valid HAR file', () => {
    const har = new HarRecorder();
    har.record({
      url: 'https://acme.procurify.com/api/v3/users/',
      method: 'GET',
      requestHeaders: {},
      requestBody: null,
      responseStatus: 200,
      responseHeaders: { entries: () => [][Symbol.iterator]() },
      responseBody: '{}',
      startedAt: Date.now(),
      durationMs: 5,
    });
    const tmp = path.join(os.tmpdir(), `procure-har-${Date.now()}.har`);
    har.writeFile(tmp);
    const parsed = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    expect(parsed.log.entries).toHaveLength(1);
    fs.unlinkSync(tmp);
  });

  it('parses query string into pairs', () => {
    const har = new HarRecorder();
    har.record({
      url: 'https://acme.procurify.com/api/v3/users/?a=1&b=hello',
      method: 'GET',
      requestHeaders: {},
      requestBody: null,
      responseStatus: 200,
      responseHeaders: { entries: () => [][Symbol.iterator]() },
      responseBody: '',
      startedAt: Date.now(),
      durationMs: 1,
    });
    const qs = har.toJSON().log.entries[0].request.queryString;
    expect(qs).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: 'hello' },
    ]);
  });
});

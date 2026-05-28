'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const ANSI_RE = /\x1B\[[0-?]*[ -/]*[@-~]/g;
const stripAnsi = (s) => (s || '').replace(ANSI_RE, '');

const CLI = path.join(__dirname, '..', 'index.js');
const registry = require('../lib/services/_registry');

function run(args = [], opts = {}) {
  const env = { ...process.env, PROCURE_HOME: opts.home || '/tmp/no-such-home', NO_COLOR: '1' };
  const out = spawnSync('node', [CLI, ...args], { encoding: 'utf8', env, timeout: 15000 });
  return {
    code: out.status,
    stdout: stripAnsi(out.stdout || ''),
    stderr: stripAnsi(out.stderr || ''),
  };
}

describe('CLI integration', () => {
  it('--version prints version', () => {
    const out = run(['--version']);
    expect(out.code).toBe(0);
    expect(out.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('--help lists all 16 services', () => {
    const out = run(['--help']);
    expect(out.code).toBe(0);
    for (const name of registry.SERVICE_TAG_ORDER) {
      expect(out.stdout).toContain(name);
    }
  });

  it('--help is exit code 0 for every service and every action', () => {
    for (const serviceName of registry.SERVICE_TAG_ORDER) {
      const helpService = run([serviceName, '--help']);
      expect(helpService.code).toBe(0);
      const actions = registry.listActions(serviceName);
      for (const a of actions) {
        const helpAction = run([serviceName, a.action, '--help']);
        expect(helpAction.code).toBe(0);
        expect(helpAction.stdout).toContain(a.action);
      }
    }
  });

  it('list-services prints json with all 17 entries', () => {
    const out = run(['list-services']);
    expect(out.code).toBe(0);
    const arr = JSON.parse(out.stdout);
    expect(arr).toHaveLength(17);
  });

  it('list-actions ap prints JSON', () => {
    const out = run(['list-actions', 'ap']);
    expect(out.code).toBe(0);
    const arr = JSON.parse(out.stdout);
    expect(arr.find((a) => a.action === 'list-bills')).toBeDefined();
    expect(arr.find((a) => a.action === 'get-bill')).toBeDefined();
  });

  it('list-actions on unknown service exits 2', () => {
    const out = run(['list-actions', 'no-such-thing']);
    expect(out.code).toBe(2);
    expect(out.stderr).toMatch(/Unknown service/);
  });

  it('unknown command exits 2', () => {
    const out = run(['totally-not-a-command']);
    expect(out.code).toBe(2);
  });
});

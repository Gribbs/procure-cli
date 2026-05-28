'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function setupTmpHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'procure-test-'));
  const original = process.env.PROCURE_HOME;
  process.env.PROCURE_HOME = dir;

  return {
    dir,
    cleanup() {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (_err) {
        // ignore
      }
      if (original == null) delete process.env.PROCURE_HOME;
      else process.env.PROCURE_HOME = original;
    },
  };
}

module.exports = { setupTmpHome };

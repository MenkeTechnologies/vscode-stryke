// Regression test for lib/resolveBinary.js — the fix for the uncaught
// "Client is not running and can't be stopped" / "Pending response rejected"
// errors that fired when the editor's PATH (GUI launch) didn't include the
// stryke binary. Runs headless in CI (no `vscode` dependency).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveStrykeBinary, defaultFallbackDirs } = require('../lib/resolveBinary');

// Build a throwaway "bin" dir holding an executable named `stryke`, plus a
// non-executable file, so the test asserts real fs.accessSync(X_OK) behavior.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stryke-resolver-'));
const binDir = path.join(tmp, 'bin');
fs.mkdirSync(binDir);
const exe = path.join(binDir, 'stryke');
fs.writeFileSync(exe, '#!/bin/sh\nexit 0\n');
fs.chmodSync(exe, 0o755);
const notExe = path.join(tmp, 'not-exec');
fs.writeFileSync(notExe, 'x');
fs.chmodSync(notExe, 0o644);

const origPath = process.env.PATH;
test.after(() => {
  process.env.PATH = origPath;
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('bare name resolves via PATH', () => {
  process.env.PATH = binDir;
  assert.equal(resolveStrykeBinary('stryke'), exe);
});

test('GUI-launch bug: bare name resolves via fallback dir even with PATH empty', () => {
  // The reported failure: editor launched from the Dock has a minimal PATH
  // that omits the binary's dir. Resolution must still find it via the
  // fallback locations (in production: /opt/homebrew/bin, etc.).
  process.env.PATH = '';
  assert.equal(resolveStrykeBinary('stryke', [binDir]), exe);
});

test('PATH is searched before fallback dirs', () => {
  process.env.PATH = binDir;
  // A bogus fallback must not shadow the real PATH hit.
  assert.equal(resolveStrykeBinary('stryke', ['/nonexistent']), exe);
});

test('explicit executable path is returned as-is', () => {
  assert.equal(resolveStrykeBinary(exe), exe);
});

test('explicit non-executable / missing path returns undefined (no client start)', () => {
  assert.equal(resolveStrykeBinary(path.join(tmp, 'nope', 'stryke')), undefined);
  assert.equal(resolveStrykeBinary(notExe), undefined);
});

test('missing bare name returns undefined', () => {
  process.env.PATH = binDir;
  assert.equal(resolveStrykeBinary('stryke-does-not-exist', []), undefined);
});

test('production fallback list includes the Homebrew prefix', () => {
  // Guards against someone trimming the list and silently reintroducing the
  // GUI-PATH bug for Homebrew installs (the reported environment).
  assert.ok(defaultFallbackDirs().includes('/opt/homebrew/bin'));
});

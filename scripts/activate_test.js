// Regression test for the LSP spawn contract. Pins two things that, when
// broken, silently kill the language server in real editors but pass every
// other check:
//   1. The server is spawned as bare `stryke --lsp` (no `--stdio` appended).
//      Setting `transport: TransportKind.stdio` makes vscode-languageclient
//      append `--stdio`, and stryke's CLI rejects the extra arg — the original
//      "Pending response rejected since connection got disposed" bug.
//   2. When the binary can't be resolved, the LanguageClient is never
//      constructed (so the StartFailed retry/stop cascade can't fire).
//
// extension.js requires `vscode` and `vscode-languageclient/node`, neither of
// which exists outside an editor, so we intercept require() to feed stubs and
// capture the serverOptions the extension builds.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');

// A real executable on disk so resolveStrykeBinary's accessSync(X_OK) passes.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stryke-activate-'));
const fakeBin = path.join(tmp, 'stryke');
fs.writeFileSync(fakeBin, '#!/bin/sh\n');
fs.chmodSync(fakeBin, 0o755);

let captured;        // serverOptions passed to the LanguageClient ctor
let clientCtorCalls; // how many times LanguageClient was constructed

function loadExtensionWith(configPath) {
  captured = undefined;
  clientCtorCalls = 0;
  delete require.cache[require.resolve('../extension.js')];

  const vscodeStub = {
    workspace: {
      getConfiguration: () => ({
        get: (key, def) => (key === 'path' ? configPath : def)
      }),
      createFileSystemWatcher: () => ({ dispose() {} })
    },
    window: { showWarningMessage: () => {} }
  };
  class FakeLanguageClient {
    constructor(_id, _name, serverOptions) {
      clientCtorCalls += 1;
      captured = serverOptions;
    }
    start() { return Promise.resolve(); }
    isRunning() { return false; }
    stop() { return Promise.resolve(); }
  }
  const lcStub = { LanguageClient: FakeLanguageClient, TransportKind: { stdio: 0, ipc: 1, pipe: 2 } };

  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'vscode') return vscodeStub;
    if (request === 'vscode-languageclient/node') return lcStub;
    return origLoad.call(this, request, parent, isMain);
  };
  try {
    const ext = require('../extension.js');
    ext.activate({ subscriptions: [] });
    return ext;
  } finally {
    Module._load = origLoad;
  }
}

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('server is spawned as bare `stryke --lsp` (no --stdio-triggering transport)', () => {
  loadExtensionWith(fakeBin);
  assert.equal(clientCtorCalls, 1);
  assert.deepEqual(captured.run.args, ['--lsp']);
  // The crux: no transport set → vscode-languageclient won't append --stdio.
  assert.equal(captured.run.transport, undefined);
  assert.equal(captured.debug.transport, undefined);
  // And it spawns the resolved absolute path, not a bare name.
  assert.equal(captured.run.command, fakeBin);
});

test('missing binary → LanguageClient is never constructed', () => {
  loadExtensionWith(path.join(tmp, 'does-not-exist', 'stryke'));
  assert.equal(clientCtorCalls, 0);
  assert.equal(captured, undefined);
});

// Regression tests for the extension's runtime wiring. Pins the things that,
// when broken, silently fail in real editors but pass every other check:
//   1. The LSP is spawned as bare `stryke --lsp` (no `--stdio` appended) —
//      setting `transport: TransportKind.stdio` makes vscode-languageclient
//      append `--stdio`, which stryke rejects ("connection got disposed" bug).
//   2. A missing binary never constructs the LanguageClient (no retry/stop cascade).
//   3. Run + debug are registered, and the debug adapter is `stryke --dap` at the
//      resolved absolute path (so debugging works under the GUI PATH).
//
// extension.js requires `vscode` and `vscode-languageclient/node`, neither of
// which exists outside an editor, so we intercept require() with stubs and
// capture what the extension registers.

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
let reg;             // captured registrations (commands, debug providers/factories)

class DebugAdapterExecutable {
  constructor(command, args) { this.command = command; this.args = args; }
}

function loadExtensionWith(configPath, activeEditor) {
  captured = undefined;
  clientCtorCalls = 0;
  reg = { commands: {}, debugConfigProviders: {}, debugAdapterFactories: {} };
  delete require.cache[require.resolve('../extension.js')];

  const vscodeStub = {
    workspace: {
      getConfiguration: () => ({ get: (key, def) => (key === 'path' ? configPath : def) }),
      createFileSystemWatcher: () => ({ dispose() {} }),
      getWorkspaceFolder: () => undefined
    },
    window: { showWarningMessage: () => {}, showErrorMessage: () => {}, activeTextEditor: activeEditor },
    commands: { registerCommand: (id, fn) => { reg.commands[id] = fn; return { dispose() {} }; } },
    debug: {
      registerDebugConfigurationProvider: (type, p) => { reg.debugConfigProviders[type] = p; return { dispose() {} }; },
      registerDebugAdapterDescriptorFactory: (type, f) => { reg.debugAdapterFactories[type] = f; return { dispose() {} }; },
      startDebugging: () => Promise.resolve(true)
    },
    DebugAdapterExecutable
  };
  class FakeLanguageClient {
    constructor(_id, _name, serverOptions) { clientCtorCalls += 1; captured = serverOptions; }
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

test('LSP is spawned as bare `stryke --lsp` (no --stdio-triggering transport)', () => {
  loadExtensionWith(fakeBin);
  assert.equal(clientCtorCalls, 1);
  assert.deepEqual(captured.run.args, ['--lsp']);
  assert.equal(captured.run.transport, undefined);
  assert.equal(captured.debug.transport, undefined);
  assert.equal(captured.run.command, fakeBin);
});

test('missing binary → LanguageClient is never constructed', () => {
  loadExtensionWith(path.join(tmp, 'does-not-exist', 'stryke'));
  assert.equal(clientCtorCalls, 0);
  assert.equal(captured, undefined);
});

test('run + debug commands and providers are registered (even with a missing binary)', () => {
  loadExtensionWith(path.join(tmp, 'nope', 'stryke'));
  assert.equal(typeof reg.commands['stryke.run'], 'function');
  assert.equal(typeof reg.commands['stryke.debug'], 'function');
  assert.ok(reg.debugConfigProviders.stryke, 'config provider registered for type stryke');
  assert.ok(reg.debugAdapterFactories.stryke, 'adapter factory registered for type stryke');
});

test('debug adapter is `stryke --dap` at the resolved absolute path', () => {
  loadExtensionWith(fakeBin);
  const desc = reg.debugAdapterFactories.stryke.createDebugAdapterDescriptor({ configuration: {} });
  assert.ok(desc instanceof DebugAdapterExecutable);
  assert.equal(desc.command, fakeBin);
  assert.deepEqual(desc.args, ['--dap']);
});

test('per-session strykePath overrides the setting for the adapter', () => {
  const alt = path.join(tmp, 'stryke-alt');
  fs.writeFileSync(alt, '#!/bin/sh\n'); fs.chmodSync(alt, 0o755);
  loadExtensionWith('stryke-not-on-path');
  const desc = reg.debugAdapterFactories.stryke.createDebugAdapterDescriptor({ configuration: { strykePath: alt } });
  assert.equal(desc.command, alt);
});

test('missing binary → adapter factory returns undefined (no broken session)', () => {
  loadExtensionWith(path.join(tmp, 'gone', 'stryke'));
  const desc = reg.debugAdapterFactories.stryke.createDebugAdapterDescriptor({ configuration: {} });
  assert.equal(desc, undefined);
});

test('F5 with no launch.json fills in the active .stk file as program', () => {
  loadExtensionWith(fakeBin, { document: { languageId: 'stryke' } });
  const out = reg.debugConfigProviders.stryke.resolveDebugConfiguration(undefined, {});
  assert.equal(out.type, 'stryke');
  assert.equal(out.request, 'launch');
  assert.equal(out.program, '${file}');
});

test('debug config with no resolvable program is aborted', () => {
  loadExtensionWith(fakeBin, undefined); // no active editor
  const out = reg.debugConfigProviders.stryke.resolveDebugConfiguration(undefined, {});
  assert.equal(out, undefined);
});

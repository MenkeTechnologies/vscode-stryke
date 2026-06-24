// vscode-stryke — activates the stryke language server (stryke --lsp).
//
// Syntax highlighting and filetype detection are declarative (see package.json
// + syntaxes/stryke.tmLanguage.json) and need no code. This module only wires
// up the language client so diagnostics / hover / completion work when the
// `stryke` binary is on PATH. Flags verified against `stryke --help`:
//   --lsp   Language Server (JSON-RPC on stdio); must be the only arg after stryke

const vscode = require('vscode');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
  const config = vscode.workspace.getConfiguration('stryke');
  if (!config.get('lsp.enabled', true)) {
    return;
  }

  const command = config.get('path', 'stryke');
  const args = config.get('lsp.args', ['--lsp']);

  const serverOptions = {
    run: { command, args, transport: TransportKind.stdio },
    debug: { command, args, transport: TransportKind.stdio }
  };

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'stryke' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.stk')
    }
  };

  client = new LanguageClient(
    'stryke',
    'stryke Language Server',
    serverOptions,
    clientOptions
  );

  // start() rejects if the binary is missing (e.g. `stryke` not on the
  // editor's PATH — GUI launches on macOS don't inherit the shell PATH);
  // surface it once, non-fatally. Without this catch the rejection — and
  // the "Pending response rejected since connection got disposed" that
  // follows — would bubble up as an uncaught error.
  client.start().catch((err) => {
    vscode.window.showWarningMessage(
      `stryke language server failed to start (${command} --lsp): ${err.message}. ` +
      `Set "stryke.path" or disable "stryke.lsp.enabled". Syntax highlighting still works.`
    );
  });

  context.subscriptions.push({ dispose: stopClient });
}

// stop() throws synchronously unless the client is actually Running — in the
// Starting / StartFailed states it raises "Client is not running and can't be
// stopped". A failed `stryke --lsp` launch leaves the client in exactly those
// states, so calling stop() from the dispose handler or deactivate() on window
// reload / shutdown spammed uncaught errors. Only stop a running client, and
// swallow any late rejection from the stop itself.
function stopClient() {
  if (!client || !client.isRunning()) {
    return undefined;
  }
  try {
    return Promise.resolve(client.stop()).catch(() => undefined);
  } catch (_e) {
    return undefined;
  }
}

function deactivate() {
  return stopClient();
}

module.exports = { activate, deactivate };

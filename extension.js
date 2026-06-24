// vscode-stryke — activates the stryke language server (stryke --lsp).
//
// Syntax highlighting and filetype detection are declarative (see package.json
// + syntaxes/stryke.tmLanguage.json) and need no code. This module only wires
// up the language client so diagnostics / hover / completion work. Flags
// verified against `stryke --help`:
//   --lsp   Language Server (JSON-RPC on stdio); must be the only arg after stryke

const vscode = require('vscode');
const { LanguageClient } = require('vscode-languageclient/node');
const { resolveStrykeBinary } = require('./lib/resolveBinary');

let client;

function activate(context) {
  const config = vscode.workspace.getConfiguration('stryke');
  if (!config.get('lsp.enabled', true)) {
    return;
  }

  const configured = config.get('path', 'stryke');
  const command = resolveStrykeBinary(configured);
  const args = config.get('lsp.args', ['--lsp']);

  // Binary not found — do NOT start the client. Starting it would spawn-fail
  // and trigger the internal retry/stop cascade described above. Warn once and
  // leave syntax highlighting (which needs no server) working.
  if (!command) {
    vscode.window.showWarningMessage(
      `stryke language server not started: could not find the \`${configured}\` binary. ` +
      `Set "stryke.path" to the absolute path (e.g. /opt/homebrew/bin/stryke), ` +
      `install it (\`brew install stryke\`), or disable "stryke.lsp.enabled". ` +
      `Syntax highlighting still works.`
    );
    return;
  }

  // NOTE: do NOT set `transport: TransportKind.stdio`. For a command-based
  // server, vscode-languageclient reacts to that by appending `--stdio` to the
  // argv (see vscode-languageclient/lib/node/main.js — the Executable branch),
  // so it would spawn `stryke --lsp --stdio`. stryke's CLI rejects the extra
  // arg ("error: unexpected argument found") and exits before the JSON-RPC
  // handshake — which the client reports as "Pending response rejected since
  // connection got disposed" plus the StartFailed retry cascade. With transport
  // omitted the client still talks JSON-RPC over the process stdout/stdin (the
  // `transport === undefined` path uses StreamMessageReader/Writer), but spawns
  // bare `stryke --lsp`, which is what the binary expects.
  const serverOptions = {
    run: { command, args },
    debug: { command, args }
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

  // Defensive: if start() still rejects (server crashes after a successful
  // spawn), surface it once instead of letting the rejection go uncaught.
  client.start().catch((err) => {
    vscode.window.showWarningMessage(
      `stryke language server failed to start (${command} --lsp): ${err.message}. ` +
      `Syntax highlighting still works.`
    );
  });

  context.subscriptions.push({ dispose: stopClient });
}

// stop() throws synchronously unless the client is actually Running — in the
// Starting / StartFailed states it raises "Client is not running and can't be
// stopped". Only stop a running client, and swallow any late rejection.
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

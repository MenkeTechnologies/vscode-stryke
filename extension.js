// vscode-stryke — language support, running, and debugging for stryke.
//
// Syntax highlighting and filetype detection are declarative (see package.json
// + syntaxes/stryke.tmLanguage.json). This module wires up the runtime pieces:
//   --lsp   Language Server (JSON-RPC on stdio) — diagnostics / hover / completion
//   --dap   Debug Adapter (DAP on stdio)        — breakpoints / stepping / variables
// Both flags verified against `stryke --help` and the strykelang dap.rs server.

const vscode = require('vscode');
const { LanguageClient } = require('vscode-languageclient/node');
const { resolveStrykeBinary } = require('./lib/resolveBinary');

let client;
let runTerminal;

function activate(context) {
  registerExecutionAndDebug(context);

  const config = vscode.workspace.getConfiguration('stryke');
  if (config.get('lsp.enabled', true)) {
    startLanguageServer(context, config);
  }
}

// Resolve the stryke binary or warn once, returning undefined when not found.
function resolveOrWarn(configured, action) {
  const command = resolveStrykeBinary(configured);
  if (!command) {
    vscode.window.showWarningMessage(
      `stryke not found for ${action}: could not find the \`${configured}\` binary. ` +
      `Set "stryke.path" to the absolute path (e.g. /opt/homebrew/bin/stryke) or install it (\`brew install stryke\`).`
    );
  }
  return command;
}

// Shell-quote a path for `Terminal.sendText` (POSIX shells vs Windows).
function shellQuote(s) {
  if (process.platform === 'win32') {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function activeStrykeEditor(action) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'stryke') {
    vscode.window.showWarningMessage(`Stryke: open a .stk file to ${action}.`);
    return undefined;
  }
  return editor;
}

// `stryke.run` — execute the active file in an integrated terminal.
function runFile() {
  const editor = activeStrykeEditor('run');
  if (!editor) return;
  const configured = vscode.workspace.getConfiguration('stryke').get('path', 'stryke');
  const command = resolveOrWarn(configured, 'running');
  if (!command) return;
  editor.document.save().then(() => {
    if (!runTerminal || runTerminal.exitStatus !== undefined) {
      runTerminal = vscode.window.createTerminal('stryke');
    }
    runTerminal.show(true);
    runTerminal.sendText(`${shellQuote(command)} ${shellQuote(editor.document.uri.fsPath)}`);
  });
}

// `stryke.debug` — launch a debug session for the active file.
function debugFile() {
  const editor = activeStrykeEditor('debug');
  if (!editor) return;
  editor.document.save().then(() => {
    vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(editor.document.uri), {
      type: 'stryke',
      request: 'launch',
      name: 'Stryke: Debug Current File',
      program: editor.document.uri.fsPath,
      cwd: '${workspaceFolder}',
      stopOnEntry: false
    });
  });
}

// Fills in a debug config for F5-with-no-launch.json, and aborts cleanly if no
// program can be determined.
const debugConfigProvider = {
  resolveDebugConfiguration(_folder, config) {
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'stryke') {
        config.type = 'stryke';
        config.request = 'launch';
        config.name = 'Stryke: Debug Current File';
        config.program = '${file}';
        config.cwd = '${workspaceFolder}';
        config.stopOnEntry = false;
      }
    }
    if (!config.program) {
      vscode.window.showWarningMessage('Stryke debug: no `program` to debug (open a .stk file or set one in launch.json).');
      return undefined; // abort the session
    }
    return config;
  }
};

// Builds the debug adapter: `stryke --dap` over stdio. The binary is resolved
// the same way as the LSP, so it works under the GUI PATH; a per-session
// `strykePath` in the launch config overrides the `stryke.path` setting.
const debugAdapterFactory = {
  createDebugAdapterDescriptor(session) {
    const configured = session.configuration.strykePath
      || vscode.workspace.getConfiguration('stryke').get('path', 'stryke');
    const command = resolveStrykeBinary(configured);
    if (!command) {
      vscode.window.showErrorMessage(
        `stryke not found for debugging: could not find the \`${configured}\` binary. Set "stryke.path".`
      );
      return undefined;
    }
    return new vscode.DebugAdapterExecutable(command, ['--dap']);
  }
};

function registerExecutionAndDebug(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('stryke.run', runFile),
    vscode.commands.registerCommand('stryke.debug', debugFile),
    vscode.debug.registerDebugConfigurationProvider('stryke', debugConfigProvider),
    vscode.debug.registerDebugAdapterDescriptorFactory('stryke', debugAdapterFactory)
  );
}

function startLanguageServer(context, config) {
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

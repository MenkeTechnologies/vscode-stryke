# Changelog

## 0.2.0

- Add **running**: `Stryke: Run File` command (Ctrl+F5, editor-title ▶, command
  palette) saves and runs the active `.stk` file as `stryke <file>` in a terminal.
- Add **debugging** via stryke's native debug adapter (`stryke --dap`): gutter
  breakpoints, step over/into/out, call stack, scopes, local + global variables,
  watch / hover-to-evaluate, and run-without-debugging. F5 on a `.stk` file works
  with no `launch.json`; launch attributes `program`/`args`/`cwd`/`stopOnEntry`/
  `noDebug`/`interpreterArgs`/`strykePath` are supported. The adapter binary is
  resolved like the language server, so it works under the macOS GUI `$PATH`.

## 0.1.4

- Fix the actual cause of the language server never connecting. Passing
  `transport: TransportKind.stdio` to the language client makes
  vscode-languageclient append `--stdio` to the server argv, so it spawned
  `stryke --lsp --stdio`; stryke's CLI rejects the extra argument
  ("error: unexpected argument found") and exits before the JSON-RPC handshake,
  which surfaced as "Pending response rejected since connection got disposed"
  and the StartFailed retry cascade. The transport is now omitted — the client
  still speaks JSON-RPC over the process stdio, but spawns bare `stryke --lsp`,
  which is what the binary expects. (0.1.2/0.1.3 addressed the teardown and PATH
  handling; this is the fix that makes the server actually start.)

## 0.1.3

- Resolve the `stryke` binary to an absolute path before starting the language
  server, searching `PATH` plus common install locations (`/opt/homebrew/bin`,
  `/usr/local/bin`, `~/.cargo/bin`, `~/.local/bin`). Editors launched from the
  macOS Dock / Finder don't inherit the shell `PATH`, so a bare `stryke` failed
  to spawn — and the failed spawn made vscode-languageclient retry and emit
  uncaught "Client is not running and can't be stopped" / "Pending response
  rejected" errors that an extension can't intercept. When the binary genuinely
  can't be found, the client is no longer started at all (warn + keep syntax
  highlighting), so the error cascade can't occur.

## 0.1.2

- Fix uncaught errors ("Client is not running and can't be stopped",
  "Pending response rejected since connection got disposed") raised when the
  `stryke --lsp` server fails to launch — e.g. when `stryke` is not on the
  editor's PATH. The language client is now only stopped while it is actually
  running, and a failed launch degrades to syntax highlighting silently.

## 0.1.1

- Add `vscode-textmate` + `vscode-oniguruma` as devDependencies for the
  grammar tokenizer test.

## 0.1.0

- Initial release.
- Filetype detection for `*.stk` and stryke shebangs.
- Standalone TextMate grammar generated from the stryke binary's reflection
  tables — the complete builtin surface (all 10,450 builtins), keywords,
  parallel primitives, sigils, strings, here-docs, regex, and thread macros.
- Language server integration via `stryke --lsp` (vscode-languageclient).

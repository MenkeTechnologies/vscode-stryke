# Changelog

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

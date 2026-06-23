# Changelog

## 0.1.0

- Initial release.
- Filetype detection for `*.stk` and stryke shebangs.
- Standalone TextMate grammar generated from the stryke binary's reflection
  tables — the complete builtin surface (all 10,450 builtins), keywords,
  parallel primitives, sigils, strings, here-docs, regex, and thread macros.
- Language server integration via `stryke --lsp` (vscode-languageclient).

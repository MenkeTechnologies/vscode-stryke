```
██╗   ██╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗    ███████╗████████╗██████╗ ██╗   ██╗██╗  ██╗███████╗
██║   ██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝    ██╔════╝╚══██╔══╝██╔══██╗╚██╗ ██╔╝██║ ██╔╝██╔════╝
██║   ██║███████╗██║     ██║   ██║██║  ██║█████╗█████╗███████╗   ██║   ██████╔╝ ╚████╔╝ █████╔╝ █████╗
╚██╗ ██╔╝╚════██║██║     ██║   ██║██║  ██║██╔══╝╚════╝╚════██║   ██║   ██╔══██╗  ╚██╔╝  ██╔═██╗ ██╔══╝
 ╚████╔╝ ███████║╚██████╗╚██████╔╝██████╔╝███████╗    ███████║   ██║   ██║  ██║   ██║   ██║  ██╗███████╗
  ╚═══╝  ╚══════╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝
```

[![CI](https://github.com/MenkeTechnologies/vscode-stryke/actions/workflows/ci.yml/badge.svg)](https://github.com/MenkeTechnologies/vscode-stryke/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-online-blue.svg)](https://menketechnologies.github.io/vscode-stryke/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

### `[VS CODE EXTENSION // NEON GRAMMAR // COMPLETE BUILTIN SURFACE // LSP]`

> *"Open a `.stk`. The whole language lights up — all 10,450 builtins."*

VS Code / VSCodium support for **[stryke](https://github.com/MenkeTechnologies/strykelang)** — a highly parallel Perl 5 superset interpreter written in Rust. A standalone TextMate grammar (not a perl reskin), filetype detection, and language-server integration via `stryke --lsp`.

### [`Read the Docs`](https://menketechnologies.github.io/vscode-stryke/) &middot; [`Engineering Report`](https://menketechnologies.github.io/vscode-stryke/report.html) · [`strykelang`](https://github.com/MenkeTechnologies/strykelang) · [`vim-stryke`](https://github.com/MenkeTechnologies/vim-stryke) · [`zshrs`](https://github.com/MenkeTechnologies/zshrs)

---

## [0x00] OVERVIEW

**vscode-stryke** is the VS Code / VSCodium extension for **stryke**. It provides:

- **Filetype detection** — `*.stk` files and files whose first line is a stryke shebang (`#!/usr/bin/env stryke`).
- **Syntax highlighting** — a standalone TextMate grammar (`source.stryke`).
- **Language server** — `stryke --lsp` via [vscode-languageclient](https://github.com/microsoft/vscode-languageserver-node) (diagnostics, hover, completion — whatever the server provides).

The grammar is **generated** (`scripts/gen_grammar.sh`) directly from the stryke binary's own reflection tables, so it carries the **complete** language surface and never drifts — it is **not** a reskin of the built-in Perl grammar:

- **all 10,450 builtins** — `stryke -E 'p join "\n", sort keys %b'`
- the 90 keywords — `stryke -E 'p join "\n", sort keys %k'`
- the 39 parallel primitives — `stryke -E 'p join "\n", sort @{$c{parallel}}'`

Created by **[MenkeTechnologies](https://github.com/MenkeTechnologies)**.

---

## [0x01] FEATURE MATRIX

| Capability | Status |
|---|---|
| Filetype detection — `*.stk` | **Implemented** — `contributes.languages` extension map |
| Filetype detection — shebang | **Implemented** — `firstLine` regex `^#!.*\bstryke\b` |
| Syntax highlighting | **Implemented** — TextMate grammar (`source.stryke`), all 10,450 builtins |
| Comments / brackets / autoclose | **Implemented** — `language-configuration.json` |
| Indentation | **Implemented** — brace-based `indentationRules` |
| Language server | **Implemented** — `stryke --lsp` via vscode-languageclient |
| Config | `stryke.path`, `stryke.lsp.enabled`, `stryke.lsp.args` |

> The language server needs the `stryke` binary. The extension resolves it from
> `$PATH` plus the common install locations (`/opt/homebrew/bin`, `/usr/local/bin`,
> `~/.cargo/bin`, `~/.local/bin`) — so it works even when the editor is launched
> from the macOS Dock / Finder, which doesn't inherit your shell `$PATH`. Install
> with `brew install stryke` or build **[strykelang](https://github.com/MenkeTechnologies/strykelang)**.
> If it lives elsewhere, set `stryke.path` to the absolute path.

---

## [0x02] INSTALL

This extension is not yet on the Marketplace. Build and install the `.vsix` locally:

```bash
git clone https://github.com/MenkeTechnologies/vscode-stryke
cd vscode-stryke
npm install
npx @vscode/vsce package          # produces vscode-stryke-<version>.vsix
code --install-extension vscode-stryke-*.vsix
```

Or drop the folder into your extensions dir for development:

```bash
git clone https://github.com/MenkeTechnologies/vscode-stryke \
    ~/.vscode/extensions/vscode-stryke
```

Open any `.stk` file — it lights up. The language server starts automatically when `stryke` is on `$PATH`.

---

## [0x03] SYNTAX // SCOPES

The grammar maps stryke tokens to standard TextMate scopes, so every VS Code theme colors them:

| Token group | Scope | Sample |
|---|---|---|
| Control flow | `keyword.control.stryke` | `if` `unless` `loop` `match` `when` `try` `catch` `defer` |
| Concurrency | `keyword.other.concurrent.stryke` | `async` `await` `spawn` |
| Declarations | `storage.modifier.stryke` | `my` `var` `val` `our` `const` `typed` `use` `package` |
| Fn / type intro | `storage.type.stryke` | `fn` `sub` `class` `trait` `struct` `enum` `impl` |
| Phase hooks | `keyword.other.phase.stryke` | `BEGIN` `END` `INIT` `CHECK` `UNITCHECK` |
| Word operators | `keyword.operator.word.stryke` | `and` `or` `not` `eq` `ne` `cmp` `x` |
| Parallel builtins (39) | `support.function.parallel.stryke` | `pmap` `pgrep` `pfor` `pchannel` `preduce` `fan` |
| Builtins (10,450) | `support.function.builtin.stryke` | `p` `say` `map` `grep` `reduce` `json_encode` `sha256` `ai` `absorbance` … |
| Types | `support.type.stryke` | `Int` `Str` `Float` `Bool` `Array` `Hash` `Map` |
| Thread macros | `keyword.operator.thread.stryke` | `~>` `~>>` `->>` `\|>` (plus `~s>` `~p>` `~d>`) |

Strings (single / double / backtick / `qw` / `q` / `qq` / `qx`), here-docs, interpolation, escapes, `m//` `s///` `tr///` `qr//` regex, sigil variables, the `$_` topic, and numbers are all scoped too.

---

## [0x04] LANGUAGE SERVER

The extension launches `stryke --lsp` (stdio JSON-RPC) through `vscode-languageclient`. Configure it in Settings:

| Setting | Default | Effect |
|---|---|---|
| `stryke.path` | `stryke` | Path to the stryke executable |
| `stryke.lsp.enabled` | `true` | Start the language server (set `false` for highlighting only) |
| `stryke.lsp.args` | `["--lsp"]` | Args passed to start the server |

If the binary is missing, the extension shows one non-fatal warning and syntax highlighting keeps working.

---

## [0x05] REGENERATING THE GRAMMAR

The builtin surface is generated from the live binary so it never drifts. After a stryke upgrade:

```bash
./scripts/gen_grammar.sh        # rewrites syntaxes/stryke.tmLanguage.json
npm run gen                      # same thing via npm
```

Verify it still tokenizes correctly with the real VS Code grammar engine:

```bash
npm install
node scripts/tokenize_test.js
```

---

## [0x06] LAYOUT

```
vscode-stryke/
├── package.json                    # extension manifest (language, grammar, config, LSP)
├── language-configuration.json     # comments, brackets, autoclose, indent rules
├── extension.js                    # LSP client (stryke --lsp)
├── syntaxes/stryke.tmLanguage.json # generated grammar — all 10,450 builtins
├── scripts/gen_grammar.sh          # regenerates the grammar from the stryke binary
└── scripts/tokenize_test.js        # tokenizes a sample with vscode-textmate + asserts scopes
```

---

## [0x07] LICENSE

MIT © **[MenkeTechnologies](https://github.com/MenkeTechnologies)**

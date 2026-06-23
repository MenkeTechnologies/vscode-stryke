// Tokenize a stryke sample with the real VS Code grammar engine
// (vscode-textmate + vscode-oniguruma) and assert key scopes. Verifies the
// generated grammar actually loads under oniguruma and classifies tokens.
const fs = require('fs');
const path = require('path');
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

const root = path.join(__dirname, '..');
const wasm = fs.readFileSync(path.join(root, 'node_modules/vscode-oniguruma/release/onig.wasm'));
const onigLib = oniguruma.loadWASM(wasm.buffer).then(() => ({
  createOnigScanner: (s) => new oniguruma.OnigScanner(s),
  createOnigString: (s) => new oniguruma.OnigString(s)
}));

const registry = new vsctm.Registry({
  onigLib,
  loadGrammar: () =>
    Promise.resolve(
      vsctm.parseRawGrammar(
        fs.readFileSync(path.join(root, 'syntaxes/stryke.tmLanguage.json'), 'utf8'),
        'stryke.tmLanguage.json'
      )
    )
});

const lines = [
  '#!/usr/bin/env stryke',
  'use strict;',
  'my $name = "hello $who";',
  'fn greet ($w: Str) {',
  '    say "yo";',
  '    my @r = pmap { $_ } 1..10;',
  '    my $a = absorbance(0.5);',
  '    return contains(@r, 3);',
  '}',
  '@list ~> map { $_ } |> say;'
];

// (lineIndex, columnIndex) -> required scope substring
const checks = [
  [1, 0, 'storage.modifier', 'use'],
  [2, 0, 'storage.modifier', 'my'],
  [2, 11, 'string.quoted.double', '"hello'],
  [3, 0, 'storage.type', 'fn'],
  [3, 15, 'support.type', 'Str'],
  [4, 4, 'support.function.builtin', 'say'],
  [5, 12, 'support.function.parallel', 'pmap'],
  [6, 12, 'support.function.builtin', 'absorbance'],
  [7, 11, 'support.function.builtin', 'contains'],
  [9, 6, 'keyword.operator.thread', '~>']
];

registry.loadGrammar('source.stryke').then((grammar) => {
  let ruleStack = vsctm.INITIAL;
  const tokensPerLine = lines.map((line) => {
    const r = grammar.tokenizeLine(line, ruleStack);
    ruleStack = r.ruleStack;
    return r.tokens;
  });

  let failed = 0;
  for (const [li, col, wantScope, label] of checks) {
    const toks = tokensPerLine[li];
    const tok = toks.find((t) => col >= t.startIndex && col < t.endIndex);
    const scopes = tok ? tok.scopes.join(' ') : '(none)';
    const ok = scopes.includes(wantScope);
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  L${li}c${col} ${label.padEnd(10)} want=${wantScope.padEnd(28)} got=${scopes}`);
  }
  console.log(failed === 0 ? '\nALL TOKEN CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}).catch((e) => { console.error(e); process.exit(2); });

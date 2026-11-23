// Lists every string that tr() can receive in the given files, ordered by file priority.
const ts = require('./ts');
const ensureImport = require('./ensureImport');
const fs = require('fs');
const PROPS = new Set(['label', 'title', 'description', 'placeholder', 'hint', 'subtitle', 'desc', 'message', 'tooltip', 'confirmText', 'cancelText', 'text', 'name']);
const seen = new Map();
const add = (s, f) => { if (typeof s !== 'string') return; const k = s.replace(/\s+/g, ' ').trim(); if (!/[A-Za-z]{2,}/.test(k) || k.length > 400) return; if (!seen.has(k)) seen.set(k, f); };
for (const file of process.argv.slice(3)) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const short = file.replace(/.*app[\/]/, '');
  const visit = (n) => {
    if (ts.isCallExpression(n) && n.expression.getText(sf) === 'tr' && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))) add(n.arguments[0].text, short);
    if (ts.isPropertyAssignment(n) && PROPS.has(n.name.getText(sf).replace(/['"]/g, '')) && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) {
      // `name` only for UI lists (skip obvious data/sample objects is impossible here; harmless if unused)
      add(n.initializer.text, short);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const list = [...seen.entries()].map(([s, f], i) => ({ i, s, f }));
fs.writeFileSync(process.argv[2], JSON.stringify(list, null, 1));
console.log('strings', list.length);

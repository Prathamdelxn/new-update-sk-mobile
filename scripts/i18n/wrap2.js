// Second pass: wrap raw enum values rendered in JSX ({x.status}, {x.priority}, {x.status.replace('_',' ')})
const ts = require('./ts');
const ensureImport = require('./ensureImport');
const fs = require('fs');
const NAMES = new Set(['status', 'priority', 'category', 'trade', 'healthLabel', 'stage', 'paymentMethod', 'incomingStatus', 'outgoingStatus', 'probability', 'impact', 'source', 'propertyType', 'interiorType']);
let total = 0;
for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const target = (e) => {
    let x = e;
    while (ts.isParenthesizedExpression(x) || ts.isNonNullExpression(x)) x = x.expression;
    if (ts.isPropertyAccessExpression(x) && NAMES.has(x.name.getText(sf))) return true;
    if (ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression) && ['replace', 'replaceAll', 'toUpperCase', 'toLowerCase'].includes(x.expression.name.getText(sf))) return target(x.expression.expression);
    return false;
  };
  const visit = (n) => {
    if (ts.isJsxExpression(n) && n.expression && n.parent && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent)) && target(n.expression)) {
      const t = n.expression.getText(sf);
      if (!t.startsWith('tr(')) edits.push({ s: n.expression.getStart(sf), e: n.expression.getEnd(), t: `tr(${t})` });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  let out = src;
  for (const e of edits.sort((a, b) => b.s - a.s)) out = out.slice(0, e.s) + e.t + out.slice(e.e);
  out = ensureImport(out, file);
  fs.writeFileSync(file, out);
  total += edits.length;
}
console.log('wrapped enum renders:', total);

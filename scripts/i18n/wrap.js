// Wraps user-visible English text in tr() (AST based, English output unchanged).
// usage: node wrap.js [--dry] <file...>
const ts = require('./ts');
const ensureImport = require('./ensureImport');
const fs = require('fs');

const ATTRS = new Set(['message', 'buttonText', 'headerTitle', 'accessibilityLabel', 'emptyTitle', 'emptyMessage', 'placeholder', 'title', 'aria-label', 'label', 'description', 'tooltip', 'emptyText', 'confirmText', 'cancelText', 'subtitle', 'helperText', 'alt']);
const PROPS = new Set(['label', 'title', 'description', 'placeholder', 'hint', 'subtitle', 'message', 'emptyText', 'tooltip', 'desc', 'confirmText', 'cancelText']);
const RENDER_PROPS = new Set(['label', 'title', 'description', 'placeholder', 'hint', 'subtitle', 'desc', 'message', 'tooltip']);
const TOASTS = /^(toast\.(success|error|info|warning|message|loading)|showToast|alert|window\.alert|confirm|window\.confirm|Alert\.alert)$/;
const ENT = { '&amp;': '&', '&apos;': "'", '&#39;': "'", '&quot;': '"', '&nbsp;': '\u00a0', '&lt;': '<', '&gt;': '>', '&rarr;': '→', '&larr;': '←', '&middot;': '·', '&bull;': '•', '&ndash;': '–', '&mdash;': '—', '&hellip;': '…', '&times;': '×', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&copy;': '©' };
const hasWords = (s) => /[A-Za-z]{2,}/.test(s);
const dry = process.argv.includes('--dry');
const files = process.argv.slice(2).filter((a) => a !== '--dry');

function cleanJsxText(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  if (lines.length === 1) return raw;
  const parts = [];
  lines.forEach((line, i) => {
    let l = line;
    if (i > 0) l = l.replace(/^[ \t]+/, '');
    if (i < lines.length - 1) l = l.replace(/[ \t]+$/, '');
    if (l) parts.push(l);
  });
  return parts.join(' ');
}
function decode(s) {
  let ok = true;
  const out = s.replace(/&[#a-zA-Z0-9]+;/g, (m) => {
    if (ENT[m] !== undefined) return ENT[m];
    if (/^&#\d+;$/.test(m)) return String.fromCharCode(Number(m.slice(2, -1)));
    ok = false;
    return m;
  });
  return ok ? out : null;
}
const lit = (s) => JSON.stringify(s);

let totalEdits = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = []; // {start, end, text}
  const isInsideTr = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) && p.expression.getText(sf) === 'tr') return true;
    }
    return false;
  };
  const inFunction = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isFunctionLike(p)) return true;
    }
    return false;
  };
  const wrapExpr = (node) => {
    if (isInsideTr(node)) return;
    edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `tr(${node.getText(sf)})` });
  };
  const wrapStringNode = (node) => {
    if (!hasWords(node.text) || isInsideTr(node)) return;
    edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `tr(${lit(node.text)})` });
  };
  // String literal branches of ?: / || / ?? (recursively)
  const wrapBranches = (e) => {
    if (!e) return;
    if (ts.isParenthesizedExpression(e)) return wrapBranches(e.expression);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return wrapStringNode(e);
    if (ts.isConditionalExpression(e)) { wrapBranches(e.whenTrue); wrapBranches(e.whenFalse); return; }
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(e.operatorToken.kind)) {
      wrapBranches(e.right);
      return;
    }
    if (ts.isPropertyAccessExpression(e) && RENDER_PROPS.has(e.name.getText(sf))) wrapExpr(e);
  };

  const visit = (n) => {
    if (n.kind === ts.SyntaxKind.JsxText) {
      const raw = n.getFullText(sf);
      if (hasWords(raw)) {
        const cleaned = cleanJsxText(raw);
        const decoded = decode(cleaned);
        if (decoded && hasWords(decoded) && !/[{}]/.test(decoded)) {
          const lead = (raw.match(/^\s*/)[0].includes('\n')) ? raw.match(/^\s*/)[0] : '';
          const trail = (raw.match(/\s*$/)[0].includes('\n')) ? raw.match(/\s*$/)[0] : '';
          const core = lead || trail ? decoded.trim() === decoded ? decoded : decoded : decoded;
          edits.push({ start: n.getFullStart(), end: n.getEnd(), text: `${lead}{tr(${lit(core)})}${trail}` });
        }
      }
    } else if (ts.isJsxAttribute(n) && n.initializer && ATTRS.has(n.name.getText(sf))) {
      const i = n.initializer;
      if (ts.isStringLiteral(i)) {
        if (hasWords(i.text)) edits.push({ start: i.getStart(sf), end: i.getEnd(), text: `{tr(${lit(i.text)})}` });
      } else if (ts.isJsxExpression(i) && i.expression) {
        wrapBranches(i.expression);
      }
    } else if (ts.isJsxExpression(n) && n.expression && n.parent && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
      wrapBranches(n.expression);
    } else if (ts.isCallExpression(n) && TOASTS.test(n.expression.getText(sf)) && n.arguments[0]) {
      wrapBranches(n.arguments[0]);
      if (n.expression.getText(sf) === 'Alert.alert') {
        if (n.arguments[1]) wrapBranches(n.arguments[1]);
        // button labels: Alert.alert(title, msg, [{ text: 'Cancel' }, ...])
        const btns = n.arguments[2];
        if (btns && ts.isArrayLiteralExpression(btns)) for (const b of btns.elements) if (ts.isObjectLiteralExpression(b)) for (const p of b.properties)
          if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'text') wrapBranches(p.initializer);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);

  if (!edits.length) continue;
  // drop overlapping edits (keep outermost-first order safe)
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  let lastEnd = -1;
  for (const e of edits) {
    if (e.start >= lastEnd) { kept.push(e); lastEnd = e.end; }
  }
  let out = src;
  for (const e of kept.slice().reverse()) out = out.slice(0, e.start) + e.text + out.slice(e.end);

  // import { tr } from '@/i18n'
  out = ensureImport(out, file);
  totalEdits += kept.length;
  if (!dry) fs.writeFileSync(file, out);
  console.log(kept.length, file.replace(/.*src[\\/]/, ''));
}
console.log('total', totalEdits);

// Third pass (run after wrap.js / wrap2.js):
//  1. Sentences with values inside (template literals) in visible places become
//     tr('BOQ Version {{versionNumber}} approved', { versionNumber }) so Arabic can reorder words.
//  2. Messages returned by validators / set into error state / passed to confirm({...}).
//  3. {someVariable} rendered as JSX text goes through tr() (non-strings pass through unchanged),
//     so labels and error messages held in state are translated too.
// usage: node scripts/i18n/wrap3.js [--lib] <files...>   (--lib: also wrap `return '...'` in validators)
const ts = require('./ts');
const ensureImport = require('./ensureImport');
const fs = require('fs');

const ATTRS = new Set(['message', 'buttonText', 'headerTitle', 'accessibilityLabel', 'emptyTitle', 'emptyMessage', 'placeholder', 'title', 'aria-label', 'label', 'description', 'tooltip', 'emptyText', 'confirmText', 'cancelText', 'subtitle', 'helperText', 'alt']);
const MSG_CALL = /^(toast\.(success|error|info|warning|message|loading)|showToast|alert|window\.alert|confirm|window\.confirm|prompt|Alert\.alert|set\w*(Error|Errors|Message|Msg|Warning|Notice|Status)\w*)$/;
const CONFIRM_CALL = /^(confirm|prompt|alert|confirmDialog|openConfirm)$/;
const DIALOG_PROPS = new Set(['title', 'message', 'description', 'confirmText', 'cancelText', 'placeholder', 'label']);
const SKIP_IDS = new Set(['children', 'icon', 'Icon', 'content', 'node', 'element', 'el']);
const hasWords = (s) => /[A-Za-z]{2,}/.test(s);
const looksLikeCss = (s) => /(^|\s)(bg|text|border|px|py|p|m|mx|my|rounded|flex|grid|w|h|gap)-/.test(s) || /^[\w/:.-]+$/.test(s.trim());

const args = process.argv.slice(2);
const LIB = args.includes('--lib');
const files = args.filter((a) => !a.startsWith('--'));
let stats = { tpl: 0, lit: 0, expr: 0 };

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.TSX);
  const edits = [];
  const insideTr = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isCallExpression(p) && p.expression.getText(sf) === 'tr') return true; return false; };

  // climb through wrappers that keep the value a "displayed message"
  const contextOf = (n) => {
    let c = n;
    let p = n.parent;
    while (p && (ts.isParenthesizedExpression(p) || (ts.isConditionalExpression(p) && p.condition !== c) ||
      (ts.isBinaryExpression(p) && p.right === c && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(p.operatorToken.kind)))) {
      c = p; p = p.parent;
    }
    if (!p) return null;
    if (ts.isJsxExpression(p)) {
      if (p.parent && (ts.isJsxElement(p.parent) || ts.isJsxFragment(p.parent))) return 'jsx';
      if (p.parent && ts.isJsxAttribute(p.parent) && ATTRS.has(p.parent.name.getText(sf))) return 'jsx';
      return null;
    }
    if (ts.isCallExpression(p) && p.arguments.includes(c) && MSG_CALL.test(p.expression.getText(sf))) return 'call';
    if (ts.isPropertyAssignment(p) && p.initializer === c) {
      const key = p.name.getText(sf).replace(/['"]/g, '');
      const obj = p.parent;
      const call = obj && obj.parent;
      if (call && ts.isCallExpression(call) && CONFIRM_CALL.test(call.expression.getText(sf)) && DIALOG_PROPS.has(key)) return 'dialog';
      // error maps: setErrors({ name: 'Required' }) / errors.name = ...
      if (call && ts.isCallExpression(call) && /^set\w*Errors?$/.test(call.expression.getText(sf))) return 'call';
      return null;
    }
    if (LIB && ts.isReturnStatement(p)) return 'return';
    return null;
  };

  const placeholderName = (expr, used) => {
    let base = 'value';
    let e = expr;
    while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e)) e = e.expression;
    if (ts.isIdentifier(e)) base = e.text;
    else if (ts.isPropertyAccessExpression(e)) base = e.name.text === 'length' && ts.isPropertyAccessExpression(e.expression) ? e.expression.name.text + 'Count' : e.name.text === 'length' && ts.isIdentifier(e.expression) ? e.expression.text + 'Count' : e.name.text;
    else if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression)) base = ts.isPropertyAccessExpression(e.expression.expression) ? e.expression.expression.name.text : ts.isIdentifier(e.expression.expression) ? e.expression.expression.text : 'value';
    else if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) base = e.expression.text;
    base = base.replace(/[^A-Za-z0-9]/g, '') || 'value';
    let name = base; let i = 2;
    while (used.has(name)) name = base + i++;
    used.add(name);
    return name;
  };

  const visit = (n) => {
    if (ts.isTemplateExpression(n) && !insideTr(n)) {
      const ctx = contextOf(n);
      if (ctx) {
        const used = new Set();
        let key = n.head.text;
        const vars = [];
        for (const span of n.templateSpans) {
          const name = placeholderName(span.expression, used);
          key += `{{${name}}}` + span.literal.text;
          vars.push(`${name}: ${span.expression.getText(sf)}`);
        }
        const staticText = key.replace(/\{\{\w+\}\}/g, ' ');
        if (hasWords(staticText) && !looksLikeCss(staticText)) {
          edits.push({ s: n.getStart(sf), e: n.getEnd(), t: `tr(${JSON.stringify(key)}, { ${vars.join(', ')} })` });
          stats.tpl++;
          return; // don't descend: nested templates stay as values
        }
      }
    } else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !insideTr(n) && hasWords(n.text) && !looksLikeCss(n.text)) {
      const ctx = contextOf(n);
      if (ctx === 'call' || ctx === 'dialog' || ctx === 'return') {
        edits.push({ s: n.getStart(sf), e: n.getEnd(), t: `tr(${JSON.stringify(n.text)})` });
        stats.lit++;
      }
    } else if (ts.isJsxExpression(n) && n.expression && n.parent && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent)) && !insideTr(n)) {
      let e = n.expression;
      while (ts.isParenthesizedExpression(e)) e = e.expression;
      const simple = ts.isIdentifier(e) || ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e);
      const last = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '';
      if (simple && !SKIP_IDS.has(last) && last !== 'length' && !/^(id|_id|count|total|amount|price|qty|quantity|url|email|phone|code|number)$/i.test(last)) {
        edits.push({ s: n.expression.getStart(sf), e: n.expression.getEnd(), t: `tr(${n.expression.getText(sf)})` });
        stats.expr++;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  edits.sort((a, b) => a.s - b.s || b.e - a.e);
  const kept = []; let lastEnd = -1;
  for (const e of edits) if (e.s >= lastEnd) { kept.push(e); lastEnd = e.e; }
  let out = src;
  for (const e of kept.slice().reverse()) out = out.slice(0, e.s) + e.t + out.slice(e.e);
  out = ensureImport(out, file);
  fs.writeFileSync(file, out);
}
console.log('template sentences:', stats.tpl, '| message literals:', stats.lit, '| rendered variables:', stats.expr);

// Adds `import { tr } from '<relative>/utils/i18n/tr';` to a screen once.
const path = require('path');
const TR = path.resolve(__dirname, '../../app/utils/i18n/tr');
module.exports = function ensureImport(out, file) {
  if (/import\s*\{[^}]*\btr\b[^}]*\}\s*from\s*['"][^'"]*utils\/i18n\/tr['"]/.test(out)) return out;
  let rel = path.relative(path.dirname(path.resolve(file)), TR).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return `import { tr } from '${rel}';\n` + out;
};

// =============================================================================
// tr('English text') — same helper as the web (new-update-web-sklite/src/i18n).
// The English text is the key; Arabic comes from the web dictionaries plus
// app-only strings in locales/ar.mobile.json. Untranslated text stays English.
//   tr('Overview')                        -> 'نظرة عامة' when the app is in Arabic
//   tr('{{count}} tasks', { count: 3 })   -> interpolation
// The language is the app's i18next language (settings.lang). Changing it
// reloads the app (needed anyway for right-to-left), so plain calls are enough.
// =============================================================================
import i18n from '../../../i18n';
import arWebInterior from '../../../locales/ar.web-interior.json';
import arWebConstruction from '../../../locales/ar.web-construction.json';
import arMobile from '../../../locales/ar.mobile.json';

// app-only wording wins, then interior, then construction
const AR = { ...arWebConstruction, ...arWebInterior, ...arMobile };

// case/whitespace-insensitive, and 'in_progress' matches 'In Progress'
const normalize = (s) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
let normalized = null;
const normalizedAr = () => {
  if (!normalized) {
    normalized = new Map();
    for (const [k, v] of Object.entries(AR)) normalized.set(normalize(k), v);
  }
  return normalized;
};

const interpolate = (text, vars) =>
  !vars ? text : text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k])));

export const isArabic = () => String(i18n.language || '').startsWith('ar');

/** Translate English UI text into the app language (English and non-strings pass through). */
export function tr(text, vars) {
  if (typeof text !== 'string') return text;
  if (!isArabic() || !text.trim()) return interpolate(text, vars);
  let hit = AR[text];
  if (hit === undefined) {
    hit = AR[text.trim()] ?? normalizedAr().get(normalize(text));
    if (hit !== undefined) {
      const lead = text.match(/^\s*/)[0];
      const trail = text.match(/\s*$/)[0];
      hit = lead + hit + trail;
    }
  }
  return interpolate(hit ?? text, vars);
}

export default tr;

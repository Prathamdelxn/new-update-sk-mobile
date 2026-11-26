// =============================================================================
// SkyStruct app — standard PDF format (same look as the web exports)
//
//   standardPdf(html, { docType, meta, terms, hide })
//     • official logo + organisation letterhead at the top
//     • terms & conditions line at the BOTTOM OF EVERY PAGE (not after the content)
//     • table rows are never split across pages; table headers repeat
//     • `hide`: CSS selectors of a template's old brand header to remove
//
// expo-print renders with the system WebView print engine, which cannot number
// pages, so app PDFs carry the terms line without "Page X of Y".
// =============================================================================

import { PDF_LOGO_DATA_URI } from './pdfLogo';

let currentOrg = null;
/** Called by AuthContext whenever the signed-in user (and their organisation) loads. */
export function setPdfOrg(org) {
  currentOrg = org && typeof org === 'object' ? org : null;
}

const esc = (v) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const joinAddress = (a) =>
  !a ? '' : typeof a === 'string' ? a : [a.street || a.address || a.line1, a.city, a.state, a.country].filter(Boolean).join(', ');

export const PDF_TERMS = {
  quotation:
    'Terms & Conditions: This quotation is valid for 30 days from the issue date. Prices cover only the scope listed; any additional work is quoted separately. Work begins on written acceptance and receipt of the agreed advance.',
  boq: 'Terms & Conditions: Quantities are estimates for pricing and are subject to final site measurement. Rates exclude any items not listed.',
  receipt:
    'Terms & Conditions: This receipt confirms payment received against the stated milestone and is subject to realisation of funds. Please quote the receipt number in all correspondence.',
  report:
    'Terms & Conditions: This report records site progress as reported on the stated date. Quantities and progress figures are indicative and subject to joint measurement and verification.',
  certificate:
    'Terms & Conditions: Practical completion is subject to the agreed snag list and defects-liability period. This certificate does not waive any obligations under the contract.',
  voucher:
    'Terms & Conditions: This document records a project transaction for accounting purposes and is subject to verification against supporting invoices and bank records.',
  purchase:
    'Terms & Conditions: Goods must match the specification and quantities stated. Deliveries are subject to inspection on site; please quote this reference on all invoices.',
};

const FOOTER_MM = 16;

function letterhead({ docType, meta = [], subtitle }) {
  const o = currentOrg || { name: 'SkyStruct Lite' };
  const contact = [o.phone, o.email].filter(Boolean).map(esc).join(' &nbsp;•&nbsp; ');
  const address = joinAddress(o.address || o.location);
  const rows = meta
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`)
    .join('');
  return `
  <div class="sd-head">
    <div class="sd-brand">
      <div class="sd-logo"><img src="${PDF_LOGO_DATA_URI}" alt="SkyStruct" /></div>
      <div class="sd-orgwrap">
        <div class="sd-org">${esc(o.name)}</div>
        ${address ? `<div class="sd-orgline">${esc(address)}</div>` : ''}
        ${contact ? `<div class="sd-orgline">${contact}</div>` : ''}
      </div>
    </div>
    <div class="sd-doc">
      <div class="sd-doctype">${esc(docType)}</div>
      ${subtitle ? `<div class="sd-docsub">${esc(subtitle)}</div>` : ''}
      ${rows ? `<table class="sd-meta">${rows}</table>` : ''}
    </div>
  </div>`;
}

const STANDARD_CSS = `
  @page { size: A4; margin: 12mm 12mm 6mm 12mm; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tr, img, .sd-head, .avoid-break { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  .sd-head { display: table; width: 100%; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 12px;
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  .sd-head > div { display: table-cell; vertical-align: middle; }
  .sd-brand { display: table; }
  .sd-brand > div { display: table-cell; vertical-align: middle; }
  .sd-logo { padding-right: 12px; }
  .sd-logo img { height: 38px; width: auto; display: block; }
  .sd-orgwrap { padding-left: 12px; border-left: 1px solid #e2e8f0; }
  .sd-org { font-size: 12.5px; font-weight: 800; color: #0f172a; }
  .sd-orgline { font-size: 9.5px; color: #64748b; line-height: 1.35; }
  .sd-doc { text-align: right; }
  .sd-doctype { font-size: 16px; font-weight: 900; color: #1e3a8a; letter-spacing: 1px; text-transform: uppercase; }
  .sd-docsub { font-size: 10px; color: #475569; font-weight: 600; margin-top: 2px; }
  .sd-meta { margin-left: auto; margin-top: 4px; border-collapse: collapse; font-size: 9.5px; }
  .sd-meta td { padding: 0.5px 0; }
  .sd-meta td.k { color: #64748b; padding-right: 10px; text-align: right; white-space: nowrap; }
  .sd-meta td.v { color: #0f172a; font-weight: 700; text-align: right; }
  /* repeating footer: the outer table's tfoot reserves space on every page, the fixed div draws in it */
  table.sd-page { width: 100%; border-collapse: collapse; }
  table.sd-page > tfoot > tr > td { height: ${FOOTER_MM}mm; }
  .sd-foot { position: fixed; left: 0; right: 0; bottom: 0; height: ${FOOTER_MM - 3}mm; border-top: 1px solid #cbd5e1;
    padding-top: 5px; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 8.5px; color: #475569; line-height: 1.35; background: #fff; }
  .sd-foot b { color: #1e3a8a; }
`;

/**
 * Turn any document HTML into the standard format.
 * @param {string} html   full HTML document from a template
 * @param {{ docType: string, meta?: [string, any][], subtitle?: string, terms?: string, hide?: string[] }} opts
 */
export function standardPdf(html, { docType, meta = [], subtitle, terms = '', hide = [] }) {
  const orgName = esc(currentOrg?.name || 'SkyStruct Lite');
  const hideCss = hide.length ? `${hide.join(', ')} { display: none !important; }` : '';
  const style = `<style>${STANDARD_CSS}${hideCss}</style>`;

  let doc = String(html);
  if (!/<html/i.test(doc)) doc = `<html><head></head><body>${doc}</body></html>`;
  if (!/<head/i.test(doc)) doc = doc.replace(/<html[^>]*>/i, (m) => `${m}<head></head>`);
  doc = doc.replace(/<\/head>/i, `<meta name="viewport" content="width=device-width, initial-scale=1" />${style}</head>`);

  const bodyOpen = doc.match(/<body[^>]*>/i);
  const start = bodyOpen ? bodyOpen.index + bodyOpen[0].length : 0;
  const end = doc.search(/<\/body>/i);
  const inner = doc.slice(start, end < 0 ? undefined : end);

  const wrapped = `
    <table class="sd-page">
      <tbody><tr><td>${letterhead({ docType, meta, subtitle })}${inner}</td></tr></tbody>
      <tfoot><tr><td></td></tr></tfoot>
    </table>
    <div class="sd-foot">${esc(terms)}<br/><b>${orgName}</b> · ${esc(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }))}</div>`;

  return doc.slice(0, start) + wrapped + (end < 0 ? '' : doc.slice(end));
}

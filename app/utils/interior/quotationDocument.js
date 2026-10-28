// =============================================================================
// Interior — quotation document. A direct port of the web's A4 quotation
// (new-update-web-sklite: src/components/crm/QuotationPreview.tsx, "A4 Printable
// Area") so the app preview, print and PDF look the same as the web.
// Used by the CRM lead, project Quotation and Confirm Order screens.
// =============================================================================

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getCurrencySymbol } from '../format';

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Same number formatting as the web (Number(x).toLocaleString())
const num = (v) => Number(v || 0).toLocaleString();

export const buildQuotationHtml = (targetLead, quote) => {
  const lead = targetLead || {};
  const q = quote || {};
  const sym = getCurrencySymbol(lead.currency || 'INR');
  const idx = Array.isArray(lead.quotations) ? lead.quotations.indexOf(quote) : -1;
  const quotationIndex = idx >= 0 ? idx : Math.max(0, (Number(q.version) || 1) - 1);

  const title = q.title ? String(q.title).toUpperCase() : 'COMMERCIAL QUOTATION';
  const subtitle = q.title || `Quotation #${quotationIndex + 1}`;
  const date = q.createdAt ? new Date(q.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
  const notes = String(q.notes || '').trim();

  const rows = (q.items || [])
    .map((item) => {
      const itemTitle =
        typeof item.description === 'string' ? item.description.split('\n')[0] : item.description || 'Item';
      return `
        <tr>
          <td class="desc">${esc(itemTitle)}</td>
          <td class="center muted">${esc(item.quantity)} ${esc(item.unit || '')}</td>
          <td class="right muted">${sym} ${num(item.unitPrice)}</td>
          <td class="right strong">${sym} ${num(item.total)}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #f1f5f9; padding: 16px; }
  /* A4 sheet */
  .sheet { position: relative; overflow: hidden; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 210mm; min-height: 297mm; margin: 0 auto; }
  .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0.03; pointer-events: none; }
  .watermark span { font-size: 96px; font-weight: 900; transform: rotate(-45deg); letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; }
  .content { position: relative; z-index: 1; padding: 48px; display: flex; flex-direction: column; min-height: 297mm; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #e0e7ff; padding-bottom: 32px; margin-bottom: 32px; }
  .header h1 { font-size: 30px; font-weight: 900; color: #312e81; letter-spacing: -0.025em; }
  .header .sub { font-size: 14px; font-weight: 700; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.1em; }
  .company { text-align: right; }
  .company h2 { font-size: 24px; font-weight: 900; color: #0f172a; }
  .company p { font-size: 14px; color: #64748b; margin-top: 2px; }

  .meta { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 40px; }
  .meta .left { max-width: 50%; min-width: 0; }
  .meta .right { text-align: right; min-width: 0; }
  .label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .meta .name { font-size: 18px; font-weight: 700; color: #0f172a; overflow-wrap: anywhere; }
  .meta p { font-size: 14px; color: #475569; overflow-wrap: anywhere; }
  .meta b { font-weight: 600; color: #0f172a; }

  .table-wrap { flex: 1; margin-bottom: 32px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; text-align: left; min-width: 400px; }
  thead tr { border-bottom: 2px solid #0f172a; }
  th { padding: 12px 0; font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; }
  tbody tr + tr td { border-top: 1px solid #f1f5f9; }
  td { padding: 16px 0; font-size: 14px; vertical-align: top; }
  td.desc { font-weight: 500; color: #1e293b; overflow-wrap: anywhere; max-width: 320px; padding-right: 8px; }
  .center { text-align: center; width: 96px; }
  .right { text-align: right; width: 128px; }
  .muted { color: #475569; }
  .strong { font-weight: 700; color: #0f172a; }

  .totals { display: flex; justify-content: flex-end; margin-top: auto; padding-top: 32px; border-top: 1px solid #e2e8f0; }
  .totals-box { width: 288px; }
  .totals-box .row { display: flex; justify-content: space-between; font-size: 14px; color: #475569; margin-bottom: 12px; }
  .totals-box .row span:last-child { font-weight: 600; color: #0f172a; }
  .totals-box .row.discount, .totals-box .row.discount span:last-child { color: #059669; }
  .totals-box .grand { display: flex; justify-content: space-between; font-size: 20px; font-weight: 900; color: #312e81; padding-top: 12px; border-top: 2px solid #e0e7ff; }

  .notes { margin-top: 64px; padding-top: 32px; border-top: 1px solid #f1f5f9; }
  .notes p.text { font-size: 12px; color: #64748b; white-space: pre-wrap; line-height: 1.6; overflow-wrap: anywhere; }

  /* Phone width — same as the web below its "sm" breakpoint (640px) */
  @media (max-width: 639px) {
    body { padding: 10px; }
    .sheet { min-height: 0; }
    .content { padding: 20px; min-height: 0; }
    .header { flex-direction: column; padding-bottom: 24px; margin-bottom: 24px; }
    .header h1 { font-size: 24px; }
    .header .sub { font-size: 12px; }
    .company { text-align: left; }
    .company h2 { font-size: 18px; }
    .company p { font-size: 12px; }
    .meta { flex-direction: column; margin-bottom: 24px; }
    .meta .left { max-width: 100%; }
    .meta .right { text-align: left; }
    .meta .name { font-size: 16px; }
    .meta p { font-size: 12px; }
    th { font-size: 11px; padding: 10px 0; }
    td { font-size: 12px; padding: 12px 0; }
    .center { width: 64px; }
    .right { width: 96px; }
    .watermark span { font-size: 60px; }
    .totals { padding-top: 24px; }
    .totals-box { width: 100%; }
    .totals-box .row { font-size: 12px; margin-bottom: 8px; }
    .totals-box .grand { font-size: 16px; padding-top: 8px; }
    .notes { margin-top: 40px; padding-top: 24px; }
    .notes p.text { font-size: 11px; }
  }

  /* Print / PDF: plain A4 page, no frame (same as the web print styles) */
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border: none; border-radius: 0; min-height: 0; max-width: none; }
    .watermark { display: none; }
    .content { min-height: 0; }
    tr, .totals, .notes { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="watermark"><span>SKY INTERIOR</span></div>
    <div class="content">
      <div class="header">
        <div>
          <h1>${esc(title)}</h1>
          <p class="sub">${esc(subtitle)}</p>
        </div>
        <div class="company">
          <h2>SKY INTERIOR</h2>
          <p>123 Design Avenue, Tech Park</p>
          <p>contact@skyinterior.com</p>
          <p>+1 (555) 234-5678</p>
        </div>
      </div>

      <div class="meta">
        <div class="left">
          <p class="label">Prepared For</p>
          <p class="name">${esc(lead.name || '')}</p>
          <p>${esc(lead.mobileNumber || '')}</p>
          ${lead.email ? `<p>${esc(lead.email)}</p>` : ''}
        </div>
        <div class="right">
          <p class="label">Details</p>
          <p><b>Date:</b> ${esc(date)}</p>
          <p><b>Lead ID:</b> ${esc(lead.leadNumber || 'LD-XXXX')}</p>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="center">Qty</th>
              <th class="right">Unit Price (${sym})</th>
              <th class="right">Total (${sym})</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="totals">
        <div class="totals-box">
          <div class="row"><span>Subtotal</span><span>${sym} ${num(q.subtotal)}</span></div>
          <div class="row"><span>Tax (${esc(q.taxPercentage || 0)}%)</span><span>${sym} ${num(q.tax)}</span></div>
          ${Number(q.discount || 0) > 0 ? `<div class="row discount"><span>Discount</span><span>- ${sym} ${num(q.discount)}</span></div>` : ''}
          <div class="grand"><span>Grand Total</span><span>${sym} ${num(q.grandTotal)}</span></div>
        </div>
      </div>

      ${notes ? `
      <div class="notes">
        <p class="label">Notes &amp; Remarks</p>
        <p class="text">${esc(notes)}</p>
      </div>` : ''}
    </div>
  </div>
</body>
</html>`;
};

// System print dialog (same as the web "Print / PDF" button)
export async function printQuotation(lead, quote) {
  await Print.printAsync({ html: buildQuotationHtml(lead, quote) });
}

// Generates a PDF and opens the share sheet (save / WhatsApp / email …)
export async function shareQuotationPdf(lead, quote) {
  const { uri } = await Print.printToFileAsync({ html: buildQuotationHtml(lead, quote) });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Quotation v${quote?.version || 1}` });
}

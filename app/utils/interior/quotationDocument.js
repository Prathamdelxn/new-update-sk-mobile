// =============================================================================
// Interior — quotation document. A direct port of the web's A4 quotation
// (new-update-web-sklite: src/components/crm/QuotationPreview.tsx, "A4 Printable
// Document Container") so the app preview, print and PDF look the same as the web.
// Used by the CRM lead, project Quotation and Confirm Order screens.
// =============================================================================

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getCurrencySymbol, formatMillionBillion, formatSmartCurrency } from '../format';

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const STATUS_CLASS = { Accepted: 'st-accepted', Rejected: 'st-rejected' };

// Inline SVG versions of the lucide icons the web document uses
const ICON = {
  sparkles: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/></svg>',
  user: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  calendar: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  phone: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  mail: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>',
  tag: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l8.59-8.59a1 1 0 0 0 0-1.41z"/><circle cx="7" cy="7" r="1.5"/></svg>',
  file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
};

export const buildQuotationHtml = (targetLead, quote) => {
  const lead = targetLead || {};
  const q = quote || {};
  const sym = getCurrencySymbol(lead.currency || 'INR');
  const idx = Array.isArray(lead.quotations) ? lead.quotations.indexOf(quote) : -1;
  const quotationIndex = idx >= 0 ? idx : Math.max(0, (Number(q.version) || 1) - 1);
  const version = q.version || quotationIndex + 1;

  const dateOpts = { day: '2-digit', month: 'short', year: 'numeric' };
  const quoteDate = (q.createdAt ? new Date(q.createdAt) : new Date()).toLocaleDateString('en-US', dateOpts);
  const qtnNumber =
    q.quotationNumber ||
    q.quoteNumber ||
    (lead.leadNumber
      ? `QTN-${String(lead.leadNumber).replace(/^LD-/, '')}-${version}`
      : `QTN-${String(quotationIndex + 1).padStart(3, '0')}`);
  const rawTitle = String(q.title || '').trim();
  const hasCustomTitle = Boolean(rawTitle && rawTitle.toLowerCase() !== 'commercial quotation');
  const status = q.status || 'Draft';
  const statusClass = STATUS_CLASS[status] || 'st-pending';
  const notes = String(q.notes || '').trim();
  const items = Array.isArray(q.items) ? q.items : [];
  const money = (v) => `${sym} ${formatMillionBillion(Number(v || 0))}`;

  const rows = items.length
    ? items
        .map((item, i) => {
          const rawDesc = typeof item.description === 'string' ? item.description : String(item.description || 'Item');
          const lines = rawDesc.split('\n').filter(Boolean);
          const itemTitle = lines[0] || 'Item';
          const itemNotes = lines.slice(1).join('\n');
          const unit = item.unit ? String(item.unit).trim() : '';
          const rate = formatSmartCurrency(Number(item.unitPrice || 0), sym, { threshold: 1_000_000 });
          const total = formatSmartCurrency(Number(item.total || 0), sym, { threshold: 1_000_000 });
          return `
          <tr>
            <td class="c num">${String(i + 1).padStart(2, '0')}</td>
            <td class="desc">
              <div class="item-title">${esc(itemTitle)}</div>
              ${itemNotes ? `<div class="item-notes">${esc(itemNotes)}</div>` : ''}
              ${item.category && item.category !== 'General Scope' ? `<div class="cat"><span>${esc(item.category)}</span></div>` : ''}
            </td>
            <td class="c">
              <div class="qty">${esc(item.quantity)}</div>
              ${unit ? `<div class="unit">${esc(unit.length > 8 ? `${unit.slice(0, 8)}…` : unit)}</div>` : ''}
            </td>
            <td class="r rate">${esc(rate.display)}</td>
            <td class="r total">${esc(total.display)}</td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="5" class="empty">No line items listed in this quotation.</td></tr>';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #f1f5f9; padding: 16px; }
  .sheet { position: relative; overflow: hidden; background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; max-width: 210mm; min-height: 297mm; margin: 0 auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,.08); }
  .stripe { height: 8px; background: linear-gradient(90deg, #4f46e5, #7c3aed, #3730a3); }
  .body { padding: 48px; display: flex; flex-direction: column; gap: 32px; min-height: calc(297mm - 8px); }

  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 32px; }
  .identity { min-width: 0; max-width: 58%; }
  .badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  .badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; padding: 2px 10px; border-radius: 999px; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; font-family: ui-monospace, Menlo, monospace; }
  .qtn { font-size: 11px; font-family: ui-monospace, Menlo, monospace; font-weight: 700; color: #94a3b8; }
  h1 { font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: -.02em; line-height: 1.3; overflow-wrap: anywhere; word-break: break-all; }
  .option { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 4px; }
  .company { text-align: right; flex-shrink: 0; }
  .brand { display: flex; align-items: center; gap: 10px; justify-content: flex-end; margin-bottom: 6px; }
  .logo { width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(135deg, #4f46e5, #312e81); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; }
  .brand h2 { font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -.02em; line-height: 1; }
  .brand span { font-size: 10px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: .03em; }
  .company p { font-size: 12px; color: #64748b; line-height: 1.6; }

  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; min-width: 0; }
  .card-label { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px; }
  .client { font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1.25; overflow-wrap: anywhere; word-break: break-all; }
  .contact { margin-top: 10px; font-size: 12px; color: #475569; }
  .contact p { display: flex; align-items: center; gap: 8px; margin-top: 4px; overflow-wrap: anywhere; word-break: break-all; }
  .details { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; }
  .details small { display: block; font-size: 11px; color: #94a3b8; font-weight: 500; }
  .details b { font-weight: 700; color: #1e293b; }
  .mono { font-family: ui-monospace, Menlo, monospace; }
  .ref { color: #4338ca; font-size: 11px; }
  .status { display: inline-block; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: .05em; margin-top: 2px; border: 1px solid; }
  .st-accepted { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
  .st-rejected { background: #fff1f2; color: #be123c; border-color: #fecdd3; }
  .st-pending { background: #fffbeb; color: #b45309; border-color: #fde68a; }

  .table-wrap { flex: 1; overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; text-align: left; }
  col.c1 { width: 6%; } col.c2 { width: 48%; } col.c3 { width: 14%; } col.c4 { width: 16%; } col.c5 { width: 16%; }
  thead tr { background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
  th { padding: 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .05em; }
  tbody tr + tr td { border-top: 1px solid #f1f5f9; }
  td { padding: 14px 12px; font-size: 14px; vertical-align: top; overflow: hidden; }
  .c { text-align: center; } .r { text-align: right; }
  .num { color: #94a3b8; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  .item-title { font-weight: 600; color: #1e293b; line-height: 1.35; overflow-wrap: anywhere; word-break: break-all; }
  .item-notes { font-size: 11px; color: #64748b; margin-top: 4px; white-space: pre-wrap; line-height: 1.6; overflow-wrap: anywhere; word-break: break-all; }
  .cat { margin-top: 6px; }
  .cat span { display: inline-block; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 6px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
  .qty { font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; }
  .unit { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .05em; margin-top: 2px; }
  .rate { color: #334155; font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap; text-overflow: ellipsis; }
  .total { font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; white-space: nowrap; text-overflow: ellipsis; }
  .empty { padding: 32px; text-align: center; color: #94a3b8; font-size: 12px; }

  .summary { display: flex; justify-content: flex-end; margin-top: auto; padding-top: 24px; border-top: 1px solid #e2e8f0; }
  .totals { width: 320px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; }
  .line { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #475569; margin-bottom: 10px; }
  .line span:last-child { font-weight: 600; color: #0f172a; font-variant-numeric: tabular-nums; }
  .line.discount, .line.discount span:last-child { color: #059669; font-weight: 700; }
  .line.discount span:first-child { display: flex; align-items: center; gap: 4px; font-weight: 500; }
  .grand-wrap { padding-top: 8px; border-top: 1px solid #e2e8f0; }
  .grand { background: linear-gradient(90deg, #0f172a, #1e1b4b, #0f172a); color: #fff; border-radius: 12px; padding: 14px; display: flex; align-items: center; justify-content: space-between; }
  .grand small { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #a5b4fc; }
  .grand em { font-style: normal; font-size: 12px; color: #cbd5e1; font-weight: 500; }
  .grand strong { font-size: 20px; font-weight: 900; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }

  .notes { background: rgba(245,158,11,.04); border: 1px solid rgba(245,158,11,.2); border-radius: 16px; padding: 20px; }
  .notes .title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #451a03; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
  .notes .text { font-size: 12px; color: #334155; white-space: pre-wrap; line-height: 1.6; overflow-wrap: anywhere; word-break: break-all; }

  /* Phone width — same as the web below its "sm" breakpoint (640px) */
  @media (max-width: 639px) {
    body { padding: 8px; }
    .sheet { min-height: 0; }
    .body { padding: 24px; gap: 24px; min-height: 0; }
    .header { flex-direction: column; padding-bottom: 24px; }
    .identity { max-width: 100%; }
    h1 { font-size: 20px; }
    .company { text-align: left; }
    .brand { justify-content: flex-start; }
    .brand h2 { font-size: 16px; }
    .cards { grid-template-columns: 1fr; }
    .card { padding: 16px; }
    col.c1 { width: 8%; } col.c2 { width: 46%; }
    td { font-size: 12px; }
    .totals { width: 100%; padding: 16px; }
    .grand { padding: 12px; }
    .grand strong { font-size: 16px; }
    .notes { padding: 16px; }
  }

  /* Print / PDF: plain A4 page, no frame (same as the web print styles) */
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border: none; border-radius: 0; box-shadow: none; min-height: 0; max-width: none; margin: 0; }
    .body { min-height: 0; }
    .table-wrap { flex: none; }
    tr, .summary, .notes { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="stripe"></div>
    <div class="body">
      <div class="header">
        <div class="identity">
          <div class="badges">
            <span class="badge">${ICON.sparkles} Commercial Quotation</span>
            <span class="qtn">${esc(qtnNumber)}</span>
          </div>
          <h1>${esc(hasCustomTitle ? rawTitle : 'Commercial Estimate & Scope')}</h1>
          <p class="option">Quotation Option #${quotationIndex + 1} • Version ${esc(version)}</p>
        </div>
        <div class="company">
          <div class="brand">
            <div class="logo">SI</div>
            <div>
              <h2>SKY INTERIOR</h2>
              <span>Architecture &amp; Design</span>
            </div>
          </div>
          <p>123 Design Avenue, Tech Park</p>
          <p>contact@skyinterior.com</p>
          <p>+1 (555) 234-5678</p>
        </div>
      </div>

      <div class="cards">
        <div class="card">
          <div class="card-label">${ICON.user} Prepared For</div>
          <p class="client">${esc(lead.name || 'Valued Client')}</p>
          <div class="contact">
            ${lead.mobileNumber ? `<p>${ICON.phone}<span>${esc(lead.mobileNumber)}</span></p>` : ''}
            ${lead.email ? `<p>${ICON.mail}<span>${esc(lead.email)}</span></p>` : ''}
          </div>
        </div>
        <div class="card">
          <div class="card-label">${ICON.calendar} Quotation Details</div>
          <div class="details">
            <div><small>Issue Date</small><b>${esc(quoteDate)}</b></div>
            <div><small>Lead Reference</small><b class="mono">${esc(lead.leadNumber || 'LD-XXXX')}</b></div>
            <div><small>Quote Reference</small><b class="mono ref">${esc(qtnNumber)}</b></div>
            <div><small>Status</small><span class="status ${statusClass}">${esc(status)}</span></div>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <colgroup><col class="c1" /><col class="c2" /><col class="c3" /><col class="c4" /><col class="c5" /></colgroup>
          <thead>
            <tr>
              <th class="c">#</th>
              <th>Description</th>
              <th class="c">Qty</th>
              <th class="r">Unit Rate (${esc(sym)})</th>
              <th class="r">Total (${esc(sym)})</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="summary">
        <div class="totals">
          <div class="line"><span>Subtotal (${items.length} items)</span><span>${esc(money(q.subtotal))}</span></div>
          <div class="line"><span>Tax (${esc(q.taxPercentage || 0)}%)</span><span>${esc(money(q.tax))}</span></div>
          ${Number(q.discount || 0) > 0 ? `<div class="line discount"><span>${ICON.tag} Discount Applied</span><span>- ${esc(money(q.discount))}</span></div>` : ''}
          <div class="grand-wrap">
            <div class="grand">
              <div><small>Grand Total</small><em>Net Payable</em></div>
              <strong>${esc(money(q.grandTotal))}</strong>
            </div>
          </div>
        </div>
      </div>

      ${notes ? `
      <div class="notes">
        <p class="title">${ICON.file} Notes &amp; Remarks</p>
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

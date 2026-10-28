// =============================================================================
// Interior — payment invoice / receipt document. Ported as-is from the web
// (features/interior-new/utils/invoicePdfGenerator.ts) so both apps print the
// same receipt. View = in-app preview, Print = system print dialog,
// Download = PDF via the share sheet.
// =============================================================================

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

function formatLocation(loc) {
  if (!loc) return 'Site Location';
  if (typeof loc === 'string') {
    const raw = loc.trim();
    if (!raw) return 'Site Location';
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const unique = Array.from(new Set(parts));
    return unique.join(', ');
  }
  if (typeof loc === 'object') {
    const rawParts = [loc.address, loc.city, loc.state, loc.country, loc.zipCode]
      .filter((p) => typeof p === 'string' && p.trim().length > 0)
      .map((p) => p.trim());
    const unique = Array.from(new Set(rawParts));
    return unique.length > 0 ? unique.join(', ') : 'Site Location';
  }
  return 'Site Location';
}

function resolveClientName(project) {
  if (!project) return 'Valued Client';
  if (typeof project.client === 'string' && project.client.trim()) return project.client.trim();
  if (typeof project.client === 'object' && project.client?.name) return project.client.name;
  if (project.clientName && typeof project.clientName === 'string') return project.clientName.trim();
  if (project.customerName && typeof project.customerName === 'string') return project.customerName.trim();
  return 'Valued Client';
}

export function generateInvoiceHtml(payment, project, currencySymbol = '₹') {
  const projectName = project?.name || project?.title || 'Interior Fitout Project';
  const clientName = resolveClientName(project);
  const clientPhone = (typeof project?.client === 'object' ? project?.client?.phone : '') || project?.clientPhone || project?.phone || '';
  const clientEmail = (typeof project?.client === 'object' ? project?.client?.email : '') || project?.clientEmail || project?.email || '';
  const location = formatLocation(project?.location || project?.siteAddress);
  const projectCode = project?.code || project?.projectCode || `PRJ-${String(project?._id || '').slice(-4).toUpperCase() || '001'}`;

  const invoiceNumber = payment.invoiceNo || 'INV-2026-001';
  const paymentDate = payment.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const milestone = payment.milestoneName || 'Milestone Payment Receipt';
  const method = payment.paymentMethod || 'Bank Transfer';
  const refNo = payment.referenceNo || 'N/A';
  const formattedAmount = `${currencySymbol} ${(payment.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const status = (payment.incomingStatus || 'COMPLETED').toUpperCase();

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Payment Receipt - ${invoiceNumber}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #111827;
          background-color: #ffffff;
          padding: 36px 40px;
          line-height: 1.4;
          font-size: 13px;
        }
        .invoice-box {
          width: 100%;
          max-width: 780px;
          margin: 0 auto;
          background-color: #ffffff;
        }
        table { border-collapse: collapse; width: 100%; }
        td, th { vertical-align: top; }
      </style>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; background-color: #ffffff; padding: 36px 40px; font-size: 13px; line-height: 1.4;">
      <div class="invoice-box" style="width: 100%; max-width: 780px; margin: 0 auto; background-color: #ffffff;">

        <!-- ── HEADER ── -->
        <table style="width: 100%; border-bottom: 2px solid #111827; padding-bottom: 20px; margin-bottom: 24px;">
          <tr>
            <td style="vertical-align: top; width: 55%;">
              <div style="font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.5px; margin-bottom: 4px;">SKYSTRUCT LITE</div>
              <div style="font-size: 12px; color: #4b5563; font-weight: 600; margin-bottom: 4px;">Interior Architecture &amp; Construction Management</div>
              <div style="font-size: 11px; color: #6b7280; line-height: 1.4;">
                Project Operations &amp; Site Finance<br />
                Email: accounts@skystruct.com &bull; Web: www.skystruct.com
              </div>
            </td>
            <td style="vertical-align: top; width: 45%; text-align: right;">
              <div style="font-size: 20px; font-weight: 800; color: #111827; letter-spacing: 0.5px; margin-bottom: 8px;">PAYMENT RECEIPT</div>
              <table style="width: auto; margin-left: auto; font-size: 12px; border-collapse: collapse;">
                <tr>
                  <td style="color: #6b7280; font-weight: 500; padding: 2px 10px 2px 0; text-align: right;">Receipt / Invoice #:</td>
                  <td style="color: #111827; font-weight: 700; text-align: right;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 500; padding: 2px 10px 2px 0; text-align: right;">Receipt Date:</td>
                  <td style="color: #111827; font-weight: 700; text-align: right;">${paymentDate}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 500; padding: 2px 10px 2px 0; text-align: right;">Status:</td>
                  <td style="text-align: right;">
                    <span style="display: inline-block; background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; font-weight: 700; font-size: 10.5px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
                      ${status}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- ── ADDRESSES & PROJECT SECTION ── -->
        <table style="width: 100%; margin-bottom: 24px;">
          <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 20px;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px;">
                Billed To (Client)
              </div>
              <div style="font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 4px;">${clientName}</div>
              <div style="font-size: 12px; color: #4b5563; margin-bottom: 3px; line-height: 1.4;">
                <strong style="color: #111827;">Site Location:</strong> ${location}
              </div>
              ${clientPhone ? `<div style="font-size: 12px; color: #4b5563; margin-bottom: 3px;"><strong style="color: #111827;">Phone:</strong> ${clientPhone}</div>` : ''}
              ${clientEmail ? `<div style="font-size: 12px; color: #4b5563; margin-bottom: 3px;"><strong style="color: #111827;">Email:</strong> ${clientEmail}</div>` : ''}
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 20px;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px;">
                Project &amp; Transaction Details
              </div>
              <div style="font-size: 12px; color: #4b5563; margin-bottom: 4px;"><strong style="color: #111827;">Project:</strong> ${projectName}</div>
              <div style="font-size: 12px; color: #4b5563; margin-bottom: 4px;"><strong style="color: #111827;">Project Code:</strong> ${projectCode}</div>
              <div style="font-size: 12px; color: #4b5563; margin-bottom: 4px;"><strong style="color: #111827;">Payment Mode:</strong> ${method}</div>
              <div style="font-size: 12px; color: #4b5563; margin-bottom: 4px;"><strong style="color: #111827;">UTR / Transaction Ref:</strong> ${refNo}</div>
            </td>
          </tr>
        </table>

        <!-- ── TABLE ── -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; text-align: center; width: 36px;">#</th>
              <th style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; text-align: left;">Milestone Scope / Particulars</th>
              <th style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; text-align: left; width: 130px;">Payment Mode</th>
              <th style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; text-align: left; width: 130px;">Reference #</th>
              <th style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; text-align: right; width: 160px;">Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 14px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-weight: 600;">1</td>
              <td style="padding: 14px 12px; border-bottom: 1px solid #e5e7eb;">
                <div style="font-weight: 700; color: #111827; font-size: 13px;">${milestone}</div>
                <div style="font-size: 11.5px; color: #6b7280; margin-top: 3px;">Official milestone payment received against interior contract.</div>
              </td>
              <td style="padding: 14px 12px; border-bottom: 1px solid #e5e7eb; color: #111827; font-weight: 500;">${method}</td>
              <td style="padding: 14px 12px; border-bottom: 1px solid #e5e7eb; color: #4b5563; font-family: monospace; font-size: 12px;">${refNo}</td>
              <td style="padding: 14px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 700; color: #111827; font-size: 13.5px;">${formattedAmount}</td>
            </tr>
          </tbody>
        </table>

        <!-- ── SUMMARY & NOTES ── -->
        <table style="width: 100%; margin-bottom: 36px;">
          <tr>
            <td style="width: 55%; vertical-align: top; padding-right: 24px;">
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 14px;">
                <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #4b5563; margin-bottom: 4px;">
                  Receipt Notes &amp; Remarks
                </div>
                <div style="font-size: 11.5px; color: #4b5563; line-height: 1.45;">
                  ${
                    payment.remarks
                      ? payment.remarks
                      : `Payment of ${formattedAmount} received and verified for milestone "${milestone}". Thank you for your business.`
                  }
                </div>
              </div>
            </td>
            <td style="width: 45%; vertical-align: top;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                <tr>
                  <td style="padding: 6px 0; color: #4b5563; font-weight: 500;">Milestone Amount</td>
                  <td style="padding: 6px 0; color: #111827; font-weight: 600; text-align: right;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #4b5563; font-weight: 500;">Tax / Adjustments (0%)</td>
                  <td style="padding: 6px 0; color: #111827; font-weight: 600; text-align: right;">${currencySymbol} 0.00</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-top: 2px solid #111827; border-bottom: 2px solid #111827; font-size: 15px; font-weight: 800; color: #111827;">Total Amount Paid</td>
                  <td style="padding: 10px 0; border-top: 2px solid #111827; border-bottom: 2px solid #111827; font-size: 15px; font-weight: 800; color: #111827; text-align: right;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding-top: 8px; font-size: 12px; color: #059669; font-weight: 700;">Balance Due for Milestone</td>
                  <td style="padding-top: 8px; font-size: 12px; color: #059669; font-weight: 700; text-align: right;">${currencySymbol} 0.00</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- ── SIGNATURES ── -->
        <table style="width: 100%; margin-top: 40px;">
          <tr>
            <td style="width: 45%; text-align: center; vertical-align: bottom;">
              <div style="border-bottom: 1px solid #9ca3af; height: 40px; margin-bottom: 8px;"></div>
              <div style="font-size: 12px; font-weight: 700; color: #111827;">${clientName}</div>
              <div style="font-size: 11px; color: #6b7280;">Client Signature &amp; Date</div>
            </td>
            <td style="width: 10%;"></td>
            <td style="width: 45%; text-align: center; vertical-align: bottom;">
              <div style="border-bottom: 1px solid #9ca3af; height: 40px; margin-bottom: 8px;"></div>
              <div style="font-size: 12px; font-weight: 700; color: #111827;">Authorized Signatory</div>
              <div style="font-size: 11px; color: #6b7280;">For SkyStruct Interiors</div>
            </td>
          </tr>
        </table>

        <!-- ── FOOTER ── -->
        <div style="margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px; text-align: center; font-size: 11px; color: #9ca3af;">
          This is an official computer-generated tax invoice &amp; payment receipt issued by SkyStruct Lite.<br />
          &copy; ${new Date().getFullYear()} SkyStruct Interiors. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function printInvoice(payment, project, currencySymbol) {
  await Print.printAsync({ html: generateInvoiceHtml(payment, project, currencySymbol) });
}

export async function shareInvoicePdf(payment, project, currencySymbol) {
  const { uri } = await Print.printToFileAsync({ html: generateInvoiceHtml(payment, project, currencySymbol) });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${payment?.invoiceNo || ''}`.trim() });
}

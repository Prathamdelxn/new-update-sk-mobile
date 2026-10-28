// =============================================================================
// Interior — quotation document preview (mobile version of the web
// InteriorQuotationPreviewModal): the A4 quotation document, plus Print,
// Download PDF, Send to Client and Send to Vendor.
// Used by the project Quotation and Confirm Order screens.
// =============================================================================

import { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../../context/ToastContext';
import SendQuotationModal from '../crm/SendQuotationModal';
import { buildQuotationHtml, printQuotation, shareQuotationPdf } from '../../utils/interior/quotationDocument';
import { formatExactCurrency } from '../../utils/format';

/**
 * @param visible
 * @param onClose
 * @param lead            CRM lead the quotation belongs to (name, email, phone, leadNumber…)
 * @param quotationIndex  index into lead.quotations
 * @param canSend         show Send to Client / Send to Vendor
 * @param canExport       show Print / Download PDF
 * @param onSent          called after a quotation is dispatched
 */
export default function QuotationPreviewModal({
  visible,
  onClose,
  lead,
  quotationIndex,
  canSend = false,
  canExport = true,
  onSent,
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(null); // 'print' | 'pdf'
  const [sendTarget, setSendTarget] = useState(null); // 'customer' | 'vendor'

  const quote = quotationIndex != null ? lead?.quotations?.[quotationIndex] : null;
  const currency = lead?.currency || 'INR';

  const run = async (kind, fn) => {
    if (!quote) return;
    setBusy(kind);
    try {
      await fn(lead, quote);
    } catch (e) {
      // Closing the print dialog without printing is not an error
      if (!/cancel/i.test(e?.message || '')) showToast(e?.message || 'Something went wrong', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={Boolean(visible && quote)} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.screen}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.title} numberOfLines={1}>{quote?.title || 'Quotation Document'}</Text>
            <Text style={s.sub} numberOfLines={1}>
              Version {quote?.version || (quotationIndex ?? 0) + 1} · {quote?.status || 'Generated'}
            </Text>
            <Text style={[s.sub, { color: '#334155' }]} numberOfLines={1}>
              Client: {lead?.name || '—'} • {(quote?.items || []).length} Items ({formatExactCurrency(Number(quote?.grandTotal) || 0, currency)})
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Document */}
        {quote && (
          <WebView
            originWhitelist={['*']}
            source={{ html: buildQuotationHtml(lead, quote) }}
            style={s.doc}
          />
        )}

        {/* Actions */}
        {(canExport || canSend) && (
          <View style={s.actions}>
            {canExport && (
              <View style={s.actionRow}>
                <TouchableOpacity style={s.secondaryBtn} onPress={() => run('print', printQuotation)} disabled={!!busy}>
                  {busy === 'print' ? <ActivityIndicator size="small" color="#334155" /> : <Ionicons name="print-outline" size={16} color="#334155" />}
                  <Text style={s.secondaryText}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={() => run('pdf', shareQuotationPdf)} disabled={!!busy}>
                  {busy === 'pdf' ? <ActivityIndicator size="small" color="#334155" /> : <Ionicons name="download-outline" size={16} color="#334155" />}
                  <Text style={s.secondaryText}>Download PDF</Text>
                </TouchableOpacity>
              </View>
            )}
            {canSend && (
              <View style={s.actionRow}>
                <TouchableOpacity style={s.clientBtn} onPress={() => setSendTarget('customer')}>
                  <Ionicons name="person-outline" size={16} color="#FFFFFF" />
                  <Text style={s.primaryText}>Send to Client</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.vendorBtn} onPress={() => setSendTarget('vendor')}>
                  <Ionicons name="storefront-outline" size={16} color="#FFFFFF" />
                  <Text style={s.primaryText}>Send to Vendor</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <SendQuotationModal
          isOpen={Boolean(sendTarget)}
          initialTarget={sendTarget || 'customer'}
          onClose={() => setSendTarget(null)}
          customerId={lead?._id}
          customerName={lead?.name}
          customerEmail={lead?.email}
          customerPhone={lead?.phone || lead?.mobileNumber}
          quotation={quote}
          quotationIndex={quotationIndex}
          onSuccess={() => {
            setSendTarget(null);
            showToast('Quotation dispatched successfully!', 'success');
            onSent?.();
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  title: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  sub: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  doc: { flex: 1, backgroundColor: '#F1F5F9' },
  actions: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  actionRow: { flexDirection: 'row', gap: 8 },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  secondaryText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#334155' },
  clientBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: '#2563EB' },
  vendorBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: '#4F46E5' },
  primaryText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

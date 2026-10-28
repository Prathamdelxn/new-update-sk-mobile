// =============================================================================
// Interior — Confirm Order (mobile port of the web InteriorConfirmedOrderStageView)
// Vendors each quotation was dispatched to, one vendor document per row, and the
// general signed-contract / waste files of the confirmed order. Used by the CRM
// lead's "Confirm Order" tab and by the project's Confirm Order screen; the
// caller decides where updates are saved (CRM lead or project endpoint).
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import cloudinaryService from '../../services/cloudinaryService';
import { useToast } from '../../context/ToastContext';

const MAX_BYTES = 15 * 1024 * 1024;
const DOC_TYPES = ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

const rid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

// Vendor rows per quotation, from the confirmed order, the quotation's own vendor
// quotes, vendors it was sent to, and vendor e-mail dispatches (de-duplicated)
function buildVendorMap(lead, quotations) {
  const map = {};
  quotations.forEach((q, qIdx) => {
    const qTitle = q.title || `Quotation ${qIdx + 1}`;
    const list = [];
    const isDuplicate = (name, email, id) => {
      const nEmail = email?.trim().toLowerCase();
      const nName = name?.trim().toLowerCase();
      return list.some((v) =>
        (id && v.vendorId && v.vendorId === id) ||
        (nEmail && v.vendorEmail && v.vendorEmail.trim().toLowerCase() === nEmail) ||
        (nName && v.vendorName && v.vendorName.trim().toLowerCase() === nName)
      );
    };
    const push = (src, prefix, withQuote) => {
      list.push({
        id: (withQuote && src.id) || rid(`${prefix}-${qIdx}`),
        vendorId: src.vendorId,
        vendorName: src.vendorName || src.recipientName || 'Vendor Partner',
        vendorCategory: src.vendorCategory || 'Material Partner',
        vendorEmail: src.vendorEmail || src.recipientEmail,
        vendorPhone: src.vendorPhone,
        quotationRef: qTitle,
        quotationTitle: qTitle,
        quotationIndex: qIdx,
        quoteAmount: withQuote && src.quoteAmount !== undefined ? src.quoteAmount : '',
        notes: (withQuote && src.notes) || '',
        attachments: withQuote && Array.isArray(src.attachments) ? src.attachments : [],
        sentAt: src.sentAt,
      });
    };

    (lead?.confirmedOrder?.vendorQuotations || []).forEach((vq) => {
      const matches = vq.quotationIndex === qIdx || vq.quotationRef === qTitle || vq.quotationRef === q.quotationNumber || (quotations.length === 1 && !vq.quotationRef);
      if (matches && !isDuplicate(vq.vendorName, vq.vendorEmail, vq.vendorId)) push(vq, 'vq-conf', true);
    });
    (q.vendorQuotes || []).forEach((vq) => {
      if (!isDuplicate(vq.vendorName, vq.vendorEmail, vq.vendorId)) push(vq, 'vq-q', true);
    });
    (q.sentVendors || []).forEach((sv) => {
      if (!isDuplicate(sv.vendorName, sv.vendorEmail, sv.vendorId)) push(sv, 'vq-sent', false);
    });
    (q.dispatches || []).filter((d) => d.recipientType === 'vendor').forEach((d) => {
      if (!isDuplicate(d.recipientName, d.recipientEmail)) push(d, 'vq-disp', false);
    });
    map[qIdx] = list;
  });
  return map;
}

/**
 * @param lead          CRM lead (with quotations and confirmedOrder)
 * @param isReadOnly    lost / converted lead on the CRM side
 * @param canEdit       permission to change the order (CRM Quotations or project Confirm Order → Update)
 * @param saveUpdates   (updates) => Promise — where to save
 * @param onRefresh     reload the lead after a save
 * @param onViewQuotation (quotationIndex) => void
 */
export default function ConfirmOrderView({ lead, isReadOnly = false, canEdit = false, saveUpdates, onRefresh, onViewQuotation }) {
  const router = useRouter();
  const { showToast } = useToast();
  const quotations = useMemo(() => lead?.quotations || [], [lead?.quotations]);
  const [vendorMap, setVendorMap] = useState({});
  const [search, setSearch] = useState('');
  const [quoteFilter, setQuoteFilter] = useState('all');
  const [uploadingRowId, setUploadingRowId] = useState(null);
  const [uploadingGeneral, setUploadingGeneral] = useState(false);
  const editable = canEdit && !isReadOnly;

  useEffect(() => {
    if (lead) setVendorMap(buildVendorMap(lead, quotations));
  }, [lead, quotations]);

  // PDFs / images / videos open in the in-app viewer; anything else (Word, Excel, …)
  // opens in the browser — same as the web's "Preview" link (new tab).
  const openDoc = (doc) => {
    if (!doc?.url) return;
    const type = doc.type || doc.mimeType || '';
    const target = `${doc.name || ''} ${doc.url}`.toLowerCase();
    const viewable =
      type === 'application/pdf' || type.startsWith('image/') || type.startsWith('video/') ||
      /\.(pdf|jpe?g|png|gif|webp|mp4|mov|m4v|webm)(\s|$|\?)/.test(target);
    if (viewable) {
      router.push({ pathname: '/document-viewer', params: { url: doc.url, name: doc.name || 'Document', mimeType: type } });
    } else {
      Linking.openURL(doc.url).catch(() => showToast('Could not open this document', 'error'));
    }
  };

  // Save vendor rows back to the quotations (and the confirmed order, if there is one)
  const persistVendors = async (nextMap, removed) => {
    const flat = Object.values(nextMap).flat();
    const updatedQuotations = quotations.map((q, qIdx) => {
      let sentVendors = Array.isArray(q.sentVendors) ? [...q.sentVendors] : [];
      let dispatches = Array.isArray(q.dispatches) ? [...q.dispatches] : [];
      if (removed && removed.qIdx === qIdx) {
        const nEmail = removed.vendorEmail?.trim().toLowerCase();
        const nName = removed.vendorName?.trim().toLowerCase();
        sentVendors = sentVendors.filter((sv) => {
          if (removed.vendorId && sv.vendorId && sv.vendorId === removed.vendorId) return false;
          if (nEmail && sv.vendorEmail?.trim().toLowerCase() === nEmail) return false;
          if (nName && sv.vendorName?.trim().toLowerCase() === nName) return false;
          return true;
        });
        dispatches = dispatches.filter((d) => {
          if (d.recipientType !== 'vendor') return true;
          if (nEmail && d.recipientEmail?.trim().toLowerCase() === nEmail) return false;
          if (nName && d.recipientName?.trim().toLowerCase() === nName) return false;
          return true;
        });
      }
      return { ...q, vendorQuotes: nextMap[qIdx] || [], sentVendors, dispatches };
    });
    await saveUpdates({
      quotations: updatedQuotations,
      ...(lead.confirmedOrder ? { confirmedOrder: { ...lead.confirmedOrder, vendorQuotations: flat } } : {}),
    });
    onRefresh?.();
  };

  const pickFile = async (multiple = false) => {
    const result = await DocumentPicker.getDocumentAsync({ type: DOC_TYPES, multiple, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return [];
    return result.assets;
  };

  const uploadAsset = async (asset) => {
    if (asset.size && asset.size > MAX_BYTES) {
      showToast(`"${asset.name}" is larger than 15 MB`, 'error');
      return null;
    }
    const url = await cloudinaryService.uploadFile(asset.uri, asset.name, asset.mimeType || '');
    if (!url) throw new Error('Upload returned no URL');
    return { name: asset.name, url, size: asset.size, type: asset.mimeType, uploadedAt: new Date().toISOString() };
  };

  const handleVendorUpload = async (row) => {
    try {
      const [asset] = await pickFile(false);
      if (!asset) return;
      setUploadingRowId(row.id);
      const attachment = await uploadAsset(asset);
      if (!attachment) return;
      const next = { ...vendorMap, [row.quotationIndex]: (vendorMap[row.quotationIndex] || []).map((v) => (v.id === row.id ? { ...v, attachments: [attachment] } : v)) };
      setVendorMap(next);
      await persistVendors(next);
      showToast('Document uploaded', 'success');
    } catch (e) {
      showToast(e?.message || 'Failed to upload the document', 'error');
    } finally {
      setUploadingRowId(null);
    }
  };

  const handleRemoveVendorDoc = async (row) => {
    try {
      const next = { ...vendorMap, [row.quotationIndex]: (vendorMap[row.quotationIndex] || []).map((v) => (v.id === row.id ? { ...v, attachments: [] } : v)) };
      setVendorMap(next);
      await persistVendors(next);
      showToast('Document removed', 'success');
    } catch (e) {
      showToast(e?.message || 'Failed to remove the document', 'error');
    }
  };

  const handleRemoveVendor = (row) => {
    Alert.alert('Remove vendor', `Remove ${row.vendorName} from "${row.quotationTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const next = { ...vendorMap, [row.quotationIndex]: (vendorMap[row.quotationIndex] || []).filter((v) => v.id !== row.id) };
            setVendorMap(next);
            await persistVendors(next, { qIdx: row.quotationIndex, vendorEmail: row.vendorEmail, vendorName: row.vendorName, vendorId: row.vendorId });
            showToast('Vendor entry removed', 'success');
          } catch (e) {
            showToast(e?.message || 'Failed to remove the vendor', 'error');
          }
        },
      },
    ]);
  };

  const generalDocs = Array.isArray(lead?.confirmedOrder?.attachments) ? lead.confirmedOrder.attachments : [];

  const handleGeneralUpload = async () => {
    try {
      const assets = await pickFile(true);
      if (!assets.length) return;
      setUploadingGeneral(true);
      const uploaded = [];
      for (const a of assets) {
        const att = await uploadAsset(a);
        if (att) uploaded.push(att);
      }
      if (!uploaded.length) return;
      await saveUpdates({ confirmedOrder: { ...(lead.confirmedOrder || {}), attachments: [...generalDocs, ...uploaded] } });
      showToast(`${uploaded.length} file(s) uploaded`, 'success');
      onRefresh?.();
    } catch (e) {
      showToast(e?.message || 'Failed to upload files', 'error');
    } finally {
      setUploadingGeneral(false);
    }
  };

  const handleRemoveGeneral = (idx) => {
    Alert.alert('Remove document', `Remove "${generalDocs[idx]?.name || 'document'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await saveUpdates({ confirmedOrder: { ...(lead.confirmedOrder || {}), attachments: generalDocs.filter((_, i) => i !== idx) } });
            showToast('Document removed', 'success');
            onRefresh?.();
          } catch (e) {
            showToast(e?.message || 'Failed to remove the document', 'error');
          }
        },
      },
    ]);
  };

  // One row per vendor a quotation was dispatched to
  const rows = useMemo(() => {
    const list = [];
    quotations.forEach((q, qIdx) => {
      const status = q.status || 'Draft';
      const isPrimary = lead?.confirmedOrder?.quotationIndex === qIdx || ((status === 'Accepted' || status === 'Approved') && !lead?.confirmedOrder);
      (vendorMap[qIdx] || []).forEach((v) => {
        list.push({ ...v, quotationVersion: q.version || qIdx + 1, isPrimary });
      });
    });
    return list;
  }, [quotations, vendorMap, lead?.confirmedOrder]);

  const quoteIndices = useMemo(() => Array.from(new Set(rows.map((r) => r.quotationIndex))), [rows]);
  const filtered = rows.filter((r) => {
    if (quoteFilter !== 'all' && r.quotationIndex !== quoteFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.quotationTitle.toLowerCase().includes(q) || r.vendorName.toLowerCase().includes(q) || (r.vendorCategory || '').toLowerCase().includes(q);
  });

  return (
    <View style={{ gap: 14 }}>
      {/* Dispatched vendors */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Ionicons name="paper-plane-outline" size={16} color="#2563EB" />
          <Text style={s.cardTitle}>Dispatched Quotations</Text>
          <Text style={s.countText}>{filtered.length}</Text>
        </View>

        {rows.length > 0 && (
          <View style={s.searchBox}>
            <Ionicons name="search" size={14} color="#94A3B8" />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search quote or vendor..." placeholderTextColor="#94A3B8" style={s.searchInput} />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {quoteIndices.length > 1 && (
          <View style={s.pillRow}>
            {['all', ...quoteIndices].map((k) => (
              <TouchableOpacity key={String(k)} style={[s.pill, quoteFilter === k && s.pillActive]} onPress={() => setQuoteFilter(k)}>
                <Text style={[s.pillText, quoteFilter === k && s.pillTextActive]}>{k === 'all' ? 'All Quotes' : quotations[k]?.title || `Q${k + 1}`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={30} color="#CBD5E1" />
            <Text style={s.emptyTitle}>{rows.length === 0 ? 'No quotations dispatched to vendors yet' : 'No vendors match your search'}</Text>
            {rows.length === 0 && <Text style={s.emptySub}>Quotations show up here as soon as they are sent to vendor partners.</Text>}
          </View>
        ) : (
          filtered.map((row) => (
            <View key={`${row.quotationIndex}-${row.id}`} style={s.row}>
              <View style={s.rowTop}>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={s.quoteLine}>
                    <Text style={s.quoteTitle} numberOfLines={1}>{row.quotationTitle}</Text>
                    <Text style={s.versionTag}>v{row.quotationVersion}</Text>
                    {row.isPrimary && (
                      <View style={s.primaryTag}>
                        <Ionicons name="checkmark-circle" size={11} color="#047857" />
                        <Text style={s.primaryText}>Primary</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.vendorName}>{row.vendorName}</Text>
                  {!!row.vendorEmail && <Text style={s.meta} numberOfLines={1}>{row.vendorEmail}</Text>}
                  <Text style={s.meta}>Sent: {formatDateTime(row.sentAt)}</Text>
                </View>
                <View style={s.rowActions}>
                  {!!onViewQuotation && (
                    <TouchableOpacity style={s.viewBtn} onPress={() => onViewQuotation(row.quotationIndex)}>
                      <Ionicons name="eye-outline" size={13} color="#1D4ED8" />
                      <Text style={s.viewText}>View</Text>
                    </TouchableOpacity>
                  )}
                  {editable && (
                    <TouchableOpacity style={s.iconBtn} onPress={() => handleRemoveVendor(row)} hitSlop={6}>
                      <Ionicons name="trash-outline" size={15} color="#E11D48" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={s.docLine}>
                {row.attachments.map((doc, i) => (
                  <View key={i} style={s.docChip}>
                    <TouchableOpacity style={s.docChipMain} onPress={() => openDoc(doc)}>
                      <Ionicons name="document-text-outline" size={13} color="#2563EB" />
                      <Text style={s.docChipText} numberOfLines={1}>{doc.name}</Text>
                    </TouchableOpacity>
                    {editable && (
                      <TouchableOpacity onPress={() => handleRemoveVendorDoc(row)} hitSlop={6}>
                        <Ionicons name="close" size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {row.attachments.length === 0 && (editable ? (
                  <TouchableOpacity style={s.uploadBtn} onPress={() => handleVendorUpload(row)} disabled={uploadingRowId === row.id}>
                    {uploadingRowId === row.id ? <ActivityIndicator size="small" color="#475569" /> : <Ionicons name="cloud-upload-outline" size={14} color="#475569" />}
                    <Text style={s.uploadText}>{uploadingRowId === row.id ? 'Uploading...' : 'Upload vendor document'}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={s.meta}>No vendor document</Text>
                ))}
              </View>
            </View>
          ))
        )}
      </View>

      {/* General signed contract / waste files */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Ionicons name="attach-outline" size={17} color="#2563EB" />
          <Text style={s.cardTitle}>Signed Contract & Waste Files</Text>
        </View>
        <Text style={s.emptySub}>Signed client proposals, execution attachments or waste calculation sheets.</Text>

        {generalDocs.length === 0 ? (
          <View style={s.dashedBox}>
            <Text style={s.meta}>No signed contract or waste files attached yet.</Text>
          </View>
        ) : (
          generalDocs.map((file, idx) => (
            <View key={idx} style={s.fileRow}>
              <TouchableOpacity style={s.fileMain} onPress={() => openDoc(file)}>
                <View style={s.fileIcon}>
                  <Ionicons name="document-text-outline" size={15} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fileName} numberOfLines={1}>{file.name}</Text>
                  {!!file.size && <Text style={s.meta}>{Math.round(file.size / 1024)} KB</Text>}
                </View>
              </TouchableOpacity>
              {editable && (
                <TouchableOpacity style={s.iconBtn} onPress={() => handleRemoveGeneral(idx)} hitSlop={6}>
                  <Ionicons name="trash-outline" size={15} color="#E11D48" />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        {editable && (
          <TouchableOpacity style={s.primaryBtn} onPress={handleGeneralUpload} disabled={uploadingGeneral}>
            {uploadingGeneral ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="cloud-upload-outline" size={15} color="#FFFFFF" />}
            <Text style={s.primaryBtnText}>{uploadingGeneral ? 'Uploading...' : 'Upload Documents'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  countText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 10, height: 38 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A', paddingVertical: 0 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F1F5F9' },
  pillActive: { backgroundColor: '#0F172A' },
  pillText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#334155' },
  pillTextActive: { color: '#FFFFFF' },
  empty: { alignItems: 'center', paddingVertical: 22, gap: 6 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#1E293B', textAlign: 'center' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center' },
  row: { borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FCFDFE', borderRadius: 12, padding: 12, gap: 10 },
  rowTop: { flexDirection: 'row', gap: 10 },
  quoteLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  quoteTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A', flexShrink: 1 },
  versionTag: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#334155', backgroundColor: '#F1F5F9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  primaryTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  primaryText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#047857' },
  vendorName: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1E293B', marginTop: 2 },
  meta: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B' },
  rowActions: { alignItems: 'flex-end', gap: 8 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  viewText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#1D4ED8' },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: '#FFF1F2' },
  docLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  docChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, maxWidth: '100%' },
  docChipMain: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  docChipText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#334155', flexShrink: 1 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  uploadText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#334155' },
  dashedBox: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 10, padding: 12, alignItems: 'center', backgroundColor: '#F8FAFC' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10 },
  fileMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 11 },
  primaryBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

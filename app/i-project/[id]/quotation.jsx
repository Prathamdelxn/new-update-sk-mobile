// =============================================================================
// Interior project — Commercial Quotations & Proposals
// Mobile version of the web InteriorProjectQuotationView: every quotation of the
// CRM lead this project was converted from, with View (document preview, print,
// PDF, send to client / vendor), Edit, Delete and Create.
// =============================================================================

import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import interiorApiClient from '../../services/interiorApiClient';
import { interiorCrmService } from '../../services/interiorCrmService';
import { useToast } from '../../context/ToastContext';
import { useInteriorPermissions } from '../../utils/interior/useInteriorPermissions';
import { formatCompactCurrency, formatExactCurrency } from '../../utils/format';
import QuotationBuilderModal from '../../components/crm/QuotationBuilderModal';
import QuotationPreviewModal from '../../components/interior/QuotationPreviewModal';

const STATUS_STYLE = {
  Accepted: { bg: '#ECFDF5', border: '#A7F3D0', color: '#047857' },
  Approved: { bg: '#ECFDF5', border: '#A7F3D0', color: '#047857' },
  Rejected: { bg: '#FFF1F2', border: '#FECDD3', color: '#BE123C' },
  Sent: { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8' },
  Generated: { bg: '#EEF2FF', border: '#C7D2FE', color: '#4338CA' },
  Draft: { bg: '#FFFBEB', border: '#FDE68A', color: '#B45309' },
};
const statusStyle = (st) => STATUS_STYLE[st] || { bg: '#F1F5F9', border: '#E2E8F0', color: '#334155' };

const linkedProjectId = (c) =>
  typeof c?.linkedProject === 'object' && c.linkedProject?._id ? String(c.linkedProject._id) : String(c?.linkedProject || '');

export default function InteriorProjectQuotationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { id: projectId } = useLocalSearchParams();
  const { hasPermission: canDo } = useInteriorPermissions();

  const [project, setProject] = useState(null);
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      let projectData = null;
      try {
        const prj = await interiorApiClient.get(`/projects/${projectId}`);
        projectData = prj?.data?.data || prj?.data || null;
        setProject(projectData);
      } catch {
        // project details are only used for the target budget
      }

      const res = await interiorApiClient.get('/crm/customers');
      const customers = res?.success && res?.data ? res.data : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const matched = customers.find((c) => c.linkedProject && linkedProjectId(c) === String(projectId));

      // Same fallback as the web when the project wasn't converted from a lead
      setLead(
        matched || {
          _id: `proj-${projectId}`,
          name: projectData?.client || projectData?.name || 'Project Client',
          email: projectData?.email || '',
          quotations: projectData?.quotations || [],
          boqs: projectData?.boqs || [],
          linkedProject: projectId,
          isSynthetic: true,
        }
      );
    } catch (e) {
      showToast(e?.message || 'Failed to load quotations', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const quotations = useMemo(() => lead?.quotations || [], [lead]);
  const hasQuotations = quotations.length > 0;
  const latestQuote = hasQuotations ? quotations[quotations.length - 1] : null;
  const hasAccepted = quotations.some((q) => q.status === 'Accepted' || q.status === 'Approved');
  const latestRejected = latestQuote?.status === 'Rejected';
  const currency = lead?.currency || project?.budget?.currency || 'INR';

  // Edits need a real CRM lead to save to
  const canSave = !lead?.isSynthetic;
  const canCreate = canDo('crm_quotations', 'create') && canSave;
  const canUpdate = canDo('crm_quotations', 'update') && canSave;
  const canDelete = canDo('crm_quotations', 'delete') && canSave;
  const canSend = canDo('crm_quotations', 'update') && canSave;

  const openCreate = () => { setEditingIndex(null); setBuilderOpen(true); };
  const openEdit = (idx) => { setEditingIndex(idx); setBuilderOpen(true); };

  const confirmDelete = (idx) => {
    const q = quotations[idx];
    const title = q?.title || `Quotation ${idx + 1}`;
    Alert.alert('Delete Quotation', `Delete "${title}" (v${q?.version || idx + 1})? This action cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Quotation',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = quotations.filter((_, i) => i !== idx);
            await interiorCrmService.updateCustomer(lead._id, { quotations: updated });
            setLead((prev) => ({ ...prev, quotations: updated }));
            showToast(`Quotation "${title}" deleted successfully.`, 'success');
          } catch (e) {
            showToast(e?.message || 'Failed to delete quotation', 'error');
          }
        },
      },
    ]);
  };

  const badge = hasQuotations
    ? latestRejected ? statusStyle('Rejected') : hasAccepted ? statusStyle('Accepted') : statusStyle('Sent')
    : statusStyle('Draft');
  const targetBudget = project?.budget?.amount
    ? formatCompactCurrency(project.budget.amount, currency)
    : lead?.budgetRange || 'Not specified';

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Commercial Quotations & Proposals</Text>
            <Text style={s.headerSub} numberOfLines={2}>Generate commercial proposals, apply taxes, discounts and manage client approvals.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#2563EB" />}
          >
            {/* Summary card */}
            <View style={s.summaryCard}>
              <View style={s.summaryTop}>
                <View style={[s.statusPill, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                  <View style={[s.dot, { backgroundColor: badge.color }]} />
                  <Text style={[s.statusPillText, { color: badge.color }]}>
                    {hasQuotations ? `${quotations.length} ${quotations.length === 1 ? 'Proposal' : 'Proposals'} Generated` : 'Pending Creation'}
                  </Text>
                </View>
                {canCreate && (
                  <TouchableOpacity style={s.createBtn} onPress={openCreate} activeOpacity={0.85}>
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={s.createBtnText}>Create Quotation</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={s.kpiGrid}>
                <Kpi label="Grand Total" value={latestQuote ? formatExactCurrency(Number(latestQuote.grandTotal) || 0, currency) : '—'} accent />
                <Kpi label="Breakdown" value={latestQuote ? `${latestQuote.taxPercentage || 0}% Tax • ${(latestQuote.items || []).length} Items` : 'No items'} />
                <Kpi label="Latest Status" value={latestQuote?.status || (hasQuotations ? 'Generated' : 'Pending')} />
                <Kpi label="Target Budget" value={targetBudget} />
              </View>
            </View>

            {!hasQuotations ? (
              <View style={s.emptyCard}>
                <View style={s.emptyIcon}>
                  <Ionicons name="document-text-outline" size={26} color="#2563EB" />
                </View>
                <Text style={s.emptyTitle}>No Quotations Created Yet</Text>
                <Text style={s.emptySub}>Generate itemized pricing proposals directly from project BOQ estimation, apply custom discounts and taxes.</Text>
                {canCreate && (
                  <TouchableOpacity style={[s.createBtn, { marginTop: 6 }]} onPress={openCreate} activeOpacity={0.85}>
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={s.createBtnText}>Create First Quotation</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <View style={s.listHeader}>
                  <Text style={s.listTitle}>Quotation Versions & Options</Text>
                  <View style={s.countPill}><Text style={s.countPillText}>{quotations.length}</Text></View>
                </View>
                <Text style={s.listHint}>Tap “View” to see the document, print, download the PDF or send it.</Text>

                {quotations.map((q, idx) => {
                  const st = q.status || 'Generated';
                  const sty = statusStyle(st);
                  const itemCount = (q.items || []).length;
                  const discount = Number(q.discountAmount || q.discount || 0);
                  return (
                    <TouchableOpacity key={q._id || idx} style={s.quoteCard} activeOpacity={0.85} onPress={() => setPreviewIndex(idx)}>
                      <View style={s.quoteTop}>
                        <View style={s.indexBox}><Text style={s.indexText}>{idx + 1}</Text></View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.quoteTitle} numberOfLines={1}>{q.title || `Quotation ${idx + 1}`}</Text>
                          <Text style={s.quoteMeta} numberOfLines={1}>
                            Version {q.version || idx + 1}
                            {q.sourceBoqVersion ? ` • BOQ v${q.sourceBoqVersion}` : ''}
                            {Array.isArray(q.vendorQuotes) && q.vendorQuotes.length > 0
                              ? ` • ${q.vendorQuotes.length} Vendor ${q.vendorQuotes.length === 1 ? 'Quote' : 'Quotes'}`
                              : ''}
                          </Text>
                        </View>
                        <View style={[s.statusTag, { backgroundColor: sty.bg, borderColor: sty.border }]}>
                          <Text style={[s.statusTagText, { color: sty.color }]}>{st}</Text>
                        </View>
                      </View>

                      <View style={s.figures}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.figLabel}>Scope</Text>
                          <Text style={s.figValue}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
                        </View>
                        <View style={{ flex: 1.4 }}>
                          <Text style={s.figLabel}>Subtotal & Tax</Text>
                          <Text style={s.figValue}>{formatExactCurrency(Number(q.subtotal || q.subTotal || 0), currency)}</Text>
                          <Text style={s.figSub}>
                            Tax: {q.taxPercentage || 0}%
                            {discount > 0 ? <Text style={{ color: '#059669' }}> • Disc: {formatExactCurrency(discount, currency)}</Text> : null}
                          </Text>
                        </View>
                        <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                          <Text style={s.figLabel}>Grand Total</Text>
                          <Text style={s.grandValue}>{formatExactCurrency(Number(q.grandTotal) || 0, currency)}</Text>
                        </View>
                      </View>

                      <View style={s.actionsRow}>
                        <TouchableOpacity style={s.viewBtn} onPress={() => setPreviewIndex(idx)}>
                          <Ionicons name="eye-outline" size={14} color="#1D4ED8" />
                          <Text style={s.viewBtnText}>View</Text>
                        </TouchableOpacity>
                        {canUpdate && (
                          <TouchableOpacity style={s.editBtn} onPress={() => openEdit(idx)}>
                            <Ionicons name="create-outline" size={14} color="#334155" />
                            <Text style={s.editBtnText}>Edit</Text>
                          </TouchableOpacity>
                        )}
                        {canDelete && (
                          <TouchableOpacity style={s.deleteBtn} onPress={() => confirmDelete(idx)}>
                            <Ionicons name="trash-outline" size={14} color="#E11D48" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Document preview: print / PDF / send to client or vendor */}
      <QuotationPreviewModal
        visible={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        lead={lead}
        quotationIndex={previewIndex}
        canSend={canSend}
        canExport
        onSent={() => load()}
      />

      {/* Create / edit */}
      {(canCreate || canUpdate) && (
        <QuotationBuilderModal
          visible={builderOpen}
          onClose={() => { setBuilderOpen(false); setEditingIndex(null); }}
          customerId={lead?._id}
          existingQuotations={quotations}
          existingBoqs={lead?.boqs || project?.boqs || []}
          editingQuoteIndex={editingIndex}
          budgetRange={lead?.budgetRange || lead?.estimatedBudget || lead?.budget}
          onSuccess={() => {
            showToast('Quotation saved successfully!', 'success');
            load();
          }}
        />
      )}
    </View>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, accent && { color: '#2563EB' }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 15.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, gap: 12 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontFamily: 'Inter-Bold' },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  createBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { flexBasis: '48%', flexGrow: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 10 },
  kpiLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValue: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 4 },

  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 24, alignItems: 'center', gap: 8 },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 14.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center', lineHeight: 18 },

  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  listTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  countPill: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  countPillText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#2563EB' },
  listHint: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: -6 },

  quoteCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, gap: 12 },
  quoteTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  indexBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  indexText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#475569' },
  quoteTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  quoteMeta: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  statusTag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusTagText: { fontSize: 9.5, fontFamily: 'Inter-Bold', textTransform: 'uppercase', letterSpacing: 0.4 },

  figures: { flexDirection: 'row', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10 },
  figLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 },
  figValue: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginTop: 3 },
  figSub: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },
  grandValue: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#2563EB', marginTop: 3 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#3B82F6', backgroundColor: '#FFFFFF' },
  viewBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#1D4ED8' },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  editBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#334155' },
  deleteBtn: { width: 40, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#FECDD3', backgroundColor: '#FFF1F2' },
});

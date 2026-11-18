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
import { formatCompactCurrency, formatSmartCurrency, getCurrencySymbol } from '../../utils/format';
import QuotationBuilderModal from '../../components/crm/QuotationBuilderModal';
import QuotationPreviewModal from '../../components/interior/QuotationPreviewModal';
import SkeletonList from '../../components/common/SkeletonList';

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
      // Project + its linked lead in parallel (web: getProjectConfirmOrder). The confirm-order
      // endpoint only needs project access, so it works for users without CRM rights.
      const [prjResult, orderResult] = await Promise.allSettled([
        interiorApiClient.get(`/projects/${projectId}`),
        interiorApiClient.get(`/projects/${projectId}/confirm-order`),
      ]);
      const projectData = prjResult.status === 'fulfilled' ? prjResult.value?.data?.data || prjResult.value?.data || null : null;
      setProject(projectData);

      let matched = orderResult.status === 'fulfilled' ? orderResult.value?.data || null : null;
      if (!matched) {
        // Fallback: search the CRM list (needs CRM access)
        try {
          const res = await interiorApiClient.get('/crm/customers');
          const customers = res?.success && res?.data ? res.data : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          matched = customers.find((c) => c.linkedProject && linkedProjectId(c) === String(projectId)) || null;
        } catch {
          matched = null;
        }
      }

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
  const currency = lead?.currency || project?.budget?.currency || 'INR';
  const smart = (n) => formatSmartCurrency(Number(n) || 0, getCurrencySymbol(currency));

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
    const displayTitle = title.length > 50 ? `${title.slice(0, 50)}...` : title;
    Alert.alert('Delete Quotation', `Are you sure you want to delete "${displayTitle}" (v${q?.version || idx + 1})? This action cannot be undone.`, [
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

  const targetBudget = project?.budget?.amount
    ? formatCompactCurrency(project.budget.amount, currency)
    : lead?.budgetRange || 'Not specified';

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Commercial Quotations & Proposals</Text>
          </View>
        </View>

        {loading ? (
          <SkeletonList />
        ) : (
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#2563EB" />}
          >
            {/* Summary card */}
            <View style={s.summaryCard}>
              <View style={s.kpiGrid}>
                <Kpi
                  label="Grand Total"
                  value={latestQuote ? smart(latestQuote.grandTotal).display : '—'}
                  sub={latestQuote && smart(latestQuote.grandTotal).isLarge ? `(${smart(latestQuote.grandTotal).exact})` : null}
                  accent
                />
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
                  <View style={{ flex: 1 }} />
                  {canCreate && (
                    <TouchableOpacity style={s.createBtn} onPress={openCreate} activeOpacity={0.85}>
                      <Ionicons name="add" size={15} color="#FFFFFF" />
                      <Text style={s.createBtnText}>Create</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {quotations.map((q, idx) => {
                  const st = q.status || 'Generated';
                  const sty = statusStyle(st);
                  const itemCount = (q.items || []).length;
                  const discount = Number(q.discountAmount || q.discount || 0);
                  return (
                    <TouchableOpacity key={q._id || idx} style={s.quoteCard} activeOpacity={0.85} onPress={() => setPreviewIndex(idx)}>
                      {/* Name + status */}
                      <View style={s.quoteTop}>
                        <Text style={s.quoteTitle} numberOfLines={2}>{q.title || `Quotation ${idx + 1}`}</Text>
                        <View style={[s.statusTag, { backgroundColor: sty.bg }]}>
                          <Text style={[s.statusTagText, { color: sty.color }]}>{st}</Text>
                        </View>
                      </View>
                      <Text style={s.quoteMeta} numberOfLines={1}>
                        {[
                          `v${q.version || idx + 1}`,
                          q.sourceBoqVersion ? `BOQ v${q.sourceBoqVersion}` : null,
                          `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`,
                          Array.isArray(q.vendorQuotes) && q.vendorQuotes.length > 0
                            ? `${q.vendorQuotes.length} vendor ${q.vendorQuotes.length === 1 ? 'quote' : 'quotes'}`
                            : null,
                        ].filter(Boolean).join(' · ')}
                      </Text>

                      {/* Three equal figures */}
                      <View style={s.figRow}>
                        <View style={s.figCol}>
                          <Text style={s.figLabel}>Subtotal</Text>
                          <Text style={s.figValue} numberOfLines={1}>{smart(q.subtotal || q.subTotal).display}</Text>
                        </View>
                        <View style={[s.figCol, { alignItems: 'center' }]}>
                          <Text style={s.figLabel}>{discount > 0 ? 'Discount' : 'Tax'}</Text>
                          <Text style={[s.figValue, discount > 0 && { color: '#059669' }]} numberOfLines={1}>
                            {discount > 0 ? `- ${smart(discount).display}` : `${q.taxPercentage || 0}%`}
                          </Text>
                        </View>
                        <View style={[s.figCol, { alignItems: 'flex-end' }]}>
                          <Text style={s.figLabel}>Grand total</Text>
                          <Text style={[s.figValue, { color: '#2563EB', fontFamily: 'Inter-Bold' }]} numberOfLines={1}>{smart(q.grandTotal).display}</Text>
                        </View>
                      </View>

                      {/* Actions: two equal buttons + delete */}
                      <View style={s.actionsRow}>
                        <TouchableOpacity style={[s.actBtn, s.viewBtn]} onPress={() => setPreviewIndex(idx)}>
                          <Ionicons name="eye-outline" size={15} color="#1D4ED8" />
                          <Text style={s.viewBtnText}>View</Text>
                        </TouchableOpacity>
                        {canUpdate && (
                          <TouchableOpacity style={[s.actBtn, s.editBtn]} onPress={() => openEdit(idx)}>
                            <Ionicons name="create-outline" size={15} color="#334155" />
                            <Text style={s.editBtnText}>Edit</Text>
                          </TouchableOpacity>
                        )}
                        {canDelete && (
                          <TouchableOpacity style={s.deleteBtn} onPress={() => confirmDelete(idx)}>
                            <Ionicons name="trash-outline" size={15} color="#E11D48" />
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

function Kpi({ label, value, sub, accent }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, accent && { color: '#2563EB' }]} numberOfLines={1}>{value}</Text>
      {!!sub && <Text style={{ fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8' }} numberOfLines={1}>{sub}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },

  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, gap: 12 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2563EB', paddingHorizontal: 12, height: 32, borderRadius: 9 },
  createBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { flexBasis: '48%', flexGrow: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 10 },
  kpiLabel: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValue: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 4 },

  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 24, alignItems: 'center', gap: 8 },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 14.5, fontFamily: 'Inter-Bold', color: '#0F172A' },

  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  listTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  countPill: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  countPillText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#2563EB' },

  quoteCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 14 },
  quoteTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  quoteTitle: { flex: 1, fontSize: 13.5, lineHeight: 18, fontFamily: 'Inter-Bold', color: '#0F172A' },
  quoteMeta: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 3 },
  statusTag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  statusTagText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold' },

  figRow: { flexDirection: 'row', marginTop: 12, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  figCol: { flex: 1, minWidth: 0 },
  figLabel: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  figValue: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginTop: 2 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 36, borderRadius: 9, borderWidth: 1 },
  viewBtn: { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  viewBtnText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1D4ED8' },
  editBtn: { borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  editBtnText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#334155' },
  deleteBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#FECDD3', backgroundColor: '#FFF1F2' },
});

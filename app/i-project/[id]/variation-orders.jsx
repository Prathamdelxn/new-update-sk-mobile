import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const VO_TYPES = [
  { value: 'addition', label: 'Addition' },
  { value: 'deletion', label: 'Deletion' },
  { value: 'replacement', label: 'Replacement' },
  { value: 'quantity_change', label: 'Quantity Change' },
];
const CATEGORIES = ['Civil', 'Electrical', 'Carpentry', 'Furniture', 'MEP', 'Landscape', 'Design'];
const TYPE_COLOR = { addition: '#059669', deletion: '#E11D48', replacement: '#2563EB', quantity_change: '#7C3AED' };
const STATUS_META = {
  approved: { color: '#16A34A', bg: '#F0FDF4' },
  executed: { color: '#16A34A', bg: '#F0FDF4' },
  rejected: { color: '#E11D48', bg: '#FFF1F2' },
  draft: { color: '#64748B', bg: '#F1F5F9' },
};

function fmtMoney(n) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

function computeMetrics(list) {
  const approved = list.filter((v) => v.status === 'approved' || v.status === 'executed');
  const pending = list.filter((v) => ['submitted', 'pm_review', 'commercial_review', 'management_approval', 'client_approval'].includes(v.status));
  const revenue = approved.reduce((sum, v) => sum + (v.financialSummary?.netDifference || 0), 0);
  const days = approved.reduce((sum, v) => sum + (v.impactAnalysis?.timelineImpactDays || 0), 0);
  return { total: list.length, approved: approved.length, pending: pending.length, revenue, days };
}

const emptyForm = { type: 'addition', category: 'Carpentry', description: '', materialCost: '0', laborCost: '0', vendorCost: '0', overheadCost: '0', timelineImpactDays: '0' };

function ImpactRow({ done, title, sub }) {
  return (
    <View style={s.impactRow}>
      <View style={[s.impactDot, done && { backgroundColor: '#10B981' }]}>
        {done && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.impactTitle}>{title}</Text>
        <Text style={s.impactSub}>{sub}</Text>
      </View>
    </View>
  );
}

export default function InteriorVariationOrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [vos, setVos] = useState([]);
  const [projectBudget, setProjectBudget] = useState(500000);
  const [loading, setLoading] = useState(true);
  const [detailVo, setDetailVo] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, voRes] = await Promise.allSettled([
        interiorApiClient.get(`/projects/${projectId}`),
        interiorApiClient.get(`/projects/${projectId}/variation-orders`),
      ]);
      if (projRes.status === 'fulfilled' && projRes.value?.success) {
        setProjectBudget(projRes.value.data?.budget?.amount || 500000);
      }
      const list = voRes.status === 'fulfilled' && voRes.value?.success ? voRes.value.data || [] : [];
      setVos(list);
    } catch (e) {
      console.error('Failed to load variation orders', e);
      showToast('Failed to load variation orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const metrics = computeMetrics(vos);

  const handleCreate = async () => {
    if (!form.description.trim()) return showToast('Please describe the scope of variation', 'error');
    setActionLoading(true);
    try {
      const materialCost = parseFloat(form.materialCost) || 0;
      const laborCost = parseFloat(form.laborCost) || 0;
      const vendorCost = parseFloat(form.vendorCost) || 0;
      const overheadCost = parseFloat(form.overheadCost) || 0;
      const totalDiff = materialCost + laborCost + vendorCost + overheadCost;
      await interiorApiClient.post(`/projects/${projectId}/variation-orders`, {
        type: form.type,
        category: form.category,
        description: form.description,
        impactAnalysis: { materialCost, laborCost, vendorCost, overheadCost, timelineImpactDays: parseInt(form.timelineImpactDays, 10) || 0 },
        financialSummary: { originalCost: projectBudget, variationCost: totalDiff, netDifference: totalDiff, revisedProjectCost: projectBudget + totalDiff },
      });
      showToast('Variation Order created successfully', 'success');
      setIsCreateOpen(false);
      setForm(emptyForm);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to create Variation Order', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const approveVo = async () => {
    if (!detailVo) return;
    setActionLoading(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/variation-orders/${detailVo._id}/approve`);
      showToast('Variation Order approved', 'success');
      setDetailVo(null);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to approve Variation Order', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Variation Order Dashboard</Text>
            <Text style={s.headerSub}>Approve design variations & cost margins.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.kpiGrid}>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>Total VOs</Text>
                <Text style={s.kpiValue}>{metrics.total}</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>Approved</Text>
                <Text style={[s.kpiValue, { color: '#16A34A' }]}>{metrics.approved}</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>Pending Review</Text>
                <Text style={[s.kpiValue, { color: '#D97706' }]}>{metrics.pending}</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>Timeline Delay</Text>
                <Text style={s.kpiValue}>+{metrics.days}d</Text>
              </View>
            </View>
            <View style={s.revenueCard}>
              <Text style={s.revenueLabel}>ADDITIONAL REVENUE GENERATED</Text>
              <Text style={s.revenueValue}>{fmtMoney(metrics.revenue)}</Text>
            </View>

            {vos.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="document-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No variation orders yet</Text>
              </View>
            ) : (
              vos.map((vo) => {
                const statusMeta = STATUS_META[vo.status] || { color: '#D97706', bg: '#FFFBEB' };
                return (
                  <TouchableOpacity key={vo._id} style={s.voCard} onPress={() => setDetailVo(vo)}>
                    <View style={s.voTopRow}>
                      <Text style={s.voNumber}>{vo.voNumber}</Text>
                      <View style={[s.statusBadge, { backgroundColor: statusMeta.bg }]}>
                        <Text style={[s.statusBadgeText, { color: statusMeta.color }]}>{String(vo.status).replace('_', ' ')}</Text>
                      </View>
                    </View>
                    <Text style={s.voDesc} numberOfLines={2}>{vo.description}</Text>
                    <View style={s.voBottomRow}>
                      <View style={[s.typeTag, { backgroundColor: (TYPE_COLOR[vo.type] || '#7C3AED') + '1A' }]}>
                        <Text style={[s.typeTagText, { color: TYPE_COLOR[vo.type] || '#7C3AED' }]}>{String(vo.type).replace('_', ' ')}</Text>
                      </View>
                      <Text style={s.voAmount}>{fmtMoney(vo.financialSummary?.netDifference)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        <TouchableOpacity style={s.fab} onPress={() => setIsCreateOpen(true)}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Create modal */}
      <Modal visible={isCreateOpen} animationType="slide" transparent onRequestClose={() => setIsCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Create Variation Order</Text>
              <TouchableOpacity onPress={() => setIsCreateOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>VO Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {VO_TYPES.map((t) => (
                  <TouchableOpacity key={t.value} style={[s.chip, form.type === t.value && s.chipActive]} onPress={() => setForm({ ...form, type: t.value })}>
                    <Text style={[s.chipText, form.type === t.value && s.chipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity key={c} style={[s.chip, form.category === c && s.chipActive]} onPress={() => setForm({ ...form, category: c })}>
                    <Text style={[s.chipText, form.category === c && s.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.label}>Scope of Variation Description *</Text>
              <TextInput style={[s.input, { height: 70, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Describe the scope changes and execution instructions..." placeholderTextColor="#94A3B8" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Material Cost (₹)</Text>
                  <TextInput style={s.input} keyboardType="numeric" value={form.materialCost} onChangeText={(v) => setForm({ ...form, materialCost: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Labor Cost (₹)</Text>
                  <TextInput style={s.input} keyboardType="numeric" value={form.laborCost} onChangeText={(v) => setForm({ ...form, laborCost: v })} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Vendor Cost (₹)</Text>
                  <TextInput style={s.input} keyboardType="numeric" value={form.vendorCost} onChangeText={(v) => setForm({ ...form, vendorCost: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Overhead Cost (₹)</Text>
                  <TextInput style={s.input} keyboardType="numeric" value={form.overheadCost} onChangeText={(v) => setForm({ ...form, overheadCost: v })} />
                </View>
              </View>

              <Text style={s.label}>Timeline Impact (Days Added)</Text>
              <TextInput style={s.input} keyboardType="numeric" value={form.timelineImpactDays} onChangeText={(v) => setForm({ ...form, timelineImpactDays: v })} />

              <TouchableOpacity style={[s.saveBtn, actionLoading && { opacity: 0.7 }]} onPress={handleCreate} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Create VO</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail modal */}
      <Modal visible={!!detailVo} animationType="slide" transparent onRequestClose={() => setDetailVo(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '90%' }]}>
            {detailVo && (
              <>
                <View style={s.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalTitle}>{detailVo.voNumber}</Text>
                    <Text style={s.headerSub}>Category: {detailVo.category}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetailVo(null)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={s.descBox}>
                    <Text style={s.sectionLabel}>SCOPE OF VARIATION</Text>
                    <Text style={s.descText}>{detailVo.description}</Text>
                  </View>

                  <Text style={s.sectionLabel}>FINANCIAL SUMMARY</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <View style={s.finCard}>
                      <Text style={s.finLabel}>ORIGINAL COST</Text>
                      <Text style={s.finValue}>{fmtMoney(detailVo.financialSummary?.originalCost)}</Text>
                    </View>
                    <View style={[s.finCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                      <Text style={[s.finLabel, { color: '#16A34A' }]}>NET DIFFERENCE</Text>
                      <Text style={[s.finValue, { color: '#16A34A' }]}>{fmtMoney(detailVo.financialSummary?.netDifference)}</Text>
                    </View>
                  </View>
                  <View style={[s.finCard, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE', marginBottom: 8 }]}>
                    <Text style={[s.finLabel, { color: '#2563EB' }]}>REVISED PROJECT COST</Text>
                    <Text style={[s.finValue, { color: '#2563EB' }]}>{fmtMoney(detailVo.financialSummary?.revisedProjectCost)}</Text>
                  </View>

                  <Text style={s.sectionLabel}>COST IMPACT ANALYSIS</Text>
                  <View style={s.impactGrid}>
                    <View style={s.impactCard}>
                      <Text style={s.impactCardLabel}>Material</Text>
                      <Text style={s.impactCardValue}>{fmtMoney(detailVo.impactAnalysis?.materialCost)}</Text>
                    </View>
                    <View style={s.impactCard}>
                      <Text style={s.impactCardLabel}>Labor</Text>
                      <Text style={s.impactCardValue}>{fmtMoney(detailVo.impactAnalysis?.laborCost)}</Text>
                    </View>
                    <View style={s.impactCard}>
                      <Text style={s.impactCardLabel}>Vendor</Text>
                      <Text style={s.impactCardValue}>{fmtMoney(detailVo.impactAnalysis?.vendorCost)}</Text>
                    </View>
                    <View style={s.impactCard}>
                      <Text style={s.impactCardLabel}>Overhead</Text>
                      <Text style={s.impactCardValue}>{fmtMoney(detailVo.impactAnalysis?.overheadCost)}</Text>
                    </View>
                  </View>

                  <Text style={s.sectionLabel}>AUTO-IMPACT SYSTEM ADJUSTMENTS</Text>
                  <View style={s.impactBox}>
                    <ImpactRow
                      done={detailVo.status === 'approved' || detailVo.status === 'executed'}
                      title="Project Budget Revised"
                      sub={detailVo.status === 'approved' || detailVo.status === 'executed' ? `Updated by +${fmtMoney(detailVo.financialSummary?.netDifference)}` : 'Awaiting approval...'}
                    />
                    <ImpactRow
                      done={detailVo.status === 'approved' || detailVo.status === 'executed'}
                      title="BOQ Line Items Appended"
                      sub={detailVo.status === 'approved' || detailVo.status === 'executed' ? `Added line item 'VO Item - ${detailVo.voNumber}'` : 'Awaiting approval...'}
                    />
                    <ImpactRow
                      done={detailVo.status === 'approved' || detailVo.status === 'executed'}
                      title="WBS Schedule Recalculated"
                      sub={detailVo.status === 'approved' || detailVo.status === 'executed' ? `Created task 'Execute VO: ${detailVo.voNumber}' (+${detailVo.impactAnalysis?.timelineImpactDays} days)` : 'Awaiting approval...'}
                    />
                    <ImpactRow
                      done={(detailVo.status === 'approved' || detailVo.status === 'executed') && detailVo.impactAnalysis?.materialCost > 0}
                      title="Procurement Requisitions Created"
                      sub={(detailVo.status === 'approved' || detailVo.status === 'executed') && detailVo.impactAnalysis?.materialCost > 0 ? `Created PO-VO-${detailVo.voNumber}` : 'No material adjustments required.'}
                    />
                    <ImpactRow
                      done={!!detailVo.billingGenerated}
                      title="Client Variation Billing Logs Updated"
                      sub={detailVo.billingGenerated ? `Invoice generated ${new Date(detailVo.billingGeneratedAt).toLocaleDateString('en-IN')}` : 'Awaiting execution approval...'}
                    />
                  </View>

                  {detailVo.status !== 'approved' && (
                    <TouchableOpacity style={[s.approveBtn, actionLoading && { opacity: 0.7 }]} onPress={approveVo} disabled={actionLoading}>
                      {actionLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                        <>
                          <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
                          <Text style={s.approveBtnText}>Approve & Run Auto Impact Updates</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  <View style={{ height: 20 }} />
                </ScrollView>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  kpiLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase' },
  kpiValue: { fontSize: 18, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 4 },

  revenueCard: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 14, padding: 14 },
  revenueLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#16A34A', letterSpacing: 0.3 },
  revenueValue: { fontSize: 20, fontFamily: 'Inter-Black', color: '#16A34A', marginTop: 4 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  voCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 8 },
  voTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voNumber: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', textTransform: 'capitalize' },
  voDesc: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#0F172A', lineHeight: 18 },
  voBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 8 },
  typeTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeTagText: { fontSize: 9, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
  voAmount: { fontSize: 12.5, fontFamily: 'Inter-Black', color: '#0F172A' },

  fab: {
    position: 'absolute', right: 20, bottom: 30,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B', textTransform: 'capitalize' },
  chipTextActive: { color: '#2563EB' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  descBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, marginBottom: 6 },
  sectionLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3, marginTop: 14, marginBottom: 8 },
  descText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#0F172A', lineHeight: 18 },

  finCard: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12 },
  finLabel: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#94A3B8' },
  finValue: { fontSize: 15, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 4 },

  impactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  impactCard: { width: '47%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 10 },
  impactCardLabel: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase' },
  impactCardValue: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2 },

  impactBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, gap: 8 },
  impactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 10, padding: 10 },
  impactDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  impactTitle: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  impactSub: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  approveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#059669', borderRadius: 14, paddingVertical: 14, marginTop: 16 },
  approveBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

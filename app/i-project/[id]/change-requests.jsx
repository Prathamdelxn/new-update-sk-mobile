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

const WORKFLOW_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'design_review', label: 'Design Review' },
  { key: 'pm_review', label: 'PM Review' },
  { key: 'commercial_review', label: 'Commercial Review' },
  { key: 'client_review', label: 'Client Review' },
  { key: 'approved', label: 'Approved' },
];
const NEXT_STEP = {
  draft: { next: 'submitted', label: 'Submit for Review' },
  submitted: { next: 'design_review', label: 'Move to Design Review' },
  design_review: { next: 'pm_review', label: 'Move to PM Review' },
  pm_review: { next: 'commercial_review', label: 'Move to Commercial Review' },
  commercial_review: { next: 'client_review', label: 'Move to Client Review' },
};
const STATUS_META = {
  approved: { color: '#16A34A', bg: '#F0FDF4' },
  rejected: { color: '#E11D48', bg: '#FFF1F2' },
  draft: { color: '#64748B', bg: '#F1F5F9' },
};
const PRIORITY_COLOR = { critical: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#64748B' };
const CATEGORIES = [
  { value: 'design', label: 'Design Change' },
  { value: 'material', label: 'Material Change' },
  { value: 'layout', label: 'Layout Change' },
  { value: 'mep', label: 'MEP Change' },
  { value: 'scope', label: 'Scope Change' },
  { value: 'other', label: 'Other' },
];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const emptyForm = { category: 'design', priority: 'medium', description: '', areaAffected: '', currentDesign: '', proposedDesign: '', reasonForChange: '' };

function statusMeta(status) {
  return STATUS_META[status] || { color: '#D97706', bg: '#FFFBEB' };
}

export default function InteriorChangeRequestsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [crs, setCrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailCr, setDetailCr] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchCrs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/change-requests`);
      setCrs(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load change requests', e);
      showToast('Failed to fetch change request list', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchCrs(); }, [fetchCrs]));

  const handleCreate = async () => {
    if (!form.description.trim()) return showToast('Please describe the change', 'error');
    setActionLoading(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/change-requests`, form);
      showToast('Change request created successfully!', 'success');
      setIsCreateOpen(false);
      setForm(emptyForm);
      fetchCrs();
    } catch (e) {
      showToast(e.message || 'Failed to create change request', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const updateStatus = async (newStatus) => {
    if (!detailCr) return;
    setActionLoading(true);
    try {
      const res = await interiorApiClient.put(`/projects/${projectId}/change-requests/${detailCr._id}`, { status: newStatus });
      if (res?.success) {
        setDetailCr(res.data);
        setCrs((prev) => prev.map((c) => (c._id === detailCr._id ? res.data : c)));
      }
    } catch (e) {
      showToast(e.message || 'Failed to update change request status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const approveAndGenerateVo = async () => {
    if (!detailCr) return;
    setActionLoading(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/change-requests/${detailCr._id}/approve`);
      showToast('Change request approved! Variation order generated.', 'success');
      setDetailCr(null);
      fetchCrs();
    } catch (e) {
      showToast(e.message || 'Failed to approve change request', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const nextStep = detailCr ? NEXT_STEP[detailCr.status] : null;

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Change Request Management</Text>
            <Text style={s.headerSub}>Evaluate & review project variations.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {crs.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="layers-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No change requests logged yet</Text>
              </View>
            ) : (
              crs.map((cr) => {
                const meta = statusMeta(cr.status);
                return (
                  <TouchableOpacity key={cr._id} style={s.crCard} onPress={() => setDetailCr(cr)}>
                    <View style={s.crTopRow}>
                      <Text style={s.crNumber}>{cr.crNumber}</Text>
                      <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
                        <Text style={[s.statusBadgeText, { color: meta.color }]}>{String(cr.status).replace('_', ' ')}</Text>
                      </View>
                    </View>
                    <Text style={s.crDesc} numberOfLines={2}>{cr.description}</Text>
                    <View style={s.crBottomRow}>
                      <Text style={s.crMeta}>{cr.category} · Priority: <Text style={{ fontFamily: 'Inter-Bold', color: '#0F172A' }}>{cr.priority}</Text></Text>
                      <Text style={s.crDate}>{new Date(cr.requestedDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</Text>
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

      {/* Create Modal */}
      <Modal visible={isCreateOpen} animationType="slide" transparent onRequestClose={() => setIsCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Create Change Request</Text>
              <TouchableOpacity onPress={() => setIsCreateOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity key={c.value} style={[s.chip, form.category === c.value && s.chipActive]} onPress={() => setForm({ ...form, category: c.value })}>
                    <Text style={[s.chipText, form.category === c.value && s.chipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.label}>Priority</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity key={p} style={[s.chip, form.priority === p && s.chipActive]} onPress={() => setForm({ ...form, priority: p })}>
                    <Text style={[s.chipText, form.priority === p && s.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Area Affected</Text>
              <TextInput style={s.input} placeholder="e.g. Master Bedroom, Kitchen Counter" placeholderTextColor="#94A3B8" value={form.areaAffected} onChangeText={(v) => setForm({ ...form, areaAffected: v })} />

              <Text style={s.label}>Description of Change *</Text>
              <TextInput style={[s.input, { height: 60, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Describe the requested change..." placeholderTextColor="#94A3B8" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline />

              <Text style={s.label}>Current Design / Material</Text>
              <TextInput style={[s.input, { height: 60, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Currently approved specifications..." placeholderTextColor="#94A3B8" value={form.currentDesign} onChangeText={(v) => setForm({ ...form, currentDesign: v })} multiline />

              <Text style={s.label}>Proposed Design / Material</Text>
              <TextInput style={[s.input, { height: 60, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Proposed alternative specifications..." placeholderTextColor="#94A3B8" value={form.proposedDesign} onChangeText={(v) => setForm({ ...form, proposedDesign: v })} multiline />

              <Text style={s.label}>Reason for Change</Text>
              <TextInput style={[s.input, { height: 60, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Why is this change necessary?" placeholderTextColor="#94A3B8" value={form.reasonForChange} onChangeText={(v) => setForm({ ...form, reasonForChange: v })} multiline />

              <TouchableOpacity style={[s.saveBtn, actionLoading && { opacity: 0.7 }]} onPress={handleCreate} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Create Request</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!detailCr} animationType="slide" transparent onRequestClose={() => setDetailCr(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '90%' }]}>
            {detailCr && (
              <>
                <View style={s.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={s.modalTitle}>{detailCr.crNumber}</Text>
                      <View style={[s.priorityDot, { backgroundColor: PRIORITY_COLOR[detailCr.priority] || '#64748B' }]}>
                        <Text style={s.priorityDotText}>{detailCr.priority}</Text>
                      </View>
                    </View>
                    <Text style={s.headerSub}>Requested by {detailCr.requestedBy?.firstName} {detailCr.requestedBy?.lastName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetailCr(null)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={s.sectionLabel}>APPROVAL WORKFLOW</Text>
                  <View style={s.workflowRow}>
                    {WORKFLOW_STEPS.map((step, idx) => {
                      const currentIdx = WORKFLOW_STEPS.findIndex((st) => st.key === detailCr.status);
                      const isCompleted = currentIdx >= idx || detailCr.status === 'approved';
                      const isActive = detailCr.status === step.key;
                      return (
                        <View key={step.key} style={s.workflowStep}>
                          <View style={[s.workflowDot, isCompleted && { backgroundColor: '#10B981' }, isActive && s.workflowDotActive]}>
                            {isCompleted && step.key !== detailCr.status ? (
                              <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                            ) : (
                              <Text style={s.workflowDotText}>{idx + 1}</Text>
                            )}
                          </View>
                          <Text style={[s.workflowLabel, isActive && { color: '#2563EB' }]} numberOfLines={2}>{step.label}</Text>
                        </View>
                      );
                    })}
                  </View>

                  <Text style={s.sectionLabel}>SCOPE & DESIGN CHANGES</Text>
                  <View style={s.scopeBox}>
                    <Text style={s.scopeLabel}>CURRENT APPROVED DESIGN</Text>
                    <Text style={s.scopeText}>{detailCr.currentDesign || 'No description provided.'}</Text>
                  </View>
                  <View style={[s.scopeBox, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
                    <Text style={[s.scopeLabel, { color: '#2563EB' }]}>PROPOSED VARIATION DESIGN</Text>
                    <Text style={s.scopeText}>{detailCr.proposedDesign || 'No description provided.'}</Text>
                  </View>

                  <Text style={s.sectionLabel}>DESCRIPTION OF CHANGE</Text>
                  <Text style={s.bodyText}>{detailCr.description}</Text>

                  <Text style={s.sectionLabel}>REASON FOR MODIFICATION</Text>
                  <Text style={s.bodyText}>{detailCr.reasonForChange || 'No reason specified.'}</Text>

                  {detailCr.status !== 'approved' && detailCr.status !== 'rejected' ? (
                    <View style={{ marginTop: 16, gap: 8 }}>
                      {nextStep && (
                        <TouchableOpacity style={s.workflowActionBtn} onPress={() => updateStatus(nextStep.next)} disabled={actionLoading}>
                          <Text style={s.workflowActionBtnText}>{nextStep.label}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[s.workflowActionBtn, { borderColor: '#FECDD3' }]} onPress={() => updateStatus('rejected')} disabled={actionLoading}>
                        <Text style={[s.workflowActionBtnText, { color: '#E11D48' }]}>Reject Request</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.approveBtn, actionLoading && { opacity: 0.7 }]} onPress={approveAndGenerateVo} disabled={actionLoading}>
                        {actionLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                          <>
                            <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
                            <Text style={s.approveBtnText}>Approve & Generate VO</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={s.resolvedRow}>
                      <Ionicons name={detailCr.status === 'approved' ? 'checkmark-circle' : 'close-circle'} size={16} color={detailCr.status === 'approved' ? '#16A34A' : '#E11D48'} />
                      <Text style={s.resolvedText}>
                        {detailCr.status === 'approved' ? 'This request was approved and generated a Variation Order.' : 'This request was rejected.'}
                      </Text>
                    </View>
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

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  crCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 8 },
  crTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  crNumber: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', textTransform: 'capitalize' },
  crDesc: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#0F172A', lineHeight: 18 },
  crBottomRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 8 },
  crMeta: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', textTransform: 'capitalize' },
  crDate: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },

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

  priorityDot: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  priorityDotText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#FFFFFF', textTransform: 'uppercase' },

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

  sectionLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3, marginTop: 14, marginBottom: 8 },

  workflowRow: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', padding: 10 },
  workflowStep: { flex: 1, alignItems: 'center', gap: 4 },
  workflowDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  workflowDotActive: { borderWidth: 2, borderColor: '#2563EB' },
  workflowDotText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#64748B' },
  workflowLabel: { fontSize: 7.5, fontFamily: 'Inter-SemiBold', color: '#94A3B8', textAlign: 'center' },

  scopeBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, marginBottom: 8 },
  scopeLabel: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3, marginBottom: 4 },
  scopeText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#0F172A', lineHeight: 18 },

  bodyText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#334155', lineHeight: 18 },

  workflowActionBtn: { paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  workflowActionBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#334155' },
  approveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#059669', borderRadius: 12, paddingVertical: 12 },
  approveBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  resolvedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12 },
  resolvedText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', flex: 1 },
});

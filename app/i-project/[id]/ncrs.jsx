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

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'investigation', label: 'Under Investigation' },
  { value: 'corrective_action', label: 'Corrective Action' },
  { value: 'verification', label: 'Verification Check' },
  { value: 'closed', label: 'Closed / Solved' },
];

const STATUS_META = {
  open: { color: '#DC2626', bg: '#FEF2F2' },
  investigation: { color: '#D97706', bg: '#FFFBEB' },
  corrective_action: { color: '#4F46E5', bg: '#EEF2FF' },
  verification: { color: '#4F46E5', bg: '#EEF2FF' },
  closed: { color: '#16A34A', bg: '#F0FDF4' },
};

const emptyForm = { description: '', rootCause: '', correctiveAction: '', status: 'open' };

export default function InteriorNcrsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [ncrs, setNcrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchNcrs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/ncrs`);
      setNcrs(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load NCRs', e);
      showToast('Failed to fetch Non-Conformance logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchNcrs(); }, [fetchNcrs]));

  const handleCreate = async () => {
    if (!form.description.trim()) {
      showToast('Description is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/ncrs`, form);
      showToast('Non-Conformance Report logged successfully!', 'success');
      setIsModalOpen(false);
      setForm(emptyForm);
      fetchNcrs();
    } catch (e) {
      showToast(e.message || 'Failed to log NCR', 'error');
    } finally {
      setSubmitting(false);
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
            <Text style={s.headerTitle}>Non-Conformance Reports</Text>
            <Text style={s.headerSub}>Record quality deviations & corrective workflows.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {ncrs.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="alert-circle-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No non-conformances logged</Text>
                <Text style={s.emptySub}>Tap "Log NCR" to register a quality deviation.</Text>
              </View>
            ) : (
              ncrs.map((ncr) => {
                const meta = STATUS_META[ncr.status] || STATUS_META.open;
                return (
                  <View key={ncr._id} style={s.ncrCard}>
                    <View style={s.ncrTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="document-text-outline" size={12} color="#64748B" />
                        <Text style={s.ncrNumber}>{ncr.ncrNumber}</Text>
                      </View>
                      <View style={[s.pill, { backgroundColor: meta.bg }]}>
                        <Text style={[s.pillText, { color: meta.color }]}>{String(ncr.status).replace('_', ' ')}</Text>
                      </View>
                    </View>

                    <Text style={s.ncrDesc}>{ncr.description}</Text>

                    {(!!ncr.rootCause || !!ncr.correctiveAction) && (
                      <View style={s.detailBox}>
                        {!!ncr.rootCause && (
                          <View style={{ marginBottom: ncr.correctiveAction ? 10 : 0 }}>
                            <Text style={s.detailLabel}>Investigated Root Cause:</Text>
                            <Text style={s.detailText}>{ncr.rootCause}</Text>
                          </View>
                        )}
                        {!!ncr.correctiveAction && (
                          <View>
                            <Text style={[s.detailLabel, { color: '#16A34A' }]}>Corrective Action Taken:</Text>
                            <Text style={s.detailText}>{ncr.correctiveAction}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        <TouchableOpacity style={s.fab} onPress={() => setIsModalOpen(true)}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Log Quality NCR</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Deviation Description *</Text>
              <TextInput style={s.input} placeholder="e.g. Concrete cube compression test failed target" placeholderTextColor="#94A3B8" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />

              <Text style={s.label}>Root Cause Investigation</Text>
              <TextInput style={s.input} placeholder="e.g. Excess water added in transit batch mix" placeholderTextColor="#94A3B8" value={form.rootCause} onChangeText={(v) => setForm({ ...form, rootCause: v })} />

              <Text style={s.label}>Corrective Action Plan</Text>
              <TextInput style={s.input} placeholder="e.g. Demolish grid core column and recast with audit" placeholderTextColor="#94A3B8" value={form.correctiveAction} onChangeText={(v) => setForm({ ...form, correctiveAction: v })} />

              <Text style={s.label}>Workflow Status</Text>
              <View style={{ gap: 6, marginBottom: 8 }}>
                {STATUSES.map((st) => (
                  <TouchableOpacity key={st.value} style={[s.statusOption, form.status === st.value && s.statusOptionActive]} onPress={() => setForm({ ...form, status: st.value })}>
                    <Text style={[s.statusOptionText, form.status === st.value && s.statusOptionTextActive]}>{st.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleCreate} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Log NCR</Text>}
              </TouchableOpacity>
            </ScrollView>
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
  emptySub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  ncrCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 10 },
  ncrTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ncrNumber: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 9.5, fontFamily: 'Inter-Bold', textTransform: 'capitalize' },
  ncrDesc: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },

  detailBox: { borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
  detailLabel: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  detailText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },

  fab: {
    position: 'absolute', right: 20, bottom: 30,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  statusOption: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  statusOptionActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  statusOptionText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  statusOptionTextActive: { color: '#2563EB' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

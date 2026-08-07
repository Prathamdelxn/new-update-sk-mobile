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

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const PRIORITY_META = {
  low: { color: '#2563EB', bg: '#EFF6FF' },
  medium: { color: '#2563EB', bg: '#EFF6FF' },
  high: { color: '#D97706', bg: '#FFFBEB' },
  critical: { color: '#DC2626', bg: '#FEF2F2' },
};
const STATUS_META = {
  open: { color: '#475569', bg: '#F8FAFC' },
  assigned: { color: '#475569', bg: '#F8FAFC' },
  in_progress: { color: '#475569', bg: '#F8FAFC' },
  resolved: { color: '#2563EB', bg: '#EFF6FF' },
  closed: { color: '#16A34A', bg: '#F0FDF4' },
};

function nextStatus(status) {
  if (status === 'resolved') return 'closed';
  if (status === 'open' || status === 'assigned' || status === 'in_progress') return 'resolved';
  return 'open';
}

function nextStatusLabel(status) {
  if (status === 'open' || status === 'assigned' || status === 'in_progress') return 'Mark Resolved';
  if (status === 'resolved') return 'Verify & Close';
  return 'Reopen Snag';
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const emptyForm = { description: '', location: '', priority: 'medium', dueDate: '' };

export default function InteriorSnagsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [snags, setSnags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchSnags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/snags`);
      setSnags(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load snags', e);
      showToast('Failed to fetch Snag registry', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchSnags(); }, [fetchSnags]));

  const handleCreate = async () => {
    if (!form.description.trim() || !form.location.trim()) {
      showToast('Please fill in description and location', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/snags`, {
        description: form.description,
        location: form.location,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
      });
      showToast('Snag logged successfully!', 'success');
      setIsModalOpen(false);
      setForm(emptyForm);
      fetchSnags();
    } catch (e) {
      showToast(e.message || 'Failed to log snag', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (snag) => {
    const status = nextStatus(snag.status);
    try {
      await interiorApiClient.put(`/projects/${projectId}/snags`, { snagId: snag._id, status });
      showToast(`Snag status updated to: ${status}`, 'success');
      fetchSnags();
    } catch (e) {
      showToast(e.message || 'Failed to update status', 'error');
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
            <Text style={s.headerTitle}>Quality Snag Register</Text>
            <Text style={s.headerSub}>Log site quality defects and track closeout verification.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {snags.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="bug-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No quality snags raised yet</Text>
                <Text style={s.emptySub}>Tap "Log Snag" to record a punch list item.</Text>
              </View>
            ) : (
              snags.map((snag) => {
                const priority = PRIORITY_META[snag.priority] || PRIORITY_META.medium;
                const status = STATUS_META[snag.status] || STATUS_META.open;
                return (
                  <View key={snag._id} style={s.snagCard}>
                    <View style={s.snagTopRow}>
                      <View style={s.locationRow}>
                        <Ionicons name="location-outline" size={13} color="#3B82F6" />
                        <Text style={s.locationText} numberOfLines={1}>{snag.location}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <View style={[s.pill, { backgroundColor: priority.bg }]}>
                          <Text style={[s.pillText, { color: priority.color }]}>{snag.priority}</Text>
                        </View>
                        <View style={[s.pill, { backgroundColor: status.bg }]}>
                          <Text style={[s.pillText, { color: status.color }]}>{snag.status}</Text>
                        </View>
                      </View>
                    </View>

                    <Text style={s.snagDesc}>{snag.description}</Text>

                    <View style={s.snagBottomRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
                        <Text style={s.dueText}>Due: {formatDate(snag.dueDate)}</Text>
                      </View>
                      <TouchableOpacity style={s.actionBtn} onPress={() => toggleStatus(snag)}>
                        <Text style={s.actionBtnText}>{nextStatusLabel(snag.status)}</Text>
                      </TouchableOpacity>
                    </View>
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
              <Text style={s.modalTitle}>Log Punch List Snag</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Defect Description *</Text>
              <TextInput style={s.input} placeholder="e.g. Scratched premium wall paint near main pantry" placeholderTextColor="#94A3B8" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />

              <Text style={s.label}>Defect Location / Area *</Text>
              <TextInput style={s.input} placeholder="e.g. Floor 4, Cafeteria Pantry Zone" placeholderTextColor="#94A3B8" value={form.location} onChangeText={(v) => setForm({ ...form, location: v })} />

              <Text style={s.label}>Priority</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity key={p} style={[s.chip, form.priority === p && s.chipActive]} onPress={() => setForm({ ...form, priority: p })}>
                    <Text style={[s.chipText, form.priority === p && s.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Target Resolve Date</Text>
              <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={form.dueDate} onChangeText={(v) => setForm({ ...form, dueDate: v })} />

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleCreate} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Log Snag</Text>}
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

  snagCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 10 },
  snagTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  locationText: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 9.5, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },

  snagDesc: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },

  snagBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
  dueText: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  actionBtnText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#334155' },

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

  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B', textTransform: 'capitalize' },
  chipTextActive: { color: '#2563EB' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

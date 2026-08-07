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
  responded: { color: '#2563EB', bg: '#EFF6FF' },
  closed: { color: '#16A34A', bg: '#F0FDF4' },
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const emptyForm = { subject: '', question: '', priority: 'medium', dueDate: '' };

export default function InteriorRfisScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [rfis, setRfis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [selectedRfi, setSelectedRfi] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchRfis = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/rfis`);
      setRfis(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load RFIs', e);
      showToast('Failed to fetch RFIs registry', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchRfis(); }, [fetchRfis]));

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.question.trim()) {
      showToast('Please fill in subject and question', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/rfis`, {
        subject: form.subject,
        question: form.question,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
      });
      showToast('RFI raised successfully!', 'success');
      setIsModalOpen(false);
      setForm(emptyForm);
      fetchRfis();
    } catch (e) {
      showToast(e.message || 'Failed to submit RFI', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const postResponse = async () => {
    if (!responseText.trim() || !selectedRfi) return;
    setPosting(true);
    try {
      await interiorApiClient.put(`/projects/${projectId}/rfis`, { rfiId: selectedRfi._id, response: responseText });
      showToast('Response posted successfully!', 'success');
      setResponseText('');
      setSelectedRfi(null);
      fetchRfis();
    } catch (e) {
      showToast(e.message || 'Failed to post response', 'error');
    } finally {
      setPosting(false);
    }
  };

  const closeRfi = async (rfi) => {
    try {
      await interiorApiClient.put(`/projects/${projectId}/rfis`, { rfiId: rfi._id, status: 'closed' });
      showToast('RFI closed and verified', 'success');
      setSelectedRfi(null);
      fetchRfis();
    } catch (e) {
      showToast(e.message || 'Failed to close RFI', 'error');
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
            <Text style={s.headerTitle}>Requests For Information</Text>
            <Text style={s.headerSub}>Clarify design/drawing discrepancies with consultants.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {rfis.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="chatbox-ellipses-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No RFIs raised yet</Text>
                <Text style={s.emptySub}>Tap "Raise RFI" to submit a question.</Text>
              </View>
            ) : (
              rfis.map((rfi) => {
                const priority = PRIORITY_META[rfi.priority] || PRIORITY_META.medium;
                const status = STATUS_META[rfi.status] || STATUS_META.open;
                return (
                  <TouchableOpacity key={rfi._id} style={s.rfiCard} onPress={() => setSelectedRfi(rfi)}>
                    <View style={s.rfiTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="chatbox-outline" size={12} color="#64748B" />
                        <Text style={s.rfiNumber}>{rfi.rfiNumber}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <View style={[s.pill, { backgroundColor: priority.bg }]}>
                          <Text style={[s.pillText, { color: priority.color }]}>{rfi.priority}</Text>
                        </View>
                        <View style={[s.pill, { backgroundColor: status.bg }]}>
                          <Text style={[s.pillText, { color: status.color }]}>{rfi.status}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={s.rfiSubject} numberOfLines={1}>{rfi.subject}</Text>
                    <Text style={s.rfiQuestion} numberOfLines={2}>{rfi.question}</Text>
                    <View style={s.rfiBottomRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="calendar-outline" size={12} color="#3B82F6" />
                        <Text style={s.dueText}>Due: {formatDate(rfi.dueDate)}</Text>
                      </View>
                      <Text style={s.viewThreadText}>View thread →</Text>
                    </View>
                  </TouchableOpacity>
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

      {/* Create RFI Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Raise Design RFI</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Subject Title *</Text>
              <TextInput style={s.input} placeholder="e.g. Glass partition core alignment" placeholderTextColor="#94A3B8" value={form.subject} onChangeText={(v) => setForm({ ...form, subject: v })} />

              <Text style={s.label}>Clarification Question *</Text>
              <TextInput
                style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                placeholder="Specify drawing discrepancy details..."
                placeholderTextColor="#94A3B8"
                value={form.question}
                onChangeText={(v) => setForm({ ...form, question: v })}
                multiline
              />

              <Text style={s.label}>Priority</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity key={p} style={[s.chip, form.priority === p && s.chipActive]} onPress={() => setForm({ ...form, priority: p })}>
                    <Text style={[s.chipText, form.priority === p && s.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Due Date</Text>
              <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={form.dueDate} onChangeText={(v) => setForm({ ...form, dueDate: v })} />

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleCreate} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Submit RFI</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* RFI Thread Modal */}
      <Modal visible={!!selectedRfi} animationType="slide" transparent onRequestClose={() => setSelectedRfi(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            {selectedRfi && (
              <>
                <View style={s.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rfiNumber}>{selectedRfi.rfiNumber}</Text>
                    <Text style={s.modalTitle} numberOfLines={1}>{selectedRfi.subject}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedRfi(null)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={s.label}>Question Description</Text>
                  <View style={s.questionBox}>
                    <Text style={s.questionText}>{selectedRfi.question}</Text>
                  </View>

                  {!!selectedRfi.response && (
                    <>
                      <Text style={s.label}>Latest Response</Text>
                      <View style={[s.questionBox, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
                        <Text style={s.questionText}>{selectedRfi.response}</Text>
                      </View>
                    </>
                  )}

                  {selectedRfi.status !== 'closed' && (
                    <>
                      <TouchableOpacity style={s.resolveBtn} onPress={() => closeRfi(selectedRfi)}>
                        <Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" />
                        <Text style={s.resolveBtnText}>Mark Resolved & Close</Text>
                      </TouchableOpacity>

                      <Text style={s.label}>Post a Response</Text>
                      <View style={s.responseRow}>
                        <TextInput
                          style={s.responseInput}
                          placeholder="Type consultant response or clarification note..."
                          placeholderTextColor="#94A3B8"
                          value={responseText}
                          onChangeText={setResponseText}
                        />
                        <TouchableOpacity style={s.postBtn} onPress={postResponse} disabled={posting}>
                          {posting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={16} color="#FFFFFF" />}
                        </TouchableOpacity>
                      </View>
                    </>
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
  emptySub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  rfiCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 8 },
  rfiTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rfiNumber: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 9.5, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
  rfiSubject: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  rfiQuestion: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', lineHeight: 17 },

  rfiBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
  dueText: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  viewThreadText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#2563EB' },

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

  questionBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12 },
  questionText: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#334155', lineHeight: 19 },

  resolveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 12, paddingVertical: 10, justifyContent: 'center', marginTop: 14 },
  resolveBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#16A34A' },

  responseRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  responseInput: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#0F172A' },
  postBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
});

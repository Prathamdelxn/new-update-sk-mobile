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

function fmt(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const emptyAction = { description: '', status: 'open' };

export default function InteriorMomScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [moms, setMoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [attendees, setAttendees] = useState('');
  const [agenda, setAgenda] = useState('');
  const [notes, setNotes] = useState('');
  const [actionItems, setActionItems] = useState([{ ...emptyAction }]);

  const fetchMoms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/mom`);
      setMoms(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load MOMs', e);
      showToast('Failed to fetch meeting minutes list', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchMoms(); }, [fetchMoms]));

  const addAction = () => setActionItems((p) => [...p, { ...emptyAction }]);
  const removeAction = (idx) => setActionItems((p) => p.filter((_, i) => i !== idx));
  const updateAction = (idx, val) => setActionItems((p) => p.map((a, i) => (i === idx ? { ...a, description: val } : a)));

  const resetForm = () => {
    setTitle(''); setDate(''); setAttendees(''); setAgenda(''); setNotes(''); setActionItems([{ ...emptyAction }]);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !agenda.trim() || !notes.trim()) {
      showToast('Please fill in title, agenda, and notes', 'error');
      return;
    }
    setCreating(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/mom`, {
        title,
        date: date || undefined,
        attendees: attendees.split(',').map((s) => s.trim()).filter(Boolean),
        agenda,
        notes,
        actionItems,
      });
      showToast('Meeting Minutes logged successfully!', 'success');
      setIsModalOpen(false);
      resetForm();
      fetchMoms();
    } catch (e) {
      showToast(e.message || 'Failed to log meeting minutes', 'error');
    } finally {
      setCreating(false);
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
            <Text style={s.headerTitle}>Minutes of Meeting</Text>
            <Text style={s.headerSub}>Consultant discussions & site action items.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {moms.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="clipboard-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No meeting records logged yet</Text>
              </View>
            ) : (
              moms.map((mom) => (
                <View key={mom._id} style={s.momCard}>
                  <View style={s.momHeader}>
                    <Ionicons name="clipboard-outline" size={16} color="#2563EB" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.momTitle}>{mom.title}</Text>
                      <Text style={s.momDate}>Held: {fmt(mom.date)}</Text>
                    </View>
                  </View>
                  {mom.attendees?.length > 0 && (
                    <Text style={s.attendeesText}>Attendees: <Text style={{ fontFamily: 'Inter-Bold', color: '#0F172A' }}>{mom.attendees.join(', ')}</Text></Text>
                  )}

                  <Text style={s.sectionTitle}>AGENDA</Text>
                  <Text style={s.bodyText}>{mom.agenda}</Text>

                  <Text style={s.sectionTitle}>DISCUSSION NOTES</Text>
                  <Text style={s.bodyText}>{mom.notes}</Text>

                  <Text style={s.sectionTitle}>ASSIGNED ACTION ITEMS</Text>
                  {(!mom.actionItems || mom.actionItems.length === 0) ? (
                    <Text style={s.emptyLine}>No action items logged.</Text>
                  ) : (
                    mom.actionItems.map((item, i) => (
                      <View key={i} style={s.actionRow}>
                        <Ionicons name="checkbox-outline" size={14} color="#16A34A" />
                        <Text style={s.actionText}>{item.description}</Text>
                      </View>
                    ))
                  )}
                </View>
              ))
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
              <Text style={s.modalTitle}>Log Minutes of Meeting</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Meeting Title *</Text>
              <TextInput style={s.input} placeholder="e.g. Weekly MEP Coordination" placeholderTextColor="#94A3B8" value={title} onChangeText={setTitle} />

              <Text style={s.label}>Meeting Date</Text>
              <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={date} onChangeText={setDate} />

              <Text style={s.label}>Attendees (comma-separated)</Text>
              <TextInput style={s.input} placeholder="e.g. Sameer PM, Consultant A" placeholderTextColor="#94A3B8" value={attendees} onChangeText={setAttendees} />

              <Text style={s.label}>Meeting Agenda *</Text>
              <TextInput style={[s.input, { height: 60, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Specify agenda topics..." placeholderTextColor="#94A3B8" value={agenda} onChangeText={setAgenda} multiline />

              <Text style={s.label}>Discussion Notes *</Text>
              <TextInput style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Specify key discussion outcomes..." placeholderTextColor="#94A3B8" value={notes} onChangeText={setNotes} multiline />

              <View style={s.sectionHeaderRow}>
                <Text style={s.formSectionLabel}>ACTION ITEMS</Text>
                <TouchableOpacity style={s.addRowBtn} onPress={addAction}>
                  <Text style={s.addRowBtnText}>+ Add Action</Text>
                </TouchableOpacity>
              </View>
              {actionItems.map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <TextInput style={[s.input, { flex: 1 }]} placeholder="Action item description..." placeholderTextColor="#94A3B8" value={item.description} onChangeText={(v) => updateAction(idx, v)} />
                  <TouchableOpacity onPress={() => removeAction(idx)} disabled={actionItems.length === 1} style={s.removeBtn}>
                    <Ionicons name="trash-outline" size={15} color={actionItems.length === 1 ? '#CBD5E1' : '#EF4444'} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={[s.saveBtn, creating && { opacity: 0.7 }]} onPress={handleSubmit} disabled={creating}>
                {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Save MOM</Text>}
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
  emptyLine: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  momCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  momHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', paddingBottom: 10, marginBottom: 8 },
  momTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  momDate: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  attendeesText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginBottom: 6 },

  sectionTitle: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3, marginTop: 8, marginBottom: 3 },
  bodyText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#334155', lineHeight: 18 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 4 },
  actionText: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#0F172A', flex: 1 },

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

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  formSectionLabel: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3 },
  addRowBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  addRowBtnText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#2563EB' },
  removeBtn: { width: 40, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

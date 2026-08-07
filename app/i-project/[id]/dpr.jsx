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

const WEATHER_OPTIONS = ['Sunny', 'Cloudy', 'Rainy', 'Heavy Wind'];

const emptyManpowerRow = { trade: 'Electrician', count: '2', contractor: 'Vendor A' };
const emptyActivityRow = { category: 'Wiring', description: 'Wall chasing and conduit installation', plannedProgress: '10', actualProgress: '10', remarks: '' };

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function InteriorDprScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [dprs, setDprs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [dprDate, setDprDate] = useState('');
  const [weather, setWeather] = useState('Sunny');
  const [manpower, setManpower] = useState([{ ...emptyManpowerRow }]);
  const [activities, setActivities] = useState([{ ...emptyActivityRow }]);

  const fetchDprs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/dpr`);
      setDprs(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load DPRs', e);
      showToast('Failed to fetch DPR history', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchDprs(); }, [fetchDprs]));

  const addManpowerRow = () => setManpower((p) => [...p, { trade: 'Painter', count: '2', contractor: 'Vendor B' }]);
  const removeManpowerRow = (idx) => setManpower((p) => p.filter((_, i) => i !== idx));
  const updateManpowerRow = (idx, field, val) => setManpower((p) => p.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  const addActivityRow = () => setActivities((p) => [...p, { category: 'Finishes', description: 'Wall plastering', plannedProgress: '20', actualProgress: '0', remarks: '' }]);
  const removeActivityRow = (idx) => setActivities((p) => p.filter((_, i) => i !== idx));
  const updateActivityRow = (idx, field, val) => setActivities((p) => p.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  const resetForm = () => {
    setDprDate('');
    setWeather('Sunny');
    setManpower([{ ...emptyManpowerRow }]);
    setActivities([{ ...emptyActivityRow }]);
  };

  const handleSubmit = async () => {
    if (!dprDate.trim()) {
      showToast('Please enter a date', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/dpr`, {
        date: dprDate,
        weather,
        manpower: manpower.map((m) => ({ ...m, count: parseInt(m.count, 10) || 0 })),
        activities: activities.map((a) => ({ ...a, plannedProgress: parseInt(a.plannedProgress, 10) || 0, actualProgress: parseInt(a.actualProgress, 10) || 0 })),
      });
      showToast('Daily Progress Report submitted successfully', 'success');
      setIsFormOpen(false);
      resetForm();
      fetchDprs();
    } catch (e) {
      showToast(e.message || 'Submission failed', 'error');
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
            <Text style={s.headerTitle}>Daily Progress Reports</Text>
            <Text style={s.headerSub}>Site logs, weather, manpower, task progress.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {dprs.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="document-text-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No DPRs recorded yet</Text>
                <Text style={s.emptySub}>Tap "Submit DPR" to register site updates.</Text>
              </View>
            ) : (
              dprs.map((dpr) => (
                <View key={dpr._id} style={s.dprCard}>
                  <View style={s.dprTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="calendar-outline" size={14} color="#2563EB" />
                      <Text style={s.dprDate}>{formatDate(dpr.date)}</Text>
                    </View>
                  </View>
                  <View style={s.dprMetaRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="partly-sunny-outline" size={13} color="#94A3B8" />
                      <Text style={s.dprMetaText}>{dpr.weather}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="people-outline" size={13} color="#94A3B8" />
                      <Text style={s.dprMetaText}>{dpr.manpower?.reduce((a, c) => a + c.count, 0) || 0} workers</Text>
                    </View>
                  </View>

                  <Text style={s.activitiesLabel}>SITE ACTIVITIES</Text>
                  {dpr.activities?.map((act, idx) => (
                    <View key={idx} style={s.activityCard}>
                      <View style={s.activityTopRow}>
                        <View style={s.categoryTag}>
                          <Text style={s.categoryTagText}>{act.category}</Text>
                        </View>
                        <Text style={s.activityProgress}>{act.actualProgress}% (Target: {act.plannedProgress}%)</Text>
                      </View>
                      <Text style={s.activityDesc}>{act.description}</Text>
                      {!!act.remarks && <Text style={s.activityRemarks}>Remarks: {act.remarks}</Text>}
                    </View>
                  ))}
                </View>
              ))
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        <TouchableOpacity style={s.fab} onPress={() => setIsFormOpen(true)}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      <Modal visible={isFormOpen} animationType="slide" transparent onRequestClose={() => setIsFormOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Log Daily Progress</Text>
              <TouchableOpacity onPress={() => setIsFormOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>DPR Date *</Text>
              <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={dprDate} onChangeText={setDprDate} />

              <Text style={s.label}>Weather Conditions</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {WEATHER_OPTIONS.map((w) => (
                  <TouchableOpacity key={w} style={[s.chip, weather === w && s.chipActive]} onPress={() => setWeather(w)}>
                    <Text style={[s.chipText, weather === w && s.chipTextActive]}>{w}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.sectionHeaderRow}>
                <Text style={s.sectionHeader}>MANPOWER REGISTRY</Text>
                <TouchableOpacity style={s.addRowBtn} onPress={addManpowerRow}>
                  <Text style={s.addRowBtnText}>+ Add Trade</Text>
                </TouchableOpacity>
              </View>
              {manpower.map((row, idx) => (
                <View key={idx} style={s.rowBox}>
                  <TextInput style={[s.input, { marginBottom: 6 }]} placeholder="Trade (e.g. Mason)" placeholderTextColor="#94A3B8" value={row.trade} onChangeText={(v) => updateManpowerRow(idx, 'trade', v)} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[s.input, { flex: 1 }]} placeholder="Count" placeholderTextColor="#94A3B8" keyboardType="numeric" value={row.count} onChangeText={(v) => updateManpowerRow(idx, 'count', v)} />
                    <TextInput style={[s.input, { flex: 2 }]} placeholder="Contractor Vendor" placeholderTextColor="#94A3B8" value={row.contractor} onChangeText={(v) => updateManpowerRow(idx, 'contractor', v)} />
                    <TouchableOpacity style={s.removeBtn} onPress={() => removeManpowerRow(idx)} disabled={manpower.length === 1}>
                      <Ionicons name="trash-outline" size={15} color={manpower.length === 1 ? '#CBD5E1' : '#EF4444'} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={s.sectionHeaderRow}>
                <Text style={s.sectionHeader}>WORK PROGRESS CHECKLIST</Text>
                <TouchableOpacity style={s.addRowBtn} onPress={addActivityRow}>
                  <Text style={s.addRowBtnText}>+ Add Activity</Text>
                </TouchableOpacity>
              </View>
              {activities.map((row, idx) => (
                <View key={idx} style={s.activityRowBox}>
                  <TouchableOpacity style={s.removeActivityBtn} onPress={() => removeActivityRow(idx)} disabled={activities.length === 1}>
                    <Ionicons name="close" size={14} color={activities.length === 1 ? '#CBD5E1' : '#EF4444'} />
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                    <TextInput style={[s.input, { flex: 2 }]} placeholder="Category (e.g. Electrical)" placeholderTextColor="#94A3B8" value={row.category} onChangeText={(v) => updateActivityRow(idx, 'category', v)} />
                    <TextInput style={[s.input, { flex: 1 }]} placeholder="Actual %" placeholderTextColor="#94A3B8" keyboardType="numeric" value={row.actualProgress} onChangeText={(v) => updateActivityRow(idx, 'actualProgress', v)} />
                  </View>
                  <TextInput style={[s.input, { marginBottom: 6 }]} placeholder="Task Description..." placeholderTextColor="#94A3B8" value={row.description} onChangeText={(v) => updateActivityRow(idx, 'description', v)} />
                  <TextInput style={s.input} placeholder="Remarks / Blockers..." placeholderTextColor="#94A3B8" value={row.remarks} onChangeText={(v) => updateActivityRow(idx, 'remarks', v)} />
                </View>
              ))}

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Submit Log</Text>}
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

  dprCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 10 },
  dprTopRow: { borderBottomWidth: 1, borderBottomColor: '#F8FAFC', paddingBottom: 8 },
  dprDate: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  dprMetaRow: { flexDirection: 'row', gap: 14 },
  dprMetaText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B' },

  activitiesLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3, marginTop: 4 },
  activityCard: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, gap: 4 },
  activityTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  categoryTag: { backgroundColor: '#EFF6FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  categoryTagText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#2563EB', textTransform: 'uppercase' },
  activityProgress: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#16A34A' },
  activityDesc: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  activityRemarks: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', fontStyle: 'italic' },

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
  chipText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  chipTextActive: { color: '#2563EB' },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  sectionHeader: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3 },
  addRowBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  addRowBtnText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#2563EB' },

  rowBox: { marginBottom: 10 },
  removeBtn: { width: 40, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },

  activityRowBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, marginBottom: 10 },
  removeActivityBtn: { alignSelf: 'flex-end', marginBottom: 4 },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

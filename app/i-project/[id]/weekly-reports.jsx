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
  return new Date(d).toLocaleDateString('en-IN');
}

function ListSection({ icon, color, title, items, emptyText }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <Ionicons name={icon} size={13} color={color} />
        <Text style={[s.sectionTitle, { color }]}>{title}</Text>
      </View>
      {(!items || items.length === 0) ? (
        <Text style={s.emptyLine}>{emptyText}</Text>
      ) : (
        items.map((item, i) => (
          <View key={i} style={s.bulletRow}>
            <Text style={s.bulletDot}>•</Text>
            <Text style={s.bulletText}>{item}</Text>
          </View>
        ))
      )}
    </View>
  );
}

export default function InteriorWeeklyReportsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/weekly-reports`);
      setReports(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load reports', e);
      showToast('Failed to fetch weekly report list', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchReports(); }, [fetchReports]));

  const handleGenerate = async () => {
    if (!startDate.trim() || !endDate.trim()) {
      showToast('Please specify both start and end dates', 'error');
      return;
    }
    setGenerating(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/weekly-reports`, { weekStart: startDate, weekEnd: endDate });
      showToast('Weekly Report generated successfully!', 'success');
      setIsModalOpen(false);
      setStartDate('');
      setEndDate('');
      fetchReports();
    } catch (e) {
      showToast(e.message || 'Failed to generate report', 'error');
    } finally {
      setGenerating(false);
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
            <Text style={s.headerTitle}>Weekly Progress Reports</Text>
            <Text style={s.headerSub}>Auto-generated summaries, delays, risks & plans.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {reports.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="document-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No weekly reports generated yet</Text>
              </View>
            ) : (
              reports.map((report) => (
                <View key={report._id} style={s.reportCard}>
                  <View style={s.reportHeader}>
                    <Ionicons name="document-text-outline" size={15} color="#2563EB" />
                    <Text style={s.reportHeaderText}>{fmt(report.weekStart)} – {fmt(report.weekEnd)}</Text>
                  </View>
                  <ListSection icon="checkmark-circle-outline" color="#16A34A" title="COMPLETED ACTIVITIES" items={report.completedActivities} emptyText="No activities completed this period." />
                  <ListSection icon="time-outline" color="#DC2626" title="DELAYED MILESTONES / TASKS" items={report.delayedActivities} emptyText="Zero delays logged. On track!" />
                  <ListSection icon="alert-outline" color="#D97706" title="IDENTIFIED RISKS" items={report.risks} emptyText="No critical risks flagged." />
                  <ListSection icon="calendar-outline" color="#2563EB" title="NEXT WEEK PLANNED SCOPE" items={report.nextWeekPlan} emptyText="No plan defined." />
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
              <Text style={s.modalTitle}>Auto-compile Weekly Report</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={s.hintText}>Select a weekly boundary. The system scans completed tasks, delay logs, and risks in this interval.</Text>

            <Text style={s.label}>Start Date *</Text>
            <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={startDate} onChangeText={setStartDate} />
            <Text style={s.label}>End Date *</Text>
            <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={endDate} onChangeText={setEndDate} />

            <TouchableOpacity style={[s.saveBtn, generating && { opacity: 0.7 }]} onPress={handleGenerate} disabled={generating}>
              {generating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Compile Report</Text>}
            </TouchableOpacity>
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

  reportCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', paddingBottom: 10, marginBottom: 10 },
  reportHeaderText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A' },

  sectionTitle: { fontSize: 9.5, fontFamily: 'Inter-Bold', letterSpacing: 0.3 },
  emptyLine: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  bulletRow: { flexDirection: 'row', gap: 5, marginBottom: 2 },
  bulletDot: { fontSize: 12, color: '#94A3B8' },
  bulletText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#334155', flex: 1 },

  fab: {
    position: 'absolute', right: 20, bottom: 30,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  hintText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginBottom: 6 },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

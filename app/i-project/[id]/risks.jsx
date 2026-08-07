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

const CATEGORIES = [
  { value: 'design', label: 'Design Mismatch' },
  { value: 'procurement', label: 'Procurement & Sourcing' },
  { value: 'site_execution', label: 'Site Execution Blocker' },
  { value: 'client', label: 'Client Change Request' },
  { value: 'vendor', label: 'Vendor Compliance' },
];
const LEVELS = [
  { value: 'low', label: 'Low (1)' },
  { value: 'medium', label: 'Medium (2)' },
  { value: 'high', label: 'High (3)' },
];

function scoreColor(score) {
  if (score >= 6) return { color: '#DC2626', bg: '#FEF2F2' };
  if (score >= 3) return { color: '#D97706', bg: '#FFFBEB' };
  return { color: '#16A34A', bg: '#F0FDF4' };
}

function heatCellColor(p, i) {
  if (p === 'high' && i === 'high') return '#EF4444';
  if ((p === 'high' && i === 'medium') || (p === 'medium' && i === 'high')) return '#F87171';
  if ((p === 'high' && i === 'low') || (p === 'medium' && i === 'medium') || (p === 'low' && i === 'high')) return '#FBBF24';
  return '#86EFAC';
}

const emptyForm = { description: '', category: 'site_execution', probability: 'medium', impact: 'medium', mitigationPlan: '' };

export default function InteriorRisksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchRisks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/risks`);
      setRisks(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load risks', e);
      showToast('Failed to fetch Risk Register', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchRisks(); }, [fetchRisks]));

  const handleCreate = async () => {
    if (!form.description.trim()) {
      showToast('Please fill in the risk description', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/risks`, form);
      showToast('Risk logged successfully!', 'success');
      setIsModalOpen(false);
      setForm(emptyForm);
      fetchRisks();
    } catch (e) {
      showToast(e.message || 'Failed to log risk', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const matrixCount = (p, i) => risks.filter((r) => r.probability === p && r.impact === i).length;

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Risk Register</Text>
            <Text style={s.headerSub}>Probability-impact heatmap & mitigation plans.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {/* Heatmap */}
            <Text style={s.sectionTitle}>Severity Heatmap</Text>
            <View style={s.heatmapCard}>
              <View style={s.heatRow}>
                <View style={s.heatHeadCell}><Text style={s.heatHeadText}>P / I</Text></View>
                {['Low', 'Medium', 'High'].map((h) => (
                  <View key={h} style={s.heatHeadCell}><Text style={s.heatHeadText}>{h}</Text></View>
                ))}
              </View>
              {['high', 'medium', 'low'].map((p) => (
                <View key={p} style={s.heatRow}>
                  <View style={s.heatHeadCell}><Text style={s.heatHeadText}>{p}</Text></View>
                  {['low', 'medium', 'high'].map((i) => (
                    <View key={i} style={[s.heatCell, { backgroundColor: heatCellColor(p, i) + '33' }]}>
                      <Text style={[s.heatCellText, { color: heatCellColor(p, i) }]}>{matrixCount(p, i)}</Text>
                    </View>
                  ))}
                </View>
              ))}
              <Text style={s.heatmapCaption}>Heatmap numbers count active logged project risks.</Text>
            </View>

            <Text style={s.sectionTitle}>Logged Risks</Text>
            {risks.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="alert-circle-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No active risks logged</Text>
              </View>
            ) : (
              risks.map((risk) => {
                const sc = scoreColor(risk.score);
                return (
                  <View key={risk._id} style={s.riskCard}>
                    <View style={s.riskTopRow}>
                      <View style={s.categoryTag}>
                        <Text style={s.categoryTagText}>{String(risk.category).replace('_', ' ')}</Text>
                      </View>
                      <View style={[s.scoreBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[s.scoreBadgeText, { color: sc.color }]}>Score {risk.score} ({risk.probability} × {risk.impact})</Text>
                      </View>
                    </View>
                    <Text style={s.riskDesc}>{risk.description}</Text>
                    {!!risk.mitigationPlan && (
                      <View style={s.mitigationBox}>
                        <Text style={s.mitigationLabel}>Mitigation Strategy:</Text>
                        <Text style={s.mitigationText}>{risk.mitigationPlan}</Text>
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
              <Text style={s.modalTitle}>Log Project Risk</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Risk Description *</Text>
              <TextInput style={s.input} placeholder="e.g. Delayed HVAC supply might slip ceiling layout" placeholderTextColor="#94A3B8" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />

              <Text style={s.label}>Threat Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity key={c.value} style={[s.chip, form.category === c.value && s.chipActive]} onPress={() => setForm({ ...form, category: c.value })}>
                    <Text style={[s.chipText, form.category === c.value && s.chipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Probability</Text>
                  {LEVELS.map((l) => (
                    <TouchableOpacity key={l.value} style={[s.levelOption, form.probability === l.value && s.levelOptionActive]} onPress={() => setForm({ ...form, probability: l.value })}>
                      <Text style={[s.levelOptionText, form.probability === l.value && s.levelOptionTextActive]}>{l.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Impact Level</Text>
                  {LEVELS.map((l) => (
                    <TouchableOpacity key={l.value} style={[s.levelOption, form.impact === l.value && s.levelOptionActive]} onPress={() => setForm({ ...form, impact: l.value })}>
                      <Text style={[s.levelOptionText, form.impact === l.value && s.levelOptionTextActive]}>{l.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={s.label}>Mitigation Strategy Plan</Text>
              <TextInput
                style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                placeholder="Specify corrective actions checklist..."
                placeholderTextColor="#94A3B8"
                value={form.mitigationPlan}
                onChangeText={(v) => setForm({ ...form, mitigationPlan: v })}
                multiline
              />

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleCreate} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Log Risk</Text>}
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
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  sectionTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 6 },

  heatmapCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  heatRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  heatHeadCell: { flex: 1, height: 32, justifyContent: 'center', alignItems: 'center' },
  heatHeadText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase' },
  heatCell: { flex: 1, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  heatCellText: { fontSize: 13, fontFamily: 'Inter-Black' },
  heatmapCaption: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', marginTop: 8 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },

  riskCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 8, marginBottom: 4 },
  riskTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  categoryTag: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryTagText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#64748B', textTransform: 'capitalize' },
  scoreBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  scoreBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', textTransform: 'capitalize' },
  riskDesc: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  mitigationBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 10, padding: 10 },
  mitigationLabel: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  mitigationText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },

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
  chipText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  chipTextActive: { color: '#2563EB' },

  levelOption: { paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', marginBottom: 6 },
  levelOptionActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  levelOptionText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  levelOptionTextActive: { color: '#FFFFFF' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

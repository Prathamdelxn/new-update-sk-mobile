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

const STATUS_META = {
  pending: { color: '#64748B', bg: '#F8FAFC' },
  passed: { color: '#16A34A', bg: '#F0FDF4' },
  failed: { color: '#DC2626', bg: '#FEF2F2' },
};
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending Check' },
  { value: 'passed', label: 'Passed Test' },
  { value: 'failed', label: 'Failed Test' },
];

export default function InteriorUtilitiesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedSystem, setSelectedSystem] = useState(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
  const [checkpointStatus, setCheckpointStatus] = useState('passed');
  const [checkpointReadings, setCheckpointReadings] = useState('');
  const [systemProgress, setSystemProgress] = useState('0');
  const [updating, setUpdating] = useState(false);

  const fetchUtilities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/utilities`);
      setSystems(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load utilities', e);
      showToast('Failed to fetch Utilities checklists', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchUtilities(); }, [fetchUtilities]));

  const openCheckpoint = (sys, cp) => {
    setSelectedSystem(sys);
    setSelectedCheckpoint(cp);
    setCheckpointStatus(cp.status === 'pending' ? 'passed' : cp.status);
    setCheckpointReadings(cp.readings || '');
    setSystemProgress(String(sys.actualProgress));
  };

  const handleSave = async () => {
    setUpdating(true);
    try {
      await interiorApiClient.put(`/projects/${projectId}/utilities`, {
        systemId: selectedSystem._id,
        checkpointName: selectedCheckpoint.name,
        status: checkpointStatus,
        readings: checkpointReadings,
        actualProgress: parseInt(systemProgress, 10) || 0,
      });
      showToast('Utility commissioning checkpoint updated!', 'success');
      setSelectedCheckpoint(null);
      fetchUtilities();
    } catch (e) {
      showToast(e.message || 'Failed to save checkpoint update', 'error');
    } finally {
      setUpdating(false);
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
            <Text style={s.headerTitle}>Systems Commissioning</Text>
            <Text style={s.headerSub}>Electrical, HVAC, PHE, Fire Fighting, STP, ELV checklists.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {systems.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="flash-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No utility systems yet</Text>
              </View>
            ) : (
              systems.map((sys) => (
                <View key={sys._id} style={s.sysCard}>
                  <View style={s.sysHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={s.sysIconBox}>
                        <Ionicons name="flash-outline" size={15} color="#2563EB" />
                      </View>
                      <Text style={s.sysTitle}>{String(sys.system).replace('_', ' ')}</Text>
                    </View>
                    <Text style={s.sysProgress}>{sys.actualProgress}%</Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${sys.actualProgress}%` }]} />
                  </View>

                  {sys.checkpoints.map((cp) => {
                    const meta = STATUS_META[cp.status] || STATUS_META.pending;
                    return (
                      <TouchableOpacity key={cp.name} style={s.cpRow} onPress={() => openCheckpoint(sys, cp)}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.cpName}>{cp.name}</Text>
                          {!!cp.readings && <Text style={s.cpReadings}>Readings: {cp.readings}</Text>}
                        </View>
                        <View style={[s.cpBadge, { backgroundColor: meta.bg }]}>
                          <Text style={[s.cpBadgeText, { color: meta.color }]}>{cp.status}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={!!selectedCheckpoint} animationType="slide" transparent onRequestClose={() => setSelectedCheckpoint(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            {selectedCheckpoint && (
              <>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle} numberOfLines={1}>Update: {selectedCheckpoint.name}</Text>
                  <TouchableOpacity onPress={() => setSelectedCheckpoint(null)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={s.label}>Test Audit Status</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  {STATUS_OPTIONS.map((opt) => (
                    <TouchableOpacity key={opt.value} style={[s.chip, checkpointStatus === opt.value && s.chipActive]} onPress={() => setCheckpointStatus(opt.value)}>
                      <Text style={[s.chipText, checkpointStatus === opt.value && s.chipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.label}>Logged Readings / Notes</Text>
                <TextInput style={s.input} placeholder="e.g. Pressure 10.2 Bar for 2 hours" placeholderTextColor="#94A3B8" value={checkpointReadings} onChangeText={setCheckpointReadings} />

                <Text style={s.label}>Overall System Progress (%)</Text>
                <TextInput style={s.input} keyboardType="numeric" value={systemProgress} onChangeText={setSystemProgress} />

                <TouchableOpacity style={[s.saveBtn, updating && { opacity: 0.7 }]} onPress={handleSave} disabled={updating}>
                  {updating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Save Changes</Text>}
                </TouchableOpacity>
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

  sysCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 8 },
  sysHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sysIconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  sysTitle: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A', textTransform: 'uppercase' },
  sysProgress: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#2563EB' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#2563EB' },

  cpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 10, gap: 8 },
  cpName: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  cpReadings: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  cpBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cpBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1 },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', flex: 1, alignItems: 'center' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  chipTextActive: { color: '#2563EB' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

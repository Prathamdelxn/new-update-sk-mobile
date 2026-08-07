import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const DISCIPLINES = ['all', 'tender', 'shop', 'gfc', 'as-built'];
const DISCIPLINE_OPTIONS = [
  { value: 'tender', label: 'Tender Drawing' },
  { value: 'shop', label: 'Shop Drawing' },
  { value: 'gfc', label: 'GFC (Issued for Construction)' },
  { value: 'as-built', label: 'As-Built Drawing' },
];
const STATUS_META = {
  approved: { color: '#16A34A', bg: '#F0FDF4' },
  under_review: { color: '#2563EB', bg: '#EFF6FF' },
  submitted: { color: '#2563EB', bg: '#EFF6FF' },
  rejected: { color: '#DC2626', bg: '#FEF2F2' },
};

async function pickFile() {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

export default function InteriorDrawingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDiscipline, setSelectedDiscipline] = useState('all');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState('gfc');
  const [selectedFile, setSelectedFile] = useState(null);

  const [revTarget, setRevTarget] = useState(null);
  const [revName, setRevName] = useState('');
  const [revChanges, setRevChanges] = useState('');
  const [revFile, setRevFile] = useState(null);

  const fetchDrawings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/drawings`);
      setDrawings(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load drawings', e);
      showToast('Failed to fetch Drawings register', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchDrawings(); }, [fetchDrawings]));

  const closeCreate = () => { setIsCreateOpen(false); setTitle(''); setDiscipline('gfc'); setSelectedFile(null); };
  const closeRev = () => { setRevTarget(null); setRevChanges(''); setRevFile(null); };

  const handlePickCreateFile = async () => {
    const asset = await pickFile();
    if (asset) setSelectedFile(asset);
  };
  const handlePickRevFile = async () => {
    const asset = await pickFile();
    if (asset) setRevFile(asset);
  };

  const handleSubmitDrawing = async () => {
    if (!title.trim()) return showToast('Please fill in drawing title', 'error');
    if (!selectedFile) return showToast('Please select a drawing file to upload', 'error');
    setSubmitting(true);
    try {
      const uploadRes = await interiorApiClient.postForm(`/projects/${projectId}/drawings/upload`, {
        file: { uri: selectedFile.uri, name: selectedFile.name, type: selectedFile.mimeType || 'application/octet-stream' },
      });
      if (!uploadRes?.success || !uploadRes?.data?.url) throw new Error('Drawing upload failed');
      await interiorApiClient.post(`/projects/${projectId}/drawings`, { title, discipline, fileUrl: uploadRes.data.url });
      showToast('Drawing registered successfully!', 'success');
      closeCreate();
      fetchDrawings();
    } catch (e) {
      showToast(e.message || 'Failed to register drawing', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openRevModal = (dwgId, nextRev) => {
    setRevTarget(dwgId);
    setRevName(`Rev ${nextRev}`);
    setRevChanges('');
    setRevFile(null);
  };

  const handleSubmitRevision = async () => {
    if (!revChanges.trim()) return showToast('Please describe the revision changes', 'error');
    if (!revFile) return showToast('Please select a revision file to upload', 'error');
    setSubmitting(true);
    try {
      const uploadRes = await interiorApiClient.postForm(`/projects/${projectId}/drawings/upload`, {
        file: { uri: revFile.uri, name: revFile.name, type: revFile.mimeType || 'application/octet-stream' },
      });
      if (!uploadRes?.success || !uploadRes?.data?.url) throw new Error('Revision upload failed');
      await interiorApiClient.put(`/projects/${projectId}/drawings`, {
        drawingId: revTarget, revisionName: revName, changes: revChanges, fileUrl: uploadRes.data.url,
      });
      showToast('New revision uploaded successfully!', 'success');
      closeRev();
      fetchDrawings();
    } catch (e) {
      showToast(e.message || 'Failed to upload revision', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (dwg, status) => {
    try {
      await interiorApiClient.put(`/projects/${projectId}/drawings`, { drawingId: dwg._id, status });
      showToast(`Drawing status updated to: ${status}`, 'success');
      fetchDrawings();
    } catch (e) {
      showToast(e.message || 'Failed to update approval status', 'error');
    }
  };

  const filteredDrawings = selectedDiscipline === 'all' ? drawings : drawings.filter((d) => d.discipline === selectedDiscipline);

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Drawings & Blueprints</Text>
            <Text style={s.headerSub}>Tender, Shop, GFC, As-Built with revisions.</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
          {DISCIPLINES.map((d) => (
            <TouchableOpacity key={d} style={[s.catChip, selectedDiscipline === d && s.catChipActive]} onPress={() => setSelectedDiscipline(d)}>
              <Text style={[s.catChipText, selectedDiscipline === d && s.catChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {filteredDrawings.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="document-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No drawings registered</Text>
              </View>
            ) : (
              filteredDrawings.map((dwg) => {
                const currentRev = dwg.revisions[dwg.revisions.length - 1];
                const meta = STATUS_META[dwg.status] || STATUS_META.submitted;
                return (
                  <View key={dwg._id} style={s.dwgCard}>
                    <View style={s.dwgTopRow}>
                      <Text style={s.dwgNumber}>{dwg.drawingNumber}</Text>
                      <View style={s.disciplineTag}>
                        <Text style={s.disciplineTagText}>{dwg.discipline}</Text>
                      </View>
                      <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
                        <Text style={[s.statusBadgeText, { color: meta.color }]}>{dwg.status}</Text>
                      </View>
                    </View>
                    <Text style={s.dwgTitle}>{dwg.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="git-branch-outline" size={12} color="#94A3B8" />
                      <Text style={s.dwgMeta}>Latest: {currentRev.revision}</Text>
                    </View>
                    {!!currentRev.changes && <Text style={s.dwgChanges}>Changes: {currentRev.changes}</Text>}

                    <View style={s.actionsRow}>
                      <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(currentRev.url)}>
                        <Ionicons name="download-outline" size={13} color="#2563EB" />
                        <Text style={s.actionBtnText}>View DWG</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actionBtn} onPress={() => openRevModal(dwg._id, dwg.revisions.length)}>
                        <Text style={s.actionBtnText}>Upload Rev</Text>
                      </TouchableOpacity>
                      {dwg.status !== 'approved' && (
                        <TouchableOpacity style={[s.actionBtn, { borderColor: '#BBF7D0' }]} onPress={() => updateStatus(dwg, 'approved')}>
                          <Text style={[s.actionBtnText, { color: '#16A34A' }]}>Approve</Text>
                        </TouchableOpacity>
                      )}
                      {dwg.status !== 'rejected' && (
                        <TouchableOpacity style={[s.actionBtn, { borderColor: '#FECACA' }]} onPress={() => updateStatus(dwg, 'rejected')}>
                          <Text style={[s.actionBtnText, { color: '#DC2626' }]}>Reject</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
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

      {/* Register drawing */}
      <Modal visible={isCreateOpen} animationType="slide" transparent onRequestClose={closeCreate}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Register Design Drawing</Text>
              <TouchableOpacity onPress={closeCreate}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Drawing Title *</Text>
              <TextInput style={s.input} placeholder="e.g. Electrical Layout Grid Plan" placeholderTextColor="#94A3B8" value={title} onChangeText={setTitle} />

              <Text style={s.label}>Discipline Category</Text>
              <View style={{ gap: 6, marginBottom: 8 }}>
                {DISCIPLINE_OPTIONS.map((opt) => (
                  <TouchableOpacity key={opt.value} style={[s.catOption, discipline === opt.value && s.catOptionActive]} onPress={() => setDiscipline(opt.value)}>
                    <Text style={[s.catOptionText, discipline === opt.value && s.catOptionTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Drawing File (PDF or Image) *</Text>
              <TouchableOpacity style={s.uploadBox} onPress={handlePickCreateFile}>
                <Ionicons name="cloud-upload-outline" size={26} color="#94A3B8" />
                <Text style={s.uploadBoxText} numberOfLines={1}>{selectedFile ? selectedFile.name : 'Tap to select drawing file'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmitDrawing} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Register & Upload</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Upload revision */}
      <Modal visible={!!revTarget} animationType="slide" transparent onRequestClose={closeRev}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Upload Revision: {revName}</Text>
              <TouchableOpacity onPress={closeRev}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Describe Revision Changes *</Text>
              <TextInput style={s.input} placeholder="e.g. Relocated main distribution board" placeholderTextColor="#94A3B8" value={revChanges} onChangeText={setRevChanges} />

              <Text style={s.label}>New Revision File *</Text>
              <TouchableOpacity style={s.uploadBox} onPress={handlePickRevFile}>
                <Ionicons name="cloud-upload-outline" size={26} color="#94A3B8" />
                <Text style={s.uploadBoxText} numberOfLines={1}>{revFile ? revFile.name : 'Tap to select revision file'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmitRevision} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Upload Revision</Text>}
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
  scroll: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  catRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC' },
  catChipActive: { backgroundColor: '#2563EB' },
  catChipText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#64748B', textTransform: 'uppercase' },
  catChipTextActive: { color: '#FFFFFF' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  dwgCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 6 },
  dwgTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dwgNumber: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#64748B' },
  disciplineTag: { backgroundColor: '#EFF6FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  disciplineTagText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#2563EB', textTransform: 'uppercase' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginLeft: 'auto' },
  statusBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
  dwgTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  dwgMeta: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B' },
  dwgChanges: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', fontStyle: 'italic' },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  actionBtnText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#334155' },

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

  catOption: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  catOptionActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  catOptionText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  catOptionTextActive: { color: '#2563EB' },

  uploadBox: { height: 90, borderRadius: 14, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  uploadBoxText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B', maxWidth: '100%' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

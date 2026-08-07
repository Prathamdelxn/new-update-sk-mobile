import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';
import CategoryNav from './_components/CategoryNav';

const RING_SIZE = 132;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function HandoverReadyRing({ percentage = 0 }) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const offset = RING_CIRCUMFERENCE - (clamped / 100) * RING_CIRCUMFERENCE;
  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke="#EEF2F6"
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke="#2563EB"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          rotation="-90"
          originX={RING_SIZE / 2}
          originY={RING_SIZE / 2}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontFamily: 'Inter-Black', color: '#0F172A' }}>{clamped}%</Text>
        <Text style={{ fontSize: 9, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.5, marginTop: 2 }}>HANDOVER READY</Text>
      </View>
    </View>
  );
}

const DOC_TYPES = [
  { value: 'warranty', label: 'Warranty Card / Contract' },
  { value: 'manual', label: 'O&M Manual Description' },
  { value: 'certificate', label: 'Handover / NOC Certificate' },
];

function fmt(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function InteriorHandoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [handover, setHandover] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('warranty');
  const [selectedFile, setSelectedFile] = useState(null);

  const [isEditingChecklist, setIsEditingChecklist] = useState(false);
  const [editedChecklist, setEditedChecklist] = useState([]);
  const [newTaskText, setNewTaskText] = useState('');

  const fetchHandover = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/handover`);
      setHandover(res?.success && res?.data ? res.data : null);
    } catch (e) {
      console.error('Failed to load handover', e);
      showToast('Failed to fetch Handover status', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchHandover(); }, [fetchHandover]));

  const closeDocModal = () => { setIsDocModalOpen(false); setDocName(''); setDocType('warranty'); setSelectedFile(null); };

  const startEditingChecklist = () => {
    if (!handover) return;
    setEditedChecklist(handover.checklist.map((c) => ({ task: c.task, status: c.status })));
    setNewTaskText('');
    setIsEditingChecklist(true);
  };

  const addTask = () => {
    if (!newTaskText.trim()) return;
    if (editedChecklist.some((c) => c.task.toLowerCase() === newTaskText.trim().toLowerCase())) {
      showToast('Task already exists in checklist', 'error');
      return;
    }
    setEditedChecklist((p) => [...p, { task: newTaskText.trim(), status: 'pending' }]);
    setNewTaskText('');
  };

  const deleteTask = (idx) => setEditedChecklist((p) => p.filter((_, i) => i !== idx));
  const updateTaskText = (idx, val) => setEditedChecklist((p) => p.map((c, i) => (i === idx ? { ...c, task: val } : c)));

  const saveChecklist = async () => {
    if (editedChecklist.length === 0) return showToast('Checklist cannot be empty', 'error');
    setUpdating(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/handover`, { checklist: editedChecklist });
      showToast('Handover checklist updated successfully!', 'success');
      setIsEditingChecklist(false);
      fetchHandover();
    } catch (e) {
      showToast(e.message || 'Failed to update checklist', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const toggleCheckitem = async (task, currentStatus) => {
    setUpdating(true);
    try {
      const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      await interiorApiClient.post(`/projects/${projectId}/handover`, { taskName: task, status: nextStatus });
      showToast('Checklist task updated!', 'success');
      fetchHandover();
    } catch (e) {
      showToast(e.message || 'Failed to update checklist status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.length) setSelectedFile(result.assets[0]);
  };

  const handleUploadDocument = async () => {
    if (!docName.trim()) return showToast('Please fill in document description', 'error');
    if (!selectedFile) return showToast('Please select a file to upload', 'error');
    setUpdating(true);
    try {
      const uploadRes = await interiorApiClient.postForm(`/projects/${projectId}/handover/upload`, {
        file: { uri: selectedFile.uri, name: selectedFile.name, type: selectedFile.mimeType || 'application/octet-stream' },
      });
      if (!uploadRes?.success || !uploadRes?.data?.url) throw new Error('File upload failed');
      await interiorApiClient.post(`/projects/${projectId}/handover`, { documentName: docName, documentUrl: uploadRes.data.url, documentType: docType });
      showToast('Closeout document registered successfully!', 'success');
      closeDocModal();
      fetchHandover();
    } catch (e) {
      showToast(e.message || 'Failed to register document', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={s.outerContainer}>
        <SafeAreaView style={s.center}><ActivityIndicator size="large" color="#2563EB" /></SafeAreaView>
      </View>
    );
  }

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Handover & Closeout</Text>
            <Text style={s.headerSub}>Warranties, manuals, checklist, signoffs.</Text>
          </View>
        </View>

        <CategoryNav projectId={projectId} activeItem="Project Handover" comingSoon={(label) => showToast(`${label} — coming soon.`, 'success')} />

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.readyCard}>
            <HandoverReadyRing percentage={handover?.completionPercentage || 0} />
          </View>

          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>Punch List & Handover Checklist</Text>
            {!isEditingChecklist && (
              <TouchableOpacity style={s.editBtn} onPress={startEditingChecklist}>
                <Ionicons name="pencil-outline" size={12} color="#2563EB" />
                <Text style={s.editBtnText}>Edit Checklist</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditingChecklist ? (
            <View style={s.card}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TextInput style={[s.input, { flex: 1 }]} placeholder="Add new checklist task..." placeholderTextColor="#94A3B8" value={newTaskText} onChangeText={setNewTaskText} onSubmitEditing={addTask} />
                <TouchableOpacity style={s.addBtn} onPress={addTask}>
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {editedChecklist.length === 0 ? (
                <Text style={s.emptyLine}>Checklist is empty. Add tasks above.</Text>
              ) : (
                editedChecklist.map((item, idx) => (
                  <View key={idx} style={s.editRow}>
                    <TextInput style={[s.input, { flex: 1 }]} value={item.task} onChangeText={(v) => updateTaskText(idx, v)} placeholder="Task description" placeholderTextColor="#94A3B8" />
                    <TouchableOpacity onPress={() => deleteTask(idx)} style={s.deleteTaskBtn}>
                      <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setIsEditingChecklist(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveChecklistBtn, updating && { opacity: 0.7 }]} onPress={saveChecklist} disabled={updating}>
                  {updating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveChecklistBtnText}>Save Checklist</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.card}>
              {handover?.checklist.length === 0 ? (
                <Text style={s.emptyLine}>Checklist has no items. Tap "Edit Checklist" to define tasks.</Text>
              ) : (
                handover?.checklist.map((item) => (
                  <TouchableOpacity key={item.task} style={s.checkRow} onPress={() => toggleCheckitem(item.task, item.status)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Ionicons name={item.status === 'completed' ? 'checkbox' : 'square-outline'} size={17} color={item.status === 'completed' ? '#2563EB' : '#CBD5E1'} />
                      <Text style={[s.checkText, item.status === 'completed' && s.checkTextDone]} numberOfLines={2}>{item.task}</Text>
                    </View>
                    {!!item.completedAt && <Text style={s.checkDate}>{fmt(item.completedAt)}</Text>}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          <Text style={[s.sectionTitle, { marginTop: 20 }]}>Closeout Document Register</Text>
          <View style={s.card}>
            {handover?.documents.length === 0 ? (
              <Text style={s.emptyLine}>No closeout manuals or certificates uploaded yet.</Text>
            ) : (
              handover?.documents.map((doc, i) => (
                <View key={i} style={s.docRow}>
                  <View style={s.docIconBox}>
                    <Ionicons name="document-text-outline" size={16} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.docName} numberOfLines={1}>{doc.name}</Text>
                    <Text style={s.docType}>{doc.type}</Text>
                  </View>
                  <TouchableOpacity onPress={() => Linking.openURL(doc.url)}>
                    <Ionicons name="download-outline" size={18} color="#2563EB" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <TouchableOpacity style={s.fab} onPress={() => setIsDocModalOpen(true)}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      <Modal visible={isDocModalOpen} animationType="slide" transparent onRequestClose={closeDocModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Log Closeout Document</Text>
              <TouchableOpacity onPress={closeDocModal}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Document Description *</Text>
              <TextInput style={s.input} placeholder="e.g. HVAC Compressor Warranty Certificate" placeholderTextColor="#94A3B8" value={docName} onChangeText={setDocName} />

              <Text style={s.label}>Document Category</Text>
              <View style={{ gap: 6, marginBottom: 8 }}>
                {DOC_TYPES.map((opt) => (
                  <TouchableOpacity key={opt.value} style={[s.catOption, docType === opt.value && s.catOptionActive]} onPress={() => setDocType(opt.value)}>
                    <Text style={[s.catOptionText, docType === opt.value && s.catOptionTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Closeout File *</Text>
              <TouchableOpacity style={s.uploadBox} onPress={pickFile}>
                <Ionicons name="cloud-upload-outline" size={26} color="#94A3B8" />
                <Text style={s.uploadBoxText} numberOfLines={1}>{selectedFile ? selectedFile.name : 'Tap to select closeout file'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.saveBtn, updating && { opacity: 0.7 }]} onPress={handleUploadDocument} disabled={updating}>
                {updating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Save Document</Text>}
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
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  readyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', paddingVertical: 24, alignItems: 'center', marginBottom: 16 },
  readyPct: { fontSize: 30, fontFamily: 'Inter-Black', color: '#0F172A' },
  readyLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.5, marginTop: 4 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  editBtnText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#2563EB' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  emptyLine: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', paddingVertical: 10 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  checkText: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#0F172A', flex: 1 },
  checkTextDone: { color: '#94A3B8', textDecorationLine: 'line-through' },
  checkDate: { fontSize: 9.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  editRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  deleteTaskBtn: { width: 38, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', justifyContent: 'center', alignItems: 'center' },
  addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cancelBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B' },
  saveChecklistBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#2563EB' },
  saveChecklistBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  docIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  docName: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  docType: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', marginTop: 1 },

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

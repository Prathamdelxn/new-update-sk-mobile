import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

// Reusable calendar date picker field (replaces free-text YYYY-MM-DD inputs).
function DateField({ value, onChange, placeholder = 'Select date', inputStyle }) {
  const [showIosPicker, setShowIosPicker] = useState(false);

  const open = () => {
    const base = value ? new Date(value) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        onChange: (event, d) => {
          if (event.type === 'set' && d) onChange(d.toISOString().split('T')[0]);
        },
      });
    } else {
      setShowIosPicker(true);
    }
  };

  return (
    <>
      <TouchableOpacity style={[inputStyle, dfStyles.row]} onPress={open}>
        <Text style={[dfStyles.text, !value && dfStyles.placeholder]} numberOfLines={1}>
          {value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={16} color="#64748B" />
      </TouchableOpacity>
      {Platform.OS === 'ios' && showIosPicker && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display="spinner"
          onChange={(e, d) => {
            setShowIosPicker(false);
            if (d) onChange(d.toISOString().split('T')[0]);
          }}
        />
      )}
    </>
  );
}

const dfStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A', flex: 1, marginRight: 8 },
  placeholder: { color: '#94A3B8' },
});

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

const emptyForm = { description: '', location: '', priority: 'medium', dueDate: '', photos: [] };

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
  const [editSnagId, setEditSnagId] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

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

  const handleSubmitSnag = async () => {
    if (!form.description.trim() || !form.location.trim()) {
      showToast('Please fill in description and location', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        description: form.description,
        location: form.location,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        photos: form.photos,
      };
      if (editSnagId) {
        await interiorApiClient.put(`/projects/${projectId}/snags`, { snagId: editSnagId, ...payload });
        showToast('Snag updated successfully!', 'success');
      } else {
        await interiorApiClient.post(`/projects/${projectId}/snags`, payload);
        showToast('Snag logged successfully!', 'success');
      }
      closeModal();
      fetchSnags();
    } catch (e) {
      showToast(e.message || (editSnagId ? 'Failed to update snag' : 'Failed to log snag'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateModal = () => {
    setEditSnagId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (snag) => {
    setEditSnagId(snag._id);
    setForm({
      description: snag.description || '',
      location: snag.location || '',
      priority: snag.priority || 'medium',
      dueDate: snag.dueDate ? new Date(snag.dueDate).toISOString().split('T')[0] : '',
      photos: snag.photos || [],
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditSnagId(null);
    setForm(emptyForm);
  };

  const handlePickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('Camera roll permission is required to attach photos', 'error');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const dataUri = asset.base64
          ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
        setForm((f) => ({ ...f, photos: [...f.photos, dataUri] }));
      }
    } catch (e) {
      showToast(e.message || 'Failed to attach photo', 'error');
    }
  };

  const removePhoto = (idx) => setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }));

  const handleDeleteSnag = (snag) => {
    Alert.alert('Delete Snag', 'Are you sure you want to delete this snag? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await interiorApiClient.delete(`/projects/${projectId}/snags?snagId=${snag._id}`);
            showToast('Snag deleted successfully', 'delete');
            fetchSnags();
          } catch (e) {
            showToast(e.message || 'Failed to delete snag', 'error');
          }
        },
      },
    ]);
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[s.pill, { backgroundColor: priority.bg }]}>
                          <Text style={[s.pillText, { color: priority.color }]}>{snag.priority}</Text>
                        </View>
                        <View style={[s.pill, { backgroundColor: status.bg }]}>
                          <Text style={[s.pillText, { color: status.color }]}>{snag.status}</Text>
                        </View>
                        <TouchableOpacity onPress={() => openEditModal(snag)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Ionicons name="pencil-outline" size={13} color="#94A3B8" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteSnag(snag)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Ionicons name="trash-outline" size={13} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={s.snagDesc}>{snag.description}</Text>

                    {snag.photos && snag.photos.length > 0 && (
                      <View style={s.photoRow}>
                        {snag.photos.map((photo, idx) => (
                          <TouchableOpacity key={idx} style={s.photoThumb} onPress={() => setLightboxPhoto(photo)}>
                            <Image source={{ uri: photo }} style={s.photoThumbImg} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

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

        <TouchableOpacity style={s.fab} onPress={openCreateModal}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editSnagId ? 'Edit Punch List Snag' : 'Log Punch List Snag'}</Text>
              <TouchableOpacity onPress={closeModal}>
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
              <DateField value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} inputStyle={s.input} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 }}>
                <Text style={[s.label, { marginTop: 0 }]}>Attachments ({form.photos.length})</Text>
                <TouchableOpacity style={s.addPhotoBtn} onPress={handlePickPhoto}>
                  <Ionicons name="camera" size={13} color="#2563EB" />
                  <Text style={s.addPhotoBtnText}>+ Add Photo</Text>
                </TouchableOpacity>
              </View>

              {form.photos.length > 0 ? (
                <View style={s.modalPhotoGrid}>
                  {form.photos.map((uri, idx) => (
                    <View key={idx} style={s.modalPhotoThumb}>
                      <Image source={{ uri }} style={s.modalPhotoImg} />
                      <TouchableOpacity style={s.removePhotoBtn} onPress={() => removePhoto(idx)}>
                        <Ionicons name="close" size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <TouchableOpacity style={s.photoPickerBox} onPress={handlePickPhoto}>
                  <Ionicons name="images-outline" size={22} color="#94A3B8" />
                  <Text style={s.photoPickerBoxText}>Tap to attach defect photos from device</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmitSnag} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>{editSnagId ? 'Save Changes' : 'Log Snag'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full Screen Photo Lightbox */}
      <Modal visible={!!lightboxPhoto} transparent animationType="fade" onRequestClose={() => setLightboxPhoto(null)}>
        <View style={s.lightboxOverlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.lightboxHeader}>
              <Text style={s.lightboxTitle}>Snag Photo</Text>
              <TouchableOpacity style={s.lightboxCloseBtn} onPress={() => setLightboxPhoto(null)}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={s.lightboxBody}>
              {lightboxPhoto && <Image source={{ uri: lightboxPhoto }} style={s.lightboxImage} resizeMode="contain" />}
            </View>
          </SafeAreaView>
        </View>
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

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  photoThumb: { width: 52, height: 52, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
  photoThumbImg: { width: '100%', height: '100%' },

  addPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  addPhotoBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB' },

  modalPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  modalPhotoThumb: { width: 65, height: 65, borderRadius: 10, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: '#E2E8F0' },
  modalPhotoImg: { width: '100%', height: '100%' },
  removePhotoBtn: {
    position: 'absolute', top: 2, right: 2, backgroundColor: '#DC2626',
    borderRadius: 999, width: 18, height: 18, justifyContent: 'center', alignItems: 'center',
  },
  photoPickerBox: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 12,
    padding: 16, alignItems: 'center', gap: 4, backgroundColor: '#F8FAFC', marginVertical: 4,
  },
  photoPickerBoxText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  lightboxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  lightboxTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  lightboxCloseBtn: { padding: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)' },
  lightboxBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
  lightboxImage: { width: '100%', height: '100%' },
});

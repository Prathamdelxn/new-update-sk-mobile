import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const CATEGORIES = ['all', 'progress', 'snag', 'delivery', 'other'];
const CATEGORY_OPTIONS = [
  { value: 'progress', label: 'Daily Site Progress' },
  { value: 'snag', label: 'Quality Snag Defect' },
  { value: 'delivery', label: 'Material Delivery Check' },
  { value: 'other', label: 'General Photo' },
];

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function InteriorPhotosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('progress');
  const [selectedAsset, setSelectedAsset] = useState(null);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/photos`);
      setPhotos(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load photos', e);
      showToast('Failed to fetch site photos history', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchPhotos(); }, [fetchPhotos]));

  const closeModal = () => {
    setIsModalOpen(false);
    setCaption('');
    setCategory('progress');
    setSelectedAsset(null);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast('Photo library permission is required', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets?.length > 0) {
      setSelectedAsset(result.assets[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedAsset) {
      showToast('Please select a photo to upload', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const uploadRes = await interiorApiClient.postForm(`/projects/${projectId}/photos/upload`, {
        file: { uri: selectedAsset.uri, name: selectedAsset.fileName || 'photo.jpg', type: selectedAsset.mimeType || 'image/jpeg' },
      });
      if (!uploadRes?.success || !uploadRes?.data?.url) throw new Error('Photo upload failed');

      await interiorApiClient.post(`/projects/${projectId}/photos`, { caption, category, url: uploadRes.data.url });
      showToast('Site photo logged successfully!', 'success');
      closeModal();
      fetchPhotos();
    } catch (e) {
      showToast(e.message || 'Failed to log site photo', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPhotos = activeCategory === 'all' ? photos : photos.filter((p) => p.category === activeCategory);

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Site Progress Photos</Text>
            <Text style={s.headerSub}>Progress pictures, snags, and delivery logs.</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat} style={[s.catChip, activeCategory === cat && s.catChipActive]} onPress={() => setActiveCategory(cat)}>
              <Text style={[s.catChipText, activeCategory === cat && s.catChipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {filteredPhotos.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="image-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No photos found</Text>
              </View>
            ) : (
              <View style={s.grid}>
                {filteredPhotos.map((photo) => (
                  <View key={photo._id} style={s.photoCard}>
                    <View style={s.photoImgWrap}>
                      <Image source={{ uri: photo.url }} style={s.photoImg} contentFit="cover" />
                      <View style={s.photoCatTag}>
                        <Text style={s.photoCatTagText}>{photo.category}</Text>
                      </View>
                    </View>
                    <Text style={s.photoCaption} numberOfLines={1}>{photo.caption || 'No caption added'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="calendar-outline" size={11} color="#94A3B8" />
                      <Text style={s.photoDate}>{formatDate(photo.createdAt)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        <TouchableOpacity style={s.fab} onPress={() => setIsModalOpen(true)}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Log Progress Photo</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Photo Caption / Note</Text>
              <TextInput style={s.input} placeholder="e.g. Completed partition wall boarding" placeholderTextColor="#94A3B8" value={caption} onChangeText={setCaption} />

              <Text style={s.label}>Category</Text>
              <View style={{ gap: 6, marginBottom: 8 }}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <TouchableOpacity key={opt.value} style={[s.catOption, category === opt.value && s.catOptionActive]} onPress={() => setCategory(opt.value)}>
                    <Text style={[s.catOptionText, category === opt.value && s.catOptionTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Site Photo *</Text>
              <TouchableOpacity style={s.uploadBox} onPress={pickImage}>
                {selectedAsset ? (
                  <Image source={{ uri: selectedAsset.uri }} style={s.previewImg} contentFit="cover" />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={30} color="#94A3B8" />
                    <Text style={s.uploadBoxText}>Tap to select a site photo</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleUpload} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Save & Upload Photo</Text>}
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
  scroll: { paddingHorizontal: 20, paddingTop: 14 },

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

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoCard: { width: '47%', gap: 4 },
  photoImgWrap: { width: '100%', height: 130, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  photoImg: { width: '100%', height: '100%' },
  photoCatTag: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  photoCatTagText: { fontSize: 8.5, fontFamily: 'Inter-Bold', color: '#FFFFFF', textTransform: 'uppercase' },
  photoCaption: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginTop: 4 },
  photoDate: { fontSize: 9.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },

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

  uploadBox: { height: 140, borderRadius: 14, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 6, overflow: 'hidden' },
  uploadBoxText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  previewImg: { width: '100%', height: '100%' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

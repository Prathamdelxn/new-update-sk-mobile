import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { interiorCrmService } from '../../services/interiorCrmService';
import * as DocumentPicker from 'expo-document-picker';
import cloudinaryService from '../../services/cloudinaryService';

export const STANDARD_ROOM_TAGS = [
  'General / Not Specified',
  'Living Room',
  'Master Bedroom',
  'Kitchen',
  'Dining Area',
  'Kids Bedroom',
  'Guest Bedroom',
  'Foyer / Entrance',
  'Balcony / Terrace',
  'Master Bathroom',
  'Common Bathroom',
  'Devotional Room',
  'Walk-in Wardrobe',
  'Home Office / Study',
  'Whole House / Entire Space',
  'Other / Custom Area',
];

function detectFileType(fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'hdr', 'exr'].includes(ext)) return 'image';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['dwg', 'skp', 'obj', 'fbx', '3ds', 'dae', 'blend', 'rvt', 'rfa', 'ifc', 'gltf', 'glb', 'max'].includes(ext)) return '3d-model';
  if (['dxf'].includes(ext)) return 'cad';
  if (['zip', 'rar', '7z', 'tar'].includes(ext)) return 'document';
  return 'document';
}

function sanitizeTitle(fileName) {
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  return withoutExt.replace(/[_-]+/g, ' ').trim();
}

export default function UploadDesignModal({
  visible,
  onClose,
  customerId,
  existingDesigns = [],
  users = [],
  requirements = [],
  onSuccess,
  isReadOnly = false,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);

  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [category, setCategory] = useState('2D');
  const [roomTag, setRoomTag] = useState('General / Not Specified');
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null); // { uri, name, mimeType, fileType }
  const [queuedFiles, setQueuedFiles] = useState([]);

  const availableRooms = useMemo(() => {
    const fromReqs = (requirements || []).map((r) => r.roomName?.trim()).filter(Boolean);
    return Array.from(new Set(['General / Not Specified', ...fromReqs, ...STANDARD_ROOM_TAGS]));
  }, [requirements]);

  const resetForm = () => {
    setTitle('');
    setTitleTouched(false);
    setCategory('2D');
    setRoomTag('General / Not Specified');
    setCustomRoomInput('');
    setSelectedFile(null);
    setQueuedFiles([]);
  };

  const closeModal = () => {
    resetForm();
    onClose();
  };

  const isDuplicateTitleInCategory = (testTitle, testCategory, ignoreId) => {
    const normalized = testTitle.trim().toLowerCase();
    if (!normalized) return false;

    const existsInUploaded = (existingDesigns || []).some((f) => {
      const fileCat = (f.category || '2D').toUpperCase() === '3D' ? '3D' : '2D';
      if (fileCat !== testCategory) return false;
      const fileTitle = (f.title || f.name || '').trim().toLowerCase();
      return fileTitle === normalized;
    });
    if (existsInUploaded) return true;

    return queuedFiles.some((q) => {
      if (ignoreId && q.id === ignoreId) return false;
      if (q.category !== testCategory) return false;
      return (q.title || q.name || '').trim().toLowerCase() === normalized;
    });
  };

  const getTitleValidationError = (val, targetCategory = category) => {
    const trimmed = val.trim();
    if (!trimmed) return 'Drawing title is required';
    if (trimmed.length < 3) return 'Drawing title must be at least 3 characters';
    if (trimmed.length > 50) return 'Drawing title cannot exceed 50 characters';
    if (isDuplicateTitleInCategory(trimmed, targetCategory)) {
      return `A ${targetCategory} drawing with title "${trimmed}" already exists. Please enter a unique title.`;
    }
    return null;
  };

  const getEffectiveRoom = () => {
    if (roomTag === 'Other / Custom Area') return customRoomInput.trim() || 'General / Not Specified';
    return roomTag || 'General / Not Specified';
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const detectedType = detectFileType(file.name);
        setSelectedFile({
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType || 'application/octet-stream',
          fileType: detectedType,
        });
        if (detectedType === '3d-model') setCategory('3D');
        if (!title.trim()) setTitle(sanitizeTitle(file.name).slice(0, 50));
      }
    } catch (e) {
      console.log('Document picker error:', e);
      Alert.alert('Picker Error', 'Failed to pick file from device.');
    }
  };

  const handleAddToQueue = () => {
    if (!selectedFile) {
      Alert.alert('File Required', 'Please select a file to stage.');
      return;
    }
    const titleError = getTitleValidationError(title);
    if (titleError) {
      setTitleTouched(true);
      Alert.alert('Invalid Title', titleError);
      return;
    }
    setQueuedFiles((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        title: title.trim(),
        name: selectedFile.name,
        category,
        roomTag: getEffectiveRoom(),
        fileUri: selectedFile.uri,
        mimeType: selectedFile.mimeType,
        fileType: selectedFile.fileType,
      },
    ]);
    setTitle('');
    setTitleTouched(false);
    setSelectedFile(null);
  };

  const removeQueuedFile = (queueId) => setQueuedFiles((prev) => prev.filter((q) => q.id !== queueId));

  const handleSubmit = async () => {
    if (isReadOnly) {
      Alert.alert('Locked', 'This lead is read-only and cannot be edited.');
      return;
    }

    let itemsToUpload = [...queuedFiles];

    if (itemsToUpload.length === 0) {
      if (!selectedFile) {
        Alert.alert('Error', 'Please choose a drawing file to upload.');
        return;
      }
      const titleError = getTitleValidationError(title);
      if (titleError) {
        setTitleTouched(true);
        Alert.alert('Invalid Title', titleError);
        return;
      }
      itemsToUpload.push({
        id: 'primary',
        title: title.trim(),
        name: selectedFile.name,
        category,
        roomTag: getEffectiveRoom(),
        fileUri: selectedFile.uri,
        mimeType: selectedFile.mimeType,
        fileType: selectedFile.fileType,
      });
    }

    setIsSubmitting(true);
    try {
      const uploadedNewFiles = await Promise.all(
        itemsToUpload.map(async (item) => {
          const url = await cloudinaryService.uploadFile(item.fileUri, item.name, item.mimeType);
          const initialVersion = {
            versionNumber: 1,
            name: item.title || item.name,
            url,
            fileType: item.fileType,
            category: item.category,
            uploadedAt: new Date(),
            approvalStatus: 'draft',
            clientStatus: 'pending_client_review',
          };
          return {
            name: item.name,
            title: item.title || item.name,
            url,
            fileType: item.fileType,
            category: item.category,
            roomTag: item.roomTag,
            currentVersion: 1,
            status: 'draft',
            versions: [initialVersion],
            uploadedAt: new Date(),
          };
        })
      );

      const updatedFiles = [...(existingDesigns || []), ...uploadedNewFiles];
      await interiorCrmService.updateCustomer(customerId, { designFiles: updatedFiles });

      const titlesSummary = uploadedNewFiles.map((f) => f.title).join(', ');
      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'Design Shared',
        status: 'Completed',
        remarks: `Uploaded ${uploadedNewFiles.length} drawing(s): ${titlesSummary}.`,
        completedDate: new Date(),
      });

      resetForm();
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error uploading design:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload design file. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleError = titleTouched ? getTitleValidationError(title) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeModal}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
        {imagePreviewVisible && selectedFile?.uri && selectedFile.fileType === 'image' && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setImagePreviewVisible(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setImagePreviewVisible(false)}
                style={{ position: 'absolute', top: 48, right: 16, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 8 }}
              >
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
              <Image source={{ uri: selectedFile.uri }} style={{ width: '100%', height: '80%', resizeMode: 'contain' }} />
            </View>
          </Modal>
        )}

        <View style={s.modalContent}>
          <View style={s.modalHeader}>
            <View>
              <Text style={s.modalTitle}>Upload New Drawing</Text>
              <Text style={s.modalSubtitle}>Each drawing starts as a draft and must be sent for approval.</Text>
            </View>
            <TouchableOpacity onPress={closeModal} style={s.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalBody} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {queuedFiles.length > 0 && (
              <View style={s.queueBox}>
                <Text style={s.queueLabel}>STAGED FOR UPLOAD ({queuedFiles.length})</Text>
                {queuedFiles.map((q) => (
                  <View key={q.id} style={s.queueRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.queueRowTitle} numberOfLines={1}>{q.title}</Text>
                      <Text style={s.queueRowSub} numberOfLines={1}>{q.roomTag} • {q.category} • {q.name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeQueuedFile(q.id)}>
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={s.inputContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={s.label}>Drawing Title *</Text>
                <Text style={[s.charCount, title.length > 45 && { color: '#D97706' }]}>{title.length}/50</Text>
              </View>
              <TextInput
                style={[s.input, titleError && s.inputError]}
                placeholder="e.g. Master Bedroom 3D View"
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={(v) => setTitle(v)}
                onBlur={() => setTitleTouched(true)}
                maxLength={60}
              />
              {!!titleError && <Text style={s.errorText}>{titleError}</Text>}
            </View>

            <View style={s.inputContainer}>
              <Text style={s.label}>Category</Text>
              <View style={s.chipOptions}>
                {['2D', '3D'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.optionChip, category === cat && s.optionChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[s.optionChipText, category === cat && s.optionChipTextActive]}>{cat} Drawing</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.inputContainer}>
              <Text style={s.label}>Room / Area</Text>
              <TouchableOpacity style={s.dropdownBtn} onPress={() => setShowRoomDropdown((v) => !v)}>
                <Text style={s.dropdownBtnText} numberOfLines={1}>{roomTag}</Text>
                <Ionicons name={showRoomDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
              </TouchableOpacity>
              {showRoomDropdown && (
                <View style={s.dropdownMenu}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
                    {availableRooms.map((room) => (
                      <TouchableOpacity
                        key={room}
                        style={s.dropdownItem}
                        onPress={() => { setRoomTag(room); setShowRoomDropdown(false); }}
                      >
                        <Text style={[s.dropdownItemText, roomTag === room && s.dropdownItemTextActive]}>{room}</Text>
                        {roomTag === room && <Ionicons name="checkmark" size={14} color="#2563EB" />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              {roomTag === 'Other / Custom Area' && (
                <TextInput
                  style={[s.input, { marginTop: 8 }]}
                  placeholder="Enter custom room / area name"
                  placeholderTextColor="#94A3B8"
                  value={customRoomInput}
                  onChangeText={setCustomRoomInput}
                />
              )}
            </View>

            <View style={s.inputContainer}>
              <Text style={s.label}>Upload File *</Text>
              {selectedFile ? (
                <View style={{ borderRadius: 10, overflow: 'hidden', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' }}>
                  {selectedFile.fileType === 'image' && (
                    <Image source={{ uri: selectedFile.uri }} style={{ width: '100%', height: 160, resizeMode: 'cover' }} />
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
                    <Ionicons
                      name={
                        selectedFile.fileType === 'image' ? 'image-outline' :
                        selectedFile.fileType === 'pdf' ? 'document-text-outline' :
                        selectedFile.fileType === '3d-model' ? 'cube-outline' :
                        selectedFile.fileType === 'cad' ? 'git-branch-outline' :
                        'document-outline'
                      }
                      size={22}
                      color="#2563EB"
                    />
                    <Text style={{ flex: 1, marginLeft: 8, fontSize: 13, color: '#0F172A', fontFamily: 'Inter-Medium' }} numberOfLines={1}>
                      {selectedFile.name}
                    </Text>
                    {selectedFile.fileType === 'image' && (
                      <TouchableOpacity
                        onPress={() => setImagePreviewVisible(true)}
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, marginRight: 6 }}
                      >
                        <Ionicons name="eye-outline" size={14} color="#2563EB" />
                        <Text style={{ fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#2563EB', marginLeft: 4 }}>Preview</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setSelectedFile(null)}>
                      <Ionicons name="close-circle" size={22} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 8, padding: 20, alignItems: 'center', backgroundColor: '#F8FAFC' }}
                  onPress={pickDocument}
                >
                  <Ionicons name="cloud-upload-outline" size={32} color="#94A3B8" />
                  <Text style={{ marginTop: 8, color: '#64748B', fontFamily: 'Inter-Medium', fontSize: 13 }}>Tap to select file from device</Text>
                  <Text style={{ marginTop: 4, color: '#94A3B8', fontFamily: 'Inter-Regular', fontSize: 11 }}>Images, PDFs, DWG, OBJ, FBX and more</Text>
                </TouchableOpacity>
              )}
            </View>

            {selectedFile && (
              <TouchableOpacity style={s.stageBtn} onPress={handleAddToQueue}>
                <Ionicons name="add-circle-outline" size={16} color="#0284C7" />
                <Text style={s.stageBtnText}>Stage & Add Another Drawing</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={isReadOnly ? s.saveBtn : s.cancelBtn} onPress={closeModal} disabled={isSubmitting}>
              <Text style={isReadOnly ? s.saveBtnText : s.cancelBtnText}>{isReadOnly ? 'Close' : 'Cancel'}</Text>
            </TouchableOpacity>
            {!isReadOnly && (
              <TouchableOpacity style={s.saveBtn} onPress={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={s.saveBtnText}>{queuedFiles.length > 0 ? `Upload ${queuedFiles.length + (selectedFile ? 1 : 0)} Drawing(s)` : 'Upload Drawing'}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#F8FAFC', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSubtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2, maxWidth: 260 },
  closeBtn: { padding: 4 },
  modalBody: { flexShrink: 1 },
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#475569', marginBottom: 8 },
  charCount: { fontSize: 10.5, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A', backgroundColor: '#F8FAFC' },
  inputError: { borderColor: '#DC2626' },
  errorText: { fontSize: 10.5, fontFamily: 'Inter-Medium', color: '#DC2626', marginTop: 4 },
  chipOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  optionChipActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  optionChipText: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  optionChipTextActive: { color: '#4F46E5', fontFamily: 'Inter-Bold' },

  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8FAFC' },
  dropdownBtnText: { fontSize: 13.5, fontFamily: 'Inter-Medium', color: '#0F172A', flex: 1, marginRight: 8 },
  dropdownMenu: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownItemText: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: '#334155', flex: 1, marginRight: 8 },
  dropdownItemTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  stageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#BAE6FD', backgroundColor: '#F0F9FF', borderRadius: 10, paddingVertical: 10, marginBottom: 8 },
  stageBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0284C7' },

  queueBox: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, marginBottom: 16, gap: 8 },
  queueLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 8 },
  queueRowTitle: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  queueRowSub: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  helpText: { fontSize: 11, color: '#94A3B8', marginTop: 6, fontStyle: 'italic' },
  footer: { flexDirection: 'row', padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#475569' },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#0284C7', alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

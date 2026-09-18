import React, { useState } from 'react';
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
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { interiorCrmService } from '../../services/interiorCrmService';
import * as DocumentPicker from 'expo-document-picker';
import cloudinaryService from '../../services/cloudinaryService';
import * as Sharing from 'expo-sharing';

const CATEGORIES = [
  '2D',
  '3D'
];

const FILE_TYPES = [
  'image',
  'pdf',
  '3d-model',
  'cad',
  'document'
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

export default function UploadDesignModal({ 
  visible, 
  onClose, 
  customerId, 
  existingDesigns = [],
  onSuccess 
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  
  const [designForm, setDesignForm] = useState({
    name: '',
    category: '2D',
    fileType: 'image',
    fileUri: '',
    fileName: '',
    mimeType: ''
  });

  const handlePreviewFile = async (uri) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, { dialogTitle: 'Open / Preview File' });
      } else {
        Alert.alert('Preview Unavailable', 'File preview is not supported on this device.');
      }
    } catch (e) {
      console.log('Preview error:', e);
      Alert.alert('Preview Error', 'Could not open the file for preview.');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const detectedType = detectFileType(file.name);
        setDesignForm((prev) => ({ 
          ...prev, 
          fileUri: file.uri, 
          fileName: file.name, 
          mimeType: file.mimeType || 'application/octet-stream',
          fileType: detectedType,
          category: (detectedType === '3d-model' || prev.category === '3D') ? '3D' : prev.category,
          name: prev.name ? prev.name : file.name.replace(/\.[^/.]+$/, '')
        }));
      }
    } catch (e) {
      console.log('Document picker error:', e);
      Alert.alert('Picker Error', 'Failed to pick file from device.');
    }
  };

  const handleSubmit = async () => {
    if (!designForm.name || !designForm.name.trim()) {
      Alert.alert('Error', 'Please enter a name for the design file.');
      return;
    }
    if (!designForm.fileUri) {
      Alert.alert('Error', 'Please select a file to upload.');
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedUrl = await cloudinaryService.uploadFile(designForm.fileUri, designForm.fileName, designForm.mimeType);

      const newDesignFile = {
        id: `file_${new Date().getTime()}`,
        name: designForm.name.trim(),
        category: designForm.category,
        fileType: designForm.fileType,
        url: uploadedUrl,
        uploadedAt: new Date()
      };

      const updatedDesigns = [...(existingDesigns || []), newDesignFile];

      const updatePayload = {
        status: 'Under Drawing',
        designFiles: updatedDesigns
      };

      await interiorCrmService.updateCustomer(customerId, updatePayload);

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'Status Change',
        status: 'Completed',
        remarks: `Uploaded ${designForm.category} design file: ${designForm.name}`,
        completedDate: new Date()
      });

      // Reset form
      setDesignForm({ name: '', category: '2D', fileType: 'image', fileUri: '', fileName: '', mimeType: '' });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error uploading design:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload design file. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>

        {/* Full-screen image preview overlay */}
        {imagePreviewVisible && designForm.fileUri && designForm.fileType === 'image' && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setImagePreviewVisible(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setImagePreviewVisible(false)}
                style={{ position: 'absolute', top: 48, right: 16, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 8 }}
              >
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
              <Image
                source={{ uri: designForm.fileUri }}
                style={{ width: '100%', height: '80%', resizeMode: 'contain' }}
              />
              <Text style={{ color: '#94A3B8', fontSize: 12, fontFamily: 'Inter-Regular', marginTop: 12 }} numberOfLines={1}>
                {designForm.fileName}
              </Text>
            </View>
          </Modal>
        )}

        <View style={s.modalContent}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Upload Design File</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalBody} contentContainerStyle={{ padding: 16 }}>
            
            <View style={s.inputContainer}>
              <Text style={s.label}>File Name / Title *</Text>
              <TextInput 
                style={s.input} 
                placeholder="e.g. Master Bedroom 3D View v2" 
                placeholderTextColor="#94A3B8" 
                value={designForm.name} 
                onChangeText={(v) => setDesignForm({ ...designForm, name: v })} 
              />
            </View>

            <View style={s.inputContainer}>
              <Text style={s.label}>Category</Text>
              <View style={s.chipOptions}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity 
                    key={cat} 
                    style={[s.optionChip, designForm.category === cat && s.optionChipActive]} 
                    onPress={() => setDesignForm({ ...designForm, category: cat })}
                  >
                    <Text style={[s.optionChipText, designForm.category === cat && s.optionChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.inputContainer}>
              <Text style={s.label}>File Type</Text>
              <View style={s.chipOptions}>
                {FILE_TYPES.map((t) => (
                  <TouchableOpacity 
                    key={t} 
                    style={[s.optionChip, designForm.fileType === t && s.optionChipActive]} 
                    onPress={() => setDesignForm({ ...designForm, fileType: t })}
                  >
                    <Text style={[s.optionChipText, designForm.fileType === t && s.optionChipTextActive]}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.inputContainer}>
              <Text style={s.label}>Upload File *</Text>
              {designForm.fileUri ? (
                <View style={{ borderRadius: 10, overflow: 'hidden', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' }}>
                  {/* Image preview */}
                  {designForm.fileType === 'image' && (
                    <Image
                      source={{ uri: designForm.fileUri }}
                      style={{ width: '100%', height: 180, resizeMode: 'cover' }}
                    />
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
                    <Ionicons
                      name={
                        designForm.fileType === 'image' ? 'image-outline' :
                        designForm.fileType === 'pdf' ? 'document-text-outline' :
                        designForm.fileType === '3d-model' ? 'cube-outline' :
                        designForm.fileType === 'cad' ? 'git-branch-outline' :
                        'document-outline'
                      }
                      size={22}
                      color="#2563EB"
                    />
                    <Text style={{ flex: 1, marginLeft: 8, fontSize: 13, color: '#0F172A', fontFamily: 'Inter-Medium' }} numberOfLines={1}>
                      {designForm.fileName || 'Selected File'}
                    </Text>
                    {/* Preview button — always visible after file is selected */}
                    <TouchableOpacity
                      onPress={() => {
                        if (designForm.fileType === 'image') {
                          setImagePreviewVisible(true);
                        } else {
                          handlePreviewFile(designForm.fileUri);
                        }
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, marginRight: 6 }}
                    >
                      <Ionicons name="eye-outline" size={14} color="#2563EB" />
                      <Text style={{ fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#2563EB', marginLeft: 4 }}>Preview</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setDesignForm({ ...designForm, fileUri: '', fileName: '', mimeType: '' })}>
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

            <View style={{ height: 40 }} />
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={isSubmitting}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Upload File</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#F8FAFC', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A' },
  closeBtn: { padding: 4 },
  modalBody: { flexShrink: 1 },
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#475569', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A', backgroundColor: '#F8FAFC' },
  helpText: { fontSize: 11, color: '#94A3B8', marginTop: 6, fontStyle: 'italic' },
  chipOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  optionChipActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  optionChipText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' },
  optionChipTextActive: { color: '#4F46E5', fontFamily: 'Inter-Bold' },
  footer: { flexDirection: 'row', padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#475569' },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#0284C7', alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFFFFF' }
});

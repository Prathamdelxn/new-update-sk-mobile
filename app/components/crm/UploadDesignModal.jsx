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
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { interiorCrmService } from '../../services/interiorCrmService';
import * as DocumentPicker from 'expo-document-picker';
import cloudinaryService from '../../services/cloudinaryService';

const CATEGORIES = [
  '2D Floor Plan',
  '3D Render',
  'Autocad DWG',
  'Moodboard',
  'Reference Image',
  'Other'
];

const FILE_TYPES = [
  'image',
  'pdf',
  '3d-model',
  'cad',
  'document'
];

export default function UploadDesignModal({ 
  visible, 
  onClose, 
  customerId, 
  existingDesigns = [],
  onSuccess 
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [designForm, setDesignForm] = useState({
    name: '',
    category: '2D Floor Plan',
    fileType: 'image',
    fileUri: '',
    fileName: '',
    mimeType: ''
  });

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setDesignForm({ 
          ...designForm, 
          fileUri: file.uri, 
          fileName: file.name, 
          mimeType: file.mimeType || 'application/octet-stream',
          name: designForm.name ? designForm.name : file.name.split('.')[0]
        });
      }
    } catch (e) {
      console.log('Document picker error:', e);
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
        type: 'Design Upload',
        status: 'Completed',
        remarks: `Uploaded a ${designForm.category}: ${designForm.name}`,
        completedDate: new Date()
      });

      // Reset form
      setDesignForm({ name: '', category: '2D Floor Plan', fileType: 'image', fileUri: '', fileName: '', mimeType: '' });
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
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8 }}>
                  <Ionicons name="document-text" size={24} color="#64748B" />
                  <Text style={{ flex: 1, marginLeft: 8, fontSize: 13, color: '#0F172A', fontFamily: 'Inter-Medium' }} numberOfLines={1}>{designForm.fileName || 'Selected File'}</Text>
                  <TouchableOpacity onPress={() => setDesignForm({ ...designForm, fileUri: '', fileName: '', mimeType: '' })}>
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 8, padding: 20, alignItems: 'center', backgroundColor: '#F8FAFC' }}
                  onPress={pickDocument}
                >
                  <Ionicons name="cloud-upload-outline" size={32} color="#94A3B8" />
                  <Text style={{ marginTop: 8, color: '#64748B', fontFamily: 'Inter-Medium', fontSize: 13 }}>Tap to select file from device</Text>
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

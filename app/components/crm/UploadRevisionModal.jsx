import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { interiorCrmService } from '../../services/interiorCrmService';
import cloudinaryService from '../../services/cloudinaryService';

function userLabel(u) {
  if (!u) return 'User';
  const name = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || 'User';
  return `${name}${u.role?.name || u.role ? ` (${u.role?.name || u.role})` : ''}`;
}

function detectFileType(fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'hdr', 'exr'].includes(ext)) return 'image';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['dwg', 'skp', 'obj', 'fbx', '3ds', 'dae', 'blend', 'rvt', 'rfa', 'ifc', 'gltf', 'glb', 'max'].includes(ext)) return '3d-model';
  if (['dxf'].includes(ext)) return 'cad';
  return 'document';
}

export default function UploadRevisionModal({ isOpen, onClose, customerId, drawing, users = [], onSuccess }) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedReviewer, setAssignedReviewer] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && drawing) {
      setTitle(drawing.title || drawing.name || '');
      setNotes('');
      setAssignedReviewer(drawing.assignedReviewer?._id || drawing.assignedReviewer || '');
      setSelectedFile(null);
      setShowDropdown(false);
    }
  }, [isOpen, drawing]);

  if (!isOpen || !drawing) return null;

  const drawingId = drawing._id || drawing.id;
  const nextVersion = (drawing.currentVersion || 1) + 1;

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile({
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType || 'application/octet-stream',
          fileType: detectFileType(file.name),
        });
      }
    } catch (e) {
      Alert.alert('Picker Error', 'Failed to pick file from device.');
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      Alert.alert('File Required', 'Please select the revised drawing file to upload.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for this drawing.');
      return;
    }
    setSubmitting(true);
    try {
      const url = await cloudinaryService.uploadFile(selectedFile.uri, selectedFile.name, selectedFile.mimeType);
      const reviewer = users.find((u) => (u._id || u.id) === assignedReviewer);
      await interiorCrmService.uploadDrawingVersion(customerId, drawingId, {
        name: title.trim(),
        url,
        fileType: selectedFile.fileType,
        category: drawing.category || '2D',
        internalNotes: notes.trim(),
        assignedReviewer: assignedReviewer || undefined,
        assignedReviewerName: reviewer ? userLabel(reviewer) : undefined,
      });
      onSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to upload revision.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Upload Revision (v{nextVersion})</Text>
              <Text style={s.subtitle} numberOfLines={1}>{drawing.title || drawing.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {!!drawing.rejectionReason && (
              <View style={s.noticeBox}>
                <Text style={s.noticeLabel}>WHY THIS WAS REJECTED</Text>
                <Text style={s.noticeText}>{drawing.rejectionReason}</Text>
              </View>
            )}
            {!!drawing.clientFeedback && (
              <View style={[s.noticeBox, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                <Text style={[s.noticeLabel, { color: '#B45309' }]}>CLIENT FEEDBACK</Text>
                <Text style={s.noticeText}>{drawing.clientFeedback}</Text>
              </View>
            )}

            <View style={s.infoBanner}>
              <Ionicons name="information-circle-outline" size={14} color="#0284C7" />
              <Text style={s.infoBannerText}>Uploading a revision will set this drawing's status to Pending Internal Approval.</Text>
            </View>

            <Text style={s.label}>Drawing Title / Label *</Text>
            <TextInput style={s.input} placeholder="e.g. Master Bedroom 3D View" placeholderTextColor="#94A3B8" value={title} onChangeText={setTitle} />

            <Text style={s.label}>Revision File *</Text>
            {selectedFile ? (
              <View style={{ borderRadius: 10, overflow: 'hidden', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' }}>
                {selectedFile.fileType === 'image' && (
                  <Image source={{ uri: selectedFile.uri }} style={{ width: '100%', height: 140, resizeMode: 'cover' }} />
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
                  <Ionicons name="document-outline" size={20} color="#2563EB" />
                  <Text style={{ flex: 1, marginLeft: 8, fontSize: 13, color: '#0F172A', fontFamily: 'Inter-Medium' }} numberOfLines={1}>{selectedFile.name}</Text>
                  <TouchableOpacity onPress={() => setSelectedFile(null)}>
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={s.uploadBox} onPress={pickDocument}>
                <Ionicons name="cloud-upload-outline" size={26} color="#0284C7" />
                <Text style={s.uploadBoxText}>Tap to select revised file</Text>
              </TouchableOpacity>
            )}

            <Text style={s.label}>Reassign Reviewer (Optional)</Text>
            <TouchableOpacity style={s.dropdownBtn} onPress={() => setShowDropdown((v) => !v)}>
              <Text style={[s.dropdownBtnText, !assignedReviewer && { color: '#94A3B8' }]} numberOfLines={1}>
                {assignedReviewer ? userLabel(users.find((u) => (u._id || u.id) === assignedReviewer) || {}) : 'Keep previous / select reviewer'}
              </Text>
              <Ionicons name={showDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
            </TouchableOpacity>
            {showDropdown && (
              <View style={s.dropdownMenu}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 160 }}>
                  {users.map((u) => {
                    const uid = u._id || u.id;
                    const active = assignedReviewer === uid;
                    return (
                      <TouchableOpacity key={uid} style={s.dropdownItem} onPress={() => { setAssignedReviewer(uid); setShowDropdown(false); }}>
                        <Text style={[s.dropdownItemText, active && s.dropdownItemTextActive]}>{userLabel(u)}</Text>
                        {active && <Ionicons name="checkmark" size={14} color="#2563EB" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <Text style={s.label}>Revision Changelog / Notes</Text>
            <TextInput
              style={[s.input, { height: 70, textAlignVertical: 'top' }]}
              multiline
              placeholder="What changed in this revision..."
              placeholderTextColor="#94A3B8"
              value={notes}
              onChangeText={setNotes}
            />

            <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Upload Revision v{nextVersion}</Text>}
            </TouchableOpacity>
            <View style={{ height: 10 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  title: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  subtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  noticeBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 10 },
  noticeLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#DC2626', letterSpacing: 0.3 },
  noticeText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#334155', marginTop: 4, lineHeight: 17 },

  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', borderRadius: 10, padding: 10, marginBottom: 14 },
  infoBannerText: { flex: 1, fontSize: 11, fontFamily: 'Inter-Medium', color: '#0369A1', lineHeight: 15 },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },

  uploadBox: { borderWidth: 1.5, borderColor: '#BAE6FD', borderStyle: 'dashed', borderRadius: 12, padding: 18, alignItems: 'center', backgroundColor: '#F0F9FF', gap: 4 },
  uploadBoxText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#0284C7' },

  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  dropdownBtnText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A', flex: 1, marginRight: 8 },
  dropdownMenu: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownItemText: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: '#334155', flex: 1, marginRight: 8 },
  dropdownItemTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#0284C7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { interiorCrmService } from '../../services/interiorCrmService';

function userLabel(u) {
  if (!u) return 'User';
  const name = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || 'User';
  return `${name}${u.role?.name || u.role ? ` (${u.role?.name || u.role})` : ''}`;
}

export default function SendDrawingForApprovalModal({ isOpen, onClose, customerId, drawing, users = [], onSuccess }) {
  const [assignedReviewer, setAssignedReviewer] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAssignedReviewer('');
      setShowDropdown(false);
    }
  }, [isOpen, drawing]);

  if (!isOpen || !drawing) return null;

  const drawingId = drawing._id || drawing.id;

  const handleSubmit = async () => {
    if (!assignedReviewer) {
      Alert.alert('Reviewer Required', 'Please select a team member to review this drawing.');
      return;
    }
    const reviewer = users.find((u) => (u._id || u.id) === assignedReviewer);
    setSubmitting(true);
    try {
      await interiorCrmService.sendDrawingForApproval(customerId, drawingId, {
        assignedReviewer,
        assignedReviewerName: reviewer ? userLabel(reviewer) : undefined,
        versionNumber: drawing.currentVersion || 1,
      });
      onSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to send drawing for approval.');
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
              <Text style={s.title}>Send Drawing for Approval</Text>
              <Text style={s.subtitle}>Assign an internal reviewer before it can be published to the client.</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.previewCard}>
              <Ionicons name="document-text-outline" size={18} color="#0284C7" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.previewTitle} numberOfLines={1}>{drawing.title || drawing.name}</Text>
                <Text style={s.previewSub}>{drawing.category || '2D'} • v{drawing.currentVersion || 1} • {drawing.roomTag || 'General / Not Specified'}</Text>
              </View>
            </View>

            <Text style={s.label}>Select Approver / Reviewer *</Text>
            <TouchableOpacity style={s.dropdownBtn} onPress={() => setShowDropdown((v) => !v)}>
              <Text style={[s.dropdownBtnText, !assignedReviewer && { color: '#94A3B8' }]} numberOfLines={1}>
                {assignedReviewer ? userLabel(users.find((u) => (u._id || u.id) === assignedReviewer) || {}) : 'Select reviewer'}
              </Text>
              <Ionicons name={showDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
            </TouchableOpacity>
            {showDropdown && (
              <View style={s.dropdownMenu}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
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

            <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Send for Approval</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  title: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  subtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2, maxWidth: 260 },

  previewCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', borderRadius: 12, padding: 12, marginBottom: 14 },
  previewTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  previewSub: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6 },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  dropdownBtnText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A', flex: 1, marginRight: 8 },
  dropdownMenu: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownItemText: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: '#334155', flex: 1, marginRight: 8 },
  dropdownItemTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#0284C7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { interiorCrmService } from '../../services/interiorCrmService';

const LOST_REASON_CATEGORIES = [
  { value: 'Budget', label: 'Budget / High Pricing' },
  { value: 'Competitor', label: 'Chose Competitor' },
  { value: 'No Response', label: 'No Response / Client Inactive' },
  { value: 'Possession Delayed', label: 'Possession Delayed' },
  { value: 'Cancelled', label: 'Project Cancelled / Dropped' },
  { value: 'Other', label: 'Other Reason' },
];

export default function MarkLostModal({
  visible,
  onClose,
  customerId,
  leadName,
  onSuccess
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reasonCategory, setReasonCategory] = useState('Budget');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setReasonCategory('Budget');
      setReason('');
      setError(null);
    }
  }, [visible]);

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Reason for loss is required');
      return;
    }
    if (trimmed.length < 3) {
      setError('Please provide at least 3 characters for the reason');
      return;
    }
    setIsSubmitting(true);
    try {
      await interiorCrmService.updateCustomer(customerId, {
        status: 'Lost',
        lostReason: reasonCategory,
        remarks: trimmed,
      });

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'Status Change',
        status: 'Completed',
        remarks: `Lead marked as Lost (${reasonCategory}): ${trimmed}`,
        completedDate: new Date()
      });

      setReason('');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error marking as lost:', error);
      Alert.alert('Error', error.message || 'Failed to mark lead as lost.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
        <View style={s.modalContent}>
          <View style={s.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={s.iconBox}>
                <Ionicons name="sad-outline" size={24} color="#E11D48" />
              </View>
              <View>
                <Text style={s.modalTitle}>Mark as Lost</Text>
                <Text style={s.modalSubtitle}>Move lead to lost stage</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={s.modalBody}>
            <View style={s.warningBox}>
              <Ionicons name="alert-circle-outline" size={20} color="#BE123C" />
              <Text style={s.warningText}>
                You are about to mark <Text style={{ fontFamily: 'Inter-Bold' }}>{leadName || 'this lead'}</Text> as Lost. They will be moved to the Lost Leads tab.
              </Text>
            </View>

            <View style={s.inputContainer}>
              <Text style={s.label}>Loss Reason Category *</Text>
              <View style={s.chipsRow}>
                {LOST_REASON_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[s.chip, reasonCategory === cat.value && s.chipActive]}
                    onPress={() => setReasonCategory(cat.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.chipText, reasonCategory === cat.value && s.chipTextActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.inputContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={s.label}>Reason & Notes *</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Inter-Bold', color: '#E11D48' }}>Required</Text>
              </View>
              <TextInput
                style={[s.inputArea, error && { borderColor: '#E11D48' }]}
                placeholder="Explain why the lead was lost (e.g., Client finalized another vendor with lower quotation)..."
                placeholderTextColor="#94A3B8"
                value={reason}
                onChangeText={(t) => { setReason(t); if (error) setError(null); }}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              {!!error && <Text style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#E11D48', marginTop: 4 }}>{error}</Text>}
            </View>
          </View>

          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={isSubmitting}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Confirm Lost</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF1F2', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSubtitle: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },
  closeBtn: { padding: 8, backgroundColor: '#F8FAFC', borderRadius: 12 },
  modalBody: { padding: 20 },
  warningBox: { flexDirection: 'row', backgroundColor: '#FFF1F2', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FFE4E6', gap: 12, marginBottom: 16 },
  warningText: { flex: 1, fontSize: 13, color: '#BE123C', fontFamily: 'Inter-Medium', lineHeight: 20 },
  inputContainer: { marginBottom: 8 },
  label: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECACA',
  },
  chipText: {
    fontSize: 11.5,
    fontFamily: 'Inter-Medium',
    color: '#475569',
  },
  chipTextActive: {
    color: '#E11D48',
    fontFamily: 'Inter-Bold',
  },
  inputArea: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 13.5, fontFamily: 'Inter-Medium', color: '#0F172A', backgroundColor: '#F8FAFC', minHeight: 90 },
  footer: { flexDirection: 'row', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 12, backgroundColor: '#F8FAFC' },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  cancelBtnText: { color: '#64748B', fontSize: 15, fontFamily: 'Inter-Bold' },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E11D48', elevation: 2, shadowColor: '#E11D48', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-Bold' }
});

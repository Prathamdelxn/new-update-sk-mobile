import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { interiorCrmService } from '../../services/interiorCrmService';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const VERSION_STATUS_META = {
  draft: { label: 'Draft', color: '#64748B', bg: '#F1F5F9' },
  pending_internal_approval: { label: 'Pending Approval', color: '#D97706', bg: '#FFFBEB' },
  internally_approved: { label: 'Approved', color: '#16A34A', bg: '#F0FDF4' },
  internally_rejected: { label: 'Rejected', color: '#DC2626', bg: '#FEF2F2' },
};

export default function DrawingApprovalModal({ isOpen, onClose, customerId, drawing, initialAction = 'approve', onSuccess }) {
  const [isRejectMode, setIsRejectMode] = useState(initialAction === 'reject');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRejectMode(initialAction === 'reject');
      setRejectionReason('');
    }
  }, [isOpen, drawing, initialAction]);

  if (!isOpen || !drawing) return null;

  const drawingId = drawing._id || drawing.id;
  const currentVersion = drawing.currentVersion || 1;
  const versions = (drawing.versions || []).slice().sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0));

  const handleDecision = async (action) => {
    if (action === 'reject' && !rejectionReason.trim()) {
      Alert.alert('Reason Required', 'Please describe why this drawing is being rejected.');
      return;
    }
    setSubmitting(true);
    try {
      await interiorCrmService.approveDrawing(customerId, drawingId, {
        action,
        versionNumber: currentVersion,
        internalNotes: action === 'reject' ? rejectionReason.trim() : undefined,
      });
      onSuccess(action);
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message || `Failed to ${action} drawing.`);
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
              <Text style={s.title}>{isRejectMode ? 'Reject Drawing' : 'Review & Approve Drawing'}</Text>
              <Text style={s.subtitle} numberOfLines={1}>{drawing.title || drawing.name} • v{currentVersion}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {!isRejectMode ? (
              <>
                {!!drawing.rejectionReason && (
                  <View style={[s.noticeBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                    <Text style={[s.noticeLabel, { color: '#DC2626' }]}>PREVIOUS REJECTION REASON</Text>
                    <Text style={s.noticeText}>{drawing.rejectionReason}</Text>
                  </View>
                )}
                {!!drawing.clientFeedback && (
                  <View style={[s.noticeBox, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                    <Text style={[s.noticeLabel, { color: '#B45309' }]}>CLIENT FEEDBACK</Text>
                    <Text style={s.noticeText}>{drawing.clientFeedback}</Text>
                  </View>
                )}

                {versions.length > 0 && (
                  <>
                    <Text style={s.sectionLabel}>VERSION HISTORY</Text>
                    <View style={{ gap: 8, marginBottom: 8 }}>
                      {versions.map((v) => {
                        const meta = VERSION_STATUS_META[v.approvalStatus] || VERSION_STATUS_META.draft;
                        return (
                          <View key={v.versionNumber} style={s.versionRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.versionRowTitle}>v{v.versionNumber}{v.versionNumber === currentVersion ? ' (Latest)' : ''}</Text>
                              <Text style={s.versionRowSub}>{fmtDate(v.uploadedAt)}</Text>
                            </View>
                            <View style={[s.statusPill, { backgroundColor: meta.bg }]}>
                              <Text style={[s.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity style={[s.rejectBtn, { flex: 1 }]} onPress={() => setIsRejectMode(true)} disabled={submitting}>
                    <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                    <Text style={s.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.approveBtn, { flex: 1.4 }]} onPress={() => handleDecision('approve')} disabled={submitting}>
                    {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                        <Text style={s.approveBtnText}>Approve & Publish</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={s.label}>Rejection Reason *</Text>
                <TextInput
                  style={[s.input, { height: 90, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="Explain what needs to change before this drawing can be approved..."
                  placeholderTextColor="#94A3B8"
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity style={[s.cancelBtn, { flex: 1 }]} onPress={() => setIsRejectMode(false)} disabled={submitting}>
                    <Text style={s.cancelBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.rejectConfirmBtn, { flex: 1.4 }]} onPress={() => handleDecision('reject')} disabled={submitting}>
                    {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.rejectConfirmBtnText}>Confirm Rejection</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
            <View style={{ height: 10 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  title: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  subtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  noticeBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  noticeLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', letterSpacing: 0.3 },
  noticeText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#334155', marginTop: 4, lineHeight: 17 },

  sectionLabel: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3, marginBottom: 8, marginTop: 4 },
  versionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 10, padding: 10 },
  versionRowTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  versionRowSub: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 9.5, fontFamily: 'Inter-Bold' },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },

  approveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 13 },
  approveBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  rejectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, paddingVertical: 13 },
  rejectBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#DC2626' },
  rejectConfirmBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 13 },
  rejectConfirmBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  cancelBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 13 },
  cancelBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#475569' },
});

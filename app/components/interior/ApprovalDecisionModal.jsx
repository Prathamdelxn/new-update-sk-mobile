// Approve / Reject review sheet shared by project Drawings and BOQ
// (web: InteriorProjectDrawingApprovalModal / InteriorProjectBoqApprovalModal).
// Approve mode shows a sign-off confirmation; "Request Changes" switches to reject mode, which
// needs a reason. All wording is passed in so each screen matches its web modal.
import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ApprovalDecisionModal({
  visible,
  onClose,
  approveTitle = 'Verify & Approve',
  approveSubtitle,
  rejectTitle = 'Request Changes / Reject',
  rejectSubtitle,
  summary = null,
  submissionNotes,
  submissionNotesLabel = 'Submission Notes:',
  pastRejection,
  pastRejectionLabel = 'Previous Rejection Reason:',
  initialAction = null, // 'approve' | 'reject' | null
  rejectPlaceholder = 'Specify what needs to be changed…',
  rejectHint,
  confirmTitle = 'Confirm Approval',
  confirmText,
  approveLabel = 'Approve',
  backLabel = '← Back to Approve Options',
  rejectMissingMessage = 'Please provide a rejection reason explaining the required changes.',
  rejectLabel = 'Reason for Rejection / Changes Required',
  rejectMaxLength, // optional cap with a "n/max" counter (web BOQ: 500)
  onDecision, // async (action, reason)
}) {
  const insets = useSafeAreaInsets();
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setIsRejectMode(initialAction === 'reject');
      setReason('');
      setError('');
    }
  }, [visible, initialAction]);

  const run = async (action) => {
    if (action === 'reject' && !reason.trim()) {
      setError(rejectMissingMessage);
      inputRef.current?.focus();
      return;
    }
    if (action === 'reject' && rejectMaxLength && reason.trim().length > rejectMaxLength) {
      setError(`Rejection reason cannot exceed ${rejectMaxLength} characters.`);
      inputRef.current?.focus();
      return;
    }
    setError('');
    setBusy(action);
    try {
      await onDecision(action, reason.trim());
      onClose();
    } catch (e) {
      setError(e?.message || 'Failed to update approval status');
    } finally {
      setBusy(null);
    }
  };

  const tone = isRejectMode
    ? { bg: '#FFF1F2', border: '#FECDD3', color: '#E11D48', icon: 'close-circle-outline' }
    : { bg: '#ECFDF5', border: '#A7F3D0', color: '#059669', icon: 'shield-checkmark-outline' };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !busy && onClose()}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
        <View style={[s.card, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.header}>
            <View style={[s.headerIcon, { backgroundColor: tone.bg, borderColor: tone.border }]}>
              <Ionicons name={tone.icon} size={18} color={tone.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{isRejectMode ? rejectTitle : approveTitle}</Text>
              {!!(isRejectMode ? rejectSubtitle : approveSubtitle) && (
                <Text style={s.subtitle} numberOfLines={2}>{isRejectMode ? rejectSubtitle : approveSubtitle}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} disabled={!!busy}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {summary}

            {!!submissionNotes && (
              <View style={s.noteBox}>
                <View style={s.noteLabelRow}>
                  <Ionicons name="chatbox-ellipses-outline" size={12} color="#2563EB" />
                  <Text style={s.noteLabel}>{submissionNotesLabel}</Text>
                </View>
                <Text style={s.noteText}>{submissionNotes}</Text>
              </View>
            )}

            {!!pastRejection && (
              <View style={[s.noteBox, { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]}>
                <View style={s.noteLabelRow}>
                  <Ionicons name="alert-circle-outline" size={12} color="#E11D48" />
                  <Text style={[s.noteLabel, { color: '#BE123C' }]}>{pastRejectionLabel}</Text>
                </View>
                <Text style={s.noteText}>{pastRejection}</Text>
              </View>
            )}

            {isRejectMode ? (
              <>
                <View style={s.labelRow}>
                  <Ionicons name="chatbox-ellipses-outline" size={13} color="#E11D48" />
                  <Text style={[s.label, { flex: 1 }]}>{rejectLabel} <Text style={{ color: '#F43F5E' }}>*</Text></Text>
                  {!!rejectMaxLength && <Text style={s.counter}>{reason.length}/{rejectMaxLength}</Text>}
                </View>
                <TextInput
                  ref={inputRef}
                  maxLength={rejectMaxLength || undefined}
                  style={s.textarea}
                  multiline
                  autoFocus
                  value={reason}
                  onChangeText={(v) => { setReason(v); setError(''); }}
                  placeholder={rejectPlaceholder}
                  placeholderTextColor="#94A3B8"
                />
                {!!rejectHint && <Text style={s.hint}>{rejectHint}</Text>}
              </>
            ) : (
              <View style={s.confirmBox}>
                <View style={s.noteLabelRow}>
                  <Ionicons name="checkmark-circle" size={15} color="#059669" />
                  <Text style={s.confirmTitle}>{confirmTitle}</Text>
                </View>
                {!!confirmText && <Text style={s.confirmText}>{confirmText}</Text>}
              </View>
            )}

            {!!error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <View style={s.footer}>
              {isRejectMode ? (
                <TouchableOpacity onPress={() => { setIsRejectMode(false); setError(''); }} disabled={!!busy} style={s.linkBtn}>
                  <Text style={s.linkBtnText}>{backLabel}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => { setIsRejectMode(true); setError(''); }} disabled={!!busy} style={[s.linkBtn, s.requestBtn]}>
                  <Ionicons name="close-circle-outline" size={14} color="#E11D48" />
                  <Text style={[s.linkBtnText, { color: '#E11D48' }]}>Request Changes</Text>
                </TouchableOpacity>
              )}
              <View style={s.footerRight}>
                <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={!!busy}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                {isRejectMode ? (
                  <TouchableOpacity
                    style={[s.primaryBtn, { backgroundColor: '#E11D48' }, (busy || !reason.trim()) && { opacity: 0.6 }]}
                    onPress={() => run('reject')}
                    disabled={!!busy || !reason.trim()}
                  >
                    {busy === 'reject' && <ActivityIndicator size="small" color="#FFFFFF" />}
                    <Text style={s.primaryText}>{busy === 'reject' ? 'Rejecting...' : 'Confirm Rejection'}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[s.primaryBtn, busy && { opacity: 0.6 }]} onPress={() => run('approve')} disabled={!!busy}>
                    {busy === 'approve' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
                    )}
                    <Text style={s.primaryText} numberOfLines={1}>{busy === 'approve' ? 'Approving...' : approveLabel}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerIcon: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  subtitle: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  closeBtn: { padding: 4 },
  noteBox: { marginTop: 10, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 10, padding: 10 },
  noteLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  noteLabel: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#1D4ED8' },
  noteText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#334155', marginTop: 4, lineHeight: 17 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 6 },
  label: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#1E293B', flexShrink: 1 },
  textarea: {
    minHeight: 96, textAlignVertical: 'top', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FECDD3',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },
  counter: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  hint: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 6, lineHeight: 15 },
  confirmBox: { marginTop: 12, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 12, padding: 12 },
  confirmTitle: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#065F46' },
  confirmText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#047857', marginTop: 6, lineHeight: 16 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#FEF2F2', padding: 10, borderRadius: 10 },
  errorText: { flex: 1, fontSize: 12, fontFamily: 'Inter-Medium', color: '#DC2626' },
  footer: { marginTop: 18, gap: 10 },
  footerRight: { flexDirection: 'row', gap: 10 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 6 },
  requestBtn: { backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3', borderRadius: 10, paddingHorizontal: 10 },
  linkBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#475569' },
  cancelBtn: { flex: 1, height: 46, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#334155' },
  primaryBtn: { flex: 1.6, height: 46, borderRadius: 12, backgroundColor: '#059669', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  primaryText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF', flexShrink: 1 },
});

// "Send for Approval" sheet shared by project Drawings and BOQ
// (web: InteriorProjectSendDrawingForApprovalModal / InteriorProjectSendBoqForApprovalModal).
// Pick a reviewer from the project team, add notes, and hand them to onSubmit. All wording is
// passed in so each screen shows the same text as its web modal.
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SelectField from '../common/SelectField';
import { reviewerOptions } from '../../utils/interior/projectReviewers';

export default function SendForApprovalModal({
  visible,
  onClose,
  title = 'Send for Approval',
  subtitle,
  summary = null,
  users = [],
  initialReviewer = '',
  reviewerLabel = 'Select Approver / Reviewer',
  reviewerHint,
  notesLabel = 'Submission Notes (Optional)',
  notesPlaceholder = 'Add notes for the reviewer…',
  submitLabel = 'Send for Approval',
  submittingLabel = 'Sending...',
  notesMaxLength, // optional cap with a "n/max" counter (web BOQ: 500)
  onSubmit,
}) {
  const insets = useSafeAreaInsets();
  const [reviewer, setReviewer] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setReviewer(initialReviewer ? String(initialReviewer?._id || initialReviewer) : '');
      setNotes('');
      setError('');
    }
  }, [visible, initialReviewer]);

  const handleSubmit = async () => {
    if (!reviewer) {
      setError('Please select an approver/manager from the team.');
      return;
    }
    if (notesMaxLength && notes.trim().length > notesMaxLength) {
      setError(`Submission remarks cannot exceed ${notesMaxLength} characters.`);
      return;
    }
    const picked = users.find((u) => u.id === reviewer);
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ reviewerId: reviewer, reviewerName: picked?.name || 'Project Manager', notes: notes.trim() });
      onClose();
    } catch (e) {
      setError(e?.message || 'Failed to send for approval');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !submitting && onClose()}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
        <View style={[s.card, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Ionicons name="paper-plane-outline" size={18} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{title}</Text>
              {!!subtitle && <Text style={s.subtitle} numberOfLines={2}>{subtitle}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} disabled={submitting}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {summary}

            <View style={s.labelRow}>
              <Ionicons name="person-outline" size={13} color="#2563EB" />
              <Text style={s.label}>{reviewerLabel} <Text style={{ color: '#F43F5E' }}>*</Text></Text>
            </View>
            {users.length === 0 ? (
              <Text style={s.hintWarn}>No team members found. Add members to this project first.</Text>
            ) : (
              <SelectField
                value={reviewer}
                onChange={(v) => { setReviewer(v); setError(''); }}
                options={reviewerOptions(users)}
                placeholder="-- Choose Reviewer --"
              />
            )}
            {!!reviewerHint && <Text style={s.hint}>{reviewerHint}</Text>}

            <View style={s.labelRow}>
              <Ionicons name="chatbox-ellipses-outline" size={13} color="#2563EB" />
              <Text style={[s.label, { flex: 1 }]}>{notesLabel}</Text>
              {!!notesMaxLength && <Text style={s.counter}>{notes.length}/{notesMaxLength}</Text>}
            </View>
            <TextInput
              style={s.textarea}
              maxLength={notesMaxLength || undefined}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder={notesPlaceholder}
              placeholderTextColor="#94A3B8"
            />

            {!!error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <View style={s.footer}>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={submitting}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submitBtn, (submitting || !reviewer) && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting || !reviewer}
              >
                {submitting ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={s.submitText}>{submittingLabel}</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={14} color="#FFFFFF" />
                    <Text style={s.submitText}>{submitLabel}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Shared building blocks for the summary card shown at the top of both approval sheets
export const approvalStyles = StyleSheet.create({
  summaryBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, gap: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  summaryTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A', flexShrink: 1 },
  summaryLabel: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' },
  summaryValue: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A', flexShrink: 0, textAlign: 'right' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#475569', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  reviewerChip: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#B45309', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
});

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  subtitle: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  closeBtn: { padding: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 6 },
  label: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#1E293B' },
  counter: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  hint: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 6, lineHeight: 15 },
  hintWarn: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#B45309', backgroundColor: '#FFFBEB', padding: 10, borderRadius: 10 },
  textarea: {
    minHeight: 80, textAlignVertical: 'top', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#FEF2F2', padding: 10, borderRadius: 10 },
  errorText: { flex: 1, fontSize: 12, fontFamily: 'Inter-Medium', color: '#DC2626' },
  footer: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#334155' },
  submitBtn: { flex: 1.4, height: 46, borderRadius: 12, backgroundColor: '#2563EB', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

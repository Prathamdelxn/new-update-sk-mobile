// "Email Design Questionnaire" sheet (web: InteriorSendRequirementsModal).
// Emails the client requirements intake link through the server (POST /crm/customers/:id/share/email),
// with WhatsApp / mail-app fallbacks and a "Stop Link" option.
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { interiorCrmService } from '../../services/interiorCrmService';
import { useToast } from '../../context/ToastContext';
import { WEB_APP_URL } from '../../config';

const EXPIRY_CHOICES = [
  { label: '7 Days', val: 7, desc: 'Recommended' },
  { label: '14 Days', val: 14, desc: '2 Weeks' },
  { label: '30 Days', val: 30, desc: '1 Month' },
  { label: 'No Expiry', val: null, desc: 'Always Active' },
];

export default function SendRequirementsEmailModal({ visible, onClose, lead, onSuccess }) {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [expiresDays, setExpiresDays] = useState(7);
  const [shareToken, setShareToken] = useState('');
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailError, setEmailError] = useState('');

  const requirementsUrl = shareToken ? `${WEB_APP_URL}/share/requirements/${shareToken}` : '';

  useEffect(() => {
    if (!visible || !lead) return;
    const leadName = lead.name || 'Client';
    const firstName = leadName.split(' ')[0];
    setRecipientEmail(lead.email || '');
    setEmailError('');
    setCopied(false);
    setExpiresDays(7);
    setCustomSubject(`✨ Complete Your Interior Design Wishlist - ${leadName} | SkyStruct Interior`);
    setCustomMessage(
      `Hi ${firstName},\n\nWe are excited to begin designing your dream space! Please take 3 minutes to complete your interactive design questionnaire. You can select your favorite interior styles, detail your room-by-room wishlist, and upload inspiration photos so our design team can craft tailored 2D plans and 3D renders for you.\n\nWarm regards,\nDesign Team`
    );

    const existingToken = lead.shareSettings?.shareToken;
    if (existingToken) {
      setShareToken(existingToken);
    } else if (lead._id) {
      // Make sure a requirements token exists so the link can be previewed / copied
      setIsLoadingToken(true);
      interiorCrmService
        .generateShareLink(lead._id, { mode: 'requirements', includeRequirements: true, allowDownload: false })
        .then((res) => setShareToken(res?.data?.shareToken || res?.shareToken || ''))
        .catch((e) => console.warn('Failed to ensure requirements token:', e))
        .finally(() => setIsLoadingToken(false));
    }
  }, [visible, lead]);

  const handleCopy = async () => {
    if (!requirementsUrl) return;
    await Clipboard.setStringAsync(requirementsUrl);
    setCopied(true);
    showToast('Requirements link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendEmail = async () => {
    const trimmed = recipientEmail.trim();
    if (!trimmed) {
      setEmailError('Please enter a recipient email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError('');
    setIsSubmitting(true);
    try {
      const res = await interiorCrmService.sendRequirementsEmail(lead._id, {
        recipientEmail: trimmed,
        customSubject: customSubject.trim(),
        customMessage: customMessage.trim(),
        requirementsUrl: requirementsUrl || undefined,
        expiresDays,
      });
      showToast(res?.data?.message || res?.message || `Requirements link successfully emailed to ${trimmed}!`, 'success');
      onSuccess?.();
      onClose();
    } catch (e) {
      showToast(e?.message || 'Failed to send email. Please verify SMTP configuration.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStopLink = () => {
    Alert.alert('Stop Link', 'Are you sure you want to stop this link? Anyone attempting to open it will be blocked.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop Link',
        style: 'destructive',
        onPress: async () => {
          setIsRevoking(true);
          try {
            await interiorCrmService.revokeShareLink(lead._id);
            showToast('Requirements link stopped and access revoked.', 'success');
            onSuccess?.();
            onClose();
          } catch (e) {
            showToast(e?.message || 'Failed to stop link', 'error');
          } finally {
            setIsRevoking(false);
          }
        },
      },
    ]);
  };

  const handleMailto = () => {
    if (!requirementsUrl) return;
    const body = `${customMessage}\n\n👉 Complete Your Design Questionnaire here:\n${requirementsUrl}`;
    Linking.openURL(
      `mailto:${recipientEmail.trim()}?subject=${encodeURIComponent(customSubject)}&body=${encodeURIComponent(body)}`
    ).catch(() => showToast('Could not open the email app.', 'error'));
  };

  const handleWhatsApp = () => {
    if (!requirementsUrl) return;
    const clientName = (lead?.name || 'there').split(' ')[0];
    const message = `Hi ${clientName}! Please share your interior design preferences, room wishlist, and style inspirations using this link: ${requirementsUrl}\n\nOur design team will use your brief to create your custom 2D & 3D designs!`;
    Linking.openURL(`https://wa.me/${String(lead?.mobileNumber || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`)
      .catch(() => showToast('Could not open WhatsApp.', 'error'));
  };

  if (!lead) return null;
  const isStopped = lead.shareSettings?.isPublic === false;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !isSubmitting && onClose()}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
        <View style={[s.card, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Ionicons name="mail-outline" size={20} color="#4F46E5" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={s.title}>Email Design Questionnaire</Text>
                <Text style={s.portalPill}>Client Portal</Text>
              </View>
              <Text style={s.subtitle}>
                Send the self-service requirements questionnaire directly to <Text style={{ fontFamily: 'Inter-Bold' }}>{lead.name}</Text>.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isSubmitting} style={{ padding: 4 }}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.labelRow}>
              <View style={s.labelInline}>
                <Ionicons name="mail-outline" size={13} color="#4F46E5" />
                <Text style={s.label}>Recipient Client Email <Text style={{ color: '#F43F5E' }}>*</Text></Text>
              </View>
              {!!lead.name && <Text style={s.metaText}>{lead.name}</Text>}
            </View>
            <TextInput
              style={[s.input, !!emailError && { borderColor: '#FB7185' }]}
              value={recipientEmail}
              onChangeText={(v) => { setRecipientEmail(v); if (emailError) setEmailError(''); }}
              placeholder="client@example.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {!!emailError && <Text style={s.errorText}>{emailError}</Text>}

            <Text style={[s.label, { marginTop: 14, marginBottom: 6 }]}>Email Subject</Text>
            <TextInput style={s.input} value={customSubject} onChangeText={setCustomSubject} placeholder="Subject line..." placeholderTextColor="#94A3B8" />

            <View style={s.labelRow}>
              <Text style={s.label}>Personal Message / Note from Designer</Text>
            </View>
            <Text style={[s.metaText, { marginBottom: 6 }]}>Appears inside the branded email card</Text>
            <TextInput
              style={[s.input, { minHeight: 110, textAlignVertical: 'top', fontSize: 12, lineHeight: 18 }]}
              value={customMessage}
              onChangeText={setCustomMessage}
              placeholder="Write a personalized note to the client..."
              placeholderTextColor="#94A3B8"
              multiline
            />

            <View style={s.labelRow}>
              <View style={s.labelInline}>
                <Ionicons name="time-outline" size={13} color="#4F46E5" />
                <Text style={s.label}>Link Expiration Period</Text>
              </View>
              <Text style={s.metaText}>{expiresDays === null ? 'Never expires' : `Valid for ${expiresDays} days from dispatch`}</Text>
            </View>
            <View style={s.expiryGrid}>
              {EXPIRY_CHOICES.map((opt) => {
                const active = expiresDays === opt.val;
                return (
                  <TouchableOpacity key={opt.label} style={[s.expiryChip, active && s.expiryChipActive]} onPress={() => setExpiresDays(opt.val)}>
                    <Text style={[s.expiryLabel, active && { color: '#4338CA', fontFamily: 'Inter-Bold' }]}>{opt.label}</Text>
                    <Text style={[s.expiryDesc, active && { color: '#4338CA' }]}>{opt.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!isStopped && !!shareToken && (
              <View style={s.stopBox}>
                <View style={{ flex: 1 }}>
                  <Text style={s.stopTitle}>Need to disable this link?</Text>
                  <Text style={s.stopText}>Stopping the link immediately blocks clients from accessing or submitting preferences.</Text>
                </View>
                <TouchableOpacity style={s.stopBtn} onPress={handleStopLink} disabled={isRevoking}>
                  <Text style={s.stopBtnText}>{isRevoking ? 'Stopping...' : 'Stop Link'}</Text>
                </TouchableOpacity>
              </View>
            )}
            {isStopped && (
              <View style={s.warnBox}>
                <Ionicons name="alert-circle-outline" size={14} color="#D97706" />
                <Text style={s.warnText}>
                  This link is currently <Text style={{ fontFamily: 'Inter-Bold' }}>stopped / disabled</Text>. Sending an email will automatically reactivate it for the client.
                </Text>
              </View>
            )}

            <View style={s.linkBox}>
              <View style={s.labelRow}>
                <View style={s.labelInline}>
                  <Ionicons name="link-outline" size={13} color="#4F46E5" />
                  <Text style={s.label}>Shareable Questionnaire Link</Text>
                </View>
                {isLoadingToken && <Text style={s.metaText}>Generating...</Text>}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={s.linkText} numberOfLines={1}>{requirementsUrl || 'Preparing unique link...'}</Text>
                <TouchableOpacity style={s.smallBtn} onPress={handleCopy} disabled={!requirementsUrl}>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={13} color={copied ? '#10B981' : '#0F172A'} />
                  <Text style={s.smallBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
                </TouchableOpacity>
                {!!requirementsUrl && (
                  <TouchableOpacity style={s.iconBtn} onPress={() => Linking.openURL(requirementsUrl)}>
                    <Ionicons name="open-outline" size={13} color="#0F172A" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.featureRow}>
                <Text style={s.featureText}><Ionicons name="color-palette-outline" size={11} color="#A855F7" /> Visual Theme Picker</Text>
                <Text style={s.featureText}><Ionicons name="sparkles-outline" size={11} color="#F59E0B" /> Pinterest Inspiration</Text>
                <Text style={s.featureText}><Ionicons name="checkmark" size={11} color="#10B981" /> Auto-syncs to CRM</Text>
              </View>
            </View>

            <View style={s.altRow}>
              <Text style={s.metaText}>Alternative dispatch options:</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {!!lead.mobileNumber && (
                  <TouchableOpacity onPress={handleWhatsApp} disabled={!requirementsUrl}>
                    <Text style={[s.altLink, { color: '#059669' }]}>WhatsApp</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleMailto} disabled={!requirementsUrl}>
                  <Text style={s.altLink}>Open in Email App (mailto)</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.footer}>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={isSubmitting}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.sendBtn, (isSubmitting || isLoadingToken) && { opacity: 0.6 }]}
                onPress={handleSendEmail}
                disabled={isSubmitting || isLoadingToken}
              >
                {isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={13} color="#FFFFFF" />}
                <Text style={s.sendText}>{isSubmitting ? 'Sending Email via SMTP...' : 'Send Intake Link via Email'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingBottom: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  portalPill: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#4338CA', backgroundColor: '#E0E7FF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  subtitle: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 3 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6, gap: 8 },
  labelInline: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  label: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  metaText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B' },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A',
  },
  errorText: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#F43F5E', marginTop: 4 },
  expiryGrid: { flexDirection: 'row', gap: 6 },
  expiryChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  expiryChipActive: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  expiryLabel: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  expiryDesc: { fontSize: 9.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  stopBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3', borderRadius: 12, padding: 10 },
  stopTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#881337' },
  stopText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#BE123C', marginTop: 2 },
  stopBtn: { backgroundColor: '#E11D48', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  stopBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  warnBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 10 },
  warnText: { flex: 1, fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#78350F' },
  linkBox: { marginTop: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, paddingTop: 0 },
  linkText: { flex: 1, fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#0F172A', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  smallBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  iconBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 8 },
  featureRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  featureText: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#64748B' },
  altRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  altLink: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#4F46E5' },
  footer: { flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  cancelBtn: { flex: 1, height: 46, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#475569' },
  sendBtn: { flex: 2, height: 46, borderRadius: 12, backgroundColor: '#4F46E5', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  sendText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#FFFFFF', flexShrink: 1 },
});

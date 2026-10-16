import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, StyleSheet, Linking, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { interiorCrmService } from '../../services/interiorCrmService';
import { WEB_APP_URL } from '../../config';

// Hour-based presets (matches backend's `expiresHours` field). A share link
// opened with no settings yet defaults to 1 hour / no downloads — a safe,
// short-lived preview rather than an indefinitely-open link.
const EXPIRY_OPTIONS = [
  { value: '1', label: '1 Hr', hours: 1 },
  { value: '12', label: '12 Hrs', hours: 12 },
  { value: '24', label: '24 Hrs', hours: 24 },
  { value: '168', label: '7 Days', hours: 168 },
  { value: '720', label: '30 Days', hours: 720 },
  { value: 'never', label: 'Never', hours: null },
];

function closestExpiryOption(expiresAt) {
  if (!expiresAt) return 'never';
  const diffHours = Math.round((new Date(expiresAt).getTime() - Date.now()) / (60 * 60 * 1000));
  if (diffHours <= 0) return '1';
  let best = EXPIRY_OPTIONS[0];
  let bestDiff = Infinity;
  for (const opt of EXPIRY_OPTIONS) {
    if (opt.hours === null) continue;
    const diff = Math.abs(opt.hours - diffHours);
    if (diff < bestDiff) { bestDiff = diff; best = opt; }
  }
  return best.value;
}

function countApprovedDrawings(designFiles = []) {
  return designFiles.filter((f) => {
    const status = f?.status;
    if (status === 'internally_approved' || status === 'client_approved') return true;
    return (f.versions || []).some((v) => v.approvalStatus === 'internally_approved');
  }).length;
}

export default function CrmShareModal({ isOpen, onClose, customerId, lead, onSuccess }) {
  const [allowDownload, setAllowDownload] = useState(false);
  const [expiryOption, setExpiryOption] = useState('1');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [autoProvisioned, setAutoProvisioned] = useState(false);

  const shareSettings = lead?.shareSettings;
  const isPublic = !!shareSettings?.isPublic && !!shareSettings?.shareToken;
  const shareUrl = shareSettings?.shareToken ? `${WEB_APP_URL}/share/drawing/${shareSettings.shareToken}` : '';
  const approvedCount = useMemo(() => countApprovedDrawings(lead?.designFiles), [lead?.designFiles]);

  const hoursValue = (opt) => {
    const found = EXPIRY_OPTIONS.find((o) => o.value === opt);
    return found ? found.hours : null;
  };

  const persistSettings = async ({ nextAllowDownload = allowDownload, nextExpiryOption = expiryOption, regenerate = false } = {}) => {
    setLoading(true);
    try {
      await interiorCrmService.generateShareLink(customerId, {
        expiresHours: hoursValue(nextExpiryOption),
        allowDownload: nextAllowDownload,
        includeRequirements: false,
        regenerate,
      });
      onSuccess();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update share link settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setAutoProvisioned(false);
      return;
    }
    if (isPublic) {
      setAllowDownload(shareSettings?.allowDownload === true);
      setExpiryOption(shareSettings?.expiresAt ? closestExpiryOption(shareSettings.expiresAt) : 'never');
    } else if (!autoProvisioned) {
      // Matches web: opening the modal silently provisions a safe, short-lived
      // (1hr, no-download) link so a ready-to-copy URL is available immediately.
      setAllowDownload(false);
      setExpiryOption('1');
      setAutoProvisioned(true);
      persistSettings({ nextAllowDownload: false, nextExpiryOption: '1' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isPublic, shareSettings?.allowDownload, shareSettings?.expiresAt]);

  if (!isOpen) return null;

  const handleToggleActive = async (value) => {
    if (value) {
      await persistSettings();
    } else {
      setRevoking(true);
      try {
        await interiorCrmService.revokeShareLink(customerId);
        onSuccess();
      } catch (e) {
        Alert.alert('Error', e.message || 'Failed to revoke share link.');
      } finally {
        setRevoking(false);
      }
    }
  };

  const handleToggleDownload = (value) => {
    setAllowDownload(value);
    if (isPublic) persistSettings({ nextAllowDownload: value });
  };

  const handleChangeExpiry = (opt) => {
    setExpiryOption(opt);
    if (isPublic) persistSettings({ nextExpiryOption: opt });
  };

  const handleResetToken = () => {
    Alert.alert(
      'Reset Share Link',
      'This invalidates the current link — anyone with the old URL will lose access. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Token',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await interiorCrmService.generateShareLink(customerId, {
                expiresHours: hoursValue(expiryOption),
                allowDownload,
                includeRequirements: false,
                regenerate: true,
              });
              onSuccess();
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to reset share link.');
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert('Copied', 'Share link copied to clipboard.');
  };

  const handleSendWhatsApp = () => {
    if (!shareUrl) return;
    const digits = (lead?.mobileNumber || '').replace(/\D/g, '');
    const message = `Hello ${lead?.name || ''},\n\nHere is your interior design & drawings link for review:\n${shareUrl}\n\nPlease click to view your 2D plans and 3D renders.`;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open WhatsApp.'));
  };

  const expiryDisplay = () => {
    if (!shareSettings?.expiresAt) return 'Never expires';
    const isPast = new Date(shareSettings.expiresAt).getTime() < Date.now();
    if (isPast) return 'Link expired';
    return `Active until ${new Date(shareSettings.expiresAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Client Share Portal</Text>
              <Text style={s.subtitle}>A view-only link showing this lead's approved drawings.</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[s.countBanner, approvedCount === 0 && s.countBannerWarn]}>
              <Ionicons name={approvedCount > 0 ? 'checkmark-circle' : 'alert-circle'} size={16} color={approvedCount > 0 ? '#16A34A' : '#D97706'} />
              <Text style={[s.countBannerText, { color: approvedCount > 0 ? '#166534' : '#92400E' }]}>
                {approvedCount > 0 ? `${approvedCount} Approved Drawing${approvedCount === 1 ? '' : 's'} visible on this link` : 'No Approved Drawings Yet — the client will see an empty portal'}
              </Text>
            </View>

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Public Link {isPublic ? 'Active' : 'Inactive'}</Text>
                <Text style={s.rowSub}>{isPublic ? expiryDisplay() : 'Client can view approved drawings without logging in.'}</Text>
              </View>
              {(loading && !autoProvisioned) || revoking ? <ActivityIndicator size="small" color="#0284C7" /> : (
                <Switch value={isPublic} onValueChange={handleToggleActive} trackColor={{ true: '#0284C7' }} />
              )}
            </View>

            {isPublic && (
              <>
                <View style={s.linkBox}>
                  <Text numberOfLines={1} style={s.linkText}>{shareUrl}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  <TouchableOpacity style={s.actionBtn} onPress={handleCopyLink}>
                    <Ionicons name="copy-outline" size={14} color="#334155" />
                    <Text style={s.actionBtnText}>Copy Link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]} onPress={handleSendWhatsApp}>
                    <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
                    <Text style={[s.actionBtnText, { color: '#16A34A' }]}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>Allow Drawing Downloads</Text>
                    <Text style={s.rowSub}>Off by default — client can only view, not save files.</Text>
                  </View>
                  <Switch value={allowDownload} onValueChange={handleToggleDownload} trackColor={{ true: '#0284C7' }} disabled={loading} />
                </View>

                <Text style={[s.rowLabel, { marginTop: 12, marginBottom: 8 }]}>Link Expiration</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {EXPIRY_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.expiryChip, expiryOption === opt.value && s.expiryChipActive]}
                      onPress={() => handleChangeExpiry(opt.value)}
                      disabled={loading}
                    >
                      <Text style={[s.expiryChipText, expiryOption === opt.value && s.expiryChipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={s.resetBtn} onPress={handleResetToken} disabled={resetting}>
                  {resetting ? <ActivityIndicator size="small" color="#DC2626" /> : (
                    <>
                      <Ionicons name="refresh-outline" size={14} color="#DC2626" />
                      <Text style={s.resetBtnText}>Reset Token (invalidate old link)</Text>
                    </>
                  )}
                </TouchableOpacity>

                {!!shareSettings?.viewCount && (
                  <Text style={s.viewCountText}>Viewed {shareSettings.viewCount} time{shareSettings.viewCount === 1 ? '' : 's'}{shareSettings.lastViewedAt ? ` • Last: ${new Date(shareSettings.lastViewedAt).toLocaleDateString('en-IN')}` : ''}</Text>
                )}
              </>
            )}
            <View style={{ height: 10 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  title: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  subtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2, maxWidth: 260 },

  countBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 10, padding: 10, marginBottom: 16 },
  countBannerWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  countBannerText: { flex: 1, fontSize: 11.5, fontFamily: 'Inter-Medium', lineHeight: 16 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowLabel: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  rowSub: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  linkBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, marginBottom: 10 },
  linkText: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#2563EB' },

  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingVertical: 9 },
  actionBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155' },

  expiryChip: { minWidth: '30%', flexGrow: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  expiryChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  expiryChipText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  expiryChipTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, paddingVertical: 11 },
  resetBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#DC2626' },

  viewCountText: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', marginTop: 12 },
});

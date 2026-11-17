// Construction settings: Profile Details / Organization / Change Password sheets
// (same actions as the web construction-dashboard settings page)

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const TITLES = {
  profile: ['profileDetails', 'Profile Details'],
  organization: ['organizationWorkspace', 'Organization & Workspace Details'],
  password: ['changePassword', 'Change Password'],
};

/** @param mode 'profile' | 'organization' | 'password' | null (closed) */
export default function AccountSheet({ mode, onClose }) {
  const { user, token, refreshUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orgName, setOrgName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const insets = useSafeAreaInsets();
  // Android (edge-to-edge, translucent modal) doesn't resize for the keyboard — lift the sheet ourselves
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates?.height || 0));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const isAdmin = user?.role?.name === 'Admin' || user?.role === 'Admin';
  const currentOrgName = user?.organizationName || (typeof user?.organization === 'object' ? user?.organization?.name : '') || '';

  useEffect(() => {
    if (!mode) return;
    setName(user?.name || '');
    setPhone(user?.phoneNumber || user?.mobile || '');
    setOrgName(currentOrgName);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPwd(false);
  }, [mode]);

  const call = async (path, method, body) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  };

  const save = async () => {
    if (saving) return;
    try {
      if (mode === 'profile') {
        if (!name.trim()) return showToast('Full name is required', 'error');
        setSaving(true);
        await call(`/users/${user?._id || user?.id}`, 'PATCH', { name: name.trim(), phoneNumber: phone.trim() });
        showToast('Profile details saved successfully!', 'success');
      } else if (mode === 'organization') {
        if (!orgName.trim()) return showToast('Organization name cannot be empty', 'error');
        setSaving(true);
        await call('/organization', 'PATCH', { name: orgName.trim() });
        showToast('Organization updated successfully!', 'success');
      } else {
        if (!currentPassword) return showToast('Please enter your current password', 'error');
        if (!newPassword) return showToast('Please enter a new password', 'error');
        if (newPassword.length < 8) return showToast('New password must be at least 8 characters long', 'error');
        if (newPassword !== confirmPassword) return showToast('New passwords do not match', 'error');
        setSaving(true);
        await call('/auth/change-password', 'POST', { currentPassword, newPassword });
        showToast('Password changed successfully!', 'success');
      }
      refreshUser?.();
      onClose();
    } catch (e) {
      const fallback = mode === 'password' ? 'Failed to change password. Check current password.'
        : mode === 'organization' ? 'Failed to update organization' : 'Failed to update profile';
      showToast(e.message || fallback, 'error');
    } finally {
      setSaving(false);
    }
  };

  const field = (label, value, onChange, opts = {}) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.inputRow}>
        <TextInput
          style={[s.input, opts.disabled && { color: '#94A3B8' }]}
          value={value}
          onChangeText={onChange}
          editable={!opts.disabled}
          placeholder={opts.placeholder}
          placeholderTextColor="#94A3B8"
          secureTextEntry={opts.secure && !showPwd}
          autoCapitalize={opts.secure ? 'none' : 'words'}
          keyboardType={opts.keyboardType}
        />
        {opts.secure && (
          <TouchableOpacity onPress={() => setShowPwd((v) => !v)} hitSlop={8}>
            <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const [titleKey, titleDefault] = TITLES[mode] || TITLES.profile;
  const orgReadOnly = mode === 'organization' && !isAdmin;

  return (
    <Modal visible={!!mode} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom + 16, 28) + keyboardHeight }]}>
          <View style={s.handle} />
          <View style={s.titleRow}>
            <Text style={s.title}>{t(titleKey, titleDefault)}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={28} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          {mode === 'profile' && (
            <>
              {field(t('fullName', 'Full Name'), name, setName)}
              {field(t('email', 'Email'), user?.email || '', () => {}, { disabled: true })}
              {field(t('phoneNumber', 'Phone Number'), phone, setPhone, { keyboardType: 'phone-pad', placeholder: '+91 9876543210' })}
            </>
          )}

          {mode === 'organization' && (
            <>
              {field(t('organizationName', 'Organization Name'), orgName, setOrgName, { disabled: orgReadOnly })}
              {orgReadOnly && <Text style={s.hint}>{t('onlyAdminsRenameWorkspace', 'Only organization administrators can rename this workspace.')}</Text>}
            </>
          )}

          {mode === 'password' && (
            <>
              {field(t('currentPassword', 'Current Password'), currentPassword, setCurrentPassword, { secure: true })}
              {field(t('newPassword', 'New Password'), newPassword, setNewPassword, { secure: true })}
              {field(t('confirmNewPassword', 'Confirm New Password'), confirmPassword, setConfirmPassword, { secure: true })}
              <Text style={s.hint}>{t('passwordMinHint', 'Ensure your account uses a secure password of at least 8 characters.')}</Text>
            </>
          )}

          {!orgReadOnly && (
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : (
                <Text style={s.saveText}>
                  {mode === 'password' ? t('updatePassword', 'Update Password')
                    : mode === 'organization' ? t('saveOrganizationName', 'Save Organization Name')
                    : t('saveChanges', 'Save Changes')}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontFamily: 'Inter-Black', color: '#0F172A', flex: 1 },
  label: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#475569', marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 13, fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  hint: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: -4, marginBottom: 14 },
  saveBtn: { backgroundColor: '#2563EB', borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  saveText: { fontSize: 15, fontFamily: 'Inter-Black', color: '#FFFFFF' },
});

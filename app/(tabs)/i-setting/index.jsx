import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, StatusBar, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import HeaderNotification from '../../components/HeaderNotification';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const CURRENCIES = ['USD ($)', 'EUR (€)', 'GBP (£)', 'INR (₹)', 'AED (AED)'];
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

const SettingItem = ({ icon, iconBg, iconColor, title, subtitle, type = 'chevron', value, onPress }) => (
  <TouchableOpacity style={s.item} onPress={onPress} activeOpacity={0.7}>
    <View style={s.itemLeft}>
      <View style={[s.iconContainer, { backgroundColor: iconBg || '#EFF6FF' }]}>
        <Ionicons name={icon} size={19} color={iconColor || '#2563EB'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.itemTitle}>{title}</Text>
        {!!subtitle && <Text style={s.itemSubtitle}>{subtitle}</Text>}
      </View>
    </View>
    {type === 'chevron' && <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />}
    {type === 'switch' && <Switch value={value} onValueChange={onPress} trackColor={{ true: '#2563EB', false: '#E2E8F0' }} thumbColor="#FFFFFF" />}
  </TouchableOpacity>
);

const Sheet = ({ visible, onClose, title, children }) => (
  <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
    <View style={s.sheetOverlay}>
      <TouchableOpacity style={s.modalDismiss} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AdaptiveGlass intensity={90} tint="light" style={s.sheetContent}>
          <View style={s.sheetHeader}>
            <View style={s.sheetHandle} />
            <View style={s.sheetTitleRow}>
              <Text style={s.sheetTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={26} color="#CBD5E1" />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
            <View style={{ height: 24 }} />
          </ScrollView>
        </AdaptiveGlass>
      </KeyboardAvoidingView>
    </View>
  </Modal>
);

export default function InteriorSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const { showToast } = useToast();

  const [activeSheet, setActiveSheet] = useState(null); // 'profile' | 'password' | 'workspace' | 'preferences' | 'notifications' | 'appInfo' | 'logout'

  // Account
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Workspace (local only, mirrors web's mock behavior)
  const [orgName, setOrgName] = useState('');
  const [currency, setCurrency] = useState('USD ($)');
  const [companyAddress, setCompanyAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);

  // Preferences (local only)
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Notifications (local only)
  const [emailProjects, setEmailProjects] = useState(true);
  const [emailApprovals, setEmailApprovals] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phoneNumber || user.phone || '');
      setOrgName(user.organization?.name || `${user.name || 'Studio'}'s Workspace`);
    }
  }, [user]);

  const getInitials = (n) => {
    if (!n) return '??';
    const parts = n.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  const closeSheet = () => setActiveSheet(null);

  const handleSaveProfile = async () => {
    if (!name.trim()) return showToast('Name cannot be empty.', 'error');
    setIsSavingProfile(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), phoneNumber: phone.trim() }),
      });
      if (res.ok) {
        showToast('Profile details saved successfully!', 'success');
        closeSheet();
      } else {
        showToast('Failed to update profile.', 'error');
      }
    } catch (e) {
      showToast('Network error. Check server/IP.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) return showToast('Please enter your current password.', 'error');
    if (newPassword.length < 6) return showToast('New password must be at least 6 characters.', 'error');
    if (newPassword !== confirmPassword) return showToast('New passwords do not match.', 'error');

    setIsChangingPassword(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Password updated successfully!', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        closeSheet();
      } else {
        showToast(data.message || 'Failed to update password.', 'error');
      }
    } catch (e) {
      showToast('Network error. Check server/IP.', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveWorkspace = () => {
    setIsSavingWorkspace(true);
    setTimeout(() => {
      setIsSavingWorkspace(false);
      showToast('Workspace details saved!', 'success');
      closeSheet();
    }, 500);
  };

  const handleSavePreferences = () => {
    setIsSavingPrefs(true);
    setTimeout(() => {
      setIsSavingPrefs(false);
      showToast('Application preferences updated!', 'success');
      closeSheet();
    }, 400);
  };

  const confirmLogout = async () => {
    closeSheet();
    await logout();
  };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <View style={s.bgBase} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={s.headerGreeting}>Workspace</Text>
            <Text style={s.pageTitle}>Settings</Text>
          </View>
          <HeaderNotification />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
          {/* Profile card */}
          <AdaptiveGlass intensity={20} tint="light" style={s.profileGlass}>
            <View style={s.profileMain}>
              <View style={s.avatarBox}>
                <Text style={s.avatarText}>{getInitials(user?.name)}</Text>
              </View>
              <View style={s.profileInfo}>
                <View style={s.nameRow}>
                  <Text style={s.profileName} numberOfLines={1}>{user?.name || 'User'}</Text>
                  <View style={s.badge}>
                    <Text style={s.badgeLabel}>DESIGNER</Text>
                  </View>
                </View>
                <Text style={s.profileEmail} numberOfLines={1}>{user?.email || 'No email provided'}</Text>
              </View>
            </View>
          </AdaptiveGlass>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Account</Text>
            <View style={s.flatGroup}>
              <SettingItem icon="person-outline" title="Edit Profile" subtitle="Name & phone number" onPress={() => setActiveSheet('profile')} />
              <SettingItem icon="lock-closed-outline" title="Change Password" subtitle="Update your credentials" onPress={() => setActiveSheet('password')} />
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Workspace</Text>
            <View style={s.flatGroup}>
              <SettingItem icon="business-outline" title="Company & Workspace" subtitle="Studio branding & currency" onPress={() => setActiveSheet('workspace')} />
              <SettingItem icon="options-outline" title="App Preferences" subtitle="Date format" onPress={() => setActiveSheet('preferences')} />
              <SettingItem icon="notifications-outline" title="Notifications" subtitle="Email & in-app alerts" onPress={() => setActiveSheet('notifications')} />
              <SettingItem icon="people-outline" iconBg="#F5F3FF" iconColor="#7C3AED" title="Users & Roles" subtitle="Team assignments & permission matrix" onPress={() => router.push('/interior-users-roles')} />
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Support</Text>
            <View style={s.flatGroup}>
              <SettingItem icon="information-circle-outline" title="App Info" subtitle="v2.1.0 Arctic" onPress={() => setActiveSheet('appInfo')} />
            </View>
          </View>

          <TouchableOpacity style={s.logoutBtn} activeOpacity={0.8} onPress={() => setActiveSheet('logout')}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={s.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Edit Profile */}
      <Sheet visible={activeSheet === 'profile'} onClose={closeSheet} title="Edit Profile">
        <Text style={s.label}>Full Name</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="John Doe" placeholderTextColor="#94A3B8" />
        <Text style={s.label}>Email Address</Text>
        <View style={[s.input, s.inputDisabled]}>
          <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: '#94A3B8' }}>{user?.email}</Text>
        </View>
        <Text style={s.label}>Phone Number</Text>
        <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="+1 (555) 000-0000" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />
        <TouchableOpacity style={s.saveBtn} onPress={handleSaveProfile} disabled={isSavingProfile}>
          {isSavingProfile ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
            <>
              <Ionicons name="save-outline" size={15} color="#FFFFFF" />
              <Text style={s.saveBtnText}>Save Profile</Text>
            </>
          )}
        </TouchableOpacity>
      </Sheet>

      {/* Change Password */}
      <Sheet visible={activeSheet === 'password'} onClose={closeSheet} title="Change Password">
        <Text style={s.label}>Current Password</Text>
        <TextInput style={s.input} value={currentPassword} onChangeText={setCurrentPassword} placeholder="••••••••" placeholderTextColor="#94A3B8" secureTextEntry />
        <Text style={s.label}>New Password</Text>
        <TextInput style={s.input} value={newPassword} onChangeText={setNewPassword} placeholder="••••••••" placeholderTextColor="#94A3B8" secureTextEntry />
        <Text style={s.label}>Confirm New Password</Text>
        <TextInput style={s.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="••••••••" placeholderTextColor="#94A3B8" secureTextEntry />
        <TouchableOpacity style={s.saveBtn} onPress={handleChangePassword} disabled={isChangingPassword}>
          {isChangingPassword ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
            <>
              <Ionicons name="shield-checkmark-outline" size={15} color="#FFFFFF" />
              <Text style={s.saveBtnText}>Update Password</Text>
            </>
          )}
        </TouchableOpacity>
      </Sheet>

      {/* Company & Workspace */}
      <Sheet visible={activeSheet === 'workspace'} onClose={closeSheet} title="Company & Workspace">
        <Text style={s.label}>Studio / Workspace Name</Text>
        <TextInput style={s.input} value={orgName} onChangeText={setOrgName} placeholderTextColor="#94A3B8" />
        <Text style={s.label}>Default Currency</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity key={c} style={[s.optionChip, currency === c && s.optionChipActive]} onPress={() => setCurrency(c)}>
              <Text style={[s.optionChipText, currency === c && s.optionChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.label}>Studio Address</Text>
        <TextInput style={s.input} value={companyAddress} onChangeText={setCompanyAddress} placeholder="Design District, Suite 402" placeholderTextColor="#94A3B8" />
        <Text style={s.label}>Tax ID / GST Number</Text>
        <TextInput style={s.input} value={taxId} onChangeText={setTaxId} placeholder="TAX-9948102" placeholderTextColor="#94A3B8" />
        <TouchableOpacity style={s.saveBtn} onPress={handleSaveWorkspace} disabled={isSavingWorkspace}>
          {isSavingWorkspace ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
            <>
              <Ionicons name="save-outline" size={15} color="#FFFFFF" />
              <Text style={s.saveBtnText}>Save Workspace Settings</Text>
            </>
          )}
        </TouchableOpacity>
      </Sheet>

      {/* App Preferences */}
      <Sheet visible={activeSheet === 'preferences'} onClose={closeSheet} title="App Preferences">
        <Text style={s.label}>Date Display Format</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DATE_FORMATS.map((f) => (
            <TouchableOpacity key={f} style={[s.optionChip, dateFormat === f && s.optionChipActive]} onPress={() => setDateFormat(f)}>
              <Text style={[s.optionChipText, dateFormat === f && s.optionChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.saveBtn} onPress={handleSavePreferences} disabled={isSavingPrefs}>
          {isSavingPrefs ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
            <>
              <Ionicons name="save-outline" size={15} color="#FFFFFF" />
              <Text style={s.saveBtnText}>Save Preferences</Text>
            </>
          )}
        </TouchableOpacity>
      </Sheet>

      {/* Notifications */}
      <Sheet visible={activeSheet === 'notifications'} onClose={closeSheet} title="Notifications">
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleTitle}>Project Activity Emails</Text>
            <Text style={s.toggleSub}>New milestones and updates.</Text>
          </View>
          <Switch value={emailProjects} onValueChange={setEmailProjects} trackColor={{ true: '#2563EB', false: '#E2E8F0' }} thumbColor="#FFFFFF" />
        </View>
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleTitle}>Client Finish Approvals</Text>
            <Text style={s.toggleSub}>Alerts on material swatch sign-offs.</Text>
          </View>
          <Switch value={emailApprovals} onValueChange={setEmailApprovals} trackColor={{ true: '#2563EB', false: '#E2E8F0' }} thumbColor="#FFFFFF" />
        </View>
        <View style={[s.toggleRow, { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleTitle}>In-App Audio Alerts</Text>
            <Text style={s.toggleSub}>Play chimes for active alerts.</Text>
          </View>
          <Switch value={soundAlerts} onValueChange={setSoundAlerts} trackColor={{ true: '#2563EB', false: '#E2E8F0' }} thumbColor="#FFFFFF" />
        </View>
      </Sheet>

      {/* App Info */}
      <Modal visible={activeSheet === 'appInfo'} animationType="fade" transparent statusBarTranslucent onRequestClose={closeSheet}>
        <View style={s.modalOverlayCenter}>
          <AdaptiveGlass intensity={95} tint="light" style={s.appInfoCard}>
            <View style={s.appInfoIcon}>
              <Ionicons name="sparkles" size={44} color="#2563EB" />
            </View>
            <Text style={s.appInfoTitle}>Sky Lite Interior</Text>
            <Text style={s.appInfoVersion}>Version 2.1.0 (Arctic)</Text>
            <Text style={s.appInfoDesc}>Manage your interior design studio, client CRM, fit-out projects, and blueprints all in one workspace.</Text>
            <TouchableOpacity style={s.appInfoCloseBtn} onPress={closeSheet} activeOpacity={0.8}>
              <Text style={s.appInfoCloseText}>Close</Text>
            </TouchableOpacity>
          </AdaptiveGlass>
        </View>
      </Modal>

      {/* Logout confirm */}
      <Modal visible={activeSheet === 'logout'} animationType="fade" transparent statusBarTranslucent onRequestClose={closeSheet}>
        <View style={s.modalOverlayCenter}>
          <AdaptiveGlass intensity={95} tint="light" style={s.appInfoCard}>
            <View style={[s.appInfoIcon, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}>
              <Ionicons name="log-out-outline" size={44} color="#EF4444" />
            </View>
            <Text style={s.appInfoTitle}>Sign Out</Text>
            <Text style={[s.appInfoDesc, { marginBottom: 28 }]}>Are you sure you want to sign out of your account?</Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity style={[s.appInfoCloseBtn, { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]} onPress={closeSheet}>
                <Text style={[s.appInfoCloseText, { color: '#64748B' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.appInfoCloseBtn, { flex: 1, backgroundColor: '#EF4444' }]} onPress={confirmLogout}>
                <Text style={[s.appInfoCloseText, { color: '#FFF' }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </AdaptiveGlass>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 20 },

  header: {
    backgroundColor: '#DBEAFE', paddingHorizontal: 24, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#DBEAFE',
  },
  headerGreeting: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#1D4ED8', marginBottom: 2 },
  pageTitle: { fontSize: 22, fontFamily: 'Inter-Black', color: '#0F172A', letterSpacing: -0.5 },

  profileGlass: {
    borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: '#FFFFFF', marginBottom: 32,
  },
  profileMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Inter-Black' },
  profileInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A', letterSpacing: -0.3, flexShrink: 1 },
  profileEmail: { fontSize: 12, color: '#94A3B8', fontFamily: 'Inter-Regular' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', flexShrink: 0 },
  badgeLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#2563EB' },

  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#64748B', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 },
  flatGroup: { borderRadius: 22, padding: 6, borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: '#FFFFFF' },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, gap: 10 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  iconContainer: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  itemTitle: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#1E293B' },
  itemSubtitle: { fontSize: 11.5, color: '#94A3B8', fontFamily: 'Inter-Regular', marginTop: 2 },

  logoutBtn: {
    marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: 18, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: { color: '#EF4444', fontSize: 14, fontFamily: 'Inter-Bold' },

  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalDismiss: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  sheetContent: {
    width: '100%', maxHeight: '85%', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DBEAFE', borderBottomWidth: 0,
  },
  sheetHeader: { alignItems: 'center', marginBottom: 18 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 18 },
  sheetTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  sheetTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },
  inputDisabled: { justifyContent: 'center' },

  optionChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  optionChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  optionChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  optionChipTextActive: { color: '#2563EB' },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, marginTop: 20 },
  saveBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  toggleTitle: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  toggleSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  modalOverlayCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  appInfoCard: { width: '100%', borderRadius: 28, padding: 28, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DBEAFE' },
  appInfoIcon: { width: 76, height: 76, borderRadius: 20, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  appInfoTitle: { fontSize: 18, fontFamily: 'Inter-Black', color: '#0F172A' },
  appInfoVersion: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#94A3B8', marginTop: 4, marginBottom: 14 },
  appInfoDesc: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  appInfoCloseBtn: { paddingVertical: 13, paddingHorizontal: 32, borderRadius: 14, backgroundColor: '#2563EB', width: '100%', alignItems: 'center' },
  appInfoCloseText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

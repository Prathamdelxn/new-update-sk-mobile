import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import HeaderNotification from '../../components/HeaderNotification';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useInteriorPermissions } from '../../utils/interior/useInteriorPermissions';
import interiorApiClient from '../../services/interiorApiClient';
import { getAllCountries, getCountryByCode } from '../../services/common/countryService';

const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

export default function InteriorSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const { isOrgAdmin, navAccess } = useInteriorPermissions();
  const { showToast } = useToast();

  // Active Tab: 'profile' | 'general' | 'localization' | 'security'
  const [activeTab, setActiveTab] = useState('profile');
  const [activeModal, setActiveModal] = useState(null); // 'countryPicker' | 'appInfo' | 'logout'

  // Profile State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Company / Organization State
  const [orgForm, setOrgForm] = useState({
    name: '',
    slug: '',
    country: 'India',
    countryCode: 'IN',
    currency: 'INR',
    currencySymbol: '₹',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
  });
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // Security / Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Country Search State
  const [countrySearch, setCountrySearch] = useState('');
  const allCountries = useMemo(() => getAllCountries(), []);
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return allCountries;
    const q = countrySearch.toLowerCase();
    return allCountries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.cca2.toLowerCase().includes(q) || c.currencyCode.toLowerCase().includes(q)
    );
  }, [allCountries, countrySearch]);

  // Load user & organization data
  useEffect(() => {
    if (user) {
      const fName = user.firstName || (user.name ? user.name.split(' ')[0] : '');
      const lName = user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : '');
      setFirstName(fName);
      setLastName(lName);
      setPhone(user.phone || user.phoneNumber || '');

      const initialOrg = user.organization || {};
      const countryName = initialOrg.address?.country || initialOrg.country || 'India';
      const matched = getCountryByCode(initialOrg.countryCode || 'IN') || getCountryByCode('IN');

      setOrgForm({
        name: initialOrg.name || 'Workspace',
        slug: initialOrg.slug || 'workspace',
        country: countryName,
        countryCode: matched?.cca2 || 'IN',
        currency: initialOrg.settings?.currency || matched?.currencyCode || 'INR',
        currencySymbol: matched?.currencySymbol || '₹',
        timezone: initialOrg.settings?.timezone || matched?.primaryTimezone || 'Asia/Kolkata',
        dateFormat: initialOrg.settings?.dateFormat || 'DD/MM/YYYY',
      });
    }
  }, [user]);

  // Fetch latest organization settings from API if org admin
  const loadOrgSettings = useCallback(async () => {
    try {
      const res = await interiorApiClient.get('/organizations/settings');
      const data = res?.data?.data || res?.data;
      if (data) {
        const countryName = data.address?.country || data.country || 'India';
        const matched = getCountryByCode(data.countryCode || 'IN');
        setOrgForm((prev) => ({
          ...prev,
          name: data.name || prev.name,
          slug: data.slug || prev.slug,
          country: countryName,
          countryCode: matched?.cca2 || prev.countryCode,
          currency: data.settings?.currency || prev.currency,
          currencySymbol: matched?.currencySymbol || prev.currencySymbol,
          timezone: data.settings?.timezone || prev.timezone,
          dateFormat: data.settings?.dateFormat || prev.dateFormat,
        }));
      }
    } catch (e) {
      // Keep existing values from session
    }
  }, []);

  useEffect(() => {
    if (isOrgAdmin) {
      loadOrgSettings();
    }
  }, [isOrgAdmin, loadOrgSettings]);

  // Computed Identity
  const displayName = useMemo(() => {
    const combined = [firstName, lastName].filter(Boolean).join(' ').trim();
    return combined || user?.name || user?.fullName || (user?.email ? user.email.split('@')[0] : 'User');
  }, [firstName, lastName, user]);

  const roleName = useMemo(() => {
    return (
      user?.role?.name ||
      user?.role?.displayName ||
      user?.designation ||
      (user?.systemRole ? user.systemRole.replace(/_/g, ' ') : null) ||
      'Member'
    ).toUpperCase();
  }, [user]);

  const getInitials = (n) => {
    if (!n) return '??';
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  // Password Strength Meter
  const passwordStrength = useMemo(() => {
    const pwd = newPassword;
    if (!pwd) return { score: 0, label: 'Too short', color: '#CBD5E1', width: '10%' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    switch (score) {
      case 1:
        return { score: 25, label: 'Weak', color: '#F43F5E', width: '25%' };
      case 2:
        return { score: 50, label: 'Fair', color: '#F59E0B', width: '50%' };
      case 3:
        return { score: 75, label: 'Good', color: '#3B82F6', width: '75%' };
      case 4:
        return { score: 100, label: 'Strong', color: '#10B981', width: '100%' };
      default:
        return { score: 10, label: 'Too short', color: '#CBD5E1', width: '10%' };
    }
  }, [newPassword]);

  // Handlers
  const handleSaveProfile = async () => {
    if (!firstName.trim()) return showToast('First name is required.', 'error');
    setIsSavingProfile(true);
    try {
      const userId = user?._id || user?.id;
      await interiorApiClient.patch(`/users/${userId}`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      });
      showToast('Profile updated successfully!', 'success');
      refreshUser?.();
    } catch (e) {
      showToast(e?.response?.data?.message || e.message || 'Failed to update profile.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveOrganization = async () => {
    if (!orgForm.name.trim()) return showToast('Organization name is required.', 'error');
    setIsSavingOrg(true);
    try {
      await interiorApiClient.patch('/organizations/settings', {
        name: orgForm.name.trim(),
        country: orgForm.country,
        currency: orgForm.currency,
        timezone: orgForm.timezone,
        dateFormat: orgForm.dateFormat,
      });
      showToast('Organization settings updated successfully!', 'success');
      refreshUser?.();
    } catch (e) {
      showToast(e?.response?.data?.message || e.message || 'Failed to update organization.', 'error');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleSelectCountry = (country) => {
    setOrgForm((prev) => ({
      ...prev,
      country: country.name,
      countryCode: country.cca2,
      currency: country.currencyCode,
      currencySymbol: country.currencySymbol || '$',
      timezone: country.primaryTimezone || prev.timezone,
    }));
    setActiveModal(null);
  };

  const handleChangePassword = async () => {
    if (!currentPassword) return showToast('Please enter your current password.', 'error');
    if (newPassword.length < 8) return showToast('New password must be at least 8 characters.', 'error');
    if (newPassword !== confirmPassword) return showToast('New passwords do not match.', 'error');

    setIsChangingPassword(true);
    try {
      await interiorApiClient.patch('/auth/change-password', { currentPassword, newPassword });
      showToast('Password updated successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      showToast(e?.response?.data?.error || e?.response?.data?.message || e.message || 'Failed to update password.', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const confirmLogout = async () => {
    setActiveModal(null);
    await logout();
  };

  // Navigation Items
  const navItems = [
    { id: 'profile', label: 'Profile', icon: 'person-outline' },
    ...(isOrgAdmin
      ? [
          { id: 'general', label: 'Company', icon: 'business-outline' },
          { id: 'localization', label: 'Regional', icon: 'globe-outline' },
        ]
      : []),
    { id: 'security', label: 'Security', icon: 'lock-closed-outline' },
  ];

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        {/* Top Header */}
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <View>
            <View style={s.headerBadgeRow}>
              <Text style={s.headerSubtitle}>Workspace Settings</Text>
              
            </View>
            <Text style={s.pageTitle}>Settings</Text>
          </View>
          <HeaderNotification />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Master Profile Identity Hero Card */}
          <View style={s.heroCard}>
            <View style={s.heroMain}>
              <View style={s.avatarBox}>
                <Text style={s.avatarText}>{getInitials(displayName !== 'User' ? displayName : user?.email)}</Text>
              </View>
              <View style={s.heroInfo}>
                <View style={s.nameBadgeRow}>
                  <Text style={s.heroName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <View style={s.roleBadge}>
                    <Text style={s.roleBadgeLabel}>{roleName}</Text>
                  </View>
                </View>

                <View style={s.emailRow}>
                  <Ionicons name="mail-outline" size={13} color="#64748B" />
                  <Text style={s.heroEmail} numberOfLines={1}>
                    {user?.email || 'No email provided'}
                  </Text>
                  <View style={s.verifiedChip}>
                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                    <Text style={s.verifiedText}>Verified</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Quick Workspace Info Footer */}
            <View style={s.heroFooter}>
              <View style={s.heroFooterItem}>
                <Ionicons name="business-outline" size={13} color="#2563EB" />
                <Text style={s.heroFooterText} numberOfLines={1}>
                  {orgForm.name || 'Workspace'}
                </Text>
              </View>
              <View style={s.heroFooterDivider} />
              <View style={s.heroFooterItem}>
                <Text style={s.currencyMiniBadge}>{orgForm.currencySymbol}</Text>
                <Text style={s.heroFooterText}>{orgForm.currency}</Text>
              </View>
              <View style={s.heroFooterDivider} />
              <View style={s.heroFooterItem}>
                <Ionicons name="calendar-outline" size={13} color="#64748B" />
                <Text style={s.heroFooterText}>{orgForm.dateFormat}</Text>
              </View>
            </View>
          </View>

          {/* Segmented Navigation Tab Bar */}
          <View style={s.tabBarContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBarContent}>
              {navItems.map((item) => {
                const isSelected = activeTab === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setActiveTab(item.id)}
                    style={[s.tabPill, isSelected && s.tabPillActive]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.icon}
                      size={16}
                      color={isSelected ? '#FFFFFF' : '#64748B'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[s.tabPillText, isSelected && s.tabPillTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* TAB 1: Personal Profile */}
          {activeTab === 'profile' && (
            <View style={s.tabCard}>
              <View style={s.cardHeader}>
                <Ionicons name="person-circle-outline" size={20} color="#2563EB" />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Personal Information</Text>
                  <Text style={s.cardSubtitle}>Manage your personal profile details and contact number</Text>
                </View>
              </View>

              <View style={s.formGroup}>
                <View style={s.inputRow}>
                  <View style={[s.inputCol, { flex: 1 }]}>
                    <Text style={s.inputLabel}>First Name *</Text>
                    <TextInput
                      style={s.textInput}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="e.g. John"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={[s.inputCol, { flex: 1 }]}>
                    <Text style={s.inputLabel}>Last Name *</Text>
                    <TextInput
                      style={s.textInput}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="e.g. Doe"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={s.inputCol}>
                  <Text style={s.inputLabel}>Account Email (Read-only)</Text>
                  <View style={[s.textInput, s.disabledInput]}>
                    <Ionicons name="lock-closed-outline" size={14} color="#94A3B8" style={{ marginRight: 8 }} />
                    <Text style={s.disabledInputText}>{user?.email || 'N/A'}</Text>
                  </View>
                </View>

                <View style={s.inputCol}>
                  <Text style={s.inputLabel}>Contact Number</Text>
                  <View style={s.iconInputContainer}>
                    <Ionicons name="call-outline" size={16} color="#64748B" style={s.leadingIcon} />
                    <TextInput
                      style={[s.textInput, { paddingLeft: 40 }]}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="+91 98765 43210"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[s.actionButton, isSavingProfile && s.actionButtonDisabled]}
                  onPress={handleSaveProfile}
                  disabled={isSavingProfile}
                  activeOpacity={0.8}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-outline" size={18} color="#FFFFFF" />
                      <Text style={s.actionButtonText}>Save Profile Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* TAB 2: Company Profile (Admin) */}
          {activeTab === 'general' && isOrgAdmin && (
            <View style={s.tabCard}>
              <View style={s.cardHeader}>
                <Ionicons name="business-outline" size={20} color="#2563EB" />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Company Information</Text>
                  <Text style={s.cardSubtitle}>Your organization details appear on client quotes and invoices</Text>
                </View>
              </View>

              <View style={s.formGroup}>
                <View style={s.inputCol}>
                  <Text style={s.inputLabel}>Organization Legal Name *</Text>
                  <TextInput
                    style={s.textInput}
                    value={orgForm.name}
                    onChangeText={(val) => setOrgForm({ ...orgForm, name: val })}
                    placeholder="e.g. Acme Interior Design Studio"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={s.inputCol}>
                  <Text style={s.inputLabel}>Workspace Slug / ID</Text>
                  <View style={[s.textInput, s.disabledInput]}>
                    <Ionicons name="link-outline" size={14} color="#94A3B8" style={{ marginRight: 8 }} />
                    <Text style={[s.disabledInputText, { fontFamily: 'Courier' }]}>{orgForm.slug || 'workspace'}</Text>
                  </View>
                </View>

                {/* Subscription Card */}
                <View style={s.planBox}>
                  <View style={s.planHeader}>
                    <View style={s.planBadge}>
                      <Ionicons name="sparkles" size={13} color="#2563EB" />
                      <Text style={s.planBadgeText}>Enterprise Pro</Text>
                    </View>
                    <View style={s.activeStatusPill}>
                      <Text style={s.activeStatusText}>Active Studio</Text>
                    </View>
                  </View>
                  <Text style={s.planDesc}>
                    Full access to Interior BOQ Builder, 3D Drawings, CRM Pipeline, and Procurement workflows.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[s.actionButton, isSavingOrg && s.actionButtonDisabled]}
                  onPress={handleSaveOrganization}
                  disabled={isSavingOrg}
                  activeOpacity={0.8}
                >
                  {isSavingOrg ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                      <Text style={s.actionButtonText}>Save Company Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* TAB 3: Currency & Regional (Admin) */}
          {activeTab === 'localization' && isOrgAdmin && (
            <View style={s.tabCard}>
              <View style={s.cardHeader}>
                <Ionicons name="globe-outline" size={20} color="#2563EB" />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Currency & Regional Standards</Text>
                  <Text style={s.cardSubtitle}>Configure default project currencies, symbols, and formatting</Text>
                </View>
              </View>

              <View style={s.formGroup}>
                {/* Live Currency Preview Box */}
                <View style={s.currencyPreviewCard}>
                  <View style={s.currencyIconBox}>
                    <Text style={s.currencyLargeSymbol}>{orgForm.currencySymbol}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.currencyPreviewLabel}>Standard Currency</Text>
                    <Text style={s.currencyPreviewVal}>
                      {orgForm.currency} ({orgForm.currencySymbol})
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.currencySampleLabel}>BOQ Sample</Text>
                    <Text style={s.currencySampleVal}>{orgForm.currencySymbol} 1,250,000</Text>
                  </View>
                </View>

                {/* Country / Jurisdiction Picker */}
                <View style={s.inputCol}>
                  <Text style={s.inputLabel}>Country / Jurisdiction</Text>
                  <TouchableOpacity
                    style={s.countryPickerButton}
                    onPress={() => setActiveModal('countryPicker')}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 20 }}>
                        {getCountryByCode(orgForm.countryCode)?.flag || '🌐'}
                      </Text>
                      <Text style={s.countryPickerText}>{orgForm.country} ({orgForm.currency})</Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Date Format Picker */}
                <View style={s.inputCol}>
                  <Text style={s.inputLabel}>Date Format</Text>
                  <View style={s.chipRow}>
                    {DATE_FORMATS.map((df) => {
                      const isSel = orgForm.dateFormat === df;
                      return (
                        <TouchableOpacity
                          key={df}
                          style={[s.formatChip, isSel && s.formatChipActive]}
                          onPress={() => setOrgForm({ ...orgForm, dateFormat: df })}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.formatChipText, isSel && s.formatChipTextActive]}>{df}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Timezone display */}
                <View style={s.inputCol}>
                  <Text style={s.inputLabel}>Primary Timezone</Text>
                  <View style={[s.textInput, s.disabledInput]}>
                    <Ionicons name="time-outline" size={16} color="#64748B" style={{ marginRight: 8 }} />
                    <Text style={s.disabledInputText}>{orgForm.timezone}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[s.actionButton, isSavingOrg && s.actionButtonDisabled]}
                  onPress={handleSaveOrganization}
                  disabled={isSavingOrg}
                  activeOpacity={0.8}
                >
                  {isSavingOrg ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done-outline" size={18} color="#FFFFFF" />
                      <Text style={s.actionButtonText}>Apply Regional Settings</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* TAB 4: Security & Access */}
          {activeTab === 'security' && (
            <View style={s.tabCard}>
              <View style={s.cardHeader}>
                <Ionicons name="lock-closed-outline" size={20} color="#2563EB" />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Security & Credentials</Text>
                  <Text style={s.cardSubtitle}>Ensure your account is protected with a strong credentials</Text>
                </View>
              </View>

              <View style={s.formGroup}>
                {/* Current Password */}
                <View style={s.inputCol}>
                  <Text style={s.inputLabel}>Current Password *</Text>
                  <View style={s.passwordInputContainer}>
                    <TextInput
                      style={s.passwordInput}
                      secureTextEntry={!showCurrentPwd}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Enter current password"
                      placeholderTextColor="#94A3B8"
                    />
                    <TouchableOpacity
                      onPress={() => setShowCurrentPwd(!showCurrentPwd)}
                      style={s.eyeBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name={showCurrentPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* New Password */}
                <View style={s.inputCol}>
                  <Text style={s.inputLabel}>New Password *</Text>
                  <View style={s.passwordInputContainer}>
                    <TextInput
                      style={s.passwordInput}
                      secureTextEntry={!showNewPwd}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="At least 8 characters"
                      placeholderTextColor="#94A3B8"
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPwd(!showNewPwd)}
                      style={s.eyeBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name={showNewPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  {/* Password Strength Meter */}
                  {newPassword.length > 0 && (
                    <View style={s.strengthMeterContainer}>
                      <View style={s.strengthBarTrack}>
                        <View
                          style={[
                            s.strengthBarFill,
                            { width: passwordStrength.width, backgroundColor: passwordStrength.color },
                          ]}
                        />
                      </View>
                      <Text style={[s.strengthLabel, { color: passwordStrength.color }]}>
                        {passwordStrength.label}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Confirm Password */}
                <View style={s.inputCol}>
                  <Text style={s.inputLabel}>Confirm New Password *</Text>
                  <View style={s.passwordInputContainer}>
                    <TextInput
                      style={s.passwordInput}
                      secureTextEntry={!showConfirmPwd}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor="#94A3B8"
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPwd(!showConfirmPwd)}
                      style={s.eyeBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={showConfirmPwd ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[s.actionButton, isChangingPassword && s.actionButtonDisabled]}
                  onPress={handleChangePassword}
                  disabled={isChangingPassword}
                  activeOpacity={0.8}
                >
                  {isChangingPassword ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="key-outline" size={18} color="#FFFFFF" />
                      <Text style={s.actionButtonText}>Update Password</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Quick Shortcuts & Workspace Management */}
          <View style={s.managementSection}>
            <Text style={s.managementSectionTitle}>WORKSPACE TOOLS</Text>
            <View style={s.managementCard}>
              {navAccess.usersRoles && (
                <TouchableOpacity
                  style={s.managementItem}
                  onPress={() => router.push('/interior-users-roles')}
                  activeOpacity={0.7}
                >
                  <View style={[s.mgmtIconBox, { backgroundColor: '#F5F3FF' }]}>
                    <Ionicons name="people-outline" size={19} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.mgmtItemTitle}>Users & Roles Manager</Text>
                    <Text style={s.mgmtItemSubtitle}>Team members, project access, & role matrix</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[s.managementItem, { borderTopWidth: navAccess.usersRoles ? 1 : 0, borderTopColor: '#F1F5F9' }]}
                onPress={() => setActiveModal('appInfo')}
                activeOpacity={0.7}
              >
                <View style={[s.mgmtIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="information-circle-outline" size={19} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.mgmtItemTitle}>About Interior-OS Mobile</Text>
                  <Text style={s.mgmtItemSubtitle}>v2.1.0 Arctic • Enterprise Engine</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity
            style={s.logoutButton}
            onPress={() => setActiveModal('logout')}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={19} color="#EF4444" />
            <Text style={s.logoutButtonText}>Sign Out from Workspace</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Country Picker Modal */}
      <Modal
        visible={activeModal === 'countryPicker'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={s.modalDismiss} activeOpacity={1} onPress={() => setActiveModal(null)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={s.sheetAvoidingView}
          >
            <View style={[s.countrySheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHeaderRow}>
                <Text style={s.sheetTitle}>Select Country / Jurisdiction</Text>
                <TouchableOpacity onPress={() => setActiveModal(null)}>
                  <Ionicons name="close-circle" size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={s.searchContainer}>
                <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  style={s.searchInput}
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  placeholder="Search countries or currencies..."
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                />
                {countrySearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCountrySearch('')}>
                    <Ionicons name="close-outline" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Country List */}
              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item.cca2}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = orgForm.countryCode === item.cca2;
                  return (
                    <TouchableOpacity
                      style={[s.countryItem, isSelected && s.countryItemActive]}
                      onPress={() => handleSelectCountry(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 24, marginRight: 12 }}>{item.flag || '🌐'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.countryNameText, isSelected && s.countryNameTextActive]}>
                          {item.name}
                        </Text>
                        <Text style={s.countryMetaText}>
                          {item.currencyCode} ({item.currencySymbol || '$'}) • {item.primaryTimezone}
                        </Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
                    </TouchableOpacity>
                  );
                }}
                style={{ maxHeight: 400 }}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* App Info Modal */}
      <Modal visible={activeModal === 'appInfo'} animationType="fade" transparent onRequestClose={() => setActiveModal(null)}>
        <View style={s.centerModalOverlay}>
          <View style={s.infoCard}>
            <View style={s.infoIconBox}>
              <Ionicons name="sparkles" size={32} color="#2563EB" />
            </View>
            <Text style={s.infoTitle}>Interior-OS Enterprise</Text>
            <Text style={s.infoVersion}>v2.1.0 Arctic Mobile</Text>
            <Text style={s.infoDesc}>
              Enterprise interior fit-out execution suite. Real-time synchronisation with web dashboard, client quotations, BOQ revisions, and site tracking.
            </Text>
            <TouchableOpacity
              style={s.infoCloseBtn}
              onPress={() => setActiveModal(null)}
              activeOpacity={0.8}
            >
              <Text style={s.infoCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal visible={activeModal === 'logout'} animationType="fade" transparent onRequestClose={() => setActiveModal(null)}>
        <View style={s.centerModalOverlay}>
          <View style={s.infoCard}>
            <View style={[s.infoIconBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <Ionicons name="log-out-outline" size={32} color="#EF4444" />
            </View>
            <Text style={s.infoTitle}>Sign Out</Text>
            <Text style={[s.infoDesc, { marginBottom: 24 }]}>
              Are you sure you want to sign out from your Interior workspace?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={[s.infoCloseBtn, { flex: 1, backgroundColor: '#F1F5F9' }]}
                onPress={() => setActiveModal(null)}
              >
                <Text style={[s.infoCloseBtnText, { color: '#64748B' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.infoCloseBtn, { flex: 1, backgroundColor: '#EF4444' }]}
                onPress={confirmLogout}
              >
                <Text style={s.infoCloseBtnText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 16 },

  header: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
  },
  headerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  headerSubtitle: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#1D4ED8' },
  liveSyncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  liveSyncText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#047857' },
  pageTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', letterSpacing: -0.4 },

  heroCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  heroMain: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 20, fontFamily: 'Inter-Black' },
  heroInfo: { flex: 1, gap: 4 },
  nameBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  heroName: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A', flexShrink: 1 },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  roleBadgeLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#2563EB', letterSpacing: 0.4 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroEmail: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', flexShrink: 1 },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
  },
  verifiedText: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#059669' },

  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  heroFooterItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroFooterDivider: { width: 1, height: 14, backgroundColor: '#E2E8F0' },
  heroFooterText: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#475569' },
  currencyMiniBadge: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#2563EB' },

  tabBarContainer: { marginBottom: 18 },
  tabBarContent: { flexDirection: 'row', gap: 8 },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabPillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  tabPillText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  tabPillTextActive: { color: '#FFFFFF', fontFamily: 'Inter-Bold' },

  tabCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  cardSubtitle: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },

  formGroup: { gap: 14 },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputCol: { gap: 5 },
  inputLabel: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#334155' },
  textInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    fontSize: 13.5,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
  },
  disabledInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  disabledInputText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B' },
  iconInputContainer: { position: 'relative', justifyContent: 'center' },
  leadingIcon: { position: 'absolute', left: 14, zIndex: 1 },

  passwordInputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingLeft: 14,
    paddingRight: 44,
    fontSize: 13.5,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
  },
  eyeBtn: { position: 'absolute', right: 14, padding: 4 },

  strengthMeterContainer: { marginTop: 4, gap: 4 },
  strengthBarTrack: { height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  strengthBarFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontFamily: 'Inter-Bold', textAlign: 'right' },

  actionButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  actionButtonDisabled: { opacity: 0.6 },
  actionButtonText: { color: '#FFFFFF', fontSize: 13.5, fontFamily: 'Inter-Bold' },

  planBox: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  planBadgeText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB' },
  activeStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
  },
  activeStatusText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#059669' },
  planDesc: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', lineHeight: 17 },

  currencyPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  currencyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyLargeSymbol: { fontSize: 20, fontFamily: 'Inter-Black', color: '#FFFFFF' },
  currencyPreviewLabel: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' },
  currencyPreviewVal: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 1 },
  currencySampleLabel: { fontSize: 10.5, fontFamily: 'Inter-Medium', color: '#64748B' },
  currencySampleVal: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#1D4ED8', marginTop: 1 },

  countryPickerButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countryPickerText: { fontSize: 13.5, fontFamily: 'Inter-Medium', color: '#0F172A' },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  formatChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formatChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  formatChipText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  formatChipTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  managementSection: { marginTop: 4, marginBottom: 18 },
  managementSectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  managementCard: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  managementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  mgmtIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mgmtItemTitle: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  mgmtItemSubtitle: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 6,
  },
  logoutButtonText: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#EF4444' },

  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  modalDismiss: { ...StyleSheet.absoluteFillObject },
  sheetAvoidingView: { width: '100%', justifyContent: 'flex-end' },
  countrySheet: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 14 },
  sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  countryItemActive: { backgroundColor: '#EFF6FF' },
  countryNameText: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  countryNameTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },
  countryMetaText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },

  centerModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  infoCard: {
    width: '100%',
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoIconBox: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  infoTitle: { fontSize: 17, fontFamily: 'Inter-Black', color: '#0F172A' },
  infoVersion: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B', marginTop: 3, marginBottom: 12 },
  infoDesc: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#475569', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  infoCloseBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    width: '100%',
    alignItems: 'center',
  },
  infoCloseBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

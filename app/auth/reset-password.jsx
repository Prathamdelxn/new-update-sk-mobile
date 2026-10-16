import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { resetPassword } = useAuth();
  const { showToast } = useToast();

  const industryType = params.industryType || params.type || 'construction';
  const emailParam = (params.email || '').trim();

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setPositionAsync('relative').catch(() => {});
        NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
        NavigationBar.setBackgroundColorAsync('#F8FAFC').catch(() => {});
        NavigationBar.setButtonStyleAsync('dark').catch(() => {});
      } catch (e) {}
    }
  }, []);

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !otp.trim() || !newPassword || !confirmPassword) {
      setError(t('pleaseFillFields', 'Please fill in all fields'));
      return;
    }

    if (otp.trim().length !== 6) {
      setError(t('invalidOtp', 'Please enter a valid 6-digit verification code'));
      return;
    }

    if (newPassword.length < 6) {
      setError(t('passwordMinLength', 'Password must be at least 6 characters'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('passwordsDontMatch', 'Passwords do not match'));
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await resetPassword(trimmedEmail, otp.trim(), newPassword, industryType);
    setIsLoading(false);

    if (result.success) {
      showToast('Password has been successfully reset!', 'success');
      router.replace('/auth/login');
    } else {
      setError(result.message || 'Failed to reset password. Please verify your OTP.');
    }
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 8, Platform.OS === 'ios' ? 44 : 20),
              paddingBottom: Math.max(insets.bottom + 16, 24),
            },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.replace('/auth/login')}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={18} color="#0F172A" />
            </TouchableOpacity>

            <View style={styles.brandRow}>
              <Image
                source={require('../../assets/logo.svg')}
                style={styles.brandLogo}
                contentFit="contain"
              />
              <Text style={styles.brandTitle}>Skystruct</Text>
            </View>

            <View style={{ width: 36 }} />
          </View>

          {/* Form Card (Matching Web /reset-password) */}
          <View style={styles.card}>
            {/* Header info */}
            <View style={styles.cardHeader}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.cardHeading}>Reset Password</Text>
                <View
                  style={[
                    styles.modeBadge,
                    industryType === 'interior' ? styles.modeBadgeInterior : styles.modeBadgeConstruction,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeBadgeText,
                      industryType === 'interior' ? styles.modeBadgeTextInterior : styles.modeBadgeTextConstruction,
                    ]}
                  >
                    {industryType === 'interior' ? '🎨 Interior' : '🏗️ Construction'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSubheading}>
                Enter the 6-digit OTP code and choose your new password.
              </Text>
            </View>

            {/* Error Banner */}
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.errorText} numberOfLines={2}>
                  {error}
                </Text>
              </View>
            ) : null}

            {/* Email Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={[styles.inputWrapper, !!emailParam && styles.inputWrapperDisabled]}>
                <Ionicons name="mail-outline" size={16} color="#94A3B8" style={styles.fieldIcon} />
                <TextInput
                  style={[styles.input, !!emailParam && styles.inputDisabled]}
                  placeholder="name@company.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (error) setError('');
                  }}
                  editable={!emailParam}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* 6-Digit OTP Field (Monospace, Web Parity) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Verification Code (OTP)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="key-outline" size={16} color="#94A3B8" style={styles.fieldIcon} />
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor="#CBD5E1"
                  value={otp}
                  onChangeText={(val) => {
                    setOtp(val.replace(/\D/g, ''));
                    if (error) setError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>

            {/* New Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>New Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={16} color="#94A3B8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Min. 6 characters"
                  placeholderTextColor="#94A3B8"
                  value={newPassword}
                  onChangeText={(val) => {
                    setNewPassword(val);
                    if (error) setError('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  activeOpacity={0.7}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={17}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Field */}
            <View style={[styles.fieldGroup, { marginBottom: 12 }]}>
              <Text style={styles.fieldLabel}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={16} color="#94A3B8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter new password"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={(val) => {
                    setConfirmPassword(val);
                    if (error) setError('');
                  }}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  activeOpacity={0.7}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={17}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleResetPassword}
              disabled={isLoading || otp.length !== 6 || newPassword.length < 6}
              style={[
                styles.primaryBtn,
                (isLoading || otp.length !== 6 || newPassword.length < 6) && { opacity: 0.65 },
              ]}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.primaryBtnText}>Resetting password...</Text>
                </View>
              ) : (
                <Text style={styles.primaryBtnText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            {/* Back to Login Link */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.backToLoginRow}
              onPress={() => router.replace('/auth/login')}
            >
              <Ionicons name="arrow-back" size={14} color="#64748B" />
              <Text style={styles.backToLoginText}>Back to login</Text>
            </TouchableOpacity>
          </View>

          {/* Trust Footer */}
          <View style={styles.trustFooter}>
            <Ionicons name="shield-checkmark" size={13} color="#94A3B8" />
            <Text style={styles.trustFooterText}>Encrypted and authenticated session</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  brandLogo: {
    width: 28,
    height: 28,
  },
  brandTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeading: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  modeBadgeConstruction: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  modeBadgeInterior: {
    backgroundColor: '#F5F3FF',
    borderColor: '#EDE9FE',
  },
  modeBadgeText: {
    fontSize: 10.5,
    fontFamily: 'Inter-SemiBold',
  },
  modeBadgeTextConstruction: {
    color: '#1D4ED8',
  },
  modeBadgeTextInterior: {
    color: '#7C3AED',
  },
  cardSubheading: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 3,
    lineHeight: 17,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  fieldGroup: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontFamily: 'Inter-SemiBold',
    color: '#334155',
    marginBottom: 4,
  },
  inputWrapper: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapperDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  fieldIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 13.5,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
    paddingVertical: 0,
  },
  inputDisabled: {
    color: '#64748B',
  },
  otpInput: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    letterSpacing: 6,
    textAlign: 'center',
  },
  eyeBtn: {
    padding: 6,
  },
  primaryBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  backToLoginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
    paddingVertical: 4,
  },
  backToLoginText: {
    color: '#64748B',
    fontSize: 12.5,
    fontFamily: 'Inter-SemiBold',
  },
  trustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 14,
    marginBottom: 4,
  },
  trustFooterText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
  },
});

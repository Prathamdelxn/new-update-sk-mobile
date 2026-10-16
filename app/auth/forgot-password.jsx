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

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { forgotPassword } = useAuth();
  const { showToast } = useToast();

  const [industryType, setIndustryType] = useState(params.industryType || 'construction');
  const [email, setEmail] = useState(params.email || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fpSent, setFpSent] = useState(false);

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

  const handleSendOTP = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError(t('pleaseEnterEmail', 'Please enter your email address'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError(t('invalidEmail', 'Please enter a valid email address'));
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await forgotPassword(trimmedEmail, industryType);
    setIsLoading(false);

    if (result.success) {
      setFpSent(true);
      showToast('Reset verification code sent to your email', 'success');
    } else {
      setError(result.message || 'Failed to send reset code');
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
          {/* Top Bar: Back Button + Brand Row */}
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

          {/* Main Card */}
          <View style={styles.card}>
            {fpSent ? (
              /* Phase 2: OTP Sent Confirmation View (100% Web Parity) */
              <View style={styles.sentContainer}>
                <View style={styles.sentIconCircle}>
                  <Ionicons name="checkmark-circle" size={42} color="#059669" />
                </View>

                <Text style={styles.sentTitle}>OTP Sent</Text>
                <Text style={styles.sentSubtitle}>
                  A reset verification code has been sent to{' '}
                  <Text style={styles.sentEmailHighlight}>{email.trim()}</Text>.
                </Text>

                {/* Primary Button: Enter OTP & Reset Password */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.primaryBtn}
                  onPress={() => {
                    router.push({
                      pathname: '/auth/reset-password',
                      params: {
                        email: email.trim().toLowerCase(),
                        type: industryType,
                        industryType,
                      },
                    });
                  }}
                >
                  <Text style={styles.primaryBtnText}>Enter OTP & Reset Password</Text>
                </TouchableOpacity>

                {/* Secondary Button: Resend Email */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.resendBtn}
                  onPress={() => {
                    setFpSent(false);
                    setError('');
                  }}
                >
                  <Text style={styles.resendBtnText}>Resend Email / Change Address</Text>
                </TouchableOpacity>

                {/* Back to Login link */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.backToLoginRow}
                  onPress={() => router.replace('/auth/login')}
                >
                  <Ionicons name="arrow-back" size={14} color="#64748B" />
                  <Text style={styles.backToLoginText}>Back to login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Phase 1: Request Password Reset View */
              <>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeading}>Reset Password</Text>
                  <Text style={styles.cardSubheading}>
                    Enter your email and we’ll send a verification code to recover your account.
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

                {/* Mode Segmented Switcher (Construction vs Interior) */}
                <View style={styles.modeSection}>
                  <Text style={styles.fieldLabel}>Workspace Mode</Text>
                  <View style={styles.industrySegment}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setIndustryType('construction');
                        setError('');
                      }}
                      style={[
                        styles.segmentBtn,
                        industryType === 'construction' && styles.segmentBtnActive,
                      ]}
                    >
                      <Text style={styles.segmentEmoji}>🏗️</Text>
                      <Text
                        style={[
                          styles.segmentText,
                          industryType === 'construction' && styles.segmentTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        Construction
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setIndustryType('interior');
                        setError('');
                      }}
                      style={[
                        styles.segmentBtn,
                        industryType === 'interior' && styles.segmentBtnActive,
                      ]}
                    >
                      <Text style={styles.segmentEmoji}>🎨</Text>
                      <Text
                        style={[
                          styles.segmentText,
                          industryType === 'interior' && styles.segmentTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        Interior Design
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Email Input */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={16} color="#94A3B8" style={styles.fieldIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="name@company.com"
                      placeholderTextColor="#94A3B8"
                      value={email}
                      onChangeText={(val) => {
                        setEmail(val);
                        if (error) setError('');
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSendOTP}
                  disabled={isLoading}
                  style={[styles.primaryBtn, isLoading && { opacity: 0.75 }]}
                >
                  {isLoading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.primaryBtnText}>Sending reset code...</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryBtnText}>Send Reset Code</Text>
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
              </>
            )}
          </View>

          {/* Trust Footer */}
          <View style={styles.trustFooter}>
            <Ionicons name="shield-checkmark" size={13} color="#94A3B8" />
            <Text style={styles.trustFooterText}>Secure password recovery with encrypted OTP</Text>
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
    marginBottom: 12,
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
    marginBottom: 14,
  },
  cardHeading: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  cardSubheading: {
    fontSize: 12.5,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 3,
    lineHeight: 18,
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
  modeSection: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontFamily: 'Inter-SemiBold',
    color: '#334155',
    marginBottom: 4,
  },
  industrySegment: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentEmoji: {
    fontSize: 13,
  },
  segmentText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#1D4ED8',
  },
  fieldGroup: {
    marginBottom: 14,
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
    marginTop: 14,
    paddingVertical: 4,
  },
  backToLoginText: {
    color: '#64748B',
    fontSize: 12.5,
    fontFamily: 'Inter-SemiBold',
  },
  sentContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sentIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sentTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  sentSubtitle: {
    fontSize: 12.5,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  sentEmailHighlight: {
    color: '#0F172A',
    fontFamily: 'Inter-Bold',
  },
  resendBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  resendBtnText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#2563EB',
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

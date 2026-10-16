import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function VerifyRegistrationOtpScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { email, password, industryType, organizationName, firstName, lastName, phone, country, currency, timezone } = params;
  const isInterior = industryType === 'interior';

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setPositionAsync('relative').catch(() => {});
        NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
      } catch (e) {}
    }
  }, []);

  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [error, setError] = useState('');
  const router = useRouter();
  const { showToast } = useToast();
  const { verifyRegistrationOtp, registerInterior, register } = useAuth();

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleVerifyOTP = async () => {
    if (!otp) {
      setError('Please enter the OTP');
      return;
    }
    if (otp.length !== 6) {
      setError('OTP must be 6 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await verifyRegistrationOtp(email, otp, password, industryType || 'construction');

      if (result.success) {
        showToast(isInterior ? 'Workspace verified and created successfully!' : 'Account verified successfully!', 'success');
        router.replace('/(tabs)/dashboard');
      } else {
        setError(result.message || 'Verification failed. Please check the OTP.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0 || resendLoading) return;
    setResendLoading(true);
    setError('');
    try {
      if (isInterior) {
        const result = await registerInterior({
          organizationName: organizationName || 'Studio',
          firstName: firstName || '',
          lastName: lastName || '',
          email,
          password,
          phone,
          country,
          currency,
          timezone,
        });
        if (result.success) {
          showToast('A new OTP has been sent to your email.', 'success');
          setCountdown(30);
        } else {
          setError(result.message || 'Failed to resend code');
        }
      } else {
        const result = await register(params.name || '', email, password, params.phoneNumber || '', 'construction');
        if (result.success) {
          showToast('A new OTP has been sent to your email.', 'success');
          setCountdown(30);
        } else {
          setError(result.message || 'Failed to resend code');
        }
      }
    } catch (err) {
      setError('Failed to resend OTP. Check connection.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="dark-content" />
      <SimpleBackground />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.formContainer, { paddingTop: Math.max(insets.top + 20, 36), paddingBottom: Math.max(insets.bottom + 24, 36) }]}>
          <TouchableOpacity 
            style={[styles.backButton, { top: Math.max(insets.top + 10, 36) }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Image
              source={require('../../assets/logo.svg')}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.headerTitle}>
              {isInterior ? 'Verify your workspace' : 'Verify Email'}
            </Text>
            <Text style={styles.subtext}>
              {isInterior
                ? `We sent a 6-digit code to ${email}. Enter it below to complete setup.`
                : `Enter the 6-digit OTP sent to ${email}`}
            </Text>
          </View>

          <View style={styles.glassCard}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {isInterior ? 'Verification code' : 'OTP Code'}
              </Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="000000"
                  placeholderTextColor="#94A3B8"
                  value={otp}
                  onChangeText={(text) => setOtp(text.replace(/\D/g, ''))}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleVerifyOTP}
              disabled={isLoading || otp.length !== 6}
            >
              <View style={[styles.buttonContainer, (isLoading || otp.length !== 6) && { opacity: 0.7 }]}>
                <View style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : isInterior ? (
                      'Verify workspace'
                    ) : (
                      'Verify Account'
                    )}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              <Text style={styles.resendPrompt}>Didn&apos;t receive a code? </Text>
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={countdown > 0 || resendLoading}
                activeOpacity={0.7}
              >
                <Text style={[styles.resendLink, (countdown > 0 || resendLoading) && styles.resendDisabled]}>
                  {resendLoading ? 'Resending...' : countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#F0F9FF',
  },
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFF',
  },
  container: {
    flex: 1,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtext: {
    fontSize: 16,
    color: '#64748B',
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  glassCard: {
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#334155',
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    overflow: 'hidden',
  },
  input: {
    padding: 16,
    fontSize: 16,
    color: '#0F172A',
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
    letterSpacing: 4,
  },
  buttonContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionButton: {
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  resendPrompt: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  resendLink: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  resendDisabled: {
    color: '#94A3B8',
  },
});

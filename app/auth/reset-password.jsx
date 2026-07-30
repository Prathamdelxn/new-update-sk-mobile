import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { email } = useLocalSearchParams();
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const { showToast } = useToast();

  const handleResetPassword = async () => {
    if (!otp || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Password reset successfully!', 'success');
        router.replace('/auth/login');
      } else {
        setError(data.message || 'Failed to reset password');
      }
    } catch (err) {
      setError(t('networkErrorTryAgain'));
    } finally {
      setIsLoading(false);
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
        <View style={styles.formContainer}>
          <TouchableOpacity 
            style={styles.backButton}
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
            <Text style={styles.headerTitle}>Reset Password</Text>
            <Text style={styles.subtext}>Enter the OTP sent to {email}</Text>
          </View>

          <View style={styles.glassCard}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>OTP Code</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="123456"
                  placeholderTextColor="#94A3B8"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={[styles.inputWrapper, styles.inputWrapperRow]}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <View style={[styles.inputWrapper, styles.inputWrapperRow]}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleResetPassword}
              disabled={isLoading}
              style={{ marginTop: 8 }}
            >
              <View style={[styles.buttonContainer, isLoading && { opacity: 0.7 }]}>
                <View style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      'Reset Password'
                    )}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
     fontFamily: 'Inter-Black',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtext: {
    fontSize: 14,
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
    marginBottom: 20,
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
  inputWrapperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    padding: 16,
    fontSize: 16,
    color: '#0F172A',
     fontFamily: 'Inter-SemiBold',
  },
  eyeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 16,
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
});

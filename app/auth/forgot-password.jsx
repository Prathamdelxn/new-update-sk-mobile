import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { showToast } = useToast();

  const handleSendOTP = async () => {
    if (!email) {
      setError(t('pleaseEnterEmail'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('OTP sent to your email', 'success');
        router.push({
          pathname: '/auth/reset-password',
          params: { email }
        });
      } else {
        setError(data.message || 'Failed to send OTP');
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
            <Text style={styles.headerTitle}>{t('forgotPassword')}</Text>
            <Text style={styles.subtext}>{t('enterEmailOTP')}</Text>
          </View>

          <View style={styles.glassCard}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('emailAddress')}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={t('emailPlaceholder')}
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSendOTP}
              disabled={isLoading}
            >
              <View style={[styles.buttonContainer, isLoading && { opacity: 0.7 }]}>
                <View style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      t('sendOTP')
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

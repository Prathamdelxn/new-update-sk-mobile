import { useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Dimensions, StatusBar, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import AdaptiveGlass from '../components/AdaptiveGlass';

import { useAuth } from '../context/AuthContext';
import { useSuperAdmin } from '../context/SuperAdminContext';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function LoginScreen() {
  const [industryType, setIndustryType] = useState('construction');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const { saLogin } = useSuperAdmin();
  const router = useRouter();
  const { t } = useTranslation();

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t('pleaseFillFields', 'Please fill in all fields'));
      return;
    }

    setIsLoading(true);
    setError('');

    if (industryType === 'interior') {
      const result = await login(email, password, 'interior');
      setIsLoading(false);
      if (result.success) {
        router.replace('/(tabs)/dashboard');
        return;
      }
      setError(result.message || t('invalidCredentials', 'Invalid credentials'));
      return;
    }

    // Try Super Admin login first
    const saResult = await saLogin(email, password);
    if (saResult.success) {
      setIsLoading(false);
      router.replace('/superadmin/dashboard');
      return;
    }

    // If SA login fails, try regular user login
    const result = await login(email, password, 'construction');
    setIsLoading(false);
    if (result.success) {
      router.replace('/(tabs)/dashboard');
      return;
    }

    setError(result.message || saResult.message || t('invalidCredentials', 'Invalid credentials'));
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="dark-content" />
      <SimpleBackground />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.formContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo.svg')}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.eliteGreeting}>{t('welcomeBack', 'Welcome back! Please enter your details.')}</Text>
            <Text style={styles.eliteTitle}>Skystruct</Text>
          </View>

          <View style={styles.glassCard}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Workspace Mode</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIndustryType('construction')}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: industryType === 'construction' ? '#2563EB' : '#E2E8F0',
                    backgroundColor: industryType === 'construction' ? '#EFF6FF' : '#F8FAFC',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: industryType === 'construction' ? '#1E40AF' : '#64748B' }}>
                    🏗️ Construction
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIndustryType('interior')}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: industryType === 'interior' ? '#2563EB' : '#E2E8F0',
                    backgroundColor: industryType === 'interior' ? '#DBEAFE' : '#F8FAFC',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: industryType === 'interior' ? '#6B21A8' : '#64748B' }}>
                    🎨 Interior Design
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('email', 'Email')}</Text>
              <View style={[styles.inputWrapper, { gap: 12 }]}>
                <Ionicons name="mail-outline" size={20} color="#94A3B8" />
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

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('password', 'Password')}</Text>
              <View style={[styles.inputWrapper, { gap: 12 }]}>
                <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
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

            <View style={styles.forgotRow}>
              <TouchableOpacity
                style={styles.forgotPassword}
                activeOpacity={0.7}
                onPress={() => router.push('/auth/forgot-password')}
              >
                <Text style={styles.forgotPasswordText}>{t('forgetPassword', 'Forget Password?')}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <View style={[styles.buttonContainer, isLoading && { opacity: 0.7 }]}>
                <View style={styles.loginButton}>
                  <Text style={styles.loginButtonText}>
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      t('loginUpper', 'Login')
                    )}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/auth/register')}
              activeOpacity={0.7}
              style={styles.registerLink}
            >
              <Text style={styles.registerLinkText}>
                {t('dontHaveAccount', "Don't have an account?")}{' '}
                <Text style={styles.registerLinkHighlight}>{t('signUp', 'Sign Up')}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <TouchableOpacity
        style={styles.languageBtn}
        onPress={() => router.push('/auth/language-select')}
        onLongPress={async () => {
          await SecureStore.deleteItemAsync('hasSeenOnboarding');
          await SecureStore.deleteItemAsync('hasSelectedLanguage');
          alert('App state reset! Restart the app to see the intro sequence again.');
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="language" size={24} color="#1E293B" />
      </TouchableOpacity>
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
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  eliteGreeting: {
    fontSize: 13,
    color: '#3B82F6',
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  eliteTitle: {
    fontSize: 38,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    letterSpacing: -1.5,
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
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#334155',
    marginBottom: 8,
  },
  languageBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 65 : 45,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    fontFamily: 'Inter-SemiBold',
    height: '100%',
    paddingVertical: 0,
  },
  eyeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  forgotPassword: {
    marginBottom: 32,
    marginTop: -4,
  },
  forgotPasswordText: {
    color: '#3B82F6',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  buttonContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  loginButton: {
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: '#2563EB', // Bluish color theme
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  forgotRow: {
    alignItems: 'flex-end',
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  registerLinkText: {
    color: '#475569',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  registerLinkHighlight: {
    color: '#3B82F6',
    fontFamily: 'Inter-Black',
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

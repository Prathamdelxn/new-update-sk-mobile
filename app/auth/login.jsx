import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
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
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useSuperAdmin } from '../context/SuperAdminContext';
import { useTranslation } from 'react-i18next';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
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
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Floating Language Button on top-left (Fixed position) */}
      <TouchableOpacity
        style={[
          styles.langBtn,
          {
            top: Math.max(insets.top + 6, Platform.OS === 'ios' ? 44 : 20),
          },
        ]}
        onPress={() => router.push('/auth/language-select')}
        onLongPress={async () => {
          await SecureStore.deleteItemAsync('hasSeenOnboarding');
          await SecureStore.deleteItemAsync('hasSelectedLanguage');
          alert('App state reset! Restart the app to see the intro sequence again.');
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="language" size={16} color="#475569" />
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 16, Platform.OS === 'ios' ? 48 : 24),
              paddingBottom: Math.max(insets.bottom + 16, 20),
            },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Centered Header: Logo in Center, then Title & Subtitle */}
          <View style={styles.headerSection}>
            <Image
              source={require('../../assets/logo.svg')}
              style={styles.centeredLogo}
              contentFit="contain"
            />
            <Text style={styles.mainTitle}>Welcome Back</Text>
            <Text style={styles.subTitle}>
              {industryType === 'interior'
                ? 'Sign in to your studio command centre'
                : 'Sign in to your project command centre'}
            </Text>
          </View>

          {/* Error Banner */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={15} color="#DC2626" style={{ marginRight: 6 }} />
              <Text style={styles.errorText} numberOfLines={2}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Form Card */}
          <View style={styles.card}>
            {/* Segmented Industry Switcher (100% Matching Register) */}
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

            {/* Email Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('email', 'Work email')}</Text>
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

            {/* Password Field */}
            <View style={[styles.fieldGroup, { marginBottom: 4 }]}>
              <Text style={styles.fieldLabel}>{t('password', 'Password')}</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={16} color="#94A3B8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (error) setError('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={17}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password Link */}
            <View style={styles.forgotRow}>
              <TouchableOpacity
                style={styles.forgotPassword}
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: '/auth/forgot-password',
                    params: {
                      industryType,
                      email: email || '',
                    },
                  })
                }
              >
                <Text style={styles.forgotPasswordText}>
                  {t('forgetPassword', 'Forgot password?')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleLogin}
              disabled={isLoading}
              style={[styles.submitBtn, isLoading && { opacity: 0.75 }]}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.submitBtnText}>Signing in...</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>{t('loginUpper', 'Sign in')}</Text>
              )}
            </TouchableOpacity>

            {/* Register Link */}
            <TouchableOpacity
              onPress={() => router.push('/auth/register')}
              activeOpacity={0.7}
              style={styles.registerRow}
            >
              <Text style={styles.registerRowText}>
                {t('dontHaveAccount', "Don't have a workspace?")}{' '}
                <Text style={styles.registerRowHighlight}>
                  {t('signUp', 'Create workspace')}
                </Text>
              </Text>
            </TouchableOpacity>
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
    justifyContent: 'center',
  },
  langBtn: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  centeredLogo: {
    width: 72,
    height: 40,
    marginBottom: 6,
  },
  mainTitle: {
    fontSize: 26,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    letterSpacing: -0.7,
    textAlign: 'center',
  },
  subTitle: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 11.5,
    fontFamily: 'Inter-Medium',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  industrySegment: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
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
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontFamily: 'Inter-SemiBold',
    color: '#334155',
    marginBottom: 4,
  },
  inputWrapper: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldIcon: {
    marginRight: 7,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 13.5,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: 2,
    marginBottom: 8,
  },
  forgotPassword: {
    paddingVertical: 2,
  },
  forgotPasswordText: {
    color: '#2563EB',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  submitBtn: {
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
    gap: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  registerRow: {
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 2,
  },
  registerRowText: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  registerRowHighlight: {
    color: '#2563EB',
    fontFamily: 'Inter-Bold',
  },
});

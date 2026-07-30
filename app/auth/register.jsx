import { useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Dimensions, StatusBar, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import AdaptiveGlass from '../components/AdaptiveGlass';
import PhoneInput from '../components/PhoneInput';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
const { width, height } = Dimensions.get('window');

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [industryType, setIndustryType] = useState('construction');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (!email.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (phoneNumber && !isPhoneValid) {
      setError('Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    setError('');
    const result = await register(name, email, password, phoneNumber, industryType);
    setIsLoading(false);

    if (result.success) {
      router.push({
        pathname: '/auth/verify-registration-otp',
        params: { email, password }
      });
    } else {
      setError(result.message);
    }
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
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo.svg')}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.eliteGreeting}>{t('createWorkspaceAccount')}</Text>
            <Text style={styles.eliteTitle}>Skystruct</Text>
          </View>

          <View style={styles.glassCard}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Industry / Business Type</Text>
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
                    borderColor: industryType === 'interior' ? '#9333EA' : '#E2E8F0',
                    backgroundColor: industryType === 'interior' ? '#F3E8FF' : '#F8FAFC',
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
              <Text style={styles.inputLabel}>{t('fullName')}</Text>
              <View style={[styles.inputWrapper, { gap: 12 }]}>
                <Ionicons name="person-outline" size={20} color="#94A3B8" />
                <TextInput
                  style={styles.input}
                  placeholder={t('johnDoePlaceholder')}
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('email')}</Text>
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

            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <Text style={styles.inputLabel}>{t('mobileNumber')}</Text>
              <PhoneInput
                value={phoneNumber}
                onChange={setPhoneNumber}
                onValidate={setIsPhoneValid}
                placeholder="Enter mobile number"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('password')}</Text>
              <View style={[styles.inputWrapper, { gap: 12 }]}>
                <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('confirmPassword')}</Text>
              <View style={[styles.inputWrapper, { gap: 12 }]}>
                <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleRegister}
              disabled={isLoading}
            >
              <View style={[styles.buttonContainer, isLoading && { opacity: 0.7 }]}>
                <View style={styles.registerButton}>
                  <Text style={styles.registerButtonText}>
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      t('createAccount')
                    )}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace('/auth/login')}
              activeOpacity={0.7}
              style={styles.loginLink}
            >
              <Text style={styles.loginLinkText}>
                {t('alreadyHaveAccount')}{' '}
                <Text style={styles.loginLinkHighlight}>{t('login')}</Text>
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
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 70 : 48,
    paddingBottom: 12,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  logo: {
    width: 130,
    height: 130,
    marginBottom: 16,
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
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#334155',
    marginBottom: 8,
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
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
    height: '100%',
    paddingVertical: 0,
  },
  buttonContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  registerButton: {
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: '#2563EB', // Bluish color theme
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  loginLinkText: {
    color: '#475569',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  loginLinkHighlight: {
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

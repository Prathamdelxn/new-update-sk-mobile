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
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CountryCodeModal from '../components/CountryCodeModal';
import { getCountryByCode } from '../services/countryService';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [industryType, setIndustryType] = useState('interior');

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

  // Shared state
  const [selectedCountry, setSelectedCountry] = useState(() => getCountryByCode('IN'));
  const [isCountryModalVisible, setIsCountryModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Construction fields
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [constructionPhone, setConstructionPhone] = useState('');

  // Interior fields (matching web /register)
  const [organizationName, setOrganizationName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [interiorPhone, setInteriorPhone] = useState('');

  const { register } = useAuth();
  const router = useRouter();
  const isInterior = industryType === 'interior';

  const handleRegister = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (isInterior) {
      if (!organizationName || !firstName || !lastName || !email || !password) {
        setError('Please fill in all required fields');
        return;
      }
      if (!emailRegex.test(email.trim().toLowerCase())) {
        setError('Enter a valid email address');
        return;
      }
      const strongEnough =
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password);
      if (!strongEnough) {
        setError('Password must be 8+ chars with uppercase, lowercase & number');
        return;
      }

      const fullPhone = interiorPhone.trim()
        ? `${selectedCountry?.phoneCode || '+91'} ${interiorPhone.trim()}`
        : '';

      setIsLoading(true);
      setError('');
      const result = await register(null, email, password, null, 'interior', {
        organizationName,
        firstName,
        lastName,
        phone: fullPhone,
        country: selectedCountry?.name || 'India',
        currency: selectedCountry?.currencyCode || 'INR',
        timezone: selectedCountry?.primaryTimezone || 'Asia/Kolkata',
      });
      setIsLoading(false);

      if (result.success) {
        router.push({
          pathname: '/auth/verify-registration-otp',
          params: {
            email,
            password,
            industryType: 'interior',
            organizationName,
            firstName,
            lastName,
            phone: fullPhone,
            country: selectedCountry?.name || 'India',
            currency: selectedCountry?.currencyCode || 'INR',
            timezone: selectedCountry?.primaryTimezone || 'Asia/Kolkata',
          },
        });
      } else {
        setError(result.message);
      }
      return;
    }

    // Construction validation (matching web parity)
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields');
      return;
    }
    if (!emailRegex.test(email.trim().toLowerCase())) {
      setError('Enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const fullPhone = constructionPhone.trim()
      ? `${selectedCountry?.phoneCode || '+91'} ${constructionPhone.trim()}`
      : '';

    setIsLoading(true);
    setError('');
    const result = await register(name, email, password, fullPhone, 'construction');
    setIsLoading(false);

    if (result.success) {
      router.push({
        pathname: '/auth/verify-registration-otp',
        params: {
          email,
          password,
          industryType: 'construction',
          name,
          phoneNumber: fullPhone,
        },
      });
    } else {
      setError(result.message);
    }
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
          {/* Centered Header: Logo in Center, then Title directly under that Logo */}
          <View style={styles.headerSection}>
            <Image
              source={require('../../assets/logo.svg')}
              style={styles.centeredLogo}
              contentFit="contain"
            />
            <Text style={styles.mainTitle}>Create Workspace</Text>
            <Text style={styles.subTitle}>
              {isInterior ? 'Set up your studio command centre' : 'Set up your project command centre'}
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
            {/* Segmented Industry Switcher */}
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

            {isInterior ? (
              <>
                {/* INTERIOR FORM */}
                {/* Organization */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Company / Organization</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="business-outline" size={16} color="#94A3B8" style={styles.fieldIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Acme Interior Solutions"
                      placeholderTextColor="#94A3B8"
                      value={organizationName}
                      onChangeText={setOrganizationName}
                    />
                  </View>
                </View>

                {/* First name & Last name */}
                <View style={styles.nameRow}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>First name</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="person-outline" size={15} color="#94A3B8" style={styles.fieldIconSmall} />
                      <TextInput
                        style={styles.input}
                        placeholder="John"
                        placeholderTextColor="#94A3B8"
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Last name</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={[styles.input, { paddingLeft: 4 }]}
                        placeholder="Doe"
                        placeholderTextColor="#94A3B8"
                        value={lastName}
                        onChangeText={setLastName}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                </View>

                {/* Work email */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Work email</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={16} color="#94A3B8" style={styles.fieldIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="john@acme.com"
                      placeholderTextColor="#94A3B8"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                {/* Contact Number with Country Code */}
                <View style={styles.fieldGroup}>
                  <View style={styles.phoneLabelRow}>
                    <Text style={styles.fieldLabel}>Contact Number</Text>
                    <View style={styles.currencyPill}>
                      <Text style={styles.currencyPillText}>
                        {selectedCountry?.currencySymbol} {selectedCountry?.currencyCode}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.phoneRow}>
                    <TouchableOpacity
                      style={styles.countryBtn}
                      onPress={() => setIsCountryModalVisible(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.countryFlag}>{selectedCountry?.flag}</Text>
                      <Text style={styles.countryCode}>{selectedCountry?.phoneCode}</Text>
                      <Ionicons name="chevron-down" size={12} color="#64748B" />
                    </TouchableOpacity>

                    <View style={[styles.inputWrapper, { flex: 1 }]}>
                      <Ionicons name="call-outline" size={15} color="#94A3B8" style={styles.fieldIconSmall} />
                      <TextInput
                        style={styles.input}
                        placeholder="555 019 2834"
                        placeholderTextColor="#94A3B8"
                        value={interiorPhone}
                        onChangeText={(text) => setInteriorPhone(text.replace(/[^\d\s-]/g, ''))}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>
                </View>

                {/* Password */}
                <View style={[styles.fieldGroup, { marginBottom: 4 }]}>
                  <Text style={styles.fieldLabel}>{t('password')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={16} color="#94A3B8" style={styles.fieldIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Min. 8 characters"
                      placeholderTextColor="#94A3B8"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
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
                  <Text style={styles.passwordHint}>
                    8+ chars with uppercase, lowercase &amp; number
                  </Text>
                </View>
              </>
            ) : (
              <>
                {/* CONSTRUCTION FORM - 100% Matching Structure & Styling */}
                {/* Full Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Full name</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={16} color="#94A3B8" style={styles.fieldIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="John Doe"
                      placeholderTextColor="#94A3B8"
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                {/* Work email */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Work email</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={16} color="#94A3B8" style={styles.fieldIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="name@company.com"
                      placeholderTextColor="#94A3B8"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                {/* Contact Number with Same Country Picker */}
                <View style={styles.fieldGroup}>
                  <View style={styles.phoneLabelRow}>
                    <Text style={styles.fieldLabel}>Contact Number</Text>
                    <View style={styles.currencyPill}>
                      <Text style={styles.currencyPillText}>
                        {selectedCountry?.currencySymbol} {selectedCountry?.currencyCode}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.phoneRow}>
                    <TouchableOpacity
                      style={styles.countryBtn}
                      onPress={() => setIsCountryModalVisible(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.countryFlag}>{selectedCountry?.flag}</Text>
                      <Text style={styles.countryCode}>{selectedCountry?.phoneCode}</Text>
                      <Ionicons name="chevron-down" size={12} color="#64748B" />
                    </TouchableOpacity>

                    <View style={[styles.inputWrapper, { flex: 1 }]}>
                      <Ionicons name="call-outline" size={15} color="#94A3B8" style={styles.fieldIconSmall} />
                      <TextInput
                        style={styles.input}
                        placeholder="555 019 2834"
                        placeholderTextColor="#94A3B8"
                        value={constructionPhone}
                        onChangeText={(text) => setConstructionPhone(text.replace(/[^\d\s-]/g, ''))}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>
                </View>

                {/* Password & Confirm Password (Side-by-side matching web layout) */}
                <View style={[styles.fieldGroup, { marginBottom: 4 }]}>
                  <View style={styles.nameRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Password</Text>
                      <View style={styles.inputWrapper}>
                        <Ionicons name="lock-closed-outline" size={15} color="#94A3B8" style={styles.fieldIconSmall} />
                        <TextInput
                          style={styles.input}
                          placeholder="Min. 8 chars"
                          placeholderTextColor="#94A3B8"
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          activeOpacity={0.7}
                          style={styles.eyeBtn}
                        >
                          <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={16}
                            color="#64748B"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Confirm password</Text>
                      <View style={styles.inputWrapper}>
                        <Ionicons name="lock-closed-outline" size={15} color="#94A3B8" style={styles.fieldIconSmall} />
                        <TextInput
                          style={styles.input}
                          placeholder="Confirm"
                          placeholderTextColor="#94A3B8"
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          secureTextEntry={!showConfirmPassword}
                        />
                        <TouchableOpacity
                          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                          activeOpacity={0.7}
                          style={styles.eyeBtn}
                        >
                          <Ionicons
                            name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={16}
                            color="#64748B"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.passwordHint}>
                    8+ chars with uppercase, lowercase, number &amp; symbol
                  </Text>
                </View>
              </>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleRegister}
              disabled={isLoading}
              style={[styles.submitBtn, isLoading && { opacity: 0.75 }]}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.submitBtnText}>Creating workspace...</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>Create workspace</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <TouchableOpacity
              onPress={() => router.replace('/auth/login')}
              activeOpacity={0.7}
              style={styles.loginRow}
            >
              <Text style={styles.loginRowText}>
                Already have a workspace?{' '}
                <Text style={styles.loginRowHighlight}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Code Picker Modal */}
      <CountryCodeModal
        visible={isCountryModalVisible}
        onClose={() => setIsCountryModalVisible(false)}
        selectedCode={selectedCountry?.cca2}
        onSelectCountry={(country) => setSelectedCountry(country)}
      />
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
  nameRow: {
    flexDirection: 'row',
    gap: 8,
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
  fieldIconSmall: {
    marginRight: 5,
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
  passwordHint: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginTop: 2,
  },
  phoneLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  currencyPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  currencyPillText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  countryBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countryFlag: {
    fontSize: 16,
  },
  countryCode: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
  },
  submitBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
  loginRow: {
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 2,
  },
  loginRowText: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  loginRowHighlight: {
    color: '#2563EB',
    fontFamily: 'Inter-Bold',
  },
});

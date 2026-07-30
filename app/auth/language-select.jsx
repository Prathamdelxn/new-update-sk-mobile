import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, I18nManager } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Updates from 'expo-updates';
import * as SecureStore from 'expo-secure-store';

export default function LanguageSelectScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();

  const handleLanguageSelect = async (lng) => {
    await i18n.changeLanguage(lng);
    await SecureStore.setItemAsync('settings.lang', lng);
    await SecureStore.setItemAsync('hasSelectedLanguage', 'true');

    const isArabic = lng === 'ar';
    let needsRestart = false;

    if (isArabic && !I18nManager.isRTL) {
      I18nManager.forceRTL(true);
      I18nManager.allowRTL(true);
      needsRestart = true;
    } else if (!isArabic && I18nManager.isRTL) {
      I18nManager.forceRTL(false);
      I18nManager.allowRTL(false);
      needsRestart = true;
    }

    if (needsRestart) {
      await SecureStore.setItemAsync('isLayoutRestart', 'true');
      setTimeout(async () => {
        try {
          if (__DEV__) {
            const { NativeModules } = require('react-native');
            NativeModules.DevSettings.reload();
          } else {
            await Updates.reloadAsync();
          }
        } catch (error) {
          router.replace('/onboarding');
        }
      }, 300);
    } else {
      router.replace('/onboarding');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <Text style={styles.title}>Choose Language</Text>
        <Text style={styles.titleAr}>اختر اللغة</Text>
        <Text style={styles.subtitle}>Please select your preferred language to continue</Text>
        <Text style={styles.subtitleAr}>يرجى تحديد لغتك المفضلة للمتابعة</Text>
      </View>

      <View style={styles.optionsContainer}>
        <TouchableOpacity style={styles.optionBtn} onPress={() => handleLanguageSelect('en')} activeOpacity={0.8}>
          <Text style={styles.optionEmoji}>🇺🇸</Text>
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionTitle}>English</Text>
            <Text style={styles.optionSubtitle}>US English</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionBtn} onPress={() => handleLanguageSelect('ar')} activeOpacity={0.8}>
          <Text style={styles.optionEmoji}>🇦🇪</Text>
          <View style={styles.optionTextContainerAr}>
            <Text style={styles.optionTitle}>العربية</Text>
            <Text style={styles.optionSubtitle}>Arabic</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    textAlign: 'center',
  },
  titleAr: {
    fontSize: 28,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    textAlign: 'center',
  },
  subtitleAr: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  optionsContainer: {
    gap: 16,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  optionEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTextContainerAr: {
    flex: 1,
    alignItems: 'flex-start',
  },
  optionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
});

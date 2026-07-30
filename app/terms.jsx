import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdaptiveGlass from './components/AdaptiveGlass';
import { useTranslation } from 'react-i18next';

export default function TermsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const sections = [
    { titleKey: 'termsSec1Title', contentKey: 'termsSec1Content' },
    { titleKey: 'termsSec2Title', contentKey: 'termsSec2Content' },
    { titleKey: 'termsSec3Title', contentKey: 'termsSec3Content' },
    { titleKey: 'termsSec4Title', contentKey: 'termsSec4Content' },
    { titleKey: 'termsSec5Title', contentKey: 'termsSec5Content' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('termsAndConditions')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <AdaptiveGlass intensity={20} tint="light" style={styles.heroCard}>
          <View style={styles.heroIconBox}>
            <Ionicons name="document-text" size={32} color="#3B82F6" />
          </View>
          <Text style={styles.heroTitle}>{t('legalAgreement')}</Text>
          <Text style={styles.heroSubtitle}>{t('lastUpdated')} {t('october2026')}</Text>
        </AdaptiveGlass>

        <View style={styles.contentSection}>
          <Text style={styles.introText}>{t('termsIntro')}</Text>

          {sections.map((section, index) => (
            <View key={index} style={styles.termBlock}>
              <Text style={styles.termTitle}>{t(section.titleKey)}</Text>
              <Text style={styles.termContent}>{t(section.contentKey)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('termsFooter')}
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginBottom: 32,
  },
  heroIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#94A3B8',
  },
  contentSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  introText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    lineHeight: 24,
    marginBottom: 32,
  },
  termBlock: {
    marginBottom: 24,
  },
  termTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  termContent: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#475569',
    lineHeight: 22,
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
    textAlign: 'center',
  },
});

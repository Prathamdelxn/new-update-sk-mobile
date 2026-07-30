import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Switch, Dimensions, StatusBar, Modal } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import HeaderNotification from '../../components/HeaderNotification';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { I18nManager } from 'react-native';
import * as Updates from 'expo-updates';
import * as SecureStore from 'expo-secure-store';

const { width, height } = Dimensions.get('window');

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

const SettingItem = ({ icon, title, subtitle, type = 'chevron', value, onPress, color = '#64748B' }) => (
  <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.itemLeft}>
      <View style={[styles.iconContainer, { backgroundColor: '#EFF6FF' }]}>
        <Ionicons name={icon} size={20} color="#2563EB" />
      </View>
      <View>
        <Text style={styles.itemTitle}>{title}</Text>
        {subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
      </View>
    </View>
    {type === 'chevron' && <Ionicons name="chevron-forward" size={18} color="#94A3B8" />}
    {type === 'switch' && <Switch value={value} onValueChange={onPress} trackColor={{ true: '#2563EB', false: '#E2E8F0' }} thumbColor={value ? '#FFFFFF' : '#F8FAFC'} />}
  </TouchableOpacity>
);

export default function SettingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState(true);
  const [isUserMenuVisible, setIsUserMenuVisible] = useState(false);
  const [isAppInfoVisible, setIsAppInfoVisible] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();

  const changeLanguage = async (lng) => {
    await i18n.changeLanguage(lng);
    await SecureStore.setItemAsync('settings.lang', lng);
    setIsLanguageModalVisible(false);
    
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
      setTimeout(async () => {
        try {
          if (__DEV__) {
            const { NativeModules } = require('react-native');
            NativeModules.DevSettings.reload();
          } else {
            await Updates.reloadAsync();
          }
        } catch (error) {
          console.warn("Failed to reload app:", error);
          showToast("Language changed. Please restart the app for layout changes to take effect.", "info");
        }
      }, 500);
    }
  };

  const hasPermission = (moduleId, action) => {
    if (!user || !user.role) return false;
    const perms = user.role.permissions || [];
    if (perms.includes('*')) return true;
    return perms.includes(`${moduleId}:${action}`) || perms.includes(moduleId);
  };

  const handleLogout = () => {
    setIsLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    setIsLogoutModalVisible(false);
    await logout();
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <SimpleBackground />
      <SafeAreaView style={styles.container} edges={['bottom']}>

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={{ flex: 1 }}>
           
            <Text style={styles.title}>{t('my')}<Text style={styles.titleHighlight}> {t('settings')}</Text></Text>
          </View>
          <View style={styles.bellScale}>
            <HeaderNotification />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          <AdaptiveGlass intensity={20} tint="light" style={styles.profileGlass}>
            <View style={styles.profileMain}>
              <View style={styles.avatarBox}>
                <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
              </View>
              <View style={styles.profileInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.profileName} numberOfLines={1}>{user?.name || 'User'}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeLabel}>{user?.role?.name || 'MEMBER'}</Text>
                  </View>
                </View>
                <Text style={styles.profileEmail} numberOfLines={1}>{user?.email || 'No email provided'}</Text>
              </View>
            </View>
          </AdaptiveGlass>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('preferences')}</Text>
            <View style={styles.flatGroup}>
              <SettingItem icon="notifications" title={t('pushNotifications')} type="switch" value={notifications} onPress={() => setNotifications(!notifications)} />

              <SettingItem 
                icon="language" 
                title={t('language')} 
                subtitle={i18n.language === 'ar' ? t('arabic') : t('englishUS')} 
                onPress={() => setIsLanguageModalVisible(true)}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('workspace')}</Text>
            <View style={styles.flatGroup}>

              <SettingItem
                icon="diamond"
                title={t('planAndBilling')}
                subtitle={t('subscriptionAndUsage')}
                onPress={() => router.push('/(tabs)/payment')}
              />
              <SettingItem
                icon="person-add"
                title={t('userManagement')}
                subtitle={t('rolesAndPermissions')}
                onPress={() => {
                  if (!hasPermission('users', 'view')) {
                    showToast("You don't have permission to access User Management.", "error");
                  } else {
                    setIsUserMenuVisible(true);
                  }
                }}
              />
              <SettingItem 
                icon="briefcase" 
                title={t('vendorManagement')} 
                subtitle={t('supplierDirectory')} 
                onPress={() => router.push('/vendor-management')}
              />

            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('support')}</Text>
            <View style={styles.flatGroup}>
              <SettingItem 
                icon="help-buoy" 
                title={t('termsAndConditions')} 
                onPress={() => router.push('/terms')} 
              />
              <SettingItem 
                icon="information-circle" 
                title={t('appInfo')} 
                subtitle="v2.1.0 Arctic" 
                type="none" 
                onPress={() => setIsAppInfoVisible(true)}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
            <Ionicons name="log-out" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </TouchableOpacity>


          {/* Language Selection Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={isLanguageModalVisible}
            statusBarTranslucent={true}
            onRequestClose={() => setIsLanguageModalVisible(false)}
          >
            <View style={styles.sheetOverlay}>
              <TouchableOpacity
                style={styles.modalDismiss}
                activeOpacity={1}
                onPress={() => setIsLanguageModalVisible(false)}
              />

              <AdaptiveGlass intensity={90} tint="light" style={styles.sheetContent}>
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetHandle} />
                  <View style={styles.sheetTitleRow}>
                    <Text style={styles.sheetTitle}>{t('selectLanguage')}</Text>
                    <TouchableOpacity onPress={() => setIsLanguageModalVisible(false)}>
                      <Ionicons name="close-circle" size={28} color="#CBD5E1" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.menuOptions}>
                  <TouchableOpacity
                    style={[styles.menuItem, i18n.language === 'en' && { borderColor: '#2563EB', backgroundColor: '#EFF6FF' }]}
                    activeOpacity={0.7}
                    onPress={() => changeLanguage('en')}
                  >
                    <View style={styles.menuText}>
                      <Text style={styles.menuTitle}>{t('english')}</Text>
                      <Text style={styles.menuSubtitle}>{t('englishUS')}</Text>
                    </View>
                    {i18n.language === 'en' && <Ionicons name="checkmark-circle" size={24} color="#2563EB" />}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuItem, i18n.language === 'ar' && { borderColor: '#2563EB', backgroundColor: '#EFF6FF' }]}
                    activeOpacity={0.7}
                    onPress={() => changeLanguage('ar')}
                  >
                    <View style={styles.menuText}>
                      <Text style={styles.menuTitle}>{t('arabic')}</Text>
                      <Text style={styles.menuSubtitle}>{t('arabicName')}</Text>
                    </View>
                    {i18n.language === 'ar' && <Ionicons name="checkmark-circle" size={24} color="#2563EB" />}
                  </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
              </AdaptiveGlass>
            </View>
          </Modal>

          {/* User Management Options Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={isUserMenuVisible}
            statusBarTranslucent={true}
            onRequestClose={() => setIsUserMenuVisible(false)}
          >
            <View style={styles.sheetOverlay}>
              <TouchableOpacity
                style={styles.modalDismiss}
                activeOpacity={1}
                onPress={() => setIsUserMenuVisible(false)}
              />

              <AdaptiveGlass intensity={90} tint="light" style={styles.sheetContent}>
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetHandle} />
                  <View style={styles.sheetTitleRow}>
                    <Text style={styles.sheetTitle}>{t('userManagement')}</Text>
                    <TouchableOpacity onPress={() => setIsUserMenuVisible(false)}>
                      <Ionicons name="close-circle" size={28} color="#CBD5E1" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.menuOptions}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      setIsUserMenuVisible(false);
                      router.push('/user-management');
                    }}
                  >
                    <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="shield-half-outline" size={24} color="#2563EB" />
                    </View>
                    <View style={styles.menuText}>
                      <Text style={styles.menuTitle}>{t('rolesManagement')}</Text>
                      <Text style={styles.menuSubtitle}>{t('rolesDesc')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      setIsUserMenuVisible(false);
                      router.push('/user-management/members');
                    }}
                  >
                    <View style={[styles.menuIconBox, { backgroundColor: '#F0FDF4' }]}>
                      <Ionicons name="people-outline" size={24} color="#10B981" />
                    </View>
                    <View style={styles.menuText}>
                      <Text style={styles.menuTitle}>{t('memberManagement')}</Text>
                      <Text style={styles.menuSubtitle}>{t('memberDesc')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                  </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
              </AdaptiveGlass>
            </View>
          </Modal>

          {/* App Info Modal */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={isAppInfoVisible}
            statusBarTranslucent={true}
            onRequestClose={() => setIsAppInfoVisible(false)}
          >
            <View style={styles.modalOverlayCenter}>
              <AdaptiveGlass intensity={95} tint="light" style={styles.appInfoCard}>
                <View style={styles.appInfoIcon}>
                  <Ionicons name="information-circle" size={48} color="#3B82F6" />
                </View>
                <Text style={styles.appInfoTitle}>Sky Lite</Text>
                <Text style={styles.appInfoVersion}>Version 2.1.0 (Arctic)</Text>
                
                <Text style={styles.appInfoDesc}>
                  {t('skyLiteDesc')}
                </Text>

                <TouchableOpacity 
                  style={styles.appInfoCloseBtn} 
                  onPress={() => setIsAppInfoVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.appInfoCloseText}>{t('close')}</Text>
                </TouchableOpacity>
              </AdaptiveGlass>
            </View>
          </Modal>

          {/* Logout Confirmation Modal */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={isLogoutModalVisible}
            statusBarTranslucent={true}
            onRequestClose={() => setIsLogoutModalVisible(false)}
          >
            <View style={styles.modalOverlayCenter}>
              <AdaptiveGlass intensity={95} tint="light" style={styles.appInfoCard}>
                <View style={[styles.appInfoIcon, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}>
                  <Ionicons name="log-out-outline" size={48} color="#EF4444" />
                </View>
                <Text style={styles.appInfoTitle}>{t('confirmLogout')}</Text>
                
                <Text style={[styles.appInfoDesc, { marginBottom: 32 }]}>
                  {t('logoutDesc')}
                </Text>

                <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                  <TouchableOpacity 
                    style={[styles.appInfoCloseBtn, { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]} 
                    onPress={() => setIsLogoutModalVisible(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.appInfoCloseText, { color: '#64748B' }]}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.appInfoCloseBtn, { flex: 1, backgroundColor: '#EF4444' }]} 
                    onPress={confirmLogout}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.appInfoCloseText, { color: '#FFF' }]}>{t('logout')}</Text>
                  </TouchableOpacity>
                </View>
              </AdaptiveGlass>
            </View>
          </Modal>


          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#DBEAFE',
  },
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFF',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#DBEAFE',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  greetingText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
    marginBottom: 2,
  },
  waveEmoji: { fontSize: 12 },
  titleHighlight: { color: '#0F172A' },
  bellScale: { transform: [{ scale: 0.78 }] },
  preTitle: {
    fontSize: 13,
    color: '#3B82F6',
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  profileGlass: {
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#FFFFFF',
    marginBottom: 44,
  },
  profileMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Inter-Black',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  profileEmail: {
    fontSize: 13,
    color: '#94A3B8',
    fontFamily: 'Inter-Regular',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    flexShrink: 0,
  },
  badgeLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  section: {
    marginBottom: 40,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
  },
  flatGroup: {
    borderRadius: 24,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#FFFFFF',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  logoutBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  sheetContent: {
    width: '100%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    borderBottomWidth: 0,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 20,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  sheetTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
  },
  menuOptions: {
    gap: 16,
    marginTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  menuIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  menuText: {
    flex: 1,
    paddingHorizontal: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#94A3B8',
  },
  modalOverlayCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 24,
  },
  appInfoCard: {
    width: '100%',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  appInfoIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  appInfoTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  appInfoVersion: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#3B82F6',
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  appInfoDesc: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  appInfoCloseBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appInfoCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
});

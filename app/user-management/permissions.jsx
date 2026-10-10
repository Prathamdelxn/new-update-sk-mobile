import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert } from 'react-native';
import AdaptiveGlass from '../components/AdaptiveGlass';
import ModulePermissionCard from '../components/ModulePermissionCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { hasProjectPermission } from '../utils/permissions';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const { width } = Dimensions.get('window');

const MODULES = [
  { id: 'projects', title: 'Project Management', excludeActions: ['approve', 'complete'] },
  { id: 'inventory', title: 'Material Management', excludeActions: ['complete', 'assign'] },
  { id: 'users', title: 'User Management', excludeActions: ['approve', 'complete', 'assign'] },

  { id: 'plans', title: 'Plan Management' },
  { id: 'annotations', title: 'Plan Annotations' },
  { id: 'sitesurvey', title: 'Site Survey Management' },
  { id: 'budget', title: 'Budget Management' },
  { id: 'land', title: 'Land Documents Mgmt', excludeActions: ['complete', 'assign'] },
  { id: 'boq', title: 'BOQ Management', excludeActions: ['complete'] },
  { id: 'tasks', title: 'Task Management', excludeActions: ['approve'] },
  { id: 'workprogress', title: 'Work Progress' },
  { id: 'reports', title: 'Reports Management', excludeActions: ['create', 'update', 'delete', 'approve', 'complete', 'assign'] },
  { id: 'risks', title: 'Risk Management', excludeActions: ['approve', 'complete', 'assign'] },
  { id: 'handover', title: 'Handover Management', excludeActions: ['update', 'delete', 'complete'] },
  { id: 'snags', title: 'Snag Management', excludeActions: ['approve'] },
  { id: 'transactions', title: 'Transaction Management', excludeActions: ['approve', 'complete', 'assign'] },
  { id: 'category', title: 'Category Management', excludeActions: ['approve', 'complete', 'assign'] },
  { id: 'template', title: 'Template Management', excludeActions: ['approve', 'complete', 'assign'] },
];

const DEFAULT_ACTIONS = { view: false, create: false, update: false, delete: false, approve: false, complete: false, assign: false };
const FULL_ACCESS = { view: true, create: true, update: true, delete: true, approve: true, complete: true, assign: true };
const READ_ONLY = { view: true, create: false, update: false, delete: false, approve: false, complete: false, assign: false };

// Org-wide modules that work without opening a project. Every other module is
// project-scoped: its permissions only apply inside a project the user can
// see, so they're useless without Project Management > View. (Mirrors web RoleModal.)
const ORG_LEVEL_MODULES = ['projects', 'users', 'category', 'template'];

const hasProjectScopedPerms = (perms) =>
  MODULES.some(m =>
    !ORG_LEVEL_MODULES.includes(m.id) &&
    Object.entries(perms[m.id] || {}).some(([action, on]) => on && !(m.excludeActions || []).includes(action))
  );

const PROJECT_VIEW_FIRST_MSG =
  "Enable Project Management → View first. Without it the user can't open any project, so this permission won't work.";

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function RolePermissionsEdit() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { roleId, roleName } = useLocalSearchParams();
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const defaultPermissions = Object.fromEntries(MODULES.map(m => [m.id, { ...DEFAULT_ACTIONS }]));
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Check if we should block editing
  const isAdminRole = roleName?.toLowerCase().includes('admin');
  // Changing a role's permissions needs User Management > Update (the API enforces it too)
  const canEditRoles = hasProjectPermission(user, null, 'users:update');
  const isReadOnly = isAdminRole || !canEditRoles;

  useEffect(() => {
    fetchRolePermissions();
  }, [roleId]);

  const fetchRolePermissions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/roles/${roleId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setPermissions(fromBackendFormat(data.permissions || []));
      } else {
        showToast('Failed to load permissions', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast(t('networkError'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Convert ['project:view', 'project:create'] -> { project: { view: true, create: true } }
   */
  const fromBackendFormat = (flatArray) => {
    const nested = {};
    MODULES.forEach(mod => {
      nested[mod.id] = { ...DEFAULT_ACTIONS };
    });

    // ["*"] means full access on all modules
    if (flatArray.includes('*')) {
      MODULES.forEach(mod => { nested[mod.id] = { ...FULL_ACCESS }; });
      return nested;
    }

    flatArray.forEach(p => {
      let [module, action] = p.split(':');
      // Default roles seeded at registration use the older `project:*` and
      // `team:assign` keys — show them under Project Management so saving the
      // role keeps them (as `projects:*`) instead of silently dropping them.
      if (module === 'project') module = 'projects';
      if (module === 'team' && action === 'assign') module = 'projects';
      if (module && action && nested[module]) {
        nested[module][action] = true;
      }
    });
    return nested;
  };

  /**
   * Convert { project: { view: true } } -> ['project:view']
   */
  const toBackendFormat = (nestedObject) => {
    const flat = [];
    Object.keys(nestedObject).forEach(moduleId => {
      const excluded = MODULES.find(m => m.id === moduleId)?.excludeActions || [];
      Object.keys(nestedObject[moduleId]).forEach(actionId => {
        if (nestedObject[moduleId][actionId] && !excluded.includes(actionId)) {
          flat.push(`${moduleId}:${actionId}`);
        }
      });
    });
    return flat;
  };

  const handleSave = async () => {
    if (isAdminRole) {
      showToast('System Admin permissions cannot be modified.', 'error');
      return;
    }
    if (!canEditRoles) {
      showToast("You don't have permission to update roles.", 'error');
      return;
    }
    if (missingProjectView) {
      showToast(PROJECT_VIEW_FIRST_MSG, 'error');
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`${API_BASE_URL}/roles/${roleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          permissions: toBackendFormat(permissions)
        }),
      });

      if (response.ok) {
        showToast('Permissions saved successfully', 'success');
        router.back();
      } else {
        const data = await response.json();
        showToast(data.message || 'Failed to save changes', 'error');
      }
    } catch (e) {
      showToast(t('networkErrorTryAgain'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Role grants project-scoped permissions but can't see any project
  const missingProjectView = !isAdminRole && !permissions.projects?.view && hasProjectScopedPerms(permissions);
  const enableProjectView = () =>
    setPermissions(prev => ({ ...prev, projects: { ...(prev.projects || DEFAULT_ACTIONS), view: true } }));

  const toggleAction = (moduleId, actionId) => {
    // Project-scoped permissions need Project Management > View first
    const enabling = !permissions[moduleId]?.[actionId];
    if (enabling && !ORG_LEVEL_MODULES.includes(moduleId) && !permissions.projects?.view) {
      showToast(PROJECT_VIEW_FIRST_MSG, 'error');
      return;
    }
    setPermissions(prev => {
      const current = prev[moduleId] || { ...DEFAULT_ACTIONS };
      const newValue = !current[actionId];
      const newModulePerms = { ...current, [actionId]: newValue };

      // If enabling any action, 'view' must be enabled
      if (newValue && actionId !== 'view') {
        newModulePerms.view = true;
      }

      // If disabling 'view', all other actions must be disabled
      if (!newValue && actionId === 'view') {
        Object.keys(newModulePerms).forEach(key => {
          newModulePerms[key] = false;
        });
      }

      return {
        ...prev,
        [moduleId]: newModulePerms,
      };
    });
  };

  const applyPreset = (presetType) => {
    const preset = presetType === 'full' ? FULL_ACCESS : READ_ONLY;
    const updated = {};
    MODULES.forEach(mod => { updated[mod.id] = { ...preset }; });
    setPermissions(updated);
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="dark-content" />
      <SimpleBackground />

      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerPreTitle}>{t('rolePermissions', 'ROLE PERMISSIONS')}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {roleName || t('role')}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.contentScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        >




          <View style={styles.modulesHeader}>
            <Text style={styles.modulesTitle}>{t('moduleControl')}</Text>
            <Text style={styles.modulesSubtitle}>{t('setViewEditApproval')}</Text>
          </View>

          {isLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={{ marginTop: 12, color: '#94A3B8', fontFamily: 'Inter-SemiBold' }}>{t('synchronizing')}</Text>
            </View>
          ) : (
            <>
              {isAdminRole && (
                <View style={styles.protectedNotice}>
                  <Ionicons name="shield-checkmark" size={20} color="#1D4ED8" />
                  <Text style={styles.protectedNoticeText}>{t('protectedRoleLocked')}</Text>
                </View>
              )}
              {!isAdminRole && !canEditRoles && (
                <View style={styles.protectedNotice}>
                  <Ionicons name="eye-outline" size={20} color="#1D4ED8" />
                  <Text style={styles.protectedNoticeText}>View only — you need User Management → Update to change role permissions.</Text>
                </View>
              )}
              {missingProjectView && (
                <View style={styles.projectViewNotice}>
                  <Ionicons name="warning-outline" size={20} color="#B45309" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.projectViewNoticeText}>
                      This role has project permissions but not Project Management → View. Members with it won't be able to open any project, so those permissions won't work.
                    </Text>
                    <TouchableOpacity style={styles.projectViewNoticeBtn} onPress={enableProjectView}>
                      <Text style={styles.projectViewNoticeBtnText}>Enable Project View</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {MODULES.map((module) => (
                <ModulePermissionCard
                  key={module.id}
                  title={module.title}
                  permissions={permissions[module.id] || DEFAULT_ACTIONS}
                  onToggle={(actionId) => !isReadOnly && toggleAction(module.id, actionId)}
                  excludeActions={module.excludeActions}
                />
              ))}
            </>
          )}
        </ScrollView>

        {/* Footer Save Button */}
        <View style={[styles.footer, { bottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={[styles.saveBtn, (isReadOnly || isLoading) && { opacity: 0.5 }]}
            activeOpacity={0.9}
            onPress={handleSave}
            disabled={isReadOnly || isLoading || isSaving}
          >
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.saveBtnGradient}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{isAdminRole ? t('roleLocked') : t('saveChanges')}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F0F9FF' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, marginBottom: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0F2FE' },
  headerTitleContainer: { flex: 1, marginLeft: 16 },
  headerPreTitle: { fontSize: 11, color: '#3B82F6', fontFamily: 'Inter-Black', textTransform: 'uppercase', letterSpacing: 1.5 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', letterSpacing: -0.5 },
  contentScroll: { flex: 1, paddingHorizontal: 24 },
  targetRoleCard: { padding: 22, borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0F2FE', marginBottom: 28, marginTop: 12 },
  targetRoleInfo: { flexDirection: 'row', alignItems: 'center' },
  targetLabel: { fontSize: 11, color: '#94A3B8', fontFamily: 'Inter-Black', textTransform: 'uppercase', letterSpacing: 1 },
  targetTitle: { fontSize: 22, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 4 },
  presetsSection: { marginBottom: 32 },
  presetsLabel: { fontSize: 11, color: '#3B82F6', fontFamily: 'Inter-Black', letterSpacing: 1.2, marginBottom: 12, marginLeft: 4 },
  presetGrid: { flexDirection: 'row', gap: 12 },
  presetBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 18, borderWidth: 1 },
  presetText: { fontSize: 14, fontFamily: 'Inter-Bold' },
  modulesHeader: { marginBottom: 20, marginLeft: 4 },
  modulesTitle: { fontSize: 14, fontFamily: 'Inter-Black', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 1.2 },
  modulesSubtitle: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#94A3B8', marginTop: 2 },
  footer: { position: 'absolute', left: 24, right: 24 },
  saveBtn: { borderRadius: 20, overflow: 'hidden', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 8 },
  saveBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 64 },
  saveBtnText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  protectedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    gap: 12
  },
  protectedNoticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    lineHeight: 18
  },
  projectViewNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 12
  },
  projectViewNoticeText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    lineHeight: 18
  },
  projectViewNoticeBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#D97706',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10
  },
  projectViewNoticeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Bold'
  },
});

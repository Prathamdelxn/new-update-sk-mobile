import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Dimensions, Modal, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, Alert, ToastAndroid } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdaptiveGlass from '../components/AdaptiveGlass';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

// IP should ideally be in a central config, but using user's latest update here
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// INITIAL_ROLES removed - now fetching from DB

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function UserManagementDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();

  const hasPermission = (moduleId, action) => {
    if (!user || !user.role) return false;
    const perms = user.role.permissions || [];
    if (perms.includes('*')) return true;
    return perms.includes(`${moduleId}:${action}`) || perms.includes(moduleId);
  };

  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const [isAddRoleVisible, setIsAddRoleVisible] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  const { showToast } = useToast();

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/roles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        // Map backend 'name' to frontend 'title' for existing UI compatibility
        const mappedRoles = data.map(r => ({
          id: r._id,
          title: r.name,
          count: r.userCount || 0,
          access: r.permissions?.length > 0 ? "Tier 1" : "Empty"
        }));
        setRoles(mappedRoles);
      }
    } catch (e) {
      console.error('Fetch roles error', e);
    } finally {
      setIsLoading(false);
    }
  };

  const addNewRole = async () => {
    if (!newRoleName.trim()) return;

    try {
      setIsCreating(true);
      const url = isEditingRole ? `${API_BASE_URL}/roles/${editingRoleId}` : `${API_BASE_URL}/roles`;
      const method = isEditingRole ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newRoleName,
          description: newRoleDescription || `Role for ${newRoleName}`,
          permissions: isEditingRole ? undefined : [] // Don't wipe permissions on name edit
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (isEditingRole) {
          setRoles(prev => prev.map(r => r.id === editingRoleId ? { ...r, title: data.name } : r));
          showToast('Role identity updated', 'success');
        } else {
          const newRoleObj = { id: data._id, title: data.name, count: 0, access: 'Empty' };
          setRoles(prev => [newRoleObj, ...prev]);
          showToast('Role created successfully', 'success');
        }
        closeRoleModal();
      } else {
        showToast(data.message || 'Operation failed', 'error');
      }
    } catch (e) {
      showToast(t('networkErrorTryAgain'), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const closeRoleModal = () => {
    setIsAddRoleVisible(false);
    setIsEditingRole(false);
    setEditingRoleId(null);
    setNewRoleName('');
    setNewRoleDescription('');
  };

  const handleEditRole = (role) => {
    if (!hasPermission('users', 'update')) {
      showToast("You don't have permission to update roles.", "error");
      return;
    }
    setIsEditingRole(true);
    setEditingRoleId(role.id);
    setNewRoleName(role.title);
    setNewRoleDescription(role.description || '');
    setIsAddRoleVisible(true);
  };

  const handleDeleteRole = (role) => {
    if (!hasPermission('users', 'delete')) {
      showToast("You don't have permission to delete roles.", "error");
      return;
    }
    Alert.alert(
      'Cascade Delete Role',
      `WARNING: Deleting "${role.title}" will also PERMANENTLY DELETE all ${role.count} members assigned to it. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/roles/${role.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (response.ok) {
                setRoles(prev => prev.filter(r => r.id !== role.id));
                showToast('Role and associated members removed.', 'delete');
              } else {
                const data = await response.json();
                showToast(data.message || 'Deletion failed', 'error');
              }
            } catch (e) {
              showToast('Network request failed', 'error');
            }
          }
        }
      ]
    );
  };

  const processedRoles = useMemo(() => {
    let filtered = roles.filter(role =>
      role.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (sortBy === 'name') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      filtered.sort((a, b) => b.count - a.count);
    }

    return filtered;
  }, [roles, searchQuery, sortBy]);

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
            <Text style={styles.headerPreTitle}>{t('roleHeader')}</Text>
            <Text style={styles.headerTitle}>{t('accessControl')}</Text>
          </View>

          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => setSortBy(prev => prev === 'name' ? 'members' : 'name')}
            activeOpacity={0.7}
          >
            <Ionicons name={sortBy === 'name' ? "filter-outline" : "list-outline"} size={22} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {/* Global Search */}
        <View style={styles.topFilterSection}>
          <AdaptiveGlass intensity={10} tint="light" style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('searchAllRoles')}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </AdaptiveGlass>
        </View>

        <ScrollView
          style={styles.contentScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{t('allSystemRoles')}</Text>
            <Text style={styles.listCount}>{t('rolesCount', { count: processedRoles.length })}</Text>
          </View>

          {isLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={{ marginTop: 12, color: '#94A3B8', fontFamily: 'Inter-SemiBold' }}>{t('fetchingRoles')}</Text>
            </View>
          ) : (
            processedRoles.map((role) => (
              <TouchableOpacity
                key={role.id}
                activeOpacity={0.7}
                onPress={() => router.push({
                  pathname: '/user-management/permissions',
                  params: { roleId: role.id, roleName: role.title }
                })}
              >
                <AdaptiveGlass intensity={15} tint="light" style={styles.roleCard}>
                  <View style={styles.roleInfo}>
                    <View style={styles.textContainer}>
                      <View style={styles.roleTitleRow}>
                        <Text style={styles.roleTitle}>{role.title}</Text>
                      </View>
                      {/* <Text style={styles.roleSubtitle}>{t('activeMembersCount', { count: role.count || 0 })}</Text> */}
                    </View>
                  </View>

                  <View style={styles.roleActions}>
                    <TouchableOpacity
                      style={styles.roleActionBtn}
                      onPress={() => handleEditRole(role)}
                    >
                      <Ionicons name="create-outline" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roleActionBtn, styles.roleDeleteBtn]}
                      onPress={() => handleDeleteRole(role)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={16} color="#3B82F6" style={{ marginLeft: 4 }} />
                  </View>
                </AdaptiveGlass>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* FAB for Add Role */}
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 24 }]}
          onPress={() => { 
            if (!hasPermission('users', 'create')) {
              showToast("You don't have permission to create new roles.", "error");
              return;
            }
            setIsEditingRole(false); setIsAddRoleVisible(true); 
          }}
          activeOpacity={0.9}
        >
          <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.fabGradient}>
            <Ionicons name="add" size={30} color="#FFFFFF" />
            <Text style={styles.fabText}>{t('newRole')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Add Role Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isAddRoleVisible}
          onRequestClose={closeRoleModal}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={closeRoleModal} />
            <AdaptiveGlass intensity={60} tint="light" style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditingRole ? t('updateRoleIdentity') : t('initializeRole')}
                </Text>
                <TouchableOpacity onPress={closeRoleModal}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>{t('roleIdentityName')}</Text>
              <AdaptiveGlass intensity={10} tint="light" style={styles.inputBox}>
                <TextInput style={styles.textInput} placeholder={t('egAuditLead')} placeholderTextColor="#94A3B8" autoFocus value={newRoleName} onChangeText={setNewRoleName} />
              </AdaptiveGlass>

              <Text style={styles.inputLabel}>{t('roleDescriptionOptional')}</Text>
              <AdaptiveGlass intensity={10} tint="light" style={styles.inputBox}>
                <TextInput style={styles.textInput} placeholder={t('describeResponsibilities')} placeholderTextColor="#94A3B8" value={newRoleDescription} onChangeText={setNewRoleDescription} />
              </AdaptiveGlass>

              <TouchableOpacity
                style={styles.createBtn}
                onPress={addNewRole}
                activeOpacity={0.8}
                disabled={isCreating}
              >
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.createBtnGradient}>
                  {isCreating ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.createBtnText}>
                      {isEditingRole ? t('saveChanges') : t('createRole')}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </AdaptiveGlass>
          </KeyboardAvoidingView>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, marginBottom: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0F2FE' },
  headerActionBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(59, 130, 246, 0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.1)' },
  headerTitleContainer: { flex: 1, marginLeft: 16 },
  headerPreTitle: { fontSize: 11, color: '#3B82F6', fontFamily: 'Inter-Black', textTransform: 'uppercase', letterSpacing: 1.5 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', letterSpacing: -0.5 },
  topFilterSection: { paddingHorizontal: 24, marginBottom: 16 },
  searchBar: { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0F2FE', marginBottom: 0 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  contentScroll: { flex: 1, paddingHorizontal: 24 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4, marginTop: 12 },
  listTitle: { fontSize: 13, color: '#94A3B8', fontFamily: 'Inter-Black', textTransform: 'uppercase', letterSpacing: 1.5 },
  listCount: { fontSize: 12, color: '#94A3B8', fontFamily: 'Inter-SemiBold' },
  roleCard: { padding: 18, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0F2FE', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  roleInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  textContainer: { flex: 1 },
  roleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },
  accessBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(59, 130, 246, 0.05)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.1)' },
  accessText: { fontSize: 9, fontFamily: 'Inter-Black', color: '#3B82F6', textTransform: 'uppercase' },
  roleSubtitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#94A3B8', marginTop: 4 },
  fab: { position: 'absolute', right: 24, borderRadius: 20, overflow: 'hidden', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 12 },
  fabGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 10 },
  fabText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-Bold' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalDismiss: { ...StyleSheet.absoluteFillObject },
  modalContent: { width: '100%', borderRadius: 32, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0F2FE' },
  roleActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roleActionBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F8FAFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  roleDeleteBtn: { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A' },
  inputLabel: { fontSize: 11, fontFamily: 'Inter-Black', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  inputBox: { height: 56, borderRadius: 16, paddingHorizontal: 16, justifyContent: 'center', marginBottom: 24 },
  textInput: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  createBtn: { borderRadius: 18, overflow: 'hidden' },
  createBtnGradient: { height: 56, alignItems: 'center', justifyContent: 'center' },
  createBtnText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Dimensions, Modal, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, Alert, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdaptiveGlass from '../components/AdaptiveGlass';
import MemberCard from '../components/MemberCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import ConfirmModal from '../components/ConfirmModal';
import PhoneInput from '../components/PhoneInput';

const { width, height } = Dimensions.get('window');

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Hardcoded roles removed - now fetching from DB

// PROJECTS removed - now fetching from DB


// INITIAL_MEMBERS removed - now fetching from DB

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function MemberManagementScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const hasPermission = (moduleId, action) => {
    if (!user || !user.role) return false;
    const perms = user.role.permissions || [];
    if (perms.includes('*')) return true;
    return perms.includes(`${moduleId}:${action}`) || perms.includes(moduleId);
  };

  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [projects, setProjects] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isOnboarding, setIsOnboarding] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const [isAddMemberVisible, setIsAddMemberVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [isRolePickerVisible, setIsRolePickerVisible] = useState(false);
  const [roleSearchQuery, setRoleSearchQuery] = useState('');

  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberMobile, setNewMemberMobile] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(true);
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [isProjectPickerVisible, setIsProjectPickerVisible] = useState(false);
  const [projectRoles, setProjectRoles] = useState({});
  const [activeProjectForRole, setActiveProjectForRole] = useState(null);

  // Credential reveal modal after user creation
  const [credentialModal, setCredentialModal] = useState({ visible: false, name: '', email: '', password: '' });

  // Modern Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: null,
    type: 'default'
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);

      const [membersRes, rolesRes, projectsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/roles`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/projects`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [membersData, rolesData, projectsData] = await Promise.all([
        membersRes.json(),
        rolesRes.json(),
        projectsRes.json()
      ]);

      if (membersRes.ok) setMembers(membersData);
      if (rolesRes.ok) {
        const mappedRoles = rolesData
          // .filter(r => r.name !== 'Admin' && r.name !== 'admin')
          .map(r => ({ id: r._id, title: r.name }));
        setRoles(mappedRoles);
      }
      if (projectsRes.ok) setProjects(projectsData);

    } catch (e) {
      console.error('Failed to fetch registry data', e);
      showToast('Failed to synchronize with server', 'error');
    } finally {
      setIsLoading(false);
      setIsLoadingSettings(false);
    }
  };

  const toggleProject = (project) => {
    setSelectedProjects(prev => {
      const isSelected = prev.some(p => p._id === project._id);
      if (isSelected) {
        setProjectRoles(roles => { const { [project._id]: _, ...rest } = roles; return rest; });
        return prev.filter(p => p._id !== project._id);
      } else {
        return [...prev, project];
      }
    });
  };

  const projectDisplayText = useMemo(() => {
    if (isLoading) return 'Loading projects...';
    if (selectedProjects.length === 0) return 'Select Projects';
    if (selectedProjects.length === 1) return selectedProjects[0].name;
    return `${selectedProjects.length} Projects Selected`;
  }, [selectedProjects, isLoading]);

  const filteredMembers = useMemo(() => {
    return members.filter(m =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [members, searchQuery]);

  const filteredRoles = useMemo(() => {
    return roles.filter(r =>
      r.title.toLowerCase().includes(roleSearchQuery.toLowerCase())
    );
  }, [roles, roleSearchQuery]);

  const addNewMember = async () => {
    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      showToast('Please enter at least a name and email.', 'error');
      return;
    }

    if (newMemberMobile && !isPhoneValid) {
      showToast('Please enter a valid phone number length.', 'error');
      return;
    }

    const finalPassword = newMemberPassword.trim() || 'welcome123';

    try {
      setIsOnboarding(true);
      const url = isEditing ? `${API_BASE_URL}/users/${editingId}` : `${API_BASE_URL}/users`;
      const method = isEditing ? 'PATCH' : 'POST';

      const body = {
        name: newMemberName,
        email: newMemberEmail,
        phoneNumber: newMemberMobile,
        roleId: selectedRole?.id,
        projects: selectedProjects.map(p => ({
          project: p._id,
          role: projectRoles[p._id] || undefined,
        })),
      };
      if (!isEditing) body.password = finalPassword;

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        if (isEditing) {
          setMembers(prev => prev.map(m => m._id === editingId ? data : m));
          showToast('Member details updated successfully', 'success');
          closeModal();
        } else {
          setMembers(prev => [data, ...prev]);
          closeModal();
          // Show credential card so Admin can hand credentials to the new user
          setCredentialModal({ visible: true, name: newMemberName, email: newMemberEmail, password: finalPassword });
        }
      } else {
        setConfirmModal({
          visible: true,
          title: 'Operation Failed',
          message: data.message || 'We could not complete this action. Please check the information and try again.',
          confirmText: 'Understood',
          type: 'default',
          onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false })),
          onCancel: null
        });
      }
    } catch (e) {
      showToast(t('networkErrorTryAgain'), 'error');
    } finally {
      setIsOnboarding(false);
    }
  };

  const closeModal = () => {
    setIsAddMemberVisible(false);
    setIsEditing(false);
    setEditingId(null);
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberMobile('');
    setIsPhoneValid(true);
    setNewMemberPassword('');
    setShowPassword(false);
    setSelectedRole(null);
    setSelectedProjects([]);
    setProjectRoles({});
    setActiveProjectForRole(null);
  };

  // An Admin-equivalent account can only be edited/removed by that account
  // itself — never by another member, even one with user-management
  // permission. Checked against name, wildcard permission, and
  // isSystemRole (not just an exact "Admin" string match) so a
  // differently-named or custom-flagged admin role is still protected.
  const canManageMember = (member) => {
    const targetRole = member.role;
    const isTargetAdmin = !!targetRole && (
      (targetRole.name || '').toLowerCase() === 'admin' ||
      targetRole.permissions?.includes('*') ||
      targetRole.isSystemRole === true
    );
    const isSelf = !!user && (user._id === member._id || user.id === member._id);
    return !isTargetAdmin || isSelf;
  };

  const handleEditMember = (member) => {
    if (!hasPermission('users', 'update')) {
      showToast("You don't have permission to update members.", "error");
      return;
    }
    if (!canManageMember(member)) {
      showToast("Only the Admin can edit their own account.", "error");
      return;
    }
    setEditingId(member._id);
    setIsEditing(true);
    setNewMemberName(member.name);
    setNewMemberEmail(member.email);
    setNewMemberMobile(member.phoneNumber || '');

    // Find role in fetched roles list
    const foundRole = roles.find(r => r.id === member.role?._id);
    if (foundRole) setSelectedRole(foundRole);

    // Set projects and roles
    // Entries with no linked project (project: null) are orphaned
    // assignments left over from elsewhere — they don't reference a real
    // project, so there's nothing to display or resubmit for them.
    const projArr = [];
    const roleMap = {};
    if (member.projects) {
      member.projects.forEach(p => {
        if (p.project) {
          projArr.push(p.project);
          if (p.role) roleMap[p.project._id] = p.role._id || p.role;
        }
      });
    }
    setSelectedProjects(projArr);
    setProjectRoles(roleMap);

    setIsAddMemberVisible(true);
  };

  const removeMember = (id, name, member) => {
    if (!hasPermission('users', 'delete')) {
      showToast("You don't have permission to remove members.", "error");
      return;
    }
    if (member && !canManageMember(member)) {
      showToast("Only the Admin can remove their own account.", "error");
      return;
    }
    setConfirmModal({
      visible: true,
      title: 'Remove Member',
      message: `Are you sure you want to remove ${name} from the team? This action cannot be undone.`,
      confirmText: 'Remove',
      type: 'destructive',
      onConfirm: async () => {
        try {
          setIsOnboarding(true); // Using isOnboarding as a general processing state
          const response = await fetch(`${API_BASE_URL}/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            setMembers(prev => prev.filter(m => m._id !== id));
            showToast('Team member has been removed.', 'delete');
          } else {
            const data = await response.json();
            showToast(data.message || 'Failed to remove member', 'error');
          }
        } catch (e) {
          showToast(t('networkError'), 'error');
        } finally {
          setIsOnboarding(false);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="dark-content" />
      <SimpleBackground />

      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerPreTitle}>{t('workforce')}</Text>
            <Text style={styles.headerTitle}>{t('memberRegistry')}</Text>
          </View>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => { 
            if (!hasPermission('users', 'create')) {
              showToast("You don't have permission to add new members.", "error");
              return;
            }
            setIsEditing(false); setIsAddMemberVisible(true); 
          }} activeOpacity={0.7}>
            <Ionicons name="person-add-outline" size={22} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchSection}>
          <AdaptiveGlass intensity={10} tint="light" style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#94A3B8" />
            <TextInput style={styles.searchInput} placeholder={t('searchByNameEmail')} placeholderTextColor="#94A3B8" value={searchQuery} onChangeText={setSearchQuery} />
          </AdaptiveGlass>
        </View>

        <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{t('teamMembersTitle')}</Text>
            <View style={styles.countBadge}><Text style={styles.countText}>{filteredMembers.length}</Text></View>
          </View>

          {isLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={{ marginTop: 12, color: '#94A3B8', fontFamily: 'Inter-SemiBold' }}>{t('fetchingTeam')}</Text>
            </View>
          ) : filteredMembers.length === 0 ? (
            <Text style={{ textAlign: 'center', marginTop: 40, color: '#94A3B8' }}>{t('noMembersFound')}</Text>
          ) : (
            filteredMembers.map((member) => (
              <MemberCard
                key={member._id}
                name={member.name}
                email={member.email}
                role={member.role?.name || 'No Role'}
                onRemove={() => removeMember(member._id, member.name, member)}
                onChangeRole={() => handleEditMember(member)}
                showActions={canManageMember(member)}
              />
            ))
          )}
        </ScrollView>

        {/* Add Member Modal */}
        <Modal animationType="slide" transparent={true} visible={isAddMemberVisible} onRequestClose={closeModal}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={closeModal} />
            <AdaptiveGlass intensity={60} tint="light" style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditing ? t('updateTeamMember') : t('onboardNewMember')}
                </Text>
                <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>{t('fullName')}</Text>
              <AdaptiveGlass intensity={10} tint="light" style={styles.inputBox}>
                <TextInput style={styles.textInput} placeholder={t('egRobertFox')} placeholderTextColor="#94A3B8" value={newMemberName} onChangeText={setNewMemberName} />
              </AdaptiveGlass>

              <Text style={styles.inputLabel}>{t('emailAddress')}</Text>
              <AdaptiveGlass intensity={10} tint="light" style={styles.inputBox}>
                <TextInput style={styles.textInput} placeholder={t('emailPlaceholder')} placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" value={newMemberEmail} onChangeText={setNewMemberEmail} />
              </AdaptiveGlass>

              <Text style={styles.inputLabel}>{t('mobileNumber')}</Text>
              <PhoneInput 
                value={newMemberMobile} 
                onChange={setNewMemberMobile} 
                onValidate={setIsPhoneValid}
                placeholder="Enter mobile number" 
                placeholderTextColor="#94A3B8" 
              />

              {!isEditing && (
                <>
                  <Text style={styles.inputLabel}>{t('password')}</Text>
                  <AdaptiveGlass intensity={10} tint="light" style={[styles.inputBox, { flexDirection: 'row', alignItems: 'center', marginBottom: 8 }]}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      placeholder={t('leaveBlankDefault')}
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      value={newMemberPassword}
                      onChangeText={setNewMemberPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={{ paddingHorizontal: 8 }}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  </AdaptiveGlass>
                  <Text style={{ fontSize: 12, color: '#64748B', fontFamily: 'Inter-Medium', paddingHorizontal: 4, marginBottom: 24 }}>
                    * Default password will be welcome123
                  </Text>
                </>
              )}

              <TouchableOpacity
                style={styles.createBtn}
                onPress={addNewMember}
                activeOpacity={0.8}
                disabled={isOnboarding}
              >
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.createBtnGradient}>
                  {isOnboarding ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.createBtnText}>
                      {isEditing ? t('saveChanges') : t('initializeMember')}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </AdaptiveGlass>
          </KeyboardAvoidingView>
        </Modal>

        {/* Searchable Role Picker Modal (Text Only) */}
        <Modal animationType="fade" transparent={true} visible={isRolePickerVisible} onRequestClose={() => setIsRolePickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setIsRolePickerVisible(false)} />
            <AdaptiveGlass intensity={95} tint="light" style={styles.rolePickerContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('selectRoleTitle')}</Text>
                <TouchableOpacity onPress={() => setIsRolePickerVisible(false)}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity>
              </View>

              <AdaptiveGlass intensity={10} tint="light" style={styles.pickerSearchBar}>
                <Ionicons name="search" size={20} color="#94A3B8" />
                <TextInput style={styles.pickerSearchInput} placeholder={t('searchAllRoles')} placeholderTextColor="#94A3B8" value={roleSearchQuery} onChangeText={setRoleSearchQuery} autoFocus />
              </AdaptiveGlass>

              <ScrollView style={styles.rolePickerList} showsVerticalScrollIndicator={false}>
                <View style={styles.pickerFullList}>
                  {isLoadingSettings ? (
                    <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
                  ) : filteredRoles.length === 0 ? (
                    <Text style={{ textAlign: 'center', marginTop: 40, color: '#94A3B8' }}>{t('noRolesFound')}</Text>
                  ) : (
                    <>
                      {!activeProjectForRole && (
                        <TouchableOpacity
                          style={[styles.roleListItem, !selectedRole && styles.activeRoleItem]}
                          onPress={() => {
                            setSelectedRole(null);
                            setIsRolePickerVisible(false);
                          }}
                        >
                          <View style={styles.listItemTextContainer}>
                            <Text style={[styles.roleListItemText, !selectedRole && styles.activeRoleItemText]}>None (Project Specific)</Text>
                          </View>
                          {!selectedRole && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
                        </TouchableOpacity>
                      )}
                      {filteredRoles.map(role => (
                      <TouchableOpacity
                        key={role.id}
                        style={[styles.roleListItem, ((activeProjectForRole && projectRoles[activeProjectForRole] === role.id) || (!activeProjectForRole && selectedRole?.id === role.id)) && styles.activeRoleItem, role.title.toLowerCase() === 'admin' && { opacity: 0.5 }]}
                        onPress={() => { 
                          if (role.title.toLowerCase() === 'admin') {
                            showToast('There can be only one Admin for the workspace.', 'error');
                            return;
                          }
                          if (activeProjectForRole) {
                            setProjectRoles(prev => ({ ...prev, [activeProjectForRole]: role.id }));
                          } else {
                            setSelectedRole(role); 
                          }
                          setIsRolePickerVisible(false); 
                        }}
                      >
                        <View style={styles.listItemTextContainer}>
                          <Text style={[styles.roleListItemText, ((activeProjectForRole && projectRoles[activeProjectForRole] === role.id) || (!activeProjectForRole && selectedRole?.id === role.id)) && styles.activeRoleItemText]}>{role.title}</Text>
                        </View>
                        {((activeProjectForRole && projectRoles[activeProjectForRole] === role.id) || (!activeProjectForRole && selectedRole?.id === role.id)) && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
                      </TouchableOpacity>
                    ))}
                    </>
                  )}
                </View>
              </ScrollView>
            </AdaptiveGlass>
          </View>
        </Modal>

        {/* Project Picker Modal */}
        <Modal animationType="fade" transparent={true} visible={isProjectPickerVisible} onRequestClose={() => setIsProjectPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setIsProjectPickerVisible(false)} />
            <AdaptiveGlass intensity={95} tint="light" style={styles.rolePickerContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('selectProjectTitle')}</Text>
                <TouchableOpacity onPress={() => setIsProjectPickerVisible(false)}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity>
              </View>

              <ScrollView style={styles.rolePickerList} showsVerticalScrollIndicator={false}>
                <View style={styles.pickerFullList}>
                  {isLoadingSettings ? (
                    <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
                  ) : projects.length === 0 ? (
                    <Text style={{ textAlign: 'center', marginTop: 40, color: '#94A3B8' }}>{t('noProjectsAvailable')}</Text>
                  ) : (
                    projects.map(project => {
                      const isSelected = selectedProjects.some(p => p._id === project._id);
                      return (
                        <TouchableOpacity
                          key={project._id}
                          style={[styles.roleListItem, isSelected && styles.activeRoleItem]}
                          onPress={() => toggleProject(project)}
                        >
                          <View style={styles.listItemTextContainer}>
                            <Text style={[styles.roleListItemText, isSelected && styles.activeRoleItemText]}>{project.name}</Text>
                          </View>
                          {isSelected && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </ScrollView>

              <TouchableOpacity style={styles.createBtn} onPress={() => setIsProjectPickerVisible(false)} activeOpacity={0.8}>
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.createBtnGradient}>
                  <Text style={styles.createBtnText}>{t('done')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </AdaptiveGlass>
          </View>
        </Modal>


      </SafeAreaView>

      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        isSubmitting={isOnboarding}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />

      {/* Credential Reveal Modal */}
      <Modal animationType="fade" transparent={true} visible={credentialModal.visible} onRequestClose={() => setCredentialModal(c => ({ ...c, visible: false }))}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setCredentialModal(c => ({ ...c, visible: false }))} />
          <AdaptiveGlass intensity={60} tint="light" style={[styles.modalContent, { padding: 28 }]}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="checkmark-circle" size={32} color="#10B981" />
              </View>
              <Text style={{ fontSize: 18, fontFamily: 'Inter-Black', color: '#0F172A' }}>{credentialModal.name} {t('onboardNewMember').split(' ').slice(-1)[0]}</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B', marginTop: 4, textAlign: 'center' }}>{t('shareLoginCredentials')}</Text>
            </View>

            <View style={{ backgroundColor: '#F8FAFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 }}>
              <View>
                <Text style={{ fontSize: 10, fontFamily: 'Inter-Black', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>{t('email')}</Text>
                <Text style={{ fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#0F172A' }}>{credentialModal.email}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: '#E2E8F0' }} />
              <View>
                <Text style={{ fontSize: 10, fontFamily: 'Inter-Black', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>{t('password')}</Text>
                <Text style={{ fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A', letterSpacing: 1 }}>{credentialModal.password}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden' }}
              activeOpacity={0.8}
              onPress={() => {
                Clipboard.setString(`Email: ${credentialModal.email}\nPassword: ${credentialModal.password}`);
                showToast('Credentials copied to clipboard', 'success');
              }}
            >
              <LinearGradient colors={['#3B82F6', '#2563EB']} style={{ height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
                <Text style={{ fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFFFFF' }}>Copy Credentials</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 10, height: 44, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setCredentialModal(c => ({ ...c, visible: false }))}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#64748B' }}>{t('done')}</Text>
            </TouchableOpacity>
          </AdaptiveGlass>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F0F9FF' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, marginBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0F2FE' },
  headerActionBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(59, 130, 246, 0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.1)' },
  headerTitleContainer: { flex: 1, marginLeft: 16 },
  headerPreTitle: { fontSize: 11, color: '#3B82F6', fontFamily: 'Inter-Black', textTransform: 'uppercase', letterSpacing: 1.5 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', letterSpacing: -0.5 },
  searchSection: { paddingHorizontal: 24, marginBottom: 24 },
  searchBar: { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0F2FE' },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  contentScroll: { flex: 1, paddingHorizontal: 24 },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingHorizontal: 4 },
  listTitle: { fontSize: 13, color: '#0F172A', fontFamily: 'Inter-Black', textTransform: 'uppercase', letterSpacing: 1.2 },
  countBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  countText: { fontSize: 12, color: '#64748B', fontFamily: 'Inter-Bold' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalDismiss: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalContent: { width: '100%', borderRadius: 32, padding: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0F2FE' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A' },
  inputLabel: { fontSize: 11, fontFamily: 'Inter-Black', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  inputBox: { height: 56, borderRadius: 16, paddingHorizontal: 16, justifyContent: 'center', marginBottom: 24 },
  textInput: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  roleSelectionTrigger: { padding: 14, borderRadius: 18, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  selectedRoleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roleIconBoxAlt: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DBEAFE' },
  selectedRoleTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  selectedRoleTag: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#94A3B8', textTransform: 'uppercase' },
  changeAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  changeText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#3B82F6' },
  createBtn: { borderRadius: 18, overflow: 'hidden' },
  createBtnGradient: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  createBtnText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  rolePickerContent: { width: '100%', height: height * 0.7, borderRadius: 32, padding: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0F2FE' },
  pickerSearchBar: { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0F2FE', marginBottom: 20 },
  pickerSearchInput: { flex: 1, marginLeft: 12, fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  rolePickerList: { flex: 1 },
  pickerFullList: { marginTop: 8 },
  roleListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, borderRadius: 16, marginBottom: 8, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#F1F5F9' },
  activeRoleItem: { backgroundColor: '#EFF6FF', borderColor: '#3B82F620' },
  listItemTextContainer: { flex: 1 },
  roleListItemText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  activeRoleItemText: { fontFamily: 'Inter-Bold', color: '#0F172A' },
});

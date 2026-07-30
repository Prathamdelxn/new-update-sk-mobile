import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AdaptiveGlass from '../../components/AdaptiveGlass';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function AddMemberScreen() {
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { token } = useAuth();
  const { showToast } = useToast();

  const [availableUsers, setAvailableUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [selectedMemberRole, setSelectedMemberRole] = useState(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  
  const [wizardStep, setWizardStep] = useState(1);
  const [expandedRole, setExpandedRole] = useState(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setIsFetchingData(true);
    try {
      const [usersRes, rolesRes, projectRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/roles`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/projects/${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [usersData, rolesData, projectData] = await Promise.all([
        usersRes.json(), rolesRes.json(), projectRes.json()
      ]);
      
      if (usersRes.ok && rolesRes.ok && projectRes.ok) {
        // Filter out existing members
        const existingUserIds = new Set(projectData.members?.map(m => m.user?._id || m.user));
        if (projectData.createdBy?._id) existingUserIds.add(projectData.createdBy._id);
        
        const filteredUsers = usersData.filter(u => !existingUserIds.has(u._id));
        setAvailableUsers(filteredUsers);
        setAvailableRoles(rolesData.filter(r => r.name !== 'Admin'));
      }
    } catch (e) {
      console.log('Error fetching add member data', e);
      showToast('Error fetching data', 'error');
    } finally {
      setIsFetchingData(false);
    }
  };

  const handleAddMemberSubmit = async () => {
    if (selectedNewMembers.length === 0 || !selectedMemberRole) {
      showToast('Please select at least one user and a role', 'error');
      return;
    }
    try {
      setIsAddingMember(true);
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userIds: selectedNewMembers, roleId: selectedMemberRole })
      });
      if (res.ok) {
        showToast('Members added successfully', 'success');
        router.back();
      } else {
        const err = await res.json();
        showToast(err.message || 'Failed to add member', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setIsAddingMember(false);
    }
  };

  const renderRoleItem = ({ item: r }) => {
    const isExpanded = expandedRole === r._id;
    const isSelected = selectedMemberRole === r._id;
    
    return (
      <AdaptiveGlass intensity={40} tint="light" style={[styles.roleCard, isSelected && styles.roleCardSelected]}>
        <TouchableOpacity 
          style={styles.roleCardHeader} 
          onPress={() => setExpandedRole(isExpanded ? null : r._id)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.roleCardTitle, isSelected && styles.roleCardTitleSelected]}>{r.name}</Text>
            <Text style={styles.roleCardDesc} numberOfLines={isExpanded ? undefined : 1}>
              {r.description || 'No description available.'}
            </Text>
          </View>
          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#64748B" />
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.roleCardBody}>
            {r.permissions && r.permissions.length > 0 ? (
              <View style={styles.permissionsGrid}>
                {(() => {
                  const grouped = {};
                  r.permissions.forEach(perm => {
                    if (perm === '*') { grouped['Admin'] = ['Full Access (*)']; return; }
                    const parts = perm.split(':');
                    const modName = (parts[0].charAt(0).toUpperCase() + parts[0].slice(1));
                    const action = parts.length > 1 ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : 'All';
                    if (!grouped[modName]) grouped[modName] = [];
                    grouped[modName].push(action);
                  });
                  return Object.keys(grouped).map((mod, idx) => (
                    <View key={idx} style={styles.permissionBadge}>
                      <Text style={styles.permissionBadgeTitle}>{mod}</Text>
                      <Text style={styles.permissionBadgeDetails}>{grouped[mod].join(', ')}</Text>
                    </View>
                  ));
                })()}
              </View>
            ) : (
              <Text style={styles.noPermissionsText}>No specific permissions defined.</Text>
            )}
            
            <TouchableOpacity 
              style={styles.selectRoleBtn}
              onPress={() => {
                setSelectedMemberRole(r._id);
                setWizardStep(2);
              }}
            >
              <Text style={styles.selectRoleBtnText}>Choose {r.name}</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </AdaptiveGlass>
    );
  };

  const filteredUsers = availableUsers.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const renderUserItem = ({ item: u }) => {
    const isSelected = selectedNewMembers.includes(u._id);
    return (
      <TouchableOpacity
        style={[styles.selectionItem, isSelected && styles.selectionItemActive]}
        onPress={() => {
          setSelectedNewMembers(prev => 
            prev.includes(u._id) 
              ? prev.filter(id => id !== u._id) 
              : [...prev, u._id]
          );
        }}
        activeOpacity={0.7}
      >
        <View style={styles.userItemAvatar}>
          <Text style={styles.userItemAvatarText}>{u.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.selectionItemTitle, isSelected && styles.selectionItemTitleActive]}>{u.name}</Text>
          <Text style={[styles.selectionItemSub, isSelected && styles.selectionItemTitleActive]}>{u.email}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            if (wizardStep === 2) {
              setWizardStep(1);
            } else {
              router.back();
            }
          }} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Team Member</Text>
          <View style={{ width: 24 }} />
        </View>

        {isFetchingData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading data...</Text>
          </View>
        ) : (
          <View style={styles.content}>
            {wizardStep === 1 && (
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Step 1: Select Role</Text>
                <FlatList
                  data={availableRoles}
                  keyExtractor={item => item._id}
                  renderItem={renderRoleItem}
                  contentContainerStyle={{ paddingBottom: 24 }}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}

            {wizardStep === 2 && (
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                  Step 2: Assign Users to '{availableRoles.find(r => r._id === selectedMemberRole)?.name}'
                </Text>
                
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search users..."
                    value={userSearch}
                    onChangeText={setUserSearch}
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                  />
                </View>
                
                <FlatList
                  data={filteredUsers}
                  keyExtractor={item => item._id}
                  renderItem={renderUserItem}
                  contentContainerStyle={{ paddingBottom: 100 }}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>No users found</Text>
                  }
                />
                
                <View style={styles.footerSticky}>
                  <TouchableOpacity 
                    style={[styles.submitBtn, (isAddingMember || selectedNewMembers.length === 0) && styles.submitBtnDisabled]} 
                    onPress={handleAddMemberSubmit}
                    disabled={isAddingMember || selectedNewMembers.length === 0}
                  >
                    {isAddingMember ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.submitBtnText}>
                        Assign {selectedNewMembers.length > 0 ? selectedNewMembers.length : ''} {selectedNewMembers.length === 1 ? 'User' : 'Users'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748B', fontFamily: 'Inter-Medium' },
  content: { flex: 1, padding: 20 },
  inputLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B', marginBottom: 16, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  // Role Card Styles
  roleCard: { borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, overflow: 'hidden' },
  roleCardSelected: { borderColor: '#BFDBFE', borderWidth: 1 },
  roleCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  roleCardTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 4 },
  roleCardTitleSelected: { color: '#1D4ED8' },
  roleCardDesc: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#64748B', lineHeight: 20 },
  roleCardBody: { padding: 18, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  permissionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  permissionBadge: { backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  permissionBadgeTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 2 },
  permissionBadgeDetails: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' },
  noPermissionsText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#94A3B8', fontStyle: 'italic', marginBottom: 16 },
  selectRoleBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 16, gap: 8 },
  selectRoleBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter-Bold' },
  
  // Users Styles
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, paddingHorizontal: 16, height: 52, marginBottom: 16 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, fontFamily: 'Inter-Medium', color: '#0F172A', height: '100%' },
  selectionItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  selectionItemActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  userItemAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  userItemAvatarText: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#64748B' },
  selectionItemTitle: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  selectionItemSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  selectionItemTitleActive: { color: '#1E3A8A' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  emptyText: { color: '#94A3B8', textAlign: 'center', padding: 20, fontFamily: 'Inter-Medium' },
  
  // Footer
  footerSticky: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'transparent' },
  submitBtn: { backgroundColor: '#2563EB', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter-Bold' },
});

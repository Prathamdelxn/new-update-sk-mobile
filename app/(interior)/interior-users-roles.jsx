import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useToast } from '../context/ToastContext';
import interiorApiClient from '../services/interiorApiClient';
import InteriorRolesManager from '../components/interior/InteriorRolesManager';
import { useInteriorPermissions } from '../utils/interior/useInteriorPermissions';

const SYSTEM_ROLE_LABELS = {
  super_admin: { label: 'Super Admin', color: '#7C3AED', bg: '#F5F3FF' },
  org_admin: { label: 'Org Admin', color: '#E11D48', bg: '#FFF1F2' },
  manager: { label: 'Manager', color: '#2563EB', bg: '#EFF6FF' },
  member: { label: 'Member', color: '#059669', bg: '#ECFDF5' },
  viewer: { label: 'Viewer', color: '#64748B', bg: '#F8FAFC' },
};

const PROJECT_ROLE_LABELS = {
  project_manager: 'Project Manager', site_engineer: 'Site Engineer',
  quantity_surveyor: 'Quantity Surveyor', designer: 'Designer',
  client_representative: 'Client Rep.', sub_contractor: 'Sub Contractor', viewer: 'Viewer',
};

function getInitials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

const emptyUserForm = { firstName: '', lastName: '', email: '', password: '', phone: '', designation: '', department: '', systemRole: 'member', roleId: '', status: 'active' };

export default function InteriorUsersRolesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();

  // Managing users is admin-only on the server; the Roles tab needs Roles → View
  const { isOrgAdmin, hasPermission } = useInteriorPermissions();
  const showUsersTab = isOrgAdmin;
  const showRolesTab = isOrgAdmin || hasPermission('roles', 'read');
  const [selectedTab, setActiveTab] = useState('users');
  const activeTab = selectedTab === 'users' && showUsersTab ? 'users' : showRolesTab ? 'roles' : showUsersTab ? 'users' : null;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [expandedUserId, setExpandedUserId] = useState(null);

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);
  // Set when the form edits an existing user instead of adding one (same as web Edit User)
  const [editingUserId, setEditingUserId] = useState(null);

  const openAddUser = () => {
    setEditingUserId(null);
    setUserForm(emptyUserForm);
    setAddUserOpen(true);
  };
  const openEditUser = (u) => {
    setEditingUserId(u._id);
    setUserForm({
      ...emptyUserForm,
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      phone: u.phone || '',
      designation: u.designation || '',
      department: u.department || '',
      systemRole: u.systemRole || 'member',
      roleId: (u.role && typeof u.role === 'object' ? u.role._id : u.role) || '',
      status: u.status || 'active',
    });
    setAddUserOpen(true);
  };
  const confirmDeleteUser = (u) =>
    Alert.alert('Delete user', `Remove ${u.firstName} ${u.lastName}? They will lose access to every project.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await interiorApiClient.delete(`/users/${u._id}`);
            showToast('User deleted', 'success');
            loadUsers();
          } catch (e) {
            showToast(e.message || 'Failed to delete user', 'error');
          }
        },
      },
    ]);
  // Organization roles for the new user (same as the web Add User form)
  const [orgRoles, setOrgRoles] = useState([]);
  useEffect(() => {
    if (!addUserOpen) return;
    interiorApiClient.get('/roles')
      .then((res) => {
        const list = (Array.isArray(res?.data) ? res.data : []).filter((r) => r.slug !== 'admin');
        setOrgRoles(list);
        const viewer = list.find((r) => r.slug === 'viewer') || list[0];
        // New users default to Viewer; editing keeps the user's current role (or none)
        setUserForm((f) => (editingUserId || f.roleId || !viewer ? f : { ...f, roleId: viewer._id }));
      })
      .catch(() => setOrgRoles([]));
  }, [addUserOpen, editingUserId]);

  const loadUsers = useCallback(async () => {
    if (!isOrgAdmin) { setLoading(false); return; } // Users tab is admin-only
    setLoading(true);
    try {
      const res = await interiorApiClient.get('/users/with-projects');
      setUsers(res?.success && res?.data ? res.data : Array.isArray(res) ? res : []);
    } catch (e) {
      console.error('Failed to load users', e);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [isOrgAdmin]);

  useFocusEffect(useCallback(() => { loadUsers(); }, [loadUsers]));

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.designation || '').toLowerCase().includes(q) ||
      (u.projectAssignments || []).some((a) => a.projectName?.toLowerCase().includes(q));
    const matchesRole = roleFilter === 'All' || u.systemRole === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalProjects = new Set(users.flatMap((u) => (u.projectAssignments || []).map((a) => a.projectId))).size;
  const activeUsers = users.filter((u) => u.status === 'active').length;

  const handleAddUser = async () => {
    if (!userForm.firstName.trim() || !userForm.lastName.trim() || !userForm.email.trim()) {
      showToast('First name, last name and email are required', 'error');
      return;
    }
    setSavingUser(true);
    try {
      const payload = {
        firstName: userForm.firstName.trim(),
        lastName: userForm.lastName.trim(),
        email: userForm.email.trim(),
        // Like the web: access comes from the organization role; new users are members,
        // and editing never changes someone's system role
        ...(editingUserId ? {} : { systemRole: 'member' }),
        ...(userForm.roleId ? { role: userForm.roleId } : {}),
        ...(userForm.password.trim() ? { password: userForm.password.trim() } : {}),
        ...(userForm.phone.trim() ? { phone: userForm.phone.trim() } : {}),
        ...(userForm.designation.trim() ? { designation: userForm.designation.trim() } : {}),
        ...(userForm.department.trim() ? { department: userForm.department.trim() } : {}),
      };
      if (editingUserId) {
        // Clearing the phone is allowed when editing
        await interiorApiClient.patch(`/users/${editingUserId}`, { ...payload, phone: userForm.phone.trim(), status: userForm.status });
        showToast(`User ${userForm.firstName} ${userForm.lastName} updated successfully`, 'success');
      } else {
        await interiorApiClient.post('/users', payload);
        showToast(`User ${userForm.firstName} ${userForm.lastName} created successfully`, 'success');
      }
      setEditingUserId(null);
      setAddUserOpen(false);
      setUserForm(emptyUserForm);
      loadUsers();
    } catch (e) {
      showToast(e.message || (editingUserId ? 'Failed to update user' : 'Failed to create user'), 'error');
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Users & Roles</Text>
            <Text style={s.headerSub}>Team assignments & role permission matrix.</Text>
          </View>
          {activeTab === 'users' && (
            <TouchableOpacity style={s.addBtn} onPress={openAddUser}>
              <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.tabRow}>
          {showUsersTab && (
            <TouchableOpacity style={[s.tabBtn, activeTab === 'users' && s.tabBtnActive]} onPress={() => setActiveTab('users')}>
              <Ionicons name="people-outline" size={14} color={activeTab === 'users' ? '#FFFFFF' : '#64748B'} />
              <Text style={[s.tabBtnText, activeTab === 'users' && s.tabBtnTextActive]}>Users</Text>
            </TouchableOpacity>
          )}
          {showRolesTab && (
            <TouchableOpacity style={[s.tabBtn, activeTab === 'roles' && s.tabBtnActive]} onPress={() => setActiveTab('roles')}>
              <Ionicons name="shield-outline" size={14} color={activeTab === 'roles' ? '#FFFFFF' : '#64748B'} />
              <Text style={[s.tabBtnText, activeTab === 'roles' && s.tabBtnTextActive]}>Roles</Text>
            </TouchableOpacity>
          )}
        </View>

        {activeTab === null ? (
          <View style={s.center}>
            <Text style={{ fontSize: 13, color: '#64748B', fontFamily: 'Inter-Regular' }}>You don&apos;t have permission to view users or roles.</Text>
          </View>
        ) : activeTab === 'users' && loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : activeTab === 'users' ? (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.summaryRow}>
              <View style={s.summaryCard}>
                <Text style={s.summaryValue}>{users.length}</Text>
                <Text style={s.summaryLabel}>Total Users</Text>
              </View>
              <View style={s.summaryCard}>
                <Text style={[s.summaryValue, { color: '#059669' }]}>{activeUsers}</Text>
                <Text style={s.summaryLabel}>Active</Text>
              </View>
              <View style={s.summaryCard}>
                <Text style={[s.summaryValue, { color: '#2563EB' }]}>{totalProjects}</Text>
                <Text style={s.summaryLabel}>Projects Covered</Text>
              </View>
            </View>

            <View style={s.searchRow}>
              <Ionicons name="search" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput style={s.searchInput} placeholder="Search by name, email, or project..." placeholderTextColor="#94A3B8" value={searchQuery} onChangeText={setSearchQuery} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10, marginBottom: 4 }}>
              {['All', 'super_admin', 'org_admin', 'manager', 'member', 'viewer'].map((r) => (
                <TouchableOpacity key={r} style={[s.filterChip, roleFilter === r && s.filterChipActive]} onPress={() => setRoleFilter(r)}>
                  <Text style={[s.filterChipText, roleFilter === r && s.filterChipTextActive]}>{r === 'All' ? 'All Roles' : (SYSTEM_ROLE_LABELS[r]?.label || r)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ marginTop: 12, gap: 10 }}>
              {filteredUsers.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="people-outline" size={40} color="#CBD5E1" />
                  <Text style={s.emptyTitle}>No users match your search.</Text>
                </View>
              ) : (
                filteredUsers.map((u) => {
                  const sysRole = SYSTEM_ROLE_LABELS[u.systemRole] || { label: u.systemRole, color: '#64748B', bg: '#F8FAFC' };
                  const expanded = expandedUserId === u._id;
                  const assignments = u.projectAssignments || [];
                  return (
                    <View key={u._id} style={s.userCard}>
                      <TouchableOpacity style={s.userRow} onPress={() => setExpandedUserId(expanded ? null : u._id)}>
                        <View style={s.userAvatar}>
                          <Text style={s.userAvatarText}>{getInitials(u.firstName, u.lastName)}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={s.userName}>{u.firstName} {u.lastName}</Text>
                            <View style={[s.roleBadge, { backgroundColor: sysRole.bg }]}>
                              <Text style={[s.roleBadgeText, { color: sysRole.color }]}>{sysRole.label}</Text>
                            </View>
                          </View>
                          <Text style={s.userEmail} numberOfLines={1}>{u.email}</Text>
                        </View>
                        <View style={s.projCountBadge}>
                          <Ionicons name="folder-outline" size={11} color="#64748B" />
                          <Text style={s.projCountText}>{assignments.length}</Text>
                        </View>
                        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
                      </TouchableOpacity>

                      {expanded && (
                        <View style={s.assignmentsBox}>
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                            <TouchableOpacity style={s.userActionBtn} onPress={() => openEditUser(u)}>
                              <Ionicons name="create-outline" size={14} color="#2563EB" />
                              <Text style={s.userActionText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.userActionBtn, { borderColor: '#FECACA' }]} onPress={() => confirmDeleteUser(u)}>
                              <Ionicons name="trash-outline" size={14} color="#DC2626" />
                              <Text style={[s.userActionText, { color: '#DC2626' }]}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                          {assignments.length === 0 ? (
                            <Text style={s.noAssignments}>Not assigned to any project yet.</Text>
                          ) : (
                            assignments.map((a) => (
                              <View key={a.projectId} style={s.assignmentRow}>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={s.assignmentProject} numberOfLines={1}>{a.projectName}</Text>
                                  <Text style={s.assignmentRole}>{PROJECT_ROLE_LABELS[a.projectRole] || a.projectRole} · {(a.permissions || []).length} modules</Text>
                                </View>
                                <View style={s.assignmentStatusBadge}>
                                  <Text style={s.assignmentStatusText}>{a.projectStatus}</Text>
                                </View>
                              </View>
                            ))
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
            <View style={{ height: 80 }} />
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.infoBanner}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#2563EB" />
              <Text style={s.infoBannerText}>Organization roles. Assign one to a user, or use it as a member's role in a project. Tap a role to see its permissions.</Text>
            </View>
            <InteriorRolesManager />
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={addUserOpen} animationType="slide" transparent onRequestClose={() => setAddUserOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingUserId ? 'Edit User' : 'Add New User'}</Text>
              <TouchableOpacity onPress={() => setAddUserOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>First Name *</Text>
                  <TextInput style={s.input} placeholder="John" placeholderTextColor="#94A3B8" value={userForm.firstName} onChangeText={(v) => setUserForm({ ...userForm, firstName: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Last Name *</Text>
                  <TextInput style={s.input} placeholder="Doe" placeholderTextColor="#94A3B8" value={userForm.lastName} onChangeText={(v) => setUserForm({ ...userForm, lastName: v })} />
                </View>
              </View>

              <Text style={s.label}>Email *</Text>
              <TextInput style={s.input} placeholder="john@company.com" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" value={userForm.email} onChangeText={(v) => setUserForm({ ...userForm, email: v })} />

              <Text style={s.label}>Password</Text>
              <TextInput style={s.input} placeholder="Leave blank for welcome123" placeholderTextColor="#94A3B8" secureTextEntry value={userForm.password} onChangeText={(v) => setUserForm({ ...userForm, password: v })} />

              <Text style={s.label}>Phone</Text>
              <TextInput style={s.input} placeholder="+91 9876543210" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={userForm.phone} onChangeText={(v) => setUserForm({ ...userForm, phone: v })} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Designation</Text>
                  <TextInput style={s.input} placeholder="e.g. Site Engineer" placeholderTextColor="#94A3B8" value={userForm.designation} onChangeText={(v) => setUserForm({ ...userForm, designation: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Department</Text>
                  <TextInput style={s.input} placeholder="e.g. Operations" placeholderTextColor="#94A3B8" value={userForm.department} onChangeText={(v) => setUserForm({ ...userForm, department: v })} />
                </View>
              </View>

              {orgRoles.length > 0 && (
                <>
                  <Text style={s.label}>Organization Role</Text>
                  <View style={s.pillWrap}>
                    {orgRoles.map((r) => (
                      <TouchableOpacity key={r._id} style={[s.pill, userForm.roleId === r._id && s.pillActive]} onPress={() => setUserForm({ ...userForm, roleId: r._id })}>
                        <Text style={[s.pillText, userForm.roleId === r._id && s.pillTextActive]}>{r.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {editingUserId && (
                <>
                  <Text style={s.label}>Status</Text>
                  <View style={s.pillWrap}>
                    {['active', 'inactive', 'suspended'].map((st) => (
                      <TouchableOpacity key={st} style={[s.pill, userForm.status === st && s.pillActive]} onPress={() => setUserForm({ ...userForm, status: st })}>
                        <Text style={[s.pillText, userForm.status === st && s.pillTextActive]}>{st.charAt(0).toUpperCase() + st.slice(1)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <TouchableOpacity style={[s.saveBtn, savingUser && { opacity: 0.6 }]} onPress={handleAddUser} disabled={savingUser}>
                {savingUser ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>{editingUserId ? 'Save Changes' : 'Create User'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  userActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#FFFFFF' },
  userActionText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#2563EB' },
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 14 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  addBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },

  tabRow: { flexDirection: 'row', gap: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F8FAFC' },
  tabBtnActive: { backgroundColor: '#2563EB' },
  tabBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B' },
  tabBtnTextActive: { color: '#FFFFFF' },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' },
  summaryValue: { fontSize: 18, fontFamily: 'Inter-Black', color: '#0F172A' },
  summaryLabel: { fontSize: 9.5, fontFamily: 'Inter-SemiBold', color: '#94A3B8', marginTop: 3, textAlign: 'center' },

  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },

  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  filterChipTextActive: { color: '#FFFFFF' },

  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  userCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  userAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  userName: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  userEmail: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },
  roleBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  roleBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold' },
  projCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F8FAFC', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  projCountText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#64748B' },

  assignmentsBox: { borderTopWidth: 1, borderTopColor: '#F8FAFC', padding: 12, gap: 8 },
  noAssignments: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
  assignmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10 },
  assignmentProject: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  assignmentRole: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  assignmentStatusBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  assignmentStatusText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#2563EB', textTransform: 'capitalize' },

  infoBanner: { flexDirection: 'row', gap: 10, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 14, padding: 12, marginBottom: 14 },
  infoBannerText: { flex: 1, fontSize: 11, fontFamily: 'Inter-Regular', color: '#334155', lineHeight: 16 },

  roleCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden', marginBottom: 10 },
  roleCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  roleIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  roleCardTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  roleCardDesc: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  roleModuleCount: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#0F172A', marginRight: 2 },

  matrixBox: { borderTopWidth: 1, borderTopColor: '#F8FAFC', padding: 12, gap: 10 },
  matrixRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matrixModuleText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#334155', flexShrink: 1 },
  actionPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  actionPillText: { fontSize: 9, fontFamily: 'Inter-Bold' },
  noAccessText: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#CBD5E1', fontStyle: 'italic' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  pillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  pillText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  pillTextActive: { color: '#FFFFFF' },
  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

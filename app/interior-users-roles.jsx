import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useToast } from './context/ToastContext';
import interiorApiClient from './services/interiorApiClient';

const ALL_MODULES = [
  { key: 'projects', label: 'Project Config' },
  { key: 'wbs', label: 'WBS Hierarchy' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'dpr', label: 'Daily Progress' },
  { key: 'weekly_reports', label: 'Weekly Reports' },
  { key: 'procurement', label: 'Procurement' },
  { key: 'purchase_orders', label: 'Purchase Orders' },
  { key: 'drawings', label: 'Drawings' },
  { key: 'rfis', label: 'RFIs' },
  { key: 'mom', label: 'Minutes of Meeting' },
  { key: 'risks', label: 'Risks' },
  { key: 'snags', label: 'Snags' },
  { key: 'ncrs', label: 'NCRs' },
  { key: 'utilities', label: 'Utilities' },
  { key: 'photos', label: 'Site Photos' },
  { key: 'handover', label: 'Handover' },
  { key: 'users', label: 'Team / Members' },
  { key: 'filemgt', label: 'File Management' },
  { key: 'financials', label: 'Payments & Financials' },
];

const full = ['create', 'read', 'update', 'delete', 'approve', 'export', 'manage'];
const crud = ['create', 'read', 'update', 'delete'];
const cru = ['create', 'read', 'update'];
const ro = ['read'];
const none = [];

const ROLE_MATRIX = {
  project_manager: { projects: full, wbs: full, tasks: full, milestones: full, dpr: full, weekly_reports: full, procurement: full, purchase_orders: full, drawings: full, rfis: full, mom: full, risks: full, snags: full, ncrs: full, utilities: full, photos: full, handover: full, users: full, filemgt: full, financials: full },
  site_engineer: { projects: ro, wbs: ro, tasks: cru, milestones: ro, dpr: crud, weekly_reports: crud, procurement: ro, purchase_orders: ro, drawings: ro, rfis: crud, mom: crud, risks: crud, snags: crud, ncrs: crud, utilities: crud, photos: crud, handover: ro, users: ro, filemgt: crud, financials: ro },
  quantity_surveyor: { projects: ro, wbs: ro, tasks: ro, milestones: ro, dpr: ro, weekly_reports: ro, procurement: crud, purchase_orders: crud, drawings: ro, rfis: ro, mom: ro, risks: ro, snags: ro, ncrs: ro, utilities: crud, photos: ro, handover: ro, users: none, filemgt: crud, financials: crud },
  designer: { projects: ro, wbs: ro, tasks: ro, milestones: ro, dpr: none, weekly_reports: none, procurement: none, purchase_orders: none, drawings: crud, rfis: crud, mom: ro, risks: ro, snags: ro, ncrs: ro, utilities: none, photos: crud, handover: ro, users: none, filemgt: crud, financials: ro },
  sub_contractor: { projects: ro, wbs: none, tasks: cru, milestones: none, dpr: ro, weekly_reports: none, procurement: ro, purchase_orders: ro, drawings: ro, rfis: ro, mom: none, risks: none, snags: ro, ncrs: ro, utilities: none, photos: ro, handover: none, users: none, filemgt: ro, financials: ro },
  client_representative: { projects: ro, wbs: ro, tasks: ro, milestones: ro, dpr: ro, weekly_reports: ro, procurement: ro, purchase_orders: ro, drawings: ro, rfis: ro, mom: ro, risks: ro, snags: ro, ncrs: ro, utilities: ro, photos: ro, handover: ro, users: none, filemgt: ro, financials: ro },
  viewer: { projects: ro, wbs: ro, tasks: ro, milestones: ro, dpr: ro, weekly_reports: ro, procurement: ro, purchase_orders: ro, drawings: ro, rfis: ro, mom: ro, risks: ro, snags: ro, ncrs: ro, utilities: ro, photos: ro, handover: ro, users: none, filemgt: ro, financials: ro },
};

const ROLE_DEFS = [
  { key: 'project_manager', label: 'Project Manager', desc: 'Full access to all modules' },
  { key: 'site_engineer', label: 'Site Engineer', desc: 'Field-focused CRUD + own tasks' },
  { key: 'quantity_surveyor', label: 'Quantity Surveyor', desc: 'Procurement & financials focused' },
  { key: 'designer', label: 'Designer', desc: 'Drawings, RFIs & photos access' },
  { key: 'sub_contractor', label: 'Sub Contractor', desc: 'Own tasks + limited read' },
  { key: 'client_representative', label: 'Client Rep.', desc: 'Read-heavy + project config read' },
  { key: 'viewer', label: 'Viewer', desc: 'Read-only across all modules' },
];

const ACTION_COLORS = {
  create: '#059669', read: '#2563EB', update: '#D97706', delete: '#DC2626',
  approve: '#7C3AED', export: '#0D9488', manage: '#E11D48',
};

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

const emptyUserForm = { firstName: '', lastName: '', email: '', password: '', phone: '', designation: '', department: '', systemRole: 'member' };

export default function InteriorUsersRolesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [expandedRoleKey, setExpandedRoleKey] = useState(null);

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);

  const loadUsers = useCallback(async () => {
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
  }, []);

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
        systemRole: userForm.systemRole,
        ...(userForm.password.trim() ? { password: userForm.password.trim() } : {}),
        ...(userForm.phone.trim() ? { phone: userForm.phone.trim() } : {}),
        ...(userForm.designation.trim() ? { designation: userForm.designation.trim() } : {}),
        ...(userForm.department.trim() ? { department: userForm.department.trim() } : {}),
      };
      await interiorApiClient.post('/users', payload);
      showToast(`User ${userForm.firstName} ${userForm.lastName} created successfully`, 'success');
      setAddUserOpen(false);
      setUserForm(emptyUserForm);
      loadUsers();
    } catch (e) {
      showToast(e.message || 'Failed to create user', 'error');
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
            <TouchableOpacity style={s.addBtn} onPress={() => setAddUserOpen(true)}>
              <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.tabRow}>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'users' && s.tabBtnActive]} onPress={() => setActiveTab('users')}>
            <Ionicons name="people-outline" size={14} color={activeTab === 'users' ? '#FFFFFF' : '#64748B'} />
            <Text style={[s.tabBtnText, activeTab === 'users' && s.tabBtnTextActive]}>Users</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'roles' && s.tabBtnActive]} onPress={() => setActiveTab('roles')}>
            <Ionicons name="shield-outline" size={14} color={activeTab === 'roles' ? '#FFFFFF' : '#64748B'} />
            <Text style={[s.tabBtnText, activeTab === 'roles' && s.tabBtnTextActive]}>Roles</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
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
              <Text style={s.infoBannerText}>These are the built-in permission presets automatically assigned when a user is added to a project. Tap any role to expand its full permission matrix.</Text>
            </View>

            {ROLE_DEFS.map((roleDef) => {
              const matrix = ROLE_MATRIX[roleDef.key];
              const modulesWithAccess = ALL_MODULES.filter((m) => (matrix[m.key] || []).length > 0).length;
              const expanded = expandedRoleKey === roleDef.key;
              return (
                <View key={roleDef.key} style={s.roleCard}>
                  <TouchableOpacity style={s.roleCardHeader} onPress={() => setExpandedRoleKey(expanded ? null : roleDef.key)}>
                    <View style={s.roleIconBox}>
                      <Ionicons name="shield-outline" size={18} color="#64748B" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.roleCardTitle}>{roleDef.label}</Text>
                      <Text style={s.roleCardDesc}>{roleDef.desc}</Text>
                    </View>
                    <Text style={s.roleModuleCount}>{modulesWithAccess}/{ALL_MODULES.length}</Text>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
                  </TouchableOpacity>

                  {expanded && (
                    <View style={s.matrixBox}>
                      {ALL_MODULES.map((mod) => {
                        const actions = matrix[mod.key] || [];
                        const hasAccess = actions.length > 0;
                        return (
                          <View key={mod.key} style={s.matrixRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, width: 120 }}>
                              <Ionicons name={hasAccess ? 'checkmark-circle' : 'remove-circle-outline'} size={13} color={hasAccess ? '#059669' : '#CBD5E1'} />
                              <Text style={[s.matrixModuleText, !hasAccess && { opacity: 0.4 }]} numberOfLines={1}>{mod.label}</Text>
                            </View>
                            <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                              {hasAccess ? actions.map((a) => (
                                <View key={a} style={[s.actionPill, { borderColor: ACTION_COLORS[a] || '#94A3B8' }]}>
                                  <Text style={[s.actionPillText, { color: ACTION_COLORS[a] || '#94A3B8' }]}>{a}</Text>
                                </View>
                              )) : (
                                <Text style={s.noAccessText}>no access</Text>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={addUserOpen} animationType="slide" transparent onRequestClose={() => setAddUserOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add New User</Text>
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
              <TextInput style={s.input} placeholder="Leave blank for Welcome@123" placeholderTextColor="#94A3B8" secureTextEntry value={userForm.password} onChangeText={(v) => setUserForm({ ...userForm, password: v })} />

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

              <Text style={s.label}>System Role</Text>
              <View style={s.pillWrap}>
                {['member', 'manager', 'org_admin', 'viewer'].map((r) => (
                  <TouchableOpacity key={r} style={[s.pill, userForm.systemRole === r && s.pillActive]} onPress={() => setUserForm({ ...userForm, systemRole: r })}>
                    <Text style={[s.pillText, userForm.systemRole === r && s.pillTextActive]}>{SYSTEM_ROLE_LABELS[r]?.label || r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[s.saveBtn, savingUser && { opacity: 0.6 }]} onPress={handleAddUser} disabled={savingUser}>
                {savingUser ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Create User</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
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

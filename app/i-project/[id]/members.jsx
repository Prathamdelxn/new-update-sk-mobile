import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';
import { useAuth } from '../../context/AuthContext';
import { PERMISSION_ACTIONS as CATALOG_ACTIONS, PERMISSION_MODULES, moduleActions } from '../../utils/interior/permissionCatalog';
import { useProjectPermissions, invalidateProjectPermissions } from '../../utils/interior/useProjectPermissions';
import { memberRoleLabel, isVirtualAdminMember } from '../../utils/interior/memberRoleLabel';

const ROLE_META = {
  project_manager: { label: 'Project Manager', color: '#2563EB', bg: '#EFF6FF' },
  site_engineer: { label: 'Site Engineer', color: '#D97706', bg: '#FFFBEB' },
  quantity_surveyor: { label: 'Quantity Surveyor', color: '#16A34A', bg: '#F0FDF4' },
  designer: { label: 'Designer', color: '#7C3AED', bg: '#F5F3FF' },
  sub_contractor: { label: 'Sub Contractor', color: '#E11D48', bg: '#FFF1F2' },
  client_representative: { label: 'Client Rep', color: '#4F46E5', bg: '#EEF2FF' },
  viewer: { label: 'Viewer', color: '#64748B', bg: '#F8FAFC' },
};
// Same project sections and actions as the role editor (shared catalog)
const PROJECT_MODULES = PERMISSION_MODULES
  .filter((m) => m.category === 'Project Execution')
  .map((m) => ({ module: m.key, label: m.label }));
const PERMISSION_ACTIONS = CATALOG_ACTIONS.map((a) => a.key);
const ACTION_LABEL = Object.fromEntries(CATALOG_ACTIONS.map((a) => [a.key, a.label]));

// Opening the project needs Project Config → View, so any other project
// permission keeps it on (same rule as the role editor)
const ensureProjectView = (perms) => {
  const needs = perms.some((p) => p.module !== 'projects' && p.actions.length > 0);
  const proj = perms.find((p) => p.module === 'projects');
  if (!needs || proj?.actions.includes('read')) return perms;
  return proj
    ? perms.map((p) => (p.module === 'projects' ? { ...p, actions: [...p.actions, 'read'] } : p))
    : [...perms, { module: 'projects', actions: ['read'] }];
};

const emptyInvite = { firstName: '', lastName: '', email: '', password: '', roleId: '', designation: '', department: '' };

export default function InteriorMembersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();
  const { refreshUser } = useAuth();
  // Add / invite = Team & Members → Create, edit = Update, remove = Delete
  const { can: canDo } = useProjectPermissions(projectId);

  const [members, setMembers] = useState([]);
  // Project roles come from the organization's roles (Users & Roles → Roles)
  const [orgRoles, setOrgRoles] = useState([]);
  const [permMode, setPermMode] = useState('role'); // 'role' = linked org role, 'custom' = hand-picked
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState(emptyInvite);

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [orgUsers, setOrgUsers] = useState([]);
  const [orgUsersLoading, setOrgUsersLoading] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addMemberRole, setAddMemberRole] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

  const [permMember, setPermMember] = useState(null);
  const [editedPermissions, setEditedPermissions] = useState([]);
  const [editedRole, setEditedRole] = useState('');
  const [expandedModule, setExpandedModule] = useState(null);
  const [savingPerms, setSavingPerms] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/members`);
      setMembers(res?.success ? res.data || [] : []);
    } catch (e) {
      showToast(e.message || 'Failed to load members', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchMembers(); }, [fetchMembers]));

  useEffect(() => {
    interiorApiClient.get('/roles')
      .then((res) => setOrgRoles((Array.isArray(res?.data) ? res.data : []).filter((r) => r.slug !== 'admin')))
      .catch(() => setOrgRoles([]));
  }, []);
  const viewerRoleId = (orgRoles.find((r) => r.slug === 'viewer') || orgRoles[0])?._id || '';

  // A member's role id (linked) — or the built-in role matching their preset
  const memberRoleId = (m) => {
    if (m.roleId && typeof m.roleId === 'object') return m.roleId._id;
    if (typeof m.roleId === 'string' && m.roleId) return m.roleId;
    const slug = (m.projectRole || '').replace(/_/g, '-');
    return orgRoles.find((r) => r.slug === slug)?._id || '';
  };

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.userId?.firstName?.toLowerCase().includes(q) ||
      m.userId?.lastName?.toLowerCase().includes(q) ||
      m.userId?.email?.toLowerCase().includes(q) ||
      m.projectRole?.toLowerCase().includes(q)
    );
  });

  const fetchOrgUsers = useCallback(async () => {
    setOrgUsersLoading(true);
    try {
      const res = await interiorApiClient.get('/users');
      const list = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
      setOrgUsers(list);
    } catch (e) {
      showToast(e.message || 'Failed to load organisation users', 'error');
    } finally {
      setOrgUsersLoading(false);
    }
  }, [showToast]);

  const openAddMemberModal = () => {
    setAddMemberSearch('');
    setAddMemberUserId('');
    setAddMemberRole(viewerRoleId);
    setIsAddMemberOpen(true);
    fetchOrgUsers();
  };

  const handleAddExistingMember = async () => {
    if (!addMemberUserId) {
      showToast('Please select a user', 'error');
      return;
    }
    setIsAddingMember(true);
    try {
      await interiorApiClient.post(
        `/projects/${projectId}/members`,
        addMemberRole ? { userId: addMemberUserId, roleId: addMemberRole } : { userId: addMemberUserId, projectRole: 'viewer' }
      );
      showToast('Member added to project', 'success');
      setIsAddMemberOpen(false);
      fetchMembers();
    } catch (e) {
      showToast(e.message || 'Failed to add member', 'error');
    } finally {
      setIsAddingMember(false);
    }
  };

  const alreadyMemberIds = new Set(members.map((m) => m.userId?._id));
  const filteredOrgUsers = orgUsers.filter((u) => {
    if (alreadyMemberIds.has(u._id)) return false;
    const q = addMemberSearch.toLowerCase();
    if (!q) return true;
    return `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
  });

  const handleInvite = async () => {
    if (!inviteForm.firstName || !inviteForm.lastName || !inviteForm.email) {
      showToast('Please fill all required fields', 'error');
      return;
    }
    setInviting(true);
    try {
      // Password is optional — the server defaults it to welcome123 (same as construction)
      const { password, roleId, ...rest } = inviteForm;
      await interiorApiClient.post(`/projects/${projectId}/members/invite`, {
        ...rest,
        ...(password.trim() ? { password: password.trim() } : {}),
        ...(roleId || viewerRoleId ? { roleId: roleId || viewerRoleId } : { projectRole: 'viewer' }),
      });
      showToast('User created and added to project', 'success');
      setIsInviteOpen(false);
      setInviteForm(emptyInvite);
      fetchMembers();
    } catch (e) {
      showToast(e.message || 'Failed to invite member', 'error');
    } finally {
      setInviting(false);
    }
  };

  const confirmDelete = (member) => {
    Alert.alert(
      'Remove Member',
      'They will lose access to all tasks and documents in this project.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => handleDelete(member) },
      ]
    );
  };

  const handleDelete = async (member) => {
    try {
      await interiorApiClient.delete(`/projects/${projectId}/members/${member._id}`);
      showToast('Member removed from project', 'delete');
      fetchMembers();
    } catch (e) {
      showToast(e.message || 'Failed to remove member', 'error');
    }
  };

  const openPermissions = (member) => {
    const linked = member.roleId && typeof member.roleId === 'object' ? member.roleId : null;
    setPermMember(member);
    setEditedPermissions(JSON.parse(JSON.stringify((linked ? linked.permissions : member.permissions) || [])));
    setEditedRole(memberRoleId(member));
    // Linked members follow their role; older members keep their own permissions until a role is picked
    setPermMode(linked ? 'role' : 'custom');
    setExpandedModule(null);
  };

  const closePermissions = () => {
    setPermMember(null);
    setEditedPermissions([]);
    setEditedRole('');
  };

  const hasAction = (moduleName, action) => {
    const perm = editedPermissions.find((p) => p.module === moduleName);
    return perm ? perm.actions.includes(action) : false;
  };

  const toggleAction = (moduleName, action) => {
    // Hand-picking permissions makes them custom for this member (no role link)
    setPermMode('custom');
    setEditedPermissions((prev) => ensureProjectView((() => {
      const idx = prev.findIndex((p) => p.module === moduleName);
      if (idx > -1) {
        const existing = prev[idx];
        const newActions = existing.actions.includes(action)
          ? existing.actions.filter((a) => a !== action)
          : [...existing.actions, action];
        if (newActions.length === 0) return prev.filter((p) => p.module !== moduleName);
        const updated = [...prev];
        updated[idx] = { ...existing, actions: newActions };
        return updated;
      }
      return [...prev, { module: moduleName, actions: [action] }];
    })()));
  };

  const handleRoleChange = (roleId) => {
    const role = orgRoles.find((r) => r._id === roleId);
    setEditedRole(roleId);
    setEditedPermissions(JSON.parse(JSON.stringify(role?.permissions || [])));
    setPermMode('role');
    if (role) showToast(`Using the "${role.name}" role's permissions`, 'success');
  };

  const savePermissions = async () => {
    if (!permMember) return;
    setSavingPerms(true);
    try {
      // Role mode → link the org role (its permissions apply live); custom → these exact permissions
      const payload = permMode === 'role' && editedRole ? { roleId: editedRole } : { permissions: editedPermissions };
      await interiorApiClient.patch(`/projects/${projectId}/members/${permMember._id}`, payload);
      showToast('Permissions updated successfully', 'success');
      // Apply the change to open screens right away
      invalidateProjectPermissions(projectId);
      refreshUser?.();
      closePermissions();
      fetchMembers();
    } catch (e) {
      showToast(e.message || 'Failed to update permissions', 'error');
    } finally {
      setSavingPerms(false);
    }
  };

  const totalPerms = editedPermissions.reduce((acc, p) => acc + p.actions.length, 0);

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Team & Access Control</Text>
            <Text style={s.headerSub}>Manage users, roles, and granular permissions.</Text>
          </View>
        </View>

        <View style={s.searchRow}>
          <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput style={s.searchInput} placeholder="Search team members..." placeholderTextColor="#94A3B8" value={searchQuery} onChangeText={setSearchQuery} />
          <Text style={s.countText}>{members.length} {members.length === 1 ? 'Member' : 'Members'}</Text>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {filteredMembers.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="people-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No members found</Text>
              </View>
            ) : (
              filteredMembers.map((member) => {
                const role = { ...(ROLE_META[member.projectRole] || ROLE_META.viewer), label: memberRoleLabel(member) };
                const editable = !isVirtualAdminMember(member);
                const permCount = member.permissions?.reduce((acc, p) => acc + p.actions.length, 0) || 0;
                return (
                  <View key={member._id} style={s.memberCard}>
                    <View style={s.memberTopRow}>
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>{member.userId?.firstName?.[0]}{member.userId?.lastName?.[0]}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.memberName} numberOfLines={1}>{member.userId?.firstName} {member.userId?.lastName}</Text>
                        <Text style={s.memberEmail} numberOfLines={1}>{member.userId?.email}</Text>
                        {!!member.userId?.designation && <Text style={s.memberDesignation} numberOfLines={1}>{member.userId.designation}</Text>}
                      </View>
                      <View style={{ gap: 6, alignItems: 'flex-end' }}>
                        {editable && canDo('users', 'update') && (
                          <TouchableOpacity onPress={() => openPermissions(member)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="settings-outline" size={17} color="#94A3B8" />
                          </TouchableOpacity>
                        )}
                        {editable && canDo('users', 'delete') && (
                          <TouchableOpacity onPress={() => confirmDelete(member)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <View style={s.memberBottomRow}>
                      <View style={[s.roleBadge, { backgroundColor: role.bg }]}>
                        <Text style={[s.roleBadgeText, { color: role.color }]}>{role.label}</Text>
                      </View>
                      <TouchableOpacity style={s.permCountBtn} disabled={!editable || !canDo('users', 'update')} onPress={() => openPermissions(member)}>
                        <Ionicons name="shield-checkmark-outline" size={11} color="#64748B" />
                        <Text style={s.permCountText}>{permCount} permissions</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {canDo('users', 'create') && (
          <View style={s.fabGroup}>
            <TouchableOpacity style={s.fabSecondary} onPress={openAddMemberModal}>
              <Ionicons name="person-add-outline" size={20} color="#2563EB" />
            </TouchableOpacity>
            <TouchableOpacity style={s.fab} onPress={() => setIsInviteOpen(true)}>
              <Ionicons name="add" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* Add Existing Member Modal */}
      <Modal visible={isAddMemberOpen} animationType="slide" transparent onRequestClose={() => setIsAddMemberOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Add Existing Member</Text>
                <Text style={s.headerSub}>Select a user from your organisation</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAddMemberOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={s.searchRow2}>
              <Ionicons name="search" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search by name or email..."
                placeholderTextColor="#94A3B8"
                value={addMemberSearch}
                onChangeText={(t) => { setAddMemberSearch(t); setAddMemberUserId(''); }}
              />
            </View>

            {orgUsersLoading ? (
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#2563EB" />
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 260, marginTop: 10 }} showsVerticalScrollIndicator={false}>
                {filteredOrgUsers.length === 0 ? (
                  <Text style={s.emptyTitle}>
                    {addMemberSearch ? 'No users match your search.' : 'All organisation users are already members.'}
                  </Text>
                ) : (
                  filteredOrgUsers.map((u) => (
                    <TouchableOpacity
                      key={u._id}
                      style={[s.orgUserRow, addMemberUserId === u._id && s.orgUserRowActive]}
                      onPress={() => setAddMemberUserId(u._id)}
                    >
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>{u.firstName?.[0]}{u.lastName?.[0]}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.memberName} numberOfLines={1}>{u.firstName} {u.lastName}</Text>
                        <Text style={s.memberEmail} numberOfLines={1}>{u.email}</Text>
                      </View>
                      {addMemberUserId === u._id && <Ionicons name="checkmark-circle" size={18} color="#2563EB" />}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}

            <Text style={[s.label, { marginTop: 14 }]}>Project Role</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.roleScroll} contentContainerStyle={s.roleScrollContent}>
              {orgRoles.map((r) => (
                <TouchableOpacity key={r._id} style={[s.chip, addMemberRole === r._id && s.chipActive]} onPress={() => setAddMemberRole(r._id)}>
                  <Text style={[s.chipText, addMemberRole === r._id && s.chipTextActive]}>{r.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[s.saveBtn, (!addMemberUserId || isAddingMember) && { opacity: 0.6 }]}
              onPress={handleAddExistingMember}
              disabled={!addMemberUserId || isAddingMember}
            >
              {isAddingMember ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Add to Project</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Invite Modal */}
      <Modal visible={isInviteOpen} animationType="slide" transparent onRequestClose={() => setIsInviteOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Create Project Member</Text>
              <TouchableOpacity onPress={() => setIsInviteOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>First Name *</Text>
                  <TextInput style={s.input} placeholderTextColor="#94A3B8" value={inviteForm.firstName} onChangeText={(v) => setInviteForm({ ...inviteForm, firstName: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Last Name *</Text>
                  <TextInput style={s.input} placeholderTextColor="#94A3B8" value={inviteForm.lastName} onChangeText={(v) => setInviteForm({ ...inviteForm, lastName: v })} />
                </View>
              </View>

              <Text style={s.label}>Email Address *</Text>
              <TextInput style={s.input} placeholder="user@example.com" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" value={inviteForm.email} onChangeText={(v) => setInviteForm({ ...inviteForm, email: v })} />

              <Text style={s.label}>Temporary Password (optional)</Text>
              <TextInput style={s.input} placeholder="Leave blank to use welcome123" placeholderTextColor="#94A3B8" secureTextEntry value={inviteForm.password} onChangeText={(v) => setInviteForm({ ...inviteForm, password: v })} />

              <Text style={s.label}>Project Role *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.roleScroll} contentContainerStyle={s.roleScrollContent}>
                {orgRoles.map((r) => {
                  const active = (inviteForm.roleId || viewerRoleId) === r._id;
                  return (
                    <TouchableOpacity key={r._id} style={[s.chip, active && s.chipActive]} onPress={() => setInviteForm({ ...inviteForm, roleId: r._id })}>
                      <Text style={[s.chipText, active && s.chipTextActive]}>{r.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={s.hintText}>The member gets this role&apos;s permissions. Customize afterwards via Settings.</Text>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Designation</Text>
                  <TextInput style={s.input} placeholder="e.g. Lead Architect" placeholderTextColor="#94A3B8" value={inviteForm.designation} onChangeText={(v) => setInviteForm({ ...inviteForm, designation: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Department</Text>
                  <TextInput style={s.input} placeholder="e.g. Engineering" placeholderTextColor="#94A3B8" value={inviteForm.department} onChangeText={(v) => setInviteForm({ ...inviteForm, department: v })} />
                </View>
              </View>

              <TouchableOpacity style={[s.saveBtn, inviting && { opacity: 0.7 }]} onPress={handleInvite} disabled={inviting}>
                {inviting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Create User</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Permissions Modal */}
      <Modal visible={!!permMember} animationType="slide" transparent onRequestClose={closePermissions}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={[s.modalCard, { height: '88%', maxHeight: '90%' }]}>
            {permMember && (
              <>
                <View style={s.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>{permMember.userId?.firstName?.[0]}{permMember.userId?.lastName?.[0]}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.modalTitle} numberOfLines={1}>{permMember.userId?.firstName} {permMember.userId?.lastName}</Text>
                      <Text style={s.memberEmail} numberOfLines={1}>{permMember.userId?.email}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={closePermissions}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={s.label}>Project Role</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.roleScroll} contentContainerStyle={s.roleScrollContent}>
                  {orgRoles.map((r) => (
                    <TouchableOpacity key={r._id} style={[s.chip, permMode === 'role' && editedRole === r._id && s.chipActive]} onPress={() => handleRoleChange(r._id)}>
                      <Text style={[s.chipText, permMode === 'role' && editedRole === r._id && s.chipTextActive]}>{r.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {permMode === 'custom' ? (
                  <Text style={s.roleChangedTag}>Custom permissions (this member only)</Text>
                ) : editedRole !== memberRoleId(permMember) ? (
                  <Text style={s.roleChangedTag}>Role changed</Text>
                ) : null}

                <Text style={[s.label, { marginTop: 14 }]}>Module Permissions</Text>
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginBottom: 8 }}>
                  {PROJECT_MODULES.map((mod) => {
                    const offered = moduleActions(mod.module);
                    const activeCount = offered.filter((a) => hasAction(mod.module, a) || hasAction(mod.module, 'manage')).length;
                    const expanded = expandedModule === mod.module;
                    return (
                      <View key={mod.module} style={s.moduleRow}>
                        <TouchableOpacity style={s.moduleHeaderRow} onPress={() => setExpandedModule(expanded ? null : mod.module)}>
                          <Text style={s.moduleLabel}>{mod.label}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {activeCount > 0 && (
                              <View style={s.moduleCountBadge}>
                                <Text style={s.moduleCountText}>{activeCount}</Text>
                              </View>
                            )}
                            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
                          </View>
                        </TouchableOpacity>
                        {expanded && (
                          <View style={s.actionChipsRow}>
                            {offered.map((action) => {
                              const active = hasAction(mod.module, action) || hasAction(mod.module, 'manage');
                              return (
                                <TouchableOpacity key={action} style={[s.actionChip, active && s.actionChipActive]} onPress={() => toggleAction(mod.module, action)}>
                                  {active && <Ionicons name="checkmark" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />}
                                  <Text style={[s.actionChipText, active && s.actionChipTextActive]}>{ACTION_LABEL[action] || action}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>

                <View style={s.permFooter}>
                  <Text style={s.permFooterText}>{totalPerms} total permissions across {editedPermissions.length} modules</Text>
                  <TouchableOpacity style={[s.saveBtn, { marginTop: 10 }, savingPerms && { opacity: 0.7 }]} onPress={savePermissions} disabled={savingPerms}>
                    {savingPerms ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Save Permissions</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  scroll: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },
  countText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },

  memberCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 10 },
  memberTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  memberName: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  memberEmail: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  memberDesignation: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  memberBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  roleBadgeText: { fontSize: 10.5, fontFamily: 'Inter-Bold' },
  permCountBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  permCountText: { fontSize: 9.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  fabGroup: { position: 'absolute', right: 20, bottom: 30, alignItems: 'center', gap: 12 },
  fab: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabSecondary: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },

  searchRow2: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, height: 40,
  },
  orgUserRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
  },
  orgUserRowActive: { backgroundColor: '#EFF6FF', borderRadius: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },
  hintText: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginBottom: 4 },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    flexShrink: 0,
  },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B', includeFontPadding: false },
  chipTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },
  roleScroll: { flexGrow: 0, flexShrink: 0, marginVertical: 4 },
  roleScrollContent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingRight: 10 },

  roleChangedTag: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#D97706', backgroundColor: '#FFFBEB', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 6 },

  moduleRow: { borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  moduleHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11 },
  moduleLabel: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  moduleCountBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  moduleCountText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#2563EB' },
  actionChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 12 },
  actionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  actionChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  actionChipText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#64748B', textTransform: 'capitalize' },
  actionChipTextActive: { color: '#FFFFFF' },

  permFooter: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },
  permFooterText: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

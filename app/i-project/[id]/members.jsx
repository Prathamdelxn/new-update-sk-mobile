import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const ROLE_META = {
  project_manager: { label: 'Project Manager', color: '#2563EB', bg: '#EFF6FF' },
  site_engineer: { label: 'Site Engineer', color: '#D97706', bg: '#FFFBEB' },
  quantity_surveyor: { label: 'Quantity Surveyor', color: '#16A34A', bg: '#F0FDF4' },
  designer: { label: 'Designer', color: '#7C3AED', bg: '#F5F3FF' },
  sub_contractor: { label: 'Sub Contractor', color: '#E11D48', bg: '#FFF1F2' },
  client_representative: { label: 'Client Rep', color: '#4F46E5', bg: '#EEF2FF' },
  viewer: { label: 'Viewer', color: '#64748B', bg: '#F8FAFC' },
};
const ALL_ROLES = ['viewer', 'sub_contractor', 'designer', 'quantity_surveyor', 'site_engineer', 'client_representative', 'project_manager'];

const PROJECT_MODULES = [
  { module: 'projects', label: 'Project Config' },
  { module: 'wbs', label: 'WBS Hierarchy' },
  { module: 'tasks', label: 'Tasks' },
  { module: 'milestones', label: 'Milestones' },
  { module: 'dpr', label: 'Daily Progress Report' },
  { module: 'weekly_reports', label: 'Weekly Reports' },
  { module: 'procurement', label: 'Procurement' },
  { module: 'purchase_orders', label: 'Purchase Orders' },
  { module: 'vendors', label: 'Vendors' },
  { module: 'drawings', label: 'Drawings' },
  { module: 'rfis', label: 'RFIs' },
  { module: 'mom', label: 'Minutes of Meeting' },
  { module: 'risks', label: 'Risks' },
  { module: 'snags', label: 'Snags' },
  { module: 'ncrs', label: 'NCRs' },
  { module: 'utilities', label: 'Utilities' },
  { module: 'photos', label: 'Site Photos' },
  { module: 'handover', label: 'Handover' },
  { module: 'users', label: 'Team / Members' },
  { module: 'filemgt', label: 'File Management' },
];
const PERMISSION_ACTIONS = ['create', 'read', 'update', 'delete', 'approve', 'export', 'manage'];

const emptyInvite = { firstName: '', lastName: '', email: '', password: '', projectRole: 'viewer', designation: '', department: '' };

export default function InteriorMembersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState(emptyInvite);

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

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.userId?.firstName?.toLowerCase().includes(q) ||
      m.userId?.lastName?.toLowerCase().includes(q) ||
      m.userId?.email?.toLowerCase().includes(q) ||
      m.projectRole?.toLowerCase().includes(q)
    );
  });

  const handleInvite = async () => {
    if (!inviteForm.firstName || !inviteForm.lastName || !inviteForm.email || !inviteForm.password) {
      showToast('Please fill all required fields', 'error');
      return;
    }
    setInviting(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/members/invite`, inviteForm);
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
    setPermMember(member);
    setEditedPermissions(JSON.parse(JSON.stringify(member.permissions || [])));
    setEditedRole(member.projectRole);
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
    setEditedPermissions((prev) => {
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
    });
  };

  const savePermissions = async () => {
    if (!permMember) return;
    setSavingPerms(true);
    try {
      const payload = { permissions: editedPermissions };
      if (editedRole !== permMember.projectRole) payload.projectRole = editedRole;
      await interiorApiClient.patch(`/projects/${projectId}/members/${permMember._id}`, payload);
      showToast('Permissions updated successfully', 'success');
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
                const role = ROLE_META[member.projectRole] || ROLE_META.viewer;
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
                        <TouchableOpacity onPress={() => openPermissions(member)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="settings-outline" size={17} color="#94A3B8" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDelete(member)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={s.memberBottomRow}>
                      <View style={[s.roleBadge, { backgroundColor: role.bg }]}>
                        <Text style={[s.roleBadgeText, { color: role.color }]}>{role.label}</Text>
                      </View>
                      <TouchableOpacity style={s.permCountBtn} onPress={() => openPermissions(member)}>
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

        <TouchableOpacity style={s.fab} onPress={() => setIsInviteOpen(true)}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

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

              <Text style={s.label}>Temporary Password *</Text>
              <TextInput style={s.input} placeholder="At least 8 characters" placeholderTextColor="#94A3B8" secureTextEntry value={inviteForm.password} onChangeText={(v) => setInviteForm({ ...inviteForm, password: v })} />

              <Text style={s.label}>Project Role *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 4 }}>
                {ALL_ROLES.map((r) => (
                  <TouchableOpacity key={r} style={[s.chip, inviteForm.projectRole === r && s.chipActive]} onPress={() => setInviteForm({ ...inviteForm, projectRole: r })}>
                    <Text style={[s.chipText, inviteForm.projectRole === r && s.chipTextActive]}>{ROLE_META[r].label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.hintText}>Default permissions will be auto-assigned. Customize afterwards via Settings.</Text>

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
          <View style={[s.modalCard, { maxHeight: '90%' }]}>
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 4 }}>
                  {ALL_ROLES.map((r) => (
                    <TouchableOpacity key={r} style={[s.chip, editedRole === r && s.chipActive]} onPress={() => setEditedRole(r)}>
                      <Text style={[s.chipText, editedRole === r && s.chipTextActive]}>{ROLE_META[r].label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {editedRole !== permMember.projectRole && <Text style={s.roleChangedTag}>Role changed</Text>}

                <Text style={[s.label, { marginTop: 14 }]}>Module Permissions</Text>
                <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {PROJECT_MODULES.map((mod) => {
                    const activeCount = PERMISSION_ACTIONS.filter((a) => hasAction(mod.module, a)).length;
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
                            {PERMISSION_ACTIONS.map((action) => {
                              const active = hasAction(mod.module, action);
                              return (
                                <TouchableOpacity key={action} style={[s.actionChip, active && s.actionChipActive]} onPress={() => toggleAction(mod.module, action)}>
                                  {active && <Ionicons name="checkmark" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />}
                                  <Text style={[s.actionChipText, active && s.actionChipTextActive]}>{action}</Text>
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

  fab: {
    position: 'absolute', right: 20, bottom: 30,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

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

  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  chipTextActive: { color: '#2563EB' },

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

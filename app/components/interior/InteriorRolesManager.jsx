// =============================================================================
// Interior — Roles & Permissions manager (live roles, editable)
// Same rules as the web Roles tab (InteriorRolesManager.tsx):
//  - roles come from GET /roles; admins, or users with Roles → Create / Update /
//    Delete, can manage them (the API enforces the same rules)
//  - the Admin role is locked; built-in roles can't be renamed or deleted
//  - any action also turns on View; any project module turns on Project Config → View
//  - modules only offer the actions they use; "Full" ticks all of them
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import interiorApiClient from '../../services/interiorApiClient';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useInteriorPermissions } from '../../utils/interior/useInteriorPermissions';
import {
  PERMISSION_ACTIONS, PERMISSION_MODULES, MODULE_CATEGORIES, moduleActions,
} from '../../utils/interior/permissionCatalog';

const ACTION_COLORS = {
  read: '#2563EB', create: '#059669', update: '#D97706', delete: '#DC2626', approve: '#7C3AED', export: '#0D9488',
};
const PROJECT_MODULE_KEYS = PERMISSION_MODULES
  .filter((m) => m.category === 'Project Execution' && m.key !== 'projects')
  .map((m) => m.key);

// 'manage' (= every action) shows as all of the module's actions
const actionsOf = (moduleKey, actions = []) => {
  const offered = moduleActions(moduleKey);
  return actions.includes('manage') ? [...offered] : offered.filter((a) => actions.includes(a));
};
const toMatrix = (perms = []) => {
  const m = {};
  perms.forEach((p) => { m[p.module] = actionsOf(p.module, p.actions); });
  return m;
};
const fromMatrix = (m) =>
  Object.entries(m)
    .filter(([, list]) => list.length > 0)
    .map(([module, list]) => ({ module, actions: PERMISSION_ACTIONS.map((a) => a.key).filter((a) => list.includes(a)) }));
// Opening a project needs Project Config → View, so any project module keeps it on
const withProjectView = (m) => {
  const needs = PROJECT_MODULE_KEYS.some((k) => (m[k] || []).length > 0);
  if (!needs || (m.projects || []).includes('read')) return m;
  return { ...m, projects: [...(m.projects || []), 'read'] };
};

const isAdminRole = (r) => r.slug === 'admin';

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
function RoleEditor({ role, visible, onClose, onSaved }) {
  const { showToast } = useToast();
  const isEdit = !!role;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [matrix, setMatrix] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setMatrix(toMatrix(role?.permissions));
  }, [visible, role]);

  const has = (m, a) => (matrix[m] || []).includes(a);
  const toggle = (m, a) =>
    setMatrix((prev) => {
      const cur = prev[m] || [];
      let next;
      if (cur.includes(a)) {
        next = cur.filter((x) => x !== a);
        if (a === 'read') next = []; // without View nothing else in the module is usable
      } else {
        next = [...cur, a];
        if (a !== 'read' && !next.includes('read')) next.push('read'); // any action implies View
      }
      return withProjectView({ ...prev, [m]: next });
    });
  const toggleFull = (m) =>
    setMatrix((prev) => {
      const offered = moduleActions(m);
      const full = (prev[m] || []).length === offered.length;
      return withProjectView({ ...prev, [m]: full ? [] : [...offered] });
    });
  const applyPreset = (preset) => {
    const next = {};
    PERMISSION_MODULES.forEach((mod) => {
      next[mod.key] = preset === 'full' ? [...moduleActions(mod.key)] : preset === 'read' ? ['read'] : [];
    });
    setMatrix(withProjectView(next));
  };
  const enabledModules = PERMISSION_MODULES.filter((m) => (matrix[m.key] || []).length > 0).length;

  const handleSave = async () => {
    if (!name.trim()) return showToast('Role name is required', 'error');
    setSaving(true);
    try {
      const permissions = fromMatrix(matrix);
      if (isEdit) {
        await interiorApiClient.patch(`/roles/${role._id}`, {
          ...(role.isSystem ? {} : { name: name.trim() }),
          description: description.trim(),
          permissions,
        });
        showToast('Role updated', 'success');
      } else {
        await interiorApiClient.post('/roles', { name: name.trim(), description: description.trim(), permissions });
        showToast('Role created', 'success');
      }
      onSaved();
      onClose();
    } catch (e) {
      showToast(e.message || 'Failed to save role', 'error'); // the server's reason
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle}>{isEdit ? 'Edit Role' : 'New Role'}</Text>
              <Text style={s.sheetSub}>{enabledModules} of {PERMISSION_MODULES.length} modules enabled</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Role name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              editable={!(isEdit && role.isSystem)}
              placeholder="e.g. Site Supervisor"
              placeholderTextColor="#94A3B8"
              style={[s.input, isEdit && role.isSystem && { opacity: 0.6 }]}
            />
            {isEdit && role.isSystem && <Text style={s.hint}>Built-in roles can&apos;t be renamed.</Text>}
            <Text style={[s.label, { marginTop: 12 }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What this role is for"
              placeholderTextColor="#94A3B8"
              style={s.input}
            />

            <View style={s.presetRow}>
              <TouchableOpacity style={s.presetBtn} onPress={() => applyPreset('read')}><Text style={s.presetText}>Read Only</Text></TouchableOpacity>
              <TouchableOpacity style={[s.presetBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]} onPress={() => applyPreset('full')}><Text style={[s.presetText, { color: '#2563EB' }]}>Full Access</Text></TouchableOpacity>
              <TouchableOpacity style={[s.presetBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]} onPress={() => applyPreset('clear')}><Text style={[s.presetText, { color: '#DC2626' }]}>Clear All</Text></TouchableOpacity>
            </View>

            {MODULE_CATEGORIES.map((category) => (
              <View key={category} style={s.categoryBox}>
                <Text style={s.categoryTitle}>{category}</Text>
                {category === 'Project Execution' && (
                  <Text style={s.categoryHint}>Project Config → View is turned on automatically with any project module — it&apos;s needed to open a project.</Text>
                )}
                {PERMISSION_MODULES.filter((m) => m.category === category).map((mod) => {
                  const offered = moduleActions(mod.key);
                  const count = (matrix[mod.key] || []).length;
                  const full = count === offered.length;
                  return (
                    <View key={mod.key} style={s.moduleRow}>
                      <View style={s.moduleHead}>
                        <Text style={s.moduleLabel}>{mod.label}</Text>
                        <TouchableOpacity
                          style={[s.fullChip, full && s.fullChipOn, count > 0 && !full && s.fullChipPartial]}
                          onPress={() => toggleFull(mod.key)}
                        >
                          <Text style={[s.fullChipText, (full || count > 0) && { color: full ? '#FFFFFF' : '#2563EB' }]}>Full</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={s.actionWrap}>
                        {PERMISSION_ACTIONS.filter((a) => offered.includes(a.key)).map((a) => {
                          const on = has(mod.key, a.key);
                          return (
                            <TouchableOpacity
                              key={a.key}
                              onPress={() => toggle(mod.key, a.key)}
                              style={[s.actionChip, on && { backgroundColor: ACTION_COLORS[a.key], borderColor: ACTION_COLORS[a.key] }]}
                            >
                              <Text style={[s.actionChipText, on && { color: '#FFFFFF' }]}>{a.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View style={s.sheetFooter}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveText}>{isEdit ? 'Save Changes' : 'Create Role'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
export default function InteriorRolesManager() {
  const { showToast } = useToast();
  const { refreshUser } = useAuth();
  const { isOrgAdmin, hasPermission } = useInteriorPermissions();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, role = edit

  const canCreate = isOrgAdmin || hasPermission('roles', 'create');
  const canUpdate = isOrgAdmin || hasPermission('roles', 'update');
  const canDelete = isOrgAdmin || hasPermission('roles', 'delete');

  const loadRoles = useCallback(async () => {
    try {
      const res = await interiorApiClient.get('/roles');
      const raw = res?.data ?? res ?? [];
      setRoles(Array.isArray(raw) ? raw : []);
    } catch (e) {
      showToast(e.message || 'Failed to load roles', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const onChanged = () => {
    loadRoles();
    refreshUser?.(); // the user's own role may have changed
  };

  const confirmDelete = (role) =>
    Alert.alert('Delete role', `Delete the "${role.name}" role? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await interiorApiClient.delete(`/roles/${role._id}`);
            showToast('Role deleted', 'success');
            onChanged();
          } catch (e) {
            showToast(e.message || 'Failed to delete role', 'error');
          }
        },
      },
    ]);

  const sorted = useMemo(() => [...roles].sort((a, b) => (isAdminRole(b) ? 1 : 0) - (isAdminRole(a) ? 1 : 0)), [roles]);

  if (loading) {
    return <View style={{ paddingVertical: 40 }}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <View>
      {canCreate && (
        <TouchableOpacity style={s.newRoleBtn} onPress={() => setEditing(null)}>
          <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
          <Text style={s.newRoleText}>New Role</Text>
        </TouchableOpacity>
      )}

      {sorted.map((role) => {
        const locked = isAdminRole(role);
        const isOpen = expanded === role._id;
        const withAccess = PERMISSION_MODULES.filter((m) => locked || actionsOf(m.key, (role.permissions || []).find((p) => p.module === m.key)?.actions).length > 0).length;
        return (
          <View key={role._id} style={s.roleCard}>
            <TouchableOpacity style={s.roleHeader} onPress={() => setExpanded(isOpen ? null : role._id)}>
              <View style={s.roleIcon}>
                <Ionicons name={locked ? 'lock-closed-outline' : 'shield-outline'} size={17} color={locked ? '#E11D48' : '#64748B'} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.roleTitle} numberOfLines={1}>{role.name}</Text>
                <Text style={s.roleDesc} numberOfLines={1}>{locked ? 'Full access — locked' : role.description || (role.isSystem ? 'Built-in role' : 'Custom role')}</Text>
              </View>
              <Text style={s.roleCount}>{withAccess}/{PERMISSION_MODULES.length}</Text>
              {canUpdate && !locked && (
                <TouchableOpacity onPress={() => setEditing(role)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="create-outline" size={18} color="#2563EB" />
                </TouchableOpacity>
              )}
              {canDelete && !role.isSystem && (
                <TouchableOpacity onPress={() => confirmDelete(role)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                </TouchableOpacity>
              )}
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
            </TouchableOpacity>

            {isOpen && (
              <View style={s.matrixBox}>
                {PERMISSION_MODULES.map((m) => {
                  const actions = locked ? moduleActions(m.key) : actionsOf(m.key, (role.permissions || []).find((p) => p.module === m.key)?.actions);
                  const full = actions.length === moduleActions(m.key).length;
                  return (
                    <View key={m.key} style={s.matrixRow}>
                      <Ionicons name={actions.length ? 'checkmark-circle' : 'remove-circle-outline'} size={13} color={actions.length ? '#059669' : '#CBD5E1'} />
                      <Text style={[s.matrixLabel, !actions.length && { opacity: 0.4 }]} numberOfLines={1}>{m.label}</Text>
                      <View style={s.matrixActions}>
                        {full ? (
                          <Text style={s.fullBadge}>Full</Text>
                        ) : actions.length ? (
                          actions.map((a) => (
                            <Text key={a} style={[s.actionBadge, { color: ACTION_COLORS[a], borderColor: ACTION_COLORS[a] }]}>
                              {PERMISSION_ACTIONS.find((x) => x.key === a)?.short}
                            </Text>
                          ))
                        ) : (
                          <Text style={s.noAccess}>—</Text>
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

      <RoleEditor
        visible={editing !== undefined}
        role={editing || null}
        onClose={() => setEditing(undefined)}
        onSaved={onChanged}
      />
    </View>
  );
}

const s = StyleSheet.create({
  newRoleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  newRoleText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#2563EB' },
  roleCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 10, overflow: 'hidden' },
  roleHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  roleIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  roleTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  roleDesc: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },
  roleCount: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  matrixBox: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 8 },
  matrixRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
  matrixLabel: { width: 130, fontSize: 12, fontFamily: 'Inter-Medium', color: '#334155' },
  matrixActions: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  actionBadge: { fontSize: 9.5, fontFamily: 'Inter-Bold', borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  fullBadge: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#047857', backgroundColor: '#ECFDF5', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  noAccess: { fontSize: 11, color: '#CBD5E1' },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sheetTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  sheetSub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  label: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#475569', marginBottom: 6 },
  hint: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter-Regular', color: '#0F172A', backgroundColor: '#F8FAFC' },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 6 },
  presetBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  presetText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#475569' },
  categoryBox: { marginTop: 14, borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 14, padding: 12 },
  categoryTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  categoryHint: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 3 },
  moduleRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  moduleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  moduleLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#334155', flex: 1 },
  fullChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#CBD5E1' },
  fullChipOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  fullChipPartial: { borderColor: '#93C5FD', backgroundColor: '#EFF6FF' },
  fullChipText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#64748B' },
  actionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  actionChipText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#475569' },
  sheetFooter: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F1F5F9' },
  cancelText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#475569' },
  saveBtn: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#2563EB' },
  saveText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

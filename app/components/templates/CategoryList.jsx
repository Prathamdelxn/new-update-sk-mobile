import { tr } from '../../utils/i18n/tr';
// Construction Templates → Categories tab (same as the web construction-dashboard CategoryList):
// search, add, inline rename and delete of template categories.

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, FlatList, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { hasAnyRolePermission } from '../../utils/permissions';
import SkeletonList from '../common/SkeletonList';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const templateCategoryId = (tpl) => (typeof tpl.category === 'object' ? tpl.category?._id : tpl.category);

/**
 * @param categories  categories from the Templates screen (without the "All" chip)
 * @param templates   loaded templates, used for the per-category count
 * @param loading     categories still loading
 * @param onChanged   reload categories (and templates, after a delete) on the parent
 */
export default function CategoryList({ categories, templates, loading, onChanged }) {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  // Category Management is org-wide: the global role or any project role counts
  const canCreate = hasAnyRolePermission(user, 'category:create');
  const canUpdate = hasAnyRolePermission(user, 'category:update');
  const canDelete = hasAnyRolePermission(user, 'category:delete');

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [lastAdded, setLastAdded] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const call = async (path, method, body) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || '');
    return data;
  };

  const counts = useMemo(() => {
    const map = {};
    (templates || []).forEach((tpl) => {
      const id = templateCategoryId(tpl);
      if (id) map[id] = (map[id] || 0) + 1;
    });
    return map;
  }, [templates]);

  const filtered = useMemo(
    () => (categories || []).filter((c) => (c.name || '').toLowerCase().includes(search.toLowerCase())),
    [categories, search]
  );

  const newNameTrimmed = newName.trim();
  const alreadyExists = (categories || []).some((c) => (c.name || '').toLowerCase() === newNameTrimmed.toLowerCase());

  const handleCreate = async () => {
    if (!newNameTrimmed || alreadyExists) return;
    setIsCreating(true);
    try {
      await call('/template-categories', 'POST', { name: newNameTrimmed });
      setNewName('');
      setShowCreate(false);
      Keyboard.dismiss();
      setLastAdded(newNameTrimmed);
      setTimeout(() => setLastAdded(null), 3000);
      onChanged?.();
    } catch (e) {
      showToast(e.message || tr("Failed to create category"), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editingName.trim()) return;
    setIsUpdating(true);
    try {
      await call(`/template-categories/${id}`, 'PATCH', { name: editingName.trim() });
      showToast(tr("Category updated"), 'success');
      setEditingId(null);
      Keyboard.dismiss();
      onChanged?.();
    } catch (e) {
      showToast(e.message || tr("Failed to update"), 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = (cat) => {
    Alert.alert(tr("Delete Category"), tr("Are you sure? This will delete all templates associated with this category."), [
      { text: tr("Cancel"), style: 'cancel' },
      {
        text: tr("Delete Category"),
        style: 'destructive',
        onPress: async () => {
          try {
            await call(`/template-categories/${cat._id}`, 'DELETE');
            showToast(tr("Category deleted"), 'success');
            onChanged?.({ templatesToo: true, deletedId: cat._id });
          } catch (e) {
            showToast(e.message || tr("Failed to delete category"), 'error');
          }
        },
      },
    ]);
  };

  const startEditing = (cat) => {
    setEditingId(cat._id);
    setEditingName(cat.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const renderItem = ({ item: cat }) => {
    const isEditing = editingId === cat._id;
    const count = counts[cat._id] || 0;
    return (
      <View style={s.row}>
        <View style={s.rowIcon}>
          <Ionicons name="folder-outline" size={18} color="#2563EB" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <TextInput
              style={s.editInput}
              value={editingName}
              onChangeText={setEditingName}
              autoFocus
              maxLength={100}
              returnKeyType="done"
              onSubmitEditing={() => handleUpdate(cat._id)}
            />
          ) : (
            <Text style={s.rowName} numberOfLines={2}>{tr(cat.name)}</Text>
          )}
          <Text style={s.rowMeta}>{count} {count === 1 ? tr("Template") : tr("Templates")}</Text>
        </View>

        {isEditing ? (
          <View style={s.actions}>
            <TouchableOpacity style={[s.iconBtn, s.iconBtnPrimary]} onPress={() => handleUpdate(cat._id)} disabled={isUpdating || !editingName.trim()}>
              {isUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={cancelEditing}>
              <Ionicons name="close" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.actions}>
            {canUpdate && (
              <TouchableOpacity style={s.iconBtn} onPress={() => startEditing(cat)} accessibilityLabel={tr("Edit Category")}>
                <Ionicons name="create-outline" size={16} color="#2563EB" />
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity style={[s.iconBtn, s.iconBtnDanger]} onPress={() => handleDelete(cat)} accessibilityLabel={tr("Delete Category")}>
                <Ionicons name="trash-outline" size={16} color="#E11D48" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            style={s.searchInput}
            placeholder={tr("Search categories by name...")}
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
        {canCreate && (
          <TouchableOpacity style={s.newBtn} onPress={() => { setShowCreate(true); setNewName(''); }} activeOpacity={0.85}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={s.newBtnText}>{tr("New Category")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {showCreate && (
        <View style={s.createCard}>
          <TextInput
            style={s.createInput}
            placeholder={tr("Enter category name (e.g. Residential Villa, Commercial Fit-Out)...")}
            placeholderTextColor="#94A3B8"
            value={newName}
            onChangeText={setNewName}
            autoFocus
            maxLength={100}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          {!!newNameTrimmed && alreadyExists && (
            <View style={s.warnRow}>
              <Ionicons name="warning-outline" size={14} color="#D97706" />
              <Text style={s.warnText}>{tr("Category already exists")}</Text>
            </View>
          )}
          <View style={s.createActions}>
            <TouchableOpacity
              style={[s.saveBtn, (isCreating || !newNameTrimmed || alreadyExists) && { opacity: 0.4 }]}
              onPress={handleCreate}
              disabled={isCreating || !newNameTrimmed || alreadyExists}
            >
              {isCreating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
              <Text style={s.saveBtnText}>{tr("Save")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowCreate(false); setNewName(''); }}>
              <Ionicons name="close" size={15} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!!lastAdded && (
        <View style={s.addedBanner}>
          <Ionicons name="checkmark-circle" size={15} color="#059669" />
          <Text style={s.addedText}>
            {tr("Category ")}<Text style={{ fontFamily: 'Inter-Bold', color: '#065F46' }}>&quot;{tr(lastAdded)}&quot;</Text>{tr(" added successfully")}
          </Text>
        </View>
      )}

      {loading && (categories || []).length === 0 ? (
        <SkeletonList variant="rows" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c._id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshing={!!loading}
          onRefresh={() => onChanged?.()}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="folder-open-outline" size={24} color="#94A3B8" />
              </View>
              <Text style={s.emptyTitle}>{search ? tr("No categories found") : tr("No categories created yet")}</Text>
              <Text style={s.emptySub}>
                {search
                  ? tr("No categories match \"{{search}}\". Try searching for another keyword.", { search: search })
                  : tr("Organize your templates by creating your first template category.")}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  center: { paddingVertical: 60, alignItems: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A', paddingVertical: 0 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#2563EB' },
  newBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  createCard: { marginHorizontal: 20, marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFDBFE' },
  createInput: { height: 42, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  warnText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#D97706' },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#2563EB' },
  saveBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  cancelBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },

  addedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  addedText: { flex: 1, fontSize: 12, fontFamily: 'Inter-Medium', color: '#047857' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  rowIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  rowMeta: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },
  editInput: { height: 38, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#2563EB', fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  actions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  iconBtnPrimary: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  iconBtnDanger: { borderColor: '#FECDD3', backgroundColor: '#FFF1F2' },

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1E293B', textAlign: 'center' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center', marginTop: 4, lineHeight: 18 },
});

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import ConfirmModal from '../../components/ConfirmModal';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const CATEGORIES = ['Furniture', 'Fixture', 'Equipment', 'Appliance', 'Lighting', 'Decor', 'Sanitary', 'Other'];
const STATUSES = ['Planned', 'Ordered', 'Delivered', 'Installed', 'Rejected'];

const STATUS_COLOR = {
  Planned:   { bg: '#F1F5F9', text: '#64748B' },
  Ordered:   { bg: '#DBEAFE', text: '#2563EB' },
  Delivered: { bg: '#FEF3C7', text: '#D97706' },
  Installed: { bg: '#D1FAE5', text: '#059669' },
  Rejected:  { bg: '#FEE2E2', text: '#DC2626' },
};

const CATEGORY_ICON = {
  Furniture: 'chair',
  Fixture:   'wb-incandescent',
  Equipment: 'build',
  Appliance: 'kitchen',
  Lighting:  'lightbulb-outline',
  Decor:     'palette',
  Sanitary:  'shower',
  Other:     'category',
};

const EMPTY_FORM = {
  name: '', category: 'Other', quantity: '1', unit: 'nos',
  unitCost: '', status: 'Planned', brand: '', modelNo: '',
  supplier: '', finish: '', colorCode: '', dimensions: '', notes: '', room: '',
};

const formatCost = (n, currency = '$') => {
  if (!n) return `${currency} 0`;
  if (n >= 1000000) return `${currency} ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${currency} ${(n / 1000).toFixed(1)}k`;
  return `${currency} ${n}`;
};

export default function ProjectFFETab({ projectId, project }) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [summary, setSummary] = useState({ totalCost: 0, byStatus: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ visible: false, item: null });
  const [detailItem, setDetailItem] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [ffeRes, roomsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/projects/${projectId}/ffe`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/projects/${projectId}/rooms`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const ffeData = await ffeRes.json();
      const roomsData = await roomsRes.json();
      if (ffeRes.ok) {
        setItems(ffeData.items || []);
        setSummary({ totalCost: ffeData.totalCost || 0, byStatus: ffeData.byStatus || {} });
      }
      if (roomsRes.ok) setRooms(roomsData);
    } catch {
      showToast(t('networkErrorLoadingFFE'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasPermission = useCallback((moduleId, action) => {
    if (user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*')) return true;
    if (!project) return false;
    
    let myRole = project.myRole;
    if (!myRole && project.members) {
      const currentUserId = user?.id || user?._id;
      const member = project.members.find(m => m.user?._id === currentUserId || m.user === currentUserId);
      if (member && member.role) myRole = member.role;
    }
    
    if (!myRole) return false;
    if (myRole.name === 'Admin' || myRole.permissions?.includes('*')) return true;
    return myRole.permissions?.includes(`${moduleId}:${action}`);
  }, [project, user]);

  const openAddModal = () => { setEditingItem(null); setForm(EMPTY_FORM); setModalVisible(true); };

  const openEditModal = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name, category: item.category,
      quantity: String(item.quantity ?? 1), unit: item.unit || 'nos',
      unitCost: item.unitCost != null ? String(item.unitCost) : '',
      status: item.status, brand: item.brand || '', modelNo: item.modelNo || '',
      supplier: item.supplier || '', finish: item.finish || '',
      colorCode: item.colorCode || '', dimensions: item.dimensions || '',
      notes: item.notes || '', room: item.room?._id || item.room || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Item name is required', 'error'); return; }
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(), category: form.category,
        quantity: parseFloat(form.quantity) || 1, unit: form.unit || 'nos',
        unitCost: parseFloat(form.unitCost) || 0, status: form.status,
        brand: form.brand || undefined, modelNo: form.modelNo || undefined,
        supplier: form.supplier || undefined, finish: form.finish || undefined,
        colorCode: form.colorCode || undefined, dimensions: form.dimensions || undefined,
        notes: form.notes || undefined, room: form.room || null,
      };
      const url = editingItem
        ? `${API_BASE_URL}/projects/${projectId}/ffe/${editingItem._id}`
        : `${API_BASE_URL}/projects/${projectId}/ffe`;
      const res = await fetch(url, {
        method: editingItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) { showToast(editingItem ? 'Item updated' : 'Item added', 'success'); setModalVisible(false); fetchData(); }
      else showToast(data.message || 'Failed to save item', 'error');
    } catch { showToast(t('networkError'), 'error'); }
    finally { setIsSubmitting(false); }
  };

  const confirmDelete = (item) => setConfirmModal({ visible: true, item });
  const handleDelete = async () => {
    const item = confirmModal.item;
    setConfirmModal({ visible: false, item: null });
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/ffe/${item._id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { showToast('Item deleted', 'success'); fetchData(); }
      else { const d = await res.json(); showToast(d.message || 'Failed to delete', 'error'); }
    } catch { showToast(t('networkError'), 'error'); }
  };

  const filteredItems = activeCategory === 'All' ? items : items.filter(i => i.category === activeCategory);
  const categoriesWithItems = ['All', ...CATEGORIES.filter(c => items.some(i => i.category === c))];
  const totalItems = items.length;
  const installedCount = summary.byStatus['Installed'] || 0;
  const overallProgress = totalItems ? Math.round((installedCount / totalItems) * 100) : 0;

  return (
    <View style={styles.container}>

      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>FFE</Text>
          <Text style={styles.sectionSubtitle}>{totalItems} items tracked</Text>
        </View>
        {hasPermission('ffe', 'create') && (
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={openAddModal}>
            <Feather name="plus" size={16} color="#FFF" />
            <Text style={styles.addBtnText}>Add FFE</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cost + Progress Banner */}
      <AdaptiveGlass intensity={20} tint="light" style={styles.costBanner}>
        <View style={styles.costTopRow}>
          <View style={styles.costMainBlock}>
            <Text style={styles.costLabel}>TOTAL FFE COST</Text>
            <Text style={styles.costValue}>{formatCost(summary.totalCost, project?.currency)}</Text>
          </View>
          <View style={styles.costProgressBlock}>
            <Text style={styles.progressPct}>{overallProgress}%</Text>
            <Text style={styles.progressLabel}>installed</Text>
          </View>
        </View>
        <View style={styles.costStatStrip}>
          {STATUSES.filter(s => (summary.byStatus[s] || 0) > 0).map(s => {
            const sc = STATUS_COLOR[s];
            return (
              <View key={s} style={[styles.costStatChip, { backgroundColor: sc.bg }]}>
                <Text style={[styles.costStatText, { color: sc.text }]}>{summary.byStatus[s]} {s}</Text>
              </View>
            );
          })}
          {totalItems === 0 && <Text style={styles.noItemsHint}>No items yet</Text>}
        </View>
        {totalItems > 0 && (
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${overallProgress}%`, backgroundColor: overallProgress === 100 ? '#059669' : '#3B82F6' }]} />
          </View>
        )}
      </AdaptiveGlass>

      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {categoriesWithItems.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.filterChip, activeCategory === c && styles.filterChipActive]}
            onPress={() => setActiveCategory(c)}
            activeOpacity={0.7}
          >
            {c !== 'All' && (
              <MaterialIcons
                name={CATEGORY_ICON[c] || 'category'}
                size={13}
                color={activeCategory === c ? '#FFFFFF' : '#64748B'}
              />
            )}
            <Text style={[styles.filterChipText, activeCategory === c && styles.filterChipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!hasPermission('ffe', 'view') ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
          <Feather name="lock" size={48} color="#CBD5E1" />
          <Text style={{ marginTop: 16, fontSize: 16, fontFamily: 'Inter-Medium', color: '#64748B' }}>
            You don't have permission to view FF&E.
          </Text>
        </View>
      ) : isLoading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color="#3B82F6" />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 72 }]}
          showsVerticalScrollIndicator={false}
        >
          {filteredItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <AdaptiveGlass intensity={20} tint="light" style={styles.emptyIconWrap}>
                <MaterialIcons name="chair" size={40} color="#93C5FD" />
              </AdaptiveGlass>
              <Text style={styles.emptyTitle}>No items yet</Text>
              <Text style={styles.emptySubtitle}>
                {activeCategory === 'All'
                  ? 'Add furniture, fixtures & equipment to track costs and installation status'
                  : `No ${activeCategory} items added yet`}
              </Text>
            </View>
          ) : (
            filteredItems.map(item => {
              const sc = STATUS_COLOR[item.status] || STATUS_COLOR['Planned'];
              const roomName = item.room?.name;
              return (
                <TouchableOpacity key={item._id} style={styles.itemCard} onPress={() => setDetailItem(item)} activeOpacity={0.85}>

                  {/* Top row: category + room, name, cost & status */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter-Bold', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.category}</Text>
                        {roomName && (
                          <>
                            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#CBD5E1' }} />
                            <Text style={{ fontSize: 11, fontFamily: 'Inter-Bold', color: '#94A3B8' }}>{roomName}</Text>
                          </>
                        )}
                      </View>
                      
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemCost}>{formatCost(item.totalCost || 0, project?.currency)}</Text>
                    </View>
                    
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusPillText, { color: sc.text }]}>{item.status}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Detail row */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailChip}>
                      <Ionicons name="layers-outline" size={12} color="#94A3B8" />
                      <Text style={styles.detailChipText}>Qty: {item.quantity} {item.unit}</Text>
                    </View>
                    <View style={styles.detailChip}>
                      <Ionicons name="pricetag-outline" size={12} color="#94A3B8" />
                      <Text style={styles.detailChipText}>{formatCost(item.unitCost || 0, project?.currency)} / unit</Text>
                    </View>
                    {item.brand && (
                      <View style={styles.detailChip}>
                        <Ionicons name="business-outline" size={12} color="#94A3B8" />
                        <Text style={styles.detailChipText}>{item.brand}</Text>
                      </View>
                    )}
                    {item.supplier && (
                      <View style={styles.detailChip}>
                        <Ionicons name="cube-outline" size={12} color="#94A3B8" />
                        <Text style={styles.detailChipText}>{item.supplier}</Text>
                      </View>
                    )}
                    {item.colorCode && (
                      <View style={[styles.detailChip, { backgroundColor: '#F8FAFC' }]}>
                        <View style={[styles.colorSwatch, { backgroundColor: item.colorCode }]} />
                        <Text style={styles.detailChipText}>{item.colorCode}</Text>
                      </View>
                    )}
                  </View>

                  {item.notes && (
                    <View style={styles.notesRow}>
                      <Ionicons name="document-text-outline" size={13} color="#94A3B8" />
                      <Text style={styles.notesText} numberOfLines={2}>{item.notes}</Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                    <TouchableOpacity style={styles.cardActionBtn} onPress={() => setDetailItem(item)} activeOpacity={0.7}>
                      <Feather name="eye" size={14} color="#64748B" />
                    </TouchableOpacity>
                    {hasPermission('ffe', 'update') && (
                      <TouchableOpacity style={styles.cardActionBtn} onPress={() => openEditModal(item)} activeOpacity={0.7}>
                        <Feather name="edit-2" size={14} color="#3B82F6" />
                      </TouchableOpacity>
                    )}
                    {hasPermission('ffe', 'delete') && (
                      <TouchableOpacity style={[styles.cardActionBtn, styles.deleteBtn]} onPress={() => confirmDelete(item)} activeOpacity={0.7}>
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}



      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <AdaptiveGlass intensity={60} tint="light" style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalPre}>{editingItem ? 'MODIFY ITEM' : 'NEW ITEM'}</Text>
                <Text style={styles.modalTitle}>{editingItem ? `Edit "${editingItem.name}"` : 'Add FFE Item'}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Item Name <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput style={styles.input} placeholder="e.g. Sofa Set" placeholderTextColor="#94A3B8" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} />
              </View>

              <View style={styles.fieldRow}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <TouchableOpacity style={[styles.input, styles.pickerInput]} onPress={() => setShowCatPicker(true)} activeOpacity={0.8}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <MaterialIcons name={CATEGORY_ICON[form.category] || 'category'} size={16} color="#3B82F6" />
                      <Text style={styles.pickerInputText}>{form.category}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Status</Text>
                  <TouchableOpacity style={[styles.input, styles.pickerInput]} onPress={() => setShowStatusPicker(true)} activeOpacity={0.8}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[form.status]?.text }]} />
                      <Text style={styles.pickerInputText}>{form.status}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Quantity</Text>
                  <TextInput style={styles.input} placeholder="1" placeholderTextColor="#94A3B8" keyboardType="numeric" value={form.quantity} onChangeText={v => setForm(f => ({ ...f, quantity: v }))} />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <TextInput style={styles.input} placeholder="nos" placeholderTextColor="#94A3B8" value={form.unit} onChangeText={v => setForm(f => ({ ...f, unit: v }))} />
                </View>
                <View style={[styles.field, { flex: 1.2 }]}>
                  <Text style={styles.fieldLabel}>Unit Cost ($)</Text>
                  <TextInput style={styles.input} placeholder="0" placeholderTextColor="#94A3B8" keyboardType="numeric" value={form.unitCost} onChangeText={v => setForm(f => ({ ...f, unitCost: v }))} />
                </View>
              </View>

              {rooms.length > 0 && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Assign to Room</Text>
                  <TouchableOpacity style={[styles.input, styles.pickerInput]} onPress={() => setShowRoomPicker(true)} activeOpacity={0.8}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <MaterialIcons name="meeting-room" size={16} color={form.room ? '#2563EB' : '#94A3B8'} />
                      <Text style={[styles.pickerInputText, !form.room && { color: '#94A3B8' }]}>
                        {rooms.find(r => r._id === form.room)?.name || 'No room assigned'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>SPECIFICATIONS (OPTIONAL)</Text>
              </View>

              <View style={styles.fieldRow}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Brand</Text>
                  <TextInput style={styles.input} placeholder="e.g. IKEA" placeholderTextColor="#94A3B8" value={form.brand} onChangeText={v => setForm(f => ({ ...f, brand: v }))} />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Supplier</Text>
                  <TextInput style={styles.input} placeholder="e.g. ABC Decor" placeholderTextColor="#94A3B8" value={form.supplier} onChangeText={v => setForm(f => ({ ...f, supplier: v }))} />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Finish</Text>
                  <TextInput style={styles.input} placeholder="e.g. Matte" placeholderTextColor="#94A3B8" value={form.finish} onChangeText={v => setForm(f => ({ ...f, finish: v }))} />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Color Code</Text>
                  <TextInput style={styles.input} placeholder="e.g. #F5F5F5" placeholderTextColor="#94A3B8" value={form.colorCode} onChangeText={v => setForm(f => ({ ...f, colorCode: v }))} />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Dimensions</Text>
                <TextInput style={styles.input} placeholder="e.g. 200cm x 90cm x 75cm" placeholderTextColor="#94A3B8" value={form.dimensions} onChangeText={v => setForm(f => ({ ...f, dimensions: v }))} />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput style={[styles.input, styles.textArea]} placeholder="Optional notes about this item..." placeholderTextColor="#94A3B8" multiline textAlignVertical="top" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSubmitting} activeOpacity={0.85}>
                <LinearGradient colors={['#3B82F6', '#3B82F6']} style={styles.saveBtnGradient}>
                  {isSubmitting
                    ? <ActivityIndicator color="#FFF" />
                    : <><Ionicons name={editingItem ? 'checkmark-done' : 'add-circle-outline'} size={20} color="#FFF" /><Text style={styles.saveBtnText}>{editingItem ? t('updateItem') : t('addItem')}</Text></>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </AdaptiveGlass>
        </KeyboardAvoidingView>
      </Modal>

      {/* Category Picker */}
      <Modal visible={showCatPicker} animationType="fade" transparent>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowCatPicker(false)}>
          <AdaptiveGlass intensity={80} tint="light" style={styles.pickerSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.pickerTitle}>Select Category</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.pickerItem, form.category === c && styles.pickerItemActive]}
                  onPress={() => { setForm(f => ({ ...f, category: c })); setShowCatPicker(false); }}
                  activeOpacity={0.8}
                >
                  <View style={styles.pickerItemRow}>
                    <View style={[styles.pickerIcon, form.category === c && { backgroundColor: '#DBEAFE' }]}>
                      <MaterialIcons name={CATEGORY_ICON[c] || 'category'} size={18} color={form.category === c ? '#3B82F6' : '#94A3B8'} />
                    </View>
                    <Text style={[styles.pickerItemText, form.category === c && styles.pickerItemTextActive]}>{c}</Text>
                  </View>
                  {form.category === c && <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </AdaptiveGlass>
        </TouchableOpacity>
      </Modal>

      {/* Status Picker */}
      <Modal visible={showStatusPicker} animationType="fade" transparent>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <AdaptiveGlass intensity={80} tint="light" style={styles.pickerSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.pickerTitle}>Select Status</Text>
            {STATUSES.map(s => {
              const sc = STATUS_COLOR[s];
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.pickerItem, form.status === s && styles.pickerItemActive]}
                  onPress={() => { setForm(f => ({ ...f, status: s })); setShowStatusPicker(false); }}
                  activeOpacity={0.8}
                >
                  <View style={styles.pickerItemRow}>
                    <View style={[styles.statusDot, { backgroundColor: sc.text, width: 12, height: 12, borderRadius: 6 }]} />
                    <Text style={[styles.pickerItemText, form.status === s && styles.pickerItemTextActive]}>{s}</Text>
                  </View>
                  {form.status === s && <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />}
                </TouchableOpacity>
              );
            })}
          </AdaptiveGlass>
        </TouchableOpacity>
      </Modal>

      {/* Room Picker */}
      <Modal visible={showRoomPicker} animationType="fade" transparent>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowRoomPicker(false)}>
          <AdaptiveGlass intensity={80} tint="light" style={styles.pickerSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.pickerTitle}>Assign to Room</Text>
            <TouchableOpacity
              style={[styles.pickerItem, !form.room && styles.pickerItemActive]}
              onPress={() => { setForm(f => ({ ...f, room: '' })); setShowRoomPicker(false); }}
              activeOpacity={0.8}
            >
              <View style={styles.pickerItemRow}>
                <Ionicons name="close-circle-outline" size={18} color={!form.room ? '#3B82F6' : '#94A3B8'} />
                <Text style={[styles.pickerItemText, !form.room && styles.pickerItemTextActive]}>No room</Text>
              </View>
              {!form.room && <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />}
            </TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false}>
              {rooms.map(r => (
                <TouchableOpacity
                  key={r._id}
                  style={[styles.pickerItem, form.room === r._id && styles.pickerItemActive]}
                  onPress={() => { setForm(f => ({ ...f, room: r._id })); setShowRoomPicker(false); }}
                  activeOpacity={0.8}
                >
                  <View style={styles.pickerItemRow}>
                    <MaterialIcons name="meeting-room" size={18} color={form.room === r._id ? '#3B82F6' : '#94A3B8'} />
                    <View>
                      <Text style={[styles.pickerItemText, form.room === r._id && styles.pickerItemTextActive]}>{r.name}</Text>
                      <Text style={styles.pickerItemSub}>Floor {r.floor}{r.area ? `  ·  ${r.area} ${r.areaUnit}` : ''}</Text>
                    </View>
                  </View>
                  {form.room === r._id && <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </AdaptiveGlass>
        </TouchableOpacity>
      </Modal>

      {/* Detail Sheet */}
      <Modal visible={!!detailItem} animationType="slide" transparent>
        <View style={styles.detailOverlay}>
          <AdaptiveGlass intensity={60} tint="light" style={styles.detailSheet}>
            {detailItem && (() => {
              const sc = STATUS_COLOR[detailItem.status] || STATUS_COLOR['Planned'];
              return (
                <>
                  <View style={styles.modalHandle} />

                  {/* Header */}
                  <View style={styles.detailHeader}>
                    <View style={[styles.detailHeaderIcon, { backgroundColor: sc.bg }]}>
                      <MaterialIcons name={CATEGORY_ICON[detailItem.category] || 'category'} size={26} color={sc.text} />
                    </View>
                    <View style={styles.detailHeaderInfo}>
                      <Text style={styles.detailName}>{detailItem.name}</Text>
                      <View style={styles.detailTagRow}>
                        <View style={styles.categoryChip}><Text style={styles.categoryChipText}>{detailItem.category}</Text></View>
                        {detailItem.room?.name && (
                          <View style={styles.roomChip}>
                            <MaterialIcons name="meeting-room" size={10} color="#2563EB" />
                            <Text style={styles.roomChipText}>{detailItem.room.name}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDetailItem(null)}>
                      <Ionicons name="close" size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  {/* Status + Cost strip */}
                  <View style={styles.detailCostRow}>
                    <View style={[styles.detailStatusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.detailStatusText, { color: sc.text }]}>{detailItem.status}</Text>
                    </View>
                    <View style={styles.detailCostBlock}>
                      <Text style={styles.detailCostLabel}>Total Cost</Text>
                      <Text style={styles.detailCostVal}>{formatCost(detailItem.totalCost || 0, project?.currency)}</Text>
                    </View>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                    {/* Quantity & Pricing */}
                    <Text style={styles.detailSectionTitle}>QUANTITY & PRICING</Text>
                    <View style={styles.detailGrid}>
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailGridLabel}>Quantity</Text>
                        <Text style={styles.detailGridVal}>{detailItem.quantity} {detailItem.unit}</Text>
                      </View>
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailGridLabel}>Unit Cost</Text>
                        <Text style={styles.detailGridVal}>{formatCost(detailItem.unitCost || 0, project?.currency)}</Text>
                      </View>
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailGridLabel}>Unit</Text>
                        <Text style={styles.detailGridVal}>{detailItem.unit || '—'}</Text>
                      </View>
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailGridLabel}>Total</Text>
                        <Text style={[styles.detailGridVal, { color: '#2563EB' }]}>{formatCost(detailItem.totalCost || 0, project?.currency)}</Text>
                      </View>
                    </View>

                    {/* Specifications */}
                    {(detailItem.brand || detailItem.modelNo || detailItem.supplier || detailItem.finish || detailItem.dimensions || detailItem.colorCode) && (
                      <>
                        <Text style={styles.detailSectionTitle}>SPECIFICATIONS</Text>
                        <View style={styles.detailGrid}>
                          {detailItem.brand && <View style={styles.detailGridItem}><Text style={styles.detailGridLabel}>Brand</Text><Text style={styles.detailGridVal}>{detailItem.brand}</Text></View>}
                          {detailItem.modelNo && <View style={styles.detailGridItem}><Text style={styles.detailGridLabel}>Model No.</Text><Text style={styles.detailGridVal}>{detailItem.modelNo}</Text></View>}
                          {detailItem.supplier && <View style={styles.detailGridItem}><Text style={styles.detailGridLabel}>Supplier</Text><Text style={styles.detailGridVal}>{detailItem.supplier}</Text></View>}
                          {detailItem.finish && <View style={styles.detailGridItem}><Text style={styles.detailGridLabel}>Finish</Text><Text style={styles.detailGridVal}>{detailItem.finish}</Text></View>}
                          {detailItem.dimensions && <View style={styles.detailGridItem}><Text style={styles.detailGridLabel}>Dimensions</Text><Text style={styles.detailGridVal}>{detailItem.dimensions}</Text></View>}
                          {detailItem.colorCode && (
                            <View style={styles.detailGridItem}>
                              <Text style={styles.detailGridLabel}>Color</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <View style={[styles.colorSwatch, { width: 14, height: 14, borderRadius: 4, backgroundColor: detailItem.colorCode }]} />
                                <Text style={styles.detailGridVal}>{detailItem.colorCode}</Text>
                              </View>
                            </View>
                          )}
                        </View>
                      </>
                    )}

                    {/* Notes */}
                    {detailItem.notes && (
                      <>
                        <Text style={styles.detailSectionTitle}>NOTES</Text>
                        <View style={styles.detailNotesBox}>
                          <Text style={styles.detailNotesText}>{detailItem.notes}</Text>
                        </View>
                      </>
                    )}

                    {/* Actions */}
                    <View style={styles.detailActions}>
                      <TouchableOpacity style={styles.detailEditBtn} onPress={() => { setDetailItem(null); openEditModal(detailItem); }} activeOpacity={0.8}>
                        <Ionicons name="create-outline" size={16} color="#3B82F6" />
                        <Text style={styles.detailEditBtnText}>Edit Item</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.detailDeleteBtn} onPress={() => { setDetailItem(null); confirmDelete(detailItem); }} activeOpacity={0.8}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        <Text style={styles.detailDeleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </>
              );
            })()}
          </AdaptiveGlass>
        </View>
      </Modal>

      <ConfirmModal
        visible={confirmModal.visible}
        title="Delete Item"
        message={`Remove "${confirmModal.item?.name}" from FFE list?`}
        confirmText="Delete"
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmModal({ visible: false, item: null })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 20, color: '#0F172A', letterSpacing: -0.5 , fontFamily: 'Inter-Bold' },
  sectionSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  addBtn: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, height: 36, borderRadius: 12, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  addBtnText: { color: '#FFF', fontSize: 13, fontFamily: 'Inter-Bold' },

  // Cost banner
  costBanner: { marginHorizontal: 16, marginTop: 8, marginBottom: 8, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: 'rgba(239,246,255,0.9)' },
  costTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  costMainBlock: {},
  costLabel: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#3B82F6', letterSpacing: 1.5, marginBottom: 2 },
  costValue: { fontSize: 22, fontFamily: 'Inter-Bold', color: '#0F172A' },
  costProgressBlock: { alignItems: 'flex-end' },
  progressPct: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#3B82F6' },
  progressLabel: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  costStatStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  costStatChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  costStatText: { fontSize: 11, fontFamily: 'Inter-Bold' },
  noItemsHint: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  progressBarBg: { height: 4, backgroundColor: '#BFDBFE', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },

  // Category filter
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 6, alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#3B82F6', borderColor: '#2563EB' },
  filterChipText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B' },
  filterChipTextActive: { color: '#FFFFFF', fontFamily: 'Inter-Bold' },

  // List
  scroll: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { gap: 0, paddingTop: 2 },

  // Item card
  itemCard: { borderRadius: 24, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E0F2FE', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  itemTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 6 },
  itemTagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  categoryChip: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#F1F5F9', borderRadius: 8 },
  categoryChipText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#475569' },
  roomChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#EFF6FF', borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  roomChipText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#2563EB' },
  itemRightCol: { alignItems: 'flex-end', gap: 6 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusPillText: { fontSize: 11, fontFamily: 'Inter-Bold' },
  itemCost: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },

  // Detail row
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  detailChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  detailChipText: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' },
  colorSwatch: { width: 10, height: 10, borderRadius: 3, borderWidth: 0.5, borderColor: '#E2E8F0' },

  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  notesText: { flex: 1, fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', lineHeight: 18 },

  cardActionBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' },

  // Detail sheet
  detailOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.5)' },
  detailSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingTop: 12, maxHeight: '88%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.96)' },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  detailHeaderIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  detailHeaderInfo: { flex: 1 },
  detailName: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 6 },
  detailTagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  detailCostRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  detailStatusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  detailStatusText: { fontSize: 13, fontFamily: 'Inter-Bold' },
  detailCostBlock: { alignItems: 'flex-end' },
  detailCostLabel: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  detailCostVal: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A' },
  detailSectionTitle: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 8, marginTop: 4 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  detailGridItem: { width: '47%', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  detailGridLabel: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#94A3B8', marginBottom: 3 },
  detailGridVal: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  detailNotesBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  detailNotesText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#475569', lineHeight: 20 },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  detailEditBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE' },
  detailEditBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#3B82F6' },
  detailDeleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  detailDeleteBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#EF4444' },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: 'rgba(239,246,255,0.8)' },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A' },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', paddingHorizontal: 32, lineHeight: 22 },

  // FAB
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, overflow: 'hidden', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },
  fabGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.5)' },
  modalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingTop: 12, maxHeight: '92%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.92)' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalPre: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#3B82F6', letterSpacing: 1.5, marginBottom: 4 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  sectionDivider: { marginBottom: 14, paddingTop: 4 },
  sectionDividerText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 1.5 },

  // Form
  field: { marginBottom: 14, gap: 6 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#475569' },
  input: { height: 50, backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 14, fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
  pickerInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerInputText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A' },
  textArea: { height: 80, paddingTop: 14, textAlignVertical: 'top' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  saveBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 8, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  saveBtnGradient: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveBtnText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  // Pickers
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  pickerSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12, maxHeight: '65%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.95)' },
  pickerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 12 },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', borderRadius: 10 },
  pickerItemActive: { backgroundColor: '#EFF6FF' },
  pickerItemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickerIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  pickerItemText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A' },
  pickerItemTextActive: { color: '#3B82F6', fontFamily: 'Inter-Bold' },
  pickerItemSub: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#94A3B8', marginTop: 2 },
});

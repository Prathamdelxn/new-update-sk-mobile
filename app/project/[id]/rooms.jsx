import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import ConfirmModal from '../../components/ConfirmModal';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const ROOM_TYPES = ['Living Room', 'Bedroom', 'Master Bedroom', 'Kitchen', 'Bathroom', 'Dining', 'Office', 'Corridor', 'Balcony', 'Terrace', 'Store', 'Laundry', 'Entrance', 'Other'];
const STATUS_OPTIONS = ['Planned', 'In Progress', 'Snagging', 'Completed'];
const AREA_UNITS = ['sqft', 'sqm'];

const STATUS_STYLE = {
  'Planned':     { bg: '#F1F5F9', text: '#64748B', icon: 'radio-button-unchecked' },
  'In Progress': { bg: '#DBEAFE', text: '#2563EB', icon: 'pending' },
  'Snagging':    { bg: '#FEF3C7', text: '#D97706', icon: 'warning-amber' },
  'Completed':   { bg: '#D1FAE5', text: '#059669', icon: 'check-circle' },
};

const EMPTY_FORM = { name: '', type: 'Other', floor: '1', area: '', areaUnit: 'sqft', notes: '' };

const formatCost = (n, currency = '$') => {
  if (!n) return `${currency} 0`;
  if (n >= 1000000) return `${currency} ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${currency} ${(n / 1000).toFixed(1)}k`;
  return `${currency} ${n}`;
};

export default function ProjectRoomsTab({ projectId, project, onSwitchToFFE }) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [rooms, setRooms] = useState([]);
  const [ffeItems, setFfeItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ visible: false, room: null });

  const fetchData = useCallback(async () => {
    try {
      const [roomsRes, ffeRes] = await Promise.all([
        fetch(`${API_BASE_URL}/projects/${projectId}/rooms`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/projects/${projectId}/ffe`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const roomsData = await roomsRes.json();
      const ffeData = await ffeRes.json();
      if (roomsRes.ok) setRooms(roomsData);
      if (ffeRes.ok) setFfeItems(ffeData.items || []);
    } catch {
      showToast(t('networkErrorLoadingRooms'), 'error');
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

  // Per-room FFE stats
  const roomStats = useMemo(() => {
    const map = {};
    ffeItems.forEach(item => {
      const roomId = item.room?._id || item.room;
      if (!roomId) return;
      if (!map[roomId]) map[roomId] = { total: 0, installed: 0, cost: 0 };
      map[roomId].total += 1;
      if (item.status === 'Installed') map[roomId].installed += 1;
      map[roomId].cost += item.totalCost || 0;
    });
    return map;
  }, [ffeItems]);

  const unassignedFFE = ffeItems.filter(i => !i.room?._id && !i.room).length;
  const totalFFECost = ffeItems.reduce((sum, i) => sum + (i.totalCost || 0), 0);
  const totalInstalled = ffeItems.filter(i => i.status === 'Installed').length;
  const overallProgress = ffeItems.length ? Math.round((totalInstalled / ffeItems.length) * 100) : 0;

  const openAddModal = () => { setEditingRoom(null); setForm(EMPTY_FORM); setModalVisible(true); };

  const openEditModal = (room) => {
    setEditingRoom(room);
    setForm({ name: room.name, type: room.type, floor: String(room.floor ?? 1), area: room.area != null ? String(room.area) : '', areaUnit: room.areaUnit || 'sqft', status: room.status, notes: room.notes || '' });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Room name is required', 'error'); return; }
    setIsSubmitting(true);
    try {
      const payload = { name: form.name.trim(), type: form.type, floor: parseInt(form.floor) || 1, area: form.area ? parseFloat(form.area) : undefined, areaUnit: form.areaUnit, notes: form.notes.trim() || undefined };
      if (editingRoom) payload.status = form.status;
      const url = editingRoom ? `${API_BASE_URL}/projects/${projectId}/rooms/${editingRoom._id}` : `${API_BASE_URL}/projects/${projectId}/rooms`;
      const res = await fetch(url, { method: editingRoom ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) { showToast(editingRoom ? 'Room updated' : 'Room added', 'success'); setModalVisible(false); fetchData(); }
      else if (data.code === 'ROOM_LIMIT_REACHED') { showToast(data.message, 'error'); setModalVisible(false); }
      else showToast(data.message || 'Failed to save room', 'error');
    } catch { showToast(t('networkError'), 'error'); }
    finally { setIsSubmitting(false); }
  };

  const confirmDelete = (room) => setConfirmModal({ visible: true, room });
  const handleDelete = async () => {
    const room = confirmModal.room;
    setConfirmModal({ visible: false, room: null });
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/rooms/${room._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { showToast('Room deleted', 'success'); fetchData(); }
      else { const d = await res.json(); showToast(d.message || 'Failed to delete', 'error'); }
    } catch { showToast(t('networkError'), 'error'); }
  };

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);

  return (
    <View style={styles.container}>

      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>Rooms</Text>
          <Text style={styles.sectionSubtitle}>{rooms.length} rooms tracked</Text>
        </View>
        {hasPermission('rooms', 'create') && (
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={openAddModal}>
            <Feather name="plus" size={16} color="#FFF" />
            <Text style={styles.addBtnText}>Add Room</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Overall FFE Progress Banner */}
      {ffeItems.length > 0 && (
        <AdaptiveGlass intensity={20} tint="light" style={styles.progressBanner}>
          <View style={styles.progressBannerTop}>
            <View style={styles.progressBannerLeft}>
              <Text style={styles.progressBannerLabel}>OVERALL FFE PROGRESS</Text>
              <Text style={styles.progressBannerVal}>{totalInstalled} / {ffeItems.length} items installed</Text>
            </View>
            <View style={styles.progressBannerRight}>
              <Text style={styles.progressPct}>{overallProgress}%</Text>
              <Text style={styles.progressCostLabel}>{formatCost(totalFFECost, project?.currency)} total</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${overallProgress}%` }]} />
          </View>
          {unassignedFFE > 0 && (
            <TouchableOpacity style={styles.unassignedBanner} onPress={onSwitchToFFE} activeOpacity={0.8}>
              <Ionicons name="warning-outline" size={14} color="#D97706" />
              <Text style={styles.unassignedText}>{unassignedFFE} FFE item{unassignedFFE > 1 ? 's' : ''} not assigned to any room</Text>
              <Text style={styles.unassignedLink}>Assign →</Text>
            </TouchableOpacity>
          )}
        </AdaptiveGlass>
      )}

      {/* Summary Strip */}
      <AdaptiveGlass intensity={20} tint="light" style={styles.summaryStrip}>
        <View style={styles.summaryStat}>
          <MaterialIcons name="meeting-room" size={14} color="#3B82F6" />
          <Text style={styles.summaryStatNum}>{rooms.length}</Text>
          <Text style={styles.summaryStatLabel}>Total</Text>
        </View>
        {STATUS_OPTIONS.map((s, i) => (
          <View key={s} style={{ flexDirection: 'row', flex: 1 }}>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryStatNum, { color: STATUS_STYLE[s].text }]}>{rooms.filter(r => r.status === s).length}</Text>
              <Text style={styles.summaryStatLabel}>{s}</Text>
            </View>
          </View>
        ))}
      </AdaptiveGlass>

      {!hasPermission('rooms', 'view') ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
          <Feather name="lock" size={48} color="#CBD5E1" />
          <Text style={{ marginTop: 16, fontSize: 16, fontFamily: 'Inter-Medium', color: '#64748B' }}>
            You don't have permission to view Rooms.
          </Text>
        </View>
      ) : isLoading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color="#3B82F6" />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 72 }]} showsVerticalScrollIndicator={false}>
          {rooms.length === 0 ? (
            <View style={styles.emptyBox}>
              <AdaptiveGlass intensity={20} tint="light" style={styles.emptyIconWrap}>
                <MaterialIcons name="weekend" size={40} color="#93C5FD" />
              </AdaptiveGlass>
              <Text style={styles.emptyTitle}>No rooms added yet</Text>
              <Text style={styles.emptySubtitle}>Add rooms to track FFE progress per space. Each room shows furniture, fixtures and installation status.</Text>
            </View>
          ) : (
            floors.map(floor => (
              <View key={floor}>
                <View style={styles.floorHeaderRow}>
                  <View style={styles.floorAccent} />
                  <Text style={styles.floorHeader}>Floor {floor}</Text>
                  <Text style={styles.floorRoomCount}>{rooms.filter(r => r.floor === floor).length} rooms</Text>
                </View>

                {rooms.filter(r => r.floor === floor).map(room => {
                  const sc = STATUS_STYLE[room.status] || STATUS_STYLE['Planned'];
                  const stats = roomStats[room._id];
                  const roomProgress = stats?.total ? Math.round((stats.installed / stats.total) * 100) : 0;

                  return (
                    <View key={room._id} style={styles.roomCard}>
                      {/* Top Row */}
                      <View style={styles.roomTopRow}>
                        <View style={[styles.roomIconWrap, { backgroundColor: sc.bg }]}>
                          <MaterialIcons name="meeting-room" size={22} color={sc.text} />
                        </View>
                        <View style={styles.roomInfo}>
                          <Text style={styles.roomName}>{room.name}</Text>
                          <View style={styles.roomMetaRow}>
                            <Text style={styles.roomType}>{room.type}</Text>
                            {room.area ? (<><View style={styles.metaDot} /><Text style={styles.roomArea}>{room.area} {room.areaUnit}</Text></>) : null}
                          </View>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                          <MaterialIcons name={sc.icon} size={12} color={sc.text} />
                          <Text style={[styles.statusPillText, { color: sc.text }]}>{room.status}</Text>
                        </View>
                      </View>

                      {/* FFE Progress Section */}
                      {stats ? (
                        <View style={styles.ffeSection}>
                          <View style={styles.ffeSectionTop}>
                            <View style={styles.ffeStatRow}>
                              <View style={styles.ffeStat}>
                                <Text style={styles.ffeStatNum}>{stats.total}</Text>
                                <Text style={styles.ffeStatLabel}>FFE Items</Text>
                              </View>
                              <View style={styles.ffeStatDivider} />
                              <View style={styles.ffeStat}>
                                <Text style={[styles.ffeStatNum, { color: '#059669' }]}>{stats.installed}</Text>
                                <Text style={styles.ffeStatLabel}>Installed</Text>
                              </View>
                              <View style={styles.ffeStatDivider} />
                              <View style={styles.ffeStat}>
                                <Text style={[styles.ffeStatNum, { color: '#D97706' }]}>{stats.total - stats.installed}</Text>
                                <Text style={styles.ffeStatLabel}>Pending</Text>
                              </View>
                              <View style={styles.ffeStatDivider} />
                              <View style={styles.ffeStat}>
                                <Text style={[styles.ffeStatNum, { color: '#3B82F6' }]}>{formatCost(stats.cost, project?.currency)}</Text>
                                <Text style={styles.ffeStatLabel}>Cost</Text>
                              </View>
                            </View>
                          </View>
                          <View style={styles.roomProgressBg}>
                            <View style={[styles.roomProgressFill, { width: `${roomProgress}%`, backgroundColor: roomProgress === 100 ? '#059669' : '#3B82F6' }]} />
                          </View>
                          <Text style={styles.progressCaption}>{roomProgress}% installed</Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.noFFEBanner} onPress={onSwitchToFFE} activeOpacity={0.8}>
                          <Ionicons name="add-circle-outline" size={16} color="#3B82F6" />
                          <Text style={styles.noFFEText}>No FFE items assigned — tap to add items in the FFE tab</Text>
                        </TouchableOpacity>
                      )}

                      {room.notes ? (
                        <View style={styles.notesRow}>
                          <Ionicons name="document-text-outline" size={13} color="#94A3B8" />
                          <Text style={styles.roomNotes} numberOfLines={2}>{room.notes}</Text>
                        </View>
                      ) : null}

                      <View style={styles.cardDivider} />
                      <View style={styles.cardActions}>
                        {onSwitchToFFE && (
                          <TouchableOpacity style={styles.viewFFEBtn} onPress={onSwitchToFFE} activeOpacity={0.8}>
                            <MaterialIcons name="chair" size={15} color="#3B82F6" />
                            <Text style={styles.viewFFEBtnText}>View Items</Text>
                          </TouchableOpacity>
                        )}
                        {hasPermission('rooms', 'update') && (
                          <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(room)} activeOpacity={0.8}>
                            <Ionicons name="create-outline" size={16} color="#3B82F6" />
                          </TouchableOpacity>
                        )}
                        {hasPermission('rooms', 'delete') && (
                          <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(room)} activeOpacity={0.8}>
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
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
                <Text style={styles.modalPre}>{editingRoom ? 'MODIFY ROOM' : 'NEW ROOM'}</Text>
                <Text style={styles.modalTitle}>{editingRoom ? `Edit "${editingRoom.name}"` : 'Add Room / Space'}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Room Name <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput style={styles.input} placeholder="e.g. Master Bedroom" placeholderTextColor="#94A3B8" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Room Type</Text>
                <TouchableOpacity style={[styles.input, styles.pickerInput]} onPress={() => setShowTypePicker(true)} activeOpacity={0.8}>
                  <Text style={styles.pickerInputText}>{form.type}</Text>
                  <Ionicons name="chevron-down" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldRow}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Floor</Text>
                  <TextInput style={styles.input} placeholder="1" placeholderTextColor="#94A3B8" keyboardType="numeric" value={form.floor} onChangeText={v => setForm(f => ({ ...f, floor: v }))} />
                </View>
                <View style={[styles.field, { flex: 1.5 }]}>
                  <Text style={styles.fieldLabel}>Area</Text>
                  <TextInput style={styles.input} placeholder="e.g. 250" placeholderTextColor="#94A3B8" keyboardType="numeric" value={form.area} onChangeText={v => setForm(f => ({ ...f, area: v }))} />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <View style={styles.unitToggle}>
                    {AREA_UNITS.map(u => (
                      <TouchableOpacity key={u} style={[styles.unitBtn, form.areaUnit === u && styles.unitBtnActive]} onPress={() => setForm(f => ({ ...f, areaUnit: u }))} activeOpacity={0.8}>
                        <Text style={[styles.unitBtnText, form.areaUnit === u && styles.unitBtnTextActive]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {editingRoom && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Status</Text>
                  <TouchableOpacity style={[styles.input, styles.pickerInput]} onPress={() => setShowStatusPicker(true)} activeOpacity={0.8}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_STYLE[form.status]?.text || '#94A3B8' }]} />
                      <Text style={styles.pickerInputText}>{form.status}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput style={[styles.input, styles.textArea]} placeholder="Optional notes about this room..." placeholderTextColor="#94A3B8" multiline textAlignVertical="top" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSubmitting} activeOpacity={0.85}>
                <LinearGradient colors={['#3B82F6', '#3B82F6']} style={styles.saveBtnGradient}>
                  {isSubmitting ? <ActivityIndicator color="#FFF" /> : <><Ionicons name={editingRoom ? 'checkmark-done' : 'add-circle-outline'} size={20} color="#FFF" /><Text style={styles.saveBtnText}>{editingRoom ? 'Update Room' : 'Add Room'}</Text></>}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </AdaptiveGlass>
        </KeyboardAvoidingView>
      </Modal>

      {/* Type Picker */}
      <Modal visible={showTypePicker} animationType="fade" transparent>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowTypePicker(false)}>
          <AdaptiveGlass intensity={80} tint="light" style={styles.pickerSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.pickerTitle}>Select Room Type</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ROOM_TYPES.map(t => (
                <TouchableOpacity key={t} style={[styles.pickerItem, form.type === t && styles.pickerItemActive]} onPress={() => { setForm(f => ({ ...f, type: t })); setShowTypePicker(false); }} activeOpacity={0.8}>
                  <Text style={[styles.pickerItemText, form.type === t && styles.pickerItemTextActive]}>{t}</Text>
                  {form.type === t && <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />}
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
            {STATUS_OPTIONS.map(s => {
              const sc = STATUS_STYLE[s];
              return (
                <TouchableOpacity key={s} style={[styles.pickerItem, form.status === s && styles.pickerItemActive]} onPress={() => { setForm(f => ({ ...f, status: s })); setShowStatusPicker(false); }} activeOpacity={0.8}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.statusDot, { backgroundColor: sc.text }]} />
                    <Text style={[styles.pickerItemText, form.status === s && styles.pickerItemTextActive]}>{s}</Text>
                  </View>
                  {form.status === s && <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />}
                </TouchableOpacity>
              );
            })}
          </AdaptiveGlass>
        </TouchableOpacity>
      </Modal>

      <ConfirmModal
        visible={confirmModal.visible}
        title="Delete Room"
        message={`Remove "${confirmModal.room?.name}"? FFE items linked to this room will be unlinked.`}
        confirmText="Delete"
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmModal({ visible: false, room: null })}
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

  // Overall progress banner
  progressBanner: { marginHorizontal: 16, marginTop: 8, marginBottom: 8, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: 'rgba(239,246,255,0.9)' },
  progressBannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressBannerLeft: {},
  progressBannerLabel: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#3B82F6', letterSpacing: 1.5, marginBottom: 2 },
  progressBannerVal: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  progressBannerRight: { alignItems: 'flex-end' },
  progressPct: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#3B82F6' },
  progressCostLabel: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  progressBarBg: { height: 4, backgroundColor: '#BFDBFE', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 },
  unassignedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#DBEAFE' },
  unassignedText: { flex: 1, fontSize: 11, fontFamily: 'Inter-Medium', color: '#D97706' },
  unassignedLink: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#D97706' },

  // Summary
  summaryStrip: { marginHorizontal: 16, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: 'rgba(239,246,255,0.8)', flexDirection: 'row', alignItems: 'center' },
  summaryStat: { flex: 1, alignItems: 'center', gap: 1 },
  summaryStatNum: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  summaryStatLabel: { fontSize: 9, fontFamily: 'Inter-SemiBold', color: '#94A3B8', textAlign: 'center' },
  summaryDivider: { width: 1, height: 26, backgroundColor: '#E2E8F0' },

  scroll: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { gap: 0, paddingTop: 2 },

  // Floor group
  floorHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 6 },
  floorAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: '#3B82F6' },
  floorHeader: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB', textTransform: 'uppercase', letterSpacing: 1.2, flex: 1 },
  floorRoomCount: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },

  // Room card
  roomCard: { borderRadius: 24, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFF' },
  roomTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roomIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  roomMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  roomType: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#CBD5E1' },
  roomArea: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#3B82F6' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusPillText: { fontSize: 11, fontFamily: 'Inter-Bold' },

  // FFE section inside room card
  ffeSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#DBEAFE' },
  ffeSectionTop: { marginBottom: 10 },
  ffeStatRow: { flexDirection: 'row', alignItems: 'center' },
  ffeStat: { flex: 1, alignItems: 'center', gap: 2 },
  ffeStatNum: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  ffeStatLabel: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },
  ffeStatDivider: { width: 1, height: 30, backgroundColor: '#DBEAFE' },
  roomProgressBg: { height: 6, backgroundColor: '#DBEAFE', borderRadius: 3, overflow: 'hidden' },
  roomProgressFill: { height: '100%', borderRadius: 3 },
  progressCaption: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#94A3B8', marginTop: 5, textAlign: 'right' },
  noFFEBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#DBEAFE', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#EFF6FF', borderRadius: 12 },
  noFFEText: { flex: 1, fontSize: 12, fontFamily: 'Inter-Medium', color: '#1D4ED8' },

  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  roomNotes: { flex: 1, fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', lineHeight: 18 },
  cardDivider: { height: 1, backgroundColor: '#F1F5F9', marginTop: 12, marginBottom: 10 },
  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  viewFFEBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 12, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0' },
  viewFFEBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#3B82F6' },
  editBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },

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
  modalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingTop: 12, maxHeight: '88%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.92)' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalPre: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#3B82F6', letterSpacing: 1.5, marginBottom: 4 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  field: { marginBottom: 14, gap: 6 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#475569' },
  input: { height: 50, backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 14, fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
  pickerInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerInputText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  textArea: { height: 80, paddingTop: 14, textAlignVertical: 'top' },
  unitToggle: { flexDirection: 'row', height: 50, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  unitBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  unitBtnActive: { backgroundColor: '#3B82F6' },
  unitBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B' },
  unitBtnTextActive: { color: '#FFFFFF' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  saveBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 8, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  saveBtnGradient: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveBtnText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  pickerSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12, maxHeight: '60%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.95)' },
  pickerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 12 },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', borderRadius: 10 },
  pickerItemActive: { backgroundColor: '#EFF6FF' },
  pickerItemText: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  pickerItemTextActive: { color: '#3B82F6', fontFamily: 'Inter-Bold' },
});

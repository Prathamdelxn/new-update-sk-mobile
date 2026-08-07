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

const PIPELINES = [
  { key: 'pending', label: 'Planned', icon: 'time-outline', color: '#64748B' },
  { key: 'approved', label: 'Approved PO', icon: 'cart-outline', color: '#2563EB' },
  { key: 'ordered', label: 'Manufacturing', icon: 'cube-outline', color: '#D97706' },
  { key: 'dispatched', label: 'In Transit', icon: 'car-outline', color: '#4F46E5' },
  { key: 'delivered', label: 'Delivered', icon: 'checkmark-circle-outline', color: '#16A34A' },
  { key: 'rejected', label: 'Rejected', icon: 'close-circle-outline', color: '#DC2626' },
];

function formatCost(amount) {
  return `₹${Math.round(amount || 0).toLocaleString('en-IN')}`;
}

const emptyForm = { vendorName: '', deliveryDate: '' };
const emptyItem = { name: '', quantity: '1', unit: 'nos', unitPrice: '0' };

export default function InteriorProcurementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('procurement');
  const [pos, setPos] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [poItems, setPoItems] = useState([]);
  const [newItem, setNewItem] = useState(emptyItem);

  const [selectedPo, setSelectedPo] = useState(null);
  const [updatingPo, setUpdatingPo] = useState(false);

  const [selectedStock, setSelectedStock] = useState(null);
  const [installQty, setInstallQty] = useState('');
  const [installNotes, setInstallNotes] = useState('');
  const [loggingInstall, setLoggingInstall] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, invRes] = await Promise.allSettled([
        interiorApiClient.get(`/projects/${projectId}/procurement`),
        interiorApiClient.get(`/projects/${projectId}/inventory`),
      ]);
      setPos(poRes.status === 'fulfilled' && poRes.value?.success ? poRes.value.data || [] : []);
      setInventory(invRes.status === 'fulfilled' && invRes.value?.success ? invRes.value.data || [] : []);
    } catch (e) {
      console.error('Failed to load procurement data', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const addItemLine = () => {
    const qty = parseInt(newItem.quantity, 10);
    const price = parseFloat(newItem.unitPrice);
    if (!newItem.name.trim() || !qty || qty <= 0 || price < 0) {
      showToast('Enter a valid item name, quantity, and rate', 'error');
      return;
    }
    setPoItems((prev) => [...prev, { name: newItem.name, quantity: qty, unit: newItem.unit, unitPrice: price }]);
    setNewItem(emptyItem);
  };

  const removeItemLine = (idx) => setPoItems((prev) => prev.filter((_, i) => i !== idx));

  const handleCreatePo = async () => {
    if (poItems.length === 0) {
      showToast('Please add at least one item to the Purchase Order', 'error');
      return;
    }
    setCreating(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/procurement`, {
        vendorName: form.vendorName,
        items: poItems,
        deliveryDate: form.deliveryDate || undefined,
        status: 'pending',
      });
      showToast('Purchase Order created successfully', 'success');
      setIsAddOpen(false);
      setForm(emptyForm);
      setPoItems([]);
      loadAll();
    } catch (e) {
      showToast(e.message || 'Failed to create Purchase Order', 'error');
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (status) => {
    if (!selectedPo) return;
    setUpdatingPo(true);
    setPos((prev) => prev.map((po) => (po._id === selectedPo._id ? { ...po, status } : po)));
    try {
      const res = await interiorApiClient.put(`/projects/${projectId}/procurement/${selectedPo._id}`, { status });
      if (res?.success) setSelectedPo(res.data);
      loadAll();
    } catch (e) {
      showToast(e.message || 'Failed to update PO status', 'error');
      loadAll();
    } finally {
      setUpdatingPo(false);
    }
  };

  const confirmDeletePo = () => {
    Alert.alert('Delete Purchase Order', 'This will permanently delete the PO and its material history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: deletePo },
    ]);
  };

  const deletePo = async () => {
    if (!selectedPo) return;
    setUpdatingPo(true);
    try {
      await interiorApiClient.delete(`/projects/${projectId}/procurement/${selectedPo._id}`);
      showToast('Purchase Order deleted successfully', 'delete');
      setSelectedPo(null);
      loadAll();
    } catch (e) {
      showToast(e.message || 'Failed to delete Purchase Order', 'error');
    } finally {
      setUpdatingPo(false);
    }
  };

  const openInstall = (stock) => {
    setSelectedStock(stock);
    setInstallQty('');
    setInstallNotes('');
  };

  const handleLogInstall = async () => {
    const qty = parseInt(installQty, 10);
    if (!qty || qty <= 0) {
      showToast('Enter a valid quantity', 'error');
      return;
    }
    const available = selectedStock.totalReceived - selectedStock.installedQuantity;
    if (qty > available) {
      showToast(`Cannot install more than available stock (${available} ${selectedStock.unit})`, 'error');
      return;
    }
    setLoggingInstall(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/inventory`, {
        inventoryId: selectedStock._id,
        quantity: qty,
        notes: installNotes || undefined,
      });
      showToast('Installation logged successfully', 'success');
      setSelectedStock(null);
      loadAll();
    } catch (e) {
      showToast(e.message || 'Failed to log installation', 'error');
    } finally {
      setLoggingInstall(false);
    }
  };

  const totalBudget = pos.reduce((acc, po) => acc + (po.amount || 0), 0);
  const activePOs = pos.filter((po) => ['approved', 'ordered', 'dispatched'].includes(po.status)).length;
  const deliveredPOs = pos.filter((po) => po.status === 'delivered').length;

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Procurement & Inventory</Text>
            <Text style={s.headerSub}>Track orders, deliveries, and site installations.</Text>
          </View>
        </View>

        <View style={s.tabRow}>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'procurement' && s.tabBtnActive]} onPress={() => setActiveTab('procurement')}>
            <Text style={[s.tabBtnText, activeTab === 'procurement' && s.tabBtnTextActive]}>Procurement</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'inventory' && s.tabBtnActive]} onPress={() => setActiveTab('inventory')}>
            <Text style={[s.tabBtnText, activeTab === 'inventory' && s.tabBtnTextActive]}>Inventory</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : activeTab === 'procurement' ? (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.aggregateRow}>
              <View style={s.aggregateCard}>
                <Text style={s.aggregateLabel}>Total Budget</Text>
                <Text style={s.aggregateValue}>{formatCost(totalBudget)}</Text>
              </View>
              <View style={s.aggregateCard}>
                <Text style={s.aggregateLabel}>Active POs</Text>
                <Text style={s.aggregateValue}>{activePOs}</Text>
              </View>
              <View style={s.aggregateCard}>
                <Text style={s.aggregateLabel}>Delivered</Text>
                <Text style={s.aggregateValue}>{deliveredPOs}</Text>
              </View>
            </View>

            {PIPELINES.map((pipe) => {
              const items = pos.filter((po) => po.status === pipe.key);
              if (items.length === 0) return null;
              return (
                <View key={pipe.key} style={{ marginBottom: 14 }}>
                  <View style={s.pipelineHeader}>
                    <Ionicons name={pipe.icon} size={14} color={pipe.color} />
                    <Text style={[s.pipelineTitle, { color: pipe.color }]}>{pipe.label}</Text>
                    <View style={s.pipelineCountBadge}>
                      <Text style={s.pipelineCountText}>{items.length}</Text>
                    </View>
                  </View>
                  {items.map((po) => (
                    <TouchableOpacity key={po._id} style={s.poCard} onPress={() => setSelectedPo(po)}>
                      <View style={s.poTopRow}>
                        <Text style={s.poNumber}>{po.poNumber}</Text>
                        <Text style={s.poAmount}>{formatCost(po.amount)}</Text>
                      </View>
                      <Text style={s.poVendor} numberOfLines={1}>{po.vendorName}</Text>
                      <View style={s.poBottomRow}>
                        <Text style={s.poItemCount}>{po.items?.length || 1} product(s)</Text>
                        {!!po.deliveryDate && <Text style={s.poDate}>{new Date(po.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
            {pos.length === 0 && (
              <View style={s.empty}>
                <Ionicons name="cart-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No purchase orders yet</Text>
              </View>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {inventory.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="cube-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No products in inventory</Text>
                <Text style={s.emptySub}>Stock is created once a PO status becomes "Delivered".</Text>
              </View>
            ) : (
              inventory.map((item) => {
                const available = item.totalReceived - item.installedQuantity;
                const pct = Math.round((item.installedQuantity / item.totalReceived) * 100) || 0;
                return (
                  <View key={item._id} style={s.invCard}>
                    <View style={s.invTopRow}>
                      <Text style={s.invName} numberOfLines={1}>{item.productName}</Text>
                      <TouchableOpacity style={[s.installBtn, available <= 0 && { opacity: 0.4 }]} onPress={() => available > 0 && openInstall(item)} disabled={available <= 0}>
                        <Ionicons name="build-outline" size={13} color="#FFFFFF" />
                        <Text style={s.installBtnText}>Install</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={s.invStatsRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.invStatLabel}>DELIVERED</Text>
                        <Text style={s.invStatValue}>{item.totalReceived} {item.unit}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.invStatLabel, { color: '#16A34A' }]}>INSTALLED</Text>
                        <Text style={[s.invStatValue, { color: '#16A34A' }]}>{item.installedQuantity} {item.unit}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.invStatLabel, { color: '#2563EB' }]}>AVAILABLE</Text>
                        <Text style={[s.invStatValue, { color: '#2563EB' }]}>{available} {item.unit}</Text>
                      </View>
                    </View>
                    <View style={s.progressTrack}>
                      <View style={[s.progressFill, { width: `${pct}%` }]} />
                    </View>

                    {item.installHistory?.length > 0 ? (
                      <View style={s.historyBox}>
                        {item.installHistory.map((log, i) => (
                          <View key={log._id || i} style={s.historyRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.historyText}>Installed: <Text style={{ color: '#16A34A' }}>+{log.quantity} {item.unit}</Text></Text>
                              {!!log.notes && <Text style={s.historyNotes}>{log.notes}</Text>}
                            </View>
                            <Text style={s.historyDate}>{new Date(log.date).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={s.noHistoryText}>No materials installed yet.</Text>
                    )}
                  </View>
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {activeTab === 'procurement' && (
          <TouchableOpacity style={s.fab} onPress={() => setIsAddOpen(true)}>
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Add PO Modal */}
      <Modal visible={isAddOpen} animationType="slide" transparent onRequestClose={() => setIsAddOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Raise Purchase Order</Text>
              <TouchableOpacity onPress={() => setIsAddOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Vendor Name</Text>
              <TextInput style={s.input} placeholder="e.g. Supreme Pipes Ltd" placeholderTextColor="#94A3B8" value={form.vendorName} onChangeText={(v) => setForm({ ...form, vendorName: v })} />

              <Text style={s.label}>Est. Delivery Date</Text>
              <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={form.deliveryDate} onChangeText={(v) => setForm({ ...form, deliveryDate: v })} />

              <View style={s.itemLineBox}>
                <Text style={s.itemLineLabel}>ADD MATERIALS LINE</Text>
                <TextInput style={s.input} placeholder="Product Name (e.g. Copper pipes 22mm)" placeholderTextColor="#94A3B8" value={newItem.name} onChangeText={(v) => setNewItem({ ...newItem, name: v })} />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TextInput style={[s.input, { flex: 1 }]} placeholder="Qty" placeholderTextColor="#94A3B8" keyboardType="numeric" value={newItem.quantity} onChangeText={(v) => setNewItem({ ...newItem, quantity: v })} />
                  <TextInput style={[s.input, { flex: 1 }]} placeholder="Unit" placeholderTextColor="#94A3B8" value={newItem.unit} onChangeText={(v) => setNewItem({ ...newItem, unit: v })} />
                  <TextInput style={[s.input, { flex: 1 }]} placeholder="Rate ₹" placeholderTextColor="#94A3B8" keyboardType="numeric" value={newItem.unitPrice} onChangeText={(v) => setNewItem({ ...newItem, unitPrice: v })} />
                </View>
                <TouchableOpacity style={s.addLineBtn} onPress={addItemLine}>
                  <Ionicons name="add" size={14} color="#2563EB" />
                  <Text style={s.addLineBtnText}>Add Item Line</Text>
                </TouchableOpacity>
              </View>

              {poItems.length > 0 && (
                <View style={s.itemListBox}>
                  {poItems.map((item, idx) => (
                    <View key={idx} style={s.itemListRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.itemListName} numberOfLines={1}>{item.name}</Text>
                        <Text style={s.itemListMeta}>{item.quantity} {item.unit} @ {formatCost(item.unitPrice)} each</Text>
                      </View>
                      <Text style={s.itemListAmount}>{formatCost(item.quantity * item.unitPrice)}</Text>
                      <TouchableOpacity onPress={() => removeItemLine(idx)} style={{ marginLeft: 8 }}>
                        <Ionicons name="trash-outline" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>PO TOTAL COST</Text>
                    <Text style={s.totalValue}>{formatCost(poItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0))}</Text>
                  </View>
                </View>
              )}

              <TouchableOpacity style={[s.saveBtn, (creating || poItems.length === 0) && { opacity: 0.6 }]} onPress={handleCreatePo} disabled={creating || poItems.length === 0}>
                {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Submit PO</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* PO Detail Modal */}
      <Modal visible={!!selectedPo} animationType="slide" transparent onRequestClose={() => setSelectedPo(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            {selectedPo && (
              <>
                <View style={s.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.poNumber}>{selectedPo.poNumber}</Text>
                    <Text style={s.modalTitle}>Purchase Order Details</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedPo(null)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={s.detailChip}>
                      <Text style={s.detailChipLabel}>VENDOR</Text>
                      <Text style={s.detailChipValue}>{selectedPo.vendorName}</Text>
                    </View>
                    <View style={s.detailChip}>
                      <Text style={s.detailChipLabel}>TARGET DATE</Text>
                      <Text style={s.detailChipValue}>{selectedPo.deliveryDate ? new Date(selectedPo.deliveryDate).toLocaleDateString() : 'Not set'}</Text>
                    </View>
                  </View>

                  <Text style={s.label}>Procurement Status</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    {PIPELINES.map((p) => (
                      <TouchableOpacity key={p.key} style={[s.statusChip, selectedPo.status === p.key && { backgroundColor: p.color }]} onPress={() => updateStatus(p.key)} disabled={updatingPo}>
                        <Text style={[s.statusChipText, selectedPo.status === p.key && { color: '#FFFFFF' }]}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.hintText}>Changing to "Delivered" moves these materials into inventory for installation logging.</Text>

                  <Text style={s.label}>Ordered Products</Text>
                  <View style={s.itemListBox}>
                    {(selectedPo.items && selectedPo.items.length > 0 ? selectedPo.items : [{ name: selectedPo.materialName, quantity: 1, unit: '', unitPrice: selectedPo.amount }]).map((item, idx) => (
                      <View key={idx} style={s.itemListRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.itemListName} numberOfLines={1}>{item.name}</Text>
                          <Text style={s.itemListMeta}>{item.quantity} {item.unit} @ {formatCost(item.unitPrice)} each</Text>
                        </View>
                        <Text style={s.itemListAmount}>{formatCost(item.amount || item.quantity * item.unitPrice)}</Text>
                      </View>
                    ))}
                    <View style={s.totalRow}>
                      <Text style={s.totalLabel}>TOTAL AMOUNT</Text>
                      <Text style={s.totalValue}>{formatCost(selectedPo.amount)}</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={s.deleteBtn} onPress={confirmDeletePo} disabled={updatingPo}>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={s.deleteBtnText}>Delete PO</Text>
                  </TouchableOpacity>
                  <View style={{ height: 20 }} />
                </ScrollView>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Install Modal */}
      <Modal visible={!!selectedStock} animationType="slide" transparent onRequestClose={() => setSelectedStock(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            {selectedStock && (
              <>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Log Site Installation</Text>
                  <TouchableOpacity onPress={() => setSelectedStock(null)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={s.installHighlight}>
                  <Text style={s.installHighlightName}>{selectedStock.productName}</Text>
                  <Text style={s.installHighlightAvail}>Available: {selectedStock.totalReceived - selectedStock.installedQuantity} {selectedStock.unit}</Text>
                </View>

                <Text style={s.label}>Quantity to Install ({selectedStock.unit})</Text>
                <TextInput style={s.input} placeholder="e.g. 10" placeholderTextColor="#94A3B8" keyboardType="numeric" value={installQty} onChangeText={setInstallQty} />

                <Text style={s.label}>Installation Notes</Text>
                <TextInput style={s.input} placeholder="e.g. Installed primary lines on Floor 4" placeholderTextColor="#94A3B8" value={installNotes} onChangeText={setInstallNotes} />

                <TouchableOpacity style={[s.saveBtn, (loggingInstall || !installQty) && { opacity: 0.6 }]} onPress={handleLogInstall} disabled={loggingInstall || !installQty}>
                  {loggingInstall ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Confirm Install</Text>}
                </TouchableOpacity>
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
  scroll: { paddingHorizontal: 20, paddingTop: 14 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  tabRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F8FAFC', alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#2563EB' },
  tabBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B' },
  tabBtnTextActive: { color: '#FFFFFF' },

  aggregateRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  aggregateCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  aggregateLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8' },
  aggregateValue: { fontSize: 15, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 4 },

  pipelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  pipelineTitle: { fontSize: 12, fontFamily: 'Inter-Bold' },
  pipelineCountBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, marginLeft: 'auto' },
  pipelineCountText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#64748B' },

  poCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 8, gap: 4 },
  poTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  poNumber: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  poAmount: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  poVendor: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  poBottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  poItemCount: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  poDate: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  emptySub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },

  invCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 12, gap: 10 },
  invTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  invName: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1 },
  installBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2563EB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  installBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  invStatsRow: { flexDirection: 'row' },
  invStatLabel: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#94A3B8' },
  invStatValue: { fontSize: 12.5, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 2 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#16A34A' },
  historyBox: { borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 8, gap: 8 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  historyText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  historyNotes: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  historyDate: { fontSize: 9.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  noHistoryText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', fontStyle: 'italic' },

  fab: {
    position: 'absolute', right: 20, bottom: 30,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },
  hintText: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginBottom: 4 },

  itemLineBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, marginTop: 14 },
  itemLineLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 8 },
  addLineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 10, paddingVertical: 8, marginTop: 8 },
  addLineBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#2563EB' },

  itemListBox: { borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, marginTop: 10, overflow: 'hidden' },
  itemListRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  itemListName: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  itemListMeta: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  itemListAmount: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#EFF6FF' },
  totalLabel: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#64748B' },
  totalValue: { fontSize: 13, fontFamily: 'Inter-Black', color: '#2563EB' },

  statusChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  statusChipText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  detailChip: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 10, padding: 10 },
  detailChipLabel: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#94A3B8' },
  detailChipValue: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2 },

  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, paddingVertical: 12, marginTop: 16 },
  deleteBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#DC2626' },

  installHighlight: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 12, padding: 12 },
  installHighlightName: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#166534' },
  installHighlightAvail: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#16A34A', marginTop: 2 },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

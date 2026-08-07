import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const STATUS_META = {
  approved: { color: '#16A34A', bg: '#F0FDF4' },
  pending_approval: { color: '#D97706', bg: '#FFFBEB' },
  rejected: { color: '#DC2626', bg: '#FEF2F2' },
  superseded: { color: '#64748B', bg: '#F1F5F9' },
  draft: { color: '#2563EB', bg: '#EFF6FF' },
};
const ITEM_CATEGORIES = ['Flooring', 'Woodwork', 'False Ceiling', 'Painting', 'Electrical', 'Plumbing', 'HVAC', 'Masonry', 'Other'];
const AVA_STATUS_META = {
  over_budget: { color: '#DC2626', bg: '#FEF2F2' },
  completed: { color: '#16A34A', bg: '#F0FDF4' },
  on_track: { color: '#2563EB', bg: '#EFF6FF' },
  in_progress: { color: '#D97706', bg: '#FFFBEB' },
  not_started: { color: '#64748B', bg: '#F1F5F9' },
};

function fmtMoney(n) { return `₹${Math.round(n || 0).toLocaleString('en-IN')}`; }

const emptyItemRow = () => ({ category: 'Flooring', itemName: '', quantity: '1', unit: 'sqft', rate: '0' });

export default function InteriorBoqScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('items');
  const [boqs, setBoqs] = useState([]);
  const [selectedBoq, setSelectedBoq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [actualData, setActualData] = useState(null);
  const [loadingActual, setLoadingActual] = useState(false);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newBoqNotes, setNewBoqNotes] = useState('');
  const [newItems, setNewItems] = useState([emptyItemRow()]);

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchBoqDetail = useCallback(async (boqId) => {
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/boq/${boqId}`);
      if (res?.success && res?.data) setSelectedBoq(res.data);
    } catch (e) {
      showToast('Failed to fetch BOQ details', 'error');
    }
  }, [projectId]);

  const fetchBoqs = useCallback(async (selectLatest = true) => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/boq`);
      const list = res?.success && res?.data ? res.data : [];
      setBoqs(list);
      if (selectLatest && list.length > 0) await fetchBoqDetail(list[0]._id);
    } catch (e) {
      console.error('Failed to load BOQs', e);
      showToast('Failed to fetch BOQ versions list', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, fetchBoqDetail]);

  const fetchActual = useCallback(async () => {
    setLoadingActual(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/boq/actual`);
      setActualData(res?.success && res?.data ? res.data : null);
    } catch (e) {
      setActualData(null);
    } finally {
      setLoadingActual(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchBoqs(); }, [fetchBoqs]));

  const switchTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'actual' && !actualData) fetchActual();
  };

  const handleApprovalAction = async (action, reason) => {
    if (!selectedBoq) return;
    setActionLoading(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/boq/${selectedBoq._id}/approve`, { action, reason });
      showToast(`BOQ successfully ${action}ed`, 'success');
      setIsRejectOpen(false);
      setRejectReason('');
      await fetchBoqs(false);
      await fetchBoqDetail(selectedBoq._id);
    } catch (e) {
      showToast(e.message || `Failed to ${action} BOQ`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRevision = async () => {
    if (!selectedBoq) return;
    setActionLoading(true);
    try {
      const res = await interiorApiClient.post(`/projects/${projectId}/boq/${selectedBoq._id}/revise`);
      if (res?.success && res?.data) {
        showToast(`New draft revision created: ${res.data.versionLabel}`, 'success');
        fetchBoqs(true);
      }
    } catch (e) {
      showToast(e.message || 'Failed to create BOQ revision', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeleteBoq = () => {
    Alert.alert('Delete BOQ Draft', 'Are you sure you want to delete this BOQ draft?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: handleDeleteBoq },
    ]);
  };

  const handleDeleteBoq = async () => {
    if (!selectedBoq) return;
    setActionLoading(true);
    try {
      await interiorApiClient.delete(`/projects/${projectId}/boq/${selectedBoq._id}`);
      showToast('Draft deleted successfully', 'delete');
      setSelectedBoq(null);
      fetchBoqs(true);
    } catch (e) {
      showToast(e.message || 'Failed to delete BOQ', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const pickExcelFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.length) setExcelFile(result.assets[0]);
  };

  const handleExcelImport = async () => {
    if (!excelFile) return showToast('Please choose a valid Excel file first', 'error');
    setImporting(true);
    try {
      const res = await interiorApiClient.postForm(`/projects/${projectId}/boq/import`, {
        file: { uri: excelFile.uri, name: excelFile.name, type: excelFile.mimeType || 'application/octet-stream' },
      });
      showToast(res?.message || 'Excel BOQ Imported Successfully!', 'success');
      setIsImportOpen(false);
      setExcelFile(null);
      fetchBoqs(true);
    } catch (e) {
      showToast(e.message || 'Failed to import Excel file', 'error');
    } finally {
      setImporting(false);
    }
  };

  const addItemRow = () => setNewItems((p) => [...p, { ...emptyItemRow(), category: p[p.length - 1]?.category || 'Flooring', unit: p[p.length - 1]?.unit || 'sqft' }]);
  const removeItemRow = (idx) => setNewItems((p) => p.filter((_, i) => i !== idx));
  const updateItemRow = (idx, field, val) => setNewItems((p) => p.map((it, i) => (i === idx ? { ...it, [field]: val } : it)));

  const handleManualCreate = async () => {
    if (newItems.some((it) => !it.itemName.trim())) return showToast('Please fill in all item names', 'error');
    setActionLoading(true);
    try {
      const items = newItems.map((it, idx) => ({
        serialNumber: idx + 1, category: it.category, itemName: it.itemName,
        quantity: parseFloat(it.quantity) || 0, unit: it.unit, rate: parseFloat(it.rate) || 0,
      }));
      await interiorApiClient.post(`/projects/${projectId}/boq`, { notes: newBoqNotes, items });
      showToast('BOQ Created Successfully!', 'success');
      setIsCreateOpen(false);
      setNewBoqNotes('');
      setNewItems([emptyItemRow()]);
      fetchBoqs(true);
    } catch (e) {
      showToast(e.message || 'Failed to create BOQ', 'error');
    } finally {
      setActionLoading(false);
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
            <Text style={s.headerTitle}>Bill of Quantities</Text>
            <Text style={s.headerSub}>Materials, pricing, and revision audits.</Text>
          </View>
          <TouchableOpacity style={s.headerIconBtn} onPress={() => setIsImportOpen(true)}>
            <Ionicons name="cloud-upload-outline" size={17} color="#2563EB" />
          </TouchableOpacity>
          <TouchableOpacity style={[s.headerIconBtn, { backgroundColor: '#2563EB' }]} onPress={() => setIsCreateOpen(true)}>
            <Ionicons name="add" size={17} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sectionLabel}>VERSIONS</Text>
            {boqs.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="document-outline" size={36} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No BOQ registered</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
                {boqs.map((boq) => {
                  const meta = STATUS_META[boq.status] || STATUS_META.draft;
                  const active = selectedBoq?._id === boq._id;
                  return (
                    <TouchableOpacity key={boq._id} style={[s.versionCard, active && s.versionCardActive]} onPress={() => fetchBoqDetail(boq._id)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[s.versionLabel, active && { color: '#2563EB' }]}>{boq.versionLabel}</Text>
                        <View style={[s.versionStatusBadge, { backgroundColor: meta.bg }]}>
                          <Text style={[s.versionStatusText, { color: meta.color }]}>{String(boq.status).replace('_', ' ')}</Text>
                        </View>
                      </View>
                      <Text style={s.versionAmount}>{fmtMoney(boq.totalAmount)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {selectedBoq && (
              <View style={s.summaryCard}>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Total Cost</Text>
                  <Text style={s.summaryValue}>{fmtMoney(selectedBoq.totalAmount)}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Created By</Text>
                  <Text style={s.summaryValue}>{selectedBoq.createdBy?.firstName} {selectedBoq.createdBy?.lastName}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Source</Text>
                  <Text style={[s.summaryValue, { textTransform: 'capitalize' }]}>{selectedBoq.importedFrom || 'manual'}</Text>
                </View>
                {!!selectedBoq.notes && (
                  <View style={s.notesBox}>
                    <Text style={s.notesText}>{selectedBoq.notes}</Text>
                  </View>
                )}

                <View style={{ marginTop: 12, gap: 8 }}>
                  {selectedBoq.status === 'draft' && (
                    <TouchableOpacity style={s.primaryBtn} onPress={() => handleApprovalAction('submit')} disabled={actionLoading}>
                      <Text style={s.primaryBtnText}>Submit for Approval</Text>
                    </TouchableOpacity>
                  )}
                  {selectedBoq.status === 'pending_approval' && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={[s.primaryBtn, { flex: 1, backgroundColor: '#059669' }]} onPress={() => handleApprovalAction('approve')} disabled={actionLoading}>
                        <Text style={s.primaryBtnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.primaryBtn, { flex: 1, backgroundColor: '#DC2626' }]} onPress={() => setIsRejectOpen(true)} disabled={actionLoading}>
                        <Text style={s.primaryBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {selectedBoq.status === 'approved' && (
                    <TouchableOpacity style={s.outlineBtn} onPress={handleCreateRevision} disabled={actionLoading}>
                      <Text style={s.outlineBtnText}>Create New Revision</Text>
                    </TouchableOpacity>
                  )}
                  {(selectedBoq.status === 'draft' || selectedBoq.status === 'rejected') && (
                    <TouchableOpacity style={[s.outlineBtn, { borderColor: '#FECACA' }]} onPress={confirmDeleteBoq} disabled={actionLoading}>
                      <Text style={[s.outlineBtnText, { color: '#DC2626' }]}>Delete Draft</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            <View style={s.tabRow}>
              <TouchableOpacity style={[s.tabBtn, activeTab === 'items' && s.tabBtnActive]} onPress={() => switchTab('items')}>
                <Text style={[s.tabBtnText, activeTab === 'items' && s.tabBtnTextActive]}>Line Items</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.tabBtn, activeTab === 'actual' && s.tabBtnActive]} onPress={() => switchTab('actual')}>
                <Text style={[s.tabBtnText, activeTab === 'actual' && s.tabBtnTextActive]}>BOQ vs Actual</Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'items' ? (
              selectedBoq ? (
                selectedBoq.items?.map((item, idx) => (
                  <View key={item._id || idx} style={s.itemCard}>
                    <View style={s.itemTopRow}>
                      <Text style={s.itemSerial}>#{item.serialNumber}</Text>
                      <View style={s.itemCategoryTag}>
                        <Text style={s.itemCategoryTagText}>{item.category}</Text>
                      </View>
                    </View>
                    <Text style={s.itemName}>{item.itemName}</Text>
                    <View style={s.itemBottomRow}>
                      <Text style={s.itemMeta}>{item.quantity?.toLocaleString('en-IN')} {item.unit} @ {fmtMoney(item.rate)}</Text>
                      <Text style={s.itemAmount}>{fmtMoney(item.amount)}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>Select or create a BOQ version to view items.</Text>
                </View>
              )
            ) : loadingActual ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2563EB" />
              </View>
            ) : !actualData ? (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>No approved BOQ found to compare. Approve a version first.</Text>
              </View>
            ) : (
              <>
                <View style={s.actualKpiRow}>
                  <View style={[s.actualKpiCard, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
                    <Text style={[s.actualKpiLabel, { color: '#2563EB' }]}>PLANNED</Text>
                    <Text style={s.actualKpiValue}>{fmtMoney(actualData.summary?.totalPlannedAmount)}</Text>
                  </View>
                  <View style={[s.actualKpiCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                    <Text style={[s.actualKpiLabel, { color: '#D97706' }]}>CONSUMED</Text>
                    <Text style={s.actualKpiValue}>{fmtMoney(actualData.summary?.totalConsumedAmount)}</Text>
                  </View>
                  <View style={[s.actualKpiCard, actualData.summary?.overallVariance > 0 ? { backgroundColor: '#FEF2F2', borderColor: '#FECACA' } : { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                    <Text style={[s.actualKpiLabel, { color: actualData.summary?.overallVariance > 0 ? '#DC2626' : '#16A34A' }]}>VARIANCE</Text>
                    <Text style={[s.actualKpiValue, { color: actualData.summary?.overallVariance > 0 ? '#DC2626' : '#16A34A' }]}>
                      {actualData.summary?.overallVariance > 0 ? '+' : ''}{actualData.summary?.overallVariance}%
                    </Text>
                  </View>
                </View>

                {actualData.items?.map((item, idx) => {
                  const meta = AVA_STATUS_META[item.status] || AVA_STATUS_META.not_started;
                  return (
                    <View key={item._id || idx} style={s.itemCard}>
                      <View style={s.itemTopRow}>
                        <Text style={s.itemName}>{item.itemName}</Text>
                        <View style={[s.itemCategoryTag, { backgroundColor: meta.bg }]}>
                          <Text style={[s.itemCategoryTagText, { color: meta.color }]}>{String(item.status).replace('_', ' ')}</Text>
                        </View>
                      </View>
                      <Text style={s.itemMeta}>{item.category} · {item.unit}</Text>
                      <View style={s.avaGrid}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.avaLabel}>Planned</Text>
                          <Text style={s.avaValue}>{item.plannedQuantity?.toLocaleString('en-IN')}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.avaLabel}>Consumed</Text>
                          <Text style={s.avaValue}>{item.consumedQuantity?.toLocaleString('en-IN')}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.avaLabel}>Variance</Text>
                          <Text style={[s.avaValue, { color: item.variancePercentage > 0 ? '#DC2626' : item.variancePercentage < 0 ? '#16A34A' : '#94A3B8' }]}>
                            {item.variancePercentage > 0 ? '+' : ''}{item.variancePercentage}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Excel import */}
      <Modal visible={isImportOpen} animationType="slide" transparent onRequestClose={() => setIsImportOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Import BOQ Excel Sheet</Text>
              <TouchableOpacity onPress={() => setIsImportOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={s.hintText}>Upload a spreadsheet (.xlsx/.xls). Columns auto-map to Category, Item Name, Quantity, Unit, and Rate.</Text>
            <TouchableOpacity style={s.uploadBox} onPress={pickExcelFile}>
              <Ionicons name="document-outline" size={26} color="#94A3B8" />
              <Text style={s.uploadBoxText} numberOfLines={1}>{excelFile ? excelFile.name : 'Tap to select Excel file'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: '#059669' }, importing && { opacity: 0.7 }]} onPress={handleExcelImport} disabled={importing}>
              {importing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Import & Process</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Manual create */}
      <Modal visible={isCreateOpen} animationType="slide" transparent onRequestClose={() => setIsCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '90%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Manual BOQ Entry</Text>
              <TouchableOpacity onPress={() => setIsCreateOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Revision Notes</Text>
              <TextInput style={s.input} placeholder="e.g. Initial draft base price calculations" placeholderTextColor="#94A3B8" value={newBoqNotes} onChangeText={setNewBoqNotes} />

              <View style={s.sectionHeaderRow}>
                <Text style={s.formSectionLabel}>BOQ LINE ITEMS ({newItems.length})</Text>
                <TouchableOpacity style={s.addRowBtn} onPress={addItemRow}>
                  <Text style={s.addRowBtnText}>+ Add Row</Text>
                </TouchableOpacity>
              </View>

              {newItems.map((item, idx) => (
                <View key={idx} style={s.itemRowBox}>
                  <View style={s.itemRowHeader}>
                    <Text style={s.itemRowNum}>#{idx + 1}</Text>
                    <TouchableOpacity onPress={() => removeItemRow(idx)} disabled={newItems.length === 1}>
                      <Ionicons name="close-circle" size={17} color={newItems.length === 1 ? '#CBD5E1' : '#EF4444'} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                    {ITEM_CATEGORIES.map((c) => (
                      <TouchableOpacity key={c} style={[s.miniChip, item.category === c && s.miniChipActive]} onPress={() => updateItemRow(idx, 'category', c)}>
                        <Text style={[s.miniChipText, item.category === c && s.miniChipTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TextInput style={[s.input, { marginBottom: 6 }]} placeholder="Item / material specifications" placeholderTextColor="#94A3B8" value={item.itemName} onChangeText={(v) => updateItemRow(idx, 'itemName', v)} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[s.input, { flex: 1 }]} placeholder="Qty" placeholderTextColor="#94A3B8" keyboardType="numeric" value={item.quantity} onChangeText={(v) => updateItemRow(idx, 'quantity', v)} />
                    <TextInput style={[s.input, { flex: 1 }]} placeholder="Unit" placeholderTextColor="#94A3B8" value={item.unit} onChangeText={(v) => updateItemRow(idx, 'unit', v)} />
                    <TextInput style={[s.input, { flex: 1 }]} placeholder="Rate ₹" placeholderTextColor="#94A3B8" keyboardType="numeric" value={item.rate} onChangeText={(v) => updateItemRow(idx, 'rate', v)} />
                  </View>
                </View>
              ))}

              <TouchableOpacity style={[s.saveBtn, actionLoading && { opacity: 0.7 }]} onPress={handleManualCreate} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Create BOQ Version</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reject reason */}
      <Modal visible={isRejectOpen} animationType="slide" transparent onRequestClose={() => setIsRejectOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Specify Rejection Reason</Text>
              <TouchableOpacity onPress={() => setIsRejectOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={s.label}>Comments *</Text>
            <TextInput style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Enter reason for rejecting this BOQ draft..." placeholderTextColor="#94A3B8" value={rejectReason} onChangeText={setRejectReason} multiline />
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: '#DC2626' }, (!rejectReason.trim() || actionLoading) && { opacity: 0.6 }]}
              onPress={() => handleApprovalAction('reject', rejectReason)}
              disabled={!rejectReason.trim() || actionLoading}
            >
              {actionLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Reject BOQ</Text>}
            </TouchableOpacity>
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

  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  headerIconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },

  sectionLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3, marginBottom: 8 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#64748B', textAlign: 'center' },

  versionCard: { width: 150, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  versionCardActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  versionLabel: { fontSize: 13, fontFamily: 'Inter-Black', color: '#0F172A' },
  versionStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  versionStatusText: { fontSize: 8, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
  versionAmount: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B', marginTop: 6 },

  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  summaryLabel: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  summaryValue: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  notesBox: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 8, marginTop: 8 },
  notesText: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#64748B' },

  primaryBtn: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  primaryBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  outlineBtn: { borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  outlineBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#2563EB' },

  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#2563EB' },
  tabBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B' },
  tabBtnTextActive: { color: '#FFFFFF' },

  itemCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 8, gap: 6 },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemSerial: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },
  itemCategoryTag: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  itemCategoryTagText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#64748B', textTransform: 'capitalize' },
  itemName: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1 },
  itemBottomRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 6 },
  itemMeta: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  itemAmount: { fontSize: 12, fontFamily: 'Inter-Black', color: '#0F172A' },

  actualKpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  actualKpiCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10 },
  actualKpiLabel: { fontSize: 8.5, fontFamily: 'Inter-Bold' },
  actualKpiValue: { fontSize: 13, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 4 },

  avaGrid: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 6 },
  avaLabel: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#94A3B8' },
  avaValue: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  hintText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginBottom: 10 },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  uploadBox: { height: 90, borderRadius: 14, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 8 },
  uploadBoxText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B', maxWidth: '100%' },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  formSectionLabel: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3 },
  addRowBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  addRowBtnText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#2563EB' },

  itemRowBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, marginBottom: 10 },
  itemRowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  itemRowNum: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#94A3B8' },

  miniChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  miniChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  miniChipText: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  miniChipTextActive: { color: '#2563EB' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator,
  TextInput, Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const RATINGS = [4.8, 4.2, 4.6, 3.9];
const COMPLIANCE = [95, 88, 92, 75];
const ON_TIME = [98, 80, 94, 70];
const FALLBACK_TRADES = ['Acoustic & Glazing', 'MEP Pipes', 'Interior Slabs', 'Finishes & Drywalls'];
const VENDOR_CATEGORIES = ['Raw Materials', 'Furniture', 'Electrical', 'Labour', 'Paint', 'Other'];

function formatCost(amount) {
  return `₹${Math.round(amount || 0).toLocaleString('en-IN')}`;
}

const emptyVendorForm = {
  name: '', vendorCategory: VENDOR_CATEGORIES[0], contactPerson: '',
  phoneNumber: '', email: '', address: '', gstNumber: '',
};

export default function InteriorVendorsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [dbVendors, setDbVendors] = useState([]);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vendorRes, poRes] = await Promise.allSettled([
        interiorApiClient.get('/vendors'),
        interiorApiClient.get(`/projects/${projectId}/procurement`),
      ]);
      setDbVendors(vendorRes.status === 'fulfilled' && vendorRes.value?.success ? vendorRes.value.data || [] : []);
      setPos(poRes.status === 'fulfilled' && poRes.value?.success ? poRes.value.data || [] : []);
    } catch (e) {
      console.error('Failed to load vendors', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAddModal = () => {
    setEditingVendor(null);
    setVendorForm(emptyVendorForm);
    setVendorModalOpen(true);
  };

  const openEditModal = (vendor) => {
    setEditingVendor(vendor);
    setVendorForm({
      name: vendor.name || '',
      vendorCategory: vendor.vendorCategory || VENDOR_CATEGORIES[0],
      contactPerson: vendor.contactPerson || '',
      phoneNumber: vendor.phoneNumber || '',
      email: vendor.email || '',
      address: vendor.address || '',
      gstNumber: vendor.gstNumber || '',
    });
    setVendorModalOpen(true);
  };

  const handleSaveVendor = async () => {
    if (!vendorForm.name.trim()) {
      showToast('Vendor name is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (editingVendor) {
        await interiorApiClient.patch(`/vendors/${editingVendor._id}`, vendorForm);
        showToast('Vendor updated successfully', 'success');
      } else {
        await interiorApiClient.post('/vendors', vendorForm);
        showToast('Vendor added successfully', 'success');
      }
      setVendorModalOpen(false);
      setEditingVendor(null);
      setVendorForm(emptyVendorForm);
      load();
    } catch (e) {
      showToast(e.message || 'Failed to save vendor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVendor = (vendor) => {
    Alert.alert('Delete Vendor', `Are you sure you want to remove "${vendor.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await interiorApiClient.delete(`/vendors/${vendor._id}`);
            showToast(`Vendor "${vendor.name}" deleted successfully.`, 'success');
            load();
          } catch (e) {
            showToast(e.message || 'Failed to delete vendor', 'error');
          }
        },
      },
    ]);
  };

  const vendorsMap = new Map();
  pos.forEach((po) => {
    const name = po.vendorName || 'Unknown Vendor';
    const existing = vendorsMap.get(name) || { count: 0, totalValue: 0 };
    vendorsMap.set(name, { count: existing.count + 1, totalValue: existing.totalValue + (po.amount || 0) });
  });

  const vendors = dbVendors.map((vendor, index) => {
    const stats = vendorsMap.get(vendor.name) || { count: 0, totalValue: 0 };
    return {
      raw: vendor,
      _id: vendor._id,
      name: vendor.name,
      trade: vendor.vendorCategory || FALLBACK_TRADES[index % 4],
      gstNumber: vendor.gstNumber,
      contractsCount: stats.count,
      totalValue: stats.totalValue,
      rating: RATINGS[index % 4],
      compliance: COMPLIANCE[index % 4],
      onTime: ON_TIME[index % 4],
    };
  });

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Vendors & Subcontractors</Text>
            <Text style={s.headerSub}>Ratings, compliance, and contract values.</Text>
          </View>
          <TouchableOpacity style={s.addVendorBtn} onPress={openAddModal}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={s.addVendorBtnText}>Add Vendor</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {vendors.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="car-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No vendors found in the database</Text>
                <Text style={s.emptySub}>Tap "Add Vendor" to register a new vendor.</Text>
              </View>
            ) : (
              vendors.map((vendor) => (
                <View key={vendor._id || vendor.name} style={s.vendorCard}>
                  <View style={s.vendorTopRow}>
                    <View style={s.vendorIconBox}>
                      <Ionicons name="car-outline" size={18} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.vendorName} numberOfLines={1}>{vendor.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={s.vendorTrade}>{vendor.trade}</Text>
                        {!!vendor.gstNumber && (
                          <View style={s.gstBadge}><Text style={s.gstBadgeText}>GST: {vendor.gstNumber}</Text></View>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => openEditModal(vendor.raw)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="pencil-outline" size={15} color="#94A3B8" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteVendor(vendor)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={{ marginLeft: 10 }}>
                      <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  <View style={s.statsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.statLabel}>Contracts Held</Text>
                      <Text style={s.statValue}>{vendor.contractsCount} Purchase Orders</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.statLabel}>Total Contract Value</Text>
                      <Text style={[s.statValue, { color: '#2563EB' }]}>{formatCost(vendor.totalValue)}</Text>
                    </View>
                  </View>

                  <Text style={s.perfTitle}>PERFORMANCE INDICATORS</Text>
                  <View style={{ gap: 10 }}>
                    <View>
                      <View style={s.perfRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="shield-checkmark-outline" size={13} color="#16A34A" />
                          <Text style={s.perfLabel}>Quality Compliance</Text>
                        </View>
                        <Text style={s.perfValue}>{vendor.compliance}%</Text>
                      </View>
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${vendor.compliance}%`, backgroundColor: '#10B981' }]} />
                      </View>
                    </View>
                    <View>
                      <View style={s.perfRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="time-outline" size={13} color="#2563EB" />
                          <Text style={s.perfLabel}>On-Time Delivery Rate</Text>
                        </View>
                        <Text style={s.perfValue}>{vendor.onTime}%</Text>
                      </View>
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${vendor.onTime}%`, backgroundColor: '#3B82F6' }]} />
                      </View>
                    </View>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={vendorModalOpen} animationType="slide" transparent onRequestClose={() => setVendorModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</Text>
              <TouchableOpacity onPress={() => setVendorModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Vendor Name *</Text>
              <TextInput style={s.input} placeholder="e.g. BuildTech Suppliers" placeholderTextColor="#94A3B8" value={vendorForm.name} onChangeText={(v) => setVendorForm({ ...vendorForm, name: v })} />

              <Text style={s.label}>Category</Text>
              <View style={s.pillWrap}>
                {VENDOR_CATEGORIES.map((c) => (
                  <TouchableOpacity key={c} style={[s.pill, vendorForm.vendorCategory === c && s.pillActive]} onPress={() => setVendorForm({ ...vendorForm, vendorCategory: c })}>
                    <Text style={[s.pillText, vendorForm.vendorCategory === c && s.pillTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>GST Number</Text>
              <TextInput style={s.input} placeholder="e.g. 27AAAPL1234C1ZV" placeholderTextColor="#94A3B8" autoCapitalize="characters" value={vendorForm.gstNumber} onChangeText={(v) => setVendorForm({ ...vendorForm, gstNumber: v })} />

              <Text style={s.label}>Billing Address</Text>
              <TextInput style={s.input} placeholder="Full physical or billing address" placeholderTextColor="#94A3B8" value={vendorForm.address} onChangeText={(v) => setVendorForm({ ...vendorForm, address: v })} />

              <Text style={s.label}>Contact Person</Text>
              <TextInput style={s.input} placeholder="e.g. Ramesh" placeholderTextColor="#94A3B8" value={vendorForm.contactPerson} onChangeText={(v) => setVendorForm({ ...vendorForm, contactPerson: v })} />

              <Text style={s.label}>Phone</Text>
              <TextInput style={s.input} placeholder="+91..." placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={vendorForm.phoneNumber} onChangeText={(v) => setVendorForm({ ...vendorForm, phoneNumber: v })} />

              <Text style={s.label}>Email</Text>
              <TextInput style={s.input} placeholder="supplier@mail.com" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" value={vendorForm.email} onChangeText={(v) => setVendorForm({ ...vendorForm, email: v })} />

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.6 }]} onPress={handleSaveVendor} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>{editingVendor ? 'Save Changes' : 'Add Vendor'}</Text>}
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
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  addVendorBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addVendorBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  pillActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  pillText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  pillTextActive: { color: '#FFFFFF' },
  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#7C3AED', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  emptySub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },

  vendorCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 12 },
  vendorTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vendorIconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  vendorName: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  vendorTrade: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  gstBadge: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  gstBadgeText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#334155', textTransform: 'uppercase' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  ratingBadgeText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#D97706' },

  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F8FAFC', paddingVertical: 10 },
  statLabel: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  statValue: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2 },

  perfTitle: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3 },
  perfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  perfLabel: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B' },
  perfValue: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
});

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator,
  TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const RATINGS = [4.8, 4.2, 4.6, 3.9];
const COMPLIANCE = [95, 88, 92, 75];
const ON_TIME = [98, 80, 94, 70];
const TRADES = ['Acoustic & Glazing', 'MEP Pipes', 'Interior Slabs', 'Finishes & Drywalls'];
const VENDOR_CATEGORIES = ['Raw Materials', 'Furniture', 'Electrical', 'Labour', 'Paint', 'Other'];

function formatCost(amount) {
  return `₹${Math.round(amount || 0).toLocaleString('en-IN')}`;
}

const emptyVendorForm = {
  name: '', vendorCategory: VENDOR_CATEGORIES[0], contactPerson: '',
  phoneNumber: '', email: '', address: '',
};

export default function InteriorVendorsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/procurement`);
      setPos(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load POs', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAddVendor = async () => {
    if (!vendorForm.name.trim()) {
      showToast('Vendor name is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await interiorApiClient.post('/vendors', vendorForm);
      showToast('Vendor added successfully', 'success');
      setAddVendorOpen(false);
      setVendorForm(emptyVendorForm);
    } catch (e) {
      showToast(e.message || 'Failed to add vendor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const vendorsMap = new Map();
  pos.forEach((po) => {
    const name = po.vendorName || 'Unknown Vendor';
    const existing = vendorsMap.get(name) || { count: 0, totalValue: 0 };
    vendorsMap.set(name, { count: existing.count + 1, totalValue: existing.totalValue + (po.amount || 0) });
  });

  const vendors = Array.from(vendorsMap.entries()).map(([name, stats], i) => ({
    name,
    trade: TRADES[i % 4],
    contractsCount: stats.count,
    totalValue: stats.totalValue,
    rating: RATINGS[i % 4],
    compliance: COMPLIANCE[i % 4],
    onTime: ON_TIME[i % 4],
  }));

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
          <TouchableOpacity style={s.addVendorBtn} onPress={() => setAddVendorOpen(true)}>
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
                <Text style={s.emptyTitle}>No active vendors found</Text>
                <Text style={s.emptySub}>Vendors register here once a Purchase Order is issued.</Text>
              </View>
            ) : (
              vendors.map((vendor) => (
                <View key={vendor.name} style={s.vendorCard}>
                  <View style={s.vendorTopRow}>
                    <View style={s.vendorIconBox}>
                      <Ionicons name="car-outline" size={18} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.vendorName} numberOfLines={1}>{vendor.name}</Text>
                      <Text style={s.vendorTrade}>{vendor.trade}</Text>
                    </View>
                    <View style={s.ratingBadge}>
                      <Ionicons name="star" size={12} color="#D97706" />
                      <Text style={s.ratingBadgeText}>{vendor.rating}</Text>
                    </View>
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

      <Modal visible={addVendorOpen} animationType="slide" transparent onRequestClose={() => setAddVendorOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add New Vendor</Text>
              <TouchableOpacity onPress={() => setAddVendorOpen(false)}>
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

              <Text style={s.label}>Billing Address</Text>
              <TextInput style={s.input} placeholder="Full physical or billing address" placeholderTextColor="#94A3B8" value={vendorForm.address} onChangeText={(v) => setVendorForm({ ...vendorForm, address: v })} />

              <Text style={s.label}>Contact Person</Text>
              <TextInput style={s.input} placeholder="e.g. Ramesh" placeholderTextColor="#94A3B8" value={vendorForm.contactPerson} onChangeText={(v) => setVendorForm({ ...vendorForm, contactPerson: v })} />

              <Text style={s.label}>Phone</Text>
              <TextInput style={s.input} placeholder="+91..." placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={vendorForm.phoneNumber} onChangeText={(v) => setVendorForm({ ...vendorForm, phoneNumber: v })} />

              <Text style={s.label}>Email</Text>
              <TextInput style={s.input} placeholder="supplier@mail.com" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" value={vendorForm.email} onChangeText={(v) => setVendorForm({ ...vendorForm, email: v })} />

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.6 }]} onPress={handleAddVendor} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Add Vendor</Text>}
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

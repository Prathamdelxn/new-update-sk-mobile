import { tr } from '../../utils/i18n/tr';
import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator,
  TextInput, Modal, KeyboardAvoidingView, Platform, Alert, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useOrgCurrency } from '../../utils/interior/orgCurrency';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';
import { useInteriorPermissions } from '../../utils/interior/useInteriorPermissions';
import SelectField from '../../components/common/SelectField';
import SkeletonList from '../../components/common/SkeletonList';

const VENDOR_CATEGORIES = ['Raw Materials', 'Furniture', 'Electrical', 'Labour', 'Paint', 'Other'];

const emptyVendorForm = {
  name: '', vendorCategory: VENDOR_CATEGORIES[0], contactPerson: '',
  phoneNumber: '', email: '', address: '', gstNumber: '',
};

export default function InteriorVendorsScreen() {
  const orgCurrency = useOrgCurrency();
  const formatCost = orgCurrency.money;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  // Also used as the org-wide Vendor Management screen (no project → no PO stats)
  const isOrgView = !projectId;
  const { showToast } = useToast();
const { hasPermission: canDo } = useInteriorPermissions();

  const [dbVendors, setDbVendors] = useState([]);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);
  // Web Vendor Management filters: search, category, partner status, sort order
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vendorRes, poRes] = await Promise.allSettled([
        interiorApiClient.get('/vendors'),
        isOrgView ? Promise.resolve(null) : interiorApiClient.get(`/projects/${projectId}/procurement`),
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
      showToast(tr("Vendor name is required"), 'error');
      return;
    }
    // Same cleanup as the web form: trim everything and leave out empty optional fields,
    // so blank email / phone / GST don't fail the server's format checks
    const payload = { name: vendorForm.name.trim(), vendorCategory: vendorForm.vendorCategory };
    ['contactPerson', 'email', 'phoneNumber', 'gstNumber', 'address'].forEach((k) => {
      const v = String(vendorForm[k] || '').trim();
      if (v) payload[k] = v;
    });
    setSubmitting(true);
    try {
      if (editingVendor) {
        await interiorApiClient.patch(`/vendors/${editingVendor._id}`, payload);
        showToast(tr("Vendor updated successfully"), 'success');
      } else {
        await interiorApiClient.post('/vendors', payload);
        showToast(tr("Vendor added successfully"), 'success');
      }
      setVendorModalOpen(false);
      setEditingVendor(null);
      setVendorForm(emptyVendorForm);
      load();
    } catch (e) {
      showToast(e.message || tr("Failed to save vendor"), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVendor = (vendor) => {
    Alert.alert(tr("Delete Vendor"), tr("Are you sure you want to remove \"{{name}}\"? This cannot be undone.", { name: vendor.name }), [
      { text: tr("Cancel"), style: 'cancel' },
      {
        text: tr("Delete"), style: 'destructive', onPress: async () => {
          try {
            await interiorApiClient.delete(`/vendors/${vendor._id}`);
            showToast(tr("Vendor \"{{name}}\" deleted successfully.", { name: vendor.name }), 'success');
            load();
          } catch (e) {
            showToast(e.message || tr("Failed to delete vendor"), 'error');
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

  const q = searchQuery.toLowerCase().trim();
  const activeFiltersCount = [categoryFilter !== 'All', statusFilter !== 'all', sortBy !== 'newest'].filter(Boolean).length;
  const categoryOptions = [...new Set([...VENDOR_CATEGORIES, ...dbVendors.map((v) => v.vendorCategory || v.category).filter(Boolean)])];
  const resetFilters = () => { setCategoryFilter('All'); setStatusFilter('all'); setSortBy('newest'); };
  const visibleVendors = dbVendors.filter((v) => {
    const cat = v.vendorCategory || v.category || 'Other';
    const matchesSearch = !q || [v.name, v.vendorCode, v.contactPerson, v.email, v.phoneNumber || v.phone, v.gstNumber, cat]
      .some((x) => String(x || '').toLowerCase().includes(q));
    const matchesCategory = categoryFilter === 'All' || cat === categoryFilter;
    const matchesStatus = statusFilter === 'all' || (v.status || 'Active').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesCategory && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '');
    if (sortBy === 'category') return (a.vendorCategory || a.category || 'Other').localeCompare(b.vendorCategory || b.category || 'Other');
    if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return 0;
  });

  const vendors = visibleVendors.map((vendor, index) => {
    const stats = vendorsMap.get(vendor.name) || { count: 0, totalValue: 0 };
    return {
      raw: vendor,
      _id: vendor._id,
      name: vendor.name,
      trade: vendor.vendorCategory || vendor.category || 'Other',
      gstNumber: vendor.gstNumber,
      contractsCount: stats.count,
      totalValue: stats.totalValue,
    };
  });

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{isOrgView ? tr("Vendor Management") : tr("Vendors & Subcontractors")}</Text>
          </View>
          {canDo('vendors', 'create') && (
            <TouchableOpacity style={s.addVendorBtn} onPress={openAddModal}>
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={s.addVendorBtnText}>{tr("Add Vendor")}</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <SkeletonList />
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {dbVendors.length > 0 && (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={s.searchBox}>
                    <Ionicons name="search" size={15} color="#94A3B8" />
                    <TextInput
                      style={s.searchInput}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder={tr("Search vendors by name, category, contact, GSTIN...")}
                      placeholderTextColor="#94A3B8"
                    />
                    {!!searchQuery && (
                      <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                        <Ionicons name="close-circle" size={15} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[s.filterBtn, (showFilters || activeFiltersCount > 0) && s.filterBtnActive]}
                    onPress={() => setShowFilters((v) => !v)}
                  >
                    <Ionicons name="options-outline" size={17} color={(showFilters || activeFiltersCount > 0) ? '#FFFFFF' : '#475569'} />
                    {activeFiltersCount > 0 && <View style={s.filterCount}><Text style={s.filterCountText}>{tr(activeFiltersCount)}</Text></View>}
                  </TouchableOpacity>
                </View>
                {showFilters && (
                  <View style={s.filterPanel}>
                    <View style={s.filterCell}>
                      <Text style={s.label}>{tr("Vendor Category")}</Text>
                      <SelectField value={categoryFilter} onChange={setCategoryFilter} options={[{ value: 'All', label: 'All Categories' }, ...categoryOptions]} />
                    </View>
                    <View style={s.filterCell}>
                      <Text style={s.label}>{tr("Partner Status")}</Text>
                      <SelectField value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All Statuses' }, { value: 'Active', label: 'Active Only' }, { value: 'Inactive', label: 'Inactive' }]} />
                    </View>
                    <View style={s.filterCell}>
                      <Text style={s.label}>{tr("Sort Order")}</Text>
                      <SelectField
                        value={sortBy}
                        onChange={setSortBy}
                        options={[
                          { value: 'newest', label: 'Recently Added (Default)' },
                          { value: 'name-asc', label: 'Name: A → Z' },
                          { value: 'name-desc', label: 'Name: Z → A' },
                          { value: 'category', label: 'Category' },
                        ]}
                      />
                    </View>
                    {activeFiltersCount > 0 && (
                      <TouchableOpacity onPress={resetFilters} style={{ alignSelf: 'flex-end' }}>
                        <Text style={s.resetText}>{tr("Reset Filters")}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
            {dbVendors.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="car-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>{tr("No vendors registered yet")}</Text>
              </View>
            ) : vendors.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="search-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>{tr("No matching vendors found")}</Text>
                <Text style={s.emptySub}>{tr("Try adjusting your search query or filters.")}</Text>
                <TouchableOpacity onPress={() => { resetFilters(); setSearchQuery(''); }}>
                  <Text style={[s.resetText, { marginTop: 8 }]}>{tr("Reset Filters")}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              vendors.map((vendor) => (
                <View key={vendor._id || vendor.name} style={s.vendorCard}>
                  <View style={s.vendorTopRow}>
                    <View style={s.vendorIconBox}>
                      <Ionicons name="car-outline" size={18} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.vendorName} numberOfLines={1}>{tr(vendor.name)}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={s.vendorTrade}>{tr(vendor.trade)}</Text>
                        {!!vendor.gstNumber && (
                          <View style={s.gstBadge}><Text style={s.gstBadgeText}>{tr("GST: ")}{tr(vendor.gstNumber)}</Text></View>
                        )}
                      </View>
                    </View>
                    {canDo('vendors', 'update') && (
                      <TouchableOpacity onPress={() => openEditModal(vendor.raw)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="pencil-outline" size={15} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                    {canDo('vendors', 'delete') && (
                      <TouchableOpacity onPress={() => handleDeleteVendor(vendor)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={{ marginLeft: 10 }}>
                        <Ionicons name="trash-outline" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {isOrgView ? (
                    <View style={{ gap: 5, marginTop: 10 }}>
                      {!!vendor.raw.contactPerson && (
                        <View style={s.contactRow}><Ionicons name="person-outline" size={13} color="#64748B" /><Text style={s.contactText}>{tr(vendor.raw.contactPerson)}</Text></View>
                      )}
                      {!!vendor.raw.phoneNumber && (
                        <View style={s.contactRow}>
                          <Ionicons name="call-outline" size={13} color="#64748B" />
                          <Text style={[s.contactText, { flex: 1 }]}>{tr(vendor.raw.phoneNumber)}</Text>
                          <TouchableOpacity
                            onPress={() => {
                              const digits = String(vendor.raw.phoneNumber).replace(/\D/g, '');
                              Linking.openURL(`https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`).catch(() => {});
                            }}
                            hitSlop={6}
                            accessibilityLabel={tr("Chat on WhatsApp")}
                          >
                            <Ionicons name="logo-whatsapp" size={15} color="#16A34A" />
                          </TouchableOpacity>
                        </View>
                      )}
                      {!!vendor.raw.email && (
                        <View style={s.contactRow}><Ionicons name="mail-outline" size={13} color="#64748B" /><Text style={s.contactText} numberOfLines={1}>{vendor.raw.email}</Text></View>
                      )}
                      {!!vendor.raw.address && (
                        <View style={s.contactRow}><Ionicons name="location-outline" size={13} color="#64748B" /><Text style={s.contactText} numberOfLines={2}>{tr(vendor.raw.address)}</Text></View>
                      )}
                      {!vendor.raw.contactPerson && !vendor.raw.phoneNumber && !vendor.raw.email && !vendor.raw.address && (
                        <Text style={s.contactText}>{tr("No contact details added.")}</Text>
                      )}
                    </View>
                  ) : (
                  <>
                  <View style={s.statsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.statLabel}>{tr("Contracts Held")}</Text>
                      <Text style={s.statValue}>{tr(vendor.contractsCount)}{tr(" Purchase Orders")}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.statLabel}>{tr("Total Contract Value")}</Text>
                      <Text style={[s.statValue, { color: '#2563EB' }]}>{formatCost(vendor.totalValue)}</Text>
                    </View>
                  </View>
                  </>
                  )}
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
              <Text style={s.modalTitle}>{editingVendor ? tr("Edit Vendor") : tr("Add New Vendor")}</Text>
              <TouchableOpacity onPress={() => setVendorModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>{tr("Vendor Name *")}</Text>
              <TextInput style={s.input} placeholder={tr("e.g. BuildTech Suppliers")} placeholderTextColor="#94A3B8" value={vendorForm.name} onChangeText={(v) => setVendorForm({ ...vendorForm, name: v })} />

              <Text style={s.label}>{tr("Category")}</Text>
              <View style={s.pillWrap}>
                {VENDOR_CATEGORIES.map((c) => (
                  <TouchableOpacity key={c} style={[s.pill, vendorForm.vendorCategory === c && s.pillActive]} onPress={() => setVendorForm({ ...vendorForm, vendorCategory: c })}>
                    <Text style={[s.pillText, vendorForm.vendorCategory === c && s.pillTextActive]}>{tr(c)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>{tr("GST Number")}</Text>
              <TextInput style={s.input} placeholder={tr("e.g. 27AAAPL1234C1ZV")} placeholderTextColor="#94A3B8" autoCapitalize="characters" value={vendorForm.gstNumber} onChangeText={(v) => setVendorForm({ ...vendorForm, gstNumber: v })} />

              <Text style={s.label}>{tr("Billing Address")}</Text>
              <TextInput style={s.input} placeholder={tr("Full physical or billing address")} placeholderTextColor="#94A3B8" value={vendorForm.address} onChangeText={(v) => setVendorForm({ ...vendorForm, address: v })} />

              <Text style={s.label}>{tr("Contact Person")}</Text>
              <TextInput style={s.input} placeholder={tr("e.g. Ramesh")} placeholderTextColor="#94A3B8" value={vendorForm.contactPerson} onChangeText={(v) => setVendorForm({ ...vendorForm, contactPerson: v })} />

              <Text style={s.label}>{tr("Phone")}</Text>
              <TextInput style={s.input} placeholder="+91..." placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={vendorForm.phoneNumber} onChangeText={(v) => setVendorForm({ ...vendorForm, phoneNumber: v })} />

              <Text style={s.label}>{tr("Email")}</Text>
              <TextInput style={s.input} placeholder={tr("supplier@mail.com")} placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" value={vendorForm.email} onChangeText={(v) => setVendorForm({ ...vendorForm, email: v })} />

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.6 }]} onPress={handleSaveVendor} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>{editingVendor ? tr("Save Changes") : tr("Add Vendor")}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#475569', flexShrink: 1 },
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A' },
  filterBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterCount: { position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#E11D48', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterCountText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  filterPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 12, paddingTop: 2 },
  filterCell: {},
  resetText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#E11D48', marginTop: 10 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },

  addVendorBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addVendorBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  label: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter-Regular', color: '#0F172A',
  },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  pillActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  pillText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  pillTextActive: { color: '#FFFFFF' },
  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#7C3AED', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  emptySub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },

  vendorCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 12 },
  vendorTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vendorIconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  vendorName: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  vendorTrade: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  gstBadge: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  gstBadgeText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#334155', textTransform: 'uppercase' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  ratingBadgeText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#D97706' },

  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F8FAFC', paddingVertical: 10 },
  statLabel: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  statValue: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2 },

  perfTitle: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3 },
  perfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  perfLabel: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B' },
  perfValue: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
});

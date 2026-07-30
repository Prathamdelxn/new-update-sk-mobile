import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Dimensions, Modal, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdaptiveGlass from '../components/AdaptiveGlass';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function VendorManagementDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();

  const hasPermission = (moduleId, action) => {
    if (!user || !user.role) return false;
    const perms = user.role.permissions || [];
    if (perms.includes('*')) return true;
    return perms.includes(`${moduleId}:${action}`) || perms.includes(moduleId);
  };

  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const [isAddVendorVisible, setIsAddVendorVisible] = useState(false);
  const [isEditingVendor, setIsEditingVendor] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorContact, setNewVendorContact] = useState('');
  const [newVendorEmail, setNewVendorEmail] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');

  const { showToast } = useToast();

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/vendors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setVendors(data);
      }
    } catch (e) {
      console.error('Fetch vendors error', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveVendor = async () => {
    if (!newVendorName.trim()) {
        showToast("Vendor name is required", "error");
        return;
    }

    try {
      setIsCreating(true);
      const url = isEditingVendor ? `${API_BASE_URL}/vendors/${editingVendorId}` : `${API_BASE_URL}/vendors`;
      const method = isEditingVendor ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newVendorName,
          contactPerson: newVendorContact,
          email: newVendorEmail,
          phoneNumber: newVendorPhone,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (isEditingVendor) {
          setVendors(prev => prev.map(v => v._id === editingVendorId ? data : v));
          showToast('Vendor updated successfully', 'success');
        } else {
          setVendors(prev => [data, ...prev]);
          showToast('Vendor created successfully', 'success');
        }
        closeVendorModal();
      } else {
        showToast(data.message || 'Operation failed', 'error');
      }
    } catch (e) {
      showToast(t('networkErrorTryAgain'), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const closeVendorModal = () => {
    setIsAddVendorVisible(false);
    setIsEditingVendor(false);
    setEditingVendorId(null);
    setNewVendorName('');
    setNewVendorContact('');
    setNewVendorEmail('');
    setNewVendorPhone('');
  };

  const handleEditVendor = (vendor) => {
    if (!hasPermission('vendors', 'update')) {
      showToast("You don't have permission to update vendors.", "error");
      return;
    }
    setIsEditingVendor(true);
    setEditingVendorId(vendor._id);
    setNewVendorName(vendor.name);
    setNewVendorContact(vendor.contactPerson || '');
    setNewVendorEmail(vendor.email || '');
    setNewVendorPhone(vendor.phoneNumber || '');
    setIsAddVendorVisible(true);
  };

  const handleDeleteVendor = (vendor) => {
    if (!hasPermission('vendors', 'delete')) {
      showToast("You don't have permission to delete vendors.", "error");
      return;
    }
    Alert.alert(
      'Delete Vendor',
      `Are you sure you want to delete "${vendor.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/vendors/${vendor._id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (response.ok) {
                setVendors(prev => prev.filter(v => v._id !== vendor._id));
                showToast('Vendor deleted successfully.', 'delete');
              } else {
                const data = await response.json();
                showToast(data.message || 'Deletion failed', 'error');
              }
            } catch (e) {
              showToast('Network request failed', 'error');
            }
          }
        }
      ]
    );
  };

  const processedVendors = useMemo(() => {
    let filtered = vendors.filter(vendor =>
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (vendor.contactPerson && vendor.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [vendors, searchQuery, sortBy]);

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="dark-content" />
      <SimpleBackground />

      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerPreTitle}>{t('settings')}</Text>
            <Text style={styles.headerTitle}>{t('vendorManagement')}</Text>
          </View>

          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => setSortBy(prev => prev === 'name' ? 'date' : 'name')}
            activeOpacity={0.7}
          >
            <Ionicons name={sortBy === 'name' ? "filter-outline" : "list-outline"} size={22} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {/* Global Search */}
        <View style={styles.topFilterSection}>
          <AdaptiveGlass intensity={10} tint="light" style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search vendors..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </AdaptiveGlass>
        </View>

        <ScrollView
          style={styles.contentScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>All Vendors</Text>
            <Text style={styles.listCount}>{processedVendors.length} Vendors</Text>
          </View>

          {isLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={{ marginTop: 12, color: '#94A3B8', fontFamily: 'Inter-SemiBold' }}>Fetching vendors...</Text>
            </View>
          ) : processedVendors.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="briefcase-outline" size={48} color="#CBD5E1" />
                <Text style={{ marginTop: 12, color: '#94A3B8', fontFamily: 'Inter-SemiBold', textAlign: 'center' }}>No vendors found. Add your first vendor to get started.</Text>
            </View>
          ) : (
            processedVendors.map((vendor) => (
              <View key={vendor._id}>
                <AdaptiveGlass intensity={15} tint="light" style={styles.vendorCard}>
                  <View style={styles.vendorInfo}>
                    <View style={styles.textContainer}>
                      <View style={styles.vendorTitleRow}>
                        <Text style={styles.vendorTitle}>{vendor.name}</Text>
                        {vendor.status === 'Active' ? 
                            <View style={styles.statusBadgeActive}><Text style={styles.statusTextActive}>Active</Text></View> : 
                            <View style={styles.statusBadgeInactive}><Text style={styles.statusTextInactive}>Inactive</Text></View>
                        }
                      </View>
                      {vendor.contactPerson && <Text style={styles.vendorSubtitle}><Ionicons name="person-outline" size={12} color="#94A3B8" /> {vendor.contactPerson}</Text>}
                      {vendor.email && <Text style={styles.vendorSubtitle}><Ionicons name="mail-outline" size={12} color="#94A3B8" /> {vendor.email}</Text>}
                      {vendor.phoneNumber && <Text style={styles.vendorSubtitle}><Ionicons name="call-outline" size={12} color="#94A3B8" /> {vendor.phoneNumber}</Text>}
                    </View>
                  </View>

                  <View style={styles.vendorActions}>
                    <TouchableOpacity
                      style={styles.vendorActionBtn}
                      onPress={() => handleEditVendor(vendor)}
                    >
                      <Ionicons name="create-outline" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.vendorActionBtn, styles.vendorDeleteBtn]}
                      onPress={() => handleDeleteVendor(vendor)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </AdaptiveGlass>
              </View>
            ))
          )}
        </ScrollView>

        {/* FAB for Add Vendor */}
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 24 }]}
          onPress={() => { 
            if (!hasPermission('vendors', 'create')) {
              showToast("You don't have permission to add vendors.", "error");
              return;
            }
            setIsEditingVendor(false); setIsAddVendorVisible(true); 
          }}
          activeOpacity={0.9}
        >
          <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.fabGradient}>
            <Ionicons name="add" size={30} color="#FFFFFF" />
            <Text style={styles.fabText}>Add Vendor</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Add Vendor Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isAddVendorVisible}
          onRequestClose={closeVendorModal}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={closeVendorModal} />
            <AdaptiveGlass intensity={60} tint="light" style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditingVendor ? 'Update Vendor' : 'Add Vendor'}
                </Text>
                <TouchableOpacity onPress={closeVendorModal}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity>
              </View>
              
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Vendor Name *</Text>
                <AdaptiveGlass intensity={10} tint="light" style={styles.inputBox}>
                    <TextInput style={styles.textInput} placeholder="e.g. Acme Corp" placeholderTextColor="#94A3B8" value={newVendorName} onChangeText={setNewVendorName} />
                </AdaptiveGlass>

                <Text style={styles.inputLabel}>Contact Person</Text>
                <AdaptiveGlass intensity={10} tint="light" style={styles.inputBox}>
                    <TextInput style={styles.textInput} placeholder="e.g. John Doe" placeholderTextColor="#94A3B8" value={newVendorContact} onChangeText={setNewVendorContact} />
                </AdaptiveGlass>

                <Text style={styles.inputLabel}>Email Address</Text>
                <AdaptiveGlass intensity={10} tint="light" style={styles.inputBox}>
                    <TextInput style={styles.textInput} placeholder="e.g. john@acme.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#94A3B8" value={newVendorEmail} onChangeText={setNewVendorEmail} />
                </AdaptiveGlass>
                
                <Text style={styles.inputLabel}>Phone Number</Text>
                <AdaptiveGlass intensity={10} tint="light" style={styles.inputBox}>
                    <TextInput style={styles.textInput} placeholder="e.g. +1 234 567 8900" keyboardType="phone-pad" placeholderTextColor="#94A3B8" value={newVendorPhone} onChangeText={setNewVendorPhone} />
                </AdaptiveGlass>

                <TouchableOpacity
                    style={styles.createBtn}
                    onPress={saveVendor}
                    activeOpacity={0.8}
                    disabled={isCreating}
                >
                    <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.createBtnGradient}>
                    {isCreating ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <Text style={styles.createBtnText}>
                        {isEditingVendor ? 'Save Changes' : 'Add Vendor'}
                        </Text>
                    )}
                    </LinearGradient>
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
            </AdaptiveGlass>
          </KeyboardAvoidingView>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, marginBottom: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0F2FE' },
  headerActionBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(59, 130, 246, 0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.1)' },
  headerTitleContainer: { flex: 1, marginLeft: 16 },
  headerPreTitle: { fontSize: 11, color: '#3B82F6', fontFamily: 'Inter-Black', textTransform: 'uppercase', letterSpacing: 1.5 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', letterSpacing: -0.5 },
  topFilterSection: { paddingHorizontal: 24, marginBottom: 16 },
  searchBar: { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0F2FE', marginBottom: 0 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  contentScroll: { flex: 1, paddingHorizontal: 24 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4, marginTop: 12 },
  listTitle: { fontSize: 13, color: '#94A3B8', fontFamily: 'Inter-Black', textTransform: 'uppercase', letterSpacing: 1.5 },
  listCount: { fontSize: 12, color: '#94A3B8', fontFamily: 'Inter-SemiBold' },
  vendorCard: { padding: 18, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0F2FE', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  vendorInfo: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  textContainer: { flex: 1, gap: 4 },
  vendorTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  vendorTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },
  statusBadgeActive: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#BBF7D0' },
  statusTextActive: { fontSize: 9, fontFamily: 'Inter-Black', color: '#16A34A', textTransform: 'uppercase' },
  statusBadgeInactive: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  statusTextInactive: { fontSize: 9, fontFamily: 'Inter-Black', color: '#64748B', textTransform: 'uppercase' },
  vendorSubtitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  fab: { position: 'absolute', right: 24, borderRadius: 20, overflow: 'hidden', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 12 },
  fabGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 10 },
  fabText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-Bold' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalDismiss: { ...StyleSheet.absoluteFillObject },
  modalContent: { width: '100%', borderRadius: 32, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0F2FE', maxHeight: '85%' },
  vendorActions: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' },
  vendorActionBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F8FAFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  vendorDeleteBtn: { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A' },
  inputLabel: { fontSize: 11, fontFamily: 'Inter-Black', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  inputBox: { height: 56, borderRadius: 16, paddingHorizontal: 16, justifyContent: 'center', marginBottom: 24 },
  textInput: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  createBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 10 },
  createBtnGradient: { height: 56, alignItems: 'center', justifyContent: 'center' },
  createBtnText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

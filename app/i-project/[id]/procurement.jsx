import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import interiorApiClient from '../../services/interiorApiClient';

const PIPELINES = [
  { key: 'requested', label: 'Requested', icon: 'clipboard-outline', color: '#64748B' },
  { key: 'pending', label: 'Planned PO', icon: 'time-outline', color: '#64748B' },
  { key: 'approved', label: 'Approved', icon: 'cart-outline', color: '#2563EB' },
  { key: 'ordered', label: 'Manufacturing', icon: 'cube-outline', color: '#D97706' },
  { key: 'dispatched', label: 'In Transit', icon: 'car-outline', color: '#4F46E5' },
  { key: 'partially_delivered', label: 'Partially Delivered', icon: 'git-compare-outline', color: '#F97316' },
  { key: 'delivered', label: 'Delivered', icon: 'checkmark-circle-outline', color: '#16A34A' },
  { key: 'rejected', label: 'Cancelled', icon: 'close-circle-outline', color: '#DC2626' },
];

const PAYMENT_METHODS = ['Bank Transfer', 'UPI', 'RTGS/NEFT', 'Cheque', 'Cash'];

// PO statuses eligible for a GRN / receive-material action
const GRN_ELIGIBLE_STATUSES = ['approved', 'ordered', 'dispatched', 'partially_delivered'];
// PO statuses eligible for the Pay Vendor action
const PAY_ELIGIBLE_STATUSES = ['approved', 'dispatched', 'partially_delivered', 'delivered'];

function genRef(prefix) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${Math.floor(100 + Math.random() * 900)}`;
}

function formatCost(amount) {
  return `₹${Math.round(amount || 0).toLocaleString('en-IN')}`;
}

const emptyForm = { vendorName: '', deliveryDate: '', origin: 'requested' };
const emptyItem = { name: '', quantity: '1', unit: 'nos', unitPrice: '0' };

export default function InteriorProcurementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('procurement'); // 'procurement' | 'inventory'
  const [selectedPipeline, setSelectedPipeline] = useState('all');
  const [pos, setPos] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal: Add PO
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [poItems, setPoItems] = useState([]);
  const [newItem, setNewItem] = useState(emptyItem);

  // Modal: PO Details
  const [selectedPo, setSelectedPo] = useState(null);
  const [updatingPo, setUpdatingPo] = useState(false);

  // Modal: Send RFQ
  const [isRfqOpen, setIsRfqOpen] = useState(false);
  const [rfqVendors, setRfqVendors] = useState([]);
  const [rfqNotes, setRfqNotes] = useState('');
  const [sendingRfq, setSendingRfq] = useState(false);

  // Modal: GRN (Goods Received Note)
  const [isGrnOpen, setIsGrnOpen] = useState(false);
  const [grnChallan, setGrnChallan] = useState('');
  const [grnProofPhoto, setGrnProofPhoto] = useState(null);
  const [grnInvoicePhoto, setGrnInvoicePhoto] = useState(null);
  const [grnReceivedBy, setGrnReceivedBy] = useState('');
  const [grnReceivedItems, setGrnReceivedItems] = useState([]);
  const [submittingGrn, setSubmittingGrn] = useState(false);
  const [viewingGrnDocs, setViewingGrnDocs] = useState(null);

  // Modal: Approve & Select Vendor (rate locking)
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approvingPo, setApprovingPo] = useState(null);
  const [approveVendorName, setApproveVendorName] = useState('');
  const [approveItems, setApproveItems] = useState([]);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Modal: Pay Vendor
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payingPo, setPayingPo] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', paymentMethod: 'Bank Transfer', referenceNo: '', remarks: '' });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Modal: Log Installation
  const [selectedStock, setSelectedStock] = useState(null);
  const [installQty, setInstallQty] = useState('');
  const [installNotes, setInstallNotes] = useState('');
  const [loggingInstall, setLoggingInstall] = useState(false);

  // Modal: Create Material
  const [isCreateMaterialOpen, setIsCreateMaterialOpen] = useState(false);
  const [matName, setMatName] = useState('');
  const [matUnit, setMatUnit] = useState('Nos');
  const [matStock, setMatStock] = useState('0');
  const [creatingMaterial, setCreatingMaterial] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, invRes, venRes, payRes] = await Promise.allSettled([
        interiorApiClient.get(`/projects/${projectId}/procurement`),
        interiorApiClient.get(`/projects/${projectId}/inventory`),
        interiorApiClient.get('/vendors'),
        interiorApiClient.get(`/projects/${projectId}/payments`),
      ]);
      setPos(poRes.status === 'fulfilled' && poRes.value?.success ? poRes.value.data || [] : []);
      setInventory(invRes.status === 'fulfilled' && invRes.value?.success ? invRes.value.data || [] : []);
      setVendors(venRes.status === 'fulfilled' && venRes.value?.data ? venRes.value.data : []);
      setPayments(payRes.status === 'fulfilled' && payRes.value?.success ? payRes.value.data || [] : []);
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
        vendorName: form.vendorName.trim() || 'Unassigned',
        items: poItems,
        deliveryDate: form.deliveryDate || undefined,
        status: form.origin,
      });
      showToast('Purchase Order created successfully!', 'success');
      setIsAddOpen(false);
      setForm(emptyForm);
      setPoItems([]);
      loadAll();
    } catch (e) {
      showToast(e.message || 'Failed to create PO', 'error');
    } finally {
      setCreating(false);
    }
  };

  const updatePoStatus = async (po, nextStatus) => {
    setUpdatingPo(true);
    try {
      await interiorApiClient.put(`/projects/${projectId}/procurement/${po._id}`, { status: nextStatus });
      showToast(`Status updated to: ${nextStatus}`, 'success');
      if (selectedPo) {
        setSelectedPo((p) => ({ ...p, status: nextStatus }));
      }
      loadAll();
    } catch (e) {
      showToast(e.message || 'Failed to update status', 'error');
    } finally {
      setUpdatingPo(false);
    }
  };

  // RFQ
  const openRfqModal = (po) => {
    setSelectedPo(po);
    const matched = vendors.find((v) => v.name === po.vendorName);
    setRfqVendors(matched?._id ? [matched._id] : (vendors[0]?._id ? [vendors[0]._id] : []));
    setRfqNotes('');
    setIsRfqOpen(true);
  };

  const handleSendRfq = async () => {
    if (rfqVendors.length === 0) {
      showToast('Please select or specify at least one vendor', 'error');
      return;
    }
    setSendingRfq(true);
    try {
      await interiorApiClient.post('/procurement/send-rfq', {
        poId: selectedPo._id,
        vendorIds: rfqVendors,
        notes: rfqNotes.trim(),
      });

      showToast(`Quotation request dispatched to ${rfqVendors.length} vendors!`, 'success');
      setIsRfqOpen(false);
      loadAll();
    } catch (e) {
      showToast(e.message || 'Failed to send RFQ', 'error');
    } finally {
      setSendingRfq(false);
    }
  };

  // GRN Verification
  const openGrnModal = (po) => {
    setSelectedPo(po);
    setGrnChallan('');
    setGrnProofPhoto(null);
    setGrnInvoicePhoto(null);
    setGrnReceivedBy(`${user?.firstName || ''} ${user?.lastName || ''}`.trim());

    // Compute remaining items
    const items = (po.items || []).map((item) => {
      const prevRec = (po.grns || []).reduce((sum, grn) => {
        const found = (grn.receivedItems || []).find((i) => i.name === item.name);
        return sum + (found?.receivedQuantity || 0);
      }, 0);
      const remaining = Math.max(0, item.quantity - prevRec);
      return {
        name: item.name,
        orderedQuantity: item.quantity,
        previouslyReceived: prevRec,
        remainingQuantity: remaining,
        receivedQuantity: String(remaining),
        unit: item.unit || 'nos',
      };
    });

    setGrnReceivedItems(items);
    setIsGrnOpen(true);
  };

  const handlePickGrnPhoto = async (target) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast('Camera roll permission required', 'error');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        if (target === 'invoice') setGrnInvoicePhoto(uri);
        else setGrnProofPhoto(uri);
      }
    } catch (e) {
      showToast('Photo attach failed', 'error');
    }
  };

  const handleSubmitGrn = async () => {
    if (!grnChallan.trim()) {
      showToast('Please enter Challan / Invoice number', 'error');
      return;
    }

    setSubmittingGrn(true);
    try {
      const formattedReceived = grnReceivedItems.map((item) => ({
        name: item.name,
        receivedQuantity: parseFloat(item.receivedQuantity) || 0,
        unit: item.unit,
      }));

      const newGrn = {
        receivedItems: formattedReceived,
        challanNumber: grnChallan.trim(),
        proofUrl: grnProofPhoto,
        invoiceUrl: grnInvoicePhoto,
        receivedBy: grnReceivedBy.trim(),
        receivedAt: new Date().toISOString(),
      };

      const existingGrns = selectedPo.grns || [];
      const updatedGrns = [...existingGrns, newGrn];

      // Check if fully received
      let fullyReceived = true;
      selectedPo.items.forEach((item) => {
        const total = updatedGrns.reduce((sum, grn) => {
          const found = (grn.receivedItems || []).find((i) => i.name === item.name);
          return sum + (found?.receivedQuantity || 0);
        }, 0);
        if (total < item.quantity) fullyReceived = false;
      });

      const nextStatus = fullyReceived ? 'delivered' : 'partially_delivered';

      await interiorApiClient.put(`/projects/${projectId}/procurement/${selectedPo._id}`, {
        status: nextStatus,
        grns: updatedGrns,
      });

      showToast('GRN recorded & materials inwarded successfully!', 'success');
      setIsGrnOpen(false);
      loadAll();
    } catch (e) {
      showToast(e.message || 'Failed to submit GRN', 'error');
    } finally {
      setSubmittingGrn(false);
    }
  };

  // -----------------------------------------------------------------------
  // Payment status / smart suggested-payment calculation (mirrors web spec)
  // -----------------------------------------------------------------------
  const getPoAmount = (po) => {
    if (po.amount) return po.amount;
    return (po.items || []).reduce((sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0), 0);
  };

  const getPoPaidAmount = (po) =>
    payments
      .filter((p) => p.type === 'outgoing' && p.poNo === po.poNumber)
      .reduce((sum, p) => sum + (p.amount || 0), 0);

  const getPoPaymentStatus = (po) => {
    const amount = getPoAmount(po);
    const paid = getPoPaidAmount(po);
    if (amount > 0 && paid >= amount) return { label: 'Paid', color: '#16A34A', bg: '#F0FDF4' };
    if (paid > 0 && paid < amount) return { label: 'Part Paid', color: '#D97706', bg: '#FFFBEB' };
    return { label: 'Unpaid', color: '#DC2626', bg: '#FEF2F2' };
  };

  // Smart suggested payment: suggest paying for the value of goods actually
  // received but not yet paid for, capped at the remaining balance. Falls
  // back to the full remaining balance when nothing has been received yet
  // (useful for advance payments).
  const getSuggestedPayment = (po) => {
    const amount = getPoAmount(po);
    const paid = getPoPaidAmount(po);
    const remainingBalance = Math.max(0, amount - paid);

    let receivedValue = 0;
    (po.items || []).forEach((item) => {
      let totalReceivedQty = 0;
      (po.grns || []).forEach((grn) => {
        const receivedItem = (grn.receivedItems || []).find((ri) => ri.name === item.name);
        if (receivedItem) totalReceivedQty += receivedItem.receivedQuantity || 0;
      });
      receivedValue += totalReceivedQty * (item.unitPrice || 0);
    });

    if (receivedValue > 0) {
      const unpaidReceivedValue = Math.max(0, receivedValue - paid);
      return Math.min(unpaidReceivedValue, remainingBalance);
    }
    return remainingBalance;
  };

  const openPayModal = (po) => {
    setPayingPo(po);
    const suggested = getSuggestedPayment(po);
    setPayForm({
      amount: suggested > 0 ? String(Math.round(suggested)) : '',
      paymentMethod: 'Bank Transfer',
      referenceNo: '',
      remarks: `Payment against PO ${po.poNumber || po._id} (${(po.items || [])[0]?.name || 'Materials'})`,
    });
    setIsPayOpen(true);
  };

  const handleSubmitPayment = async () => {
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) {
      showToast('Enter a valid payment amount', 'error');
      return;
    }
    if (!payForm.referenceNo.trim()) {
      showToast('Reference / UTR number is required', 'error');
      return;
    }
    setSubmittingPayment(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/payments`, {
        type: 'outgoing',
        poNo: payingPo.poNumber,
        vendorName: payingPo.vendorName,
        category: (payingPo.items || [])[0]?.name || 'Materials',
        amount: amt,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: payForm.paymentMethod,
        referenceNo: payForm.referenceNo.trim(),
        remarks: payForm.remarks.trim(),
      });
      showToast('Vendor payment recorded successfully!', 'success');
      setIsPayOpen(false);
      setPayingPo(null);
      loadAll();
    } catch (e) {
      showToast(e.message || 'Failed to record payment', 'error');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // -----------------------------------------------------------------------
  // Approve & Select Vendor (rate locking) — moves requested/pending -> approved.
  // Deliberately does NOT call createPayment: approving a PO must never
  // auto-mark it as paid.
  // -----------------------------------------------------------------------
  const openApproveModal = (po) => {
    setApprovingPo(po);
    setApproveVendorName(po.vendorName === 'Unassigned' || po.vendorName === 'Unassigned Vendor' ? '' : po.vendorName || '');
    setApproveItems((po.items || []).map((it) => ({ ...it, unitPrice: String(it.unitPrice ?? 0) })));
    setIsApproveOpen(true);
  };

  const updateApproveItemPrice = (idx, price) => {
    setApproveItems((prev) => prev.map((it, i) => (i === idx ? { ...it, unitPrice: price } : it)));
  };

  const handleApprovePo = async () => {
    if (!approveVendorName.trim()) {
      showToast('Please assign a vendor before approving', 'error');
      return;
    }
    setSubmittingApproval(true);
    try {
      const finalItems = approveItems.map((it) => ({ ...it, unitPrice: parseFloat(it.unitPrice) || 0 }));
      await interiorApiClient.put(`/projects/${projectId}/procurement/${approvingPo._id}`, {
        vendorName: approveVendorName.trim(),
        items: finalItems,
        status: 'approved',
      });
      showToast('Purchase Order approved & vendor assigned!', 'success');
      setIsApproveOpen(false);
      setApprovingPo(null);
      loadAll();
    } catch (e) {
      showToast(e.message || 'Failed to approve PO', 'error');
    } finally {
      setSubmittingApproval(false);
    }
  };

  // Inventory Installation
  const handleLogInstallation = async () => {
    const qty = parseFloat(installQty);
    if (!qty || qty <= 0) {
      showToast('Enter a valid installation quantity', 'error');
      return;
    }
    const currentAvailable = Math.max(
      0,
      (selectedStock?.totalReceived !== undefined ? selectedStock.totalReceived : selectedStock?.quantity || 0) -
        (selectedStock?.installedQuantity || 0)
    );
    if (qty > currentAvailable) {
      showToast(`Cannot install more than currently available (${currentAvailable} ${selectedStock?.unit || ''})`, 'error');
      return;
    }

    setLoggingInstall(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/inventory`, {
        action: 'log_install',
        inventoryId: selectedStock._id,
        quantity: qty,
        notes: installNotes.trim(),
      });
      showToast('Installation logged & stock updated!', 'success');
      setSelectedStock(null);
      setInstallQty('');
      setInstallNotes('');
      loadAll();
    } catch (e) {
      showToast(e.message || 'Failed to log installation', 'error');
    } finally {
      setLoggingInstall(false);
    }
  };

  // Create Custom Material
  const handleCreateMaterial = async () => {
    if (!matName.trim()) {
      showToast('Please enter material name', 'error');
      return;
    }
    setCreatingMaterial(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/inventory`, {
        action: 'create_material',
        productName: matName.trim(),
        unit: matUnit.trim() || 'Nos',
        initialStock: parseFloat(matStock) || 0,
      });
      showToast('Material added to Site Inventory', 'success');
      setIsCreateMaterialOpen(false);
      setMatName('');
      setMatStock('0');
      loadAll();
    } catch (e) {
      showToast(e.message || 'Failed to create material', 'error');
    } finally {
      setCreatingMaterial(false);
    }
  };

  const filteredPos = useMemo(() => {
    if (selectedPipeline === 'all') return pos;
    return pos.filter((p) => p.status === selectedPipeline);
  }, [pos, selectedPipeline]);

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        {/* --- HEADER --- */}
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Procurement & Inventory</Text>
            <Text style={s.headerSub}>Purchase orders, RFQs, GRN inward & stock</Text>
          </View>
        </View>

        {/* --- TABS SWITCHER --- */}
        <View style={s.tabSwitchRow}>
          <TouchableOpacity
            style={[s.tabSwitchBtn, activeTab === 'procurement' && s.tabSwitchBtnActive]}
            onPress={() => setActiveTab('procurement')}
          >
            <Ionicons
              name="cart-outline"
              size={15}
              color={activeTab === 'procurement' ? '#2563EB' : '#64748B'}
            />
            <Text style={[s.tabSwitchText, activeTab === 'procurement' && s.tabSwitchTextActive]}>
              Purchase Orders ({pos.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.tabSwitchBtn, activeTab === 'inventory' && s.tabSwitchBtnActive]}
            onPress={() => setActiveTab('inventory')}
          >
            <Ionicons
              name="cube-outline"
              size={15}
              color={activeTab === 'inventory' ? '#2563EB' : '#64748B'}
            />
            <Text style={[s.tabSwitchText, activeTab === 'inventory' && s.tabSwitchTextActive]}>
              Site Stock ({inventory.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'procurement' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pipelineRow}>
            <TouchableOpacity
              style={[s.pipelineChip, selectedPipeline === 'all' && s.pipelineChipActive]}
              onPress={() => setSelectedPipeline('all')}
            >
              <Text style={[s.pipelineChipText, selectedPipeline === 'all' && s.pipelineChipTextActive]}>All ({pos.length})</Text>
            </TouchableOpacity>
            {PIPELINES.map((p) => {
              const count = pos.filter((po) => po.status === p.key).length;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[s.pipelineChip, selectedPipeline === p.key && s.pipelineChipActive]}
                  onPress={() => setSelectedPipeline(p.key)}
                >
                  <Text style={[s.pipelineChipText, selectedPipeline === p.key && s.pipelineChipTextActive]}>
                    {p.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {activeTab === 'procurement' ? (
              filteredPos.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="cart-outline" size={44} color="#CBD5E1" />
                  <Text style={s.emptyTitle}>No Purchase Orders Found</Text>
                  <Text style={s.emptySub}>Tap + to raise a requisition or purchase order for this project.</Text>
                </View>
              ) : (
                filteredPos.map((po) => {
                  const pipe = PIPELINES.find((p) => p.key === po.status) || PIPELINES[0];
                  const totalAmt = getPoAmount(po);
                  const grnsCount = (po.grns || []).length;
                  const payStatus = getPoPaymentStatus(po);
                  const canApprove = ['requested', 'pending'].includes(po.status);
                  const canGrn = GRN_ELIGIBLE_STATUSES.includes(po.status);
                  const canPay = PAY_ELIGIBLE_STATUSES.includes(po.status) && payStatus.label !== 'Paid';

                  return (
                    <View key={po._id} style={s.card}>
                      <View style={s.cardTopRow}>
                        <View style={s.poNumBadge}>
                          <Text style={s.poNumText}>{po.poNumber || `PO #${po._id?.slice(-5)?.toUpperCase()}`}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <View style={[s.statusBadge, { backgroundColor: payStatus.bg }]}>
                            <Text style={[s.statusBadgeText, { color: payStatus.color }]}>{payStatus.label}</Text>
                          </View>
                          <View style={[s.statusBadge, { backgroundColor: `${pipe.color}15` }]}>
                            <Ionicons name={pipe.icon} size={11} color={pipe.color} />
                            <Text style={[s.statusBadgeText, { color: pipe.color }]}>{pipe.label}</Text>
                          </View>
                        </View>
                      </View>

                      <Text style={s.vendorTitle}>{po.vendorName || 'Unassigned'}</Text>
                      <Text style={s.poSub}>
                        {(po.items || []).length} items · Total: <Text style={s.boldCost}>{formatCost(totalAmt)}</Text>
                      </Text>

                      {/* Items Preview */}
                      <View style={s.itemsPreviewBox}>
                        {(po.items || []).slice(0, 2).map((item, i) => (
                          <Text key={i} style={s.itemPreviewText} numberOfLines={1}>
                            • {item.name} ({item.quantity} {item.unit})
                          </Text>
                        ))}
                        {(po.items || []).length > 2 && (
                          <Text style={s.moreItemsText}>+{(po.items || []).length - 2} more items</Text>
                        )}
                      </View>

                      {/* Action buttons */}
                      <View style={s.poActionsRow}>
                        <TouchableOpacity
                          style={s.poActionBtn}
                          onPress={() => setSelectedPo(po)}
                        >
                          <Ionicons name="eye-outline" size={13} color="#2563EB" />
                          <Text style={[s.poActionBtnText, { color: '#2563EB' }]}>Details</Text>
                        </TouchableOpacity>

                        {/* Send RFQ button */}
                        {canApprove && (
                          <TouchableOpacity
                            style={[s.poActionBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                            onPress={() => openRfqModal(po)}
                          >
                            <Ionicons name="mail-outline" size={13} color="#2563EB" />
                            <Text style={[s.poActionBtnText, { color: '#2563EB' }]}>Send RFQ</Text>
                          </TouchableOpacity>
                        )}

                        {/* Approve & Select Vendor (rate locking) */}
                        {canApprove && (
                          <TouchableOpacity
                            style={[s.poActionBtn, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}
                            onPress={() => openApproveModal(po)}
                          >
                            <Ionicons name="checkmark-circle-outline" size={13} color="#7C3AED" />
                            <Text style={[s.poActionBtnText, { color: '#7C3AED' }]}>Approve & Select Vendor</Text>
                          </TouchableOpacity>
                        )}

                        {/* GRN Inward Button */}
                        {canGrn && (
                          <TouchableOpacity
                            style={[s.poActionBtn, { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' }]}
                            onPress={() => openGrnModal(po)}
                          >
                            <Ionicons name="checkmark-done-circle-outline" size={14} color="#059669" />
                            <Text style={[s.poActionBtnText, { color: '#059669' }]}>Receive Material</Text>
                          </TouchableOpacity>
                        )}

                        {/* Pay Vendor */}
                        {canPay && (
                          <TouchableOpacity
                            style={[s.poActionBtn, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
                            onPress={() => openPayModal(po)}
                          >
                            <Ionicons name="card-outline" size={13} color="#D97706" />
                            <Text style={[s.poActionBtnText, { color: '#D97706' }]}>Pay Vendor</Text>
                          </TouchableOpacity>
                        )}

                        {grnsCount > 0 && (
                          <View style={s.grnBadge}>
                            <Text style={s.grnBadgeText}>{grnsCount} GRN inwarded</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )
            ) : (
              // INVENTORY TAB
              inventory.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="cube-outline" size={44} color="#CBD5E1" />
                  <Text style={s.emptyTitle}>Site Inventory Empty</Text>
                  <Text style={s.emptySub}>Materials inwarded from approved POs or added manually will appear here.</Text>
                </View>
              ) : (
                inventory.map((item) => {
                  const totalRec = item.totalReceived !== undefined ? item.totalReceived : (item.quantity || 0);
                  const instQty = item.installedQuantity || 0;
                  const inStock = Math.max(0, totalRec - instQty);
                  return (
                    <View key={item._id} style={s.card}>
                      <View style={s.cardTopRow}>
                        <Text style={s.materialTitle}>{item.productName || item.name}</Text>
                        <View style={s.unitTag}>
                          <Text style={s.unitTagText}>{item.unit || 'nos'}</Text>
                        </View>
                      </View>

                      <View style={s.stockStatsRow}>
                        <View style={s.stockTile}>
                          <Text style={s.stockVal}>{inStock}</Text>
                          <Text style={s.stockLbl}>In Stock</Text>
                        </View>
                        <View style={s.stockTile}>
                          <Text style={[s.stockVal, { color: '#059669' }]}>{instQty}</Text>
                          <Text style={s.stockLbl}>Installed</Text>
                        </View>
                      </View>

                    <TouchableOpacity
                      style={s.installBtn}
                      onPress={() => {
                        setSelectedStock(item);
                        setInstallQty('');
                        setInstallNotes('');
                      }}
                    >
                      <Ionicons name="hammer-outline" size={13} color="#2563EB" />
                      <Text style={s.installBtnText}>Log Installation on Site</Text>
                    </TouchableOpacity>
                  </View>
                  );
                })
              )
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* --- FLOATING ACTION BUTTON --- */}
        <TouchableOpacity
          style={s.fab}
          onPress={() => {
            if (activeTab === 'procurement') {
              setIsAddOpen(true);
            } else {
              setIsCreateMaterialOpen(true);
            }
          }}
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* ========================================================================= */}
      {/* MODAL: Create Purchase Order */}
      {/* ========================================================================= */}
      <Modal visible={isAddOpen} animationType="slide" transparent onRequestClose={() => setIsAddOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>New Purchase Order</Text>
                <Text style={s.modalSubtitle}>Order materials, hardware & fit-out supplies</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAddOpen(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Type</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TouchableOpacity
                  style={[s.originOption, form.origin === 'requested' && s.originOptionActive]}
                  onPress={() => setForm((f) => ({ ...f, origin: 'requested' }))}
                >
                  <Text style={[s.originOptionTitle, form.origin === 'requested' && s.originOptionTitleActive]}>Site Material Request</Text>
                  <Text style={s.originOptionSub}>Needs procurement review & approval</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.originOption, form.origin === 'pending' && s.originOptionActive]}
                  onPress={() => setForm((f) => ({ ...f, origin: 'pending' }))}
                >
                  <Text style={[s.originOptionTitle, form.origin === 'pending' && s.originOptionTitleActive]}>Direct Purchase Order</Text>
                  <Text style={s.originOptionSub}>Already planned, pending approval</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.label}>Vendor / Supplier Name</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Century Ply & Hardware Hub (optional if unassigned)"
                placeholderTextColor="#94A3B8"
                value={form.vendorName}
                onChangeText={(t) => setForm((f) => ({ ...f, vendorName: t }))}
              />

              <Text style={s.label}>Expected Delivery Date</Text>
              <TextInput
                style={s.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                value={form.deliveryDate}
                onChangeText={(t) => setForm((f) => ({ ...f, deliveryDate: t }))}
              />

              <Text style={[s.label, { marginTop: 14 }]}>Line Items ({poItems.length})</Text>
              {poItems.map((item, idx) => (
                <View key={idx} style={s.addedItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.addedItemTitle}>{item.name}</Text>
                    <Text style={s.addedItemSub}>
                      {item.quantity} {item.unit} @ ₹{item.unitPrice} = {formatCost(item.quantity * item.unitPrice)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removeItemLine(idx)}>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add item inputs */}
              <View style={s.newItemBox}>
                <TextInput
                  style={s.inputSm}
                  placeholder="Material description"
                  placeholderTextColor="#94A3B8"
                  value={newItem.name}
                  onChangeText={(t) => setNewItem((i) => ({ ...i, name: t }))}
                />
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput
                    style={[s.inputSm, { flex: 1 }]}
                    keyboardType="numeric"
                    placeholder="Qty"
                    placeholderTextColor="#94A3B8"
                    value={newItem.quantity}
                    onChangeText={(t) => setNewItem((i) => ({ ...i, quantity: t }))}
                  />
                  <TextInput
                    style={[s.inputSm, { flex: 1 }]}
                    placeholder="Unit (nos/sqft)"
                    placeholderTextColor="#94A3B8"
                    value={newItem.unit}
                    onChangeText={(t) => setNewItem((i) => ({ ...i, unit: t }))}
                  />
                  <TextInput
                    style={[s.inputSm, { flex: 1.2 }]}
                    keyboardType="numeric"
                    placeholder="Rate ₹"
                    placeholderTextColor="#94A3B8"
                    value={newItem.unitPrice}
                    onChangeText={(t) => setNewItem((i) => ({ ...i, unitPrice: t }))}
                  />
                </View>
                <TouchableOpacity style={s.addItemBtn} onPress={addItemLine}>
                  <Ionicons name="add" size={14} color="#2563EB" />
                  <Text style={s.addItemBtnText}>Add Item Line</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[s.saveBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreatePo}
                disabled={creating}
              >
                {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Create Purchase Order</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: Send RFQ Modal */}
      {/* ========================================================================= */}
      <Modal visible={isRfqOpen} animationType="slide" transparent onRequestClose={() => setIsRfqOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Dispatch Request For Quotation (RFQ)</Text>
                <Text style={s.modalSubtitle}>PO #{selectedPo?._id?.slice(-5)?.toUpperCase()}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsRfqOpen(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Target Vendors ({vendors.length} registered)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
                {vendors.map((v) => {
                  const isSel = rfqVendors.includes(v._id);
                  return (
                    <TouchableOpacity
                      key={v._id || v.name}
                      style={[s.vendorChip, isSel && s.vendorChipActive]}
                      onPress={() => {
                        setRfqVendors((prev) =>
                          isSel ? prev.filter((id) => id !== v._id) : [...prev, v._id]
                        );
                      }}
                    >
                      <Ionicons name={isSel ? 'checkmark' : 'add'} size={12} color={isSel ? '#FFFFFF' : '#475569'} />
                      <Text style={[s.vendorChipText, isSel && s.vendorChipTextActive]}>{v.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={s.label}>Commercial Notes & Terms</Text>
              <TextInput
                style={[s.input, { height: 75, textAlignVertical: 'top' }]}
                multiline
                placeholder="e.g. Please quote inclusive of delivery to site by Friday. Payment terms 30 days."
                placeholderTextColor="#94A3B8"
                value={rfqNotes}
                onChangeText={setRfqNotes}
              />

              <TouchableOpacity
                style={[s.saveBtn, sendingRfq && { opacity: 0.7 }]}
                onPress={handleSendRfq}
                disabled={sendingRfq}
              >
                {sendingRfq ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.saveBtnText}>Send Quotation Requests</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: GRN (Goods Received Note) Site Verification */}
      {/* ========================================================================= */}
      <Modal visible={isGrnOpen} animationType="slide" transparent onRequestClose={() => setIsGrnOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Goods Received Note (GRN)</Text>
                <Text style={s.modalSubtitle}>Verify incoming delivery against PO items</Text>
              </View>
              <TouchableOpacity onPress={() => setIsGrnOpen(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Delivery Challan / Invoice # *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. DC-9842 / INV-402"
                placeholderTextColor="#94A3B8"
                value={grnChallan}
                onChangeText={setGrnChallan}
              />

              <Text style={[s.label, { marginTop: 12 }]}>Inward Items Verification</Text>
              {grnReceivedItems.map((item, idx) => (
                <View key={idx} style={s.grnItemRow}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={s.grnItemTitle}>{item.name}</Text>
                    <Text style={s.grnItemSub}>
                      Ordered: {item.orderedQuantity} {item.unit} · Prev: {item.previouslyReceived}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>Received Now</Text>
                    <TextInput
                      style={s.inputSm}
                      keyboardType="numeric"
                      value={item.receivedQuantity}
                      onChangeText={(t) => {
                        setGrnReceivedItems((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, receivedQuantity: t } : r))
                        );
                      }}
                    />
                  </View>
                </View>
              ))}

              <Text style={[s.label, { marginTop: 12 }]}>Received By</Text>
              <TextInput
                style={s.input}
                placeholder="Name of person receiving delivery"
                placeholderTextColor="#94A3B8"
                value={grnReceivedBy}
                onChangeText={setGrnReceivedBy}
              />

              {/* Photo Attachments — side by side, matching web's split challan/invoice viewer */}
              <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Delivery Challan Photo</Text>
                  {grnProofPhoto ? (
                    <View style={s.grnProofBox}>
                      <Image source={{ uri: grnProofPhoto }} style={s.grnProofImg} />
                      <TouchableOpacity style={s.removeProofBtn} onPress={() => setGrnProofPhoto(null)}>
                        <Ionicons name="trash" size={13} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={s.photoPickerBoxSm} onPress={() => handlePickGrnPhoto('proof')}>
                      <Ionicons name="camera-outline" size={20} color="#2563EB" />
                      <Text style={s.photoPickerBoxSmText}>Attach Challan</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Vendor Invoice Photo</Text>
                  {grnInvoicePhoto ? (
                    <View style={s.grnProofBox}>
                      <Image source={{ uri: grnInvoicePhoto }} style={s.grnProofImg} />
                      <TouchableOpacity style={s.removeProofBtn} onPress={() => setGrnInvoicePhoto(null)}>
                        <Ionicons name="trash" size={13} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={s.photoPickerBoxSm} onPress={() => handlePickGrnPhoto('invoice')}>
                      <Ionicons name="receipt-outline" size={20} color="#2563EB" />
                      <Text style={s.photoPickerBoxSmText}>Attach Invoice</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={[s.saveBtn, submittingGrn && { opacity: 0.7 }]}
                onPress={handleSubmitGrn}
                disabled={submittingGrn}
              >
                {submittingGrn ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.saveBtnText}>Verify & Inward to Inventory</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: Approve & Select Vendor (rate locking) */}
      {/* ========================================================================= */}
      <Modal visible={isApproveOpen} animationType="slide" transparent onRequestClose={() => setIsApproveOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Approve & Select Vendor</Text>
                <Text style={s.modalSubtitle}>Lock final rates and assign the vendor before approving</Text>
              </View>
              <TouchableOpacity onPress={() => setIsApproveOpen(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Assigned Vendor *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Century Ply & Hardware Hub"
                placeholderTextColor="#94A3B8"
                value={approveVendorName}
                onChangeText={setApproveVendorName}
              />

              <Text style={[s.label, { marginTop: 12 }]}>Final Locked Rates</Text>
              {approveItems.map((item, idx) => (
                <View key={idx} style={s.grnItemRow}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={s.grnItemTitle}>{item.name}</Text>
                    <Text style={s.grnItemSub}>{item.quantity} {item.unit}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>Rate ₹ / {item.unit}</Text>
                    <TextInput
                      style={s.inputSm}
                      keyboardType="numeric"
                      value={item.unitPrice}
                      onChangeText={(t) => updateApproveItemPrice(idx, t)}
                    />
                  </View>
                </View>
              ))}

              <View style={s.poTotalRow}>
                <Text style={s.poTotalLabel}>Approved Total Value:</Text>
                <Text style={s.poTotalVal}>
                  {formatCost(approveItems.reduce((s2, it) => s2 + (parseInt(it.quantity, 10) || 0) * (parseFloat(it.unitPrice) || 0), 0))}
                </Text>
              </View>

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: '#7C3AED' }, submittingApproval && { opacity: 0.7 }]}
                onPress={handleApprovePo}
                disabled={submittingApproval}
              >
                {submittingApproval ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Approve Purchase Order</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: Pay Vendor */}
      {/* ========================================================================= */}
      <Modal visible={isPayOpen} animationType="slide" transparent onRequestClose={() => setIsPayOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Pay Vendor</Text>
                <Text style={s.modalSubtitle}>{payingPo?.vendorName} · {payingPo?.poNumber || payingPo?._id}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsPayOpen(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {payingPo && (
                <View style={s.paySummaryBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>Order Value</Text>
                    <Text style={s.paySummaryVal}>{formatCost(getPoAmount(payingPo))}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>Already Paid</Text>
                    <Text style={s.paySummaryVal}>{formatCost(getPoPaidAmount(payingPo))}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>Remaining</Text>
                    <Text style={[s.paySummaryVal, { color: '#DC2626' }]}>
                      {formatCost(Math.max(0, getPoAmount(payingPo) - getPoPaidAmount(payingPo)))}
                    </Text>
                  </View>
                </View>
              )}
              <Text style={s.smartHint}>
                Suggested amount is auto-calculated from the value of goods actually received so far, so you don't overpay for partial deliveries.
              </Text>

              <Text style={s.label}>Payment Amount (₹) *</Text>
              <TextInput
                style={s.input}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#94A3B8"
                value={payForm.amount}
                onChangeText={(t) => setPayForm((f) => ({ ...f, amount: t }))}
              />

              <Text style={s.label}>Payment Mode</Text>
              <View style={s.pillWrap}>
                {PAYMENT_METHODS.map((m) => (
                  <TouchableOpacity key={m} style={[s.pill, payForm.paymentMethod === m && s.pillActive]} onPress={() => setPayForm((f) => ({ ...f, paymentMethod: m }))}>
                    <Text style={[s.pillText, payForm.paymentMethod === m && s.pillTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Ref / UTR Number *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. UTR-9812401"
                placeholderTextColor="#94A3B8"
                value={payForm.referenceNo}
                onChangeText={(t) => setPayForm((f) => ({ ...f, referenceNo: t }))}
              />

              <Text style={s.label}>Remarks</Text>
              <TextInput
                style={[s.input, { height: 60, textAlignVertical: 'top' }]}
                multiline
                placeholderTextColor="#94A3B8"
                value={payForm.remarks}
                onChangeText={(t) => setPayForm((f) => ({ ...f, remarks: t }))}
              />

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: '#D97706' }, submittingPayment && { opacity: 0.7 }]}
                onPress={handleSubmitPayment}
                disabled={submittingPayment}
              >
                {submittingPayment ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Record Payment</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: Log Installation */}
      {/* ========================================================================= */}
      <Modal visible={!!selectedStock} animationType="slide" transparent onRequestClose={() => setSelectedStock(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Log Installation</Text>
                <Text style={s.modalSubtitle}>{selectedStock?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStock(null)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Available In Stock: {selectedStock?.quantity} {selectedStock?.unit}</Text>
              <Text style={s.label}>Quantity to Install *</Text>
              <TextInput
                style={s.input}
                keyboardType="numeric"
                placeholder="e.g. 5"
                placeholderTextColor="#94A3B8"
                value={installQty}
                onChangeText={setInstallQty}
              />

              <Text style={s.label}>Installation Location & Remarks</Text>
              <TextInput
                style={[s.input, { height: 75, textAlignVertical: 'top' }]}
                multiline
                placeholder="e.g. Installed in Master Bedroom wardrobe carcasses."
                placeholderTextColor="#94A3B8"
                value={installNotes}
                onChangeText={setInstallNotes}
              />

              <TouchableOpacity
                style={[s.saveBtn, loggingInstall && { opacity: 0.7 }]}
                onPress={handleLogInstallation}
                disabled={loggingInstall}
              >
                {loggingInstall ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.saveBtnText}>Record Installation & Deduct Stock</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: Create Custom Material */}
      {/* ========================================================================= */}
      <Modal visible={isCreateMaterialOpen} animationType="slide" transparent onRequestClose={() => setIsCreateMaterialOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Add Site Material</Text>
                <Text style={s.modalSubtitle}>Register direct inventory stock</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCreateMaterialOpen(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Material Name *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 12mm Greenlam Charcoal Laminate"
                placeholderTextColor="#94A3B8"
                value={matName}
                onChangeText={setMatName}
              />

              <Text style={s.label}>Unit of Measurement</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Sheets, Bags, Boxes, Rft"
                placeholderTextColor="#94A3B8"
                value={matUnit}
                onChangeText={setMatUnit}
              />

              <Text style={s.label}>Initial Stock Quantity</Text>
              <TextInput
                style={s.input}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#94A3B8"
                value={matStock}
                onChangeText={setMatStock}
              />

              <TouchableOpacity
                style={[s.saveBtn, creatingMaterial && { opacity: 0.7 }]}
                onPress={handleCreateMaterial}
                disabled={creatingMaterial}
              >
                {creatingMaterial ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Add Material to Inventory</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: PO Details & Status Update */}
      {/* ========================================================================= */}
      <Modal visible={!!selectedPo && !isRfqOpen && !isGrnOpen} animationType="slide" transparent onRequestClose={() => setSelectedPo(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Purchase Order Details</Text>
                <Text style={s.modalSubtitle}>{selectedPo?.vendorName}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPo(null)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Current Pipeline Stage</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
                {PIPELINES.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    style={[s.stageChip, selectedPo?.status === p.key && { backgroundColor: p.color, borderColor: p.color }]}
                    onPress={() => updatePoStatus(selectedPo, p.key)}
                    disabled={updatingPo}
                  >
                    <Text style={[s.stageChipText, selectedPo?.status === p.key && { color: '#FFFFFF', fontFamily: 'Inter-Bold' }]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[s.label, { marginTop: 12 }]}>Ordered Line Items</Text>
              {(selectedPo?.items || []).map((it, i) => (
                <View key={i} style={s.poDetailItemRow}>
                  <Text style={s.poDetailItemTitle}>{it.name}</Text>
                  <Text style={s.poDetailItemSub}>
                    {it.quantity} {it.unit} @ ₹{it.unitPrice} = {formatCost(it.quantity * it.unitPrice)}
                  </Text>
                </View>
              ))}

              <View style={s.poTotalRow}>
                <Text style={s.poTotalLabel}>Grand Total Value:</Text>
                <Text style={s.poTotalVal}>
                  {formatCost((selectedPo?.items || []).reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0))}
                </Text>
              </View>

              {selectedPo && (
                <View style={s.poTotalRow}>
                  <Text style={s.poTotalLabel}>Paid to Vendor:</Text>
                  <Text style={[s.poTotalVal, { color: getPoPaymentStatus(selectedPo).color }]}>
                    {formatCost(getPoPaidAmount(selectedPo))} ({getPoPaymentStatus(selectedPo).label})
                  </Text>
                </View>
              )}

              {(selectedPo?.grns || []).length > 0 && (
                <>
                  <Text style={[s.label, { marginTop: 14 }]}>GRN History ({selectedPo.grns.length})</Text>
                  {selectedPo.grns.map((grn, idx) => (
                    <View key={idx} style={s.grnHistoryRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.grnItemTitle}>Challan {grn.challanNumber || '—'}</Text>
                        <Text style={s.grnItemSub}>
                          {grn.receivedBy ? `By ${grn.receivedBy} · ` : ''}
                          {grn.receivedAt ? new Date(grn.receivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                        </Text>
                        <Text style={s.grnItemSub}>
                          {(grn.receivedItems || []).map((ri) => `${ri.name}: ${ri.receivedQuantity} ${ri.unit || ''}`).join(', ')}
                        </Text>
                      </View>
                      {(grn.proofUrl || grn.invoiceUrl) && (
                        <TouchableOpacity onPress={() => setViewingGrnDocs(grn)} style={s.grnEyeBtn}>
                          <Ionicons name="eye-outline" size={16} color="#2563EB" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: GRN Document Viewer (Challan + Invoice side by side) */}
      {/* ========================================================================= */}
      <Modal visible={!!viewingGrnDocs} transparent animationType="fade" onRequestClose={() => setViewingGrnDocs(null)}>
        <View style={s.lightboxOverlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.lightboxHeader}>
              <Text style={s.lightboxTitle}>Challan {viewingGrnDocs?.challanNumber || ''}</Text>
              <TouchableOpacity onPress={() => setViewingGrnDocs(null)} style={s.lightboxCloseBtn}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={s.lightboxSplitBody}>
              <View style={s.lightboxSplitPane}>
                <Text style={s.lightboxPaneLabel}>Delivery Challan</Text>
                {viewingGrnDocs?.proofUrl ? (
                  <Image source={{ uri: viewingGrnDocs.proofUrl }} style={s.lightboxSplitImage} resizeMode="contain" />
                ) : (
                  <Text style={s.lightboxPaneEmpty}>No challan photo</Text>
                )}
              </View>
              <View style={s.lightboxSplitPane}>
                <Text style={s.lightboxPaneLabel}>Vendor Invoice</Text>
                {viewingGrnDocs?.invoiceUrl ? (
                  <Image source={{ uri: viewingGrnDocs.invoiceUrl }} style={s.lightboxSplitImage} resizeMode="contain" />
                ) : (
                  <Text style={s.lightboxPaneEmpty}>No invoice photo</Text>
                )}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  tabSwitchRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  tabSwitchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabSwitchBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  tabSwitchText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  tabSwitchTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  pipelineRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  pipelineChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pipelineChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  pipelineChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  pipelineChipTextActive: { color: '#FFFFFF', fontFamily: 'Inter-Bold' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#475569' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', paddingHorizontal: 30 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 14,
    gap: 8,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  poNumBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  poNumText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#475569' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold' },

  vendorTitle: { fontSize: 14.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  poSub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B' },
  boldCost: { fontFamily: 'Inter-Bold', color: '#0F172A' },

  itemsPreviewBox: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 8, gap: 3 },
  itemPreviewText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#475569' },
  moreItemsText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#2563EB', marginTop: 2 },

  poActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 8,
    marginTop: 2,
  },
  poActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  poActionBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#334155' },
  grnBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, marginLeft: 'auto' },
  grnBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#059669' },

  materialTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1 },
  unitTag: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  unitTagText: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#475569', textTransform: 'uppercase' },

  stockStatsRow: { flexDirection: 'row', gap: 10 },
  stockTile: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, alignItems: 'center' },
  stockVal: { fontSize: 16, fontFamily: 'Inter-Black', color: '#0F172A' },
  stockLbl: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#94A3B8', textTransform: 'uppercase', marginTop: 2 },

  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 2,
  },
  installBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#2563EB' },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '90%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 10,
  },
  modalCloseBtn: { padding: 4 },
  modalTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSubtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12.5,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
  },
  inputSm: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11.5,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
  },

  addedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addedItemTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  addedItemSub: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },

  newItemBox: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingVertical: 7,
    borderRadius: 8,
  },
  addItemBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB' },

  saveBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  saveBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  vendorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  vendorChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  vendorChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#475569' },
  vendorChipTextActive: { color: '#FFFFFF', fontFamily: 'Inter-Bold' },

  grnItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  grnItemTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  grnItemSub: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  miniLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#475569', marginBottom: 2 },

  photoPickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#F8FAFC',
  },
  photoPickerBoxText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#2563EB' },

  grnProofBox: {
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  grnProofImg: { width: '100%', height: '100%' },
  removeProofBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#DC2626',
    borderRadius: 999,
    padding: 6,
  },

  stageChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  stageChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  poDetailItemRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  poDetailItemTitle: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  poDetailItemSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },

  poTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    marginTop: 6,
  },
  poTotalLabel: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  poTotalVal: { fontSize: 15, fontFamily: 'Inter-Black', color: '#16A34A' },

  originOption: {
    flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 10, backgroundColor: '#F8FAFC',
  },
  originOptionActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  originOptionTitle: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155' },
  originOptionTitleActive: { color: '#2563EB' },
  originOptionSub: { fontSize: 9.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  photoPickerBoxSm: {
    alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 10,
    paddingVertical: 16, backgroundColor: '#F8FAFC',
  },
  photoPickerBoxSmText: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#2563EB', textAlign: 'center' },

  paySummaryBox: {
    flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9',
    padding: 12, marginBottom: 4,
  },
  paySummaryVal: { fontSize: 13, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 2 },
  smartHint: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 8, lineHeight: 15 },

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  pillActive: { backgroundColor: '#D97706', borderColor: '#D97706' },
  pillText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  pillTextActive: { color: '#FFFFFF' },

  grnHistoryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10,
    padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0',
  },
  grnEyeBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },

  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  lightboxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  lightboxTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  lightboxCloseBtn: { padding: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)' },
  lightboxSplitBody: { flex: 1, flexDirection: 'row', gap: 1 },
  lightboxSplitPane: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 8 },
  lightboxPaneLabel: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 },
  lightboxSplitImage: { width: '100%', height: '90%' },
  lightboxPaneEmpty: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B' },
});

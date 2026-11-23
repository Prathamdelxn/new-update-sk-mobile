import { tr } from '../../utils/i18n/tr';
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
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useOrgCurrency } from '../../utils/interior/orgCurrency';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import interiorApiClient from '../../services/interiorApiClient';
import * as Clipboard from 'expo-clipboard';
import { WEB_APP_URL } from '../../config';
import { useProjectPermissions } from '../../utils/interior/useProjectPermissions';
import SkeletonList from '../../components/common/SkeletonList';

// Public RFQ link state: the isLinkActive flag, or the older "||CLOSED||" marker on the material name
const isRfqLinkActive = (po) =>
  po?.isLinkActive !== undefined ? Boolean(po.isLinkActive) : !String(po?.materialName || '').includes('||CLOSED||');

// Reusable calendar date picker field (replaces free-text YYYY-MM-DD inputs).
function DateField({ value, onChange, placeholder = 'Select date', inputStyle }) {
  const [showIosPicker, setShowIosPicker] = useState(false);

  const open = () => {
    const base = value ? new Date(value) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        onChange: (event, d) => {
          if (event.type === 'set' && d) onChange(d.toISOString().split('T')[0]);
        },
      });
    } else {
      setShowIosPicker(true);
    }
  };

  return (
    <>
      <TouchableOpacity style={[inputStyle, dfStyles.row]} onPress={open}>
        <Text style={[dfStyles.text, !value && dfStyles.placeholder]} numberOfLines={1}>
          {value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={16} color="#64748B" />
      </TouchableOpacity>
      {Platform.OS === 'ios' && showIosPicker && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display="spinner"
          onChange={(e, d) => {
            setShowIosPicker(false);
            if (d) onChange(d.toISOString().split('T')[0]);
          }}
        />
      )}
    </>
  );
}

const dfStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#0F172A', flex: 1, marginRight: 8 },
  placeholder: { color: '#94A3B8' },
});

// Full status metadata — used for PO badge styling and the manual "Current Pipeline
// Stage" override picker in the PO Detail modal (a superset of the visible tabs below).
const PIPELINES = [
  { key: 'requested', label: 'Requested', icon: 'clipboard-outline', color: '#8B5CF6' },
  { key: 'rfq', label: 'RFQ (Quotes)', icon: 'document-text-outline', color: '#6366F1' },
  { key: 'pending', label: 'Planned PO', icon: 'time-outline', color: '#64748B' },
  { key: 'approved', label: 'Approved', icon: 'cart-outline', color: '#2563EB' },
  { key: 'ordered', label: 'Manufacturing', icon: 'cube-outline', color: '#D97706' },
  { key: 'dispatched', label: 'In Transit', icon: 'car-outline', color: '#4F46E5' },
  { key: 'partially_delivered', label: 'Partially Delivered', icon: 'git-compare-outline', color: '#F97316' },
  { key: 'delivered', label: 'Delivered', icon: 'checkmark-circle-outline', color: '#16A34A' },
  { key: 'rejected', label: 'Cancelled', icon: 'close-circle-outline', color: '#DC2626' },
];

// The pipeline tab bar — matches web's 6 active tabs
const PIPELINE_TABS = [
  { key: 'requested', label: 'Material Request', icon: 'clipboard-outline', color: '#8B5CF6' },
  { key: 'rfq', label: 'RFQ', icon: 'document-text-outline', color: '#6366F1' },
  { key: 'pending', label: 'Purchase Order', icon: 'time-outline', color: '#64748B' },
  { key: 'approved', label: 'Approved PO', icon: 'cart-outline', color: '#2563EB' },
  { key: 'partially_delivered', label: 'Partial Delivery', icon: 'git-compare-outline', color: '#F97316' },
  { key: 'delivered', label: 'Delivered', icon: 'checkmark-circle-outline', color: '#16A34A' },
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

const emptyForm = { vendorName: '', deliveryDate: '' };
const emptyItem = { name: '', quantity: '1', unit: 'nos', unitPrice: '0' };

export default function InteriorProcurementScreen() {
  const orgCurrency = useOrgCurrency();
  const formatCost = orgCurrency.money;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();
const { can: canDo } = useProjectPermissions(projectId);
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('procurement'); // 'procurement' | 'inventory'
  const [selectedPipeline, setSelectedPipeline] = useState('requested');
  const [pos, setPos] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal: Add PO
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [poItems, setPoItems] = useState([]);
  const [newItem, setNewItem] = useState(emptyItem);
  const [isMaterialDropdownOpen, setIsMaterialDropdownOpen] = useState(false);
  const [materialSearchText, setMaterialSearchText] = useState('');

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
  const [payForm, setPayForm] = useState({
    amount: '',
    paymentMethod: 'Bank Transfer',
    referenceNo: '',
    remarks: '',
    projectName: '',
    projectLocation: '',
    invoiceNo: '',
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Modal: Log Installation
  const [selectedStock, setSelectedStock] = useState(null);
  const [installQty, setInstallQty] = useState('');
  const [installNotes, setInstallNotes] = useState('');
  const [loggingInstall, setLoggingInstall] = useState(false);

  // Modal: Create / Edit Material
  const [isCreateMaterialOpen, setIsCreateMaterialOpen] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [matName, setMatName] = useState('');
  const [matUnit, setMatUnit] = useState('Nos');
  const [matStock, setMatStock] = useState('0');
  const [creatingMaterial, setCreatingMaterial] = useState(false);

  // PO Details editing & deletion & history
  const [editingPoItems, setEditingPoItems] = useState([]);
  const [savingPoRates, setSavingPoRates] = useState(false);
  const [deletingPo, setDeletingPo] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState({});

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
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
      setRefreshing(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const getAvailableStock = (item) => {
    if (!item) return 0;
    const totalRec = item.totalReceived !== undefined ? item.totalReceived : (item.quantity || 0);
    const instQty = item.installedQuantity || 0;
    return Math.max(0, totalRec - instQty);
  };

  const selectedInventoryItem = useMemo(() => {
    if (!newItem.name) return null;
    return (inventory || []).find(
      (inv) => (inv.productName || inv.name || '').trim().toLowerCase() === newItem.name.trim().toLowerCase()
    );
  }, [inventory, newItem.name]);

  const filteredInventory = useMemo(() => {
    const list = inventory || [];
    if (!materialSearchText.trim()) return list;
    const q = materialSearchText.trim().toLowerCase();
    return list.filter((m) => (m.productName || m.name || '').toLowerCase().includes(q));
  }, [inventory, materialSearchText]);

  const handleSelectMaterial = (item) => {
    const matName = item.productName || item.name || '';
    const matUnit = item.unit || 'nos';
    setNewItem((prev) => ({
      ...prev,
      name: matName,
      unit: matUnit,
    }));
    setIsMaterialDropdownOpen(false);
    setMaterialSearchText('');
  };

  const addItemLine = () => {
    if (!newItem.name || !newItem.name.trim()) {
      showToast(tr("Please select a material from catalog"), 'error');
      return;
    }
    const qty = parseInt(newItem.quantity, 10);
    if (!qty || qty <= 0) {
      showToast(tr("Quantity must be at least 1"), 'error');
      return;
    }
    const parsedPrice = parseFloat(newItem.unitPrice);
    const unitPrice = isNaN(parsedPrice) || parsedPrice < 0 ? 0 : parsedPrice;
    const unit = (newItem.unit || '').trim() || 'nos';

    setPoItems((prev) => [
      ...prev,
      {
        name: newItem.name.trim(),
        quantity: qty,
        unit: unit,
        unitPrice: unitPrice,
        amount: qty * unitPrice,
      },
    ]);
    setNewItem(emptyItem);
    setIsMaterialDropdownOpen(false);
    setMaterialSearchText('');
  };

  const removeItemLine = (idx) => setPoItems((prev) => prev.filter((_, i) => i !== idx));

  const handleCreatePo = async () => {
    let itemsToSubmit = [...poItems];
    // If user filled in the line item inputs but hasn't tapped "+ Add Item Line", auto-include it
    if (itemsToSubmit.length === 0 && newItem.name && newItem.name.trim()) {
      const qty = parseInt(newItem.quantity, 10) || 1;
      const parsedPrice = parseFloat(newItem.unitPrice);
      const unitPrice = isNaN(parsedPrice) || parsedPrice < 0 ? 0 : parsedPrice;
      const unit = (newItem.unit || '').trim() || 'nos';
      itemsToSubmit.push({
        name: newItem.name.trim(),
        quantity: qty,
        unit: unit,
        unitPrice: unitPrice,
        amount: qty * unitPrice,
      });
    }

    if (itemsToSubmit.length === 0) {
      showToast(tr("Please select and add at least one material item"), 'error');
      return;
    }

    // Sanitize every item to ensure schema validation never fails
    const sanitizedItems = itemsToSubmit.map((it) => {
      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      const price = Math.max(0, parseFloat(it.unitPrice) || 0);
      return {
        name: (it.name || '').trim() || 'Material',
        quantity: qty,
        unit: (it.unit || '').trim() || 'nos',
        unitPrice: price,
        amount: qty * price,
      };
    });

    const totalAmount = sanitizedItems.reduce((acc, it) => acc + it.amount, 0);

    setCreating(true);
    try {
      const payload = {
        vendorName: form.vendorName.trim() || 'Unassigned',
        materialName: sanitizedItems[0]?.name || 'Materials',
        items: sanitizedItems,
        amount: totalAmount,
        status: selectedPipeline === 'requested' ? 'requested' : 'pending',
      };

      if (form.deliveryDate && form.deliveryDate.trim()) {
        payload.deliveryDate = form.deliveryDate.trim();
      }

      await interiorApiClient.post(`/projects/${projectId}/procurement`, payload);
      showToast(
        selectedPipeline === 'requested' ? tr("Material request created successfully!") : tr("Purchase Order created successfully!"),
        'success'
      );
      setIsAddOpen(false);
      setForm(emptyForm);
      setPoItems([]);
      setNewItem(emptyItem);
      setIsMaterialDropdownOpen(false);
      setMaterialSearchText('');
      loadAll();
    } catch (e) {
      console.error('Create PO failed:', e);
      showToast(e.message || tr("Failed to create request"), 'error');
    } finally {
      setCreating(false);
    }
  };

  const updatePoStatus = async (po, nextStatus) => {
    setUpdatingPo(true);
    try {
      await interiorApiClient.put(`/projects/${projectId}/procurement/${po._id}`, { status: nextStatus });
      showToast(tr("Status updated to: {{nextStatus}}", { nextStatus: nextStatus }), 'success');
      if (selectedPo) {
        setSelectedPo((p) => ({ ...p, status: nextStatus }));
      }
      loadAll();
    } catch (e) {
      showToast(e.message || tr("Failed to update status"), 'error');
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
      showToast(tr("Please select or specify at least one vendor"), 'error');
      return;
    }
    setSendingRfq(true);
    try {
      await interiorApiClient.post('/procurement/send-rfq', {
        poId: selectedPo._id,
        vendorIds: rfqVendors,
        notes: rfqNotes.trim(),
        rfqLink: `${WEB_APP_URL}/rfq/${selectedPo._id}`,
      });

      // Update status to rfq and switch tab to rfq pipeline
      try {
        await interiorApiClient.put(`/projects/${projectId}/procurement/${selectedPo._id}`, { status: 'rfq' });
      } catch (err) {
        console.warn('Status update to rfq notice:', err);
      }

      showToast(tr("Quotation request dispatched to {{rfqVendorsCount}} vendors!", { rfqVendorsCount: rfqVendors.length }), 'success');
      setIsRfqOpen(false);
      setSelectedPo(null);
      setSelectedPipeline('rfq');
      loadAll();
    } catch (e) {
      showToast(e.message || tr("Failed to send RFQ"), 'error');
    } finally {
      setSendingRfq(false);
    }
  };

  const [togglingLink, setTogglingLink] = useState(false);
  const handleToggleRfqLink = async () => {
    if (!selectedPo) return;
    const next = !isRfqLinkActive(selectedPo);
    const cleanName = String(selectedPo.materialName || '').replace(' ||CLOSED||', '').trim() || selectedPo.materialName;
    setTogglingLink(true);
    try {
      await interiorApiClient.put(`/projects/${projectId}/procurement/${selectedPo._id}`, {
        isLinkActive: next,
        materialName: cleanName,
      });
      setSelectedPo((prev) => (prev ? { ...prev, isLinkActive: next, materialName: cleanName } : prev));
      showToast(next ? tr("Link reactivated") : tr("Link manually expired"), 'success');
      loadAll();
    } catch (e) {
      showToast(e.message || tr("Failed to update link status"), 'error');
    } finally {
      setTogglingLink(false);
    }
  };

  // Award PO to supplier based on quotation
  const handleAwardQuote = async (po, vendorName, quote) => {
    if (!po) return;
    setUpdatingPo(true);
    try {
      let updatedItems = po.items ? [...po.items] : [];
      let totalAmount = po.amount || 0;

      if (quote && quote.rates && quote.rates.length > 0) {
        updatedItems = updatedItems.map((item) => {
          const rateInfo = quote.rates.find(
            (r) => r.itemId === (item._id || item.id) || r.name === item.name
          );
          const newUnitPrice = rateInfo ? Number(rateInfo.unitPrice) : Number(item.unitPrice || 0);
          return {
            ...item,
            unitPrice: newUnitPrice,
            totalPrice: newUnitPrice * (item.quantity || 1),
          };
        });
        totalAmount = updatedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      }

      const updatedPoPayload = {
        vendorName,
        status: 'approved',
        items: updatedItems,
        amount: totalAmount,
      };

      await interiorApiClient.put(`/projects/${projectId}/procurement/${po._id}`, updatedPoPayload);

      // Tell the supplier (same as the web): e-mail the award, or WhatsApp when there is no e-mail
      const vendorInfo = vendors.find((v) => v.name === vendorName);
      const targetEmail = quote?.email || quote?.vendorEmail || quote?.vendorContact || vendorInfo?.email;
      const targetPhone = quote?.phoneNumber || quote?.phone || vendorInfo?.phoneNumber || vendorInfo?.phone;
      const materialName = (po.materialName || '').replace(' ||CLOSED||', '').trim();
      const poLink = `${WEB_APP_URL}/rfq/${po._id}`;
      const emailLike = typeof targetEmail === 'string' && targetEmail.includes('@');
      if (emailLike) {
        try {
          await interiorApiClient.post(`/projects/${projectId}/procurement/${po._id}/send-award-email`, {
            email: targetEmail,
            vendorName,
            materialName,
            poLink,
          });
          showToast(tr("Supplier {{vendorName}} awarded, PO approved and e-mail sent!", { vendorName: vendorName }), 'success');
        } catch (mailErr) {
          showToast(tr("PO approved, but the award e-mail could not be sent."), 'error');
        }
      } else if (targetPhone) {
        const msg = encodeURIComponent(`Hello ${vendorName},

We are pleased to inform you that you have been awarded the Purchase Order for ${materialName}.

Please review your PO details here:
${poLink}

Thank you.`);
        Linking.openURL(`https://wa.me/${String(targetPhone).replace(/\D/g, '')}?text=${msg}`).catch(() => {});
        showToast(tr("Supplier {{vendorName}} awarded! PO approved — opened WhatsApp.", { vendorName: vendorName }), 'success');
      } else {
        showToast(tr("Supplier {{vendorName}} awarded! PO Approved.", { vendorName: vendorName }), 'success');
      }
      setSelectedPo(null);
      loadAll();
    } catch (e) {
      showToast(e.message || tr("Failed to award quote"), 'error');
    } finally {
      setUpdatingPo(false);
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
        showToast(tr("Camera roll permission required"), 'error');
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
      showToast(tr("Photo attach failed"), 'error');
    }
  };

  const handleSubmitGrn = async () => {
    if (!grnChallan.trim()) {
      showToast(tr("Please enter Challan / Invoice number"), 'error');
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

      showToast(tr("GRN recorded & materials inwarded successfully!"), 'success');
      setIsGrnOpen(false);
      loadAll();
    } catch (e) {
      showToast(e.message || tr("Failed to submit GRN"), 'error');
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
      projectName: '',
      projectLocation: '',
      invoiceNo: '',
    });
    setIsPayOpen(true);
  };

  const handleSubmitPayment = async () => {
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) {
      showToast(tr("Enter a valid payment amount"), 'error');
      return;
    }
    if (!payForm.referenceNo.trim()) {
      showToast(tr("Reference / UTR number is required"), 'error');
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
        projectName: payForm.projectName?.trim(),
        projectLocation: payForm.projectLocation?.trim(),
        invoiceNo: payForm.invoiceNo?.trim(),
      });
      showToast(tr("Vendor payment recorded successfully!"), 'success');
      setIsPayOpen(false);
      setPayingPo(null);
      loadAll();
    } catch (e) {
      showToast(e.message || tr("Failed to record payment"), 'error');
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
      showToast(tr("Please assign a vendor before approving"), 'error');
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
      showToast(tr("Purchase Order approved & vendor assigned!"), 'success');
      setIsApproveOpen(false);
      setApprovingPo(null);
      loadAll();
    } catch (e) {
      showToast(e.message || tr("Failed to approve PO"), 'error');
    } finally {
      setSubmittingApproval(false);
    }
  };

  // Inventory Installation
  const handleLogInstallation = async () => {
    const qty = parseFloat(installQty);
    if (!qty || qty <= 0) {
      showToast(tr("Enter a valid installation quantity"), 'error');
      return;
    }
    const currentAvailable = Math.max(
      0,
      (selectedStock?.totalReceived !== undefined ? selectedStock.totalReceived : selectedStock?.quantity || 0) -
      (selectedStock?.installedQuantity || 0)
    );
    if (qty > currentAvailable) {
      showToast(tr("Cannot install more than currently available ({{currentAvailable}} {{value}})", { currentAvailable: currentAvailable, value: selectedStock?.unit || '' }), 'error');
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
      showToast(tr("Installation logged & stock updated!"), 'success');
      setSelectedStock(null);
      setInstallQty('');
      setInstallNotes('');
      loadAll();
    } catch (e) {
      showToast(e.message || tr("Failed to log installation"), 'error');
    } finally {
      setLoggingInstall(false);
    }
  };

  // Create / Edit Custom Material
  const openAddMaterial = () => {
    setEditingMaterialId(null);
    setMatName('');
    setMatUnit('Nos');
    setMatStock('0');
    setIsCreateMaterialOpen(true);
  };

  const openEditMaterial = (item) => {
    setEditingMaterialId(item._id);
    setMatName(item.productName || item.name || '');
    setMatUnit(item.unit || 'Nos');
    // Shown read-only on edit: stock changes through deliveries (GRN) and installs
    setMatStock(String(Math.max(0, (item.totalReceived || 0) - (item.installedQuantity || 0))));
    setIsCreateMaterialOpen(true);
  };

  const handleCreateMaterial = async () => {
    if (!matName.trim()) {
      showToast(tr("Please enter material name"), 'error');
      return;
    }
    setCreatingMaterial(true);
    try {
      if (editingMaterialId) {
        await interiorApiClient.put(`/projects/${projectId}/inventory/${editingMaterialId}`, {
          productName: matName.trim(),
          unit: matUnit.trim() || 'Nos',
        });
        showToast(tr("Material updated successfully"), 'success');
      } else {
        await interiorApiClient.post(`/projects/${projectId}/inventory`, {
          action: 'create_material',
          productName: matName.trim(),
          unit: matUnit.trim() || 'Nos',
          initialStock: parseFloat(matStock) || 0,
        });
        showToast(tr("Material added to Site Inventory"), 'success');
      }
      setIsCreateMaterialOpen(false);
      setEditingMaterialId(null);
      setMatName('');
      setMatStock('0');
      loadAll();
    } catch (e) {
      showToast(e.message || tr("Failed to save material"), 'error');
    } finally {
      setCreatingMaterial(false);
    }
  };

  const handleDeleteMaterial = (item) => {
    Alert.alert(
      tr("Delete Material"),
      tr("Are you sure you want to delete \"{{value}}\"? This will permanently remove it from inventory.", { value: item.productName || item.name }),
      [
        { text: tr("Cancel"), style: 'cancel' },
        {
          text: tr("Delete"),
          style: 'destructive',
          onPress: async () => {
            try {
              await interiorApiClient.delete(`/projects/${projectId}/inventory/${item._id}`);
              showToast(tr("Material deleted successfully"), 'success');
              loadAll();
            } catch (err) {
              showToast(err.message || tr("Failed to delete material"), 'error');
            }
          },
        },
      ]
    );
  };

  const openPoDetails = (po) => {
    setSelectedPo(po);
    setEditingPoItems(po.items ? JSON.parse(JSON.stringify(po.items)) : []);
  };

  const handleLocalPoRateChange = (idx, newPrice) => {
    setEditingPoItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], unitPrice: newPrice };
      return copy;
    });
  };

  const handleSavePoRates = async () => {
    if (!selectedPo) return;
    setSavingPoRates(true);
    try {
      const sanitizedItems = editingPoItems.map((it) => ({
        ...it,
        unitPrice: parseFloat(it.unitPrice) || 0,
      }));
      const newTotal = sanitizedItems.reduce((acc, it) => acc + (it.quantity || 0) * (it.unitPrice || 0), 0);
      await interiorApiClient.put(`/projects/${projectId}/procurement/${selectedPo._id}`, {
        items: sanitizedItems,
        amount: newTotal,
      });
      showToast(tr("PO rates updated successfully"), 'success');
      setSelectedPo((prev) => ({ ...prev, items: sanitizedItems, amount: newTotal }));
      loadAll();
    } catch (err) {
      showToast(err.message || tr("Failed to update rates"), 'error');
    } finally {
      setSavingPoRates(false);
    }
  };

  const handleDeletePo = (po) => {
    const isRequest = po?.status === 'requested';
    Alert.alert(
      isRequest ? tr("Delete Material Request") : tr("Delete Purchase Order"),
      tr("Are you sure you want to delete {{value}}? This action cannot be undone.", { value: po?.poNumber || (isRequest ? 'this Material Request' : 'this Purchase Order') }),
      [
        { text: tr("Cancel"), style: 'cancel' },
        {
          text: isRequest ? tr("Delete Request") : tr("Delete PO"),
          style: 'destructive',
          onPress: async () => {
            setDeletingPo(true);
            try {
              await interiorApiClient.delete(`/projects/${projectId}/procurement/${po._id}`);
              showToast(isRequest ? tr("Material request deleted") : tr("Purchase Order deleted successfully"), 'success');
              setSelectedPo(null);
              loadAll();
            } catch (err) {
              showToast(err.message || tr("Failed to delete"), 'error');
            } finally {
              setDeletingPo(false);
            }
          },
        },
      ]
    );
  };

  const toggleHistory = (itemId) => {
    setExpandedHistory((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const totalProcurementBudget = useMemo(() => {
    return pos.reduce((sum, po) => sum + getPoAmount(po), 0);
  }, [pos]);

  const activePoCount = useMemo(() => {
    return pos.filter((po) => ['approved', 'ordered', 'dispatched', 'partially_delivered'].includes(po.status)).length;
  }, [pos]);

  const deliveredPoCount = useMemo(() => {
    return pos.filter((po) => po.status === 'delivered').length;
  }, [pos]);

  const filteredPos = useMemo(() => {
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
            <Text style={s.headerTitle}>{tr("Procurement")}</Text>
          </View>
        </View>

        {/* --- Purchase orders | Inventory --- */}
        <View style={s.segWrap}>
          <View style={s.segTrack}>
            {[
              { key: 'procurement', label: 'Purchase orders' },
              { key: 'inventory', label: 'Inventory' },
            ].map((t) => (
              <TouchableOpacity key={t.key} style={[s.segBtn, activeTab === t.key && s.segBtnActive]} onPress={() => setActiveTab(t.key)} activeOpacity={0.8}>
                <Text style={[s.segText, activeTab === t.key && s.segTextActive]}>{tr(t.label)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading && !refreshing && pos.length === 0 && inventory.length === 0 ? (
          <SkeletonList />
        ) : (
          <>
            {activeTab === 'procurement' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.pipelineScroll}
                contentContainerStyle={s.pipelineRow}
              >
                {PIPELINE_TABS.map((p) => {
                  const count = pos.filter((po) => po.status === p.key).length;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      style={[s.pipelineChip, selectedPipeline === p.key && s.pipelineChipActive]}
                      onPress={() => setSelectedPipeline(p.key)}
                    >
                      <Text
                        style={[s.pipelineChipText, selectedPipeline === p.key && s.pipelineChipTextActive]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {tr(p.label)}
                        {count > 0 ? <Text style={[s.pipelineCount, selectedPipeline === p.key && { color: '#2563EB' }]}>  {count}</Text> : null}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <ScrollView
              contentContainerStyle={s.scroll}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadAll(true)}
                  colors={['#2563EB']}
                  tintColor="#2563EB"
                />
              }
            >
              {/* --- Summary: three equal figures --- */}
            {activeTab === 'procurement' && (
              <View style={s.sumCard}>
                <View style={s.figCol}>
                  <Text style={s.figLabel}>{tr("Budget")}</Text>
                  <Text style={s.figValue} numberOfLines={1}>{formatCost(totalProcurementBudget)}</Text>
                </View>
                <View style={[s.figCol, { alignItems: 'center' }]}>
                  <Text style={s.figLabel}>{tr("Active POs")}</Text>
                  <Text style={s.figValue}>{tr(activePoCount)}</Text>
                </View>
                <View style={[s.figCol, { alignItems: 'flex-end' }]}>
                  <Text style={s.figLabel}>{tr("Delivered")}</Text>
                  <Text style={[s.figValue, { color: '#059669' }]}>{tr(deliveredPoCount)}</Text>
                </View>
              </View>
            )}

              {activeTab === 'procurement' ? (
                filteredPos.length === 0 ? (
                  <View style={s.empty}>
                    <Ionicons name="cart-outline" size={44} color="#CBD5E1" />
                    <Text style={s.emptyTitle}>{tr("No Purchase Orders Found")}</Text>
                  </View>
                ) : (
                  filteredPos.map((po) => {
                    const pipe = PIPELINES.find((p) => p.key === po.status) || PIPELINES[0];
                    const totalAmt = getPoAmount(po);
                    const grnsCount = (po.grns || []).length;
                    const payStatus = getPoPaymentStatus(po);
                    const canApprove = ['requested', 'pending', 'rfq'].includes(po.status);
                    const canGrn = GRN_ELIGIBLE_STATUSES.includes(po.status);
                    const canPay = PAY_ELIGIBLE_STATUSES.includes(po.status) && payStatus.label !== 'Paid';

                    const itemCount = (po.items || []).length;
                    const quoteCount = (po.quotes || []).length;
                    const title = po.materialName || (po.items?.[0]?.name ? `${po.items[0].name}${itemCount > 1 ? ` +${itemCount - 1} items` : ''}` : 'Material Request');
                    const facts = [
                      po.vendorName && po.vendorName !== 'Unassigned' ? po.vendorName : null,
                      `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`,
                      po.poNumber || `PO #${po._id?.slice(-5)?.toUpperCase()}`,
                    ].filter(Boolean).join('  ·  ');
                    // Only the actions that apply at this stage (RFQ/approve and receive/pay never overlap)
                    const actions = [
                      canApprove && canDo('procurement', 'update') && { key: 'rfq', label: 'Send RFQ', icon: 'mail-outline', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', onPress: () => openRfqModal(po) },
                      canApprove && canDo('procurement', 'update') && { key: 'approve', label: 'Approve Vendor', icon: 'checkmark-circle-outline', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', onPress: () => openApproveModal(po) },
                      canGrn && canDo('procurement', 'update') && { key: 'grn', label: 'Receive Material', icon: 'checkmark-done-circle-outline', color: '#059669', bg: '#ECFDF5', border: '#BBF7D0', onPress: () => openGrnModal(po) },
                      canPay && canDo('financials', 'create') && { key: 'pay', label: 'Pay Vendor', icon: 'card-outline', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', onPress: () => openPayModal(po) },
                    ].filter(Boolean);

                    return (
                      <TouchableOpacity key={po._id} style={s.card} onPress={() => openPoDetails(po)} activeOpacity={0.85}>
                        <View style={s.poTitleRow}>
                          <Text style={s.vendorTitle} numberOfLines={2}>{tr(title)}</Text>
                          <View style={[s.statusBadge, { backgroundColor: `${pipe.color}15` }]}>
                            <Text style={[s.statusBadgeText, { color: pipe.color }]}>{tr(pipe.label)}</Text>
                          </View>
                        </View>
                        <Text style={s.poSub} numberOfLines={1}>{tr(facts)}</Text>

                        {po.status === 'requested' || po.status === 'rfq' ? (
                          <Text style={s.poMuted}>
                            {po.status === 'rfq' ? tr("RFQ sent · {{quoteCount}} {{value}} received", { quoteCount: quoteCount, value: quoteCount === 1 ? 'quote' : 'quotes' }) : tr("Material request · awaiting quotes")}
                          </Text>
                        ) : (
                          <View style={s.figRow}>
                            <View style={s.figCol}>
                              <Text style={s.figLabel}>{tr("Amount")}</Text>
                              <Text style={[s.figValue, { color: '#2563EB' }]} numberOfLines={1}>{formatCost(totalAmt)}</Text>
                            </View>
                            <View style={[s.figCol, { alignItems: 'center' }]}>
                              <Text style={s.figLabel}>{tr("Payment")}</Text>
                              <Text style={[s.figValue, { color: payStatus.color }]} numberOfLines={1}>{tr(payStatus.label)}</Text>
                            </View>
                            <View style={[s.figCol, { alignItems: 'flex-end' }]}>
                              <Text style={s.figLabel}>{grnsCount > 0 ? tr("Received") : tr("Delivery")}</Text>
                              <Text style={s.figValue} numberOfLines={1}>
                                {grnsCount > 0
                                  ? `${grnsCount} GRN`
                                  : po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                              </Text>
                            </View>
                          </View>
                        )}

                        {actions.length > 0 && (
                          <View style={s.cardActions}>
                            {actions.map((a) => (
                              <TouchableOpacity
                                key={a.key}
                                style={[s.cardActionBtn, { backgroundColor: a.bg, borderColor: a.border }]}
                                onPress={a.onPress}
                              >
                                <Ionicons name={a.icon} size={15} color={a.color} />
                                <Text style={[s.cardActionText, { color: a.color }]} numberOfLines={1}>{tr(a.label)}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )
              ) : (
                // INVENTORY / MATERIAL MANAGEMENT TAB
                inventory.length === 0 ? (
                  <View style={s.empty}>
                    <Ionicons name="cube-outline" size={44} color="#CBD5E1" />
                    <Text style={s.emptyTitle}>{tr("Site Inventory Empty")}</Text>
                                      </View>
                ) : (
                  inventory.map((item) => {
                    const totalRec = item.totalReceived !== undefined ? item.totalReceived : (item.quantity || 0);
                    const instQty = item.installedQuantity || 0;
                    const inStock = Math.max(0, totalRec - instQty);
                    const percentInstalled = totalRec > 0 ? Math.round((instQty / totalRec) * 100) : 0;
                    const historyList = item.installHistory || [];
                    const isHistoryExpanded = !!expandedHistory[item._id];

                    return (
                      <View key={item._id} style={s.card}>
                        <View style={s.poTitleRow}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={s.vendorTitle} numberOfLines={2}>{item.productName || item.name}</Text>
                            <Text style={s.poSub}>{item.unit || tr("nos")}{historyList.length ? tr("  ·  used {{historyListCount}} {{value}}", { historyListCount: historyList.length, value: historyList.length === 1 ? 'time' : 'times' }) : ''}</Text>
                          </View>
                          {(canDo('inventory', 'update') || canDo('inventory', 'delete')) && (
                            <TouchableOpacity
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              onPress={() => {
                                const opts = [];
                                if (canDo('inventory', 'update')) opts.push({ text: 'Edit material', onPress: () => openEditMaterial(item) });
                                if (canDo('inventory', 'delete')) opts.push({ text: 'Delete material', style: 'destructive', onPress: () => handleDeleteMaterial(item) });
                                Alert.alert(item.productName || item.name, undefined, [...opts, { text: tr("Cancel"), style: 'cancel' }]);
                              }}
                            >
                              <Ionicons name="ellipsis-vertical" size={17} color="#64748B" />
                            </TouchableOpacity>
                          )}
                        </View>

                        <View style={s.figRow}>
                          <View style={s.figCol}>
                            <Text style={s.figLabel}>{tr("Delivered")}</Text>
                            <Text style={s.figValue}>{tr(totalRec)}</Text>
                          </View>
                          <View style={[s.figCol, { alignItems: 'center' }]}>
                            <Text style={s.figLabel}>{tr("Used")}</Text>
                            <Text style={s.figValue}>{tr(instQty)}</Text>
                          </View>
                          <View style={[s.figCol, { alignItems: 'flex-end' }]}>
                            <Text style={s.figLabel}>{tr("Available")}</Text>
                            <Text style={[s.figValue, { color: inStock > 0 ? '#2563EB' : '#DC2626' }]}>{tr(inStock)}</Text>
                          </View>
                        </View>
                        <View style={s.usageRow}>
                          <View style={s.usageTrack}>
                            <View style={[s.usageFill, { width: `${Math.min(100, percentInstalled)}%` }]} />
                          </View>
                          <Text style={s.usagePct}>{tr(percentInstalled)}{tr("% used")}</Text>
                        </View>

                        <View style={s.cardActions}>
                          {canDo('inventory', 'create') && (
                            <TouchableOpacity
                              style={[s.cardActionBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }, inStock <= 0 && { opacity: 0.5 }]}
                              disabled={inStock <= 0}
                              onPress={() => { setSelectedStock(item); setInstallQty(''); setInstallNotes(''); }}
                            >
                              <Ionicons name="hammer-outline" size={15} color="#1D4ED8" />
                              <Text style={[s.cardActionText, { color: '#1D4ED8' }]}>{inStock <= 0 ? tr("Out of stock") : tr("Log usage")}</Text>
                            </TouchableOpacity>
                          )}
                          {historyList.length > 0 && (
                            <TouchableOpacity style={[s.cardActionBtn, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]} onPress={() => toggleHistory(item._id)}>
                              <Ionicons name={isHistoryExpanded ? 'chevron-up' : 'time-outline'} size={15} color="#334155" />
                              <Text style={[s.cardActionText, { color: '#334155' }]}>{tr("History")}</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {isHistoryExpanded && historyList.length > 0 && (
                          <View style={s.historyListBox}>
                            {historyList.map((log, hIdx) => (
                              <View key={log._id || hIdx} style={s.historyItemRow}>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={s.historyQtyText}>{log.quantity} {item.unit || tr("nos")}{tr(" used")}</Text>
                                    <Text style={s.historyDateText}>
                                      {log.date ? new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}
                                    </Text>
                                  </View>
                                  {log.notes ? <Text style={s.historyNotesText} numberOfLines={2}>{tr(log.notes)}</Text> : null}
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })
                )
              )}
              <View style={{ height: 100 }} />
            </ScrollView>
          </>
        )}

        {/* --- FLOATING ACTION BUTTON --- */}
        {(activeTab === 'procurement' ? canDo('procurement', 'create') : canDo('inventory', 'create')) && (
          <TouchableOpacity
            style={s.fab}
            onPress={() => {
              if (activeTab === 'procurement') {
                setIsMaterialDropdownOpen(false);
                setMaterialSearchText('');
                if (inventory.length === 0) loadAll();
                setIsAddOpen(true);
              } else {
                openAddMaterial();
              }
            }}
          >
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* ========================================================================= */}
      {/* MODAL: Create Purchase Order */}
      {/* ========================================================================= */}
      <Modal
        visible={isAddOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setIsAddOpen(false);
          setIsMaterialDropdownOpen(false);
          setMaterialSearchText('');
        }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>{selectedPipeline === 'requested' ? tr("New Material Request") : tr("New Purchase Order")}</Text>
                <Text style={s.modalSubtitle}>{tr("Order materials, hardware & fit-out supplies")}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsAddOpen(false);
                  setIsMaterialDropdownOpen(false);
                  setMaterialSearchText('');
                }}
                style={s.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Vendor is assigned later via "Approve & Select Vendor" — a
                  fresh Material Request has no vendor yet, matching web,
                  which only asks for it once creating an actual Purchase Order. */}
              {selectedPipeline !== 'requested' && (
                <>
                  <Text style={s.label}>{tr("Vendor / Supplier Name")}</Text>
                  <TextInput
                    style={s.input}
                    placeholder={tr("e.g. Century Ply & Hardware Hub (optional if unassigned)")}
                    placeholderTextColor="#94A3B8"
                    value={form.vendorName}
                    onChangeText={(t) => setForm((f) => ({ ...f, vendorName: t }))}
                  />
                </>
              )}

              <Text style={s.label}>{selectedPipeline === 'requested' ? tr("Target Delivery Date") : tr("Expected Delivery Date")}</Text>
              <DateField value={form.deliveryDate} onChange={(v) => setForm((f) => ({ ...f, deliveryDate: v }))} inputStyle={s.input} />

              <Text style={[s.label, { marginTop: 14 }]}>{tr("Line Items (")}{poItems.length})</Text>
              {poItems.map((item, idx) => (
                <View key={idx} style={s.addedItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.addedItemTitle}>{tr(item.name)}</Text>
                    <Text style={s.addedItemSub}>
                      {item.quantity} {tr(item.unit)} @ {formatCost(item.unitPrice)} = {formatCost(item.quantity * item.unitPrice)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removeItemLine(idx)}>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add item inputs */}
              <View style={s.newItemBox}>
                <View style={{ gap: 6 }}>
                  <Text style={s.customModeLabel}>{tr("Select Material from Catalog *")}</Text>

                  {/* Dropdown Trigger */}
                  <TouchableOpacity
                    style={[s.dropdownTrigger, isMaterialDropdownOpen && s.dropdownTriggerActive]}
                    onPress={() => setIsMaterialDropdownOpen(!isMaterialDropdownOpen)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="cube-outline" size={16} color={newItem.name ? '#2563EB' : '#94A3B8'} />
                    <View style={{ flex: 1 }}>
                      {newItem.name ? (
                        <View>
                          <Text style={s.dropdownSelectedText} numberOfLines={1}>{tr(newItem.name)}</Text>
                          {selectedInventoryItem && (
                            <Text style={s.dropdownStockHint}>
                              {tr("Available in stock: ")}{getAvailableStock(selectedInventoryItem)} {selectedInventoryItem.unit || ''}
                            </Text>
                          )}
                        </View>
                      ) : (
                        <Text style={s.dropdownPlaceholderText}>
                          {inventory.length > 0 ? tr("Select Material from Inventory...") : tr("No inventory materials found")}
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name={isMaterialDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={17}
                      color="#64748B"
                    />
                  </TouchableOpacity>

                  {/* Dropdown Options List */}
                  {isMaterialDropdownOpen && (
                    <View style={s.dropdownMenu}>
                      {inventory.length > 3 && (
                        <View style={s.dropdownSearchBox}>
                          <Ionicons name="search-outline" size={14} color="#94A3B8" />
                          <TextInput
                            style={s.dropdownSearchInput}
                            placeholder={tr("Search inventory materials...")}
                            placeholderTextColor="#94A3B8"
                            value={materialSearchText}
                            onChangeText={setMaterialSearchText}
                          />
                          {materialSearchText ? (
                            <TouchableOpacity onPress={() => setMaterialSearchText('')}>
                              <Ionicons name="close-circle" size={14} color="#94A3B8" />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      )}

                      <ScrollView
                        style={s.dropdownScroll}
                        nestedScrollEnabled={true}
                        keyboardShouldPersistTaps="handled"
                      >
                        {filteredInventory.length === 0 ? (
                          <View style={s.dropdownEmpty}>
                            <Text style={s.dropdownEmptyText}>
                              {materialSearchText ? tr("No matching materials found") : tr("No materials in inventory yet. Add materials in Material Management tab.")}
                            </Text>
                          </View>
                        ) : (
                          filteredInventory.map((item) => {
                            const matName = item.productName || item.name || '';
                            const isSelected = (newItem.name || '').trim().toLowerCase() === matName.trim().toLowerCase();
                            const avail = getAvailableStock(item);

                            return (
                              <TouchableOpacity
                                key={item._id || matName}
                                style={[s.dropdownItem, isSelected && s.dropdownItemSelected]}
                                onPress={() => handleSelectMaterial(item)}
                              >
                                <View style={{ flex: 1, marginRight: 8 }}>
                                  <Text style={[s.dropdownItemTitle, isSelected && s.dropdownItemTitleSelected]} numberOfLines={1}>
                                    {tr(matName)}
                                  </Text>
                                  <View style={s.dropdownItemSubRow}>
                                    <Text style={s.dropdownItemSub}>{tr("Unit: ")}{item.unit || tr("nos")}</Text>
                                    <View style={[s.stockPill, avail > 0 ? s.stockPillInStock : s.stockPillOut]}>
                                      <Text style={[s.stockPillText, avail > 0 ? s.stockPillTextInStock : s.stockPillTextOut]}>
                                        {tr("Available: ")}{tr(avail)} {item.unit || ''}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                                {isSelected && <Ionicons name="checkmark-circle" size={17} color="#2563EB" />}
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* 3-Col Inputs for Qty, Unit, Rate */}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniFieldLabel}>{tr("Qty *")}</Text>
                    <TextInput
                      style={s.inputSm}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor="#94A3B8"
                      value={newItem.quantity}
                      onChangeText={(t) => setNewItem((i) => ({ ...i, quantity: t }))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniFieldLabel}>{tr("Unit")}</Text>
                    <TextInput
                      style={[s.inputSm, { backgroundColor: '#F1F5F9', color: '#475569' }]}
                      editable={false}
                      placeholder={tr("nos")}
                      placeholderTextColor="#94A3B8"
                      value={newItem.unit || 'nos'}
                    />
                  </View>
                  <View style={{ flex: 1.2 }}>
                    <Text style={s.miniFieldLabel}>{tr("Rate (")}{orgCurrency.code})</Text>
                    <TextInput
                      style={s.inputSm}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      value={newItem.unitPrice}
                      onChangeText={(t) => setNewItem((i) => ({ ...i, unitPrice: t }))}
                    />
                  </View>
                </View>

                <TouchableOpacity style={s.addItemBtn} onPress={addItemLine}>
                  <Ionicons name="add" size={14} color="#2563EB" />
                  <Text style={s.addItemBtnText}>{tr("Add Item Line")}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[s.saveBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreatePo}
                disabled={creating}
              >
                {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>{selectedPipeline === 'requested' ? tr("Create Material Request") : tr("Create Purchase Order")}</Text>}
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
                <Text style={s.modalTitle}>{tr("Dispatch Request For Quotation (RFQ)")}</Text>
                <Text style={s.modalSubtitle}>{tr("PO #")}{selectedPo?._id?.slice(-5)?.toUpperCase()}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsRfqOpen(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>{tr("Target Vendors (")}{vendors.length}{tr(" registered)")}</Text>
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
                      <Text style={[s.vendorChipText, isSel && s.vendorChipTextActive]}>{tr(v.name)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={s.label}>{tr("Commercial Notes & Terms")}</Text>
              <TextInput
                style={[s.input, { height: 75, textAlignVertical: 'top' }]}
                multiline
                placeholder={tr("e.g. Please quote inclusive of delivery to site by Friday. Payment terms 30 days.")}
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
                  <Text style={s.saveBtnText}>{tr("Send Quotation Requests")}</Text>
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
                <Text style={s.modalTitle}>{tr("Goods Received Note (GRN)")}</Text>
                <Text style={s.modalSubtitle}>{tr("Verify incoming delivery against PO items")}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsGrnOpen(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>{tr("Delivery Challan / Invoice # *")}</Text>
              <TextInput
                style={s.input}
                placeholder={tr("e.g. DC-9842 / INV-402")}
                placeholderTextColor="#94A3B8"
                value={grnChallan}
                onChangeText={setGrnChallan}
              />

              <Text style={[s.label, { marginTop: 12 }]}>{tr("Inward Items Verification")}</Text>
              {grnReceivedItems.map((item, idx) => (
                <View key={idx} style={s.grnItemRow}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={s.grnItemTitle}>{tr(item.name)}</Text>
                    <Text style={s.grnItemSub}>
                      {tr("Ordered: ")}{tr(item.orderedQuantity)} {tr(item.unit)}{tr(" · Prev: ")}{tr(item.previouslyReceived)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>{tr("Received Now")}</Text>
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

              <Text style={[s.label, { marginTop: 12 }]}>{tr("Received By")}</Text>
              <TextInput
                style={s.input}
                placeholder={tr("Name of person receiving delivery")}
                placeholderTextColor="#94A3B8"
                value={grnReceivedBy}
                onChangeText={setGrnReceivedBy}
              />

              {/* Photo Attachments — side by side, matching web's split challan/invoice viewer */}
              <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{tr("Delivery Challan Photo")}</Text>
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
                      <Text style={s.photoPickerBoxSmText}>{tr("Attach Challan")}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{tr("Vendor Invoice Photo")}</Text>
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
                      <Text style={s.photoPickerBoxSmText}>{tr("Attach Invoice")}</Text>
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
                  <Text style={s.saveBtnText}>{tr("Verify & Inward to Inventory")}</Text>
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
                <Text style={s.modalTitle}>{tr("Approve & Select Vendor")}</Text>
                <Text style={s.modalSubtitle}>{tr("Lock final rates and assign the vendor before approving")}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsApproveOpen(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>{tr("Assigned Vendor *")}</Text>
              <TextInput
                style={s.input}
                placeholder={tr("e.g. Century Ply & Hardware Hub")}
                placeholderTextColor="#94A3B8"
                value={approveVendorName}
                onChangeText={setApproveVendorName}
              />

              <Text style={[s.label, { marginTop: 12 }]}>{tr("Final Locked Rates")}</Text>
              {approveItems.map((item, idx) => (
                <View key={idx} style={s.grnItemRow}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={s.grnItemTitle}>{tr(item.name)}</Text>
                    <Text style={s.grnItemSub}>{item.quantity} {tr(item.unit)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>{tr("Rate (")}{orgCurrency.code}) / {tr(item.unit)}</Text>
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
                <Text style={s.poTotalLabel}>{tr("Approved Total Value:")}</Text>
                <Text style={s.poTotalVal}>
                  {formatCost(approveItems.reduce((s2, it) => s2 + (parseInt(it.quantity, 10) || 0) * (parseFloat(it.unitPrice) || 0), 0))}
                </Text>
              </View>

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: '#7C3AED' }, submittingApproval && { opacity: 0.7 }]}
                onPress={handleApprovePo}
                disabled={submittingApproval}
              >
                {submittingApproval ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>{tr("Approve Purchase Order")}</Text>}
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
                <Text style={s.modalTitle}>{tr("Pay Vendor")}</Text>
                <Text style={s.modalSubtitle}>{tr(payingPo?.vendorName)} · {payingPo?.poNumber || payingPo?._id}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsPayOpen(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {payingPo && (
                <View style={s.paySummaryBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>{tr("Order Value")}</Text>
                    <Text style={s.paySummaryVal}>{formatCost(getPoAmount(payingPo))}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>{tr("Already Paid")}</Text>
                    <Text style={s.paySummaryVal}>{formatCost(getPoPaidAmount(payingPo))}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>{tr("Remaining")}</Text>
                    <Text style={[s.paySummaryVal, { color: '#DC2626' }]}>
                      {formatCost(Math.max(0, getPoAmount(payingPo) - getPoPaidAmount(payingPo)))}
                    </Text>
                  </View>
                </View>
              )}
              <Text style={s.smartHint}>
                {tr("Suggested amount is auto-calculated from the value of goods actually received so far, so you don't overpay for partial deliveries.")}
              </Text>

              <Text style={s.label}>{tr("Payment Amount (")}{orgCurrency.code}) *</Text>
              <TextInput
                style={s.input}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#94A3B8"
                value={payForm.amount}
                onChangeText={(t) => setPayForm((f) => ({ ...f, amount: t }))}
              />

              <Text style={s.label}>{tr("Payment Mode")}</Text>
              <View style={s.pillWrap}>
                {PAYMENT_METHODS.map((m) => (
                  <TouchableOpacity key={m} style={[s.pill, payForm.paymentMethod === m && s.pillActive]} onPress={() => setPayForm((f) => ({ ...f, paymentMethod: m }))}>
                    <Text style={[s.pillText, payForm.paymentMethod === m && s.pillTextActive]}>{tr(m)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>{tr("Ref / UTR Number *")}</Text>
              <TextInput
                style={s.input}
                placeholder={tr("e.g. UTR-9812401")}
                placeholderTextColor="#94A3B8"
                value={payForm.referenceNo}
                onChangeText={(t) => setPayForm((f) => ({ ...f, referenceNo: t }))}
              />

              <Text style={s.label}>{tr("Remarks")}</Text>
              <TextInput
                style={[s.input, { height: 60, textAlignVertical: 'top' }]}
                multiline
                placeholderTextColor="#94A3B8"
                value={payForm.remarks}
                onChangeText={(t) => setPayForm((f) => ({ ...f, remarks: t }))}
              />

              <Text style={s.label}>{tr("Project Name")}</Text>
              <TextInput
                style={s.input}
                placeholder={tr("e.g. Skyline Residency")}
                placeholderTextColor="#94A3B8"
                value={payForm.projectName}
                onChangeText={(t) => setPayForm((f) => ({ ...f, projectName: t }))}
              />

              <Text style={s.label}>{tr("Project Location")}</Text>
              <TextInput
                style={s.input}
                placeholder={tr("e.g. Mumbai, MH")}
                placeholderTextColor="#94A3B8"
                value={payForm.projectLocation}
                onChangeText={(t) => setPayForm((f) => ({ ...f, projectLocation: t }))}
              />

              <Text style={s.label}>{tr("Invoice No.")}</Text>
              <TextInput
                style={s.input}
                placeholder={tr("e.g. INV-2023-001")}
                placeholderTextColor="#94A3B8"
                value={payForm.invoiceNo}
                onChangeText={(t) => setPayForm((f) => ({ ...f, invoiceNo: t }))}
              />

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: '#D97706' }, submittingPayment && { opacity: 0.7 }]}
                onPress={handleSubmitPayment}
                disabled={submittingPayment}
              >
                {submittingPayment ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>{tr("Record Payment")}</Text>}
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
                <Text style={s.modalTitle}>{tr("Log Installation")}</Text>
                <Text style={s.modalSubtitle}>{tr(selectedStock?.name)}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStock(null)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>{tr("Available In Stock: ")}{selectedStock?.quantity} {tr(selectedStock?.unit)}</Text>
              <Text style={s.label}>{tr("Quantity to Install *")}</Text>
              <TextInput
                style={s.input}
                keyboardType="numeric"
                placeholder="e.g. 5"
                placeholderTextColor="#94A3B8"
                value={installQty}
                onChangeText={setInstallQty}
              />

              <Text style={s.label}>{tr("Installation Location & Remarks")}</Text>
              <TextInput
                style={[s.input, { height: 75, textAlignVertical: 'top' }]}
                multiline
                placeholder={tr("e.g. Installed in Master Bedroom wardrobe carcasses.")}
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
                  <Text style={s.saveBtnText}>{tr("Record Installation & Deduct Stock")}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL: Create / Edit Custom Material */}
      {/* ========================================================================= */}
      <Modal visible={isCreateMaterialOpen} animationType="slide" transparent onRequestClose={() => setIsCreateMaterialOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>{editingMaterialId ? tr("Edit Material") : tr("Add Site Material")}</Text>
                <Text style={s.modalSubtitle}>{editingMaterialId ? tr("Update material details") : tr("Register direct inventory stock")}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCreateMaterialOpen(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>{tr("Material Name *")}</Text>
              <TextInput
                style={s.input}
                placeholder={tr("e.g. 12mm Greenlam Charcoal Laminate")}
                placeholderTextColor="#94A3B8"
                value={matName}
                onChangeText={setMatName}
              />

              <Text style={s.label}>{tr("Unit of Measurement")}</Text>
              <TextInput
                style={s.input}
                placeholder={tr("e.g. Sheets, Bags, Boxes, Rft")}
                placeholderTextColor="#94A3B8"
                value={matUnit}
                onChangeText={setMatUnit}
              />

              <Text style={s.label}>{editingMaterialId ? tr("Initial Stock (Current Available)") : tr("Initial Stock (Default: 0)")}</Text>
              <TextInput
                style={[s.input, editingMaterialId && { backgroundColor: '#F1F5F9', color: '#64748B' }]}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#94A3B8"
                value={matStock}
                onChangeText={setMatStock}
                editable={!editingMaterialId}
              />
              {!!editingMaterialId && (
                <Text style={{ fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: -4, marginBottom: 8 }}>
                  {tr("Stock is updated by deliveries (GRN) and installations, not by editing the material.")}
                </Text>
              )}

              <TouchableOpacity
                style={[s.saveBtn, creatingMaterial && { opacity: 0.7 }]}
                onPress={handleCreateMaterial}
                disabled={creatingMaterial}
              >
                {creatingMaterial ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.saveBtnText}>{editingMaterialId ? tr("Update Material") : tr("Add Material to Inventory")}</Text>
                )}
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
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>{selectedPo?.poNumber || tr("Purchase Order")}</Text>
                <Text style={s.modalSubtitle}>{selectedPo?.vendorName || tr("Unassigned Vendor")}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPo(null)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedPo?.deliveryDate && (
                <View style={s.poMetaBox}>
                  <Ionicons name="calendar-outline" size={14} color="#2563EB" />
                  <Text style={s.poMetaText}>
                    {tr("Target Delivery:")}{' '}
                    <Text style={{ fontFamily: 'Inter-SemiBold', color: '#0F172A' }}>
                      {new Date(selectedPo.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </Text>
                </View>
              )}

              <Text style={s.label}>{tr("Current Pipeline Stage")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
                {PIPELINES.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    style={[s.stageChip, selectedPo?.status === p.key && { backgroundColor: p.color, borderColor: p.color }]}
                    onPress={() => {
                      if (!canDo('procurement', 'update')) return;
                      if (p.key === 'delivered' || p.key === 'partially_delivered') {
                        const targetPo = selectedPo;
                        setSelectedPo(null);
                        openGrnModal(targetPo);
                      } else {
                        updatePoStatus(selectedPo, p.key);
                      }
                    }}
                    disabled={updatingPo}
                  >
                    <Text style={[s.stageChipText, selectedPo?.status === p.key && { color: '#FFFFFF', fontFamily: 'Inter-Bold' }]}>
                      {tr(p.label)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Supplier Quotes Comparison Matrix */}
              {selectedPo?.quotes && selectedPo.quotes.length > 0 && (
                <View style={s.quotesSection}>
                  <View style={s.quotesHeaderRow}>
                    <Ionicons name="pricetags" size={15} color="#2563EB" />
                    <Text style={s.quotesHeaderTitle}>{tr("Supplier Quotations (")}{selectedPo.quotes.length})</Text>
                  </View>
                  <Text style={s.quotesSubtext}>{tr("Compare rates received from suppliers and award the PO.")}</Text>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quotesCardScroll}>
                    {(() => {
                      const poItems = selectedPo.items && selectedPo.items.length > 0 ? selectedPo.items : [];
                      const supplierTotals = selectedPo.quotes.map((quote) =>
                        (quote.rates || []).reduce((sum, r) => {
                          const item = poItems.find((i) => (i._id || i.id) === r.itemId || i.name === r.name);
                          return sum + (Number(r.unitPrice) || 0) * (item?.quantity || 1);
                        }, 0)
                      );
                      const validTotals = supplierTotals.filter((t) => t > 0);
                      const lowestTotal = validTotals.length > 0 ? Math.min(...validTotals) : 0;

                      return selectedPo.quotes.map((quote, qIdx) => {
                        const myTotal = (quote.rates || []).reduce((sum, r) => {
                          const item = poItems.find((i) => (i._id || i.id) === r.itemId || i.name === r.name);
                          return sum + (Number(r.unitPrice) || 0) * (item?.quantity || 1);
                        }, 0);
                        const isLowest = myTotal > 0 && myTotal === lowestTotal && selectedPo.quotes.length > 1;

                        return (
                          <View key={qIdx} style={[s.quoteCard, isLowest && s.quoteCardLowest]}>
                            <View style={s.quoteCardHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={s.quoteSupplierBadge}>{tr("Supplier ")}{qIdx + 1}</Text>
                                <Text style={s.quoteVendorName} numberOfLines={1}>{quote.vendorName || tr("Vendor")}</Text>
                              </View>
                              {isLowest && (
                                <View style={s.lowestBadge}>
                                  <Ionicons name="sparkles" size={10} color="#059669" />
                                  <Text style={s.lowestBadgeText}>{tr("Lowest")}</Text>
                                </View>
                              )}
                            </View>

                            <View style={s.quoteRatesList}>
                              {poItems.map((item, itemIdx) => {
                                const rate = (quote.rates || []).find((r) => r.itemId === (item._id || item.id) || r.name === item.name);
                                return (
                                  <View key={itemIdx} style={s.quoteRateRow}>
                                    <Text style={s.quoteItemName} numberOfLines={1}>{tr(item.name)}</Text>
                                    <Text style={s.quoteItemRate}>
                                      {rate ? `${formatCost(rate.unitPrice)}/${item.unit || 'nos'}` : '—'}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>

                            <View style={s.quoteTotalRow}>
                              <Text style={s.quoteTotalLabel}>{tr("Total Quote:")}</Text>
                              <Text style={[s.quoteTotalVal, isLowest && { color: '#059669' }]}>
                                {formatCost(myTotal)}
                              </Text>
                            </View>

                            {canDo('procurement', 'update') && (
                              <TouchableOpacity
                                style={[s.awardBtn, isLowest && s.awardBtnLowest, updatingPo && { opacity: 0.6 }]}
                                onPress={() => handleAwardQuote(selectedPo, quote.vendorName, quote)}
                                disabled={updatingPo}
                              >
                                {updatingPo ? (
                                  <ActivityIndicator size="small" color={isLowest ? '#FFFFFF' : '#2563EB'} />
                                ) : (
                                  <>
                                    <Ionicons name="trophy-outline" size={13} color={isLowest ? '#FFFFFF' : '#2563EB'} />
                                    <Text style={[s.awardBtnText, isLowest && s.awardBtnTextLowest]}>
                                      {isLowest ? tr("Award PO") : tr("Award")}
                                    </Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      });
                    })()}
                  </ScrollView>
                </View>
              )}

              {selectedPo?.status === 'rfq' && (() => {
                const active = isRfqLinkActive(selectedPo);
                const link = `${WEB_APP_URL}/rfq/${selectedPo._id}`;
                return (
                  <View style={[s.rfqLinkBox, !active && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[s.rfqLinkTitle, !active && { color: '#64748B' }]}>
                        {active ? tr("Public RFQ Link Active") : tr("RFQ Link Expired")}
                      </Text>
                      {!active && <Text style={s.rfqLinkBadge}>{tr("Deactivated")}</Text>}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={s.rfqLinkUrl} numberOfLines={1}>{tr(link)}</Text>
                      <TouchableOpacity
                        style={[s.rfqLinkBtn, !active && { opacity: 0.4 }]}
                        disabled={!active}
                        onPress={async () => {
                          await Clipboard.setStringAsync(link);
                          showToast(tr("Link copied!"), 'success');
                        }}
                      >
                        <Text style={s.rfqLinkBtnText}>{tr("Copy")}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={s.rfqLinkHint}>{active ? tr("Vendors can currently submit quotes") : tr("No longer accepting quotes")}</Text>
                      {canDo('procurement', 'update') && (
                        <TouchableOpacity
                          style={[s.rfqLinkBtn, active ? { backgroundColor: '#DC2626', borderColor: '#DC2626' } : null]}
                          onPress={handleToggleRfqLink}
                          disabled={togglingLink}
                        >
                          {togglingLink ? (
                            <ActivityIndicator size="small" color={active ? '#FFFFFF' : '#4F46E5'} />
                          ) : (
                            <Text style={[s.rfqLinkBtnText, active && { color: '#FFFFFF' }]}>{active ? tr("Force Expire Now") : tr("Reactivate Link")}</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })()}

              {selectedPo?.status === 'rfq' && (!selectedPo.quotes || selectedPo.quotes.length === 0) && (
                <View style={s.awaitingQuotesBox}>
                  <Ionicons name="time-outline" size={18} color="#6366F1" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.awaitingQuotesTitle}>{tr("Awaiting Supplier Quotations")}</Text>
                    <Text style={s.awaitingQuotesSub}>
                      {tr("Quotation request has been dispatched. Quotes submitted by suppliers will appear here for comparison and awarding.")}
                    </Text>
                  </View>
                </View>
              )}

              {/* Ordered Line Items with editable rates if requested or pending */}
              {(() => {
                const canEditRates = ['requested', 'pending', 'rfq'].includes(selectedPo?.status);
                const itemsToRender = canEditRates ? (editingPoItems.length > 0 ? editingPoItems : selectedPo?.items || []) : (selectedPo?.items || []);
                const grandTotal = itemsToRender.reduce((sum, it) => sum + (it.quantity || 0) * (parseFloat(it.unitPrice) || 0), 0);

                return (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 }}>
                      <Text style={s.label}>{tr("Ordered Line Items (")}{itemsToRender.length})</Text>
                      {canEditRates ? (
                        canDo('procurement', 'update') && (
                          <TouchableOpacity
                            style={[s.saveRatesBtn, savingPoRates && { opacity: 0.6 }]}
                            onPress={handleSavePoRates}
                            disabled={savingPoRates}
                          >
                            {savingPoRates ? (
                              <ActivityIndicator size="small" color="#2563EB" />
                            ) : (
                              <>
                                <Ionicons name="save-outline" size={13} color="#2563EB" />
                                <Text style={s.saveRatesBtnText}>{tr("Save Rates")}</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )
                      ) : (
                        <View style={s.ratesLockedBadge}>
                          <Ionicons name="lock-closed" size={11} color="#64748B" />
                          <Text style={s.ratesLockedText}>{tr("Rates Locked")}</Text>
                        </View>
                      )}
                    </View>

                    {itemsToRender.map((it, i) => {
                      const qty = it.quantity || 0;
                      const price = parseFloat(it.unitPrice) || 0;
                      const subtotal = qty * price;

                      return (
                        <View key={i} style={s.poDetailItemRow}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={s.poDetailItemTitle}>{tr(it.name)}</Text>
                            <Text style={s.poDetailItemSub}>
                              {tr("Quantity: ")}{qty} {it.unit || tr("nos")}
                            </Text>
                          </View>
                          {canEditRates ? (
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={{ fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#64748B' }}>{tr(orgCurrency.symbol)}</Text>
                                <TextInput
                                  style={s.rateInput}
                                  keyboardType="numeric"
                                  value={String(it.unitPrice ?? '')}
                                  onChangeText={(val) => handleLocalPoRateChange(i, val)}
                                  placeholder="0"
                                  placeholderTextColor="#94A3B8"
                                />
                                <Text style={{ fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#94A3B8' }}>/{it.unit || tr("nos")}</Text>
                              </View>
                              <Text style={s.itemSubtotalText}>= {formatCost(subtotal)}</Text>
                            </View>
                          ) : (
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={s.poDetailItemSub}>
                                @ {formatCost(price)} / {it.unit || tr("nos")}
                              </Text>
                              <Text style={s.itemSubtotalText}>{formatCost(subtotal)}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {selectedPo?.status !== 'requested' && selectedPo?.status !== 'rfq' && (
                      <View style={s.poTotalRow}>
                        <Text style={s.poTotalLabel}>{tr("Grand Total Value:")}</Text>
                        <Text style={s.poTotalVal}>{formatCost(grandTotal)}</Text>
                      </View>
                    )}
                  </>
                );
              })()}

              {selectedPo && selectedPo?.status !== 'requested' && selectedPo?.status !== 'rfq' && (
                <View style={s.poTotalRow}>
                  <Text style={s.poTotalLabel}>{tr("Paid to Vendor:")}</Text>
                  <Text style={[s.poTotalVal, { color: getPoPaymentStatus(selectedPo).color }]}>
                    {formatCost(getPoPaidAmount(selectedPo))} ({tr(getPoPaymentStatus(selectedPo).label)})
                  </Text>
                </View>
              )}

              {(selectedPo?.grns || []).length > 0 && (
                <>
                  <Text style={[s.label, { marginTop: 14 }]}>{tr("GRN History (")}{selectedPo.grns.length})</Text>
                  {selectedPo.grns.map((grn, idx) => (
                    <View key={idx} style={s.grnHistoryRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.grnItemTitle}>{tr("Challan ")}{grn.challanNumber || '—'}</Text>
                        <Text style={s.grnItemSub}>
                          {grn.receivedBy ? tr("By {{receivedBy}} · ", { receivedBy: grn.receivedBy }) : ''}
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

              {/* Bottom Delete Button */}
              {canDo('procurement', 'delete') && (
                <TouchableOpacity
                  style={[s.deletePoBtn, deletingPo && { opacity: 0.6 }]}
                  onPress={() => handleDeletePo(selectedPo)}
                  disabled={deletingPo}
                >
                  {deletingPo ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={15} color="#DC2626" />
                      <Text style={s.deletePoBtnText}>
                        {selectedPo?.status === 'requested' ? tr("Delete Material Request") : tr("Delete Purchase Order")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
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
              <Text style={s.lightboxTitle}>{tr("Challan ")}{viewingGrnDocs?.challanNumber || ''}</Text>
              <TouchableOpacity onPress={() => setViewingGrnDocs(null)} style={s.lightboxCloseBtn}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={s.lightboxSplitBody}>
              <View style={s.lightboxSplitPane}>
                <Text style={s.lightboxPaneLabel}>{tr("Delivery Challan")}</Text>
                {viewingGrnDocs?.proofUrl ? (
                  <Image source={{ uri: viewingGrnDocs.proofUrl }} style={s.lightboxSplitImage} resizeMode="contain" />
                ) : (
                  <Text style={s.lightboxPaneEmpty}>{tr("No challan photo")}</Text>
                )}
              </View>
              <View style={s.lightboxSplitPane}>
                <Text style={s.lightboxPaneLabel}>{tr("Vendor Invoice")}</Text>
                {viewingGrnDocs?.invoiceUrl ? (
                  <Image source={{ uri: viewingGrnDocs.invoiceUrl }} style={s.lightboxSplitImage} resizeMode="contain" />
                ) : (
                  <Text style={s.lightboxPaneEmpty}>{tr("No invoice photo")}</Text>
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
  pipelineCount: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  segTextActive: { color: '#0F172A' },
  segText: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  segBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segBtn: { flex: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segTrack: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 11, padding: 3 },
  segWrap: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  usagePct: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: '#64748B' },
  usageFill: { height: '100%', borderRadius: 3, backgroundColor: '#10B981' },
  usageTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  cardActionText: { fontSize: 13, fontFamily: 'Inter-SemiBold' },
  cardActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 9, borderWidth: 1, paddingHorizontal: 8 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  poMuted: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 10 },
  figValue: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginTop: 2 },
  figLabel: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  figCol: { flex: 1, minWidth: 0 },
  figRow: { flexDirection: 'row', marginTop: 12, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  sumCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12 },
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },


  // KPI Overview Cards (mirrors web)

  pipelineScroll: { flexGrow: 0, flexShrink: 0, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  pipelineChip: { height: 34, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  pipelineChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  pipelineChipText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  pipelineChipTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#475569' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 14 },
  poTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 12, fontFamily: 'Inter-SemiBold' },

  vendorTitle: { flex: 1, fontSize: 14.5, lineHeight: 20, fontFamily: 'Inter-Bold', color: '#0F172A' },
  poSub: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 4 },






  historyListBox: {
    marginTop: 6,
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  historyItemRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
    paddingBottom: 4,
    marginBottom: 4,
  },
  historyQtyText: {
    fontSize: 12.5,
    fontFamily: 'Inter-Bold',
    color: '#059669',
  },
  historyDateText: {
    fontSize: 11.5,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
  },
  historyNotesText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#475569',
    marginTop: 1,
  },


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
  modalSubtitle: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  label: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
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
    fontSize: 13,
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
  addedItemTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  addedItemSub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },

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
  addItemBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#2563EB' },
  miniFieldLabel: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B', marginBottom: 2 },

  customModeLabel: {
    fontSize: 12.5,
    fontFamily: 'Inter-SemiBold',
    color: '#475569',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    minHeight: 42,
  },
  dropdownTriggerActive: {
    borderColor: '#2563EB',
  },
  dropdownSelectedText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
  },
  dropdownPlaceholderText: {
    fontSize: 13.5,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
  },
  dropdownStockHint: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#059669',
    marginTop: 2,
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
    padding: 0,
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  dropdownEmpty: {
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  dropdownEmptyText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  dropdownItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  dropdownItemTitle: {
    fontSize: 13.5,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
  },
  dropdownItemTitleSelected: {
    fontFamily: 'Inter-SemiBold',
    color: '#2563EB',
  },
  dropdownItemSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  dropdownItemSub: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  stockPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockPillInStock: {
    backgroundColor: '#ECFDF5',
  },
  stockPillOut: {
    backgroundColor: '#FEF2F2',
  },
  stockPillText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
  },
  stockPillTextInStock: {
    color: '#059669',
  },
  stockPillTextOut: {
    color: '#DC2626',
  },

  saveBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

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
  vendorChipText: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#475569' },
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
  grnItemTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  grnItemSub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  miniLabel: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#475569', marginBottom: 2 },


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
  stageChipText: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  poMetaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  poMetaText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
  },
  saveRatesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  saveRatesBtnText: {
    fontSize: 12.5,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  ratesLockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratesLockedText: {
    fontSize: 11.5,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  rateInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    width: 65,
    textAlign: 'right',
  },
  itemSubtotalText: {
    fontSize: 12.5,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },

  poDetailItemRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  poDetailItemTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  poDetailItemSub: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },

  poTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    marginTop: 6,
  },
  poTotalLabel: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  poTotalVal: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#16A34A' },

  deletePoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 18,
    marginBottom: 10,
  },
  deletePoBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#DC2626',
  },

  photoPickerBoxSm: {
    alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 10,
    paddingVertical: 16, backgroundColor: '#F8FAFC',
  },
  photoPickerBoxSmText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#2563EB', textAlign: 'center' },

  paySummaryBox: {
    flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9',
    padding: 12, marginBottom: 4,
  },
  paySummaryVal: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2 },
  smartHint: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 8, lineHeight: 15 },

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  pillActive: { backgroundColor: '#D97706', borderColor: '#D97706' },
  pillText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
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
  lightboxPaneLabel: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 },
  lightboxSplitImage: { width: '100%', height: '90%' },
  lightboxPaneEmpty: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B' },

  // Quotes comparison styles
  quotesSection: {
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quotesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quotesHeaderTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  quotesSubtext: {
    fontSize: 12.5,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  quotesCardScroll: {
    gap: 10,
    paddingRight: 10,
  },
  quoteCard: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  quoteCardLowest: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  quoteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
    marginBottom: 6,
  },
  quoteSupplierBadge: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  quoteVendorName: {
    fontSize: 13.5,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginTop: 1,
  },
  lowestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  lowestBadgeText: {
    fontSize: 10.5,
    fontFamily: 'Inter-Bold',
    color: '#059669',
  },
  quoteRatesList: {
    gap: 4,
    marginBottom: 8,
  },
  quoteRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteItemName: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#475569',
    flex: 1,
    marginRight: 6,
  },
  quoteItemRate: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  quoteTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
    marginBottom: 8,
  },
  quoteTotalLabel: {
    fontSize: 12.5,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  quoteTotalVal: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  awardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingVertical: 6,
  },
  awardBtnLowest: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  awardBtnText: {
    fontSize: 12.5,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  awardBtnTextLowest: {
    color: '#FFFFFF',
  },
  rfqLinkBox: {
    backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#E0E7FF', borderRadius: 12, padding: 12, gap: 8, marginBottom: 12,
  },
  rfqLinkTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#4F46E5', textTransform: 'uppercase', letterSpacing: 0.4 },
  rfqLinkBadge: {
    fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#64748B', backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden',
  },
  rfqLinkUrl: {
    flex: 1, fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
  },
  rfqLinkBtn: {
    borderWidth: 1, borderColor: '#C7D2FE', backgroundColor: '#FFFFFF', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', minWidth: 56,
  },
  rfqLinkBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#4F46E5' },
  rfqLinkHint: { flex: 1, fontSize: 12, fontFamily: 'Inter-Regular', color: '#6366F1' },
  awaitingQuotesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  awaitingQuotesTitle: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#4338CA',
  },
  awaitingQuotesSub: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6366F1',
    marginTop: 2,
    lineHeight: 14,
  },
});

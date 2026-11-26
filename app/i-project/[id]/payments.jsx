import { tr } from '../../utils/i18n/tr';
import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useOrgCurrency } from '../../utils/interior/orgCurrency';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';
import { formatExactCurrency, getCurrencySymbol } from '../../utils/format';
import { useProjectPermissions } from '../../utils/interior/useProjectPermissions';
import { WebView } from 'react-native-webview';
import { standardInvoiceHtml, printInvoice, shareInvoicePdf } from '../../utils/interior/invoiceDocument';
import SkeletonList from '../../components/common/SkeletonList';

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
      <TouchableOpacity style={[inputStyle, ctrlStyles.row]} onPress={open}>
        <Text style={[ctrlStyles.text, !value && ctrlStyles.placeholder]} numberOfLines={1}>
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

// Reusable dropdown select field (replaces horizontal chip-scroll pickers for
// single-choice fields like Contract Milestone / Payment Mode).
function SelectDropdown({ value, options, onChange, placeholder = 'Select...', inputStyle }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View>
      <TouchableOpacity style={[inputStyle, ctrlStyles.row]} onPress={() => setOpen((v) => !v)}>
        <Text style={[ctrlStyles.text, !selected && ctrlStyles.placeholder]} numberOfLines={1}>
          {selected ? tr(selected.label) : placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
      </TouchableOpacity>
      {open && (
        <View style={ctrlStyles.menu}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 200 }}>
            {options.map((o, idx) => {
              const active = o.value === value;
              return (
                <TouchableOpacity
                  key={`${o.value}-${idx}`}
                  style={[ctrlStyles.menuItem, active && ctrlStyles.menuItemActive]}
                  onPress={() => { onChange(o.value); setOpen(false); }}
                >
                  <Text style={[ctrlStyles.menuItemText, active && ctrlStyles.menuItemTextActive]} numberOfLines={1}>{tr(o.label)}</Text>
                  {active && <Ionicons name="checkmark" size={14} color="#2563EB" />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const ctrlStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#0F172A', flex: 1, marginRight: 8 },
  placeholder: { color: '#94A3B8' },
  menu: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  menuItemActive: { backgroundColor: '#EFF6FF' },
  menuItemText: { fontSize: 13.5, fontFamily: 'Inter-Medium', color: '#334155', flex: 1, marginRight: 8 },
  menuItemTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },
});

const CATEGORIES = [
  { key: 'incoming', label: 'Incoming', icon: 'arrow-down-circle-outline', color: '#16A34A' },
  { key: 'outgoing', label: 'Outgoing', icon: 'arrow-up-circle-outline', color: '#DC2626' },
];

const MILESTONE_OPTIONS = [
  'Booking Advance (10%)',
  'Design Approval & Site Start (30%)',
  'Carpentry & Midpoint (40%)',
  'Final Handover (20%)',
];

const EXPENSE_CATEGORIES = [
  'Wood & Plywood', 'Electrical Services', 'Hardware & Fittings',
  'Plumbing & Sanitary', 'Paint & Finishes', 'Civil Materials',
];

const PAYMENT_METHODS = ['Bank Transfer', 'UPI', 'RTGS/NEFT', 'Cheque', 'Cash'];

function formatAmount(amount, currency = 'INR') {
  return formatExactCurrency(amount, currency);
}

function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function genRef(prefix) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${Math.floor(100 + Math.random() * 900)}`;
}

const emptyIncoming = () => ({
  milestoneName: MILESTONE_OPTIONS[0],
  invoiceNo: genRef('INV'),
  amount: '',
  paymentDate: new Date().toISOString().split('T')[0],
  paymentMethod: 'Bank Transfer',
  referenceNo: '',
  remarks: '',
});

const emptyOutgoing = () => ({
  poNo: genRef('PO'),
  vendorName: '',
  category: EXPENSE_CATEGORIES[0],
  amount: '',
  paymentDate: new Date().toISOString().split('T')[0],
  paymentMethod: 'Bank Transfer',
  referenceNo: '',
  remarks: '',
});

export default function InteriorPaymentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();
const { can: canDo } = useProjectPermissions(projectId);

  const [activeCategory, setActiveCategory] = useState('incoming');
  const [payments, setPayments] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  // Interior amounts are in the organisation's currency
  const projectCurrency = useOrgCurrency().code;
  // Invoice / receipt for incoming payments (same as the web View / Download)
  const [project, setProject] = useState(null);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [invoiceBusy, setInvoiceBusy] = useState(null); // `${id}:pdf` | 'print'
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [incomingModalOpen, setIncomingModalOpen] = useState(false);
  const [outgoingModalOpen, setOutgoingModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [incomingForm, setIncomingForm] = useState(emptyIncoming());
  const [outgoingForm, setOutgoingForm] = useState(emptyOutgoing());
  const [selectedPoId, setSelectedPoId] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const [payRes, poRes, projRes] = await Promise.allSettled([
        interiorApiClient.get(`/projects/${projectId}/payments`),
        interiorApiClient.get(`/projects/${projectId}/procurement`),
        interiorApiClient.get(`/projects/${projectId}`),
      ]);
      setPayments(payRes.status === 'fulfilled' && payRes.value?.success ? payRes.value.data || [] : []);
      setPurchaseOrders(poRes.status === 'fulfilled' && poRes.value?.success ? poRes.value.data || [] : []);
      if (projRes.status === 'fulfilled' && projRes.value?.data) setProject(projRes.value.data);
    } catch (e) {
      console.error('Failed to load payments', e);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { loadPayments(); }, [loadPayments]));

  const matchesSearch = (fields) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return fields.some((f) => (f || '').toLowerCase().includes(q));
  };

  const incoming = payments.filter((p) => p.type === 'incoming' && matchesSearch([p.invoiceNo, p.milestoneName, p.referenceNo]));
  const outgoing = payments.filter((p) => p.type === 'outgoing' && matchesSearch([p.poNo, p.vendorName, p.category, p.referenceNo]));
  const allIncoming = payments.filter((p) => p.type === 'incoming');
  const allOutgoing = payments.filter((p) => p.type === 'outgoing');

  const fmt = (amt) => formatAmount(amt, projectCurrency);

  const handlePoSelect = (poId) => {
    setSelectedPoId(poId);
    if (!poId) {
      setOutgoingForm((f) => ({ ...f, poNo: genRef('PO'), vendorName: '', category: EXPENSE_CATEGORIES[0], amount: '' }));
      return;
    }
    const po = purchaseOrders.find((p) => p._id === poId || p.poNumber === poId);
    if (po) {
      const alreadyPaid = payments.filter((p) => p.type === 'outgoing' && p.poNo === po.poNumber).reduce((sum, p) => sum + (p.amount || 0), 0);
      const remaining = Math.max(0, (po.amount || 0) - alreadyPaid);
      setOutgoingForm((f) => ({
        ...f,
        poNo: po.poNumber || po._id,
        vendorName: po.vendorName || po.vendorId?.name || '',
        category: po.materialName || EXPENSE_CATEGORIES[0],
        amount: remaining > 0 ? String(remaining) : String(po.amount || 0),
        remarks: `Payment against PO ${po.poNumber} (${po.materialName || 'Materials'})`,
      }));
    }
  };

  const handleDeletePayment = (tx) => {
    Alert.alert(tr("Delete Payment Record"), tr("Are you sure you want to delete this payment record? This cannot be undone."), [
      { text: tr("Cancel"), style: 'cancel' },
      {
        text: tr("Delete"), style: 'destructive', onPress: async () => {
          try {
            await interiorApiClient.delete(`/projects/${projectId}/payments/${tx._id}`);
            showToast(tr("Payment record deleted successfully"), 'success');
            loadPayments();
          } catch (e) {
            showToast(e.message || tr("Failed to delete payment"), 'error');
          }
        },
      },
    ]);
  };

  const netBalance = allIncoming.reduce((s, p) => s + (p.amount || 0), 0) - allOutgoing.reduce((s, p) => s + (p.amount || 0), 0);

  const submitPayment = async (payload, onSuccess) => {
    setSubmitting(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/payments`, payload);
      showToast(tr("Payment recorded successfully"), 'success');
      onSuccess();
      loadPayments();
    } catch (e) {
      showToast(e.message || tr("Failed to record payment"), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleIncomingSubmit = () => {
    const amt = parseFloat(incomingForm.amount);
    if (!amt || amt <= 0) return showToast(tr("Enter a valid payment amount"), 'error');
    if (!incomingForm.referenceNo.trim()) return showToast(tr("Reference / UTR number is required"), 'error');
    submitPayment(
      {
        type: 'incoming',
        invoiceNo: incomingForm.invoiceNo,
        milestoneName: incomingForm.milestoneName,
        amount: amt,
        paymentDate: incomingForm.paymentDate,
        paymentMethod: incomingForm.paymentMethod,
        referenceNo: incomingForm.referenceNo.trim(),
        remarks: incomingForm.remarks.trim(),
      },
      () => { setIncomingModalOpen(false); setIncomingForm(emptyIncoming()); }
    );
  };

  const handleOutgoingSubmit = () => {
    const amt = parseFloat(outgoingForm.amount);
    if (!outgoingForm.vendorName.trim()) return showToast(tr("Vendor / contractor name is required"), 'error');
    if (!amt || amt <= 0) return showToast(tr("Enter a valid payout amount"), 'error');
    if (!outgoingForm.referenceNo.trim()) return showToast(tr("Reference / UTR number is required"), 'error');
    submitPayment(
      {
        type: 'outgoing',
        poNo: outgoingForm.poNo,
        vendorName: outgoingForm.vendorName.trim(),
        category: outgoingForm.category,
        amount: amt,
        paymentDate: outgoingForm.paymentDate,
        paymentMethod: outgoingForm.paymentMethod,
        referenceNo: outgoingForm.referenceNo.trim(),
        remarks: outgoingForm.remarks.trim(),
      },
      () => { setOutgoingModalOpen(false); setOutgoingForm(emptyOutgoing()); }
    );
  };

  const invoiceSymbol = getCurrencySymbol(projectCurrency);
  const runInvoice = async (key, fn, tx) => {
    setInvoiceBusy(key);
    try {
      await fn(tx, project, invoiceSymbol);
    } catch (e) {
      if (!/cancel/i.test(e?.message || '')) showToast(e?.message || tr("Failed to generate the invoice"), 'error');
    } finally {
      setInvoiceBusy(null);
    }
  };

  const openCreateModal = () => {
    if (activeCategory === 'incoming') setIncomingModalOpen(true);
    else setOutgoingModalOpen(true);
  };

  const renderList = () => {
    if (activeCategory === 'incoming') {
      return incoming.length === 0 ? (
        <Empty icon="arrow-down-circle-outline" text="No incoming client payments yet." />
      ) : incoming.map((tx) => (
        <View key={tx._id} style={s.card}>
          <View style={s.cardTopRow}>
            <Text style={s.cardTitle} numberOfLines={1}>{tr(tx.invoiceNo)}</Text>
            <Text style={[s.cardAmount, { color: '#16A34A' }]}>+{fmt(tx.amount)}</Text>
          </View>
          <Text style={s.cardSub}>{tr(tx.milestoneName)}</Text>
          <View style={s.cardBottomRow}>
            <Text style={s.cardMeta}>{tr(tx.paymentMethod)}{tr(" • Ref: ")}{tr(tx.referenceNo)}</Text>
            <Text style={s.cardMeta}>{formatDate(tx.paymentDate)}</Text>
          </View>
          <View style={s.cardFooterRow}>
            <View style={[s.statusPill, { backgroundColor: '#F0FDF4' }]}>
              <Text style={[s.statusPillText, { color: '#16A34A' }]}>{tx.incomingStatus || tr("Completed")}</Text>
            </View>
            <View style={s.invoiceActions}>
              <TouchableOpacity style={s.invoiceBtn} onPress={() => setPreviewInvoice(tx)}>
                <Ionicons name="eye-outline" size={14} color="#1D4ED8" />
                <Text style={s.invoiceBtnText}>{tr("View")}</Text>
              </TouchableOpacity>
              {canDo('financials', 'export') && (
                <TouchableOpacity
                  style={s.invoiceBtn}
                  onPress={() => runInvoice(`${tx._id}:pdf`, shareInvoicePdf, tx)}
                  disabled={invoiceBusy === `${tx._id}:pdf`}
                >
                  {invoiceBusy === `${tx._id}:pdf`
                    ? <ActivityIndicator size="small" color="#1D4ED8" />
                    : <Ionicons name="download-outline" size={14} color="#1D4ED8" />}
                  <Text style={s.invoiceBtnText}>{tr("PDF")}</Text>
                </TouchableOpacity>
              )}
              {canDo('financials', 'delete') && (
                <TouchableOpacity onPress={() => handleDeletePayment(tx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      ));
    }
    if (activeCategory === 'outgoing') {
      return outgoing.length === 0 ? (
        <Empty icon="arrow-up-circle-outline" text="No outgoing vendor payouts yet." />
      ) : outgoing.map((tx) => (
        <View key={tx._id} style={s.card}>
          <View style={s.cardTopRow}>
            <Text style={s.cardTitle} numberOfLines={1}>{tr(tx.vendorName)}</Text>
            <Text style={[s.cardAmount, { color: '#DC2626' }]}>-{fmt(tx.amount)}</Text>
          </View>
          <Text style={s.cardSub}>{tr(tx.poNo)} • {tr(tx.category)}</Text>
          <View style={s.cardBottomRow}>
            <Text style={s.cardMeta}>{tr(tx.paymentMethod)}{tr(" • Ref: ")}{tr(tx.referenceNo)}</Text>
            <Text style={s.cardMeta}>{formatDate(tx.paymentDate)}</Text>
          </View>
          <View style={s.cardFooterRow}>
            <View style={[s.statusPill, { backgroundColor: tx.outgoingStatus === 'Paid' ? '#F0FDF4' : '#FFFBEB' }]}>
              <Text style={[s.statusPillText, { color: tx.outgoingStatus === 'Paid' ? '#16A34A' : '#D97706' }]}>{tx.outgoingStatus || tr("Paid")}</Text>
            </View>
            {canDo('financials', 'delete') && (
              <TouchableOpacity onPress={() => handleDeletePayment(tx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ));
    }
    return null;
  };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{tr("Payments & Financial Ledger")}</Text>
          </View>
        </View>

        {loading ? (
          <SkeletonList />
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.summaryRow}>
              <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>{tr("Net Balance")}</Text>
                <Text style={[s.summaryValue, { color: netBalance >= 0 ? '#16A34A' : '#DC2626' }]}>{fmt(Math.abs(netBalance))}</Text>
              </View>
              <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>{tr("Incoming")}</Text>
                <Text style={[s.summaryValue, { color: '#16A34A' }]}>{fmt(allIncoming.reduce((s2, p) => s2 + (p.amount || 0), 0))}</Text>
              </View>
              <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>{tr("Outgoing")}</Text>
                <Text style={[s.summaryValue, { color: '#DC2626' }]}>{fmt(allOutgoing.reduce((s2, p) => s2 + (p.amount || 0), 0))}</Text>
              </View>
            </ScrollView>

            <View style={s.tabRow}>
              {CATEGORIES.map((c) => {
                const active = activeCategory === c.key;
                return (
                  <TouchableOpacity key={c.key} style={[s.tabBtn, active && s.tabBtnActive]} onPress={() => setActiveCategory(c.key)} activeOpacity={0.8}>
                    <Text style={[s.tabBtnText, active && { color: c.color }]} numberOfLines={1}>{tr(c.label)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.searchRow}>
              <Ionicons name="search" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput style={s.searchInput} placeholder={tr("Search by reference, vendor, invoice...")} placeholderTextColor="#94A3B8" value={searchQuery} onChangeText={setSearchQuery} />
            </View>

            {renderList()}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {canDo('financials', 'create') && (
          <TouchableOpacity style={s.fab} onPress={openCreateModal}>
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Incoming Payment Modal */}
      <Modal visible={incomingModalOpen} animationType="slide" transparent onRequestClose={() => setIncomingModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{tr("Record Incoming Payment")}</Text>
              <TouchableOpacity onPress={() => setIncomingModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>{tr("Contract Milestone")}</Text>
              <SelectDropdown
                value={incomingForm.milestoneName}
                options={MILESTONE_OPTIONS.map((m) => ({ value: m, label: m }))}
                onChange={(v) => setIncomingForm({ ...incomingForm, milestoneName: v })}
                placeholder={tr("Select milestone")}
                inputStyle={s.input}
              />

              <Text style={s.label}>{tr("Amount (")}{getCurrencySymbol(projectCurrency)})</Text>
              <TextInput style={s.input} placeholder="e.g. 250000" placeholderTextColor="#94A3B8" keyboardType="numeric" value={incomingForm.amount} onChangeText={(v) => setIncomingForm({ ...incomingForm, amount: v })} />

              <Text style={s.label}>{tr("Payment Date")}</Text>
              <DateField value={incomingForm.paymentDate} onChange={(v) => setIncomingForm({ ...incomingForm, paymentDate: v })} inputStyle={s.input} />

              <Text style={s.label}>{tr("Payment Mode")}</Text>
              <SelectDropdown
                value={incomingForm.paymentMethod}
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
                onChange={(v) => setIncomingForm({ ...incomingForm, paymentMethod: v })}
                placeholder={tr("Select payment mode")}
                inputStyle={s.input}
              />

              <Text style={s.label}>{tr("Ref / Transaction Number")}</Text>
              <TextInput style={s.input} placeholder={tr("e.g. WIRE-89210928 / CHQ-4401")} placeholderTextColor="#94A3B8" value={incomingForm.referenceNo} onChangeText={(v) => setIncomingForm({ ...incomingForm, referenceNo: v })} />

              <Text style={s.label}>{tr("Remarks")}</Text>
              <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} multiline placeholder={tr("Enter transaction notes...")} placeholderTextColor="#94A3B8" value={incomingForm.remarks} onChangeText={(v) => setIncomingForm({ ...incomingForm, remarks: v })} />

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.6 }]} onPress={handleIncomingSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>{tr("Save Incoming Payment")}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Outgoing Payment Modal */}
      <Modal visible={outgoingModalOpen} animationType="slide" transparent onRequestClose={() => setOutgoingModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{tr("Record Outgoing Payment")}</Text>
              <TouchableOpacity onPress={() => setOutgoingModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {purchaseOrders.length > 0 && (
                <>
                  <Text style={s.label}>{tr("Link Purchase Order (Optional)")}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                    <TouchableOpacity style={[s.pill, !selectedPoId && s.pillActive]} onPress={() => handlePoSelect('')}>
                      <Text style={[s.pillText, !selectedPoId && s.pillTextActive]}>{tr("Direct Payment (No PO)")}</Text>
                    </TouchableOpacity>
                    {purchaseOrders.map((po) => (
                      <TouchableOpacity key={po._id} style={[s.pill, selectedPoId === po._id && s.pillActive]} onPress={() => handlePoSelect(po._id)}>
                        <Text style={[s.pillText, selectedPoId === po._id && s.pillTextActive]} numberOfLines={1}>{tr(po.poNumber)} · {tr(po.materialName)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={s.label}>{tr("Vendor / Contractor Name")}</Text>
              <TextInput style={s.input} placeholder={tr("e.g. Royal Wood Suppliers")} placeholderTextColor="#94A3B8" value={outgoingForm.vendorName} onChangeText={(v) => setOutgoingForm({ ...outgoingForm, vendorName: v })} />

              <Text style={s.label}>{tr("Expense Category")}</Text>
              <View style={s.pillWrap}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <TouchableOpacity key={c} style={[s.pill, outgoingForm.category === c && s.pillActive]} onPress={() => setOutgoingForm({ ...outgoingForm, category: c })}>
                    <Text style={[s.pillText, outgoingForm.category === c && s.pillTextActive]}>{tr(c)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>{tr("Amount (")}{getCurrencySymbol(projectCurrency)})</Text>
              <TextInput style={s.input} placeholder="e.g. 150000" placeholderTextColor="#94A3B8" keyboardType="numeric" value={outgoingForm.amount} onChangeText={(v) => setOutgoingForm({ ...outgoingForm, amount: v })} />

              <Text style={s.label}>{tr("Payment Date")}</Text>
              <DateField value={outgoingForm.paymentDate} onChange={(v) => setOutgoingForm({ ...outgoingForm, paymentDate: v })} inputStyle={s.input} />

              <Text style={s.label}>{tr("Payment Mode")}</Text>
              <SelectDropdown
                value={outgoingForm.paymentMethod}
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
                onChange={(v) => setOutgoingForm({ ...outgoingForm, paymentMethod: v })}
                placeholder={tr("Select payment mode")}
                inputStyle={s.input}
              />

              <Text style={s.label}>{tr("Ref / Transaction Number")}</Text>
              <TextInput style={s.input} placeholder={tr("e.g. TXN-9812401")} placeholderTextColor="#94A3B8" value={outgoingForm.referenceNo} onChangeText={(v) => setOutgoingForm({ ...outgoingForm, referenceNo: v })} />

              <Text style={s.label}>{tr("Remarks")}</Text>
              <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} multiline placeholder={tr("Enter transaction notes...")} placeholderTextColor="#94A3B8" value={outgoingForm.remarks} onChangeText={(v) => setOutgoingForm({ ...outgoingForm, remarks: v })} />

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.6 }]} onPress={handleOutgoingSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>{tr("Save Outgoing Payment")}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Invoice & Receipt preview (same document as the web) */}
      <Modal visible={!!previewInvoice} animationType="slide" onRequestClose={() => setPreviewInvoice(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
          <View style={s.invoiceHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.invoiceHeaderTitle}>{tr("Payment Invoice & Receipt")}</Text>
              <Text style={s.invoiceHeaderSub} numberOfLines={1}>
                {previewInvoice?.invoiceNo || tr("Invoice")} • {previewInvoice ? fmt(previewInvoice.amount) : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setPreviewInvoice(null)} style={s.invoiceClose}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
          {previewInvoice && (
            <WebView
              originWhitelist={['*']}
              source={{ html: standardInvoiceHtml(previewInvoice, project, invoiceSymbol) }}
              style={{ flex: 1, backgroundColor: '#F1F5F9' }}
            />
          )}
          <View style={s.invoiceFooter}>
            <TouchableOpacity style={s.invoiceFooterBtn} onPress={() => runInvoice('print', printInvoice, previewInvoice)} disabled={!!invoiceBusy}>
              {invoiceBusy === 'print' ? <ActivityIndicator size="small" color="#334155" /> : <Ionicons name="print-outline" size={16} color="#334155" />}
              <Text style={s.invoiceFooterText}>{tr("Print")}</Text>
            </TouchableOpacity>
            {canDo('financials', 'export') && (
              <TouchableOpacity
                style={[s.invoiceFooterBtn, { backgroundColor: '#2563EB', borderColor: '#2563EB' }]}
                onPress={() => runInvoice('preview:pdf', shareInvoicePdf, previewInvoice)}
                disabled={!!invoiceBusy}
              >
                {invoiceBusy === 'preview:pdf' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="download-outline" size={16} color="#FFFFFF" />}
                <Text style={[s.invoiceFooterText, { color: '#FFFFFF' }]}>{tr("Download PDF")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function Empty({ icon, text }) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={40} color="#CBD5E1" />
      <Text style={s.emptyTitle}>{tr(text)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  invoiceActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  invoiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  invoiceBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#1D4ED8' },
  invoiceHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  invoiceHeaderTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  invoiceHeaderSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },
  invoiceClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  invoiceFooter: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  invoiceFooterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  invoiceFooterText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#334155' },
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 14 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },

  summaryRow: { gap: 8, marginBottom: 14 },
  summaryCard: { width: 130, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  summaryLabel: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#94A3B8' },
  summaryValue: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 4 },

  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, height: 40, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 13.5, fontFamily: 'Inter-Regular', color: '#0F172A' },

  cardFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },

  tabRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 11, padding: 3, marginBottom: 12 },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: 9 },
  tabBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabBtnText: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 10 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1 },
  cardAmount: { fontSize: 14, fontFamily: 'Inter-Bold' },
  cardSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 3 },
  cardReason: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 4 },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  cardMeta: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 11.5, fontFamily: 'Inter-Bold' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#64748B' },

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

  label: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  pillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  pillText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  pillTextActive: { color: '#FFFFFF' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

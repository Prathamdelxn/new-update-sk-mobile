import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const CATEGORIES = [
  { key: 'incoming', label: 'Incoming', icon: 'arrow-down-circle-outline', color: '#16A34A' },
  { key: 'outgoing', label: 'Outgoing', icon: 'arrow-up-circle-outline', color: '#DC2626' },
  { key: 'debit_note', label: 'Debit Notes', icon: 'document-text-outline', color: '#D97706' },
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

function formatAmount(amount) {
  return `₹${Math.round(amount || 0).toLocaleString('en-IN')}`;
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

const emptyDebitNote = () => ({
  debitNoteNo: genRef('DN'),
  vendorName: '',
  reason: '',
  amount: '',
  issueDate: new Date().toISOString().split('T')[0],
  remarks: '',
});

export default function InteriorPaymentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [activeCategory, setActiveCategory] = useState('incoming');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [incomingModalOpen, setIncomingModalOpen] = useState(false);
  const [outgoingModalOpen, setOutgoingModalOpen] = useState(false);
  const [debitNoteModalOpen, setDebitNoteModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [incomingForm, setIncomingForm] = useState(emptyIncoming());
  const [outgoingForm, setOutgoingForm] = useState(emptyOutgoing());
  const [debitNoteForm, setDebitNoteForm] = useState(emptyDebitNote());

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/payments`);
      setPayments(res?.success ? res.data || [] : []);
    } catch (e) {
      console.error('Failed to load payments', e);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { loadPayments(); }, [loadPayments]));

  const incoming = payments.filter((p) => p.type === 'incoming');
  const outgoing = payments.filter((p) => p.type === 'outgoing');
  const debitNotes = payments.filter((p) => p.type === 'debit_note');

  const netBalance = incoming.reduce((s, p) => s + (p.amount || 0), 0) - outgoing.reduce((s, p) => s + (p.amount || 0), 0);

  const submitPayment = async (payload, onSuccess) => {
    setSubmitting(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/payments`, payload);
      showToast('Payment recorded successfully', 'success');
      onSuccess();
      loadPayments();
    } catch (e) {
      showToast(e.message || 'Failed to record payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleIncomingSubmit = () => {
    const amt = parseFloat(incomingForm.amount);
    if (!amt || amt <= 0) return showToast('Enter a valid payment amount', 'error');
    if (!incomingForm.referenceNo.trim()) return showToast('Reference / UTR number is required', 'error');
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
    if (!outgoingForm.vendorName.trim()) return showToast('Vendor / contractor name is required', 'error');
    if (!amt || amt <= 0) return showToast('Enter a valid payout amount', 'error');
    if (!outgoingForm.referenceNo.trim()) return showToast('Reference / UTR number is required', 'error');
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

  const handleDebitNoteSubmit = () => {
    const amt = parseFloat(debitNoteForm.amount);
    if (!debitNoteForm.vendorName.trim()) return showToast('Vendor / party name is required', 'error');
    if (!debitNoteForm.reason.trim()) return showToast('Reason / defect detail is required', 'error');
    if (!amt || amt <= 0) return showToast('Enter a valid debit amount', 'error');
    submitPayment(
      {
        type: 'debit_note',
        debitNoteNo: debitNoteForm.debitNoteNo,
        vendorName: debitNoteForm.vendorName.trim(),
        reason: debitNoteForm.reason.trim(),
        amount: amt,
        issueDate: debitNoteForm.issueDate,
        remarks: debitNoteForm.remarks.trim(),
      },
      () => { setDebitNoteModalOpen(false); setDebitNoteForm(emptyDebitNote()); }
    );
  };

  const openCreateModal = () => {
    if (activeCategory === 'incoming') setIncomingModalOpen(true);
    else if (activeCategory === 'outgoing') setOutgoingModalOpen(true);
    else setDebitNoteModalOpen(true);
  };

  const renderList = () => {
    if (activeCategory === 'incoming') {
      return incoming.length === 0 ? (
        <Empty icon="arrow-down-circle-outline" text="No incoming client payments yet." />
      ) : incoming.map((tx) => (
        <View key={tx._id} style={s.card}>
          <View style={s.cardTopRow}>
            <Text style={s.cardTitle} numberOfLines={1}>{tx.invoiceNo}</Text>
            <Text style={[s.cardAmount, { color: '#16A34A' }]}>+{formatAmount(tx.amount)}</Text>
          </View>
          <Text style={s.cardSub}>{tx.milestoneName}</Text>
          <View style={s.cardBottomRow}>
            <Text style={s.cardMeta}>{tx.paymentMethod} • Ref: {tx.referenceNo}</Text>
            <Text style={s.cardMeta}>{formatDate(tx.paymentDate)}</Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: '#F0FDF4', alignSelf: 'flex-start', marginTop: 8 }]}>
            <Text style={[s.statusPillText, { color: '#16A34A' }]}>{tx.incomingStatus || 'Completed'}</Text>
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
            <Text style={s.cardTitle} numberOfLines={1}>{tx.vendorName}</Text>
            <Text style={[s.cardAmount, { color: '#DC2626' }]}>-{formatAmount(tx.amount)}</Text>
          </View>
          <Text style={s.cardSub}>{tx.poNo} • {tx.category}</Text>
          <View style={s.cardBottomRow}>
            <Text style={s.cardMeta}>{tx.paymentMethod} • Ref: {tx.referenceNo}</Text>
            <Text style={s.cardMeta}>{formatDate(tx.paymentDate)}</Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: tx.outgoingStatus === 'Paid' ? '#F0FDF4' : '#FFFBEB', alignSelf: 'flex-start', marginTop: 8 }]}>
            <Text style={[s.statusPillText, { color: tx.outgoingStatus === 'Paid' ? '#16A34A' : '#D97706' }]}>{tx.outgoingStatus || 'Paid'}</Text>
          </View>
        </View>
      ));
    }
    return debitNotes.length === 0 ? (
      <Empty icon="document-text-outline" text="No debit notes issued yet." />
    ) : debitNotes.map((dn) => (
      <View key={dn._id} style={s.card}>
        <View style={s.cardTopRow}>
          <Text style={s.cardTitle} numberOfLines={1}>{dn.debitNoteNo}</Text>
          <Text style={[s.cardAmount, { color: '#D97706' }]}>{formatAmount(dn.amount)}</Text>
        </View>
        <Text style={s.cardSub}>{dn.vendorName}</Text>
        <Text style={s.cardReason} numberOfLines={2}>{dn.reason}</Text>
        <View style={s.cardBottomRow}>
          <Text style={s.cardMeta}>{formatDate(dn.issueDate)}</Text>
        </View>
        <View style={[s.statusPill, { backgroundColor: dn.debitNoteStatus === 'Settled' ? '#F0FDF4' : dn.debitNoteStatus === 'Adjusted' ? '#EFF6FF' : '#FFFBEB', alignSelf: 'flex-start', marginTop: 8 }]}>
          <Text style={[s.statusPillText, { color: dn.debitNoteStatus === 'Settled' ? '#16A34A' : dn.debitNoteStatus === 'Adjusted' ? '#2563EB' : '#D97706' }]}>{dn.debitNoteStatus || 'Issued'}</Text>
        </View>
      </View>
    ));
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
            <Text style={s.headerTitle}>Payments & Financial Ledger</Text>
            <Text style={s.headerSub}>Incoming receipts, vendor payouts & debit notes.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.summaryRow}>
              <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>Net Balance</Text>
                <Text style={[s.summaryValue, { color: netBalance >= 0 ? '#16A34A' : '#DC2626' }]}>{formatAmount(Math.abs(netBalance))}</Text>
              </View>
              <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>Incoming</Text>
                <Text style={[s.summaryValue, { color: '#16A34A' }]}>{formatAmount(incoming.reduce((s2, p) => s2 + (p.amount || 0), 0))}</Text>
              </View>
              <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>Outgoing</Text>
                <Text style={[s.summaryValue, { color: '#DC2626' }]}>{formatAmount(outgoing.reduce((s2, p) => s2 + (p.amount || 0), 0))}</Text>
              </View>
            </View>

            <View style={s.tabRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[s.tabBtn, activeCategory === c.key && { backgroundColor: c.color }]}
                  onPress={() => setActiveCategory(c.key)}
                >
                  <Ionicons name={c.icon} size={14} color={activeCategory === c.key ? '#FFFFFF' : c.color} />
                  <Text style={[s.tabBtnText, activeCategory === c.key && { color: '#FFFFFF' }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {renderList()}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        <TouchableOpacity style={s.fab} onPress={openCreateModal}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Incoming Payment Modal */}
      <Modal visible={incomingModalOpen} animationType="slide" transparent onRequestClose={() => setIncomingModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Record Incoming Payment</Text>
              <TouchableOpacity onPress={() => setIncomingModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Contract Milestone</Text>
              <View style={s.pillWrap}>
                {MILESTONE_OPTIONS.map((m) => (
                  <TouchableOpacity key={m} style={[s.pill, incomingForm.milestoneName === m && s.pillActive]} onPress={() => setIncomingForm({ ...incomingForm, milestoneName: m })}>
                    <Text style={[s.pillText, incomingForm.milestoneName === m && s.pillTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Amount (₹)</Text>
              <TextInput style={s.input} placeholder="e.g. 250000" placeholderTextColor="#94A3B8" keyboardType="numeric" value={incomingForm.amount} onChangeText={(v) => setIncomingForm({ ...incomingForm, amount: v })} />

              <Text style={s.label}>Payment Date</Text>
              <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={incomingForm.paymentDate} onChangeText={(v) => setIncomingForm({ ...incomingForm, paymentDate: v })} />

              <Text style={s.label}>Payment Mode</Text>
              <View style={s.pillWrap}>
                {PAYMENT_METHODS.map((m) => (
                  <TouchableOpacity key={m} style={[s.pill, incomingForm.paymentMethod === m && s.pillActive]} onPress={() => setIncomingForm({ ...incomingForm, paymentMethod: m })}>
                    <Text style={[s.pillText, incomingForm.paymentMethod === m && s.pillTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Ref / UTR Number</Text>
              <TextInput style={s.input} placeholder="e.g. HDFC10928301" placeholderTextColor="#94A3B8" value={incomingForm.referenceNo} onChangeText={(v) => setIncomingForm({ ...incomingForm, referenceNo: v })} />

              <Text style={s.label}>Remarks</Text>
              <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} multiline placeholder="Enter transaction notes..." placeholderTextColor="#94A3B8" value={incomingForm.remarks} onChangeText={(v) => setIncomingForm({ ...incomingForm, remarks: v })} />

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.6 }]} onPress={handleIncomingSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Save Incoming Payment</Text>}
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
              <Text style={s.modalTitle}>Record Outgoing Payment</Text>
              <TouchableOpacity onPress={() => setOutgoingModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Vendor / Contractor Name</Text>
              <TextInput style={s.input} placeholder="e.g. Royal Wood Suppliers" placeholderTextColor="#94A3B8" value={outgoingForm.vendorName} onChangeText={(v) => setOutgoingForm({ ...outgoingForm, vendorName: v })} />

              <Text style={s.label}>Expense Category</Text>
              <View style={s.pillWrap}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <TouchableOpacity key={c} style={[s.pill, outgoingForm.category === c && s.pillActive]} onPress={() => setOutgoingForm({ ...outgoingForm, category: c })}>
                    <Text style={[s.pillText, outgoingForm.category === c && s.pillTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Amount (₹)</Text>
              <TextInput style={s.input} placeholder="e.g. 150000" placeholderTextColor="#94A3B8" keyboardType="numeric" value={outgoingForm.amount} onChangeText={(v) => setOutgoingForm({ ...outgoingForm, amount: v })} />

              <Text style={s.label}>Payment Date</Text>
              <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={outgoingForm.paymentDate} onChangeText={(v) => setOutgoingForm({ ...outgoingForm, paymentDate: v })} />

              <Text style={s.label}>Payment Mode</Text>
              <View style={s.pillWrap}>
                {PAYMENT_METHODS.map((m) => (
                  <TouchableOpacity key={m} style={[s.pill, outgoingForm.paymentMethod === m && s.pillActive]} onPress={() => setOutgoingForm({ ...outgoingForm, paymentMethod: m })}>
                    <Text style={[s.pillText, outgoingForm.paymentMethod === m && s.pillTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Ref / UTR Number</Text>
              <TextInput style={s.input} placeholder="e.g. UTR-9812401" placeholderTextColor="#94A3B8" value={outgoingForm.referenceNo} onChangeText={(v) => setOutgoingForm({ ...outgoingForm, referenceNo: v })} />

              <Text style={s.label}>Remarks</Text>
              <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} multiline placeholder="Enter transaction notes..." placeholderTextColor="#94A3B8" value={outgoingForm.remarks} onChangeText={(v) => setOutgoingForm({ ...outgoingForm, remarks: v })} />

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.6 }]} onPress={handleOutgoingSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Save Outgoing Payment</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Debit Note Modal */}
      <Modal visible={debitNoteModalOpen} animationType="slide" transparent onRequestClose={() => setDebitNoteModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Issue Debit Note</Text>
              <TouchableOpacity onPress={() => setDebitNoteModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Vendor / Party Name</Text>
              <TextInput style={s.input} placeholder="e.g. Royal Wood Suppliers" placeholderTextColor="#94A3B8" value={debitNoteForm.vendorName} onChangeText={(v) => setDebitNoteForm({ ...debitNoteForm, vendorName: v })} />

              <Text style={s.label}>Reason / Defect Detail</Text>
              <TextInput style={[s.input, { height: 60, textAlignVertical: 'top' }]} multiline placeholder="e.g. Damaged plywood sheets returned (5 sheets)" placeholderTextColor="#94A3B8" value={debitNoteForm.reason} onChangeText={(v) => setDebitNoteForm({ ...debitNoteForm, reason: v })} />

              <Text style={s.label}>Amount (₹)</Text>
              <TextInput style={s.input} placeholder="e.g. 45000" placeholderTextColor="#94A3B8" keyboardType="numeric" value={debitNoteForm.amount} onChangeText={(v) => setDebitNoteForm({ ...debitNoteForm, amount: v })} />

              <Text style={s.label}>Issue Date</Text>
              <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={debitNoteForm.issueDate} onChangeText={(v) => setDebitNoteForm({ ...debitNoteForm, issueDate: v })} />

              <Text style={s.label}>Remarks</Text>
              <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} multiline placeholderTextColor="#94A3B8" value={debitNoteForm.remarks} onChangeText={(v) => setDebitNoteForm({ ...debitNoteForm, remarks: v })} />

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.6 }]} onPress={handleDebitNoteSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Issue Debit Note</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Empty({ icon, text }) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={40} color="#CBD5E1" />
      <Text style={s.emptyTitle}>{text}</Text>
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

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  summaryLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8' },
  summaryValue: { fontSize: 14, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 4 },

  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  tabBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#64748B' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 10 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1 },
  cardAmount: { fontSize: 13, fontFamily: 'Inter-Black' },
  cardSub: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 3 },
  cardReason: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 4 },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  cardMeta: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 10, fontFamily: 'Inter-Bold' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },

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

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  pillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  pillText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  pillTextActive: { color: '#FFFFFF' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

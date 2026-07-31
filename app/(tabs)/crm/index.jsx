import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HeaderNotification from '../../components/HeaderNotification';

const STAGES = ['New Lead', 'Consultation Scheduled', 'Proposal Sent', 'Contract Signed'];

const STAGE_META = {
  'New Lead':                  { color: '#0284C7', bg: '#F0F9FF' },
  'Consultation Scheduled':    { color: '#4F46E5', bg: '#EEF2FF' },
  'Proposal Sent':             { color: '#D97706', bg: '#FFFBEB' },
  'Contract Signed':           { color: '#16A34A', bg: '#F0FDF4' },
  'Lost':                      { color: '#64748B', bg: '#F8FAFC' },
};

const INITIAL_LEADS = [
  { id: '1', clientName: 'Vikram & Radhika Mehta', email: 'vikram.mehta@gmail.com', phone: '+1 (555) 234-8901', propertyType: 'Luxury Penthouse (450 m²)', budget: '$120,000', stage: 'Contract Signed', consultationDate: 'Jul 24, 2026' },
  { id: '2', clientName: 'Sophie Turner', email: 'sophie.t@designcorp.com', phone: '+1 (555) 876-1234', propertyType: 'Residential Villa (600 m²)', budget: '$250,000', stage: 'Proposal Sent', consultationDate: 'Jul 28, 2026' },
  { id: '3', clientName: 'Apex Capital Offices', email: 'contact@apexcap.com', phone: '+1 (555) 432-9087', propertyType: 'Executive Office Suite (800 m²)', budget: '$180,000', stage: 'Consultation Scheduled', consultationDate: 'Jul 31, 2026' },
  { id: '4', clientName: 'Julian Rossi', email: 'julian.rossi@luxury.it', phone: '+1 (555) 345-6789', propertyType: 'Boutique Hotel Lobby', budget: '$300,000', stage: 'New Lead', consultationDate: 'Aug 02, 2026' },
];

export default function CRMScreen() {
  const insets = useSafeAreaInsets();

  const [leads, setLeads] = useState(INITIAL_LEADS);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [isModalVisible, setIsModalVisible] = useState(false);

  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [propertyType, setPropertyType] = useState('Residential Villa');
  const [budget, setBudget] = useState('$50,000');

  const filteredLeads = leads.filter((l) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      l.clientName.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.propertyType.toLowerCase().includes(q);
    const matchesStage = stageFilter === 'All' || l.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const resetForm = () => {
    setClientName('');
    setEmail('');
    setPhone('');
    setPropertyType('Residential Villa');
    setBudget('$50,000');
  };

  const handleAddLead = () => {
    if (!clientName.trim() || !email.trim()) return;
    const newLead = {
      id: String(Date.now()),
      clientName: clientName.trim(),
      email: email.trim(),
      phone: phone.trim() || '+1 (555) 000-0000',
      propertyType,
      budget: budget.startsWith('$') ? budget : `$${budget}`,
      stage: 'New Lead',
      consultationDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
    setLeads([newLead, ...leads]);
    resetForm();
    setIsModalVisible(false);
  };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <View style={s.bgBase} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={s.headerGreeting}>Workspace</Text>
            <Text style={s.pageTitle}>Client CRM</Text>
          </View>
          <HeaderNotification />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* Stat cards */}
          <View style={s.statsGrid}>
            <StatCard icon="people-outline" iconBg="#F0F9FF" iconColor="#0284C7" label="Total Pipeline" value={`${leads.length}`} sub="leads" />
            <StatCard icon="calendar-outline" iconBg="#EEF2FF" iconColor="#4F46E5" label="Consultations" value="3" sub="this week" />
            <StatCard icon="cash-outline" iconBg="#F0FDF4" iconColor="#16A34A" label="Pipeline Value" value="$850K" />
            <StatCard icon="trending-up-outline" iconBg="#FFFBEB" iconColor="#D97706" label="Conversion" value="85%" />
          </View>

          {/* Search */}
          <View style={s.searchRow}>
            <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Search by client or property..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Stage filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {['All', ...STAGES].map((stage) => {
              const active = stageFilter === stage;
              return (
                <TouchableOpacity
                  key={stage}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setStageFilter(stage)}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{stage}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Lead list */}
          <View style={{ marginTop: 16, gap: 12 }}>
            {filteredLeads.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="people-outline" size={44} color="#94A3B8" />
                <Text style={s.emptyTitle}>No client leads found</Text>
              </View>
            ) : (
              filteredLeads.map((lead) => {
                const meta = STAGE_META[lead.stage] || STAGE_META['Lost'];
                return (
                  <View key={lead.id} style={s.leadCard}>
                    <View style={s.leadTopRow}>
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>{lead.clientName.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.leadName} numberOfLines={1}>{lead.clientName}</Text>
                        <Text style={s.leadSub} numberOfLines={1}>{lead.propertyType}</Text>
                      </View>
                      <Text style={s.leadBudget}>{lead.budget}</Text>
                    </View>

                    <View style={s.leadBottomRow}>
                      <View style={[s.stageBadge, { backgroundColor: meta.bg }]}>
                        <Text style={[s.stageBadgeText, { color: meta.color }]}>{lead.stage}</Text>
                      </View>
                      <Text style={s.leadDate}>{lead.consultationDate}</Text>
                      <TouchableOpacity style={s.contactBtn}>
                        <Ionicons name="call-outline" size={13} color="#2563EB" />
                        <Text style={s.contactBtnText}>Contact</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Add Lead FAB */}
        <TouchableOpacity style={s.fab} onPress={() => setIsModalVisible(true)}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Add Lead Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent onRequestClose={() => setIsModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalOverlay}
        >
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Client Lead</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Client Full Name</Text>
              <TextInput style={s.input} placeholder="e.g. Vikram Mehta" placeholderTextColor="#94A3B8" value={clientName} onChangeText={setClientName} />

              <Text style={s.label}>Email Address</Text>
              <TextInput style={s.input} placeholder="client@gmail.com" placeholderTextColor="#94A3B8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

              <Text style={s.label}>Phone</Text>
              <TextInput style={s.input} placeholder="+1 (555) 000-0000" placeholderTextColor="#94A3B8" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

              <Text style={s.label}>Est. Budget</Text>
              <TextInput style={s.input} placeholder="$150,000" placeholderTextColor="#94A3B8" value={budget} onChangeText={setBudget} />

              <Text style={s.label}>Property & Project Scope</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {['Residential Villa', 'Luxury Penthouse Apartment', 'Commercial Executive Office', 'Hospitality / Retail Suite'].map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[s.optionChip, propertyType === opt && s.optionChipActive]}
                    onPress={() => setPropertyType(opt)}
                  >
                    <Text style={[s.optionChipText, propertyType === opt && s.optionChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={s.saveBtn} onPress={handleAddLead}>
                <Ionicons name="send" size={15} color="#FFFFFF" />
                <Text style={s.saveBtnText}>Save Client Lead</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value, sub }) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>
        {value} {!!sub && <Text style={s.statValueSub}>{sub}</Text>}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  header: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  headerGreeting: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#1D4ED8', marginBottom: 2 },
  pageTitle: { fontSize: 22, fontFamily: 'Inter-Black', color: '#0F172A', letterSpacing: -0.5 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: '#DBEAFE',
  },
  statIconBox: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statLabel: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },
  statValue: { fontSize: 17, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 2 },
  statValueSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#DBEAFE',
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 16,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },

  chipRow: { gap: 8, paddingVertical: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFDBFE',
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  chipTextActive: { color: '#FFFFFF' },

  leadCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: '#DBEAFE', gap: 10,
  },
  leadTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  leadName: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  leadSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  leadBudget: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#2563EB' },

  leadBottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10,
  },
  stageBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  stageBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold' },
  leadDate: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF6FF', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8,
  },
  contactBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB' },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  fab: {
    position: 'absolute', right: 20, bottom: 100,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  optionChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
  },
  optionChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  optionChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  optionChipTextActive: { color: '#2563EB' },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, marginTop: 20, marginBottom: 10,
  },
  saveBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

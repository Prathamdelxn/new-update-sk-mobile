import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, KeyboardAvoidingView, Platform,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useToast } from '../../context/ToastContext';
import HeaderNotification from '../../components/HeaderNotification';
import interiorApiClient from '../../services/interiorApiClient';
import interiorCrmService from '../../services/interiorCrmService';
import CrmFlowTabs from '../../components/crm/CrmFlowTabs';

const FOLLOWUP_TYPES = ['Phone Call', 'WhatsApp', 'Meeting', 'Office Visit', 'Site Visit'];

function userLabel(u) {
  const name = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || 'User';
  return `${name}${u.role?.name || u.role ? ` (${u.role?.name || u.role})` : ''}`;
}

// Must match CrmCustomer's actual `status` enum in interior-os-backend exactly —
// it does NOT include "Negotiation"/"Converted" (those were leftover copy from
// a different status vocabulary); the real terminal stages are "Booking
// Pending" and "Won".
const STAGES = ['New Lead', 'Contacted', 'Meeting Scheduled', 'Measurement Done', 'Requirement Completed', 'Design Approved', 'Quotation Sent', 'Booking Pending', 'Won', 'Lost'];

const STAGE_META = {
  'New Lead':               { color: '#0284C7', bg: '#F0F9FF' },
  'Contacted':               { color: '#D97706', bg: '#FFFBEB' },
  'Meeting Scheduled':       { color: '#7C3AED', bg: '#F5F3FF' },
  'Measurement Done':        { color: '#7C3AED', bg: '#F5F3FF' },
  'Requirement Completed':   { color: '#4F46E5', bg: '#EEF2FF' },
  'Design Approved':         { color: '#4F46E5', bg: '#EEF2FF' },
  'Quotation Sent':          { color: '#E11D48', bg: '#FFF1F2' },
  'Booking Pending':         { color: '#E11D48', bg: '#FFF1F2' },
  'Won':                     { color: '#16A34A', bg: '#F0FDF4' },
  'Lost':                    { color: '#64748B', bg: '#F8FAFC' },
};

const LEAD_SOURCES = ['Phone Call', 'Walk-in', 'Referral', 'Existing Customer', 'Builder Reference', 'Architect Reference', 'Society Reference', 'Social Media', 'Other'];
const PROPERTY_TYPES = ['Flat', 'Villa', 'Office', 'Shop', 'Other'];

const emptyForm = { name: '', mobileNumber: '', email: '', leadSource: 'Phone Call', propertyType: 'Flat', projectLocation: '' };
const emptyFollowUpForm = { type: 'Phone Call', scheduledDate: null, remarks: '', assignedSalesExecutive: '' };

export default function CRMScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [activeFlowTab, setActiveFlowTab] = useState('leads');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [followUpLead, setFollowUpLead] = useState(null);
  const [followUpForm, setFollowUpForm] = useState(emptyFollowUpForm);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [schedulingFollowUp, setSchedulingFollowUp] = useState(false);

  const loadLeads = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const list = await interiorCrmService.getCustomers();
      setLeads(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Failed to load leads', e);
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const list = await interiorCrmService.getUsers();
      setUsers(Array.isArray(list) ? list : []);
    } catch (e) {
      setUsers([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadLeads(); loadUsers(); }, [loadLeads, loadUsers]));

  const flowCounts = {
    leads: leads.length,
    follow_ups: leads.filter((l) => ['New Lead', 'Contacted', 'Meeting Scheduled'].includes(l.status)).length,
    site_visits: leads.filter((l) => ['Under Site Visit', 'Measurement Done', 'Meeting Scheduled'].includes(l.status) || (l.siteMeasurements && Object.keys(l.siteMeasurements).length > 0)).length,
    requirement_design: leads.filter((l) => ['Under Requirement', 'Requirement Completed'].includes(l.status) || (l.requirements && l.requirements.length > 0)).length,
    drawing: leads.filter((l) => ['Under Drawing', 'Design Approved'].includes(l.status) || (l.designFiles && l.designFiles.length > 0)).length,
    boq: leads.filter((l) => ['Under BOQ Creation', 'BOQ Approved'].includes(l.status) || (l.boqs && l.boqs.length > 0)).length,
    quotations: leads.filter((l) => ['Under Quotation', 'Quotation Sent', 'Booking Pending'].includes(l.status) || (l.quotations && l.quotations.length > 0)).length,
    won_projects: leads.filter((l) => l.status === 'Won' || l.status === 'Converted' || !!l.linkedProject).length,
    lost_leads: leads.filter((l) => l.status === 'Lost').length,
  };

  const filteredLeads = leads.filter((l) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      l.name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.mobileNumber?.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    // Direct stage chip filter
    if (stageFilter !== 'All' && l.status !== stageFilter) return false;

    // Horizontal workflow tab filter
    if (activeFlowTab === 'leads') return true;
    if (activeFlowTab === 'follow_ups') return ['New Lead', 'Contacted', 'Meeting Scheduled'].includes(l.status);
    if (activeFlowTab === 'site_visits') return ['Under Site Visit', 'Measurement Done', 'Meeting Scheduled'].includes(l.status) || (l.siteMeasurements && Object.keys(l.siteMeasurements).length > 0);
    if (activeFlowTab === 'requirement_design') return ['Under Requirement', 'Requirement Completed'].includes(l.status) || (l.requirements && l.requirements.length > 0);
    if (activeFlowTab === 'drawing') return ['Under Drawing', 'Design Approved'].includes(l.status) || (l.designFiles && l.designFiles.length > 0);
    if (activeFlowTab === 'boq') return ['Under BOQ Creation', 'BOQ Approved'].includes(l.status) || (l.boqs && l.boqs.length > 0);
    if (activeFlowTab === 'quotations') return ['Under Quotation', 'Quotation Sent', 'Booking Pending'].includes(l.status) || (l.quotations && l.quotations.length > 0);
    if (activeFlowTab === 'won_projects') return l.status === 'Won' || l.status === 'Converted' || !!l.linkedProject;
    if (activeFlowTab === 'lost_leads') return l.status === 'Lost';
    return true;
  });

  const handleAddLead = async () => {
    if (!form.name.trim() || !form.mobileNumber.trim()) {
      showToast('Name and Mobile Number are required', 'error');
      return;
    }
    setCreateLoading(true);
    try {
      await interiorApiClient.post('/crm/customers', form);
      showToast('Lead created successfully!', 'success');
      setForm(emptyForm);
      setIsModalVisible(false);
      loadLeads();
    } catch (e) {
      showToast(e.message || 'Failed to create lead', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const openFollowUpModal = (lead) => {
    setFollowUpLead(lead);
    setFollowUpForm(emptyFollowUpForm);
  };

  // Android has no native combined date+time dialog, and its imperative
  // picker auto-dismisses itself — rendering the declarative <DateTimePicker>
  // there too causes a double-dismiss crash on unmount. So on Android we
  // chain a date dialog into a time dialog imperatively; iOS keeps the
  // declarative "datetime" spinner.
  const openScheduleDatePicker = () => {
    if (Platform.OS === 'android') {
      const base = followUpForm.scheduledDate || new Date();
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        onChange: (event, pickedDate) => {
          if (event.type !== 'set' || !pickedDate) return;
          DateTimePickerAndroid.open({
            value: base,
            mode: 'time',
            onChange: (timeEvent, pickedTime) => {
              if (timeEvent.type !== 'set' || !pickedTime) return;
              const combined = new Date(pickedDate);
              combined.setHours(pickedTime.getHours(), pickedTime.getMinutes());
              setFollowUpForm((prev) => ({ ...prev, scheduledDate: combined }));
            },
          });
        },
      });
    } else {
      setShowDatePicker(true);
    }
  };

  const closeFollowUpModal = () => {
    setFollowUpLead(null);
    setFollowUpForm(emptyFollowUpForm);
  };

  const handleScheduleFollowUp = async () => {
    if (!followUpForm.scheduledDate) return showToast('Date is required', 'error');
    if (!followUpForm.remarks.trim()) return showToast('Remarks are required', 'error');

    setSchedulingFollowUp(true);
    try {
      await interiorApiClient.post('/crm/activities', {
        customer: followUpLead._id,
        type: followUpForm.type,
        status: 'Pending',
        scheduledDate: followUpForm.scheduledDate.toISOString(),
        remarks: followUpForm.remarks,
      });

      await interiorApiClient.patch(`/crm/customers/${followUpLead._id}`, followUpForm.assignedSalesExecutive
        ? { assignedSalesExecutive: followUpForm.assignedSalesExecutive, status: 'Contacted' }
        : { status: 'Contacted' });

      showToast('Follow-up scheduled successfully!', 'success');
      closeFollowUpModal();
      loadLeads();
    } catch (e) {
      showToast(e.message || 'Failed to schedule follow-up', 'error');
    } finally {
      setSchedulingFollowUp(false);
    }
  };

  const passToSiteVisit = async (lead) => {
    try {
      await interiorApiClient.patch(`/crm/customers/${lead._id}`, { status: 'Meeting Scheduled' });
      showToast(`${lead.name} moved to Site Visit`, 'success');
      loadLeads();
    } catch (e) {
      showToast(e.message || 'Failed to update lead', 'error');
    }
  };

  const pipelineValue = leads.length;
  const converted = leads.filter((l) => l.status === 'Won').length;
  const conversionRate = leads.length ? Math.round((converted / leads.length) * 100) : 0;

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <View style={s.bgBase} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={s.headerGreeting}>Workspace</Text>
            <Text style={s.pageTitle}>CRM Workspace</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity style={s.followUpsBtn} onPress={() => router.push('/crm-pipeline')}>
              <Ionicons name="funnel-outline" size={16} color="#1D4ED8" />
            </TouchableOpacity>
            <TouchableOpacity style={s.followUpsBtn} onPress={() => router.push('/crm-followups')}>
              <Ionicons name="time-outline" size={17} color="#1D4ED8" />
            </TouchableOpacity>
            <HeaderNotification />
          </View>
        </View>

        <CrmFlowTabs
          activeTab={activeFlowTab}
          onSelectTab={setActiveFlowTab}
          counts={flowCounts}
        />

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLeads(true)} tintColor="#2563EB" colors={['#2563EB']} />}
          >
            {/* Stat cards */}
            <View style={s.statsGrid}>
              <StatCard icon="people-outline" iconBg="#F0F9FF" iconColor="#0284C7" label="Total Pipeline" value={`${pipelineValue}`} sub="leads" />
              <StatCard icon="trending-up-outline" iconBg="#FFFBEB" iconColor="#D97706" label="Conversion" value={`${conversionRate}%`} />
              <StatCard icon="checkmark-circle-outline" iconBg="#F0FDF4" iconColor="#16A34A" label="Converted" value={`${converted}`} onPress={() => router.push('/crm-won-projects')} />
              <StatCard icon="hourglass-outline" iconBg="#EEF2FF" iconColor="#4F46E5" label="In Progress" value={`${leads.length - converted}`} />
            </View>

            {/* Search */}
            <View style={s.searchRow}>
              <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search by name, email or phone..."
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
                  <TouchableOpacity key={stage} style={[s.chip, active && s.chipActive]} onPress={() => setStageFilter(stage)}>
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
                  <Text style={s.emptyTitle}>No leads found</Text>
                </View>
              ) : (
                filteredLeads.map((lead) => {
                  const meta = STAGE_META[lead.status] || STAGE_META['Lost'];
                  return (
                    <TouchableOpacity 
                      key={lead._id} 
                      style={s.leadCard}
                      onPress={() => router.push(`/crm-lead/${lead._id}`)}
                      activeOpacity={0.7}
                    >
                      <View style={s.leadTopRow}>
                        <View style={s.avatar}>
                          <Text style={s.avatarText}>{lead.name?.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={s.leadName} numberOfLines={1}>{lead.name}</Text>
                            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                          </View>
                          <Text style={s.leadSub} numberOfLines={1}>{lead.mobileNumber}{lead.propertyType ? ` · ${lead.propertyType}` : ''}</Text>
                        </View>
                      </View>

                      <View style={s.leadBottomRow}>
                        <View style={[s.stageBadge, { backgroundColor: meta.bg }]}>
                          <Text style={[s.stageBadgeText, { color: meta.color }]}>{lead.status}</Text>
                        </View>
                        <Text style={s.leadDate} numberOfLines={1}>{lead.leadSource || 'N/A'}</Text>
                        {lead.status === 'New Lead' && (
                          <TouchableOpacity style={s.contactBtn} onPress={() => openFollowUpModal(lead)}>
                            <Ionicons name="arrow-forward" size={13} color="#2563EB" />
                            <Text style={s.contactBtnText}>Follow-up</Text>
                          </TouchableOpacity>
                        )}
                        {lead.status === 'Contacted' && (
                          <TouchableOpacity style={s.contactBtn} onPress={() => passToSiteVisit(lead)}>
                            <Ionicons name="arrow-forward" size={13} color="#2563EB" />
                            <Text style={s.contactBtnText}>Site Visit</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* Add Lead FAB */}
        <TouchableOpacity style={s.fab} onPress={() => setIsModalVisible(true)}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Add Lead Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent onRequestClose={() => setIsModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add New Lead</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Full Name *</Text>
              <TextInput style={s.input} placeholder="e.g. John Doe" placeholderTextColor="#94A3B8" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />

              <Text style={s.label}>Mobile Number *</Text>
              <TextInput style={s.input} placeholder="+91 9876543210" placeholderTextColor="#94A3B8" value={form.mobileNumber} onChangeText={(v) => setForm({ ...form, mobileNumber: v })} keyboardType="phone-pad" />

              <Text style={s.label}>Email Address</Text>
              <TextInput style={s.input} placeholder="john@example.com" placeholderTextColor="#94A3B8" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />

              <Text style={s.label}>Lead Source</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {LEAD_SOURCES.map((opt) => (
                  <TouchableOpacity key={opt} style={[s.optionChip, form.leadSource === opt && s.optionChipActive]} onPress={() => setForm({ ...form, leadSource: opt })}>
                    <Text style={[s.optionChipText, form.leadSource === opt && s.optionChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Property Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {PROPERTY_TYPES.map((opt) => (
                  <TouchableOpacity key={opt} style={[s.optionChip, form.propertyType === opt && s.optionChipActive]} onPress={() => setForm({ ...form, propertyType: opt })}>
                    <Text style={[s.optionChipText, form.propertyType === opt && s.optionChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Project Location</Text>
              <TextInput style={s.input} placeholder="e.g. Hiranandani Estate, Thane" placeholderTextColor="#94A3B8" value={form.projectLocation} onChangeText={(v) => setForm({ ...form, projectLocation: v })} />

              <TouchableOpacity style={[s.saveBtn, createLoading && { opacity: 0.7 }]} onPress={handleAddLead} disabled={createLoading}>
                {createLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <>
                    <Ionicons name="send" size={15} color="#FFFFFF" />
                    <Text style={s.saveBtnText}>Create Lead</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Schedule Follow-up Modal */}
      <Modal visible={!!followUpLead} animationType="slide" transparent onRequestClose={closeFollowUpModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            {followUpLead && (
              <>
                <View style={s.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalTitle}>Schedule Follow-up</Text>
                    <Text style={s.modalSubtitle}>Plan a future touchpoint with {followUpLead.name}</Text>
                  </View>
                  <TouchableOpacity onPress={closeFollowUpModal}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={s.label}>Follow-up Type</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {FOLLOWUP_TYPES.map((opt) => (
                      <TouchableOpacity key={opt} style={[s.optionChip, followUpForm.type === opt && s.optionChipActive]} onPress={() => setFollowUpForm({ ...followUpForm, type: opt })}>
                        <Text style={[s.optionChipText, followUpForm.type === opt && s.optionChipTextActive]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.label}>Date & Time *</Text>
                  <TouchableOpacity style={s.dateInput} onPress={openScheduleDatePicker}>
                    <Text style={[s.dateInputText, !followUpForm.scheduledDate && { color: '#94A3B8' }]}>
                      {followUpForm.scheduledDate
                        ? followUpForm.scheduledDate.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                        : 'Select date & time'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                  {Platform.OS === 'ios' && showDatePicker && (
                    <DateTimePicker
                      value={followUpForm.scheduledDate || new Date()}
                      mode="datetime"
                      display="spinner"
                      onChange={(e, d) => {
                        setShowDatePicker(false);
                        if (d) setFollowUpForm((prev) => ({ ...prev, scheduledDate: d }));
                      }}
                    />
                  )}

                  <Text style={s.label}>Assign Member</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <TouchableOpacity
                      style={[s.optionChip, !followUpForm.assignedSalesExecutive && s.optionChipActive]}
                      onPress={() => setFollowUpForm({ ...followUpForm, assignedSalesExecutive: '' })}
                    >
                      <Text style={[s.optionChipText, !followUpForm.assignedSalesExecutive && s.optionChipTextActive]}>Unassigned (Keep Current)</Text>
                    </TouchableOpacity>
                    {users.map((u) => {
                      const uid = u._id || u.id;
                      return (
                        <TouchableOpacity key={uid} style={[s.optionChip, followUpForm.assignedSalesExecutive === uid && s.optionChipActive]} onPress={() => setFollowUpForm({ ...followUpForm, assignedSalesExecutive: uid })}>
                          <Text style={[s.optionChipText, followUpForm.assignedSalesExecutive === uid && s.optionChipTextActive]}>{userLabel(u)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={s.label}>Follow-up Goal / Notes *</Text>
                  <TextInput
                    style={[s.input, { height: 90, textAlignVertical: 'top', paddingTop: 12 }]}
                    placeholder="E.g., Call to discuss revised quotation..."
                    placeholderTextColor="#94A3B8"
                    value={followUpForm.remarks}
                    onChangeText={(v) => setFollowUpForm({ ...followUpForm, remarks: v })}
                    multiline
                  />

                  <TouchableOpacity style={[s.saveBtn, schedulingFollowUp && { opacity: 0.7 }]} onPress={handleScheduleFollowUp} disabled={schedulingFollowUp}>
                    {schedulingFollowUp ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Schedule Follow-up</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value, sub, onPress }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={s.statCard} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[s.statIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>
        {value} {!!sub && <Text style={s.statValueSub}>{sub}</Text>}
      </Text>
    </Wrapper>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  followUpsBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
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

  leadBottomRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10,
  },
  stageBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  stageBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold' },
  leadDate: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', flex: 1 },
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
  modalSubtitle: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },
  dateInput: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dateInputText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A' },

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

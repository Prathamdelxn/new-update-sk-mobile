import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, KeyboardAvoidingView, Platform,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useToast } from '../../context/ToastContext';
import HeaderNotification from '../../components/HeaderNotification';
import interiorApiClient from '../../services/interiorApiClient';
import interiorCrmService from '../../services/interiorCrmService';
import CrmFlowTabs, { useVisibleFlowStages } from '../../components/crm/CrmFlowTabs';
import StageLeadPicker from '../../components/crm/StageLeadPicker';
import { useInteriorPermissions } from '../../utils/interior/useInteriorPermissions';
import { STATUS_STAGE_INDEX } from '../../utils/interior/crmStages';
import { queryKeys, invalidateCrmQueries, useRefreshOnFocus } from '../../context/QueryProvider';
import { validateName, validateMobileNumber, validateEmail, validateProjectLocation, validateLeadSource, validatePropertyType, validateFutureDate } from '../../utils/crmValidation';

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

const SOURCE_ICONS = {
  'Phone Call': 'call-outline',
  'Walk-in': 'walk-outline',
  'Referral': 'people-outline',
  'Existing Customer': 'star-outline',
  'Builder Reference': 'business-outline',
  'Architect Reference': 'color-palette-outline',
  'Society Reference': 'home-outline',
  'Social Media': 'logo-instagram',
  'Other': 'ellipsis-horizontal-outline',
};

const PROPERTY_ICONS = {
  Flat: 'business-outline',
  Villa: 'home-outline',
  Office: 'briefcase-outline',
  Shop: 'storefront-outline',
  Other: 'apps-outline',
};

const emptyForm = { name: '', mobileNumber: '', email: '', leadSource: 'Phone Call', propertyType: 'Flat', projectLocation: '' };

// Matches web's crmValidation.ts field map for the 6-field Create Lead form.
function validateLeadField(field, value) {
  switch (field) {
    case 'name': return validateName(value);
    case 'mobileNumber': return validateMobileNumber(value);
    case 'email': return validateEmail(value);
    case 'leadSource': return validateLeadSource(value);
    case 'propertyType': return validatePropertyType(value);
    case 'projectLocation': return validateProjectLocation(value);
    default: return null;
  }
}
const emptyFollowUpForm = { type: 'Phone Call', scheduledDate: null, remarks: '', assignedSalesExecutive: '' };

export default function CRMScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const queryClient = useQueryClient();
  const leadsQuery = useQuery({
    queryKey: queryKeys.crmLeads,
    queryFn: async () => {
      const list = await interiorCrmService.getCustomers({ all: true });
      return Array.isArray(list) ? list : [];
    },
  });
  const usersQuery = useQuery({
    queryKey: queryKeys.crmUsers,
    queryFn: async () => {
      const list = await interiorCrmService.getUsers();
      return Array.isArray(list) ? list : [];
    },
    staleTime: 10 * 60 * 1000,
  });
  const leads = leadsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const loading = leadsQuery.isPending;
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFlowTab, setActiveFlowTab] = useState('leads');
  // Only tabs this user can view; start on the first one they can see
  const { hasPermission } = useInteriorPermissions();
  const visibleStages = useVisibleFlowStages();
  const activeFlowTab = visibleStages.some((st) => st.id === selectedFlowTab)
    ? selectedFlowTab
    : visibleStages[0]?.id ?? selectedFlowTab;
  const [isStagePickerOpen, setIsStagePickerOpen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [formTouched, setFormTouched] = useState({});

  const [followUpLead, setFollowUpLead] = useState(null);
  const [followUpForm, setFollowUpForm] = useState(emptyFollowUpForm);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [schedulingFollowUp, setSchedulingFollowUp] = useState(false);

  // Leads are cached (see QueryProvider) — reopening the tab shows them instantly.
  // Called after mutations and on pull-to-refresh to force fresh data.
  const loadLeads = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      await invalidateCrmQueries(queryClient);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  useRefreshOnFocus([queryKeys.crmLeads, queryKeys.crmUsers]);

  const flowCounts = {
    leads: leads.filter((l) => l.status !== 'Lost').length,
    follow_ups: leads.filter((l) => l.status !== 'Lost' && ['New Lead', 'Contacted', 'Meeting Scheduled'].includes(l.status)).length,
    site_visits: leads.filter((l) => l.status !== 'Lost' && (['Under Site Visit', 'Measurement Done', 'Meeting Scheduled'].includes(l.status) || (l.siteMeasurements && Object.keys(l.siteMeasurements).length > 0))).length,
    requirement_design: leads.filter((l) => l.status !== 'Lost' && (['Under Requirement', 'Requirement Completed'].includes(l.status) || (l.requirements && l.requirements.length > 0))).length,
    drawing: leads.filter((l) => l.status !== 'Lost' && (['Under Drawing', 'Design Approved'].includes(l.status) || (l.designFiles && l.designFiles.length > 0))).length,
    boq: leads.filter((l) => l.status !== 'Lost' && (['Under BOQ Creation', 'BOQ Approved'].includes(l.status) || (l.boqs && l.boqs.length > 0))).length,
    quotations: leads.filter((l) => l.status !== 'Lost' && (['Under Quotation', 'Quotation Sent', 'Booking Pending'].includes(l.status) || (l.quotations && l.quotations.length > 0))).length,
    won_projects: leads.filter((l) => l.status !== 'Lost' && (l.status === 'Won' || l.status === 'Converted' || !!l.linkedProject)).length,
    lost_leads: leads.filter((l) => l.status === 'Lost').length,
  };

  // "Add to <stage>" per stage tab (opens the lead on that stage's send-to form)
  const STAGE_ADD = {
    follow_ups: { label: 'Schedule Follow-up', module: 'crm_followups', index: 1, action: 'followup' },
    site_visits: { label: 'Add to Site Visits', module: 'crm_site_visits', index: 2, action: 'site' },
    requirement_design: { label: 'Add to Requirements', module: 'crm_requirements', index: 3, action: 'requirements' },
    drawing: { label: 'Add to Drawings', module: 'crm_drawings', index: 4, action: 'drawing' },
    boq: { label: 'Add to BOQ', module: 'crm_boq', index: 5, action: 'boq' },
    quotations: { label: 'Add to Quotations', module: 'crm_quotations', index: 6, action: 'quotation' },
  };
  const stageAdd = STAGE_ADD[activeFlowTab];
  const stageCandidates = stageAdd
    ? leads.filter((l) => {
        const idx = STATUS_STAGE_INDEX[l.status];
        if (idx === undefined) return false; // Lost / Won / Converted
        return activeFlowTab === 'follow_ups' ? idx <= stageAdd.index : idx < stageAdd.index;
      })
    : [];

  const filteredLeads = leads.filter((l) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      l.name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.mobileNumber?.toLowerCase().includes(q) ||
      l.lostReason?.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    // Dedicated Lost Leads tab explicitly displays only leads where status === 'Lost'
    if (activeFlowTab === 'lost_leads') {
      return l.status === 'Lost';
    }

    // Active stages strictly EXCLUDE Lost leads to prevent pipeline clutter
    if (l.status === 'Lost') return false;

    // Active stage filters
    if (activeFlowTab === 'leads') return true;
    if (activeFlowTab === 'follow_ups') return ['New Lead', 'Contacted', 'Meeting Scheduled'].includes(l.status);
    if (activeFlowTab === 'site_visits') return ['Under Site Visit', 'Measurement Done', 'Meeting Scheduled'].includes(l.status) || (l.siteMeasurements && Object.keys(l.siteMeasurements).length > 0);
    if (activeFlowTab === 'requirement_design') return ['Under Requirement', 'Requirement Completed'].includes(l.status) || (l.requirements && l.requirements.length > 0);
    if (activeFlowTab === 'drawing') return ['Under Drawing', 'Design Approved'].includes(l.status) || (l.designFiles && l.designFiles.length > 0);
    if (activeFlowTab === 'boq') return ['Under BOQ Creation', 'BOQ Approved'].includes(l.status) || (l.boqs && l.boqs.length > 0);
    if (activeFlowTab === 'quotations') return ['Under Quotation', 'Quotation Sent', 'Booking Pending'].includes(l.status) || (l.quotations && l.quotations.length > 0);
    if (activeFlowTab === 'won_projects') return l.status === 'Won' || l.status === 'Converted' || !!l.linkedProject;
    return true;
  });

  const handleLeadFieldChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (formTouched[field] || formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: validateLeadField(field, value) }));
    }
  };

  const handleLeadFieldBlur = (field) => {
    setFormTouched((prev) => ({ ...prev, [field]: true }));
    setFormErrors((prev) => ({ ...prev, [field]: validateLeadField(field, form[field]) }));
  };

  const handleAddLead = async () => {
    const fields = ['name', 'mobileNumber', 'email', 'leadSource', 'propertyType', 'projectLocation'];
    const nextErrors = {};
    fields.forEach((f) => { nextErrors[f] = validateLeadField(f, form[f]); });
    setFormErrors(nextErrors);
    setFormTouched(fields.reduce((acc, f) => ({ ...acc, [f]: true }), {}));
    if (Object.values(nextErrors).some(Boolean)) {
      showToast('Please fix the validation errors before creating the lead', 'error');
      return;
    }

    setCreateLoading(true);
    try {
      const res = await interiorApiClient.post('/crm/customers', {
        ...form,
        name: form.name.trim(),
        mobileNumber: form.mobileNumber.trim(),
        email: form.email.trim(),
        projectLocation: form.projectLocation.trim(),
      });
      showToast('Lead created successfully!', 'success');
      const createdLead = res?.data || res?.customer || res;
      const createdId = createdLead?._id || createdLead?.id;
      setForm(emptyForm);
      setFormErrors({});
      setFormTouched({});
      setShowSourcePicker(false);
      setIsModalVisible(false);
      loadLeads();
      if (createdId) {
        router.push({
          pathname: `/crm-lead/${createdId}`,
          params: { tab: 'follow_ups' },
        });
      }
    } catch (e) {
      showToast(e.message || 'Failed to create lead', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const closeAddLeadModal = () => {
    setShowSourcePicker(false);
    setIsModalVisible(false);
    setForm(emptyForm);
    setFormErrors({});
    setFormTouched({});
  };

  const openFollowUpModal = (lead) => {
    // Web flow: exactly 1 active follow-up until done.
    // If already contacted/scheduled, direct user straight to the lead's follow-up tab to complete it.
    if (lead?.status === 'Contacted') {
      router.push({
        pathname: `/crm-lead/${lead._id}`,
        params: { tab: 'follow_ups' },
      });
      return;
    }
    setFollowUpLead(lead);
    const currExecId = typeof lead?.assignedSalesExecutive === 'object'
      ? (lead?.assignedSalesExecutive?._id || '')
      : (lead?.assignedSalesExecutive || '');
    setFollowUpForm({
      ...emptyFollowUpForm,
      assignedSalesExecutive: currExecId,
    });
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
    const dateError = validateFutureDate(followUpForm.scheduledDate, 'Follow-up date');
    if (dateError) return showToast(dateError, 'error');
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

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <View style={s.bgBase} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerGreeting}>Workspace</Text>
            <Text style={s.pageTitle}>CRM Workspace</Text>
          </View>
          <TouchableOpacity
            style={s.followUpsBtn}
            onPress={() => router.push('/crm-followups')}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={18} color="#2563EB" />
          </TouchableOpacity>
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
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Follow-ups Board Banner when in follow_ups tab */}
            {activeFlowTab === 'follow_ups' && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#EFF6FF',
                  borderWidth: 1,
                  borderColor: '#BFDBFE',
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  marginBottom: 14,
                }}
                onPress={() => router.push('/crm-followups')}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Ionicons name="calendar" size={18} color="#2563EB" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter-Bold', color: '#1E40AF' }}>
                      Follow-up Touchpoints Board
                    </Text>
                    <Text style={{ fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#3B82F6' }}>
                      View all scheduled calls, mark Done, or pass to Site Visit
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#2563EB" />
              </TouchableOpacity>
            )}

            {/* Add to <stage>: bring a lead in without access to the earlier tabs */}
            {stageAdd && hasPermission(stageAdd.module, 'create') && (
              <TouchableOpacity style={s.stageAddBtn} onPress={() => setIsStagePickerOpen(true)} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
                <Text style={s.stageAddText}>{stageAdd.label}</Text>
              </TouchableOpacity>
            )}

            {/* Lead list */}
            <View style={{ gap: 12 }}>
              {filteredLeads.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name={activeFlowTab === 'lost_leads' ? 'shield-checkmark-outline' : 'people-outline'} size={44} color="#94A3B8" />
                  <Text style={s.emptyTitle}>
                    {activeFlowTab === 'lost_leads' ? 'No Lost Leads' : 'No leads found'}
                  </Text>
                  {activeFlowTab === 'lost_leads' && (
                    <Text style={s.emptySub}>All leads in your workspace are active or won.</Text>
                  )}
                </View>
              ) : (
                filteredLeads.map((lead) => {
                  const meta = STAGE_META[lead.status] || STAGE_META['Lost'];
                  const isLost = lead.status === 'Lost';

                  const isQuotationsTab = activeFlowTab === 'quotations';
                  const latestQuote = isQuotationsTab && lead.quotations && lead.quotations.length > 0
                    ? lead.quotations[lead.quotations.length - 1]
                    : null;
                  const isAcceptedQuoteStatus = (status) => ['accepted', 'approved', 'converted', 'signed & accepted'].includes(String(status || '').toLowerCase());
                  const quoteBadge = isQuotationsTab
                    ? (lead.status === 'Won' || lead.status === 'Converted')
                      ? { label: 'Converted', color: '#16A34A', bg: '#F0FDF4' }
                      : (isAcceptedQuoteStatus(latestQuote?.status) || lead.status === 'Booking Pending')
                      ? { label: 'Approved', color: '#16A34A', bg: '#F0FDF4' }
                      : latestQuote?.status === 'Rejected'
                      ? { label: 'Rejected', color: '#E11D48', bg: '#FFF1F2' }
                      : { label: 'Pending', color: '#4F46E5', bg: '#EEF2FF' }
                    : null;

                  return (
                    <TouchableOpacity 
                      key={lead._id} 
                      style={s.leadCard}
                      onPress={() => router.push(`/crm-lead/${lead._id}`)}
                      activeOpacity={0.7}
                    >
                      <View style={s.leadTopRow}>
                        <View style={[s.avatar, isLost && { backgroundColor: '#F1F5F9' }]}>
                          <Text style={[s.avatarText, isLost && { color: '#64748B' }]}>{lead.name?.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                              <Text style={[s.leadName, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">{lead.name}</Text>
                              <Text style={[s.leadNumber, { flexShrink: 0 }]}>{lead.leadNumber || 'LD-XXXX'}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
                          </View>
                          <Text style={s.leadSub} numberOfLines={1}>{lead.mobileNumber}{lead.propertyType ? ` · ${lead.propertyType}` : ''}</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
                          <Ionicons name="person-circle-outline" size={15} color={lead.assignedSalesExecutive ? '#4F46E5' : '#94A3B8'} style={{ flexShrink: 0 }} />
                          <Text style={{ fontSize: 11.5, fontFamily: 'Inter-Medium', color: lead.assignedSalesExecutive ? '#334155' : '#94A3B8', flexShrink: 1 }} numberOfLines={1}>
                            {lead.assignedSalesExecutive
                              ? (typeof lead.assignedSalesExecutive === 'object'
                                  ? (lead.assignedSalesExecutive.fullName || `${lead.assignedSalesExecutive.firstName || ''} ${lead.assignedSalesExecutive.lastName || ''}`.trim() || lead.assignedSalesExecutive.name || 'Assigned')
                                  : 'Assigned')
                              : 'Unassigned'}
                          </Text>
                        </View>
                      </View>

                      {/* Quotation Info (Quotations tab only) */}
                      {isQuotationsTab && (
                        <View style={s.quoteInfoRow}>
                          {latestQuote ? (
                            <>
                              <Text style={s.quoteInfoTotal} numberOfLines={1}>
                                Grand Total: ₹{(latestQuote.grandTotal || 0).toLocaleString('en-IN')}
                              </Text>
                              <Text style={s.quoteInfoVersion}>v{latestQuote.version}</Text>
                            </>
                          ) : (
                            <Text style={s.quoteInfoEmpty}>No quotation generated</Text>
                          )}
                        </View>
                      )}

                      {/* Lost Reason Pill */}
                      {isLost && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF1F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 4, borderWidth: 1, borderColor: '#FECACA' }}>
                          <Ionicons name="alert-circle" size={14} color="#E11D48" />
                          <Text style={{ fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#9F1239', flex: 1 }} numberOfLines={2}>
                            <Text style={{ fontFamily: 'Inter-Bold' }}>Reason: </Text>{lead.lostReason || 'Reason not recorded'}
                          </Text>
                        </View>
                      )}

                      <View style={s.leadBottomRow}>
                        <View style={[s.stageBadge, { backgroundColor: isQuotationsTab ? quoteBadge.bg : meta.bg }]}>
                          <Text style={[s.stageBadgeText, { color: isQuotationsTab ? quoteBadge.color : meta.color }]}>
                            {isQuotationsTab ? quoteBadge.label : lead.status}
                          </Text>
                        </View>
                        <Text style={s.leadDate} numberOfLines={1}>{lead.leadSource || 'N/A'}</Text>
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
        {hasPermission('crm_leads', 'create') && (
          <TouchableOpacity style={s.fab} onPress={() => setIsModalVisible(true)}>
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      <StageLeadPicker
        visible={isStagePickerOpen && !!stageAdd}
        title={stageAdd?.label ?? ''}
        leads={stageCandidates}
        onClose={() => setIsStagePickerOpen(false)}
        onPick={(leadId) => router.push(`/crm-lead/${leadId}?action=${stageAdd.action}`)}
      />

      {/* Add Lead Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent onRequestClose={closeAddLeadModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            {/* Modal Header */}
            <View style={s.leadModalHeader}>
              <View style={s.leadModalTitleRow}>
                <View style={s.leadModalIconBadge}>
                  <Ionicons name="person-add" size={18} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.leadModalTitle}>Add New Lead</Text>
                  <Text style={s.leadModalSubtitle}>Enter prospect details to start tracking in CRM</Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeAddLeadModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.leadModalCloseBtn}>
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
              {/* Section 1: Contact Information */}
              <View style={s.leadSection}>
                <View style={s.leadSectionHeaderRow}>
                  <Ionicons name="person-circle-outline" size={14} color="#64748B" />
                  <Text style={s.leadSectionTitle}>CONTACT INFORMATION</Text>
                </View>

                {/* Full Name */}
                <View style={s.leadFieldGroup}>
                  <View style={s.leadLabelRow}>
                    <Text style={s.leadLabel}>Full Name <Text style={s.requiredStar}>*</Text></Text>
                    {form.name.length > 0 && <Text style={s.leadCharCount}>{form.name.length}/50</Text>}
                  </View>
                  <View style={[s.leadInputContainer, !!formErrors.name && s.leadInputContainerError]}>
                    <Ionicons name="person-outline" size={16} color={formErrors.name ? '#DC2626' : '#64748B'} style={s.leadInputPrefixIcon} />
                    <TextInput
                      style={s.leadTextInput}
                      placeholder="e.g. John Doe"
                      placeholderTextColor="#94A3B8"
                      value={form.name}
                      maxLength={50}
                      onChangeText={(v) => handleLeadFieldChange('name', v)}
                      onBlur={() => handleLeadFieldBlur('name')}
                    />
                  </View>
                  {!!formErrors.name && (
                    <View style={s.leadErrorRow}>
                      <Ionicons name="alert-circle" size={12} color="#DC2626" />
                      <Text style={s.leadErrorText}>{formErrors.name}</Text>
                    </View>
                  )}
                </View>

                {/* Mobile Number */}
                <View style={s.leadFieldGroup}>
                  <View style={s.leadLabelRow}>
                    <Text style={s.leadLabel}>Mobile Number <Text style={s.requiredStar}>*</Text></Text>
                  </View>
                  <View style={[s.leadInputContainer, !!formErrors.mobileNumber && s.leadInputContainerError]}>
                    <Ionicons name="call-outline" size={16} color={formErrors.mobileNumber ? '#DC2626' : '#64748B'} style={s.leadInputPrefixIcon} />
                    <TextInput
                      style={s.leadTextInput}
                      placeholder="+91 98765 43210"
                      placeholderTextColor="#94A3B8"
                      value={form.mobileNumber}
                      maxLength={16}
                      onChangeText={(v) => handleLeadFieldChange('mobileNumber', v)}
                      onBlur={() => handleLeadFieldBlur('mobileNumber')}
                      keyboardType="phone-pad"
                    />
                  </View>
                  {!!formErrors.mobileNumber && (
                    <View style={s.leadErrorRow}>
                      <Ionicons name="alert-circle" size={12} color="#DC2626" />
                      <Text style={s.leadErrorText}>{formErrors.mobileNumber}</Text>
                    </View>
                  )}
                </View>

                {/* Email Address */}
                <View style={s.leadFieldGroup}>
                  <View style={s.leadLabelRow}>
                    <Text style={s.leadLabel}>Email Address</Text>
                    <Text style={s.leadOptionalTag}>Optional</Text>
                  </View>
                  <View style={[s.leadInputContainer, !!formErrors.email && s.leadInputContainerError]}>
                    <Ionicons name="mail-outline" size={16} color={formErrors.email ? '#DC2626' : '#64748B'} style={s.leadInputPrefixIcon} />
                    <TextInput
                      style={s.leadTextInput}
                      placeholder="client@example.com"
                      placeholderTextColor="#94A3B8"
                      value={form.email}
                      maxLength={100}
                      onChangeText={(v) => handleLeadFieldChange('email', v)}
                      onBlur={() => handleLeadFieldBlur('email')}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                  {!!formErrors.email && (
                    <View style={s.leadErrorRow}>
                      <Ionicons name="alert-circle" size={12} color="#DC2626" />
                      <Text style={s.leadErrorText}>{formErrors.email}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Section 2: Requirement & Source */}
              <View style={[s.leadSection, { marginTop: 14 }]}>
                <View style={s.leadSectionHeaderRow}>
                  <Ionicons name="business-outline" size={14} color="#64748B" />
                  <Text style={s.leadSectionTitle}>REQUIREMENT & SOURCE</Text>
                </View>

                {/* Property Type */}
                <View style={s.leadFieldGroup}>
                  <View style={s.leadLabelRow}>
                    <Text style={s.leadLabel}>Property Type <Text style={s.requiredStar}>*</Text></Text>
                  </View>
                  <View style={s.propertyChipsRow}>
                    {PROPERTY_TYPES.map((opt) => {
                      const active = form.propertyType === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[s.propertyChip, active && s.propertyChipActive]}
                          onPress={() => handleLeadFieldChange('propertyType', opt)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={PROPERTY_ICONS[opt] || 'home-outline'}
                            size={14}
                            color={active ? '#2563EB' : '#64748B'}
                          />
                          <Text style={[s.propertyChipText, active && s.propertyChipTextActive]}>{opt}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {!!formErrors.propertyType && (
                    <View style={s.leadErrorRow}>
                      <Ionicons name="alert-circle" size={12} color="#DC2626" />
                      <Text style={s.leadErrorText}>{formErrors.propertyType}</Text>
                    </View>
                  )}
                </View>

                {/* Lead Source */}
                <View style={s.leadFieldGroup}>
                  <View style={s.leadLabelRow}>
                    <Text style={s.leadLabel}>Lead Source <Text style={s.requiredStar}>*</Text></Text>
                  </View>
                  <TouchableOpacity
                    style={[s.sourceSelectBtn, !!formErrors.leadSource && s.leadInputContainerError]}
                    onPress={() => setShowSourcePicker(true)}
                    activeOpacity={0.7}
                  >
                    <View style={s.sourceSelectLeft}>
                      <View style={s.sourceSelectIconWrap}>
                        <Ionicons
                          name={SOURCE_ICONS[form.leadSource] || 'radio-button-on'}
                          size={15}
                          color="#2563EB"
                        />
                      </View>
                      <Text style={s.sourceSelectText}>{form.leadSource}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#64748B" />
                  </TouchableOpacity>
                  {!!formErrors.leadSource && (
                    <View style={s.leadErrorRow}>
                      <Ionicons name="alert-circle" size={12} color="#DC2626" />
                      <Text style={s.leadErrorText}>{formErrors.leadSource}</Text>
                    </View>
                  )}
                </View>

                {/* Project Location */}
                <View style={s.leadFieldGroup}>
                  <View style={s.leadLabelRow}>
                    <Text style={s.leadLabel}>Project Location <Text style={s.requiredStar}>*</Text></Text>
                    {form.projectLocation.length > 0 && <Text style={s.leadCharCount}>{form.projectLocation.length}/150</Text>}
                  </View>
                  <View style={[s.leadInputContainer, !!formErrors.projectLocation && s.leadInputContainerError]}>
                    <Ionicons name="location-outline" size={16} color={formErrors.projectLocation ? '#DC2626' : '#64748B'} style={s.leadInputPrefixIcon} />
                    <TextInput
                      style={s.leadTextInput}
                      placeholder="e.g. Hiranandani Estate, Thane"
                      placeholderTextColor="#94A3B8"
                      value={form.projectLocation}
                      maxLength={150}
                      onChangeText={(v) => handleLeadFieldChange('projectLocation', v)}
                      onBlur={() => handleLeadFieldBlur('projectLocation')}
                    />
                  </View>
                  {!!formErrors.projectLocation && (
                    <View style={s.leadErrorRow}>
                      <Ionicons name="alert-circle" size={12} color="#DC2626" />
                      <Text style={s.leadErrorText}>{formErrors.projectLocation}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[s.leadSubmitBtn, createLoading && { opacity: 0.7 }]}
                onPress={handleAddLead}
                disabled={createLoading}
                activeOpacity={0.8}
              >
                {createLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={16} color="#FFFFFF" />
                    <Text style={s.leadSubmitBtnText}>Create Lead</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Lead Source Picker Modal */}
      <Modal visible={showSourcePicker} animationType="fade" transparent onRequestClose={() => setShowSourcePicker(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setShowSourcePicker(false)}>
          <View style={s.pickerCard} onStartShouldSetResponder={() => true}>
            <View style={s.pickerHeader}>
              <View>
                <Text style={s.pickerTitle}>Select Lead Source</Text>
                <Text style={s.pickerSubtitle}>Where did this prospect find you?</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSourcePicker(false)} style={s.leadModalCloseBtn}>
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {LEAD_SOURCES.map((source) => {
                const selected = form.leadSource === source;
                return (
                  <TouchableOpacity
                    key={source}
                    style={[s.pickerRow, selected && s.pickerRowSelected]}
                    onPress={() => {
                      handleLeadFieldChange('leadSource', source);
                      setShowSourcePicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[s.pickerIconBox, selected && s.pickerIconBoxSelected]}>
                        <Ionicons
                          name={SOURCE_ICONS[source] || 'radio-button-on'}
                          size={16}
                          color={selected ? '#2563EB' : '#64748B'}
                        />
                      </View>
                      <Text style={[s.pickerRowText, selected && s.pickerRowTextSelected]}>
                        {source}
                      </Text>
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                    ) : (
                      <Ionicons name="ellipse-outline" size={18} color="#CBD5E1" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
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
                      <Text style={[s.optionChipText, !followUpForm.assignedSalesExecutive && s.optionChipTextActive]}>Keep Current</Text>
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
  stageAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, marginBottom: 14, borderRadius: 14, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  stageAddText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#2563EB' },
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 },

  header: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  headerGreeting: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#1D4ED8', marginBottom: 2 },
  followUpsBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
    paddingVertical: 0,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },

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
  leadNumber: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  leadSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  quoteInfoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  quoteInfoTotal: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#16A34A', flexShrink: 1 },
  quoteInfoVersion: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#64748B', marginLeft: 8 },
  quoteInfoEmpty: { fontSize: 11, fontFamily: 'Inter-MediumItalic', color: '#94A3B8' },

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
    padding: 20, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSubtitle: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 12 },
  charCount: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },
  inputError: { borderColor: '#DC2626' },
  fieldErrorText: { fontSize: 10.5, fontFamily: 'Inter-Medium', color: '#DC2626', marginTop: 4 },
  dateInput: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dateInputText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A' },

  dropdownBtn: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  dropdownBtnActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF20' },
  dropdownBtnContent: { flexDirection: 'row', alignItems: 'center' },
  dropdownBtnText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A' },
  dropdownMenu: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    marginTop: 4, marginBottom: 10, overflow: 'hidden',
    shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  dropdownItem: {
    paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  dropdownItemActive: { backgroundColor: '#EFF6FF' },
  dropdownItemText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#334155' },
  dropdownItemTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

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

  // Add Lead Modal Redesign Styles
  leadModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14,
  },
  leadModalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  leadModalIconBadge: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  leadModalTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  leadModalSubtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },
  leadModalCloseBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#F8FAFC',
    borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center',
  },

  leadSection: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 14, padding: 14, gap: 12,
  },
  leadSectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 8,
  },
  leadSectionTitle: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#64748B', letterSpacing: 0.5 },

  leadFieldGroup: { gap: 5 },
  leadLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leadLabel: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#334155' },
  requiredStar: { color: '#DC2626' },
  leadOptionalTag: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  leadCharCount: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#94A3B8' },

  leadInputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 12, height: 44,
  },
  leadInputContainerError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  leadInputPrefixIcon: { marginRight: 8 },
  leadTextInput: {
    flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A', paddingVertical: 0,
  },
  leadErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  leadErrorText: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#DC2626' },

  propertyChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  propertyChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
  },
  propertyChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  propertyChipText: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#64748B' },
  propertyChipTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  sourceSelectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 12, height: 44,
  },
  sourceSelectLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sourceSelectIconWrap: {
    width: 26, height: 26, borderRadius: 6, backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  sourceSelectText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A' },

  leadSubmitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2563EB', borderRadius: 12, height: 46, marginTop: 16,
  },
  leadSubmitBtnText: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  // Lead Source Picker Sheet
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  pickerCard: {
    width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 20,
    padding: 18, borderWidth: 1, borderColor: '#E2E8F0',
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12, marginBottom: 8,
  },
  pickerTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  pickerSubtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, marginVertical: 2,
  },
  pickerRowSelected: { backgroundColor: '#EFF6FF' },
  pickerIconBox: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  pickerIconBoxSelected: { backgroundColor: '#DBEAFE' },
  pickerRowText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#334155' },
  pickerRowTextSelected: { color: '#2563EB', fontFamily: 'Inter-Bold' },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, Alert, Image, Linking
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useToast } from '../context/ToastContext';
import interiorApiClient from '../services/interiorApiClient';
import interiorCrmService from '../services/interiorCrmService';
import * as ImagePicker from 'expo-image-picker';
import BoqBuilderModal from '../components/crm/BoqBuilderModal';
import LogSiteVisitModal from '../components/crm/LogSiteVisitModal';
import LogRequirementsModal from '../components/crm/LogRequirementsModal';
import UploadDesignModal from '../components/crm/UploadDesignModal';
import MarkLostModal from '../components/crm/MarkLostModal';
import {
  SendToSiteVisitModal,
  SendToRequirementsModal,
  SendToDrawingModal,
  SendToBoqModal,
  SendToQuotationsModal,
  ConvertToProjectModal,
} from '../components/crm/StageTransitionModals';

const STAGES = [
  'New Lead', 'Contacted', 'Meeting Scheduled', 'Under Site Visit', 'Measurement Done',
  'Under Requirement', 'Requirement Completed', 'Under Drawing', 'Design Approved',
  'Under BOQ Creation', 'Under Quotation', 'Quotation Sent',
  'Booking Pending', 'Won', 'Lost'
];

const STAGE_META = {
  'New Lead': { color: '#0284C7', bg: '#F0F9FF' },
  'Contacted': { color: '#D97706', bg: '#FFFBEB' },
  'Meeting Scheduled': { color: '#7C3AED', bg: '#F5F3FF' },
  'Under Site Visit': { color: '#7C3AED', bg: '#F5F3FF' },
  'Measurement Done': { color: '#7C3AED', bg: '#F5F3FF' },
  'Under Requirement': { color: '#4F46E5', bg: '#EEF2FF' },
  'Requirement Completed': { color: '#4F46E5', bg: '#EEF2FF' },
  'Under Drawing': { color: '#0284C7', bg: '#F0F9FF' },
  'Design Approved': { color: '#0284C7', bg: '#F0F9FF' },
  'Under BOQ Creation': { color: '#059669', bg: '#ECFDF5' },
  'Under Quotation': { color: '#E11D48', bg: '#FFF1F2' },
  'Quotation Sent': { color: '#E11D48', bg: '#FFF1F2' },
  'Booking Pending': { color: '#E11D48', bg: '#FFF1F2' },
  'Won': { color: '#16A34A', bg: '#F0FDF4' },
  'Lost': { color: '#64748B', bg: '#F8FAFC' },
};

const STAGE_ORDER = {
  'New Lead': 0,
  'Contacted': 0,
  'Meeting Scheduled': 0,
  'Under Site Visit': 1,
  'Measurement Done': 1,
  'Under Requirement': 2,
  'Requirement Completed': 2,
  'Under Drawing': 3,
  'Design Approved': 3,
  'Under BOQ Creation': 4,
  'BOQ Approved': 4,
  'Under Quotation': 5,
  'Quotation Sent': 5,
  'Booking Pending': 5,
  'Won': 6,
  'Converted': 6,
  'Lost': 6,
};

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'site', label: 'Site Visits' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'designs', label: 'Designs & Files' },
  { id: 'boq', label: 'BOQ' },
  { id: 'quotations', label: 'Quotations' },
];

export default function Lead360Screen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeQuoteIdx, setActiveQuoteIdx] = useState(0);

  // BOQ state
  const [activeBoqIdx, setActiveBoqIdx] = useState(0);
  const [showBoqModal, setShowBoqModal] = useState(false);
  const [editingBoqIdx, setEditingBoqIdx] = useState(null);

  // Guided Transition Modals
  const [showSendSiteModal, setShowSendSiteModal] = useState(false);
  const [showSendReqModal, setShowSendReqModal] = useState(false);
  const [showSendDrawingModal, setShowSendDrawingModal] = useState(false);
  const [showSendBoqModal, setShowSendBoqModal] = useState(false);
  const [showSendQuoteModal, setShowSendQuoteModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);

  // Status Change Modal
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Edit Lead Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', mobileNumber: '', email: '', leadSource: 'Phone Call', propertyType: 'Flat', projectLocation: '' });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);

  // Activity Modal State
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'Phone Call', remarks: '' });
  const [submittingAct, setSubmittingAct] = useState(false);

  // Follow Up Modal State
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({ type: 'Phone Call', remarks: '', dateStr: '' });

  // Site Visit Modal State
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [siteForm, setSiteForm] = useState({ carpetArea: '', ceilingHeight: '', rooms: '', notes: '' });
  const [sitePhotos, setSitePhotos] = useState([]);

  // Requirements Modal State
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqForm, setReqForm] = useState({ roomName: '', theme: '', description: '' });

  // Upload Design Modal State
  const [showDesignModal, setShowDesignModal] = useState(false);
  const [designForm, setDesignForm] = useState({ name: '', fileType: 'image', url: '' });

  // Quotation Builder Modal State
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteItems, setQuoteItems] = useState([{ description: '', quantity: '1', unitPrice: '' }]);
  const [quoteTax, setQuoteTax] = useState('18');
  const [quoteDiscount, setQuoteDiscount] = useState('0');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [shouldSendEmail, setShouldSendEmail] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('');

  const isConverted = lead?.status === 'Won' || lead?.status === 'Converted' || !!lead?.linkedProject;

  const getTabLockState = (tabId) => {
    if (isConverted) return { isLocked: false, requiredStage: '', stageTitle: '' };
    const currentStage = STAGE_ORDER[lead?.status || 'New Lead'] ?? 0;

    switch (tabId) {
      case 'overview':
        return { isLocked: false, requiredStage: 'New Lead', stageTitle: 'Overview' };
      case 'site': {
        const isUnlocked = currentStage >= 1 || !!lead?.siteMeasurements || (lead?.sitePhotos && lead.sitePhotos.length > 0);
        return { isLocked: !isUnlocked, requiredStage: 'Under Site Visit', stageTitle: 'Site Visit' };
      }
      case 'requirements': {
        const isUnlocked = currentStage >= 2 || (lead?.requirements && lead.requirements.length > 0);
        return { isLocked: !isUnlocked, requiredStage: 'Under Requirement', stageTitle: 'Requirements' };
      }
      case 'designs': {
        const isUnlocked = currentStage >= 3 || (lead?.designFiles && lead.designFiles.length > 0);
        return { isLocked: !isUnlocked, requiredStage: 'Under Drawing', stageTitle: '2D/3D Drawing' };
      }
      case 'boq': {
        const isUnlocked = currentStage >= 4 || (lead?.boqs && lead.boqs.length > 0);
        return { isLocked: !isUnlocked, requiredStage: 'Under BOQ Creation', stageTitle: 'BOQ' };
      }
      case 'quotations': {
        const isUnlocked = currentStage >= 5 || (lead?.quotations && lead.quotations.length > 0);
        return { isLocked: !isUnlocked, requiredStage: 'Under Quotation', stageTitle: 'Quotations' };
      }
      default:
        return { isLocked: false, requiredStage: '', stageTitle: '' };
    }
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      // 1. Fetch lead
      const cust = await interiorCrmService.getCustomerById(id);
      if (cust) setLead(cust);

      // 2. Fetch activities
      const actList = await interiorCrmService.getActivities(id);
      setActivities(Array.isArray(actList) ? actList : []);

      // 3. Fetch users
      const userList = await interiorCrmService.getUsers();
      setUsers(Array.isArray(userList) ? userList : []);
    } catch (e) {
      showToast(e.message || 'Failed to load lead details', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchData();
  }, [id, fetchData]);

  const handleStatusChange = async (newStatus) => {
    try {
      await interiorApiClient.patch(`/crm/customers/${id}`, { status: newStatus });
      showToast(`Lead moved to ${newStatus}`, 'success');
      setShowStatusModal(false);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to update status', 'error');
    }
  };

  const handleAddActivity = async () => {
    if (!activityForm.remarks.trim()) return showToast('Remarks are required', 'error');
    setSubmittingAct(true);
    try {
      await interiorApiClient.post('/crm/activities', {
        customer: id,
        type: activityForm.type,
        status: 'Completed',
        remarks: activityForm.remarks,
      });
      showToast('Activity logged!', 'success');
      setShowActivityModal(false);
      setActivityForm({ type: 'Phone Call', remarks: '' });
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to log activity', 'error');
    } finally {
      setSubmittingAct(false);
    }
  };

  const handleScheduleFollowUp = async () => {
    if (!followUpForm.remarks.trim()) return showToast('Notes are required', 'error');
    setSubmittingAct(true);
    try {
      await interiorApiClient.post('/crm/activities', {
        customer: id,
        type: followUpForm.type,
        status: 'Pending',
        scheduledDate: new Date().toISOString(),
        remarks: followUpForm.remarks,
      });
      showToast('Follow-up scheduled!', 'success');
      setShowFollowUpModal(false);
      setFollowUpForm({ type: 'Phone Call', remarks: '', dateStr: '' });
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to schedule follow-up', 'error');
    } finally {
      setSubmittingAct(false);
    }
  };

  const handlePickSitePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]?.base64) {
      const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setSitePhotos((prev) => [...prev, base64Uri]);
    }
  };

  const handleSaveSiteVisit = async () => {
    setSubmittingAct(true);
    try {
      await interiorApiClient.patch(`/crm/customers/${id}`, {
        status: 'Measurement Done',
        siteMeasurements: siteForm,
        sitePhotos: sitePhotos,
      });

      await interiorApiClient.post('/crm/activities', {
        customer: id,
        type: 'Site Visit',
        status: 'Completed',
        remarks: 'Completed site visit and updated measurements & photos.',
      });

      showToast('Site Visit saved!', 'success');
      setShowSiteModal(false);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to save site visit', 'error');
    } finally {
      setSubmittingAct(false);
    }
  };

  const handleSaveRequirements = async () => {
    if (!reqForm.roomName.trim()) return showToast('Room name is required', 'error');
    setSubmittingAct(true);
    try {
      const existingReqs = lead?.requirements || [];
      const updatedReqs = [...existingReqs, reqForm];

      await interiorApiClient.patch(`/crm/customers/${id}`, {
        requirements: updatedReqs,
        status: 'Requirement Completed',
      });

      showToast('Requirement logged!', 'success');
      setShowReqModal(false);
      setReqForm({ roomName: '', theme: '', description: '' });
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to log requirement', 'error');
    } finally {
      setSubmittingAct(false);
    }
  };

  const handleSaveDesign = async () => {
    if (!designForm.name.trim() || !designForm.url.trim()) return showToast('Name and URL are required', 'error');
    setSubmittingAct(true);
    try {
      const existingDesigns = lead?.designFiles || [];
      const newFile = {
        name: designForm.name,
        url: designForm.url,
        fileType: designForm.fileType,
        uploadedAt: new Date().toISOString(),
      };
      await interiorApiClient.patch(`/crm/customers/${id}`, {
        designFiles: [...existingDesigns, newFile],
        status: 'Design Approved',
      });

      showToast('Design file uploaded!', 'success');
      setShowDesignModal(false);
      setDesignForm({ name: '', fileType: 'image', url: '' });
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to upload design', 'error');
    } finally {
      setSubmittingAct(false);
    }
  };

  const handleSaveQuotation = async () => {
    const validItems = quoteItems.filter(i => i.description.trim() && parseFloat(i.unitPrice));
    if (validItems.length === 0) return showToast('Please add at least one item with description and price', 'error');

    setSubmittingAct(true);
    try {
      const formattedItems = validItems.map(i => {
        const qty = parseFloat(i.quantity) || 1;
        const price = parseFloat(i.unitPrice) || 0;
        return { description: i.description, quantity: qty, unitPrice: price, total: qty * price };
      });

      const subtotal = formattedItems.reduce((sum, item) => sum + item.total, 0);
      const taxRate = parseFloat(quoteTax) || 0;
      const tax = (subtotal * taxRate) / 100;
      const discount = parseFloat(quoteDiscount) || 0;
      const grandTotal = Math.max(0, subtotal + tax - discount);

      const existingQuotations = lead?.quotations || [];
      const newQuote = {
        version: existingQuotations.length + 1,
        items: formattedItems,
        subtotal,
        taxPercentage: taxRate,
        tax,
        discount,
        grandTotal,
        notes: quoteNotes,
        status: 'Sent',
        createdAt: new Date().toISOString(),
      };

      await interiorApiClient.patch(`/crm/customers/${id}`, {
        quotations: [...existingQuotations, newQuote],
        status: 'Quotation Sent',
      });

      let emailMessage = '';
      if (shouldSendEmail && recipientEmail.trim()) {
        try {
          await interiorApiClient.post(`/crm/customers/${id}/send-quotation-email`, {
            quotation: newQuote,
            recipientEmail: recipientEmail.trim(),
          });
          emailMessage = ` & emailed to ${recipientEmail.trim()}`;
        } catch (emailErr) {
          showToast(emailErr.message || 'Quotation saved, but failed to send email', 'error');
        }
      }

      showToast(`Quotation generated successfully${emailMessage}!`, 'success');
      setShowQuoteModal(false);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to create quotation', 'error');
    } finally {
      setSubmittingAct(false);
    }
  };

  const handleQuoteStatus = async (quoteIndex, status) => {
    try {
      const updatedQuotations = [...(lead?.quotations || [])];
      if (updatedQuotations[quoteIndex]) {
        updatedQuotations[quoteIndex].status = status;
      }
      let nextStatus = lead.status;
      if (status === 'Accepted') nextStatus = 'Booking Pending';
      if (status === 'Rejected') nextStatus = 'Lost';

      await interiorApiClient.patch(`/crm/customers/${id}`, {
        quotations: updatedQuotations,
        status: nextStatus,
      });

      showToast(`Quotation marked as ${status}`, 'success');
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to update quote status', 'error');
    }
  };

  const handleConvertToProject = async (quoteIndex) => {
    Alert.alert(
      'Convert to Project',
      'Are you sure you want to convert this Lead into an active Execution Project?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert Now',
          style: 'default',
          onPress: async () => {
            try {
              await interiorApiClient.post(`/crm/customers/${id}/convert`, { quotationIndex: quoteIndex });
              showToast('🎉 Successfully converted to Project!', 'success');
              router.push('/(tabs)/crm');
            } catch (e) {
              showToast(e.message || 'Failed to convert to project', 'error');
            }
          }
        }
      ]
    );
  };

  const openEditModal = () => {
    setEditForm({
      name: lead.name || '',
      mobileNumber: lead.mobileNumber || '',
      email: lead.email || '',
      leadSource: lead.leadSource || 'Phone Call',
      propertyType: lead.propertyType || 'Flat',
      projectLocation: lead.projectLocation || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async () => {
    if (!editForm.name.trim() || !editForm.mobileNumber.trim()) {
      showToast('Name and Mobile Number are required', 'error');
      return;
    }
    setSubmittingEdit(true);
    try {
      await interiorApiClient.patch(`/crm/customers/${id}`, {
        ...editForm,
        name: editForm.name.trim(),
        mobileNumber: editForm.mobileNumber.trim(),
        email: editForm.email.trim(),
        projectLocation: editForm.projectLocation.trim(),
      });
      showToast('Lead updated successfully!', 'success');
      setShowEditModal(false);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to update lead', 'error');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const openQuoteModal = () => {
    setRecipientEmail(lead?.email || '');
    setShouldSendEmail(true);
    setShowQuoteModal(true);
  };

  const handleDeleteLead = () => {
    Alert.alert(
      'Delete Lead',
      `Are you sure you want to delete ${lead?.name || 'this lead'}? This action cannot be undone — all site visits, requirements, quotations, and activity history will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingLead(true);
            try {
              await interiorApiClient.delete(`/crm/customers/${id}`);
              showToast('Lead deleted successfully', 'delete');
              router.replace('/(tabs)/crm');
            } catch (e) {
              showToast(e.message || 'Failed to delete lead', 'error');
            } finally {
              setDeletingLead(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Loading Lead Profile...</Text>
      </View>
    );
  }

  if (!lead) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Lead Details</Text>
        </View>
        <View style={s.center}>
          <Text style={s.errorText}>Lead not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const meta = STAGE_META[lead.status] || STAGE_META['Lost'];
  const currentQuote = lead.quotations?.[activeQuoteIdx];

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      {/* --- HERO HEADER --- */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#1E293B" />
        </TouchableOpacity>

        <View style={{ flex: 1, minWidth: 0, marginHorizontal: 8 }}>
          <View style={{ flexDirection: 'row', items: 'center', gap: 6 }}>
            <Text style={s.headerTitle} numberOfLines={1}>{lead.name}</Text>
            <View style={s.leadIdBadge}>
              <Text style={s.leadIdText}>{lead.leadNumber || 'LD-XXXX'}</Text>
            </View>
          </View>
          <Text style={s.headerSub} numberOfLines={1}>
            {lead.mobileNumber} {lead.email ? `· ${lead.email}` : ''}
          </Text>
        </View>

        <TouchableOpacity style={s.headerIconBtn} onPress={openEditModal}>
          <Ionicons name="pencil-outline" size={17} color="#334155" />
        </TouchableOpacity>

        <TouchableOpacity style={s.headerIconBtn} onPress={handleDeleteLead} disabled={deletingLead}>
          {deletingLead ? <ActivityIndicator size="small" color="#DC2626" /> : <Ionicons name="trash-outline" size={17} color="#DC2626" />}
        </TouchableOpacity>

        {lead.status !== 'Lost' && (
          <TouchableOpacity style={s.headerIconBtn} onPress={() => setShowLostModal(true)}>
            <Ionicons name="close-circle-outline" size={19} color="#BE123C" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[s.statusDropdownBtn, { backgroundColor: meta.bg }]} >
          <Text style={[s.statusDropdownText, { color: meta.color }]} numberOfLines={1}>{lead.status}</Text>
          {/* <Ionicons name="chevron-down" size={14} color={meta.color} /> */}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor="#2563EB" />}
      >
        {/* --- QUICK ACTION BAR --- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickActionsRow}>
          <TouchableOpacity style={s.actionCard} onPress={() => setShowSiteModal(true)}>
            <View style={[s.actionIconBox, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="location-outline" size={18} color="#7C3AED" />
            </View>
            <Text style={s.actionLabel}>Site Visit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionCard} onPress={() => setShowReqModal(true)}>
            <View style={[s.actionIconBox, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="create-outline" size={18} color="#059669" />
            </View>
            <Text style={s.actionLabel}>Requirements</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionCard} onPress={() => setShowDesignModal(true)}>
            <View style={[s.actionIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="cloud-upload-outline" size={18} color="#2563EB" />
            </View>
            <Text style={s.actionLabel}>Designs</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionCard} onPress={() => { setEditingBoqIdx(null); setShowBoqModal(true); }}>
            <View style={[s.actionIconBox, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="calculator-outline" size={18} color="#059669" />
            </View>
            <Text style={s.actionLabel}>BOQ</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionCard} onPress={openQuoteModal}>
            <View style={[s.actionIconBox, { backgroundColor: '#FFF1F2' }]}>
              <Ionicons name="document-text-outline" size={18} color="#E11D48" />
            </View>
            <Text style={s.actionLabel}>Quote</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionCard} onPress={() => setShowFollowUpModal(true)}>
            <View style={[s.actionIconBox, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="calendar-outline" size={18} color="#D97706" />
            </View>
            <Text style={s.actionLabel}>Follow-up</Text>
          </TouchableOpacity>
        </ScrollView>



        {/* --- TAB NAVIGATION --- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            const lock = getTabLockState(t.id);
            return (
              <TouchableOpacity key={t.id} style={[s.tabItem, active && s.tabItemActive]} onPress={() => setActiveTab(t.id)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {lock.isLocked && <Ionicons name="lock-closed" size={11} color="#94A3B8" />}
                  <Text style={[s.tabText, active && s.tabTextActive, lock.isLocked && { color: '#94A3B8' }]}>{t.label}</Text>
                </View>
                {active && <View style={s.tabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* --- TAB CONTENT --- */}
        <View style={s.tabContent}>
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <View style={{ gap: 16 }}>
              <View style={s.metricsGrid}>
                <View style={s.metricCard}>
                  <Text style={s.metricLabel}>Mobile Number</Text>
                  <Text style={s.metricVal}>{lead.mobileNumber || 'Not specified'}</Text>
                </View>
                <View style={s.metricCard}>
                  <Text style={s.metricLabel}>Email</Text>
                  <Text style={s.metricVal} numberOfLines={1}>{lead.email || 'Not specified'}</Text>
                </View>
                <View style={s.metricCard}>
                  <Text style={s.metricLabel}>Client Source</Text>
                  <Text style={s.metricVal}>{lead.leadSource || 'Manual Entry'}</Text>
                </View>
                <View style={s.metricCard}>
                  <Text style={s.metricLabel}>Property Scope</Text>
                  <Text style={s.metricVal}>{lead.propertyType || 'Not specified'}</Text>
                </View>
                <View style={s.metricCard}>
                  <Text style={s.metricLabel}>Location</Text>
                  <Text style={s.metricVal} numberOfLines={1}>{lead.projectLocation || lead.city || 'Not specified'}</Text>
                </View>
              </View>

              {/* Activity Timeline */}
              <View style={s.card}>
                <View style={s.cardHeaderRow}>
                  <Ionicons name="pulse" size={18} color="#2563EB" />
                  <Text style={s.cardTitle}>Activity Timeline</Text>
                  <TouchableOpacity style={s.smallBtn} onPress={() => setShowActivityModal(true)}>
                    <Ionicons name="add" size={14} color="#2563EB" />
                    <Text style={s.smallBtnText}>Log</Text>
                  </TouchableOpacity>
                </View>

                {activities.length === 0 ? (
                  <Text style={s.emptySubText}>No activities logged yet.</Text>
                ) : (
                  activities.map((act) => {
                    const userName = act.user?.name || act.user?.firstName || 'User';
                    return (
                      <View key={act._id} style={s.timelineItem}>
                        <View style={[s.timelineDot, { backgroundColor: act.status === 'Pending' ? '#F59E0B' : '#2563EB' }]} />
                        <View style={s.timelineBody}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={s.actType}>{act.type} {act.status === 'Pending' && '• Scheduled'}</Text>
                            <Text style={s.actTime}>
                              {new Date(act.scheduledDate || act.createdAt).toLocaleDateString()}
                            </Text>
                          </View>
                          <Text style={s.actRemarks}>{act.remarks}</Text>
                          <Text style={s.actAuthor}>Logged by {userName}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* 2. SITE VISITS TAB */}
          {activeTab === 'site' && (
            <View style={{ gap: 16 }}>
              {getTabLockState('site').isLocked ? (
                <View style={s.lockedCard}>
                  <View style={[s.lockedIconBox, { backgroundColor: '#F3E8FF' }]}>
                    <Ionicons name="lock-closed" size={24} color="#7C3AED" />
                  </View>
                  <Text style={s.lockedTitle}>Site Visit Phase Locked</Text>
                  <Text style={s.lockedSub}>Advance the lead from "{lead.status}" to begin physical site measurements.</Text>
                  <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#7C3AED' }]} onPress={() => setShowSendSiteModal(true)}>
                    <Text style={s.unlockActionBtnText}>Pass to Site Visit</Text>
                  </TouchableOpacity>
                </View>
              ) : !lead.siteMeasurements ? (
                <View style={s.emptyCard}>
                  <Ionicons name="location-outline" size={40} color="#7C3AED" />
                  <Text style={s.emptyCardTitle}>No Site Measurements</Text>
                  <Text style={s.emptySubText}>Capture area, height, and site photos.</Text>
                  <TouchableOpacity style={s.actionBtnPrimary} onPress={() => setShowSiteModal(true)}>
                    <Text style={s.actionBtnText}>Log Site Visit</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  <View style={s.card}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={s.cardTitle}>Measurements & Specs</Text>
                      <TouchableOpacity style={s.smallBtn} onPress={() => setShowSiteModal(true)}>
                        <Ionicons name="create-outline" size={14} color="#4F46E5" />
                        <Text style={[s.smallBtnText, { color: '#4F46E5' }]}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={s.measureGrid}>
                      <View style={s.measureItem}>
                        <Text style={s.metricLabel}>Carpet Area</Text>
                        <Text style={s.measureVal}>{lead.siteMeasurements.carpetArea ? `${lead.siteMeasurements.carpetArea} Sq.Ft` : 'N/A'}</Text>
                      </View>
                      <View style={s.measureItem}>
                        <Text style={s.metricLabel}>Rooms</Text>
                        <Text style={s.measureVal}>{lead.siteMeasurements.rooms || 'N/A'}</Text>
                      </View>
                      <View style={s.measureItem}>
                        <Text style={s.metricLabel}>Ceiling Ht</Text>
                        <Text style={s.measureVal}>{lead.siteMeasurements.ceilingHeight ? `${lead.siteMeasurements.ceilingHeight} Ft` : 'N/A'}</Text>
                      </View>
                      <View style={s.measureItem}>
                        <Text style={s.metricLabel}>Drop Ht</Text>
                        <Text style={s.measureVal}>{lead.siteMeasurements.floorToCeilingHeight ? `${lead.siteMeasurements.floorToCeilingHeight} Ft` : 'N/A'}</Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 16, gap: 12 }}>
                      {lead.siteMeasurements.roomDimensions && (
                        <View>
                          <Text style={s.metricLabel}>Room Dimensions</Text>
                          <Text style={s.measureVal}>{lead.siteMeasurements.roomDimensions}</Text>
                        </View>
                      )}
                      {(lead.siteMeasurements.doorDimensions || lead.siteMeasurements.windowDimensions) && (
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.metricLabel}>Doors</Text>
                            <Text style={s.measureVal}>{lead.siteMeasurements.doorDimensions || 'N/A'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.metricLabel}>Windows</Text>
                            <Text style={s.measureVal}>{lead.siteMeasurements.windowDimensions || 'N/A'}</Text>
                          </View>
                        </View>
                      )}
                      {lead.siteMeasurements.electricalPoints && (
                        <View>
                          <Text style={s.metricLabel}>Electrical & Plumbing</Text>
                          <Text style={s.measureVal}>{lead.siteMeasurements.electricalPoints}</Text>
                          {lead.siteMeasurements.plumbingPoints && <Text style={s.measureVal}>{lead.siteMeasurements.plumbingPoints}</Text>}
                        </View>
                      )}
                      {lead.siteMeasurements.acLocations && (
                        <View>
                          <Text style={s.metricLabel}>AC Locations & Piping</Text>
                          <Text style={s.measureVal}>{lead.siteMeasurements.acLocations}</Text>
                        </View>
                      )}
                      {lead.siteMeasurements.siteConstraints && (
                        <View>
                          <Text style={s.metricLabel}>Site Constraints / Rules</Text>
                          <Text style={s.measureVal}>{lead.siteMeasurements.siteConstraints}</Text>
                        </View>
                      )}
                    </View>

                    {lead.siteMeasurements.notes && (
                      <View style={{ marginTop: 16, padding: 10, backgroundColor: '#F3E8FF', borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3AED' }}>Notes</Text>
                        <Text style={{ fontSize: 13, color: '#4C1D95', marginTop: 2 }}>{lead.siteMeasurements.notes}</Text>
                      </View>
                    )}
                  </View>

                  <View style={s.card}>
                    <Text style={s.cardTitle}>Site Photos</Text>
                    {lead.sitePhotos && lead.sitePhotos.length > 0 ? (
                      <View style={s.photoGrid}>
                        {lead.sitePhotos.map((photo, i) => (
                          <Image key={i} source={{ uri: photo }} style={s.photoThumb} />
                        ))}
                      </View>
                    ) : (
                      <Text style={s.emptySubText}>No photos attached yet.</Text>
                    )}
                  </View>
                  
                  {lead.status === 'Under Site Visit' && (
                    <TouchableOpacity style={[s.actionBtnPrimary, { backgroundColor: '#7C3AED', marginTop: 8 }]} onPress={() => setShowSendReqModal(true)}>
                      <Text style={s.actionBtnText}>Complete Phase & Pass to Requirements</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* 3. REQUIREMENTS TAB */}
          {activeTab === 'requirements' && (
            <View style={{ gap: 16 }}>
              {getTabLockState('requirements').isLocked ? (
                <View style={s.lockedCard}>
                  <View style={[s.lockedIconBox, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="lock-closed" size={24} color="#4F46E5" />
                  </View>
                  <Text style={s.lockedTitle}>Requirements Phase Locked</Text>
                  <Text style={s.lockedSub}>Complete site measurements before logging detailed room specifications.</Text>
                  <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#4F46E5' }]} onPress={() => setShowSendReqModal(true)}>
                    <Text style={s.unlockActionBtnText}>Pass to Requirements</Text>
                  </TouchableOpacity>
                </View>
              ) : !lead.requirements || lead.requirements.length === 0 ? (
                <View style={s.emptyCard}>
                  <Ionicons name="create-outline" size={40} color="#059669" />
                  <Text style={s.emptyCardTitle}>No Requirements Recorded</Text>
                  <Text style={s.emptySubText}>Add room-by-room themes and specifications.</Text>
                  <TouchableOpacity style={[s.actionBtnPrimary, { backgroundColor: '#059669' }]} onPress={() => setShowReqModal(true)}>
                    <Text style={s.actionBtnText}>Log Requirement</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    {lead.budgetRange ? (
                      <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: '#059669' }}>Budget: ₹{lead.budgetRange}</Text>
                    ) : <View />}
                    <TouchableOpacity style={s.smallBtn} onPress={() => setShowReqModal(true)}>
                      <Ionicons name="create-outline" size={14} color="#059669" />
                      <Text style={[s.smallBtnText, { color: '#059669' }]}>Edit / Add</Text>
                    </TouchableOpacity>
                  </View>
                  {lead.requirements.map((req, idx) => (
                    <View key={idx} style={s.card}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={s.reqRoomName}>{req.roomName}</Text>
                        {req.theme && <Text style={s.reqThemeBadge}>{req.theme}</Text>}
                      </View>
                      {req.description && <Text style={s.reqDesc}>{req.description}</Text>}
                      
                      {/* Functional Details */}
                      {(req.roomUsage || req.furnitureRequirements || req.storage || req.electricalPoints || req.plumbingPoints) && (
                        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter-Bold', color: '#64748B', marginBottom: 6 }}>FUNCTIONAL</Text>
                          {req.roomUsage && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Usage:</Text> {req.roomUsage}</Text>}
                          {req.furnitureRequirements && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Furniture:</Text> {req.furnitureRequirements}</Text>}
                          {req.storage && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Storage:</Text> {req.storage}</Text>}
                          {req.electricalPoints && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Electrical:</Text> {req.electricalPoints}</Text>}
                          {req.plumbingPoints && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Plumbing:</Text> {req.plumbingPoints}</Text>}
                        </View>
                      )}

                      {/* Aesthetic Details */}
                      {(req.colours || req.materials || req.flooring || req.ceiling || req.wallFinishes) && (
                        <View style={{ marginTop: 8 }}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter-Bold', color: '#64748B', marginBottom: 6 }}>AESTHETIC</Text>
                          {req.colours && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Colors:</Text> {req.colours}</Text>}
                          {req.materials && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Materials:</Text> {req.materials}</Text>}
                          {req.flooring && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Flooring:</Text> {req.flooring}</Text>}
                          {req.ceiling && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Ceiling:</Text> {req.ceiling}</Text>}
                          {req.wallFinishes && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Walls:</Text> {req.wallFinishes}</Text>}
                        </View>
                      )}
                    </View>
                  ))}
                  
                  {lead.status === 'Under Requirement' && (
                    <TouchableOpacity style={[s.actionBtnPrimary, { backgroundColor: '#4F46E5', marginTop: 8 }]} onPress={() => setShowSendDrawingModal(true)}>
                      <Text style={s.actionBtnText}>Complete Phase & Pass to Drawing</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* 4. DESIGNS & FILES TAB */}
          {activeTab === 'designs' && (
            <View style={{ gap: 16 }}>
              {getTabLockState('designs').isLocked ? (
                <View style={s.lockedCard}>
                  <View style={[s.lockedIconBox, { backgroundColor: '#F0F9FF' }]}>
                    <Ionicons name="lock-closed" size={24} color="#0284C7" />
                  </View>
                  <Text style={s.lockedTitle}>Drawing & Design Phase Locked</Text>
                  <Text style={s.lockedSub}>Finalize site requirements before initiating 2D/3D design drafting.</Text>
                  <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#0284C7' }]} onPress={() => setShowSendDrawingModal(true)}>
                    <Text style={s.unlockActionBtnText}>Pass to Drawing</Text>
                  </TouchableOpacity>
                </View>
              ) : !lead.designFiles || lead.designFiles.length === 0 ? (
                <View style={s.emptyCard}>
                  <Ionicons name="cloud-upload-outline" size={40} color="#2563EB" />
                  <Text style={s.emptyCardTitle}>No Designs Uploaded</Text>
                  <Text style={s.emptySubText}>Attach 2D/3D design renders and files.</Text>
                  <TouchableOpacity style={s.actionBtnPrimary} onPress={() => setShowDesignModal(true)}>
                    <Text style={s.actionBtnText}>Upload Design File</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  <TouchableOpacity style={[s.smallBtn, { alignSelf: 'flex-end' }]} onPress={() => setShowDesignModal(true)}>
                    <Ionicons name="add" size={14} color="#2563EB" />
                    <Text style={s.smallBtnText}>Upload File</Text>
                  </TouchableOpacity>
                  {lead.designFiles.map((file, idx) => (
                    <TouchableOpacity key={idx} style={s.fileCard} onPress={() => file.url && Linking.openURL(file.url)}>
                      <View style={s.fileIconBox}>
                        <Ionicons name={file.fileType === 'pdf' ? 'document-text-outline' : file.fileType === 'image' ? 'image-outline' : 'cube-outline'} size={20} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fileName} numberOfLines={1}>{file.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          {file.category && (
                            <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 9, fontFamily: 'Inter-Bold', color: '#4F46E5', textTransform: 'uppercase' }}>{file.category}</Text>
                            </View>
                          )}
                          <Text style={s.fileSub}>{new Date(file.uploadedAt).toLocaleDateString()}</Text>
                        </View>
                      </View>
                      <Ionicons name="open-outline" size={16} color="#64748B" />
                    </TouchableOpacity>
                  ))}
                  
                  {lead.status === 'Under Drawing' && (
                    <TouchableOpacity style={[s.actionBtnPrimary, { backgroundColor: '#0284C7', marginTop: 8 }]} onPress={() => setShowSendBoqModal(true)}>
                      <Text style={s.actionBtnText}>Complete Phase & Pass to BOQ Estimation</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* 5. BOQ TAB */}
          {activeTab === 'boq' && (
            <View style={{ gap: 16 }}>
              {getTabLockState('boq').isLocked ? (
                <View style={s.lockedCard}>
                  <View style={[s.lockedIconBox, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="lock-closed" size={24} color="#059669" />
                  </View>
                  <Text style={s.lockedTitle}>BOQ Estimation Phase Locked</Text>
                  <Text style={s.lockedSub}>Approval of 2D/3D drawings is required before building itemized BOQs.</Text>
                  <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#059669' }]} onPress={() => setShowSendBoqModal(true)}>
                    <Text style={s.unlockActionBtnText}>Pass to BOQ Phase</Text>
                  </TouchableOpacity>
                </View>
              ) : !lead.boqs || lead.boqs.length === 0 ? (
                <View style={s.emptyCard}>
                  <Ionicons name="calculator-outline" size={40} color="#059669" />
                  <Text style={s.emptyCardTitle}>No BOQ Generated</Text>
                  <Text style={s.emptySubText}>Build an itemized Bill of Quantities with quantities and rates.</Text>
                  <TouchableOpacity
                    style={[s.actionBtnPrimary, { backgroundColor: '#059669' }]}
                    onPress={() => { setEditingBoqIdx(null); setShowBoqModal(true); }}
                  >
                    <Text style={s.actionBtnText}>+ Create Estimate BOQ</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 14 }}>
                  {/* BOQ Header & Rev Switcher */}
                  <View style={s.boqHeaderCard}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.boqNumberText}>{lead.boqs[activeBoqIdx]?.boqNumber || 'BOQ'}</Text>
                        <View style={s.versionTag}>
                          <Text style={s.versionTagText}>
                            {lead.boqs[activeBoqIdx]?.version ? `v${lead.boqs[activeBoqIdx].version}.0` : 'v1.0'}
                          </Text>
                        </View>
                      </View>
                      <Text style={s.boqDateText}>
                        Updated: {new Date(lead.boqs[activeBoqIdx]?.createdAt || Date.now()).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={s.editBoqBtn}
                      onPress={() => { setEditingBoqIdx(activeBoqIdx); setShowBoqModal(true); }}
                    >
                      <Ionicons name="create-outline" size={13} color="#2563EB" />
                      <Text style={s.editBoqBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.newBoqBtn}
                      onPress={() => { setEditingBoqIdx(null); setShowBoqModal(true); }}
                    >
                      <Ionicons name="add" size={14} color="#FFFFFF" />
                      <Text style={s.newBoqBtnText}>New Rev</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Versions Tabs if multiple */}
                  {lead.boqs.length > 1 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {lead.boqs.map((b, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[s.versionChip, activeBoqIdx === idx && s.versionChipActive]}
                          onPress={() => setActiveBoqIdx(idx)}
                        >
                          <Text style={[s.versionChipText, activeBoqIdx === idx && s.versionChipTextActive]}>
                            {b.version ? `v${b.version}.0` : `v${idx + 1}.0`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}

                  {/* Summary Totals */}
                  <View style={s.costSummaryCard}>
                    <View style={s.costRow}>
                      <Text style={s.costLabel}>Items Subtotal</Text>
                      <Text style={s.costVal}>₹{(lead.boqs[activeBoqIdx]?.subtotal || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={s.costRow}>
                      <Text style={s.costLabel}>GST ({lead.boqs[activeBoqIdx]?.taxPercent || 18}%)</Text>
                      <Text style={s.costVal}>₹{(lead.boqs[activeBoqIdx]?.taxAmount || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={[s.costRow, s.costRowTotal]}>
                      <Text style={s.grandTotalTitle}>Estimated Total</Text>
                      <Text style={s.grandTotalAmount}>
                        ₹{(lead.boqs[activeBoqIdx]?.totalAmount || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>

                  {/* Items List */}
                  <View style={s.card}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={s.cardTitle}>Line Items ({lead.boqs[activeBoqIdx]?.items?.length || 0})</Text>
                      <TouchableOpacity
                        style={[s.smallBtn, { backgroundColor: '#FFF1F2' }]}
                        onPress={() => {
                          const activeItems = lead.boqs[activeBoqIdx]?.items || [];
                          if (activeItems.length > 0) {
                            setQuoteItems(
                              activeItems.map((it) => ({
                                description: `${it.category ? `[${it.category}] ` : ''}${it.itemName}`,
                                quantity: String(it.quantity || 1),
                                unitPrice: String(it.rate || it.unitRate || 0),
                              }))
                            );
                            openQuoteModal();
                          }
                        }}
                      >
                        <Ionicons name="arrow-forward" size={13} color="#E11D48" />
                        <Text style={[s.smallBtnText, { color: '#E11D48' }]}>Create Quote</Text>
                      </TouchableOpacity>
                    </View>

                    {(lead.boqs[activeBoqIdx]?.items || []).map((it, idx) => (
                      <View key={idx} style={s.boqItemRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={s.catBadgeSmall}>
                              <Text style={s.catBadgeSmallText}>{it.category || 'Item'}</Text>
                            </View>
                            <Text style={s.itemNameText}>{it.itemName}</Text>
                          </View>
                          {!!it.description && <Text style={s.itemDescText}>{it.description}</Text>}
                          <Text style={s.itemQtyRateText}>
                            {it.quantity} {it.unit} × ₹{Number(it.rate || it.unitRate || 0).toLocaleString('en-IN')}
                          </Text>
                        </View>
                        <Text style={s.itemTotalText}>
                          ₹{Math.round(it.amount || (parseFloat(it.quantity) || 1) * (parseFloat(it.rate || it.unitRate) || 0)).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    ))}
                  </View>
                  
                  {lead.status === 'Under BOQ Creation' && (
                    <TouchableOpacity style={[s.actionBtnPrimary, { backgroundColor: '#059669', marginTop: 8 }]} onPress={() => setShowSendQuoteModal(true)}>
                      <Text style={s.actionBtnText}>Complete Phase & Pass to Quotation</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* 6. QUOTATIONS TAB */}
          {activeTab === 'quotations' && (
            <View style={{ gap: 16 }}>
              {getTabLockState('quotations').isLocked ? (
                <View style={s.lockedCard}>
                  <View style={[s.lockedIconBox, { backgroundColor: '#FFF1F2' }]}>
                    <Ionicons name="lock-closed" size={24} color="#E11D48" />
                  </View>
                  <Text style={s.lockedTitle}>Quotation Phase Locked</Text>
                  <Text style={s.lockedSub}>An estimate BOQ is required before generating final sales quotations.</Text>
                  <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#E11D48' }]} onPress={() => setShowSendQuoteModal(true)}>
                    <Text style={s.unlockActionBtnText}>Pass to Quotation</Text>
                  </TouchableOpacity>
                </View>
              ) : !lead.quotations || lead.quotations.length === 0 ? (
                <View style={s.emptyCard}>
                  <Ionicons name="calculator-outline" size={40} color="#E11D48" />
                  <Text style={s.emptyCardTitle}>No Quotations Created</Text>
                  <Text style={s.emptySubText}>Generate itemized quotes for your client.</Text>
                  <TouchableOpacity style={[s.actionBtnPrimary, { backgroundColor: '#E11D48' }]} onPress={openQuoteModal}>
                    <Text style={s.actionBtnText}>Generate Quotation</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  {/* Version Picker */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {lead.quotations.map((q, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[s.versionChip, activeQuoteIdx === idx && s.versionChipActive]}
                        onPress={() => setActiveQuoteIdx(idx)}
                      >
                        <Text style={[s.versionChipText, activeQuoteIdx === idx && s.versionChipTextActive]}>
                          v{q.version} ({q.status})
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={s.addVersionBtn} onPress={openQuoteModal}>
                      <Ionicons name="add" size={14} color="#E11D48" />
                    </TouchableOpacity>
                  </ScrollView>

                  {/* Quotation Detail Card */}
                  {currentQuote && (
                    <View style={s.card}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={s.cardTitle}>Quotation v{currentQuote.version}</Text>
                        <View style={[s.stageBadge, { backgroundColor: currentQuote.status === 'Accepted' ? '#DCFCE7' : currentQuote.status === 'Rejected' ? '#FEE2E2' : '#FEF3C7' }]}>
                          <Text style={[s.stageBadgeText, { color: currentQuote.status === 'Accepted' ? '#15803D' : currentQuote.status === 'Rejected' ? '#B91C1C' : '#B45309' }]}>
                            {currentQuote.status}
                          </Text>
                        </View>
                      </View>

                      {/* Items */}
                      <View style={s.quoteTable}>
                        <View style={s.quoteHeaderRow}>
                          <Text style={[s.quoteCol, { flex: 2 }]}>Item</Text>
                          <Text style={s.quoteCol}>Qty</Text>
                          <Text style={s.quoteCol}>Rate</Text>
                          <Text style={[s.quoteCol, { textAlign: 'right' }]}>Total</Text>
                        </View>
                        {currentQuote.items?.map((item, i) => (
                          <View key={i} style={s.quoteRow}>
                            <Text style={[s.quoteCell, { flex: 2 }]} numberOfLines={1}>{item.description}</Text>
                            <Text style={s.quoteCell}>{item.quantity}</Text>
                            <Text style={s.quoteCell}>₹{item.unitPrice}</Text>
                            <Text style={[s.quoteCell, { textAlign: 'right', fontWeight: '700' }]}>₹{item.total}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Totals */}
                      <View style={s.quoteTotalsBox}>
                        <View style={s.totalRow}>
                          <Text style={s.totalLabel}>Subtotal</Text>
                          <Text style={s.totalVal}>₹{currentQuote.subtotal?.toLocaleString('en-IN')}</Text>
                        </View>
                        <View style={s.totalRow}>
                          <Text style={s.totalLabel}>Tax ({currentQuote.taxPercentage}%)</Text>
                          <Text style={s.totalVal}>₹{currentQuote.tax?.toLocaleString('en-IN')}</Text>
                        </View>
                        {currentQuote.discount > 0 && (
                          <View style={s.totalRow}>
                            <Text style={{ fontSize: 12, color: '#16A34A' }}>Discount</Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#16A34A' }}>- ₹{currentQuote.discount?.toLocaleString('en-IN')}</Text>
                          </View>
                        )}
                        <View style={[s.totalRow, { paddingTop: 8, borderTopWidth: 1, borderColor: '#E2E8F0', marginTop: 4 }]}>
                          <Text style={{ fontSize: 15, fontWeight: '900', color: '#0F172A' }}>Grand Total</Text>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: '#2563EB' }}>₹{currentQuote.grandTotal?.toLocaleString('en-IN')}</Text>
                        </View>
                      </View>

                      {/* Actions */}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                        <TouchableOpacity style={[s.smallActionBtn, { backgroundColor: '#DCFCE7' }]} onPress={() => handleQuoteStatus(activeQuoteIdx, 'Accepted')}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803D' }}>Mark Accepted</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.smallActionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => handleQuoteStatus(activeQuoteIdx, 'Rejected')}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#B91C1C' }}>Mark Rejected</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.smallActionBtn, { backgroundColor: '#4F46E5', flex: 1 }]} onPress={() => handleConvertToProject(activeQuoteIdx)}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' }}>🎉 Convert to Project</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* --- MODALS --- */}
      {/* Mark Lost Modal */}
      <MarkLostModal
        visible={showLostModal}
        onClose={() => setShowLostModal(false)}
        customerId={id}
        leadName={lead.name}
        onSuccess={() => fetchData()}
      />

      {/* 1. Status Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade" onRequestClose={() => setShowStatusModal(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowStatusModal(false)}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Update Lead Stage</Text>
            {STAGES.map((st) => (
              <TouchableOpacity key={st} style={s.stageOption} onPress={() => handleStatusChange(st)}>
                <Text style={[s.stageOptionText, lead.status === st && { fontWeight: '900', color: '#2563EB' }]}>{st}</Text>
                {lead.status === st && <Ionicons name="checkmark" size={16} color="#2563EB" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 1b. Edit Lead Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Lead Details</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Full Name *</Text>
              <TextInput style={s.input} placeholder="e.g. John Doe" placeholderTextColor="#94A3B8" value={editForm.name} onChangeText={(v) => setEditForm({ ...editForm, name: v })} />

              <Text style={s.label}>Mobile Number *</Text>
              <TextInput style={s.input} placeholder="+91 9876543210" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={editForm.mobileNumber} onChangeText={(v) => setEditForm({ ...editForm, mobileNumber: v })} />

              <Text style={s.label}>Email Address</Text>
              <TextInput style={s.input} placeholder="john@example.com" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" value={editForm.email} onChangeText={(v) => setEditForm({ ...editForm, email: v })} />

              <Text style={s.label}>Lead Source</Text>
              <View style={s.chipOptions}>
                {['Phone Call', 'Walk-in', 'Referral', 'Existing Customer', 'Builder Reference', 'Architect Reference', 'Society Reference', 'Social Media', 'Other'].map((opt) => (
                  <TouchableOpacity key={opt} style={[s.optionChip, editForm.leadSource === opt && s.optionChipActive]} onPress={() => setEditForm({ ...editForm, leadSource: opt })}>
                    <Text style={[s.optionChipText, editForm.leadSource === opt && s.optionChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Property Type</Text>
              <View style={s.chipOptions}>
                {['Flat', 'Villa', 'Office', 'Shop', 'Other'].map((opt) => (
                  <TouchableOpacity key={opt} style={[s.optionChip, editForm.propertyType === opt && s.optionChipActive]} onPress={() => setEditForm({ ...editForm, propertyType: opt })}>
                    <Text style={[s.optionChipText, editForm.propertyType === opt && s.optionChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Project Location</Text>
              <TextInput style={s.input} placeholder="e.g. Hiranandani Estate, Thane" placeholderTextColor="#94A3B8" value={editForm.projectLocation} onChangeText={(v) => setEditForm({ ...editForm, projectLocation: v })} />

              <TouchableOpacity style={s.submitBtn} onPress={handleEditSubmit} disabled={submittingEdit}>
                <Text style={s.submitBtnText}>{submittingEdit ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 2. Activity Modal */}
      <Modal visible={showActivityModal} transparent animationType="slide" onRequestClose={() => setShowActivityModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Log Activity</Text>
              <TouchableOpacity onPress={() => setShowActivityModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={s.label}>Activity Type</Text>
            <View style={s.chipOptions}>
              {['Phone Call', 'WhatsApp', 'Meeting', 'Site Visit'].map((t) => (
                <TouchableOpacity key={t} style={[s.optionChip, activityForm.type === t && s.optionChipActive]} onPress={() => setActivityForm({ ...activityForm, type: t })}>
                  <Text style={[s.optionChipText, activityForm.type === t && s.optionChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>Remarks / Summary</Text>
            <TextInput
              style={[s.input, { height: 80 }]}
              multiline
              placeholder="Enter meeting notes..."
              placeholderTextColor="#94A3B8"
              value={activityForm.remarks}
              onChangeText={(v) => setActivityForm({ ...activityForm, remarks: v })}
            />
            <TouchableOpacity style={s.submitBtn} onPress={handleAddActivity} disabled={submittingAct}>
              <Text style={s.submitBtnText}>{submittingAct ? 'Saving...' : 'Save Activity'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 3. Follow Up Modal */}
      <Modal visible={showFollowUpModal} transparent animationType="slide" onRequestClose={() => setShowFollowUpModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Schedule Follow-up</Text>
              <TouchableOpacity onPress={() => setShowFollowUpModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={s.label}>Follow-up Notes / Goal</Text>
            <TextInput
              style={[s.input, { height: 80 }]}
              multiline
              placeholder="e.g. Call client to confirm design meeting..."
              placeholderTextColor="#94A3B8"
              value={followUpForm.remarks}
              onChangeText={(v) => setFollowUpForm({ ...followUpForm, remarks: v })}
            />
            <TouchableOpacity style={s.submitBtn} onPress={handleScheduleFollowUp} disabled={submittingAct}>
              <Text style={s.submitBtnText}>{submittingAct ? 'Scheduling...' : 'Schedule Follow-up'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 4. Site Visit Modal */}
      <LogSiteVisitModal
        visible={showSiteModal}
        onClose={() => setShowSiteModal(false)}
        customerId={id}
        initialMeasurements={lead?.siteMeasurements}
        initialPhotos={lead?.sitePhotos}
        onSuccess={() => {
          showToast('Site visit logged successfully!', 'success');
          fetchData();
        }}
      />

      {/* 5. Requirements Modal */}
      <LogRequirementsModal
        visible={showReqModal}
        onClose={() => setShowReqModal(false)}
        customerId={id}
        initialBudgetRange={lead?.budgetRange}
        initialRequirements={lead?.requirements}
        onSuccess={() => {
          showToast('Requirements logged successfully!', 'success');
          fetchData();
        }}
      />

      {/* 6. Upload Design Modal */}
      <UploadDesignModal
        visible={showDesignModal}
        onClose={() => setShowDesignModal(false)}
        customerId={id}
        existingDesigns={lead?.designFiles}
        onSuccess={() => {
          showToast('Design file uploaded successfully!', 'success');
          fetchData();
        }}
      />

      {/* 7. Quotation Builder Modal */}
      <Modal visible={showQuoteModal} transparent animationType="slide" onRequestClose={() => setShowQuoteModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '90%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Generate Quotation</Text>
              <TouchableOpacity onPress={() => setShowQuoteModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Itemized Breakdown</Text>
              {quoteItems.map((item, idx) => (
                <View key={idx} style={s.quoteItemBuilderRow}>
                  <TextInput
                    style={[s.input, { flex: 2, marginBottom: 0 }]}
                    placeholder="Description"
                    placeholderTextColor="#94A3B8"
                    value={item.description}
                    onChangeText={(v) => {
                      const copy = [...quoteItems];
                      copy[idx].description = v;
                      setQuoteItems(copy);
                    }}
                  />
                  <TextInput
                    style={[s.input, { width: 50, marginBottom: 0 }]}
                    placeholder="Qty"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={item.quantity}
                    onChangeText={(v) => {
                      const copy = [...quoteItems];
                      copy[idx].quantity = v;
                      setQuoteItems(copy);
                    }}
                  />
                  <TextInput
                    style={[s.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Rate"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={item.unitPrice}
                    onChangeText={(v) => {
                      const copy = [...quoteItems];
                      copy[idx].unitPrice = v;
                      setQuoteItems(copy);
                    }}
                  />
                </View>
              ))}

              <TouchableOpacity style={s.addItemBtn} onPress={() => setQuoteItems([...quoteItems, { description: '', quantity: '1', unitPrice: '' }])}>
                <Ionicons name="add" size={14} color="#2563EB" />
                <Text style={s.addItemText}>Add Another Item</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Tax (%)</Text>
                  <TextInput style={s.input} keyboardType="numeric" value={quoteTax} onChangeText={setQuoteTax} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Discount (₹)</Text>
                  <TextInput style={s.input} keyboardType="numeric" value={quoteDiscount} onChangeText={setQuoteDiscount} />
                </View>
              </View>

              <Text style={s.label}>Terms & Notes</Text>
              <TextInput style={[s.input, { height: 60 }]} multiline value={quoteNotes} onChangeText={setQuoteNotes} placeholder="1. 50% advance payment..." />

              <TouchableOpacity style={s.emailToggleRow} onPress={() => setShouldSendEmail(!shouldSendEmail)}>
                <View style={[s.checkbox, shouldSendEmail && s.checkboxChecked]}>
                  {shouldSendEmail && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                </View>
                <Text style={s.checkboxLabel}>Email Proforma Invoice to client</Text>
              </TouchableOpacity>

              {shouldSendEmail && (
                <TextInput
                  style={s.input}
                  placeholder="client@example.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={recipientEmail}
                  onChangeText={setRecipientEmail}
                />
              )}

              <TouchableOpacity style={s.submitBtn} onPress={handleSaveQuotation} disabled={submittingAct}>
                <Text style={s.submitBtnText}>{submittingAct ? 'Generating...' : 'Generate Quote'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 8. BOQ Builder Modal */}
      <BoqBuilderModal
        visible={showBoqModal}
        onClose={() => setShowBoqModal(false)}
        customerId={id}
        existingBoqs={lead?.boqs || []}
        editingBoqIndex={editingBoqIdx}
        onSuccess={() => {
          showToast('BOQ saved successfully!', 'success');
          fetchData();
        }}
      />

      {/* 9. Stage Advancement Guided Modals */}
      <SendToSiteVisitModal
        isOpen={showSendSiteModal}
        onClose={() => setShowSendSiteModal(false)}
        customerId={id}
        users={users}
        onSuccess={() => {
          showToast('Passed to Site Visit phase!', 'success');
          fetchData();
        }}
      />

      <SendToRequirementsModal
        isOpen={showSendReqModal}
        onClose={() => setShowSendReqModal(false)}
        customerId={id}
        users={users}
        onSuccess={() => {
          showToast('Passed to Requirements phase!', 'success');
          fetchData();
        }}
      />

      <SendToDrawingModal
        isOpen={showSendDrawingModal}
        onClose={() => setShowSendDrawingModal(false)}
        customerId={id}
        users={users}
        onSuccess={() => {
          showToast('Passed to Drawing phase!', 'success');
          fetchData();
        }}
      />

      <SendToBoqModal
        isOpen={showSendBoqModal}
        onClose={() => setShowSendBoqModal(false)}
        customerId={id}
        users={users}
        onSuccess={() => {
          showToast('Passed to BOQ Estimation phase!', 'success');
          fetchData();
        }}
      />

      <SendToQuotationsModal
        isOpen={showSendQuoteModal}
        onClose={() => setShowSendQuoteModal(false)}
        customerId={id}
        onSuccess={() => {
          showToast('Passed to Quotation phase!', 'success');
          fetchData();
        }}
      />

      <ConvertToProjectModal
        isOpen={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        customerId={id}
        onSuccess={() => {
          showToast('🎉 Converted to active project!', 'success');
          fetchData();
          router.push('/(tabs)/crm');
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 14, color: '#64748B', fontWeight: '500' },
  errorText: { fontSize: 16, color: '#EF4444', fontWeight: '700' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0'
  },
  backBtn: { padding: 6, borderRadius: 10, backgroundColor: '#F1F5F9' },
  headerIconBtn: { padding: 7, borderRadius: 10, backgroundColor: '#F1F5F9', marginRight: 6 },
  emailToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkboxLabel: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#334155' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 2 },
  leadIdBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  leadIdText: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700', color: '#475569' },
  statusDropdownBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  statusDropdownText: { fontSize: 11, fontWeight: '800' },
  quickActionsRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  actionCard: { alignItems: 'center', gap: 6, width: 70 },
  actionIconBox: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '700', color: '#475569' },
  tabRow: { paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#E2E8F0', gap: 20, backgroundColor: '#FFFFFF' },
  tabItem: { paddingVertical: 12, position: 'relative' },
  tabItemActive: {},
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#2563EB', fontWeight: '800' },
  tabIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#2563EB', borderRadius: 2 },
  tabContent: { padding: 16 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  metricVal: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', flex: 1 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#EFF6FF', borderRadius: 8 },
  smallBtnText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
  emptySubText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', marginVertical: 12 },
  timelineItem: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineBody: { flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  actType: { fontSize: 11, fontWeight: '800', color: '#334155' },
  actTime: { fontSize: 10, color: '#94A3B8' },
  actRemarks: { fontSize: 12, color: '#475569', marginTop: 4 },
  actAuthor: { fontSize: 10, color: '#64748B', marginTop: 6, fontWeight: '600' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  emptyCardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  actionBtnPrimary: { backgroundColor: '#7C3AED', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 8 },
  actionBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  measureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  measureItem: { width: '48%', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10 },
  measureVal: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  photoThumb: { width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  reqRoomName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  reqThemeBadge: { fontSize: 10, fontWeight: '800', color: '#059669', backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  reqDesc: { fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 18 },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  fileIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  fileName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  fileSub: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  versionChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F1F5F9' },
  versionChipActive: { backgroundColor: '#0F172A' },
  versionChipText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  versionChipTextActive: { color: '#FFFFFF' },
  addVersionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#FFF1F2', justifyContent: 'center' },
  quoteTable: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, overflow: 'hidden' },
  quoteHeaderRow: { flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 8, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  quoteCol: { flex: 1, fontSize: 10, fontWeight: '800', color: '#64748B', uppercase: true },
  quoteRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  quoteCell: { flex: 1, fontSize: 12, color: '#334155' },
  quoteTotalsBox: { marginTop: 12, gap: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 12, color: '#64748B' },
  totalVal: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  smallActionBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  stageOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  stageOptionText: { fontSize: 13, color: '#334155' },
  label: { fontSize: 11, fontWeight: '700', color: '#64748B', uppercase: true, marginTop: 4 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#0F172A', marginBottom: 6 },
  chipOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F5F9' },
  optionChipActive: { backgroundColor: '#2563EB' },
  optionChipText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  optionChipTextActive: { color: '#FFFFFF' },
  submitBtn: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  submitBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  photoPickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', padding: 12, borderRadius: 10, justifyContent: 'center' },
  photoPickText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  quoteItemBuilderRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 6 },
  addItemText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },

  // Stage Advancement Banner
  advanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  advanceBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  advanceIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advanceBannerTitle: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  advanceBannerSub: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 1,
  },

  // Locked Phase Card
  lockedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  lockedIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  lockedSub: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  unlockActionBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  unlockActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },

  // BOQ Component Styles
  boqHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  boqNumberText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  versionTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  versionTagText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#059669',
  },
  boqDateText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 2,
  },
  editBoqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  editBoqBtnText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  newBoqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  newBoqBtnText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  costSummaryCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costRowTotal: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  costLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  costVal: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  grandTotalTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  grandTotalAmount: {
    fontSize: 16,
    fontFamily: 'Inter-Black',
    color: '#059669',
  },
  boqItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  catBadgeSmall: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catBadgeSmallText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: '#475569',
    textTransform: 'uppercase',
  },
  itemNameText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    flex: 1,
  },
  itemDescText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 2,
  },
  itemQtyRateText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
    marginTop: 3,
  },
  itemTotalText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginLeft: 8,
  },
});


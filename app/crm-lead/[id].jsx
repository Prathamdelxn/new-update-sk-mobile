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
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
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

const LEAD_SOURCES = ['Phone Call', 'Walk-in', 'Referral', 'Existing Customer', 'Builder Reference', 'Architect Reference', 'Society Reference', 'Social Media', 'Other'];
const FOLLOWUP_TYPES = ['Phone Call', 'WhatsApp', 'Meeting', 'Office Visit', 'Site Visit'];

function userLabel(u) {
  if (!u) return 'User';
  const name = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || 'User';
  return `${name}${u.role?.name || u.role ? ` (${u.role?.name || u.role})` : ''}`;
}

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
  { id: 'overview', label: 'Overview', icon: 'grid-outline' },
  { id: 'follow_ups', label: 'Follow-ups', icon: 'calendar-outline' },
  { id: 'site', label: 'Site Visits', icon: 'location-outline' },
  { id: 'requirements', label: 'Requirements', icon: 'document-text-outline' },
  { id: 'designs', label: 'Designs', icon: 'cube-outline' },
  { id: 'boq', label: 'BOQ', icon: 'calculator-outline' },
  { id: 'quotations', label: 'Quotations', icon: 'receipt-outline' },
];

export default function Lead360Screen() {
  const { id, tab } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const showFieldDetail = (title, value, actionType = null) => {
    const valText = value || 'Not specified';
    const buttons = [{ text: 'Close', style: 'cancel' }];
    if (actionType === 'phone' && value) {
      buttons.unshift(
        { text: 'Call', onPress: () => Linking.openURL(`tel:${value}`) },
        { text: 'WhatsApp', onPress: () => Linking.openURL(`https://wa.me/${value.replace(/\D/g, '')}`) }
      );
    } else if (actionType === 'email' && value) {
      buttons.unshift(
        { text: 'Send Email', onPress: () => Linking.openURL(`mailto:${value}`) }
      );
    }
    Alert.alert(title, valText, buttons);
  };

  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(tab || 'overview');
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
  const [showEditLeadSourceDropdown, setShowEditLeadSourceDropdown] = useState(false);
  const [showEditAssignDropdown, setShowEditAssignDropdown] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', mobileNumber: '', email: '', leadSource: 'Phone Call', propertyType: 'Flat', projectLocation: '', assignedSalesExecutive: '' });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);

  // Activity Modal State
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'Phone Call', remarks: '' });
  const [submittingAct, setSubmittingAct] = useState(false);

  // Follow Up Modal State
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({ type: 'Phone Call', scheduledDate: null, remarks: '', assignedSalesExecutive: '' });

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

  const isConverted = lead?.status === 'Won' || lead?.status === 'Converted' || !!lead?.linkedProject;

  const getTabLockState = (tabId) => {
    if (isConverted) return { isLocked: false, requiredStage: '', stageTitle: '', reason: '' };

    if (tabId === 'overview') {
      return { isLocked: false, requiredStage: 'New Lead', stageTitle: 'Overview', reason: '' };
    }
    if (tabId === 'follow_ups') {
      return { isLocked: false, requiredStage: 'New Lead', stageTitle: 'Follow-ups', reason: '' };
    }

    const currentStage = STAGE_ORDER[lead?.status || 'New Lead'] ?? 0;

    switch (tabId) {
      case 'site': {
        const hasCompletedFollowUp = activities.some(
          (a) => a.type !== 'System Update' && a.type !== 'Status Change' && a.type !== 'Site Visit' && a.status?.toLowerCase() === 'completed'
        );
        const isUnlocked = hasCompletedFollowUp || currentStage >= 1 || !!lead?.siteMeasurements || (lead?.sitePhotos && lead.sitePhotos.length > 0);
        return {
          isLocked: !isUnlocked,
          requiredStage: 'Under Site Visit',
          stageTitle: 'Site Visit',
          reason: hasCompletedFollowUp
            ? 'Advance lead to Site Visit to begin physical site measurements.'
            : 'Complete the initial follow-up before passing to the Site Visit stage.',
          needsFollowUp: !hasCompletedFollowUp,
        };
      }
      case 'requirements': {
        const isUnlocked = currentStage >= 2 || (lead?.requirements && lead.requirements.length > 0);
        return {
          isLocked: !isUnlocked,
          requiredStage: 'Under Requirement',
          stageTitle: 'Requirements',
          reason: 'Complete site measurements before logging detailed room specifications.',
        };
      }
      case 'designs': {
        const isUnlocked = currentStage >= 3 || (lead?.designFiles && lead.designFiles.length > 0);
        return {
          isLocked: !isUnlocked,
          requiredStage: 'Under Drawing',
          stageTitle: '2D/3D Drawing',
          reason: 'Finalize site requirements before initiating 2D/3D design drafting.',
        };
      }
      case 'boq': {
        const isUnlocked = currentStage >= 4 || (lead?.boqs && lead.boqs.length > 0);
        return {
          isLocked: !isUnlocked,
          requiredStage: 'Under BOQ Creation',
          stageTitle: 'BOQ',
          reason: 'Approval of 2D/3D drawings is required before building itemized BOQs.',
        };
      }
      case 'quotations': {
        const isUnlocked = currentStage >= 5 || (lead?.quotations && lead.quotations.length > 0);
        return {
          isLocked: !isUnlocked,
          requiredStage: 'Under Quotation',
          stageTitle: 'Quotations',
          reason: 'An estimate BOQ is required before generating final sales quotations.',
        };
      }
      default:
        return { isLocked: false, requiredStage: '', stageTitle: '', reason: '' };
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

  useEffect(() => {
    if (tab) setActiveTab(tab);
  }, [tab]);

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'Lost') {
      setShowStatusModal(false);
      setShowLostModal(true);
      return;
    }
    try {
      setLead((prev) => (prev ? { ...prev, status: newStatus } : prev));
      await interiorApiClient.patch(`/crm/customers/${id}`, { status: newStatus });
      showToast(`Lead moved to ${newStatus}`, 'success');
      setShowStatusModal(false);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to update status', 'error');
      fetchData();
    }
  };

  const handleAddActivity = async () => {
    if (!activityForm.remarks.trim()) return showToast('Remarks are required', 'error');
    setSubmittingAct(true);
    try {
      await interiorCrmService.createActivity({
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

  const handleAssignSalesExecutive = async (userId) => {
    try {
      await interiorApiClient.patch(`/crm/customers/${id}`, {
        assignedSalesExecutive: userId,
        status: lead?.status === 'New Lead' ? 'Contacted' : lead?.status,
      });
      showToast('Sales executive assigned successfully!', 'success');
      setShowAssignDropdown(false);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to assign executive', 'error');
    }
  };

  const handleCompleteFollowUp = async (actId) => {
    try {
      // Optimistic update so Done disappears immediately
      setActivities((prev) =>
        prev.map((act) => (act._id === actId ? { ...act, status: 'Completed', completedDate: new Date().toISOString() } : act))
      );
      await interiorApiClient.patch(`/crm/activities/${actId}`, {
        status: 'Completed',
        completedDate: new Date(),
      });
      showToast('Follow-up marked as completed!', 'success');
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to update follow-up', 'error');
      fetchData();
    }
  };

  const handleScheduleFollowUp = async () => {
    const followUpActs = activities.filter(
      (a) => a.type !== 'System Update' && a.type !== 'Status Change' && a.type !== 'Site Visit'
    );
    const hasPending = followUpActs.some((a) => a.status?.toLowerCase() === 'pending');
    const hasCompleted = followUpActs.some((a) => a.status?.toLowerCase() === 'completed');
    if (hasPending) {
      return showToast('A follow-up is already scheduled. Mark it as done before creating another.', 'error');
    }
    if (hasCompleted) {
      return showToast('Follow-up is already completed for this lead.', 'info');
    }
    if (!followUpForm.remarks.trim()) return showToast('Notes are required', 'error');
    setSubmittingAct(true);
    try {
      await interiorApiClient.post('/crm/activities', {
        customer: id,
        type: followUpForm.type,
        status: 'Pending',
        scheduledDate: followUpForm.scheduledDate ? followUpForm.scheduledDate.toISOString() : new Date().toISOString(),
        remarks: followUpForm.remarks.trim(),
      });
      if (followUpForm.assignedSalesExecutive) {
        await interiorApiClient.patch(`/crm/customers/${id}`, {
          assignedSalesExecutive: followUpForm.assignedSalesExecutive,
          status: lead?.status === 'New Lead' ? 'Contacted' : lead?.status,
        });
      }
      showToast('Follow-up scheduled successfully!', 'success');
      setShowFollowUpModal(false);
      setFollowUpForm({ type: 'Phone Call', scheduledDate: null, remarks: '', assignedSalesExecutive: '' });
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
    if (quoteItems.length === 0 || !quoteItems[0].description.trim()) {
      return showToast('At least one item with a description is required', 'error');
    }
    setSubmittingAct(true);
    try {
      const formattedItems = quoteItems.map((i) => {
        const qty = parseFloat(i.quantity) || 1;
        const price = parseFloat(i.unitPrice) || 0;
        return { description: i.description, quantity: qty, unitPrice: price, total: qty * price };
      });

      const subtotal = formattedItems.reduce((sum, item) => sum + item.total, 0);
      const taxRate = parseFloat(quoteTax) || 0;
      const tax = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
      const discount = parseFloat(quoteDiscount) || 0;
      const grandTotal = Math.max(0, Math.round((subtotal + tax - discount) * 100) / 100);

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

      const updatedQuotations = [...existingQuotations, newQuote];

      // Optimistic update
      setLead((prev) => (prev ? { ...prev, quotations: updatedQuotations, status: 'Quotation Sent' } : prev));

      await interiorApiClient.patch(`/crm/customers/${id}`, {
        quotations: updatedQuotations,
        status: 'Quotation Sent',
      });

      await interiorApiClient.post('/crm/activities', {
        customer: id,
        type: 'Status Change',
        status: 'Completed',
        remarks: `Quotation v${newQuote.version} created (₹${grandTotal.toLocaleString('en-IN')}).`,
      });

      showToast('Quotation generated successfully!', 'success');
      setShowQuoteModal(false);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to create quotation', 'error');
      fetchData();
    } finally {
      setSubmittingAct(false);
    }
  };

  const handleQuoteStatus = async (quoteIndex, status) => {
    try {
      const updatedQuotations = [...(lead?.quotations || [])];
      if (updatedQuotations[quoteIndex]) {
        updatedQuotations[quoteIndex] = {
          ...updatedQuotations[quoteIndex],
          status: status,
        };
      }
      let nextStatus = lead.status;
      if (status === 'Accepted') nextStatus = 'Booking Pending';
      if (status === 'Rejected') nextStatus = 'Lost';

      // Optimistic update so UI immediately renders the updated status without delay
      setLead((prev) => (prev ? {
        ...prev,
        quotations: updatedQuotations,
        status: nextStatus,
      } : prev));

      await interiorApiClient.patch(`/crm/customers/${id}`, {
        quotations: updatedQuotations,
        status: nextStatus,
      });

      await interiorApiClient.post('/crm/activities', {
        customer: id,
        type: 'Status Change',
        status: 'Completed',
        remarks: `Quotation v${updatedQuotations[quoteIndex]?.version || (quoteIndex + 1)} marked as ${status}.`,
      });

      showToast(`Quotation marked as ${status}!`, 'success');
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to update quote status', 'error');
      fetchData();
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
    const currExecId = typeof lead?.assignedSalesExecutive === 'object'
      ? (lead?.assignedSalesExecutive?._id || '')
      : (lead?.assignedSalesExecutive || '');
    setEditForm({
      name: lead?.name || '',
      mobileNumber: lead?.mobileNumber || '',
      email: lead?.email || '',
      leadSource: lead?.leadSource || 'Phone Call',
      propertyType: lead?.propertyType || 'Flat',
      projectLocation: lead?.projectLocation || '',
      assignedSalesExecutive: currExecId,
    });
    setShowEditLeadSourceDropdown(false);
    setShowEditAssignDropdown(false);
    setShowEditModal(true);
  };

  const handleEditSubmit = async () => {
    if (!editForm.name.trim() || !editForm.mobileNumber.trim()) {
      showToast('Name and Mobile Number are required', 'error');
      return;
    }
    setSubmittingEdit(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        mobileNumber: editForm.mobileNumber.trim(),
        email: editForm.email.trim(),
        leadSource: editForm.leadSource,
        propertyType: editForm.propertyType,
        projectLocation: editForm.projectLocation.trim(),
      };
      if (editForm.assignedSalesExecutive) {
        payload.assignedSalesExecutive = editForm.assignedSalesExecutive;
      }
      await interiorApiClient.patch(`/crm/customers/${id}`, payload);
      showToast('Lead updated successfully!', 'success');
      setShowEditLeadSourceDropdown(false);
      setShowEditAssignDropdown(false);
      setShowEditModal(false);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to update lead', 'error');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const openQuoteModal = () => {
    if (!quoteItems || quoteItems.length === 0) {
      setQuoteItems([{ description: '', quantity: '1', unitPrice: '' }]);
    }
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
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />

      {/* --- HERO HEADER (Compact & Centered) --- */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color="#1E293B" />
          </TouchableOpacity>
        </View>

        <View style={s.headerLeadInfoCenter}>
          <Text style={s.headerGreeting} numberOfLines={1}>CRM Workspace / Lead</Text>
          <View style={s.headerTitleRow}>
            <Text style={s.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              {lead.name}
            </Text>
            <View style={s.leadIdBadge}>
              <Text style={s.leadIdText}>{lead.leadNumber || 'LD-XXXX'}</Text>
            </View>
          </View>
          <View style={s.headerPhoneRow}>
            <Ionicons name="call" size={11} color="#1D4ED8" />
            <Text style={s.headerSub} numberOfLines={1}>{lead.mobileNumber || 'No Phone'}</Text>
          </View>
        </View>

      </View>


      {/* Lost Lead Alert Banner */}
      {lead.status === 'Lost' && (
        <View style={s.lostAlertBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View style={s.lostAlertIconBox}>
              <Ionicons name="close-circle" size={22} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.lostAlertTitle}>This Deal is Marked as Lost</Text>
              <Text style={s.lostAlertReason}>
                {lead.lostReason ? `Reason: ${lead.lostReason}` : 'No reason recorded for this lost deal.'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.reopenLeadBtn}
            onPress={() => setShowStatusModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={13} color="#2563EB" />
            <Text style={s.reopenLeadBtnText}>Reactivate</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor="#2563EB" />}
      >
        {/* --- TAB NAVIGATION --- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            const lock = getTabLockState(t.id);
            return (
              <TouchableOpacity
                key={t.id}
                style={[s.tabItem, active && s.tabItemActive]}
                activeOpacity={0.7}
                onPress={() => {
                  if (lock.isLocked) {
                    showToast(`Complete previous stages to unlock ${t.label}.`, 'info');
                  }
                  setActiveTab(t.id);
                }}
              >
                {lock.isLocked ? (
                  <Ionicons name="lock-closed" size={12} color="#94A3B8" />
                ) : (
                  <Ionicons name={t.icon} size={13} color={active ? '#2563EB' : '#64748B'} />
                )}
                <Text style={[s.tabText, active && s.tabTextActive, lock.isLocked && { color: '#94A3B8' }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* --- TAB CONTENT --- */}
        <View style={s.tabContent}>
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <View style={{ gap: 14 }}>
              {/* Overview Section Header with Edit Button & Mark Lost */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: '#334155', letterSpacing: 0.3 }}>
                  LEAD DETAILS
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {lead.status !== 'Lost' && lead.status !== 'Won' && lead.status !== 'Converted' && (
                    <TouchableOpacity
                      style={[s.editLeadBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
                      onPress={() => setShowLostModal(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle-outline" size={13} color="#DC2626" />
                      <Text style={[s.editLeadBtnText, { color: '#DC2626' }]}>Mark Lost</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={s.editLeadBtn}
                    onPress={openEditModal}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pencil" size={13} color="#2563EB" />
                    <Text style={s.editLeadBtnText}>Edit Details</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ gap: 10 }}>
                {/* Row 1: Mobile Number & Client Source side-by-side */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[s.metricCard, { flex: 1 }]}
                    activeOpacity={0.7}
                    onPress={() => showFieldDetail('Mobile Number', lead.mobileNumber, 'phone')}
                  >
                    <View style={s.metricHeader}>
                      <Text style={s.metricLabel}>MOBILE NUMBER</Text>
                      <Ionicons name="call-outline" size={13} color="#64748B" />
                    </View>
                    <Text style={s.metricVal} numberOfLines={1}>{lead.mobileNumber || 'Not specified'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.metricCard, { flex: 1 }]}
                    activeOpacity={0.7}
                    onPress={() => showFieldDetail('Client Source', lead.leadSource)}
                  >
                    <View style={s.metricHeader}>
                      <Text style={s.metricLabel}>CLIENT SOURCE</Text>
                      <Ionicons name="pricetag-outline" size={13} color="#64748B" />
                    </View>
                    <Text style={s.metricVal} numberOfLines={1}>{lead.leadSource || 'Manual Entry'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Row 2: Property Scope & Location side-by-side */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[s.metricCard, { flex: 1 }]}
                    activeOpacity={0.7}
                    onPress={() => showFieldDetail('Property Scope', lead.propertyType)}
                  >
                    <View style={s.metricHeader}>
                      <Text style={s.metricLabel}>PROPERTY SCOPE</Text>
                      <Ionicons name="business-outline" size={13} color="#64748B" />
                    </View>
                    <Text style={s.metricVal} numberOfLines={1}>{lead.propertyType || 'Not specified'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.metricCard, { flex: 1 }]}
                    activeOpacity={0.7}
                    onPress={() => showFieldDetail('Project Location', lead.projectLocation || lead.city)}
                  >
                    <View style={s.metricHeader}>
                      <Text style={s.metricLabel}>LOCATION</Text>
                      <Ionicons name="location-outline" size={13} color="#64748B" />
                    </View>
                    <Text style={s.metricVal} numberOfLines={1}>{lead.projectLocation || lead.city || 'Not specified'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Row 3: Email Address full width */}
                <TouchableOpacity
                  style={s.metricCardFull}
                  activeOpacity={0.7}
                  onPress={() => showFieldDetail('Email Address', lead.email, 'email')}
                >
                  <View style={s.metricHeader}>
                    <Text style={s.metricLabel}>EMAIL ADDRESS</Text>
                    <Ionicons name="mail-outline" size={13} color="#64748B" />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={[s.metricVal, { flex: 1 }]} numberOfLines={2}>
                      {lead.email || 'Not specified'}
                    </Text>
                    {!!lead.email && (
                      <View style={s.quickActionPill}>
                        <Ionicons name="send-outline" size={11} color="#2563EB" />
                        <Text style={s.quickActionPillText}>Send</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
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

          {/* 2. FOLLOW-UPS TAB (Web Flow: Exactly 1 Active Follow-up Until Done) */}
          {activeTab === 'follow_ups' && (
            <View style={{ gap: 16 }}>
              {(() => {
                const followUpActs = activities.filter(
                  (a) => a.type !== 'System Update' && a.type !== 'Status Change' && a.type !== 'Site Visit'
                );
                // In Web flow: Exactly 1 pending follow-up is active until it is marked as done
                const activePendingFollowUp = followUpActs.find((a) => a.status?.toLowerCase() === 'pending');
                const completedFollowUps = followUpActs.filter((a) => a.status?.toLowerCase() === 'completed');

                return (
                  <>
                    {/* Action Buttons Row */}
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {activePendingFollowUp ? (
                          <TouchableOpacity
                            style={[s.saveBtn, { flex: 1, marginTop: 0, marginBottom: 0, backgroundColor: '#16A34A', paddingVertical: 12 }]}
                            onPress={() => handleCompleteFollowUp(activePendingFollowUp._id)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                            <Text style={s.saveBtnText}>Mark Done</Text>
                          </TouchableOpacity>
                        ) : completedFollowUps.length === 0 ? (
                          <TouchableOpacity
                            style={[s.saveBtn, { flex: 1, marginTop: 0, marginBottom: 0, backgroundColor: '#2563EB', paddingVertical: 12 }]}
                            onPress={() => setShowFollowUpModal(true)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="calendar-outline" size={15} color="#FFFFFF" />
                            <Text style={s.saveBtnText}>Schedule Follow-up</Text>
                          </TouchableOpacity>
                        ) : null}

                        {['New Lead', 'Contacted', 'Meeting Scheduled'].includes(lead.status) && (
                          <TouchableOpacity
                            style={[
                              s.saveBtn,
                              { flex: 1, marginTop: 0, marginBottom: 0, backgroundColor: '#7C3AED', paddingVertical: 12 },
                              completedFollowUps.length === 0 && { opacity: 0.6 }
                            ]}
                            onPress={() => {
                              if (completedFollowUps.length === 0) {
                                Alert.alert(
                                  'Follow-up Required',
                                  'Please complete the follow-up before passing to the Site Visit stage.'
                                );
                                return;
                              }
                              setShowSendSiteModal(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="location-outline" size={15} color="#FFFFFF" />
                            <Text style={s.saveBtnText}>Pass to Site Visit</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {lead.status !== 'Lost' && lead.status !== 'Won' && lead.status !== 'Converted' && (
                        <TouchableOpacity
                          style={s.stageLostActionBtn}
                          onPress={() => setShowLostModal(true)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                          <Text style={s.stageLostActionBtnText}>Mark as Lost</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Active Scheduled Follow-up Card (1 Active Follow-up Until Done) */}
                    {activePendingFollowUp && (
                      <View style={[s.card, { borderColor: '#FDE68A', backgroundColor: '#FFFDF5' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#D97706' }} />
                            <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: '#92400E' }}>
                              Current Active Follow-up
                            </Text>
                          </View>
                          <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
                            <Text style={{ fontSize: 10, fontFamily: 'Inter-Bold', color: '#B45309', textTransform: 'uppercase' }}>
                              Pending
                            </Text>
                          </View>
                        </View>

                        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FEF08A', gap: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                              <View style={[s.actionIconBox, { backgroundColor: '#FFFBEB' }]}>
                                <Ionicons
                                  name={activePendingFollowUp.type === 'WhatsApp' ? 'logo-whatsapp' : activePendingFollowUp.type === 'Meeting' ? 'people-outline' : 'call-outline'}
                                  size={16}
                                  color="#D97706"
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' }}>
                                  {activePendingFollowUp.type || 'Touchpoint'}
                                </Text>
                                <Text style={{ fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' }}>
                                  Due: {activePendingFollowUp.scheduledDate
                                    ? new Date(activePendingFollowUp.scheduledDate).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                                    : 'Not set'}
                                </Text>
                              </View>
                            </View>

                            <TouchableOpacity
                              style={{ backgroundColor: '#16A34A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                              onPress={() => handleCompleteFollowUp(activePendingFollowUp._id)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                              <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontFamily: 'Inter-Bold' }}>Done</Text>
                            </TouchableOpacity>
                          </View>

                          {!!activePendingFollowUp.remarks && (
                            <Text style={{ fontSize: 12, fontFamily: 'Inter-Regular', color: '#475569', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#F1F5F9' }}>
                              &quot;{activePendingFollowUp.remarks}&quot;
                            </Text>
                          )}

                          {/* Quick Outreach Links */}
                          {!!lead.mobileNumber && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 2 }}>
                              <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
                                onPress={() => Linking.openURL(`tel:${lead.mobileNumber}`)}
                              >
                                <Ionicons name="call" size={12} color="#2563EB" />
                                <Text style={{ fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB' }}>Call</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
                                onPress={() => Linking.openURL(`https://wa.me/${lead.mobileNumber.replace(/\D/g, '')}`)}
                              >
                                <Ionicons name="logo-whatsapp" size={12} color="#16A34A" />
                                <Text style={{ fontSize: 11, fontFamily: 'Inter-Bold', color: '#16A34A' }}>WhatsApp</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Follow-up Touchpoints / Completed History */}
                    <View style={s.card}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Ionicons name="time-outline" size={18} color="#2563EB" />
                          <Text style={{ fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' }}>
                            Follow-up History ({completedFollowUps.length})
                          </Text>
                        </View>
                        {completedFollowUps.length === 0 && !activePendingFollowUp && (
                          <TouchableOpacity style={s.smallBtn} onPress={() => setShowFollowUpModal(true)}>
                            <Ionicons name="add" size={14} color="#2563EB" />
                            <Text style={s.smallBtnText}>Schedule</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {completedFollowUps.length === 0 && !activePendingFollowUp ? (
                        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
                          <Ionicons name="calendar-clear-outline" size={36} color="#CBD5E1" />
                          <Text style={s.emptySubText}>No follow-ups logged yet.</Text>
                          <TouchableOpacity
                            style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
                            onPress={() => setShowFollowUpModal(true)}
                          >
                            <Text style={{ color: '#2563EB', fontSize: 12, fontFamily: 'Inter-Bold' }}>+ Schedule First Follow-up</Text>
                          </TouchableOpacity>
                        </View>
                      ) : completedFollowUps.length === 0 && activePendingFollowUp ? (
                        <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 }}>
                          Current follow-up is pending above. Tap &quot;Done&quot; once completed.
                        </Text>
                      ) : (
                        completedFollowUps.map((act) => {
                          const actDate = act.completedDate || act.updatedAt || act.scheduledDate || act.createdAt;
                          return (
                            <View key={act._id} style={s.followUpCard}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                  <View style={[s.actionIconBox, { backgroundColor: '#F0FDF4' }]}>
                                    <Ionicons
                                      name={act.type === 'WhatsApp' ? 'logo-whatsapp' : act.type === 'Meeting' ? 'people-outline' : 'call-outline'}
                                      size={16}
                                      color="#16A34A"
                                    />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' }}>{act.type || 'Touchpoint'}</Text>
                                    <Text style={{ fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B' }}>
                                      {new Date(actDate).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </Text>
                                  </View>
                                </View>
                                <View style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 6,
                                  backgroundColor: '#F0FDF4',
                                  borderWidth: 1,
                                  borderColor: '#BBF7D0',
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 3,
                                }}>
                                  <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                                  <Text style={{
                                    fontSize: 10,
                                    fontFamily: 'Inter-Bold',
                                    color: '#16A34A',
                                    textTransform: 'uppercase',
                                  }}>
                                    Completed
                                  </Text>
                                </View>
                              </View>

                              {!!act.remarks && (
                                <Text style={{ fontSize: 12, fontFamily: 'Inter-Regular', color: '#475569', marginTop: 8, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                  &quot;{act.remarks}&quot;
                                </Text>
                              )}
                            </View>
                          );
                        })
                      )}
                    </View>
                  </>
                );
              })()}
            </View>
          )}

          {/* 3. SITE VISITS TAB */}
          {activeTab === 'site' && (
            <View style={{ gap: 16 }}>
              {(() => {
                const lock = getTabLockState('site');
                if (lock.isLocked) {
                  return (
                    <View style={s.lockedCard}>
                      <View style={[s.lockedIconBox, { backgroundColor: lock.isUnassigned ? '#EFF6FF' : '#F3E8FF' }]}>
                        <Ionicons name="lock-closed" size={24} color={lock.isUnassigned ? '#2563EB' : '#7C3AED'} />
                      </View>
                      <Text style={s.lockedTitle}>{lock.isUnassigned ? 'Lead Assignment Required' : 'Site Visit Phase Locked'}</Text>
                      <Text style={s.lockedSub}>{lock.reason || `Advance the lead from "${lead.status}" to begin physical site measurements.`}</Text>
                      {lock.isUnassigned ? (
                        <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#2563EB' }]} onPress={() => setActiveTab('follow_ups')}>
                          <Ionicons name="person-add-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={s.unlockActionBtnText}>Go to Follow-ups & Assign</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[s.unlockActionBtn, { backgroundColor: '#7C3AED' }]}
                          onPress={() => {
                            const hasCompletedFollowUp = activities.some(
                              (a) => a.type !== 'System Update' && a.type !== 'Status Change' && a.type !== 'Site Visit' && a.status?.toLowerCase() === 'completed'
                            );
                            if (!hasCompletedFollowUp) {
                              Alert.alert('Follow-up Required', 'Please complete the follow-up before passing to the Site Visit stage.');
                              setActiveTab('follow_ups');
                              return;
                            }
                            setShowSendSiteModal(true);
                          }}
                        >
                          <Text style={s.unlockActionBtnText}>Pass to Site Visit</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }

                if (!lead.siteMeasurements) {
                  return (
                    <View style={s.emptyCard}>
                      <Ionicons name="location-outline" size={40} color="#7C3AED" />
                      <Text style={s.emptyCardTitle}>No Site Measurements</Text>
                      <Text style={s.emptySubText}>Capture area, height, and site photos.</Text>
                      <TouchableOpacity style={s.actionBtnPrimary} onPress={() => setShowSiteModal(true)}>
                        <Text style={s.actionBtnText}>Log Site Visit</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
                  <View style={{ gap: 16 }}>
                    {/* 1. ROOM & SPATIAL DIMENSIONS */}
                    <View style={s.card}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                          <View style={[s.actionIconBox, { backgroundColor: '#F3E8FF', width: 32, height: 32, borderRadius: 8 }]}>
                            <Ionicons name="pencil-outline" size={16} color="#7C3AED" />
                          </View>
                          <Text style={s.cardTitle} numberOfLines={1}>Room & Spatial Dimensions</Text>
                        </View>
                        <TouchableOpacity style={s.smallBtn} onPress={() => setShowSiteModal(true)}>
                          <Ionicons name="create-outline" size={14} color="#2563EB" />
                          <Text style={s.smallBtnText}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                      
                      {/* Metric Row: Carpet Area & Ceiling Height */}
                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                        <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                          <Text style={s.metricLabel}>Carpet Area</Text>
                          <Text style={s.measureVal}>{lead.siteMeasurements.carpetArea ? `${lead.siteMeasurements.carpetArea} Sq.Ft` : 'N/A'}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                          <Text style={s.metricLabel}>Ceiling Height</Text>
                          <Text style={s.measureVal}>{lead.siteMeasurements.ceilingHeight ? `${lead.siteMeasurements.ceilingHeight} Ft` : 'N/A'}</Text>
                        </View>
                      </View>

                      {/* Floor-to-Ceiling Height */}
                      {!!lead.siteMeasurements.floorToCeilingHeight && (
                        <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 10 }}>
                          <Text style={s.metricLabel}>Floor-to-Ceiling Height</Text>
                          <Text style={s.measureVal}>{lead.siteMeasurements.floorToCeilingHeight} Ft</Text>
                        </View>
                      )}

                      {/* Rooms to Design */}
                      {!!lead.siteMeasurements.rooms && (
                        <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 10 }}>
                          <Text style={s.metricLabel}>Rooms to Design</Text>
                          <Text style={[s.measureVal, { fontSize: 13, marginTop: 2 }]}>{lead.siteMeasurements.rooms}</Text>
                        </View>
                      )}

                      {/* Room Length × Width */}
                      {!!lead.siteMeasurements.roomDimensions && (
                        <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                          <Text style={s.metricLabel}>Room Length × Width</Text>
                          <Text style={[s.measureVal, { fontSize: 13, marginTop: 2 }]}>{lead.siteMeasurements.roomDimensions}</Text>
                        </View>
                      )}
                    </View>

                    {/* 2. OPENINGS & STRUCTURAL ELEMENTS */}
                    {(!!lead.siteMeasurements.doorDimensions || !!lead.siteMeasurements.windowDimensions || !!lead.siteMeasurements.wallThickness || !!lead.siteMeasurements.columnBeamDimensions) && (
                      <View style={s.card}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <View style={[s.actionIconBox, { backgroundColor: '#EEF2FF', width: 32, height: 32, borderRadius: 8 }]}>
                            <Ionicons name="construct-outline" size={16} color="#4F46E5" />
                          </View>
                          <Text style={s.cardTitle}>Openings & Structural Elements</Text>
                        </View>

                        <View style={{ gap: 10 }}>
                          {(!!lead.siteMeasurements.doorDimensions || !!lead.siteMeasurements.windowDimensions) && (
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                              {!!lead.siteMeasurements.doorDimensions && (
                                <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                  <Text style={s.metricLabel}>Door Dimensions</Text>
                                  <Text style={[s.measureVal, { fontSize: 13, marginTop: 2 }]}>{lead.siteMeasurements.doorDimensions}</Text>
                                </View>
                              )}
                              {!!lead.siteMeasurements.windowDimensions && (
                                <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                  <Text style={s.metricLabel}>Window Dimensions</Text>
                                  <Text style={[s.measureVal, { fontSize: 13, marginTop: 2 }]}>{lead.siteMeasurements.windowDimensions}</Text>
                                </View>
                              )}
                            </View>
                          )}
                          {!!lead.siteMeasurements.wallThickness && (
                            <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                              <Text style={s.metricLabel}>Wall Thickness</Text>
                              <Text style={[s.measureVal, { fontSize: 13, marginTop: 2 }]}>{lead.siteMeasurements.wallThickness}</Text>
                            </View>
                          )}
                          {!!lead.siteMeasurements.columnBeamDimensions && (
                            <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                              <Text style={s.metricLabel}>Column & Beam Dimensions</Text>
                              <Text style={[s.measureVal, { fontSize: 13, marginTop: 2 }]}>{lead.siteMeasurements.columnBeamDimensions}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* 3. MEP & SERVICES (ELECTRICAL, PLUMBING, AC) */}
                    {(!!lead.siteMeasurements.electricalPoints || !!lead.siteMeasurements.plumbingPoints || !!lead.siteMeasurements.acLocations) && (
                      <View style={s.card}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <View style={[s.actionIconBox, { backgroundColor: '#FEF3C7', width: 32, height: 32, borderRadius: 8 }]}>
                            <Ionicons name="flash-outline" size={16} color="#D97706" />
                          </View>
                          <Text style={s.cardTitle}>MEP & Services</Text>
                        </View>

                        <View style={{ gap: 10 }}>
                          {!!lead.siteMeasurements.electricalPoints && (
                            <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                              <Text style={s.metricLabel}>Existing Electrical Points</Text>
                              <Text style={[s.measureVal, { fontSize: 13, marginTop: 2 }]}>{lead.siteMeasurements.electricalPoints}</Text>
                            </View>
                          )}
                          {!!lead.siteMeasurements.plumbingPoints && (
                            <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                              <Text style={s.metricLabel}>Plumbing Points</Text>
                              <Text style={[s.measureVal, { fontSize: 13, marginTop: 2 }]}>{lead.siteMeasurements.plumbingPoints}</Text>
                            </View>
                          )}
                          {!!lead.siteMeasurements.acLocations && (
                            <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                              <Text style={s.metricLabel}>AC Locations & Piping</Text>
                              <Text style={[s.measureVal, { fontSize: 13, marginTop: 2 }]}>{lead.siteMeasurements.acLocations}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* 3. EXISTING FURNITURE & SITE CONSTRAINTS */}
                    {(!!lead.siteMeasurements.furnitureDimensions || !!lead.siteMeasurements.siteConstraints || !!lead.siteMeasurements.notes) && (
                      <View style={s.card}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <View style={[s.actionIconBox, { backgroundColor: '#ECFDF5', width: 32, height: 32, borderRadius: 8 }]}>
                            <Ionicons name="cube-outline" size={16} color="#059669" />
                          </View>
                          <Text style={s.cardTitle}>Existing Furniture & Site Constraints</Text>
                        </View>

                        <View style={{ gap: 10 }}>
                          {!!lead.siteMeasurements.furnitureDimensions && (
                            <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                              <Text style={s.metricLabel}>Existing Furniture Dimensions</Text>
                              <Text style={[s.measureVal, { fontSize: 13, marginTop: 2 }]}>{lead.siteMeasurements.furnitureDimensions}</Text>
                            </View>
                          )}
                          {!!lead.siteMeasurements.siteConstraints && (
                            <View style={{ backgroundColor: '#FEF2F2', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#FEE2E2' }}>
                              <Text style={[s.metricLabel, { color: '#DC2626' }]}>Any Site Constraints / Society Rules</Text>
                              <Text style={[s.measureVal, { fontSize: 13, color: '#991B1B', marginTop: 2 }]}>{lead.siteMeasurements.siteConstraints}</Text>
                            </View>
                          )}
                          {!!lead.siteMeasurements.notes && (
                            <View style={{ backgroundColor: '#F3E8FF', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E9D5FF' }}>
                              <Text style={[s.metricLabel, { color: '#7C3AED' }]}>Additional Site Notes / Observations</Text>
                              <Text style={[s.measureVal, { fontSize: 13, color: '#4C1D95', marginTop: 2 }]}>{lead.siteMeasurements.notes}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* 4. SITE PHOTOS */}
                    <View style={s.card}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, marginRight: 8 }}>
                          <View style={[s.actionIconBox, { backgroundColor: '#ECFDF5', width: 32, height: 32, borderRadius: 8, flexShrink: 0 }]}>
                            <Ionicons name="images-outline" size={16} color="#059669" />
                          </View>
                          <Text style={s.cardTitle} numberOfLines={1}>Site Photos ({lead.sitePhotos?.length || 0})</Text>
                        </View>
                        <TouchableOpacity style={[s.smallBtn, { flexShrink: 0 }]} onPress={() => setShowSiteModal(true)}>
                          <Ionicons name="camera-outline" size={14} color="#2563EB" />
                          <Text style={s.smallBtnText}>Manage</Text>
                        </TouchableOpacity>
                      </View>
                      {lead.sitePhotos && lead.sitePhotos.length > 0 ? (
                        <View style={s.photoGrid}>
                          {lead.sitePhotos.map((photo, i) => (
                            <Image key={i} source={{ uri: photo }} style={s.photoThumb} />
                          ))}
                        </View>
                      ) : (
                        <Text style={s.emptySubText}>No site photos attached yet.</Text>
                      )}
                    </View>
                    
                    <View style={{ gap: 8, marginTop: 4 }}>
                      {lead.status === 'Under Site Visit' && (
                        <TouchableOpacity style={[s.actionBtnPrimary, { backgroundColor: '#7C3AED', marginTop: 0 }]} onPress={() => setShowSendReqModal(true)}>
                          <Text style={s.actionBtnText}>Complete Phase & Pass to Requirements</Text>
                        </TouchableOpacity>
                      )}
                      {lead.status !== 'Lost' && lead.status !== 'Won' && lead.status !== 'Converted' && (
                        <TouchableOpacity
                          style={s.stageLostActionBtn}
                          onPress={() => setShowLostModal(true)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                          <Text style={s.stageLostActionBtnText}>Mark as Lost</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
            })()}
          </View>
        )}

          {/* 3. REQUIREMENTS TAB */}
          {activeTab === 'requirements' && (
            <View style={{ gap: 16 }}>
              {(() => {
                const lock = getTabLockState('requirements');
                if (lock.isLocked) {
                  return (
                    <View style={s.lockedCard}>
                      <View style={[s.lockedIconBox, { backgroundColor: lock.isUnassigned ? '#EFF6FF' : '#EEF2FF' }]}>
                        <Ionicons name="lock-closed" size={24} color={lock.isUnassigned ? '#2563EB' : '#4F46E5'} />
                      </View>
                      <Text style={s.lockedTitle}>{lock.isUnassigned ? 'Lead Assignment Required' : 'Requirements Phase Locked'}</Text>
                      <Text style={s.lockedSub}>{lock.reason || 'Complete site measurements before logging detailed room specifications.'}</Text>
                      {lock.isUnassigned ? (
                        <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#2563EB' }]} onPress={() => setActiveTab('follow_ups')}>
                          <Ionicons name="person-add-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={s.unlockActionBtnText}>Go to Follow-ups & Assign</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#4F46E5' }]} onPress={() => setShowSendReqModal(true)}>
                          <Text style={s.unlockActionBtnText}>Pass to Requirements</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }

                if (!lead.requirements || lead.requirements.length === 0) {
                  return (
                    <View style={s.emptyCard}>
                      <Ionicons name="create-outline" size={40} color="#059669" />
                      <Text style={s.emptyCardTitle}>No Requirements Recorded</Text>
                      <Text style={s.emptySubText}>Add room-by-room themes and specifications.</Text>
                      <TouchableOpacity style={[s.actionBtnPrimary, { backgroundColor: '#059669' }]} onPress={() => setShowReqModal(true)}>
                        <Text style={s.actionBtnText}>Log Requirement</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
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
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                        <Text style={s.reqRoomName}>{req.roomName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {req.interiorType && (
                            <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#DBEAFE' }}>
                              <Text style={{ fontSize: 10, fontFamily: 'Inter-Bold', color: '#2563EB' }}>{req.interiorType}</Text>
                            </View>
                          )}
                          {(req.designStyle || req.theme) && (
                            <Text style={s.reqThemeBadge}>{req.designStyle || req.theme}</Text>
                          )}
                        </View>
                      </View>
                      
                      {/* Functional Details */}
                      {(req.roomUsage || req.furnitureRequirements || req.storage || req.electricalPoints || req.lightingRequirements || req.plumbingRequirements || req.circulation) && (
                        <View style={{ marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB', marginBottom: 6 }}>FUNCTIONAL REQUIREMENTS</Text>
                          {req.roomUsage && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Usage:</Text> {req.roomUsage}</Text>}
                          {req.furnitureRequirements && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Furniture:</Text> {req.furnitureRequirements}</Text>}
                          {req.storage && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Storage:</Text> {req.storage}</Text>}
                          {req.electricalPoints && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Electrical:</Text> {req.electricalPoints}</Text>}
                          {req.lightingRequirements && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Lighting:</Text> {req.lightingRequirements}</Text>}
                          {req.plumbingRequirements && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Plumbing:</Text> {req.plumbingRequirements}</Text>}
                          {req.circulation && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Circulation:</Text> {req.circulation}</Text>}
                        </View>
                      )}

                      {/* Aesthetic Details */}
                      {(req.designStyle || req.colours || req.materials || req.flooring || req.ceiling || req.wallFinishes || req.furnitureStyle) && (
                        <View style={{ marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter-Bold', color: '#7C3AED', marginBottom: 6 }}>AESTHETIC REQUIREMENTS</Text>
                          {req.designStyle && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Style:</Text> {req.designStyle}</Text>}
                          {req.colours && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Colors:</Text> {req.colours}</Text>}
                          {req.materials && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Materials:</Text> {req.materials}</Text>}
                          {req.flooring && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Flooring:</Text> {req.flooring}</Text>}
                          {req.ceiling && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Ceiling:</Text> {req.ceiling}</Text>}
                          {req.wallFinishes && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Walls:</Text> {req.wallFinishes}</Text>}
                          {req.furnitureStyle && <Text style={s.measureVal}><Text style={{fontWeight: '600'}}>Furniture Style:</Text> {req.furnitureStyle}</Text>}
                        </View>
                      )}

                      {/* Observations & Notes */}
                      {req.description && (
                        <View style={{ marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter-Bold', color: '#059669', marginBottom: 4 }}>OBSERVATIONS & NOTES</Text>
                          <Text style={[s.measureVal, { color: '#334155' }]}>{req.description}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                  
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {lead.status === 'Under Requirement' && (
                      <TouchableOpacity style={[s.actionBtnPrimary, { backgroundColor: '#4F46E5', marginTop: 0 }]} onPress={() => setShowSendDrawingModal(true)}>
                        <Text style={s.actionBtnText}>Complete Phase & Pass to Drawing</Text>
                      </TouchableOpacity>
                    )}
                    {lead.status !== 'Lost' && lead.status !== 'Won' && lead.status !== 'Converted' && (
                      <TouchableOpacity
                        style={s.stageLostActionBtn}
                        onPress={() => setShowLostModal(true)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                        <Text style={s.stageLostActionBtnText}>Mark as Lost</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })()}
          </View>
        )}

          {/* 4. DESIGNS & FILES TAB */}
          {activeTab === 'designs' && (
            <View style={{ gap: 16 }}>
              {(() => {
                const lock = getTabLockState('designs');
                if (lock.isLocked) {
                  return (
                    <View style={s.lockedCard}>
                      <View style={[s.lockedIconBox, { backgroundColor: lock.isUnassigned ? '#EFF6FF' : '#F0F9FF' }]}>
                        <Ionicons name="lock-closed" size={24} color={lock.isUnassigned ? '#2563EB' : '#0284C7'} />
                      </View>
                      <Text style={s.lockedTitle}>{lock.isUnassigned ? 'Lead Assignment Required' : 'Drawing & Design Phase Locked'}</Text>
                      <Text style={s.lockedSub}>{lock.reason || 'Finalize site requirements before initiating 2D/3D design drafting.'}</Text>
                      {lock.isUnassigned ? (
                        <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#2563EB' }]} onPress={() => setActiveTab('follow_ups')}>
                          <Ionicons name="person-add-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={s.unlockActionBtnText}>Go to Follow-ups & Assign</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#0284C7' }]} onPress={() => setShowSendDrawingModal(true)}>
                          <Text style={s.unlockActionBtnText}>Pass to Drawing</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }

                if (!lead.designFiles || lead.designFiles.length === 0) {
                  return (
                    <View style={s.emptyCard}>
                      <Ionicons name="cloud-upload-outline" size={40} color="#2563EB" />
                      <Text style={s.emptyCardTitle}>No Designs Uploaded</Text>
                      <Text style={s.emptySubText}>Attach 2D/3D design renders and files.</Text>
                      <TouchableOpacity style={s.actionBtnPrimary} onPress={() => setShowDesignModal(true)}>
                        <Text style={s.actionBtnText}>Upload Design File</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
                  <View style={{ gap: 12 }}>
                    <TouchableOpacity style={[s.smallBtn, { alignSelf: 'flex-end' }]} onPress={() => setShowDesignModal(true)}>
                      <Ionicons name="add" size={14} color="#2563EB" />
                      <Text style={s.smallBtnText}>Upload File</Text>
                    </TouchableOpacity>
                    {lead.designFiles.map((file, idx) => (
                      <TouchableOpacity key={idx} style={[s.fileCard, { flexDirection: 'column', padding: 0, overflow: 'hidden' }]} onPress={() => file.url && Linking.openURL(file.url)} activeOpacity={0.8}>
                        {/* Thumbnail for image files */}
                        {file.fileType === 'image' && file.url ? (
                          <Image source={{ uri: file.url }} style={{ width: '100%', height: 160, resizeMode: 'cover', backgroundColor: '#E2E8F0' }} />
                        ) : (
                          <View style={{ width: '100%', height: 80, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons
                              name={file.fileType === 'pdf' ? 'document-text-outline' : file.fileType === '3d-model' ? 'cube-outline' : file.fileType === 'cad' ? 'git-branch-outline' : 'document-outline'}
                              size={36}
                              color="#2563EB"
                            />
                            <Text style={{ fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#2563EB', marginTop: 4, textTransform: 'uppercase' }}>
                              {file.fileType || 'File'}
                            </Text>
                          </View>
                        )}
                        {/* File info row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
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
                        </View>
                      </TouchableOpacity>
                    ))}
                    
                    <View style={{ gap: 8, marginTop: 8 }}>
                      {lead.status === 'Under Drawing' && (
                        <TouchableOpacity style={[s.actionBtnPrimary, { backgroundColor: '#0284C7', marginTop: 0 }]} onPress={() => setShowSendBoqModal(true)}>
                          <Text style={s.actionBtnText}>Complete Phase & Pass to BOQ Estimation</Text>
                        </TouchableOpacity>
                      )}
                      {lead.status !== 'Lost' && lead.status !== 'Won' && lead.status !== 'Converted' && (
                        <TouchableOpacity
                          style={s.stageLostActionBtn}
                          onPress={() => setShowLostModal(true)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                          <Text style={s.stageLostActionBtnText}>Mark as Lost</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })()}
            </View>
          )}

          {/* 5. BOQ TAB */}
          {activeTab === 'boq' && (
            <View style={{ gap: 16 }}>
              {(() => {
                const lock = getTabLockState('boq');
                if (lock.isLocked) {
                  return (
                    <View style={s.lockedCard}>
                      <View style={[s.lockedIconBox, { backgroundColor: lock.isUnassigned ? '#EFF6FF' : '#ECFDF5' }]}>
                        <Ionicons name="lock-closed" size={24} color={lock.isUnassigned ? '#2563EB' : '#059669'} />
                      </View>
                      <Text style={s.lockedTitle}>{lock.isUnassigned ? 'Lead Assignment Required' : 'BOQ Estimation Phase Locked'}</Text>
                      <Text style={s.lockedSub}>{lock.reason || 'Approval of 2D/3D drawings is required before building itemized BOQs.'}</Text>
                      {lock.isUnassigned ? (
                        <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#2563EB' }]} onPress={() => setActiveTab('follow_ups')}>
                          <Ionicons name="person-add-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={s.unlockActionBtnText}>Go to Follow-ups & Assign</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#059669' }]} onPress={() => setShowSendBoqModal(true)}>
                          <Text style={s.unlockActionBtnText}>Pass to BOQ Phase</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }

                if (!lead.boqs || lead.boqs.length === 0) {
                  return (
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
                  );
                }

                const activeBoq = lead.boqs[activeBoqIdx] || {};
                const boqItems = activeBoq.items || [];
                const calculatedItemsSubtotal = boqItems.reduce((acc, it) => {
                  const amt = Number(it.amount);
                  if (!isNaN(amt) && amt > 0) return acc + amt;
                  const qty = parseFloat(it.quantity) || 0;
                  const rt = parseFloat(it.rate || it.unitRate) || 0;
                  return acc + (qty * rt);
                }, 0);

                const itemsSubtotal = Number(activeBoq.subtotal) || calculatedItemsSubtotal || (activeBoq.totalAmount ? Math.round(Number(activeBoq.totalAmount) / 1.18) : 0);
                const taxPercent = Number(activeBoq.taxPercent) || 18;
                const taxAmount = Number(activeBoq.taxAmount) || Math.round(itemsSubtotal * (taxPercent / 100));
                const estimatedTotal = Number(activeBoq.totalAmount) || Math.round(itemsSubtotal + taxAmount);

                return (
                  <View style={{ gap: 14 }}>
                    {/* BOQ Header & Rev Switcher */}
                    <View style={s.boqHeaderCard}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={s.boqNumberText}>{activeBoq.boqNumber || 'BOQ'}</Text>
                          <View style={s.versionTag}>
                            <Text style={s.versionTagText}>
                              {activeBoq.version ? `v${activeBoq.version}.0` : 'v1.0'}
                            </Text>
                          </View>
                        </View>
                        <Text style={s.boqDateText}>
                          Updated: {new Date(activeBoq.createdAt || Date.now()).toLocaleDateString()}
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
                        <Text style={s.costVal}>₹{itemsSubtotal.toLocaleString('en-IN')}</Text>
                      </View>
                      <View style={s.costRow}>
                        <Text style={s.costLabel}>GST ({taxPercent}%)</Text>
                        <Text style={s.costVal}>₹{taxAmount.toLocaleString('en-IN')}</Text>
                      </View>
                      <View style={[s.costRow, s.costRowTotal]}>
                        <Text style={s.grandTotalTitle}>Estimated Total</Text>
                        <Text style={s.grandTotalAmount}>
                          ₹{estimatedTotal.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>

                    {/* Items List */}
                    <View style={s.card}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={s.cardTitle}>Line Items ({lead.boqs[activeBoqIdx]?.items?.length || 0})</Text>
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
                    
                    <View style={{ gap: 8, marginTop: 8 }}>
                      {lead.status === 'Under BOQ Creation' && (
                        <TouchableOpacity style={[s.actionBtnPrimary, { backgroundColor: '#059669', marginTop: 0 }]} onPress={() => setShowSendQuoteModal(true)}>
                          <Text style={s.actionBtnText}>Complete Phase & Pass to Quotation</Text>
                        </TouchableOpacity>
                      )}
                      {lead.status !== 'Lost' && lead.status !== 'Won' && lead.status !== 'Converted' && (
                        <TouchableOpacity
                          style={s.stageLostActionBtn}
                          onPress={() => setShowLostModal(true)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                          <Text style={s.stageLostActionBtnText}>Mark as Lost</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })()}
            </View>
          )}

          {/* 6. QUOTATIONS TAB */}
          {activeTab === 'quotations' && (
            <View style={{ gap: 16 }}>
              {(() => {
                const lock = getTabLockState('quotations');
                if (lock.isLocked) {
                  return (
                    <View style={s.lockedCard}>
                      <View style={[s.lockedIconBox, { backgroundColor: lock.isUnassigned ? '#EFF6FF' : '#FFF1F2' }]}>
                        <Ionicons name="lock-closed" size={24} color={lock.isUnassigned ? '#2563EB' : '#E11D48'} />
                      </View>
                      <Text style={s.lockedTitle}>{lock.isUnassigned ? 'Lead Assignment Required' : 'Quotation Phase Locked'}</Text>
                      <Text style={s.lockedSub}>{lock.reason || 'An estimate BOQ is required before generating final sales quotations.'}</Text>
                      {lock.isUnassigned ? (
                        <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#2563EB' }]} onPress={() => setActiveTab('follow_ups')}>
                          <Ionicons name="person-add-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={s.unlockActionBtnText}>Go to Follow-ups & Assign</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={[s.unlockActionBtn, { backgroundColor: '#E11D48' }]} onPress={() => setShowSendQuoteModal(true)}>
                          <Text style={s.unlockActionBtnText}>Pass to Quotation</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }

                if (!lead.quotations || lead.quotations.length === 0) {
                  return (
                    <View style={s.emptyCard}>
                      <Ionicons name="calculator-outline" size={40} color="#E11D48" />
                      <Text style={s.emptyCardTitle}>No Quotations Created</Text>
                      <Text style={s.emptySubText}>Generate itemized quotes for your client.</Text>
                      <TouchableOpacity style={[s.actionBtnPrimary, { backgroundColor: '#E11D48' }]} onPress={openQuoteModal}>
                        <Text style={s.actionBtnText}>Generate Quotation</Text>
                      </TouchableOpacity>
                      {lead.status !== 'Lost' && lead.status !== 'Won' && lead.status !== 'Converted' && (
                        <TouchableOpacity
                          style={[s.stageLostActionBtn, { marginTop: 8, width: '100%' }]}
                          onPress={() => setShowLostModal(true)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                          <Text style={s.stageLostActionBtnText}>Mark as Lost</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }

                return (
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
                        {/* Quotation Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <View>
                            <Text style={s.cardTitle}>Quotation v{currentQuote.version}</Text>
                            <Text style={{ fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 }}>
                              {currentQuote.items?.length || 0} line item{currentQuote.items?.length === 1 ? '' : 's'}
                            </Text>
                          </View>
                          <View style={[s.stageBadge, { backgroundColor: currentQuote.status === 'Accepted' ? '#DCFCE7' : currentQuote.status === 'Rejected' ? '#FEE2E2' : '#FEF3C7' }]}>
                            <Text style={[s.stageBadgeText, { color: currentQuote.status === 'Accepted' ? '#15803D' : currentQuote.status === 'Rejected' ? '#B91C1C' : '#B45309' }]}>
                              {currentQuote.status || 'Sent'}
                            </Text>
                          </View>
                        </View>

                        {/* Items Section (Responsive Mobile Itemized Table) */}
                        <View style={s.quoteTableCard}>
                          <View style={s.quoteHeaderRow}>
                            <Text style={s.quoteHeaderTitle}>ITEM & SPECIFICATION</Text>
                            <Text style={s.quoteHeaderTotal}>TOTAL</Text>
                          </View>

                          {(currentQuote.items || []).map((item, i) => {
                            const qty = Number(item.quantity) || 1;
                            const unitPrice = Number(item.unitPrice || item.rate || 0);
                            const lineTotal = Number(item.total) || (qty * unitPrice);

                            // Extract category badge if item has [Category] prefix
                            const catMatch = item.description?.match(/^\[(.*?)\]\s*(.*)$/);
                            const category = catMatch ? catMatch[1] : null;
                            const displayName = catMatch ? catMatch[2] : (item.description || 'Line Item');
                            const isLast = i === (currentQuote.items?.length || 0) - 1;

                            return (
                              <View key={i} style={[s.quoteItemRow, isLast && { borderBottomWidth: 0 }]}>
                                <View style={{ flex: 1, paddingRight: 12 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                                    {category && (
                                      <View style={s.quoteCatBadge}>
                                        <Text style={s.quoteCatBadgeText}>{category}</Text>
                                      </View>
                                    )}
                                    <Text style={s.quoteItemName} numberOfLines={2}>
                                      {displayName}
                                    </Text>
                                  </View>
                                  <Text style={s.quoteItemMeta}>
                                    {qty} {item.unit || 'unit'}{qty === 1 ? '' : 's'} × ₹{unitPrice.toLocaleString('en-IN')}
                                  </Text>
                                </View>
                                <Text style={s.quoteItemTotal}>
                                  ₹{Math.round(lineTotal).toLocaleString('en-IN')}
                                </Text>
                              </View>
                            );
                          })}
                        </View>

                        {/* Totals Summary Card */}
                        {(() => {
                          const quoteItems = currentQuote.items || [];
                          const computedSubtotal = quoteItems.reduce((acc, it) => acc + (Number(it.total) || ((parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice || it.rate) || 0))), 0);
                          const subtotal = Number(currentQuote.subtotal) || computedSubtotal;
                          const taxPercentage = Number(currentQuote.taxPercentage ?? 18);
                          const taxAmount = Number(currentQuote.tax) || Math.round(subtotal * (taxPercentage / 100));
                          const discount = Number(currentQuote.discount) || 0;
                          const grandTotal = Number(currentQuote.grandTotal) || Math.max(0, subtotal + taxAmount - discount);

                          return (
                            <View style={s.quoteTotalsCard}>
                              <View style={s.quoteTotalRow}>
                                <Text style={s.quoteTotalLabel}>Total Items</Text>
                                <Text style={s.quoteTotalVal}>{quoteItems.length} item{quoteItems.length === 1 ? '' : 's'}</Text>
                              </View>
                              <View style={s.quoteTotalRow}>
                                <Text style={s.quoteTotalLabel}>Subtotal</Text>
                                <Text style={s.quoteTotalVal}>₹{Math.round(subtotal).toLocaleString('en-IN')}</Text>
                              </View>
                              <View style={s.quoteTotalRow}>
                                <Text style={s.quoteTotalLabel}>GST ({taxPercentage}%)</Text>
                                <Text style={s.quoteTotalVal}>+ ₹{Math.round(taxAmount).toLocaleString('en-IN')}</Text>
                              </View>
                              {discount > 0 && (
                                <View style={s.quoteTotalRow}>
                                  <Text style={[s.quoteTotalLabel, { color: '#16A34A' }]}>Discount</Text>
                                  <Text style={[s.quoteTotalVal, { color: '#16A34A' }]}>- ₹{Math.round(discount).toLocaleString('en-IN')}</Text>
                                </View>
                              )}
                              <View style={s.quoteTotalDivider} />
                              <View style={s.quoteTotalRow}>
                                <View>
                                  <Text style={s.quoteGrandTotalTitle}>Grand Total</Text>
                                  <Text style={s.quoteGrandTotalSub}>Inclusive of taxes</Text>
                                </View>
                                <Text style={s.quoteGrandTotalAmount}>
                                  ₹{Math.round(grandTotal).toLocaleString('en-IN')}
                                </Text>
                              </View>
                            </View>
                          );
                        })()}

                        {/* Notes / Terms if present */}
                        {!!currentQuote.notes && (
                          <View style={s.quoteNotesBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <Ionicons name="document-text-outline" size={13} color="#64748B" />
                              <Text style={s.quoteNotesHeader}>TERMS & CLIENT NOTES</Text>
                            </View>
                            <Text style={s.quoteNotesBody}>{currentQuote.notes}</Text>
                          </View>
                        )}

                        {/* Actions */}
                        {currentQuote.status === 'Accepted' ? (
                          <View style={{ marginTop: 16, gap: 10 }}>
                            <View style={s.quoteAcceptedBanner}>
                              <Ionicons name="checkmark-circle" size={20} color="#15803D" />
                              <View style={{ flex: 1 }}>
                                <Text style={s.quoteAcceptedTitle}>Quotation Accepted</Text>
                                <Text style={s.quoteAcceptedSubtitle}>Client approved this proposal. Ready to initialize project execution.</Text>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={s.quoteConvertBtn}
                              onPress={() => handleConvertToProject(activeQuoteIdx)}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="rocket-outline" size={18} color="#FFFFFF" />
                              <Text style={s.quoteConvertBtnText}>Convert to Project</Text>
                            </TouchableOpacity>
                          </View>
                        ) : currentQuote.status === 'Rejected' ? (
                          <View style={{ marginTop: 16, gap: 10 }}>
                            <View style={s.quoteRejectedBanner}>
                              <Ionicons name="close-circle" size={20} color="#B91C1C" />
                              <View style={{ flex: 1 }}>
                                <Text style={s.quoteRejectedTitle}>Quotation Rejected</Text>
                                <Text style={s.quoteRejectedSubtitle}>Client declined this version. Create a new revision with revised rates.</Text>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={s.quoteRevisionBtn}
                              onPress={openQuoteModal}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                              <Text style={s.quoteConvertBtnText}>Create New Revision</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={{ gap: 8, marginTop: 16 }}>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <TouchableOpacity
                                style={[s.smallActionBtn, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC', borderWidth: 1, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                                onPress={() => handleQuoteStatus(activeQuoteIdx, 'Accepted')}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="checkmark-circle-outline" size={15} color="#15803D" style={{ marginRight: 4 }} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803D' }}>Mark Accepted</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[s.smallActionBtn, { backgroundColor: '#FEE2E2', borderColor: '#FECACA', borderWidth: 1, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                                onPress={() => handleQuoteStatus(activeQuoteIdx, 'Rejected')}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="close-circle-outline" size={15} color="#B91C1C" style={{ marginRight: 4 }} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#B91C1C' }}>Mark Rejected</Text>
                              </TouchableOpacity>
                            </View>
                            {lead.status !== 'Lost' && lead.status !== 'Won' && lead.status !== 'Converted' && (
                              <TouchableOpacity
                                style={s.stageLostActionBtn}
                                onPress={() => setShowLostModal(true)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                                <Text style={s.stageLostActionBtnText}>Mark as Lost</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })()}
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
        onSuccess={() => {
          setLead((prev) => (prev ? { ...prev, status: 'Lost' } : prev));
          showToast('Lead has been marked as Lost.', 'success');
          fetchData();
        }}
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
              <TouchableOpacity
                style={[s.dropdownBtn, showEditLeadSourceDropdown && s.dropdownBtnActive]}
                onPress={() => setShowEditLeadSourceDropdown(!showEditLeadSourceDropdown)}
                activeOpacity={0.7}
              >
                <View style={s.dropdownBtnContent}>
                  <Ionicons name="funnel-outline" size={15} color="#64748B" style={{ marginRight: 8 }} />
                  <Text style={s.dropdownBtnText}>{editForm.leadSource || 'Select Lead Source'}</Text>
                </View>
                <Ionicons name={showEditLeadSourceDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
              </TouchableOpacity>

              {showEditLeadSourceDropdown && (
                <View style={s.dropdownMenu}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
                    {LEAD_SOURCES.map((opt, idx) => {
                      const active = editForm.leadSource === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[
                            s.dropdownItem,
                            active && s.dropdownItemActive,
                            idx === LEAD_SOURCES.length - 1 && { borderBottomWidth: 0 }
                          ]}
                          onPress={() => {
                            setEditForm({ ...editForm, leadSource: opt });
                            setShowEditLeadSourceDropdown(false);
                          }}
                        >
                          <Text style={[s.dropdownItemText, active && s.dropdownItemTextActive]}>{opt}</Text>
                          {active && <Ionicons name="checkmark-circle" size={18} color="#2563EB" />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <Text style={s.label}>Property Type</Text>
              <View style={s.chipOptions}>
                {['Flat', 'Villa', 'Office', 'Shop', 'Other'].map((opt) => (
                  <TouchableOpacity key={opt} style={[s.optionChip, editForm.propertyType === opt && s.optionChipActive]} onPress={() => setEditForm({ ...editForm, propertyType: opt })}>
                    <Text style={[s.optionChipText, editForm.propertyType === opt && s.optionChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Assign Follow-up Executive</Text>
              <TouchableOpacity
                style={[s.dropdownBtn, showEditAssignDropdown && s.dropdownBtnActive]}
                onPress={() => setShowEditAssignDropdown(!showEditAssignDropdown)}
                activeOpacity={0.7}
              >
                <View style={s.dropdownBtnContent}>
                  <Ionicons name="person-outline" size={15} color="#64748B" style={{ marginRight: 8 }} />
                  <Text style={s.dropdownBtnText}>
                    {(() => {
                      if (!editForm.assignedSalesExecutive) return 'Unassigned (No Follow-up Assigned)';
                      const match = users.find((u) => (u._id || u.id) === editForm.assignedSalesExecutive);
                      return match ? userLabel(match) : 'Assigned Member';
                    })()}
                  </Text>
                </View>
                <Ionicons name={showEditAssignDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
              </TouchableOpacity>

              {showEditAssignDropdown && (
                <View style={s.dropdownMenu}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
                    <TouchableOpacity
                      style={[
                        s.dropdownItem,
                        !editForm.assignedSalesExecutive && s.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setEditForm({ ...editForm, assignedSalesExecutive: '' });
                        setShowEditAssignDropdown(false);
                      }}
                    >
                      <Text style={[s.dropdownItemText, !editForm.assignedSalesExecutive && s.dropdownItemTextActive]}>
                        Unassigned (No Follow-up Assigned)
                      </Text>
                      {!editForm.assignedSalesExecutive && <Ionicons name="checkmark-circle" size={18} color="#2563EB" />}
                    </TouchableOpacity>
                    {users.map((u, idx) => {
                      const uid = u._id || u.id;
                      const active = editForm.assignedSalesExecutive === uid;
                      return (
                        <TouchableOpacity
                          key={uid}
                          style={[
                            s.dropdownItem,
                            active && s.dropdownItemActive,
                            idx === users.length - 1 && { borderBottomWidth: 0 }
                          ]}
                          onPress={() => {
                            setEditForm({ ...editForm, assignedSalesExecutive: uid });
                            setShowEditAssignDropdown(false);
                          }}
                        >
                          <Text style={[s.dropdownItemText, active && s.dropdownItemTextActive]}>{userLabel(u)}</Text>
                          {active && <Ionicons name="checkmark-circle" size={18} color="#2563EB" />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

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

            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Follow-up Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {FOLLOWUP_TYPES.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[s.optionChip, followUpForm.type === opt && s.optionChipActive]}
                    onPress={() => setFollowUpForm({ ...followUpForm, type: opt })}
                  >
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
                  const uId = u._id || u.id;
                  const active = followUpForm.assignedSalesExecutive === uId;
                  return (
                    <TouchableOpacity
                      key={uId}
                      style={[s.optionChip, active && s.optionChipActive]}
                      onPress={() => setFollowUpForm({ ...followUpForm, assignedSalesExecutive: uId })}
                    >
                      <Text style={[s.optionChipText, active && s.optionChipTextActive]}>{userLabel(u)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.label}>Follow-up Notes / Goal *</Text>
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
            </ScrollView>
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

      {/* 7. Quotation Builder Modal (Matches Web Exactly) */}
      <Modal visible={showQuoteModal} transparent animationType="slide" onRequestClose={() => setShowQuoteModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '92%', paddingBottom: Platform.OS === 'ios' ? 24 : 16 }]}>
            {/* Header */}
            <View style={s.quoteModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={s.quoteHeaderIconBox}>
                  <Ionicons name="calculator-outline" size={18} color="#4F46E5" />
                </View>
                <View>
                  <Text style={s.quoteModalTitle}>Quotation Builder</Text>
                  <Text style={s.quoteModalSubtitle}>
                    Generating Version {(lead?.quotations?.length || 0) + 1}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowQuoteModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={s.quoteCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Line Items Card / Box */}
              <View style={s.quoteItemsContainer}>
                {quoteItems.map((item, idx) => {
                  const itemQty = parseFloat(item.quantity) || 0;
                  const itemPrice = parseFloat(item.unitPrice) || 0;
                  const itemTotal = itemQty * itemPrice;

                  return (
                    <View key={idx} style={s.quoteItemRowWeb}>
                      {/* Trash Button */}
                      <TouchableOpacity
                        style={s.quoteTrashBtn}
                        onPress={() => {
                          if (quoteItems.length > 1) {
                            setQuoteItems(quoteItems.filter((_, i) => i !== idx));
                          } else {
                            setQuoteItems([{ description: '', quantity: '1', unitPrice: '' }]);
                          }
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#F87171" />
                      </TouchableOpacity>

                      {/* Description */}
                      <TextInput
                        style={s.quoteDescInput}
                        placeholder="e.g. Modular Kitchen - Acrylic Finish"
                        placeholderTextColor="#94A3B8"
                        value={item.description}
                        onChangeText={(v) => {
                          const copy = [...quoteItems];
                          copy[idx].description = v;
                          setQuoteItems(copy);
                        }}
                      />

                      {/* Quantity */}
                      <TextInput
                        style={s.quoteQtyInput}
                        placeholder="1"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={item.quantity}
                        onChangeText={(v) => {
                          const copy = [...quoteItems];
                          copy[idx].quantity = v;
                          setQuoteItems(copy);
                        }}
                      />

                      {/* Rate */}
                      <TextInput
                        style={s.quoteRateInput}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={item.unitPrice}
                        onChangeText={(v) => {
                          const copy = [...quoteItems];
                          copy[idx].unitPrice = v;
                          setQuoteItems(copy);
                        }}
                      />

                      {/* Line Item Total */}
                      <View style={s.quoteRowTotalBox}>
                        <Text style={s.quoteRowTotalText} numberOfLines={1}>
                          ₹{Math.round(itemTotal).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {/* Add Line Item */}
                <TouchableOpacity
                  style={s.addLineItemBtn}
                  onPress={() => setQuoteItems([...quoteItems, { description: '', quantity: '1', unitPrice: '' }])}
                >
                  <Ionicons name="add" size={16} color="#4F46E5" />
                  <Text style={s.addLineItemText}>Add Line Item</Text>
                </TouchableOpacity>
              </View>

              {/* Client Notes / Terms */}
              <View style={{ marginTop: 14 }}>
                <Text style={s.clientNotesLabel}>CLIENT NOTES / TERMS</Text>
                <TextInput
                  style={s.clientNotesInput}
                  multiline
                  numberOfLines={3}
                  value={quoteNotes}
                  onChangeText={setQuoteNotes}
                  placeholder="E.g., 50% advance required before production begins. Valid for 15 days."
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Financial Calculation Card */}
              {(() => {
                const subtotal = quoteItems.reduce((sum, item) => {
                  const qty = parseFloat(item.quantity) || 0;
                  const price = parseFloat(item.unitPrice) || 0;
                  return sum + (qty * price);
                }, 0);
                const taxRate = parseFloat(quoteTax) || 0;
                const tax = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
                const discount = parseFloat(quoteDiscount) || 0;
                const grandTotal = Math.max(0, Math.round((subtotal + tax - discount) * 100) / 100);

                return (
                  <View style={s.quoteFinancialCard}>
                    {/* Subtotal */}
                    <View style={s.quoteFinRow}>
                      <Text style={s.quoteFinLabel}>Subtotal</Text>
                      <Text style={s.quoteFinVal}>₹{Math.round(subtotal).toLocaleString('en-IN')}</Text>
                    </View>

                    {/* Tax (GST) % */}
                    <View style={s.quoteFinRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={s.quoteFinLabel}>Tax (GST) %</Text>
                        <TextInput
                          style={s.quoteInlineInput}
                          keyboardType="numeric"
                          value={quoteTax}
                          onChangeText={setQuoteTax}
                          placeholder="18"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <Text style={s.quoteTaxVal}>+ ₹{tax.toLocaleString('en-IN')}</Text>
                    </View>

                    {/* Discount (₹) */}
                    <View style={s.quoteFinRow}>
                      <Text style={s.quoteFinLabel}>Discount (₹)</Text>
                      <TextInput
                        style={[s.quoteInlineInput, { width: 68 }]}
                        keyboardType="numeric"
                        value={quoteDiscount}
                        onChangeText={setQuoteDiscount}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    {/* Grand Total */}
                    <View style={s.quoteGrandTotalRow}>
                      <Text style={s.quoteGrandTotalLabel}>Grand Total</Text>
                      <Text style={s.quoteGrandTotalVal}>₹{(Math.round(grandTotal * 100) / 100).toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                );
              })()}
            </ScrollView>

            {/* Bottom Footer Action Buttons */}
            <View style={s.quoteModalFooter}>
              <TouchableOpacity
                style={s.quoteCancelBtn}
                onPress={() => setShowQuoteModal(false)}
                disabled={submittingAct}
              >
                <Text style={s.quoteCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.quoteSaveBtn, submittingAct && { opacity: 0.7 }]}
                onPress={handleSaveQuotation}
                disabled={submittingAct}
              >
                {submittingAct ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                    <Text style={s.quoteSaveText}>Save & Generate</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
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
        isFollowUpCompleted={activities.some(
          (a) => a.type !== 'System Update' && a.type !== 'Status Change' && a.type !== 'Site Visit' && a.status?.toLowerCase() === 'completed'
        )}
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
        users={users}
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
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 14, color: '#64748B', fontWeight: '500' },
  errorText: { fontSize: 16, color: '#EF4444', fontWeight: '700' },
  header: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    width: 38,
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 2,
  },
  headerRight: {
    minWidth: 38,
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 2,
  },
  headerLeadInfoCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 1,
    maxWidth: '100%',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    letterSpacing: -0.3,
    flexShrink: 1,
    textAlign: 'center',
  },
  headerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 2,
    maxWidth: '100%',
  },
  statusBadgeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 105,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editLeadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  editLeadBtnText: {
    fontSize: 11.5,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  headerGreeting: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#1D4ED8',
    marginBottom: 1,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#1D4ED8',
  },
  leadIdBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexShrink: 0,
  },
  leadIdText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#1D4ED8',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
  },

  tabRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#2563EB',
    fontFamily: 'Inter-Bold',
  },
  tabContent: { padding: 16 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
  },
  metricCardFull: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 9.5,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  metricVal: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
  },
  quickActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickActionPillText: {
    fontSize: 10.5,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  actionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', flex: 1 },
  cardSubText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#EFF6FF', borderRadius: 8 },
  smallBtnText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
  emptySubText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', marginVertical: 12 },
  followUpCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 10 },
  dateInput: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateInputText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, marginTop: 20, marginBottom: 10,
  },
  saveBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
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
  // Quotation Tab Layout Styles
  quoteTableCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginBottom: 12,
  },
  quoteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  quoteHeaderTitle: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  quoteHeaderTotal: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  quoteItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  quoteCatBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  quoteCatBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: '#4F46E5',
    textTransform: 'uppercase',
  },
  quoteItemName: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  quoteItemMeta: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 2,
  },
  quoteItemTotal: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginLeft: 8,
  },
  quoteTotalsCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 7,
  },
  quoteTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteTotalLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  quoteTotalVal: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  quoteTotalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  quoteGrandTotalTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  quoteGrandTotalSub: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
    marginTop: 1,
  },
  quoteGrandTotalAmount: {
    fontSize: 16,
    fontFamily: 'Inter-Black',
    color: '#2563EB',
  },
  quoteNotesBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  quoteNotesHeader: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  quoteNotesBody: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#334155',
    lineHeight: 17,
  },
  quoteAcceptedBanner: {
    backgroundColor: '#DCFCE7',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quoteAcceptedTitle: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#15803D',
  },
  quoteAcceptedSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    marginTop: 1,
  },
  quoteRejectedBanner: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quoteRejectedTitle: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#B91C1C',
  },
  quoteRejectedSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#991B1B',
    marginTop: 1,
  },
  quoteConvertBtn: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  quoteRevisionBtn: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  quoteConvertBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
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
  // Quotation Builder Modal (Web Match)
  quoteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 10,
  },
  quoteHeaderIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteModalTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  quoteModalSubtitle: {
    fontSize: 11.5,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 1,
  },
  quoteCloseBtn: {
    padding: 4,
  },
  quoteItemsContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 10,
    gap: 8,
    marginTop: 4,
  },
  quoteItemRowWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quoteTrashBtn: {
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteDescInput: {
    flex: 1,
    minWidth: 90,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
  },
  quoteQtyInput: {
    width: 42,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
    paddingHorizontal: 4,
  },
  quoteRateInput: {
    width: 58,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
    paddingHorizontal: 4,
  },
  quoteRowTotalBox: {
    minWidth: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 2,
  },
  quoteRowTotalText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  addLineItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  addLineItemText: {
    fontSize: 12.5,
    fontFamily: 'Inter-Bold',
    color: '#4F46E5',
  },
  clientNotesLabel: {
    fontSize: 10.5,
    fontFamily: 'Inter-Bold',
    color: '#334155',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  clientNotesInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12.5,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  quoteFinancialCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginTop: 14,
    marginBottom: 8,
  },
  quoteFinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quoteFinLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#475569',
  },
  quoteFinVal: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  quoteInlineInput: {
    width: 48,
    height: 30,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12.5,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
    paddingVertical: 0,
    paddingHorizontal: 4,
  },
  quoteTaxVal: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#475569',
  },
  quoteGrandTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
  },
  quoteGrandTotalLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  quoteGrandTotalVal: {
    fontSize: 20,
    fontFamily: 'Inter-Black',
    color: '#4F46E5',
    letterSpacing: -0.3,
  },
  quoteModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 8,
  },
  quoteCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  quoteCancelText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  quoteSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  quoteSaveText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },

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
  stageLostActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  stageLostActionBtnText: {
    fontSize: 12.5,
    fontFamily: 'Inter-Bold',
    color: '#DC2626',
  },
  lostAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 10,
  },
  lostAlertIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lostAlertTitle: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#991B1B',
  },
  lostAlertReason: {
    fontSize: 11.5,
    fontFamily: 'Inter-Medium',
    color: '#B91C1C',
    marginTop: 1,
  },
  reopenLeadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reopenLeadBtnText: {
    fontSize: 11.5,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
});



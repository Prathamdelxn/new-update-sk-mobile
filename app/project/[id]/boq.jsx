import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Modal, TextInput, ActivityIndicator, Alert, Platform, InteractionManager,
  SectionList, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import ConfirmModal from '../../components/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import { formatCompact } from '../../utils/format';
import { useTranslation } from 'react-i18next';
import { hasProjectPermission, hasAnyProjectPermissionPrefix, isProjectLocked } from '../../utils/permissions';

import BOQItem from './_components/BOQItem';
import {
  ViewDetailsModal,
  ChoiceModal,
  ExcelPreviewModal,
  ManualEntryModal,
  HistoryModal,
  ApproverModal,
  BudgetImpactModal,
  RejectionReasonModal
} from './_components/BOQModals';
import { styles } from './boqStyles';

export default function ProjectBOQTab({ project, fetchProjectData }) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Excel Import Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);

  // View/History State
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [viewingHistory, setViewingHistory] = useState([]);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Modern Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: null,
    type: 'default' // 'default' | 'destructive' | 'success'
  });

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Selection State
  const [selectedItems, setSelectedItems] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const isAdmin = user?.role?.name === 'Admin';
  const canView = isAdmin || hasAnyProjectPermissionPrefix(user, project, 'boq:');
  const isLocked = isProjectLocked(project);
  const canCreate = !isLocked && (isAdmin || hasProjectPermission(user, project, 'boq:create'));
  const canUpdate = !isLocked && (isAdmin || hasProjectPermission(user, project, 'boq:update'));
  const canDelete = !isLocked && (isAdmin || hasProjectPermission(user, project, 'boq:delete'));
  const canApprove = !isLocked && (isAdmin || hasProjectPermission(user, project, 'boq:approve'));

  // Debugging user permissions as requested
  console.log("=== USER PERMISSIONS DEBUG ===");
  console.log("User Global Role:", user?.role?.name);
  console.log("User Global Permissions:", user?.role?.permissions);
  console.log("canView BOQ:", canView);
  console.log("isAdmin:", isAdmin);
  // Find project member object for this user
  const memberObj = project?.members?.find(m => m.user === user?._id || m._id === user?._id);
  console.log("Project Member Object:", memberObj);
  console.log("Project Member Role Permissions:", memberObj?.role?.permissions);
  console.log("==============================");

  // Approver Modal State
  const [showApproverModal, setShowApproverModal] = useState(false);
  const [approvers, setApprovers] = useState([]);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [pendingSelection, setPendingSelection] = useState([]);
  const [selectedApproverId, setSelectedApproverId] = useState(null);

  // Budget Impact State
  const [showBudgetImpactModal, setShowBudgetImpactModal] = useState(false);
  const [budgetImpactData, setBudgetImpactData] = useState({
    oldAmount: 0,
    newAmount: 0,
    difference: 0,
    reason: '',
    itemId: null
  });

  // Rejection Reason State
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [pendingRejectionItemId, setPendingRejectionItemId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    groupName: '',
    itemNumber: '',
    itemDescription: '',
    unit: '',
    quantity: '',
    unitCost: '',
    remark: ''
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (!project?._id) return;
    const task = InteractionManager.runAfterInteractions(() => {
      fetchBOQ();
    });
    return () => task.cancel();
  }, [project?._id]);

  // Real-time: refresh when any team member updates the BOQ
  useEffect(() => {
    if (!socket) return;
    socket.on('boq:updated', fetchBOQ);
    return () => socket.off('boq:updated', fetchBOQ);
  }, [socket]);

  const fetchBOQ = async () => {
    if (!project?._id) return;
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/boq`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setItems(data);
      }
    } catch (error) {
      console.error('Fetch BOQ error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (historyId) => {
    if (!historyId) return;
    try {
      setLoadingHistory(true);
      setShowHistoryModal(true);
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/boq/history/${historyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setHistoryItems(data);
      }
    } catch (error) {
      console.error('Fetch history error:', error);
      showToast('Failed to load history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenView = async (item) => {
    setViewingItem(item);
    setShowViewModal(true);
    setSelectedVersionIdx(0);
    setViewingHistory([item]); // Start with the current item

    try {
      setIsLoadingVersions(true);
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/boq/history/${item.historyId || item._id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setViewingHistory(data);
      }
    } catch (error) {
      console.error('Fetch viewing history error:', error);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleUpdateStatus = async (itemId, newStatus, budgetData = null) => {
    // For rejection — show reason modal first
    if (newStatus === 'Rejected') {
      setPendingRejectionItemId(itemId);
      setShowRejectionModal(true);
      return;
    }

    // If it's an approval for a newer version and we haven't confirmed budget yet
    if (newStatus === 'Approved' && viewingHistory.length > 1 && selectedVersionIdx === 0 && !budgetData) {
      const currentItem = viewingHistory[0];
      const prevItem = viewingHistory[1];
      const diff = currentItem.totalCost - prevItem.totalCost;
      
      const autoReason = `BOQ Adjustment: ${currentItem.itemNumber || currentItem.itemDescription} (v${currentItem.version}) - ${diff >= 0 ? 'Increase' : 'Decrease'} of ${project?.currency || '$'} ${formatCompact(Math.abs(diff))}`;

      setBudgetImpactData({
        oldAmount: prevItem.totalCost,
        newAmount: currentItem.totalCost,
        difference: diff,
        reason: autoReason,
        itemId: itemId
      });
      setShowBudgetImpactModal(true);
      return;
    }

    setConfirmModal({
      visible: true,
      title: `${newStatus} Item`,
      message: budgetData 
        ? `Confirming this will update the project budget by ${project?.currency || '$'} ${formatCompact(Math.abs(budgetData.difference))}. Continue?`
        : `Are you sure you want to ${newStatus.toLowerCase()} this BOQ item?`,
      confirmText: newStatus,
      type: newStatus === 'Rejected' ? 'destructive' : 'success',
      onConfirm: async () => {
        try {
          setIsSubmitting(true);
          const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
          const res = await fetch(`${API_BASE_URL}/projects/${project._id}/boq/${itemId}/status`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
              status: newStatus,
              updateBudget: !!budgetData,
              budgetReason: budgetData?.reason
            })
          });

          if (res.ok) {
            showToast(budgetData ? 'Approved & Budget Updated' : `Item ${newStatus}`, 'success');
            fetchBOQ();
            setShowViewModal(false);
            setShowBudgetImpactModal(false);
          } else {
            const errorData = await res.json();
            showToast(errorData.message || 'Status update failed', 'error');
          }
        } catch (error) {
          showToast('Connection error', 'error');
        } finally {
          setIsSubmitting(false);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  // Called after user submits rejection reason
  const handleConfirmRejection = async (reason) => {
    setShowRejectionModal(false);
    try {
      setIsSubmitting(true);
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/boq/${pendingRejectionItemId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'Rejected', rejectionReason: reason })
      });
      if (res.ok) {
        showToast('Item Rejected', 'success');
        fetchBOQ();
        setShowViewModal(false);
      } else {
        const errorData = await res.json();
        showToast(errorData.message || 'Rejection failed', 'error');
      }
    } catch (error) {
      showToast('Connection error', 'error');
    } finally {
      setIsSubmitting(false);
      setPendingRejectionItemId(null);
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      groupName: '',
      itemNumber: '',
      itemDescription: '',
      unit: '',
      quantity: '',
      unitCost: '',
      remark: ''
    });
  };

  const handleManualSubmit = async () => {
    // Input Validation
    const errors = {};
    if (!formData.groupName?.trim()) errors.groupName = 'Required';
    if (!formData.itemDescription?.trim()) errors.itemDescription = 'Required';
    if (!formData.unit?.trim()) errors.unit = 'Required';
    
    const qty = Number(formData.quantity);
    const cost = Number(formData.unitCost);

    if (!formData.quantity || isNaN(qty) || qty <= 0) errors.quantity = 'Invalid';
    if (!formData.unitCost || isNaN(cost) || cost < 0) errors.unitCost = 'Invalid';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('Please correct the highlighted fields', 'error');
      return;
    }

    setFormErrors({});

    try {
      setIsSubmitting(true);
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
      const url = editingItem
        ? `${API_BASE_URL}/projects/${project._id}/boq/${editingItem._id}`
        : `${API_BASE_URL}/projects/${project._id}/boq`;

      const method = editingItem ? 'PATCH' : 'POST';
      const body = editingItem
        ? { ...formData, quantity: qty, unitCost: cost }
        : { items: [{ ...formData, quantity: qty, unitCost: cost }] };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const isDraftEdit = editingItem && editingItem.status === 'Draft';
        const isRejectedEdit = editingItem && editingItem.status === 'Rejected';
        showToast(
          editingItem
            ? (isDraftEdit ? 'BOQ item updated' : isRejectedEdit ? 'Item re-drafted successfully' : 'New version created')
            : 'BOQ item created',
          'success'
        );
        setShowManualModal(false);
        resetForm();
        fetchBOQ();
      } else {
        const errorData = await res.json();
        showToast(errorData.message || 'Update failed', 'error');
      }
    } catch (error) {
      console.error('BOQ submit error:', error);
      showToast('Connection error', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelection = useCallback((id, forceOn = false) => {
    if (forceOn) {
      setIsSelectionMode(true);
      setSelectedItems([id]);
      return;
    }
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(it => it._id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedItems.length === 0) return;
    setConfirmModal({
      visible: true,
      title: 'Bulk Approve',
      message: `Are you sure you want to approve all ${selectedItems.length} selected items?`,
      confirmText: 'Approve All',
      type: 'success',
      onConfirm: async () => {
        try {
          setIsSubmitting(true);
          const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
          const promises = selectedItems.map(id =>
            fetch(`${API_BASE_URL}/projects/${project._id}/boq/${id}/status`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ status: 'Approved' })
            })
          );
          await Promise.all(promises);
          showToast(`${selectedItems.length} items approved`, 'success');
          setIsSelectionMode(false);
          setSelectedItems([]);
          fetchBOQ();
        } catch (e) {
          showToast('Bulk approval failed', 'error');
        } finally {
          setIsSubmitting(false);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedItems.length === 0) return;
    setConfirmModal({
      visible: true,
      title: 'Bulk Delete',
      message: `Delete ${selectedItems.length} selected items? This cannot be undone.`,
      confirmText: 'Delete All',
      type: 'destructive',
      onConfirm: async () => {
        try {
          setIsSubmitting(true);
          const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
          const promises = selectedItems.map(id =>
            fetch(`${API_BASE_URL}/projects/${project._id}/boq/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            })
          );
          await Promise.all(promises);
          showToast(`${selectedItems.length} items deleted`, 'success');
          setIsSelectionMode(false);
          setSelectedItems([]);
          fetchBOQ();
        } catch (e) {
          showToast('Bulk delete failed', 'error');
        } finally {
          setIsSubmitting(false);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const fetchApprovers = async () => {
    try {
      setLoadingApprovers(true);
      setShowApproverModal(true);
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/boq-approvers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        const mappedApprovers = data.map(approver => {
          const matchingMember = project?.members?.find(m => m._id === approver._id || (m.email && m.email === approver.email)) || 
                                 ((project?.createdBy?._id === approver._id || (project?.createdBy?.email && project?.createdBy?.email === approver.email)) ? project?.createdBy : null);
          
          let displayName = approver.name;
          const isInvalidName = (name) => {
            if (!name) return true;
            if (name.includes(':')) return true;
            if (/^[a-f0-9]{24}$/i.test(name)) return true;
            return false;
          };

          if (matchingMember?.name && !isInvalidName(matchingMember.name)) {
            displayName = matchingMember.name;
          } else if (approver.name && !isInvalidName(approver.name)) {
            displayName = approver.name;
          } else if (matchingMember?.email) {
            displayName = matchingMember.email.split('@')[0];
          } else if (approver.email) {
            displayName = approver.email.split('@')[0];
          }

          if (displayName && displayName.includes('.')) {
              displayName = displayName.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
          }

          return {
            ...approver,
            name: displayName,
            email: matchingMember?.email || approver.email
          };
        });
        setApprovers(mappedApprovers);
      }
    } catch (error) {
      console.error('Fetch approvers error:', error);
      showToast('Failed to load approvers', 'error');
    } finally {
      setLoadingApprovers(false);
    }
  };

  const handleOpenApproverSelection = (itemIds) => {
    setPendingSelection(itemIds);
    setSelectedApproverId(null);
    fetchApprovers();
  };

  const confirmSendForApproval = async () => {
    try {
      setIsSubmitting(true);
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/boq/bulk-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          itemIds: pendingSelection, 
          status: 'Pending',
          requestedApproverId: selectedApproverId
        })
      });

      if (res.ok) {
        showToast(`${pendingSelection.length} items sent for approval`, 'success');
        setIsSelectionMode(false);
        setSelectedItems([]);
        setPendingSelection([]);
        setSelectedApproverId(null);
        setShowApproverModal(false);
        fetchBOQ();
      } else {
        const errorData = await res.json();
        showToast(errorData.message || 'Action failed', 'error');
      }
    } catch (error) {
      showToast('Connection error', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDeleteItem = (itemId) => {
    setConfirmModal({
      visible: true,
      title: 'Delete Item',
      message: 'Are you sure you want to remove this BOQ item?',
      confirmText: 'Delete',
      type: 'destructive',
      onConfirm: async () => {
        try {
          const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
          const res = await fetch(`${API_BASE_URL}/projects/${project._id}/boq/${itemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            showToast('Item deleted', 'success');
            fetchBOQ();
          }
        } catch (error) {
          showToast('Delete failed', 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setFormData({
      groupName: item.groupName,
      itemNumber: item.itemNumber || '',
      itemDescription: item.itemDescription,
      unit: item.unit || '',
      quantity: String(item.quantity),
      unitCost: String(item.unitCost),
      remark: item.remark || ''
    });
    setShowManualModal(true);
  };

  const handleExcelImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setImportFile(file);

        setIsImporting(true);
        const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL.trim();

        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        });
        formData.append('action', 'preview');

        const res = await fetch(`${API_BASE_URL}/projects/${project._id}/boq/import`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          setPreviewData(data.preview);
          setShowChoiceModal(false);
          setShowPreviewModal(true);
        } else {
          showToast(data.message || 'Failed to parse file', 'error');
        }
      }
    } catch (error) {
      console.error('Import preview error:', error);
      showToast(t('errorReadingFile'), 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importFile) return;

    try {
      setIsSubmitting(true);
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL.trim();

      const formData = new FormData();
      formData.append('file', {
        uri: importFile.uri,
        name: importFile.name,
        type: importFile.mimeType || 'application/octet-stream',
      });
      formData.append('action', 'confirm');

      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/boq/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        showToast('BOQ Imported Successfully', 'success');
        setShowPreviewModal(false);
        setPreviewData([]);
        setImportFile(null);
        fetchBOQ();
      } else {
        const data = await res.json();
        showToast(data.message || 'Import failed', 'error');
      }
    } catch (error) {
      showToast(t('networkErrorImport'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group items by groupName and sort them
  const groupedItems = useMemo(() => {
    const statusPriority = { 'Draft': 1, 'Pending': 2, 'Rejected': 3, 'Approved': 4 };
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.groupName]) acc[item.groupName] = [];
      acc[item.groupName].push(item);
      return acc;
    }, {});
    
    Object.keys(grouped).forEach(group => {
      grouped[group].sort((a, b) => {
        const priorityA = statusPriority[a.status] || 5;
        const priorityB = statusPriority[b.status] || 5;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    });
    
    return grouped;
  }, [items]);

  const sections = useMemo(() => {
    const statusPriority = { 'Draft': 1, 'Pending': 2, 'Rejected': 3, 'Approved': 4 };
    const unsortedSections = Object.keys(groupedItems).map(group => ({
      title: group,
      data: groupedItems[group],
      total: groupedItems[group].reduce((s, i) => s + (i.effectiveTotalCost !== undefined ? i.effectiveTotalCost : (i.totalCost || 0)), 0),
      minPriority: Math.min(...groupedItems[group].map(i => statusPriority[i.status] || 5))
    }));

    return unsortedSections.sort((a, b) => {
      if (a.minPriority !== b.minPriority) return a.minPriority - b.minPriority;
      return a.title.localeCompare(b.title);
    });
  }, [groupedItems]);

  const grandTotal = useMemo(() => items.filter(i => i.status === 'Approved').reduce((sum, item) => sum + (item.effectiveTotalCost !== undefined ? item.effectiveTotalCost : (item.totalCost || 0)), 0), [items]);

  const renderSectionHeader = useCallback(({ section }) => (
    <View style={styles.groupHeader}>
      <View style={[styles.groupHeaderLeft, { flex: 1, marginRight: 10 }]}>
        <View style={styles.groupAccent} />
        <Text style={[styles.categoryTitle, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">{section.title}</Text>
      </View>
      <Text style={styles.groupTotal}>
        {project?.currency || '$'} {formatCompact(section.total)}
      </Text>
    </View>
  ), [project?.currency]);

  const renderItem = useCallback(({ item }) => (
    <BOQItem
      item={item}
      isSelectionMode={isSelectionMode}
      isSelected={selectedItems.includes(item._id)}
      canApprove={canApprove}
      canUpdate={canUpdate}
      canDelete={canDelete}
      onToggleSelection={toggleSelection}
      onOpenView={handleOpenView}
      onEdit={handleEditItem}
      onDelete={handleDeleteItem}
      onFetchHistory={fetchHistory}
      onSendForApproval={handleOpenApproverSelection}
      userId={user?._id}
      isAdmin={isAdmin}
      currency={project?.currency || '$'}
    />
  ), [isSelectionMode, selectedItems, canApprove, canUpdate, canDelete, toggleSelection, project?.currency]);

  if (loading) {
    return (
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 18, gap: 12 }}>
        <View style={{ width: 140, height: 20, backgroundColor: '#E2E8F0', borderRadius: 6, alignSelf: 'center', marginBottom: 16 }} />
        {[1, 2, 3, 4, 5].map((key) => (
          <View key={key} style={{ height: 85, backgroundColor: '#F1F5F9', borderRadius: 16 }} />
        ))}
      </View>
    );
  }

  if (!canView) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
        <Text style={{ fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 16 }}>Access Restricted</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', marginTop: 8 }}>
          You don't have permission to view the BOQ Management module.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={it => it._id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.tabScrollContent, { paddingHorizontal: 18, paddingTop: 8 }]}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            {isSelectionMode ? (
              <View style={styles.selectionHeader}>
                <View style={styles.selectionLeft}>
                  <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedItems([]); }}>
                    <Ionicons name="close" size={24} color="#0F172A" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.selectAllBtn}
                    onPress={handleSelectAll}
                  >
                    <Ionicons
                      name={selectedItems.length === items.length ? "checkbox" : "square-outline"}
                      size={20}
                      color="#3B82F6"
                    />
                    <Text style={styles.selectAllText}>All</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.selectionCount}>{selectedItems.length} Selected</Text>
                <View style={styles.selectionActions}>
                  {items.some(it => selectedItems.includes(it._id) && it.status === 'Draft') && (
                    <TouchableOpacity 
                      onPress={() => handleOpenApproverSelection(selectedItems.filter(id => items.find(it => it._id === id)?.status === 'Draft'))} 
                      style={[styles.selectionActionBtn, { backgroundColor: '#4F46E5' }]}
                    >
                      <Ionicons name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.bulkActionText}>Submit</Text>
                    </TouchableOpacity>
                  )}
                  {canApprove && items.some(it => selectedItems.includes(it._id) && it.status === 'Pending') && (
                    <TouchableOpacity onPress={handleBulkApprove} style={[styles.selectionActionBtn, styles.bulkApproveBtn]}>
                      <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                      <Text style={styles.bulkActionText}>Approve</Text>
                    </TouchableOpacity>
                  )}
                  {canDelete && (
                    <TouchableOpacity onPress={handleBulkDelete} style={[styles.selectionActionBtn, styles.bulkDeleteBtn]}>
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Bill of Quantities</Text>
                {canCreate && (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => {
                      resetForm();
                      setShowChoiceModal(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#3B82F6', '#3B82F6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.addBtnGradient}
                    >
                      <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.addBtnText}>Add BOQ</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        }
        ListFooterComponent={
          items.length > 0 ? (
            <View style={styles.grandTotalBox}>
              <Text style={styles.grandTotalLabel}>APPROVED GRAND TOTAL</Text>
              <Text style={styles.grandTotalValue} numberOfLines={1}>{project?.currency || '$'} {formatCompact(grandTotal)}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading && (
            <AdaptiveGlass intensity={10} tint="light" style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={40} color="#94A3B8" />
              <Text style={styles.emptyText}>No BOQ items added yet.</Text>
            </AdaptiveGlass>
          )
        }
        SectionSeparatorComponent={() => <View style={{ height: 10 }} />}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
      />

      {/* View Details Modal */}
      <ViewDetailsModal
        visible={showViewModal}
        onClose={() => setShowViewModal(false)}
        viewingHistory={viewingHistory}
        selectedVersionIdx={selectedVersionIdx}
        setSelectedVersionIdx={setSelectedVersionIdx}
        isAdmin={isAdmin}
        user={user}
        isSubmitting={isSubmitting}
        handleUpdateStatus={handleUpdateStatus}
        currency={project?.currency || '$'}
      />

      {/* Choice Modal */}
      <ChoiceModal
        visible={showChoiceModal}
        onClose={() => setShowChoiceModal(false)}
        onOpenManual={() => { setShowChoiceModal(false); setShowManualModal(true); }}
        handleExcelImport={handleExcelImport}
        isImporting={isImporting}
      />

      {/* Excel Preview Modal */}
      <ExcelPreviewModal
        visible={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        previewData={previewData}
        importFile={importFile}
        handleConfirmImport={handleConfirmImport}
        isSubmitting={isSubmitting}
        currency={project?.currency || '$'}
      />

      {/* Manual BOQ Entry Modal */}
      <ManualEntryModal
        visible={showManualModal}
        onClose={() => { setShowManualModal(false); resetForm(); }}
        editingItem={editingItem}
        formData={formData}
        setFormData={setFormData}
        handleManualSubmit={handleManualSubmit}
        isSubmitting={isSubmitting}
        errors={formErrors}
        existingGroups={Object.keys(groupedItems)}
      />

      {/* Price History Modal */}
      <HistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        loadingHistory={loadingHistory}
        historyItems={historyItems}
        currency={project?.currency || '$'}
      />

      <ConfirmModal 
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        isSubmitting={isSubmitting}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />

      {/* Approver List Modal */}
      <ApproverModal
        visible={showApproverModal}
        onClose={() => setShowApproverModal(false)}
        loadingApprovers={loadingApprovers}
        approvers={approvers}
        selectedApproverId={selectedApproverId}
        setSelectedApproverId={setSelectedApproverId}
        confirmSendForApproval={confirmSendForApproval}
        isSubmitting={isSubmitting}
      />

      {/* Budget Impact Modal */}
      <BudgetImpactModal
        visible={showBudgetImpactModal}
        onClose={() => setShowBudgetImpactModal(false)}
        budgetImpactData={budgetImpactData}
        handleUpdateStatus={handleUpdateStatus}
        isSubmitting={isSubmitting}
        currency={project?.currency || '$'}
      />

      {/* Rejection Reason Modal */}
      <RejectionReasonModal
        visible={showRejectionModal}
        onClose={() => { setShowRejectionModal(false); setPendingRejectionItemId(null); }}
        onConfirm={handleConfirmRejection}
        isSubmitting={isSubmitting}
      />
    </View>
  );
}

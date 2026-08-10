import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Modal, KeyboardAvoidingView,
  Platform, Alert, Dimensions
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useTranslation } from 'react-i18next';
import cloudinaryService from '../../services/cloudinaryService';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import ConfirmModal from '../../components/ConfirmModal';
import { hasAnyProjectPermissionPrefix, hasProjectPermission, isProjectLocked } from '../../utils/permissions';

export default function ProjectMaterialTab({ project, fetchProjectData }) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();
  const { materialAction } = useLocalSearchParams();
  const projectId = project?._id;

  const isAdmin = user?.role?.name === 'Admin';
  const isLocked = isProjectLocked(project);
  const canView = isAdmin || hasAnyProjectPermissionPrefix(user, project, 'inventory:');
  const canCreate = !isLocked && (isAdmin || hasProjectPermission(user, project, 'inventory:create'));
  const canUpdate = !isLocked && (isAdmin || hasProjectPermission(user, project, 'inventory:update'));
  const canDelete = !isLocked && (isAdmin || hasProjectPermission(user, project, 'inventory:delete'));
  const canApprove = !isLocked && (isAdmin || hasProjectPermission(user, project, 'inventory:approve'));

  useEffect(() => {
    if (materialAction === 'Used' && canCreate) {
      startBulkAction('Used');
    }
  }, [materialAction, canCreate]);

  const [materials, setMaterials] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [materialReceipts, setMaterialReceipts] = useState([]);
  const [materialUsages, setMaterialUsages] = useState([]);
  const [materialPurchases, setMaterialPurchases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All'); // 'All', 'Low Stock', 'Out of Stock'

  // Modals
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isStockModalVisible, setIsStockModalVisible] = useState(false);
  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);
  const [isBulkActionSheetVisible, setIsBulkActionSheetVisible] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [stockType, setStockType] = useState('In'); // 'In' or 'Out'
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [newMaterial, setNewMaterial] = useState({ name: '', unit: 'Bags', initialStock: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [stockUpdate, setStockUpdate] = useState({ quantity: '', note: '' });

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'default'
  });

  // Multi-select State
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isBulkModalVisible, setIsBulkModalVisible] = useState(false);
  const [bulkType, setBulkType] = useState('Request');
  const [editingRequestId, setEditingRequestId] = useState(null);
  
  // Dynamic Form State for Actions
  const [formItems, setFormItems] = useState([{ id: '1', materialId: '', quantity: '' }]);
  const [commonNote, setCommonNote] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [challanNumber, setChallanNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [locationOrTask, setLocationOrTask] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [advancePayment, setAdvancePayment] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isMaterialPickerVisible, setIsMaterialPickerVisible] = useState(false);
  const [activePickerRowId, setActivePickerRowId] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [isVendorPickerVisible, setIsVendorPickerVisible] = useState(false);

  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const startBulkAction = (type) => {
    setBulkType(type);
    setEditingRequestId(null);
    setFormItems([{ id: Date.now().toString(), materialId: '', quantity: '' }]);
    setCommonNote('');
    setVendorName('');
    setChallanNumber('');
    setInvoiceNumber('');
    setBillNumber('');
    setSelectedInvoice(null);
    setLocationOrTask('');
    setIsBulkModalVisible(true);
  };

  const generatePurchaseHTML = (purchaseData) => {
    const itemsHtml = purchaseData.items.map(item => {
      const mat = materials.find(m => m._id === item.materialId);
      return `
        <tr>
          <td>${mat ? mat.name : 'Unknown Material'}</td>
          <td style="text-align: center;">${item.quantity} ${item.unit}</td>
          <td style="text-align: right;">${project?.currency || '$'} ${Number(item.unitPrice).toFixed(2)}</td>
          <td style="text-align: right;">${project?.currency || '$'} ${Number(item.totalPrice).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    return `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #10B981; padding-bottom: 20px; }
            .title { color: #059669; font-size: 28px; font-weight: bold; }
            .table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            .table th { background: #ECFDF5; text-align: left; padding: 12px; border-bottom: 1px solid #D1FAE5; font-size: 12px; text-transform: uppercase; color: #065F46; }
            .table td { padding: 12px; border-bottom: 1px solid #F3F4F6; font-size: 14px; }
            .summary { margin-top: 30px; border-top: 2px solid #10B981; padding-top: 20px; }
            .summary-row { display: flex; justify-content: flex-end; margin-bottom: 8px; }
            .summary-label { width: 150px; text-align: right; color: #64748B; padding-right: 20px; }
            .summary-value { width: 100px; text-align: right; font-weight: bold; }
            .footer { margin-top: 50px; font-size: 12px; color: #94A3B8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">Sky-Lite</div>
              <div style="font-size: 14px; color: #64748B;">Material Purchase Order</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; font-size: 18px;">PURCHASE INVOICE</div>
              <div style="color: #64748B;">Date: ${new Date().toLocaleDateString()}</div>
            </div>
          </div>
          <div style="margin-top: 30px;">
            <div style="color: #64748B; font-size: 12px; text-transform: uppercase;">Vendor Details</div>
            <div style="font-size: 18px; font-weight: bold;">${purchaseData.vendorName}</div>
            <div style="font-size: 14px; color: #64748B;">PO Number: ${purchaseData.poNumber || 'N/A'}</div>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Material Name</th>
                <th style="text-align: center;">Quantity</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="summary">
            <div class="summary-row">
              <div class="summary-label">Grand Total:</div>
              <div class="summary-value">${project?.currency || '$'} ${purchaseData.grandTotal.toFixed(2)}</div>
            </div>
            <div class="summary-row">
              <div class="summary-label">Advance Paid:</div>
              <div class="summary-value" style="color: #059669;">${project?.currency || '$'} ${purchaseData.advancePayment.toFixed(2)}</div>
            </div>
            <div class="summary-row">
              <div class="summary-label" style="font-weight: bold; color: #1E293B;">Remaining Balance:</div>
              <div class="summary-value" style="color: #EF4444;">${project?.currency || '$'} ${purchaseData.remainingBalance.toFixed(2)}</div>
            </div>
          </div>
          <div class="footer">
            Generated via Sky-Lite Mobile App • Verified Purchase Record
          </div>
        </body>
      </html>
    `;
  };

  const generateReceiptHTML = (receiptData) => {
    const itemsHtml = receiptData.items.map(item => {
      const mat = materials.find(m => m._id === item.materialId);
      return `
        <tr>
          <td>${mat ? mat.name : 'Unknown Material'}</td>
          <td style="text-align: center;">${item.quantity} ${item.unit}</td>
        </tr>
      `;
    }).join('');

    return `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3B82F6; padding-bottom: 20px; }
            .title { color: #2563EB; font-size: 28px; font-weight: bold; }
            .table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            .table th { background: #EFF6FF; text-align: left; padding: 12px; border-bottom: 1px solid #DBEAFE; font-size: 12px; text-transform: uppercase; color: #1E40AF; }
            .table td { padding: 12px; border-bottom: 1px solid #F3F4F6; font-size: 14px; }
            .footer { margin-top: 100px; font-size: 12px; color: #94A3B8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">Sky-Lite</div>
              <div style="font-size: 14px; color: #64748B;">Material Delivery Receipt</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; font-size: 18px;">RECEIPT RECORD</div>
              <div style="color: #64748B;">Date: ${new Date().toLocaleDateString()}</div>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 30px;">
            <div>
              <div style="color: #64748B; font-size: 12px; text-transform: uppercase;">Vendor</div>
              <div style="font-size: 16px; font-weight: bold;">${receiptData.vendorName || 'N/A'}</div>
            </div>
            <div style="text-align: right;">
              <div style="color: #64748B; font-size: 12px; text-transform: uppercase;">Challan / Invoice #</div>
              <div style="font-size: 16px; font-weight: bold;">${receiptData.challanNumber || receiptData.invoiceNumber || 'N/A'}</div>
            </div>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Material Name</th>
                <th style="text-align: center;">Quantity Received</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div style="margin-top: 30px;">
            <div style="color: #64748B; font-size: 12px; text-transform: uppercase;">Notes</div>
            <div style="font-size: 14px;">${receiptData.commonNote || 'No notes provided.'}</div>
          </div>
          <div class="footer">
            Digitally Generated Receipt • Sky-Lite Project Management
          </div>
        </body>
      </html>
    `;
  };

  const addFormRow = () => {
    setFormItems([...formItems, { id: Date.now().toString(), materialId: '', quantity: '' }]);
  };

  const removeFormRow = (id) => {
    setFormItems(formItems.filter(item => item.id !== id));
  };

  const updateFormRow = (id, field, value) => {
    setFormItems(formItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const calculatePurchaseSummary = () => {
    const totalCost = formItems.reduce((acc, item) => {
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.unitPrice) || 0;
      return acc + (q * p);
    }, 0);
    const advance = parseFloat(advancePayment) || 0;
    const remaining = totalCost - advance;
    return { totalCost, advance, remaining };
  };

  const handleEditRequest = (req) => {
    setBulkType('Request');
    setEditingRequestId(req._id);
    setFormItems(req.items.map(item => ({
      id: Math.random().toString(),
      materialId: item.materialId?._id || item.materialId,
      quantity: item.quantity.toString(),
      unit: item.unit
    })));
    setCommonNote(req.commonNote || '');
    setIsBulkModalVisible(true);
  };

  const handleBulkSubmit = async () => {
    const itemsArray = formItems
      .filter(item => item.materialId && item.quantity && parseFloat(item.quantity) > 0)
      .map(item => ({
        materialId: item.materialId,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice) || 0
      }));

    if (itemsArray.length === 0) {
      showToast('Please provide a material and valid quantity for at least one item', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      let method = 'POST';
      let url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/materials/bulk-action`;
      
      if (bulkType === 'Request') {
        if (editingRequestId) {
          url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/material-requests/${editingRequestId}`;
          method = 'PATCH';
        } else {
           url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-requests`;
        }
      } else if (bulkType === 'Received') {
        url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-receipts`;
      } else if (bulkType === 'Used') {
        url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-usage`;
      } else if (bulkType === 'Purchase') {
        url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-purchase`;
      }

      setIsSubmitting(true);
      
      const payload = {
        type: bulkType,
        items: itemsArray,
        commonNote: commonNote || (['Request', 'Received', 'Used', 'Purchase'].includes(bulkType) ? '' : `Bulk ${bulkType} via App`)
      };

      if (bulkType === 'Received') {
        payload.vendorName = vendorName;
        payload.challanNumber = challanNumber;
        payload.invoiceNumber = invoiceNumber;
      } else if (bulkType === 'Used') {
        payload.locationOrTask = locationOrTask;
      } else if (bulkType === 'Purchase') {
        payload.vendorName = vendorName;
        payload.poNumber = poNumber;
        payload.billNumber = billNumber;
        payload.advancePayment = parseFloat(advancePayment) || 0;
        
        let grandTotal = 0;
        itemsArray.forEach(item => {
          grandTotal += (parseFloat(item.unitPrice) || 0) * (parseFloat(item.quantity) || 0);
        });
        payload.grandTotal = grandTotal;
        payload.remainingBalance = grandTotal - payload.advancePayment;
      }

      if (bulkType === 'Purchase' || bulkType === 'Received') {
        try {
          const html = bulkType === 'Purchase' ? generatePurchaseHTML(payload) : generateReceiptHTML(payload);
          const { uri } = await Print.printToFileAsync({ html });
          const fileName = `${bulkType.toLowerCase()}_inv_${Date.now()}.pdf`;
          const invoiceUrl = await cloudinaryService.uploadFile(uri, fileName, 'application/pdf');
          payload.invoiceUrl = invoiceUrl;
        } catch (printErr) {
          console.error("PDF Gen Error:", printErr);
        }
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsBulkModalVisible(false);
        setSelectedIds([]);
        setIsSelectionMode(false);
        setFormItems([{ id: '1', materialId: '', quantity: '' }]);
        setCommonNote('');
        setVendorName('');
        setChallanNumber('');
        setInvoiceNumber('');
        setLocationOrTask('');
        setEditingRequestId(null);
        
        if (bulkType === 'Request') {
          fetchMaterialRequests();
          setActiveFilter('Requests');
        } else if (bulkType === 'Received') {
          fetchMaterialReceipts();
          fetchMaterials();
          setActiveFilter('Receipts');
        } else if (bulkType === 'Used') {
          fetchMaterialUsages();
          fetchMaterials();
          setActiveFilter('Usage Logs');
        } else if (bulkType === 'Purchase') {
          fetchMaterialPurchases();
          setActiveFilter('Purchases');
        } else {
          fetchMaterials();
        }
        showToast(`${bulkType} recorded successfully.`, 'success');
      } else {
        const errorData = await response.json();
        showToast(errorData.message || 'Failed to submit action', 'error');
      }
    } catch (error) {
      console.error('Bulk submit error:', error);
      showToast(t('networkErrorLoadingMaterials'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchMaterials = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/materials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMaterials(data);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, token]);

  const fetchMaterialRequests = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMaterialRequests(data);
      }
    } catch (error) {
      console.error('Error fetching material requests:', error);
    }
  }, [projectId, token]);

  const fetchMaterialReceipts = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-receipts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMaterialReceipts(data);
      }
    } catch (error) {
      console.error('Error fetching material receipts:', error);
    }
  }, [projectId, token]);

  const fetchMaterialUsages = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-usage`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMaterialUsages(data);
      }
    } catch (error) {
      console.error('Error fetching material usage:', error);
    }
  }, [projectId, token]);

  const fetchMaterialPurchases = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-purchase`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMaterialPurchases(data);
      }
    } catch (error) {
      console.error('Error fetching material purchases:', error);
    }
  }, [projectId, token]);

  const fetchVendors = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/vendors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setVendors(data);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  }, [token]);

  useEffect(() => {
    if (projectId) {
      fetchMaterials();
      fetchMaterialRequests();
      fetchMaterialReceipts();
      fetchMaterialUsages();
      fetchMaterialPurchases();
      fetchVendors();
    }
  }, [projectId, fetchMaterials, fetchMaterialRequests, fetchMaterialReceipts, fetchMaterialUsages, fetchMaterialPurchases, fetchVendors]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      fetchMaterials();
      fetchMaterialRequests();
      fetchMaterialReceipts();
      fetchMaterialUsages();
      fetchMaterialPurchases();
    };
    socket.on('material:updated', refresh);
    return () => socket.off('material:updated', refresh);
  }, [socket, fetchMaterials, fetchMaterialRequests, fetchMaterialReceipts, fetchMaterialUsages, fetchMaterialPurchases]);

  const handleRequestAction = async (requestId, status) => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/material-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        fetchMaterialRequests();
        if (status === 'Fulfilled') fetchMaterials();
      } else {
        const err = await response.json();
        showToast(err.message || 'Update failed', 'error');
      }
    } catch (error) {
      console.error('Error updating request:', error);
    }
  };

  const handleReceiptAction = async (receiptId, status) => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/material-receipts/${receiptId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        fetchMaterialReceipts();
        if (status === 'Verified') fetchMaterials();
      } else {
        const err = await response.json();
        showToast(err.message || 'Update failed', 'error');
      }
    } catch (error) {
      console.error('Error updating receipt:', error);
    }
  };

  const handlePurchaseAction = async (purchaseId, status) => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-purchase/${purchaseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        fetchMaterialPurchases();
      } else {
        const err = await response.json();
        showToast(err.message || 'Update failed', 'error');
      }
    } catch (error) {
      console.error('Error updating purchase:', error);
    }
  };

  const handleDeleteRequest = (requestId) => {
    setConfirmModal({
      visible: true,
      title: 'Delete Request',
      message: 'Are you sure you want to delete this material request? This cannot be undone.',
      type: 'destructive',
      onConfirm: async () => {
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/material-requests/${requestId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) fetchMaterialRequests();
        } catch (error) {
          console.error('Error deleting request:', error);
        } finally {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const handleDeleteReceipt = (receiptId) => {
    setConfirmModal({
      visible: true,
      title: 'Delete Receipt',
      message: 'Are you sure you want to delete this material receipt? This cannot be undone.',
      type: 'destructive',
      onConfirm: async () => {
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/material-receipts/${receiptId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            fetchMaterialReceipts();
            showToast('Receipt deleted successfully', 'delete');
          }
        } catch (error) {
          console.error('Error deleting receipt:', error);
        } finally {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const handleDownloadInvoice = async (item, itemType) => {
    if (!item) return;
    try {
      let uriToShare = '';
      
      if (item.invoiceUrl) {
        const filename = item.invoiceUrl.split('/').pop() || 'document.pdf';
        const fileUri = FileSystem.cacheDirectory + filename;
        const downloadRes = await FileSystem.downloadAsync(item.invoiceUrl, fileUri);
        uriToShare = downloadRes.uri;
      } else {
        // Generate on-the-fly for old records
        showToast('Generating document...', 'info');
        const html = itemType === 'Purchase' ? generatePurchaseHTML(item) : generateReceiptHTML(item);
        const { uri } = await Print.printToFileAsync({ html });
        uriToShare = uri;
      }
      
      if (await Sharing.isAvailableAsync()) {
        showToast('Document ready, opening options...', 'success');
        await Sharing.shareAsync(uriToShare);
      } else {
        showToast('Sharing not available', 'error');
      }
    } catch (error) {
      console.error('Download error:', error);
      showToast('Failed to process document', 'error');
    }
  };

  const handleDeleteUsage = (usageId) => {
    setConfirmModal({
      visible: true,
      title: 'Delete Usage Log',
      message: 'Are you sure you want to delete this material usage log? This cannot be undone.',
      type: 'destructive',
      onConfirm: async () => {
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-usage/${usageId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            fetchMaterialUsages();
            fetchMaterials();
            showToast('Usage log deleted and stock restored', 'delete');
          }
        } catch (error) {
          console.error('Error deleting usage:', error);
        } finally {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const handleDeletePurchase = (purchaseId) => {
    setConfirmModal({
      visible: true,
      title: 'Delete Purchase Log',
      message: 'Are you sure you want to delete this material purchase log? This cannot be undone.',
      type: 'destructive',
      onConfirm: async () => {
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-purchase/${purchaseId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            fetchMaterialPurchases();
            showToast('Purchase log deleted successfully', 'delete');
          }
        } catch (error) {
          console.error('Error deleting purchase:', error);
        } finally {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const handleAddMaterial = async () => {
    if (!newMaterial.name.trim() || !newMaterial.unit.trim()) {
      showToast('Please provide a name and unit', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const url = isEditing 
        ? `${process.env.EXPO_PUBLIC_API_BASE_URL}/materials/${selectedMaterial._id}`
        : `${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/materials`;
      
      const method = isEditing ? 'PATCH' : 'POST';
      const body = isEditing 
        ? { name: newMaterial.name, unit: newMaterial.unit }
        : { ...newMaterial, initialStock: parseFloat(newMaterial.initialStock) || 0 };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setNewMaterial({ name: '', unit: 'Bags', initialStock: '' });
        setIsAddModalVisible(false);
        setIsEditing(false);
        
        // Refresh everything to ensure name changes reflect in history/logs
        fetchMaterials();
        fetchMaterialRequests();
        fetchMaterialReceipts();
        fetchMaterialUsages();
        fetchMaterialPurchases();
        
        showToast(`Material ${isEditing ? 'updated' : 'added'} successfully`, 'success');
      } else {
        const errorData = await response.json();
        showToast(errorData.message || `Failed to ${isEditing ? 'update' : 'add'} material`, 'error');
      }
    } catch (error) {
      console.error('Error adding/editing material:', error);
      showToast(t('networkError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStock = async () => {
    if (!stockUpdate.quantity || parseFloat(stockUpdate.quantity) <= 0) {
      showToast('Please provide a valid quantity', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/materials/${selectedMaterial._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: stockType,
          quantity: parseFloat(stockUpdate.quantity),
          note: stockUpdate.note
        })
      });

      if (response.ok) {
        setStockUpdate({ quantity: '', note: '' });
        setIsStockModalVisible(false);
        fetchMaterials();
      }
    } catch (error) {
      console.error('Error updating stock:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMaterial = (material) => {
    setConfirmModal({
      visible: true,
      title: 'Delete Material',
      message: `Are you sure you want to remove ${material.name} from inventory? This action cannot be undone.`,
      type: 'destructive',
      onConfirm: async () => {
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/materials/${material._id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            fetchMaterials();
            showToast('Material deleted successfully', 'delete');
          }
        } catch (error) {
          console.error('Error deleting material:', error);
        } finally {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const getHistoryLogs = () => {
    let allLogs = [];
    materials.forEach(material => {
      if (material.logs && material.logs.length > 0) {
        material.logs.forEach(log => {
          allLogs.push({ ...log, materialName: material.name, materialUnit: material.unit });
        });
      }
    });
    return allLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'Received': return '#10B981';
      case 'Used': return '#F97316';
      case 'Request': return '#0EA5E9';
      case 'Purchase': return '#8B5CF6';
      default: return '#3B82F6';
    }
  };

  const getLogIcon = (type) => {
    switch (type) {
      case 'Received': return 'download';
      case 'Used': return 'upload';
      case 'Request': return 'file-text';
      case 'Purchase': return 'shopping-cart';
      default: return 'box';
    }
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const balance = m.totalReceived - m.totalConsumed;
    
    if (activeFilter === 'Low Stock') return matchesSearch && balance > 0 && balance < 10;
    if (activeFilter === 'Out of Stock') return matchesSearch && balance <= 0;
    return matchesSearch;
  });

  if (isLoading && materials.length === 0) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!canView) {
    // Rendered inside the parent's shared ScrollView (unlike BOQ/Milestone,
    // which render full-screen), so flex:1 has no height to center within.
    // Give it an explicit height approximating the visible content area so
    // it visually centers at the same position as BOQ's "Access Restricted".
    const { height: screenHeight } = Dimensions.get('window');
    return (
      <View style={{ height: screenHeight - 250, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
        <Text style={{ fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 16 }}>Access Restricted</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', marginTop: 8 }}>
          You don't have permission to view the Material Management module.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Material Management</Text>
        {canCreate && (
          <TouchableOpacity
            style={styles.smallAddBtn}
            onPress={() => setIsAddModalVisible(true)}
          >
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.smallAddBtnText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search materials..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        {canCreate && (
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setIsBulkActionSheetVisible(true)}
          >
            <Ionicons name="options" size={20} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
        {['All', 'Low Stock', 'Out of Stock', 'Requests', 'Purchases', 'Receipts', 'Usage Logs', 'Log History'].map(filter => (
          <TouchableOpacity
            key={filter}
            onPress={() => setActiveFilter(filter)}
            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeFilter === 'Requests' ? (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {materialRequests.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="inbox" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>No material requests found</Text>
            </View>
          ) : (
            materialRequests.map(req => (
              <View key={req._id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View style={[styles.historyIcon, { backgroundColor: req.status === 'Pending' ? '#FEF08A' : req.status === 'Approved' ? '#BAE6FD' : req.status === 'Fulfilled' ? '#D1FAE5' : '#FECDD3' }]}>
                    <Feather name="file-text" size={20} color={req.status === 'Pending' ? '#CA8A04' : req.status === 'Approved' ? '#0284C7' : req.status === 'Fulfilled' ? '#059669' : '#E11D48'} />
                  </View>
                  <View style={styles.historyTitleBox}>
                    <Text style={styles.historyType}>Request #{req._id.slice(-6).toUpperCase()}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.historyDate}>{new Date(req.createdAt).toLocaleDateString()}</Text>
                      {req.invoiceUrl && <Feather name="image" size={12} color="#3B82F6" />}
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: req.status === 'Pending' ? '#FEF08A' : req.status === 'Approved' ? '#BAE6FD' : req.status === 'Fulfilled' ? '#D1FAE5' : '#FECDD3' }]}>
                    <Text style={[styles.statusText, { color: req.status === 'Pending' ? '#CA8A04' : req.status === 'Approved' ? '#0284C7' : req.status === 'Fulfilled' ? '#059669' : '#E11D48' }]}>{req.status}</Text>
                  </View>
                  {(canUpdate || canDelete) && (
                    <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
                      {req.status === 'Pending' && canUpdate && (
                        <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleEditRequest(req)}>
                          <Feather name="edit-3" size={14} color="#3B82F6" />
                        </TouchableOpacity>
                      )}
                      {canDelete && (
                        <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleDeleteRequest(req._id)}>
                          <Feather name="trash-2" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
                
                <View style={styles.historyContent}>
                  {req.items.map((item, idx) => (
                    <View key={idx} style={styles.reqItemRow}>
                      <Text style={styles.reqItemName}>{item.materialId?.name || 'Unknown'}</Text>
                      <Text style={styles.reqItemQty}>{item.quantity} {item.unit}</Text>
                    </View>
                  ))}
                  {req.commonNote ? <Text style={styles.historyNote}>{req.commonNote}</Text> : null}
                  <View style={styles.historyUserBox}>
                    <View style={styles.historyUserIcon}>
                      <Feather name="user" size={10} color="#64748B" />
                    </View>
                    <Text style={styles.historyUserText}>Requested by {req.requestedByName}</Text>
                  </View>
                  
                  {/* Action Buttons — require the actual granted permission, not a hardcoded role name */}
                  {(canApprove || canUpdate) ? (
                    <View style={styles.reqActionRow}>
                      {req.status === 'Pending' && canApprove && (
                        <>
                          <TouchableOpacity style={[styles.reqBtn, { backgroundColor: '#10B981' }]} onPress={() => handleRequestAction(req._id, 'Approved')}>
                            <Text style={styles.reqBtnText}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.reqBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleRequestAction(req._id, 'Rejected')}>
                            <Text style={styles.reqBtnText}>Reject</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {req.status === 'Approved' && canUpdate && (
                        <TouchableOpacity style={[styles.reqBtn, { backgroundColor: '#3B82F6', width: '100%' }]} onPress={() => handleRequestAction(req._id, 'Fulfilled')}>
                          <Text style={styles.reqBtnText}>Mark Fulfilled</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : activeFilter === 'Receipts' ? (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {materialReceipts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="truck" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>No material receipts found</Text>
            </View>
          ) : (
            materialReceipts.map(rec => (
              <View key={rec._id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View style={[styles.historyIcon, { backgroundColor: rec.status === 'Pending Verification' ? '#FEF08A' : rec.status === 'Verified' ? '#D1FAE5' : '#FECDD3' }]}>
                    <Feather name="truck" size={20} color={rec.status === 'Pending Verification' ? '#CA8A04' : rec.status === 'Verified' ? '#059669' : '#E11D48'} />
                  </View>
                  <View style={styles.historyTitleBox}>
                    <Text style={styles.historyType}>Receipt #{rec._id.slice(-6).toUpperCase()}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.historyDate}>{new Date(rec.createdAt).toLocaleDateString()}</Text>
                      <TouchableOpacity onPress={() => handleDownloadInvoice(rec, 'Receipt')} style={styles.txDownloadIconBtn}>
                        <Feather name="download-cloud" size={16} color="#3B82F6" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: rec.status === 'Pending Verification' ? '#FEF08A' : rec.status === 'Verified' ? '#D1FAE5' : '#FECDD3' }]}>
                    <Text style={[styles.statusText, { color: rec.status === 'Pending Verification' ? '#CA8A04' : rec.status === 'Verified' ? '#059669' : '#E11D48' }]}>{rec.status}</Text>
                  </View>
                  {canDelete && (
                    <TouchableOpacity onPress={() => handleDeleteReceipt(rec._id)} style={{ marginLeft: 8 }}>
                      <Feather name="trash-2" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                
                <View style={styles.historyContent}>
                  <View style={styles.historyMetaBox}>
                    {rec.vendorName ? (
                      <View style={styles.historyMetaRow}>
                        <Feather name="truck" size={12} color="#64748B" />
                        <Text style={styles.historyMetaText}>{rec.vendorName}</Text>
                      </View>
                    ) : null}
                    {rec.challanNumber ? (
                      <View style={styles.historyMetaRow}>
                        <Feather name="hash" size={12} color="#64748B" />
                        <Text style={styles.historyMetaText}>Challan: {rec.challanNumber}</Text>
                      </View>
                    ) : null}
                  </View>
                  
                  <View style={{ marginTop: 8 }}>
                    {rec.items.map((item, idx) => (
                      <View key={idx} style={styles.reqItemRow}>
                        <Text style={styles.reqItemName}>{item.materialId?.name || 'Unknown'}</Text>
                        <Text style={styles.reqItemQty}>{item.quantity} {item.unit}</Text>
                      </View>
                    ))}
                  </View>

                  {rec.commonNote ? <Text style={styles.historyNote}>{rec.commonNote}</Text> : null}
                  <View style={styles.historyUserBox}>
                    <View style={styles.historyUserIcon}>
                      <Feather name="user" size={10} color="#64748B" />
                    </View>
                    <Text style={styles.historyUserText}>Received by {rec.receivedByName}</Text>
                  </View>
                  
                  {/* Action Buttons */}
                  {canApprove ? (
                    <View style={styles.reqActionRow}>
                      {rec.status === 'Pending Verification' && (
                        <>
                          <TouchableOpacity style={[styles.reqBtn, { backgroundColor: '#10B981' }]} onPress={() => handleReceiptAction(rec._id, 'Verified')}>
                            <Text style={styles.reqBtnText}>Verify</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.reqBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleReceiptAction(rec._id, 'Rejected')}>
                            <Text style={styles.reqBtnText}>Reject</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : activeFilter === 'Purchases' ? (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {materialPurchases.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="shopping-cart" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>No material purchases found</Text>
            </View>
          ) : (
            materialPurchases.map(purchase => (
              <View key={purchase._id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View style={[styles.historyIcon, { backgroundColor: purchase.status === 'Pending Approval' ? '#FEF08A' : purchase.status === 'Approved' ? '#D1FAE5' : '#FECDD3' }]}>
                    <Feather name="shopping-cart" size={20} color={purchase.status === 'Pending Approval' ? '#CA8A04' : purchase.status === 'Approved' ? '#059669' : '#E11D48'} />
                  </View>
                  <View style={styles.historyTitleBox}>
                    <Text style={styles.historyType}>Purchase #{purchase._id.slice(-6).toUpperCase()}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.historyDate}>{new Date(purchase.createdAt).toLocaleDateString()}</Text>
                      <TouchableOpacity onPress={() => handleDownloadInvoice(purchase, 'Purchase')} style={styles.txDownloadIconBtn}>
                        <Feather name="download-cloud" size={16} color="#3B82F6" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: purchase.status === 'Pending Approval' ? '#FEF08A' : purchase.status === 'Approved' ? '#D1FAE5' : '#FECDD3' }]}>
                    <Text style={[styles.statusText, { color: purchase.status === 'Pending Approval' ? '#CA8A04' : purchase.status === 'Approved' ? '#059669' : '#E11D48' }]}>{purchase.status}</Text>
                  </View>
                  {canDelete && (
                    <TouchableOpacity style={[styles.actionIconBtn, { marginLeft: 8 }]} onPress={() => handleDeletePurchase(purchase._id)}>
                      <Feather name="trash-2" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                
                <View style={styles.historyContent}>
                  <View style={styles.historyMetaBox}>
                    {purchase.vendorName ? (
                      <View style={styles.historyMetaRow}>
                        <Feather name="truck" size={12} color="#64748B" />
                        <Text style={styles.historyMetaText}>{purchase.vendorName}</Text>
                      </View>
                    ) : null}
                    {purchase.poNumber ? (
                      <View style={styles.historyMetaRow}>
                        <Feather name="hash" size={12} color="#64748B" />
                        <Text style={styles.historyMetaText}>PO: {purchase.poNumber}</Text>
                      </View>
                    ) : null}
                  </View>
                  
                  <View style={{ marginTop: 4 }}>
                    {purchase.items.map((item, idx) => (
                      <View key={idx} style={styles.reqItemRow}>
                        <Text style={styles.reqItemName}>{item.materialId?.name || 'Unknown'}</Text>
                        <Text style={styles.reqItemQty}>{item.quantity} {item.unit} @ ${item.unitPrice}</Text>
                      </View>
                    ))}
                  </View>
                  
                  <View style={styles.financialSummaryBox}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total Cost</Text>
                      <Text style={styles.summaryValueTotal}>{project?.currency || '$'} {purchase.grandTotal}</Text>
                    </View>
                    <View style={styles.summaryRowDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Advance Paid</Text>
                      <Text style={styles.summaryValueAdvance}>{project?.currency || '$'} {purchase.advancePayment}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Remaining</Text>
                      <Text style={styles.summaryValueRemaining}>{project?.currency || '$'} {purchase.remainingBalance}</Text>
                    </View>
                  </View>

                  {purchase.commonNote ? <Text style={styles.historyNote}>{purchase.commonNote}</Text> : null}
                  <View style={styles.historyUserBox}>
                    <View style={styles.historyUserIcon}>
                      <Feather name="user" size={10} color="#64748B" />
                    </View>
                    <Text style={styles.historyUserText}>Purchased by {purchase.purchasedByName}</Text>
                  </View>
                  
                  {canApprove ? (
                    <View style={styles.reqActionRow}>
                      {purchase.status === 'Pending Approval' && (
                        <>
                          <TouchableOpacity style={[styles.reqBtn, { backgroundColor: '#10B981' }]} onPress={() => handlePurchaseAction(purchase._id, 'Approved')}>
                            <Text style={styles.reqBtnText}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.reqBtn, { backgroundColor: '#EF4444' }]} onPress={() => handlePurchaseAction(purchase._id, 'Rejected')}>
                            <Text style={styles.reqBtnText}>Reject</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : activeFilter === 'Usage Logs' ? (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {materialUsages.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="activity" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>No material usage logs found</Text>
            </View>
          ) : (
            materialUsages.map(usage => (
              <View key={usage._id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View style={[styles.historyIcon, { backgroundColor: '#FFEDD5' }]}>
                    <Feather name="upload" size={20} color="#F97316" />
                  </View>
                  <View style={styles.historyTitleBox}>
                    <Text style={styles.historyType}>Usage #{usage._id.slice(-6).toUpperCase()}</Text>
                    <Text style={styles.historyDate}>{new Date(usage.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5' }]}>
                    <Text style={[styles.statusText, { color: '#059669' }]}>Logged</Text>
                  </View>
                  {canDelete && (
                    <TouchableOpacity onPress={() => handleDeleteUsage(usage._id)} style={{ marginLeft: 8 }}>
                      <Feather name="trash-2" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                
                <View style={styles.historyContent}>
                  {usage.locationOrTask ? <Text style={styles.receiptVendorText}>Task/Location: {usage.locationOrTask}</Text> : null}
                  
                  <View style={{ marginTop: 8 }}>
                    {usage.items.map((item, idx) => (
                      <View key={idx} style={styles.reqItemRow}>
                        <Text style={styles.reqItemName}>{item.materialId?.name || 'Unknown'}</Text>
                        <Text style={styles.reqItemQty}>{item.quantity} {item.unit}</Text>
                      </View>
                    ))}
                  </View>

                  {usage.commonNote ? <Text style={styles.historyNote}>{usage.commonNote}</Text> : null}
                  <View style={styles.historyUserBox}>
                    <Feather name="user" size={12} color="#94A3B8" />
                    <Text style={styles.historyUserText}>Logged by {usage.usedByName}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : activeFilter === 'Log History' ? (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {getHistoryLogs().length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="clock" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>No material history found</Text>
            </View>
          ) : (
            getHistoryLogs().map((log, index) => (
              <View key={index} style={styles.logRow}>
                <View style={[styles.logIconBox, { backgroundColor: getLogColor(log.type) + '15' }]}>
                  <Feather name={getLogIcon(log.type)} size={18} color={getLogColor(log.type)} />
                </View>
                
                <View style={styles.logInfo}>
                  <Text style={styles.logMaterial} numberOfLines={1}>{log.materialName}</Text>
                  <View style={styles.logMetaRow}>
                    <Text style={[styles.logType, { color: getLogColor(log.type) }]}>{log.type}</Text>
                    <Text style={styles.logDot}>•</Text>
                    <Text style={styles.logDate}>{new Date(log.date).toLocaleDateString()}</Text>
                  </View>
                  {log.note ? <Text style={styles.logNote} numberOfLines={1}>{log.note}</Text> : null}
                </View>
                
                <View style={styles.logRightSide}>
                  <Text style={[styles.logQty, { color: getLogColor(log.type) }]}>
                    {log.type === 'Used' ? '-' : '+'}{log.quantity} {log.materialUnit}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Feather name="user" size={10} color="#94A3B8" />
                    <Text style={{ fontSize: 11, fontFamily: 'Inter-Medium', color: '#94A3B8', marginLeft: 4 }}>
                      {log.updatedByName?.split(' ')[0] || 'System'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
      <View style={styles.materialGrid}>
        {filteredMaterials.map((material) => {
          const balance = material.totalReceived - material.totalConsumed;
          const progress = material.totalReceived > 0 ? (material.totalConsumed / material.totalReceived) : 0;
          const isSelected = selectedIds.includes(material._id);
          
          return (
            <TouchableOpacity 
              activeOpacity={0.9} 
              key={material._id}
              onPress={() => {
                if (isSelectionMode) {
                  toggleSelection(material._id);
                }
              }}
              style={[styles.materialCard, isSelected && styles.materialCardSelected]}
            >
                <View style={styles.materialIconBox}>
                  <Feather name="box" size={20} color="#0EA5E9" />
                </View>
                
                <View style={styles.materialInfo}>
                  <Text style={styles.materialName} numberOfLines={1}>{material.name}</Text>
                  <View style={styles.materialMetaRow}>
                    <Text style={styles.materialMetaText}>In: {material.totalReceived}</Text>
                    <Text style={styles.materialMetaDot}>•</Text>
                    <Text style={styles.materialMetaText}>Used: {material.totalConsumed}</Text>
                  </View>
                </View>

                <View style={styles.materialRightSide}>
                  <View style={[styles.balancePill, { backgroundColor: balance <= 0 ? '#FEF2F2' : '#F0FDF4' }]}>
                    <Text style={[styles.balancePillText, { color: balance <= 0 ? '#EF4444' : '#16A34A' }]}>
                      {balance} {material.unit}
                    </Text>
                  </View>
                  
                  {!isSelectionMode && (
                    <View style={styles.cardActions}>
                      <TouchableOpacity 
                        style={styles.actionIconBtn}
                        onPress={() => {
                          setSelectedMaterial(material);
                          setNewMaterial({ 
                            name: material.name, 
                            unit: material.unit, 
                            initialStock: '0' 
                          });
                          setIsEditing(true);
                          setIsAddModalVisible(true);
                        }}
                      >
                        <Feather name="edit-3" size={13} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.actionIconBtn}
                        onPress={() => handleDeleteMaterial(material)}
                      >
                        <Feather name="trash-2" size={13} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
            </TouchableOpacity>
          );
        })}
        {filteredMaterials.length === 0 && (
          <View style={styles.emptyBox}>
            <Feather name="box" size={40} color="#CBD5E1" />
            <Text style={styles.emptyText}>No materials found</Text>
          </View>
        )}
      </View>
      )}

      {/* Bulk Action Sheet */}
      <Modal visible={isBulkActionSheetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            onPress={() => setIsBulkActionSheetVisible(false)} 
          />
          <AdaptiveGlass intensity={95} tint="light" style={styles.actionSheetContent}>
            <View style={styles.actionSheetHeader}>
              <View style={styles.dragHandle} />
              <Text style={styles.actionSheetTitle}>Project Stock Actions</Text>
              <Text style={styles.actionSheetSub}>Update multiple materials at once</Text>
            </View>

            <View style={styles.actionOptions}>
              {(canCreate ? [
                { id: 'Request', icon: 'file-text', color: '#0EA5E9', title: 'Material Request', sub: 'Request multiple items for site' },
                { id: 'Received', icon: 'download', color: '#10B981', title: 'Material Received', sub: 'Record delivery for multiple items' },
                { id: 'Used', icon: 'upload', color: '#F97316', title: 'Material Used', sub: 'Log daily consumption for all' },
                { id: 'Purchase', icon: 'shopping-cart', color: '#8B5CF6', title: 'Material Purchase', sub: 'Record purchases for all items' }
              ] : []).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.actionOptionRow}
                  onPress={() => {
                    setIsBulkActionSheetVisible(false);
                    startBulkAction(item.id);
                  }}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: `${item.color}15` }]}>
                    <Feather name={item.icon} size={22} color={item.color} />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionOptionTitle}>{item.title}</Text>
                    <Text style={styles.actionOptionSub}>{item.sub}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => setIsBulkActionSheetVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </AdaptiveGlass>
        </View>
      </Modal>

      {/* Dynamic Form Action Modal */}
      <Modal visible={isBulkModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{bulkType} Materials</Text>
                <Text style={styles.modalSub}>Add items and enter details below</Text>
              </View>
              <TouchableOpacity onPress={() => setIsBulkModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {formItems.map((item, index) => {
                const selectedMat = materials.find(m => m._id === item.materialId);
                return (
                  <View key={item.id} style={styles.formRowCard}>
                    <View style={styles.formRowHeader}>
                      <Text style={styles.formRowTitle}>Item {index + 1}</Text>
                      {formItems.length > 1 && (
                        <TouchableOpacity onPress={() => removeFormRow(item.id)}>
                          <Feather name="trash-2" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={styles.label}>Select Material</Text>
                    <TouchableOpacity 
                      style={styles.pickerButton} 
                      onPress={() => {
                        setActivePickerRowId(item.id);
                        setIsMaterialPickerVisible(true);
                      }}
                    >
                      <Text style={[styles.pickerButtonText, !selectedMat && { color: '#94A3B8' }]}>
                        {selectedMat ? `${selectedMat.name} (${selectedMat.unit})` : 'Choose a material...'}
                      </Text>
                      <Feather name="chevron-down" size={18} color="#64748B" />
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}>
                        <Text style={styles.label}>Quantity</Text>
                        <TextInput
                          style={[styles.input, { height: 48 }]}
                          placeholder="0"
                          keyboardType="numeric"
                          value={item.quantity}
                          onChangeText={(val) => updateFormRow(item.id, 'quantity', val)}
                        />
                      </View>
                      {bulkType === 'Purchase' && (
                        <View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}>
                          <Text style={styles.label}>Unit Price </Text>
                          <TextInput
                            style={[styles.input, { height: 48 }]}
                            placeholder="0.00"
                            keyboardType="numeric"
                            value={item.unitPrice}
                            onChangeText={(val) => updateFormRow(item.id, 'unitPrice', val)}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
              
              <TouchableOpacity style={styles.addRowBtn} onPress={addFormRow}>
                <Feather name="plus" size={18} color="#3B82F6" />
                <Text style={styles.addRowBtnText}>Add Another Item</Text>
              </TouchableOpacity>

              {bulkType === 'Used' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Location / Task Name (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 1st Floor Slab Casting"
                    value={locationOrTask}
                    onChangeText={setLocationOrTask}
                  />
                </View>
              )}

              {bulkType === 'Purchase' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Vendor Name</Text>
                    <TouchableOpacity 
                      style={styles.pickerButton} 
                      onPress={() => setIsVendorPickerVisible(true)}
                    >
                      <Text style={[styles.pickerButtonText, !vendorName && { color: '#94A3B8' }]}>
                        {vendorName || 'Choose a vendor...'}
                      </Text>
                      <Feather name="chevron-down" size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>PO Number (Optional)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="PO-1029"
                        value={poNumber}
                        onChangeText={setPoNumber}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Advance Paid </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0.00"
                        keyboardType="numeric"
                        value={advancePayment}
                        onChangeText={setAdvancePayment}
                      />
                    </View>
                  </View>

                  <View style={styles.financialSummaryBox}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total Estimated Cost:</Text>
                      <Text style={styles.summaryValueTotal}>{project?.currency || '$'} {calculatePurchaseSummary().totalCost.toFixed(2)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Advance Paid:</Text>
                      <Text style={styles.summaryValueAdvance}>{project?.currency || '$'} {calculatePurchaseSummary().advance.toFixed(2)}</Text>
                    </View>
                    <View style={styles.summaryRowDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabelBold}>Remaining Balance:</Text>
                      <Text style={styles.summaryValueRemaining}>{project?.currency || '$'} {calculatePurchaseSummary().remaining.toFixed(2)}</Text>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Bill / Invoice Number</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., BILL-789"
                      value={billNumber}
                      onChangeText={setBillNumber}
                    />
                  </View>
                </>
              )}

              {bulkType === 'Received' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Vendor Name (Optional)</Text>
                    <TouchableOpacity 
                      style={styles.pickerButton} 
                      onPress={() => setIsVendorPickerVisible(true)}
                    >
                      <Text style={[styles.pickerButtonText, !vendorName && { color: '#94A3B8' }]}>
                        {vendorName || 'Choose a vendor...'}
                      </Text>
                      <Feather name="chevron-down" size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Challan Number</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., CHL-102"
                        value={challanNumber}
                        onChangeText={setChallanNumber}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Invoice Number</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., INV-456"
                        value={invoiceNumber}
                        onChangeText={setInvoiceNumber}
                      />
                    </View>
                  </View>
                </>
              )}

              {(bulkType === 'Purchase' || bulkType === 'Received') && (
                <View style={styles.autoGenBanner}>
                  <Feather name="file-text" size={20} color="#3B82F6" />
                  <Text style={styles.autoGenText}>A digital {bulkType === 'Purchase' ? 'Invoice' : 'Receipt'} will be automatically generated</Text>
                </View>
              )}
              
              <View style={[styles.inputGroup, { marginBottom: 30 }]}>
                <Text style={styles.label}>Common Note / Description</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                  placeholder="Enter a description for all requested items..."
                  multiline
                  value={commonNote}
                  onChangeText={setCommonNote}
                />
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={[styles.submitBtn, { backgroundColor: bulkType === 'Received' ? '#10B981' : '#3B82F6' }]} 
              onPress={handleBulkSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Submit {bulkType}</Text>}
            </TouchableOpacity>
          </View>

          {/* Inline Material Picker Overlay */}
          {isMaterialPickerVisible && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' }]}>
              <View style={[styles.modalContent, { height: '60%' }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Material</Text>
                  <TouchableOpacity onPress={() => setIsMaterialPickerVisible(false)} style={styles.closeBtn}>
                    <Feather name="x" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {materials.map(mat => (
                    <TouchableOpacity 
                      key={mat._id} 
                      style={styles.pickerOption}
                      onPress={() => {
                        updateFormRow(activePickerRowId, 'materialId', mat._id);
                        setIsMaterialPickerVisible(false);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>{mat.name}</Text>
                      <Text style={styles.pickerOptionSub}>{mat.unit}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Inline Vendor Picker Overlay */}
          {isVendorPickerVisible && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' }]}>
              <View style={[styles.modalContent, { height: '60%' }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Vendor</Text>
                  <TouchableOpacity onPress={() => setIsVendorPickerVisible(false)} style={styles.closeBtn}>
                    <Feather name="x" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {vendors.map(vendor => (
                    <TouchableOpacity 
                      key={vendor._id} 
                      style={styles.pickerOption}
                      onPress={() => {
                        setVendorName(vendor.name);
                        setIsVendorPickerVisible(false);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>{vendor.name}</Text>
                      {vendor.contactPerson ? <Text style={styles.pickerOptionSub}>{vendor.contactPerson}</Text> : null}
                    </TouchableOpacity>
                  ))}
                  {vendors.length === 0 && (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>No vendors found. Please add vendors in Vendor Management.</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          )}

        </KeyboardAvoidingView>
      </Modal>

      {/* Action Sheet */}
      <Modal visible={isActionSheetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            onPress={() => setIsActionSheetVisible(false)} 
          />
          <AdaptiveGlass intensity={95} tint="light" style={styles.actionSheetContent}>
            <View style={styles.actionSheetHeader}>
              <View style={styles.dragHandle} />
              <Text style={styles.actionSheetTitle}>Inventory Actions</Text>
              <Text style={styles.actionSheetSub}>{selectedMaterial?.name}</Text>
            </View>

            <View style={styles.actionOptions}>
              {(canCreate ? [
                { id: 'Request', icon: 'file-text', color: '#0EA5E9', title: 'Material Request', sub: 'Request materials from warehouse' },
                { id: 'Received', icon: 'download', color: '#10B981', title: 'Material Received', sub: 'Record incoming site delivery' },
                { id: 'Used', icon: 'upload', color: '#F97316', title: 'Material Used', sub: 'Log daily site consumption' },
                { id: 'Purchase', icon: 'shopping-cart', color: '#8B5CF6', title: 'Material Purchase', sub: 'Record new vendor purchase' },
              ] : []).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.actionOptionRow}
                  onPress={() => {
                    setIsActionSheetVisible(false);
                    if (item.id === 'Delete') {
                      handleDeleteMaterial(selectedMaterial);
                    } else if (item.id === 'Edit') {
                      setNewMaterial({ 
                        name: selectedMaterial.name, 
                        unit: selectedMaterial.unit, 
                        initialStock: '0' 
                      });
                      setIsEditing(true);
                      setIsAddModalVisible(true);
                    } else {
                      setStockType(item.id);
                      setIsStockModalVisible(true);
                    }
                  }}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: `${item.color}15` }]}>
                    <Feather name={item.icon} size={22} color={item.color} />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionOptionTitle}>{item.title}</Text>
                    <Text style={styles.actionOptionSub}>{item.sub}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => setIsActionSheetVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </AdaptiveGlass>
        </View>
      </Modal>

      {/* Add Material Modal */}
      <Modal visible={isAddModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Material' : 'Add New Material'}</Text>
              <TouchableOpacity onPress={() => {
                setIsAddModalVisible(false);
                setIsEditing(false);
                setNewMaterial({ name: '', unit: 'Bags', initialStock: '' });
              }} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Material Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., UltraTech Cement"
                value={newMaterial.name}
                onChangeText={(t) => setNewMaterial({ ...newMaterial, name: t })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Select Unit</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroll}>
                {['Bags', 'kg', 'Tons', 'Nos', 'Sq.Ft', 'Cu.Ft', 'Liters', 'Meters'].map(u => (
                  <TouchableOpacity
                    key={u}
                    onPress={() => setNewMaterial({ ...newMaterial, unit: u })}
                    style={[styles.unitChip, newMaterial.unit === u && styles.unitChipActive]}
                  >
                    <Text style={[styles.unitText, newMaterial.unit === u && styles.unitTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {!isEditing && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Initial Stock</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={newMaterial.initialStock}
                  onChangeText={(t) => setNewMaterial({ ...newMaterial, initialStock: t })}
                />
              </View>
            )}

            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleAddMaterial}
              disabled={isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>{isEditing ? 'Update Material' : 'Create Material'}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Stock Update Modal */}
      <Modal visible={isStockModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Stock {stockType}</Text>
              <TouchableOpacity onPress={() => setIsStockModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.targetMaterial}>{selectedMaterial?.name}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Quantity ({selectedMaterial?.unit})</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter quantity"
                keyboardType="numeric"
                value={stockUpdate.quantity}
                onChangeText={(t) => setStockUpdate({ ...stockUpdate, quantity: t })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Note (Optional)</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                placeholder="e.g., Received from warehouse"
                multiline
                value={stockUpdate.note}
                onChangeText={(t) => setStockUpdate({ ...stockUpdate, note: t })}
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitBtn, { backgroundColor: stockType === 'In' ? '#10B981' : '#EA580C' }]} 
              onPress={handleUpdateStock}
              disabled={isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Confirm {stockType}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText="Delete"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },
  loadingBox: { padding: 40, alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { fontSize: 22, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginBottom: 4 },
  smallAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  smallAddBtnText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  header: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A', height: '100%' },
  menuBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  addBtn: { width: 52, height: 52, backgroundColor: '#3B82F6', borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  
  filterBar: { marginBottom: 20, maxHeight: 40 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  filterText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B' },
  filterTextActive: { color: '#FFF' },

  materialGrid: { gap: 12 },
  materialCard: { padding: 16, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 4 },
  materialCardSelected: { borderColor: '#3B82F6', backgroundColor: '#F0F7FF' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  titleBox: { flex: 1 },
  
  selectToggle: { width: 52, height: 52, backgroundColor: '#F1F5F9', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  selectToggleActive: { backgroundColor: '#0F172A' },

  bulkBar: { position: 'absolute', bottom: 30, left: 20, right: 20, padding: 16, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  bulkCount: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFF' },
  bulkManageBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#3B82F6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  bulkManageText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFF' },

  formScroll: { flex: 1, marginBottom: 20 },
  formRowCard: { backgroundColor: '#F8FAFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  formRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  formRowTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  pickerButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, height: 48, marginBottom: 16 },
  pickerButtonText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A' },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#3B82F6', borderRadius: 16, marginBottom: 20, backgroundColor: '#EFF6FF' },
  addRowBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#3B82F6', marginLeft: 8 },
  pickerOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  pickerOptionText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  pickerOptionSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B' },
  modalSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 4 },
  materialName: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  materialUnit: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionIconBtn: { width: 28, height: 28, backgroundColor: '#F8FAFF', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  historyHeader: { flexDirection: 'row', alignItems: 'center' },
  historyIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  historyTitleBox: { flex: 1 },
  historyType: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  historyDate: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },
  historyQuantity: { fontSize: 14, fontFamily: 'Inter-Bold' },
  historyContent: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  historyMaterialName: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 4 },
  historyNote: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', backgroundColor: '#F8FAFF', padding: 8, borderRadius: 8, marginBottom: 8 },
  
  logRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  logIconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  logInfo: { flex: 1, justifyContent: 'center' },
  logMaterial: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginBottom: 4 },
  logMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logType: { fontSize: 11, fontFamily: 'Inter-Bold' },
  logDot: { fontSize: 11, color: '#CBD5E1' },
  logDate: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' },
  logNote: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#94A3B8', marginTop: 4 },
  logRightSide: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 12 },
  logQty: { fontSize: 14, fontFamily: 'Inter-Bold', marginBottom: 4 },

  historyUserBox: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginTop: 8 },
  historyUserIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  historyUserText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#475569' },
  historyMetaBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  historyMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyMetaText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontFamily: 'Inter-Bold' },
  reqItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, backgroundColor: '#F8FAFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#EFF6FF' },
  reqItemName: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1E293B' },
  reqItemQty: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#3B82F6' },
  reqActionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  reqBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  reqBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFF' },
  receiptVendorText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 2 },
  receiptChallanText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginBottom: 6 },

  materialCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  materialIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0F9FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  materialInfo: { flex: 1, justifyContent: 'center' },
  materialMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  materialMetaText: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' },
  materialMetaDot: { fontSize: 11, color: '#CBD5E1' },
  materialRightSide: { alignItems: 'flex-end', justifyContent: 'center' },
  balancePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  balancePillText: { fontSize: 11, fontFamily: 'Inter-Bold' },
  cardActions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  actionIconBtn: { width: 28, height: 28, backgroundColor: '#F8FAFF', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  // Action Sheet Styles
  actionSheetContent: { width: '100%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, marginTop: 'auto', paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  actionSheetHeader: { alignItems: 'center', marginBottom: 24 },
  dragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginBottom: 16 },
  actionSheetTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A' },
  actionSheetSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 4 },
  actionOptions: { gap: 12, marginBottom: 24 },
  actionOptionRow: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  actionIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  actionTextCol: { flex: 1 },
  actionOptionTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#1E293B' },
  actionOptionSub: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },
  cancelBtn: { height: 56, backgroundColor: '#F1F5F9', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#64748B' },

  emptyBox: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#94A3B8', marginTop: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#F1F5F9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  targetMaterial: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#3B82F6', marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#475569', marginBottom: 8 },
  input: { backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, paddingHorizontal: 16, height: 52, fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A' },
  row: { flexDirection: 'row' },
  submitBtn: { height: 56, backgroundColor: '#3B82F6', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  submitBtnText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFF' },

  financialSummaryBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  summaryRowDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 6 },
  summaryLabel: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B' },
  summaryLabelBold: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  summaryValueTotal: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  summaryValueAdvance: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#10B981' },
  summaryValueRemaining: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#EF4444' },

  unitScroll: { flexDirection: 'row', marginTop: 4 },
  unitChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  unitChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  unitText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#64748B' },
  unitTextActive: { color: '#FFF' },

  txDocBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#DBEAFE' },
  txDocText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#3B82F6' },

  autoGenBanner: { backgroundColor: '#F0F7FF', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
  autoGenText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#1E293B' },
});

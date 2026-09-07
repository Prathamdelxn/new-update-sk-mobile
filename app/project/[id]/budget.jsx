import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import ConfirmModal from '../../components/ConfirmModal';
import { formatCompact } from '../../utils/format';
import { useTranslation } from 'react-i18next';
import { hasProjectPermission, isProjectLocked } from '../../utils/permissions';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function ProjectBudgetTab({ project, fetchProjectData }) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();

  const [isProcessing, setIsProcessing] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestReason, setRequestReason] = useState('');

  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: null,
    type: 'default'
  });

  useEffect(() => {
    if (!socket || !fetchProjectData) return;
    socket.on('budget:updated', fetchProjectData);
    return () => {
      socket.off('budget:updated', fetchProjectData);
    };
  }, [socket, fetchProjectData]);

  const isLocked = isProjectLocked(project);
  const canApproveBudget = !isLocked && hasProjectPermission(user, project, 'budget:approve');
  const pendingRequests = project?.budgetHistory?.filter(bh => bh.approvalStatus === 'Pending') || [];

  const handleBudgetAction = (budgetId, action) => {
    setConfirmModal({
      visible: true,
      title: `${action} Budget`,
      message: `Are you sure you want to ${action.toLowerCase()} this budget request?`,
      confirmText: action,
      type: action === 'Approved' ? 'success' : 'destructive',
      onConfirm: async () => {
        try {
          setIsProcessing(true);
          const res = await fetch(`${API_BASE_URL}/projects/${project._id}/budget-action`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ budgetId, action })
          });

          if (res.ok) {
            showToast(`Budget ${action.toLowerCase()} successfully`, 'success');
            if (fetchProjectData) await fetchProjectData();
          } else {
            const err = await res.json();
            showToast(err.message || 'Action failed', 'error');
          }
        } catch (e) {
          showToast(t('networkError', 'Network Error'), 'error');
        } finally {
          setIsProcessing(false);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const handleRequestBudget = async () => {
    if (!requestAmount || isNaN(requestAmount) || Number(requestAmount) <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    if (!requestReason.trim()) {
      showToast('Please provide a reason', 'error');
      return;
    }

    try {
      setIsProcessing(true);
      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/budget-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: Number(requestAmount),
          reason: requestReason
        })
      });

      if (res.ok) {
        showToast('Budget request submitted successfully', 'success');
        setShowRequestModal(false);
        setRequestAmount('');
        setRequestReason('');
        if (fetchProjectData) await fetchProjectData();
      } else {
        const err = await res.json();
        showToast(err.message || 'Failed to submit request', 'error');
      }
    } catch (e) {
      showToast(t('networkError', 'Network Error'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentBudget = project?.budgetHistory?.length ? project.budgetHistory[project.budgetHistory.length - 1].amount : 0;

  return (
    <View style={styles.container}>
      
      {/* Top Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerSubtitle}>{t('totalBudget', 'Total Budget').toUpperCase()}</Text>
          <Text style={styles.headerTitle} adjustsFontSizeToFit numberOfLines={1}>
            {project?.currency || '$'} {formatCompact(currentBudget)}
          </Text>
        </View>
        {!isLocked && (
          <TouchableOpacity 
            style={styles.requestButton} 
            onPress={() => setShowRequestModal(true)}
          >
            <Ionicons name="add-circle" size={18} color="#FFF" />
            <Text style={styles.requestButtonText}>{t('requestChange', 'Request Change')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pending Requests Alert */}
      {canApproveBudget && pendingRequests.length > 0 && (
        <AdaptiveGlass intensity={40} tint="light" style={styles.pendingBudgetBanner}>
          <View style={styles.pendingHeader}>
            <Ionicons name="notifications" size={20} color="#DC2626" />
            <Text style={styles.pendingTitle}>{t('pendingBudgetTitle', { count: pendingRequests.length })}</Text>
          </View>
          <Text style={styles.pendingDesc}>{t('newBudgetRequests', 'You have budget modification requests awaiting your approval.')}</Text>
        </AdaptiveGlass>
      )}

      {/* History List */}
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>{t('budgetLifecycle', 'Budget Lifecycle')}</Text>
        <ScrollView style={styles.histList} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          {project?.budgetHistory?.slice().reverse().map((bh, i) => (
            <View key={i} style={styles.histItem}>
              <View style={styles.histTop}>
                <Text style={styles.histAmt}>{project?.currency || '$'} {formatCompact(bh.amount)}</Text>
                <View style={[
                  styles.histStatus,
                  bh.approvalStatus === 'Pending' && styles.statusPending,
                  bh.approvalStatus === 'Rejected' && styles.statusRejected
                ]}>
                  <Text style={[
                    styles.histStatusText,
                    bh.approvalStatus === 'Pending' && styles.statusPendingText,
                    bh.approvalStatus === 'Rejected' && styles.statusRejectedText
                  ]}>
                    {bh.approvalStatus || t('approved', 'Approved')}
                  </Text>
                </View>
              </View>
              <Text style={styles.histReason}>{bh.reason}</Text>
              
              {bh.approvalStatus === 'Pending' && canApproveBudget && (
                <View style={styles.histActionRow}>
                  <TouchableOpacity 
                    style={[styles.miniActionBtn, styles.rejectBtn]} 
                    onPress={() => handleBudgetAction(bh._id, 'Rejected')}
                    disabled={isProcessing}
                  >
                    <Text style={styles.rejectBtnText}>{t('reject', 'Reject')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.miniActionBtn, styles.approveBtn]} 
                    onPress={() => handleBudgetAction(bh._id, 'Approved')}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.approveBtnText}>{t('approve', 'Approve')}</Text>}
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.histFooter}>
                <Text style={styles.histMeta}>
                  {bh.updatedByName || 'System'} • {new Date(bh.timestamp).toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))}
          {(!project?.budgetHistory || project.budgetHistory.length === 0) && (
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>{t('noUpdatesFound', 'No budget updates found.')}</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Request Modal */}
      <Modal visible={showRequestModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} onPress={() => setShowRequestModal(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('requestBudget', 'Request Budget Change')}</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('newAmount', 'New Total Amount')}</Text>
              <View style={styles.currencyInputContainer}>
                <Text style={styles.currencySymbol}>{project?.currency || '$'}</Text>
                <TextInput
                  style={styles.currencyInput}
                  value={requestAmount}
                  onChangeText={setRequestAmount}
                  placeholder="e.g. 500000"
                  keyboardType="numeric"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('reason', 'Reason for Change')}</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={requestReason}
                onChangeText={setRequestReason}
                placeholder={t('reasonPlaceholder', 'Explain why the budget needs to change...')}
                multiline
                textAlignVertical="top"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleRequestBudget}
              disabled={isProcessing}
            >
              {isProcessing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>{t('submitRequest', 'Submit Request')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmModal 
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        isSubmitting={isProcessing}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 20 },
  headerBanner: { 
    backgroundColor: '#3B82F6', 
    borderRadius: 24, 
    padding: 24, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  headerLeft: { flex: 1, paddingRight: 10 },
  headerSubtitle: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#DBEAFE', letterSpacing: 1, marginBottom: 4 },
  headerTitle: { fontSize: 32, fontFamily: 'Inter-Black', color: '#FFFFFF' },
  requestButton: { 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  requestButtonText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  
  pendingBudgetBanner: { padding: 20, borderRadius: 24, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', marginBottom: 20 },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pendingTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#991B1B' },
  pendingDesc: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#B91C1C', lineHeight: 18 },

  listContainer: { flex: 1 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 16 },
  
  histList: { flex: 1 },
  histItem: { padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF', marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  histAmt: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A' },
  histStatus: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  histStatusText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#16A34A', textTransform: 'uppercase' },
  statusPending: { backgroundColor: '#FEF9C3' },
  statusPendingText: { color: '#CA8A04' },
  statusRejected: { backgroundColor: '#FEE2E2' },
  statusRejectedText: { color: '#DC2626' },
  
  histReason: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#475569', lineHeight: 20, marginBottom: 16 },
  
  histActionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  miniActionBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  rejectBtnText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#DC2626' },
  approveBtn: { backgroundColor: '#10B981' },
  approveBtnText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFF' },
  
  histFooter: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  histMeta: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#94A3B8' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { marginTop: 12, fontSize: 14, fontFamily: 'Inter-Medium', color: '#94A3B8' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalDismiss: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  modalContent: { width: '100%', backgroundColor: '#FFF', borderRadius: 28, padding: 24, shadowColor: '#000', shadowOffset: {width:0, height:10}, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A' },
  
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B', marginBottom: 8 },
  currencyInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 16, height: 56 },
  currencySymbol: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A', marginRight: 8 },
  currencyInput: { flex: 1, fontSize: 16, fontFamily: 'Inter-Medium', color: '#0F172A', height: '100%' },
  
  textInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 16, fontSize: 15, fontFamily: 'Inter-Regular', color: '#0F172A' },
  textArea: { height: 100 },
  
  submitBtn: { backgroundColor: '#3B82F6', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter-Bold' }
});

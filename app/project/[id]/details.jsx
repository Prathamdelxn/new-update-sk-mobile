import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import ConfirmModal from '../../components/ConfirmModal';
import { formatCompact } from '../../utils/format';
import { useTranslation } from 'react-i18next';
import { hasProjectPermission, isProjectLocked } from '../../utils/permissions';
import { useRouter } from 'expo-router';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function ProjectDetailsTab({ project, fetchProjectData }) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();
  const router = useRouter();

  useEffect(() => {
    if (!socket || !fetchProjectData) return;
    socket.on('project:updated', fetchProjectData);
    socket.on('budget:updated', fetchProjectData);
    return () => {
      socket.off('project:updated', fetchProjectData);
      socket.off('budget:updated', fetchProjectData);
    };
  }, [socket, fetchProjectData]);

  const [showBudgetHist, setShowBudgetHist] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modern Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: null,
    type: 'default'
  });

  const handleOpenAddMember = () => {
    router.push(`/project/${project._id}/add-member`);
  };

  const myProjectMember = project?.members?.find(m => m.user?._id === user?.id || m.user === user?.id);
  const isLocked = isProjectLocked(project);
  const canUpdate = !isLocked && hasProjectPermission(user, project, 'projects:update');
  const canApproveBudget = !isLocked && hasProjectPermission(user, project, 'budget:approve');
  const pendingRequests = project?.budgetHistory?.filter(bh => bh.approvalStatus === 'Pending') || [];

  const calculateDaysRemaining = () => {
    if (!project?.endDate) return 'N/A';
    const end = new Date(project.endDate);
    const now = new Date();
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

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
          showToast(t('networkError'), 'error');
        } finally {
          setIsProcessing(false);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  return (
    <View style={styles.tabScrollContent}>
      {project?.siteSurveyor && project?.status === 'Site Survey' ? (
        <AdaptiveGlass intensity={10} tint="light" style={styles.surveyBanner}>
          <View style={styles.surveyBannerIcon}>
            <Ionicons name="compass" size={24} color="#3B82F6" />
          </View>
          <View style={styles.surveyBannerTextContainer}>
            <Text style={styles.surveyBannerTitle}>{t('activeSiteSurvey')}</Text>
            <Text style={styles.surveyBannerDesc}>{t('assignedTo')}<Text style={{fontFamily: 'Inter-Bold', color: '#0F172A'}}>{project.siteSurveyor.name || t('siteSurveyor')}</Text></Text>
          </View>
        </AdaptiveGlass>
      ) : null}

      {canApproveBudget && pendingRequests.length > 0 && (
        <AdaptiveGlass intensity={40} tint="light" style={styles.pendingBudgetBanner}>
          <View style={styles.pendingHeader}>
            <Ionicons name="notifications" size={20} color="#DC2626" />
            <Text style={styles.pendingTitle}>{t('pendingBudgetTitle', { count: pendingRequests.length })}</Text>
          </View>
          <Text style={styles.pendingDesc}>{t('newBudgetRequests')}</Text>
          <TouchableOpacity 
            style={styles.viewPendingBtn}
            onPress={() => setShowBudgetHist(true)}
          >
            <Text style={styles.viewPendingText}>{t('viewRequests')}</Text>
            <Ionicons name="arrow-forward" size={14} color="#DC2626" />
          </TouchableOpacity>
        </AdaptiveGlass>
      )}

      {project?.status === 'Under Snagging' && (
        <AdaptiveGlass intensity={20} tint="light" style={styles.snaggingBanner}>
          <View style={styles.snaggingBannerIcon}>
            <Ionicons name="construct" size={24} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.snaggingBannerTitle}>{t('projectUnderSnagging')}</Text>
            <Text style={styles.snaggingBannerDesc}>{t('qualityInspectionProgress')}</Text>
          </View>
          <TouchableOpacity 
            style={styles.snaggingActionBtn}
            onPress={() => Alert.alert(t('snaggingMode'), t('checkHandoverTab'))}
          >
            <Ionicons name="chevron-forward" size={20} color="#D97706" />
          </TouchableOpacity>
        </AdaptiveGlass>
      )}

      {project?.status === 'Snagging Completed' && (
        <AdaptiveGlass intensity={20} tint="light" style={[styles.snaggingBanner, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
          <View style={[styles.snaggingBannerIcon, { backgroundColor: '#FFF', borderColor: '#86EFAC' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.snaggingBannerTitle, { color: '#15803D' }]}>{t('snaggingCompleted')}</Text>
            <Text style={[styles.snaggingBannerDesc, { color: '#16A34A' }]}>{t('inspectionPhaseFinished')}</Text>
          </View>
        </AdaptiveGlass>
      )}

      <View style={styles.bentoGrid}>
        <AdaptiveGlass intensity={30} tint="light" style={[styles.bentoCard, styles.bentoHero]}>
          <View style={styles.heroTop}>
            <View style={{flexDirection: 'row', gap: 8}}>
              <View style={styles.statusChip}>
                <Text style={styles.statusChipText}>{project?.status || t('planning', 'Planning')}</Text>
              </View>
              <View style={[styles.statusChip, {backgroundColor: '#F0F9FF'}]}>
                <Text style={[styles.statusChipText, {color: '#2563EB'}]}>{project?.category?.name || 'General'}</Text>
              </View>
            </View>
            {/* <TouchableOpacity style={styles.roundEdit}>
              <Ionicons name="create-outline" size={18} color="#3B82F6" />
            </TouchableOpacity> */}
          </View>
          <Text style={styles.heroTitle}>{project?.name || ''}{project?.projectCode ? <Text style={{ fontSize: 14, color: '#64748B', fontFamily: 'Inter-Medium' }}> ({project.projectCode})</Text> : null}</Text>
          <View style={styles.locRow}>
            <Ionicons name="location" size={14} color="#64748B" />
            <Text style={styles.locText}>{project?.description || t('globalSite')}</Text>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.footerCol}>
              <Text style={styles.fLabel}>{t('startDate').toUpperCase()}</Text>
              <Text style={styles.fVal}>
                {project?.startDate ? new Date(project.startDate).toLocaleDateString() : t('nA')}
              </Text>
            </View>
            <View style={styles.footerCol}>
              <Text style={styles.fLabel}>{t('targetDate').toUpperCase()}</Text>
              <Text style={styles.fVal}>
                {project?.endDate ? new Date(project.endDate).toLocaleDateString() : t('nA')}
              </Text>
            </View>
          </View>
        </AdaptiveGlass>

        <TouchableOpacity
          style={styles.bentoCard}
          onPress={() => setShowBudgetHist(true)}
          activeOpacity={0.8}
        >
          <View style={styles.bentoHeader}>
            <Text style={styles.bentoLabel}>{t('totalBudget').toUpperCase()}</Text>
            <Ionicons name="time-outline" size={14} color="#64748B" />
          </View>
          <Text style={styles.bentoDigit} numberOfLines={2} adjustsFontSizeToFit>
            {project?.currency || '$'} {formatCompact(project?.budgetHistory?.[project.budgetHistory.length - 1]?.amount || 0)}
          </Text>
          <Text style={styles.bentoSub}>{t('latestApproved')}</Text>
        </TouchableOpacity>

        <View style={styles.bentoCard}>
          <Text style={styles.bentoLabel}>{t('daysRemaining').toUpperCase()}</Text>
          <Text style={styles.bentoDigit}>
            {calculateDaysRemaining() !== 'N/A' ? `${calculateDaysRemaining()} ${t('days', 'days')}` : 'N/A'}
          </Text>
          <Text style={styles.bentoSub}>{t('targetHandover')}</Text>
        </View>

        <View style={styles.bentoCard}>
          <View style={styles.bentoHeader}>
            <Text style={styles.bentoLabel}>{t('projectArea', 'PROJECT AREA').toUpperCase()}</Text>
            <Ionicons name="map-outline" size={14} color="#64748B" />
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text style={styles.bentoDigit}>
                {project?.area ? `${project.area.toLocaleString()} ${project.areaUnit ? project.areaUnit.toUpperCase() : 'SQFT'}` : t('nA', 'N/A')}
              </Text>
              <Text style={styles.bentoSub}>{t('totalSiteArea', 'Total Site Area')}</Text>
            </View>

            {project?.siteLocation?.latitude != null && project?.siteLocation?.longitude != null && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#EFF6FF',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4
                }}
                onPress={() => {
                  const lat = project.siteLocation.latitude;
                  const lng = project.siteLocation.longitude;
                  const url = Platform.OS === 'ios' ? `maps:0,0?q=${lat},${lng}` : `geo:0,0?q=${lat},${lng}`;
                  Linking.openURL(url);
                }}
              >
                <Ionicons name="navigate" size={14} color="#3B82F6" />
                <Text style={{ fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#3B82F6' }}>Map</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <AdaptiveGlass intensity={20} tint="light" style={[styles.bentoCard, styles.bentoWide]}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
            <Text style={[styles.bentoLabel, {marginBottom: 0}]}>{t('coordinationTeam').toUpperCase()}</Text>
            {canApproveBudget && (
              <TouchableOpacity onPress={handleOpenAddMember} style={styles.addMemberBtnSmall}>
                <Ionicons name="add" size={16} color="#3B82F6" />
                <Text style={styles.addMemberBtnText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.teamStack}>
            <View style={styles.tMember}>
              <View style={styles.circleAvatar}>
                <Text style={styles.cAvText}>{(project?.createdBy?.name || 'S').charAt(0)}</Text>
              </View>
              <View style={styles.tInfo}>
                <Text style={styles.tName}>{project?.createdBy?.name || t('manager')}</Text>
                <Text style={[styles.tRole, { color: '#3B82F6', fontFamily: 'Inter-Bold', fontSize: 10, marginTop: 2, marginBottom: 1 }]}>Admin</Text>
                <Text style={styles.tRole}>{project?.createdBy?.email || t('adminCreator')}</Text>
              </View>
            </View>
            {project?.members
              ?.filter(m => m.user?.email !== project?.createdBy?.email)
              // Skip members whose user was deleted from the DB (m.user is null/undefined) —
              // these would otherwise render as a fake "User"/'U' placeholder entry with no
              // way to remove them, since member removal isn't implemented yet. Remove this
              // filter once member removal ships and deleted-user records are cleaned up.
              .filter(m => !!m.user)
              .map((m, i) => (
              <View key={i} style={styles.tMember}>
                <View style={[styles.circleAvatar, { backgroundColor: '#F1F5F9' }]}>
                  <Text style={[styles.cAvText, { color: '#64748B' }]}>{m.user?.name?.charAt(0) || 'U'}</Text>
                </View>
                <View style={styles.tInfo}>
                  <Text style={styles.tName}>{m.user?.name || t('user')}</Text>
                  <Text style={styles.tRole}>{m.role?.name || m.user?.email}</Text>
                </View>
              </View>
            ))}
          </View>
        </AdaptiveGlass>
      </View>



      {/* BUDGET HISTORY MODAL */}
      <Modal visible={showBudgetHist} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} onPress={() => setShowBudgetHist(false)} />
          <AdaptiveGlass intensity={40} tint="light" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('budgetLifecycle')}</Text>
              <TouchableOpacity onPress={() => setShowBudgetHist(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.histList} showsVerticalScrollIndicator={false}>
              {project?.budgetHistory?.slice().reverse().map((bh, i) => (
                <View key={i} style={styles.histItem}>
                  <View style={styles.histTop}>
                    <Text style={styles.histAmt}>{project?.currency || '$'} {formatCompact(bh.amount)}</Text>
                    <View style={styles.histStatus}>
                      <Text style={styles.histStatusText}>{bh.approvalStatus || t('approved')}</Text>
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
                        <Text style={styles.rejectBtnText}>{t('reject')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.miniActionBtn, styles.approveBtn]} 
                        onPress={() => handleBudgetAction(bh._id, 'Approved')}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.approveBtnText}>{t('approve')}</Text>}
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
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#94A3B8', fontFamily: 'Inter-Medium' }}>
                  {t('noUpdatesFound')}
                </Text>
              )}
            </ScrollView>
          </AdaptiveGlass>
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
  tabScrollContent: { gap: 24, paddingBottom: 20 },
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  bentoCard: { 
    flex: 1, 
    minWidth: '45%', 
    borderRadius: 28, 
    padding: 22, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    backgroundColor: 'rgba(255, 255, 255, 0.85)'
  },
  bentoHero: { minWidth: '100%', padding: 24 },
  bentoWide: { minWidth: '100%', marginTop: 10 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statusChip: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusChipText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#3B82F6', textTransform: 'uppercase' },
  roundEdit: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3B82F620' },
  heroTitle: { fontSize: 22, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 8 },
  locRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 24 },
  locText: { flex: 1, fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', lineHeight: 20 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#FFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  footerCol: { gap: 4 },
  fLabel: { fontSize: 9, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },
  fVal: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  bentoLabel: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#94A3B8', letterSpacing: 1, marginBottom: 16 },
  bentoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  bentoDigit: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },
  bentoSub: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 4 },
  teamStack: { gap: 14 },
  tMember: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleAvatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  cAvText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter-SemiBold' },
  tInfo: { flex: 1 },
  tName: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  tRole: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: '60%', backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#64748B', marginBottom: 24 },
  histList: { flex: 1 },
  histItem: { padding: 16, borderRadius: 20, backgroundColor: '#F8FAFF', marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  histAmt: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#3B82F6' },
  histStatus: { backgroundColor: '#BBF7D0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  histStatusText: { fontSize: 9, fontFamily: 'Inter-SemiBold', color: '#15803D', textTransform: 'uppercase' },
  histReason: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#475569', lineHeight: 18, marginBottom: 12 },
  histFooter: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10 },
  histMeta: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  surveyBanner: { padding: 18, borderRadius: 24, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  surveyBannerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  surveyBannerTextContainer: { flex: 1 },
  surveyBannerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: 1 },
  surveyBannerDesc: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#3B82F6', marginTop: 4 },
  pendingBudgetBanner: { padding: 20, borderRadius: 24, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pendingTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#991B1B' },
  pendingDesc: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#B91C1C', lineHeight: 18, marginBottom: 12 },
  viewPendingBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewPendingText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#DC2626' },
  histActionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  miniActionBtn: { flex: 1, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  rejectBtnText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#DC2626' },
  approveBtn: { backgroundColor: '#059669' },
  approveBtnText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#FFF' },
  
  snaggingBanner: { padding: 18, borderRadius: 24, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FEF3C7', backgroundColor: '#FFFBEB', marginBottom: 10 },
  snaggingBannerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWeight: 1, borderColor: '#FDE68A' },
  snaggingBannerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#B45309', textTransform: 'uppercase', letterSpacing: 1 },
  snaggingBannerDesc: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#D97706', marginTop: 4 },
  snaggingActionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  // Add Member specifics
  addMemberBtnSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  addMemberBtnText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#3B82F6', marginLeft: 4 },

});

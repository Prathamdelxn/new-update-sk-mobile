import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, Alert, Linking, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import ConfirmModal from '../../components/ConfirmModal';
import { formatCompact, formatCurrency } from '../../utils/format';
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

  const [isProcessing, setIsProcessing] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [selectedApproverId, setSelectedApproverId] = useState(null);
  const [budgetApprovers, setBudgetApprovers] = useState([]);
  const [isLoadingApprovers, setIsLoadingApprovers] = useState(false);

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
    socket.on('project:updated', fetchProjectData);
    socket.on('budget:updated', fetchProjectData);
    return () => {
      socket.off('project:updated', fetchProjectData);
      socket.off('budget:updated', fetchProjectData);
    };
  }, [socket, fetchProjectData]);

  const fetchBudgetApprovers = async () => {
    try {
      setIsLoadingApprovers(true);
      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/budget-approvers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        const approvers = data.approvers || [];
        setBudgetApprovers(approvers);
        if (approvers.length > 0) {
          setSelectedApproverId(approvers[0]._id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingApprovers(false);
    }
  };

  const handleOpenRequestModal = () => {
    setRequestAmount('');
    setRequestReason('');
    fetchBudgetApprovers();
    setShowRequestModal(true);
  };

  const handleOpenAddMember = () => {
    router.push(`/project/${project._id}/add-member`);
  };

  const isLocked = isProjectLocked(project);
  const canApproveBudget = !isLocked && hasProjectPermission(user, project, 'budget:approve');
  const pendingRequests = project?.budgetHistory?.filter(bh => bh.approvalStatus === 'Pending') || [];
  const currentBudget = project?.budgetHistory?.length ? project.budgetHistory[project.budgetHistory.length - 1].amount : (project?.budget || 0);

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
          reason: requestReason,
          approverId: selectedApproverId || undefined
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

  return (
    <View style={styles.tabScrollContent}>
      {/* Site Survey Status Banner */}
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

      {/* Pending Budget Alert Banner */}
      {pendingRequests.length > 0 && (
        <AdaptiveGlass intensity={20} tint="light" style={styles.pendingBudgetBanner}>
          <View style={styles.pendingHeader}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <Text style={styles.pendingTitle}>Pending Budget Change Request</Text>
          </View>
          <Text style={styles.pendingDesc}>
            {pendingRequests.length} pending budget modification request awaiting review.
          </Text>
          <TouchableOpacity 
            style={styles.viewPendingBtn}
            onPress={() => setShowHistoryModal(true)}
          >
            <Text style={styles.viewPendingText}>View & Take Action</Text>
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

      {/* Bento Grid */}
      <View style={styles.bentoGrid}>
        {/* Bento Card 1: Project Details Hero */}
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

        {/* Bento Card 2: Total Budget */}
        <TouchableOpacity 
          style={[styles.bentoCard, pendingRequests.length > 0 && { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' }]} 
          onPress={() => setShowHistoryModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.bentoHeader}>
            <Text style={styles.bentoLabel}>{t('totalBudget').toUpperCase()}</Text>
            <Ionicons name="time-outline" size={14} color={pendingRequests.length > 0 ? "#DC2626" : "#64748B"} />
          </View>
          <Text style={[styles.bentoDigit, pendingRequests.length > 0 && { color: '#B91C1C' }]} numberOfLines={2} adjustsFontSizeToFit>
            {project?.currency || '$'} {formatCompact(currentBudget)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={styles.bentoSub}>{pendingRequests.length > 0 ? 'Pending Request' : t('latestApproved')}</Text>
            <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
          </View>
        </TouchableOpacity>

        {/* Bento Card 3: Days Remaining */}
        <View style={styles.bentoCard}>
          <Text style={styles.bentoLabel}>{t('daysRemaining').toUpperCase()}</Text>
          <Text style={styles.bentoDigit}>
            {calculateDaysRemaining() !== 'N/A' ? `${calculateDaysRemaining()} ${t('days', 'days')}` : 'N/A'}
          </Text>
          <Text style={styles.bentoSub}>{t('targetHandover')}</Text>
        </View>

        {/* Bento Card 4: Project Area */}
        <View style={styles.bentoCard}>
          <View style={styles.bentoHeader}>
            <Text style={styles.bentoLabel}>{t('projectArea', 'PROJECT AREA').toUpperCase()}</Text>
            <Ionicons name="map-outline" size={14} color="#64748B" />
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
              <Text style={styles.bentoDigit} numberOfLines={1} adjustsFontSizeToFit>
                {project?.area ? `${project.area.toLocaleString('en-US')} ${project.areaUnit ? project.areaUnit.toUpperCase() : 'SQFT'}` : t('nA', 'N/A')}
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
                  gap: 4,
                  flexShrink: 0
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

        {/* Bento Card 5: Coordination Team */}
        {/* Bento Card 5: Coordination Team */}
        <AdaptiveGlass intensity={20} tint="light" style={[styles.bentoCard, styles.bentoWide]}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.bentoLabel, {marginBottom: 0}]}>{t('coordinationTeam').toUpperCase()}</Text>
              {(() => {
                const nonCreatorMembers = (project?.members || []).filter(m => {
                  if (!m) return false;
                  const u = (m.user && typeof m.user === 'object') ? m.user : m;
                  const memberEmail = u?.email;
                  const creatorEmail = project?.createdBy?.email;
                  const memberId = u?._id || u?.id || (typeof m.user === 'string' ? m.user : null);
                  const creatorId = project?.createdBy?._id || project?.createdBy?.id;
                  if (creatorId && memberId && String(creatorId) === String(memberId)) return false;
                  if (creatorEmail && memberEmail && creatorEmail.toLowerCase() === memberEmail.toLowerCase()) return false;
                  return true;
                });
                return (
                  <View style={styles.memberCountBadge}>
                    <Text style={styles.memberCountBadgeText}>
                      {1 + nonCreatorMembers.length}
                    </Text>
                  </View>
                );
              })()}
            </View>
            {canApproveBudget && (
              <TouchableOpacity onPress={handleOpenAddMember} style={styles.addMemberBtnSmall}>
                <Ionicons name="add" size={16} color="#3B82F6" />
                <Text style={styles.addMemberBtnText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.teamStack}>
            {/* Project Creator / Admin */}
            <View style={styles.tMember}>
              <View style={styles.circleAvatar}>
                <Text style={styles.cAvText}>{(project?.createdBy?.name || 'S').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.tInfo}>
                <Text style={styles.tName}>{project?.createdBy?.name || t('manager')}</Text>
                <Text style={[styles.tRole, { color: '#3B82F6', fontFamily: 'Inter-Bold', fontSize: 10, marginTop: 2, marginBottom: 1 }]}>Admin</Text>
                <Text style={styles.tRole}>{project?.createdBy?.email || t('adminCreator')}</Text>
              </View>
            </View>

            {/* Other Assigned Project Members */}
            {(() => {
              const assignedMembers = (project?.members || []).filter(m => {
                if (!m) return false;
                const u = (m.user && typeof m.user === 'object') ? m.user : m;
                const memberEmail = u?.email;
                const creatorEmail = project?.createdBy?.email;
                const memberId = u?._id || u?.id || (typeof m.user === 'string' ? m.user : null);
                const creatorId = project?.createdBy?._id || project?.createdBy?.id;
                if (creatorId && memberId && String(creatorId) === String(memberId)) return false;
                if (creatorEmail && memberEmail && creatorEmail.toLowerCase() === memberEmail.toLowerCase()) return false;
                return true;
              });

              if (assignedMembers.length === 0) {
                return (
                  <View style={styles.emptyMembersBox}>
                    <Ionicons name="people-outline" size={16} color="#94A3B8" />
                    <Text style={styles.emptyMembersText}>No additional team members assigned yet</Text>
                  </View>
                );
              }

              return assignedMembers.map((m, i) => {
                const u = (m.user && typeof m.user === 'object') ? m.user : m;
                const name = u?.name || m?.name || 'Team Member';
                const roleName = m.role?.name || (typeof m.role === 'string' ? m.role : null) || u?.role?.name || (typeof u?.role === 'string' ? u?.role : null) || 'Member';
                const email = u?.email || m?.email || '';
                const initial = (name || 'U').charAt(0).toUpperCase();

                return (
                  <View key={m._id || u?._id || i} style={styles.tMember}>
                    <View style={[styles.circleAvatar, { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE' }]}>
                      <Text style={[styles.cAvText, { color: '#2563EB' }]}>{initial}</Text>
                    </View>
                    <View style={styles.tInfo}>
                      <Text style={styles.tName}>{name}</Text>
                      <Text style={[styles.tRole, { color: '#2563EB', fontFamily: 'Inter-SemiBold', fontSize: 10, marginTop: 2, marginBottom: 1 }]}>
                        {roleName}
                      </Text>
                      {!!email && <Text style={styles.tRole}>{email}</Text>}
                    </View>
                  </View>
                );
              });
            })()}
          </View>
        </AdaptiveGlass>

        {/* ── Bento Card 6: Budget & Change Request Action Section ── */}
        <AdaptiveGlass intensity={30} tint="light" style={[styles.bentoCard, styles.bentoWide, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="wallet-outline" size={18} color="#3B82F6" />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' }}>Budget Management</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B' }}>
                  Current: {project?.currency || '$'} {formatCompact(currentBudget)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setShowHistoryModal(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F1F5F9' }}
            >
              <Ionicons name="time-outline" size={14} color="#475569" />
              <Text style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#475569' }}>History</Text>
            </TouchableOpacity>
          </View>

          {!isLocked && (
            <TouchableOpacity
              style={styles.fullChangeReqBtn}
              onPress={handleOpenRequestModal}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#2563EB', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.fullChangeReqGradient}
              >
                <Ionicons name="git-pull-request-outline" size={18} color="#FFF" />
                <Text style={styles.fullChangeReqBtnText}>Request Budget Change</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </AdaptiveGlass>
      </View>

      {/* ── Request Budget Modal ── */}
      <Modal visible={showRequestModal} animationType="slide" transparent onRequestClose={() => setShowRequestModal(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setShowRequestModal(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Request Budget Change</Text>
                <Text style={styles.modalSubSmall}>Propose budget modification for approval</Text>
              </View>
              <TouchableOpacity 
                style={styles.modalCloseBtn}
                onPress={() => setShowRequestModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <View style={styles.baseBudgetPill}>
                <Ionicons name="information-circle-outline" size={16} color="#2563EB" />
                <Text style={styles.modalSub}>
                  Current Base Budget: <Text style={{ fontFamily: 'Inter-Bold', color: '#0F172A' }}>{project?.currency || '$'} {formatCurrency(currentBudget)}</Text>
                </Text>
              </View>

              <Text style={styles.inputLabel}>New Proposed Budget Amount ({project?.currency || '$'})</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 500000"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={requestAmount}
                onChangeText={setRequestAmount}
              />

              <Text style={styles.inputLabel}>Reason / Justification for Change</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe why the budget needs adjustment..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={requestReason}
                onChangeText={setRequestReason}
              />

              {/* Approver Selection */}
              {isLoadingApprovers ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Loading approvers...</Text>
                </View>
              ) : budgetApprovers.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.inputLabel}>Assign Approver</Text>
                  <View style={{ gap: 8 }}>
                    {budgetApprovers.map(a => {
                      const isSelected = selectedApproverId === a._id;
                      return (
                        <TouchableOpacity
                          key={a._id}
                          onPress={() => setSelectedApproverId(a._id)}
                          style={[
                            styles.approverSelectCard,
                            isSelected && styles.approverSelectCardActive
                          ]}
                        >
                          <View style={[styles.avatarBox, isSelected && { backgroundColor: '#3B82F6' }]}>
                            <Text style={styles.avatarLetter}>{(a.name || 'A').charAt(0)}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.approverName, isSelected && { color: '#1D4ED8', fontFamily: 'Inter-Bold' }]}>{a.name}</Text>
                            <Text style={styles.approverRole}>{a.role?.name || a.email}</Text>
                          </View>
                          {isSelected && <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, isProcessing && { opacity: 0.6 }]}
                onPress={handleRequestBudget}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Change Request</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Budget History & Approval Modal ── */}
      <Modal visible={showHistoryModal} animationType="slide" transparent onRequestClose={() => setShowHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setShowHistoryModal(false)} />
          <View style={[styles.modalContent, { minHeight: 320 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Budget Lifecycle</Text>
                <Text style={styles.modalSubSmall}>Historical log & pending requests</Text>
              </View>
              <TouchableOpacity 
                style={styles.modalCloseBtn}
                onPress={() => setShowHistoryModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Current Active Budget Summary Banner */}
            <View style={styles.baseBudgetPill}>
              <Ionicons name="wallet-outline" size={18} color="#2563EB" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' }}>
                  Current Active Budget
                </Text>
                <Text style={{ fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' }}>
                  {project?.currency || '$'} {formatCurrency(currentBudget)}
                </Text>
              </View>
              {pendingRequests.length > 0 && (
                <View style={{ backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#FECACA' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter-Bold', color: '#DC2626' }}>
                    {pendingRequests.length} PENDING
                  </Text>
                </View>
              )}
            </View>

            <ScrollView style={styles.histList} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {project?.budgetHistory?.slice().reverse().map((item, idx) => {
                const isPending = item.approvalStatus === 'Pending';
                const isApproved = item.approvalStatus === 'Approved';
                const isRejected = item.approvalStatus === 'Rejected';

                return (
                  <View key={item._id || idx} style={[styles.histItem, isPending && { borderColor: '#FDE68A', backgroundColor: '#FFFDF5' }]}>
                    <View style={styles.histTop}>
                      <Text style={styles.histAmt}>
                        {project?.currency || '$'} {formatCompact(item.amount)}
                      </Text>
                      <View style={[
                        styles.histStatus,
                        isApproved && { backgroundColor: '#DCFCE7' },
                        isRejected && { backgroundColor: '#FEE2E2' },
                        isPending && { backgroundColor: '#FEF3C7' },
                      ]}>
                        <Text style={[
                          styles.histStatusText,
                          isApproved && { color: '#15803D' },
                          isRejected && { color: '#B91C1C' },
                          isPending && { color: '#B45309' },
                        ]}>
                          {item.approvalStatus || 'Approved'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.histReason}>{item.reason || 'No description provided'}</Text>

                    {isPending && canApproveBudget && (
                      <View style={styles.histActionRow}>
                        <TouchableOpacity
                          style={[styles.miniActionBtn, styles.rejectBtn]}
                          onPress={() => handleBudgetAction(item._id, 'Rejected')}
                          disabled={isProcessing}
                        >
                          <Text style={styles.rejectBtnText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.miniActionBtn, styles.approveBtn]}
                          onPress={() => handleBudgetAction(item._id, 'Approved')}
                          disabled={isProcessing}
                        >
                          <Text style={styles.approveBtnText}>Approve</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.histFooter}>
                      <Text style={styles.histMeta}>
                        Updated by {item.updatedByName || 'System'} • {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'Recorded'}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {(!project?.budgetHistory || project.budgetHistory.length === 0) && (
                <View style={styles.histItem}>
                  <View style={styles.histTop}>
                    <Text style={styles.histAmt}>
                      {project?.currency || '$'} {formatCompact(project?.budget || 0)}
                    </Text>
                    <View style={[styles.histStatus, { backgroundColor: '#DCFCE7' }]}>
                      <Text style={[styles.histStatusText, { color: '#15803D' }]}>
                        Approved
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.histReason}>Baseline project budget set upon creation.</Text>
                  <View style={styles.histFooter}>
                    <Text style={styles.histMeta}>
                      Created by {project?.createdBy?.name || 'Project Admin'} • {project?.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'Initial'}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
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

  // Change request button in Bento Details
  fullChangeReqBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 6,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  fullChangeReqGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  fullChangeReqBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#FFF',
  },
  
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: '100%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  baseBudgetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#1E40AF' },
  modalSubSmall: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  
  inputLabel: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
    marginBottom: 16
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20
  },
  submitBtnText: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#FFF'
  },
  approverSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12
  },
  approverSelectCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD'
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarLetter: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter-Bold'
  },
  approverName: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A'
  },
  approverRole: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#64748B'
  },

  // History styles
  histList: { maxHeight: 480, flexGrow: 0 },
  histItem: { padding: 16, borderRadius: 20, backgroundColor: '#F8FAFF', marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  histAmt: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#2563EB' },
  histStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  histStatusText: { fontSize: 9, fontFamily: 'Inter-SemiBold', textTransform: 'uppercase' },
  histReason: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#475569', lineHeight: 18, marginBottom: 12 },
  histFooter: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10 },
  histMeta: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  
  surveyBanner: { padding: 18, borderRadius: 24, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  surveyBannerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  surveyBannerTextContainer: { flex: 1 },
  surveyBannerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: 1 },
  surveyBannerDesc: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#3B82F6', marginTop: 4 },
  pendingBudgetBanner: { padding: 16, borderRadius: 20, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', marginBottom: 6 },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  pendingTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#991B1B' },
  pendingDesc: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#B91C1C', lineHeight: 16, marginBottom: 10 },
  viewPendingBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewPendingText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#DC2626' },
  histActionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  miniActionBtn: { flex: 1, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  rejectBtnText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#DC2626' },
  approveBtn: { backgroundColor: '#059669' },
  approveBtnText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#FFF' },
  
  snaggingBanner: { padding: 18, borderRadius: 24, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FEF3C7', backgroundColor: '#FFFBEB', marginBottom: 10 },
  snaggingBannerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 1, borderColor: '#FDE68A' },
  snaggingBannerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#B45309', textTransform: 'uppercase', letterSpacing: 1 },
  snaggingBannerDesc: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#D97706', marginTop: 4 },
  snaggingActionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  addMemberBtnSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  addMemberBtnText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#3B82F6', marginLeft: 4 },
  
  memberCountBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  memberCountBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  emptyMembersBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyMembersText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
  },
});

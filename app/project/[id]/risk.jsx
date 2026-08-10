import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Modal, TextInput, Platform, RefreshControl, LayoutAnimation, Keyboard } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import ConfirmModal from '../../components/ConfirmModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';
import { hasProjectPermission, hasAnyProjectPermissionPrefix, isProjectLocked } from '../../utils/permissions';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { name: 'Logistics', icon: 'truck-outline' },
  { name: 'Resources', icon: 'account-group-outline' },
  { name: 'Environmental', icon: 'leaf' },
  { name: 'Legal', icon: 'gavel' },
  { name: 'Safety', icon: 'shield-alert-outline' },
  { name: 'Financial', icon: 'cash-multiple' },
  { name: 'Technical', icon: 'cog-outline' }
];

const IMPACTS = [
  { label: 'Low', color: '#10B981', bg: '#D1FAE5' },
  { label: 'Medium', color: '#3B82F6', bg: '#DBEAFE' },
  { label: 'High', color: '#F59E0B', bg: '#FEF3C7' },
  { label: 'Very High', color: '#EF4444', bg: '#FEE2E2' }
];

const PROBABILITIES = ['Low', 'Medium', 'High'];
const STATUSES = ['Critical', 'Active', 'Monitored', 'Resolved'];

export default function ProjectRiskTab({ project }) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();
  const projectId = project?._id;

  const [risks, setRisks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const isAdmin = user?.role?.name === 'Admin';
  const canView = isAdmin || hasAnyProjectPermissionPrefix(user, project, 'risks:');
  const isLocked = isProjectLocked(project);
  const canCreate = !isLocked && (isAdmin || hasProjectPermission(user, project, 'risks:create'));
  const canUpdate = !isLocked && (isAdmin || hasProjectPermission(user, project, 'risks:update'));
  const canDelete = !isLocked && (isAdmin || hasProjectPermission(user, project, 'risks:delete'));
  const canAssign = !isLocked && (isAdmin || hasProjectPermission(user, project, 'risks:assign'));

  // Modals
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isMitigationModalVisible, setIsMitigationModalVisible] = useState(false);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ visible: false, id: null });
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);

  // Form States
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Technical');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState('Medium');
  const [probability, setProbability] = useState('Medium');
  const [mitigationProgress, setMitigationProgress] = useState('0');
  const [updateNote, setUpdateNote] = useState('');
  const [updateStatus, setUpdateStatus] = useState('');
  const [assignOwner, setAssignOwner] = useState(null);
  const fetchRisks = useCallback(async (isRefresh = false) => {
    if (!projectId) return;

    try {
      if (!isRefresh) setIsLoading(true);
      else setRefreshing(true);

      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/risks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        const text = await res.text();
        if (!text) {
          setRisks([]);
          return;
        }
        try {
          const data = JSON.parse(text);
          setRisks(Array.isArray(data) ? data : []);
        } catch (parseError) {
          console.error('Risks JSON parse error:', parseError, 'Raw response:', text);
          showToast('Invalid data received', 'error');
        }
      } else {
        const errText = await res.text();
        console.error('Fetch risks failed:', res.status, errText);
        showToast(`Server error: ${res.status}`, 'error');
      }
    } catch (error) {
      console.error('Fetch risks network error:', error);
      showToast(t('networkError'), 'error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    if (projectId) fetchRisks();
  }, [fetchRisks, projectId]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchRisks(true);
    socket.on('risk:updated', refresh);
    return () => socket.off('risk:updated', refresh);
  }, [socket, fetchRisks]);

  const onRefresh = useCallback(() => {
    fetchRisks(true);
  }, [fetchRisks]);

  const handleCreateRisk = async () => {
    if (!canCreate) {
      showToast('Permission denied', 'error');
      return;
    }
    if (!title.trim()) {
      showToast('Title is required', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/risks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title, category, description, impact, probability, owner: null })
      });
      if (res.ok) {
        showToast('Risk logged successfully', 'success');
        setIsAddModalVisible(false);
        setTitle('');
        setCategory('Technical');
        setDescription('');
        setImpact('Medium');
        setProbability('Medium');
        fetchRisks();
      } else {
        showToast('Failed to create risk', 'error');
      }
    } catch (error) {
      showToast(t('networkError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMitigation = async () => {
    if (!canUpdate) {
      showToast('Permission denied', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/risks/${selectedRisk._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          mitigationProgress: parseInt(mitigationProgress),
          status: updateStatus,
          note: updateNote
        })
      });
      if (res.ok) {
        showToast('Risk updated', 'success');
        setIsMitigationModalVisible(false);
        fetchRisks();
      }
    } catch (error) {
      showToast('Update failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignOwner = async () => {
    if (!canAssign) {
      showToast('Permission denied', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/risks/${selectedRisk._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ owner: assignOwner })
      });
      if (res.ok) {
        showToast('Risk assigned', 'success');
        setIsAssignModalVisible(false);
        fetchRisks();
      }
    } catch (error) {
      showToast('Assignment failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRisk = async (id) => {
    if (!canDelete) {
      showToast('Permission denied', 'error');
      setConfirmModal({ visible: false, id: null });
      return;
    }
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/risks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Risk deleted', 'delete');
        fetchRisks();
      }
    } catch (error) {
      showToast('Delete failed', 'error');
    } finally {
      setConfirmModal({ visible: false, id: null });
    }
  };

  const resetForm = () => {
    setTitle('');
    setCategory('Technical');
    setDescription('');
    setImpact('Medium');
    setProbability('Medium');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Critical': return '#EF4444';
      case 'Active': return '#F59E0B';
      case 'Monitored': return '#3B82F6';
      case 'Resolved': return '#10B981';
      default: return '#94A3B8';
    }
  };

  const getImpactColor = (label) => {
    return IMPACTS.find(i => i.label === label)?.color || '#94A3B8';
  };

  const filteredRisks = filter === 'All' ? risks : risks.filter(r => r.status === filter);

  if (!canView) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 40 }}>
        <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
        <Text style={{ fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 16 }}>Access Restricted</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', marginTop: 8 }}>
          You don't have permission to view the Risk & Escalation Matrix module.
        </Text>
      </View>
    );
  }

  if (isLoading && risks.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }
  return (
    <View style={styles.container}>
      {/* Premium Unified Dark Dashboard */}
      <View style={{ paddingHorizontal: 8, marginBottom: 20 }}>
        <View style={{ backgroundColor: '#0F172A', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.15, shadowRadius: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#94A3B8' }}>{t('riskOverview') || 'Risk Overview'}</Text>
            <View style={{ backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFF' }}>{risks.length} {t('total') || 'Total Risks'}</Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                <Text style={{ fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' }}>{t('critical') || 'Critical'}</Text>
              </View>
              <Text style={{ fontSize: 24, fontFamily: 'Inter-Bold', color: '#FFF' }}>{risks.filter(r => r.status === 'Critical').length}</Text>
            </View>
            
            <View style={{ width: 1, height: 40, backgroundColor: '#1E293B' }} />
            
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }} />
                <Text style={{ fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' }}>{t('active') || 'Active'}</Text>
              </View>
              <Text style={{ fontSize: 24, fontFamily: 'Inter-Bold', color: '#FFF' }}>{risks.filter(r => r.status === 'Active').length}</Text>
            </View>

            <View style={{ width: 1, height: 40, backgroundColor: '#1E293B' }} />
            
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                <Text style={{ fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' }}>{t('resolved') || 'Resolved'}</Text>
              </View>
              <Text style={{ fontSize: 24, fontFamily: 'Inter-Bold', color: '#FFF' }}>{risks.filter(r => r.status === 'Resolved').length}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Elegant Filter Chips */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          {['All', ...STATUSES].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setFilter(f);
              }}
              style={[
                styles.filterChip,
                filter === f && styles.filterChipActive
              ]}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{t(f.toLowerCase(), f)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>{t('riskRegistry')}</Text>
          <Text style={styles.sectionSubtitle}>{filteredRisks.length} {t('incidentsTracked')}</Text>
        </View>
        {canCreate && (
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={() => setIsAddModalVisible(true)}>
            <Feather name="plus" size={20} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Risk List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.riskList}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {filteredRisks.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconBox}>
              <MaterialCommunityIcons name="shield-check-outline" size={48} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyText}>{t('noRisksDetected')}</Text>
            <Text style={styles.emptySub}>{t('noRisksDesc')}</Text>
          </View>
        ) : (
          filteredRisks.map((risk) => (
            <View key={risk._id} style={styles.riskCard}>
              <View style={styles.cardHeader}>
                <View style={styles.titleArea}>
                  <View style={styles.categoryRow}>
                    <MaterialCommunityIcons
                      name={CATEGORIES.find(c => c.name === risk.category)?.icon || 'alert-circle-outline'}
                      size={14}
                      color={getStatusColor(risk.status)}
                    />
                    <Text style={[styles.categoryText, { color: getStatusColor(risk.status) }]}>{risk.category}</Text>
                  </View>
                  <Text style={styles.riskTitle}>{risk.title}</Text>
                  
                  {/* Polymorphic Source Display */}
                  {risk.sourceType && risk.sourceType !== 'Manual' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' }}>
                      <Feather name="link" size={10} color="#64748B" />
                      <Text style={{ fontSize: 10, fontFamily: 'Inter-Medium', color: '#64748B', marginLeft: 4 }}>
                        Source: {risk.sourceType} {risk.sourceName ? `- ${risk.sourceName}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={[styles.impactBadge, { backgroundColor: getImpactColor(risk.impact) + '15' }]}>
                  <Text style={[styles.impactBadgeText, { color: getImpactColor(risk.impact) }]}>{risk.impact}</Text>
                </View>
              </View>

              <Text style={styles.riskDesc} numberOfLines={2}>{risk.description}</Text>

              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Mitigation Progress</Text>
                  <Text style={styles.progressValue}>{risk.mitigationProgress}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${risk.mitigationProgress}%`, backgroundColor: getStatusColor(risk.status) }
                    ]}
                  />
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.userInfo}>
                  <View style={[styles.avatar, { backgroundColor: '#F8FAFF' }]}>
                    <Text style={[styles.avatarText, { color: '#64748B' }]}>{risk.owner?.name?.charAt(0) || 'U'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {risk.owner?.name || 'Unassigned'} • <Text style={styles.dateText}>{new Date(risk.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                    </Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  {canAssign && !risk.owner && (
                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', borderWidth: 1 }]}
                      onPress={() => {
                        setSelectedRisk(risk);
                        setAssignOwner(risk.owner?._id || null);
                        setIsAssignModalVisible(true);
                      }}
                    >
                      <Feather name="user-plus" size={14} color="#0284C7" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => {
                      setSelectedRisk(risk);
                      setIsViewModalVisible(true);
                    }}
                  >
                    <Feather name="eye" size={14} color="#3B82F6" />
                  </TouchableOpacity>
                  {canDelete && (isAdmin || String(risk.owner?._id) === String(user?.id)) && (
                    <TouchableOpacity onPress={() => setConfirmModal({ visible: true, id: risk._id })} style={styles.actionIconBtn}>
                      <Feather name="trash-2" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                  {canUpdate && (
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => {
                        setSelectedRisk(risk);
                        setMitigationProgress(risk.mitigationProgress.toString());
                        setUpdateStatus(risk.status);
                        setUpdateNote('');
                        setIsMitigationModalVisible(true);
                      }}
                    >
                      <Feather name="edit-2" size={14} color="#64748B" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ADD RISK MODAL */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setIsAddModalVisible(false)} />
          <View style={[styles.modalContent, { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 10 : Math.max(insets.bottom, 24) }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('newRiskRecord')}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setIsAddModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('riskTitle')}</Text>
                <View style={styles.inputContainer}>
                  <Feather name="type" size={18} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputFlex}
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t('egWeatherDelay')}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('category')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {CATEGORIES.map(c => (
                    <TouchableOpacity
                      key={c.name}
                      onPress={() => setCategory(c.name)}
                      style={[styles.categoryChipModal, category === c.name && styles.categoryChipModalActive]}
                    >
                      <MaterialCommunityIcons name={c.icon} size={16} color={category === c.name ? '#FFF' : '#64748B'} />
                      <Text style={[styles.categoryChipTextModal, category === c.name && styles.categoryChipTextModalActive]}>{t(c.name.toLowerCase(), c.name)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>{t('impact')}</Text>
                  <View style={styles.optionGrid}>
                    {IMPACTS.map(i => (
                      <TouchableOpacity
                        key={i.label}
                        onPress={() => setImpact(i.label)}
                        style={[styles.optionCard, impact === i.label && { borderColor: i.color, backgroundColor: i.color + '10' }]}
                      >
                        <View style={[styles.indicator, { backgroundColor: i.color }]} />
                        <Text style={[styles.optionText, impact === i.label && { color: i.color, fontFamily: 'Inter-Bold' }]}>{t(i.label.toLowerCase().replace(/\s+/g, ''), i.label)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={{ width: 12 }} />
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>{t('probability')}</Text>
                  <View style={styles.optionGrid}>
                    {PROBABILITIES.map(p => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setProbability(p)}
                        style={[styles.optionCard, probability === p && styles.optionCardActive]}
                      >
                        <Text style={[styles.optionText, probability === p && styles.optionTextActive]}>{t(p.toLowerCase(), p)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('description')}</Text>
                <View style={[styles.inputContainer, styles.textAreaContainer]}>
                  <Feather name="align-left" size={18} color="#94A3B8" style={styles.inputIconTop} />
                  <TextInput
                    style={[styles.inputFlex, styles.textArea]}
                    multiline
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t('describeRisk')}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateRisk} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>{t('createRiskEntry')}</Text>
                    <Feather name="arrow-right" size={18} color="#FFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* UPDATE MITIGATION MODAL */}
      <Modal visible={isMitigationModalVisible} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalOverlayCenter}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setIsMitigationModalVisible(false)} />
          <View style={styles.smallModal}>
            <Text style={styles.modalTitleSmall}>{t('updateProgress')}</Text>
            <Text style={styles.modalRiskTitle}>{selectedRisk?.title}</Text>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>{t('mitigationPercent')}</Text>
                <Text style={styles.percentValue}>{mitigationProgress}%</Text>
              </View>
              <View style={{ marginTop: 16, marginBottom: 16, flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 }}>
                {[0, 25, 50, 75, 100].map(pct => {
                  const isSelected = Number(mitigationProgress) === pct;
                  return (
                    <TouchableOpacity
                      key={pct}
                      onPress={() => setMitigationProgress(pct.toString())}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                        borderRadius: 10,
                        shadowColor: isSelected ? '#000' : 'transparent',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: isSelected ? 2 : 0,
                      }}
                    >
                      <Text style={{ 
                        fontSize: 13, 
                        fontFamily: isSelected ? 'Inter-Bold' : 'Inter-Medium',
                        color: isSelected ? '#3B82F6' : '#64748B'
                      }}>
                        {pct}%
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('setStatus')}</Text>
              <View style={styles.statusRow}>
                {STATUSES.map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setUpdateStatus(s)}
                    style={[
                      styles.statusChipModal,
                      updateStatus === s && { backgroundColor: getStatusColor(s), borderColor: getStatusColor(s) }
                    ]}
                  >
                    <Text style={[styles.statusChipTextModal, updateStatus === s && { color: '#FFF' }]}>{t(s.toLowerCase(), s)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('updateNote')}</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.inputFlex}
                  value={updateNote}
                  onChangeText={setUpdateNote}
                  placeholder={t('whatProgressMade')}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <View style={styles.modalFooterActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsMitigationModalVisible(false)}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleUpdateMitigation} disabled={isSubmitting}>
                <LinearGradient colors={['#3B82F6', '#3B82F6']} style={styles.modalConfirmGrad}>
                  {isSubmitting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.modalConfirmText}>{t('save')}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* VIEW RISK MODAL */}
      <Modal visible={isViewModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setIsViewModalVisible(false)} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('riskDetails') || 'Risk Details'}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setIsViewModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedRisk && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ marginBottom: 20 }}>
                  <View style={styles.categoryRow}>
                    <MaterialCommunityIcons
                      name={CATEGORIES.find(c => c.name === selectedRisk.category)?.icon || 'alert-circle-outline'}
                      size={16}
                      color={getStatusColor(selectedRisk.status)}
                    />
                    <Text style={[styles.categoryText, { color: getStatusColor(selectedRisk.status), fontSize: 12 }]}>{selectedRisk.category}</Text>
                  </View>
                  <Text style={[styles.riskTitle, { fontSize: 20, marginTop: 8 }]}>{selectedRisk.title}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                  <View style={{ flex: 1, backgroundColor: '#F8FAFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter-Bold', color: '#64748B', marginBottom: 4, textTransform: 'uppercase' }}>{t('status') || 'Status'}</Text>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter-SemiBold', color: getStatusColor(selectedRisk.status) }}>{selectedRisk.status}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#F8FAFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter-Bold', color: '#64748B', marginBottom: 4, textTransform: 'uppercase' }}>{t('impact') || 'Impact'}</Text>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter-SemiBold', color: getImpactColor(selectedRisk.impact) }}>{selectedRisk.impact}</Text>
                  </View>
                </View>

                <View style={{ backgroundColor: '#F8FAFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B', marginBottom: 8, textTransform: 'uppercase' }}>{t('description') || 'Description'}</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A', lineHeight: 22 }}>
                    {selectedRisk.description || 'No description provided.'}
                  </Text>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Mitigation Progress</Text>
                    <Text style={styles.progressValue}>{selectedRisk.mitigationProgress}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${selectedRisk.mitigationProgress}%`, backgroundColor: getStatusColor(selectedRisk.status) }
                      ]}
                    />
                  </View>
                  {selectedRisk.note && (
                    <Text style={{ fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 12, fontStyle: 'italic' }}>
                      "{selectedRisk.note}"
                    </Text>
                  )}
                </View>

              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ASSIGN RISK MODAL */}
      <Modal visible={isAssignModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setIsAssignModalVisible(false)} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('assignOwner', 'Assign Risk Owner')}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setIsAssignModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('selectOwner', 'Select Owner')}</Text>
                <View style={{ gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => setAssignOwner(null)}
                    style={[styles.userListItem, !assignOwner && styles.userListItemActive]}
                  >
                    <View style={[styles.userAvatarModal, !assignOwner && { backgroundColor: '#FFF' }]}>
                      <Feather name="user-x" size={16} color={!assignOwner ? '#3B82F6' : '#64748B'} />
                    </View>
                    <Text style={[styles.userListItemText, !assignOwner && { color: '#FFF' }]}>{t('unassigned', 'Unassigned')}</Text>
                  </TouchableOpacity>
                  {project?.members?.filter(m => {
                    if (!m.user) return false;
                    return hasProjectPermission(m.user, project, 'risks:create') || hasProjectPermission(m.user, project, 'risks:update');
                  }).map(m => m.user).map(u => (
                    <TouchableOpacity
                      key={u._id}
                      onPress={() => setAssignOwner(u._id)}
                      style={[styles.userListItem, assignOwner === u._id && styles.userListItemActive]}
                    >
                      <View style={[styles.userAvatarModal, assignOwner === u._id && { backgroundColor: '#FFF' }]}>
                        <Text style={[styles.userAvatarTextModal, assignOwner === u._id && { color: '#3B82F6' }]}>{u.name.charAt(0)}</Text>
                      </View>
                      <Text style={[styles.userListItemText, assignOwner === u._id && { color: '#FFF' }]}>{u.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={[styles.submitBtn, { marginTop: 16 }]} onPress={handleAssignOwner} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>{t('confirmAssignment', 'Confirm Assignment')}</Text>
                    <Feather name="check" size={18} color="#FFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={confirmModal.visible}
        title={t('deleteRiskRecord')}
        message={t('deleteRiskMsg')}
        confirmText={t('remove')}
        type="destructive"
        onConfirm={() => handleDeleteRisk(confirmModal.id)}
        onCancel={() => setConfirmModal({ visible: false, id: null })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Dashboard
  dashboardSection: { paddingHorizontal: 8,  marginBottom: 24 },
  sectionLabel: { fontSize: 12, color: '#94A3B8', letterSpacing: 1, marginBottom: 12 , fontFamily: 'Inter-Bold' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  statIcon: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  statVal: { fontSize: 15, color: '#0F172A' , fontFamily: 'Inter-Bold' },
  statLab: { fontSize: 9, color: '#64748B', textTransform: 'uppercase' , fontFamily: 'Inter-Bold' },

  // Filters
  filterWrapper: { marginBottom: 20, paddingLeft: 8 },
  filterContent: { gap: 8, paddingRight: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFF',
  },
  filterChipActive: { backgroundColor: '#3B82F6' },
  filterText: { fontSize: 13, color: '#64748B' , fontFamily: 'Inter-Medium' },
  filterTextActive: { color: '#FFF', fontFamily: 'Inter-SemiBold' },

  // Header Row
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 16
  },
  sectionTitle: { fontSize: 20, color: '#0F172A', letterSpacing: -0.5 , fontFamily: 'Inter-Bold' },
  sectionSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  addBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
  },

  // Risk Cards
  riskList: { flex: 1, paddingHorizontal: 8 },
  riskCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  titleArea: { flex: 1, marginRight: 12 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  categoryText: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 , fontFamily: 'Inter-Bold' },
  riskTitle: { fontSize: 16, color: '#0F172A', lineHeight: 22 , fontFamily: 'Inter-SemiBold' },
  impactBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  impactBadgeText: { fontSize: 10, textTransform: 'uppercase' , fontFamily: 'Inter-Bold' },
  riskDesc: { fontSize: 13, color: '#64748B', lineHeight: 20, marginBottom: 16 },

  progressContainer: { marginBottom: 16 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  progressLabel: { fontSize: 11, color: '#475569' , fontFamily: 'Inter-Bold' },
  progressValue: { fontSize: 13, color: '#0F172A' , fontFamily: 'Inter-Bold' },
  progressBarBg: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%' },

  userListItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F8FAFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  userListItemActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  userAvatarModal: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userAvatarTextModal: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#64748B' },
  userListItemText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A' },


  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFF'
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 12 },
  avatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  avatarText: { fontSize: 11, fontFamily: 'Inter-Bold' },
  userName: { fontSize: 12, color: '#0F172A' , fontFamily: 'Inter-SemiBold' },
  dateText: { fontSize: 11, color: '#94A3B8' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionIconBtn: { width: 28, height: 28, backgroundColor: '#F8FAFF', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },

  // Empty State
  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyText: { fontSize: 16, color: '#0F172A', marginBottom: 4 , fontFamily: 'Inter-SemiBold' },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '85%'
  },
  dragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, color: '#0F172A' , fontFamily: 'Inter-Bold' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#F1F5F9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 13, color: '#475569', marginBottom: 8 , fontFamily: 'Inter-Bold' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 8,
    height: 52
  },
  inputIcon: { marginRight: 12 },
  inputIconTop: { marginRight: 12, marginTop: 14, alignSelf: 'flex-start' },
  inputFlex: { flex: 1, fontSize: 14, color: '#0F172A', height: '100%' , fontFamily: 'Inter-Medium' },
  textAreaContainer: { height: 100, alignItems: 'flex-start' },
  textArea: { textAlignVertical: 'top', paddingTop: 14 },

  categoryChipModal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  categoryChipModalActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  categoryChipTextModal: { fontSize: 13, color: '#64748B' , fontFamily: 'Inter-SemiBold' },
  categoryChipTextModalActive: { color: '#FFF', fontFamily: 'Inter-Bold' },

  row: { flexDirection: 'row' },
  optionGrid: { gap: 8 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  optionCardActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  indicator: { width: 6, height: 6, borderRadius: 3 },
  optionText: { fontSize: 12, color: '#64748B' , fontFamily: 'Inter-SemiBold' },
  optionTextActive: { color: '#3B82F6', fontFamily: 'Inter-Bold' },

  submitBtn: {
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20
  },
  submitBtnText: { fontSize: 15, color: '#FFF' , fontFamily: 'Inter-Bold' },

  smallModal: { width: width * 0.85, borderRadius: 16, padding: 24, overflow: 'hidden', backgroundColor: '#FFF' },
  modalTitleSmall: { fontSize: 18, color: '#0F172A', marginBottom: 4 , fontFamily: 'Inter-Bold' },
  modalRiskTitle: { fontSize: 13, color: '#3B82F6', marginBottom: 20 , fontFamily: 'Inter-SemiBold' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  percentValue: { fontSize: 14, color: '#0F172A' , fontFamily: 'Inter-Bold' },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChipModal: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFF' },
  statusChipTextModal: { fontSize: 11, color: '#64748B' , fontFamily: 'Inter-Bold' },

  modalFooterActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  modalCancelText: { fontSize: 14, color: '#64748B' , fontFamily: 'Inter-Bold' },
  modalConfirmBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  modalConfirmGrad: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 14 },
  modalConfirmText: { fontSize: 14, color: '#FFF' , fontFamily: 'Inter-Bold' }
});



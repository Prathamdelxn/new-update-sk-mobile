


import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Dimensions, StatusBar, TextInput, Modal, ActivityIndicator, DeviceEventEmitter, RefreshControl, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import HeaderNotification from '../../components/HeaderNotification';
// import CustomHeader from '../../components/CustomHeader';
// import HeaderActionButton from '../../components/HeaderActionButton';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import { BlurView } from 'expo-blur';
import ConfirmModal from '../../components/ConfirmModal';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const { width, height } = Dimensions.get('window');

// Removed static PROJECTS array

const SimpleBackground = () => (
  <View style={styles.bgBase} />
);

export default function ProjectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const isAdmin = user?.role?.name === 'Admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalStep, setModalStep] = useState('category'); // 'category' | 'create-category' | 'template'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [inlineSuccessMsg, setInlineSuccessMsg] = useState('');
  const pendingRestore = useRef(null);

  // Restore modal state when returning from create-template screen
  useFocusEffect(
    useCallback(() => {
      if (pendingRestore.current) {
        const { step, category } = pendingRestore.current;
        pendingRestore.current = null;
        setSelectedCategory(category);
        setModalStep(step);
        setIsModalVisible(true);
        fetchModalData();
      }
    }, [])
  );

  const [categories, setCategories] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Site Survey Assignment State
  const [isSurveyModalVisible, setIsSurveyModalVisible] = useState(false);
  const [surveyProjectId, setSurveyProjectId] = useState(null);
  const [membersList, setMembersList] = useState([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isAssigningSurvey, setIsAssigningSurvey] = useState(false);
  const [surveyConfirmModal, setSurveyConfirmModal] = useState({ visible: false, member: null });

  // Snagging Assignment Notification State
  const [snaggingNotification, setSnaggingNotification] = useState(null);

  // Project Deletion State
  const [deleteModal, setDeleteModal] = useState({ visible: false, projectId: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredMembersForSurvey = membersList.filter(m => {
    const query = memberSearchQuery.toLowerCase();
    const nameMatch = m.name ? m.name.toLowerCase().includes(query) : false;
    const emailMatch = m.email ? m.email.toLowerCase().includes(query) : false;
    return nameMatch || emailMatch;
  });

  const [isModalDataLoading, setIsModalDataLoading] = useState(false);

  useEffect(() => {
    fetchInitialDashboard();
    checkAssignedSnagging();

    const sub = DeviceEventEmitter.addListener('categories_updated', fetchModalData);
    const readSub = DeviceEventEmitter.addListener('chat:read', ({ projectId }) => {
      setProjectsList(prev => prev.map(p => {
        if (p._id === projectId || p._id?.toString() === projectId?.toString()) {
          return { ...p, unreadMessageCount: 0 };
        }
        return p;
      }));
    });
    return () => {
      sub.remove();
      readSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleGlobalMessage = (msg) => {
      // If the message is not from me
      if (msg.sender !== (user?.id || user?._id)) {
        const projectId = msg.project?._id || msg.project;
        setProjectsList(prev => prev.map(p => {
          if (p._id === projectId) {
            return { ...p, unreadMessageCount: (p.unreadMessageCount || 0) + 1 };
          }
          return p;
        }));
      }
    };
    socket.on('chat:message', handleGlobalMessage);
    return () => {
      socket.off('chat:message', handleGlobalMessage);
    };
  }, [socket, user]);

  useEffect(() => {
    if (isModalVisible) {
      fetchModalData();
    }
  }, [isModalVisible]);

  useEffect(() => {
    if (isSurveyModalVisible && surveyProjectId) {
      loadProjectMembersForSurvey(surveyProjectId);
    }
  }, [isSurveyModalVisible, surveyProjectId]);

  const loadProjectMembersForSurvey = async (projectId) => {
    try {
      setIsFetchingMembers(true);
      setMembersList([]);

      // Fetch members with sitesurvey permission for this project
      const res = await fetch(
        `${API_BASE_URL}/users?permission=sitesurvey&projectId=${projectId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      if (res.ok) setMembersList(data);
    } catch (e) {
      console.error('Load project members error', e);
    } finally {
      setIsFetchingMembers(false);
    }
  };

  const handleSendForSiteSurvey = (projectId) => {
    setMembersList([]);
    setMemberSearchQuery('');
    setSurveyProjectId(projectId);
    setIsSurveyModalVisible(true);
  };

  const handleMemberTapForSurvey = (member) => {
    setSurveyConfirmModal({ visible: true, member });
  };

  const confirmAssignSurveyor = async () => {
    const memberId = surveyConfirmModal.member?._id;
    if (!memberId) return;
    try {
      setIsAssigningSurvey(true);
      const projectToUpdate = projectsList.find(p => p._id === surveyProjectId);
      const existingMembers = projectToUpdate.members?.map(m => typeof m === 'object' ? m._id : m) || [];
      const updatedMembers = [...new Set([...existingMembers, memberId])];

      const response = await fetch(`${API_BASE_URL}/projects/${surveyProjectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          needSiteSurvey: false,
          siteSurveyor: memberId,
          status: 'Site Survey'
        }),
      });

      if (response.ok) {
        showToast('Site survey assigned successfully.', 'success');
        setSurveyConfirmModal({ visible: false, member: null });
        setIsSurveyModalVisible(false);
        fetchProjects();
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Server error' }));
        showToast(errorData.message || 'Failed to assign site survey', 'error');
      }
    } catch (e) {
      showToast(t('networkError'), 'error');
    } finally {
      setIsAssigningSurvey(false);
      setSurveyProjectId(null);
    }
  };

  const fetchInitialDashboard = async () => {
    try {
      setIsLoadingData(true);
      await fetchProjects();
    } finally {
      setIsLoadingData(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchProjects();
    setIsRefreshing(false);
  }, []);

  const fetchProjects = async () => {
    try {
      console.log("calling apis", `${API_BASE_URL}/projects`);
      console.log(token)
      const response = await fetch(`${API_BASE_URL}/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log("calling apis", API_BASE_URL);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Server error' }));
        showToast(errorData.message || 'Failed to sync projects', 'error');
        return;
      }

      const data = await response.json().catch(() => null);
      if (data) setProjectsList(data);
    } catch (e) {
      console.error('Fetch projects error', e);
      showToast(t('networkErrorConnectServer'), 'error');
    }
  };

  const checkAssignedSnagging = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/assigned-snagging`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data && data.length > 0) {
        setSnaggingNotification(data[0]);
      }
    } catch (e) {
      console.error('Check snagging error', e);
    }
  };

  const fetchModalData = async () => {
    try {
      if (categories.length === 0) setIsModalDataLoading(true);
      const [catRes, tempRes] = await Promise.all([
        fetch(`${API_BASE_URL}/template-categories`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/templates`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const catData = await catRes.json().catch(() => null);
      const tempData = await tempRes.json().catch(() => null);

      if (catRes.ok && catData) setCategories(catData);
      if (tempRes.ok && tempData) setTemplates(tempData);
    } catch (e) {
      console.error('Fetch modal error', e);
    } finally {
      setIsModalDataLoading(false);
    }
  };

  const handleEditProject = (item) => {
    const hasEditPermission = user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*') || user?.role?.permissions?.includes('projects:update') || user?.role?.permissions?.includes('projects:edit');
    if (!hasEditPermission) {
      showToast('You do not have permission to edit projects.', 'error');
      return;
    }
    router.push({
      pathname: '/create-project',
      params: {
        id: item._id,
        isEditing: 'true',
        projectName: item.name,
        clientName: item.description?.match(/(?:Client: |العميل: )(.*?)(?:\. |$)/)?.[1] || '',
        location: item.description?.match(/(?:Location: |الموقع: )(.*?)(?:\. |$)/)?.[1] || item.description?.replace(/^(?:Client: .*?\. )?/, '') || '',
        status: item.status,
        priority: item.priority,
        startDate: item.startDate,
        targetDate: item.endDate,
        area: item.area?.toString() || '',
        budget: item.budgetHistory?.length ? item.budgetHistory[item.budgetHistory.length - 1].amount?.toString() : (item.budget?.toString() || ''),
        currency: item.currency || 'AED',
      }
    });
  };

  const handleDeleteProject = (id) => {
    const hasDeletePermission = user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*') || user?.role?.permissions?.includes('projects:delete');
    if (!hasDeletePermission) {
      showToast('You do not have permission to delete projects.', 'error');
      return;
    }
    setDeleteModal({ visible: true, projectId: id });
  };

  const confirmDeleteProject = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`${API_BASE_URL}/projects/${deleteModal.projectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        showToast("Project deleted successfully", "delete");
        setDeleteModal({ visible: false, projectId: null });
        fetchProjects(); // Refresh list
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Server error' }));
        showToast(errorData.message || "Failed to delete project", "error");
      }
    } catch (error) {
      showToast(t('networkError'), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateCategoryInline = async () => {
    const name = newCategoryName.trim();
    if (!name) { showToast(t('pleaseEnterCategoryName'), 'error'); return; }
    setIsCreatingCategory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/template-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create category');
      setCategories(prev => [...prev, data]);
      setNewCategoryName('');
      setSelectedCategory(data);
      setModalStep('template');
      setInlineSuccessMsg(`Category "${name}" created successfully!`);
      setTimeout(() => setInlineSuccessMsg(''), 3500);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleSelectCategory = (category) => {
    setSelectedCategory(category);
    setModalStep('template');
  };

  const handleSelectTemplate = (template) => {
    setIsModalVisible(false);
    router.push({
      pathname: '/create-project',
      params: {
        templateId: template._id,
        templateName: template.name,
        categoryId: selectedCategory._id,
        categoryName: selectedCategory.name
      }
    });
  };

  const handleCustomRequirement = () => {
    setIsModalVisible(false);
    router.push({
      pathname: '/create-project',
      params: {
        isCustom: 'true',
        categoryId: selectedCategory._id,
        categoryName: selectedCategory.name
      }
    });
  };

  const filteredProjects = projectsList.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.createdBy?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const renderProjectCard = ({ item }) => {
    const statusProgressMap = {
      'Initialized': 0.00,
      'Site Survey': 0.05,
      'Planning': 0.15,
      'Ongoing': 0.40,
      'Under Snagging': 0.85,
      'Snagging Completed': 0.95,
      'Completed': 1.00,
      'On Hold': 0.50,
      'Cancelled': 0.00,
    };
    const progress = statusProgressMap[item.status] ?? 0.10;
    const priorityColor = item.priority === 'High' || item.priority === 'Urgent' ? '#EF4444' : '#3B82F6';
    const siteLocation = item.description || 'Global Site';

    const getStatusStyles = (status) => {
      switch (status) {
        case 'Initialized': return { bg: '#E0E7FF', text: '#4338CA' }; // Deep Indigo
        case 'Planning': return { bg: '#FEF3C7', text: '#D97706' }; // Amber
        case 'Site Survey': return { bg: '#EDE9FE', text: '#7C3AED' }; // Purple 
        case 'Ongoing': return { bg: '#DBEAFE', text: '#2563EB' }; // Blue
        case 'Completed': return { bg: '#D1FAE5', text: '#059669' }; // Green
        case 'On Hold': return { bg: '#FEE2E2', text: '#DC2626' }; // Red
        case 'Cancelled': return { bg: '#F3F4F6', text: '#4B5563' }; // Gray
        default: return { bg: '#bcbdbeff', text: '#64748B' }; // Slate (fallback)
      }
    };
    const currentStatusStyles = getStatusStyles(item.status);

    const initials = item.name ? item.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : 'P';
    const accentColor = currentStatusStyles.text;
    const progressBarColor = item.status === 'Cancelled' ? '#EF4444' : item.status === 'Completed' ? '#10B981' : accentColor;

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => router.push(`/project/${item._id}`)}
        style={styles.glassProjectCard}
      >
        {/* ── Header ── */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.cardAvatar, { borderColor: '#BFDBFE' }]}>
              <Ionicons name="business" size={20} color="#2563EB" />
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.cardCategoryLabel} numberOfLines={1}>
                {item.category?.name || 'General'}
              </Text>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: accentColor }]}>
            <Text style={styles.statusPillText}>{t(item.status ? item.status.replace(/ /g, '') : 'Unknown')}</Text>
          </View>
        </View>

        {/* ── White Body ── */}
        <View style={styles.cardBody}>

          {/* Location + Action Required */}
          <View style={styles.cardMetaRow}>
            <MaterialIcons name="location-on" size={12} color="#94A3B8" />
            <Text style={styles.cardLocText} numberOfLines={1}>{siteLocation}</Text>
            {item.projectCode ? (
              <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Inter-Bold', color: '#64748B' }}>{item.projectCode}</Text>
              </View>
            ) : null}
            {!isAdmin && item.hasPendingPlans && (
              <View style={styles.actionRequiredBadge}>
                <Text style={styles.actionRequiredText}>{t('actionRequired')}</Text>
              </View>
            )}
            {item.projectType === 'Interior' && (
              <View style={[styles.interiorBadge, { backgroundColor: currentStatusStyles.bg }]}>
                <Text style={[styles.interiorBadgeText, { color: accentColor }]}>INTERIOR</Text>
              </View>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.cardProgressRow}>
            <View style={styles.cardProgressTrack}>
              <View style={[styles.cardProgressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.cardProgressValue}>{Math.round(progress * 100)}%</Text>
          </View>

          {/* Surveyor alerts (only for assigned surveyor) */}
          {(item.siteSurveyor?._id || item.siteSurveyor) === (user?.id || user?._id) && (item.status === 'Site Survey' || item.status === 'Planning') && item.surveyStatus !== 'Approved' && (
            <View style={{ gap: 6, marginBottom: 8 }}>
              {item.surveyStatus === 'Needs Attention' && (
                <View style={styles.surveyAlertBox}>
                  <MaterialIcons name="warning" size={12} color="#DC2626" />
                  <Text style={styles.surveyAlertText}>{t('surveyRejected')}</Text>
                </View>
              )}
              {item.surveyStatus === 'Submitted' && item.surveyRejectionReason && (
                <View style={[styles.surveyAlertBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                  <MaterialIcons name="check-circle" size={12} color="#16A34A" />
                  <Text style={[styles.surveyAlertText, { color: '#16A34A' }]}>{t('rejectionResolved')}</Text>
                </View>
              )}
            </View>
          )}

          {/* Footer Actions */}
          <View style={styles.cardFooterRow}>
            <View style={styles.cardFooterDate}>
              <MaterialIcons name="calendar-today" size={11} color="#197ef1ff" />
              <Text style={styles.cardFooterDateText}>
                {item.startDate ? new Date(item.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No date'}
              </Text>
            </View>
            {/* Send for Site Survey icon button */}
            {item.needSiteSurvey && !item.siteSurveyor && (
              <TouchableOpacity
                style={[styles.cardActionBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                activeOpacity={0.7}
                onPress={(e) => { e.stopPropagation(); handleSendForSiteSurvey(item._id); }}
              >
                <MaterialIcons name="send" size={14} color="#2563EB" />
              </TouchableOpacity>
            )}
            {/* Perform / Edit Site Survey icon button */}
            {(item.siteSurveyor?._id || item.siteSurveyor) === (user?.id || user?._id) && (item.status === 'Site Survey' || item.status === 'Planning') && item.surveyStatus !== 'Approved' && (
              <TouchableOpacity
                style={[styles.cardActionBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                activeOpacity={0.7}
                onPress={(e) => {
                  e.stopPropagation();
                  const currentBudget = item.budgetHistory?.length ? item.budgetHistory[item.budgetHistory.length - 1].amount : 0;
                  router.push({ pathname: `/project/${item._id}/site-survey`, params: { currentBudget, editMode: item.surveyStatus ? 'true' : 'false', projectType: item.projectType || 'Construction', currency: item.currency || 'AED' } });
                }}
              >
                <MaterialIcons name="assignment" size={14} color="#2563EB" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cardActionBtn}
              activeOpacity={0.7}
              onPress={(e) => { e.stopPropagation(); router.push({ pathname: `/project/${item._id}`, params: { initialTab: 'Chat' } }); }}
            >
              <Feather name="message-circle" size={14} color="#10B981" />
              {(item.unreadMessageCount > 0) && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{item.unreadMessageCount > 9 ? '9+' : item.unreadMessageCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardActionBtn}
              activeOpacity={0.7}
              onPress={(e) => { e.stopPropagation(); handleEditProject(item); }}
            >
              <Feather name="edit-2" size={14} color="#64748B" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardActionBtn, styles.deleteBtn]}
              activeOpacity={0.7}
              onPress={(e) => { e.stopPropagation(); handleDeleteProject(item._id); }}
            >
              <Feather name="trash-2" size={14} color="#EF4444" />
            </TouchableOpacity>
          </View>

        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <SimpleBackground />
      <SafeAreaView style={styles.container} edges={['bottom']}>

        {/* ── Header (outside scroll, matches dashboard) ── */}
        <View style={[styles.modernHeader, { paddingTop: insets.top + 12 }]}>
          <View style={styles.modernHeaderLeft}>
            <View style={styles.greetingRow}>

            </View>
            <Text style={styles.modernTitle}>{t('my')}<Text style={styles.modernTitleHighlight}> {t('projects')}</Text></Text>
          </View>
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.modernAddBtn}
              activeOpacity={0.8}
              onPress={() => {
                const hasCreatePermission = user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*') || user?.role?.permissions?.includes('projects:create');
                if (!hasCreatePermission) {
                  showToast('You do not have permission to create projects.', 'error');
                  return;
                }
                setModalStep('category');
                setIsModalVisible(true);
              }}
            >
              <MaterialIcons name="add" size={20} color="#FFF" />
            </TouchableOpacity>
            {/* <View style={styles.bellScale}>
              <HeaderNotification />
            </View> */}
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#3B82F6"
              colors={['#3B82F6']}
            />
          }
        >
          {/* Search & Filter */}
          <View style={{ marginBottom: 24, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <AdaptiveGlass intensity={10} tint="light" style={[styles.searchContainer, { marginBottom: 0, flex: 1 }]}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('searchProjectsLeads')}
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </AdaptiveGlass>
              <TouchableOpacity
                style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]}
                onPress={() => setShowFilters(!showFilters)}
                activeOpacity={0.8}
              >
                <Ionicons name="options" size={20} color={showFilters ? '#FFF' : '#64748B'} />
              </TouchableOpacity>
            </View>

            {showFilters && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
                {['All', 'Initialized', 'Planning', 'Site Survey', 'Ongoing', 'Completed', 'On Hold', 'Cancelled'].map(status => (
                  <TouchableOpacity
                    key={status}
                    style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
                    onPress={() => setStatusFilter(status)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>{t(status.replace(/ /g, ''), status)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {isLoadingData ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={{ marginTop: 12, color: '#94A3B8', fontFamily: 'Inter-SemiBold' }}>{t('synchronizingWorkspace')}</Text>
            </View>
          ) : filteredProjects.length > 0 ? (
            <FlatList
              data={filteredProjects}
              renderItem={renderProjectCard}
              keyExtractor={item => item._id}
              scrollEnabled={false}
              contentContainerStyle={styles.projectList}
            />
          ) : (
            <AdaptiveGlass intensity={10} tint="light" style={styles.emptyProjectsCard}>
              <MaterialIcons name="work-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>{t('noActiveProjects')}</Text>
              <Text style={styles.emptySub}>{t('startNewProject')}</Text>
            </AdaptiveGlass>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Template Selection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => { setIsModalVisible(false); setNewCategoryName(''); setModalStep('category'); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalDismiss}
              activeOpacity={1}
              onPress={() => setIsModalVisible(false)}
            />

            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <View style={styles.modalTitleContent}>
                    <Text style={styles.modalTitle}>
                      {modalStep === 'create-category' ? t('createCategory') : modalStep === 'category' ? t('selectProjectCategory') : `${t('templatesLabel')} ${selectedCategory?.name}`}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {modalStep === 'create-category' ? t('chooseCategoryName') : modalStep === 'category' ? t('chooseCategoryForProject') : t('selectTemplateForProject')}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {modalStep === 'category' && (
                      <TouchableOpacity
                        onPress={() => setModalStep('create-category')}
                        style={styles.headerSmallAddBtn}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="add" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => { if (modalStep === 'template') setModalStep('category'); else if (modalStep === 'create-category') { setModalStep('category'); setNewCategoryName(''); } else { setIsModalVisible(false); setModalStep('category'); } }}
                      style={styles.modalBackBtn}
                    >
                      <MaterialIcons name={modalStep === 'template' ? "arrow-back" : "close"} size={24} color="#0F172A" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {isModalDataLoading ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text style={styles.loadingText}>{t('loadingOptions')}</Text>
                </View>
              ) : (
                <>
                  <ScrollView
                    contentContainerStyle={styles.modalScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {modalStep === 'create-category' ? (
                      <View style={styles.createCatForm}>
                        <View style={styles.createCatIconWrap}>
                          <MaterialIcons name="folder-open" size={32} color="#3B82F6" />
                        </View>
                        <View style={styles.createCatTextWrap}>
                          <Text style={styles.createCatLabel}>{t('categoryNameLabel')}</Text>
                          <Text style={styles.createCatHint}>{t('chooseCategoryName')}</Text>
                        </View>
                        <TextInput
                          style={styles.createCatInput}
                          placeholder={t('categoryNamePlaceholder')}
                          placeholderTextColor="#CBD5E1"
                          value={newCategoryName}
                          onChangeText={setNewCategoryName}
                          autoFocus
                          returnKeyType="done"
                          onSubmitEditing={handleCreateCategoryInline}
                        />
                        <View style={styles.suggestionRow}>
                          {['Villa', 'Apartment', 'Interior', 'Office', 'Commercial', 'Residential'].map(s => (
                            <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => setNewCategoryName(s)} activeOpacity={0.7}>
                              <Text style={styles.suggestionChipText}>{s}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <TouchableOpacity style={[styles.createCatBtn, isCreatingCategory && { opacity: 0.6 }]} onPress={handleCreateCategoryInline} disabled={isCreatingCategory} activeOpacity={0.85}>
                          {isCreatingCategory
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <><MaterialIcons name="check" size={20} color="#fff" /><Text style={styles.createCatBtnText}>{t('createAndContinue')}</Text></>}
                        </TouchableOpacity>
                      </View>
                    ) : modalStep === 'category' ? (
                      categories.length === 0 ? (
                        <View style={styles.emptyModalState}>
                          <MaterialIcons name="folder-open" size={48} color="#CBD5E1" />
                          <Text style={styles.emptyTitle}>{t('noCategoriesYet')}</Text>
                          <Text style={styles.emptySub}>{t('createFirstCategory')}</Text>
                          <TouchableOpacity style={styles.createCatBtn} onPress={() => setModalStep('create-category')} activeOpacity={0.85}>
                            <MaterialIcons name="add" size={18} color="#fff" />
                            <Text style={styles.createCatBtnText}>{t('createCategory')}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.categoryList}>

                          {categories.map((cat) => (
                            <TouchableOpacity
                              key={cat._id}
                              style={styles.categorySelectItem}
                              activeOpacity={0.7}
                              onPress={() => handleSelectCategory(cat)}
                            >
                              <View style={styles.categorySelectIcon}>
                                <MaterialIcons name="folder-open" size={16} color="#64748B" />
                              </View>
                              <View style={styles.categorySelectInfo}>
                                <Text style={styles.categorySelectName}>{cat.name}</Text>
                              </View>
                              <MaterialIcons name="chevron-right" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )
                    ) : (
                      <View style={styles.templateList}>
                        {!!inlineSuccessMsg && (
                          <View style={{ backgroundColor: '#D1FAE5', padding: 12, borderRadius: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <MaterialIcons name="check-circle" size={20} color="#059669" />
                            <Text style={{ color: '#065F46', fontFamily: 'Inter-Medium', fontSize: 13, flex: 1 }}>{inlineSuccessMsg}</Text>
                          </View>
                        )}
                        {templates
                          .filter(t => t.category?._id === selectedCategory?._id || t.category === selectedCategory?._id)
                          .map((tpl) => (
                            <TouchableOpacity
                              key={tpl._id}
                              style={styles.tplSelectItem}
                              activeOpacity={0.7}
                              onPress={() => handleSelectTemplate(tpl)}
                            >
                              <View style={styles.tplSelectIcon}>
                                <MaterialIcons name="description" size={22} color="#3B82F6" />
                              </View>
                              <View style={styles.tplSelectInfo}>
                                <Text style={styles.tplSelectName}>{tpl.name}</Text>
                                <Text style={styles.tplSelectSub}>{t('presetConfigurationsReady')}</Text>
                              </View>
                              <MaterialIcons name="chevron-right" size={18} color="#CBD5E1" />
                            </TouchableOpacity>
                          ))}

                        {/* Custom Requirement Option */}
                        <TouchableOpacity
                          style={[styles.tplSelectItem, styles.customTplItem]}
                          activeOpacity={0.7}
                          onPress={handleCustomRequirement}
                        >
                          <View style={[styles.tplSelectIcon, styles.customTplIcon]}>
                            <MaterialIcons name="bolt" size={22} color="#F59E0B" />
                          </View>
                          <View style={styles.tplSelectInfo}>
                            <Text style={[styles.tplSelectName, { color: '#B45309' }]}>{t('customRequirement')}</Text>
                            <Text style={styles.tplSelectSub}>{t('startFromScratch')}</Text>
                          </View>
                          <MaterialIcons name="chevron-right" size={18} color="#F59E0B" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Site Survey Assignment Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isSurveyModalVisible}
        onRequestClose={() => setIsSurveyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismiss}
            activeOpacity={1}
            onPress={() => setIsSurveyModalVisible(false)}
          />

          <AdaptiveGlass intensity={95} tint="light" style={styles.rolePickerContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Text style={styles.modalTitle}>{t('assignSiteSurveyor')}</Text>
                <TouchableOpacity onPress={() => setIsSurveyModalVisible(false)} style={styles.modalBackBtn}>
                  <MaterialIcons name="close" size={24} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>

            <AdaptiveGlass intensity={10} tint="light" style={styles.pickerSearchBar}>
              <MaterialIcons name="search" size={20} color="#94A3B8" />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder={t('searchTeamMembers')}
                placeholderTextColor="#94A3B8"
                value={memberSearchQuery}
                onChangeText={setMemberSearchQuery}
              />
            </AdaptiveGlass>

            <ScrollView style={styles.rolePickerList} showsVerticalScrollIndicator={false}>
              <View style={styles.pickerFullList}>
                {isFetchingMembers ? (
                  <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
                ) : filteredMembersForSurvey.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 }}>
                    <MaterialIcons name="person-off" size={40} color="#CBD5E1" />
                    <Text style={{ textAlign: 'center', marginTop: 12, color: '#94A3B8', fontFamily: 'Inter-SemiBold', fontSize: 14 }}>
                      {t('noEligibleMembers')}
                    </Text>
                    <Text style={{ textAlign: 'center', marginTop: 6, color: '#CBD5E1', fontFamily: 'Inter-Medium', fontSize: 12 }}>
                      {t('noEligibleMembersDesc')}
                    </Text>
                  </View>
                ) : (
                  filteredMembersForSurvey.map(member => (
                    <TouchableOpacity
                      key={member._id}
                      style={styles.roleListItem}
                      onPress={() => handleMemberTapForSurvey(member)}
                      disabled={isAssigningSurvey}
                    >
                      <View style={[styles.circleAvatarSmall]}>
                        <Text style={styles.cAvSmallText}>{(member.name || 'U').charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.listItemTextContainer}>
                        <Text style={styles.roleListItemText}>{member.name}</Text>
                        <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, fontFamily: 'Inter-Medium' }}>
                          {member.role?.name || 'Member'} · {member.email}
                        </Text>
                      </View>
                      {isAssigningSurvey ? (
                        <ActivityIndicator size="small" color="#3B82F6" />
                      ) : (
                        <MaterialIcons name="chevron-right" size={20} color="#CBD5E1" />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </ScrollView>
          </AdaptiveGlass>
        </View>
      </Modal>

      {/* Site Survey Assignment Confirmation Modal */}
      <ConfirmModal
        visible={surveyConfirmModal.visible}
        title={t('assignSiteSurveyor')}
        message={`${surveyConfirmModal.member?.name || ''} (${surveyConfirmModal.member?.role?.name || 'Member'})`}
        confirmText={t('assign')}
        type="success"
        isSubmitting={isAssigningSurvey}
        onConfirm={confirmAssignSurveyor}
        onCancel={() => setSurveyConfirmModal({ visible: false, member: null })}
      />

      {/* Modern Snagging Notification Modal */}
      <ConfirmModal
        visible={!!snaggingNotification}
        title={t('snaggingAvailable')}
        message={t('snaggingAvailableMsg', { name: snaggingNotification?.name })}
        confirmText={t('goToProject')}
        onConfirm={() => {
          const project = snaggingNotification;
          setSnaggingNotification(null);
          router.push({
            pathname: `/project/${project._id}`,
            params: { initialTab: 'Snagging' }
          });
        }}
        onCancel={() => setSnaggingNotification(null)}
      />

      <ConfirmModal
        visible={deleteModal.visible}
        title={t('deleteProject')}
        message={t('deleteProjectMsg')}
        confirmText={t('deleteProject')}
        type="destructive"
        isSubmitting={isDeleting}
        onConfirm={confirmDeleteProject}
        onCancel={() => setDeleteModal({ visible: false, projectId: null })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#DBEAFE',
  },
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFF',
  },

  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  modernHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#DBEAFE',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  modernHeaderLeft: {
    flex: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  greetingText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
    marginBottom: 2,
  },
  waveEmoji: {
    fontSize: 12,
  },
  modernTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  modernTitleHighlight: {
    color: '#0F172A',
  },
  modernAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellScale: {
    transform: [{ scale: 0.78 }],
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInner: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    color: '#fff',
    fontFamily: 'Inter-Bold',
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 24,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
    height: '100%',
  },
  filterToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterToggleBtnActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterChips: {
    maxHeight: 32,
    marginTop: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterChipText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  bentoGrid: {
    flexDirection: 'row',
    height: 240,
    marginBottom: 44,
  },
  featuredCard: {
    flex: 1.6,
    marginRight: 16,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  featuredGradient: {
    flex: 1,
    padding: 24,
    justifyContent: 'flex-end',
  },
  featuredLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 1,
  },
  featuredName: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  featuredStats: {
    flexDirection: 'row',
    gap: 24,
  },
  featuredStatItem: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  featuredStatVal: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  featuredStatLab: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'Inter-SemiBold',
  },
  bentoRightCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  smallBentoCard: {
    height: '47%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  bentoStatValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginTop: 10,
  },
  bentoStatLabel: {
    fontSize: 11,
    color: '#3B82F6',
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  sectionLink: {
    fontSize: 14,
    color: '#2563EB',
    fontFamily: 'Inter-Bold',
  },
  projectList: {
    gap: 12,
  },
  glassProjectCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  // ── Card Header ──
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#EFF6FF',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  cardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardAvatarText: {
    fontSize: 14,
    fontFamily: 'Inter-Black',
    letterSpacing: 0.5,
  },
  cardCategoryLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#3B82F6',
    opacity: 0.85,
    marginBottom: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    flexShrink: 0,
  },
  statusPillText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── Card Body ──
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 10,
    backgroundColor: '#F8FBFF',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  cardLocText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
    flex: 1,
  },
  cardProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  cardProgressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#DBEAFE',
    borderRadius: 99,
    overflow: 'hidden',
  },
  cardProgressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#3B82F6',
  },
  cardProgressValue: {
    fontSize: 11,
    fontFamily: 'Inter-Black',
    color: '#2563EB',
    width: 32,
    textAlign: 'right',
  },
  surveyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginBottom: 8,
    borderWidth: 1,
  },
  surveyBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  surveyAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  surveyAlertText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
    flex: 1,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#DBEAFE',
  },
  cardFooterDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  cardFooterDateText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',

  },
  cardActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 7,
    fontFamily: 'Inter-Bold',
  },
  projectInfo: {
    marginBottom: 16,
  },
  projectTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  projectIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectTextContent: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 12,
  },
  actionRequiredBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  actionRequiredText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#D97706',
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  projectName: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  projectLoc: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter-Medium',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  interiorBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
  },
  interiorBadgeText: {
    fontSize: 8,
    fontFamily: 'Inter-Bold',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  projectType: {
    fontSize: 10,
    color: '#3B82F6',
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
  projectDate: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'Inter-Bold',
    fontFamily: 'Inter-Bold',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#a1a1a1ff',
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerInfo: {
    gap: 2,
  },
  footerLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'Inter-Bold',
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
  },
  footerVal: {
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'Inter-Bold',
    fontFamily: 'Inter-Bold',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'Inter-Bold',
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
  },
  topRightActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  cardActionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  cardActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#F4F7FD',
    borderWidth: 1,
    borderColor: '#E2EAF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  priorityTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
  },
  eliteProgressContainer: {
    width: 120,
  },
  eliteProgressBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  eliteProgressBarFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  eliteProgressValue: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    width: 40,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.4)', // Solid semi-transparent dark overlay
  },
  modalDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    width: '100%',
    maxHeight: height * 0.7,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalTitleContent: {
    flex: 1,
    marginRight: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    lineHeight: 20,
  },
  headerSmallAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
  },
  modalBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoading: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontFamily: 'Inter-SemiBold',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  categoryList: {
    gap: 12,
    paddingBottom: 24,
  },
  categorySelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categorySelectIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  categorySelectInfo: {
    flex: 1,
  },
  categorySelectName: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  categorySelectSub: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  categoryAddCard: {
    backgroundColor: '#F8FAFF',
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  categoryAddIcon: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  categoryAddName: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#3B82F6',
    marginBottom: 2,
  },
  templateList: {
    gap: 12,
  },
  tplSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  tplSelectIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tplSelectInfo: {
    flex: 1,
  },
  tplSelectName: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  tplSelectSub: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#94A3B8',
  },
  customTplItem: {
    borderColor: '#FEF3C7',
    backgroundColor: '#FFFBEB',
    marginTop: 8,
  },
  customTplIcon: {
    backgroundColor: '#FEF3C7',
  },
  emptyModalState: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyProjectsCard: {
    padding: 60,
    alignItems: 'center',
    borderRadius: 32,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  createCatForm: { paddingHorizontal: 8, paddingTop: 4 },
  createCatIconWrap: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16, alignSelf: 'center' },
  createCatTextWrap: { marginBottom: 16, alignItems: 'center' },
  createCatLabel: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 4, textAlign: 'center' },
  createCatHint: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', paddingHorizontal: 20 },
  createCatInput: { width: '100%', height: 56, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', paddingHorizontal: 16, fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A', marginBottom: 16 },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24, justifyContent: 'center' },
  suggestionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  suggestionChipText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#475569' },
  createCatBtn: { width: '100%', height: 56, borderRadius: 16, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  createCatBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  surveyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  surveyActionText: {
    fontSize: 13,
    color: '#2563EB',
    fontFamily: 'Inter-SemiBold',
  },
  rolePickerContent: {
    width: '100%',
    height: height * 0.7,
    borderRadius: 32,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE'
  },
  pickerSearchBar: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginBottom: 20
  },
  pickerSearchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A'
  },
  rolePickerList: {
    flex: 1
  },
  pickerFullList: {
    marginTop: 8
  },
  roleListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  listItemTextContainer: {
    flex: 1
  },
  roleListItemText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A'
  },
  circleAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cAvSmallText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Inter-Bold',
  },
});
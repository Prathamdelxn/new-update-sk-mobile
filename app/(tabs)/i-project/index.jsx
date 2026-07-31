import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import HeaderNotification from '../../components/HeaderNotification';
import ConfirmModal from '../../components/ConfirmModal';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const STATUSES = ['All', 'Initialized', 'Planning', 'Site Survey', 'Ongoing', 'Completed', 'On Hold'];

const STATUS_META = {
  Ongoing:     { color: '#2563EB', bg: '#EFF6FF' },
  Planning:    { color: '#7C3AED', bg: '#F5F3FF' },
  Completed:   { color: '#16A34A', bg: '#F0FDF4' },
  'On Hold':   { color: '#D97706', bg: '#FFFBEB' },
  Initialized: { color: '#64748B', bg: '#F8FAFC' },
  'Site Survey': { color: '#0891B2', bg: '#ECFEFF' },
};

export default function InteriorProjectsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Category / Template selection modal (mirrors construction's project creation flow)
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalStep, setModalStep] = useState('category'); // 'category' | 'create-category' | 'template'
  const [categories, setCategories] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isModalDataLoading, setIsModalDataLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [inlineSuccessMsg, setInlineSuccessMsg] = useState('');

  const [deleteModal, setDeleteModal] = useState({ visible: false, projectId: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProjects = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setProjects(Array.isArray(data) ? data : data?.projects || data?.data || []);
      }
    } catch (e) {
      console.error('Fetch interior projects error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchProjects(); }, [fetchProjects]));

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = p.name?.toLowerCase().includes(q) || p.clientName?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const fetchModalData = async () => {
    try {
      if (categories.length === 0) setIsModalDataLoading(true);
      const [catRes, tempRes] = await Promise.all([
        fetch(`${API_BASE_URL}/template-categories`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/templates`, { headers: { Authorization: `Bearer ${token}` } }),
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

  const openCreate = () => {
    setModalStep('category');
    setSelectedCategory(null);
    setNewCategoryName('');
    setIsModalVisible(true);
    fetchModalData();
  };

  const handleCreateCategoryInline = async () => {
    const name = newCategoryName.trim();
    if (!name) return showToast('Please enter a category name.', 'error');
    setIsCreatingCategory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/template-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create category');
      setCategories((prev) => [...prev, data]);
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

  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
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
        categoryName: selectedCategory.name,
      },
    });
  };

  const handleCustomRequirement = () => {
    setIsModalVisible(false);
    router.push({
      pathname: '/create-project',
      params: {
        isCustom: 'true',
        categoryId: selectedCategory._id,
        categoryName: selectedCategory.name,
      },
    });
  };

  const openEdit = (project) => {
    const hasEditPermission = user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*') || user?.role?.permissions?.includes('projects:update') || user?.role?.permissions?.includes('projects:edit');
    if (!hasEditPermission) return showToast('You do not have permission to edit projects.', 'error');
    router.push({
      pathname: '/create-project',
      params: {
        id: project._id,
        isEditing: 'true',
        projectName: project.name,
        clientName: project.description?.match(/(?:Client: )(.*?)(?:\. |$)/)?.[1] || '',
        location: project.description?.match(/(?:Location: )(.*?)(?:\. |$)/)?.[1] || project.description?.replace(/^(?:Client: .*?\. )?/, '') || '',
        status: project.status,
        priority: project.priority,
        startDate: project.startDate,
        targetDate: project.endDate,
        area: project.area?.toString() || '',
        budget: project.budgetHistory?.length ? project.budgetHistory[project.budgetHistory.length - 1].amount?.toString() : (project.budget?.toString() || ''),
        currency: project.currency || 'AED',
      },
    });
  };

  const handleDelete = (projectId) => {
    const hasDeletePermission = user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*') || user?.role?.permissions?.includes('projects:delete');
    if (!hasDeletePermission) return showToast('You do not have permission to delete projects.', 'error');
    setDeleteModal({ visible: true, projectId });
  };

  const confirmDeleteProject = async () => {
    try {
      setIsDeleting(true);
      const res = await fetch(`${API_BASE_URL}/projects/${deleteModal.projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('Project deleted successfully', 'delete');
        setDeleteModal({ visible: false, projectId: null });
        fetchProjects();
      } else {
        const errData = await res.json().catch(() => ({ message: 'Server error' }));
        showToast(errData.message || 'Failed to delete project', 'error');
      }
    } catch (e) {
      showToast('Network error. Check server/IP.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <View style={s.bgBase} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={s.headerGreeting}>Workspace</Text>
            <Text style={s.pageTitle}>Interior Projects</Text>
          </View>
          <HeaderNotification />
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchProjects(true)} tintColor="#2563EB" colors={['#2563EB']} />}
          >
            <View style={s.searchRow}>
              <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search projects or clients..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {STATUSES.map((status) => {
                const active = statusFilter === status;
                return (
                  <TouchableOpacity key={status} style={[s.chip, active && s.chipActive]} onPress={() => setStatusFilter(status)}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{status}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ marginTop: 14, gap: 12 }}>
              {filteredProjects.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="folder-open-outline" size={44} color="#94A3B8" />
                  <Text style={s.emptyTitle}>No interior projects found</Text>
                  <TouchableOpacity style={s.emptyBtn} onPress={openCreate}>
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={s.emptyBtnText}>Create Interior Project</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredProjects.map((project) => {
                  const meta = STATUS_META[project.status] || STATUS_META['Initialized'];
                  return (
                    <TouchableOpacity
                      key={project._id}
                      style={s.projectCard}
                      onPress={() => router.push(`/project/${project._id}`)}
                    >
                      <View style={s.projectTopRow}>
                        <View style={s.projectIconBox}>
                          <Ionicons name="grid-outline" size={16} color="#2563EB" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.projectName} numberOfLines={1}>{project.name}</Text>
                          <Text style={s.projectSub} numberOfLines={1}>{project.clientName || 'No client'}</Text>
                        </View>
                        <TouchableOpacity onPress={() => openEdit(project)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="pencil-outline" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(project._id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 12 }}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                      <View style={s.projectBottomRow}>
                        <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
                          <Text style={[s.statusBadgeText, { color: meta.color }]}>{project.status || 'Ongoing'}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        <TouchableOpacity style={s.fab} onPress={openCreate}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Category / Template Selection Modal — same flow as construction project creation */}
      <Modal
        animationType="fade"
        transparent
        visible={isModalVisible}
        onRequestClose={() => { setIsModalVisible(false); setNewCategoryName(''); setModalStep('category'); }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={s.modalOverlay}>
            <TouchableOpacity style={s.modalDismiss} activeOpacity={1} onPress={() => setIsModalVisible(false)} />

            <View style={s.modalContent}>
              <View style={s.modalHeader}>
                <View style={s.modalTitleRow}>
                  <View style={s.modalTitleContent}>
                    <Text style={s.modalTitle}>
                      {modalStep === 'create-category' ? 'Create Category' : modalStep === 'category' ? 'Select Project Category' : `Templates — ${selectedCategory?.name}`}
                    </Text>
                    <Text style={s.modalSubtitle}>
                      {modalStep === 'create-category' ? 'Choose a name for the new category' : modalStep === 'category' ? 'Choose a category for this interior project' : 'Select a template to prefill the project'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {modalStep === 'category' && (
                      <TouchableOpacity onPress={() => setModalStep('create-category')} style={s.headerSmallAddBtn} activeOpacity={0.7}>
                        <MaterialIcons name="add" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        if (modalStep === 'template') setModalStep('category');
                        else if (modalStep === 'create-category') { setModalStep('category'); setNewCategoryName(''); }
                        else { setIsModalVisible(false); setModalStep('category'); }
                      }}
                      style={s.modalBackBtn}
                    >
                      <MaterialIcons name={modalStep === 'template' ? 'arrow-back' : 'close'} size={24} color="#0F172A" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {isModalDataLoading ? (
                <View style={s.modalLoading}>
                  <ActivityIndicator size="large" color="#2563EB" />
                  <Text style={s.loadingText}>Loading options…</Text>
                </View>
              ) : (
                <ScrollView contentContainerStyle={s.modalScroll} showsVerticalScrollIndicator={false}>
                  {modalStep === 'create-category' ? (
                    <View style={s.createCatForm}>
                      <View style={s.createCatIconWrap}>
                        <MaterialIcons name="folder-open" size={32} color="#2563EB" />
                      </View>
                      <View style={s.createCatTextWrap}>
                        <Text style={s.createCatLabel}>Category Name</Text>
                        <Text style={s.createCatHint}>Give this project category a clear, reusable name</Text>
                      </View>
                      <TextInput
                        style={s.createCatInput}
                        placeholder="e.g. Residential Villa"
                        placeholderTextColor="#CBD5E1"
                        value={newCategoryName}
                        onChangeText={setNewCategoryName}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={handleCreateCategoryInline}
                      />
                      <View style={s.suggestionRow}>
                        {['Residential', 'Commercial', 'Hospitality', 'Retail', 'Office', 'Villa'].map((sug) => (
                          <TouchableOpacity key={sug} style={s.suggestionChip} onPress={() => setNewCategoryName(sug)} activeOpacity={0.7}>
                            <Text style={s.suggestionChipText}>{sug}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity style={[s.createCatBtn, isCreatingCategory && { opacity: 0.6 }]} onPress={handleCreateCategoryInline} disabled={isCreatingCategory} activeOpacity={0.85}>
                        {isCreatingCategory ? <ActivityIndicator size="small" color="#fff" /> : (
                          <>
                            <MaterialIcons name="check" size={20} color="#fff" />
                            <Text style={s.createCatBtnText}>Create & Continue</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : modalStep === 'category' ? (
                    categories.length === 0 ? (
                      <View style={s.emptyModalState}>
                        <MaterialIcons name="folder-open" size={48} color="#CBD5E1" />
                        <Text style={s.emptyModalTitle}>No categories yet</Text>
                        <Text style={s.emptyModalSub}>Create your first project category to get started</Text>
                        <TouchableOpacity style={s.createCatBtn} onPress={() => setModalStep('create-category')} activeOpacity={0.85}>
                          <MaterialIcons name="add" size={18} color="#fff" />
                          <Text style={s.createCatBtnText}>Create Category</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={s.categoryList}>
                        {categories.map((cat) => (
                          <TouchableOpacity key={cat._id} style={s.categorySelectItem} activeOpacity={0.7} onPress={() => handleSelectCategory(cat)}>
                            <View style={s.categorySelectIcon}>
                              <MaterialIcons name="folder-open" size={16} color="#64748B" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.categorySelectName}>{cat.name}</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color="#CBD5E1" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )
                  ) : (
                    <View style={s.templateList}>
                      {!!inlineSuccessMsg && (
                        <View style={s.successBanner}>
                          <MaterialIcons name="check-circle" size={20} color="#059669" />
                          <Text style={s.successBannerText}>{inlineSuccessMsg}</Text>
                        </View>
                      )}
                      {templates
                        .filter((t) => (t.category?._id || t.category) === selectedCategory?._id)
                        .map((tpl) => (
                          <TouchableOpacity key={tpl._id} style={s.tplSelectItem} activeOpacity={0.7} onPress={() => handleSelectTemplate(tpl)}>
                            <View style={s.tplSelectIcon}>
                              <MaterialIcons name="description" size={22} color="#2563EB" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.tplSelectName}>{tpl.name}</Text>
                              <Text style={s.tplSelectSub}>Preset configuration ready</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={18} color="#CBD5E1" />
                          </TouchableOpacity>
                        ))}

                      <TouchableOpacity style={[s.tplSelectItem, s.customTplItem]} activeOpacity={0.7} onPress={handleCustomRequirement}>
                        <View style={[s.tplSelectIcon, s.customTplIcon]}>
                          <MaterialIcons name="bolt" size={22} color="#F59E0B" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.tplSelectName, { color: '#B45309' }]}>Custom Requirement</Text>
                          <Text style={s.tplSelectSub}>Start from scratch</Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={18} color="#F59E0B" />
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmModal
        visible={deleteModal.visible}
        title="Delete Project"
        message="Are you sure you want to delete this project? This cannot be undone."
        confirmText="Delete"
        type="destructive"
        isSubmitting={isDeleting}
        onConfirm={confirmDeleteProject}
        onCancel={() => setDeleteModal({ visible: false, projectId: null })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  header: {
    backgroundColor: '#DBEAFE', paddingHorizontal: 24, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#DBEAFE',
  },
  headerGreeting: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#1D4ED8', marginBottom: 2 },
  pageTitle: { fontSize: 22, fontFamily: 'Inter-Black', color: '#0F172A', letterSpacing: -0.5 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#DBEAFE',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },

  chipRow: { gap: 8, paddingVertical: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFDBFE' },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  chipTextActive: { color: '#FFFFFF' },

  projectCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#DBEAFE', gap: 10 },
  projectTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  projectIconBox: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  projectName: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  projectSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  projectBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold' },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  fab: {
    position: 'absolute', right: 20, bottom: 100,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  // Category / Template selection modal (mirrors construction project/index.jsx)
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalDismiss: { ...StyleSheet.absoluteFillObject },
  modalContent: { backgroundColor: '#F8FAFC', borderRadius: 16, width: '100%', maxHeight: '70%', overflow: 'hidden' },
  modalHeader: { paddingVertical: 24, paddingHorizontal: 20, paddingBottom: 16 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  modalTitleContent: { flex: 1, marginRight: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 8 },
  modalSubtitle: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', lineHeight: 20 },
  headerSmallAddBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2563EB' },
  modalBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  modalLoading: { height: 300, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748B', fontFamily: 'Inter-SemiBold' },
  modalScroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 },

  categoryList: { gap: 12, paddingBottom: 24 },
  categorySelectItem: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  categorySelectIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  categorySelectName: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },

  templateList: { gap: 12 },
  tplSelectItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#DBEAFE' },
  tplSelectIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  tplSelectName: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 2 },
  tplSelectSub: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },
  customTplItem: { borderColor: '#FEF3C7', backgroundColor: '#FFFBEB', marginTop: 8 },
  customTplIcon: { backgroundColor: '#FEF3C7' },

  successBanner: { backgroundColor: '#D1FAE5', padding: 12, borderRadius: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  successBannerText: { color: '#065F46', fontFamily: 'Inter-Medium', fontSize: 13, flex: 1 },

  emptyModalState: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyModalTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 16 },
  emptyModalSub: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#94A3B8', marginTop: 4, marginBottom: 20, textAlign: 'center' },

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
});

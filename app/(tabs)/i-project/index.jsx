import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useToast } from '../../context/ToastContext';
import HeaderNotification from '../../components/HeaderNotification';
import { queryKeys, invalidateProjectQueries, useRefreshOnFocus } from '../../context/QueryProvider';
import interiorApiClient from '../../services/interiorApiClient';

const HEALTH_META = {
  'on-track': { label: 'On Track', color: '#16A34A', bg: '#F0FDF4' },
  'at-risk':  { label: 'At Risk',  color: '#D97706', bg: '#FFFBEB' },
  delayed:    { label: 'Delayed',  color: '#DC2626', bg: '#FEF2F2' },
  completed:  { label: 'Completed', color: '#2563EB', bg: '#EFF6FF' },
};

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'on-track', label: 'On Track' },
  { key: 'at-risk', label: 'At Risk' },
  { key: 'completed', label: 'Completed' },
];

// Must match the backend's createProjectSchema `type` enum exactly.
const PROJECT_TYPES = ['Commercial Office', 'Residential', 'Tech Office', 'General'];

const emptyForm = {
  name: '', client: '', type: 'General', startDate: null, endDate: null,
  budgetAmount: '', description: '', city: '', address: '', templateId: '',
};

function formatDate(d) {
  if (!d) return 'Select date';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Budget can live on `project.budget` (number), `project.budget.amount`, or the
// legacy `project.totalBudget` field depending on how the project was created —
// check all three, matching web's fallback chain exactly.
function getProjectBudget(project) {
  if (!project) return 0;
  if (typeof project.budget === 'number') return project.budget;
  if (typeof project.budget?.amount === 'number') return project.budget.amount;
  if (typeof project.totalBudget === 'number') return project.totalBudget;
  const parsed = Number(project.budget?.amount || project.budget || project.totalBudget || 0);
  return isNaN(parsed) ? 0 : parsed;
}

function formatBudget(amount) {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  if (!num || num <= 0) return '₹ 0';
  if (num >= 10000000) return `₹ ${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹ ${(num / 100000).toFixed(2)} Lakh`;
  return `₹ ${num.toLocaleString('en-IN')}`;
}

export default function InteriorProjectsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();

  const queryClient = useQueryClient();
  const projectsQuery = useQuery({
    queryKey: queryKeys.interiorProjects,
    queryFn: async () => {
      const res = await interiorApiClient.get('/projects');
      return res?.success && res?.data ? res.data : [];
    },
  });
  const templatesQuery = useQuery({
    queryKey: queryKeys.interiorTemplates,
    queryFn: async () => {
      const res = await interiorApiClient.get('/templates');
      return res?.success && res?.data?.templates ? res.data.templates : [];
    },
    staleTime: 10 * 60 * 1000,
  });
  const projects = projectsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];
  const loading = projectsQuery.isPending;
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Android's DateTimePicker is an imperative dialog that dismisses itself —
  // rendering the declarative <DateTimePicker> component there too causes a
  // double-dismiss crash on unmount. iOS still uses the declarative spinner.
  const openStartPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: form.startDate || new Date(),
        mode: 'date',
        onChange: (event, d) => {
          if (event.type === 'set' && d) {
            setForm((prev) => ({ ...prev, startDate: d, endDate: prev.endDate && prev.endDate < d ? d : prev.endDate }));
          }
        },
      });
    } else {
      setShowStartPicker(true);
    }
  };

  const openEndPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: form.endDate || form.startDate || new Date(),
        mode: 'date',
        minimumDate: form.startDate || undefined,
        onChange: (event, d) => {
          if (event.type === 'set' && d) {
            setForm((prev) => ({ ...prev, endDate: d }));
          }
        },
      });
    } else {
      setShowEndPicker(true);
    }
  };

  // Projects are cached (see QueryProvider) — reopening the tab shows them instantly.
  // Called after create/edit/delete and on pull-to-refresh to force fresh data.
  const loadProjects = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      await invalidateProjectQueries(queryClient);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  useRefreshOnFocus([queryKeys.interiorProjects, queryKeys.interiorTemplates]);

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || p.name?.toLowerCase().includes(q) || p.client?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q) || p.location?.city?.toLowerCase().includes(q);

    let matchStatus = true;
    if (statusFilter === 'on-track') matchStatus = p.health === 'on-track' || (!p.health && p.status === 'active');
    else if (statusFilter === 'at-risk') matchStatus = p.health === 'at-risk' || p.health === 'delayed';
    else if (statusFilter === 'completed') matchStatus = p.status === 'completed' || p.progress === 100;

    return matchSearch && matchStatus;
  });

  const statCounts = {
    all: projects.length,
    'on-track': projects.filter((p) => p.health === 'on-track' || (!p.health && p.status === 'active')).length,
    'at-risk': projects.filter((p) => p.health === 'at-risk' || p.health === 'delayed').length,
    completed: projects.filter((p) => p.status === 'completed' || p.progress === 100).length,
  };

  const openCreate = () => {
    setEditingProjectId(null);
    setForm(emptyForm);
    setIsModalVisible(true);
  };

  const openEdit = (project) => {
    const id = project.id || project._id;
    setEditingProjectId(id);
    setForm({
      name: project.name || '',
      client: project.client || '',
      type: project.type || 'General',
      startDate: project.startDate ? new Date(project.startDate) : null,
      endDate: project.endDate ? new Date(project.endDate) : null,
      budgetAmount: (project.budget?.amount ?? project.budget ?? project.totalBudget ?? '').toString(),
      description: project.description || '',
      city: project.location?.city || '',
      address: project.location?.address || '',
      templateId: project.templateId || '',
    });
    setIsModalVisible(true);
  };

  const handleDeleteProject = (project) => {
    const id = project.id || project._id;
    Alert.alert(
      'Delete Project',
      `Are you sure you want to delete "${project.name}"? All linked tasks, milestones, and reports will be soft-deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(id);
            try {
              await interiorApiClient.delete(`/projects/${id}`);
              showToast('Project deleted successfully', 'success');
              loadProjects();
            } catch (e) {
              showToast(e.message || 'Failed to delete project', 'error');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleCreateProject = async () => {
    if (!form.name || !form.client || !form.startDate || !form.endDate || !form.budgetAmount) {
      showToast('Please fill in project name, client, dates and budget.', 'error');
      return;
    }
    setCreateLoading(true);
    try {
      const payload = {
        name: form.name,
        client: form.client,
        type: form.type,
        startDate: form.startDate.toISOString(),
        endDate: form.endDate.toISOString(),
        budget: { amount: parseFloat(form.budgetAmount) || 0, currency: 'INR' },
        location: { city: form.city, address: form.address },
        description: form.description,
        templateId: form.templateId || undefined,
      };
      if (editingProjectId) {
        await interiorApiClient.put(`/projects/${editingProjectId}`, payload);
        showToast('Project updated successfully!', 'success');
      } else {
        await interiorApiClient.post('/projects', payload);
        showToast('Project created successfully!', 'success');
      }
      setIsModalVisible(false);
      setEditingProjectId(null);
      setForm(emptyForm);
      loadProjects();
    } catch (e) {
      showToast(e.message || 'Failed to save project', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const openProject = (project) => {
    const id = project.id || project._id;
    if (!id) {
      showToast('This project has no id and cannot be opened.', 'error');
      return;
    }
    router.push(`/i-project/${id}`);
  };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <View style={s.bgBase} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerGreeting}>Workspace</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={s.pageTitle}>Interior Projects</Text>
              <View style={s.totalBadge}>
                <Text style={s.totalBadgeText}>{projects.length} Total</Text>
              </View>
            </View>
            {/* <Text style={s.headerSubtitle}>Executive overview, tracking progress & delivery schedules.</Text> */}
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadProjects(true)} tintColor="#2563EB" colors={['#2563EB']} />}
          >
            <View style={s.searchRow}>
              <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search project, code, client, city..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
              {STATUS_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[s.filterChip, statusFilter === f.key && s.filterChipActive]}
                  onPress={() => setStatusFilter(f.key)}
                >
                  <Text style={[s.filterChipText, statusFilter === f.key && s.filterChipTextActive]}>
                    {f.label} <Text style={statusFilter === f.key ? s.filterChipCountActive : s.filterChipCount}>{statCounts[f.key]}</Text>
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ marginTop: 12, gap: 10 }}>
              {filteredProjects.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="folder-open-outline" size={44} color="#94A3B8" />
                  <Text style={s.emptyTitle}>No projects found</Text>
                  <TouchableOpacity style={s.emptyBtn} onPress={openCreate}>
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={s.emptyBtnText}>New Project</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredProjects.map((project) => {
                  const health = HEALTH_META[project.health] || (project.status === 'completed' || project.progress === 100 ? HEALTH_META.completed : HEALTH_META['on-track']);
                  const id = project.id || project._id;
                  return (
                    <View key={id} style={s.projectCard}>
                      <TouchableOpacity onPress={() => openProject(project)} activeOpacity={0.85} style={{ gap: 6 }}>
                        <View style={s.projectTopRow}>
                          <View style={s.projectIconBox}>
                            <Ionicons name="grid-outline" size={14} color="#2563EB" />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                              {!!project.code && (
                                <View style={s.codeBadge}>
                                  <Text style={s.codeBadgeText}>{project.code}</Text>
                                </View>
                              )}
                              {!!project.type && (
                                <View style={s.typeBadge}>
                                  <Text style={s.typeBadgeText}>{project.type}</Text>
                                </View>
                              )}
                            </View>
                            <Text style={s.projectName} numberOfLines={1}>{project.name}</Text>
                            <Text style={s.projectSub} numberOfLines={1}>{project.client || 'No client'}</Text>
                          </View>
                          <View style={[s.statusBadge, { backgroundColor: health.bg }]}>
                            <Text style={[s.statusBadgeText, { color: health.color }]}>{health.label}</Text>
                          </View>
                        </View>

                        <View>
                          <View style={s.statsRow}>
                            <Text style={s.statBudgetVal}>{formatBudget(getProjectBudget(project))}</Text>
                            <Text style={s.statProgressVal}>{project.progress || 0}%</Text>
                          </View>
                          <View style={s.progressTrack}>
                            <View style={[s.progressFill, { width: `${project.progress || 0}%`, backgroundColor: health.color }]} />
                          </View>
                        </View>

                        <View style={s.dateRow}>
                          <View style={s.metaRow}>
                            <Ionicons name="calendar-outline" size={11} color="#94A3B8" />
                            <Text style={s.metaText}>{project.startDate ? formatDate(new Date(project.startDate)) : '—'}</Text>
                          </View>
                          <View style={s.metaRow}>
                            <Ionicons name="flag-outline" size={11} color="#94A3B8" />
                            <Text style={s.metaText}>{project.endDate ? formatDate(new Date(project.endDate)) : '—'}</Text>
                          </View>
                          {!!(project.location?.city || project.location?.address) && (
                            <View style={s.metaRow}>
                              <Ionicons name="location-outline" size={11} color="#94A3B8" />
                              <Text style={s.metaText} numberOfLines={1}>{project.location?.city || project.location?.address}</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>

                      <View style={s.cardFooterRow}>
                        <TouchableOpacity style={s.viewProjectBtn} onPress={() => openProject(project)}>
                          <Text style={s.viewProjectBtnText}>View Project</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.cardIconBtn} onPress={() => openEdit(project)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="pencil-outline" size={14} color="#2563EB" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.cardIconBtn}
                          onPress={() => handleDeleteProject(project)}
                          disabled={deletingId === id}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {deletingId === id ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
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

      {/* New / Edit Project Modal */}
      <Modal animationType="fade" transparent visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={s.modalOverlay}>
            <TouchableOpacity style={s.modalDismiss} activeOpacity={1} onPress={() => setIsModalVisible(false)} />

            <View style={s.modalContent}>
              <View style={s.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>{editingProjectId ? 'Edit Project' : 'Create New Project'}</Text>
                  <Text style={s.modalSubtitle}>{editingProjectId ? 'Update project parameters' : 'Define your project parameters'}</Text>
                </View>
                <TouchableOpacity onPress={() => { setIsModalVisible(false); setEditingProjectId(null); }} style={s.modalBackBtn}>
                  <Ionicons name="close" size={22} color="#0F172A" />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={s.modalScroll} showsVerticalScrollIndicator={false}>
                <FormField label="Project Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="e.g. DLF Cyber Park Tower C" />
                <FormField label="Client Name *" value={form.client} onChangeText={(v) => setForm({ ...form, client: v })} placeholder="e.g. DLF Limited" />

                <Text style={s.fieldLabel}>Project Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
                  {PROJECT_TYPES.map((t) => (
                    <TouchableOpacity key={t} style={[s.typeChip, form.type === t && s.typeChipActive]} onPress={() => setForm({ ...form, type: t })}>
                      <Text style={[s.typeChipText, form.type === t && s.typeChipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {!editingProjectId && templates.length > 0 && (
                  <>
                    <Text style={s.fieldLabel}>Interior Template (Optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
                      <TouchableOpacity style={[s.typeChip, !form.templateId && s.typeChipActive]} onPress={() => setForm({ ...form, templateId: '' })}>
                        <Text style={[s.typeChipText, !form.templateId && s.typeChipTextActive]}>No Template</Text>
                      </TouchableOpacity>
                      {templates.map((t) => (
                        <TouchableOpacity key={t._id} style={[s.typeChip, form.templateId === t._id && s.typeChipActive]} onPress={() => setForm({ ...form, templateId: t._id })}>
                          <Text style={[s.typeChipText, form.templateId === t._id && s.typeChipTextActive]}>{t.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, marginBottom: 14 }}>
                    <Text style={s.fieldLabel}>Start Date *</Text>
                    <TouchableOpacity style={s.dateInput} onPress={openStartPicker}>
                      <Text style={[s.dateInputText, !form.startDate && { color: '#CBD5E1' }]}>{formatDate(form.startDate)}</Text>
                      <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                    {Platform.OS === 'ios' && showStartPicker && (
                      <DateTimePicker
                        value={form.startDate || new Date()}
                        mode="date"
                        display="spinner"
                        onChange={(e, d) => {
                          setShowStartPicker(false);
                          if (d) setForm((prev) => ({ ...prev, startDate: d, endDate: prev.endDate && prev.endDate < d ? d : prev.endDate }));
                        }}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1, marginBottom: 14 }}>
                    <Text style={s.fieldLabel}>End Date *</Text>
                    <TouchableOpacity style={s.dateInput} onPress={openEndPicker}>
                      <Text style={[s.dateInputText, !form.endDate && { color: '#CBD5E1' }]}>{formatDate(form.endDate)}</Text>
                      <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                    {Platform.OS === 'ios' && showEndPicker && (
                      <DateTimePicker
                        value={form.endDate || form.startDate || new Date()}
                        mode="date"
                        display="spinner"
                        minimumDate={form.startDate || undefined}
                        onChange={(e, d) => {
                          setShowEndPicker(false);
                          if (d) setForm((prev) => ({ ...prev, endDate: d }));
                        }}
                      />
                    )}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <FormField label="Budget (INR) *" value={form.budgetAmount} onChangeText={(v) => setForm({ ...form, budgetAmount: v })} placeholder="e.g. 15000000" keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FormField label="City" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} placeholder="e.g. Gurugram" />
                  </View>
                </View>

                <FormField label="Site Address" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} placeholder="e.g. Phase 3, Sector 24" />
                <FormField label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Specify fit-out details..." multiline />

                <TouchableOpacity style={[s.createCatBtn, createLoading && { opacity: 0.6 }]} onPress={handleCreateProject} disabled={createLoading} activeOpacity={0.85}>
                  {createLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.createCatBtnText}>{editingProjectId ? 'Save Changes' : 'Create Project'}</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FormField({ label, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.fieldInput, props.multiline && { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
        placeholderTextColor="#CBD5E1"
        {...props}
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
  headerSubtitle: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#475569', marginTop: 3 },
  totalBadge: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  totalBadgeText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#1D4ED8' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#DBEAFE',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },

  filterRow: { gap: 8, marginTop: 12, paddingVertical: 2 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterChipText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#475569' },
  filterChipTextActive: { color: '#FFFFFF' },
  filterChipCount: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#94A3B8' },
  filterChipCountActive: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#DBEAFE' },

  projectCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#DBEAFE', gap: 8 },
  projectTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  projectIconBox: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  projectName: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2 },
  projectSub: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  statusBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold' },
  cardIconBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

  codeBadge: { backgroundColor: '#F1F5F9', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  codeBadgeText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#64748B' },
  typeBadge: { backgroundColor: '#EFF6FF', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  typeBadgeText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#2563EB' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  statBudgetVal: { fontSize: 13.5, fontFamily: 'Inter-Black', color: '#16A34A' },
  statProgressVal: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },

  progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  cardFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 8 },
  viewProjectBtn: { flex: 1, backgroundColor: '#2563EB', borderRadius: 9, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  viewProjectBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

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

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalDismiss: { ...StyleSheet.absoluteFillObject },
  modalContent: { backgroundColor: '#F8FAFC', borderRadius: 16, width: '100%', maxHeight: '80%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20 },
  modalTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 4 },
  modalSubtitle: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' },
  modalBackBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  modalScroll: { paddingHorizontal: 20, paddingBottom: 24 },

  fieldLabel: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 6 },
  fieldInput: {
    height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
    paddingHorizontal: 14, fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A',
  },

  dateInput: {
    height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
    paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dateInputText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A' },

  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  typeChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  typeChipText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  typeChipTextActive: { color: '#FFFFFF' },

  createCatBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  createCatBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

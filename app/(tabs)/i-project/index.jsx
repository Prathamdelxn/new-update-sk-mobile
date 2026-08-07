import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useToast } from '../../context/ToastContext';
import HeaderNotification from '../../components/HeaderNotification';
import interiorApiClient from '../../services/interiorApiClient';

const HEALTH_META = {
  'on-track': { label: 'On Track', color: '#16A34A', bg: '#F0FDF4' },
  'at-risk':  { label: 'At Risk',  color: '#D97706', bg: '#FFFBEB' },
  delayed:    { label: 'Delayed',  color: '#DC2626', bg: '#FEF2F2' },
};

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

function formatBudget(amount) {
  if (!amount) return '₹0';
  if (amount >= 10000000) return `₹ ${(amount / 10000000).toFixed(2)} Cr`;
  return `₹ ${(amount / 100000).toFixed(2)} Lakh`;
}

export default function InteriorProjectsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();

  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

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

  const loadProjects = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await interiorApiClient.get('/projects');
      setProjects(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load interior projects', e);
      setProjects([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await interiorApiClient.get('/templates');
      setTemplates(res?.success && res?.data?.templates ? res.data.templates : []);
    } catch (e) {
      setTemplates([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadProjects(); loadTemplates(); }, [loadProjects, loadTemplates]));

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.client?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q);
  });

  const openCreate = () => {
    setForm(emptyForm);
    setIsModalVisible(true);
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
      await interiorApiClient.post('/projects', payload);
      showToast('Project created successfully!', 'success');
      setIsModalVisible(false);
      setForm(emptyForm);
      loadProjects();
    } catch (e) {
      showToast(e.message || 'Failed to create project', 'error');
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadProjects(true)} tintColor="#2563EB" colors={['#2563EB']} />}
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

            <View style={{ marginTop: 14, gap: 12 }}>
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
                  const health = HEALTH_META[project.health] || HEALTH_META['on-track'];
                  const id = project.id || project._id;
                  return (
                    <TouchableOpacity key={id} style={s.projectCard} onPress={() => openProject(project)}>
                      <View style={s.projectTopRow}>
                        <View style={s.projectIconBox}>
                          <Ionicons name="grid-outline" size={16} color="#2563EB" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.projectName} numberOfLines={1}>{project.name}</Text>
                          <Text style={s.projectSub} numberOfLines={1}>{project.client || 'No client'}</Text>
                        </View>
                        <View style={[s.statusBadge, { backgroundColor: health.bg }]}>
                          <Text style={[s.statusBadgeText, { color: health.color }]}>{health.label}</Text>
                        </View>
                      </View>

                      <View style={s.progressRow}>
                        <View style={s.progressTrack}>
                          <View style={[s.progressFill, { width: `${project.progress || 0}%`, backgroundColor: health.color }]} />
                        </View>
                        <Text style={s.progressText}>{project.progress || 0}%</Text>
                      </View>

                      <View style={s.projectBottomRow}>
                        <View style={s.metaRow}>
                          <Ionicons name="location-outline" size={12} color="#94A3B8" />
                          <Text style={s.metaText}>{project.location?.city || project.location?.address || 'Unknown'}</Text>
                        </View>
                        <Text style={s.budgetText}>{formatBudget(project.budget?.amount)}</Text>
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

      {/* New Project Modal */}
      <Modal animationType="fade" transparent visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={s.modalOverlay}>
            <TouchableOpacity style={s.modalDismiss} activeOpacity={1} onPress={() => setIsModalVisible(false)} />

            <View style={s.modalContent}>
              <View style={s.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>Create New Project</Text>
                  <Text style={s.modalSubtitle}>Define your project parameters</Text>
                </View>
                <TouchableOpacity onPress={() => setIsModalVisible(false)} style={s.modalBackBtn}>
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

                {templates.length > 0 && (
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
                  {createLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.createCatBtnText}>Create Project</Text>}
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

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#DBEAFE',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },

  projectCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#DBEAFE', gap: 10 },
  projectTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  projectIconBox: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  projectName: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  projectSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold' },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#0F172A' },

  projectBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  metaText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  budgetText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#0F172A' },

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

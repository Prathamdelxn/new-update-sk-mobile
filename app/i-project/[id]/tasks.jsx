import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: '#3B82F6' },
  { id: 'in_progress', title: 'In Progress', color: '#F59E0B' },
  { id: 'completed', title: 'Completed', color: '#10B981' },
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const PRIORITY_META = {
  low: { label: 'Low', color: '#64748B', bg: '#F1F5F9' },
  medium: { label: 'Medium', color: '#2563EB', bg: '#EFF6FF' },
  high: { label: 'High', color: '#D97706', bg: '#FFFBEB' },
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEF2F2' },
};
const TRADES = ['civil', 'interior', 'mep', 'electrical', 'hvac', 'phe', 'fire_fighting', 'elv', 'other'];

const emptyForm = { name: '', packageId: '', priority: 'medium', startDate: '', endDate: '', assigneeId: '', milestoneId: '', description: '', dependencies: [], initialSubtasks: [] };
const emptyEdit = { packageId: '', name: '', description: '', priority: 'medium', status: 'todo', assigneeId: '', startDate: '', endDate: '', progress: 0, dependencies: [], subtasks: [] };

// Legacy status mapping, matches web's normalizeTaskStatus
function normalizeTaskStatus(st) {
  if (st === 'backlog') return 'todo';
  if (st === 'in_review') return 'in_progress';
  return st || 'todo';
}

function extractPackages(node, out, path = '') {
  if (!node) return;
  const currentPath = path ? `${path} › ${node.name}` : node.name;
  if (node.type === 'package') out.push({ ...node, id: String(node.id || node._id), fullPath: currentPath });
  ['floors', 'zones', 'areas', 'packages'].forEach((key) => {
    if (Array.isArray(node[key])) node[key].forEach((child) => extractPackages(child, out, currentPath));
  });
}

function memberName(m) {
  const u = m.userId || m;
  return `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unnamed';
}

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function toISODateInput(d) {
  if (!d) return '';
  return new Date(d).toISOString().split('T')[0];
}

export default function InteriorTasksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState([]);
  const [wbsPackages, setWbsPackages] = useState([]);
  const [members, setMembers] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState('board'); // 'board' | 'wbs'
  const [activeColumn, setActiveColumn] = useState('todo');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterPackage, setFilterPackage] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [expandedWbsGroups, setExpandedWbsGroups] = useState({});

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [newInitialSubtask, setNewInitialSubtask] = useState('');
  const [showInlinePkgForm, setShowInlinePkgForm] = useState(false);
  const [inlinePkg, setInlinePkg] = useState({ name: '', trade: 'interior' });
  const [creatingPkg, setCreatingPkg] = useState(false);

  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [newEditSubtask, setNewEditSubtask] = useState('');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const [isProofOpen, setIsProofOpen] = useState(false);
  const [proofTask, setProofTask] = useState(null);
  const [proofImages, setProofImages] = useState([]);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, wbsRes, memberRes, mileRes] = await Promise.allSettled([
        interiorApiClient.get(`/projects/${projectId}/tasks`),
        interiorApiClient.get(`/projects/${projectId}/wbs`),
        interiorApiClient.get(`/projects/${projectId}/members`),
        interiorApiClient.get(`/projects/${projectId}/milestones`),
      ]);

      if (taskRes.status === 'fulfilled' && taskRes.value?.success && taskRes.value.data) {
        setTasks(taskRes.value.data.map((t) => ({ ...t, status: normalizeTaskStatus(t.status) })));
      } else {
        setTasks([]);
      }

      const packages = [];
      if (wbsRes.status === 'fulfilled' && wbsRes.value?.success && wbsRes.value.data) {
        wbsRes.value.data.forEach((node) => extractPackages(node, packages));
      }
      setWbsPackages(packages);

      setMembers(memberRes.status === 'fulfilled' && memberRes.value?.success ? memberRes.value.data || [] : []);
      setMilestones(mileRes.status === 'fulfilled' && mileRes.value?.success ? mileRes.value.data || [] : []);
    } catch (e) {
      console.warn('Error fetching tasks data', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // -----------------------------------------------------------------------
  // Filtering, search, KPIs
  // -----------------------------------------------------------------------
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.name?.toLowerCase().includes(q);
        const matchesPkg = t.packageId?.name?.toLowerCase().includes(q) || t.packageId?.trade?.toLowerCase().includes(q);
        const matchesAssignee = t.assignees?.some((a) => `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase().includes(q));
        if (!matchesName && !matchesPkg && !matchesAssignee) return false;
      }
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterPackage !== 'all') {
        const pkgId = String(t.packageId?._id || t.packageId || '');
        if (pkgId !== filterPackage) return false;
      }
      if (filterAssignee !== 'all') {
        const has = t.assignees?.some((a) => String(a._id || a) === filterAssignee);
        if (!has) return false;
      }
      return true;
    });
  }, [tasks, searchQuery, filterPriority, filterPackage, filterAssignee]);

  const metrics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const todo = tasks.filter((t) => t.status === 'todo').length;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const overdue = tasks.filter((t) => t.status !== 'completed' && t.endDate && new Date(t.endDate) < now).length;
    const blocked = tasks.filter((t) => {
      if (t.status === 'completed' || !t.dependencies?.length) return false;
      return t.dependencies.some((d) => typeof d === 'object' && d.status !== 'completed');
    }).length;
    return { total, completed, inProgress, todo, overdue, blocked };
  }, [tasks]);

  const tasksByPackage = useMemo(() => {
    const groups = new Map();
    wbsPackages.forEach((pkg) => groups.set(String(pkg.id), { package: pkg, tasks: [] }));
    const unassigned = [];
    filteredTasks.forEach((t) => {
      const pkgId = String(t.packageId?._id || t.packageId || '');
      if (pkgId && groups.has(pkgId)) groups.get(pkgId).tasks.push(t);
      else unassigned.push(t);
    });
    const result = Array.from(groups.values()).filter((g) => g.tasks.length > 0);
    if (unassigned.length > 0) result.push({ package: { id: 'unassigned', name: 'Unassigned', trade: 'general' }, tasks: unassigned });
    return result;
  }, [filteredTasks, wbsPackages]);

  const colTasks = filteredTasks.filter((t) => t.status === activeColumn);

  // -----------------------------------------------------------------------
  // WBS package quick-create (building -> floor -> zone -> area -> package)
  // -----------------------------------------------------------------------
  const handleQuickCreateDefaultWbs = async () => {
    setCreatingPkg(true);
    try {
      const bRes = await interiorApiClient.post(`/projects/${projectId}/wbs`, { type: 'building', name: 'Main Site' });
      const fRes = await interiorApiClient.post(`/projects/${projectId}/wbs`, { type: 'floor', name: 'Ground Floor', parentId: bRes?.data?._id });
      const zRes = await interiorApiClient.post(`/projects/${projectId}/wbs`, { type: 'zone', name: 'Zone A', parentId: fRes?.data?._id });
      const aRes = await interiorApiClient.post(`/projects/${projectId}/wbs`, { type: 'area', name: 'Primary Space', parentId: zRes?.data?._id });
      const pRes = await interiorApiClient.post(`/projects/${projectId}/wbs`, { type: 'package', name: 'Interior & Fitout', trade: 'interior', parentId: aRes?.data?._id });
      if (pRes?.success && pRes?.data?._id) {
        showToast('Default WBS structure & package created!', 'success');
        setForm((f) => ({ ...f, packageId: String(pRes.data._id) }));
        await fetchData();
      }
    } catch (e) {
      showToast(e.message || 'Failed to create starter package', 'error');
    } finally {
      setCreatingPkg(false);
    }
  };

  const handleCreateInlinePackage = async () => {
    if (!inlinePkg.name.trim()) return;
    setCreatingPkg(true);
    try {
      const bRes = await interiorApiClient.post(`/projects/${projectId}/wbs`, { type: 'building', name: 'Main Site' });
      const fRes = await interiorApiClient.post(`/projects/${projectId}/wbs`, { type: 'floor', name: 'Level 1', parentId: bRes?.data?._id });
      const zRes = await interiorApiClient.post(`/projects/${projectId}/wbs`, { type: 'zone', name: 'General Zone', parentId: fRes?.data?._id });
      const aRes = await interiorApiClient.post(`/projects/${projectId}/wbs`, { type: 'area', name: 'Main Area', parentId: zRes?.data?._id });
      const pRes = await interiorApiClient.post(`/projects/${projectId}/wbs`, { type: 'package', name: inlinePkg.name.trim(), trade: inlinePkg.trade, parentId: aRes?.data?._id });
      if (pRes?.success && pRes?.data?._id) {
        showToast(`Package "${inlinePkg.name}" created!`, 'success');
        setForm((f) => ({ ...f, packageId: String(pRes.data._id) }));
        setShowInlinePkgForm(false);
        setInlinePkg({ name: '', trade: 'interior' });
        await fetchData();
      }
    } catch (e) {
      showToast(e.message || 'Failed to create package', 'error');
    } finally {
      setCreatingPkg(false);
    }
  };

  // -----------------------------------------------------------------------
  // Create task
  // -----------------------------------------------------------------------
  const handleCreateTask = async () => {
    if (!form.name.trim() || !form.packageId) {
      showToast('Task name and WBS package are required', 'error');
      return;
    }
    setCreating(true);
    try {
      const res = await interiorApiClient.post(`/projects/${projectId}/tasks`, {
        name: form.name,
        packageId: form.packageId,
        priority: form.priority,
        status: 'todo',
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        assignees: form.assigneeId ? [form.assigneeId] : [],
        dependencies: form.dependencies,
        subtasks: form.initialSubtasks.map((title) => ({ title, completed: false })),
        description: form.description,
      });

      if (form.milestoneId && res?.success && res?.data?._id) {
        const milestone = milestones.find((m) => m._id === form.milestoneId);
        if (milestone) {
          const currentLinks = (milestone.linkedTasks || []).map((t) => (typeof t === 'string' ? t : t._id));
          await interiorApiClient.put(`/projects/${projectId}/milestones/${milestone._id}`, {
            linkedTasks: [...currentLinks, res.data._id],
          });
        }
      }

      showToast('Task created successfully in "To Do"', 'success');
      setIsCreateOpen(false);
      setForm(emptyForm);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to create task', 'error');
    } finally {
      setCreating(false);
    }
  };

  // -----------------------------------------------------------------------
  // Task selection / comments
  // -----------------------------------------------------------------------
  const openTask = async (task) => {
    setSelectedTask(task);
    setIsEditingTask(false);
    setComments([]);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/tasks/${task._id}/comments`);
      setComments(res?.success && res?.data ? res.data : []);
    } catch (e) {
      setComments([]);
    }
  };

  const openEditTask = (task) => {
    setSelectedTask(task);
    setEditForm({
      packageId: task.packageId?._id || (typeof task.packageId === 'string' ? task.packageId : '') || '',
      name: task.name || '',
      description: task.description || '',
      priority: task.priority || 'medium',
      status: task.status,
      assigneeId: task.assignees?.[0]?._id || (typeof task.assignees?.[0] === 'string' ? task.assignees[0] : '') || '',
      startDate: toISODateInput(task.startDate),
      endDate: toISODateInput(task.endDate),
      progress: task.progress || 0,
      dependencies: (task.dependencies || []).map((d) => (typeof d === 'string' ? d : d._id)),
      subtasks: task.subtasks || [],
    });
    setIsEditingTask(true);
  };

  const postComment = async () => {
    if (!newComment.trim() || !selectedTask) return;
    setPostingComment(true);
    try {
      const res = await interiorApiClient.post(`/projects/${projectId}/tasks/${selectedTask._id}/comments`, { content: newComment });
      if (res?.success && res?.data) {
        setComments((prev) => [...prev, res.data]);
        setNewComment('');
      }
    } catch (e) {
      showToast('Failed to post comment', 'error');
    } finally {
      setPostingComment(false);
    }
  };

  // -----------------------------------------------------------------------
  // Status / completion (Proof of Work)
  // -----------------------------------------------------------------------
  const initiateCompleteTask = (task) => {
    setProofTask(task);
    setProofImages(task.completionProof?.images || []);
    setIsProofOpen(true);
  };

  const updateStatus = async (task, status) => {
    if (status === 'completed') {
      initiateCompleteTask(task);
      return;
    }
    setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, status } : t)));
    setSelectedTask((prev) => (prev && prev._id === task._id ? { ...prev, status } : prev));
    try {
      await interiorApiClient.put(`/projects/${projectId}/tasks/${task._id}`, { status });
    } catch (e) {
      showToast('Failed to update status', 'error');
      fetchData();
    }
  };

  const pickProofImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast('Photo library permission is required', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets?.length) {
      const newImgs = result.assets.map((a) => ({
        url: a.base64 ? `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}` : a.uri,
        name: a.fileName || 'photo.jpg',
        size: a.fileSize,
      }));
      setProofImages((prev) => [...prev, ...newImgs]);
    }
  };

  const removeProofImage = (idx) => setProofImages((prev) => prev.filter((_, i) => i !== idx));

  const submitProof = async () => {
    if (!proofTask) return;
    setSubmittingProof(true);
    try {
      const subtasksChecked = (proofTask.subtasks || []).map((s) => ({ ...s, completed: true }));
      const payload = {
        status: 'completed',
        progress: 100,
        subtasks: subtasksChecked,
        completionProof: { images: proofImages, completedAt: new Date().toISOString() },
      };
      const res = await interiorApiClient.put(`/projects/${projectId}/tasks/${proofTask._id}`, payload);
      const updated = res?.success && res?.data ? { ...res.data, status: 'completed', progress: 100 } : { ...proofTask, ...payload };
      setTasks((prev) => prev.map((t) => (t._id === proofTask._id ? updated : t)));
      if (selectedTask?._id === proofTask._id) setSelectedTask(updated);
      showToast('Task marked as Completed with Proof of Work verified!', 'success');
      setIsProofOpen(false);
      setProofTask(null);
      setProofImages([]);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to complete task', 'error');
    } finally {
      setSubmittingProof(false);
    }
  };

  // -----------------------------------------------------------------------
  // Subtasks (view mode, auto-progress)
  // -----------------------------------------------------------------------
  const toggleSubtask = async (idx) => {
    if (!selectedTask) return;
    const list = [...(selectedTask.subtasks || [])];
    if (!list[idx]) return;
    list[idx] = { ...list[idx], completed: !list[idx].completed };
    const completedCount = list.filter((s) => s.completed).length;
    const calcProgress = Math.round((completedCount / list.length) * 100);

    if (calcProgress === 100 && selectedTask.status !== 'completed') {
      initiateCompleteTask({ ...selectedTask, subtasks: list });
      return;
    }

    let newStatus = selectedTask.status;
    if (calcProgress > 0 && calcProgress < 100) newStatus = 'in_progress';
    else if (calcProgress === 0 && selectedTask.status === 'in_progress') newStatus = 'todo';

    try {
      const res = await interiorApiClient.put(`/projects/${projectId}/tasks/${selectedTask._id}`, { subtasks: list, progress: calcProgress, status: newStatus });
      const updated = res?.success && res?.data ? res.data : { ...selectedTask, subtasks: list, progress: calcProgress, status: newStatus };
      setSelectedTask(updated);
      setTasks((prev) => prev.map((t) => (t._id === selectedTask._id ? updated : t)));
    } catch (e) {
      showToast(e.message || 'Failed to update subtask', 'error');
    }
  };

  const deleteTask = (task) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${task.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await interiorApiClient.delete(`/projects/${projectId}/tasks/${task._id}`);
            showToast('Task deleted successfully', 'delete');
            setSelectedTask(null);
            setIsEditingTask(false);
            fetchData();
          } catch (e) {
            showToast(e.message || 'Failed to delete task', 'error');
          }
        },
      },
    ]);
  };

  // -----------------------------------------------------------------------
  // Edit task (save)
  // -----------------------------------------------------------------------
  const addEditSubtask = () => {
    if (!newEditSubtask.trim()) return;
    setEditForm((f) => ({ ...f, subtasks: [...(f.subtasks || []), { title: newEditSubtask.trim(), completed: false }] }));
    setNewEditSubtask('');
  };
  const removeEditSubtask = (idx) => setEditForm((f) => ({ ...f, subtasks: f.subtasks.filter((_, i) => i !== idx) }));

  const saveEditedTask = async () => {
    if (!selectedTask) return;
    try {
      const subtasks = editForm.subtasks || [];
      let calcProgress = Number(editForm.progress) || 0;
      let newStatus = editForm.status;
      if (subtasks.length > 0) {
        const completedCount = subtasks.filter((s) => s.completed).length;
        calcProgress = Math.round((completedCount / subtasks.length) * 100);
        if (calcProgress > 0 && calcProgress < 100) newStatus = 'in_progress';
        else if (calcProgress === 0 && newStatus === 'in_progress') newStatus = 'todo';
      }
      const payload = {
        name: editForm.name,
        description: editForm.description,
        priority: editForm.priority,
        status: newStatus,
        packageId: editForm.packageId || undefined,
        assignees: editForm.assigneeId ? [editForm.assigneeId] : [],
        startDate: editForm.startDate || undefined,
        endDate: editForm.endDate || undefined,
        progress: calcProgress,
        dependencies: editForm.dependencies || [],
        subtasks,
      };
      const res = await interiorApiClient.put(`/projects/${projectId}/tasks/${selectedTask._id}`, payload);
      showToast('Task updated successfully!', 'success');
      const updated = res?.success && res?.data ? res.data : { ...selectedTask, ...payload };
      setSelectedTask(updated);
      setIsEditingTask(false);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to update task', 'error');
    }
  };

  const toggleWbsGroup = (id) => setExpandedWbsGroups((p) => ({ ...p, [id]: p[id] === undefined ? false : !p[id] }));

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Tasks Management</Text>
            <Text style={s.headerSub}>{tasks.length} total · site execution & proof-of-work</Text>
          </View>
        </View>

        {/* KPI strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kpiRow}>
          <View style={s.kpiTile}><Text style={s.kpiNum}>{metrics.total}</Text><Text style={s.kpiLbl}>Total</Text></View>
          <View style={s.kpiTile}><Text style={[s.kpiNum, { color: '#2563EB' }]}>{metrics.todo}</Text><Text style={s.kpiLbl}>To Do</Text></View>
          <View style={s.kpiTile}><Text style={[s.kpiNum, { color: '#D97706' }]}>{metrics.inProgress}</Text><Text style={s.kpiLbl}>In Progress</Text></View>
          <View style={s.kpiTile}><Text style={[s.kpiNum, { color: '#16A34A' }]}>{metrics.completed}</Text><Text style={s.kpiLbl}>Completed</Text></View>
          <View style={s.kpiTile}><Text style={[s.kpiNum, { color: '#DC2626' }]}>{metrics.overdue + metrics.blocked}</Text><Text style={s.kpiLbl}>Overdue</Text></View>
        </ScrollView>

        {/* View switcher + search + filter toggle */}
        <View style={s.controlBar}>
          <View style={s.viewSwitch}>
            <TouchableOpacity style={[s.viewSwitchBtn, viewMode === 'board' && s.viewSwitchBtnActive]} onPress={() => setViewMode('board')}>
              <Text style={[s.viewSwitchText, viewMode === 'board' && s.viewSwitchTextActive]}>Board</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.viewSwitchBtn, viewMode === 'wbs' && s.viewSwitchBtnActive]} onPress={() => setViewMode('wbs')}>
              <Text style={[s.viewSwitchText, viewMode === 'wbs' && s.viewSwitchTextActive]}>By WBS</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.filterToggleBtn} onPress={() => setShowFilters((v) => !v)}>
            <Ionicons name="options-outline" size={15} color={showFilters ? '#2563EB' : '#64748B'} />
          </TouchableOpacity>
        </View>

        <View style={s.searchRow}>
          <Ionicons name="search" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput style={s.searchInput} placeholder="Search tasks, assignees..." placeholderTextColor="#94A3B8" value={searchQuery} onChangeText={setSearchQuery} />
        </View>

        {showFilters && (
          <View style={s.filterPanel}>
            <Text style={s.filterLabel}>Priority</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
              <TouchableOpacity style={[s.chipSm, filterPriority === 'all' && s.chipSmActive]} onPress={() => setFilterPriority('all')}>
                <Text style={[s.chipSmText, filterPriority === 'all' && s.chipSmTextActive]}>All</Text>
              </TouchableOpacity>
              {PRIORITIES.map((p) => (
                <TouchableOpacity key={p} style={[s.chipSm, filterPriority === p && s.chipSmActive]} onPress={() => setFilterPriority(p)}>
                  <Text style={[s.chipSmText, filterPriority === p && s.chipSmTextActive]}>{PRIORITY_META[p].label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.filterLabel}>Assignee</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 4 }}>
              <TouchableOpacity style={[s.chipSm, filterAssignee === 'all' && s.chipSmActive]} onPress={() => setFilterAssignee('all')}>
                <Text style={[s.chipSmText, filterAssignee === 'all' && s.chipSmTextActive]}>All</Text>
              </TouchableOpacity>
              {members.map((m) => {
                const uid = m.userId?._id || m._id;
                return (
                  <TouchableOpacity key={uid} style={[s.chipSm, filterAssignee === uid && s.chipSmActive]} onPress={() => setFilterAssignee(uid)}>
                    <Text style={[s.chipSmText, filterAssignee === uid && s.chipSmTextActive]}>{memberName(m)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {viewMode === 'board' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.columnTabs}>
            {COLUMNS.map((col) => {
              const count = filteredTasks.filter((t) => t.status === col.id).length;
              const active = activeColumn === col.id;
              return (
                <TouchableOpacity key={col.id} style={[s.colTab, active && { borderColor: col.color, backgroundColor: col.color + '14' }]} onPress={() => setActiveColumn(col.id)}>
                  <View style={[s.colDot, { backgroundColor: col.color }]} />
                  <Text style={[s.colTabText, active && { color: col.color }]}>{col.title}</Text>
                  <View style={s.colCountBadge}><Text style={s.colCountText}>{count}</Text></View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {loading ? (
          <View style={s.center}><ActivityIndicator size="large" color="#2563EB" /></View>
        ) : viewMode === 'board' ? (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {colTasks.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="checkbox-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No tasks in this column</Text>
              </View>
            ) : (
              colTasks.map((task) => <TaskCard key={task._id} task={task} onPress={() => openTask(task)} onEdit={() => openEditTask(task)} onDelete={() => deleteTask(task)} />)
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {tasksByPackage.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="layers-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No tasks found</Text>
              </View>
            ) : (
              tasksByPackage.map((group) => {
                const isExpanded = expandedWbsGroups[group.package.id] !== false;
                const completedInGroup = group.tasks.filter((t) => t.status === 'completed').length;
                const pkgProgress = group.tasks.length > 0 ? Math.round((completedInGroup / group.tasks.length) * 100) : 0;
                return (
                  <View key={group.package.id} style={s.wbsGroupCard}>
                    <TouchableOpacity style={s.wbsGroupHeader} onPress={() => toggleWbsGroup(group.package.id)}>
                      <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={15} color="#64748B" />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={s.wbsGroupName}>{group.package.name} <Text style={s.wbsGroupTrade}>({group.package.trade})</Text></Text>
                        <View style={s.wbsProgressTrack}><View style={[s.wbsProgressFill, { width: `${pkgProgress}%` }]} /></View>
                      </View>
                      <Text style={s.wbsGroupCount}>{completedInGroup}/{group.tasks.length}</Text>
                    </TouchableOpacity>
                    {isExpanded && (
                      <View style={{ padding: 10, gap: 8 }}>
                        {group.tasks.map((task) => <TaskCard key={task._id} task={task} compact onPress={() => openTask(task)} onEdit={() => openEditTask(task)} onDelete={() => deleteTask(task)} />)}
                      </View>
                    )}
                  </View>
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        <TouchableOpacity style={s.fab} onPress={() => setIsCreateOpen(true)}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* ==================== CREATE TASK MODAL ==================== */}
      <Modal visible={isCreateOpen} animationType="slide" transparent onRequestClose={() => setIsCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Task to WBS Package</Text>
              <TouchableOpacity onPress={() => setIsCreateOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={s.label}>WBS Target Package *</Text>
                <TouchableOpacity onPress={() => setShowInlinePkgForm((v) => !v)}>
                  <Text style={s.linkBtnText}>{showInlinePkgForm ? 'Cancel' : '+ New Package'}</Text>
                </TouchableOpacity>
              </View>

              {showInlinePkgForm ? (
                <View style={s.inlinePkgBox}>
                  <TextInput style={s.input} placeholder="Package Name (e.g. Electrical)" placeholderTextColor="#94A3B8" value={inlinePkg.name} onChangeText={(v) => setInlinePkg({ ...inlinePkg, name: v })} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8, marginBottom: 8 }}>
                    {TRADES.map((t) => (
                      <TouchableOpacity key={t} style={[s.chipSm, inlinePkg.trade === t && s.chipSmActive]} onPress={() => setInlinePkg({ ...inlinePkg, trade: t })}>
                        <Text style={[s.chipSmText, inlinePkg.trade === t && s.chipSmTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity style={[s.saveBtnSm, creatingPkg && { opacity: 0.7 }]} onPress={handleCreateInlinePackage} disabled={creatingPkg}>
                    {creatingPkg ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnSmText}>Save & Select Package</Text>}
                  </TouchableOpacity>
                </View>
              ) : wbsPackages.length === 0 ? (
                <View style={s.noPkgBox}>
                  <Text style={s.noPkgText}>Tasks must belong to a WBS Trade Package. Tap below to initialize a starter package.</Text>
                  <TouchableOpacity style={[s.saveBtnSm, creatingPkg && { opacity: 0.7 }]} onPress={handleQuickCreateDefaultWbs} disabled={creatingPkg}>
                    {creatingPkg ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnSmText}>Initialize Starter Package</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                  {wbsPackages.map((pkg) => (
                    <TouchableOpacity key={pkg.id} style={[s.chip, form.packageId === pkg.id && s.chipActive]} onPress={() => setForm({ ...form, packageId: pkg.id })}>
                      <Text style={[s.chipText, form.packageId === pkg.id && s.chipTextActive]}>{pkg.name} ({pkg.trade})</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={s.label}>Task Name *</Text>
              <TextInput style={s.input} placeholder="e.g. Core Conduit Fixing" placeholderTextColor="#94A3B8" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />

              {milestones.length > 0 && (
                <>
                  <Text style={s.label}>Link to Milestone (Optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                    <TouchableOpacity style={[s.chip, !form.milestoneId && s.chipActive]} onPress={() => setForm({ ...form, milestoneId: '' })}>
                      <Text style={[s.chipText, !form.milestoneId && s.chipTextActive]}>None</Text>
                    </TouchableOpacity>
                    {milestones.map((m) => (
                      <TouchableOpacity key={m._id} style={[s.chip, form.milestoneId === m._id && s.chipActive]} onPress={() => setForm({ ...form, milestoneId: m._id })}>
                        <Text style={[s.chipText, form.milestoneId === m._id && s.chipTextActive]}>{m.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={s.label}>Priority</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity key={p} style={[s.chip, form.priority === p && s.chipActive]} onPress={() => setForm({ ...form, priority: p })}>
                    <Text style={[s.chipText, form.priority === p && s.chipTextActive]}>{PRIORITY_META[p].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Assignee</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                <TouchableOpacity style={[s.chip, !form.assigneeId && s.chipActive]} onPress={() => setForm({ ...form, assigneeId: '' })}>
                  <Text style={[s.chipText, !form.assigneeId && s.chipTextActive]}>Unassigned</Text>
                </TouchableOpacity>
                {members.map((m) => {
                  const uid = m.userId?._id || m._id;
                  return (
                    <TouchableOpacity key={uid} style={[s.chip, form.assigneeId === uid && s.chipActive]} onPress={() => setForm({ ...form, assigneeId: uid })}>
                      <Text style={[s.chipText, form.assigneeId === uid && s.chipTextActive]}>{memberName(m)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Start Date</Text>
                  <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={form.startDate} onChangeText={(v) => setForm({ ...form, startDate: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>End Date</Text>
                  <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={form.endDate} onChangeText={(v) => setForm({ ...form, endDate: v })} />
                </View>
              </View>

              {tasks.length > 0 && (
                <>
                  <Text style={s.label}>Depends On (Optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                    {tasks.map((t) => {
                      const active = form.dependencies.includes(t._id);
                      return (
                        <TouchableOpacity key={t._id} style={[s.chip, active && s.chipActive]} onPress={() => {
                          setForm((f) => ({ ...f, dependencies: active ? f.dependencies.filter((id) => id !== t._id) : [...f.dependencies, t._id] }));
                        }}>
                          <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>{t.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
                <Text style={s.label}>Execution Subtasks Checklist</Text>
                <Text style={s.hintTextSm}>{form.initialSubtasks.length} added</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[s.input, { flex: 1 }]} placeholder="Add subtask..." placeholderTextColor="#94A3B8" value={newInitialSubtask} onChangeText={setNewInitialSubtask} onSubmitEditing={() => {
                  if (newInitialSubtask.trim()) { setForm((f) => ({ ...f, initialSubtasks: [...f.initialSubtasks, newInitialSubtask.trim()] })); setNewInitialSubtask(''); }
                }} />
                <TouchableOpacity style={s.addBtn} onPress={() => {
                  if (newInitialSubtask.trim()) { setForm((f) => ({ ...f, initialSubtasks: [...f.initialSubtasks, newInitialSubtask.trim()] })); setNewInitialSubtask(''); }
                }}>
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              {form.initialSubtasks.map((st, idx) => (
                <View key={idx} style={s.subtaskDraftRow}>
                  <Text style={s.subtaskDraftText} numberOfLines={1}>{st}</Text>
                  <TouchableOpacity onPress={() => setForm((f) => ({ ...f, initialSubtasks: f.initialSubtasks.filter((_, i) => i !== idx) }))}>
                    <Ionicons name="close" size={14} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              ))}

              <Text style={s.label}>Description</Text>
              <TextInput style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Specify task instructions..." placeholderTextColor="#94A3B8" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline />

              <TouchableOpacity style={[s.saveBtn, creating && { opacity: 0.7 }]} onPress={handleCreateTask} disabled={creating}>
                {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Create Task</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================== TASK DETAIL / EDIT MODAL ==================== */}
      <Modal visible={!!selectedTask} animationType="slide" transparent onRequestClose={() => { setSelectedTask(null); setIsEditingTask(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '92%' }]}>
            {selectedTask && !isEditingTask && (
              <>
                <View style={s.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalTitle} numberOfLines={1}>{selectedTask.name}</Text>
                    {!!selectedTask.packageId && <Text style={s.headerSub}>{selectedTask.packageId.name} ({selectedTask.packageId.trade})</Text>}
                  </View>
                  <TouchableOpacity onPress={() => openEditTask(selectedTask)} style={{ marginRight: 14 }}>
                    <Ionicons name="pencil-outline" size={18} color="#2563EB" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSelectedTask(null)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={s.label}>Task Status</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    {COLUMNS.map((col) => (
                      <TouchableOpacity key={col.id} style={[s.statusOption, selectedTask.status === col.id && s.statusOptionActive]} onPress={() => updateStatus(selectedTask, col.id)}>
                        <Text style={[s.statusOptionText, selectedTask.status === col.id && s.statusOptionTextActive]}>{col.title}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {selectedTask.status === 'completed' && (
                    <View style={s.proofVerifiedBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                          <Text style={s.proofVerifiedTitle}>Proof of Work Verified</Text>
                        </View>
                        <TouchableOpacity style={s.updateProofBtn} onPress={() => initiateCompleteTask(selectedTask)}>
                          <Ionicons name="camera-outline" size={12} color="#16A34A" />
                          <Text style={s.updateProofBtnText}>Update Proof</Text>
                        </TouchableOpacity>
                      </View>
                      {selectedTask.completionProof?.completedAt && (
                        <Text style={s.proofDate}>Completed on {new Date(selectedTask.completionProof.completedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                      )}
                      {selectedTask.completionProof?.images?.length > 0 ? (
                        <View style={s.proofImgGrid}>
                          {selectedTask.completionProof.images.map((img, idx) => (
                            <TouchableOpacity key={idx} style={s.proofImgThumb} onPress={() => setLightboxUrl(img.url)}>
                              <Image source={{ uri: img.url }} style={{ width: '100%', height: '100%' }} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : (
                        <Text style={s.proofNoPhotos}>No site photos attached to this proof.</Text>
                      )}
                    </View>
                  )}

                  <View style={s.detailCard}>
                    <View style={s.detailRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.detailLabel}>Priority</Text>
                        <Text style={s.detailValue}>{PRIORITY_META[selectedTask.priority]?.label || selectedTask.priority}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.detailLabel}>Progress</Text>
                        <Text style={s.detailValue}>{selectedTask.progress || 0}%</Text>
                      </View>
                    </View>
                    <View style={s.detailDivider} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="calendar-outline" size={14} color="#2563EB" />
                      <Text style={s.detailDates}>{formatDate(selectedTask.startDate) || 'Start unset'} — {formatDate(selectedTask.endDate) || 'End unset'}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
                    <Text style={[s.label, { marginTop: 0 }]}>
                      Subtasks ({(selectedTask.subtasks || []).filter((sub) => sub.completed).length}/{(selectedTask.subtasks || []).length})
                    </Text>
                  </View>
                  {(selectedTask.subtasks || []).length === 0 ? (
                    <Text style={s.noComments}>No subtasks defined for this task.</Text>
                  ) : (
                    selectedTask.subtasks.map((sub, idx) => (
                      <TouchableOpacity key={idx} style={[s.subtaskRow, sub.completed && s.subtaskRowDone]} onPress={() => toggleSubtask(idx)}>
                        <Ionicons name={sub.completed ? 'checkbox' : 'square-outline'} size={17} color={sub.completed ? '#16A34A' : '#CBD5E1'} />
                        <Text style={[s.subtaskRowText, sub.completed && s.subtaskRowTextDone]} numberOfLines={2}>{sub.title}</Text>
                      </TouchableOpacity>
                    ))
                  )}

                  <Text style={[s.label, { marginTop: 16 }]}>Description</Text>
                  <Text style={s.descriptionText}>{selectedTask.description || 'No description provided.'}</Text>

                  <Text style={[s.label, { marginTop: 18 }]}>Task Discussions ({comments.length})</Text>
                  {comments.length === 0 ? (
                    <Text style={s.noComments}>No messages on this task yet. Type below to align your team.</Text>
                  ) : (
                    comments.map((c) => (
                      <View key={c._id} style={s.commentCard}>
                        <View style={s.commentTopRow}>
                          <Text style={s.commentAuthor}>{c.userId?.firstName} {c.userId?.lastName}</Text>
                          <Text style={s.commentTime}>{new Date(c.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
                        <Text style={s.commentBody}>{c.content}</Text>
                      </View>
                    ))
                  )}

                  <View style={s.commentInputRow}>
                    <TextInput style={s.commentInput} placeholder="Post execution update or ask question..." placeholderTextColor="#94A3B8" value={newComment} onChangeText={setNewComment} />
                    <TouchableOpacity style={s.postBtn} onPress={postComment} disabled={postingComment}>
                      {postingComment ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={16} color="#FFFFFF" />}
                    </TouchableOpacity>
                  </View>
                  <View style={{ height: 20 }} />
                </ScrollView>
              </>
            )}

            {selectedTask && isEditingTask && (
              <>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Edit Task</Text>
                  <TouchableOpacity onPress={() => setIsEditingTask(false)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={s.label}>Task Name *</Text>
                  <TextInput style={s.input} value={editForm.name} onChangeText={(v) => setEditForm({ ...editForm, name: v })} />

                  <Text style={s.label}>WBS Package</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                    {wbsPackages.map((pkg) => (
                      <TouchableOpacity key={pkg.id} style={[s.chip, editForm.packageId === pkg.id && s.chipActive]} onPress={() => setEditForm({ ...editForm, packageId: pkg.id })}>
                        <Text style={[s.chipText, editForm.packageId === pkg.id && s.chipTextActive]}>{pkg.name} ({pkg.trade})</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={s.label}>Description</Text>
                  <TextInput style={[s.input, { height: 70, textAlignVertical: 'top', paddingTop: 12 }]} multiline value={editForm.description} onChangeText={(v) => setEditForm({ ...editForm, description: v })} />

                  <Text style={s.label}>Priority</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    {PRIORITIES.map((p) => (
                      <TouchableOpacity key={p} style={[s.chip, editForm.priority === p && s.chipActive]} onPress={() => setEditForm({ ...editForm, priority: p })}>
                        <Text style={[s.chipText, editForm.priority === p && s.chipTextActive]}>{PRIORITY_META[p].label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.label}>Assignee</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                    <TouchableOpacity style={[s.chip, !editForm.assigneeId && s.chipActive]} onPress={() => setEditForm({ ...editForm, assigneeId: '' })}>
                      <Text style={[s.chipText, !editForm.assigneeId && s.chipTextActive]}>Unassigned</Text>
                    </TouchableOpacity>
                    {members.map((m) => {
                      const uid = m.userId?._id || m._id;
                      return (
                        <TouchableOpacity key={uid} style={[s.chip, editForm.assigneeId === uid && s.chipActive]} onPress={() => setEditForm({ ...editForm, assigneeId: uid })}>
                          <Text style={[s.chipText, editForm.assigneeId === uid && s.chipTextActive]}>{memberName(m)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Start Date</Text>
                      <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={editForm.startDate} onChangeText={(v) => setEditForm({ ...editForm, startDate: v })} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>End Date</Text>
                      <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={editForm.endDate} onChangeText={(v) => setEditForm({ ...editForm, endDate: v })} />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
                    <Text style={s.label}>Subtasks Checklist ({editForm.subtasks?.length || 0})</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[s.input, { flex: 1 }]} placeholder="Add a new subtask..." placeholderTextColor="#94A3B8" value={newEditSubtask} onChangeText={setNewEditSubtask} onSubmitEditing={addEditSubtask} />
                    <TouchableOpacity style={s.addBtn} onPress={addEditSubtask}>
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  {(editForm.subtasks || []).map((sub, idx) => (
                    <View key={idx} style={s.subtaskDraftRow}>
                      <Text style={[s.subtaskDraftText, sub.completed && { textDecorationLine: 'line-through', color: '#94A3B8' }]} numberOfLines={1}>{sub.title}</Text>
                      <TouchableOpacity onPress={() => removeEditSubtask(idx)}>
                        <Ionicons name="trash-outline" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 8 }}>
                    <TouchableOpacity style={s.deleteTaskBtn} onPress={() => deleteTask(selectedTask)}>
                      <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      <Text style={s.deleteTaskBtnText}>Delete Task</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.saveBtnSm} onPress={saveEditedTask}>
                      <Text style={s.saveBtnSmText}>Save Changes</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ height: 20 }} />
                </ScrollView>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================== PROOF OF WORK MODAL ==================== */}
      <Modal visible={isProofOpen} animationType="slide" transparent onRequestClose={() => setIsProofOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={[s.modalHeader, { backgroundColor: '#F0FDF4' }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Complete Task & Proof of Work</Text>
                <Text style={s.headerSub}>Upload site completion and inspection photos</Text>
              </View>
              <TouchableOpacity onPress={() => { setIsProofOpen(false); setProofTask(null); }}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {proofTask && (
                <View style={s.proofSummaryBox}>
                  <Text style={s.proofSummaryTitle} numberOfLines={1}>{proofTask.name}</Text>
                  <View style={s.willSet100Badge}><Text style={s.willSet100BadgeText}>Will set 100% progress</Text></View>
                </View>
              )}

              <Text style={s.label}>Site Completion Photos ({proofImages.length})</Text>
              <TouchableOpacity style={s.photoDropzone} onPress={pickProofImage}>
                <Ionicons name="cloud-upload-outline" size={26} color="#16A34A" />
                <Text style={s.photoDropzoneText}>Tap to select site photos</Text>
              </TouchableOpacity>

              {proofImages.length > 0 && (
                <View style={s.proofImgGrid}>
                  {proofImages.map((img, idx) => (
                    <View key={idx} style={s.proofImgThumb}>
                      <Image source={{ uri: img.url }} style={{ width: '100%', height: '100%' }} />
                      <TouchableOpacity style={s.removePhotoBtn} onPress={() => removeProofImage(idx)}>
                        <Ionicons name="close" size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {proofTask?.subtasks?.length > 0 && (
                <View style={s.proofSubtaskNotice}>
                  <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                  <Text style={s.proofSubtaskNoticeText}>All {proofTask.subtasks.length} subtasks will be marked as completed.</Text>
                </View>
              )}

              <TouchableOpacity style={[s.confirmCompleteBtn, submittingProof && { opacity: 0.7 }]} onPress={submitProof} disabled={submittingProof}>
                {submittingProof ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Confirm & Complete Task</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================== PHOTO LIGHTBOX ==================== */}
      <Modal visible={!!lightboxUrl} transparent animationType="fade" onRequestClose={() => setLightboxUrl(null)}>
        <View style={s.lightboxOverlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.lightboxHeader}>
              <Text style={s.lightboxTitle}>Proof of Work Photo</Text>
              <TouchableOpacity onPress={() => setLightboxUrl(null)} style={s.lightboxCloseBtn}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={s.lightboxBody}>
              {lightboxUrl && <Image source={{ uri: lightboxUrl }} style={s.lightboxImage} resizeMode="contain" />}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

function TaskCard({ task, onPress, onEdit, onDelete, compact }) {
  const priority = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const assignee = task.assignees?.[0];
  const totalSub = task.subtasks?.length || 0;
  const doneSub = task.subtasks?.filter((sub) => sub.completed).length || 0;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const isOverdue = task.status !== 'completed' && task.endDate && new Date(task.endDate) < now;
  const isBlocked = task.status !== 'completed' && (task.dependencies || []).some((d) => typeof d === 'object' && d.status !== 'completed');
  const hasProof = task.status === 'completed' && task.completionProof?.images?.length > 0;

  return (
    <TouchableOpacity style={s.taskCard} onPress={onPress}>
      <View style={s.taskTopRow}>
        <View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
          <View style={[s.priorityBadge, { backgroundColor: priority.bg }]}>
            <Text style={[s.priorityBadgeText, { color: priority.color }]}>{priority.label}</Text>
          </View>
          {isBlocked && (
            <View style={[s.priorityBadge, { backgroundColor: '#FEF2F2' }]}>
              <Text style={[s.priorityBadgeText, { color: '#DC2626' }]}>Blocked</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={onEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="pencil-outline" size={14} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
      {!!task.packageId?.trade && !compact && <Text style={s.tradeTag}>#{task.packageId.trade}</Text>}
      <Text style={s.taskName} numberOfLines={2}>{task.name}</Text>
      {totalSub > 0 && (
        <View style={s.subtaskProgressRow}>
          <View style={s.subtaskProgressTrack}><View style={[s.subtaskProgressFill, { width: `${(doneSub / totalSub) * 100}%` }]} /></View>
          <Text style={s.subtaskProgressText}>{doneSub}/{totalSub}</Text>
        </View>
      )}
      <View style={s.taskBottomRow}>
        <View style={s.taskMetaItem}>
          <Ionicons name="calendar-outline" size={12} color={isOverdue ? '#DC2626' : '#94A3B8'} />
          <Text style={[s.taskMetaText, isOverdue && { color: '#DC2626', fontFamily: 'Inter-Bold' }]}>{formatDate(task.endDate) || 'Dates unset'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {hasProof && <Ionicons name="camera" size={13} color="#16A34A" />}
          {assignee ? (
            <View style={s.assigneeAvatar}><Text style={s.assigneeAvatarText}>{assignee.firstName?.[0] || '?'}</Text></View>
          ) : (
            <Ionicons name="person-outline" size={14} color="#CBD5E1" />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  kpiRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  kpiTile: { backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#F1F5F9', minWidth: 72, alignItems: 'center' },
  kpiNum: { fontSize: 16, fontFamily: 'Inter-Black', color: '#0F172A' },
  kpiLbl: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', marginTop: 1 },

  controlBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, backgroundColor: '#FFFFFF' },
  viewSwitch: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3 },
  viewSwitchBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  viewSwitchBtnActive: { backgroundColor: '#FFFFFF' },
  viewSwitchText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  viewSwitchTextActive: { color: '#0F172A' },
  filterToggleBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },

  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  searchInput: { flex: 1, fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#0F172A', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },

  filterPanel: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filterLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6 },
  chipSm: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  chipSmActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipSmText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#64748B', textTransform: 'capitalize' },
  chipSmTextActive: { color: '#2563EB' },

  columnTabs: { gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  colTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC' },
  colDot: { width: 7, height: 7, borderRadius: 4 },
  colTabText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B' },
  colCountBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  colCountText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#64748B' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },

  wbsGroupCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
  wbsGroupHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F8FAFC' },
  wbsGroupName: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  wbsGroupTrade: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8', textTransform: 'uppercase' },
  wbsGroupCount: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#0F172A' },
  wbsProgressTrack: { height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', overflow: 'hidden', marginTop: 5, width: 100 },
  wbsProgressFill: { height: '100%', borderRadius: 2, backgroundColor: '#10B981' },

  taskCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 8 },
  taskTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
  tradeTag: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  taskName: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A', lineHeight: 18 },
  subtaskProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subtaskProgressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  subtaskProgressFill: { height: '100%', borderRadius: 2, backgroundColor: '#2563EB' },
  subtaskProgressText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8' },
  taskBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
  taskMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskMetaText: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  assigneeAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  assigneeAvatarText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#2563EB' },

  fab: {
    position: 'absolute', right: 20, bottom: 30,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  hintTextSm: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  linkBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#2563EB' },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  inlinePkgBox: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  noPkgBox: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', gap: 8 },
  noPkgText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#1E3A8A', lineHeight: 17 },

  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B', maxWidth: 160 },
  chipTextActive: { color: '#2563EB' },

  addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  subtaskDraftRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 6 },
  subtaskDraftText: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#334155', flex: 1, marginRight: 8 },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  saveBtnSm: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center' },
  saveBtnSmText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  deleteTaskBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA' },
  deleteTaskBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#DC2626' },

  statusOption: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  statusOptionActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  statusOptionText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  statusOptionTextActive: { color: '#FFFFFF' },

  proofVerifiedBox: { borderWidth: 1, borderColor: '#BBF7D0', backgroundColor: '#F0FDF4', borderRadius: 14, padding: 12, marginBottom: 14, gap: 8 },
  proofVerifiedTitle: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#14532D', textTransform: 'uppercase' },
  proofDate: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#166534' },
  updateProofBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#BBF7D0', backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  updateProofBtnText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#16A34A' },
  proofNoPhotos: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#166534', fontStyle: 'italic' },
  proofImgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  proofImgThumb: { width: 78, height: 78, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', position: 'relative' },
  removePhotoBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: '#DC2626', borderRadius: 999, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },

  detailCard: { borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 14, padding: 14, marginBottom: 6 },
  detailRow: { flexDirection: 'row' },
  detailLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase' },
  detailValue: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2, textTransform: 'capitalize' },
  detailDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  detailDates: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B' },

  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 6 },
  subtaskRowDone: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  subtaskRowText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#0F172A', flex: 1 },
  subtaskRowTextDone: { color: '#94A3B8', textDecorationLine: 'line-through' },

  descriptionText: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', lineHeight: 19 },

  noComments: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', paddingVertical: 14 },
  commentCard: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 10, marginBottom: 8 },
  commentTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentAuthor: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  commentTime: { fontSize: 9.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  commentBody: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B' },

  commentInputRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  commentInput: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#0F172A' },
  postBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },

  proofSummaryBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  proofSummaryTitle: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1, marginRight: 8 },
  willSet100Badge: { backgroundColor: '#D1FAE5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  willSet100BadgeText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#065F46', textTransform: 'uppercase' },

  photoDropzone: { borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 14, paddingVertical: 22, alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', marginTop: 8 },
  photoDropzoneText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  proofSubtaskNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 10, padding: 10, marginTop: 14 },
  proofSubtaskNoticeText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#166534', flex: 1 },
  confirmCompleteBtn: { height: 50, borderRadius: 14, backgroundColor: '#16A34A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },

  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  lightboxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  lightboxTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  lightboxCloseBtn: { padding: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)' },
  lightboxBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
  lightboxImage: { width: '100%', height: '100%' },
});

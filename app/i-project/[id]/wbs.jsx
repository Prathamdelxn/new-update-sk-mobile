import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';
import { useProjectPermissions } from '../../utils/interior/useProjectPermissions';
import CategoryNav from './_components/CategoryNav';
import { memberRoleLabel } from '../../utils/interior/memberRoleLabel';
import SelectField from '../../components/common/SelectField';

// =============================================================================
// Constants & Configuration (Mirrors Web InteriorWbsView)
// =============================================================================

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#475569', bg: '#F1F5F9', border: '#E2E8F0' },
  medium: { label: 'Medium', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  high: { label: 'High', color: '#B45309', bg: '#FEF3C7', border: '#FDE68A' },
  critical: { label: 'Critical', color: '#BE123C', bg: '#FFE4E6', border: '#FECDD3' },
};

const PRIORITY_OPTIONS = Object.entries(PRIORITY_CONFIG).map(([value, c]) => ({ value, label: c.label }));

const STATUS_CONFIG = {
  todo: { label: 'To Do', color: '#475569', bg: '#F1F5F9', border: '#E2E8F0' },
  in_progress: { label: 'In Progress', color: '#B45309', bg: '#FEF3C7', border: '#FDE68A' },
  in_review: { label: 'In Review', color: '#6D28D9', bg: '#F5F3FF', border: '#DDD6FE' },
  completed: { label: 'Done', color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' },
  blocked: { label: 'Blocked', color: '#BE123C', bg: '#FFE4E6', border: '#FECDD3' },
};

// =============================================================================
// Date Helpers & Date Picker Field
// =============================================================================

const formatDateRange = (s, e) => {
  const formatSingle = (d) => {
    if (!d) return null;
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const sStr = s ? formatSingle(s) : null;
  const eStr = e ? formatSingle(e) : null;
  if (sStr && eStr) return `${sStr} — ${eStr}`;
  if (sStr) return `Starts: ${sStr}`;
  if (eStr) return `Due: ${eStr}`;
  return null;
};

const shortRange = (s, e) => {
  const d = (v) => { if (!v) return null; const x = new Date(v); return isNaN(x.getTime()) ? null : x; };
  const a = d(s); const b = d(e);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = (x, withYear) => `${x.getDate()} ${M[x.getMonth()]}${withYear ? ` ${x.getFullYear()}` : ''}`;
  if (a && b) return `${fmt(a, a.getFullYear() !== b.getFullYear())} – ${fmt(b, true)}`;
  if (a) return `From ${fmt(a, true)}`;
  if (b) return `Due ${fmt(b, true)}`;
  return null;
};

function DatePickerField({ value, onChange, placeholder = 'Select date', minDate, maxDate, disabled }) {
  const [showIosPicker, setShowIosPicker] = useState(false);

  const openPicker = () => {
    if (disabled) return;
    const base = value ? new Date(value) : new Date();
    const validBase = isNaN(base.getTime()) ? new Date() : base;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: validBase,
        mode: 'date',
        minDate: minDate ? new Date(minDate) : undefined,
        maxDate: maxDate ? new Date(maxDate) : undefined,
        onChange: (event, d) => {
          if (event.type === 'set' && d) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            onChange(`${year}-${month}-${day}`);
          }
        },
      });
    } else {
      setShowIosPicker(true);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[s.dateBtn, disabled && s.disabledInput]}
        onPress={openPicker}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={15} color={disabled ? '#94A3B8' : '#2563EB'} />
        <Text style={[s.dateBtnText, !value && s.placeholderText]} numberOfLines={1}>
          {value
            ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : placeholder}
        </Text>
        {!!value && !disabled && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={14} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {Platform.OS === 'ios' && showIosPicker && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display="spinner"
          minimumDate={minDate ? new Date(minDate) : undefined}
          maximumDate={maxDate ? new Date(maxDate) : undefined}
          onChange={(e, d) => {
            setShowIosPicker(false);
            if (d) {
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              onChange(`${year}-${month}-${day}`);
            }
          }}
        />
      )}
    </>
  );
}

// =============================================================================
// Main Component: InteriorWbsScreen
// =============================================================================

export default function InteriorWbsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();
  const { can: canDo } = useProjectPermissions(projectId);

  const [wbsData, setWbsData] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState([]);

  // Modal 1: Create / Edit WBS Node
  const [isWbsModalOpen, setIsWbsModalOpen] = useState(false);
  const [wbsModalMode, setWbsModalMode] = useState('create'); // 'create' | 'edit'
  const [currentNodeId, setCurrentNodeId] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [nodeDescription, setNodeDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('active'); // 'active' | 'inactive'
  const [submittingWbs, setSubmittingWbs] = useState(false);

  // Initial activities inside Create WBS Modal
  const [initialActivities, setInitialActivities] = useState([]);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityPriority, setNewActivityPriority] = useState('medium');
  const [newActivityAssignee, setNewActivityAssignee] = useState('');
  const [newActivityIsMilestone, setNewActivityIsMilestone] = useState(false);
  const [showActivitySection, setShowActivitySection] = useState(false);

  // Modal 2: Create / Edit Activity Modal
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [detailTask, setDetailTask] = useState(null); // { task, node } shown in the details sheet
  const [activityModalMode, setActivityModalMode] = useState('create'); // 'create' | 'edit'
  const [editingTaskId, setEditingTaskId] = useState('');
  const [selectedNodeForActivity, setSelectedNodeForActivity] = useState(null);
  const [activityName, setActivityName] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityPriority, setActivityPriority] = useState('medium');
  const [activityStatus, setActivityStatus] = useState('todo');
  const [activityStartDate, setActivityStartDate] = useState('');
  const [activityEndDate, setActivityEndDate] = useState('');
  const [activityAssigneeId, setActivityAssigneeId] = useState('');
  const [activityIsMilestone, setActivityIsMilestone] = useState(false);
  const [submittingActivity, setSubmittingActivity] = useState(false);

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [wbsRes, tasksRes, membersRes] = await Promise.all([
        interiorApiClient.get(`/projects/${projectId}/wbs`).catch(() => ({ data: [] })),
        interiorApiClient.get(`/projects/${projectId}/tasks`).catch(() => ({ data: [] })),
        interiorApiClient.get(`/projects/${projectId}/members`).catch(() => ({ data: [] })),
      ]);

      const rawWbs = wbsRes?.success && wbsRes?.data ? wbsRes.data : wbsRes?.data || [];
      const rawTasks = tasksRes?.success && tasksRes?.data ? tasksRes.data : tasksRes?.data || [];
      const rawMembers = membersRes?.success && membersRes?.data ? membersRes.data : membersRes?.data || [];

      setWbsData(rawWbs);
      setTasks(rawTasks);

      // Auto-expand all nodes by default
      if (rawWbs.length > 0) {
        setExpandedNodes((prev) => (prev.length === 0 ? rawWbs.map((n) => n.id) : prev));
      }

      const formattedMembers = rawMembers.map((m) => ({
        id: String(m.userId?._id || m.userId?.id || m.userId || m._id || ''),
        name: m.userId?.firstName
          ? `${m.userId.firstName} ${m.userId.lastName || ''}`.trim()
          : m.userId?.name || m.userId?.email || 'Member',
        email: m.userId?.email || '',
        role: memberRoleLabel(m), // project role, same as web
      }));
      setMembers(formattedMembers);
    } catch (e) {
      console.warn('Failed to load WBS data', e);
      showToast('Failed to load WBS data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, showToast]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  // ---------------------------------------------------------------------------
  // Mapping Tasks to WBS Nodes
  // ---------------------------------------------------------------------------

  const getAllDescendantIds = (node) => {
    const ids = [];
    const collect = (curr) => {
      if (!curr) return;
      const currId = String(curr.id || curr._id || '');
      if (currId) ids.push(currId);
      if (Array.isArray(curr.floors)) curr.floors.forEach(collect);
      if (Array.isArray(curr.zones)) curr.zones.forEach(collect);
      if (Array.isArray(curr.areas)) curr.areas.forEach(collect);
      if (Array.isArray(curr.packages)) curr.packages.forEach(collect);
      if (Array.isArray(curr.children)) curr.children.forEach(collect);
    };
    collect(node);
    return ids;
  };

  const tasksByPackage = useMemo(() => {
    const map = new Map();
    wbsData.forEach((node) => {
      map.set(String(node.id || node._id), []);
    });

    const rootNodesWithDescendants = wbsData.map((node) => ({
      id: String(node.id || node._id),
      childIds: getAllDescendantIds(node),
    }));

    for (const t of tasks) {
      const rawPkgId = String(t.packageId?._id || t.packageId?.id || t.packageId || '');
      const matchingRoot = rootNodesWithDescendants.find(
        (r) => r.id === rawPkgId || r.childIds.includes(rawPkgId)
      );
      if (matchingRoot && map.has(matchingRoot.id)) {
        map.get(matchingRoot.id).push(t);
      } else if (rawPkgId && map.has(rawPkgId)) {
        map.get(rawPkgId).push(t);
      }
    }

    map.forEach((list) => {
      list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    });

    return map;
  }, [wbsData, tasks]);

  const toggleNode = (id) => {
    setExpandedNodes((prev) => (prev.includes(id) ? prev.filter((nodeId) => nodeId !== id) : [...prev, id]));
  };

  const toggleAllNodes = () => {
    if (expandedNodes.length === wbsData.length) {
      setExpandedNodes([]);
    } else {
      setExpandedNodes(wbsData.map((n) => n.id));
    }
  };

  // ---------------------------------------------------------------------------
  // WBS Element CRUD
  // ---------------------------------------------------------------------------

  const handleOpenCreateWbs = () => {
    setWbsModalMode('create');
    setCurrentNodeId('');
    setNodeName('');
    setNodeDescription('');
    setStartDate('');
    setEndDate('');
    setStatus('active');
    setInitialActivities([]);
    setNewActivityName('');
    setNewActivityPriority('medium');
    setNewActivityAssignee('');
    setNewActivityIsMilestone(false);
    setShowActivitySection(false);
    setIsWbsModalOpen(true);
  };

  const handleOpenEditWbs = (node) => {
    setWbsModalMode('edit');
    setCurrentNodeId(node.id);
    setNodeName(node.name || '');
    setNodeDescription(node.description || '');
    setStartDate(node.startDate ? new Date(node.startDate).toISOString().split('T')[0] : '');
    setEndDate(node.endDate ? new Date(node.endDate).toISOString().split('T')[0] : '');
    setStatus(node.status === 'inactive' ? 'inactive' : 'active');
    setInitialActivities([]);
    setShowActivitySection(false);
    setIsWbsModalOpen(true);
  };

  const handleAddInitialActivity = () => {
    if (!newActivityName.trim()) {
      showToast('Please enter an Activity Name', 'error');
      return;
    }
    const item = {
      id: String(Date.now()),
      name: newActivityName.trim(),
      priority: newActivityPriority,
      assigneeId: newActivityAssignee || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      isMilestone: newActivityIsMilestone,
    };
    setInitialActivities((prev) => [...prev, item]);
    setNewActivityName('');
    setNewActivityIsMilestone(false);
  };

  const handleRemoveInitialActivity = (id) => {
    setInitialActivities((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSaveWbs = async () => {
    if (!nodeName.trim()) {
      showToast('Please enter a WBS Name', 'error');
      return;
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      showToast('Start Date must be before or equal to End Date', 'error');
      return;
    }

    setSubmittingWbs(true);
    try {
      const payload = {
        type: 'building',
        name: nodeName.trim(),
        description: nodeDescription.trim(),
        startDate: startDate || null,
        endDate: endDate || null,
        status,
      };

      let createdOrUpdatedNodeId = currentNodeId;

      if (wbsModalMode === 'create') {
        const res = await interiorApiClient.post(`/projects/${projectId}/wbs`, payload);
        createdOrUpdatedNodeId = res?.data?._id || res?.data?.id || res?._id || res?.id;
      } else {
        payload.id = currentNodeId;
        await interiorApiClient.put(`/projects/${projectId}/wbs`, payload);
      }

      // If initial activities were configured during creation, create them
      if (initialActivities.length > 0 && createdOrUpdatedNodeId) {
        for (const act of initialActivities) {
          try {
            await interiorApiClient.post(`/projects/${projectId}/tasks`, {
              packageId: createdOrUpdatedNodeId,
              name: act.name,
              priority: act.priority,
              status: 'todo',
              startDate: act.startDate || startDate || undefined,
              endDate: act.endDate || endDate || undefined,
              assignees: act.assigneeId ? [act.assigneeId] : [],
              progress: 0,
              isMilestone: Boolean(act.isMilestone),
            });
          } catch (taskErr) {
            console.warn('Failed to add initial activity', taskErr);
          }
        }
        showToast(
          `WBS created with ${initialActivities.length} activit${initialActivities.length > 1 ? 'ies' : 'y'}!`,
          'success'
        );
      } else {
        showToast(
          wbsModalMode === 'create' ? 'WBS element created successfully' : 'WBS element updated successfully',
          'success'
        );
      }

      setIsWbsModalOpen(false);
      fetchData(true);
    } catch (e) {
      showToast(e.message || 'Failed to save WBS element', 'error');
    } finally {
      setSubmittingWbs(false);
    }
  };

  const confirmDeleteWbs = (node) => {
    Alert.alert(
      'Delete WBS Element',
      `Are you sure you want to delete "${node.name}"? Any linked activities will also be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteWbs(node) },
      ]
    );
  };

  const handleDeleteWbs = async (node) => {
    try {
      await interiorApiClient.delete(`/projects/${projectId}/wbs?type=${node.type || 'building'}&id=${node.id}`);
      showToast('WBS element deleted successfully', 'delete');
      fetchData(true);
    } catch (e) {
      showToast(e.message || 'Failed to delete WBS element', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // Activity / Task CRUD
  // ---------------------------------------------------------------------------

  const handleOpenAddActivity = (node) => {
    setActivityModalMode('create');
    setEditingTaskId('');
    setSelectedNodeForActivity(node);
    setActivityName('');
    setActivityDescription('');
    setActivityPriority('medium');
    setActivityStatus('todo');
    setActivityStartDate('');
    setActivityEndDate('');
    setActivityAssigneeId('');
    setActivityIsMilestone(false);
    setIsActivityModalOpen(true);
  };

  const handleOpenEditActivity = (task, node) => {
    setActivityModalMode('edit');
    setEditingTaskId(task._id || task.id);
    setSelectedNodeForActivity(node);
    setActivityName(task.name || '');
    setActivityDescription(task.description || '');
    setActivityPriority(task.priority || 'medium');
    setActivityStatus(task.status || 'todo');
    setActivityStartDate(task.startDate ? String(task.startDate).split('T')[0] : '');
    setActivityEndDate(task.endDate ? String(task.endDate).split('T')[0] : '');
    const firstAssignee = task.assignees?.[0];
    const assigneeId =
      typeof firstAssignee === 'object'
        ? firstAssignee?._id || firstAssignee?.id || ''
        : firstAssignee || '';
    setActivityAssigneeId(assigneeId);
    setActivityIsMilestone(Boolean(task.isMilestone));
    setIsActivityModalOpen(true);
  };

  const handleSaveActivity = async () => {
    if (!activityName.trim()) {
      showToast('Please enter an Activity Name', 'error');
      return;
    }
    if (activityStartDate && activityEndDate && new Date(activityStartDate) > new Date(activityEndDate)) {
      showToast('Start Date must be before or equal to End Date', 'error');
      return;
    }

    // Validate that activity dates fall within parent WBS date bounds
    const targetWbsNode = wbsData.find((w) => String(w.id) === String(selectedNodeForActivity?.id));
    const wbsMin = targetWbsNode?.startDate ? String(targetWbsNode.startDate).split('T')[0] : null;
    const wbsMax = targetWbsNode?.endDate ? String(targetWbsNode.endDate).split('T')[0] : null;

    if (wbsMin && activityStartDate && activityStartDate < wbsMin) {
      showToast(`Start Date cannot be earlier than WBS Start (${wbsMin})`, 'error');
      return;
    }
    if (wbsMax && activityEndDate && activityEndDate > wbsMax) {
      showToast(`End Date cannot be later than WBS End (${wbsMax})`, 'error');
      return;
    }

    setSubmittingActivity(true);
    try {
      if (activityModalMode === 'edit') {
        const payload = {
          name: activityName.trim(),
          description: activityDescription.trim(),
          priority: activityPriority,
          status: activityStatus,
          startDate: activityStartDate || null,
          endDate: activityEndDate || null,
          assignees: activityAssigneeId ? [activityAssigneeId] : [],
          isMilestone: activityIsMilestone,
        };
        await interiorApiClient.put(`/projects/${projectId}/tasks/${editingTaskId}`, payload);
        showToast('Activity updated successfully', 'success');
      } else {
        if (!selectedNodeForActivity?.id) {
          showToast('Please select a WBS element', 'error');
          return;
        }
        const payload = {
          packageId: selectedNodeForActivity.id,
          name: activityName.trim(),
          description: activityDescription.trim(),
          priority: activityPriority,
          status: 'todo',
          startDate: activityStartDate || undefined,
          endDate: activityEndDate || undefined,
          assignees: activityAssigneeId ? [activityAssigneeId] : [],
          subtasks: [],
          progress: 0,
          isMilestone: activityIsMilestone,
        };
        await interiorApiClient.post(`/projects/${projectId}/tasks`, payload);
        showToast('Activity created successfully', 'success');
      }

      setIsActivityModalOpen(false);
      fetchData(true);
    } catch (e) {
      showToast(e.message || 'Failed to save activity', 'error');
    } finally {
      setSubmittingActivity(false);
    }
  };

  const confirmDeleteActivity = (task) => {
    Alert.alert(
      'Delete Activity',
      `Are you sure you want to delete activity "${task.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteActivity(task._id || task.id) },
      ]
    );
  };

  const handleDeleteActivity = async (taskId) => {
    try {
      await interiorApiClient.delete(`/projects/${projectId}/tasks/${taskId}`);
      showToast('Activity deleted successfully', 'delete');
      fetchData(true);
    } catch (e) {
      showToast(e.message || 'Failed to delete activity', 'error');
    }
  };

  const handleToggleTaskStatus = async (task) => {
    if (!canDo('tasks', 'update')) return;
    const isDone = task.status === 'completed';
    const newStatus = isDone ? 'in_progress' : 'completed';
    const newProgress = isDone ? 50 : 100;
    try {
      await interiorApiClient.put(`/projects/${projectId}/tasks/${task._id || task.id}`, {
        status: newStatus,
        progress: newProgress,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : null,
      });
      showToast(newStatus === 'completed' ? 'Activity completed!' : 'Activity reopened', 'success');
      fetchData(true);
    } catch (e) {
      showToast(e.message || 'Failed to update activity status', 'error');
    }
  };

  // Helper to format assignees
  // Assignee dropdown options — "Name (Role)", same as the web
  const memberOptions = useMemo(
    () => [{ value: '', label: 'Unassigned' }, ...members.map((m) => ({ value: m.id, label: `${m.name} (${m.role})` }))],
    [members]
  );

  const getAssigneeName = (task) => {
    if (!task.assignees || !Array.isArray(task.assignees) || task.assignees.length === 0) {
      return null;
    }
    const names = task.assignees
      .map((a) => {
        if (!a) return null;
        if (typeof a === 'object') {
          const fullName = `${a.firstName || ''} ${a.lastName || ''}`.trim();
          return fullName || a.name || a.email || null;
        }
        const member = members.find((m) => String(m.id) === String(a));
        return member?.name || null;
      })
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : null;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const totalCompletedActivities = tasks.filter((t) => t.status === 'completed').length;
  const overallProgressPct = tasks.length > 0 ? Math.round((totalCompletedActivities / tasks.length) * 100) : 0;

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        {/* Top Header (same look as the other module screens) */}
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.headerTitle} numberOfLines={1}>Work Breakdown</Text>
            <Text style={s.headerSub} numberOfLines={1}>
              {wbsData.length} {wbsData.length === 1 ? 'element' : 'elements'} · {tasks.length} {tasks.length === 1 ? 'activity' : 'activities'}
            </Text>
          </View>
          {canDo('wbs', 'create') && (
            <TouchableOpacity style={s.headerAddBtn} onPress={handleOpenCreateWbs} activeOpacity={0.8}>
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={s.headerAddText}>New</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Navigation Bar */}
        <CategoryNav projectId={projectId} activeItem="WBS Hierarchy" />

        {loading && !refreshing ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />}
          >
            {/* Overall progress: one slim line */}
            {wbsData.length > 0 && (
              <View style={s.overviewStrip}>
                <View style={{ flex: 1 }}>
                  <View style={s.rowBetween}>
                    <Text style={s.overviewLabel}>Overall progress</Text>
                    <Text style={s.overviewCountText}>
                      <Text style={s.overviewPctText}>{overallProgressPct}%</Text>  ·  {totalCompletedActivities}/{tasks.length} done
                    </Text>
                  </View>
                  <View style={s.progressBarTrack}>
                    <View style={[s.progressBarFill, { width: `${overallProgressPct}%` }]} />
                  </View>
                </View>
                {wbsData.length > 1 && (
                  <TouchableOpacity style={s.toggleAllBtn} onPress={toggleAllNodes} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name={expandedNodes.length === wbsData.length ? 'contract-outline' : 'expand-outline'} size={16} color="#475569" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {wbsData.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="folder-open-outline" size={36} color="#94A3B8" />
                <Text style={s.emptyTitle}>No WBS elements yet</Text>
                {canDo('wbs', 'create') && (
                  <TouchableOpacity style={s.emptyBtn} onPress={handleOpenCreateWbs} activeOpacity={0.8}>
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={s.emptyBtnText}>Create WBS element</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {wbsData.map((node) => {
                  const directTasks = tasksByPackage.get(node.id) || [];
                  const isExpanded = expandedNodes.includes(node.id);
                  const dateRange = shortRange(node.startDate, node.endDate);
                  const completedCount = directTasks.filter((t) => t.status === 'completed').length;
                  const nodeProgressPct = directTasks.length > 0 ? Math.round((completedCount / directTasks.length) * 100) : 0;
                  const inactive = node.status === 'inactive';
                  const nodeMenu = () => {
                    const opts = [];
                    if (canDo('wbs', 'update')) opts.push({ text: 'Edit element', onPress: () => handleOpenEditWbs(node) });
                    if (canDo('wbs', 'delete')) opts.push({ text: 'Delete element', style: 'destructive', onPress: () => confirmDeleteWbs(node) });
                    if (opts.length) Alert.alert(node.name, undefined, [...opts, { text: 'Cancel', style: 'cancel' }]);
                  };

                  return (
                    <View key={node.id} style={s.wbsCard}>
                      {/* Element header: name, one facts line, thin progress bar */}
                      <TouchableOpacity style={s.wbsCardHeader} onPress={() => toggleNode(node.id)} activeOpacity={0.8}>
                        <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={18} color="#64748B" style={{ marginTop: 1 }} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.wbsNodeName} numberOfLines={2}>{node.name}</Text>
                          <Text style={s.wbsNodeMeta} numberOfLines={1}>
                            {[
                              inactive ? 'Inactive' : null,
                              `${completedCount}/${directTasks.length} done`,
                              dateRange,
                            ].filter(Boolean).join('  ·  ')}
                          </Text>
                        </View>
                        <Text style={s.wbsPct}>{nodeProgressPct}%</Text>
                        {(canDo('wbs', 'update') || canDo('wbs', 'delete')) && (
                          <TouchableOpacity onPress={nodeMenu} style={s.moreBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="ellipsis-vertical" size={16} color="#64748B" />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                      <View style={s.nodeTrack}>
                        <View style={[s.nodeFill, { width: `${nodeProgressPct}%` }]} />
                      </View>

                      {/* Activities: plain rows */}
                      {isExpanded && (
                        <View style={s.activitiesContainer}>
                          {directTasks.length === 0 && (
                            <Text style={s.emptyActivitiesText}>No activities yet.</Text>
                          )}
                          {directTasks.map((task, ti) => {
                            const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                            const statusMeta = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
                            const isDone = task.status === 'completed';
                            const range = shortRange(task.startDate, task.endDate);
                            const assigneeName = getAssigneeName(task);
                            const taskMenu = () => {
                              const opts = [];
                              if (canDo('tasks', 'update')) opts.push({ text: 'Edit activity', onPress: () => handleOpenEditActivity(task, node) });
                              if (canDo('tasks', 'delete')) opts.push({ text: 'Delete activity', style: 'destructive', onPress: () => confirmDeleteActivity(task) });
                              if (opts.length) Alert.alert(task.name, undefined, [...opts, { text: 'Cancel', style: 'cancel' }]);
                            };
                            return (
                              <TouchableOpacity
                                key={task._id || task.id}
                                style={[s.activityRow, ti === directTasks.length - 1 && { borderBottomWidth: 0 }]}
                                onPress={() => setDetailTask({ task, node })}
                                onLongPress={taskMenu}
                                activeOpacity={0.7}
                              >
                                <TouchableOpacity onPress={() => handleToggleTaskStatus(task)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginTop: 1 }}>
                                  <Ionicons name={isDone ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={isDone ? '#10B981' : '#CBD5E1'} />
                                </TouchableOpacity>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={[s.activityTitle, isDone && s.activityTitleDone]} numberOfLines={2}>
                                    {task.isMilestone ? '⚑ ' : ''}{task.name}
                                  </Text>
                                  <View style={s.activityMetaRow}>
                                    <View style={[s.priorityDot, { backgroundColor: priority.color }]} />
                                    <Text style={s.activityMeta} numberOfLines={1}>
                                      {[priority.label, assigneeName || 'Unassigned', range].filter(Boolean).join('  ·  ')}
                                    </Text>
                                  </View>
                                </View>
                                {!isDone && <Text style={[s.activityStatus, { color: statusMeta.color }]}>{statusMeta.label}</Text>}
                                {(canDo('tasks', 'update') || canDo('tasks', 'delete')) && (
                                  <TouchableOpacity onPress={taskMenu} style={s.moreBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="ellipsis-vertical" size={15} color="#94A3B8" />
                                  </TouchableOpacity>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                          {canDo('tasks', 'create') && (
                            <TouchableOpacity style={s.addActivityLink} onPress={() => handleOpenAddActivity(node)} activeOpacity={0.7}>
                              <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
                              <Text style={s.addActivityLinkText}>Add activity</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* =========================================================================
          Activity details (tap a row): read view with the actions at the bottom
          ========================================================================= */}
      <Modal visible={!!detailTask} animationType="slide" transparent onRequestClose={() => setDetailTask(null)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setDetailTask(null)} />
          {detailTask && (() => {
            const { task, node } = detailTask;
            const statusMeta = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
            const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
            const isDone = task.status === 'completed';
            const fmt = (v) => {
              if (!v) return null;
              const d = new Date(v);
              return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            };
            const days = task.startDate && task.endDate
              ? Math.max(1, Math.round((new Date(task.endDate) - new Date(task.startDate)) / 86400000) + 1)
              : null;
            const overdue = !isDone && task.endDate && new Date(task.endDate).getTime() < Date.now();
            const desc = String(task.description || '').trim();
            const showDesc = desc && !desc.toLowerCase().startsWith(String(task.name || '').toLowerCase());
            const rows = [
              ['Assigned to', getAssigneeName(task) || 'Unassigned'],
              ['Start', fmt(task.startDate)],
              ['End', fmt(task.endDate), overdue],
              ['Duration', days ? `${days} ${days === 1 ? 'day' : 'days'}` : null],
              ['WBS element', node?.name],
            ].filter(([, v]) => v);
            return (
              <View style={[s.detailSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
                <View style={s.sheetHandle} />
                <View style={s.detailTop}>
                  <Text style={s.detailTitle}>{task.name}</Text>
                  <TouchableOpacity onPress={() => setDetailTask(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <View style={s.detailTags}>
                  <View style={[s.detailPill, { backgroundColor: statusMeta.bg }]}>
                    <Text style={[s.detailPillText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                  </View>
                  <View style={s.detailTagItem}>
                    <View style={[s.priorityDot, { backgroundColor: priority.color }]} />
                    <Text style={s.detailTagText}>{priority.label} priority</Text>
                  </View>
                  {task.isMilestone && (
                    <View style={s.detailTagItem}>
                      <Ionicons name="flag" size={13} color="#7C3AED" />
                      <Text style={[s.detailTagText, { color: '#7C3AED' }]}>Milestone</Text>
                    </View>
                  )}
                  {overdue && <Text style={[s.detailTagText, { color: '#DC2626' }]}>Overdue</Text>}
                </View>

                <View style={s.detailRows}>
                  {rows.map(([label, value, warn], i) => (
                    <View key={label} style={[s.detailRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
                      <Text style={s.detailLabel}>{label}</Text>
                      <Text style={[s.detailValue, warn && { color: '#DC2626' }]} numberOfLines={2}>{value}</Text>
                    </View>
                  ))}
                </View>

                {showDesc && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={s.detailLabel}>Scope</Text>
                    <Text style={s.detailDesc}>{desc}</Text>
                  </View>
                )}

                {canDo('tasks', 'update') && (
                  <TouchableOpacity
                    style={[s.detailPrimary, isDone && { backgroundColor: '#F1F5F9' }]}
                    onPress={() => { setDetailTask(null); handleToggleTaskStatus(task); }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={isDone ? 'refresh' : 'checkmark-circle'} size={18} color={isDone ? '#334155' : '#FFFFFF'} />
                    <Text style={[s.detailPrimaryText, isDone && { color: '#334155' }]}>{isDone ? 'Reopen activity' : 'Mark as done'}</Text>
                  </TouchableOpacity>
                )}
                {(canDo('tasks', 'update') || canDo('tasks', 'delete')) && (
                  <View style={s.detailActions}>
                    {canDo('tasks', 'update') && (
                      <TouchableOpacity style={s.detailSecondary} onPress={() => { setDetailTask(null); handleOpenEditActivity(task, node); }}>
                        <Ionicons name="create-outline" size={16} color="#334155" />
                        <Text style={s.detailSecondaryText}>Edit</Text>
                      </TouchableOpacity>
                    )}
                    {canDo('tasks', 'delete') && (
                      <TouchableOpacity style={[s.detailSecondary, { borderColor: '#FECDD3' }]} onPress={() => { setDetailTask(null); confirmDeleteActivity(task); }}>
                        <Ionicons name="trash-outline" size={16} color="#E11D48" />
                        <Text style={[s.detailSecondaryText, { color: '#E11D48' }]}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* =========================================================================
          MODAL 1: Create / Edit WBS Node
          ========================================================================= */}
      <Modal visible={isWbsModalOpen} animationType="slide" transparent onRequestClose={() => setIsWbsModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={s.modalIconWrap}>
                  <Ionicons name="folder-open" size={18} color="#2563EB" />
                </View>
                <View>
                  <Text style={s.modalTitle}>{wbsModalMode === 'create' ? 'Create WBS' : 'Edit WBS'}</Text>
                  <Text style={s.modalSub}>Scope, timeline, and activities for this WBS element</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsWbsModalOpen(false)} style={s.closeModalBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* WBS Name * */}
              <Text style={s.formLabel}>
                WBS Name <Text style={{ color: '#E11D48' }}>*</Text>
              </Text>
              <TextInput
                style={s.formInput}
                placeholder="e.g. Kitchen Cabinetry or Civil Partition"
                placeholderTextColor="#94A3B8"
                value={nodeName}
                onChangeText={setNodeName}
              />

              {/* Description */}
              <Text style={s.formLabel}>Description</Text>
              <TextInput
                style={[s.formInput, s.formTextArea]}
                placeholder="Define the scope of this WBS element..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={nodeDescription}
                onChangeText={setNodeDescription}
              />

              {/* Planning Dates */}
              <Text style={s.formSectionTitle}>Planning Dates</Text>
              <View style={s.dateInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formSubLabel}>Planned Start Date</Text>
                  <DatePickerField
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Start date"
                    maxDate={endDate || undefined}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.formSubLabel}>Planned End Date</Text>
                  <DatePickerField
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="End date"
                    minDate={startDate || undefined}
                  />
                </View>
              </View>

              {/* Status Radio / Segmented */}
              <Text style={s.formSectionTitle}>Status</Text>
              <View style={s.statusSegmentRow}>
                <TouchableOpacity
                  style={[s.statusSegmentBtn, status === 'active' && s.statusSegmentBtnActive]}
                  onPress={() => setStatus('active')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={status === 'active' ? '#10B981' : '#94A3B8'}
                  />
                  <Text style={[s.statusSegmentText, status === 'active' && s.statusSegmentTextActive]}>Active</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.statusSegmentBtn, status === 'inactive' && s.statusSegmentBtnInactive]}
                  onPress={() => setStatus('inactive')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="pause-circle"
                    size={14}
                    color={status === 'inactive' ? '#E11D48' : '#94A3B8'}
                  />
                  <Text style={[s.statusSegmentText, status === 'inactive' && s.statusSegmentTextInactive]}>
                    Inactive
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Activities Section inside Create Modal */}
              {wbsModalMode === 'create' && (
                <View style={s.initialActivitiesBox}>
                  <View style={s.initialActivitiesHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkbox-outline" size={15} color="#2563EB" />
                      <Text style={s.initialActivitiesTitle}>Add Activities / Tasks</Text>
                      <View style={s.optionalTag}>
                        <Text style={s.optionalTagText}>Optional</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowActivitySection(!showActivitySection)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={s.toggleActivitiesLink}>
                        {showActivitySection ? 'Hide' : '+ Add Activity'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showActivitySection && (
                    <View style={{ marginTop: 10, gap: 10 }}>
                      <TextInput
                        style={s.formInput}
                        placeholder="Activity name (e.g. Base Framing)"
                        placeholderTextColor="#94A3B8"
                        value={newActivityName}
                        onChangeText={setNewActivityName}
                      />

                      {/* Priority dropdown (same as web) */}
                      <View>
                        <Text style={s.formSubLabel}>Priority</Text>
                        <SelectField
                          value={newActivityPriority}
                          onChange={setNewActivityPriority}
                          options={PRIORITY_OPTIONS}
                        />
                      </View>

                      {/* Assign To dropdown (same as web) */}
                      {members.length > 0 && (
                        <View>
                          <Text style={s.formSubLabel}>Assign To</Text>
                          <SelectField
                            value={newActivityAssignee}
                            onChange={setNewActivityAssignee}
                            options={memberOptions}
                          />
                        </View>
                      )}

                      {/* Milestone Checkbox & Add Button */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <TouchableOpacity
                          style={s.milestoneCheckRow}
                          onPress={() => setNewActivityIsMilestone(!newActivityIsMilestone)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={newActivityIsMilestone ? 'checkbox' : 'square-outline'}
                            size={16}
                            color="#7C3AED"
                          />
                          <Text style={s.milestoneCheckText}>Milestone Activity</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={s.addInitialActBtn} onPress={handleAddInitialActivity}>
                          <Ionicons name="add" size={14} color="#FFFFFF" />
                          <Text style={s.addInitialActBtnText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Pending Initial Activities List */}
                  {initialActivities.length > 0 && (
                    <View style={{ marginTop: 10, gap: 6 }}>
                      {initialActivities.map((act) => {
                        const member = members.find((m) => String(m.id) === String(act.assigneeId));
                        return (
                          <View key={act.id} style={s.pendingActRow}>
                            <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={s.pendingActName} numberOfLines={1}>
                                {act.name}
                              </Text>
                              <View style={s.pendingActTag}>
                                <Text style={s.pendingActTagText}>{act.priority}</Text>
                              </View>
                              {member && (
                                <View style={s.pendingActMemberTag}>
                                  <Ionicons name="person-outline" size={9} color="#1D4ED8" />
                                  <Text style={s.pendingActMemberText} numberOfLines={1}>{member.name}</Text>
                                </View>
                              )}
                              {act.isMilestone && (
                                <View style={s.milestoneBadge}>
                                  <Ionicons name="flag" size={8} color="#7C3AED" />
                                  <Text style={s.milestoneBadgeText}>Milestone</Text>
                                </View>
                              )}
                            </View>
                            <TouchableOpacity
                              onPress={() => handleRemoveInitialActivity(act.id)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Ionicons name="close" size={14} color="#94A3B8" />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Submit Pill Button */}
              <TouchableOpacity
                style={[s.modalSubmitBtn, submittingWbs && { opacity: 0.7 }]}
                onPress={handleSaveWbs}
                disabled={submittingWbs}
                activeOpacity={0.8}
              >
                {submittingWbs ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.modalSubmitBtnText}>
                    {wbsModalMode === 'create'
                      ? initialActivities.length > 0
                        ? `Create WBS & ${initialActivities.length} Activit${initialActivities.length > 1 ? 'ies' : 'y'}`
                        : 'Create WBS'
                      : 'Save Changes'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =========================================================================
          MODAL 2: Create / Edit Activity Modal
          ========================================================================= */}
      <Modal visible={isActivityModalOpen} animationType="slide" transparent onRequestClose={() => setIsActivityModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={s.modalIconWrap}>
                  <Ionicons name="clipboard" size={18} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>
                    {activityModalMode === 'create' ? 'New activity' : 'Edit activity'}
                  </Text>
                  <Text style={s.modalSub} numberOfLines={1}>
                    {selectedNodeForActivity?.name}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsActivityModalOpen(false)} style={s.closeModalBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Completed Activity Lock Banner */}
              {activityModalMode === 'edit' && activityStatus === 'completed' && (
                <View style={s.completedLockBanner}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.completedLockTitle}>Completed — reopen it to make changes</Text>
                  </View>
                </View>
              )}

              {/* Activity Name * */}
              <Text style={s.formLabel}>
                Activity Name <Text style={{ color: '#E11D48' }}>*</Text>
              </Text>
              <TextInput
                style={s.formInput}
                placeholder="e.g. Base Cabinet Framing & Fitting"
                placeholderTextColor="#94A3B8"
                value={activityName}
                onChangeText={setActivityName}
                editable={!(activityModalMode === 'edit' && activityStatus === 'completed')}
              />

              {/* Description */}
              <Text style={s.formLabel}>Description / Work Scope</Text>
              <TextInput
                style={[s.formInput, s.formTextArea]}
                placeholder="Provide specific execution details..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                value={activityDescription}
                onChangeText={setActivityDescription}
                editable={!(activityModalMode === 'edit' && activityStatus === 'completed')}
              />

              {/* Priority */}
              <Text style={s.formSectionTitle}>Priority</Text>
              <SelectField
                value={activityPriority}
                onChange={setActivityPriority}
                options={PRIORITY_OPTIONS}
                disabled={activityModalMode === 'edit' && activityStatus === 'completed'}
                style={{ marginBottom: 6 }}
              />

              {/* Status Selector (in edit mode) */}
              {activityModalMode === 'edit' && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={s.formSectionTitle}>Status</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {['todo', 'in_progress', 'in_review', 'completed'].map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[
                          s.chipBtn,
                          activityStatus === st && {
                            backgroundColor: STATUS_CONFIG[st].bg,
                            borderColor: STATUS_CONFIG[st].color,
                          },
                        ]}
                        onPress={() => setActivityStatus(st)}
                      >
                        <Text
                          style={[
                            s.chipBtnText,
                            activityStatus === st && { color: STATUS_CONFIG[st].color, fontWeight: '700' },
                          ]}
                        >
                          {STATUS_CONFIG[st].label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Assignee */}
              <Text style={s.formSectionTitle}>Assignee</Text>
              <SelectField
                value={activityAssigneeId}
                onChange={setActivityAssigneeId}
                options={memberOptions}
                disabled={activityModalMode === 'edit' && activityStatus === 'completed'}
                style={{ marginBottom: 6 }}
              />

              {/* Planning Dates */}
              {(() => {
                const targetWbs = wbsData.find((w) => String(w.id) === String(selectedNodeForActivity?.id));
                const wbsMin = targetWbs?.startDate ? String(targetWbs.startDate).split('T')[0] : undefined;
                const wbsMax = targetWbs?.endDate ? String(targetWbs.endDate).split('T')[0] : undefined;

                return (
                  <View style={{ marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={s.formSectionTitle}>Planning Dates</Text>
                      {(wbsMin || wbsMax) && (
                        <View style={s.wbsScopePill}>
                          <Text style={s.wbsScopePillText}>
                            WBS Scope: {wbsMin || 'Any'} to {wbsMax || 'Any'}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={s.dateInputsRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.formSubLabel}>Start Date</Text>
                        <DatePickerField
                          value={activityStartDate}
                          onChange={setActivityStartDate}
                          placeholder="Start date"
                          minDate={wbsMin}
                          maxDate={activityEndDate || wbsMax || undefined}
                          disabled={activityModalMode === 'edit' && activityStatus === 'completed'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.formSubLabel}>End Date</Text>
                        <DatePickerField
                          value={activityEndDate}
                          onChange={setActivityEndDate}
                          placeholder="End date"
                          minDate={activityStartDate || wbsMin || undefined}
                          maxDate={wbsMax}
                          disabled={activityModalMode === 'edit' && activityStatus === 'completed'}
                        />
                      </View>
                    </View>
                  </View>
                );
              })()}

              {/* Milestone Checkbox */}
              <TouchableOpacity
                style={s.milestoneCardBox}
                onPress={() => setActivityIsMilestone(!activityIsMilestone)}
                disabled={activityModalMode === 'edit' && activityStatus === 'completed'}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={activityIsMilestone ? 'checkbox' : 'square-outline'}
                  size={18}
                  color="#7C3AED"
                />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.milestoneCardTitle}>Milestone</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Submit Pill Button */}
              <TouchableOpacity
                style={[s.modalSubmitBtn, submittingActivity && { opacity: 0.7 }]}
                onPress={handleSaveActivity}
                disabled={submittingActivity}
                activeOpacity={0.8}
              >
                {submittingActivity ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.modalSubmitBtnText}>
                    {activityModalMode === 'create' ? 'Create Activity' : 'Save Changes'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// =============================================================================
// Stylesheet (Clean, Modern, No Shadows)
// =============================================================================

const s = StyleSheet.create({
  addActivityLinkText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#2563EB' },
  addActivityLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  activityStatus: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', marginTop: 2 },
  activityMeta: { flex: 1, fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B' },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  nodeFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 2 },
  nodeTrack: { height: 4, backgroundColor: '#F1F5F9', marginHorizontal: 14, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  moreBtn: { paddingHorizontal: 2, paddingVertical: 2 },
  wbsPct: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 1 },
  wbsNodeMeta: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 3 },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  outerContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  headerAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2563EB', paddingHorizontal: 12, height: 34, borderRadius: 9 },
  headerAddText: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  // Overview Strip
  overviewStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  overviewLabel: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#334155' },
  progressBarTrack: { height: 5, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden', marginTop: 8 },
  progressBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#2563EB' },
  overviewPctText: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  overviewCountText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#64748B' },
  toggleAllBtn: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },

  // Empty State
  empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#475569' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2563EB', paddingHorizontal: 16, height: 40, borderRadius: 10, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  // WBS Card
  wbsCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  wbsCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  wbsNodeName: { fontSize: 15, lineHeight: 20, fontFamily: 'Inter-Bold', color: '#0F172A' },



  // WBS Actions Toolbar

  // Activities Container
  activitiesContainer: { paddingHorizontal: 14, paddingBottom: 6, marginTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  emptyActivitiesText: { fontSize: 13.5, fontFamily: 'Inter-Regular', color: '#94A3B8', paddingVertical: 12 },

  // Activity Card
  activityTitle: { fontSize: 14, lineHeight: 19, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  activityTitleDone: { color: '#94A3B8', textDecorationLine: 'line-through' },
  milestoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  milestoneBadgeText: { fontSize: 10.5, fontWeight: '700', color: '#7C3AED' },
  activityMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  detailSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 8 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 14 },
  detailTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailTitle: { flex: 1, fontSize: 17, lineHeight: 23, fontFamily: 'Inter-Bold', color: '#0F172A' },
  detailTags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  detailPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  detailPillText: { fontSize: 12.5, fontFamily: 'Inter-SemiBold' },
  detailTagItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailTagText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#475569' },
  detailRows: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailLabel: { width: 110, fontSize: 13.5, fontFamily: 'Inter-Regular', color: '#64748B' },
  detailValue: { flex: 1, fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A', textAlign: 'right' },
  detailDesc: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#334155', marginTop: 4 },
  detailPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 12, backgroundColor: '#10B981', marginTop: 18 },
  detailPrimaryText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  detailSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  detailSecondaryText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#334155' },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  modalSub: { fontSize: 12.5, color: '#64748B', marginTop: 1 },
  closeModalBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Form Fields
  formLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 5, marginTop: 10 },
  formSubLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  formSectionTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 12, marginBottom: 6 },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0F172A',
  },
  formTextArea: {
    minHeight: 64,
  },
  disabledInput: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  dateInputsRow: { flexDirection: 'row', gap: 10 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dateBtnText: { fontSize: 13, color: '#0F172A', fontWeight: '500', flex: 1, marginLeft: 6 },
  placeholderText: { color: '#94A3B8' },

  statusSegmentRow: { flexDirection: 'row', gap: 10 },
  statusSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  statusSegmentBtnActive: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  statusSegmentBtnInactive: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
  statusSegmentText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  statusSegmentTextActive: { color: '#047857', fontWeight: '700' },
  statusSegmentTextInactive: { color: '#B91C1C', fontWeight: '700' },

  // Initial Activities
  initialActivitiesBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
  },
  initialActivitiesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  initialActivitiesTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  optionalTag: { backgroundColor: '#E2E8F0', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  optionalTagText: { fontSize: 10.5, fontWeight: '600', color: '#475569' },
  toggleActivitiesLink: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  chipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipBtnText: { fontSize: 12.5, fontWeight: '600', color: '#475569' },
  milestoneCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  milestoneCheckText: { fontSize: 13, fontWeight: '600', color: '#581C87' },
  addInitialActBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addInitialActBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  pendingActRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 7,
  },
  pendingActName: { fontSize: 12.5, fontWeight: '600', color: '#0F172A', flexShrink: 1 },
  pendingActTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  pendingActTagText: { fontSize: 10.5, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  pendingActMemberTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  pendingActMemberText: { fontSize: 10.5, fontWeight: '600', color: '#1D4ED8' },

  // Completed lock banner
  completedLockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  completedLockTitle: { fontSize: 13, fontWeight: '700', color: '#065F46' },

  wbsScopePill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  wbsScopePillText: { fontSize: 11, fontWeight: '600', color: '#1D4ED8' },

  milestoneCardBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  milestoneCardTitle: { fontSize: 13, fontWeight: '700', color: '#4C1D95' },

  modalSubmitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  modalSubmitBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});

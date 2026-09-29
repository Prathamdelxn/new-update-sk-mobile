import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const STATUS_META = {
  planned: { label: 'Planned', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: 'calendar-outline' },
  achieved: { label: 'Achieved', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: 'checkmark-circle-outline' },
  delayed: { label: 'Delayed Slip', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: 'alert-circle-outline' },
};

function formatDate(d) {
  if (!d) return '—';
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toLocalDateString(d) {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const emptyForm = { name: '', dueDate: '' };
const emptyDelayForm = { reason: '', impactDays: '7', newDate: '' };

// Timezone-safe calendar date picker field
function DateField({ value, onChange, placeholder = 'Select date', inputStyle }) {
  const [showIosPicker, setShowIosPicker] = useState(false);

  const formatPickedDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const open = () => {
    const base = value ? new Date(value) : new Date();
    const validBase = isNaN(base.getTime()) ? new Date() : base;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: validBase,
        mode: 'date',
        onChange: (event, d) => {
          if (event.type === 'set' && d) onChange(formatPickedDate(d));
        },
      });
    } else {
      setShowIosPicker(true);
    }
  };

  return (
    <>
      <TouchableOpacity style={[inputStyle, dfStyles.row]} onPress={open} activeOpacity={0.7}>
        <Text style={[dfStyles.text, !value && dfStyles.placeholder]} numberOfLines={1}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={16} color="#64748B" />
      </TouchableOpacity>
      {Platform.OS === 'ios' && showIosPicker && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display="spinner"
          onChange={(e, d) => {
            setShowIosPicker(false);
            if (d) onChange(formatPickedDate(d));
          }}
        />
      )}
    </>
  );
}

const dfStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A', flex: 1, marginRight: 8 },
  placeholder: { color: '#94A3B8' },
});

export default function InteriorMilestonesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  const [delayTarget, setDelayTarget] = useState(null);
  const [loggingDelay, setLoggingDelay] = useState(false);
  const [delayForm, setDelayForm] = useState(emptyDelayForm);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [msRes, taskRes] = await Promise.allSettled([
        interiorApiClient.get(`/projects/${projectId}/milestones`),
        interiorApiClient.get(`/projects/${projectId}/tasks`),
      ]);
      setMilestones(msRes.status === 'fulfilled' && msRes.value?.success && msRes.value.data ? msRes.value.data : []);
      setTasks(taskRes.status === 'fulfilled' && taskRes.value?.success && taskRes.value.data ? taskRes.value.data : []);
    } catch (e) {
      console.warn('Failed to load milestones', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setSelectedTaskIds([]);
    setIsCreateOpen(true);
  };

  const toggleTask = (taskId) => {
    setSelectedTaskIds((prev) => (prev.includes(taskId) ? prev.filter((t) => t !== taskId) : [...prev, taskId]));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      showToast('Milestone name is required', 'error');
      return;
    }
    if (!form.dueDate.trim()) {
      showToast('Target due date is required', 'error');
      return;
    }
    setCreating(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/milestones`, {
        name: form.name.trim(),
        dueDate: form.dueDate,
        linkedTasks: selectedTaskIds,
      });
      showToast('Milestone created successfully!', 'success');
      setIsCreateOpen(false);
      setForm(emptyForm);
      setSelectedTaskIds([]);
      load();
    } catch (e) {
      showToast(e.message || 'Failed to create milestone', 'error');
    } finally {
      setCreating(false);
    }
  };

  const markDone = async (milestone) => {
    setMilestones((prev) => prev.map((m) => (m._id === milestone._id ? { ...m, status: 'achieved' } : m)));
    try {
      await interiorApiClient.put(`/projects/${projectId}/milestones/${milestone._id}`, { status: 'achieved' });
      showToast('Milestone marked as achieved', 'success');
      load();
    } catch (e) {
      showToast('Failed to update milestone', 'error');
      load();
    }
  };

  const openDelay = (milestone) => {
    const parsedDate = milestone.dueDate ? new Date(milestone.dueDate) : new Date();
    const currentDueDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    currentDueDate.setDate(currentDueDate.getDate() + 7);
    const suggestedStr = toLocalDateString(currentDueDate);

    setDelayForm({ reason: '', impactDays: '7', newDate: suggestedStr });
    setDelayTarget(milestone);
  };

  const handleImpactDaysChange = (daysStr) => {
    const days = parseInt(daysStr, 10);
    const base = delayTarget?.dueDate ? new Date(delayTarget.dueDate) : new Date();
    const validBase = isNaN(base.getTime()) ? new Date() : base;
    if (!isNaN(days) && days > 0) {
      const newTarget = new Date(validBase);
      newTarget.setDate(newTarget.getDate() + days);
      setDelayForm({ ...delayForm, impactDays: daysStr, newDate: toLocalDateString(newTarget) });
    } else {
      setDelayForm({ ...delayForm, impactDays: daysStr });
    }
  };

  const handleLogDelay = async () => {
    if (!delayForm.reason.trim()) {
      showToast('Delay reason is required', 'error');
      return;
    }
    if (!delayForm.newDate.trim()) {
      showToast('New target date is required', 'error');
      return;
    }
    setLoggingDelay(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/milestones/${delayTarget._id}/delays`, {
        reason: delayForm.reason.trim(),
        impactDays: parseInt(delayForm.impactDays, 10) || 1,
        originalDate: delayTarget.dueDate,
        newDate: delayForm.newDate,
      });
      showToast('Timeline delay slip logged', 'success');
      setDelayTarget(null);
      load();
    } catch (e) {
      showToast(e.message || 'Failed to log delay', 'error');
    } finally {
      setLoggingDelay(false);
    }
  };

  const confirmDelete = (milestone) => {
    Alert.alert(
      'Delete Milestone',
      'Are you sure you want to delete this milestone? Any delay logs associated with it will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(milestone) },
      ]
    );
  };

  const handleDelete = async (milestone) => {
    try {
      await interiorApiClient.delete(`/projects/${projectId}/milestones/${milestone._id}`);
      showToast('Milestone deleted successfully', 'delete');
      load();
    } catch (e) {
      showToast(e.message || 'Failed to delete milestone', 'error');
    }
  };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        {/* Header matching web design */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.headerTitle} numberOfLines={1}>Milestones & Key Targets</Text>
            <Text style={s.headerSub} numberOfLines={1}>Log milestone delays and trace timeline slips.</Text>
          </View>
          <TouchableOpacity style={s.headerAddBtn} onPress={openCreate} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={s.headerAddText}>Add</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />}
          >
            {/* Visual Timeline Gantt Card */}
            {milestones.length > 0 && (
              <View style={s.ganttCard}>
                <View style={s.ganttHeader}>
                  <Ionicons name="git-commit-outline" size={16} color="#2563EB" />
                  <Text style={s.ganttTitle}>Visual Timeline Gantt</Text>
                </View>
                <View style={s.ganttLine}>
                  {milestones.map((m, idx) => {
                    const dotColor = m.status === 'achieved' ? '#10B981' : m.status === 'delayed' ? '#EF4444' : '#3B82F6';
                    const isLast = idx === milestones.length - 1;
                    return (
                      <View key={m._id} style={[s.ganttRow, isLast && { paddingBottom: 0 }]}>
                        <View style={[
                          s.ganttDot,
                          {
                            borderColor: dotColor,
                            backgroundColor: m.status === 'achieved' ? '#10B981' : m.status === 'delayed' ? '#EF4444' : '#FFFFFF',
                          }
                        ]} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.ganttName} numberOfLines={1}>{m.name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                            <Ionicons name="calendar-outline" size={11} color="#64748B" />
                            <Text style={s.ganttDate}>{formatDate(m.dueDate)}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Empty State */}
            {milestones.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIconCircle}>
                  <Ionicons name="flag-outline" size={36} color="#94A3B8" />
                </View>
                <Text style={s.emptyTitle}>No milestones yet</Text>
                <Text style={s.emptySub}>Set critical project milestones to track completion and trace delays.</Text>
                <TouchableOpacity style={s.emptyAddBtn} onPress={openCreate} activeOpacity={0.85}>
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={s.emptyAddBtnText}>Add Milestone</Text>
                </TouchableOpacity>
              </View>
            ) : (
              milestones.map((m) => {
                const meta = STATUS_META[m.status] || STATUS_META.planned;
                const linkedTasks = m.linkedTasks || [];
                const completedCount = linkedTasks.filter((t) => t.status === 'completed').length;
                const progressPct = m.progress !== undefined
                  ? m.progress
                  : linkedTasks.length > 0
                  ? Math.round((completedCount / linkedTasks.length) * 100)
                  : m.status === 'achieved' ? 100 : 0;

                return (
                  <View key={m._id} style={s.msCard}>
                    {/* Top Row: Icon, Name, Date, Delete */}
                    <View style={s.msTopRow}>
                      <View style={s.msIconBox}>
                        <Ionicons name="flag" size={15} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.msName}>{m.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <Ionicons name="calendar-outline" size={12} color="#2563EB" />
                          <Text style={s.msDate}>Target: {formatDate(m.dueDate)}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => confirmDelete(m)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={s.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Linked Tasks Section (Progress Bar + Task Badges) */}
                    {linkedTasks.length > 0 && (
                      <View style={s.linkedTasksBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={s.linkedTasksLabel}>
                            LINKED TASKS ({completedCount}/{linkedTasks.length})
                          </Text>
                          <Text style={s.linkedTasksPct}>{progressPct}%</Text>
                        </View>

                        <View style={s.progressTrack}>
                          <View
                            style={[
                              s.progressFill,
                              {
                                width: `${progressPct}%`,
                                backgroundColor: m.status === 'achieved' || progressPct === 100 ? '#10B981' : '#2563EB',
                              },
                            ]}
                          />
                        </View>

                        <View style={{ gap: 5, marginTop: 2 }}>
                          {linkedTasks.map((task, idx) => {
                            const taskObj = typeof task === 'object' ? task : tasks.find((t) => t._id === task) || { name: 'Task', status: 'pending' };
                            const statusLower = (taskObj.status || '').toLowerCase();
                            const isCompleted = statusLower === 'completed';
                            const isInProgress = statusLower === 'in_progress';

                            return (
                              <View key={taskObj._id || idx} style={[s.linkedTaskRow, isCompleted && s.linkedTaskRowDone]}>
                                <Text
                                  style={[s.linkedTaskName, isCompleted && s.linkedTaskNameDone]}
                                  numberOfLines={1}
                                >
                                  {taskObj.name}
                                </Text>
                                <View
                                  style={[
                                    s.taskStatusTag,
                                    isCompleted ? s.taskStatusCompleted : isInProgress ? s.taskStatusProgress : s.taskStatusTodo,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      s.taskStatusTagText,
                                      isCompleted
                                        ? s.taskStatusCompletedText
                                        : isInProgress
                                        ? s.taskStatusProgressText
                                        : s.taskStatusTodoText,
                                    ]}
                                  >
                                    {(taskObj.status || 'pending').replace('_', ' ')}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Delays Box */}
                    {m.delays && m.delays.length > 0 && (
                      <View style={s.delayBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="time" size={13} color="#DC2626" />
                          <Text style={s.delayBoxTitle}>Delay Incident Logged</Text>
                        </View>
                        {m.delays.map((delay, i) => (
                          <View key={delay._id || i} style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                            <Ionicons name="alert-circle-outline" size={13} color="#F87171" style={{ marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={s.delayReason}>{delay.reason}</Text>
                              <Text style={s.delayImpact}>
                                Pushed by <Text style={{ color: '#DC2626', fontFamily: 'Inter-Bold' }}>+{delay.impactDays} days</Text> from {formatDate(delay.originalDate)}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Bottom Action Row: Status Badge, Mark Done, Log Delay */}
                    <View style={s.msBottomRow}>
                      <View style={[s.statusBadge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                        <Ionicons name={meta.icon} size={13} color={meta.color} />
                        <Text style={[s.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                      {m.status !== 'achieved' && (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity style={s.actionBtn} onPress={() => markDone(m)} activeOpacity={0.7}>
                            <Ionicons name="checkmark-done" size={13} color="#334155" />
                            <Text style={s.actionBtnText}>Mark Done</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => openDelay(m)} activeOpacity={0.7}>
                            <Ionicons name="time-outline" size={13} color="#DC2626" />
                            <Text style={[s.actionBtnText, { color: '#DC2626' }]}>Log Delay</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
            <View style={{ height: 90 }} />
          </ScrollView>
        )}

        {/* Floating Action Button */}
        <TouchableOpacity style={s.fab} onPress={openCreate} activeOpacity={0.9}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Create Milestone Modal */}
      <Modal visible={isCreateOpen} animationType="slide" transparent onRequestClose={() => setIsCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Add Key Project Milestone</Text>
                <Text style={s.modalSub}>Define a key delivery goal and connect linked tasks.</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCreateOpen(false)} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={s.label}>Milestone Name *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Mechanical Inspection Checkoff"
                placeholderTextColor="#94A3B8"
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
              />

              <Text style={s.label}>Target Due Date *</Text>
              <DateField value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} inputStyle={s.input} />

              <Text style={s.label}>Link Tasks (All must be completed to achieve milestone)</Text>
              {tasks.length === 0 ? (
                <Text style={s.noTasksText}>No tasks found in this project. Create some tasks first.</Text>
              ) : (
                <ScrollView style={s.taskListBox} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                  {tasks.map((task) => {
                    const checked = selectedTaskIds.includes(task._id);
                    const statusLower = (task.status || '').toLowerCase();
                    const isCompleted = statusLower === 'completed';
                    const isInProgress = statusLower === 'in_progress';
                    return (
                      <TouchableOpacity
                        key={task._id}
                        style={[s.taskCheckRow, checked && { backgroundColor: '#EFF6FF' }]}
                        onPress={() => toggleTask(task._id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={checked ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={checked ? '#2563EB' : '#94A3B8'}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[s.taskCheckName, isCompleted && s.linkedTaskNameDone]} numberOfLines={1}>
                            {task.name}
                          </Text>
                          <View
                            style={[
                              s.taskStatusTag,
                              isCompleted ? s.taskStatusCompleted : isInProgress ? s.taskStatusProgress : s.taskStatusTodo,
                            ]}
                          >
                            <Text
                              style={[
                                s.taskStatusTagText,
                                isCompleted
                                  ? s.taskStatusCompletedText
                                  : isInProgress
                                  ? s.taskStatusProgressText
                                  : s.taskStatusTodoText,
                              ]}
                            >
                              {(task.status || 'pending').replace('_', ' ')}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Action Buttons matching web: Cancel & Add */}
              <View style={s.modalBtnRow}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setIsCreateOpen(false)} activeOpacity={0.7}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.saveBtn, creating && { opacity: 0.7 }]}
                  onPress={handleCreate}
                  disabled={creating}
                  activeOpacity={0.85}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={s.saveBtnText}>Add Milestone</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Log Delay Modal */}
      <Modal visible={!!delayTarget} animationType="slide" transparent onRequestClose={() => setDelayTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            {delayTarget && (
              <>
                <View style={s.modalHeader}>
                  <View>
                    <Text style={s.modalTitle}>Log Timeline Delay Slip</Text>
                    <Text style={s.modalSub}>Record rationale and push target delivery date.</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDelayTarget(null)} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                  <View style={s.delayHighlight}>
                    <Text style={s.delayHighlightLabel}>SELECTED MILESTONE</Text>
                    <Text style={s.delayHighlightName}>{delayTarget.name}</Text>
                    <Text style={s.delayHighlightDate}>Original target date: {formatDate(delayTarget.dueDate)}</Text>
                  </View>

                  <Text style={s.label}>Delay Slip Reason *</Text>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. Subcontractor workforce shortage"
                    placeholderTextColor="#94A3B8"
                    value={delayForm.reason}
                    onChangeText={(v) => setDelayForm({ ...delayForm, reason: v })}
                  />

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Impact Days *</Text>
                      <TextInput
                        style={s.input}
                        keyboardType="numeric"
                        value={delayForm.impactDays}
                        onChangeText={handleImpactDaysChange}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>New Target Date *</Text>
                      <DateField
                        value={delayForm.newDate}
                        onChange={(v) => setDelayForm({ ...delayForm, newDate: v })}
                        inputStyle={s.input}
                      />
                    </View>
                  </View>

                  {/* Action Buttons matching web: Cancel & Log Delay Slip */}
                  <View style={s.modalBtnRow}>
                    <TouchableOpacity style={s.cancelBtn} onPress={() => setDelayTarget(null)} activeOpacity={0.7}>
                      <Text style={s.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.saveBtn, s.saveBtnDanger, loggingDelay && { opacity: 0.7 }]}
                      onPress={handleLogDelay}
                      disabled={loggingDelay}
                      activeOpacity={0.85}
                    >
                      {loggingDelay ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={s.saveBtnText}>Log Delay Slip</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  headerAddText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  empty: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 20, gap: 10 },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', maxWidth: 260 },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyAddBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  msCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 10 },
  msTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  msIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  msName: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  msDate: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B' },
  deleteBtn: { padding: 4, borderRadius: 8 },

  linkedTasksBox: { borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10, gap: 6 },
  linkedTasksLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3 },
  linkedTasksPct: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#2563EB' },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 3 },
  linkedTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  linkedTaskRowDone: { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' },
  linkedTaskName: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#0F172A', flex: 1 },
  linkedTaskNameDone: { color: '#94A3B8', textDecorationLine: 'line-through', fontFamily: 'Inter-Regular' },

  taskStatusTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start' },
  taskStatusTagText: { fontSize: 9, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
  taskStatusCompleted: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  taskStatusCompletedText: { color: '#16A34A' },
  taskStatusProgress: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  taskStatusProgressText: { color: '#D97706' },
  taskStatusTodo: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  taskStatusTodoText: { color: '#64748B' },

  delayBox: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FEE2E2' },
  delayBoxTitle: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#0F172A' },
  delayReason: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  delayImpact: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },

  msBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusBadgeText: { fontSize: 10.5, fontFamily: 'Inter-Bold' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  actionBtnDanger: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  actionBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#334155' },

  ganttCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  ganttHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  ganttTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  ganttLine: { borderLeftWidth: 2, borderLeftColor: '#E2E8F0', marginLeft: 8, gap: 14, paddingLeft: 14 },
  ganttRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ganttDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginLeft: -19, marginTop: 3 },
  ganttName: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  ganttDate: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#64748B' },

  fab: {
    position: 'absolute', right: 20, bottom: 24,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },
  closeBtn: { padding: 4, borderRadius: 8 },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  noTasksText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', fontStyle: 'italic', padding: 12, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 10 },
  taskListBox: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, maxHeight: 180, backgroundColor: '#FFFFFF' },
  taskCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  taskCheckName: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#0F172A' },

  modalBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDanger: { backgroundColor: '#DC2626' },
  saveBtnText: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  delayHighlight: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', borderRadius: 12, padding: 12, marginBottom: 4 },
  delayHighlightLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#EF4444', letterSpacing: 0.3 },
  delayHighlightName: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#B91C1C', marginTop: 2 },
  delayHighlightDate: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#DC2626', marginTop: 2 },
});


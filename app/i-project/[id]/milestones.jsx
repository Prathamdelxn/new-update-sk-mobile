import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const STATUS_META = {
  planned: { label: 'Planned', color: '#2563EB', bg: '#EFF6FF', icon: 'calendar-outline' },
  achieved: { label: 'Achieved', color: '#16A34A', bg: '#F0FDF4', icon: 'checkmark-circle-outline' },
  delayed: { label: 'Delayed Slip', color: '#DC2626', bg: '#FEF2F2', icon: 'alert-circle-outline' },
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

const emptyForm = { name: '', dueDate: '' };
const emptyDelayForm = { reason: '', impactDays: '7', newDate: '' };

export default function InteriorMilestonesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  const [delayTarget, setDelayTarget] = useState(null);
  const [loggingDelay, setLoggingDelay] = useState(false);
  const [delayForm, setDelayForm] = useState(emptyDelayForm);

  const load = useCallback(async () => {
    setLoading(true);
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
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openCreate = () => {
    setForm(emptyForm);
    setSelectedTaskIds([]);
    setIsCreateOpen(true);
  };

  const toggleTask = (taskId) => {
    setSelectedTaskIds((prev) => (prev.includes(taskId) ? prev.filter((t) => t !== taskId) : [...prev, taskId]));
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.dueDate.trim()) {
      showToast('Milestone name and due date are required', 'error');
      return;
    }
    setCreating(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/milestones`, {
        name: form.name,
        dueDate: form.dueDate,
        linkedTasks: selectedTaskIds,
      });
      showToast('Milestone created successfully!', 'success');
      setIsCreateOpen(false);
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
    } catch (e) {
      showToast('Failed to update milestone', 'error');
      load();
    }
  };

  const openDelay = (milestone) => {
    const suggested = new Date(milestone.dueDate);
    suggested.setDate(suggested.getDate() + 7);
    setDelayForm({ reason: '', impactDays: '7', newDate: suggested.toISOString().split('T')[0] });
    setDelayTarget(milestone);
  };

  const handleLogDelay = async () => {
    if (!delayForm.reason.trim() || !delayForm.newDate.trim()) {
      showToast('Reason and new target date are required', 'error');
      return;
    }
    setLoggingDelay(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/milestones/${delayTarget._id}/delays`, {
        reason: delayForm.reason,
        impactDays: parseInt(delayForm.impactDays, 10) || 1,
        originalDate: delayTarget.dueDate,
        newDate: delayForm.newDate,
      });
      showToast('Delay slip logged', 'success');
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
      'Are you sure? Any delay logs associated with it will be permanently deleted.',
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
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Milestones & Key Targets</Text>
            <Text style={s.headerSub}>Log milestone delays and trace timeline slips.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {milestones.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="flag-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No milestones yet</Text>
              </View>
            ) : (
              milestones.map((m) => {
                const meta = STATUS_META[m.status] || STATUS_META.planned;
                const linkedTasks = m.linkedTasks || [];
                const completedCount = linkedTasks.filter((t) => t.status === 'completed').length;
                return (
                  <View key={m._id} style={s.msCard}>
                    <View style={s.msTopRow}>
                      <View style={s.msIconBox}>
                        <Ionicons name="flag-outline" size={16} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.msName}>{m.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <Ionicons name="calendar-outline" size={12} color="#2563EB" />
                          <Text style={s.msDate}>Target: {formatDate(m.dueDate)}</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => confirmDelete(m)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {linkedTasks.length > 0 && (
                      <View style={s.linkedTasksBox}>
                        <Text style={s.linkedTasksLabel}>LINKED TASKS ({completedCount}/{linkedTasks.length})</Text>
                        {linkedTasks.map((task) => (
                          <View key={task._id} style={s.linkedTaskRow}>
                            <Text style={[s.linkedTaskName, task.status === 'completed' && s.linkedTaskNameDone]} numberOfLines={1}>
                              {task.name}
                            </Text>
                            <Text style={s.linkedTaskStatus}>{task.status.replace('_', ' ')}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {m.delays && m.delays.length > 0 && (
                      <View style={s.delayBox}>
                        <Text style={s.delayBoxTitle}>Delay Incident Logged</Text>
                        {m.delays.map((delay, i) => (
                          <View key={delay._id || i} style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                            <Ionicons name="time-outline" size={13} color="#F87171" style={{ marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={s.delayReason}>{delay.reason}</Text>
                              <Text style={s.delayImpact}>Pushed by +{delay.impactDays} days from {formatDate(delay.originalDate)}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={s.msBottomRow}>
                      <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
                        <Ionicons name={meta.icon} size={12} color={meta.color} />
                        <Text style={[s.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                      {m.status !== 'achieved' && (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {linkedTasks.length === 0 && (
                            <TouchableOpacity style={s.actionBtn} onPress={() => markDone(m)}>
                              <Text style={s.actionBtnText}>Mark Done</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => openDelay(m)}>
                            <Text style={[s.actionBtnText, { color: '#DC2626' }]}>Log Delay</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        <TouchableOpacity style={s.fab} onPress={openCreate}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Create Milestone Modal */}
      <Modal visible={isCreateOpen} animationType="slide" transparent onRequestClose={() => setIsCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Key Project Milestone</Text>
              <TouchableOpacity onPress={() => setIsCreateOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Milestone Name *</Text>
              <TextInput style={s.input} placeholder="e.g. Mechanical Inspection Checkoff" placeholderTextColor="#94A3B8" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />

              <Text style={s.label}>Target Due Date *</Text>
              <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={form.dueDate} onChangeText={(v) => setForm({ ...form, dueDate: v })} />

              <Text style={s.label}>Link Tasks (all must be completed to achieve milestone)</Text>
              {tasks.length === 0 ? (
                <Text style={s.noTasksText}>No tasks found in this project. Create some tasks first.</Text>
              ) : (
                <View style={s.taskListBox}>
                  {tasks.map((task) => {
                    const checked = selectedTaskIds.includes(task._id);
                    return (
                      <TouchableOpacity key={task._id} style={s.taskCheckRow} onPress={() => toggleTask(task._id)}>
                        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={18} color={checked ? '#2563EB' : '#CBD5E1'} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.taskCheckName} numberOfLines={1}>{task.name}</Text>
                          <Text style={s.taskCheckStatus}>{task.status.replace('_', ' ')}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity style={[s.saveBtn, creating && { opacity: 0.7 }]} onPress={handleCreate} disabled={creating}>
                {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Add Milestone</Text>}
              </TouchableOpacity>
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
                  <Text style={s.modalTitle}>Log Timeline Delay Slip</Text>
                  <TouchableOpacity onPress={() => setDelayTarget(null)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={s.delayHighlight}>
                    <Text style={s.delayHighlightLabel}>SELECTED MILESTONE</Text>
                    <Text style={s.delayHighlightName}>{delayTarget.name}</Text>
                    <Text style={s.delayHighlightDate}>Original target date: {formatDate(delayTarget.dueDate)}</Text>
                  </View>

                  <Text style={s.label}>Delay Slip Reason *</Text>
                  <TextInput style={s.input} placeholder="e.g. Subcontractor workforce shortage" placeholderTextColor="#94A3B8" value={delayForm.reason} onChangeText={(v) => setDelayForm({ ...delayForm, reason: v })} />

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Impact Days *</Text>
                      <TextInput style={s.input} keyboardType="numeric" value={delayForm.impactDays} onChangeText={(v) => setDelayForm({ ...delayForm, impactDays: v })} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>New Target Date *</Text>
                      <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={delayForm.newDate} onChangeText={(v) => setDelayForm({ ...delayForm, newDate: v })} />
                    </View>
                  </View>

                  <TouchableOpacity style={[s.saveBtn, s.saveBtnDanger, loggingDelay && { opacity: 0.7 }]} onPress={handleLogDelay} disabled={loggingDelay}>
                    {loggingDelay ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Log Delay Slip</Text>}
                  </TouchableOpacity>
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
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },

  msCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 10 },
  msTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  msIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  msName: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  msDate: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B' },

  linkedTasksBox: { borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10, gap: 6 },
  linkedTasksLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3 },
  linkedTaskRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, gap: 8 },
  linkedTaskName: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#0F172A', flex: 1 },
  linkedTaskNameDone: { color: '#94A3B8', textDecorationLine: 'line-through' },
  linkedTaskStatus: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase' },

  delayBox: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10 },
  delayBoxTitle: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#0F172A' },
  delayReason: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  delayImpact: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  msBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 10.5, fontFamily: 'Inter-Bold' },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  actionBtnDanger: { borderColor: '#FECACA' },
  actionBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#334155' },

  fab: {
    position: 'absolute', right: 20, bottom: 30,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  noTasksText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', fontStyle: 'italic', padding: 12, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 10 },
  taskListBox: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, maxHeight: 180, overflow: 'hidden' },
  taskCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  taskCheckName: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#0F172A' },
  taskCheckStatus: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', marginTop: 1 },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnDanger: { backgroundColor: '#DC2626' },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  delayHighlight: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', borderRadius: 12, padding: 12, marginBottom: 6 },
  delayHighlightLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#EF4444', letterSpacing: 0.3 },
  delayHighlightName: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#B91C1C', marginTop: 2 },
  delayHighlightDate: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#DC2626', marginTop: 2 },
});

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const COLUMNS = [
  { id: 'backlog', title: 'Backlog', color: '#94A3B8' },
  { id: 'todo', title: 'Todo', color: '#3B82F6' },
  { id: 'in_progress', title: 'In Progress', color: '#F59E0B' },
  { id: 'in_review', title: 'In Review', color: '#818CF8' },
  { id: 'completed', title: 'Completed', color: '#10B981' },
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const PRIORITY_META = {
  low: { label: 'Low', color: '#64748B', bg: '#F1F5F9' },
  medium: { label: 'Medium', color: '#2563EB', bg: '#EFF6FF' },
  high: { label: 'High', color: '#D97706', bg: '#FFFBEB' },
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEF2F2' },
};

const emptyForm = { name: '', packageId: '', priority: 'medium', startDate: '', endDate: '', assigneeId: '', description: '' };

function extractPackages(node, out) {
  if (!node) return;
  if (node.type === 'package') out.push(node);
  ['floors', 'zones', 'areas', 'packages'].forEach((key) => {
    if (Array.isArray(node[key])) node[key].forEach((child) => extractPackages(child, out));
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

export default function InteriorTasksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState([]);
  const [wbsPackages, setWbsPackages] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeColumn, setActiveColumn] = useState('todo');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, wbsRes, memberRes] = await Promise.allSettled([
        interiorApiClient.get(`/projects/${projectId}/tasks`),
        interiorApiClient.get(`/projects/${projectId}/wbs`),
        interiorApiClient.get(`/projects/${projectId}/members`),
      ]);

      setTasks(taskRes.status === 'fulfilled' && taskRes.value?.success && taskRes.value.data ? taskRes.value.data : []);

      const packages = [];
      if (wbsRes.status === 'fulfilled' && wbsRes.value?.success && wbsRes.value.data) {
        wbsRes.value.data.forEach((node) => extractPackages(node, packages));
      }
      setWbsPackages(packages);

      setMembers(memberRes.status === 'fulfilled' && memberRes.value?.success ? memberRes.value.data || [] : []);
    } catch (e) {
      console.warn('Error fetching tasks data', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const handleCreateTask = async () => {
    if (!form.name.trim() || !form.packageId) {
      showToast('Task name and WBS package are required', 'error');
      return;
    }
    setCreating(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/tasks`, {
        name: form.name,
        packageId: form.packageId,
        priority: form.priority,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        assignees: form.assigneeId ? [form.assigneeId] : [],
        description: form.description,
      });
      showToast('Task created successfully!', 'success');
      setIsCreateOpen(false);
      setForm(emptyForm);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to create task', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openTask = async (task) => {
    setSelectedTask(task);
    setComments([]);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/tasks/${task._id}/comments`);
      setComments(res?.success && res?.data ? res.data : []);
    } catch (e) {
      setComments([]);
    }
  };

  const updateStatus = async (task, status) => {
    setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, status, progress: status === 'completed' ? 100 : t.progress } : t)));
    setSelectedTask((prev) => (prev && prev._id === task._id ? { ...prev, status, progress: status === 'completed' ? 100 : prev.progress } : prev));
    try {
      await interiorApiClient.put(`/projects/${projectId}/tasks/${task._id}`, { status });
    } catch (e) {
      showToast('Failed to update status', 'error');
      fetchData();
    }
  };

  const deleteTask = async (task) => {
    try {
      await interiorApiClient.delete(`/projects/${projectId}/tasks/${task._id}`);
      showToast('Task deleted', 'delete');
      setSelectedTask(null);
      fetchData();
    } catch (e) {
      showToast(e.message || 'Failed to delete task', 'error');
    }
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

  const colTasks = tasks.filter((t) => t.status === activeColumn);

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Task Kanban Board</Text>
            <Text style={s.headerSub}>Track installation progress by WBS packages</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.columnTabs}>
          {COLUMNS.map((col) => {
            const count = tasks.filter((t) => t.status === col.id).length;
            const active = activeColumn === col.id;
            return (
              <TouchableOpacity key={col.id} style={[s.colTab, active && { borderColor: col.color, backgroundColor: col.color + '14' }]} onPress={() => setActiveColumn(col.id)}>
                <View style={[s.colDot, { backgroundColor: col.color }]} />
                <Text style={[s.colTabText, active && { color: col.color }]}>{col.title}</Text>
                <View style={s.colCountBadge}>
                  <Text style={s.colCountText}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {colTasks.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="checkbox-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No tasks in this column</Text>
              </View>
            ) : (
              colTasks.map((task) => {
                const priority = PRIORITY_META[task.priority] || PRIORITY_META.medium;
                const assignee = task.assignees?.[0];
                return (
                  <TouchableOpacity key={task._id} style={s.taskCard} onPress={() => openTask(task)}>
                    <View style={s.taskTopRow}>
                      <View style={[s.priorityBadge, { backgroundColor: priority.bg }]}>
                        <Text style={[s.priorityBadgeText, { color: priority.color }]}>{priority.label}</Text>
                      </View>
                      {!!task.packageId?.trade && <Text style={s.tradeTag}>#{task.packageId.trade}</Text>}
                    </View>
                    <Text style={s.taskName} numberOfLines={2}>{task.name}</Text>
                    <View style={s.taskBottomRow}>
                      <View style={s.taskMetaItem}>
                        <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
                        <Text style={s.taskMetaText}>{formatDate(task.endDate) || 'Dates unset'}</Text>
                      </View>
                      {assignee ? (
                        <View style={s.assigneeAvatar}>
                          <Text style={s.assigneeAvatarText}>{assignee.firstName?.[0] || '?'}</Text>
                        </View>
                      ) : (
                        <Ionicons name="person-outline" size={14} color="#CBD5E1" />
                      )}
                    </View>
                  </TouchableOpacity>
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

      {/* Create Task Modal */}
      <Modal visible={isCreateOpen} animationType="slide" transparent onRequestClose={() => setIsCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Task to Package</Text>
              <TouchableOpacity onPress={() => setIsCreateOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>WBS Target Package *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                {wbsPackages.map((pkg) => {
                  const pkgId = pkg.id || pkg._id;
                  return (
                    <TouchableOpacity key={pkgId} style={[s.chip, form.packageId === pkgId && s.chipActive]} onPress={() => setForm({ ...form, packageId: pkgId })}>
                      <Text style={[s.chipText, form.packageId === pkgId && s.chipTextActive]}>{pkg.name} ({pkg.trade})</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={s.label}>Task Name *</Text>
              <TextInput style={s.input} placeholder="e.g. Core Conduit Fixing" placeholderTextColor="#94A3B8" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />

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

              <Text style={s.label}>Description</Text>
              <TextInput style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Specify task instructions..." placeholderTextColor="#94A3B8" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline />

              <TouchableOpacity style={[s.saveBtn, creating && { opacity: 0.7 }]} onPress={handleCreateTask} disabled={creating}>
                {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Add Task</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Task Detail Modal */}
      <Modal visible={!!selectedTask} animationType="slide" transparent onRequestClose={() => setSelectedTask(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '90%' }]}>
            {selectedTask && (
              <>
                <View style={s.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalTitle} numberOfLines={1}>{selectedTask.name}</Text>
                    {!!selectedTask.packageId && (
                      <Text style={s.headerSub}>{selectedTask.packageId.name} ({selectedTask.packageId.trade})</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => deleteTask(selectedTask)} style={{ marginRight: 14 }}>
                    <Ionicons name="trash-outline" size={19} color="#EF4444" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSelectedTask(null)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={s.label}>Task Status</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    {['todo', 'in_progress', 'completed'].map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[s.statusOption, selectedTask.status === st && s.statusOptionActive]}
                        onPress={() => updateStatus(selectedTask, st)}
                      >
                        <Text style={[s.statusOptionText, selectedTask.status === st && s.statusOptionTextActive]}>{st.replace('_', ' ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

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
                      <Text style={s.detailDates}>
                        {formatDate(selectedTask.startDate) || 'Start unset'} — {formatDate(selectedTask.endDate) || 'End unset'}
                      </Text>
                    </View>
                  </View>

                  <Text style={s.label}>Description</Text>
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
                    <TextInput
                      style={s.commentInput}
                      placeholder="Ask for updates or post observations..."
                      placeholderTextColor="#94A3B8"
                      value={newComment}
                      onChangeText={setNewComment}
                    />
                    <TouchableOpacity style={s.postBtn} onPress={postComment} disabled={postingComment}>
                      {postingComment ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={16} color="#FFFFFF" />}
                    </TouchableOpacity>
                  </View>
                  <View style={{ height: 20 }} />
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
  scroll: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  columnTabs: { gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  colTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC' },
  colDot: { width: 7, height: 7, borderRadius: 4 },
  colTabText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B' },
  colCountBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  colCountText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#64748B' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },

  taskCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 10 },
  taskTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
  tradeTag: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  taskName: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A', lineHeight: 18 },
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
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  chipTextActive: { color: '#2563EB' },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  statusOption: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  statusOptionActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  statusOptionText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B', textTransform: 'capitalize' },
  statusOptionTextActive: { color: '#FFFFFF' },

  detailCard: { borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 14, padding: 14, marginBottom: 6 },
  detailRow: { flexDirection: 'row' },
  detailLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase' },
  detailValue: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2, textTransform: 'capitalize' },
  detailDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  detailDates: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B' },

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
});

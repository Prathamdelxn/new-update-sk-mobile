// Sub-items (task.subtasks) under an activity in the WBS hierarchy — same feature
// as the web's WbsSubItems: see who owns each step, tick it off, add new ones.
// Saves the list (and the activity's progress %) through the normal task update,
// exactly like the web, so a tick on the phone shows on the web and vice versa.
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import interiorApiClient from '../../../services/interiorApiClient';
import { useToast } from '../../../context/ToastContext';
import { tr } from '../../../utils/i18n/tr';

const isDone = (s) => !!(s?.completed ?? s?.isCompleted);
const idOf = (v) => (v && typeof v === 'object' ? v._id || v.id : v);

export default function WbsSubItems({ projectId, task, members = [], canEdit, onUpdated }) {
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const [open, setOpen] = useState(subtasks.length > 0);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(null); // subtask key / 'new'
  const { showToast } = useToast();

  if (!subtasks.length && !canEdit) return null;

  const doneCount = subtasks.filter(isDone).length;
  const whoName = (s) => {
    const a = s?.assignedTo;
    if (!a) return null;
    if (typeof a === 'object') return `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || null;
    return members.find((m) => String(m.id) === String(a))?.name || null;
  };

  const save = async (list, key) => {
    setSaving(key);
    const progress = list.length ? Math.round((list.filter(isDone).length / list.length) * 100) : task.progress || 0;
    // keep ids / owners / due dates, send plain values (same payload as the web)
    const payload = list.map((s) => ({
      ...(s._id ? { _id: s._id } : {}),
      title: s.title,
      completed: isDone(s),
      ...(s.dueDate ? { dueDate: new Date(s.dueDate).toISOString() } : {}),
      ...(s.assignedTo ? { assignedTo: idOf(s.assignedTo) } : {}),
    }));
    try {
      const res = await interiorApiClient.put(`/projects/${projectId}/tasks/${task._id || task.id}`, { subtasks: payload, progress });
      const updated = res?.success && res?.data ? { ...task, ...res.data } : { ...task, subtasks: list, progress };
      onUpdated?.(updated);
      return true;
    } catch (e) {
      showToast(e?.message || tr('Failed to update activity'), 'error');
      return false;
    } finally {
      setSaving(null);
    }
  };

  const toggle = (i) => {
    if (!canEdit || saving) return;
    save(subtasks.map((x, j) => (j === i ? { ...x, completed: !isDone(x) } : x)), String(subtasks[i]._id || i));
  };

  const addItem = async () => {
    const t = title.trim();
    if (!t || saving) return;
    if (await save([...subtasks, { title: t, completed: false }], 'new')) setTitle('');
  };

  return (
    <View style={st.wrap}>
      <TouchableOpacity onPress={() => setOpen((v) => !v)} style={st.header} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6 }}>
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={13} color="#64748B" />
        <Text style={st.headerText}>{tr('Sub-items')}</Text>
        <View style={st.countPill}>
          <Text style={st.countText}>{doneCount}/{subtasks.length}</Text>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={st.list}>
          {subtasks.map((s, i) => {
            const done = isDone(s);
            const key = String(s._id || i);
            const who = whoName(s);
            return (
              <View key={key} style={st.row}>
                <TouchableOpacity onPress={() => toggle(i)} disabled={!canEdit || !!saving} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  {saving === key ? (
                    <ActivityIndicator size="small" color="#94A3B8" style={{ width: 18 }} />
                  ) : (
                    <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={done ? '#059669' : '#CBD5E1'} />
                  )}
                </TouchableOpacity>
                <Text style={[st.title, done && st.titleDone]} numberOfLines={2}>{tr(s.title)}</Text>
                {who && (
                  <View style={st.who}>
                    <Ionicons name="person-outline" size={11} color="#64748B" />
                    <Text style={st.whoText} numberOfLines={1}>{tr(who)}</Text>
                  </View>
                )}
              </View>
            );
          })}

          {canEdit && (
            <View style={st.addRow}>
              <Ionicons name="add" size={18} color="#CBD5E1" />
              <TextInput
                value={title}
                onChangeText={setTitle}
                onSubmitEditing={addItem}
                returnKeyType="done"
                placeholder={tr('Add sub-item…')}
                placeholderTextColor="#94A3B8"
                style={st.input}
              />
              {!!title.trim() && (
                <TouchableOpacity onPress={addItem} disabled={saving === 'new'} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  {saving === 'new' ? <ActivityIndicator size="small" color="#2563EB" /> : <Text style={st.addText}>{tr('Add')}</Text>}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  // indented to line up with the activity title (after its tick circle)
  wrap: { paddingStart: 30, paddingBottom: 12, marginTop: -4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 2 },
  headerText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  countPill: { marginStart: 4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: '#F1F5F9' },
  countText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#475569' },
  list: { marginTop: 6, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, minWidth: 0, fontSize: 12.5, fontFamily: 'Inter-Medium', color: '#334155' },
  titleDone: { color: '#94A3B8', textDecorationLine: 'line-through' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: 110 },
  whoText: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#64748B' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  input: { flex: 1, minWidth: 0, fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#334155', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  addText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#2563EB' },
});

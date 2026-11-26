import { tr } from '../../utils/i18n/tr';
import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import interiorApiClient from '../../services/interiorApiClient';
import { useProjectPermissions } from '../../utils/interior/useProjectPermissions';
import { memberRoleLabel } from '../../utils/interior/memberRoleLabel';
import SkeletonList from '../../components/common/SkeletonList';

// RFIs — ask a specific person, or (if you're not sure who) let the project manager route it.

// Reusable calendar date picker field (replaces free-text YYYY-MM-DD inputs).
function DateField({ value, onChange, placeholder = 'Select date', inputStyle }) {
  const [showIosPicker, setShowIosPicker] = useState(false);

  const open = () => {
    const base = value ? new Date(value) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        onChange: (event, d) => {
          if (event.type === 'set' && d) onChange(d.toISOString().split('T')[0]);
        },
      });
    } else {
      setShowIosPicker(true);
    }
  };

  return (
    <>
      <TouchableOpacity style={[inputStyle, dfStyles.row]} onPress={open}>
        <Text style={[dfStyles.text, !value && dfStyles.placeholder]} numberOfLines={1}>
          {value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : tr(placeholder)}
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
            if (d) onChange(d.toISOString().split('T')[0]);
          }}
        />
      )}
    </>
  );
}

const dfStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#0F172A', flex: 1, marginRight: 8 },
  placeholder: { color: '#94A3B8' },
});

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const PRIORITY_META = {
  low: { color: '#2563EB', bg: '#EFF6FF' },
  medium: { color: '#2563EB', bg: '#EFF6FF' },
  high: { color: '#D97706', bg: '#FFFBEB' },
  critical: { color: '#DC2626', bg: '#FEF2F2' },
};
const STATUS_META = {
  open: { color: '#475569', bg: '#F8FAFC' },
  responded: { color: '#2563EB', bg: '#EFF6FF' },
  closed: { color: '#16A34A', bg: '#F0FDF4' },
};

/** What the question is about → which project roles usually answer it (same as web). */
const TOPICS = [
  { value: 'design', label: 'Design & drawings', roles: ['designer'] },
  { value: 'mep', label: 'MEP & services', roles: ['site_engineer', 'project_manager'] },
  { value: 'site', label: 'Site & structure', roles: ['site_engineer'] },
  { value: 'materials', label: 'Materials & specifications', roles: ['designer', 'quantity_surveyor'] },
  { value: 'cost', label: 'Cost & quantities', roles: ['quantity_surveyor'] },
  { value: 'client', label: 'Client decision', roles: ['client_representative'] },
  { value: 'other', label: 'Other', roles: ['project_manager'] },
];
const topicLabel = (v) => TOPICS.find((t) => t.value === v)?.label;

const FILTERS = [
  ['all', 'All'],
  ['mine', 'Assigned to me'],
  ['raised', 'Raised by me'],
  ['unassigned', 'Needs an owner'],
];

const idOf = (v) => (v && typeof v === 'object' ? String(v._id ?? v.id ?? '') : v ? String(v) : '');
const personName = (u) => (!u || typeof u !== 'object' ? '' : `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '');

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const emptyForm = { subject: '', question: '', priority: 'medium', dueDate: '', topic: '', mode: 'person', assignee: '' };

// Tappable member list (single select)
function MemberPicker({ members, value, onChange, me, exclude }) {
  const list = members.filter((m) => m.id !== exclude);
  if (list.length === 0) return <Text style={s.hint}>{tr("No project members found")}</Text>;
  return (
    <View style={s.memberList}>
      {list.map((m) => {
        const on = value === m.id;
        return (
          <TouchableOpacity key={m.id} style={[s.memberRow, on && s.memberRowOn]} onPress={() => onChange(on ? '' : m.id)} activeOpacity={0.7}>
            <View style={[s.avatar, on && { backgroundColor: '#2563EB' }]}>
              <Text style={[s.avatarText, on && { color: '#FFFFFF' }]}>{(m.name || '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.memberName} numberOfLines={1}>{m.name}{m.id === me ? ` (${tr('you')})` : ''}</Text>
              <Text style={s.memberRole} numberOfLines={1}>{tr(m.role)}</Text>
            </View>
            <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? '#2563EB' : '#CBD5E1'} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function InteriorRfisScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId, rfi: rfiParam } = useLocalSearchParams();
  const deepLinked = useRef(false); // opened from a notification: show that RFI once
  const { showToast } = useToast();
  const { user } = useAuth();
  const me = idOf(user);
  const { can: canDo } = useProjectPermissions(projectId);

  const [rfis, setRfis] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [selectedRfi, setSelectedRfi] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [posting, setPosting] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const [assignNote, setAssignNote] = useState('');

  const membersLoaded = useRef(false);
  const visitedOnce = useRef(false);

  const fetchRfis = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const needMembers = !membersLoaded.current;
      const [res, memRes] = await Promise.all([
        interiorApiClient.get(`/projects/${projectId}/rfis`),
        needMembers ? interiorApiClient.get(`/projects/${projectId}/members`).catch(() => null) : Promise.resolve(null),
      ]);
      const list = res?.success && res?.data ? res.data : [];
      setRfis(list);
      setSelectedRfi((cur) => (cur ? list.find((r) => r._id === cur._id) || null : cur));
      if (rfiParam && !deepLinked.current) {
        const hit = list.find((r) => String(r._id) === String(rfiParam));
        if (hit) { deepLinked.current = true; setSelectedRfi(hit); }
      }
      if (needMembers && memRes) {
        const raw = memRes?.data || [];
        const mapped = raw
          .map((m) => ({
            id: String(m.userId?._id || m.userId?.id || m.userId || ''),
            name: m.userId?.firstName ? `${m.userId.firstName} ${m.userId.lastName || ''}`.trim() : m.userId?.email || 'Member',
            role: memberRoleLabel(m),
            projectRole: m.projectRole || '',
          }))
          .filter((m) => m.id);
        setMembers(Array.from(new Map(mapped.map((m) => [m.id, m])).values()));
        membersLoaded.current = true;
      }
    } catch (e) {
      console.error('Failed to load RFIs', e);
      showToast(tr("Failed to fetch RFIs registry"), 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchRfis(visitedOnce.current); visitedOnce.current = true; }, [fetchRfis]));

  const counts = useMemo(() => ({
    all: rfis.length,
    mine: rfis.filter((r) => r.status !== 'closed' && idOf(r.assignedTo) === me).length,
    raised: rfis.filter((r) => idOf(r.raisedBy) === me).length,
    unassigned: rfis.filter((r) => r.status !== 'closed' && !r.assignedTo).length,
  }), [rfis, me]);

  const visible = useMemo(() => {
    if (filter === 'mine') return rfis.filter((r) => r.status !== 'closed' && idOf(r.assignedTo) === me);
    if (filter === 'raised') return rfis.filter((r) => idOf(r.raisedBy) === me);
    if (filter === 'unassigned') return rfis.filter((r) => r.status !== 'closed' && !r.assignedTo);
    return rfis;
  }, [rfis, filter, me]);

  const suggestions = useMemo(() => {
    const t = TOPICS.find((x) => x.value === form.topic);
    return t ? members.filter((m) => t.roles.includes(m.projectRole) && m.id !== me) : [];
  }, [form.topic, members, me]);

  const projectManagers = useMemo(() => members.filter((m) => m.projectRole === 'project_manager' && m.id !== me), [members, me]);

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.question.trim()) {
      showToast(tr("Please fill in subject and question"), 'error');
      return;
    }
    if (form.mode === 'person' && !form.assignee) {
      showToast(tr("Choose who should answer, or pick \"Not sure who to ask\"."), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await interiorApiClient.post(`/projects/${projectId}/rfis`, {
        subject: form.subject,
        question: form.question,
        priority: form.priority,
        topic: form.topic || undefined,
        assignedTo: form.mode === 'person' ? form.assignee : undefined,
        dueDate: form.dueDate || undefined,
      });
      showToast(tr(res?.message || 'RFI raised successfully!'), 'success');
      setIsModalOpen(false);
      setForm(emptyForm);
      fetchRfis(true);
    } catch (e) {
      showToast(e?.response?.data?.message || e.message || tr("Failed to submit RFI"), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const assign = async () => {
    if (!assignTo || !selectedRfi) return;
    setPosting(true);
    try {
      const res = await interiorApiClient.put(`/projects/${projectId}/rfis`, {
        rfiId: selectedRfi._id, action: 'assign', assignedTo: assignTo, note: assignNote.trim() || undefined,
      });
      showToast(tr(res?.message || 'RFI assigned'), 'success');
      setAssignOpen(false);
      setAssignTo('');
      setAssignNote('');
      fetchRfis(true);
    } catch (e) {
      showToast(e?.response?.data?.message || e.message || tr("Failed to assign RFI"), 'error');
    } finally {
      setPosting(false);
    }
  };

  const postResponse = async () => {
    if (!responseText.trim() || !selectedRfi) return;
    setPosting(true);
    try {
      await interiorApiClient.put(`/projects/${projectId}/rfis`, { rfiId: selectedRfi._id, response: responseText });
      showToast(tr("Response posted successfully!"), 'success');
      setResponseText('');
      fetchRfis(true);
    } catch (e) {
      showToast(e.message || tr("Failed to post response"), 'error');
    } finally {
      setPosting(false);
    }
  };

  const closeRfi = async (rfi) => {
    try {
      await interiorApiClient.put(`/projects/${projectId}/rfis`, { rfiId: rfi._id, status: 'closed' });
      showToast(tr("RFI closed and verified"), 'success');
      setSelectedRfi(null);
      fetchRfis(true);
    } catch (e) {
      showToast(e.message || tr("Failed to close RFI"), 'error');
    }
  };

  const deleteRfi = (rfi) => {
    Alert.alert(tr("Delete RFI"), tr("Delete \"{{subject}}\"? This can't be undone.", { subject: rfi.subject }), [
      { text: tr("Cancel"), style: 'cancel' },
      {
        text: tr("Delete"),
        style: 'destructive',
        onPress: async () => {
          try {
            await interiorApiClient.delete(`/projects/${projectId}/rfis?rfiId=${rfi._id}`);
            showToast(tr("RFI deleted"), 'success');
            setSelectedRfi(null);
            fetchRfis(true);
          } catch (e) {
            showToast(e.message || tr("Failed to delete RFI"), 'error');
          }
        },
      },
    ]);
  };

  const closeThread = () => { setSelectedRfi(null); setAssignOpen(false); };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{tr("Requests For Information")}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterBarContent}>
          {FILTERS.map(([key, label]) => {
            const on = filter === key;
            const warn = key === 'unassigned' && counts.unassigned > 0;
            return (
              <TouchableOpacity key={key} style={[s.filterChip, on && s.filterChipOn]} onPress={() => setFilter(key)}>
                <Text style={[s.filterText, on && { color: '#FFFFFF' }]}>{tr(label)}</Text>
                <View style={[s.countPill, on ? { backgroundColor: 'rgba(255,255,255,0.25)' } : warn ? { backgroundColor: '#FEF3C7' } : null]}>
                  <Text style={[s.countText, on && { color: '#FFFFFF' }, !on && warn && { color: '#92400E' }]}>{counts[key]}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <SkeletonList />
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {visible.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="chatbox-ellipses-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>{rfis.length === 0 ? tr("No RFIs raised yet") : tr("Nothing in this list.")}</Text>
              </View>
            ) : (
              visible.map((rfi) => {
                const priority = PRIORITY_META[rfi.priority] || PRIORITY_META.medium;
                const status = STATUS_META[rfi.status] || STATUS_META.open;
                return (
                  <TouchableOpacity key={rfi._id} style={s.rfiCard} onPress={() => setSelectedRfi(rfi)}>
                    <View style={s.rfiTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="chatbox-outline" size={12} color="#64748B" />
                        <Text style={s.rfiNumber}>{rfi.rfiNumber}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <View style={[s.pill, { backgroundColor: priority.bg }]}>
                          <Text style={[s.pillText, { color: priority.color }]}>{tr(rfi.priority)}</Text>
                        </View>
                        <View style={[s.pill, { backgroundColor: status.bg }]}>
                          <Text style={[s.pillText, { color: status.color }]}>{tr(rfi.status)}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={s.rfiSubject} numberOfLines={1}>{rfi.subject}</Text>
                    <Text style={s.rfiQuestion} numberOfLines={2}>{rfi.question}</Text>
                    <View style={s.rfiBottomRow}>
                      {rfi.assignedTo ? (
                        <View style={s.ownerRow}>
                          <Ionicons name="person-circle-outline" size={14} color="#16A34A" />
                          <Text style={s.ownerText} numberOfLines={1}>
                            {tr("Asked:")} {idOf(rfi.assignedTo) === me ? tr("You") : personName(rfi.assignedTo)}
                          </Text>
                        </View>
                      ) : rfi.status !== 'closed' ? (
                        <View style={s.ownerRow}>
                          <Ionicons name="help-circle-outline" size={14} color="#B45309" />
                          <Text style={[s.ownerText, { color: '#B45309', fontFamily: 'Inter-SemiBold' }]}>{tr("Needs an owner")}</Text>
                        </View>
                      ) : <View />}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="calendar-outline" size={12} color="#3B82F6" />
                        <Text style={s.dueText}>{formatDate(rfi.dueDate)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {canDo('rfis', 'create') && (
          <TouchableOpacity style={s.fab} onPress={() => setIsModalOpen(true)}>
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Raise RFI */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{tr("Raise RFI")}</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>{tr("Subject Title *")}</Text>
              <TextInput style={s.input} placeholder={tr("e.g. Glass partition core alignment")} placeholderTextColor="#94A3B8" value={form.subject} onChangeText={(v) => setForm({ ...form, subject: v })} />

              <Text style={s.label}>{tr("Your question *")}</Text>
              <TextInput
                style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                placeholder={tr("Describe what's unclear and what you need to know...")}
                placeholderTextColor="#94A3B8"
                value={form.question}
                onChangeText={(v) => setForm({ ...form, question: v })}
                multiline
              />

              <Text style={s.label}>{tr("What is it about?")}</Text>
              <View style={s.wrapRow}>
                {TOPICS.map((t) => {
                  const on = form.topic === t.value;
                  return (
                    <TouchableOpacity key={t.value} style={[s.chip, on && s.chipActive]} onPress={() => setForm({ ...form, topic: on ? '' : t.value })}>
                      <Text style={[s.chipText, on && s.chipTextActive]}>{tr(t.label)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.label}>{tr("Who should answer?")}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={[s.modeCard, form.mode === 'person' && s.modeCardOn]} onPress={() => setForm({ ...form, mode: 'person' })}>
                  <Ionicons name="person-outline" size={16} color={form.mode === 'person' ? '#2563EB' : '#64748B'} />
                  <Text style={s.modeTitle}>{tr("I know who to ask")}</Text>
                  <Text style={s.modeSub}>{tr("Send it straight to them")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modeCard, form.mode === 'unsure' && s.modeCardOn]} onPress={() => setForm({ ...form, mode: 'unsure', assignee: '' })}>
                  <Ionicons name="help-circle-outline" size={16} color={form.mode === 'unsure' ? '#2563EB' : '#64748B'} />
                  <Text style={s.modeTitle}>{tr("Not sure who to ask")}</Text>
                  <Text style={s.modeSub}>{tr("The project manager will route it")}</Text>
                </TouchableOpacity>
              </View>

              {suggestions.length > 0 && (
                <View style={[s.wrapRow, { marginTop: 10, alignItems: 'center' }]}>
                  <Text style={s.hint}>{tr("Usually answered by:")}</Text>
                  {suggestions.map((m) => {
                    const on = form.mode === 'person' && form.assignee === m.id;
                    return (
                      <TouchableOpacity key={m.id} style={[s.chip, on && s.chipActive]} onPress={() => setForm({ ...form, mode: 'person', assignee: m.id })}>
                        <Text style={[s.chipText, on && s.chipTextActive]}>{m.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {form.mode === 'person' ? (
                <MemberPicker members={members} value={form.assignee} me={me} onChange={(v) => setForm({ ...form, assignee: v })} />
              ) : (
                <View style={s.routeBox}>
                  <View style={s.routeIcon}>
                    <Ionicons name="git-branch-outline" size={16} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    {projectManagers.length > 0 ? (
                      <>
                        <Text style={s.routeTitle}>{tr("Goes to {{names}} to route", { names: projectManagers.map((m) => m.name).join(', ') })}</Text>
                        <Text style={s.routeText}>{tr("They will get an e-mail and assign it to the right person. Until then it shows under \"Needs an owner\".")}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={s.routeTitle}>{tr("This project has no project manager yet")}</Text>
                        <Text style={s.routeText}>{tr("It will wait under \"Needs an owner\" until someone who can manage RFIs assigns it.")}</Text>
                      </>
                    )}
                  </View>
                </View>
              )}

              <Text style={s.label}>{tr("Priority")}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity key={p} style={[s.chip, form.priority === p && s.chipActive]} onPress={() => setForm({ ...form, priority: p })}>
                    <Text style={[s.chipText, form.priority === p && s.chipTextActive]}>{tr(p)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>{tr("Answer needed by")}</Text>
              <DateField value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} inputStyle={s.input} />

              <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleCreate} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>{form.mode === 'person' ? tr("Send RFI") : tr("Raise for routing")}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* RFI thread */}
      <Modal visible={!!selectedRfi} animationType="slide" transparent onRequestClose={closeThread}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            {selectedRfi && (
              <>
                <View style={s.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rfiNumber}>{selectedRfi.rfiNumber}</Text>
                    <Text style={s.modalTitle} numberOfLines={1}>{selectedRfi.subject}</Text>
                  </View>
                  <TouchableOpacity onPress={closeThread}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={s.personBox}>
                      <Text style={s.personLabel}>{tr("Raised by")}</Text>
                      <Text style={s.personName} numberOfLines={1}>{idOf(selectedRfi.raisedBy) === me ? tr("You") : personName(selectedRfi.raisedBy) || '—'}</Text>
                    </View>
                    <View style={[s.personBox, !selectedRfi.assignedTo && { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' }]}>
                      <Text style={s.personLabel}>{tr("Asked to answer")}</Text>
                      <Text style={s.personName} numberOfLines={1}>
                        {selectedRfi.assignedTo
                          ? idOf(selectedRfi.assignedTo) === me ? tr("You") : personName(selectedRfi.assignedTo)
                          : tr("Not assigned yet")}
                      </Text>
                    </View>
                  </View>
                  {!!selectedRfi.topic && (
                    <Text style={[s.hint, { marginTop: 8 }]}>{tr("Topic:")} {tr(topicLabel(selectedRfi.topic) || selectedRfi.topic)}</Text>
                  )}

                  {selectedRfi.status !== 'closed' && canDo('rfis', 'update') && (
                    !assignOpen ? (
                      <TouchableOpacity
                        style={[s.assignBtn, !selectedRfi.assignedTo && { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }]}
                        onPress={() => { setAssignOpen(true); setAssignTo(''); setAssignNote(''); }}
                      >
                        <Ionicons name="swap-horizontal" size={15} color={selectedRfi.assignedTo ? '#2563EB' : '#B45309'} />
                        <Text style={[s.assignBtnText, !selectedRfi.assignedTo && { color: '#B45309' }]}>
                          {selectedRfi.assignedTo ? tr("Reassign / forward") : tr("Assign to someone")}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={s.assignPanel}>
                        <MemberPicker members={members} value={assignTo} me={me} exclude={idOf(selectedRfi.assignedTo)} onChange={setAssignTo} />
                        <TextInput style={[s.input, { marginTop: 8 }]} placeholder={tr("Note for them (optional)")} placeholderTextColor="#94A3B8" value={assignNote} onChangeText={setAssignNote} />
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                          <TouchableOpacity style={s.secondaryBtn} onPress={() => setAssignOpen(false)}>
                            <Text style={s.secondaryBtnText}>{tr("Cancel")}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[s.primaryBtn, (!assignTo || posting) && { opacity: 0.5 }]} onPress={assign} disabled={!assignTo || posting}>
                            {posting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.primaryBtnText}>{tr("Assign")}</Text>}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )
                  )}

                  <Text style={s.label}>{tr("Question")}</Text>
                  <View style={s.questionBox}>
                    <Text style={s.questionText}>{selectedRfi.question}</Text>
                  </View>

                  {!!selectedRfi.response && (
                    <>
                      <Text style={s.label}>{tr("Answer")}{selectedRfi.respondedBy ? ` · ${personName(selectedRfi.respondedBy)}` : ''}</Text>
                      <View style={[s.questionBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                        <Text style={s.questionText}>{selectedRfi.response}</Text>
                      </View>
                    </>
                  )}

                  {(selectedRfi.assignmentHistory || []).length > 0 && (
                    <>
                      <Text style={s.label}>{tr("History")}</Text>
                      {selectedRfi.assignmentHistory.map((h, i) => (
                        <View key={h._id || i} style={s.histRow}>
                          <View style={s.histDot} />
                          <Text style={s.histText}>
                            {i === 0
                              ? h.to
                                ? tr("{{by}} asked {{to}}", { by: personName(h.by), to: personName(h.to) })
                                : tr("{{by}} raised it for routing", { by: personName(h.by) })
                              : tr("{{by}} assigned it to {{to}}", { by: personName(h.by), to: personName(h.to) })}
                            {i > 0 && h.note ? ` — "${h.note}"` : ''}
                            <Text style={{ color: '#94A3B8' }}> · {formatDate(h.at)}</Text>
                          </Text>
                        </View>
                      ))}
                    </>
                  )}

                  {selectedRfi.status !== 'closed' && canDo('rfis', 'update') && (
                    <>
                      <TouchableOpacity style={s.resolveBtn} onPress={() => closeRfi(selectedRfi)}>
                        <Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" />
                        <Text style={s.resolveBtnText}>{tr("Mark Resolved & Close")}</Text>
                      </TouchableOpacity>

                      <Text style={s.label}>{tr("Post an answer")}</Text>
                      <View style={s.responseRow}>
                        <TextInput
                          style={s.responseInput}
                          placeholder={tr("Type your answer...")}
                          placeholderTextColor="#94A3B8"
                          value={responseText}
                          onChangeText={setResponseText}
                        />
                        <TouchableOpacity style={s.postBtn} onPress={postResponse} disabled={posting}>
                          {posting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={16} color="#FFFFFF" />}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                  {canDo('rfis', 'delete') && (
                    <TouchableOpacity style={s.deleteRfiBtn} onPress={() => deleteRfi(selectedRfi)}>
                      <Ionicons name="trash-outline" size={15} color="#E11D48" />
                      <Text style={s.deleteRfiText}>{tr("Delete RFI")}</Text>
                    </TouchableOpacity>
                  )}
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
  scroll: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },

  filterBar: { flexGrow: 0, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filterBarContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  filterChipOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterText: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#334155' },
  countPill: { paddingHorizontal: 6, borderRadius: 999, backgroundColor: '#F1F5F9' },
  countText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#475569' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  rfiCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 8 },
  rfiTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rfiNumber: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
  rfiSubject: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  rfiQuestion: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#64748B', lineHeight: 17 },
  rfiBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  ownerText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#334155', flexShrink: 1 },
  dueText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  fab: {
    position: 'absolute', right: 20, bottom: 30,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 6 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },

  label: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 14 },
  hint: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B' },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#64748B', textTransform: 'capitalize' },
  chipTextActive: { color: '#2563EB' },

  modeCard: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 10, gap: 3 },
  modeCardOn: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  modeTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modeSub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B' },

  memberList: { marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, overflow: 'hidden' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  memberRowOn: { backgroundColor: '#EFF6FF' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#334155' },
  memberName: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  memberRole: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B' },

  routeBox: { flexDirection: 'row', gap: 10, marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  routeIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  routeTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  routeText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#475569', lineHeight: 17, marginTop: 2 },

  personBox: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 10, marginTop: 10 },
  personLabel: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#64748B', textTransform: 'uppercase' },
  personName: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginTop: 2 },

  assignBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  assignBtnText: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#2563EB' },
  assignPanel: { marginTop: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  primaryBtn: { flex: 1, height: 42, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  secondaryBtn: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#334155' },

  histRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  histDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563EB', marginTop: 6 },
  histText: { flex: 1, fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#334155', lineHeight: 17 },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  questionBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12 },
  questionText: { fontSize: 13.5, fontFamily: 'Inter-Regular', color: '#334155', lineHeight: 19 },

  resolveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 12, paddingVertical: 10, justifyContent: 'center', marginTop: 14 },
  resolveBtnText: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#16A34A' },

  responseRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  responseInput: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13.5, fontFamily: 'Inter-Regular', color: '#0F172A' },
  postBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },

  deleteRfiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#FECDD3', backgroundColor: '#FFF1F2' },
  deleteRfiText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#E11D48' },
});

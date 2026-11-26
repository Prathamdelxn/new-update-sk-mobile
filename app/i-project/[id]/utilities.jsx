import { tr } from '../../utils/i18n/tr';
import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';
import { useProjectPermissions } from '../../utils/interior/useProjectPermissions';
import SkeletonList from '../../components/common/SkeletonList';

// Utility / MEP commissioning — fully per project.
// Systems are detected from the project's scope on first open (backend); the team can
// add, rename, mark N/A or remove systems and their checkpoints.

const STATUS_META = {
  pending: { color: '#94A3B8', icon: 'ellipse-outline', label: 'Pending' },
  passed: { color: '#16A34A', icon: 'checkmark-circle', label: 'Passed' },
  failed: { color: '#DC2626', icon: 'close-circle', label: 'Failed' },
};
const STATUS_OPTIONS = ['pending', 'passed', 'failed'];

// Quick-add suggestions only; nothing is created unless picked.
const SUGGESTIONS = ['Electrical', 'Lighting', 'HVAC', 'Plumbing & Drainage', 'Fire Fighting & Alarm', 'ELV / Low Current', 'Gas', 'STP / Sewage'];

// Icon by keyword in the system name (works for any custom name too)
const ICONS = [
  [/elv|network|cctv|data|low current/i, { icon: 'wifi-outline', color: '#7C3AED', bg: '#F5F3FF' }],
  [/fire|sprinkler|alarm/i, { icon: 'flame-outline', color: '#DC2626', bg: '#FEF2F2' }],
  [/hvac|ac\b|air|duct|ventilation/i, { icon: 'snow-outline', color: '#0891B2', bg: '#ECFEFF' }],
  [/plumb|drain|water|phe|sanitary/i, { icon: 'water-outline', color: '#2563EB', bg: '#EFF6FF' }],
  [/stp|sewage/i, { icon: 'leaf-outline', color: '#059669', bg: '#ECFDF5' }],
  [/gas/i, { icon: 'flame-outline', color: '#EA580C', bg: '#FFF7ED' }],
  [/light/i, { icon: 'bulb-outline', color: '#CA8A04', bg: '#FEFCE8' }],
  [/electric|power/i, { icon: 'flash-outline', color: '#D97706', bg: '#FFFBEB' }],
];
const systemName = (sys) =>
  sys.label || String(sys.system || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const metaFor = (name) => (ICONS.find(([re]) => re.test(name)) || [null, { icon: 'construct-outline', color: '#2563EB', bg: '#EFF6FF' }])[1];
const errMsg = (e, fb) => e?.response?.data?.message || e?.message || fb;

export default function InteriorUtilitiesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();
  const { can: canDo } = useProjectPermissions(projectId);
  const canEdit = canDo('utilities', 'update');

  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // checkpoint modal
  const [cpModal, setCpModal] = useState(null); // { sys, cp }
  const [cpName, setCpName] = useState('');
  const [cpStatus, setCpStatus] = useState('passed');
  const [cpReadings, setCpReadings] = useState('');

  // add / rename system modal
  const [sysModal, setSysModal] = useState(null); // { mode: 'add'|'rename', sys? }
  const [sysLabel, setSysLabel] = useState('');
  const [sysCheckpoints, setSysCheckpoints] = useState('');

  const [newCp, setNewCp] = useState({});

  const base = `/projects/${projectId}/utilities`;

  const fetchUtilities = useCallback(async () => {
    try {
      const res = await interiorApiClient.get(base);
      setSystems(res?.success && res?.data ? res.data : []);
    } catch (e) {
      console.error('Failed to load utilities', e);
      showToast(tr("Failed to fetch Utilities checklists"), 'error');
    } finally {
      setLoading(false);
    }
  }, [base]);

  useFocusEffect(useCallback(() => { fetchUtilities(); }, [fetchUtilities]));

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      const res = await fn();
      if (ok) showToast(tr(ok), 'success');
      await fetchUtilities();
      return res || true;
    } catch (e) {
      showToast(tr(errMsg(e, 'Update failed')), 'error');
      return null;
    } finally {
      setBusy(false);
    }
  };
  const update = (data, ok) => run(() => interiorApiClient.put(base, data), ok);

  // ── checkpoint ──
  const openCheckpoint = (sys, cp) => {
    if (!canEdit || sys.notApplicable) return;
    setCpModal({ sys, cp });
    setCpName(cp.name);
    setCpStatus(cp.status === 'pending' ? 'passed' : cp.status);
    setCpReadings(cp.readings || '');
  };

  const saveCheckpoint = async () => {
    const { sys, cp } = cpModal;
    const name = cpName.trim();
    if (name && name !== cp.name) {
      const r = await update({ systemId: sys._id, action: 'renameCheckpoint', checkpointName: cp.name, name });
      if (!r) return;
    }
    const r = await update({ systemId: sys._id, checkpointName: name || cp.name, status: cpStatus, readings: cpReadings }, 'Checkpoint updated');
    if (r) setCpModal(null);
  };

  const removeCheckpoint = () => {
    const { sys, cp } = cpModal;
    Alert.alert(tr("Remove checkpoint?"), tr("\"{{name}}\" will be removed from {{system}}.", { name: cp.name, system: systemName(sys) }), [
      { text: tr("Cancel"), style: 'cancel' },
      {
        text: tr("Remove"),
        style: 'destructive',
        onPress: async () => {
          const r = await update({ systemId: sys._id, action: 'removeCheckpoint', checkpointName: cp.name }, 'Checkpoint removed');
          if (r) setCpModal(null);
        },
      },
    ]);
  };

  const addCheckpoint = async (sys) => {
    const name = (newCp[sys._id] || '').trim();
    if (!name) return;
    const r = await update({ systemId: sys._id, action: 'addCheckpoint', name });
    if (r) setNewCp((p) => ({ ...p, [sys._id]: '' }));
  };

  // ── system ──
  const openAdd = () => { setSysModal({ mode: 'add' }); setSysLabel(''); setSysCheckpoints(''); };

  const saveSystem = async () => {
    const label = sysLabel.trim();
    if (!label) return;
    let r;
    if (sysModal.mode === 'rename') {
      r = await update({ systemId: sysModal.sys._id, action: 'rename', label }, 'System renamed');
    } else {
      const checkpoints = sysCheckpoints.split('\n').map((x) => x.trim()).filter(Boolean);
      r = await run(() => interiorApiClient.post(base, { label, checkpoints }), 'System added');
    }
    if (r) setSysModal(null);
  };

  const systemOptions = (sys) => {
    Alert.alert(systemName(sys), undefined, [
      { text: tr("Rename"), onPress: () => { setSysModal({ mode: 'rename', sys }); setSysLabel(systemName(sys)); } },
      {
        text: sys.notApplicable ? tr("Mark applicable") : tr("Mark not applicable"),
        onPress: () => update({ systemId: sys._id, action: 'setNotApplicable', notApplicable: !sys.notApplicable }),
      },
      {
        text: tr("Remove system"),
        style: 'destructive',
        onPress: () =>
          Alert.alert(tr("Remove system?"), tr("\"{{system}}\" and its checkpoints will be removed from this project.", { system: systemName(sys) }), [
            { text: tr("Cancel"), style: 'cancel' },
            { text: tr("Remove"), style: 'destructive', onPress: () => run(() => interiorApiClient.delete(`${base}?systemId=${sys._id}`), 'System removed') },
          ]),
      },
      { text: tr("Cancel"), style: 'cancel' },
    ]);
  };

  const detect = async () => {
    const res = await run(() => interiorApiClient.post(base, { action: 'detect' }));
    if (res && res.message) showToast(tr(res.message), 'success');
  };

  const applicable = systems.filter((x) => !x.notApplicable);
  const totalCps = applicable.reduce((n, x) => n + (x.checkpoints || []).length, 0);
  const passedCps = applicable.reduce((n, x) => n + (x.checkpoints || []).filter((c) => c.status === 'passed').length, 0);
  const overall = totalCps ? Math.round((passedCps / totalCps) * 100) : 0;

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{tr("Systems Commissioning")}</Text>
            {systems.length > 0 && <Text style={s.headerSub}>{tr("Overall")} {overall}% · {tr("{{count}} systems", { count: applicable.length })}</Text>}
          </View>
          {canEdit && (
            <>
              <TouchableOpacity style={s.iconBtn} onPress={detect} disabled={busy}>
                <Ionicons name="sparkles-outline" size={18} color="#2563EB" />
              </TouchableOpacity>
              <TouchableOpacity style={[s.iconBtn, { backgroundColor: '#2563EB', borderColor: '#2563EB' }]} onPress={openAdd} disabled={busy}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {loading ? (
          <SkeletonList variant="rows" />
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {systems.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="flash-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>{tr("No utility systems in this project's scope yet")}</Text>
                <Text style={s.emptySub}>{tr("Nothing in the BOQ, quotation or site survey mentions electrical, HVAC, plumbing or other services. Add the systems this job needs.")}</Text>
                {canEdit && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity style={s.outlineBtn} onPress={detect} disabled={busy}>
                      <Ionicons name="sparkles-outline" size={15} color="#2563EB" />
                      <Text style={s.outlineBtnText}>{tr("Detect from scope")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.outlineBtn, { backgroundColor: '#2563EB', borderColor: '#2563EB' }]} onPress={openAdd} disabled={busy}>
                      <Ionicons name="add" size={15} color="#FFFFFF" />
                      <Text style={[s.outlineBtnText, { color: '#FFFFFF' }]}>{tr("Add system")}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              systems.map((sys) => {
                const name = systemName(sys);
                const meta = metaFor(name);
                const checks = sys.checkpoints || [];
                const passed = checks.filter((c) => c.status === 'passed').length;
                const failed = checks.filter((c) => c.status === 'failed').length;
                const progress = checks.length ? Math.round((passed / checks.length) * 100) : 0;
                return (
                  <View key={sys._id} style={[s.sysCard, sys.notApplicable && { opacity: 0.6 }]}>
                    <View style={s.sysHeader}>
                      <View style={[s.sysIconBox, { backgroundColor: meta.bg }]}>
                        <Ionicons name={meta.icon} size={18} color={meta.color} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.sysTitle} numberOfLines={1}>{tr(name)}</Text>
                        <Text style={[s.sysSub, failed > 0 && { color: '#DC2626' }]} numberOfLines={1}>
                          {sys.notApplicable
                            ? tr("Not applicable to this project")
                            : `${tr("{{passed}}/{{total}} passed", { passed, total: checks.length })}${failed > 0 ? tr(" · {{failed}} failed", { failed }) : ''} · ${sys.source === 'auto' ? tr("From project scope") : tr("Added by team")}`}
                        </Text>
                      </View>
                      {!sys.notApplicable && <Text style={s.sysProgress}>{progress}%</Text>}
                      {canEdit && (
                        <TouchableOpacity onPress={() => systemOptions(sys)} hitSlop={10}>
                          <Ionicons name="ellipsis-vertical" size={18} color="#64748B" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {!sys.notApplicable && (
                      <>
                        <View style={s.progressTrack}>
                          <View style={[s.progressFill, { width: `${progress}%`, backgroundColor: meta.color }]} />
                        </View>
                        <View style={s.cpList}>
                          {checks.length === 0 && <Text style={s.cpEmpty}>{tr("No checkpoints yet. Add the tests this system needs.")}</Text>}
                          {checks.map((cp, i) => {
                            const st = STATUS_META[cp.status] || STATUS_META.pending;
                            return (
                              <TouchableOpacity
                                key={cp.name}
                                style={[s.cpRow, i === checks.length - 1 && !canEdit && { borderBottomWidth: 0 }]}
                                onPress={() => openCheckpoint(sys, cp)}
                                activeOpacity={0.7}
                              >
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={s.cpName}>{tr(cp.name)}</Text>
                                  {!!cp.readings && <Text style={s.cpReadings} numberOfLines={2}>{cp.readings}</Text>}
                                </View>
                                <View style={s.cpStatus}>
                                  <Ionicons name={st.icon} size={16} color={st.color} />
                                  <Text style={[s.cpStatusText, { color: st.color }]}>{tr(st.label)}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                          {canEdit && (
                            <View style={s.addCpRow}>
                              <TextInput
                                style={s.addCpInput}
                                placeholder={tr("Add a checkpoint, e.g. Earthing test")}
                                placeholderTextColor="#94A3B8"
                                value={newCp[sys._id] || ''}
                                onChangeText={(v) => setNewCp((p) => ({ ...p, [sys._id]: v }))}
                                onSubmitEditing={() => addCheckpoint(sys)}
                                returnKeyType="done"
                              />
                              <TouchableOpacity
                                style={[s.addCpBtn, !(newCp[sys._id] || '').trim() && { opacity: 0.4 }]}
                                onPress={() => addCheckpoint(sys)}
                                disabled={busy || !(newCp[sys._id] || '').trim()}
                              >
                                <Ionicons name="add" size={18} color="#2563EB" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </>
                    )}
                  </View>
                );
              })
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Checkpoint result */}
      <Modal visible={!!cpModal} animationType="slide" transparent onRequestClose={() => setCpModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            {cpModal && (
              <>
                <View style={s.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalTitle}>{tr("Record test result")}</Text>
                    <Text style={s.modalSub}>{tr(systemName(cpModal.sys))}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setCpModal(null)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={s.label}>{tr("Checkpoint")}</Text>
                <TextInput style={s.input} value={cpName} onChangeText={setCpName} />

                <Text style={s.label}>{tr("Result")}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {STATUS_OPTIONS.map((v) => (
                    <TouchableOpacity key={v} style={[s.chip, cpStatus === v && { backgroundColor: STATUS_META[v].color, borderColor: STATUS_META[v].color }]} onPress={() => setCpStatus(v)}>
                      <Text style={[s.chipText, cpStatus === v && { color: '#FFFFFF' }]}>{tr(STATUS_META[v].label)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.label}>{tr("Logged Readings / Notes")}</Text>
                <TextInput style={s.input} placeholder={tr("e.g. Pressure 10.2 Bar for 2 hours")} placeholderTextColor="#94A3B8" value={cpReadings} onChangeText={setCpReadings} />
                <Text style={s.hint}>{tr("System progress updates automatically from passed checkpoints.")}</Text>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8 }}>
                  <TouchableOpacity style={s.removeBtn} onPress={removeCheckpoint} disabled={busy}>
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.saveBtn, { flex: 1, marginTop: 0, marginBottom: 0 }, busy && { opacity: 0.7 }]} onPress={saveCheckpoint} disabled={busy}>
                    {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>{tr("Save Changes")}</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add / rename system */}
      <Modal visible={!!sysModal} animationType="slide" transparent onRequestClose={() => setSysModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            {sysModal && (
              <>
                <View style={s.modalHeader}>
                  <Text style={[s.modalTitle, { flex: 1 }]}>{sysModal.mode === 'add' ? tr("Add utility system") : tr("Rename system")}</Text>
                  <TouchableOpacity onPress={() => setSysModal(null)}>
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={s.label}>{tr("System name")}</Text>
                <TextInput style={s.input} autoFocus placeholder={tr("e.g. HVAC, Kitchen Gas Line, Pool Pumps")} placeholderTextColor="#94A3B8" value={sysLabel} onChangeText={setSysLabel} />

                {sysModal.mode === 'add' && (
                  <>
                    <View style={s.suggestWrap}>
                      {SUGGESTIONS.filter((x) => !systems.some((y) => systemName(y).toLowerCase() === x.toLowerCase())).map((x) => (
                        <TouchableOpacity key={x} style={[s.suggest, sysLabel === x && s.suggestActive]} onPress={() => setSysLabel(x)}>
                          <Text style={[s.suggestText, sysLabel === x && { color: '#FFFFFF' }]}>{tr(x)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={s.label}>{tr("Checkpoints (one per line, optional)")}</Text>
                    <TextInput
                      style={[s.input, { minHeight: 90, textAlignVertical: 'top' }]}
                      multiline
                      placeholder={tr("Leave empty to use the standard checklist for known systems")}
                      placeholderTextColor="#94A3B8"
                      value={sysCheckpoints}
                      onChangeText={setSysCheckpoints}
                    />
                  </>
                )}

                <TouchableOpacity style={[s.saveBtn, (busy || !sysLabel.trim()) && { opacity: 0.6 }]} onPress={saveSystem} disabled={busy || !sysLabel.trim()}>
                  {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>{sysModal.mode === 'add' ? tr("Add system") : tr("Save")}</Text>}
                </TouchableOpacity>
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
  scroll: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 10, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#334155', textAlign: 'center' },
  emptySub: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center', lineHeight: 18 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#FFFFFF' },
  outlineBtnText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#2563EB' },

  sysCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  sysHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sysIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sysTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  sysSub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },
  sysProgress: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden', marginTop: 12 },
  progressFill: { height: '100%', borderRadius: 3 },

  cpList: { marginTop: 6 },
  cpEmpty: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#94A3B8', paddingVertical: 10 },
  cpRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  cpName: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A' },
  cpReadings: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  cpStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cpStatusText: { fontSize: 13, fontFamily: 'Inter-SemiBold' },
  addCpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  addCpInput: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },
  addCpBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 6 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSub: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },

  label: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 12 },
  hint: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 8 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  chip: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', flex: 1, alignItems: 'center' },
  chipText: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  suggestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  suggest: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  suggestActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  suggestText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#334155' },

  removeBtn: { width: 50, height: 50, borderRadius: 14, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

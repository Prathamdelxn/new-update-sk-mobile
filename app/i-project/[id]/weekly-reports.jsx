import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

function fmt(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function fmtLong(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function toISODate(d) {
  return d.toISOString().split('T')[0];
}

const LIST_META = {
  completed: { icon: 'checkmark-circle-outline', color: '#16A34A', bg: '#F0FDF4', title: '1. Completed Activities & Milestones' },
  delayed: { icon: 'time-outline', color: '#DC2626', bg: '#FEF2F2', title: '2. Delayed Milestones & Blockers' },
  risks: { icon: 'alert-outline', color: '#D97706', bg: '#FFFBEB', title: '3. Identified Risks & Quality Notes' },
  plan: { icon: 'calendar-outline', color: '#2563EB', bg: '#EFF6FF', title: '4. Next Week Planned Target Scope' },
};

function ListSection({ meta, items, emptyText }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <Ionicons name={meta.icon} size={13} color={meta.color} />
        <Text style={[s.sectionTitle, { color: meta.color }]}>{meta.title} ({items?.length || 0})</Text>
      </View>
      {(!items || items.length === 0) ? (
        <Text style={s.emptyLine}>{emptyText}</Text>
      ) : (
        items.map((item, i) => (
          <View key={i} style={s.bulletRow}>
            <Text style={s.bulletDot}>•</Text>
            <Text style={s.bulletText}>{item}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function EditableList({ meta, items, setItems, draft, setDraft, placeholder }) {
  const addItem = () => {
    if (!draft.trim()) return;
    setItems((prev) => [...prev, draft.trim()]);
    setDraft('');
  };
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <Ionicons name={meta.icon} size={13} color={meta.color} />
        <Text style={[s.sectionTitle, { color: meta.color }]}>{meta.title} ({items.length})</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addItem}
        />
        <TouchableOpacity style={[s.addItemBtn, { backgroundColor: meta.color }]} onPress={addItem}>
          <Ionicons name="add" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      {items.map((item, idx) => (
        <View key={idx} style={[s.editableRow, { backgroundColor: meta.bg }]}>
          <Text style={[s.editableRowText, { color: meta.color }]} numberOfLines={2}>{item}</Text>
          <TouchableOpacity onPress={() => removeItem(idx)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close" size={14} color={meta.color} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

export default function InteriorWeeklyReportsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [project, setProject] = useState(null);
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [completedActivities, setCompletedActivities] = useState([]);
  const [delayedActivities, setDelayedActivities] = useState([]);
  const [reportRisks, setReportRisks] = useState([]);
  const [nextWeekPlan, setNextWeekPlan] = useState([]);
  const [newCompleted, setNewCompleted] = useState('');
  const [newDelayed, setNewDelayed] = useState('');
  const [newRisk, setNewRisk] = useState('');
  const [newPlan, setNewPlan] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, repRes, taskRes, mileRes, riskRes] = await Promise.allSettled([
        interiorApiClient.get(`/projects/${projectId}`),
        interiorApiClient.get(`/projects/${projectId}/weekly-reports`),
        interiorApiClient.get(`/projects/${projectId}/tasks`),
        interiorApiClient.get(`/projects/${projectId}/milestones`),
        interiorApiClient.get(`/projects/${projectId}/risks`),
      ]);
      if (projRes.status === 'fulfilled' && projRes.value?.success) setProject(projRes.value.data);
      if (repRes.status === 'fulfilled' && repRes.value?.success) setReports(repRes.value.data || []);
      if (taskRes.status === 'fulfilled' && taskRes.value?.success) setTasks(taskRes.value.data || []);
      if (mileRes.status === 'fulfilled' && mileRes.value?.success) setMilestones(mileRes.value.data || []);
      if (riskRes.status === 'fulfilled' && riskRes.value?.success) setRisks(riskRes.value.data || []);
    } catch (e) {
      console.error('Failed to load weekly reports', e);
      showToast('Failed to load Weekly Progress Reports', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const autoScanTimeline = useCallback((startOverride, endOverride) => {
    const e = endOverride || (endDate ? new Date(endDate) : new Date());

    const done = tasks
      .filter((t) => t.status === 'completed')
      .map((t) => `${t.name} (${t.packageId?.trade || 'Site Activity'})`);

    const delayed = milestones
      .filter((m) => m.status === 'delayed' || (m.dueDate && new Date(m.dueDate) < e && m.status !== 'completed'))
      .map((m) => `Milestone: ${m.name} [Target Date: ${m.dueDate ? new Date(m.dueDate).toLocaleDateString('en-IN') : '—'}]`);

    const openRisks = risks
      .filter((r) => r.status === 'open' || !r.status)
      .map((r) => `${r.title || r.description} (${r.severity || r.impact || 'Medium'} impact)`);

    const upcoming = tasks
      .filter((t) => t.status === 'todo' || (t.status === 'in_progress' && (t.progress || 0) < 100))
      .slice(0, 5)
      .map((t) => `Execute ${t.name} [${t.packageId?.trade || 'Trade'}]`);

    setCompletedActivities(done.length > 0 ? done : ['Site initial inspection & work area layout verification']);
    setDelayedActivities(delayed);
    setReportRisks(openRisks);
    setNextWeekPlan(upcoming.length > 0 ? upcoming : ['Continue baseline scheduled activities for upcoming trades']);
  }, [tasks, milestones, risks, endDate]);

  const setQuickDatePreset = (preset) => {
    const today = new Date();
    const currentDay = today.getDay();

    if (preset === 'this_week') {
      const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(today);
      monday.setDate(today.getDate() + distanceToMon);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(toISODate(monday));
      setEndDate(toISODate(sunday));
      autoScanTimeline(monday, sunday);
    } else if (preset === 'last_week') {
      const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() + distanceToMon - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      setStartDate(toISODate(lastMonday));
      setEndDate(toISODate(lastSunday));
      autoScanTimeline(lastMonday, lastSunday);
    } else if (preset === 'last_7_days') {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      setStartDate(toISODate(sevenDaysAgo));
      setEndDate(toISODate(today));
      autoScanTimeline(sevenDaysAgo, today);
    }
  };

  const openModal = () => {
    setQuickDatePreset('this_week');
    setIsModalOpen(true);
  };

  const handleGenerate = async () => {
    if (!startDate.trim() || !endDate.trim()) {
      showToast('Please specify both start and end dates', 'error');
      return;
    }
    setGenerating(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/weekly-reports`, {
        weekStart: startDate,
        weekEnd: endDate,
        completedActivities: completedActivities.filter(Boolean),
        delayedActivities: delayedActivities.filter(Boolean),
        risks: reportRisks.filter(Boolean),
        nextWeekPlan: nextWeekPlan.filter(Boolean),
      });
      showToast('Weekly Progress Report compiled & saved successfully', 'success');
      setIsModalOpen(false);
      loadData();
    } catch (e) {
      showToast(e.message || 'Failed to compile report', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = (report) => {
    Alert.alert(
      'Delete Weekly Progress Report',
      `Delete the report for ${fmt(report.weekStart)} - ${fmtLong(report.weekEnd)}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(report._id);
            try {
              await interiorApiClient.delete(`/projects/${projectId}/weekly-reports/${report._id}`);
              showToast('Weekly Report deleted successfully', 'success');
              setReports((prev) => prev.filter((r) => r._id !== report._id));
            } catch (e) {
              showToast(e.message || 'Failed to delete report', 'error');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const buildReportHtml = (report) => {
    const section = (title, items, color) => `
      <div class="section-title" style="color:${color}">${title} (${items?.length || 0})</div>
      ${items && items.length > 0
        ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
        : `<p class="muted">None logged.</p>`}
    `;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 25px; color: #0F172A; font-size: 12px; }
          .header { border-bottom: 2px solid #2563EB; padding-bottom: 12px; margin-bottom: 16px; }
          .logo { font-size: 18px; font-weight: bold; color: #2563EB; }
          .sub { font-size: 10px; color: #64748B; margin-top: 2px; }
          .section-title { font-size: 13px; font-weight: bold; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; margin-top: 16px; margin-bottom: 6px; }
          ul { margin: 0; padding-left: 18px; }
          li { margin-bottom: 4px; }
          .muted { color: #94A3B8; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">${project?.name || 'Interior Project'}</div>
          <div class="sub">Weekly Progress Report — ${fmt(report.weekStart)} to ${fmtLong(report.weekEnd)}</div>
        </div>
        ${section('1. Completed Activities & Milestones', report.completedActivities, '#059669')}
        ${section('2. Delayed Milestones & Blockers', report.delayedActivities, '#DC2626')}
        ${section('3. Identified Risks & Quality Notes', report.risks, '#D97706')}
        ${section('4. Next Week Planned Target Scope', report.nextWeekPlan, '#2563EB')}
      </body>
      </html>
    `;
  };

  const handleExportPdf = async (report) => {
    setDownloadingId(report._id);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildReportHtml(report) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        showToast('PDF generated at ' + uri, 'success');
      }
    } catch (e) {
      showToast('Failed to generate PDF: ' + e.message, 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePrint = async (report) => {
    try {
      await Print.printAsync({ html: buildReportHtml(report) });
    } catch (e) {
      showToast('Failed to open print dialog: ' + e.message, 'error');
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
            <Text style={s.headerTitle}>Weekly Progress Reports</Text>
            <Text style={s.headerSub}>Auto-compiled summaries, delays, risks & plans.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {reports.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="document-outline" size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No weekly reports generated yet</Text>
                <Text style={s.emptySub}>Auto-aggregate this week's tasks, delays, risks & next-week plan.</Text>
              </View>
            ) : (
              reports.map((report) => (
                <View key={report._id} style={s.reportCard}>
                  <View style={s.reportHeader}>
                    <Ionicons name="document-text-outline" size={15} color="#2563EB" />
                    <Text style={s.reportHeaderText}>{fmt(report.weekStart)} – {fmtLong(report.weekEnd)}</Text>
                  </View>

                  <View style={s.reportActionsRow}>
                    <TouchableOpacity style={s.actionBtn} onPress={() => handlePrint(report)}>
                      <Ionicons name="print-outline" size={14} color="#334155" />
                      <Text style={s.actionBtnText}>Print</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn, s.actionBtnPrimary]} onPress={() => handleExportPdf(report)} disabled={downloadingId === report._id}>
                      {downloadingId === report._id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="download-outline" size={14} color="#FFFFFF" />}
                      <Text style={[s.actionBtnText, { color: '#FFFFFF' }]}>Export PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionBtnDanger} onPress={() => handleDelete(report)} disabled={deletingId === report._id}>
                      {deletingId === report._id ? <ActivityIndicator size="small" color="#DC2626" /> : <Ionicons name="trash-outline" size={14} color="#DC2626" />}
                    </TouchableOpacity>
                  </View>

                  <View style={s.statRow}>
                    <View style={[s.statTile, { backgroundColor: '#F0FDF4' }]}>
                      <Text style={[s.statNum, { color: '#059669' }]}>{report.completedActivities?.length || 0}</Text>
                      <Text style={s.statLbl}>Completed</Text>
                    </View>
                    <View style={[s.statTile, { backgroundColor: '#FEF2F2' }]}>
                      <Text style={[s.statNum, { color: '#DC2626' }]}>{report.delayedActivities?.length || 0}</Text>
                      <Text style={s.statLbl}>Delays</Text>
                    </View>
                    <View style={[s.statTile, { backgroundColor: '#FFFBEB' }]}>
                      <Text style={[s.statNum, { color: '#D97706' }]}>{report.risks?.length || 0}</Text>
                      <Text style={s.statLbl}>Risks</Text>
                    </View>
                    <View style={[s.statTile, { backgroundColor: '#EFF6FF' }]}>
                      <Text style={[s.statNum, { color: '#2563EB' }]}>{report.nextWeekPlan?.length || 0}</Text>
                      <Text style={s.statLbl}>Next Wk</Text>
                    </View>
                  </View>

                  <ListSection meta={LIST_META.completed} items={report.completedActivities} emptyText="No activities completed this period." />
                  <ListSection meta={LIST_META.delayed} items={report.delayedActivities} emptyText="Zero delays logged. On track!" />
                  <ListSection meta={LIST_META.risks} items={report.risks} emptyText="No critical risks flagged." />
                  <ListSection meta={LIST_META.plan} items={report.nextWeekPlan} emptyText="No plan defined." />
                </View>
              ))
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        <TouchableOpacity style={s.fab} onPress={openModal}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Compile Weekly Report</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.presetRow}>
                <TouchableOpacity style={s.presetChip} onPress={() => setQuickDatePreset('this_week')}>
                  <Text style={s.presetChipText}>This Week</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.presetChip} onPress={() => setQuickDatePreset('last_week')}>
                  <Text style={s.presetChipText}>Last Week</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.presetChip} onPress={() => setQuickDatePreset('last_7_days')}>
                  <Text style={s.presetChipText}>Last 7 Days</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Week Start *</Text>
                  <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={startDate} onChangeText={setStartDate} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Week End *</Text>
                  <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={endDate} onChangeText={setEndDate} />
                </View>
              </View>

              <TouchableOpacity style={s.rescanBtn} onPress={() => autoScanTimeline()}>
                <Ionicons name="sparkles-outline" size={13} color="#2563EB" />
                <Text style={s.rescanBtnText}>Re-scan Live Project</Text>
              </TouchableOpacity>

              <EditableList meta={LIST_META.completed} items={completedActivities} setItems={setCompletedActivities} draft={newCompleted} setDraft={setNewCompleted} placeholder="Add completed task or milestone..." />
              <EditableList meta={LIST_META.delayed} items={delayedActivities} setItems={setDelayedActivities} draft={newDelayed} setDraft={setNewDelayed} placeholder="Add milestone delay or blocker..." />
              <EditableList meta={LIST_META.risks} items={reportRisks} setItems={setReportRisks} draft={newRisk} setDraft={setNewRisk} placeholder="Add site risk or quality note..." />
              <EditableList meta={LIST_META.plan} items={nextWeekPlan} setItems={setNextWeekPlan} draft={newPlan} setDraft={setNewPlan} placeholder="Add next week's target scope..." />

              <TouchableOpacity style={[s.saveBtn, generating && { opacity: 0.7 }]} onPress={handleGenerate} disabled={generating}>
                {generating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Save & Compile Report</Text>}
              </TouchableOpacity>
            </ScrollView>
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

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  emptySub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },

  reportCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10, marginBottom: 10 },
  reportHeaderText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A' },

  reportActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  actionBtnPrimary: { backgroundColor: '#2563EB', borderColor: '#2563EB', flex: 1, justifyContent: 'center' },
  actionBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#334155' },
  actionBtnDanger: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: '#FECACA', justifyContent: 'center', alignItems: 'center' },

  statRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statTile: { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  statNum: { fontSize: 15, fontFamily: 'Inter-Black' },
  statLbl: { fontSize: 8.5, fontFamily: 'Inter-Bold', color: '#64748B', textTransform: 'uppercase', marginTop: 1 },

  sectionTitle: { fontSize: 9.5, fontFamily: 'Inter-Bold', letterSpacing: 0.3 },
  emptyLine: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  bulletRow: { flexDirection: 'row', gap: 5, marginBottom: 2 },
  bulletDot: { fontSize: 12, color: '#94A3B8' },
  bulletText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#334155', flex: 1 },

  fab: {
    position: 'absolute', right: 20, bottom: 30,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },

  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetChip: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center' },
  presetChipText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB' },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A',
  },

  rescanBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12, marginBottom: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  rescanBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB' },

  addItemBtn: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  editableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  editableRowText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', flex: 1 },

  saveBtn: { height: 50, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 8 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

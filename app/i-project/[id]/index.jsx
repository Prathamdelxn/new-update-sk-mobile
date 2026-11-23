import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';
import { queryKeys, useRefreshOnFocus } from '../../context/QueryProvider';
import CategoryNav from './_components/CategoryNav';
import SkeletonList from '../../components/common/SkeletonList';
import { formatCompactCurrency } from '../../utils/common/format';
import { useProjectPermissions } from '../../utils/interior/useProjectPermissions';
import ProjectActionItems from './_components/ProjectActionItems';
import HealthReasonsSheet from './_components/HealthReasonsSheet';

const HEALTH_META = {
  'on-track': { label: 'On Track', color: '#16A34A', bg: '#F0FDF4' },
  'at-risk':  { label: 'At Risk',  color: '#D97706', bg: '#FFFBEB' },
  delayed:    { label: 'Delayed',  color: '#DC2626', bg: '#FEF2F2' },
};

function formatBudget(amount, currency) {
  return formatCompactCurrency(Number(amount) || 0, currency || 'INR');
}

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function InteriorProjectOverviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { showToast } = useToast();
  // Shortcut cards only open tabs the user can view
  const { can: canDo } = useProjectPermissions(id);
  // Health badge -> sheet explaining why the project is At Risk / Delayed
  const [healthOpen, setHealthOpen] = useState(false);

  // Cached per project (see QueryProvider). Edits in the sub-screens (tasks,
  // DPR, ...) mark these stale, so returning here refetches only after a change.
  const queryClient = useQueryClient();
  const projectQuery = useQuery({
    queryKey: queryKeys.interiorProject(id),
    // The projects list already has this project's name / client / status: show it while the full record loads
    placeholderData: () => (queryClient.getQueryData(queryKeys.interiorProjects) || []).find((x) => String(x._id) === String(id)),
    queryFn: async () => {
      const res = await interiorApiClient.get(`/projects/${id}`);
      return res?.success && res?.data ? res.data : null;
    },
    enabled: !!id,
  });
  const metricsQuery = useQuery({
    queryKey: queryKeys.interiorProjectMetrics(id),
    queryFn: async () => {
      const res = await interiorApiClient.get(`/projects/${id}/dashboard`);
      return res?.success && res?.data ? res.data : null;
    },
    enabled: !!id,
  });
  const project = projectQuery.data ?? null;
  const metrics = metricsQuery.data ?? null;
  // Body waits for the real record + metrics; the header / category bar render straight away
  const loading = projectQuery.isPending || projectQuery.isPlaceholderData || metricsQuery.isPending;

  useRefreshOnFocus([queryKeys.interiorProject(id), queryKeys.interiorProjectMetrics(id)]);

  const comingSoon = (label) => showToast(`${label} — coming soon.`, 'success');
  const openTasks = () => router.push(`/i-project/${id}/tasks`);
  const openMilestones = () => router.push(`/i-project/${id}/milestones`);
  const openSnags = () => router.push(`/i-project/${id}/snags`);
  const openRisks = () => router.push(`/i-project/${id}/risks`);
  const openRfis = () => router.push(`/i-project/${id}/rfis`);

  const p = project || {};
  const health = HEALTH_META[p.health] || HEALTH_META['on-track'];
  const taskStats = metrics?.taskStats || { total: 0, completed: 0, remaining: 0, breakdown: {} };
  const milestones = metrics?.milestones || { total: 0, achieved: 0, delayed: 0 };
  const quality = metrics?.quality || { openSnags: 0, openRFIs: 0, criticalRisks: 0 };

  const breakdownRows = [
    { label: 'Backlog', value: taskStats.breakdown?.backlog, color: '#94A3B8' },
    { label: 'Todo', value: taskStats.breakdown?.todo, color: '#60A5FA' },
    { label: 'In Progress', value: taskStats.breakdown?.in_progress, color: '#FBBF24' },
    { label: 'In Review', value: taskStats.breakdown?.in_review, color: '#818CF8' },
    { label: 'Completed', value: taskStats.breakdown?.completed, color: '#10B981' },
  ];

  // Most-used modules, one tap away (the category bar above still lists every module)
  const quickLinks = [
    { label: 'Tasks', icon: 'checkbox-outline', path: 'tasks', perm: 'tasks', color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Drawings', icon: 'document-text-outline', path: 'drawings', perm: 'drawings', color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'BOQ', icon: 'calculator-outline', path: 'boq', perm: 'boq', color: '#0891B2', bg: '#ECFEFF' },
    { label: 'Site Photos', icon: 'images-outline', path: 'photos', perm: 'photos', color: '#DB2777', bg: '#FDF2F8' },
    { label: 'Snags', icon: 'construct-outline', path: 'snags', perm: 'snags', color: '#D97706', bg: '#FFFBEB' },
    { label: 'DPR', icon: 'today-outline', path: 'dpr', perm: 'dpr', color: '#059669', bg: '#ECFDF5' },
    { label: 'Payments', icon: 'card-outline', path: 'payments', perm: 'financials', color: '#16A34A', bg: '#F0FDF4' },
    { label: 'Handover', icon: 'key-outline', path: 'handover', perm: 'handover', color: '#475569', bg: '#F1F5F9' },
  ].filter((q) => canDo(q.perm, 'read'));

  const qualityRows = [
    { label: 'Open snags', value: quality.openSnags, color: '#D97706', perm: 'snags', open: openSnags },
    { label: 'Open RFIs', value: quality.openRFIs, color: '#2563EB', perm: 'rfis', open: openRfis },
    { label: 'Critical risks', value: quality.criticalRisks, color: '#DC2626', perm: 'risks', open: openRisks },
  ];


  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        {/* Slim header (same look as the module screens): back · name + status, one line of facts */}
        <View style={[s.banner, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            {p.name ? (
              <>
                <Text style={s.projectTitle} numberOfLines={1}>{p.name}</Text>
                <Text style={s.projectClient} numberOfLines={1}>
                  {[p.code, p.client || 'No client', p.location?.city].filter(Boolean).join(' · ')}
                </Text>
              </>
            ) : (
              <>
                <View style={[s.headerBar, { width: '62%', height: 15 }]} />
                <View style={[s.headerBar, { width: '42%', height: 11, marginTop: 7 }]} />
              </>
            )}
          </View>
          {!!p.name && (p.status && p.status !== 'active' ? (
            <View style={[s.badge, { backgroundColor: '#FFFBEB' }]}>
              <Text style={[s.badgeText, { color: '#D97706' }]}>On Hold</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.badge, s.badgeTappable, { backgroundColor: health.bg, borderColor: health.color + '40' }]}
              onPress={() => setHealthOpen(true)}
              activeOpacity={0.75}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {p.health && p.health !== 'on-track' && <Ionicons name="warning-outline" size={12} color={health.color} />}
              <Text style={[s.badgeText, { color: health.color }]}>{health.label}</Text>
              <Ionicons name="chevron-forward" size={12} color={health.color} />
            </TouchableOpacity>
          ))}
        </View>

        <CategoryNav projectId={id} comingSoon={comingSoon} />

        {loading ? <SkeletonList variant="home" /> : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* Progress card: one headline number (progress) + bar, then 3 secondary figures */}
          <View style={s.card}>
            <View style={s.progressHead}>
              <Text style={s.progressLabel}>Overall progress</Text>
              {!!p.endDate && <Text style={s.progressDue}>Due {formatDate(p.endDate)}</Text>}
            </View>
            <Text style={s.progressValue}>{p.progress || 0}%</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${p.progress || 0}%`, backgroundColor: '#10B981' }]} />
            </View>
            <View style={s.factsRow}>
              <View style={s.factCell}>
                <Text style={s.factValue} numberOfLines={1} adjustsFontSizeToFit>{formatBudget(p.budget?.amount, p.budget?.currency)}</Text>
                <Text style={s.factLabel}>Contract</Text>
              </View>
              <TouchableOpacity style={s.factCell} onPress={() => canDo('tasks', 'read') && openTasks()} activeOpacity={0.7}>
                <Text style={s.factValue}>{taskStats.completed}/{taskStats.total}</Text>
                <Text style={s.factLabel}>Tasks done</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.factCell} onPress={() => canDo('milestones', 'read') && openMilestones()} activeOpacity={0.7}>
                <Text style={[s.factValue, milestones.delayed > 0 && { color: '#DC2626' }]}>{milestones.achieved}/{milestones.total}</Text>
                <Text style={[s.factLabel, milestones.delayed > 0 && { color: '#DC2626' }]}>
                  {milestones.delayed > 0 ? `${milestones.delayed} delayed` : 'Milestones'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* What needs doing: next steps across the project, most urgent first */}
          <ProjectActionItems projectId={id} project={p} />

          {/* Quick access */}
          {quickLinks.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Quick access</Text>
              <View style={s.quickGrid}>
                {quickLinks.map((q) => (
                  <TouchableOpacity key={q.path} style={s.quickTile} onPress={() => router.push(`/i-project/${id}/${q.path}`)} activeOpacity={0.8}>
                    <View style={[s.quickIcon, { backgroundColor: q.bg }]}>
                      <Ionicons name={q.icon} size={22} color={q.color} />
                    </View>
                    <Text style={s.quickLabel} numberOfLines={1}>{q.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Needs attention */}
          <Text style={s.sectionTitle}>Needs attention</Text>
          <View style={s.card}>
            {qualityRows.map((row, i) => (
              <TouchableOpacity
                key={row.label}
                style={[s.qualityRow, i === qualityRows.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => canDo(row.perm, 'read') && row.open()}
                activeOpacity={0.7}
              >
                <View style={[s.qualityDot, { backgroundColor: row.color }]} />
                <Text style={s.qualityLabel}>{row.label}</Text>
                <View style={[s.countPill, { backgroundColor: row.value > 0 ? row.color + '18' : '#F1F5F9' }]}>
                  <Text style={[s.countPillText, { color: row.value > 0 ? row.color : '#94A3B8' }]}>{row.value || 0}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Task breakdown */}
          <Text style={s.sectionTitle}>Tasks by status</Text>
          <View style={s.card}>
            {breakdownRows.map((row, i) => (
              <View key={row.label} style={i < breakdownRows.length - 1 && { marginBottom: 14 }}>
                <View style={s.breakdownTopRow}>
                  <Text style={s.breakdownLabel}>{row.label}</Text>
                  <Text style={s.breakdownValue}>{row.value || 0}</Text>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${((row.value || 0) / (taskStats.total || 1)) * 100}%`, backgroundColor: row.color }]} />
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
        )}
        <HealthReasonsSheet
          visible={healthOpen}
          onClose={() => setHealthOpen(false)}
          projectId={id}
          project={p}
          healthLabel={health.label}
        />
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  projectTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },
  projectClient: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  headerBar: { borderRadius: 6, backgroundColor: '#E8EDF3' },
  badgeText: { fontSize: 12.5, fontFamily: 'Inter-Bold' },
  badgeTappable: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1 },

  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  progressDue: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B' },
  progressValue: { fontSize: 24, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 4 },
  factsRow: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  factCell: { flex: 1, minWidth: 0 },
  factValue: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  factLabel: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },

  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden', marginTop: 8 },
  progressFill: { height: '100%', borderRadius: 3 },

  sectionTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 20, marginBottom: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 8 },
  quickTile: { width: '25%', alignItems: 'center', paddingVertical: 8, gap: 6 },
  quickIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#334155' },

  breakdownTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  breakdownLabel: { fontSize: 13.5, fontFamily: 'Inter-Medium', color: '#334155' },
  breakdownValue: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },

  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  qualityDot: { width: 10, height: 10, borderRadius: 5 },
  qualityLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A' },
  countPill: { minWidth: 28, height: 24, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  countPillText: { fontSize: 13, fontFamily: 'Inter-Bold' },
});

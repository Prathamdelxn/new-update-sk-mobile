import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';
import CategoryNav from './_components/CategoryNav';

const HEALTH_META = {
  'on-track': { label: 'On Track', color: '#16A34A', bg: '#F0FDF4' },
  'at-risk':  { label: 'At Risk',  color: '#D97706', bg: '#FFFBEB' },
  delayed:    { label: 'Delayed',  color: '#DC2626', bg: '#FEF2F2' },
};

function formatBudget(amount) {
  if (!amount) return '₹0';
  if (amount >= 10000000) return `₹ ${(amount / 10000000).toFixed(2)} Cr`;
  return `₹ ${(amount / 100000).toFixed(2)} Lakh`;
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

  const [project, setProject] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, metricsRes] = await Promise.all([
        interiorApiClient.get(`/projects/${id}`),
        interiorApiClient.get(`/projects/${id}/dashboard`),
      ]);
      setProject(projRes?.success && projRes?.data ? projRes.data : null);
      setMetrics(metricsRes?.success && metricsRes?.data ? metricsRes.data : null);
    } catch (e) {
      console.error('Failed to load project overview', e);
      setProject(null);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const comingSoon = (label) => showToast(`${label} — coming soon.`, 'success');
  const openTasks = () => router.push(`/i-project/${id}/tasks`);
  const openMilestones = () => router.push(`/i-project/${id}/milestones`);
  const openSnags = () => router.push(`/i-project/${id}/snags`);
  const openRisks = () => router.push(`/i-project/${id}/risks`);
  const openRfis = () => router.push(`/i-project/${id}/rfis`);

  if (loading) {
    return (
      <View style={s.outerContainer}>
        <SafeAreaView style={s.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </SafeAreaView>
      </View>
    );
  }

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

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        {/* Banner */}
        <View style={[s.banner, { paddingTop: insets.top + 12 }]}>
          <View style={s.breadcrumbRow}>
            <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="chevron-back" size={16} color="#94A3B8" />
              <Text style={s.breadcrumbText}>Projects</Text>
            </TouchableOpacity>
            <Text style={s.breadcrumbCode}>{p.code}</Text>
          </View>

          <View style={s.titleRow}>
            <View style={s.titleIconBox}>
              <Ionicons name="folder-outline" size={20} color="#2563EB" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.projectTitle} numberOfLines={1}>{p.name || 'Untitled Project'}</Text>
              <Text style={s.projectClient} numberOfLines={1}>Client: {p.client || 'Client'}</Text>
            </View>
          </View>

          <View style={s.badgeRow}>
            <View style={[s.badge, { backgroundColor: health.bg }]}>
              <Text style={[s.badgeText, { color: health.color }]}>{health.label}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: p.status === 'active' ? '#F0FDF4' : '#FFFBEB' }]}>
              <Text style={[s.badgeText, { color: p.status === 'active' ? '#16A34A' : '#D97706' }]}>
                {p.status === 'active' ? 'Active' : 'On Hold'}
              </Text>
            </View>
          </View>

          <View style={s.metaRow}>
            <View style={s.metaItem}>
              <Ionicons name="location-outline" size={13} color="#2563EB" />
              <Text style={s.metaText}>{p.location?.city ? `${p.location.city}, ${p.location.country || 'India'}` : 'Location not set'}</Text>
            </View>
            <View style={s.metaItem}>
              <Ionicons name="calendar-outline" size={13} color="#2563EB" />
              <Text style={s.metaText}>
                {p.startDate && p.endDate ? `${formatDate(p.startDate)} - ${formatDate(p.endDate)}` : 'Dates not set'}
              </Text>
            </View>
            <View style={s.metaItem}>
              <Ionicons name="business-outline" size={13} color="#2563EB" />
              <Text style={s.metaText}>{p.type || 'General Fit-out'}</Text>
            </View>
          </View>
        </View>

        <CategoryNav projectId={id} comingSoon={comingSoon} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* Top stat cards */}
          <View style={s.statsGrid}>
            <View style={s.statCard}>
              <View style={s.statTopRow}>
                <Text style={s.statLabel}>OVERALL PROGRESS</Text>
                <Ionicons name="trending-up-outline" size={14} color="#10B981" />
              </View>
              <Text style={s.statValue}>{p.progress || 0}%</Text>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${p.progress || 0}%`, backgroundColor: '#10B981' }]} />
              </View>
            </View>

            <TouchableOpacity style={s.statCard} onPress={openTasks}>
              <View style={s.statTopRow}>
                <Text style={s.statLabel}>TASKS STATUS</Text>
                <Ionicons name="checkbox-outline" size={14} color="#3B82F6" />
              </View>
              <Text style={s.statValue}>{taskStats.completed}/{taskStats.total}</Text>
              <Text style={s.statSub}>{taskStats.remaining} remaining</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.statCard} onPress={openMilestones}>
              <View style={s.statTopRow}>
                <Text style={s.statLabel}>MILESTONES</Text>
                <Ionicons name="time-outline" size={14} color="#D97706" />
              </View>
              <Text style={s.statValue}>{milestones.achieved}/{milestones.total}</Text>
              {milestones.delayed > 0 && <Text style={[s.statSub, { color: '#DC2626' }]}>{milestones.delayed} delayed</Text>}
            </TouchableOpacity>

            <View style={s.statCard}>
              <View style={s.statTopRow}>
                <Text style={s.statLabel}>CONTRACT BUDGET</Text>
                <Ionicons name="cash-outline" size={14} color="#6366F1" />
              </View>
              <Text style={s.statValue}>{formatBudget(p.budget?.amount)}</Text>
              <Text style={s.statSub}>Total allocated value</Text>
            </View>
          </View>

          {/* Scope Breakdown */}
          <Text style={s.sectionTitle}>Scope Breakdown</Text>
          <View style={s.card}>
            {breakdownRows.map((row) => (
              <View key={row.label} style={{ marginBottom: 12 }}>
                <View style={s.breakdownTopRow}>
                  <Text style={s.breakdownLabel}>{row.label}</Text>
                  <Text style={s.breakdownValue}>{row.value || 0} tasks</Text>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${((row.value || 0) / (taskStats.total || 1)) * 100}%`, backgroundColor: row.color }]} />
                </View>
              </View>
            ))}
          </View>

          {/* Quality & Risk */}
          <Text style={s.sectionTitle}>Quality & Risk Indicators</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.qualityRow} onPress={openSnags}>
              <Text style={s.qualityLabel}>Open Snags</Text>
              <View style={[s.qualityPill, { backgroundColor: '#FFFBEB' }]}>
                <Text style={[s.qualityPillText, { color: '#D97706' }]}>{quality.openSnags} snags</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.qualityRow} onPress={openRfis}>
              <Text style={s.qualityLabel}>Open RFIs</Text>
              <View style={[s.qualityPill, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[s.qualityPillText, { color: '#2563EB' }]}>{quality.openRFIs} RFIs</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[s.qualityRow, { borderBottomWidth: 0 }]} onPress={openRisks}>
              <Text style={s.qualityLabel}>Critical Risks</Text>
              <View style={[s.qualityPill, { backgroundColor: '#FEF2F2' }]}>
                <Text style={[s.qualityPillText, { color: '#DC2626' }]}>{quality.criticalRisks} risks</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Site Log */}
          <Text style={s.sectionTitle}>Site Log Feed</Text>
          <View style={s.card}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={s.logDot} />
              <View style={{ flex: 1 }}>
                <Text style={s.logTitle}>Project initialized</Text>
                <Text style={s.logSub}>PM set default roles and configuration</Text>
              </View>
            </View>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  banner: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 10 },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  breadcrumbText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },
  breadcrumbCode: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#0F172A' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  projectTitle: { fontSize: 18, fontFamily: 'Inter-Black', color: '#0F172A' },
  projectClient: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 1 },

  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontFamily: 'Inter-Bold' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 4 },
  statTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.4 },
  statValue: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A' },
  statSub: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 4 },

  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden', marginTop: 8 },
  progressFill: { height: '100%', borderRadius: 3 },

  sectionTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },

  breakdownTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  breakdownLabel: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  breakdownValue: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  qualityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  qualityLabel: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' },
  qualityPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  qualityPillText: { fontSize: 11, fontFamily: 'Inter-Bold' },

  logDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginTop: 4 },
  logTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  logSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },
});

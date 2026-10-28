import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { BarChart, PieChart, LineChart } from 'react-native-gifted-charts';
import { useAuth } from '../../context/AuthContext';
import HeaderNotification from '../../components/HeaderNotification';
import interiorApiClient from '../../services/interiorApiClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, useRefreshOnFocus } from '../../context/QueryProvider';
import { useInteriorPermissions } from '../../utils/interior/useInteriorPermissions';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const STATUS_META = {
  Ongoing:              { color: '#2563EB', bg: '#DBEAFE' },
  Planning:             { color: '#7C3AED', bg: '#F5F3FF' },
  Completed:            { color: '#16A34A', bg: '#F0FDF4' },
  'On Hold':            { color: '#D97706', bg: '#FFFBEB' },
  Cancelled:            { color: '#DC2626', bg: '#FEF2F2' },
  Initialized:          { color: '#64748B', bg: '#F8FAFC' },
  'Site Survey':        { color: '#0891B2', bg: '#ECFEFF' },
  'Under Snagging':     { color: '#EA580C', bg: '#FFF7ED' },
  'Snagging Completed': { color: '#16A34A', bg: '#F0FDF4' },
  'Pending Handover':   { color: '#7C3AED', bg: '#F5F3FF' },
  'Handover Rejected':  { color: '#DC2626', bg: '#FEF2F2' },
  'Handover Completed': { color: '#16A34A', bg: '#F0FDF4' },
};

const RISK_META = {
  Critical: { color: '#DC2626', bg: '#FEF2F2' },
  Active:   { color: '#D97706', bg: '#FFFBEB' },
  Monitored:{ color: '#2563EB', bg: '#DBEAFE' },
  Resolved: { color: '#16A34A', bg: '#F0FDF4' },
};

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export default function DashboardScreen() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceActive, setAttendanceActive] = useState(false);
  const isAdmin = user?.role?.name === 'Admin' || user?.role === 'Admin';
  const isInteriorUser = user?.organization?.industryType === 'interior';
  // The interior dashboard shows org-wide figures → Dashboard: View (admins always)
  const { hasPermission: hasInteriorPermission, navAccess: interiorNav } = useInteriorPermissions();
  const canSeeInteriorDashboard = hasInteriorPermission('dashboard', 'read');

  // Interior dashboard is cached (see QueryProvider): switching back to this
  // tab reuses loaded data and only refetches once it is stale or changed.
  const queryClient = useQueryClient();
  const interiorQuery = useQuery({
    queryKey: queryKeys.interiorDashboard,
    queryFn: async () => {
      try {
        const res = await interiorApiClient.get('/dashboard');
        return res?.success && res?.data ? res.data : null;
      } catch (e) {
        // Refused → this role has no Dashboard access (saved user can be briefly out of date)
        if (e?.status === 403) return { forbidden: true };
        throw e;
      }
    },
    enabled: isInteriorUser && canSeeInteriorDashboard,
  });
  const interiorData = interiorQuery.data ?? null;
  useRefreshOnFocus(isInteriorUser ? [queryKeys.interiorDashboard] : []);

  const fetchInteriorDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.interiorDashboard });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);
  const fetchDashboard = useCallback(async (isRefresh = false) => {
    // Interior sessions carry an interior-os JWT, not a construction one —
    // calling the construction API with it 401s and triggers the global
    // auto-logout interceptor, bouncing the user back to login.
    // The interior dashboard loads through its cached query; only an explicit
    // refresh forces a refetch.
    if (isInteriorUser) {
      if (isRefresh) return fetchInteriorDashboard(true);
      return;
    }

    // Do not call construction API if user object is not yet loaded
    if (!user) return;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [resDash, resAtt] = await Promise.all([
        fetch(`${API_BASE_URL}/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/attendance/today`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (resDash.ok) setData(await resDash.json());
      if (resAtt.ok) {
        const attData = await resAtt.json();
        setAttendanceActive(attData.active);
      }
    } catch (e) {
      console.error('Dashboard fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, user, isInteriorUser, fetchInteriorDashboard]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (isInteriorUser ? canSeeInteriorDashboard && interiorQuery.isPending : loading) {
    return (
      <View style={s.outerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
        <View style={s.bgBase} />
        <SafeAreaView style={s.container} edges={['top']}>
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const ps     = data?.projectStats  || { total: 0, statusCounts: {} };
  const ts     = data?.taskStats     || { total: 0, completed: 0, overdue: 0, dueToday: 0, dueTodayList: [] };
  const rs     = data?.riskStats     || { total: 0, statusCounts: {}, criticalRisks: [] };
  const recent = data?.recentProjects || [];

  const taskPct = ts.total > 0 ? Math.round((ts.completed / ts.total) * 100) : 0;

  const barData = Object.entries(ps.statusCounts)
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({
      value,
      label: label.length > 9 ? label.slice(0, 8) + '…' : label,
      frontColor: STATUS_META[label]?.color || '#94A3B8',
      topLabelComponent: () => (
        <Text style={{ fontSize: 9, color: '#64748B', marginBottom: 2 }}>{value}</Text>
      ),
    }));

  const taskPie = [
    { value: ts.completed,                           color: '#2563EB' },
    { value: Math.max(ts.total - ts.completed, 0),   color: '#E2E8F0' },
  ].filter(d => d.value > 0);

  const riskPie = Object.entries(rs.statusCounts)
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({
      value, label,
      color: RISK_META[label]?.color || '#94A3B8',
    }));

  const isInterior = user?.organization?.industryType === 'interior';

  if (isInterior && (!canSeeInteriorDashboard || interiorData?.forbidden)) {
    return (
      <View style={s.outerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
        <View style={s.bgBase} />
        <SafeAreaView style={s.container} edges={['bottom']}>
          <View style={[s.header, { paddingTop: insets.top + 12, backgroundColor: '#DBEAFE', borderBottomColor: '#DBEAFE' }]}>
            <View>
              <Text style={[s.headerGreeting, { color: '#1D4ED8' }]}>Good {getTimeOfDay()}, {user?.firstName || user?.name?.split(' ')[0] || 'there'}</Text>
              <Text style={s.pageTitle}>Interior Workspace</Text>
            </View>
            <HeaderNotification />
          </View>
          <View style={[s.card, { alignItems: 'center', paddingVertical: 36, margin: 16 }]}>
            <Ionicons name="grid-outline" size={34} color="#94A3B8" />
            <Text style={{ fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 10 }}>Dashboard not included in your role</Text>
            <Text style={{ fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center', marginTop: 4, marginBottom: 14 }}>
              Open the sections you work in:
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {interiorNav.projects && (
                <TouchableOpacity style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: '#2563EB' }} onPress={() => router.push('/i-project')}>
                  <Text style={{ color: '#FFFFFF', fontFamily: 'Inter-Bold', fontSize: 13 }}>Projects</Text>
                </TouchableOpacity>
              )}
              {interiorNav.crm && (
                <TouchableOpacity style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE' }} onPress={() => router.push('/crm')}>
                  <Text style={{ color: '#2563EB', fontFamily: 'Inter-Bold', fontSize: 13 }}>CRM</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isInterior) {
    const kpis = interiorData?.kpis || {
      totalLeads: 0, newLeads: 0, activeLeads: 0, wonLeads: 0, activeProjects: 0, openSnags: 0,
    };
    // Same layout as the web dashboard: shown whenever there is data (leads count too)
    const isEmpty = !interiorData;
    const progressTrend = interiorData?.progressTrend || [];
    const projectHealth = interiorData?.projectHealth || [];
    const leadsPipeline = interiorData?.leadsPipeline || [];
    const procurementData = interiorData?.procurementData || [];
    const topProjects = interiorData?.topProjects || [];
    const recentActivities = interiorData?.recentActivities || [];

    const pct = (v) => Math.min(100, Math.max(0, Number(v) || 0));
    const plannedLineData = progressTrend.map((p) => ({ value: pct(p.planned), label: p.month }));
    const actualLineData = progressTrend.map((p) => ({ value: pct(p.actual), label: p.month }));
    // Only non-empty slices (zero slices used to break the ring); grey ring when there are no projects
    const nonEmptyHealth = projectHealth.filter((h) => h.value > 0).map((h) => ({ value: h.value, color: h.color, label: h.name }));
    const healthTotal = nonEmptyHealth.reduce((sum, h) => sum + h.value, 0);
    const healthDonutData = nonEmptyHealth.length > 0 ? nonEmptyHealth : [{ value: 1, color: '#E2E8F0', label: 'No Projects' }];
    const shortStage = (st) => ({ 'New Leads': 'New', 'Follow-ups': 'Follow', 'Site Visits': 'Site', Requirements: 'Reqs', Quotations: 'Quotes', 'Won Projects': 'Won' }[st] || st);
    const pipelineBars = leadsPipeline.map((p) => ({ value: p.count || 0, label: shortStage(p.stage), frontColor: '#3B82F6' }));
    const procurementBars = procurementData.map((p) => ({ value: p.count || 0, label: p.status, frontColor: '#6366F1' }));
    const barMax = (bars) => Math.max(1, ...bars.map((b) => b.value)) + 1;
    const healthBarColor = (h) => (h === 'green' ? '#16A34A' : h === 'yellow' ? '#D97706' : '#DC2626');

    return (
      <View style={s.outerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
        <View style={s.bgBase} />
        <SafeAreaView style={s.container} edges={['bottom']}>
          <View style={[s.header, { paddingTop: insets.top + 12, backgroundColor: '#DBEAFE', borderBottomColor: '#DBEAFE' }]}>
            <View>
              <Text style={[s.headerGreeting, { color: '#1D4ED8' }]}>Good {getTimeOfDay()}, {user?.firstName || user?.name?.split(' ')[0] || 'there'}</Text>
              <Text style={s.pageTitle}>Interior Workspace</Text>
            </View>
            <HeaderNotification />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchInteriorDashboard(true)} tintColor="#fff" colors={['#2563EB']} />
            }
          >
            {/* Stats */}
            <SectionLabel title="Summary" />
            <View style={s.interiorStatsGrid}>
              <InteriorStatCard icon="people-outline" iconBg="#EFF6FF" iconColor="#2563EB" label="Total Leads" value={kpis.totalLeads || 0} />
              <InteriorStatCard icon="person-add-outline" iconBg="#F5F3FF" iconColor="#7C3AED" label="New Leads" value={kpis.newLeads || 0} />
              <InteriorStatCard icon="trending-up-outline" iconBg="#FFFBEB" iconColor="#D97706" label="Active Pipeline" value={kpis.activeLeads || 0} />
              <InteriorStatCard icon="checkmark-circle-outline" iconBg="#F0FDF4" iconColor="#16A34A" label="Won Projects" value={kpis.wonLeads || 0} />
              <InteriorStatCard icon="folder-outline" iconBg="#F0F9FF" iconColor="#0284C7" label="Active Projects" value={kpis.activeProjects || 0} />
              <InteriorStatCard icon="bug-outline" iconBg="#FEF2F2" iconColor="#DC2626" label="Open Snags" value={kpis.openSnags || 0} />
            </View>

            {isEmpty ? (
              <View style={[s.card, { alignItems: 'center', paddingVertical: 40, marginTop: 12 }]}>
                <Text style={{ fontSize: 32, marginBottom: 12 }}>🏢</Text>
                <Text style={{ fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 6 }}>
                  {interiorQuery.isError ? 'Could not load dashboard' : 'No Active Projects'}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' }}>
                  {interiorQuery.isError
                    ? 'Pull down to try again.'
                    : 'There are currently no active projects found in your workspace.'}
                </Text>
              </View>
            ) : (
              <>

                {/* Progress Trend */}
                {actualLineData.length > 0 && (
                  <>
                    <SectionLabel title="Progress Trend" />
                    <View style={s.card}>
                      <View style={s.chartHeaderRow}>
                        <Text style={s.chartHeaderTitle}>Planned vs Actual (%)</Text>
                        <Text style={s.chartHeaderTag}>Last 6 Months</Text>
                      </View>
                      {/* Legend: colour + name side by side (same as the web) */}
                      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 10 }}>
                        <View style={s.trendLegend}>
                          <View style={[s.trendLegendLine, { backgroundColor: '#2563EB' }]} />
                          <Text style={s.trendLegendText}>Planned</Text>
                        </View>
                        <View style={s.trendLegend}>
                          <View style={[s.trendLegendLine, { backgroundColor: '#16A34A' }]} />
                          <Text style={s.trendLegendText}>Actual</Text>
                        </View>
                      </View>
                      <LineChart
                        data={plannedLineData}
                        data2={actualLineData}
                        areaChart
                        height={140}
                        spacing={44}
                        initialSpacing={10}
                        maxValue={100}
                        color1="#2563EB"
                        color2="#16A34A"
                        thickness={2.5}
                        startFillColor1="#2563EB"
                        startFillColor2="#16A34A"
                        startOpacity={0.2}
                        endFillColor1="#2563EB"
                        endFillColor2="#16A34A"
                        endOpacity={0.02}
                        hideRules
                        hideDataPoints
                        xAxisColor="#E2E8F0"
                        yAxisThickness={0}
                        yAxisTextStyle={{ fontSize: 10, color: '#94A3B8', fontFamily: 'Inter-Regular' }}
                        xAxisLabelTextStyle={{ fontSize: 10, color: '#94A3B8', fontFamily: 'Inter-Regular' }}
                        noOfSections={3}
                        yAxisLabelSuffix="%"
                        isAnimated
                        animationDuration={600}
                      />
                    </View>
                  </>
                )}

                {/* Project Health */}
                {projectHealth.length > 0 && (
                  <>
                    <SectionLabel title="Project Health" />
                    <View style={[s.card, s.chartRow]}>
                      <PieChart
                        donut
                        data={healthDonutData}
                        radius={64}
                        innerRadius={44}
                        centerLabelComponent={() => (
                          <View style={{ alignItems: 'center' }}>
                            <Text style={s.donutNum}>{healthTotal}</Text>
                            <Text style={s.donutLbl}>projects</Text>
                          </View>
                        )}
                        isAnimated
                        animationDuration={600}
                      />
                      <View style={s.legendBlock}>
                        {projectHealth.map((h) => (
                          <LegendItem key={h.name} color={h.color} label={h.name} value={`${h.value}`} />
                        ))}
                      </View>
                    </View>
                  </>
                )}

                {/* CRM Lead Pipeline (same as web) */}
                {pipelineBars.length > 0 && (
                  <>
                    <SectionLabel title="CRM Lead Pipeline" />
                    <View style={s.card}>
                      <BarChart
                        data={pipelineBars}
                        barWidth={24}
                        spacing={18}
                        roundedTop
                        hideRules
                        xAxisThickness={1}
                        xAxisColor="#E2E8F0"
                        yAxisThickness={0}
                        yAxisTextStyle={{ fontSize: 10, color: '#94A3B8', fontFamily: 'Inter-Regular' }}
                        xAxisLabelTextStyle={{ fontSize: 9, color: '#94A3B8', fontFamily: 'Inter-Regular' }}
                        noOfSections={4}
                        maxValue={barMax(pipelineBars)}
                        isAnimated
                        animationDuration={500}
                        backgroundColor="transparent"
                      />
                    </View>
                  </>
                )}

                {/* Procurement (same as web) */}
                {procurementBars.length > 0 && (
                  <>
                    <SectionLabel title="Procurement" />
                    <View style={s.card}>
                      <BarChart
                        data={procurementBars}
                        barWidth={26}
                        spacing={20}
                        roundedTop
                        hideRules
                        xAxisThickness={1}
                        xAxisColor="#E2E8F0"
                        yAxisThickness={0}
                        yAxisTextStyle={{ fontSize: 10, color: '#94A3B8', fontFamily: 'Inter-Regular' }}
                        xAxisLabelTextStyle={{ fontSize: 9, color: '#94A3B8', fontFamily: 'Inter-Regular' }}
                        noOfSections={4}
                        maxValue={barMax(procurementBars)}
                        isAnimated
                        animationDuration={500}
                        backgroundColor="transparent"
                      />
                    </View>
                  </>
                )}

                {/* Top Projects — with the completion bar, like the web */}
                <SectionLabel title="Top Projects" />
                {topProjects.length > 0 ? (
                  <View style={s.listCard}>
                    {topProjects.map((p, i) => (
                      <View key={p.id || i} style={[s.topProjectRow, i === topProjects.length - 1 && { borderBottomWidth: 0 }]}>
                        <View style={s.topProjectHead}>
                          <Text style={[s.alertTitle, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
                          <View style={[s.alertBadge, { backgroundColor: healthBarColor(p.health) + '18' }]}>
                            <Text style={[s.alertBadgeText, { color: healthBarColor(p.health) }]}>
                              {p.health === 'green' ? 'On Track' : p.health === 'yellow' ? 'At Risk' : 'Delayed'}
                            </Text>
                          </View>
                        </View>
                        <View style={s.topProjectBarRow}>
                          <View style={s.topProjectTrack}>
                            <View style={[s.topProjectFill, { width: `${Math.max(0, Math.min(100, p.progress || 0))}%`, backgroundColor: healthBarColor(p.health) }]} />
                          </View>
                          <Text style={s.topProjectPct}>{p.progress || 0}%</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={s.card}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' }}>
                      No projects yet.
                    </Text>
                  </View>
                )}

                {/* Recent Activity */}
                {recentActivities.length > 0 && (
                  <>
                    <SectionLabel title="Recent Activity" />
                    <View style={s.listCard}>
                      {recentActivities.map((a, i) => (
                        <AlertRow
                          key={i}
                          last={i === recentActivities.length - 1}
                          icon="ellipse"
                          iconColor="#2563EB"
                          iconBg="#EFF6FF"
                          title={a.action}
                          subtitle={`${a.project} · ${a.time}`}
                        />
                      ))}
                    </View>
                  </>
                )}
              </>
            )}


            <View style={{ height: 100 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <View style={s.bgBase} />
      <SafeAreaView style={s.container} edges={['bottom']}>

        {/* ── Header ── */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={s.headerGreeting}>Good {getTimeOfDay()}, {user?.name?.split(' ')[0] || 'there'}</Text>
            <Text style={s.pageTitle}>Dashboard</Text>
          </View>
          <View style={s.headerRight}>
            {!isAdmin && (
              <TouchableOpacity 
                style={[s.attendanceBtn, attendanceActive ? s.btnOnline : s.btnOffline]}
                onPress={() => router.push('/attendance-module')}
              >
                <View style={[s.statusDot, { backgroundColor: attendanceActive ? '#16A34A' : '#DC2626' }]} />
                <Text style={[s.attendanceBtnText, { color: attendanceActive ? '#16A34A' : '#DC2626' }]}>
                  {attendanceActive ? 'Online' : 'Offline'}
                </Text>
              </TouchableOpacity>
            )}
            <View style={s.bellScale}>
              <HeaderNotification />
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchDashboard(true)}
              tintColor="#fff"
              colors={['#2563EB']}
            />
          }
        >

          {/* ── Stats ── */}
          <SectionLabel title="Summary" />
          <View style={s.statsRow}>
            <StatTile icon="folder-outline"       iconBg="#DBEAFE"  iconColor="#2563EB" label="Projects"  value={ps.total} />
            <View style={s.statDivider} />
            <StatTile icon="list-outline"         iconBg="#F5F3FF"  iconColor="#7C3AED" label="Tasks"     value={ts.total} />
            <View style={s.statDivider} />
            <StatTile icon="today-outline"        iconBg="#FFFBEB"  iconColor="#D97706" label="Due Today" value={ts.dueToday} />
            <View style={s.statDivider} />
            <StatTile icon="alert-circle-outline" iconBg="#FEF2F2"  iconColor="#DC2626" label="Overdue"   value={ts.overdue} />
          </View>

          {/* ── Task progress ── */}
          {ts.total > 0 && (
            <>
              <SectionLabel title="Task Progress" />
              <View style={s.card}>
                <View style={s.progressTopRow}>
                  <View>
                    <Text style={s.progressTitle}>Tasks Completed</Text>
                    <Text style={s.progressSub}>{ts.completed} of {ts.total} tasks</Text>
                  </View>
                  <Text style={s.progressPct}>{taskPct}%</Text>
                </View>
                <View style={s.trackBg}>
                  <View style={[s.trackFill, { width: `${taskPct}%` }]} />
                </View>
                <View style={s.progressDots}>
                  <ProgressDot color="#2563EB" label={`${ts.completed} Completed`} />
                  <ProgressDot color="#DC2626" label={`${ts.overdue} Overdue`} />
                  <ProgressDot color="#D97706" label={`${ts.dueToday} Due Today`} />
                </View>
              </View>
            </>
          )}

          {/* ── Projects by Status bar chart ── */}
          {barData.length > 0 && (
            <>
              <SectionLabel title="Projects by Status" />
              <View style={s.card}>
                <BarChart
                  data={barData}
                  barWidth={22}
                  spacing={16}
                  roundedTop
                  hideRules
                  xAxisThickness={1}
                  xAxisColor="#E2E8F0"
                  yAxisThickness={0}
                  yAxisTextStyle={{ fontSize: 10, color: '#94A3B8', fontFamily: 'Inter-Regular' }}
                  xAxisLabelTextStyle={{ fontSize: 9, color: '#94A3B8', fontFamily: 'Inter-Regular' }}
                  noOfSections={4}
                  maxValue={Math.max(...barData.map(d => d.value)) + 1}
                  isAnimated
                  animationDuration={500}
                  backgroundColor="transparent"
                />
              </View>
            </>
          )}

          {/* ── Task completion donut ── */}
          {taskPie.length > 0 && (
            <>
              <SectionLabel title="Task Completion" />
              <View style={[s.card, s.chartRow]}>
                <PieChart
                  donut
                  data={taskPie}
                  radius={68}
                  innerRadius={48}
                  centerLabelComponent={() => (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={s.donutNum}>{taskPct}%</Text>
                      <Text style={s.donutLbl}>done</Text>
                    </View>
                  )}
                  isAnimated
                  animationDuration={600}
                />
                <View style={s.legendBlock}>
                  <LegendItem color="#2563EB" label="Completed" value={ts.completed} />
                  <LegendItem color="#E2E8F0" label="Remaining"  value={ts.total - ts.completed} dim />
                  <LegendItem color="#DC2626" label="Overdue"    value={ts.overdue} />
                  <LegendItem color="#D97706" label="Due Today"  value={ts.dueToday} />
                </View>
              </View>
            </>
          )}

          {/* ── Risk distribution donut ── */}
          {riskPie.length > 0 && (
            <>
              <SectionLabel title="Risk Overview" />
              <View style={[s.card, s.chartRow]}>
                <PieChart
                  donut
                  data={riskPie}
                  radius={68}
                  innerRadius={48}
                  centerLabelComponent={() => (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={s.donutNum}>{rs.total}</Text>
                      <Text style={s.donutLbl}>total</Text>
                    </View>
                  )}
                  isAnimated
                  animationDuration={600}
                />
                <View style={s.legendBlock}>
                  {riskPie.map(r => (
                    <LegendItem key={r.label} color={r.color} label={r.label} value={r.value} />
                  ))}
                </View>
              </View>
            </>
          )}

          {/* ── Due today ── */}
          {ts.dueTodayList.length > 0 && (
            <>
              <SectionLabel title="Due Today" />
              <View style={s.listCard}>
                {ts.dueTodayList.map((t, i) => (
                  <AlertRow
                    key={i}
                    last={i === ts.dueTodayList.length - 1}
                    icon="today-outline"
                    iconColor="#2563EB"
                    iconBg="#DBEAFE"
                    title={t.title}
                    badge="Today"
                    badgeColor="#2563EB"
                  />
                ))}
              </View>
            </>
          )}

          {/* ── Critical risks ── */}
          {rs.criticalRisks.length > 0 && (
            <>
              <SectionLabel title="Critical Risks" />
              <View style={s.listCard}>
                {rs.criticalRisks.map((r, i) => (
                  <AlertRow
                    key={i}
                    last={i === rs.criticalRisks.length - 1}
                    icon="warning"
                    iconColor={RISK_META[r.status]?.color || '#DC2626'}
                    iconBg={RISK_META[r.status]?.bg       || '#FEF2F2'}
                    title={r.title}
                    subtitle={`Impact: ${r.impact}`}
                    badge={r.status}
                    badgeColor={RISK_META[r.status]?.color || '#DC2626'}
                  />
                ))}
              </View>
            </>
          )}

          {/* ── Recent projects ── */}
          {recent.length > 0 && (
            <>
              <SectionLabel title="Recent Projects" />
              <View style={s.listCard}>
                {recent.map((p, i) => (
                  <AlertRow
                    key={i}
                    last={i === recent.length - 1}
                    icon="folder-outline"
                    iconColor={STATUS_META[p.status]?.color || '#64748B'}
                    iconBg={STATUS_META[p.status]?.bg       || '#F8FAFC'}
                    title={p.name}
                    subtitle={
                      p.endDate
                        ? `Due ${new Date(p.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : undefined
                    }
                    badge={p.status}
                    badgeColor={STATUS_META[p.status]?.color || '#64748B'}
                  />
                ))}
              </View>
            </>
          )}

          {/* Empty Workspace */}
          {ps.total === 0 && (
            <View style={s.allClear}>
              <Ionicons name="folder-open-outline" size={52} color="#94A3B8" />
              <Text style={s.allClearTitle}>No projects yet</Text>
              <Text style={s.allClearSub}>Start by creating your first project</Text>
            </View>
          )}

          {/* All clear (No urgent alerts) */}
          {ps.total > 0 && ts.dueTodayList.length === 0 && rs.criticalRisks.length === 0 && (
            <View style={s.allClear}>
              <Ionicons name="checkmark-circle" size={52} color="#16A34A" />
              <Text style={s.allClearTitle}>Everything looks good</Text>
              <Text style={s.allClearSub}>No urgent alerts at this time</Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Sub-components ───────────────────────────────────��────

function SectionLabel({ title }) {
  return (
    <Text style={s.sectionLabel}>{title.toUpperCase()}</Text>
  );
}

function InteriorStatCard({ icon, iconBg, iconColor, label, value, sub, subColor }) {
  return (
    <View style={s.interiorStatCard}>
      <View style={s.interiorStatTopRow}>
        <Text style={s.interiorStatLabel}>{label}</Text>
        <View style={[s.interiorStatIconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={14} color={iconColor} />
        </View>
      </View>
      <Text style={s.interiorStatValue}>
        {value}{' '}
        {!!sub && <Text style={[s.interiorStatSub, subColor && { color: subColor, fontFamily: 'Inter-Bold' }]}>{sub}</Text>}
      </Text>
    </View>
  );
}

function StatTile({ icon, iconBg, iconColor, label, value }) {
  return (
    <View style={s.statTile}>
      <View style={[s.statIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function ProgressDot({ color, label }) {
  return (
    <View style={s.dotRow}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={s.dotLabel}>{label}</Text>
    </View>
  );
}

function LegendItem({ color, label, value, dim }) {
  return (
    <View style={s.legendRow}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={[s.legendLabel, dim && { color: '#CBD5E1' }]}>{label}</Text>
      <Text style={s.legendValue}>{value}</Text>
    </View>
  );
}

function AlertRow({ icon, iconColor, iconBg, title, subtitle, badge, badgeColor, last }) {
  return (
    <View style={[s.alertRow, last && { borderBottomWidth: 0 }]}>
      <View style={[s.alertIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <View style={s.alertBody}>
        <Text style={s.alertTitle} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={s.alertSub} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {!!badge && (
        <View style={[s.alertBadge, { backgroundColor: badgeColor + '18' }]}>
          <Text style={[s.alertBadgeText, { color: badgeColor }]}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  headerGreeting: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
    marginBottom: 2,
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attendanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  btnOffline: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  btnOnline: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  attendanceBtnText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  bellScale: {
    transform: [{ scale: 0.78 }],
  },

  // Interior stat cards
  interiorStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  topProjectRow: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 8 },
  topProjectHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  topProjectBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topProjectTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EEF2F6', overflow: 'hidden' },
  topProjectFill: { height: '100%', borderRadius: 3 },
  topProjectPct: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#475569', minWidth: 34, textAlign: 'right' },
  interiorStatCard: {
    width: '47%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: '#DBEAFE',
  },
  interiorStatTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  interiorStatIconBox: { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  interiorStatLabel: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#94A3B8', flex: 1, marginRight: 6 },
  interiorStatValue: { fontSize: 17, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 8 },
  interiorStatSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  // Section label — matches settings screen exactly
  sectionLabel: {
    fontSize: 13, fontFamily: 'Inter-Bold', color: '#64748B',
    letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 20, marginBottom: 10,
  },

  // Stats compact row
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 1, borderColor: '#E0F2FE',
    paddingVertical: 16,
  },
  statTile: {
    flex: 1, alignItems: 'center', gap: 4,
  },
  statDivider: { width: 1, height: 36, backgroundColor: '#E0F2FE' },
  statIconBox: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  statValue: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },

  // Generic card
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: '#E0F2FE',
  },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  chartHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  chartHeaderTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#475569' },
  chartHeaderTag: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#64748B', backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

  // Progress
  progressTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  progressTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#475569' },
  progressSub:   { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },
  progressPct:   { fontSize: 13, fontFamily: 'Inter-Bold', color: '#3B82F6' },
  trackBg:  { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  trackFill:{ height: '100%', backgroundColor: '#2563EB', borderRadius: 4 },
  progressDots: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  dotRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:     { width: 7, height: 7, borderRadius: 4 },
  dotLabel:{ fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B' },

  // Donut
  donutNum: { fontSize: 18, fontFamily: 'Inter-Black', color: '#0F172A' },
  donutLbl: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  // Legend
  legendBlock: { flex: 1, gap: 10 },
  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trendLegend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendLegendLine: { width: 16, height: 3, borderRadius: 2 },
  trendLegendText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#475569' },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#475569' },
  legendValue: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },

  // List card + alert rows
  listCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24,
    borderWidth: 1, borderColor: '#E0F2FE',
    overflow: 'hidden',
  },
  alertRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F9FF',
    gap: 12,
  },
  alertIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  alertBody:    { flex: 1 },
  alertTitle:   { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1E293B' },
  alertSub:     { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },
  alertBadge:   { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  alertBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold' },

  // All clear
  allClear:      { alignItems: 'center', paddingVertical: 48 },
  allClearTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1E293B', marginTop: 14 },
  allClearSub:   { fontSize: 13, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 4 },
});

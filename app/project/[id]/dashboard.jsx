import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { milestoneService } from '../../services/projectService';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const DAYS_WARNING = 7;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function StatCard({ label, value, color, icon }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AlertRow({ icon, iconColor, iconBg, title, subtitle, badge, badgeColor }) {
  return (
    <View style={styles.alertRow}>
      <View style={[styles.alertIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.alertBody}>
        <Text style={styles.alertTitle} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.alertSub} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {!!badge && (
        <View style={[styles.alertBadge, { backgroundColor: badgeColor + '20' }]}>
          <Text style={[styles.alertBadgeText, { color: badgeColor }]}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

export default function ProjectDashboardTab({ project, onOpenChat, refreshTrigger = 0 }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const projectId = project?._id;

  const [milestones, setMilestones] = useState([]);
  const [risks, setRisks] = useState([]);
  const [snags, setSnags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (!projectId || !token) return;
    if (isRefresh) setRefreshing(true);
    else setIsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [mData, rRes, sRes] = await Promise.all([
        milestoneService.getProjectMilestones(projectId, token),
        fetch(`${API_BASE_URL}/projects/${projectId}/risks`, { headers }),
        fetch(`${API_BASE_URL}/projects/${projectId}/issues`, { headers }),
      ]);
      const rData = rRes.ok ? await rRes.json() : [];
      const sData = sRes.ok ? await sRes.json() : [];
      setMilestones(Array.isArray(mData) ? mData : []);
      setRisks(Array.isArray(rData) ? rData : (rData?.risks ?? []));
      setSnags(Array.isArray(sData) ? sData : (sData?.issues ?? []));
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [projectId, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { if (refreshTrigger > 0) fetchAll(true); }, [refreshTrigger]);

  const allTasks = milestones.flatMap(m => m.tasks || []);
  const dueSoonMilestones = milestones.filter(m => {
    const d = daysUntil(m.dueDate ?? m.endDate);
    return d !== null && d >= 0 && d <= DAYS_WARNING;
  });
  const overdueMilestones = milestones.filter(m => {
    const d = daysUntil(m.dueDate ?? m.endDate);
    return d !== null && d < 0 && m.status !== 'Completed';
  });
  const openRisks = risks.filter(r => r.status !== 'Resolved');
  const criticalRisks = risks.filter(r => r.impact === 'Very High' || r.status === 'Critical');
  const openSnags = snags.filter(s => s.status !== 'Resolved' && s.status !== 'Closed');

  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === 'Done').length;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor="#3B82F6" colors={["#3B82F6"]} />
      }
    >
      {/* Stats Grid */}
      <Text style={styles.sectionTitle}>{t('overview')}</Text>
      <View style={styles.statsGrid}>
        <StatCard label={t('milestonesLabel')} value={milestones.length} color="#3B82F6" icon="flag-outline" />
        <StatCard label={t('dueSoon')} value={dueSoonMilestones.length} color="#F59E0B" icon="time-outline" />
        <StatCard label={t('openRisks')} value={openRisks.length} color="#EF4444" icon="warning-outline" />
        <StatCard label={t('openSnags')} value={openSnags.length} color="#8B5CF6" icon="alert-circle-outline" />
      </View>

      {/* Tasks Progress */}
      {totalTasks > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('taskProgress')}</Text>
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{t('tasksCompletedFmt', { completed: completedTasks, total: totalTasks })}</Text>
              <Text style={styles.progressPct}>{Math.round((completedTasks / totalTasks) * 100)}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(completedTasks / totalTasks) * 100}%` }]} />
            </View>
          </View>
        </>
      )}

      {/* Overdue Milestones */}
      {overdueMilestones.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('overdueMilestones')}</Text>
          <View style={styles.alertCard}>
            {overdueMilestones.map(m => {
              const d = daysUntil(m.dueDate ?? m.endDate);
              return (
                <AlertRow
                  key={m._id}
                  icon="flag"
                  iconColor="#EF4444"
                  iconBg="#FEE2E2"
                  title={m.name}
                  subtitle={m.description}
                  badge={t('daysOverdue', { d: Math.abs(d) })}
                  badgeColor="#EF4444"
                />
              );
            })}
          </View>
        </>
      )}

      {/* Due Soon Milestones */}
      {dueSoonMilestones.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('approachingDeadlines')}</Text>
          <View style={styles.alertCard}>
            {dueSoonMilestones.map(m => {
              const d = daysUntil(m.dueDate ?? m.endDate);
              return (
                <AlertRow
                  key={m._id}
                  icon="time-outline"
                  iconColor="#F59E0B"
                  iconBg="#FEF3C7"
                  title={m.name}
                  subtitle={m.description}
                  badge={d === 0 ? t('dueToday') : t('daysLeft', { d })}
                  badgeColor="#F59E0B"
                />
              );
            })}
          </View>
        </>
      )}

      {/* Critical Risks */}
      {criticalRisks.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('criticalRisksLabel')}</Text>
          <View style={styles.alertCard}>
            {criticalRisks.map(r => (
              <AlertRow
                key={r._id}
                icon="warning"
                iconColor="#EF4444"
                iconBg="#FEE2E2"
                title={r.title ?? r.name}
                subtitle={r.category}
                badge={r.impact}
                badgeColor="#EF4444"
              />
            ))}
          </View>
        </>
      )}

      {/* Open Snags */}
      {openSnags.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('openSnags')}</Text>
          <View style={styles.alertCard}>
            {openSnags.slice(0, 5).map(s => (
              <AlertRow
                key={s._id}
                icon="alert-circle-outline"
                iconColor="#8B5CF6"
                iconBg="#EDE9FE"
                title={s.title ?? s.description}
                subtitle={s.location}
                badge={s.status}
                badgeColor="#8B5CF6"
              />
            ))}
            {openSnags.length > 5 && (
              <Text style={styles.moreText}>{t('moreSnags', { count: openSnags.length - 5 })}</Text>
            )}
          </View>
        </>
      )}

      {/* All clear state */}
      {overdueMilestones.length === 0 && dueSoonMilestones.length === 0 && criticalRisks.length === 0 && openSnags.length === 0 && (
        <View style={styles.allClear}>
          <Ionicons name="checkmark-circle" size={48} color="#10B981" />
          <Text style={styles.allClearText}>{t('everythingLooksGood')}</Text>
          <Text style={styles.allClearSub}>{t('noUrgentAlerts')}</Text>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>

    {/* Chat FAB — fixed above scroll content */}
    <TouchableOpacity style={styles.chatFab} onPress={onOpenChat} activeOpacity={0.85}>
      <LinearGradient colors={['#3B82F6', '#3B82F6']} style={styles.chatFabGradient}>
        <Ionicons name="chatbubbles" size={22} color="#FFF" />
        <Text style={styles.chatFabLabel}>{t('chatFab')}</Text>
      </LinearGradient>
    </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#64748B', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%', backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 24, fontFamily: 'Inter-Black', color: '#0F172A' },
  statLabel: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#94A3B8', marginTop: 2 },

  progressCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#475569' },
  progressPct: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#3B82F6' },
  progressBar: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 4 },

  alertCard: { backgroundColor: '#FFF', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  alertRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 10 },
  alertIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  alertBody: { flex: 1 },
  alertTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1E293B' },
  alertSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },
  alertBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  alertBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold' },

  moreText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#94A3B8', textAlign: 'center', padding: 10 },

  allClear: { alignItems: 'center', paddingVertical: 40 },
  allClearText: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1E293B', marginTop: 12 },
  allClearSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 4 },

  chatFab: { position: 'absolute', bottom: 24, right: 0, borderRadius: 28, overflow: 'hidden', shadowColor: '#3B82F6', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  chatFabGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  chatFabLabel: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFF' },
});

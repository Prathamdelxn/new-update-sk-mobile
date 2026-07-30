import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCompact } from '../../utils/format';
import { useTranslation } from 'react-i18next';

// ─── Action metadata ──────────────────────────────────────────────────────────
const ACTION_META = {
  // Project-level
  Create:         { icon: 'add-circle',        color: '#3B82F6', bg: '#DBEAFE', label: 'Created',          category: 'project' },
  Update:         { icon: 'create-outline',     color: '#3B82F6', bg: '#DBEAFE', label: 'Updated',          category: 'project' },
  StatusChange:   { icon: 'refresh-circle',     color: '#3B82F6', bg: '#DBEAFE', label: 'Status Changed',   category: 'project' },
  // Members
  MemberAdded:    { icon: 'person-add',         color: '#0EA5E9', bg: '#E0F2FE', label: 'Member Added',     category: 'members' },
  MemberRemoved:  { icon: 'person-remove',      color: '#F59E0B', bg: '#FEF3C7', label: 'Member Removed',   category: 'members' },
  // Issues
  IssueAdded:     { icon: 'alert-circle',       color: '#EF4444', bg: '#FEE2E2', label: 'Issue Raised',     category: 'issues'  },
  IssueUpdated:   { icon: 'alert',              color: '#F97316', bg: '#FFEDD5', label: 'Issue Updated',    category: 'issues'  },
  IssueDeleted:   { icon: 'trash',              color: '#EF4444', bg: '#FEE2E2', label: 'Issue Deleted',    category: 'issues'  },
  // Snags
  SnagAdded:      { icon: 'construct',          color: '#F97316', bg: '#FFEDD5', label: 'Snag Reported',    category: 'snags'   },
  SnagUpdated:    { icon: 'hammer',             color: '#F59E0B', bg: '#FEF3C7', label: 'Snag Updated',     category: 'snags'   },
  SnagDeleted:    { icon: 'trash-outline',      color: '#EF4444', bg: '#FEE2E2', label: 'Snag Deleted',     category: 'snags'   },
  // Risks
  RiskAdded:      { icon: 'warning',            color: '#EAB308', bg: '#FEF9C3', label: 'Risk Logged',      category: 'risks'   },
  RiskUpdated:    { icon: 'warning-outline',    color: '#F59E0B', bg: '#FEF3C7', label: 'Risk Updated',     category: 'risks'   },
  RiskDeleted:    { icon: 'trash-outline',      color: '#EF4444', bg: '#FEE2E2', label: 'Risk Deleted',     category: 'risks'   },
  // Budget (synthetic from budgetHistory)
  BudgetPending:  { icon: 'time-outline',       color: '#F59E0B', bg: '#FEF3C7', label: 'Budget Requested', category: 'finance' },
  BudgetApproved: { icon: 'cash',               color: '#10B981', bg: '#D1FAE5', label: 'Budget Approved',  category: 'finance' },
  BudgetRejected: { icon: 'close-circle',       color: '#EF4444', bg: '#FEE2E2', label: 'Budget Rejected',  category: 'finance' },
};

const FILTERS = [
  { key: 'all',     label: 'All',     icon: 'list-outline' },
  { key: 'project', label: 'Project', icon: 'folder-outline' },
  { key: 'issues',  label: 'Issues',  icon: 'alert-circle-outline' },
  { key: 'snags',   label: 'Snags',   icon: 'construct-outline' },
  { key: 'risks',   label: 'Risks',   icon: 'warning-outline' },
  { key: 'members', label: 'Members', icon: 'people-outline' },
  { key: 'finance', label: 'Finance', icon: 'cash-outline' },
];

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Build combined log from project data ────────────────────────────────────
function buildAuditLog(project) {
  const entries = [];

  // From auditTrail
  (project?.auditTrail || []).forEach(a => {
    entries.push({
      id: `audit-${a._id || Math.random()}`,
      action: a.action || 'Update',
      details: a.details,
      userName: a.userName || 'System',
      userRole: a.userRole,
      timestamp: a.timestamp,
    });
  });

  // From budgetHistory
  (project?.budgetHistory || []).forEach(b => {
    const actionKey =
      b.approvalStatus === 'Approved' ? 'BudgetApproved' :
      b.approvalStatus === 'Rejected' ? 'BudgetRejected' : 'BudgetPending';

    entries.push({
      id: `budget-${b._id || Math.random()}`,
      action: actionKey,
      details: `${project?.currency || '$'} ${formatCompact(Number(b.amount))} — ${b.reason}`,
      userName: b.updatedByName || 'System',
      userRole: null,
      timestamp: b.timestamp,
    });
  });

  // Sort newest first
  return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ─── Entry card ───────────────────────────────────────────────────────────────
function AuditEntry({ entry, isLast }) {
  const meta = ACTION_META[entry.action] || ACTION_META.Update;
  return (
    <View style={styles.entryRow}>
      {/* Timeline spine */}
      <View style={styles.spineCol}>
        <View style={[styles.entryIcon, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={16} color={meta.color} />
        </View>
        {!isLast && <View style={styles.spine} />}
      </View>

      {/* Content */}
      <View style={[styles.entryCard, isLast && { marginBottom: 0 }]}>
        <View style={styles.entryCardTop}>
          <View style={[styles.actionBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.actionBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={styles.entryTime}>{formatTime(entry.timestamp)}</Text>
        </View>

        {entry.details ? (
          <Text style={styles.entryDetails}>{entry.details}</Text>
        ) : null}

        <View style={styles.entryFooter}>
          <Ionicons name="person-circle-outline" size={13} color="#94A3B8" />
          <Text style={styles.entryUser}>
            {entry.userName}
            {entry.userRole ? ` · ${entry.userRole}` : ''}
          </Text>
          <Text style={styles.entryDate}>{formatDate(entry.timestamp)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProjectAuditTab({ project }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState('all');
  const FILTER_LABELS = { all: t('all'), project: t('filterProject'), issues: t('issuesLabel'), snags: t('snagsLabel'), risks: t('filterRisks'), members: t('filterMembers'), finance: t('financeLabel') };

  const allEntries = useMemo(() => buildAuditLog(project), [project]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return allEntries;
    return allEntries.filter(e => {
      const meta = ACTION_META[e.action];
      return meta?.category === activeFilter;
    });
  }, [allEntries, activeFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(e => {
      const dateKey = formatDate(e.timestamp);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(e);
    });
    return groups;
  }, [filtered]);

  const totalByCategory = useMemo(() => {
    const counts = { project: 0, issues: 0, snags: 0, risks: 0, members: 0, finance: 0 };
    allEntries.forEach(e => {
      const cat = ACTION_META[e.action]?.category;
      if (cat && counts[cat] !== undefined) counts[cat]++;
    });
    return counts;
  }, [allEntries]);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statCount, { color: '#3B82F6' }]}>{allEntries.length}</Text>
          <Text style={styles.statLabel}>{t('totalEvents')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statCount, { color: '#EF4444' }]}>{totalByCategory.issues}</Text>
          <Text style={styles.statLabel}>{t('issuesLabel')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statCount, { color: '#F97316' }]}>{totalByCategory.snags}</Text>
          <Text style={styles.statLabel}>{t('snagsLabel')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statCount, { color: '#10B981' }]}>{totalByCategory.finance}</Text>
          <Text style={styles.statLabel}>{t('financeLabel')}</Text>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTERS.map(f => {
          const isActive = activeFilter === f.key;
          const count = f.key === 'all' ? allEntries.length : totalByCategory[f.key];
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.75}
            >
              <Ionicons name={f.icon} size={13} color={isActive ? '#FFF' : '#64748B'} />
              <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>{FILTER_LABELS[f.key] || f.label}</Text>
              {count > 0 && (
                <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, isActive && { color: '#3B82F6' }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Log */}
      <ScrollView style={styles.logScroll} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.logContent, { paddingBottom: insets.bottom + 40 }]}>
        {Object.keys(grouped).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>{t('noActivity')}</Text>
            <Text style={styles.emptyDesc}>{t('noEventsFound')}</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([dateKey, entries]) => (
            <View key={dateKey}>
              <View style={styles.dateHeader}>
                <View style={styles.dateLine} />
                <Text style={styles.dateLabel}>{dateKey}</Text>
                <View style={styles.dateLine} />
              </View>
              {entries.map((entry, idx) => (
                <AuditEntry key={entry.id} entry={entry} isLast={idx === entries.length - 1} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFF' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  statCount: { fontSize: 22, fontFamily: 'Inter-Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#94A3B8', marginTop: 2, textAlign: 'center' },

  filterScroll: { maxHeight: 48, marginBottom: 20 },
  filterContent: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  filterLabel: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B' },
  filterLabelActive: { color: '#FFFFFF' },
  filterBadge: { backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  filterBadgeActive: { backgroundColor: '#FFFFFF' },
  filterBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#64748B' },

  logScroll: { flex: 1 },
  logContent: { paddingHorizontal: 20 },

  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  dateLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dateLabel: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.5 },

  entryRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  spineCol: { width: 36, alignItems: 'center' },
  entryIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  spine: { flex: 1, width: 2, backgroundColor: '#E2E8F0', marginVertical: 4, marginBottom: 8 },

  entryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  entryCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  actionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  actionBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  entryTime: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },
  entryDetails: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#334155', lineHeight: 19, marginBottom: 10 },
  entryFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  entryUser: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B', flex: 1 },
  entryDate: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#CBD5E1' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#94A3B8', textAlign: 'center' },
});

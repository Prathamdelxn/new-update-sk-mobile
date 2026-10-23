import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import HeaderNotification from '../../components/HeaderNotification';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useInteriorPermissions } from '../../utils/interior/useInteriorPermissions';
import interiorApiClient from '../../services/interiorApiClient';

// ── Action Themes (matching Web InteriorAuditManagementView) ─────────────────
const ACTION_THEMES = {
  create: { label: 'Created', color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', icon: 'add-circle-outline' },
  update: { label: 'Updated', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: 'refresh-outline' },
  delete: { label: 'Deleted', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', icon: 'trash-outline' },
  approve: { label: 'Approved', color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4', icon: 'checkmark-circle-outline' },
  reject: { label: 'Rejected', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', icon: 'close-circle-outline' },
  login: { label: 'Login', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: 'log-in-outline' },
  logout: { label: 'Logout', color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', icon: 'log-out-outline' },
  export: { label: 'Export', color: '#06B6D4', bg: '#ECFEFF', border: '#A5F3FC', icon: 'download-outline' },
  upload: { label: 'Upload', color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', icon: 'cloud-upload-outline' },
};

const QUICK_SEGMENTS = [
  { id: 'all', label: 'All Activities' },
  { id: 'Project', label: 'Projects', entity: 'Project' },
  { id: 'CRM', label: 'CRM & Quotes', entity: 'CRM' },
  { id: 'User', label: 'Users & Roles', entity: 'User' },
  { id: 'Authentication', label: 'Auth & Logins', entity: 'Authentication' },
  { id: 'delete', label: 'Deletions', action: 'delete' },
];

export default function InteriorAuditScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isOrgAdmin } = useInteriorPermissions();
  const { showToast } = useToast();

  // State
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [page, setPage] = useState(1);
  const [activeSegment, setActiveSegment] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailTab, setDetailTab] = useState('overview'); // 'overview' | 'changes' | 'json'

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(
    async (isPullRefresh = false) => {
      if (isPullRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const params = {
          page,
          limit: 15,
        };

        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

        // Handle quick segment
        const segment = QUICK_SEGMENTS.find((s) => s.id === activeSegment);
        if (segment?.entity) params.entity = segment.entity;
        if (segment?.action) params.action = segment.action;

        if (selectedAction !== 'all') params.action = selectedAction;

        const res = await interiorApiClient.get('/audit', { params });
        const data = res?.data?.data || res?.data;

        if (data) {
          setLogs(data.logs || []);
          setStats(data.stats || null);
          setMeta(data.meta || { page: 1, limit: 15, total: 0, totalPages: 1 });
          setAccessDenied(false);
        }
      } catch (err) {
        if (err?.response?.status === 403) {
          setAccessDenied(true);
        } else {
          console.error('Failed to load audit logs:', err);
          showToast('Failed to load audit logs.', 'error');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, debouncedSearch, activeSegment, selectedAction, showToast]
  );

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Export to CSV
  const handleExportCSV = async () => {
    if (!logs.length) {
      showToast('No audit records to export.', 'info');
      return;
    }
    setExporting(true);
    try {
      const header = ['Timestamp', 'Action', 'Entity', 'Entity Name', 'Operator', 'Email', 'Description'];
      const rows = logs.map((log) => {
        const dateStr = log.createdAt ? new Date(log.createdAt).toISOString() : '';
        const op =
          log.userId?.name ||
          log.userName ||
          (log.userId?.firstName ? `${log.userId.firstName} ${log.userId.lastName || ''}`.trim() : 'System');
        const email = log.userId?.email || log.userEmail || '';
        const clean = (txt) => `"${String(txt || '').replace(/"/g, '""')}"`;
        return [
          clean(dateStr),
          clean(log.action),
          clean(log.entity),
          clean(log.entityName),
          clean(op),
          clean(email),
          clean(log.description),
        ].join(',');
      });
      const csvContent = [header.join(','), ...rows].join('\n');
      const fileUri = `${FileSystem.cacheDirectory}audit_logs_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Audit Trail CSV',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        await Clipboard.setStringAsync(csvContent);
        showToast('CSV copied to clipboard!', 'success');
      }
    } catch (err) {
      console.error('CSV export failed:', err);
      showToast('Export failed. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleCopyPayload = async () => {
    if (!selectedLog) return;
    try {
      await Clipboard.setStringAsync(JSON.stringify(selectedLog, null, 2));
      showToast('Payload copied to clipboard!', 'success');
    } catch {
      showToast('Failed to copy payload', 'error');
    }
  };

  const getInitials = (n) => {
    if (!n) return '??';
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return (
        d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ', ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      );
    } catch {
      return dateStr;
    }
  };

  // Render Log Item Card
  const renderLogItem = ({ item }) => {
    const theme = ACTION_THEMES[item.action] || ACTION_THEMES.update;
    const operatorName =
      typeof item.userId === 'object' && item.userId !== null
        ? [item.userId.firstName, item.userId.lastName].filter(Boolean).join(' ') || item.userId.name || item.userId.email
        : item.entityName || 'System';

    const operatorEmail = typeof item.userId === 'object' && item.userId !== null ? item.userId.email : '';

    return (
      <TouchableOpacity
        style={s.logCard}
        onPress={() => {
          setSelectedLog(item);
          setDetailTab('overview');
        }}
        activeOpacity={0.7}
      >
        {/* Top Badges & Time Row */}
        <View style={s.logCardHeader}>
          <View style={s.badgeGroup}>
            <View style={[s.actionBadge, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Ionicons name={theme.icon} size={12} color={theme.color} style={{ marginRight: 4 }} />
              <Text style={[s.actionBadgeText, { color: theme.color }]}>{theme.label}</Text>
            </View>

            {item.entity && (
              <View style={s.entityBadge}>
                <Text style={s.entityBadgeText}>{item.entity}</Text>
              </View>
            )}
          </View>

          <Text style={s.logTimeText}>{formatTimestamp(item.createdAt)}</Text>
        </View>

        {/* Description */}
        <Text style={s.logDescription} numberOfLines={2}>
          {item.description || `${theme.label} ${item.entity || 'Record'} ${item.entityName || ''}`}
        </Text>

        {/* Operator Footer */}
        <View style={s.logCardFooter}>
          <View style={s.operatorRow}>
            <View style={s.operatorAvatar}>
              <Text style={s.operatorAvatarText}>{getInitials(operatorName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.operatorName} numberOfLines={1}>
                {operatorName}
              </Text>
              {operatorEmail ? (
                <Text style={s.operatorEmail} numberOfLines={1}>
                  {operatorEmail}
                </Text>
              ) : null}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        {/* Top Header */}
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <View>
            <View style={s.headerBadgeRow}>
              <Text style={s.headerSubtitle}>Workspace Security</Text>
              <View style={s.liveSyncPill}>
                <View style={s.liveDot} />
                <Text style={s.liveSyncText}>Live Audit</Text>
              </View>
            </View>
            <Text style={s.pageTitle}>Audit Ledger</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity
              style={s.refreshBtn}
              onPress={handleExportCSV}
              activeOpacity={0.7}
              disabled={exporting || loading}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#2563EB" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={s.refreshBtn}
              onPress={() => fetchAuditLogs(true)}
              activeOpacity={0.7}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Ionicons name="refresh-outline" size={20} color="#2563EB" />
              )}
            </TouchableOpacity>
            <HeaderNotification />
          </View>
        </View>

        {/* Access Guard for Forbidden / Non-Admins */}
        {accessDenied ? (
          <View style={s.restrictedBox}>
            <View style={s.restrictedIconBox}>
              <Ionicons name="shield-outline" size={36} color="#DC2626" />
            </View>
            <Text style={s.restrictedTitle}>Administrator Access Required</Text>
            <Text style={s.restrictedDesc}>
              Audit logs contain sensitive workspace activity, authentication records, and deletion trails. Access is
              restricted to organization administrators.
            </Text>
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => item._id || Math.random().toString()}
            renderItem={renderLogItem}
            refreshing={refreshing}
            onRefresh={() => fetchAuditLogs(true)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.listContent}
            ListHeaderComponent={
              <View style={s.listHeader}>
                {/* 4 Stat Boxes (Matching Web) */}
                <View style={s.statsGrid}>
                  <View style={s.statCard}>
                    <View style={[s.statIconBox, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="pulse-outline" size={16} color="#2563EB" />
                    </View>
                    <Text style={s.statVal}>{stats?.totalLogs ?? meta.total ?? 0}</Text>
                    <Text style={s.statLabel}>Total Events</Text>
                  </View>

                  <View style={s.statCard}>
                    <View style={[s.statIconBox, { backgroundColor: '#ECFDF5' }]}>
                      <Ionicons name="today-outline" size={16} color="#10B981" />
                    </View>
                    <Text style={s.statVal}>{stats?.todayLogs ?? 0}</Text>
                    <Text style={s.statLabel}>Today</Text>
                  </View>

                  <View style={s.statCard}>
                    <View style={[s.statIconBox, { backgroundColor: '#F5F3FF' }]}>
                      <Ionicons name="people-outline" size={16} color="#7C3AED" />
                    </View>
                    <Text style={s.statVal}>{stats?.uniqueUsersCount ?? 0}</Text>
                    <Text style={s.statLabel}>Operators</Text>
                  </View>

                  <View style={s.statCard}>
                    <View style={[s.statIconBox, { backgroundColor: '#FEF2F2' }]}>
                      <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                    </View>
                    <Text style={[s.statVal, { color: '#DC2626' }]}>{stats?.criticalActionsCount ?? 0}</Text>
                    <Text style={s.statLabel}>Critical</Text>
                  </View>
                </View>

                {/* Search Input */}
                <View style={s.searchBar}>
                  <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                  <TextInput
                    style={s.searchInput}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    placeholder="Search logs by user, action, or details..."
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                  />
                  {searchTerm.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Quick Segment Filter Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.segmentScroll}>
                  {QUICK_SEGMENTS.map((seg) => {
                    const isSel = activeSegment === seg.id;
                    return (
                      <TouchableOpacity
                        key={seg.id}
                        onPress={() => {
                          setActiveSegment(seg.id);
                          setPage(1);
                        }}
                        style={[s.segmentPill, isSel && s.segmentPillActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.segmentPillText, isSel && s.segmentPillTextActive]}>{seg.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            }
            ListEmptyComponent={
              loading ? (
                <View style={s.loadingBox}>
                  <ActivityIndicator size="large" color="#2563EB" />
                  <Text style={s.loadingText}>Loading audit events...</Text>
                </View>
              ) : (
                <View style={s.emptyBox}>
                  <Ionicons name="document-text-outline" size={44} color="#CBD5E1" />
                  <Text style={s.emptyTitle}>No Audit Records Found</Text>
                  <Text style={s.emptyDesc}>Try adjusting your search terms or segment filters.</Text>
                </View>
              )
            }
            ListFooterComponent={
              meta.totalPages > 1 ? (
                <View style={s.paginationRow}>
                  <TouchableOpacity
                    style={[s.pageBtn, page <= 1 && s.pageBtnDisabled]}
                    onPress={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page <= 1}
                  >
                    <Ionicons name="chevron-back" size={16} color={page <= 1 ? '#94A3B8' : '#2563EB'} />
                    <Text style={[s.pageBtnText, page <= 1 && s.pageBtnTextDisabled]}>Previous</Text>
                  </TouchableOpacity>

                  <Text style={s.pageInfoText}>
                    Page <Text style={{ fontFamily: 'Inter-Bold', color: '#0F172A' }}>{page}</Text> of{' '}
                    <Text style={{ fontFamily: 'Inter-Bold', color: '#0F172A' }}>{meta.totalPages}</Text>
                  </Text>

                  <TouchableOpacity
                    style={[s.pageBtn, page >= meta.totalPages && s.pageBtnDisabled]}
                    onPress={() => setPage((p) => Math.min(p + 1, meta.totalPages))}
                    disabled={page >= meta.totalPages}
                  >
                    <Text style={[s.pageBtnText, page >= meta.totalPages && s.pageBtnTextDisabled]}>Next</Text>
                    <Ionicons name="chevron-forward" size={16} color={page >= meta.totalPages ? '#94A3B8' : '#2563EB'} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ height: 90 }} />
              )
            }
          />
        )}
      </SafeAreaView>

      {/* Audit Detail Inspection Modal */}
      <Modal
        visible={!!selectedLog}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedLog(null)}
      >
        <View style={s.modalOverlay}>
          <TouchableOpacity style={s.modalDismiss} activeOpacity={1} onPress={() => setSelectedLog(null)} />
          <View style={[s.modalSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            <View style={s.sheetHandle} />

            {/* Modal Header */}
            <View style={s.sheetHeaderRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.sheetTitle}>Audit Inspection</Text>
                <Text style={s.sheetSubtitle}>Record ID: {selectedLog?._id || 'N/A'}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedLog(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Modal Tabs */}
            <View style={s.modalTabBar}>
              <TouchableOpacity
                style={[s.modalTabBtn, detailTab === 'overview' && s.modalTabBtnActive]}
                onPress={() => setDetailTab('overview')}
              >
                <Text style={[s.modalTabBtnText, detailTab === 'overview' && s.modalTabBtnTextActive]}>Overview</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalTabBtn, detailTab === 'changes' && s.modalTabBtnActive]}
                onPress={() => setDetailTab('changes')}
              >
                <Text style={[s.modalTabBtnText, detailTab === 'changes' && s.modalTabBtnTextActive]}>Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalTabBtn, detailTab === 'json' && s.modalTabBtnActive]}
                onPress={() => setDetailTab('json')}
              >
                <Text style={[s.modalTabBtnText, detailTab === 'json' && s.modalTabBtnTextActive]}>Raw JSON</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* TAB 1: Overview */}
              {detailTab === 'overview' && (
                <View style={s.modalDetailSection}>
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Action</Text>
                    <Text style={[s.detailValue, { textTransform: 'capitalize', color: '#2563EB', fontFamily: 'Inter-Bold' }]}>
                      {selectedLog?.action}
                    </Text>
                  </View>

                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Entity Module</Text>
                    <Text style={s.detailValue}>{selectedLog?.entity || 'N/A'}</Text>
                  </View>

                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Target Record</Text>
                    <Text style={s.detailValue}>{selectedLog?.entityName || selectedLog?.entityId || 'N/A'}</Text>
                  </View>

                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Timestamp</Text>
                    <Text style={s.detailValue}>{formatTimestamp(selectedLog?.createdAt)}</Text>
                  </View>

                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Operator</Text>
                    <Text style={s.detailValue}>
                      {typeof selectedLog?.userId === 'object' && selectedLog?.userId !== null
                        ? [selectedLog.userId.firstName, selectedLog.userId.lastName].filter(Boolean).join(' ') ||
                          selectedLog.userId.email
                        : 'System'}
                    </Text>
                  </View>

                  {selectedLog?.ipAddress ? (
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>IP Address</Text>
                      <Text style={[s.detailValue, { fontFamily: 'Courier' }]}>{selectedLog.ipAddress}</Text>
                    </View>
                  ) : null}

                  {selectedLog?.userAgent ? (
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>Client / Device</Text>
                      <Text style={s.detailValue} numberOfLines={2}>
                        {selectedLog.userAgent}
                      </Text>
                    </View>
                  ) : null}

                  <View style={s.descBox}>
                    <Text style={s.descBoxLabel}>Detailed Description</Text>
                    <Text style={s.descBoxText}>{selectedLog?.description || 'No description recorded.'}</Text>
                  </View>
                </View>
              )}

              {/* TAB 2: Changes / Diff */}
              {detailTab === 'changes' && (
                <View style={s.modalDetailSection}>
                  {selectedLog?.changes ? (
                    <View style={s.codeBlock}>
                      <Text style={s.codeText}>{JSON.stringify(selectedLog.changes, null, 2)}</Text>
                    </View>
                  ) : (
                    <View style={s.emptyChangesBox}>
                      <Ionicons name="information-circle-outline" size={28} color="#94A3B8" />
                      <Text style={s.emptyChangesText}>No direct state diff was captured for this event.</Text>
                    </View>
                  )}
                </View>
              )}

              {/* TAB 3: Raw JSON */}
              {detailTab === 'json' && (
                <View style={s.modalDetailSection}>
                  <TouchableOpacity style={s.copyBtn} onPress={handleCopyPayload} activeOpacity={0.7}>
                    <Ionicons name="copy-outline" size={16} color="#2563EB" />
                    <Text style={s.copyBtnText}>Copy JSON Payload</Text>
                  </TouchableOpacity>
                  <View style={s.codeBlock}>
                    <Text style={s.codeText}>{JSON.stringify(selectedLog, null, 2)}</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },

  header: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
  },
  headerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  headerSubtitle: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#1D4ED8' },
  liveSyncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  liveSyncText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#047857' },
  pageTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', letterSpacing: -0.4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },

  listHeader: { paddingTop: 14, paddingBottom: 6 },

  // Stats Grid
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    alignItems: 'center',
    gap: 3,
  },
  statIconBox: { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  statVal: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  statLabel: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#64748B' },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#0F172A' },

  // Quick Segments
  segmentScroll: { flexDirection: 'row', gap: 8, paddingBottom: 6 },
  segmentPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentPillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  segmentPillText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  segmentPillTextActive: { color: '#FFFFFF', fontFamily: 'Inter-Bold' },

  // Log Cards
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  logCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBadgeText: { fontSize: 10.5, fontFamily: 'Inter-Bold' },
  entityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  entityBadgeText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#475569' },
  logTimeText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  logDescription: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#1E293B', lineHeight: 18 },

  logCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  operatorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 },
  operatorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  operatorAvatarText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#2563EB' },
  operatorName: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#334155' },
  operatorEmail: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  // Pagination
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    marginTop: 4,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#2563EB' },
  pageBtnTextDisabled: { color: '#94A3B8' },
  pageInfoText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B' },

  // States
  loadingBox: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B' },
  emptyBox: { paddingVertical: 50, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#334155' },
  emptyDesc: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },

  restrictedBox: {
    margin: 20,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    gap: 10,
  },
  restrictedIconBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  restrictedTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#991B1B' },
  restrictedDesc: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center', lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  modalDismiss: { ...StyleSheet.absoluteFillObject },
  modalSheet: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 14 },
  sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },
  sheetSubtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  modalTabBar: { flexDirection: 'row', gap: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 14 },
  modalTabBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  modalTabBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  modalTabBtnText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  modalTabBtnTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  modalDetailSection: { gap: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  detailLabel: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' },
  detailValue: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#0F172A', maxWidth: '60%', textAlign: 'right' },

  descBox: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, marginTop: 4, gap: 4 },
  descBoxLabel: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#475569' },
  descBoxText: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#1E293B', lineHeight: 18 },

  codeBlock: { backgroundColor: '#0F172A', borderRadius: 14, padding: 14, marginTop: 4 },
  codeText: { fontFamily: 'Courier', fontSize: 11.5, color: '#E2E8F0', lineHeight: 17 },

  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignSelf: 'flex-start',
  },
  copyBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#2563EB' },

  emptyChangesBox: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyChangesText: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },
});

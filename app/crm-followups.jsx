import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useToast } from './context/ToastContext';
import interiorApiClient from './services/interiorApiClient';
import interiorCrmService from './services/interiorCrmService';

function displayUserName(u) {
  if (!u) return '';
  if (typeof u !== 'object') return 'Assigned';
  if (u.fullName) return u.fullName;
  if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return u.name || 'Assigned';
}

export default function CrmFollowUpsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();

  const [allActivities, setAllActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'completed'
  const [searchTerm, setSearchTerm] = useState('');
  const [completingId, setCompletingId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const loadFollowUps = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await interiorCrmService.getActivities();
      const list = res?.success && res?.data ? res.data : Array.isArray(res) ? res : [];

      // Sort so pending activities take precedence, then newest created/scheduled
      const sorted = [...list].sort((a, b) => {
        const aPending = a.status?.toLowerCase() === 'pending' ? 1 : 0;
        const bPending = b.status?.toLowerCase() === 'pending' ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        return new Date(b.createdAt || b.scheduledDate || 0) - new Date(a.createdAt || a.scheduledDate || 0);
      });

      // Filter and deduplicate per customer (strictly 1 row per lead in follow-ups, matching web flow)
      const seen = new Set();
      const deduped = [];

      for (const act of sorted) {
        if (!act.customer) continue;
        const custId = act.customer._id || act.customer.id;
        if (!custId) continue;
        if (act.customer.status === 'Lost') continue;
        if (act.type === 'Site Visit' || act.type === 'Status Change' || act.type === 'System Update') continue;

        if (!seen.has(custId)) {
          seen.add(custId);
          deduped.push(act);
        }
      }

      setAllActivities(deduped);
    } catch (e) {
      console.error('Failed to load follow-ups', e);
      setAllActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadFollowUps(); }, [loadFollowUps]));

  const handleCompleteActivity = async (activityId) => {
    if (!activityId) return;
    try {
      setCompletingId(activityId);
      // Optimistic update
      setAllActivities((prev) =>
        prev.map((act) =>
          act._id === activityId
            ? { ...act, status: 'Completed', completedDate: new Date().toISOString() }
            : act
        )
      );
      await interiorCrmService.updateActivity(activityId, {
        status: 'Completed',
        completedDate: new Date(),
      });
      showToast('Follow-up marked as completed! You can now send to Site Visit.', 'success');
      loadFollowUps();
    } catch (e) {
      showToast(e.message || 'Failed to complete follow-up', 'error');
      loadFollowUps();
    } finally {
      setCompletingId(null);
    }
  };

  const passToSiteVisit = async (leadId) => {
    if (!leadId) return;
    try {
      setActionLoadingId(leadId);
      await interiorCrmService.updateCustomer(leadId, { status: 'Meeting Scheduled' });
      showToast('Lead moved to Site Visit', 'success');
      loadFollowUps();
    } catch (e) {
      showToast(e.message || 'Failed to update lead', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCall = (phoneNumber) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      showToast('Cannot make phone calls on this device', 'error');
    });
  };

  const handleWhatsApp = (phoneNumber) => {
    if (!phoneNumber) return;
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${cleanNumber}`).catch(() => {
      showToast('Cannot open WhatsApp', 'error');
    });
  };

  const pendingCount = useMemo(
    () => allActivities.filter((a) => a.status?.toLowerCase() === 'pending').length,
    [allActivities]
  );
  const completedCount = useMemo(
    () => allActivities.filter((a) => a.status?.toLowerCase() === 'completed').length,
    [allActivities]
  );

  const filteredActivities = useMemo(() => {
    let list = [...allActivities];

    if (activeTab === 'pending') {
      list = list.filter((a) => a.status?.toLowerCase() === 'pending');
    } else if (activeTab === 'completed') {
      list = list.filter((a) => a.status?.toLowerCase() === 'completed');
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (act) =>
          act.customer?.name?.toLowerCase().includes(q) ||
          act.customer?.mobileNumber?.toLowerCase().includes(q) ||
          act.customer?.leadNumber?.toLowerCase().includes(q) ||
          act.type?.toLowerCase().includes(q) ||
          act.remarks?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allActivities, activeTab, searchTerm]);

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#DBEAFE" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={18} color="#1E293B" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerGreeting}>CRM Workspace / Pipeline</Text>
            <Text style={s.headerTitle}>Follow-up Touchpoints</Text>
            <Text style={s.headerSub}>1 active follow-up per customer until marked done.</Text>
          </View>
        </View>

        {/* Filter Tabs (All, Pending, Completed) */}
        <View style={s.tabBarContainer}>
          <View style={s.tabBar}>
            <TouchableOpacity
              style={[s.tabButton, activeTab === 'all' && s.tabButtonActive]}
              onPress={() => setActiveTab('all')}
              activeOpacity={0.7}
            >
              <Text style={[s.tabButtonText, activeTab === 'all' && s.tabButtonTextActive]}>
                All ({allActivities.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.tabButton, activeTab === 'pending' && s.tabButtonPendingActive]}
              onPress={() => setActiveTab('pending')}
              activeOpacity={0.7}
            >
              <View style={[s.dotIndicator, { backgroundColor: activeTab === 'pending' ? '#FFFFFF' : '#D97706' }]} />
              <Text style={[s.tabButtonText, activeTab === 'pending' && s.tabButtonPendingTextActive]}>
                Pending ({pendingCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.tabButton, activeTab === 'completed' && s.tabButtonCompletedActive]}
              onPress={() => setActiveTab('completed')}
              activeOpacity={0.7}
            >
              <View style={[s.dotIndicator, { backgroundColor: activeTab === 'completed' ? '#FFFFFF' : '#16A34A' }]} />
              <Text style={[s.tabButtonText, activeTab === 'completed' && s.tabButtonCompletedTextActive]}>
                Completed ({completedCount})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={s.searchRow}>
            <Ionicons name="search" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Search follow-ups by lead, phone or note..."
              placeholderTextColor="#94A3B8"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={s.loadingText}>Loading follow-up touchpoints...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadFollowUps(true)}
                tintColor="#2563EB"
                colors={['#2563EB']}
              />
            }
          >
            {filteredActivities.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIconBox}>
                  <Ionicons
                    name={
                      activeTab === 'completed'
                        ? 'checkmark-done-circle-outline'
                        : 'calendar-outline'
                    }
                    size={38}
                    color="#2563EB"
                  />
                </View>
                <Text style={s.emptyTitle}>
                  {searchTerm
                    ? 'No matching follow-ups'
                    : activeTab === 'completed'
                    ? 'No Completed Follow-ups Yet'
                    : 'All Clear!'}
                </Text>
                <Text style={s.emptySub}>
                  {searchTerm
                    ? 'Try adjusting your search terms or filters.'
                    : activeTab === 'completed'
                    ? 'Completed follow-up calls and meetings appear here with a direct option to send to Site Visit.'
                    : 'You have no pending follow-up touchpoints. Open any lead profile to schedule one.'}
                </Text>
              </View>
            ) : (
              filteredActivities.map((act) => {
                const isCompleted = act.status?.toLowerCase() === 'completed';
                const isCompleting = completingId === act._id;
                const isPassingSite = actionLoadingId === act.customer?._id;
                const canPassToSite =
                  isCompleted &&
                  ['New Lead', 'Contacted', 'Meeting Scheduled'].includes(act.customer?.status || '');

                return (
                  <TouchableOpacity
                    key={act._id}
                    style={[
                      s.card,
                      !isCompleted && s.cardPending,
                    ]}
                    activeOpacity={0.75}
                    onPress={() =>
                      router.push({
                        pathname: `/crm-lead/${act.customer?._id}`,
                        params: { tab: 'follow_ups' },
                      })
                    }
                  >
                    {/* Top Row: Customer Info & Status Badge */}
                    <View style={s.cardTopRow}>
                      <View style={[s.avatar, isCompleted && { backgroundColor: '#10B981' }]}>
                        <Text style={s.avatarText}>
                          {act.customer?.name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={s.leadName} numberOfLines={1}>
                            {act.customer?.name || 'Unknown Lead'}
                          </Text>
                          <Text style={s.leadNumber}>{act.customer?.leadNumber || 'LD-XXXX'}</Text>
                        </View>
                        <Text style={s.leadPhone} numberOfLines={1}>
                          {act.customer?.mobileNumber || 'No phone'}
                          {act.customer?.propertyType ? ` Â· ${act.customer.propertyType}` : ''}
                        </Text>
                      </View>

                      <View
                        style={[
                          s.statusBadge,
                          isCompleted ? s.statusBadgeCompleted : s.statusBadgePending,
                        ]}
                      >
                        <Ionicons
                          name={isCompleted ? 'checkmark-circle' : 'time'}
                          size={11}
                          color={isCompleted ? '#16A34A' : '#D97706'}
                        />
                        <Text
                          style={[
                            s.statusBadgeText,
                            isCompleted ? { color: '#16A34A' } : { color: '#D97706' },
                          ]}
                        >
                          {isCompleted ? 'COMPLETED' : 'PENDING'}
                        </Text>
                      </View>
                    </View>

                    {/* Meta Row: Follow-up Type & Scheduled Date */}
                    <View style={s.metaRow}>
                      <View style={s.typeBadge}>
                        <Ionicons name="chatbox-ellipses-outline" size={11} color="#2563EB" />
                        <Text style={s.typeBadgeText}>{act.type || 'Follow-up'}</Text>
                      </View>

                      <View style={s.dateBadge}>
                        <Ionicons name="calendar-outline" size={11} color="#64748B" />
                        <Text style={s.dateBadgeText}>
                          {act.scheduledDate
                            ? new Date(act.scheduledDate).toLocaleString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                            : act.createdAt
                            ? new Date(act.createdAt).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </Text>
                      </View>

                      {act.customer?.assignedSalesExecutive && (
                        <View style={s.assignedBadge}>
                          <Ionicons name="person-circle-outline" size={12} color="#4F46E5" />
                          <Text style={s.assignedBadgeText} numberOfLines={1}>
                            {displayUserName(act.customer.assignedSalesExecutive)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Remarks / Follow-up Notes */}
                    {!!act.remarks && (
                      <View style={s.remarksBox}>
                        <Text style={s.remarksText} numberOfLines={2}>
                          &quot;{act.remarks}&quot;
                        </Text>
                      </View>
                    )}

                    {/* Actions Ribbon */}
                    <View style={s.actionsRow}>
                      {/* Left: Quick Call / WhatsApp */}
                      <View style={s.quickContacts}>
                        {!!act.customer?.mobileNumber && (
                          <TouchableOpacity
                            style={s.contactIconBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleCall(act.customer.mobileNumber);
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="call" size={13} color="#059669" />
                          </TouchableOpacity>
                        )}
                        {!!act.customer?.mobileNumber && (
                          <TouchableOpacity
                            style={s.contactIconBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleWhatsApp(act.customer.mobileNumber);
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="logo-whatsapp" size={13} color="#059669" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Right: Stage progression action */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {!isCompleted ? (
                          <TouchableOpacity
                            style={[s.doneBtn, isCompleting && { opacity: 0.7 }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleCompleteActivity(act._id);
                            }}
                            disabled={isCompleting}
                            activeOpacity={0.7}
                          >
                            {isCompleting ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                                <Text style={s.doneBtnText}>Done</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : canPassToSite ? (
                          <TouchableOpacity
                            style={[s.passSiteBtn, isPassingSite && { opacity: 0.7 }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              passToSiteVisit(act.customer._id);
                            }}
                            disabled={isPassingSite}
                            activeOpacity={0.7}
                          >
                            {isPassingSite ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Ionicons name="location" size={12} color="#FFFFFF" />
                                <Text style={s.passSiteBtnText}>Pass to Site Visit</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <View style={s.completedPill}>
                            <Ionicons name="checkmark" size={12} color="#16A34A" />
                            <Text style={s.completedPillText}>Completed</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B' },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },

  header: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  headerGreeting: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#1D4ED8', textTransform: 'uppercase' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Black', color: '#0F172A', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },

  tabBarContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    padding: 4,
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  tabButtonPendingActive: {
    backgroundColor: '#D97706',
  },
  tabButtonCompletedActive: {
    backgroundColor: '#16A34A',
  },
  tabButtonText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#0F172A',
    fontFamily: 'Inter-Bold',
  },
  tabButtonPendingTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  tabButtonCompletedTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
    padding: 0,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', lineHeight: 18 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  cardPending: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  leadName: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A', flexShrink: 1 },
  leadNumber: { fontSize: 10.5, fontFamily: 'Inter-Medium', color: '#64748B', flexShrink: 0 },
  leadPhone: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgePending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusBadgeCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.3,
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#2563EB' },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dateBadgeText: { fontSize: 10.5, fontFamily: 'Inter-Medium', color: '#64748B' },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#EDE9FE',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  assignedBadgeText: { fontSize: 10.5, fontFamily: 'Inter-Medium', color: '#6D28D9' },

  remarksBox: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#CBD5E1',
  },
  remarksText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#475569', fontStyle: 'italic' },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickContacts: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  doneBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  passSiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  passSiteBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  completedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  completedPillText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#16A34A' },
});

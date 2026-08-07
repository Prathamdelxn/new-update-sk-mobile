import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useToast } from './context/ToastContext';
import interiorApiClient from './services/interiorApiClient';

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

  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await interiorApiClient.get('/crm/activities/pending');
      const list = res?.success && res?.data ? res.data : Array.isArray(res) ? res : [];
      const filtered = list.filter((act) => act.customer && ['New Lead', 'Contacted'].includes(act.customer.status));
      setFollowUps(filtered);
    } catch (e) {
      console.error('Failed to load pending follow-ups', e);
      setFollowUps([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const passToSiteVisit = async (leadId) => {
    if (!leadId) return;
    try {
      await interiorApiClient.patch(`/crm/customers/${leadId}`, { status: 'Meeting Scheduled' });
      showToast('Lead moved to Site Visit', 'success');
      load();
    } catch (e) {
      showToast(e.message || 'Failed to update lead', 'error');
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
            <Text style={s.headerTitle}>Pending Follow-ups</Text>
            <Text style={s.headerSub}>Manage your scheduled calls and meetings.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#2563EB" colors={['#2563EB']} />}
          >
            {followUps.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="checkmark-done-circle-outline" size={44} color="#94A3B8" />
                <Text style={s.emptyTitle}>All clear!</Text>
                <Text style={s.emptySub}>You have no pending follow-ups. Open any lead's profile to schedule one.</Text>
              </View>
            ) : (
              followUps.map((act) => (
                <TouchableOpacity
                  key={act._id}
                  style={s.card}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/crm-lead/${act.customer?._id}`)}
                >
                  <View style={s.cardTopRow}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>{act.customer?.name?.charAt(0).toUpperCase() || '?'}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.leadName} numberOfLines={1}>{act.customer?.name || 'Unknown'}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="call-outline" size={11} color="#94A3B8" />
                        <Text style={s.leadPhone}>{act.customer?.mobileNumber}</Text>
                      </View>
                    </View>
                    <View style={s.scheduledBadge}>
                      <Ionicons name="time-outline" size={12} color="#B45309" />
                      <Text style={s.scheduledBadgeText}>
                        {act.scheduledDate ? new Date(act.scheduledDate).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                      </Text>
                    </View>
                  </View>

                  <View style={s.metaRow}>
                    <View style={s.typeBadge}>
                      <Text style={s.typeBadgeText}>{act.type}</Text>
                    </View>
                    {act.customer?.assignedSalesExecutive ? (
                      <View style={s.assignedBadge}>
                        <Ionicons name="person-circle-outline" size={13} color="#2563EB" />
                        <Text style={s.assignedBadgeText} numberOfLines={1}>{displayUserName(act.customer.assignedSalesExecutive)}</Text>
                      </View>
                    ) : (
                      <Text style={s.unassignedText}>Unassigned</Text>
                    )}
                  </View>

                  {!!act.remarks && <Text style={s.remarks} numberOfLines={2}>{act.remarks}</Text>}

                  <TouchableOpacity
                    style={s.passBtn}
                    onPress={(e) => { e.stopPropagation?.(); passToSiteVisit(act.customer?._id); }}
                  >
                    <Text style={s.passBtnText}>Pass to Site Visit</Text>
                    <Ionicons name="arrow-forward" size={13} color="#7C3AED" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 14, gap: 10 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 10 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  leadName: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  leadPhone: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  scheduledBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  scheduledBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#B45309' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  typeBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#2563EB', textTransform: 'uppercase', letterSpacing: 0.3 },
  assignedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexShrink: 1 },
  assignedBadgeText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  unassignedText: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', fontStyle: 'italic' },

  remarks: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B' },

  passBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#F5F3FF', paddingVertical: 8, borderRadius: 10 },
  passBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#7C3AED' },
});

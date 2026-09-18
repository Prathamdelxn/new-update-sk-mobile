import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import interiorCrmService from './services/interiorCrmService';
import interiorApiClient from './services/interiorApiClient';

// Currency formatter using unicode rupee symbol
function formatBudget(amount) {
  if (!amount) return '\u20B90';
  return `\u20B9${Math.round(amount).toLocaleString('en-IN')}`;
}

function getStatusColor(status) {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'on track') return { bg: '#DBEAFE', text: '#1D4ED8' };
  if (s === 'completed' || s === 'done') return { bg: '#DCFCE7', text: '#15803D' };
  if (s === 'delayed' || s === 'at risk') return { bg: '#FEE2E2', text: '#DC2626' };
  return { bg: '#DBEAFE', text: '#1D4ED8' };
}

export default function CrmWonProjectsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      // Fetch interior projects (converted from CRM leads)
      const res = await interiorApiClient.get('/i-projects');
      const list = res?.success && res?.data ? res.data : Array.isArray(res) ? res : [];
      setProjects(list);
    } catch (e) {
      // Fallback to /projects if /i-projects is not available
      try {
        const res2 = await interiorApiClient.get('/projects');
        const list2 = res2?.success && res2?.data ? res2.data : Array.isArray(res2) ? res2 : [];
        setProjects(list2);
      } catch {
        console.error('Failed to load projects', e);
        setProjects([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Won Projects</Text>
            <Text style={s.headerSub}>Converted leads now in execution.</Text>
          </View>
          <View style={s.totalBadge}>
            <Ionicons name="trophy" size={12} color="#D97706" />
            <Text style={s.totalBadgeText}>{projects.length}</Text>
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
            {projects.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIconBox}>
                  <Ionicons name="trophy-outline" size={32} color="#FCD34D" />
                </View>
                <Text style={s.emptyTitle}>No Converted Projects Yet</Text>
                <Text style={s.emptySub}>
                  Once a quotation is accepted and converted, the project will appear here for the execution team.
                </Text>
              </View>
            ) : (
              projects.map((p) => {
                const statusColor = getStatusColor(p.status || p.health);
                return (
                  <TouchableOpacity
                    key={p._id || p.id}
                    style={s.card}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/i-project/${p._id || p.id}`)}
                  >
                    {/* Card Header */}
                    <View style={s.cardTopRow}>
                      <View style={s.trophyBox}>
                        <Ionicons name="trophy" size={18} color="#D97706" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.projectName} numberOfLines={1}>
                          {p.name || p.projectName || 'Interior Project'}
                        </Text>
                        <View style={s.clientChip}>
                          <Ionicons name="person-outline" size={11} color="#64748B" />
                          <Text style={s.clientChipText} numberOfLines={1}>
                            {p.client || p.customer?.name || p.clientName || 'Client'}
                          </Text>
                        </View>
                      </View>
                      <View style={[s.statusPill, { backgroundColor: statusColor.bg }]}>
                        <Text style={[s.statusPillText, { color: statusColor.text }]}>
                          {p.status || p.health || 'Active'}
                        </Text>
                      </View>
                    </View>

                    {/* Stats */}
                    <View style={s.statsBox}>
                      <View style={s.statsRow}>
                        <Text style={s.statsLabel}>Final Budget</Text>
                        <Text style={s.statsValue}>
                          {formatBudget(p.budget?.amount ?? p.totalBudget ?? p.finalBudget)}
                        </Text>
                      </View>
                      {p.startDate && (
                        <View style={s.statsRow}>
                          <Text style={s.statsLabel}>Start Date</Text>
                          <Text style={s.statsValueSm}>
                            {new Date(p.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                        </View>
                      )}
                      {(p.completionPercentage !== undefined || p.progress !== undefined) && (
                        <View style={s.statsRow}>
                          <Text style={s.statsLabel}>Progress</Text>
                          <Text style={s.statsValue}>{p.completionPercentage ?? p.progress ?? 0}%</Text>
                        </View>
                      )}
                    </View>

                    {/* CTA */}
                    <View style={s.openBtn}>
                      <Text style={s.openBtnText}>Open Project Details</Text>
                      <Ionicons name="arrow-forward" size={14} color="#B45309" />
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
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  totalBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  totalBadgeText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#D97706' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10, paddingHorizontal: 30 },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', lineHeight: 18 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#F1F5F9', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  trophyBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  projectName: { fontSize: 14.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  clientChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F8FAFC', alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 5,
  },
  clientChipText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexShrink: 0 },
  statusPillText: { fontSize: 9.5, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },

  statsBox: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9',
    borderRadius: 14, padding: 12, gap: 8,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsLabel: {
    fontSize: 10, fontFamily: 'Inter-Bold', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  statsValue: { fontSize: 13, fontFamily: 'Inter-Black', color: '#0F172A' },
  statsValueSm: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#0F172A' },

  openBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#FFFBEB', paddingVertical: 11, borderRadius: 12,
  },
  openBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#B45309' },
});

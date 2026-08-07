import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import interiorApiClient from './services/interiorApiClient';

function formatBudget(amount) {
  if (!amount) return '₹0';
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
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
      const res = await interiorApiClient.get('/projects');
      const list = res?.success && res?.data ? res.data : Array.isArray(res) ? res : [];
      setProjects(list);
    } catch (e) {
      console.error('Failed to load projects', e);
      setProjects([]);
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
                <Ionicons name="trophy-outline" size={44} color="#FCD34D" />
                <Text style={s.emptyTitle}>No Converted Projects Yet</Text>
                <Text style={s.emptySub}>Once a quotation is accepted and converted, the project will appear here for the execution team.</Text>
              </View>
            ) : (
              projects.map((p) => (
                <TouchableOpacity
                  key={p._id || p.id}
                  style={s.card}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/i-project/${p._id || p.id}`)}
                >
                  <View style={s.cardTopRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.projectName} numberOfLines={1}>{p.name || p.projectName}</Text>
                      <View style={s.clientChip}>
                        <Ionicons name="person-outline" size={11} color="#64748B" />
                        <Text style={s.clientChipText} numberOfLines={1}>{p.client || p.customer?.name || 'Client'}</Text>
                      </View>
                    </View>
                    <View style={s.trophyBox}>
                      <Ionicons name="trophy" size={18} color="#D97706" />
                    </View>
                  </View>

                  <View style={s.statsBox}>
                    <View style={s.statsRow}>
                      <Text style={s.statsLabel}>Final Budget</Text>
                      <Text style={s.statsValue}>{formatBudget(p.budget?.amount ?? p.totalBudget)}</Text>
                    </View>
                    <View style={s.statsRow}>
                      <Text style={s.statsLabel}>Status</Text>
                      <View style={s.statusPill}>
                        <Text style={s.statusPillText}>{p.status || p.health || 'Active'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={s.openBtn}>
                    <Text style={s.openBtnText}>Open Project Details</Text>
                    <Ionicons name="arrow-forward" size={14} color="#B45309" />
                  </View>
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
  scroll: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', gap: 12 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  projectName: { fontSize: 14.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  clientChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F8FAFC', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 6 },
  clientChipText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  trophyBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center' },

  statsBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 14, padding: 12, gap: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.3 },
  statsValue: { fontSize: 13, fontFamily: 'Inter-Black', color: '#0F172A' },
  statusPill: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusPillText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#1D4ED8', textTransform: 'uppercase' },

  openBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFFBEB', paddingVertical: 11, borderRadius: 12 },
  openBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#B45309' },
});

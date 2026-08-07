import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import interiorApiClient from './services/interiorApiClient';

const STAGES = [
  { key: 'site_visits', label: 'Site Visits', icon: 'location-outline', color: '#7C3AED', statuses: ['Meeting Scheduled', 'Measurement Done'] },
  { key: 'requirement_design', label: 'Requirements & Design', icon: 'create-outline', color: '#059669', statuses: ['Requirement Completed', 'Design Approved'] },
  { key: 'quotations', label: 'Quotations', icon: 'document-text-outline', color: '#E11D48', statuses: ['Quotation Sent'] },
];

export default function CrmPipelineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [activeStage, setActiveStage] = useState(STAGES.some((s) => s.key === params.stage) ? params.stage : 'site_visits');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await interiorApiClient.get('/crm/customers');
      const list = res?.success && res?.data ? res.data : Array.isArray(res) ? res : [];
      setLeads(list);
    } catch (e) {
      console.error('Failed to load leads', e);
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const stage = STAGES.find((s) => s.key === activeStage);
  const filtered = leads.filter((l) => stage.statuses.includes(l.status));

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Pipeline Views</Text>
            <Text style={s.headerSub}>All leads at each sales stage.</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {STAGES.map((st) => (
            <TouchableOpacity
              key={st.key}
              style={[s.tabBtn, activeStage === st.key && { backgroundColor: st.color }]}
              onPress={() => setActiveStage(st.key)}
            >
              <Ionicons name={st.icon} size={13} color={activeStage === st.key ? '#FFFFFF' : st.color} />
              <Text style={[s.tabBtnText, activeStage === st.key && { color: '#FFFFFF' }]}>{st.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
            {filtered.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name={stage.icon} size={40} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No leads in this stage</Text>
                <Text style={s.emptySub}>Leads will appear here once they reach the {stage.label} stage.</Text>
              </View>
            ) : (
              filtered.map((lead) => (
                <TouchableOpacity key={lead._id} style={s.card} activeOpacity={0.7} onPress={() => router.push(`/crm-lead/${lead._id}`)}>
                  <View style={[s.avatar, { backgroundColor: stage.color }]}>
                    <Text style={s.avatarText}>{lead.name?.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.leadName} numberOfLines={1}>{lead.name}</Text>
                      <Text style={s.leadNumber}>{lead.leadNumber || 'LD-XXXX'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name="home-outline" size={11} color="#94A3B8" />
                      <Text style={s.leadLocation} numberOfLines={1}>{lead.projectLocation || 'Location Pending'}</Text>
                    </View>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: `${stage.color}15` }]}>
                    <Text style={[s.statusBadgeText, { color: stage.color }]}>{lead.status}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
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
  scroll: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  tabRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F8FAFC' },
  tabBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#64748B' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  avatar: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  leadName: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  leadNumber: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  leadLocation: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', flexShrink: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 9, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
});

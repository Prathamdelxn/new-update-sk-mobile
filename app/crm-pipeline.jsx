import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import interiorCrmService from './services/interiorCrmService';

const STAGES = [
  {
    key: 'site_visits',
    label: 'Site Visits',
    icon: 'location-outline',
    color: '#7C3AED',
    statuses: ['Meeting Scheduled', 'Under Site Visit', 'Measurement Done'],
  },
  {
    key: 'requirement_design',
    label: 'Requirements',
    icon: 'create-outline',
    color: '#059669',
    statuses: ['Under Requirement', 'Requirement Completed'],
  },
  {
    key: 'drawing',
    label: '2D/3D Drawing',
    icon: 'pencil-outline',
    color: '#0284C7',
    statuses: ['Under Drawing', 'Design Approved'],
  },
  {
    key: 'boq',
    label: 'BOQ',
    icon: 'calculator-outline',
    color: '#0D9488',
    statuses: ['Under BOQ Creation', 'BOQ Approved'],
  },
  {
    key: 'quotations',
    label: 'Quotations',
    icon: 'document-text-outline',
    color: '#E11D48',
    statuses: ['Under Quotation', 'Quotation Sent', 'Booking Pending'],
  },
];

export default function CrmPipelineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [activeStage, setActiveStage] = useState(
    STAGES.some((s) => s.key === params.stage) ? params.stage : 'site_visits'
  );
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const list = await interiorCrmService.getCustomers();
      setLeads(Array.isArray(list) ? list : []);
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
  const filtered = leads.filter(
    (l) => l.status !== 'Lost' && l.status !== 'Won' && l.status !== 'Converted' && stage.statuses.includes(l.status)
  );

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
          <View style={s.totalBadge}>
            <Text style={s.totalBadgeText}>{filtered.length} leads</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {STAGES.map((st) => {
            const count = leads.filter(
              (l) => l.status !== 'Lost' && l.status !== 'Won' && l.status !== 'Converted' && st.statuses.includes(l.status)
            ).length;
            const isActive = activeStage === st.key;
            return (
              <TouchableOpacity
                key={st.key}
                style={[s.tabBtn, isActive && { backgroundColor: st.color }]}
                onPress={() => setActiveStage(st.key)}
              >
                <Ionicons name={st.icon} size={13} color={isActive ? '#FFFFFF' : st.color} />
                <Text style={[s.tabBtnText, isActive && { color: '#FFFFFF' }]}>{st.label}</Text>
                {count > 0 && (
                  <View style={[s.tabCount, isActive && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                    <Text style={[s.tabCountText, isActive && { color: '#FFFFFF' }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
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
                <View style={[s.emptyIconBox, { backgroundColor: `${stage.color}15` }]}>
                  <Ionicons name={stage.icon} size={28} color={stage.color} />
                </View>
                <Text style={s.emptyTitle}>No leads in this stage</Text>
                <Text style={s.emptySub}>
                  Leads will appear here once they reach the {stage.label} stage.
                </Text>
              </View>
            ) : (
              filtered.map((lead) => (
                <TouchableOpacity
                  key={lead._id}
                  style={s.card}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/crm-lead/${lead._id}`)}
                >
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
                      <Text style={s.leadLocation} numberOfLines={1}>
                        {lead.projectLocation || 'Location Pending'}
                      </Text>
                    </View>
                    {lead.assignedSalesExecutive && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Ionicons name="person-outline" size={10} color="#94A3B8" />
                        <Text style={s.leadAssigned} numberOfLines={1}>
                          {lead.assignedSalesExecutive?.fullName || lead.assignedSalesExecutive?.name || 'Assigned'}
                        </Text>
                      </View>
                    )}
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

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  totalBadge: {
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  totalBadgeText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB' },

  tabRow: {
    gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F8FAFC',
  },
  tabBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#64748B' },
  tabCount: {
    backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, minWidth: 18, alignItems: 'center',
  },
  tabCountText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#475569' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10, paddingHorizontal: 30 },
  emptyIconBox: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', lineHeight: 18 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  avatar: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  leadName: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A', flexShrink: 1 },
  leadNumber: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8', flexShrink: 0 },
  leadLocation: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', flexShrink: 1 },
  leadAssigned: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#7C3AED', flexShrink: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 9, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
});

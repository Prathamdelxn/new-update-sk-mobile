import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Image, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import interiorApiClient from '../../services/interiorApiClient';

export default function InteriorSiteDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get('/crm/customers');
      const customers = res?.success && res?.data ? res.data : Array.isArray(res) ? res : [];
      const found = customers.find((c) => {
        if (!c.linkedProject) return false;
        const linkedId = typeof c.linkedProject === 'object' && c.linkedProject?._id ? String(c.linkedProject._id) : String(c.linkedProject);
        return linkedId === String(projectId);
      });
      setCustomer(found || null);
    } catch (e) {
      console.error('Failed to load site details', e);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const requirements = customer?.requirements || [];
  const siteMeasurements = customer?.siteMeasurements;
  const sitePhotos = customer?.sitePhotos || [];
  const hasRequirements = requirements.length > 0;
  const hasMeasurements = !!siteMeasurements;
  const hasPhotos = sitePhotos.length > 0;
  const hasNothing = !hasRequirements && !hasMeasurements && !hasPhotos;

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Site Details</Text>
            <Text style={s.headerSub}>Measurements, photos & requirements from the original lead.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : !customer ? (
          <View style={s.empty}>
            <Ionicons name="clipboard-outline" size={44} color="#CBD5E1" />
            <Text style={s.emptyTitle}>No CRM Link Found</Text>
            <Text style={s.emptySub}>This project doesn't have associated CRM site visit data or requirements.</Text>
          </View>
        ) : hasNothing ? (
          <View style={s.empty}>
            <Ionicons name="clipboard-outline" size={44} color="#CBD5E1" />
            <Text style={s.emptyTitle}>No Site Details Logged</Text>
            <Text style={s.emptySub}>The original CRM lead does not have any recorded requirements, measurements, or site photos.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.sectionHeader}>
              <Ionicons name="resize-outline" size={14} color="#7C3AED" />
              <Text style={s.sectionHeaderText}>Measurements</Text>
            </View>
            {hasMeasurements ? (
              <View style={s.card}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={s.metricBox}>
                    <Text style={s.metricLabel}>Carpet Area</Text>
                    <Text style={s.metricValue}>{siteMeasurements.carpetArea || 0} <Text style={s.metricUnit}>Sq.Ft</Text></Text>
                  </View>
                  <View style={s.metricBox}>
                    <Text style={s.metricLabel}>Ceiling</Text>
                    <Text style={s.metricValue}>{siteMeasurements.ceilingHeight || 0} <Text style={s.metricUnit}>Ft</Text></Text>
                  </View>
                </View>
                {!!siteMeasurements.rooms && (
                  <View style={[s.metricBox, { marginTop: 10 }]}>
                    <Text style={s.metricLabel}>Rooms Count</Text>
                    <Text style={s.metricValueSm}>{siteMeasurements.rooms}</Text>
                  </View>
                )}
                {!!siteMeasurements.notes && (
                  <View style={[s.metricBox, { marginTop: 10 }]}>
                    <Text style={s.metricLabel}>Notes</Text>
                    <Text style={s.metricValueSm}>{siteMeasurements.notes}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={s.dashedBox}><Text style={s.dashedBoxText}>No measurements logged.</Text></View>
            )}

            <View style={[s.sectionHeader, { marginTop: 18 }]}>
              <Ionicons name="images-outline" size={14} color="#7C3AED" />
              <Text style={s.sectionHeaderText}>Site Photos</Text>
            </View>
            {hasPhotos ? (
              <View style={s.photoGrid}>
                {sitePhotos.map((photo, idx) => (
                  <TouchableOpacity key={idx} style={s.photoThumb} onPress={() => Linking.openURL(photo)}>
                    <Image source={{ uri: photo }} style={s.photoImg} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={s.dashedBox}><Text style={s.dashedBoxText}>No photos uploaded.</Text></View>
            )}

            <View style={[s.sectionHeader, { marginTop: 18 }]}>
              <Ionicons name="list-outline" size={14} color="#059669" />
              <Text style={[s.sectionHeaderText, { color: '#059669' }]}>Requirements</Text>
            </View>
            {hasRequirements ? (
              <View style={{ gap: 10 }}>
                {requirements.map((req, idx) => (
                  <View key={idx} style={s.reqCard}>
                    <View style={s.reqTopRow}>
                      <Text style={s.reqRoom}>{req.roomName || 'General Requirement'}</Text>
                      {!!req.theme && (
                        <View style={s.themeBadge}>
                          <Text style={s.themeBadgeText}>{req.theme}</Text>
                        </View>
                      )}
                    </View>
                    {!!req.description && <Text style={s.reqDesc}>{req.description}</Text>}
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.dashedBox}><Text style={s.dashedBoxText}>No requirements recorded.</Text></View>
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
  scroll: { paddingHorizontal: 20, paddingTop: 14 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionHeaderText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.5 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', padding: 14 },
  metricBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12 },
  metricLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.3 },
  metricValue: { fontSize: 15, fontFamily: 'Inter-Black', color: '#0F172A', marginTop: 4 },
  metricUnit: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  metricValueSm: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 4 },

  dashedBox: { borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 16, padding: 20, alignItems: 'center', backgroundColor: '#F8FAFC' },
  dashedBoxText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
  photoImg: { width: '100%', height: '100%' },

  reqCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9', padding: 13 },
  reqTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  reqRoom: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1 },
  themeBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  themeBadgeText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#059669', textTransform: 'uppercase' },
  reqDesc: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 6, lineHeight: 17 },
});

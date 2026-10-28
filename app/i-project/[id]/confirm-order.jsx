import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import interiorApiClient from '../../services/interiorApiClient';
import { useToast } from '../../context/ToastContext';
import { useProjectPermissions } from '../../utils/interior/useProjectPermissions';
import ConfirmOrderView from '../../components/interior/ConfirmOrderView';
import QuotationPreviewModal from '../../components/interior/QuotationPreviewModal';

// Project "Confirm Order": the confirmed order of the CRM lead this project was
// converted from, read and saved through the project endpoint (project
// "Confirm Order" permission, no CRM access needed) — same as the web tab.
export default function InteriorProjectConfirmOrderScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { id: projectId } = useLocalSearchParams();
  const { can } = useProjectPermissions(projectId);

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await interiorApiClient.get(`/projects/${projectId}/confirm-order`);
      setLead(res?.data ?? null);
    } catch (e) {
      showToast(e?.message || 'Failed to load the confirmed order', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveUpdates = (updates) => interiorApiClient.patch(`/projects/${projectId}/confirm-order`, updates);
  const hasQuotations = (lead?.quotations || []).length > 0;

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Confirm Order</Text>
            <Text style={s.headerSub}>Vendor dispatches and signed order documents.</Text>
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#2563EB" />}
          >
            {!lead || !hasQuotations ? (
              <View style={s.emptyCard}>
                <Ionicons name="receipt-outline" size={36} color="#CBD5E1" />
                <Text style={s.emptyTitle}>{!lead ? 'No CRM order linked' : 'No quotations yet'}</Text>
                <Text style={s.emptySub}>
                  {!lead
                    ? 'This project was not converted from a CRM lead, so there is no confirmed order to show.'
                    : 'The linked CRM lead has no quotations yet.'}
                </Text>
              </View>
            ) : (
              <>
                {!!lead.confirmedOrder?.orderNumber && (
                  <View style={s.summary}>
                    <Text style={s.summaryLabel}>Order</Text>
                    <Text style={s.summaryValue}>{lead.confirmedOrder.title || lead.name} · {lead.confirmedOrder.orderNumber}</Text>
                  </View>
                )}
                <ConfirmOrderView
                  lead={lead}
                  canEdit={can('confirm_order', 'update')}
                  saveUpdates={saveUpdates}
                  onRefresh={() => load()}
                  onViewQuotation={(idx) => setPreviewIndex(idx)}
                />
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Quotation document (same preview as the web: print, PDF, send) */}
      <QuotationPreviewModal
        visible={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        lead={lead}
        quotationIndex={previewIndex}
        canSend={can('confirm_order', 'update')}
        canExport
        onSent={() => load()}
      />
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 28, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1E293B' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center' },
  summary: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 10 },
  summaryLabel: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginTop: 2 },
});

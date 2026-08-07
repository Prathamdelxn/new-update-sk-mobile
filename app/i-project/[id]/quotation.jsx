import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import interiorApiClient from '../../services/interiorApiClient';

function formatAmount(amount) {
  return `₹${Math.round(amount || 0).toLocaleString('en-IN')}`;
}

export default function InteriorProjectQuotationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interiorApiClient.get('/crm/customers');
      const customers = res?.success && res?.data ? res.data : Array.isArray(res) ? res : [];
      const customer = customers.find((c) => {
        if (!c.linkedProject) return false;
        const linkedId = typeof c.linkedProject === 'object' && c.linkedProject?._id ? String(c.linkedProject._id) : String(c.linkedProject);
        return linkedId === String(projectId);
      });
      const approved = (customer?.quotations || []).filter((q) => q.status === 'Approved' || q.status === 'Accepted');
      setQuotations(approved);
    } catch (e) {
      console.error('Failed to load project quotations', e);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

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
            <Text style={s.headerTitle}>Approved Quotations</Text>
            <Text style={s.headerSub}>Final approved financial quotes for this project.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {quotations.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="document-text-outline" size={44} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No Approved Quotations Found</Text>
                <Text style={s.emptySub}>There are no approved quotations associated with this project.</Text>
              </View>
            ) : (
              quotations.map((quote, idx) => (
                <View key={quote._id || idx} style={s.card}>
                  <View style={s.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="document-text-outline" size={15} color="#059669" />
                      <Text style={s.cardHeaderTitle}>{quote.quotationNumber || `Quotation V${quote.version}`}</Text>
                    </View>
                    <View style={s.statusBadge}>
                      <Ionicons name="checkmark-circle" size={12} color="#059669" />
                      <Text style={s.statusBadgeText}>{quote.status}</Text>
                    </View>
                  </View>

                  <View style={s.cardBody}>
                    <View style={s.metaRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.metaLabel}>Version</Text>
                        <Text style={s.metaValue}>V{quote.version}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.metaLabel}>Date</Text>
                        <Text style={s.metaValue}>{quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('en-IN') : 'N/A'}</Text>
                      </View>
                    </View>

                    <View style={s.divider} />

                    <View style={s.lineRow}>
                      <Text style={s.lineLabel}>Subtotal</Text>
                      <Text style={s.lineValue}>{formatAmount(quote.subtotal ?? quote.subTotal)}</Text>
                    </View>
                    <View style={s.lineRow}>
                      <Text style={s.lineLabel}>Tax / Discount</Text>
                      <Text style={s.lineValue}>
                        {quote.tax > 0 ? `+${formatAmount(quote.tax)} ` : ''}
                        {quote.discount > 0 ? `-${formatAmount(quote.discount)}` : ''}
                        {!quote.tax && !quote.discount ? '₹0' : ''}
                      </Text>
                    </View>
                    <View style={[s.lineRow, s.grandTotalRow]}>
                      <Text style={s.grandTotalLabel}>Grand Total</Text>
                      <Text style={s.grandTotalValue}>{formatAmount(quote.grandTotal)}</Text>
                    </View>
                  </View>
                </View>
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

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#A7F3D0', overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ECFDF5', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#D1FAE5' },
  cardHeaderTitle: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#065F46' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#059669', textTransform: 'uppercase' },

  cardBody: { padding: 14 },
  metaRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  metaLabel: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  metaValue: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2 },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 10 },

  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  lineLabel: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B' },
  lineValue: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 6, paddingTop: 10 },
  grandTotalLabel: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  grandTotalValue: { fontSize: 16, fontFamily: 'Inter-Black', color: '#2563EB' },
});

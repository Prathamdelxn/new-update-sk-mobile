import { tr } from '../utils/i18n/tr';
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import interiorApiClient from '../services/interiorApiClient';
import SkeletonList from '../components/common/SkeletonList';

// Interior in-app notifications (same data as the web header bell): RFIs assigned to you,
// RFIs waiting for a project manager to route, etc.

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return tr('just now');
  if (s < 3600) return tr('{{n}}m ago', { n: Math.floor(s / 60) });
  if (s < 86400) return tr('{{n}}h ago', { n: Math.floor(s / 3600) });
  return tr('{{n}}d ago', { n: Math.floor(s / 86400) });
}

/** Web paths in actionUrl → the matching app screen. */
function appRouteFor(actionUrl) {
  const m = String(actionUrl || '').match(/\/interior-new\/projects\/([^/?#]+)\/rfis/);
  if (m) {
    const rfi = new URLSearchParams(String(actionUrl).split('?')[1] || '').get('rfi');
    return { pathname: `/i-project/${m[1]}/rfis`, params: rfi ? { rfi } : {} };
  }
  return null;
}

export default function InteriorNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await interiorApiClient.get('/notifications', { params: { limit: 50 } });
      setItems(res?.data?.items || []);
      setUnread(res?.data?.unreadCount || 0);
    } catch (e) {
      console.warn('Failed to load notifications', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markRead = async (body) => {
    setItems((prev) => prev.map((n) => (body.all || body.ids?.includes(n._id) ? { ...n, isRead: true } : n)));
    setUnread((u) => (body.all ? 0 : Math.max(0, u - 1)));
    try {
      await interiorApiClient.patch('/notifications', body);
    } catch {
      load();
    }
  };

  const open = (n) => {
    if (!n.isRead) markRead({ ids: [n._id] });
    const route = appRouteFor(n.actionUrl);
    if (route) router.push(route);
  };

  return (
    <View style={s.outer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text style={s.title}>{tr('Notifications')}</Text>
          {unread > 0 ? (
            <TouchableOpacity onPress={() => markRead({ all: true })} hitSlop={8}>
              <Text style={s.markAll}>{tr('Mark all read')}</Text>
            </TouchableOpacity>
          ) : <View />}
        </View>

        {loading ? (
          <SkeletonList variant="rows" />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(n) => n._id}
            contentContainerStyle={items.length === 0 ? { flex: 1 } : { paddingVertical: 6 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="notifications-off-outline" size={36} color="#CBD5E1" />
                <Text style={s.emptyText}>{tr("You're all caught up")}</Text>
              </View>
            }
            renderItem={({ item: n }) => (
              <TouchableOpacity style={[s.row, !n.isRead && s.rowUnread]} onPress={() => open(n)} activeOpacity={0.75}>
                <View style={s.icon}>
                  <Ionicons name="chatbox-ellipses-outline" size={18} color="#4F46E5" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.rowTitle, !n.isRead && { fontFamily: 'Inter-Bold' }]} numberOfLines={2}>{n.title}</Text>
                  <Text style={s.rowBody} numberOfLines={2}>{n.body}</Text>
                  <Text style={s.rowTime}>{timeAgo(n.createdAt)}</Text>
                </View>
                {!n.isRead && <View style={s.dot} />}
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F8FAFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  title: { flex: 1, fontSize: 17, fontFamily: 'Inter-Bold', color: '#0F172A' },
  markAll: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#2563EB' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  rowUnread: { backgroundColor: '#F5F8FF' },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  rowBody: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2, lineHeight: 17 },
  rowTime: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB', marginTop: 6 },
});

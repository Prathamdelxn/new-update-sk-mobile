// Tapping the On Track / At Risk / Delayed badge explains WHY (same rules as the backend
// health check and the web ProjectHealthBadge), and links to each cause.
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import interiorApiClient from '../../../services/interiorApiClient';
import { useProjectPermissions } from '../../../utils/interior/useProjectPermissions';
import { buildHealthReasons } from '../../../utils/interior/projectActionItems';

const listOf = (r) => {
  if (!r || r.status !== 'fulfilled' || !r.value) return [];
  const d = r.value?.data ?? r.value;
  return (Array.isArray(d) ? d : []).filter((x) => x && !x.isDeleted);
};

export default function HealthReasonsSheet({ visible, onClose, projectId, project, healthLabel }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { can } = useProjectPermissions(projectId);
  const allowed = { tasks: can('tasks', 'read'), milestones: can('milestones', 'read'), risks: can('risks', 'read') };
  const health = project?.health || 'on-track';

  const query = useQuery({
    queryKey: ['interior-project-health-reasons', projectId, allowed.tasks, allowed.milestones, allowed.risks],
    enabled: visible && !!projectId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const get = (ok, path) => (ok ? interiorApiClient.get(`/projects/${projectId}/${path}`) : Promise.resolve(null));
      const [t, m, r] = await Promise.allSettled([get(allowed.tasks, 'tasks'), get(allowed.milestones, 'milestones'), get(allowed.risks, 'risks')]);
      return { tasks: listOf(t), milestones: listOf(m), risks: listOf(r) };
    },
  });

  const reasons = buildHealthReasons(project, query.data);
  const hidden = Object.entries(allowed).filter(([, ok]) => !ok).map(([k]) => k);

  const go = (section, taskId) => {
    onClose();
    if (section === 'tasks' && taskId) router.push({ pathname: `/i-project/${projectId}/tasks`, params: { task: taskId } });
    else router.push(`/i-project/${projectId}/${section}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.grabber} />
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{health === 'on-track' ? 'Project is on track' : `Why "${healthLabel}"?`}</Text>
            <Text style={s.sub}>
              {health === 'delayed'
                ? 'Delayed = a milestone is delayed, or the end date has passed.'
                : health === 'at-risk'
                  ? 'At Risk = an overdue task, or an open risk scoring 6+.'
                  : 'No overdue tasks, delayed milestones or high-score risks.'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
          {query.isPending && visible ? (
            <View style={s.center}><ActivityIndicator color="#2563EB" /><Text style={s.sub}>Checking what's causing this…</Text></View>
          ) : reasons.length === 0 ? (
            <View style={s.center}>
              <Ionicons name="checkmark-circle" size={30} color="#10B981" />
              <Text style={s.okTitle}>{health === 'on-track' ? 'Nothing needs attention' : 'Nothing is flagged any more'}</Text>
              {health !== 'on-track' && <Text style={s.sub}>The issues seem resolved. Go back and reopen the project to update the status.</Text>}
            </View>
          ) : (
            reasons.map((r) => (
              <View key={r.key} style={s.reason}>
                <TouchableOpacity style={s.reasonHead} onPress={() => go(r.section)} activeOpacity={0.75}>
                  <View style={[s.reasonIcon, { backgroundColor: r.bg }]}>
                    <Ionicons name={r.icon} size={16} color={r.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.reasonTitle}>{r.title}</Text>
                    <Text style={s.reasonHint}>{r.hint}</Text>
                  </View>
                  <Text style={s.openText}>Open</Text>
                </TouchableOpacity>
                {r.rows.slice(0, 5).map((row) => (
                  <TouchableOpacity key={row.id} style={s.rowItem} onPress={() => go(r.section, row.taskId)} activeOpacity={0.75}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.rowLabel} numberOfLines={1}>{row.label}</Text>
                      {!!row.sub && <Text style={s.rowSub} numberOfLines={1}>{row.sub}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                  </TouchableOpacity>
                ))}
                {r.rows.length > 5 && (
                  <TouchableOpacity style={s.rowItem} onPress={() => go(r.section)}>
                    <Text style={s.openText}>+{r.rows.length - 5} more</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
          {hidden.length > 0 && health !== 'on-track' && (
            <Text style={s.note}>You don't have access to {hidden.join(', ')}, so items there aren't listed.</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  title: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  sub: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 3, textAlign: 'left' },
  center: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  okTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  reason: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, overflow: 'hidden' },
  reasonHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 11 },
  reasonIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  reasonTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  reasonHint: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  openText: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#2563EB' },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  rowLabel: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A' },
  rowSub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1, textTransform: 'capitalize' },
  note: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
});

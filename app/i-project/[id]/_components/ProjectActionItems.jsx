import { tr } from '../../../utils/i18n/tr';
// "What needs doing" — the project's next steps, most urgent first (same as the web overview)
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useProjectPermissions } from '../../../utils/interior/useProjectPermissions';
import { useInteriorPermissions } from '../../../utils/interior/useInteriorPermissions';
import { formatCurrency } from '../../../utils/common/format';
import { useOrgCurrency } from '../../../utils/interior/orgCurrency';
import {
  ACTION_SOURCES, KIND_META, fetchActionSources, buildActionItems, groupActionItems,
  bucketOf, dueLabel, startOfDay, idOf,
} from '../../../utils/interior/projectActionItems';

const LIMIT = 6;

export default function ProjectActionItems({ projectId, project }) {
  const router = useRouter();
  const { can, loading: permsLoading } = useProjectPermissions(projectId);
  const { user } = useInteriorPermissions();
  const [scope, setScope] = useState(null); // null = auto (mine if any)
  const [expanded, setExpanded] = useState(false);

  const allowed = useMemo(() => {
    if (permsLoading) return null;
    const out = {};
    ACTION_SOURCES.forEach((src) => { out[src.key] = can(src.perm, 'read'); });
    return out;
  }, [permsLoading, can]);

  const query = useQuery({
    queryKey: ['interior-project-actions', projectId, allowed],
    enabled: !!projectId && !!allowed,
    staleTime: 2 * 60 * 1000,
    queryFn: () => fetchActionSources(projectId, allowed),
  });

  // Organisation currency (project.budget.currency can be a stale INR)
  const currency = useOrgCurrency().code;
  const items = useMemo(
    () => buildActionItems(query.data, {
      me: idOf(user),
      projectStatus: project?.status,
      formatMoney: (n) => formatCurrency(n, currency),
    }),
    [query.data, user, project?.status, currency]
  );

  const today = startOfDay(new Date());
  const mineCount = items.filter((i) => i.mine).length;
  const activeScope = scope ?? (mineCount > 0 ? 'mine' : 'all');
  const visible = activeScope === 'mine' ? items.filter((i) => i.mine) : items;
  const groups = useMemo(() => groupActionItems(visible, today), [visible, today]);
  const overdueCount = visible.filter((i) => bucketOf(i, today) === 'overdue').length;
  const loading = !allowed || (query.isPending && !query.data);

  const open = (it) => {
    if (it.kind === 'task' && it.recordId) {
      router.push({ pathname: `/i-project/${projectId}/tasks`, params: { task: it.recordId } });
    } else {
      router.push(`/i-project/${projectId}/${it.section}`);
    }
  };

  let shown = 0;

  return (
    <View>
      <View style={s.headRow}>
        <Text style={s.title}>{tr("What needs doing")}</Text>
        {!loading && visible.length > 0 && <View style={s.countPill}><Text style={s.countText}>{visible.length}</Text></View>}
        {!loading && overdueCount > 0 && <View style={[s.countPill, { backgroundColor: '#FEF2F2' }]}><Text style={[s.countText, { color: '#DC2626' }]}>{tr(overdueCount)}{tr(" overdue")}</Text></View>}
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => query.refetch()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {query.isFetching && !loading ? <ActivityIndicator size="small" color="#64748B" /> : <Ionicons name="refresh" size={17} color="#64748B" />}
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <View style={s.segment}>
          {['mine', 'all'].map((k) => (
            <TouchableOpacity
              key={k}
              style={[s.segBtn, activeScope === k && s.segBtnActive]}
              onPress={() => { setScope(k); setExpanded(false); }}
              activeOpacity={0.8}
            >
              <Text style={[s.segText, activeScope === k && s.segTextActive]}>
                {k === 'mine' ? tr("Assigned to me ({{mineCount}})", { mineCount: mineCount }) : tr("All ({{itemsCount}})", { itemsCount: items.length })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={{ gap: 8 }}>
            {[0, 1, 2].map((i) => <View key={i} style={s.skeleton} />)}
          </View>
        ) : visible.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={30} color="#10B981" />
            <Text style={s.emptyTitle}>{activeScope === 'mine' ? tr("Nothing assigned to you right now") : tr("All caught up")}</Text>
            <Text style={s.emptySub}>
              {activeScope === 'mine' && items.length > 0
                ? tr("There are {{itemsCount}} open items for the team. Switch to All to see them.", { itemsCount: items.length })
                : tr("No overdue work, pending approvals or open issues.")}
            </Text>
          </View>
        ) : (
          <>
            {groups.map((g) => {
              if (!expanded && shown >= LIMIT) return null;
              const take = expanded ? g.items : g.items.slice(0, Math.max(0, LIMIT - shown));
              shown += take.length;
              return (
                <View key={g.key} style={{ marginTop: 6 }}>
                  <Text style={[s.groupLabel, { color: g.color }]}>
                    {g.label.toUpperCase()} <Text style={s.groupCount}>· {g.items.length}</Text>
                  </Text>
                  {take.map((it) => {
                    const meta = KIND_META[it.kind];
                    const label = dueLabel(it.due, today);
                    const overdue = g.key === 'overdue';
                    return (
                      <TouchableOpacity key={it.id} style={s.row} onPress={() => open(it)} activeOpacity={0.75}>
                        <View style={[s.icon, { backgroundColor: meta.bg }]}>
                          <Ionicons name={meta.icon} size={17} color={meta.color} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.action} numberOfLines={1}>{tr(it.action)}</Text>
                          {!!it.title && <Text style={s.itemTitle} numberOfLines={1}>{tr(it.title)}</Text>}
                          <Text style={s.meta} numberOfLines={1}>
                            {tr(meta.label)}
                            {it.meta ? ` · ${it.meta}` : ''}
                            {it.mine ? <Text style={{ color: '#2563EB', fontFamily: 'Inter-SemiBold' }}>{tr(" · You")}</Text> : null}
                            {it.priority === 'critical' || it.priority === 'high' ? (
                              <Text style={{ color: it.priority === 'critical' ? '#DC2626' : '#EA580C', fontFamily: 'Inter-SemiBold' }}>
                                {` · ${it.priority === 'critical' ? 'Critical' : 'High'}`}
                              </Text>
                            ) : null}
                          </Text>
                        </View>
                        {!!label && (
                          <View style={[s.duePill, overdue ? s.duePillOverdue : g.key === 'later' ? s.duePillLater : null]}>
                            <Text style={[s.dueText, overdue ? { color: '#DC2626' } : g.key === 'later' ? { color: '#64748B' } : null]}>{tr(label)}</Text>
                          </View>
                        )}
                        <Ionicons name="chevron-forward" size={15} color="#CBD5E1" />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
            {visible.length > LIMIT && (
              <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={s.moreBtn}>
                <Text style={s.moreText}>{expanded ? tr("Show less") : tr("Show all {{visibleCount}}", { visibleCount: visible.length })}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, marginBottom: 10 },
  title: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#F1F5F9' },
  countText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  segment: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3, marginBottom: 6 },
  segBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segBtnActive: { backgroundColor: '#2563EB' },
  segText: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  segTextActive: { color: '#FFFFFF' },
  skeleton: { height: 54, borderRadius: 10, backgroundColor: '#F1F5F9' },
  empty: { alignItems: 'center', paddingVertical: 18, gap: 4 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginTop: 4 },
  emptySub: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center' },
  groupLabel: { fontSize: 11.5, fontFamily: 'Inter-Bold', letterSpacing: 0.5, marginTop: 6, marginBottom: 4 },
  groupCount: { color: '#94A3B8', fontFamily: 'Inter-SemiBold' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  icon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  action: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  itemTitle: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#475569', marginTop: 1 },
  meta: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },
  duePill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FFFBEB' },
  duePillOverdue: { backgroundColor: '#FEF2F2' },
  duePillLater: { backgroundColor: '#F1F5F9' },
  dueText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#B45309' },
  moreBtn: { alignItems: 'center', paddingTop: 10 },
  moreText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#2563EB' },
});

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import interiorApiClient from '../../services/interiorApiClient';
import { useToast } from '../../context/ToastContext';
import { useProjectPermissions } from '../../utils/interior/useProjectPermissions';

const UNASSIGNED_WBS_ID = 'unassigned-wbs';
const DAY_WIDTH = 28;
const LABEL_WIDTH_WBS = 220;
const LABEL_WIDTH_MILESTONE = 200;
const LABEL_WIDTH_TASK = 180;

// --- Minimal date helpers (no date-fns dependency on mobile) ---
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}
function differenceInDays(a, b) {
  return Math.round((new Date(a).setHours(0, 0, 0, 0) - new Date(b).setHours(0, 0, 0, 0)) / 86400000);
}
function minDateOf(dates) {
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}
function maxDateOf(dates) {
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}
function isToday(date) {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}
function fmtDay(date) {
  return String(date.getDate()).padStart(2, '0');
}
function fmtLongDate(date) {
  if (!date || isNaN(new Date(date).getTime())) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtShort(date) {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function fmtMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Actual completion date of a completed task (same fallbacks as the web timeline)
function getCompletedDate(t) {
  if (t.status !== 'completed') return null;
  const raw = t.completedAt || t.completionProof?.completedAt || t.completedDate || t.updatedAt;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

const STATUS_COLOR = {
  completed: '#16A34A', achieved: '#16A34A', delayed: '#DC2626',
  in_progress: '#D97706', todo: '#3B82F6', planned: '#64748B',
};

export default function InteriorTimelineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();
  const { can } = useProjectPermissions(projectId);
  const canToggle = can('tasks', 'update');

  const [loading, setLoading] = useState(true);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [wbsPackages, setWbsPackages] = useState([]);
  const [expandedWbs, setExpandedWbs] = useState({});
  const [expandedMilestones, setExpandedMilestones] = useState({});
  const didInitExpansion = useRef(false);
  // Date header row is pinned at the top of the vertical scroll (stickyHeaderIndices)
  // Height available for the vertical scroll (needed inside the sideways ScrollView)
  const [viewportH, setViewportH] = useState(0);
  // Tapped bar / milestone -> its dates (the web shows these on hover)
  const [barInfo, setBarInfo] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [msRes, taskRes, wbsRes] = await Promise.allSettled([
        interiorApiClient.get(`/projects/${projectId}/milestones`),
        interiorApiClient.get(`/projects/${projectId}/tasks`),
        interiorApiClient.get(`/projects/${projectId}/wbs`),
      ]);
      setMilestones(msRes.status === 'fulfilled' && msRes.value?.success ? msRes.value.data || [] : []);
      setTasks(taskRes.status === 'fulfilled' && taskRes.value?.success ? taskRes.value.data || [] : []);

      const packages = [];
      const extractPackages = (node) => {
        if (!node) return;
        if (node.type === 'package') packages.push(node);
        ['floors', 'zones', 'areas', 'packages'].forEach((key) => {
          if (Array.isArray(node[key])) node[key].forEach(extractPackages);
        });
      };
      if (wbsRes.status === 'fulfilled' && wbsRes.value?.success) {
        (wbsRes.value.data || []).forEach(extractPackages);
      }
      setWbsPackages(packages);
    } catch (e) {
      console.error('Failed to load timeline data', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const toggleTaskStatus = async (task) => {
    const reopening = task.status === 'completed';
    const status = reopening ? 'in_progress' : 'completed';
    const progress = reopening ? 50 : 100;
    const completedAt = reopening ? null : new Date().toISOString();
    setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, status, progress, completedAt } : t)));
    try {
      await interiorApiClient.put(`/projects/${projectId}/tasks/${task._id}`, { status, progress, completedAt });
      showToast(reopening ? 'Activity reopened' : `Activity completed! (${fmtShort(new Date())})`, 'success');
    } catch (e) {
      showToast(e?.message || 'Failed to update the activity', 'error');
      fetchData();
    }
  };

  const toggleWbs = (id) => setExpandedWbs((prev) => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }));
  const toggleMilestone = (key) => setExpandedMilestones((prev) => ({ ...prev, [key]: prev[key] === undefined ? false : !prev[key] }));

  const { minDate, totalDays, dates, timelineData } = useMemo(() => {
    if (milestones.length === 0 && tasks.length === 0) {
      return { minDate: new Date(), totalDays: 0, dates: [], timelineData: [] };
    }

    let allDates = [];
    milestones.forEach((m) => {
      if (m.dueDate) {
        const d = new Date(m.dueDate);
        if (!isNaN(d.getTime())) allDates.push(d);
      }
    });
    tasks.forEach((t) => {
      if (t.startDate) {
        const d = new Date(t.startDate);
        if (!isNaN(d.getTime())) allDates.push(d);
      }
      if (t.endDate) {
        const d = new Date(t.endDate);
        if (!isNaN(d.getTime())) allDates.push(d);
      }
      // Include actual completion dates so late finishes stay on the chart
      const done = getCompletedDate(t);
      if (done) allDates.push(done);
    });
    if (allDates.length === 0) allDates = [new Date()];

    const minD = addDays(startOfWeek(minDateOf(allDates)), -7);
    const maxD = addDays(endOfWeek(maxDateOf(allDates)), 14);
    const totalDays = differenceInDays(maxD, minD) + 1;
    const dates = Array.from({ length: totalDays }).map((_, i) => addDays(minD, i));

    const getPackageId = (t) => {
      const p = t.packageId;
      if (!p) return null;
      return typeof p === 'string' ? p : (p._id || p.id)?.toString() || null;
    };

    const packageMeta = new Map();
    wbsPackages.forEach((pkg) => {
      packageMeta.set((pkg.id || pkg._id).toString(), { name: pkg.name, trade: pkg.trade });
    });
    tasks.forEach((t) => {
      const pid = getPackageId(t);
      const p = t.packageId;
      if (pid && p && typeof p !== 'string' && !packageMeta.has(pid)) {
        packageMeta.set(pid, { name: p.name, trade: p.trade });
      }
    });

    const tasksByPackage = new Map();
    tasks.forEach((t) => {
      const pid = getPackageId(t) || UNASSIGNED_WBS_ID;
      if (!tasksByPackage.has(pid)) tasksByPackage.set(pid, []);
      tasksByPackage.get(pid).push(t);
    });

    const seenMilestoneIds = new Set();
    const buildMilestoneGroups = (wbsId, taskList) => {
      const claimed = new Set();
      const groups = milestones
        .map((m) => {
          const linkedTaskIds = (m.linkedTasks || []).map((lt) => (typeof lt === 'string' ? lt : (lt._id || lt).toString()));
          const mTasks = taskList.filter((t) => linkedTaskIds.includes(t._id.toString()));
          mTasks.forEach((t) => claimed.add(t._id.toString()));
          if (mTasks.length > 0) seenMilestoneIds.add(m._id);
          return { ...m, _key: `${wbsId}::${m._id}`, isMilestone: true, tasks: mTasks };
        })
        .filter((mg) => mg.tasks.length > 0);

      const unlinkedTasks = taskList.filter((t) => !claimed.has(t._id.toString()));
      if (unlinkedTasks.length > 0) {
        groups.push({
          _id: `${wbsId}::unlinked`,
          _key: `${wbsId}::unlinked`,
          name: 'Unscheduled / General Tasks',
          dueDate: null,
          status: 'planned',
          isMilestone: true,
          tasks: unlinkedTasks,
        });
      }
      return groups;
    };

    const wbsIds = [
      ...wbsPackages.map((p) => (p.id || p._id).toString()).filter((id) => tasksByPackage.has(id)),
      ...Array.from(tasksByPackage.keys()).filter((id) => id !== UNASSIGNED_WBS_ID && !packageMeta.has(id)),
    ];

    const data = wbsIds.map((wbsId) => {
      const taskList = tasksByPackage.get(wbsId) || [];
      const meta = packageMeta.get(wbsId);
      return {
        _id: wbsId,
        name: meta?.name || 'Package',
        trade: meta?.trade,
        milestoneGroups: buildMilestoneGroups(wbsId, taskList),
      };
    });

    const orphanMilestones = milestones.filter((m) => !seenMilestoneIds.has(m._id));
    const unassignedTasks = tasksByPackage.get(UNASSIGNED_WBS_ID) || [];
    if (unassignedTasks.length > 0 || orphanMilestones.length > 0) {
      const milestoneGroups = buildMilestoneGroups(UNASSIGNED_WBS_ID, unassignedTasks);
      orphanMilestones.forEach((m) => {
        milestoneGroups.push({ ...m, _key: `${UNASSIGNED_WBS_ID}::${m._id}`, isMilestone: true, tasks: [] });
      });
      if (milestoneGroups.length > 0) {
        data.push({ _id: UNASSIGNED_WBS_ID, name: 'Unassigned WBS Package', trade: undefined, milestoneGroups });
      }
    }

    return { minDate: minD, totalDays, dates, timelineData: data };
  }, [milestones, tasks, wbsPackages]);

  if (!loading && !didInitExpansion.current && timelineData.length > 0) {
    const wbsMap = {};
    timelineData.forEach((w) => { wbsMap[w._id] = true; });
    const msMap = {};
    timelineData.forEach((w) => w.milestoneGroups.forEach((mg) => { msMap[mg._key] = true; }));
    setExpandedWbs(wbsMap);
    setExpandedMilestones(msMap);
    didInitExpansion.current = true;
  }

  const gridWidth = totalDays * DAY_WIDTH;

  // One pass over the rows, drawn twice: side 'label' = fixed left column, 'grid' = scrolling chart.
  // Both sides use the same row styles, so heights always line up.
  const renderRows = (side, part = 'body') => {
    const isLabel = side === 'label';
    const header = isLabel ? (
      <>
        <View style={s.monthRow}><View style={{ width: LABEL_WIDTH_WBS, height: 24, justifyContent: 'center', paddingLeft: 8 }}><Text style={s.monthCellText}>Activity</Text></View></View>
        <View style={s.dayRow}><View style={{ width: LABEL_WIDTH_WBS, height: 24, justifyContent: 'center', paddingLeft: 8 }}><Text style={s.dayCellText}>Plan / Done</Text></View></View>
      </>
    ) : (
      <>
        <View style={s.monthRow}>
          {(() => {
            const months = [];
            let currentMonth = '';
            let currentCount = 0;
            dates.forEach((d) => {
              const m = fmtMonthYear(d);
              if (m !== currentMonth) {
                if (currentMonth) months.push({ label: currentMonth, days: currentCount });
                currentMonth = m;
                currentCount = 1;
              } else {
                currentCount++;
              }
            });
            if (currentMonth) months.push({ label: currentMonth, days: currentCount });
            return months.map((m, i) => (
              <View key={i} style={[s.monthCell, { width: m.days * DAY_WIDTH }]}>
                <Text style={s.monthCellText} numberOfLines={1}>{m.label}</Text>
              </View>
            ));
          })()}
        </View>
        <View style={s.dayRow}>
          {dates.map((date, i) => {
            const today = isToday(date);
            const weekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <View key={i} style={[s.dayCell, { width: DAY_WIDTH }, today && s.dayCellToday, !today && weekend && s.dayCellWeekend]}>
                <Text style={[s.dayCellText, today && s.dayCellTextToday]}>{fmtDay(date)}</Text>
              </View>
            );
          })}
        </View>
      </>
    );

    if (part === 'header') return header;

    return (
      <>
        {timelineData.map((w) => {
          const wbsExpanded = expandedWbs[w._id] !== false;
          return (
            <View key={w._id}>
              <TouchableOpacity style={s.wbsRow} onPress={() => toggleWbs(w._id)}>
                {isLabel ? (
                  <View style={[s.wbsLabelCell, { width: LABEL_WIDTH_WBS }]}>
                    <Ionicons name={wbsExpanded ? 'chevron-down' : 'chevron-forward'} size={13} color="#94A3B8" />
                    <Ionicons name="cube-outline" size={13} color="#7C3AED" style={{ marginLeft: 4 }} />
                    <Text style={s.wbsLabelText} numberOfLines={1}>{w.name}</Text>
                    {!!w.trade && <Text style={s.wbsTradeTag}>{w.trade}</Text>}
                  </View>
                ) : (
                  <View style={{ width: gridWidth }} />
                )}
              </TouchableOpacity>

              {wbsExpanded && w.milestoneGroups.map((mg) => {
                const msExpanded = expandedMilestones[mg._key] !== false;
                const dueOffset = mg.dueDate ? differenceInDays(new Date(mg.dueDate), minDate) : null;
                return (
                  <View key={mg._key}>
                    <TouchableOpacity style={s.milestoneRow} onPress={() => toggleMilestone(mg._key)}>
                      {isLabel ? (
                        <View style={[s.msLabelCell, { width: LABEL_WIDTH_WBS }]}>
                          <Ionicons name={msExpanded ? 'chevron-down' : 'chevron-forward'} size={12} color="#94A3B8" />
                          <Ionicons name="flag-outline" size={12} color="#D97706" style={{ marginLeft: 4 }} />
                          <Text style={s.msLabelText} numberOfLines={1}>{mg.name}</Text>
                        </View>
                      ) : (
                        <View style={{ width: gridWidth, height: '100%' }}>
                          {dueOffset !== null && dueOffset >= 0 && dueOffset < totalDays && (
                            <TouchableOpacity
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              onPress={() => setBarInfo((cur) => (cur?.key === mg._key ? null : { key: mg._key, kind: 'milestone', name: mg.name, status: mg.status, due: new Date(mg.dueDate) }))}
                              style={[s.milestoneDiamond, { left: dueOffset * DAY_WIDTH + DAY_WIDTH / 2 - 5, backgroundColor: STATUS_COLOR[mg.status] || '#D97706' }]}
                            />
                          )}
                        </View>
                      )}
                    </TouchableOpacity>

                    {msExpanded && mg.tasks.map((t) => {
                      const start = t.startDate ? new Date(t.startDate) : null;
                      const end = t.endDate ? new Date(t.endDate) : start;
                      const hasRange = start && end;
                      const left = hasRange ? differenceInDays(start, minDate) * DAY_WIDTH : 0;
                      const width = hasRange ? (differenceInDays(end, start) + 1) * DAY_WIDTH : 0;
                      const color = STATUS_COLOR[t.status] || '#3B82F6';
                      // Actual completion vs plan (same markings as the web Gantt)
                      const done = getCompletedDate(t);
                      const doneOffset = done ? differenceInDays(done, minDate) : null;
                      const doneVisible = doneOffset !== null && doneOffset >= 0 && doneOffset < totalDays;
                      const diff = done && end ? differenceInDays(done, end) : 0;
                      const isLate = diff > 0;
                      const isEarly = diff < 0;
                      const barEnd = left + Math.max(width, 6);
                      const doneCenter = doneVisible ? doneOffset * DAY_WIDTH + DAY_WIDTH / 2 : 0;

                      if (isLabel) {
                        return (
                          <View key={t._id} style={[s.taskRow, done && s.taskRowDone]}>
                            <View style={[s.taskLabelCell, { width: LABEL_WIDTH_WBS }, done && s.taskLabelCellDone]}>
                              <TouchableOpacity
                                onPress={() => toggleTaskStatus(t)}
                                disabled={!canToggle}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={s.checkBtn}
                              >
                                <Ionicons
                                  name={done ? 'checkmark-circle' : t.status === 'in_progress' ? 'time-outline' : 'ellipse-outline'}
                                  size={done ? 17 : 15}
                                  color={done ? '#059669' : t.status === 'in_progress' ? '#2563EB' : '#94A3B8'}
                                />
                              </TouchableOpacity>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={[s.taskLabelText, done && s.taskLabelTextDone]} numberOfLines={1}>{t.name}</Text>
                                {done ? (
                                  <View style={s.doneLine}>
                                    <View style={s.donePill}>
                                      <Text style={s.donePillText}>✓ {fmtShort(done)}</Text>
                                    </View>
                                    {!!end && (
                                      <Text style={[s.planText, isLate && { color: '#B45309' }, isEarly && { color: '#047857' }]} numberOfLines={1}>
                                        {isLate ? `${diff}d late` : isEarly ? `${Math.abs(diff)}d early` : 'on time'} · plan {fmtShort(end)}
                                      </Text>
                                    )}
                                  </View>
                                ) : (
                                  !!end && <Text style={s.planText} numberOfLines={1}>{start ? `${fmtShort(start)} – ` : ''}{fmtShort(end)}</Text>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      }

                      return (
                        <View key={t._id} style={[s.taskRow, done && s.taskRowDone]}>
                          <View style={{ width: gridWidth, height: '100%', justifyContent: 'center' }}>
                            {/* Completion day column + hairline */}
                            {done && doneVisible && <View pointerEvents="none" style={[s.doneColumn, { left: doneOffset * DAY_WIDTH, width: DAY_WIDTH }]} />}
                            {done && doneVisible && <View pointerEvents="none" style={[s.doneHairline, { left: doneCenter - 1 }]} />}
                            {/* Late: dashed connector from the planned end to the actual completion */}
                            {done && isLate && hasRange && doneVisible && (
                              <View pointerEvents="none" style={[s.lateConnector, { left: barEnd, width: Math.max(0, doneCenter - barEnd) }]}>
                                {Array.from({ length: Math.max(1, Math.floor((doneCenter - barEnd) / 6)) }).map((_, i) => (
                                  <View key={i} style={s.lateDash} />
                                ))}
                              </View>
                            )}
                            {hasRange && (
                              <TouchableOpacity
                                activeOpacity={0.75}
                                hitSlop={{ top: 8, bottom: 8 }}
                                onPress={() => setBarInfo((cur) => (cur?.key === t._id ? null : {
                                  key: t._id, kind: 'task', name: t.name, status: t.status, start, end, done, diff,
                                }))}
                                style={[
                                  s.taskBar, done && s.taskBarDone,
                                  { left, width: Math.max(width, 6), backgroundColor: color },
                                  barInfo?.key === t._id && s.taskBarSelected,
                                ]}
                              >
                                {/* Early: marked part of the bar that wasn't needed */}
                                {done && isEarly && (
                                  <View style={[s.earlyNotch, { width: Math.min(width, Math.abs(diff) * DAY_WIDTH) }]} />
                                )}
                              </TouchableOpacity>
                            )}
                            {done && doneVisible && (
                              <View pointerEvents="none" style={[s.doneMarker, { left: doneCenter - 6 }]}>
                                <Ionicons name="checkmark" size={9} color="#FFFFFF" />
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          );
        })}
      </>
    );
  };


  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Project Timeline</Text>
            <Text style={s.headerSub}>WBS packages, milestones & tasks on a Gantt chart.</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : timelineData.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={44} color="#CBD5E1" />
            <Text style={s.emptyTitle}>No Timeline Data</Text>
            <Text style={s.emptySub}>Create tasks and milestones in the Execution tabs to see them here.</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }} onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}>
            {/* One sideways scroll for the whole timeline (names + chart move together) */}
            <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
              {/* Vertical scroll inside it; its first child (the date header) stays pinned at the top */}
              <ScrollView
                style={{ height: viewportH || undefined }}
                stickyHeaderIndices={[0]}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                contentContainerStyle={{ paddingBottom: barInfo ? 150 : 30 }}
              >
                <View style={s.pinnedHeader}>
                  <View style={[s.stickyCol, { width: LABEL_WIDTH_WBS }]}>{renderRows('label', 'header')}</View>
                  <View>{renderRows('grid', 'header')}</View>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <View style={[s.stickyCol, { width: LABEL_WIDTH_WBS }]}>{renderRows('label')}</View>
                  <View>{renderRows('grid')}</View>
                </View>
              </ScrollView>
            </ScrollView>

            {/* Tapped bar / milestone details */}
            {barInfo && (
              <View style={s.infoCard}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Ionicons name={barInfo.kind === 'milestone' ? 'flag' : 'reorder-two'} size={16} color={barInfo.kind === 'milestone' ? '#D97706' : '#2563EB'} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.infoTitle} numberOfLines={2}>{barInfo.name}</Text>
                    <Text style={s.infoStatus}>{String(barInfo.status || '').replace('_', ' ')}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setBarInfo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
                {barInfo.kind === 'milestone' ? (
                  <View style={s.infoGrid}>
                    <View style={s.infoCell}><Text style={s.infoLabel}>DUE DATE</Text><Text style={s.infoValue}>{fmtLongDate(barInfo.due)}</Text></View>
                  </View>
                ) : (
                  <View style={s.infoGrid}>
                    <View style={s.infoCell}><Text style={s.infoLabel}>START</Text><Text style={s.infoValue}>{fmtLongDate(barInfo.start)}</Text></View>
                    <View style={s.infoCell}><Text style={s.infoLabel}>END</Text><Text style={s.infoValue}>{fmtLongDate(barInfo.end)}</Text></View>
                    <View style={s.infoCell}>
                      <Text style={s.infoLabel}>DURATION</Text>
                      <Text style={s.infoValue}>
                        {barInfo.start && barInfo.end ? `${differenceInDays(barInfo.end, barInfo.start) + 1} days` : '—'}
                      </Text>
                    </View>
                    {barInfo.done && (
                      <View style={s.infoCell}>
                        <Text style={s.infoLabel}>COMPLETED</Text>
                        <Text style={[s.infoValue, { color: barInfo.diff > 0 ? '#B45309' : '#047857' }]}>
                          {fmtLongDate(barInfo.done)}
                          {barInfo.diff > 0 ? ` (${barInfo.diff}d late)` : barInfo.diff < 0 ? ` (${Math.abs(barInfo.diff)}d early)` : ' (on time)'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  pinnedHeader: { flexDirection: 'row', backgroundColor: '#FFFFFF', zIndex: 3, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  taskBarSelected: { borderWidth: 2, borderColor: '#0F172A' },
  infoCard: {
    position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#E2E8F0', padding: 12, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  infoTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  infoStatus: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#64748B', textTransform: 'capitalize', marginTop: 2 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoCell: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 8 },
  infoLabel: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.4 },
  infoValue: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2 },
  stickyCol: { backgroundColor: '#FFFFFF', borderRightWidth: 1, borderRightColor: '#E2E8F0', zIndex: 2, elevation: 2 },
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  empty: { alignItems: 'center', paddingVertical: 80, gap: 8, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#475569' },
  emptySub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },

  monthRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  monthCell: { height: 24, justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#E2E8F0', paddingLeft: 6 },
  monthCellText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#2563EB', textTransform: 'uppercase' },

  dayRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  dayCell: { height: 24, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#F1F5F9' },
  dayCellToday: { backgroundColor: '#2563EB' },
  dayCellWeekend: { backgroundColor: '#F8FAFC' },
  dayCellText: { fontSize: 9, fontFamily: 'Inter-Regular', color: '#94A3B8' },
  dayCellTextToday: { color: '#FFFFFF', fontFamily: 'Inter-Bold' },

  wbsRow: { flexDirection: 'row', height: 34, backgroundColor: '#F5F3FF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  wbsLabelCell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 2 },
  wbsLabelText: { fontSize: 11, fontFamily: 'Inter-Black', color: '#0F172A', textTransform: 'uppercase', flexShrink: 1, marginLeft: 2 },
  wbsTradeTag: { fontSize: 8, fontFamily: 'Inter-Bold', color: '#7C3AED', backgroundColor: '#EDE9FE', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginLeft: 6, textTransform: 'uppercase' },

  milestoneRow: { flexDirection: 'row', height: 30, backgroundColor: '#FFFBEB', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  msLabelCell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingLeft: 20 },
  msLabelText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#334155', flexShrink: 1, marginLeft: 2 },
  milestoneDiamond: { position: 'absolute', top: 10, width: 10, height: 10, borderRadius: 2, transform: [{ rotate: '45deg' }] },

  taskRow: { flexDirection: 'row', height: 40, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  taskRowDone: { height: 46, backgroundColor: '#F7FEF9' },
  taskLabelCell: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8, paddingLeft: 22, borderRightWidth: 1, borderRightColor: '#F1F5F9' },
  taskLabelCellDone: { borderLeftWidth: 3, borderLeftColor: '#10B981', paddingLeft: 19 },
  checkBtn: { width: 20, alignItems: 'center' },
  taskLabelText: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#334155' },
  taskLabelTextDone: { color: '#94A3B8', textDecorationLine: 'line-through' },
  planText: { fontSize: 9.5, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2, flexShrink: 1 },
  doneLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  donePill: { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#6EE7B7', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  donePillText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#065F46' },
  taskBar: { position: 'absolute', height: 14, borderRadius: 6, top: 13, overflow: 'hidden' },
  taskBarDone: { top: 16 },
  earlyNotch: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(2, 44, 34, 0.28)', borderLeftWidth: 1.5, borderLeftColor: 'rgba(255,255,255,0.7)', borderStyle: 'dashed' },
  doneColumn: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(16, 185, 129, 0.12)', borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(52, 211, 153, 0.7)', borderStyle: 'dashed' },
  doneHairline: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#10B981' },
  lateConnector: { position: 'absolute', top: 21, height: 2, flexDirection: 'row', overflow: 'hidden', gap: 2 },
  lateDash: { width: 4, height: 2, backgroundColor: '#F59E0B' },
  doneMarker: { position: 'absolute', top: 17, width: 12, height: 12, borderRadius: 6, backgroundColor: '#059669', borderWidth: 1.5, borderColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
});

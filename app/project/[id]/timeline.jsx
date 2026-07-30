// import React, { useState, useEffect, useCallback, useRef } from 'react';
// import {
//   View, Text, StyleSheet, ScrollView, ActivityIndicator,
//   TouchableOpacity, RefreshControl, Dimensions, Modal, useWindowDimensions, StatusBar,
//   LayoutAnimation, Platform, UIManager
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';

// if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
//   UIManager.setLayoutAnimationEnabledExperimental(true);
// }
// import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import { useLocalSearchParams } from 'expo-router';
// import { useAuth } from '../../context/AuthContext';
// import { useToast } from '../../context/ToastContext';
// import { useSocket } from '../../context/SocketContext';
// import { milestoneService } from '../../services/projectService';
// import * as ScreenOrientation from 'expo-screen-orientation';

// const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// // Layout constants
// const NAME_COL = 160;
// const ROW_H = 100;
// const HEADER_H = 44;
// const DAY_W = 36;  // pixels per day

// // Status colours
// const STATUS = {
//   Completed: { bar: '#10B981', fill: '#D1FAE5', text: '#065F46' },
//   'In Progress': { bar: '#3B82F6', fill: '#DBEAFE', text: '#1E40AF' },
//   Pending: { bar: '#94A3B8', fill: '#F1F5F9', text: '#475569' },
//   'On Hold': { bar: '#F59E0B', fill: '#FEF3C7', text: '#92400E' },
// };

// // ─── Helpers ──────────────────────────────────────────────────────────────────
// function startOfDay(d) {
//   const x = new Date(d);
//   x.setHours(0, 0, 0, 0);
//   return x;
// }

// function daysBetween(a, b) {
//   return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
// }

// function getDateRange(milestones) {
//   const now = new Date();
//   let minD = now, maxD = new Date(now.getTime() + 90 * 86400000);

//   milestones.forEach(m => {
//     const s = new Date(m.createdAt);
//     if (s < minD) minD = s;
//     if (m.dueDate) {
//       const e = new Date(m.dueDate);
//       if (e > maxD) maxD = e;
//     }
//   });

//   // Pad by 7 days on each side
//   minD = new Date(minD.getTime() - 7 * 86400000);
//   maxD = new Date(maxD.getTime() + 7 * 86400000);

//   return { start: startOfDay(minD), end: startOfDay(maxD), totalDays: daysBetween(minD, maxD) };
// }

// function buildMonthHeaders(rangeStart, totalDays) {
//   const headers = [];
//   const cur = new Date(rangeStart);
//   let dayIdx = 0;

//   while (dayIdx < totalDays) {
//     const monthStart = dayIdx;
//     const label = cur.toLocaleString('default', { month: 'short', year: '2-digit' });
//     const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
//     const remaining = totalDays - dayIdx;
//     const span = Math.min(daysInMonth - cur.getDate() + 1, remaining);

//     headers.push({ label, width: span * DAY_W, dayStart: monthStart });
//     dayIdx += span;
//     cur.setDate(cur.getDate() + span);
//   }
//   return headers;
// }

// // ─── Sub-components ───────────────────────────────────────────────────────────
// function TodayLine({ rangeStart, totalDays }) {
//   const today = startOfDay(new Date());
//   const offset = daysBetween(rangeStart, today);
//   if (offset < 0 || offset > totalDays) return null;
//   return (
//     <View style={[styles.todayLine, { left: offset * DAY_W }]} pointerEvents="none">
//       <View style={styles.todayIndicator} />
//     </View>
//   );
// }

// function GanttBar({ milestone, rangeStart, totalDays, onPress }) {
//   const col = STATUS[milestone.status] || STATUS.Pending;
//   const start = new Date(milestone.createdAt);
//   const end = milestone.dueDate ? new Date(milestone.dueDate) : new Date(start.getTime() + 30 * 86400000);

//   const barLeft = Math.max(0, daysBetween(rangeStart, start)) * DAY_W;
//   const barDays = Math.max(1, daysBetween(start, end));
//   const barWidth = Math.min(barDays * DAY_W, (totalDays - daysBetween(rangeStart, start)) * DAY_W);

//   const completed = milestone.tasks?.filter(t => t.isCompleted).length || 0;
//   const total = milestone.tasks?.length || 0;
//   const pct = total > 0 ? completed / total : (milestone.status === 'Completed' ? 1 : 0);

//   return (
//     <TouchableOpacity
//       activeOpacity={0.8}
//       onPress={onPress}
//       style={[styles.barTrack, { left: barLeft, width: barWidth, backgroundColor: col.fill, borderColor: col.bar }]}
//     >
//       <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: col.bar }]} />
//       {barWidth > 50 && (
//         <Text style={[styles.barLabel, { color: col.text }]} numberOfLines={1}>
//           {Math.round(pct * 100)}%
//         </Text>
//       )}
//     </TouchableOpacity>
//   );
// }

// function TaskBar({ task, rangeStart, totalDays, milestoneStart, milestoneEnd }) {
//   const start = task.startDate ? new Date(task.startDate) : milestoneStart;
//   const end = task.endDate ? new Date(task.endDate) : milestoneEnd;

//   const barLeft = Math.max(0, daysBetween(rangeStart, start)) * DAY_W;
//   const barDays = Math.max(1, daysBetween(start, end));
//   const barWidth = Math.min(barDays * DAY_W, (totalDays - daysBetween(rangeStart, start)) * DAY_W);

//   return (
//     <View style={[
//       styles.taskBarTrack,
//       { left: barLeft, width: barWidth, backgroundColor: task.isCompleted ? '#D1FAE5' : '#F1F5F9', borderColor: task.isCompleted ? '#10B981' : '#CBD5E1' }
//     ]}>
//       {task.isCompleted && <View style={[styles.taskBarFill, { backgroundColor: '#10B981' }]} />}
//     </View>
//   );
// }

// function GanttChart({ milestones, rangeStart, totalDays, monthHeaders, chartWidth, isFullScreen, winH }) {
//   const [expandedId, setExpandedId] = useState(null);

//   const toggleExpand = (id) => {
//     LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
//     setExpandedId(expandedId === id ? null : id);
//   };

//   return (
//     <View style={[
//       styles.ganttWrapper,
//       isFullScreen ? styles.ganttFullScreen : { minHeight: Math.round(winH * 0.48) }
//     ]}>
//       {/* ── Left name column ── */}
//       <View style={styles.nameCol}>
//         {/* header spacer */}
//         <View style={{ height: HEADER_H }} />
//         {milestones.map((m, i) => {
//           const col = STATUS[m.status] || STATUS.Pending;
//           const isExpanded = expandedId === m._id;
//           const taskH = 32;
//           const rowH = isExpanded ? ROW_H + (m.tasks?.length || 0) * taskH + 10 : ROW_H;

//           return (
//             <View key={m._id} style={[styles.nameRow, i % 2 === 1 && styles.nameRowAlt, { height: rowH }]}>
//               <TouchableOpacity activeOpacity={0.7} onPress={() => toggleExpand(m._id)} style={styles.nameRowTop}>
//                 <View style={[styles.statusDot, { backgroundColor: col.bar }]} />
//                 <Text style={styles.nameText} numberOfLines={2}>{m.name}</Text>
//                 <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={12} color="#94A3B8" />
//               </TouchableOpacity>
//               {isExpanded && m.tasks?.map((task, tIdx) => (
//                 <View key={task._id || tIdx} style={[styles.taskNameRow, { height: taskH }]}>
//                   <View style={styles.treeConnector} />
//                   <Ionicons
//                     name={task.isCompleted ? "checkmark-circle" : "ellipse-outline"}
//                     size={10}
//                     color={task.isCompleted ? "#10B981" : "#94A3B8"}
//                   />
//                   <Text style={[styles.taskNameText, task.isCompleted && styles.taskNameTextDone]} numberOfLines={1}>
//                     {task.title}
//                   </Text>
//                 </View>
//               ))}
//             </View>
//           );
//         })}
//       </View>

//       {/* ── Right chart area ── */}
//       <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
//         <View style={{ width: chartWidth }}>
//           {/* Month headers */}
//           <View style={[styles.monthRow, { width: chartWidth }]}>
//             {monthHeaders.map((h, i) => (
//               <View key={i} style={[styles.monthCell, { width: h.width }]}>
//                 <Text style={styles.monthLabel}>{h.label}</Text>
//               </View>
//             ))}
//           </View>

//           {/* Milestone rows */}
//           {milestones.map((m, i) => {
//             const isExpanded = expandedId === m._id;
//             const taskH = 32;
//             const rowH = isExpanded ? ROW_H + (m.tasks?.length || 0) * taskH + 10 : ROW_H;
//             const mStart = new Date(m.createdAt);
//             const mEnd = m.dueDate ? new Date(m.dueDate) : new Date(mStart.getTime() + 30 * 86400000);

//             return (
//               <View key={m._id} style={[styles.barRow, i % 2 === 1 && styles.barRowAlt, { width: chartWidth, height: rowH }]}>
//                 <TodayLine rangeStart={rangeStart} totalDays={totalDays} />
//                 <GanttBar milestone={m} rangeStart={rangeStart} totalDays={totalDays} onPress={() => toggleExpand(m._id)} />

//                 <View style={{ height: ROW_H }} />
//                 {isExpanded && m.tasks?.map((task, tIdx) => (
//                   <View key={task._id || tIdx} style={[styles.taskBarRow, { height: taskH }]}>
//                     <TaskBar
//                       task={task}
//                       rangeStart={rangeStart}
//                       totalDays={totalDays}
//                       milestoneStart={mStart}
//                       milestoneEnd={mEnd}
//                     />
//                   </View>
//                 ))}
//               </View>
//             );
//           })}

//           {/* Today label at bottom */}
//           <TodayLabel rangeStart={rangeStart} totalDays={totalDays} />
//         </View>
//       </ScrollView>
//     </View>
//   );
// }

// // ─── Main Component ───────────────────────────────────────────────────────────
// export default function ProjectTimelineTab() {
//   const insets = useSafeAreaInsets();
//   const { width: winW, height: winH } = useWindowDimensions();
//   const { id: projectId } = useLocalSearchParams();
//   const { token } = useAuth();
//   const { showToast } = useToast();

//   const { socket } = useSocket();
//   const [milestones, setMilestones] = useState([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [isFullScreen, setIsFullScreen] = useState(false);

//   const fetchMilestones = useCallback(async (isRefresh = false) => {
//     try {
//       if (isRefresh) setRefreshing(true); else setIsLoading(true);
//       const data = await milestoneService.getProjectMilestones(projectId, token);
//       setMilestones(Array.isArray(data) ? data : []);
//     } catch {
//       showToast('Failed to load milestones', 'error');
//     } finally {
//       setIsLoading(false);
//       setRefreshing(false);
//     }
//   }, [projectId, token]);

//   useEffect(() => { fetchMilestones(); }, [fetchMilestones]);

//   // Handle Orientation for Full Screen
//   useEffect(() => {
//     async function changeOrientation() {
//       if (isFullScreen) {
//         await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
//       } else {
//         await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
//       }
//     }
//     changeOrientation();

//     // Reset on unmount
//     return () => {
//       ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
//     };
//   }, [isFullScreen]);

//   useEffect(() => {
//     if (!socket) return;
//     const refresh = () => fetchMilestones(true);
//     socket.on('milestone:created', refresh);
//     socket.on('milestone:updated', refresh);
//     socket.on('milestone:deleted', refresh);
//     return () => {
//       socket.off('milestone:created', refresh);
//       socket.off('milestone:updated', refresh);
//       socket.off('milestone:deleted', refresh);
//     };
//   }, [socket, fetchMilestones]);

//   if (isLoading) {
//     return (
//       <View style={styles.center}>
//         <ActivityIndicator size="large" color="#3B82F6" />
//       </View>
//     );
//   }

//   if (milestones.length === 0) {
//     return (
//       <View style={styles.center}>
//         <Ionicons name="git-branch-outline" size={52} color="#CBD5E1" />
//         <Text style={styles.emptyTitle}>No Milestones Yet</Text>
//         <Text style={styles.emptyDesc}>Add milestones from the Milestone tab to see the Gantt chart.</Text>
//       </View>
//     );
//   }

//   const range = getDateRange(milestones);
//   const { start: rangeStart, totalDays } = range;
//   const monthHeaders = buildMonthHeaders(rangeStart, totalDays);
//   const chartWidth = totalDays * DAY_W;

//   return (
//     <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
//       {/* Top bar */}
//       <View style={styles.topBar}>
//         <View style={styles.topHeader}>
//           <Text style={styles.topTitle}>PROJECT TIMELINE</Text>
//           <TouchableOpacity style={styles.expandBtn} onPress={() => setIsFullScreen(true)}>
//             <Ionicons name="expand-outline" size={18} color="#3B82F6" />
//             <Text style={styles.expandText}>Full View</Text>
//           </TouchableOpacity>
//         </View>
//         <View style={styles.legend}>
//           {Object.entries(STATUS).map(([label, col]) => (
//             <View key={label} style={styles.legendItem}>
//               <View style={[styles.legendDot, { backgroundColor: col.bar }]} />
//               <Text style={styles.legendText}>{label}</Text>
//             </View>
//           ))}
//         </View>
//       </View>

//       {/* Gantt */}
//       <ScrollView
//         style={{ flex: 1 }}
//         showsVerticalScrollIndicator={false}
//         refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchMilestones(true)} tintColor="#3B82F6" colors={['#3B82F6']} />}
//       >
//         <GanttChart
//           milestones={milestones}
//           rangeStart={rangeStart}
//           totalDays={totalDays}
//           monthHeaders={monthHeaders}
//           chartWidth={chartWidth}
//           isFullScreen={false}
//           winH={winH}
//         />

//         {/* ── Summary cards ── */}
//         <View style={styles.summarySection}>
//           <Text style={styles.summaryTitle}>MILESTONE SUMMARY</Text>
//           <View style={styles.summaryRow}>
//             {[
//               { label: 'Total', count: milestones.length, color: '#3B82F6' },
//               { label: 'Done', count: milestones.filter(m => m.status === 'Completed').length, color: '#10B981' },
//               { label: 'Active', count: milestones.filter(m => m.status === 'In Progress').length, color: '#6366F1' },
//               { label: 'Pending', count: milestones.filter(m => m.status === 'Pending').length, color: '#94A3B8' },
//             ].map(s => (
//               <View key={s.label} style={styles.summaryCard}>
//                 <Text style={[styles.summaryCount, { color: s.color }]}>{s.count}</Text>
//                 <Text style={styles.summaryLabel}>{s.label}</Text>
//               </View>
//             ))}
//           </View>
//         </View>

//         {/* ── Milestone detail list ── */}
//         <View style={styles.detailSection}>
//           <Text style={styles.summaryTitle}>MILESTONE DETAILS</Text>
//           {milestones.map(m => {
//             const col = STATUS[m.status] || STATUS.Pending;
//             const done = m.tasks?.filter(t => t.isCompleted).length || 0;
//             const total = m.tasks?.length || 0;
//             const pct = total > 0 ? Math.round(done / total * 100) : (m.status === 'Completed' ? 100 : 0);
//             return (
//               <View key={m._id} style={styles.detailCard}>
//                 <View style={styles.detailCardTop}>
//                   <View style={[styles.detailStatusBar, { backgroundColor: col.bar }]} />
//                   <View style={{ flex: 1 }}>
//                     <Text style={styles.detailName}>{m.name}</Text>
//                     <View style={styles.detailMeta}>
//                       <View style={[styles.statusPill, { backgroundColor: col.fill }]}>
//                         <Text style={[styles.statusPillText, { color: col.text }]}>{m.status}</Text>
//                       </View>
//                       {m.dueDate && (
//                         <Text style={styles.dueDateText}>
//                           Due {new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
//                         </Text>
//                       )}
//                     </View>
//                   </View>
//                   <Text style={[styles.pctText, { color: col.bar }]}>{pct}%</Text>
//                 </View>
//                 <View style={styles.progressTrack}>
//                   <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: col.bar }]} />
//                 </View>
//                 {total > 0 && (
//                   <Text style={styles.taskCount}>{done} of {total} tasks completed</Text>
//                 )}
//               </View>
//             );
//           })}
//         </View>
//       </ScrollView>

//       {/* ── Full Screen Modal ── */}
//       <Modal visible={isFullScreen} animationType="slide" transparent={false} statusBarTranslucent>
//         <StatusBar hidden={isFullScreen} />
//         <View style={styles.modalRoot}>
//           <View style={styles.modalHeader}>
//             <View>
//               <Text style={styles.modalTitle}>PROJECT TIMELINE</Text>
//               <Text style={styles.modalSubtitle}>Full Chart View</Text>
//             </View>
//             <TouchableOpacity style={styles.closeBtn} onPress={() => setIsFullScreen(false)}>
//               <Ionicons name="close-outline" size={24} color="#0F172A" />
//             </TouchableOpacity>
//           </View>

//           <View style={styles.modalLegend}>
//             {Object.entries(STATUS).map(([label, col]) => (
//               <View key={label} style={styles.legendItem}>
//                 <View style={[styles.legendDot, { backgroundColor: col.bar }]} />
//                 <Text style={styles.legendText}>{label}</Text>
//               </View>
//             ))}
//           </View>

//           <ScrollView style={{ flex: 1 }}>
//             <GanttChart
//               milestones={milestones}
//               rangeStart={rangeStart}
//               totalDays={totalDays}
//               monthHeaders={monthHeaders}
//               chartWidth={chartWidth}
//               isFullScreen={true}
//               winH={winH}
//             />
//           </ScrollView>
//         </View>
//       </Modal>
//     </View>
//   );
// }

// function TodayLabel({ rangeStart, totalDays }) {
//   const today = startOfDay(new Date());
//   const offset = daysBetween(rangeStart, today);
//   if (offset < 0 || offset > totalDays) return null;
//   return (
//     <View style={[styles.todayLabelWrapper, { left: offset * DAY_W - 16 }]}>
//       <Text style={styles.todayLabelText}>Today</Text>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   root: { flex: 1, backgroundColor: '#F8FAFF' },
//   center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
//   emptyTitle: { fontSize: 17, fontFamily: 'Inter-Black', color: '#0F172A' },
//   emptyDesc: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#94A3B8', textAlign: 'center' },

//   topBar: { paddingHorizontal: 20, paddingBottom: 12 },
//   topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
//   topTitle: { fontSize: 11, fontFamily: 'Inter-Black', color: '#94A3B8', letterSpacing: 1.5 },
//   expandBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#DBEAFE' },
//   expandText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#3B82F6' },
//   legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
//   legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
//   legendDot: { width: 8, height: 8, borderRadius: 4 },
//   legendText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },

//   ganttWrapper: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 24, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
//   ganttFullScreen: { marginHorizontal: 0, borderRadius: 0, borderWidth: 0, flex: 1 },

//   nameCol: { width: NAME_COL, borderRightWidth: 1, borderRightColor: '#E2E8F0', backgroundColor: '#FAFAFA' },
//   nameRow: { paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', justifyContent: 'center' },
//   nameRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, height: ROW_H, justifyContent: 'center' },
//   nameRowAlt: { backgroundColor: '#F8FAFF' },
//   statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
//   nameText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1, lineHeight: 15 },

//   monthRow: { height: HEADER_H, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#F8FAFF' },
//   monthCell: { justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#E2E8F0' },
//   monthLabel: { fontSize: 10, fontFamily: 'Inter-Black', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },

//   barRow: { position: 'relative', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
//   barRowAlt: { backgroundColor: '#FAFBFF' },

//   barTrack: { position: 'absolute', top: (ROW_H - 36) / 2, height: 36, borderRadius: 10, borderWidth: 1, overflow: 'hidden', justifyContent: 'center', minWidth: 8, zIndex: 2 },
//   barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 8 },
//   barLabel: { fontSize: 10, fontFamily: 'Inter-Bold', paddingHorizontal: 6, zIndex: 1 },

//   todayLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#EF4444', zIndex: 5, opacity: 0.8 },
//   todayIndicator: { position: 'absolute', top: 0, left: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#FFF' },
//   todayLabelWrapper: { position: 'absolute', bottom: 2 },
//   todayLabelText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#EF4444' },

//   // Expanded Tasks
//   taskNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 30 },
//   treeConnector: { position: 'absolute', left: 18, top: -16, bottom: 16, width: 1.5, backgroundColor: '#E2E8F0' },
//   taskNameText: { fontSize: 9.5, fontFamily: 'Inter-Medium', color: '#475569', flex: 1 },
//   taskNameTextDone: { color: '#94A3B8', textDecorationLine: 'line-through' },

//   taskBarRow: { width: '100%', justifyContent: 'center' },
//   taskBarTrack: { position: 'absolute', height: 10, borderRadius: 5, borderWidth: 1, overflow: 'hidden', minWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1 },
//   taskBarFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.9 },

//   summarySection: { marginHorizontal: 20, marginBottom: 20 },
//   summaryTitle: { fontSize: 11, fontFamily: 'Inter-Black', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 12 },
//   summaryRow: { flexDirection: 'row', gap: 8 },
//   summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
//   summaryCount: { fontSize: 22, fontFamily: 'Inter-Black' },
//   summaryLabel: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#94A3B8', marginTop: 2, textAlign: 'center' },

//   detailSection: { marginHorizontal: 20, marginBottom: 20, gap: 12 },
//   detailCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
//   detailCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
//   detailStatusBar: { width: 4, height: 40, borderRadius: 2 },
//   detailName: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 6 },
//   detailMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
//   statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
//   statusPillText: { fontSize: 10, fontFamily: 'Inter-Black', textTransform: 'uppercase' },
//   dueDateText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
//   pctText: { fontSize: 20, fontFamily: 'Inter-Black' },
//   progressTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
//   progressFill: { height: '100%', borderRadius: 3 },
//   taskCount: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#94A3B8' },

//   // Modal
//   modalRoot: { flex: 1, backgroundColor: '#FFFFFF' },
//   modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
//   modalTitle: { fontSize: 10, fontFamily: 'Inter-Black', color: '#3B82F6', letterSpacing: 1.5 },
//   modalSubtitle: { fontSize: 14, fontFamily: 'Inter-Black', color: '#0F172A' },
//   closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
//   modalLegend: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#F8FAFF' },
// });
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, Dimensions, Modal, useWindowDimensions, StatusBar,
  LayoutAnimation, Platform, UIManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import { milestoneService } from '../../services/projectService';
import * as ScreenOrientation from 'expo-screen-orientation';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Layout constants
const NAME_COL = 160;
const ROW_H = 100;
const HEADER_H = 44;
const DAY_W = 36;  // pixels per day

// Status colours
const STATUS = {
  Completed: { bar: '#10B981', fill: '#D1FAE5', text: '#065F46' },
  'In Progress': { bar: '#3B82F6', fill: '#DBEAFE', text: '#1E40AF' },
  Pending: { bar: '#94A3B8', fill: '#F1F5F9', text: '#475569' },
  'On Hold': { bar: '#F59E0B', fill: '#FEF3C7', text: '#92400E' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

function getDateRange(milestones) {
  const now = new Date();
  let minD = now, maxD = new Date(now.getTime() + 90 * 86400000);

  milestones.forEach(m => {
    // Check milestone dates
    const ms = m.createdAt ? new Date(m.createdAt) : new Date();
    if (ms < minD) minD = ms;

    const defaultMe = new Date(ms.getTime() + 30 * 86400000);
    const me = m.dueDate ? new Date(m.dueDate) : defaultMe;
    if (me > maxD) maxD = me;

    // Check task dates for more accuracy
    if (m.tasks && m.tasks.length > 0) {
      m.tasks.forEach(t => {
        if (t.startDate) {
          const ts = new Date(t.startDate);
          if (ts < minD) minD = ts;
        }
        if (t.endDate) {
          const te = new Date(t.endDate);
          if (te > maxD) maxD = te;
        }
      });
    }
  });

  // Pad by 7 days on each side
  minD = new Date(minD.getTime() - 7 * 86400000);
  maxD = new Date(maxD.getTime() + 7 * 86400000);

  return { start: startOfDay(minD), end: startOfDay(maxD), totalDays: daysBetween(minD, maxD) };
}

function fmtDateSafe(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildMonthHeaders(rangeStart, totalDays) {
  const headers = [];
  const cur = new Date(rangeStart);
  let dayIdx = 0;

  while (dayIdx < totalDays) {
    const monthStart = dayIdx;
    const label = cur.toLocaleString('default', { month: 'short', year: '2-digit' });
    const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
    const remaining = totalDays - dayIdx;
    const span = Math.min(daysInMonth - cur.getDate() + 1, remaining);

    headers.push({ label, width: span * DAY_W, dayStart: monthStart });
    dayIdx += span;
    cur.setDate(cur.getDate() + span);
  }
  return headers;
}

function buildDayHeaders(rangeStart, totalDays) {
  const days = [];
  const todayStr = startOfDay(new Date()).toISOString();
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    days.push({
      num: d.getDate(),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: startOfDay(d).toISOString() === todayStr
    });
  }
  return days;
}

function VerticalGrid({ dayHeaders, height }) {
  return (
    <View style={[styles.gridOverlay, { height }]} pointerEvents="none">
      {dayHeaders.map((d, i) => (
        <View 
          key={i} 
          style={[
            styles.gridLine, 
            d.isWeekend && { backgroundColor: '#F8FAFF' },
            d.isToday && { backgroundColor: '#EFF6FF', borderRightColor: '#BFDBFE', borderStyle: 'solid' }
          ]} 
        />
      ))}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TodayLine({ rangeStart, totalDays }) {
  const today = startOfDay(new Date());
  const offset = daysBetween(rangeStart, today);
  if (offset < 0 || offset > totalDays) return null;
  return (
    <View style={[styles.todayLine, { left: offset * DAY_W }]} pointerEvents="none">
      <View style={styles.todayIndicator} />
    </View>
  );
}

function GanttBar({ milestone, rangeStart, totalDays, onPress }) {
  const col = STATUS[milestone.status] || STATUS.Pending;

  // Calculate accurate start/end based on tasks if available
  let start = milestone.createdAt ? new Date(milestone.createdAt) : new Date();
  let end = milestone.dueDate ? new Date(milestone.dueDate) : new Date(start.getTime() + 30 * 86400000);

  if (milestonesHasTasks(milestone)) {
    // Find absolute min/max strictly from tasks
    let minT = null;
    let maxT = null;

    milestone.tasks.forEach(t => {
      if (t.startDate) {
        const s = new Date(t.startDate);
        if (!minT || s < minT) minT = s;
      }
      if (t.endDate) {
        const e = new Date(t.endDate);
        if (!maxT || e > maxT) maxT = e;
      }
    });

    if (minT) start = minT;
    if (maxT) end = maxT;
  }

  const barLeft = Math.max(0, daysBetween(rangeStart, start)) * DAY_W;
  const barDays = Math.max(1, daysBetween(start, end));
  const barWidth = Math.min(barDays * DAY_W, (totalDays - daysBetween(rangeStart, start)) * DAY_W);

  const completed = milestone.tasks?.filter(t => t.isCompleted)?.length || 0;
  const total = milestone.tasks?.length || 0;
  const pct = total > 0 ? completed / total : (milestone.status === 'Completed' ? 1 : 0);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.barTrack, { left: barLeft, width: barWidth, backgroundColor: col.fill, borderColor: col.bar }]}
    >
      <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: col.bar }]} />
      {barWidth > 50 && (
        <Text style={[styles.barLabel, { color: col.text }]} numberOfLines={1}>
          {Math.round(pct * 100)}%
        </Text>
      )}
    </TouchableOpacity>
  );
}

function milestonesHasTasks(m) {
  return m.tasks && m.tasks.length > 0;
}

function TaskBar({ task, rangeStart, totalDays, milestoneStart, milestoneEnd }) {
  const start = task.startDate ? new Date(task.startDate) : milestoneStart;
  const end = task.endDate ? new Date(task.endDate) : milestoneEnd;

  const barLeft = Math.max(0, daysBetween(rangeStart, start)) * DAY_W;
  const barDays = Math.max(1, daysBetween(start, end));
  const barWidth = Math.min(barDays * DAY_W, (totalDays - daysBetween(rangeStart, start)) * DAY_W);

  return (
    <View style={[
      styles.taskBarTrack,
      { left: barLeft, width: barWidth, backgroundColor: task.isCompleted ? '#D1FAE5' : '#F1F5F9', borderColor: task.isCompleted ? '#10B981' : '#CBD5E1' }
    ]}>
      {task.isCompleted && <View style={[styles.taskBarFill, { backgroundColor: '#10B981' }]} />}
    </View>
  );
}

function GanttChart({ milestones, rangeStart, totalDays, monthHeaders, chartWidth, isFullScreen, winH }) {
  const [expandedId, setExpandedId] = useState(null);
  const headerScrollRef = useRef(null);

  const toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const dayHeaders = buildDayHeaders(rangeStart, totalDays);
  const nameColHeaderHeight = HEADER_H + 28; // Month + Date row

  // Sync horizontal scroll: body drives header
  const onBodyScroll = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    headerScrollRef.current?.scrollTo({ x, animated: false });
  };

  return (
    <View style={[
      styles.ganttWrapper,
      { flexDirection: 'column' },
      isFullScreen ? styles.ganttFullScreen : { height: Math.round(winH * 0.48) }
    ]}>
      {/* ── Fixed Header Row ── */}
      <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', zIndex: 10 }}>
        {/* Left spacer matching name column width */}
        <View style={{ width: NAME_COL, height: nameColHeaderHeight, borderRightWidth: 1, borderRightColor: '#E2E8F0' }} />
        
        {/* Right scrollable (synced) header */}
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <ScrollView
            ref={headerScrollRef}
            horizontal
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
          >
            <View style={{ width: chartWidth }}>
              {/* Month headers */}
              <View style={[styles.monthRow, { width: chartWidth, borderBottomWidth: 0 }]}>
                {monthHeaders.map((h, i) => (
                  <View key={i} style={[styles.monthCell, { width: h.width }]}>
                    <Text style={styles.monthLabel}>{h.label}</Text>
                  </View>
                ))}
              </View>
              {/* Date headers */}
              <View style={[styles.dateRow, { width: chartWidth, borderBottomWidth: 0 }]}>
                {dayHeaders.map((d, i) => (
                  <View key={i} style={[styles.dateCell, d.isWeekend && styles.weekendCell, d.isToday && styles.todayCell]}>
                    <Text style={[styles.dateLabel, d.isWeekend && styles.weekendLabel, d.isToday && styles.todayLabel]}>{d.num}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* ── Scrollable Body Row ── */}
      <ScrollView style={{ flex: 1 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
        <View style={{ flexDirection: 'row' }}>
          {/* Left name column */}
          <View style={[styles.nameCol, { borderRightColor: '#E2E8F0', borderRightWidth: 1 }]}>
            {milestones.map((m, i) => {
              const col = STATUS[m.status] || STATUS.Pending;
              const isExpanded = expandedId === m._id;
              const taskH = 32;
              const rowH = isExpanded ? ROW_H + (m.tasks?.length || 0) * taskH + 10 : ROW_H;

              return (
                <View key={m._id} style={[styles.nameRow, i % 2 === 1 && styles.nameRowAlt, { height: rowH }]}>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => toggleExpand(m._id)} style={styles.nameRowTop}>
                    <View style={[styles.statusDot, { backgroundColor: col.bar }]} />
                    <Text style={styles.nameText} numberOfLines={2}>{m.name}</Text>
                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={12} color="#94A3B8" />
                  </TouchableOpacity>
                  {isExpanded && m.tasks?.map((task, tIdx) => (
                    <View key={task._id || tIdx} style={[styles.taskNameRow, { height: taskH }]}>
                      <View style={styles.treeConnector} />
                      <Ionicons
                        name={task.isCompleted ? "checkmark-circle" : "ellipse-outline"}
                        size={10}
                        color={task.isCompleted ? "#10B981" : "#94A3B8"}
                      />
                      <Text style={[styles.taskNameText, task.isCompleted && styles.taskNameTextDone]} numberOfLines={1}>
                        {task.title}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>

          {/* Right chart area */}
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              style={{ flex: 1 }}
              onScroll={onBodyScroll}
              scrollEventThrottle={16}
            >
              <View style={{ width: chartWidth }}>
                {/* Milestone rows */}
                {milestones.map((m, i) => {
                  const isExpanded = expandedId === m._id;
                  const taskH = 32;
                  const rowH = isExpanded ? ROW_H + (m.tasks?.length || 0) * taskH + 10 : ROW_H;
                  const mStart = new Date(m.createdAt);
                  const mEnd = m.dueDate ? new Date(m.dueDate) : new Date(mStart.getTime() + 30 * 86400000);

                  return (
                    <View key={m._id} style={[styles.barRow, i % 2 === 1 && styles.barRowAlt, { width: chartWidth, height: rowH }]}>
                      <VerticalGrid dayHeaders={dayHeaders} height={rowH} />
                      <GanttBar milestone={m} rangeStart={rangeStart} totalDays={totalDays} onPress={() => toggleExpand(m._id)} />

                      <View style={{ height: ROW_H }} />
                      {isExpanded && m.tasks?.map((task, tIdx) => (
                        <View key={task._id || tIdx} style={[styles.taskBarRow, { height: taskH }]}>
                          <TaskBar
                            task={task}
                            rangeStart={rangeStart}
                            totalDays={totalDays}
                            milestoneStart={mStart}
                            milestoneEnd={mEnd}
                          />
                        </View>
                      ))}
                    </View>
                  );
                })}

                {/* Today label at bottom */}
                <TodayLabel rangeStart={rangeStart} totalDays={totalDays} />
              </View>
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProjectTimelineTab() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { id: projectId } = useLocalSearchParams();
  const { token } = useAuth();
  const { showToast } = useToast();

  const { socket } = useSocket();
  const [milestones, setMilestones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const fetchMilestones = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setIsLoading(true);
      const data = await milestoneService.getProjectMilestones(projectId, token);
      setMilestones(Array.isArray(data) ? data : []);
    } catch {
      showToast('Failed to load milestones', 'error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [projectId, token]);

  useEffect(() => { fetchMilestones(); }, [fetchMilestones]);

  // Handle Orientation for Full Screen
  useEffect(() => {
    async function changeOrientation() {
      if (isFullScreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }
    changeOrientation();

    // Reset on unmount
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, [isFullScreen]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchMilestones(true);
    socket.on('milestone:created', refresh);
    socket.on('milestone:updated', refresh);
    socket.on('milestone:deleted', refresh);
    return () => {
      socket.off('milestone:created', refresh);
      socket.off('milestone:updated', refresh);
      socket.off('milestone:deleted', refresh);
    };
  }, [socket, fetchMilestones]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (milestones.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="git-branch-outline" size={52} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>No Milestones Yet</Text>
        <Text style={styles.emptyDesc}>Add milestones from the Milestone tab to see the Gantt chart.</Text>
      </View>
    );
  }

  const range = getDateRange(milestones);
  const { start: rangeStart, totalDays } = range;
  const monthHeaders = buildMonthHeaders(rangeStart, totalDays);
  const chartWidth = totalDays * DAY_W;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topHeader}>
          <Text style={styles.topTitle}>PROJECT TIMELINE</Text>
          <TouchableOpacity style={styles.expandBtn} onPress={() => setIsFullScreen(true)}>
            <Ionicons name="expand-outline" size={18} color="#3B82F6" />
            <Text style={styles.expandText}>Full View</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.legend}>
          {Object.entries(STATUS).map(([label, col]) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: col.bar }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Gantt */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchMilestones(true)} tintColor="#3B82F6" colors={['#3B82F6']} />}
      >
        <GanttChart
          milestones={milestones}
          rangeStart={rangeStart}
          totalDays={totalDays}
          monthHeaders={monthHeaders}
          chartWidth={chartWidth}
          isFullScreen={false}
          winH={winH}
        />

        {/* ── Summary cards ── */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>MILESTONE SUMMARY</Text>
          <View style={styles.summaryRow}>
            {[
              { label: 'Total', count: milestones.length, color: '#3B82F6' },
              { label: 'Done', count: milestones.filter(m => m.status === 'Completed').length, color: '#10B981' },
              { label: 'Active', count: milestones.filter(m => m.status === 'In Progress').length, color: '#6366F1' },
              { label: 'Pending', count: milestones.filter(m => m.status === 'Pending').length, color: '#94A3B8' },
            ].map(s => (
              <View key={s.label} style={styles.summaryCard}>
                <Text style={[styles.summaryCount, { color: s.color }]}>{s.count}</Text>
                <Text style={styles.summaryLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Milestone detail list ── */}
        <View style={styles.detailSection}>
          <Text style={styles.summaryTitle}>MILESTONE DETAILS</Text>
          {milestones.map(m => {
            const col = STATUS[m.status] || STATUS.Pending;
            const done = m.tasks?.filter(t => t.isCompleted)?.length || 0;
            const total = m.tasks?.length || 0;
            const pct = total > 0 ? Math.round(done / total * 100) : (m.status === 'Completed' ? 100 : 0);
            return (
              <View key={m._id} style={styles.detailCard}>
                <View style={styles.detailCardTop}>
                  <View style={[styles.detailStatusBar, { backgroundColor: col.bar }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{m.name}</Text>
                    <View style={styles.detailMeta}>
                      <View style={[styles.statusPill, { backgroundColor: col.fill }]}>
                        <Text style={[styles.statusPillText, { color: col.text }]}>{m.status}</Text>
                      </View>
                      {m.dueDate && (
                        <Text style={styles.dueDateText}>
                          Due {fmtDateSafe(m.dueDate)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.pctText, { color: col.bar }]}>{pct}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: col.bar }]} />
                </View>
                {total > 0 && (
                  <Text style={styles.taskCount}>{done} of {total} tasks completed</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ── Full Screen Modal ── */}
      <Modal visible={isFullScreen} animationType="slide" transparent={false} statusBarTranslucent>
        <StatusBar hidden={isFullScreen} />
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>PROJECT TIMELINE</Text>
              <Text style={styles.modalSubtitle}>Full Chart View</Text>
            </View>
            {/* Legend inline in header row */}
            <View style={styles.modalLegend}>
              {Object.entries(STATUS).map(([label, col]) => (
                <View key={label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: col.bar }]} />
                  <Text style={styles.legendText}>{label}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setIsFullScreen(false)}>
              <Ionicons name="close-outline" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            <GanttChart
              milestones={milestones}
              rangeStart={rangeStart}
              totalDays={totalDays}
              monthHeaders={monthHeaders}
              chartWidth={chartWidth}
              isFullScreen={true}
              winH={winH}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TodayLabel({ rangeStart, totalDays }) {
  const today = startOfDay(new Date());
  const offset = daysBetween(rangeStart, today);
  if (offset < 0 || offset > totalDays) return null;
  return (
    <View style={[styles.todayLabelWrapper, { left: offset * DAY_W - 16 }]}>
      <Text style={styles.todayLabelText}>Today</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter-Black', color: '#0F172A' },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#94A3B8', textAlign: 'center' },

  topBar: { paddingHorizontal: 20, paddingBottom: 12 },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  topTitle: { fontSize: 11, fontFamily: 'Inter-Black', color: '#94A3B8', letterSpacing: 1.5 },
  expandBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#DBEAFE' },
  expandText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#3B82F6' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },

  ganttWrapper: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 24, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  ganttFullScreen: { marginHorizontal: 0, borderRadius: 0, borderWidth: 0, flex: 1 },

  nameCol: { width: NAME_COL, borderRightWidth: 1, borderRightColor: '#E2E8F0', backgroundColor: '#FAFAFA' },
  nameRow: { paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', justifyContent: 'center' },
  nameRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, height: ROW_H, justifyContent: 'center' },
  nameRowAlt: { backgroundColor: '#F8FAFF' },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  nameText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1, lineHeight: 15 },

  monthRow: { height: HEADER_H, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#F8FAFF' },
  monthCell: { justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#E2E8F0' },
  monthLabel: { fontSize: 10, fontFamily: 'Inter-Black', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },

  dateRow: { height: 28, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  dateCell: { width: DAY_W, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#F1F5F9' },
  dateLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#94A3B8' },
  weekendCell: { backgroundColor: '#F8FAFF' },
  weekendLabel: { color: '#64748B' },
  todayCell: { backgroundColor: '#DBEAFE' },
  todayLabel: { color: '#2563EB', fontFamily: 'Inter-Black' },

  barRow: { position: 'relative', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  barRowAlt: { backgroundColor: '#FAFBFF' },

  gridOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', zIndex: 0 },
  gridLine: { width: DAY_W, borderRightWidth: 1, borderRightColor: '#F1F5F9', borderStyle: 'dashed', height: '100%' },

  barTrack: { position: 'absolute', top: (ROW_H - 36) / 2, height: 36, borderRadius: 10, borderWidth: 1, overflow: 'hidden', justifyContent: 'center', minWidth: 8, zIndex: 2 },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 8 },
  barLabel: { fontSize: 10, fontFamily: 'Inter-Bold', paddingHorizontal: 6, zIndex: 1 },

  todayLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#EF4444', zIndex: 5, opacity: 0.8 },
  todayIndicator: { position: 'absolute', top: 0, left: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#FFF' },
  todayLabelWrapper: { position: 'absolute', bottom: 2 },
  todayLabelText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#EF4444' },

  // Expanded Tasks
  taskNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 30 },
  treeConnector: { position: 'absolute', left: 18, top: -16, bottom: 16, width: 1.5, backgroundColor: '#E2E8F0' },
  taskNameText: { fontSize: 9.5, fontFamily: 'Inter-Medium', color: '#475569', flex: 1 },
  taskNameTextDone: { color: '#94A3B8', textDecorationLine: 'line-through' },

  taskBarRow: { width: '100%', justifyContent: 'center' },
  taskBarTrack: { position: 'absolute', height: 10, borderRadius: 5, borderWidth: 1, overflow: 'hidden', minWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1 },
  taskBarFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.9 },

  summarySection: { marginHorizontal: 20, marginBottom: 20 },
  summaryTitle: { fontSize: 11, fontFamily: 'Inter-Black', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: { flexGrow: 1, minWidth: 70, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  summaryCount: { fontSize: 22, fontFamily: 'Inter-Black' },
  summaryLabel: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#94A3B8', marginTop: 2, textAlign: 'center' },

  detailSection: { marginHorizontal: 20, marginBottom: 20, gap: 12 },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  detailCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  detailStatusBar: { width: 4, height: 40, borderRadius: 2 },
  detailName: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 6 },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontFamily: 'Inter-Black', textTransform: 'uppercase' },
  dueDateText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  pctText: { fontSize: 20, fontFamily: 'Inter-Black' },
  progressTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 3 },
  taskCount: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#94A3B8' },

  // Modal
  modalRoot: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 10, fontFamily: 'Inter-Black', color: '#3B82F6', letterSpacing: 1.5 },
  modalSubtitle: { fontSize: 14, fontFamily: 'Inter-Black', color: '#0F172A' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  modalLegend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, paddingHorizontal: 12, flex: 1 },
});
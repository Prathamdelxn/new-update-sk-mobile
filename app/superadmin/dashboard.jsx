// import { useState, useEffect, useCallback, useMemo } from 'react';
// import {
//   View, Text, ScrollView, TouchableOpacity, StyleSheet,
//   StatusBar, ActivityIndicator, Modal, Platform, RefreshControl,
//   TextInput, KeyboardAvoidingView,
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { useRouter } from 'expo-router';
// import { useSuperAdmin } from '../context/SuperAdminContext';

// const PLANS = ['Silver', 'Gold', 'Platinum'];
// const STATUSES = ['Active', 'Trial', 'Suspended'];
// const FILTERS = ['All', 'Active', 'Trial', 'Suspended'];
// const TABS = ['Organizations', 'Plan Requests'];

// const REQ_STATUS_COLORS = {
//   Pending:  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', dot: '#F97316' },
//   Approved: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', dot: '#22C55E' },
//   Rejected: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', dot: '#EF4444' },
// };

// const PLAN_COLORS = {
//   Silver:   { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1', icon: '🪙' },
//   Gold:     { bg: '#FEF9C3', text: '#92400E', border: '#FDE68A', icon: '🥇' },
//   Platinum: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', icon: '💎' },
// };

// const STATUS_COLORS = {
//   Active:    { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
//   Trial:     { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
//   Suspended: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
//   Expired:   { bg: '#F8FAFC', text: '#94A3B8', border: '#E2E8F0' },
// };

// function trialDaysLeft(trialEndsAt) {
//   if (!trialEndsAt) return null;
//   const diff = Math.ceil((new Date(trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24));
//   return diff;
// }

// function formatDate(dateStr) {
//   if (!dateStr) return '—';
//   return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
// }

// export default function SuperAdminDashboard() {
//   const [activeTab, setActiveTab] = useState('Organizations');

//   const [orgs, setOrgs] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [error, setError] = useState('');
//   const [search, setSearch] = useState('');
//   const [filter, setFilter] = useState('All');

//   const [selectedOrg, setSelectedOrg] = useState(null);
//   const [modalVisible, setModalVisible] = useState(false);
//   const [selectedPlan, setSelectedPlan] = useState('Gold');
//   const [selectedStatus, setSelectedStatus] = useState('Active');
//   const [maxUsers, setMaxUsers] = useState('');
//   const [maxProjects, setMaxProjects] = useState('');
//   const [trialEndsAt, setTrialEndsAt] = useState('');
//   const [saving, setSaving] = useState(false);
//   const [saveError, setSaveError] = useState('');

//   // Plan requests state
//   const [planRequests, setPlanRequests] = useState([]);
//   const [loadingReqs, setLoadingReqs] = useState(false);
//   const [reviewModal, setReviewModal] = useState(false);
//   const [reviewTarget, setReviewTarget] = useState(null);
//   const [reviewAction, setReviewAction] = useState('Approved');
//   const [reviewNote, setReviewNote] = useState('');
//   const [reviewing, setReviewing] = useState(false);

//   const { saLogout, saFetch } = useSuperAdmin();
//   const router = useRouter();

//   const loadOrgs = useCallback(async () => {
//     try {
//       const res = await saFetch('/superadmin/subscriptions');
//       if (!res.ok) throw new Error('Unauthorized');
//       const data = await res.json();
//       setOrgs(data);
//       setError('');
//     } catch (e) {
//       setError(e.message === 'Unauthorized' ? 'Session expired. Please log in again.' : 'Failed to load organizations.');
//     } finally {
//       setLoading(false);
//       setRefreshing(false);
//     }
//   }, [saFetch]);

//   const loadRequests = useCallback(async () => {
//     setLoadingReqs(true);
//     try {
//       const res = await saFetch('/superadmin/plan-requests');
//       if (res.ok) {
//         const data = await res.json();
//         setPlanRequests(data);
//       }
//     } catch { } finally {
//       setLoadingReqs(false);
//     }
//   }, [saFetch]);

//   useEffect(() => { loadOrgs(); loadRequests(); }, []);

//   const handleRefresh = () => {
//     setRefreshing(true);
//     loadOrgs();
//     loadRequests();
//   };

//   // Stats
//   const stats = useMemo(() => ({
//     total:     orgs.length,
//     active:    orgs.filter(o => o.subscription?.status === 'Active').length,
//     trial:     orgs.filter(o => o.subscription?.status === 'Trial').length,
//     suspended: orgs.filter(o => o.subscription?.status === 'Suspended').length,
//   }), [orgs]);

//   // Filtered + searched orgs
//   const filtered = useMemo(() => {
//     return orgs.filter(o => {
//       const matchFilter = filter === 'All' || o.subscription?.status === filter;
//       const matchSearch = !search.trim() ||
//         o.orgName?.toLowerCase().includes(search.toLowerCase()) ||
//         o.owner?.email?.toLowerCase().includes(search.toLowerCase());
//       return matchFilter && matchSearch;
//     });
//   }, [orgs, filter, search]);

//   const openManageModal = (org) => {
//     setSelectedOrg(org);
//     setSelectedPlan(org.subscription?.plan || 'Silver');
//     setSelectedStatus(org.subscription?.status || 'Active');
//     setMaxUsers(org.subscription?.overrides?.maxUsers?.toString() || '');
//     setMaxProjects(org.subscription?.overrides?.maxProjects?.toString() || '');
//     const te = org.subscription?.trialEndsAt;
//     setTrialEndsAt(te ? new Date(te).toISOString().split('T')[0] : '');
//     setSaveError('');
//     setModalVisible(true);
//   };

//   const handleSavePlan = async () => {
//     if (!selectedOrg) return;
//     setSaving(true);
//     setSaveError('');
//     try {
//       const body = {
//         plan: selectedPlan,
//         status: selectedStatus,
//         reason: 'Updated via mobile Super Admin',
//         overrides: {
//           maxUsers: maxUsers ? parseInt(maxUsers) : null,
//           maxProjects: maxProjects ? parseInt(maxProjects) : null,
//         },
//       };
//       if (trialEndsAt) body.trialEndsAt = trialEndsAt;

//       const res = await saFetch(`/superadmin/subscriptions/${selectedOrg.orgId}`, {
//         method: 'PATCH',
//         body: JSON.stringify(body),
//       });
//       if (!res.ok) throw new Error('Failed to save');
//       setModalVisible(false);
//       loadOrgs();
//     } catch (e) {
//       setSaveError('Failed to save. Please try again.');
//     } finally {
//       setSaving(false);
//     }
//   };

//   const openReviewModal = (req, action) => {
//     setReviewTarget(req);
//     setReviewAction(action);
//     setReviewNote('');
//     setReviewModal(true);
//   };

//   const handleReview = async () => {
//     if (!reviewTarget) return;
//     setReviewing(true);
//     try {
//       const res = await saFetch(`/superadmin/plan-requests/${reviewTarget._id}`, {
//         method: 'PATCH',
//         body: JSON.stringify({ action: reviewAction, reviewNote }),
//       });
//       if (res.ok) {
//         setReviewModal(false);
//         loadRequests();
//         loadOrgs();
//       }
//     } catch { } finally {
//       setReviewing(false);
//     }
//   };

//   const pendingCount = planRequests.filter(r => r.status === 'Pending').length;

//   const handleLogout = async () => {
//     await saLogout();
//     router.replace('/auth/login');
//   };

//   if (loading) {
//     return (
//       <View style={styles.centered}>
//         <ActivityIndicator size="large" color="#DC2626" />
//         <Text style={styles.loadingText}>Loading organizations...</Text>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       <StatusBar barStyle="dark-content" />

//       {/* Header */}
//       <View style={styles.header}>
//         <View>
//           <Text style={styles.headerTitle}>Super Admin</Text>
//           <Text style={styles.headerSub}>Platform Control Center</Text>
//         </View>
//         <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7}>
//           <Ionicons name="log-out-outline" size={20} color="#DC2626" />
//         </TouchableOpacity>
//       </View>

//       {/* Tab switcher */}
//       <View style={styles.tabRow}>
//         {TABS.map(t => (
//           <TouchableOpacity
//             key={t}
//             style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
//             onPress={() => setActiveTab(t)}
//             activeOpacity={0.8}
//           >
//             <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>{t}</Text>
//             {t === 'Plan Requests' && pendingCount > 0 && (
//               <View style={styles.tabBadge}>
//                 <Text style={styles.tabBadgeText}>{pendingCount}</Text>
//               </View>
//             )}
//           </TouchableOpacity>
//         ))}
//       </View>

//       <ScrollView
//         refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#DC2626" />}
//         showsVerticalScrollIndicator={false}
//       >
//         {activeTab === 'Organizations' ? (
//           <>
//             {/* Stats Row */}
//             <View style={styles.statsRow}>
//               <StatCard label="Total" value={stats.total} color="#6366F1" icon="business-outline" />
//               <StatCard label="Active" value={stats.active} color="#10B981" icon="checkmark-circle-outline" />
//               <StatCard label="Trial" value={stats.trial} color="#F59E0B" icon="time-outline" />
//               <StatCard label="Suspended" value={stats.suspended} color="#EF4444" icon="ban-outline" />
//             </View>

//             {/* Search */}
//             <View style={styles.searchWrap}>
//               <Ionicons name="search-outline" size={16} color="#94A3B8" style={{ marginLeft: 12 }} />
//               <TextInput
//                 style={styles.searchInput}
//                 placeholder="Search by org name or email..."
//                 placeholderTextColor="#94A3B8"
//                 value={search}
//                 onChangeText={setSearch}
//                 autoCapitalize="none"
//               />
//               {search ? (
//                 <TouchableOpacity onPress={() => setSearch('')} style={{ paddingHorizontal: 12 }}>
//                   <Ionicons name="close-circle" size={16} color="#94A3B8" />
//                 </TouchableOpacity>
//               ) : null}
//             </View>

//             {/* Filter Tabs */}
//             <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
//               {FILTERS.map(f => (
//                 <TouchableOpacity
//                   key={f}
//                   style={[styles.filterTab, filter === f && styles.filterTabActive]}
//                   onPress={() => setFilter(f)}
//                   activeOpacity={0.8}
//                 >
//                   <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>{f}</Text>
//                 </TouchableOpacity>
//               ))}
//             </ScrollView>

//             {error ? (
//               <View style={styles.errorBox}>
//                 <Text style={styles.errorText}>{error}</Text>
//               </View>
//             ) : null}

//             {/* Org Cards */}
//             <View style={styles.list}>
//               {filtered.length === 0 ? (
//                 <View style={styles.emptyWrap}>
//                   <Ionicons name="search-outline" size={32} color="#CBD5E1" />
//                   <Text style={styles.emptyText}>No organizations found</Text>
//                 </View>
//               ) : filtered.map((org) => {
//                 const plan = org.subscription?.plan || 'Silver';
//                 const status = org.subscription?.status || 'Trial';
//                 const planColor = PLAN_COLORS[plan] || PLAN_COLORS.Silver;
//                 const statusColor = STATUS_COLORS[status] || STATUS_COLORS.Expired;
//                 const daysLeft = status === 'Trial' ? trialDaysLeft(org.subscription?.trialEndsAt) : null;

//                 return (
//                   <View key={org.orgId} style={styles.card}>
//                     <View style={styles.cardTop}>
//                       <View style={styles.orgAvatar}>
//                         <Text style={styles.orgAvatarText}>{org.orgName?.[0]?.toUpperCase() || '?'}</Text>
//                       </View>
//                       <View style={styles.orgInfo}>
//                         <Text style={styles.orgName} numberOfLines={1}>{org.orgName}</Text>
//                         <Text style={styles.orgOwner} numberOfLines={1}>{org.owner?.email || '—'}</Text>
//                       </View>
//                       <View style={[styles.planBadge, { backgroundColor: planColor.bg, borderColor: planColor.border }]}>
//                         <Text style={styles.planBadgeIcon}>{planColor.icon}</Text>
//                         <Text style={[styles.planBadgeText, { color: planColor.text }]}>{plan}</Text>
//                       </View>
//                     </View>

//                     <View style={styles.metaRow}>
//                       <View style={[styles.statusChip, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}>
//                         <Text style={[styles.statusChipText, { color: statusColor.text }]}>{status}</Text>
//                       </View>
//                       <View style={styles.metaStat}>
//                         <Ionicons name="people-outline" size={12} color="#94A3B8" />
//                         <Text style={styles.metaStatText}>{org.usage?.users ?? 0}</Text>
//                       </View>
//                       <View style={styles.metaStat}>
//                         <Ionicons name="folder-outline" size={12} color="#94A3B8" />
//                         <Text style={styles.metaStatText}>{org.usage?.projects ?? 0}</Text>
//                       </View>
//                       <Text style={styles.joinedText}>Joined {formatDate(org.createdAt)}</Text>
//                     </View>

//                     {daysLeft !== null && (
//                       <View style={[styles.trialBanner, daysLeft <= 3 && styles.trialBannerUrgent]}>
//                         <Ionicons name="time-outline" size={13} color={daysLeft <= 3 ? '#DC2626' : '#C2410C'} />
//                         <Text style={[styles.trialBannerText, daysLeft <= 3 && { color: '#DC2626' }]}>
//                           {daysLeft <= 0 ? 'Trial expired' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in trial`}
//                         </Text>
//                       </View>
//                     )}

//                     <TouchableOpacity
//                       style={styles.manageBtn}
//                       onPress={() => openManageModal(org)}
//                       activeOpacity={0.8}
//                     >
//                       <Ionicons name="settings-outline" size={14} color="#2563EB" />
//                       <Text style={styles.manageBtnText}>Manage Plan</Text>
//                     </TouchableOpacity>
//                   </View>
//                 );
//               })}
//             </View>
//           </>
//         ) : (
//           /* ── Plan Requests Tab ── */
//           <View style={styles.list}>
//             {loadingReqs ? (
//               <View style={styles.emptyWrap}>
//                 <ActivityIndicator color="#DC2626" />
//               </View>
//             ) : planRequests.length === 0 ? (
//               <View style={styles.emptyWrap}>
//                 <Ionicons name="document-text-outline" size={32} color="#CBD5E1" />
//                 <Text style={styles.emptyText}>No plan requests yet</Text>
//               </View>
//             ) : planRequests.map((req) => {
//               const rc = REQ_STATUS_COLORS[req.status] || REQ_STATUS_COLORS.Pending;
//               const fromColor = PLAN_COLORS[req.currentPlan] || PLAN_COLORS.Silver;
//               const toColor = PLAN_COLORS[req.requestedPlan] || PLAN_COLORS.Gold;
//               return (
//                 <View key={req._id} style={styles.card}>
//                   {/* Top */}
//                   <View style={styles.cardTop}>
//                     <View style={styles.orgAvatar}>
//                       <Text style={styles.orgAvatarText}>{req.orgName?.[0]?.toUpperCase() || '?'}</Text>
//                     </View>
//                     <View style={styles.orgInfo}>
//                       <Text style={styles.orgName} numberOfLines={1}>{req.orgName}</Text>
//                       <Text style={styles.orgOwner}>{req.requestedByName || '—'}</Text>
//                     </View>
//                     <View style={[styles.statusChip, { backgroundColor: rc.bg, borderColor: rc.border }]}>
//                       <Text style={[styles.statusChipText, { color: rc.text }]}>{req.status}</Text>
//                     </View>
//                   </View>

//                   {/* Plan arrow */}
//                   <View style={styles.reqPlanRow}>
//                     <View style={[styles.reqPlanChip, { backgroundColor: fromColor.bg, borderColor: fromColor.border }]}>
//                       <Text style={[styles.reqPlanText, { color: fromColor.text }]}>{fromColor.icon} {req.currentPlan}</Text>
//                     </View>
//                     <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
//                     <View style={[styles.reqPlanChip, { backgroundColor: toColor.bg, borderColor: toColor.border }]}>
//                       <Text style={[styles.reqPlanText, { color: toColor.text }]}>{toColor.icon} {req.requestedPlan}</Text>
//                     </View>
//                     <Text style={[styles.joinedText, { marginLeft: 'auto' }]}>{formatDate(req.createdAt)}</Text>
//                   </View>

//                   {/* Org note */}
//                   {req.note ? (
//                     <Text style={styles.reqNote}>"{req.note}"</Text>
//                   ) : null}

//                   {/* Review info (if reviewed) */}
//                   {req.status !== 'Pending' && req.reviewedBy && (
//                     <Text style={styles.reqReviewedBy}>
//                       {req.status === 'Approved' ? 'Approved' : 'Rejected'} by {req.reviewedBy}
//                       {req.reviewNote ? ` — "${req.reviewNote}"` : ''}
//                     </Text>
//                   )}

//                   {/* Approve / Reject buttons */}
//                   {req.status === 'Pending' && (
//                     <View style={styles.reqActions}>
//                       <TouchableOpacity
//                         style={styles.approveBtn}
//                         onPress={() => openReviewModal(req, 'Approved')}
//                         activeOpacity={0.8}
//                       >
//                         <Ionicons name="checkmark" size={14} color="#fff" />
//                         <Text style={styles.approveBtnText}>Approve</Text>
//                       </TouchableOpacity>
//                       <TouchableOpacity
//                         style={styles.rejectBtn}
//                         onPress={() => openReviewModal(req, 'Rejected')}
//                         activeOpacity={0.8}
//                       >
//                         <Ionicons name="close" size={14} color="#DC2626" />
//                         <Text style={styles.rejectBtnText}>Reject</Text>
//                       </TouchableOpacity>
//                     </View>
//                   )}
//                 </View>
//               );
//             })}
//           </View>
//         )}
//       </ScrollView>

//       {/* Review Plan Request Modal */}
//       <Modal visible={reviewModal} animationType="slide" transparent onRequestClose={() => setReviewModal(false)}>
//         <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setReviewModal(false)} />
//         <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
//           <View style={styles.modalSheet}>
//             <View style={styles.modalHandle} />
//             <View style={styles.modalHeader}>
//               <View>
//                 <Text style={styles.modalTitle}>
//                   {reviewAction === 'Approved' ? 'Approve' : 'Reject'} Request
//                 </Text>
//                 <Text style={styles.modalSub}>
//                   {reviewTarget?.orgName} — {reviewTarget?.requestedPlan} plan
//                 </Text>
//               </View>
//               <TouchableOpacity onPress={() => setReviewModal(false)} style={styles.modalClose}>
//                 <Ionicons name="close" size={18} color="#64748B" />
//               </TouchableOpacity>
//             </View>
//             <Text style={styles.selectorLabel}>Review Note (optional)</Text>
//             <TextInput
//               style={[styles.overrideInput, { minHeight: 80, textAlignVertical: 'top', marginBottom: 16 }]}
//               placeholder="Add a note for the organization..."
//               placeholderTextColor="#CBD5E1"
//               value={reviewNote}
//               onChangeText={setReviewNote}
//               multiline
//             />
//             <TouchableOpacity
//               style={[
//                 styles.saveBtn,
//                 reviewing && { opacity: 0.6 },
//                 reviewAction === 'Rejected' && { backgroundColor: '#DC2626' },
//               ]}
//               onPress={handleReview}
//               disabled={reviewing}
//               activeOpacity={0.85}
//             >
//               {reviewing
//                 ? <ActivityIndicator color="#fff" size="small" />
//                 : <Text style={styles.saveBtnText}>{reviewAction === 'Approved' ? 'Approve Plan' : 'Reject Request'}</Text>}
//             </TouchableOpacity>
//           </View>
//         </KeyboardAvoidingView>
//       </Modal>

//       {/* Manage Plan Modal */}
//       <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
//         <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
//         <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
//           <View style={styles.modalSheet}>
//             <View style={styles.modalHandle} />

//             <View style={styles.modalHeader}>
//               <View>
//                 <Text style={styles.modalTitle}>{selectedOrg?.orgName}</Text>
//                 <Text style={styles.modalSub}>{selectedOrg?.owner?.email}</Text>
//               </View>
//               <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
//                 <Ionicons name="close" size={18} color="#64748B" />
//               </TouchableOpacity>
//             </View>

//             <ScrollView showsVerticalScrollIndicator={false}>
//               {/* Plan */}
//               <Text style={styles.selectorLabel}>Subscription Plan</Text>
//               <View style={styles.selectorRow}>
//                 {PLANS.map(p => {
//                   const c = PLAN_COLORS[p];
//                   const active = selectedPlan === p;
//                   return (
//                     <TouchableOpacity
//                       key={p}
//                       style={[styles.selectorChip, { borderColor: active ? c.border : '#E2E8F0', backgroundColor: active ? c.bg : '#F8FAFC' }]}
//                       onPress={() => setSelectedPlan(p)}
//                       activeOpacity={0.8}
//                     >
//                       <Text style={styles.chipIcon}>{c.icon}</Text>
//                       <Text style={[styles.selectorChipText, { color: active ? c.text : '#94A3B8' }]}>{p}</Text>
//                     </TouchableOpacity>
//                   );
//                 })}
//               </View>

//               {/* Status */}
//               <Text style={styles.selectorLabel}>Account Status</Text>
//               <View style={styles.selectorRow}>
//                 {STATUSES.map(s => {
//                   const c = STATUS_COLORS[s];
//                   const active = selectedStatus === s;
//                   return (
//                     <TouchableOpacity
//                       key={s}
//                       style={[styles.selectorChip, { borderColor: active ? c.border : '#E2E8F0', backgroundColor: active ? c.bg : '#F8FAFC' }]}
//                       onPress={() => setSelectedStatus(s)}
//                       activeOpacity={0.8}
//                     >
//                       <Text style={[styles.selectorChipText, { color: active ? c.text : '#94A3B8' }]}>{s}</Text>
//                     </TouchableOpacity>
//                   );
//                 })}
//               </View>

//               {/* Trial end date */}
//               {selectedStatus === 'Trial' && (
//                 <>
//                   <Text style={styles.selectorLabel}>Trial End Date</Text>
//                   <TextInput
//                     style={styles.overrideInput}
//                     placeholder="YYYY-MM-DD"
//                     placeholderTextColor="#CBD5E1"
//                     value={trialEndsAt}
//                     onChangeText={setTrialEndsAt}
//                     keyboardType="default"
//                   />
//                 </>
//               )}

//               {/* Overrides */}
//               <Text style={styles.selectorLabel}>Override Limits <Text style={styles.selectorLabelHint}>(leave blank = use plan default)</Text></Text>
//               <View style={styles.overrideRow}>
//                 <View style={styles.overrideField}>
//                   <Text style={styles.overrideLabel}>Max Users</Text>
//                   <TextInput
//                     style={styles.overrideInput}
//                     placeholder={`Default`}
//                     placeholderTextColor="#CBD5E1"
//                     value={maxUsers}
//                     onChangeText={setMaxUsers}
//                     keyboardType="number-pad"
//                   />
//                 </View>
//                 <View style={styles.overrideField}>
//                   <Text style={styles.overrideLabel}>Max Projects</Text>
//                   <TextInput
//                     style={styles.overrideInput}
//                     placeholder={`Default`}
//                     placeholderTextColor="#CBD5E1"
//                     value={maxProjects}
//                     onChangeText={setMaxProjects}
//                     keyboardType="number-pad"
//                   />
//                 </View>
//               </View>

//               {saveError ? (
//                 <View style={styles.saveErrorBox}>
//                   <Text style={styles.saveErrorText}>{saveError}</Text>
//                 </View>
//               ) : null}

//               <TouchableOpacity
//                 style={[styles.saveBtn, saving && { opacity: 0.6 }]}
//                 onPress={handleSavePlan}
//                 disabled={saving}
//                 activeOpacity={0.85}
//               >
//                 {saving
//                   ? <ActivityIndicator color="#fff" size="small" />
//                   : <Text style={styles.saveBtnText}>Save Changes</Text>
//                 }
//               </TouchableOpacity>
//             </ScrollView>
//           </View>
//         </KeyboardAvoidingView>
//       </Modal>
//     </View>
//   );
// }

// function StatCard({ label, value, color, icon }) {
//   return (
//     <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
//       <Ionicons name={icon} size={18} color={color} />
//       <Text style={[styles.statValue, { color }]}>{value}</Text>
//       <Text style={styles.statLabel}>{label}</Text>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#F8FAFF' },
//   centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFF', gap: 12 },
//   loadingText: { color: '#94A3B8', fontSize: 13, fontFamily: 'Inter-SemiBold' },

//   // Header
//   header: {
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
//     paddingHorizontal: 20,
//     paddingTop: Platform.OS === 'ios' ? 60 : 40,
//     paddingBottom: 16,
//     backgroundColor: '#fff',
//     borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
//   },
//   headerTitle: { fontSize: 22, color: '#0F172A', letterSpacing: -0.5 , fontFamily: 'Inter-Black' },
//   headerSub: { fontSize: 11, color: '#94A3B8', marginTop: 2, letterSpacing: 0.3 , fontFamily: 'Inter-SemiBold' },
//   logoutBtn: {
//     width: 40, height: 40, borderRadius: 12,
//     backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
//     alignItems: 'center', justifyContent: 'center',
//   },

//   // Stats
//   statsRow: { flexDirection: 'row', padding: 16, gap: 10 },
//   statCard: {
//     flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12,
//     alignItems: 'center', gap: 4,
//     borderWidth: 1, borderColor: '#F1F5F9',
//     shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
//   },
//   statValue: { fontSize: 22, letterSpacing: -0.5 , fontFamily: 'Inter-Black' },
//   statLabel: { fontSize: 10, color: '#94A3B8', letterSpacing: 0.5 , fontFamily: 'Inter-Bold' },

//   // Search
//   searchWrap: {
//     flexDirection: 'row', alignItems: 'center',
//     marginHorizontal: 16, marginBottom: 12,
//     backgroundColor: '#fff', borderRadius: 14,
//     borderWidth: 1, borderColor: '#E2E8F0',
//   },
//   searchInput: { flex: 1, paddingVertical: 11, paddingHorizontal: 10, fontSize: 14, color: '#0F172A', fontFamily: 'Inter-Medium' },

//   // Filter tabs
//   filterRow: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
//   filterTab: {
//     paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
//     backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
//   },
//   filterTabActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
//   filterTabText: { fontSize: 13, color: '#64748B' , fontFamily: 'Inter-Bold' },
//   filterTabTextActive: { color: '#fff' },

//   errorBox: { margin: 16, padding: 14, backgroundColor: '#FEF2F2', borderRadius: 12, borderWidth: 1, borderColor: '#FECACA' },
//   errorText: { color: '#DC2626', fontSize: 13, textAlign: 'center' , fontFamily: 'Inter-Bold' },

//   list: { padding: 16, gap: 12, paddingBottom: 40 },

//   emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 8 },
//   emptyText: { color: '#94A3B8', fontSize: 14, fontFamily: 'Inter-SemiBold' },

//   // Card
//   card: {
//     backgroundColor: '#fff', borderRadius: 18, padding: 16,
//     borderWidth: 1, borderColor: '#F1F5F9',
//     shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
//   },
//   cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
//   orgAvatar: {
//     width: 40, height: 40, borderRadius: 12,
//     backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 10,
//   },
//   orgAvatarText: { fontSize: 18, color: '#2563EB' , fontFamily: 'Inter-Black' },
//   orgInfo: { flex: 1, marginRight: 8 },
//   orgName: { fontSize: 15, color: '#0F172A' , fontFamily: 'Inter-Black' },
//   orgOwner: { fontSize: 11, color: '#94A3B8', marginTop: 1 , fontFamily: 'Inter-Medium' },
//   planBadge: {
//     flexDirection: 'row', alignItems: 'center', gap: 4,
//     paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
//   },
//   planBadgeIcon: { fontSize: 11 },
//   planBadgeText: { fontSize: 11, fontFamily: 'Inter-Black' },

//   metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
//   statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
//   statusChipText: { fontSize: 10, letterSpacing: 0.3 , fontFamily: 'Inter-Bold' },
//   metaStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
//   metaStatText: { fontSize: 11, color: '#94A3B8', fontFamily: 'Inter-SemiBold' },
//   joinedText: { fontSize: 10, color: '#CBD5E1', marginLeft: 'auto' , fontFamily: 'Inter-SemiBold' },

//   trialBanner: {
//     flexDirection: 'row', alignItems: 'center', gap: 6,
//     backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA',
//     borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10,
//   },
//   trialBannerUrgent: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
//   trialBannerText: { fontSize: 12, color: '#C2410C' , fontFamily: 'Inter-Bold' },

//   manageBtn: {
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
//     paddingVertical: 9, borderRadius: 12, gap: 5,
//     backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
//   },
//   manageBtnText: { color: '#2563EB', fontSize: 12, fontFamily: 'Inter-Bold' },

//   // Modal
//   modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
//   modalSheet: {
//     backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
//     padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '85%',
//   },
//   modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
//   modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
//   modalTitle: { fontSize: 18, color: '#0F172A' , fontFamily: 'Inter-Black' },
//   modalSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 , fontFamily: 'Inter-Medium' },
//   modalClose: {
//     width: 32, height: 32, borderRadius: 10,
//     backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
//   },

//   selectorLabel: { fontSize: 11, color: '#64748B', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 , fontFamily: 'Inter-Bold' },
//   selectorLabelHint: { fontSize: 10, color: '#CBD5E1', letterSpacing: 0, textTransform: 'none' , fontFamily: 'Inter-Medium' },
//   selectorRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
//   selectorChip: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', gap: 4 },
//   chipIcon: { fontSize: 16 },
//   selectorChipText: { fontSize: 12, fontFamily: 'Inter-Black' },

//   overrideRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
//   overrideField: { flex: 1 },
//   overrideLabel: { fontSize: 11, color: '#64748B', marginBottom: 6 , fontFamily: 'Inter-Bold' },
//   overrideInput: {
//     backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
//     borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
//     fontSize: 14, color: '#0F172A',  fontFamily: 'Inter-SemiBold',
//   },

//   saveErrorBox: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
//   saveErrorText: { color: '#DC2626', fontSize: 12, textAlign: 'center' , fontFamily: 'Inter-Bold' },

//   saveBtn: {
//     backgroundColor: '#2563EB', borderRadius: 14,
//     paddingVertical: 16, alignItems: 'center', marginTop: 4, marginBottom: 8,
//   },
//   saveBtnText: { color: '#fff', fontSize: 15, letterSpacing: 0.5 , fontFamily: 'Inter-Black' },

//   // Tabs
//   tabRow: {
//     flexDirection: 'row',
//     borderBottomWidth: 1,
//     borderBottomColor: '#F1F5F9',
//     backgroundColor: '#fff',
//   },
//   tabBtn: {
//     flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
//     paddingVertical: 14, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent',
//   },
//   tabBtnActive: { borderBottomColor: '#DC2626' },
//   tabBtnText: { fontSize: 13, color: '#94A3B8' , fontFamily: 'Inter-Bold' },
//   tabBtnTextActive: { color: '#DC2626' },
//   tabBadge: {
//     backgroundColor: '#DC2626', borderRadius: 10,
//     paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center',
//   },
//   tabBadgeText: { color: '#fff', fontSize: 10, fontFamily: 'Inter-Black' },

//   // Plan request cards
//   reqPlanRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
//   reqPlanChip: {
//     flexDirection: 'row', alignItems: 'center', gap: 4,
//     paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
//   },
//   reqPlanText: { fontSize: 11, fontFamily: 'Inter-Black' },
//   reqNote: { fontSize: 12, color: '#64748B', fontStyle: 'italic', marginBottom: 6 , fontFamily: 'Inter-Medium' },
//   reqReviewedBy: { fontSize: 11, color: '#94A3B8', marginBottom: 6 , fontFamily: 'Inter-SemiBold' },
//   reqActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
//   approveBtn: {
//     flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
//     gap: 5, backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 10,
//   },
//   approveBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter-Black' },
//   rejectBtn: {
//     flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
//     gap: 5, backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 10,
//     borderWidth: 1, borderColor: '#FECACA',
//   },
//   rejectBtnText: { color: '#DC2626', fontSize: 13, fontFamily: 'Inter-Black' },
// });


import { useState, useEffect, useCallback, useMemo } from 'react';

import {

  View, Text, ScrollView, TouchableOpacity, StyleSheet,

  StatusBar, ActivityIndicator, Modal, Platform, RefreshControl,

  TextInput, KeyboardAvoidingView,

} from 'react-native';

import { Ionicons, Feather } from '@expo/vector-icons';

import { useRouter } from 'expo-router';

import { useSuperAdmin } from '../context/SuperAdminContext';



// Smart avatar palette — same as user-side dashboard

const AVATAR_PALETTE = [

  { bg: '#EFF6FF', text: '#2563EB' },

  { bg: '#F0FDF4', text: '#16A34A' },

  { bg: '#FEF3C7', text: '#D97706' },

  { bg: '#FDF4FF', text: '#9333EA' },

  { bg: '#FFF7ED', text: '#EA580C' },

  { bg: '#F0F9FF', text: '#0284C7' },

  { bg: '#FFF1F2', text: '#E11D48' },

  { bg: '#F0FDFA', text: '#0D9488' },

];

function getAvatarColor(name = '') {

  let hash = 0;

  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);

  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];

}



const PLANS = ['Silver', 'Gold', 'Platinum'];

const STATUSES = ['Active', 'Trial', 'Suspended'];

const FILTERS = ['All', 'Active', 'Suspended', 'Expiring'];

const TABS = ['Dashboard', 'Organizations', 'Plan Requests'];



const PLAN_PRICES = {

  Silver: 50,

  Gold: 100,

  Platinum: 250

};



const REQ_STATUS_COLORS = {

  Pending:  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', dot: '#F97316' },

  Approved: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', dot: '#22C55E' },

  Rejected: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', dot: '#EF4444' },

};



const PLAN_COLORS = {

  Silver:   { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },

  Gold:     { bg: '#FEF9C3', text: '#92400E', border: '#FDE68A' },

  Platinum: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },

};



const STATUS_COLORS = {

  Active:    { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },

  Trial:     { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },

  Suspended: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },

  Expired:   { bg: '#F8FAFC', text: '#94A3B8', border: '#E2E8F0' },

};



function trialDaysLeft(trialEndsAt) {

  if (!trialEndsAt) return null;

  const diff = Math.ceil((new Date(trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24));

  return diff;

}



function formatDate(dateStr) {

  if (!dateStr) return '—';

  return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

}



export default function SuperAdminDashboard() {

  const [activeTab, setActiveTab] = useState('Dashboard');



  const [orgs, setOrgs] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState('');

  const [search, setSearch] = useState('');

  const [filter, setFilter] = useState('All');



  const [selectedOrg, setSelectedOrg] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState('Gold');

  const [selectedStatus, setSelectedStatus] = useState('Active');

  const [maxUsers, setMaxUsers] = useState('');

  const [maxProjects, setMaxProjects] = useState('');

  const [trialEndsAt, setTrialEndsAt] = useState('');

  const [saving, setSaving] = useState(false);

  const [saveError, setSaveError] = useState('');



  // Plan requests state

  const [planRequests, setPlanRequests] = useState([]);

  const [loadingReqs, setLoadingReqs] = useState(false);

  const [reviewModal, setReviewModal] = useState(false);

  const [reviewTarget, setReviewTarget] = useState(null);

  const [reviewAction, setReviewAction] = useState('Approved');

  const [reviewNote, setReviewNote] = useState('');

  const [reviewing, setReviewing] = useState(false);



  const { saLogout, saFetch } = useSuperAdmin();

  const router = useRouter();



  const loadOrgs = useCallback(async () => {

    try {

      const res = await saFetch('/superadmin/subscriptions');

      if (!res.ok) throw new Error('Unauthorized');

      const data = await res.json();

      setOrgs(data);

      setError('');

    } catch (e) {

      setError(e.message === 'Unauthorized' ? 'Session expired. Please log in again.' : 'Failed to load organizations.');

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  }, [saFetch]);



  const loadRequests = useCallback(async () => {

    setLoadingReqs(true);

    try {

      const res = await saFetch('/superadmin/plan-requests');

      if (res.ok) {

        const data = await res.json();

        setPlanRequests(data);

      }

    } catch { } finally {

      setLoadingReqs(false);

    }

  }, [saFetch]);



  useEffect(() => { loadOrgs(); loadRequests(); }, []);



  const handleRefresh = () => {

    setRefreshing(true);

    loadOrgs();

    loadRequests();

  };



  // Stats

  const stats = useMemo(() => ({

    total:     orgs.length,

    active:    orgs.filter(o => o.subscription?.status === 'Active').length,

    suspended: orgs.filter(o => o.subscription?.status === 'Suspended').length,

  }), [orgs]);



  // Dashboard Analytics

  const dashboardData = useMemo(() => {

    // 1. Revenue (Estimated MRR based on active plans)

    let mrr = 0;

    orgs.forEach(o => {

      if (o.subscription?.status === 'Active') {

        const plan = o.subscription?.plan || 'Silver';

        mrr += PLAN_PRICES[plan] || 0;

      }

    });



    // 2. Chart Data (Registrations in last 6 months)

    const months = [];

    const now = new Date();

    for (let i = 5; i >= 0; i--) {

      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);

      months.push({ label: d.toLocaleString('en-US', { month: 'short' }), count: 0, year: d.getFullYear(), month: d.getMonth() });

    }

   

    orgs.forEach(o => {

      if (!o.createdAt) return;

      const d = new Date(o.createdAt);

      const target = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());

      if (target) target.count++;

    });

    const maxChartValue = Math.max(...months.map(m => m.count), 5);



    // 3. Expiring Soon (Trials or active plans ending in <= 30 days)

    const allExpiring = orgs.map(o => {

      const days = trialDaysLeft(o.subscription?.trialEndsAt);

      return { ...o, daysLeft: days };

    }).filter(o => o.daysLeft !== null && o.daysLeft >= 0 && o.daysLeft <= 30)

      .sort((a, b) => a.daysLeft - b.daysLeft);

     

    const expiring = allExpiring.slice(0, 5);



    // 4. Recent Activity

    const activities = [];

    orgs.forEach(o => {

      if (o.createdAt) {

        activities.push({ id: `org_${o.orgId}`, type: 'new_org', title: `${o.orgName} joined`, date: o.createdAt, icon: 'business-outline', color: '#10B981', bg: '#F0FDF4' });

      }

    });

    planRequests.forEach(r => {

      if (r.createdAt) {

        activities.push({ id: `req_${r._id}`, type: 'plan_request', title: `${r.orgName} requested ${r.requestedPlan}`, date: r.createdAt, icon: 'arrow-up-circle-outline', color: '#3B82F6', bg: '#EFF6FF' });

      }

    });

    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

   

    return { mrr, chart: months, maxChartValue, expiring, expiringTotal: allExpiring.length, recentActivity: activities.slice(0, 8) };

  }, [orgs, planRequests]);



  // Filtered + searched orgs

  const filtered = useMemo(() => {

    return orgs.filter(o => {

      if (filter === 'Expiring') {

        const days = trialDaysLeft(o.subscription?.trialEndsAt);

        if (days === null || days < 0 || days > 30) return false;

      } else {

        const matchFilter = filter === 'All' || o.subscription?.status === filter;

        if (!matchFilter) return false;

      }



      const searchStr = search.toLowerCase();

      const matchSearch = !searchStr || o.orgName?.toLowerCase().includes(searchStr) || o.owner?.email?.toLowerCase().includes(searchStr);

      return matchSearch;

    });

  }, [orgs, filter, search]);



  const openManageModal = (org) => {

    setSelectedOrg(org);

    setSelectedPlan(org.subscription?.plan || 'Silver');

    setSelectedStatus(org.subscription?.status || 'Active');

    setMaxUsers(org.subscription?.overrides?.maxUsers?.toString() || '');

    setMaxProjects(org.subscription?.overrides?.maxProjects?.toString() || '');

    const te = org.subscription?.trialEndsAt;

    setTrialEndsAt(te ? new Date(te).toISOString().split('T')[0] : '');

    setSaveError('');

    setModalVisible(true);

  };



  const handleSavePlan = async () => {

    if (!selectedOrg) return;

    setSaving(true);

    setSaveError('');

    try {

      const body = {

        plan: selectedPlan,

        status: selectedStatus,

        reason: 'Updated via mobile Super Admin',

        overrides: {

          maxUsers: maxUsers ? parseInt(maxUsers) : null,

          maxProjects: maxProjects ? parseInt(maxProjects) : null,

        },

      };

      if (trialEndsAt) body.trialEndsAt = trialEndsAt;



      const res = await saFetch(`/superadmin/subscriptions/${selectedOrg.orgId}`, {

        method: 'PATCH',

        body: JSON.stringify(body),

      });

      if (!res.ok) throw new Error('Failed to save');

      setModalVisible(false);

      loadOrgs();

    } catch (e) {

      setSaveError('Failed to save. Please try again.');

    } finally {

      setSaving(false);

    }

  };



  const openReviewModal = (req, action) => {

    setReviewTarget(req);

    setReviewAction(action);

    setReviewNote('');

    setReviewModal(true);

  };



  const handleReview = async () => {

    if (!reviewTarget) return;

    setReviewing(true);

    try {

      const res = await saFetch(`/superadmin/plan-requests/${reviewTarget._id}`, {

        method: 'PATCH',

        body: JSON.stringify({ action: reviewAction, reviewNote }),

      });

      if (res.ok) {

        setReviewModal(false);

        loadRequests();

        loadOrgs();

      }

    } catch { } finally {

      setReviewing(false);

    }

  };



  const pendingCount = planRequests.filter(r => r.status === 'Pending').length;



  const handleLogout = async () => {

    await saLogout();

    router.replace('/auth/login');

  };



  if (loading) {

    return (

      <View style={styles.centered}>

        <ActivityIndicator size="large" color="#3B82F6" />

        <Text style={styles.loadingText}>Loading organizations...</Text>

      </View>

    );

  }



  return (

    <View style={styles.container}>

      <StatusBar barStyle="light-content" backgroundColor="#2D1B64" />



      {/* Purple Header Container */}

      <View style={styles.headerWrap}>

        <View style={styles.header}>

          <TouchableOpacity onPress={() => router.replace('/auth/login')} activeOpacity={0.7} style={{ padding: 4 }}>

            <Ionicons name="chevron-back" size={26} color="#FFF" />

          </TouchableOpacity>

          <Text style={styles.headerTitle}>Super Admin</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginRight: 8 }}>

            <TouchableOpacity activeOpacity={0.7}>

              <Ionicons name="thumbs-up-outline" size={22} color="#FFF" />

            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.7}>

              <Ionicons name="notifications-outline" size={22} color="#FFF" />

            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>

              <Ionicons name="log-out-outline" size={24} color="#FFF" />

            </TouchableOpacity>

          </View>

        </View>



        {/* Tab switcher */}

        <View style={styles.tabRow}>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>

            {TABS.map(t => (

              <TouchableOpacity

                key={t}

                style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}

                onPress={() => setActiveTab(t)}

                activeOpacity={0.8}

              >

                <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>{t}</Text>

                {t === 'Plan Requests' && pendingCount > 0 && (

                  <View style={styles.tabBadge}>

                    <Text style={styles.tabBadgeText}>{pendingCount}</Text>

                  </View>

                )}

              </TouchableOpacity>

            ))}

          </ScrollView>

        </View>

      </View>



      <ScrollView

        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3B82F6" colors={['#3B82F6']} />}

        showsVerticalScrollIndicator={false}

      >

        {activeTab === 'Dashboard' ? (

          <View style={styles.dashboardTab}>

            {/* Stats Row */}

            <View style={styles.statsRow}>

              <StatCard label="Total Orgs" value={stats.total} onPress={() => { setActiveTab('Organizations'); setFilter('All'); }} />

              <StatCard label="Active" value={stats.active} onPress={() => { setActiveTab('Organizations'); setFilter('Active'); }} />

              <StatCard label="Suspended" value={stats.suspended} onPress={() => { setActiveTab('Organizations'); setFilter('Suspended'); }} />

              <StatCard label="Expiring" value={dashboardData.expiringTotal} onPress={() => { setActiveTab('Organizations'); setFilter('Expiring'); }} />

            </View>



            {/* Revenue & Chart */}

            <View style={styles.dashGrid}>

              <View style={[styles.card, styles.mrrCard]}>

                <View style={styles.mrrIconWrap}>

                  <Ionicons name="wallet-outline" size={24} color="#16A34A" />

                </View>

                <Text style={styles.mrrLabel}>Estimated MRR</Text>

                <Text style={styles.mrrValue}>${dashboardData.mrr.toLocaleString()}</Text>

                <Text style={styles.mrrSub}>Based on active plans</Text>

              </View>



              <View style={[styles.card, styles.chartCard]}>

                <Text style={styles.sectionTitle}>Registrations (6mo)</Text>

                <BarChart data={dashboardData.chart} maxVal={dashboardData.maxChartValue} />

              </View>

            </View>



            {/* Expiring Soon */}

            <Text style={[styles.sectionTitle, { marginLeft: 16, marginTop: 16 }]}>Expiring Soon</Text>

            <View style={styles.list}>

              {dashboardData.expiring.length === 0 ? (

                <View style={styles.emptyWrap}>

                  <Ionicons name="checkmark-circle-outline" size={32} color="#CBD5E1" />

                  <Text style={styles.emptyText}>No subscriptions expiring soon</Text>

                </View>

              ) : dashboardData.expiring.map(org => {

                const av = getAvatarColor(org.orgName || '');

                return (

                  <View key={org.orgId} style={styles.card}>

                    <View style={styles.cardTop}>

                      <View style={[styles.orgAvatar, { backgroundColor: av.bg }]}>

                        <Text style={[styles.orgAvatarText, { color: av.text }]}>{org.orgName?.[0]?.toUpperCase() || '?'}</Text>

                      </View>

                      <View style={styles.orgInfo}>

                        <Text style={styles.orgName} numberOfLines={1}>{org.orgName}</Text>

                        <Text style={[styles.trialBannerText, { color: '#DC2626', marginTop: 4, fontFamily: 'Inter-Bold' }]}>

                          Ends in {org.daysLeft} days

                        </Text>

                      </View>

                      <TouchableOpacity style={styles.manageBtn} onPress={() => openManageModal(org)} activeOpacity={0.8}>

                        <Text style={styles.manageBtnText}>Manage</Text>

                      </TouchableOpacity>

                    </View>

                  </View>

                );

              })}

            </View>



            {/* Recent Activity Feed */}

            <Text style={[styles.sectionTitle, { marginLeft: 16 }]}>Recent Activity</Text>

            <View style={[styles.card, { marginHorizontal: 16, marginBottom: 40 }]}>

              {dashboardData.recentActivity.length === 0 ? (

                <Text style={styles.emptyText}>No recent activity</Text>

              ) : dashboardData.recentActivity.map((act, i) => (

                <View key={act.id} style={[styles.activityRow, i === dashboardData.recentActivity.length - 1 && { borderBottomWidth: 0 }]}>

                  <View style={[styles.activityIconWrap, { backgroundColor: act.bg }]}>

                    <Ionicons name={act.icon} size={16} color={act.color} />

                  </View>

                  <View style={{ flex: 1 }}>

                    <Text style={styles.activityTitle}>{act.title}</Text>

                    <Text style={styles.activityTime}>{formatDate(act.date)}</Text>

                  </View>

                </View>

              ))}

            </View>

          </View>

        ) : activeTab === 'Organizations' ? (

          <>

            {/* Search */}

            <View style={styles.searchWrap}>

              <Ionicons name="search-outline" size={16} color="#94A3B8" style={{ marginLeft: 12 }} />

              <TextInput

                style={styles.searchInput}

                placeholder="Search by org name or email..."

                placeholderTextColor="#94A3B8"

                value={search}

                onChangeText={setSearch}

                autoCapitalize="none"

              />

              {search ? (

                <TouchableOpacity onPress={() => setSearch('')} style={{ paddingHorizontal: 12 }}>

                  <Ionicons name="close-circle" size={16} color="#94A3B8" />

                </TouchableOpacity>

              ) : null}

            </View>



            {/* Filter Tabs */}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>

              {FILTERS.map(f => (

                <TouchableOpacity

                  key={f}

                  style={[styles.filterTab, filter === f && styles.filterTabActive]}

                  onPress={() => setFilter(f)}

                  activeOpacity={0.8}

                >

                  <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>{f}</Text>

                </TouchableOpacity>

              ))}

            </ScrollView>



            {error ? (

              <View style={styles.errorBox}>

                <Text style={styles.errorText}>{error}</Text>

              </View>

            ) : null}



            {/* Org Cards */}

            <View style={styles.list}>

              {filtered.length === 0 ? (

                <View style={styles.emptyWrap}>

                  <Ionicons name="search-outline" size={32} color="#CBD5E1" />

                  <Text style={styles.emptyText}>No organizations found</Text>

                </View>

              ) : filtered.map((org) => {

                const plan = org.subscription?.plan || 'Silver';

                const status = org.subscription?.status || 'Trial';

                const planColor = PLAN_COLORS[plan] || PLAN_COLORS.Silver;

                const statusColor = STATUS_COLORS[status] || STATUS_COLORS.Expired;

                const daysLeft = status === 'Trial' ? trialDaysLeft(org.subscription?.trialEndsAt) : null;

                const av = getAvatarColor(org.orgName || '');



                return (

                  <View key={org.orgId} style={styles.card}>

                    <View style={styles.cardTop}>

                      <View style={[styles.orgAvatar, { backgroundColor: av.bg }]}>

                        <Text style={[styles.orgAvatarText, { color: av.text }]}>{org.orgName?.[0]?.toUpperCase() || '?'}</Text>

                      </View>

                      <View style={styles.orgInfo}>

                        <Text style={styles.orgName} numberOfLines={1}>{org.orgName}</Text>

                        <Text style={styles.orgOwner} numberOfLines={1}>{org.owner?.email || '—'}</Text>

                      </View>

                      <View style={[styles.planBadge, { backgroundColor: planColor.bg, borderColor: planColor.border }]}>

                        <Text style={[styles.planBadgeText, { color: planColor.text }]}>{plan}</Text>

                      </View>

                    </View>



                    <View style={styles.metaRow}>

                      <View style={[styles.statusChip, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}>

                        <Text style={[styles.statusChipText, { color: statusColor.text }]}>{status}</Text>

                      </View>

                      <View style={styles.metaStat}>

                        <Ionicons name="people-outline" size={12} color="#94A3B8" />

                        <Text style={styles.metaStatText}>{org.usage?.users ?? 0}</Text>

                      </View>

                      <View style={styles.metaStat}>

                        <Ionicons name="folder-outline" size={12} color="#94A3B8" />

                        <Text style={styles.metaStatText}>{org.usage?.projects ?? 0}</Text>

                      </View>

                      <Text style={styles.joinedText}>Joined {formatDate(org.createdAt)}</Text>

                    </View>



                    {daysLeft !== null && (

                      <View style={[styles.trialBanner, daysLeft <= 3 && styles.trialBannerUrgent]}>

                        <Ionicons name="time-outline" size={13} color={daysLeft <= 3 ? '#DC2626' : '#C2410C'} />

                        <Text style={[styles.trialBannerText, daysLeft <= 3 && { color: '#DC2626' }]}>

                          {daysLeft <= 0 ? 'Trial expired' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in trial`}

                        </Text>

                      </View>

                    )}



                    <TouchableOpacity

                      style={styles.manageBtn}

                      onPress={() => openManageModal(org)}

                      activeOpacity={0.8}

                    >

                      <Ionicons name="settings-outline" size={14} color="#FFF" />

                      <Text style={styles.manageBtnText}>Manage Plan</Text>

                    </TouchableOpacity>

                  </View>

                );

              })}

            </View>

          </>

        ) : (

          /* ── Plan Requests Tab ── */

          <View style={styles.list}>

            {loadingReqs ? (

              <View style={styles.emptyWrap}>

                <ActivityIndicator color="#3B82F6" />

              </View>

            ) : planRequests.length === 0 ? (

              <View style={styles.emptyWrap}>

                <Ionicons name="document-text-outline" size={32} color="#CBD5E1" />

                <Text style={styles.emptyText}>No plan requests yet</Text>

              </View>

            ) : planRequests.map((req) => {

              const rc = REQ_STATUS_COLORS[req.status] || REQ_STATUS_COLORS.Pending;

              const fromColor = PLAN_COLORS[req.currentPlan] || PLAN_COLORS.Silver;

              const toColor = PLAN_COLORS[req.requestedPlan] || PLAN_COLORS.Gold;

              const av = getAvatarColor(req.orgName || '');

              return (

                <View key={req._id} style={styles.card}>

                  {/* Top */}

                  <View style={styles.cardTop}>

                    <View style={[styles.orgAvatar, { backgroundColor: av.bg }]}>

                      <Text style={[styles.orgAvatarText, { color: av.text }]}>{req.orgName?.[0]?.toUpperCase() || '?'}</Text>

                    </View>

                    <View style={styles.orgInfo}>

                      <Text style={styles.orgName} numberOfLines={1}>{req.orgName}</Text>

                      <Text style={styles.orgOwner}>{req.requestedByName || '—'}</Text>

                    </View>

                    <View style={[styles.statusChip, { backgroundColor: rc.bg, borderColor: rc.border }]}>

                      <Text style={[styles.statusChipText, { color: rc.text }]}>{req.status}</Text>

                    </View>

                  </View>



                  {/* Plan arrow */}

                  <View style={styles.reqPlanRow}>

                    <View style={[styles.reqPlanChip, { backgroundColor: fromColor.bg, borderColor: fromColor.border }]}>

                      <Text style={[styles.reqPlanText, { color: fromColor.text }]}>{req.currentPlan}</Text>

                    </View>

                    <Ionicons name="arrow-forward" size={14} color="#94A3B8" />

                    <View style={[styles.reqPlanChip, { backgroundColor: toColor.bg, borderColor: toColor.border }]}>

                      <Text style={[styles.reqPlanText, { color: toColor.text }]}>{req.requestedPlan}</Text>

                    </View>

                    <Text style={[styles.joinedText, { marginLeft: 'auto' }]}>{formatDate(req.createdAt)}</Text>

                  </View>



                  {/* Org note */}

                  {req.note ? (

                    <Text style={styles.reqNote}>"{req.note}"</Text>

                  ) : null}



                  {/* Review info (if reviewed) */}

                  {req.status !== 'Pending' && req.reviewedBy && (

                    <Text style={styles.reqReviewedBy}>

                      {req.status === 'Approved' ? 'Approved' : 'Rejected'} by {req.reviewedBy}

                      {req.reviewNote ? ` — "${req.reviewNote}"` : ''}

                    </Text>

                  )}



                  {/* Approve / Reject buttons */}

                  {req.status === 'Pending' && (

                    <View style={styles.reqActions}>

                      <TouchableOpacity

                        style={styles.approveBtn}

                        onPress={() => openReviewModal(req, 'Approved')}

                        activeOpacity={0.8}

                      >

                        <Feather name="check" size={16} color="#16A34A" />

                      </TouchableOpacity>

                      <TouchableOpacity

                        style={styles.rejectBtn}

                        onPress={() => openReviewModal(req, 'Rejected')}

                        activeOpacity={0.8}

                      >

                        <Feather name="x" size={16} color="#EF4444" />

                      </TouchableOpacity>

                    </View>

                  )}

                </View>

              );

            })}

          </View>

        )}

      </ScrollView>



      {/* Review Plan Request Modal */}

      <Modal visible={reviewModal} animationType="slide" transparent onRequestClose={() => setReviewModal(false)}>

        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setReviewModal(false)} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          <View style={styles.modalSheet}>

            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>

              <View>

                <Text style={styles.modalTitle}>

                  {reviewAction === 'Approved' ? 'Approve' : 'Reject'} Request

                </Text>

                <Text style={styles.modalSub}>

                  {reviewTarget?.orgName} — {reviewTarget?.requestedPlan} plan

                </Text>

              </View>

              <TouchableOpacity onPress={() => setReviewModal(false)} style={styles.modalClose}>

                <Ionicons name="close" size={18} color="#64748B" />

              </TouchableOpacity>

            </View>

            <Text style={styles.selectorLabel}>Review Note (optional)</Text>

            <TextInput

              style={[styles.overrideInput, { minHeight: 80, textAlignVertical: 'top', marginBottom: 16 }]}

              placeholder="Add a note for the organization..."

              placeholderTextColor="#CBD5E1"

              value={reviewNote}

              onChangeText={setReviewNote}

              multiline

            />

            <TouchableOpacity

              style={[

                styles.saveBtn,

                reviewing && { opacity: 0.6 },

                reviewAction === 'Rejected' && { backgroundColor: '#DC2626' },

              ]}

              onPress={handleReview}

              disabled={reviewing}

              activeOpacity={0.85}

            >

              {reviewing

                ? <ActivityIndicator color="#fff" size="small" />

                : <Text style={styles.saveBtnText}>{reviewAction === 'Approved' ? 'Approve Plan' : 'Reject Request'}</Text>}

            </TouchableOpacity>

          </View>

        </KeyboardAvoidingView>

      </Modal>



      {/* Manage Plan Modal */}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>

        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          <View style={styles.modalSheet}>

            <View style={styles.modalHandle} />



            <View style={styles.modalHeader}>

              <View>

                <Text style={styles.modalTitle}>{selectedOrg?.orgName}</Text>

                <Text style={styles.modalSub}>{selectedOrg?.owner?.email}</Text>

              </View>

              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>

                <Ionicons name="close" size={18} color="#64748B" />

              </TouchableOpacity>

            </View>



            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Plan */}

              <Text style={styles.selectorLabel}>Subscription Plan</Text>

              <View style={styles.selectorRow}>

                {PLANS.map(p => {

                  const c = PLAN_COLORS[p];

                  const active = selectedPlan === p;

                  return (

                    <TouchableOpacity

                      key={p}

                      style={[styles.selectorChip, { borderColor: active ? c.border : '#E2E8F0', backgroundColor: active ? c.bg : '#F8FAFC' }]}

                      onPress={() => setSelectedPlan(p)}

                      activeOpacity={0.8}

                    >

                      <Text style={styles.chipIcon}>{c.icon}</Text>

                      <Text style={[styles.selectorChipText, { color: active ? c.text : '#94A3B8' }]}>{p}</Text>

                    </TouchableOpacity>

                  );

                })}

              </View>



              {/* Status */}

              <Text style={styles.selectorLabel}>Account Status</Text>

              <View style={styles.selectorRow}>

                {STATUSES.map(s => {

                  const c = STATUS_COLORS[s];

                  const active = selectedStatus === s;

                  return (

                    <TouchableOpacity

                      key={s}

                      style={[styles.selectorChip, { borderColor: active ? c.border : '#E2E8F0', backgroundColor: active ? c.bg : '#F8FAFC' }]}

                      onPress={() => setSelectedStatus(s)}

                      activeOpacity={0.8}

                    >

                      <Text style={[styles.selectorChipText, { color: active ? c.text : '#94A3B8' }]}>{s}</Text>

                    </TouchableOpacity>

                  );

                })}

              </View>



              {/* Trial end date */}

              {selectedStatus === 'Trial' && (

                <>

                  <Text style={styles.selectorLabel}>Trial End Date</Text>

                  <TextInput

                    style={styles.overrideInput}

                    placeholder="YYYY-MM-DD"

                    placeholderTextColor="#CBD5E1"

                    value={trialEndsAt}

                    onChangeText={setTrialEndsAt}

                    keyboardType="default"

                  />

                </>

              )}



              {/* Overrides */}

              <Text style={styles.selectorLabel}>Override Limits <Text style={styles.selectorLabelHint}>(leave blank = use plan default)</Text></Text>

              <View style={styles.overrideRow}>

                <View style={styles.overrideField}>

                  <Text style={styles.overrideLabel}>Max Users</Text>

                  <TextInput

                    style={styles.overrideInput}

                    placeholder={`Default`}

                    placeholderTextColor="#CBD5E1"

                    value={maxUsers}

                    onChangeText={setMaxUsers}

                    keyboardType="number-pad"

                  />

                </View>

                <View style={styles.overrideField}>

                  <Text style={styles.overrideLabel}>Max Projects</Text>

                  <TextInput

                    style={styles.overrideInput}

                    placeholder={`Default`}

                    placeholderTextColor="#CBD5E1"

                    value={maxProjects}

                    onChangeText={setMaxProjects}

                    keyboardType="number-pad"

                  />

                </View>

              </View>



              {saveError ? (

                <View style={styles.saveErrorBox}>

                  <Text style={styles.saveErrorText}>{saveError}</Text>

                </View>

              ) : null}



              <TouchableOpacity

                style={[styles.saveBtn, saving && { opacity: 0.6 }]}

                onPress={handleSavePlan}

                disabled={saving}

                activeOpacity={0.85}

              >

                {saving

                  ? <ActivityIndicator color="#fff" size="small" />

                  : <Text style={styles.saveBtnText}>Save Changes</Text>

                }

              </TouchableOpacity>

            </ScrollView>

          </View>

        </KeyboardAvoidingView>

      </Modal>

    </View>

  );

}



function StatCard({ label, value, onPress }) {

  return (

    <TouchableOpacity style={styles.statCard} activeOpacity={0.7} onPress={onPress}>

      <Text style={styles.statValue}>{value}</Text>

      <Text style={styles.statLabel}>{label}</Text>

    </TouchableOpacity>

  );

}



function BarChart({ data, maxVal }) {

  return (

    <View style={styles.chartContainer}>

      {data.map((col, idx) => {

        const heightPct = maxVal > 0 ? (col.count / maxVal) * 100 : 0;

        return (

          <View key={idx} style={styles.chartCol}>

            <Text style={styles.chartColValue}>{col.count > 0 ? col.count : ''}</Text>

            <View style={styles.chartBarBg}>

              <View style={[styles.chartBarFill, { height: `${heightPct}%` }]} />

            </View>

            <Text style={styles.chartColLabel}>{col.label}</Text>

          </View>

        );

      })}

    </View>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#F8FAFF' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFF', gap: 12 },

  loadingText: { color: '#94A3B8', fontSize: 13, fontFamily: 'Inter-SemiBold' },



  // Header

  headerWrap: {

    backgroundColor: '#2D1B64',

    paddingTop: Platform.OS === 'ios' ? 65 : 50,

  },

  header: {

    flexDirection: 'row', alignItems: 'center',

    paddingHorizontal: 16,

    paddingBottom: 16,

  },

  headerTitle: { flex: 1, fontSize: 20, fontFamily: 'Inter-Bold', color: '#FFF', marginLeft: 16 },



  // Stats

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 16, justifyContent: 'space-between' },

  statCard: {

    width: '48%',

    marginBottom: 12,

    borderRadius: 20, padding: 16,

    borderWidth: 1, borderColor: '#E2E8F0',

    backgroundColor: '#FFFFFF',

    justifyContent: 'center',

  },

  statValue: { fontSize: 24, fontFamily: 'Inter-Black', color: '#0F172A', letterSpacing: -0.5, marginBottom: 2 },

  statLabel: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B', letterSpacing: 0.5 },



  // Search

  searchWrap: {

    flexDirection: 'row', alignItems: 'center',

    marginHorizontal: 16, marginBottom: 12,

    backgroundColor: '#fff', borderRadius: 14,

    borderWidth: 1, borderColor: '#E2E8F0',

  },

  searchInput: { flex: 1, paddingVertical: 11, paddingHorizontal: 10, fontSize: 14, color: '#0F172A', fontFamily: 'Inter-Medium' },



  // Dashboard additions

  dashboardTab: { paddingBottom: 20 },

  dashGrid: { paddingHorizontal: 16, gap: 12 },

  mrrCard: { alignItems: 'center', paddingVertical: 30 },

  mrrIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },

  mrrLabel: { fontSize: 13, color: '#64748B', fontFamily: 'Inter-Bold', marginBottom: 4 },

  mrrValue: { fontSize: 36, color: '#0F172A', fontFamily: 'Inter-Black', letterSpacing: -1 },

  mrrSub: { fontSize: 12, color: '#94A3B8', fontFamily: 'Inter-Medium', marginTop: 4 },

  sectionTitle: { fontSize: 18, color: '#0F172A', fontFamily: 'Inter-Black', marginBottom: 12, letterSpacing: -0.5 },

  chartCard: { paddingTop: 24, paddingBottom: 16 },

  chartContainer: { flexDirection: 'row', justifyContent: 'space-between', height: 160, alignItems: 'flex-end', marginTop: 10 },

  chartCol: { alignItems: 'center', flex: 1 },

  chartColValue: { fontSize: 10, color: '#64748B', fontFamily: 'Inter-Bold', marginBottom: 4, height: 14 },

  chartBarBg: { width: 30, height: 100, backgroundColor: '#F1F5F9', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },

  chartBarFill: { backgroundColor: '#3B82F6', width: '100%', borderRadius: 6 },

  chartColLabel: { fontSize: 10, color: '#94A3B8', fontFamily: 'Inter-SemiBold', marginTop: 8 },

  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },

  activityIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },

  activityTitle: { fontSize: 14, color: '#0F172A', fontFamily: 'Inter-SemiBold' },

  activityTime: { fontSize: 11, color: '#94A3B8', fontFamily: 'Inter-Medium', marginTop: 2 },



  // Filter tabs

  filterRow: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },

  filterTab: {

    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,

    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',

  },

  filterTabActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },

  filterTabText: { fontSize: 13, color: '#64748B', fontFamily: 'Inter-Bold' },

  filterTabTextActive: { color: '#2563EB', fontFamily: 'Inter-Black' },



  errorBox: { margin: 16, padding: 14, backgroundColor: '#FEF2F2', borderRadius: 12, borderWidth: 1, borderColor: '#FECACA' },

  errorText: { color: '#DC2626', fontSize: 13, textAlign: 'center' , fontFamily: 'Inter-Bold' },



  list: { padding: 16, gap: 12, paddingBottom: 40 },



  emptyWrap: {

    alignItems: 'center', padding: 40, gap: 8, margin: 4,

    borderRadius: 28, borderWidth: 1, borderColor: '#E2E8F0',

    backgroundColor: 'rgba(255,255,255,0.85)',

  },

  emptyText: { color: '#94A3B8', fontSize: 14, fontFamily: 'Inter-SemiBold' },



  // Card — bento style, zero shadow

  card: {

    backgroundColor: '#FFFFFF',

    borderRadius: 28,

    padding: 22,

    borderWidth: 1,

    borderColor: '#E2E8F0',

    shadowColor: 'transparent',

    shadowOpacity: 0,

    shadowRadius: 0,

    elevation: 0,

  },

  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },

  orgAvatar: {

    width: 44, height: 44, borderRadius: 14,

    alignItems: 'center', justifyContent: 'center', marginRight: 12,

  },

  orgAvatarText: { fontSize: 16, fontFamily: 'Inter-Black' },

  orgInfo: { flex: 1, marginRight: 8 },

  orgName: { fontSize: 15, color: '#0F172A' , fontFamily: 'Inter-Black' },

  orgOwner: { fontSize: 11, color: '#94A3B8', marginTop: 1 , fontFamily: 'Inter-Medium' },

  planBadge: {

    flexDirection: 'row', alignItems: 'center', gap: 4,

    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,

  },

  planBadgeIcon: { fontSize: 11 },

  planBadgeText: { fontSize: 11, fontFamily: 'Inter-Black' },



  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },

  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },

  statusChipText: { fontSize: 10, letterSpacing: 0.3 , fontFamily: 'Inter-Bold' },

  metaStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  metaStatText: { fontSize: 11, color: '#94A3B8', fontFamily: 'Inter-SemiBold' },

  joinedText: { fontSize: 10, color: '#CBD5E1', marginLeft: 'auto' , fontFamily: 'Inter-SemiBold' },



  trialBanner: {

    flexDirection: 'row', alignItems: 'center', gap: 6,

    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA',

    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10,

  },

  trialBannerUrgent: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },

  trialBannerText: { fontSize: 12, color: '#C2410C' , fontFamily: 'Inter-Bold' },



  manageBtn: {

    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',

    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, gap: 6,

    backgroundColor: '#2563EB',

  },

  manageBtnText: { color: '#FFF', fontSize: 13, fontFamily: 'Inter-Bold' },



  // Modal

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },

  modalSheet: {

    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,

    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '85%',

  },

  modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },

  modalTitle: { fontSize: 18, color: '#0F172A' , fontFamily: 'Inter-Black' },

  modalSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 , fontFamily: 'Inter-Medium' },

  modalClose: {

    width: 32, height: 32, borderRadius: 10,

    backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',

  },



  selectorLabel: { fontSize: 11, color: '#64748B', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 , fontFamily: 'Inter-Bold' },

  selectorLabelHint: { fontSize: 10, color: '#CBD5E1', letterSpacing: 0, textTransform: 'none' , fontFamily: 'Inter-Medium' },

  selectorRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },

  selectorChip: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', gap: 4 },

  chipIcon: { fontSize: 16 },

  selectorChipText: { fontSize: 12, fontFamily: 'Inter-Black' },



  overrideRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },

  overrideField: { flex: 1 },

  overrideLabel: { fontSize: 11, color: '#64748B', marginBottom: 6 , fontFamily: 'Inter-Bold' },

  overrideInput: {

    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',

    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,

    fontSize: 14, color: '#0F172A',  fontFamily: 'Inter-SemiBold',

  },



  saveErrorBox: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },

  saveErrorText: { color: '#DC2626', fontSize: 12, textAlign: 'center' , fontFamily: 'Inter-Bold' },



  saveBtn: {

    backgroundColor: '#2563EB', borderRadius: 14,

    paddingVertical: 16, alignItems: 'center', marginTop: 4, marginBottom: 8,

  },

  saveBtnText: { color: '#fff', fontSize: 15, letterSpacing: 0.5 , fontFamily: 'Inter-Black' },



  // Tabs

  tabRow: {

    flexDirection: 'row',

  },

  tabBtn: {

    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',

    paddingHorizontal: 16, paddingVertical: 14, gap: 6, borderBottomWidth: 3, borderBottomColor: 'transparent',

  },

  tabBtnActive: { borderBottomColor: '#FFF' },

  tabBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter-SemiBold' },

  tabBtnTextActive: { color: '#FFF' },

  tabBadge: {

    backgroundColor: '#2563EB', borderRadius: 10,

    paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center',

  },

  tabBadgeText: { color: '#fff', fontSize: 10, fontFamily: 'Inter-Black' },



  // Plan request cards

  reqPlanRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },

  reqPlanChip: {

    flexDirection: 'row', alignItems: 'center', gap: 4,

    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1,

  },

  reqPlanText: { fontSize: 11, fontFamily: 'Inter-Black' },

  reqNote: { fontSize: 12, color: '#64748B', fontStyle: 'italic', marginBottom: 6 , fontFamily: 'Inter-Medium' },

  reqReviewedBy: { fontSize: 11, color: '#94A3B8', marginBottom: 6 , fontFamily: 'Inter-SemiBold' },

  // Approve / Reject — compact icon buttons matching user-side deleteBtn / updateLink

  reqActions: { flexDirection: 'row', gap: 8, marginTop: 4, justifyContent: 'flex-end' },

  approveBtn: {

    width: 32, height: 32, borderRadius: 10,

    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',

    alignItems: 'center', justifyContent: 'center',

  },

  rejectBtn: {

    width: 32, height: 32, borderRadius: 10,

    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',

    alignItems: 'center', justifyContent: 'center',

  },

});
//hello
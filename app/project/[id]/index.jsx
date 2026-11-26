import { tr } from '../../utils/i18n/tr';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Animated, RefreshControl, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { hasProjectPermission, hasAnyProjectPermissionPrefix } from '../../utils/permissions';
import ProjectDashboardTab from './dashboard';
import ProjectPlansTab from './plans';
import ProjectDetailsTab from './details';
import ProjectDocumentsTab from './documents';
import ProjectBOQTab from './boq';
import ProjectMilestonesTab from './milestones';
import ProjectAuditTab from './audit';
import ProjectSurveyTab from './survey';
import ProjectMaterialTab from './material';
import ProjectTransactionsTab from './transactions';
import ProjectRiskTab from './risk';
import ProjectIssuesTab from './issues';
import ProjectHandoverTab from './handover';
import ProjectProgressTab from './progress';
import ProjectChatTab from './chat';
import ProjectRoomsTab from './rooms';
import ProjectFFETab from './ffe';
// Attendance tab hidden for now — no other module depends on it
// import ProjectAttendanceTab from './attendance';
import ProjectReportsTab from './reports';
import SkeletonList from '../../components/common/SkeletonList';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const SimpleBackground = () => <View style={styles.bgBase} />;

// Section groups — same structure as the web project header (Overview / Planning / Execution /
// Finance / Closeout). Replaces the long sideways-scrolling strip of pill tabs.
const SECTION_GROUPS = [
  { label: 'Overview', tabs: ['Details'] },
  { label: 'Planning', tabs: ['Survey', 'Drawings', 'Documents', 'BOQ', 'Rooms', 'FFE'] },
  { label: 'Execution', tabs: ['Milestone', 'Material', 'Snags', 'Risk'] },
  { label: 'Finance', tabs: ['Transactions', 'Reports'] },
  { label: 'Closeout', tabs: ['Handover', 'Audit'] },
];
const SECTION_ICONS = {
  Details: 'information-circle-outline', Survey: 'clipboard-outline', Drawings: 'map-outline', Documents: 'documents-outline',
  BOQ: 'document-text-outline', Rooms: 'grid-outline', FFE: 'bed-outline', Milestone: 'calendar-outline', Material: 'cube-outline',
  Snags: 'alert-circle-outline', Risk: 'shield-outline', Transactions: 'card-outline', Reports: 'trending-up-outline',
  Handover: 'checkmark-done-outline', Audit: 'time-outline', Chat: 'chatbubbles-outline',
};

export default function FullWorkspacePreview() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, initialTab } = useLocalSearchParams();
  const { token, user } = useAuth();
  const { joinProject, leaveProject } = useSocket();
  const { t } = useTranslation();
  const isAdmin = user?.role?.name === 'Admin';
  const currentUserId = user?.id;

  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // API refused the project (403) — the user's role lacks Project Management > View
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab ? initialTab : 'Details');
  const [sectionSheet, setSectionSheet] = useState(false);
  const [visibleTab, setVisibleTab] = useState(initialTab ? initialTab : 'Details');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const bubbleX = useRef(new Animated.Value(0)).current;
  const bubbleWidth = useRef(new Animated.Value(0)).current;
  const tabLayouts = useRef({}).current;
  const [layoutReady, setLayoutReady] = useState(false);
  const scrollRef = useRef(null);
  const tabScrollRef = useRef(null);
  const scrollContainerWidth = useRef(0);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const isInterior = project?.projectType === 'Interior';

  const isSurveyPending = !isInterior && (project?.status === 'Site Survey' || (project?.status === 'Initialized' && project?.needSiteSurvey)) && project?.surveyStatus !== 'Approved';
  const restrictedTabs = ['Drawings', 'Rooms', 'FFE', 'BOQ', 'Milestone', 'Audit', 'Material', 'Transactions', 'Risk', 'Snags', 'Handover', 'Attendance', 'Reports'];
  const isRestrictedTab = isSurveyPending && restrictedTabs.includes(visibleTab);
  const TABS = (() => {
    let base = (project?.siteSurveyor || project?.needSiteSurvey || project?.surveyStatus)
      // 'Attendance' (after 'Material') hidden for now
      ? ['Details', 'Survey', 'Drawings', 'Documents', 'BOQ', 'Milestone', 'Material', 'Snags', 'Risk', 'Transactions', 'Reports', 'Audit', 'Handover']
      : ['Details', 'Drawings', 'Documents', 'BOQ', 'Milestone', 'Material', 'Snags', 'Risk', 'Transactions', 'Reports', 'Audit', 'Handover'];
    if (isInterior) {
      const insertIndex = base.indexOf('Milestone') + 1;
      base.splice(insertIndex, 0, 'Rooms', 'FFE');
    }
    // Only gate tabs that have an established view-permission module —
    // matches the same scope/keys already used inside each screen's own
    // canView check (documents.jsx, risk.jsx), or the equivalent web fix
    // (reports.jsx, handover.jsx).
    base = base.filter(tab => {
      if (tab === 'Survey') {
        const surveyorId = String(project?.siteSurveyor?._id || project?.siteSurveyor || '');
        const userIds = [user?.id, user?._id].filter(Boolean).map(String);
        const isSurveyor = Boolean(surveyorId && userIds.includes(surveyorId));
        return isAdmin || isSurveyor || hasAnyProjectPermissionPrefix(user, project, 'sitesurvey:');
      }
      if (tab === 'Documents') return isAdmin || hasAnyProjectPermissionPrefix(user, project, 'land:');
      if (tab === 'Risk') return isAdmin || hasAnyProjectPermissionPrefix(user, project, 'risks:');
      if (tab === 'Reports') return isAdmin || hasProjectPermission(user, project, 'reports:view');
      if (tab === 'Handover') return isAdmin || hasProjectPermission(user, project, 'handover:view');
      return true;
    });
    return base;
  })();

  const fetchProjectData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!isMounted.current) return;
      if (response.status === 403) {
        setAccessDenied(true);
        setProject(null);
        return;
      }
      if (response.ok) {
        setAccessDenied(false);
        setProject(data);
      }
    } catch (e) { console.error(e); }
    finally { if (isMounted.current) setIsLoading(false); }
  }, [id, token]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchProjectData();
    setRefreshTrigger(prev => prev + 1);
    setIsRefreshing(false);
  }, [fetchProjectData]);

  // Governs whether the user can create/edit annotation pins — must check
  // create/update permission, not view (a prior version pinged the GET
  // .../annotations endpoint and used its success as a stand-in, which
  // actually only reflects 'annotations:view' and so incorrectly blocked
  // users who had create/update granted without view, or vice versa).
  const canAnnotate = isAdmin || hasProjectPermission(user, project, 'annotations:create') || hasProjectPermission(user, project, 'annotations:update');

  useEffect(() => { fetchProjectData(); }, [fetchProjectData]);

  useEffect(() => {
    if (!id) return;
    joinProject(id);
    return () => leaveProject(id);
  }, [id, joinProject, leaveProject]);

  const animateBubble = useCallback((tabName) => {
    const layout = tabLayouts[tabName];
    if (layout) {
      Animated.spring(bubbleX, { toValue: layout.x, useNativeDriver: false, bounciness: 4 }).start();
      Animated.spring(bubbleWidth, { toValue: layout.width, useNativeDriver: false, bounciness: 4 }).start();

      if (tabScrollRef.current && scrollContainerWidth.current > 0) {
        const scrollX = layout.x + (layout.width / 2) - (scrollContainerWidth.current / 2);
        tabScrollRef.current.scrollTo({ x: Math.max(0, scrollX), animated: true });
      }
    }
  }, [tabLayouts, bubbleX, bubbleWidth]);

  const tabsSignature = TABS.join('|');
  const prevTabsSignatureRef = useRef(tabsSignature);
  if (prevTabsSignatureRef.current !== tabsSignature) {
    prevTabsSignatureRef.current = tabsSignature;
    Object.keys(tabLayouts).forEach(key => delete tabLayouts[key]);
    if (layoutReady) setLayoutReady(false);
  }

  useEffect(() => {
    if (layoutReady) animateBubble(activeTab);
  }, [activeTab, layoutReady, animateBubble]);

  const handleTabPress = useCallback((tab) => {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      setVisibleTab(tab);
    });
  }, []);

  const onTabLayout = (tab, e) => {
    tabLayouts[tab] = e.nativeEvent.layout;
    if (TABS.every(t => tabLayouts[t])) setLayoutReady(true);
  };

  if (accessDenied) {
    return (
      <View style={styles.outerContainer}>
        <StatusBar barStyle="dark-content" />
        <SimpleBackground />
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.hBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <Ionicons name="lock-closed-outline" size={64} color="#CBD5E1" />
            <Text style={{ marginTop: 16, fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A', textAlign: 'center' }}>
              {t('accessDenied', 'Access denied')}
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', lineHeight: 22 }}>
              {t('noProjectViewPermission', "You don't have permission to view this project.")}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      <Modal visible={sectionSheet} transparent animationType="slide" onRequestClose={() => setSectionSheet(false)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setSectionSheet(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {SECTION_GROUPS.map((group) => {
                const tabs = group.tabs.filter((tb) => TABS.includes(tb));
                if (tabs.length === 0) return null;
                return (
                  <View key={group.label} style={{ marginBottom: 10 }}>
                    <Text style={styles.sheetGroup}>{t(group.label)}</Text>
                    {tabs.map((tb) => {
                      const on = activeTab === tb;
                      const locked = isSurveyPending && restrictedTabs.includes(tb);
                      return (
                        <TouchableOpacity
                          key={tb}
                          style={[styles.sheetRow, on && styles.sheetRowOn]}
                          onPress={() => { setSectionSheet(false); handleTabPress(tb); }}
                        >
                          <Ionicons name={SECTION_ICONS[tb] || 'ellipse-outline'} size={18} color={on ? '#2563EB' : '#64748B'} />
                          <Text style={[styles.sheetRowText, on && { color: '#1D4ED8', fontFamily: 'Inter-Bold' }]}>{t(tb)}</Text>
                          {locked && <Ionicons name="lock-closed-outline" size={15} color="#94A3B8" />}
                          {on && <Ionicons name="checkmark" size={18} color="#2563EB" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <StatusBar barStyle="dark-content" />
      <SimpleBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.hBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.hText}>
            <Text style={styles.hTitle} numberOfLines={2}>{tr(project?.name)}</Text>
          </View>
          <View style={styles.hBtnSpacer} />
        </View>

        {activeTab !== 'Chat' && (
          <View style={styles.tabPillWrapper}>
            {isLoading ? (
              <View style={[styles.pillBox, styles.pillSkeleton]}>
                {[70, 90, 80, 100].map((w, i) => (
                  <View key={i} style={[styles.tabSkeletonPill, { width: w }]} />
                ))}
              </View>
            ) : (
              <TouchableOpacity style={styles.sectionBtn} onPress={() => setSectionSheet(true)} activeOpacity={0.85}>
                <View style={styles.sectionIcon}>
                  <Ionicons name={SECTION_ICONS[activeTab] || 'apps-outline'} size={18} color="#2563EB" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.sectionGroup} numberOfLines={1}>
                    {t((SECTION_GROUPS.find((g) => g.tabs.includes(activeTab)) || { label: 'Section' }).label)}
                  </Text>
                  <Text style={styles.sectionLabel} numberOfLines={1}>{t(activeTab)}</Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {isLoading ? (
          <SkeletonList />
        ) : isRestrictedTab ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <Ionicons name="lock-closed-outline" size={64} color="#CBD5E1" />
            <Text style={{ marginTop: 16, fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A', textAlign: 'center' }}>
              {t('sectionLocked', 'Section Locked')}
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', lineHeight: 22 }}>
              {t('completeSiteSurveyToUnlock', 'Please complete and approve the Site Survey to unlock this section.')}
            </Text>
            {TABS.includes('Survey') && (
               <TouchableOpacity
                 style={{ marginTop: 24, backgroundColor: '#3B82F6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                 onPress={() => handleTabPress('Survey')}
               >
                 <Text style={{ color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 14 }}>{t('goToSurvey', 'Go to Survey')}</Text>
                 <Ionicons name="arrow-forward" size={16} color="#FFF" />
               </TouchableOpacity>
            )}
          </View>
        ) : visibleTab === 'Drawings' ? (
          <ProjectPlansTab projectId={id} project={project} isAdmin={isAdmin} currentUserId={currentUserId} insetsBottom={insets.bottom} canAnnotate={canAnnotate} />
        ) : visibleTab === 'Rooms' ? (
          <ProjectRoomsTab projectId={id} project={project} onSwitchToFFE={() => handleTabPress('FFE')} />
        ) : visibleTab === 'FFE' ? (
          <ProjectFFETab projectId={id} project={project} />
        ) : visibleTab === 'Chat' ? (
          <ProjectChatTab
            modules={TABS.filter(tab => tab !== 'Chat')}
            onNavigateToModule={(tab) => handleTabPress(tab)}
          />
        ) : visibleTab === 'BOQ' ? (
          <ProjectBOQTab project={project} fetchProjectData={fetchProjectData} />
        ) : visibleTab === 'Milestone' ? (
          <ProjectMilestonesTab project={project} />
        )  : visibleTab === 'Audit' ? (
          <ProjectAuditTab project={project} />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.contentScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#3B82F6" colors={["#3B82F6"]} />}
          >
            <>
              {visibleTab === 'Details' && <ProjectDetailsTab project={project} fetchProjectData={fetchProjectData} />}
              {/* {visibleTab === 'Attendance' && <ProjectAttendanceTab project={project} />} */}
              {visibleTab === 'Reports' && <ProjectReportsTab />}
              {visibleTab === 'Survey' && <ProjectSurveyTab project={project} fetchProjectData={fetchProjectData} />}
              {visibleTab === 'Documents' && <ProjectDocumentsTab project={project} fetchProjectData={fetchProjectData} />}
              {visibleTab === 'Material' && <ProjectMaterialTab project={project} fetchProjectData={fetchProjectData} />}
              {visibleTab === 'Transactions' && <ProjectTransactionsTab project={project} fetchProjectData={fetchProjectData} />}
              {visibleTab === 'Risk' && <ProjectRiskTab project={project} />}
              {visibleTab === 'Snags' && <ProjectIssuesTab project={project} />}
              {visibleTab === 'Handover' && <ProjectHandoverTab project={project} onOpenTab={handleTabPress} />}
            </>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  sectionIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  sectionGroup: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionLabel: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 1 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 12 },
  sheetGroup: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 4, paddingHorizontal: 4 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12 },
  sheetRowOn: { backgroundColor: '#EFF6FF' },
  sheetRowText: { flex: 1, fontSize: 14.5, fontFamily: 'Inter-Medium', color: '#0F172A' },
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 16 },
  hBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  hBtnSpacer: { width: 44, height: 44 },
  hText: { flex: 1 },
  hTitle: { fontSize: 19, fontFamily: 'Inter-Black', color: '#0F172A', lineHeight: 26 },
  tabPillWrapper: { paddingHorizontal: 20, marginBottom: 12 },
  pillBox: { height: 52, borderRadius: 26, paddingHorizontal: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255, 255, 255, 0.4)', overflow: 'hidden' },
  pillSkeleton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255, 255, 255, 0.6)' },
  tabSkeletonPill: { height: 24, borderRadius: 12, backgroundColor: '#E2E8F0' },
  tabScroll: { height: '100%', alignItems: 'center' },
  bubble: { position: 'absolute', height: 42, backgroundColor: '#3B82F6', borderRadius: 21, top: 4, zIndex: -1 },
  tabBtn: { paddingHorizontal: 20, height: '100%', justifyContent: 'center' },
  tabLabel: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#64748B' },
  tabLabelActive: { color: '#FFF' },
  contentScroll: { flex: 1, paddingHorizontal: 20 },
});

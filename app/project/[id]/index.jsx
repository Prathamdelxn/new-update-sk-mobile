import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Animated, RefreshControl } from 'react-native';
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
import ProjectAttendanceTab from './attendance';
import ProjectReportsTab from './reports';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const SimpleBackground = () => <View style={styles.bgBase} />;

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
  const [activeTab, setActiveTab] = useState(initialTab ? initialTab : 'Details');
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

  const isSurveyPending = project?.needSiteSurvey || (project?.status === 'Site Survey' && project?.surveyStatus !== 'Approved');
  const restrictedTabs = ['Drawings', 'Rooms', 'FFE', 'BOQ', 'Milestone', 'Audit', 'Material', 'Transactions', 'Risk', 'Snags', 'Handover', 'Attendance', 'Reports'];
  const isRestrictedTab = isSurveyPending && restrictedTabs.includes(visibleTab);
  const TABS = (() => {
    let base = project?.siteSurveyor
      ? ['Details', 'Survey', 'Drawings', 'Documents', 'BOQ', 'Milestone', 'Material', 'Attendance', 'Snags', 'Risk', 'Transactions', 'Reports', 'Audit', 'Handover']
      : ['Details', 'Drawings', 'Documents', 'BOQ', 'Milestone', 'Material', 'Attendance', 'Snags', 'Risk', 'Transactions', 'Reports', 'Audit', 'Handover'];
    if (isInterior) {
      const insertIndex = base.indexOf('Milestone') + 1;
      base.splice(insertIndex, 0, 'Rooms', 'FFE');
    }
    // Only gate tabs that have an established view-permission module —
    // matches the same scope/keys already used inside each screen's own
    // canView check (documents.jsx, risk.jsx), or the equivalent web fix
    // (reports.jsx, handover.jsx).
    base = base.filter(tab => {
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
      if (response.ok && isMounted.current) setProject(data);
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

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="dark-content" />
      <SimpleBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.hBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.hText}>
            <Text style={styles.hTitle} numberOfLines={2}>{project?.name}</Text>
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
              <AdaptiveGlass intensity={40} tint="light" style={styles.pillBox}>
                <ScrollView
                  ref={tabScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tabScroll}
                  keyboardShouldPersistTaps="handled"
                  removeClippedSubviews={false}
                  onLayout={(e) => { scrollContainerWidth.current = e.nativeEvent.layout.width; }}
                >
                  <Animated.View pointerEvents="none" style={[styles.bubble, { width: bubbleWidth, transform: [{ translateX: bubbleX }] }]} />
                  {TABS.map(tab => (
                    <TouchableOpacity key={tab} onLayout={(e) => onTabLayout(tab, e)} onPress={() => handleTabPress(tab)} style={styles.tabBtn} activeOpacity={0.9}>
                      <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{t(tab)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </AdaptiveGlass>
            )}
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 100 }} size="large" color="#3B82F6" />
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
            contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#3B82F6" colors={["#3B82F6"]} />}
          >
            <>
              {visibleTab === 'Details' && <ProjectDetailsTab project={project} fetchProjectData={fetchProjectData} />}
              {visibleTab === 'Attendance' && <ProjectAttendanceTab project={project} />}
              {visibleTab === 'Reports' && <ProjectReportsTab />}
              {visibleTab === 'Survey' && <ProjectSurveyTab project={project} fetchProjectData={fetchProjectData} />}
              {visibleTab === 'Documents' && <ProjectDocumentsTab project={project} fetchProjectData={fetchProjectData} />}
              {visibleTab === 'Material' && <ProjectMaterialTab project={project} fetchProjectData={fetchProjectData} />}
              {visibleTab === 'Transactions' && <ProjectTransactionsTab project={project} fetchProjectData={fetchProjectData} />}
              {visibleTab === 'Risk' && <ProjectRiskTab project={project} />}
              {visibleTab === 'Snags' && <ProjectIssuesTab project={project} />}
              {visibleTab === 'Handover' && <ProjectHandoverTab project={project} />}
            </>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
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

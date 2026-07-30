import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Dimensions, Modal, TextInput,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import HeaderNotification from '../../components/HeaderNotification';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';

Dimensions.get('window');
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// ─── Plan metadata ─────────────────────────────────────────────────────────
const PLAN_META = {
  Silver: {
    label: 'Silver',
    gradient: ['#94A3B8', '#64748B'],
    iconName: 'star',
    accentColor: '#64748B',
    lightBg: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  Gold: {
    label: 'Gold',
    gradient: ['#F59E0B', '#D97706'],
    iconName: 'trophy',
    accentColor: '#D97706',
    lightBg: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  Platinum: {
    label: 'Platinum',
    gradient: ['#3B82F6', '#1D4ED8'],
    iconName: 'diamond',
    accentColor: '#2563EB',
    lightBg: '#EFF6FF',
    borderColor: '#93C5FD',
  },
};

const PLAN_FEATURES = {
  Silver: [
    { label: 'Up to 10 projects',              included: true },
    { label: 'Up to 10 team members',          included: true },
    { label: 'Milestones & Tasks',             included: true },
    { label: 'Materials tracking',             included: true },
    { label: 'Issues & Risks',                 included: true },
    { label: 'Custom roles',                   included: true },
    { label: 'BOQ Import (XLS/XER)',           included: false },
    { label: 'Interior project type',          included: false },
    { label: 'Export reports',                 included: false },
    { label: 'Arabic / RTL interface',         included: false },
  ],
  Gold: [
    { label: 'Up to 50 projects',              included: true },
    { label: 'Up to 100 team members',         included: true },
    { label: 'Milestones & Tasks',             included: true },
    { label: 'Materials tracking',             included: true },
    { label: 'Issues & Risks',                 included: true },
    { label: 'BOQ Import (XLS/XER)',           included: true },
    { label: 'Interior project type',          included: true },
    { label: 'Custom roles',                   included: true },
    { label: 'Export reports',                 included: true },
    { label: 'Arabic / RTL interface',         included: false },
  ],
  Platinum: [
    { label: 'Unlimited projects',             included: true },
    { label: 'Unlimited team members',         included: true },
    { label: 'Milestones & Tasks',             included: true },
    { label: 'Materials tracking',             included: true },
    { label: 'Issues & Risks',                 included: true },
    { label: 'BOQ Import (XLS/XER)',           included: true },
    { label: 'Interior project type',          included: true },
    { label: 'Custom roles',                   included: true },
    { label: 'Export reports',                 included: true },
    { label: 'Arabic / RTL interface',         included: true },
  ],
};

// ─── Status badge ──────────────────────────────────────────────────────────
const STATUS_STYLES = {
  Active:    { bg: '#DCFCE7', text: '#15803D', dot: '#22C55E' },
  Trial:     { bg: '#F3E8FF', text: '#7E22CE', dot: '#A855F7' },
  Suspended: { bg: '#FEE2E2', text: '#B91C1C', dot: '#EF4444' },
  Expired:   { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Active;
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: s.dot }]} />
      <Text style={[styles.statusText, { color: s.text }]}>{status}</Text>
    </View>
  );
};

// ─── Usage bar ────────────────────────────────────────────────────────────
const UsageBar = ({ label, used, max, accentColor }) => {
  const isUnlimited = max === null;
  const pct = isUnlimited ? 20 : Math.min(100, Math.round((used / max) * 100));
  const isOver = !isUnlimited && used > max;
  const barColor = isOver ? '#EF4444' : pct >= 80 ? '#F59E0B' : accentColor;

  return (
    <View style={styles.usageBarWrap}>
      <View style={styles.usageBarHeader}>
        <Text style={styles.usageBarLabel}>{label}</Text>
        <Text style={[styles.usageBarCount, isOver && { color: '#EF4444', fontFamily: 'Inter-Black' }]}>
          {used} / {isUnlimited ? '∞' : max}
        </Text>
      </View>
      <View style={styles.usageTrack}>
        <View style={[styles.usageFill, { width: `${isUnlimited ? 20 : pct}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
};

// ─── Feature row ─────────────────────────────────────────────────────────
const FeatureRow = ({ label, included }) => (
  <View style={styles.featureRow}>
    <View style={[styles.featureIcon, { backgroundColor: included ? '#DCFCE7' : '#F1F5F9' }]}>
      <Ionicons
        name={included ? 'checkmark' : 'close'}
        size={14}
        color={included ? '#16A34A' : '#94A3B8'}
      />
    </View>
    <Text style={[styles.featureLabel, !included && styles.featureLabelOff]}>
      {label}
    </Text>
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────
export default function PlanBillingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [subData, setSubData]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [planRequest, setPlanRequest] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [requestNote, setRequestNote]   = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState('');
  const [cancellingReq, setCancellingReq] = useState(false);

  const getToken = () => SecureStore.getItemAsync('userToken');

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [subRes, reqRes] = await Promise.all([
        fetch(`${API_BASE_URL}/organization/subscription`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/organization/plan-request`,  { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const subJson = await subRes.json();
      if (!subRes.ok) throw new Error(subJson.message || 'Failed to load subscription');
      setSubData(subJson);
      const reqJson = reqRes.ok ? await reqRes.json() : null;
      setPlanRequest(reqJson);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  const openRequestModal = (plan) => {
    setSelectedPlan(plan);
    setRequestNote('');
    setSubmitError('');
    setModalVisible(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/organization/plan-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestedPlan: selectedPlan, note: requestNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit request');
      setModalVisible(false);
      fetchSubscription();
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    setCancellingReq(true);
    try {
      const token = await getToken();
      await fetch(`${API_BASE_URL}/organization/plan-request`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSubscription();
    } catch { } finally {
      setCancellingReq(false);
    }
  };

  // ── Derived values ───────────────────────────────────────────────────────
  const sub     = subData?.subscription;
  const usage   = subData?.usage || {};
  const plan    = sub?.plan    || 'Silver';
  const status  = sub?.status  || 'Trial';
  const limits  = sub?.limits  || {};
  const meta    = PLAN_META[plan] || PLAN_META.Silver;
  const features = PLAN_FEATURES[plan] || PLAN_FEATURES.Silver;

  const trialEnd      = sub?.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  const isTrialExpired = subData?.isTrialExpired;
  const daysLeft      = trialEnd
    ? Math.max(0, Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.bg} />

      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color="#0F172A" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t('planAndBilling')}</Text>
            </View>
            <View style={styles.bellScale}>
              <HeaderNotification />
            </View>
          </View>

          {/* ── Loading ── */}
          {loading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>{t('loadingYourPlan')}</Text>
            </View>
          )}

          {/* ── Error ── */}
          {!loading && error && (
            <AdaptiveGlass intensity={20} tint="light" style={styles.errorCard}>
              <Ionicons name="alert-circle" size={32} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchSubscription} activeOpacity={0.8}>
                <Text style={styles.retryText}>{t('retry')}</Text>
              </TouchableOpacity>
            </AdaptiveGlass>
          )}

          {/* ── Content ── */}
          {!loading && !error && (
            <>
              {/* Alert banners */}
              {status === 'Suspended' && (
                <View style={[styles.alertBanner, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                  <Ionicons name="ban" size={18} color="#B91C1C" />
                  <Text style={[styles.alertText, { color: '#B91C1C' }]}>
                    {t('accountSuspended')}
                  </Text>
                </View>
              )}
              {isTrialExpired && (
                <View style={[styles.alertBanner, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                  <Ionicons name="time" size={18} color="#B45309" />
                  <Text style={[styles.alertText, { color: '#B45309' }]}>
                    {t('freeTrialExpired')}
                  </Text>
                </View>
              )}
              {status === 'Trial' && !isTrialExpired && daysLeft !== null && daysLeft <= 5 && (
                <View style={[styles.alertBanner, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                  <Ionicons name="alert-circle" size={18} color="#C2410C" />
                  <Text style={[styles.alertText, { color: '#C2410C' }]}>
                    {t('trialExpiresInDays', { days: daysLeft })}
                  </Text>
                </View>
              )}

              {/* Plan card */}
              <LinearGradient colors={meta.gradient} style={styles.planCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.planCardTop}>
                  <View>
                    <Text style={styles.planCardLabel}>{t('currentPlanLabel')}</Text>
                    <Text style={styles.planCardName}>{plan}</Text>
                  </View>
                  <View style={styles.planCardIconWrap}>
                    <Ionicons name={meta.iconName} size={32} color="rgba(255,255,255,0.9)" />
                  </View>
                </View>

                <View style={styles.planCardBottom}>
                  <StatusBadge status={status} />
                  {status === 'Trial' && trialEnd && (
                    <Text style={styles.planCardMeta}>
                      {isTrialExpired
                        ? t('trialExpiredLabel')
                        : t('trialEndsDate', { date: trialEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })}
                    </Text>
                  )}
                  {sub?.renewalDate && status === 'Active' && (
                    <Text style={styles.planCardMeta}>
                      {t('renewsDate', { date: new Date(sub.renewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })}
                    </Text>
                  )}
                </View>
              </LinearGradient>

              {/* Usage */}
              <AdaptiveGlass intensity={20} tint="light" style={styles.section}>
                <Text style={styles.sectionTitle}>{t('usageLabel')}</Text>
                <UsageBar
                  label={t('projectsLabel')}
                  used={usage.projects ?? 0}
                  max={limits.maxProjects ?? 10}
                  accentColor={meta.accentColor}
                />
                <View style={styles.usageDivider} />
                <UsageBar
                  label={t('teamMembersLabel')}
                  used={usage.users ?? 0}
                  max={limits.maxUsers ?? 20}
                  accentColor={meta.accentColor}
                />
              </AdaptiveGlass>

              {/* Features */}
              <AdaptiveGlass intensity={20} tint="light" style={styles.section}>
                <Text style={styles.sectionTitle}>{t('whatsIncluded')}</Text>
                {features.map((f) => (
                  <FeatureRow key={f.label} label={f.label} included={f.included} />
                ))}
              </AdaptiveGlass>

              {/* ── Plan request status banner ── */}
              {planRequest && (
                <View style={[
                  styles.reqBanner,
                  planRequest.status === 'Pending'  && { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
                  planRequest.status === 'Approved' && { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
                  planRequest.status === 'Rejected' && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
                ]}>
                  <View style={styles.reqBannerTop}>
                    <Ionicons
                      name={
                        planRequest.status === 'Pending'  ? 'time-outline' :
                        planRequest.status === 'Approved' ? 'checkmark-circle' : 'close-circle'
                      }
                      size={20}
                      color={
                        planRequest.status === 'Pending'  ? '#C2410C' :
                        planRequest.status === 'Approved' ? '#15803D' : '#B91C1C'
                      }
                    />
                    <Text style={[
                      styles.reqBannerTitle,
                      planRequest.status === 'Pending'  && { color: '#C2410C' },
                      planRequest.status === 'Approved' && { color: '#15803D' },
                      planRequest.status === 'Rejected' && { color: '#B91C1C' },
                    ]}>
                      {planRequest.status === 'Pending'  && t('planRequestPendingMsg', { plan: planRequest.requestedPlan })}
                      {planRequest.status === 'Approved' && t('planRequestApprovedMsg', { plan: planRequest.requestedPlan })}
                      {planRequest.status === 'Rejected' && t('planRequestRejectedMsg', { plan: planRequest.requestedPlan })}
                    </Text>
                  </View>
                  {planRequest.reviewNote ? (
                    <Text style={styles.reqBannerNote}>"{planRequest.reviewNote}"</Text>
                  ) : null}
                  {planRequest.status === 'Pending' && (
                    <TouchableOpacity
                      style={styles.reqCancelBtn}
                      onPress={handleCancelRequest}
                      disabled={cancellingReq}
                      activeOpacity={0.8}
                    >
                      {cancellingReq
                        ? <ActivityIndicator size="small" color="#B91C1C" />
                        : <Text style={styles.reqCancelText}>{t('cancelRequest')}</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* ── Choose a Plan ── */}
              <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>{t('choosePlanLabel')}</Text>
              {['Silver', 'Gold', 'Platinum'].map((p) => {
                const m = PLAN_META[p];
                const isCurrent = p === plan;
                const hasPending = planRequest?.status === 'Pending';
                const isThisPending = hasPending && planRequest?.requestedPlan === p;
                const planFeat = PLAN_FEATURES[p];
                return (
                  <View
                    key={p}
                    style={[
                      styles.planChoiceCard,
                      isCurrent && { borderColor: m.borderColor, borderWidth: 2 },
                    ]}
                  >
                    <LinearGradient
                      colors={m.gradient}
                      style={styles.planChoiceHeader}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Ionicons name={m.iconName} size={20} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.planChoiceName}>{p}</Text>
                      </View>
                      {isCurrent && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>{t('currentBadge')}</Text>
                        </View>
                      )}
                      {isThisPending && (
                        <View style={[styles.currentBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                          <Text style={styles.currentBadgeText}>{t('pending')}</Text>
                        </View>
                      )}
                    </LinearGradient>
                    <View style={styles.planChoiceBody}>
                      {planFeat.slice(0, 6).map((f) => (
                        <FeatureRow key={f.label} label={f.label} included={f.included} />
                      ))}
                      {!isCurrent && (
                        <TouchableOpacity
                          style={[
                            styles.requestBtn,
                            { backgroundColor: m.accentColor },
                            hasPending && styles.requestBtnDisabled,
                          ]}
                          onPress={() => openRequestModal(p)}
                          disabled={hasPending}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.requestBtnText}>
                            {isThisPending ? t('requestPendingBtn') : t('requestThisPlan')}
                          </Text>
                          {!isThisPending && (
                            <Ionicons name="arrow-forward" size={15} color="#fff" />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}

              {/* Plan history */}
              {sub?.history?.length > 0 && (
                <AdaptiveGlass intensity={20} tint="light" style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('planHistoryLabel')}</Text>
                  {[...sub.history].reverse().slice(0, 5).map((h, i) => (
                    <View key={i} style={[styles.historyRow, i < Math.min(sub.history.length, 5) - 1 && styles.historyDivider]}>
                      <View style={[styles.historyDot, { backgroundColor: meta.accentColor }]} />
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyTitle}>{h.plan} — {h.status}</Text>
                        {h.reason ? <Text style={styles.historyReason}>{h.reason}</Text> : null}
                        <Text style={styles.historyDate}>
                          {h.timestamp ? new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </AdaptiveGlass>
              )}
            </>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Request Plan Modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('requestPlanTitle', { plan: selectedPlan })}</Text>
            <Text style={styles.modalSubtitle}>{t('requestPlanDesc')}</Text>
            <Text style={styles.modalInputLabel}>{t('noteOptional')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('addNoteForAdmin')}
              placeholderTextColor="#94A3B8"
              value={requestNote}
              onChangeText={setRequestNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            {submitError ? (
              <Text style={styles.submitError}>{submitError}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmitRequest}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.submitBtnText}>{t('submitRequest')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F8FAFF' },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  scroll: { padding: 24, paddingTop: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E0F2FE',
    justifyContent: 'center', alignItems: 'center',
  },
  bellScale: { transform: [{ scale: 0.78 }] },
  preTitle: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter-SemiBold',
    fontFamily: 'Inter-Black',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
    letterSpacing: -0.5,
  },

  loadingWrap: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  loadingText: { fontSize: 14, color: '#94A3B8', fontFamily: 'Inter-SemiBold' },

  errorCard: {
    borderRadius: 24, padding: 32, alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#FEE2E2', backgroundColor: '#FFF5F5',
  },
  errorText: { fontSize: 14, color: '#EF4444', fontFamily: 'Inter-SemiBold', textAlign: 'center' },
  retryBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: '#EF4444', borderRadius: 14,
  },
  retryText: { color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 14 },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  alertText: { flex: 1, fontSize: 13, fontFamily: 'Inter-SemiBold', lineHeight: 20 },

  // Plan card
  planCard: {
    borderRadius: 28,
    padding: 28,
    marginBottom: 20,
    gap: 20,
  },
  planCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planCardLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Black',
    letterSpacing: 2,
    marginBottom: 6,
  },
  planCardName: {
    fontSize: 36,
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
    letterSpacing: -1,
  },
  planCardIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planCardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planCardMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'Inter-SemiBold',
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontFamily: 'Inter-Black', letterSpacing: 0.3 },

  // Sections
  section: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 11,
    color: '#3B82F6',
    fontFamily: 'Inter-Black',
    letterSpacing: 2.5,
    marginBottom: 4,
  },

  // Usage bar
  usageBarWrap: { gap: 8 },
  usageBarHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  usageBarLabel: { fontSize: 14, color: '#0F172A', fontFamily: 'Inter-Bold' },
  usageBarCount: { fontSize: 14, color: '#64748B', fontFamily: 'Inter-SemiBold' },
  usageTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 100,
    overflow: 'hidden',
  },
  usageFill: { height: '100%', borderRadius: 100 },
  usageDivider: { height: 1, backgroundColor: '#F1F5F9' },

  // Feature rows
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  featureIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureLabel: {
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Inter-SemiBold',
    flex: 1,
  },
  featureLabelOff: { color: '#94A3B8', textDecorationLine: 'line-through' },

  // Upgrade card
  upgradeWrap: { marginBottom: 20 },
  upgradeCard: { borderRadius: 28, padding: 28, gap: 14 },
  upgradeIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(245,158,11,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
    letterSpacing: -0.5,
  },
  upgradeDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: 'Inter-SemiBold',
    lineHeight: 22,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  upgradeBtnText: {
    color: '#0F172A',
    fontFamily: 'Inter-Black',
    fontSize: 15,
  },

  // History
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 10 },
  historyDivider: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  historyInfo: { flex: 1, gap: 2 },
  historyTitle: { fontSize: 14, color: '#0F172A', fontFamily: 'Inter-Bold' },
  historyReason: { fontSize: 12, color: '#64748B', fontFamily: 'Inter-SemiBold' },
  historyDate: { fontSize: 11, color: '#94A3B8', fontFamily: 'Inter-SemiBold' },

  // Plan request status banner
  reqBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  reqBannerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reqBannerTitle: { flex: 1, fontSize: 13, fontFamily: 'Inter-Bold', lineHeight: 20 },
  reqBannerNote: { fontSize: 12, color: '#475569', fontFamily: 'Inter-SemiBold', fontStyle: 'italic', paddingLeft: 30 },
  reqCancelBtn: {
    alignSelf: 'flex-start',
    marginLeft: 30,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    minWidth: 120,
    alignItems: 'center',
  },
  reqCancelText: { fontSize: 13, color: '#B91C1C', fontFamily: 'Inter-Bold' },

  // Plan choice cards
  planChoiceCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    overflow: 'hidden',
  },
  planChoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  planChoiceName: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
    letterSpacing: -0.3,
  },
  currentBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  currentBadgeText: { fontSize: 12, color: '#FFFFFF', fontFamily: 'Inter-Bold' },
  planChoiceBody: { padding: 16, gap: 2 },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 10,
  },
  requestBtnDisabled: { opacity: 0.4 },
  requestBtnText: { fontSize: 14, color: '#FFFFFF', fontFamily: 'Inter-Bold' },

  // Request modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
    gap: 12,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 22, color: '#0F172A', fontFamily: 'Inter-Black', letterSpacing: -0.5 },
  modalSubtitle: { fontSize: 13, color: '#64748B', fontFamily: 'Inter-SemiBold', lineHeight: 20, marginBottom: 4 },
  modalInputLabel: { fontSize: 13, color: '#0F172A', fontFamily: 'Inter-Bold' },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Inter-SemiBold',
    minHeight: 90,
    backgroundColor: '#F8FAFC',
  },
  submitError: { fontSize: 13, color: '#EF4444', fontFamily: 'Inter-SemiBold' },
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: { fontSize: 15, color: '#FFFFFF', fontFamily: 'Inter-Black' },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalCancelText: { fontSize: 14, color: '#64748B', fontFamily: 'Inter-SemiBold' },
});

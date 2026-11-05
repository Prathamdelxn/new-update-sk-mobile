// Project Site Details (web: InteriorSiteDetailsView).
// The site profile is the CRM record linked to the project; the backend creates one for every
// project, so there is always something to show. Tabs: Design Requirements (with the client
// intake link), Site Visit & Measurements, Site Photos, View All.
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';
import cloudinaryService from '../../services/cloudinaryService';
import { interiorCrmService } from '../../services/interiorCrmService';
import { useInteriorPermissions } from '../../utils/interior/useInteriorPermissions';
import { WEB_APP_URL } from '../../config';
import CrmShareModal from '../../components/crm/CrmShareModal';
import SendRequirementsEmailModal from '../../components/crm/SendRequirementsEmailModal';
import LogRequirementsModal from '../../components/crm/LogRequirementsModal';
import LogSiteVisitModal from '../../components/crm/LogSiteVisitModal';

const linkedId = (v) => (v && typeof v === 'object' ? String(v._id || '') : String(v || ''));

const asList = (v) => {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Array.isArray(v.rooms) ? v.rooms : [v];
  return [];
};

// Expiry choices of the intake link (web select: 24h / 3d / 7d / 30d / Never)
const EXPIRY_CHOICES = [
  { label: '24h', hours: 24 },
  { label: '3d', hours: 72 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
  { label: 'Never', hours: null },
];
const expiryLabel = (h) =>
  h === null ? 'Never expire' : h === 24 ? '24 hours' : h === 72 ? '3 days' : h === 168 ? '7 days' : h === 720 ? '30 days' : `${h} hours`;

const FUNCTIONAL_ROWS = [
  ['Usage', 'roomUsage'],
  ['Furniture', 'furnitureRequirements'],
  ['Storage', 'storage'],
  ['Electrical', 'electricalPoints', 'flash-outline', '#F59E0B'],
  ['Lighting', 'lightingRequirements', 'sunny-outline', '#F59E0B'],
  ['Plumbing', 'plumbingRequirements', 'water-outline', '#0891B2'],
  ['Circulation', 'circulation'],
];
const AESTHETIC_ROWS = [
  ['Colours', 'colours'],
  ['Materials', 'materials'],
  ['Flooring', 'flooring'],
  ['Ceiling', 'ceiling'],
  ['Walls', 'wallFinishes'],
  ['Furniture Style', 'furnitureStyle'],
];

export default function InteriorSiteDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();
  const { hasPermission: canDo } = useInteriorPermissions();
  // Same as the web: project editors can maintain the site profile too
  const canEditReq = canDo('crm_requirements', 'update') || canDo('projects', 'update') || canDo('projects', 'create');
  const canEditSiteVisit = canDo('crm_site_visits', 'update') || canDo('projects', 'update') || canDo('projects', 'create');
  const canEditPhotos = canDo('photos', 'create') || canDo('photos', 'update') || canDo('crm_site_visits', 'update') || canDo('projects', 'update');

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [projectInfo, setProjectInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('requirements'); // 'requirements' | 'measurements' | 'photos' | 'all'

  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isUpdatingExpiry, setIsUpdatingExpiry] = useState(false);
  const [isStoppingLink, setIsStoppingLink] = useState(false);

  const [showReqModal, setShowReqModal] = useState(false);
  const [showSiteVisitModal, setShowSiteVisitModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Project + its site profile (GET /projects/:id returns linkedCustomer, created on demand by the server),
  // the full CRM record, and project photos merged into the site photos
  const loadSiteDetails = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [projRes, photosRes] = await Promise.allSettled([
        interiorApiClient.get(`/projects/${projectId}`),
        interiorApiClient.get(`/projects/${projectId}/photos`),
      ]);
      const project = projRes.status === 'fulfilled' ? projRes.value?.data : null;
      setProjectInfo(project);

      let found = project?.linkedCustomer || null;
      if (!found) {
        try {
          const res = await interiorApiClient.get('/crm/customers');
          const customers = res?.success && res?.data ? res.data : Array.isArray(res) ? res : [];
          found = customers.find((c) => linkedId(c.linkedProject) === String(projectId)) || null;
        } catch {
          found = null;
        }
      }
      if (found?._id) {
        try {
          const detail = await interiorApiClient.get(`/crm/customers/${found._id}`);
          if (detail?.data) found = { ...found, ...detail.data };
        } catch {
          // keep the summary from the project
        }
      }

      if (found) {
        const raw = photosRes.status === 'fulfilled' ? photosRes.value?.data : [];
        const extra = (Array.isArray(raw) ? raw : []).map((p) => p?.url || p).filter((u) => typeof u === 'string' && u.trim());
        found = { ...found, sitePhotos: Array.from(new Set([...(Array.isArray(found.sitePhotos) ? found.sitePhotos : []), ...extra])) };
      }
      setCustomer(found);
    } catch (e) {
      console.error('Failed to load site details', e);
      showToast('Failed to load site details', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  useFocusEffect(useCallback(() => { loadSiteDetails(); }, [loadSiteDetails]));

  // ── Share link state ──
  const shareSettings = customer?.shareSettings || projectInfo?.linkedCustomer?.shareSettings;
  const isLinkStopped = shareSettings?.isPublic === false;
  const isLinkExpired = Boolean(shareSettings?.expiresAt && new Date(shareSettings.expiresAt).getTime() < Date.now());
  const isLinkActive = Boolean(shareSettings?.shareToken && !isLinkStopped && !isLinkExpired);
  const clientFormUrl = shareSettings?.shareToken && !isLinkStopped && !isLinkExpired
    ? `${WEB_APP_URL}/share/requirements/${shareSettings.shareToken}`
    : '';

  // While waiting for the client, refresh when the app comes back to the foreground
  // (web: focus / visibility / cross-tab sync)
  const waitingRef = useRef(false);
  waitingRef.current = isLinkActive && !customer?.clientRequirementsSubmittedAt;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && waitingRef.current) loadSiteDetails(true);
    });
    return () => sub.remove();
  }, [loadSiteDetails]);

  const currentExpiry = (() => {
    if (isLinkStopped) return { label: 'Link Stopped / Disabled', isWarning: true };
    if (isLinkExpired) return { label: 'Link Expired', isWarning: true };
    if (!shareSettings?.expiresAt) return { label: 'No Expiry (Always Active)', isWarning: false };
    const diffMs = new Date(shareSettings.expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return { label: 'Link Expired', isWarning: true };
    const hours = Math.round(diffMs / (1000 * 60 * 60));
    if (hours < 1) return { label: `Expires in ${Math.max(1, Math.round(diffMs / (1000 * 60)))}m`, isWarning: true };
    if (hours < 24) return { label: `Expires in ${hours}h`, isWarning: hours <= 3 };
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const dateStr = new Date(shareSettings.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { label: `Expires in ${days}d (${dateStr})`, isWarning: false };
  })();

  const currentExpiryChoice = (() => {
    if (!shareSettings?.expiresAt) return null;
    const h = Math.round((new Date(shareSettings.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60));
    if (Math.abs(h - 24) <= 4) return 24;
    if (Math.abs(h - 72) <= 8) return 72;
    if (Math.abs(h - 168) <= 24) return 168;
    if (Math.abs(h - 720) <= 48) return 720;
    return 'custom';
  })();

  const getOrFetchUrl = async () => {
    if (isLinkStopped) {
      showToast('Sharing link is currently stopped. Click "Reactivate" to enable it.', 'error');
      return null;
    }
    if (isLinkExpired) {
      showToast('Sharing link has expired. Click "Reactivate" to enable it.', 'error');
      return null;
    }
    if (clientFormUrl) return clientFormUrl;
    if (!customer?._id) {
      showToast('Site profile ID is missing.', 'error');
      return null;
    }
    setIsGeneratingLink(true);
    try {
      const res = await interiorCrmService.generateShareLink(customer._id, { mode: 'requirements', includeRequirements: true, allowDownload: false });
      const token = res?.data?.shareToken || res?.shareToken;
      if (!token) throw new Error(res?.error || res?.message || 'Failed to generate share link');
      await loadSiteDetails(true);
      return `${WEB_APP_URL}/share/requirements/${token}`;
    } catch (e) {
      showToast(e?.message || 'Failed to create share link', 'error');
      return null;
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    const url = await getOrFetchUrl();
    if (!url) return;
    try {
      await Clipboard.setStringAsync(url);
      setCopiedLink(true);
      showToast('Shareable Client Intake Link copied to clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast('Failed to copy to clipboard.', 'error');
    }
  };

  const handleShareWhatsApp = async () => {
    const url = await getOrFetchUrl();
    if (!url) return;
    const clientName = (projectInfo?.client || customer?.name || 'there').split(' ')[0];
    const message = encodeURIComponent(
      `Hi ${clientName}! Please share your interior design preferences & room requirements using this interactive questionnaire: ${url}\n\nOur design team will review your wishlist and prepare tailored 2D & 3D plans!`
    );
    const phone = String(customer?.mobileNumber || '').replace(/[^0-9]/g, '');
    // 9876543210 is the placeholder number on auto-created site profiles
    Linking.openURL(phone && phone !== '9876543210' ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`)
      .catch(() => showToast('Could not open WhatsApp.', 'error'));
  };

  const handleStopLink = () => {
    if (!customer?._id) return;
    Alert.alert('Stop Client Intake Link?', 'The link will be deactivated immediately and clients opening it will be blocked.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: async () => {
          setIsStoppingLink(true);
          try {
            await interiorCrmService.revokeShareLink(customer._id);
            showToast('Client intake link stopped.', 'success');
            await loadSiteDetails(true);
          } catch (e) {
            showToast(e?.message || 'Failed to stop link', 'error');
          } finally {
            setIsStoppingLink(false);
          }
        },
      },
    ]);
  };

  const setLinkExpiry = async (hours, successMsg) => {
    if (!customer?._id) return;
    setIsUpdatingExpiry(true);
    try {
      await interiorCrmService.generateShareLink(customer._id, { mode: 'requirements', includeRequirements: true, allowDownload: false, expiresHours: hours });
      showToast(successMsg, 'success');
      await loadSiteDetails(true);
    } catch (e) {
      showToast(e?.message || 'Failed to update link expiry', 'error');
    } finally {
      setIsUpdatingExpiry(false);
    }
  };
  const handleChangeExpiry = (hours) => setLinkExpiry(hours, `Link expiry set to ${expiryLabel(hours)}.`);
  const handleReactivateLink = (hours = 168) => setLinkExpiry(hours, 'Client intake link reactivated!');

  // Direct photo upload (web handleDirectPhotoUpload): Cloudinary → project photos + site profile photos
  const handleDirectPhotoUpload = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('Photo library permission is required to upload site photos', 'error');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;

      setUploadingPhotos(true);
      const urls = [];
      for (let i = 0; i < result.assets.length; i++) {
        const a = result.assets[i];
        const url = await cloudinaryService.uploadFile(a.uri, a.fileName || `site-photo-${Date.now()}-${i + 1}.jpg`, a.mimeType || 'image/jpeg');
        if (url) urls.push(url);
      }
      if (urls.length === 0) throw new Error('Failed to upload some or all photos');

      for (const url of urls) {
        try {
          await interiorApiClient.post(`/projects/${projectId}/photos`, { url, category: 'site_visit' });
        } catch {
          // still saved on the site profile below
        }
      }
      if (customer?._id) {
        const updated = Array.from(new Set([...(customer.sitePhotos || []), ...urls]));
        await interiorApiClient.patch(`/crm/customers/${customer._id}`, { sitePhotos: updated });
      }
      showToast(`Successfully uploaded ${urls.length} photo${urls.length > 1 ? 's' : ''}`, 'success');
      await loadSiteDetails(true);
    } catch (e) {
      showToast(e?.message || 'Failed to upload some or all photos', 'error');
    } finally {
      setUploadingPhotos(false);
    }
  };

  // ── Requirements: team specs enriched with the client's wishlist (same merge as the web) ──
  const teamRequirements = useMemo(() => asList(customer?.requirements), [customer?.requirements]);
  const clientRequirements = useMemo(() => asList(customer?.clientRequirements), [customer?.clientRequirements]);
  const requirements = useMemo(() => {
    if (teamRequirements.length === 0 && clientRequirements.length === 0) return [];
    if (teamRequirements.length === 0) return clientRequirements.map((r) => ({ ...r, source: 'client' }));
    if (clientRequirements.length === 0) return teamRequirements.map((r) => ({ ...r, source: 'team' }));
    const clientMap = new Map();
    clientRequirements.forEach((cr) => { if (cr.roomName) clientMap.set(cr.roomName.toLowerCase().trim(), cr); });
    const used = new Set();
    const merged = teamRequirements.map((tr) => {
      const key = (tr.roomName || '').toLowerCase().trim();
      const cr = clientMap.get(key);
      if (!cr) return { ...tr, source: 'team' };
      used.add(key);
      const pick = (k) => tr[k] || cr[k] || '';
      return {
        ...cr,
        ...tr,
        source: 'merged',
        designStyle: tr.designStyle || cr.designStyle || tr.theme || cr.theme || '',
        furnitureRequirements: pick('furnitureRequirements'),
        storage: pick('storage'),
        lightingRequirements: pick('lightingRequirements'),
        plumbingRequirements: pick('plumbingRequirements'),
        colours: pick('colours'),
        materials: pick('materials'),
        flooring: pick('flooring'),
        ceiling: pick('ceiling'),
        wallFinishes: pick('wallFinishes'),
        furnitureStyle: pick('furnitureStyle'),
        description: pick('description'),
      };
    });
    clientRequirements.forEach((cr) => {
      const key = (cr.roomName || '').toLowerCase().trim();
      if (!used.has(key)) merged.push({ ...cr, source: 'client' });
    });
    return merged;
  }, [teamRequirements, clientRequirements]);
  const isClientSubmittedOnly = teamRequirements.length === 0 && clientRequirements.length > 0;

  const siteMeasurements = customer?.siteMeasurements;
  const sitePhotos = (customer?.sitePhotos || []).map((p) => (typeof p === 'string' ? p : p?.url || '')).filter(Boolean);
  const hasRequirements = requirements.length > 0;
  const hasMeasurements = !!siteMeasurements;
  const hasPhotos = sitePhotos.length > 0;
  const showRequirements = activeTab === 'all' || activeTab === 'requirements';
  const showMeasurements = activeTab === 'all' || activeTab === 'measurements';
  const showPhotos = activeTab === 'all' || activeTab === 'photos';

  const TABS = [
    { id: 'requirements', label: 'Design Requirements', icon: 'clipboard-outline', color: '#059669', badge: `${requirements.length} Spaces` },
    {
      id: 'measurements', label: 'Site Visit & Measurements', icon: 'resize-outline', color: '#7C3AED',
      badge: hasMeasurements ? (siteMeasurements?.carpetArea ? `${siteMeasurements.carpetArea} sqft` : 'Active') : null,
    },
    { id: 'photos', label: 'Site Photos', icon: 'camera-outline', color: '#2563EB', badge: String(sitePhotos.length) },
    { id: 'all', label: 'View All', icon: 'layers-outline', color: '#0F172A', badge: null },
  ];

  const intakeStatus = customer?.clientRequirementsSubmittedAt
    ? { label: 'Client Wishlist Received', color: '#047857', bg: '#ECFDF5', border: '#A7F3D0', icon: 'checkmark-circle' }
    : isLinkActive
      ? { label: 'Awaiting Client Input', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', dot: true }
      : isLinkStopped
        ? { label: 'Link Stopped', color: '#BE123C', bg: '#FFF1F2', border: '#FECDD3', icon: 'power' }
        : isLinkExpired
          ? { label: 'Link Expired', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', icon: 'time-outline' }
          : { label: 'Not Active', color: '#475569', bg: '#F1F5F9', border: '#E2E8F0' };

  const intakeDescription = customer?.clientRequirementsSubmittedAt
    ? `Client submitted wishlist on ${new Date(customer.clientRequirementsSubmittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : isLinkStopped
      ? 'This questionnaire link has been stopped. Reactivate it to allow the client to access and fill the form.'
      : isLinkExpired
        ? 'This questionnaire link has expired. Reactivate it to set a new expiry window.'
        : isLinkActive
          ? 'Clients can open this link on mobile or desktop to choose styles, upload inspiration images, and specify room requirements.'
          : 'Generate an interactive intake form so the client can submit their preferences online.';

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.headerTitle}>Site Details</Text>
              {!!customer?.leadNumber && (
                <View style={s.leadBadge}>
                  <Text style={s.leadBadgeText}>Lead: {customer.leadNumber}</Text>
                </View>
              )}
            </View>
            <Text style={s.headerSub}>Requirements, site measurements & photo records</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabBarWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.tabBar}>
            {TABS.map((t) => {
              const active = activeTab === t.id;
              return (
                <TouchableOpacity key={t.id} style={[s.tab, active && { backgroundColor: t.color }]} onPress={() => setActiveTab(t.id)}>
                  <Ionicons name={t.icon} size={14} color={active ? '#FFFFFF' : '#64748B'} />
                  <Text style={[s.tabText, active && { color: '#FFFFFF' }]}>{t.label}</Text>
                  {!!t.badge && (
                    <Text style={[s.tabBadge, active ? s.tabBadgeActive : { color: t.color, backgroundColor: `${t.color}1A` }]}>{t.badge}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : !customer ? (
          <View style={s.center}>
            <Ionicons name="clipboard-outline" size={44} color="#CBD5E1" />
            <Text style={s.emptyTitle}>Site profile unavailable</Text>
            <Text style={s.emptySub}>The site profile for this project could not be loaded. Tap Retry to try again.</Text>
            <TouchableOpacity style={[s.pillBtn, s.pillBlue, { marginTop: 10 }]} onPress={() => loadSiteDetails()}>
              <Ionicons name="refresh" size={12} color="#2563EB" />
              <Text style={[s.pillBtnText, { color: '#2563EB' }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {/* ── TAB 1: CLIENT DESIGN REQUIREMENTS ── */}
            {showRequirements && (
              <View style={s.card}>
                <View style={s.cardHeaderCol}>
                  <View style={s.rowCenter}>
                    <Ionicons name="clipboard-outline" size={16} color="#059669" />
                    <Text style={s.cardTitle}>Client Design Requirements & Specifications</Text>
                  </View>
                  <Text style={s.cardSub}>Functional and aesthetic specifications captured for room execution.</Text>
                  <View style={s.actionWrap}>
                    <Text style={[s.pill, s.pillGreen]}>{requirements.length} Spaces to Execute</Text>
                    {isLinkActive ? (
                      <TouchableOpacity style={[s.pillBtn, s.pillIndigo]} onPress={handleCopyLink} disabled={isGeneratingLink}>
                        <Ionicons name={copiedLink ? 'checkmark' : 'share-social-outline'} size={11} color={copiedLink ? '#10B981' : '#4F46E5'} />
                        <Text style={[s.pillBtnText, { color: '#4F46E5' }]}>{copiedLink ? 'Copied' : 'Share Intake Link'}</Text>
                      </TouchableOpacity>
                    ) : (isLinkStopped || isLinkExpired) ? (
                      <TouchableOpacity style={[s.pillBtn, s.pillAmber]} onPress={() => handleReactivateLink(168)} disabled={isUpdatingExpiry}>
                        <Ionicons name="refresh" size={11} color="#B45309" />
                        <Text style={[s.pillBtnText, { color: '#B45309' }]}>Reactivate Link</Text>
                      </TouchableOpacity>
                    ) : null}
                    {canEditReq && (
                      <TouchableOpacity style={[s.pillBtn, s.pillGreenBtn]} onPress={() => setShowReqModal(true)}>
                        <Ionicons name="pencil" size={11} color="#059669" />
                        <Text style={[s.pillBtnText, { color: '#059669' }]}>{hasRequirements ? 'Edit Requirements' : '+ Add Requirements'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Shareable link & client intake status card */}
                <View style={s.intakeCard}>
                  <View style={s.rowTop}>
                    <View style={s.intakeIcon}>
                      <Ionicons name="share-social-outline" size={16} color="#4F46E5" />
                    </View>
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text style={s.intakeTitle}>Shareable Client Intake & Questionnaire Link</Text>
                      <View style={s.actionWrap}>
                        <View style={[s.statusPill, { backgroundColor: intakeStatus.bg, borderColor: intakeStatus.border }]}>
                          {intakeStatus.dot ? <View style={s.statusDot} /> : intakeStatus.icon ? <Ionicons name={intakeStatus.icon} size={10} color={intakeStatus.color} /> : null}
                          <Text style={[s.statusPillText, { color: intakeStatus.color }]}>{intakeStatus.label}</Text>
                        </View>
                        {isLinkActive && (
                          <View style={[s.statusPill, currentExpiry.isWarning ? { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' } : { backgroundColor: '#F0FDFA', borderColor: '#99F6E4' }]}>
                            <Ionicons name="time-outline" size={10} color={currentExpiry.isWarning ? '#BE123C' : '#0F766E'} />
                            <Text style={[s.statusPillText, { color: currentExpiry.isWarning ? '#BE123C' : '#0F766E' }]}>{currentExpiry.label}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.intakeDesc}>{intakeDescription}</Text>
                    </View>
                  </View>

                  <View style={s.actionWrap}>
                    {isLinkActive ? (
                      <>
                        <TouchableOpacity style={[s.linkBtn, s.linkBtnMuted]} onPress={handleCopyLink} disabled={isGeneratingLink}>
                          <Ionicons name={copiedLink ? 'checkmark' : 'copy-outline'} size={12} color={copiedLink ? '#10B981' : '#0F172A'} />
                          <Text style={s.linkBtnTextDark}>{copiedLink ? 'Copied' : 'Copy Link'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.linkBtn, { backgroundColor: '#059669' }]} onPress={handleShareWhatsApp} disabled={isGeneratingLink}>
                          <Ionicons name="logo-whatsapp" size={12} color="#FFFFFF" />
                          <Text style={s.linkBtnText}>WhatsApp</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.linkBtn, { backgroundColor: '#2563EB' }]} onPress={() => setShowEmailModal(true)}>
                          <Ionicons name="mail-outline" size={12} color="#FFFFFF" />
                          <Text style={s.linkBtnText}>Email</Text>
                        </TouchableOpacity>
                        {!!clientFormUrl && (
                          <TouchableOpacity style={[s.linkBtn, s.linkBtnMuted]} onPress={() => Linking.openURL(clientFormUrl)}>
                            <Ionicons name="open-outline" size={12} color="#64748B" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[s.linkBtn, s.linkBtnRose]} onPress={handleStopLink} disabled={isStoppingLink}>
                          <Ionicons name="power" size={11} color="#E11D48" />
                          <Text style={[s.linkBtnText, { color: '#E11D48' }]}>Stop</Text>
                        </TouchableOpacity>
                      </>
                    ) : (isLinkStopped || isLinkExpired) ? (
                      <TouchableOpacity style={[s.linkBtn, s.linkBtnGreen]} onPress={() => handleReactivateLink(168)} disabled={isUpdatingExpiry}>
                        <Ionicons name="refresh" size={12} color="#059669" />
                        <Text style={[s.linkBtnText, { color: '#059669' }]}>Reactivate Link</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={[s.linkBtn, { backgroundColor: '#4F46E5' }]} onPress={handleCopyLink} disabled={isGeneratingLink}>
                        {isGeneratingLink ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="share-social-outline" size={12} color="#FFFFFF" />}
                        <Text style={s.linkBtnText}>Generate Link</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[s.linkBtn, s.linkBtnMuted]} onPress={() => setShowShareModal(true)}>
                      <Ionicons name="settings-outline" size={13} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  {isLinkActive && (
                    <View style={s.expiryRow}>
                      <Ionicons name="time-outline" size={12} color="#F59E0B" />
                      {EXPIRY_CHOICES.map((c) => {
                        const active = currentExpiryChoice === c.hours;
                        return (
                          <TouchableOpacity
                            key={c.label}
                            style={[s.expiryChip, active && s.expiryChipActive]}
                            disabled={isUpdatingExpiry || active}
                            onPress={() => handleChangeExpiry(c.hours)}
                          >
                            <Text style={[s.expiryChipText, active && s.expiryChipTextActive]}>{c.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      {isUpdatingExpiry && <ActivityIndicator size="small" color="#F59E0B" />}
                    </View>
                  )}

                  {!!customer?.clientRequirementsNotes && (
                    <Text style={s.clientNote}>
                      <Text style={{ fontFamily: 'Inter-SemiBold', fontStyle: 'normal', color: '#059669' }}>Client Note: </Text>
                      "{customer.clientRequirementsNotes}"
                    </Text>
                  )}
                </View>

                {/* Budget & overview highlights */}
                <View style={{ gap: 8 }}>
                  {[
                    { label: 'Estimated Budget', icon: 'cash-outline', color: '#D97706', bg: '#FEF3C7',
                      value: customer?.budgetRange || (projectInfo?.budget?.amount ? `₹${Number(projectInfo.budget.amount).toLocaleString()}` : 'Not recorded') },
                    { label: 'Interior Type', icon: 'layers-outline', color: '#2563EB', bg: '#DBEAFE',
                      value: requirements[0]?.interiorType || customer?.propertyType || projectInfo?.type || 'Residential' },
                    { label: 'Primary Theme', icon: 'color-palette-outline', color: '#7C3AED', bg: '#F5F3FF',
                      value: requirements.find((r) => r.designStyle)?.designStyle || requirements[0]?.theme || 'Custom Spec' },
                  ].map((h) => (
                    <View key={h.label} style={s.highlightTile}>
                      <View style={[s.highlightIcon, { backgroundColor: h.bg }]}>
                        <Ionicons name={h.icon} size={16} color={h.color} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.highlightLabel}>{h.label}</Text>
                        <Text style={s.highlightValue} numberOfLines={1}>{h.value}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {hasRequirements ? (
                  <View style={{ gap: 12 }}>
                    {requirements.map((req, idx) => {
                      const functional = FUNCTIONAL_ROWS.filter(([, k]) => !!req[k]);
                      const aesthetic = [
                        ...((req.designStyle || req.theme) ? [['Style', null, null, null, req.designStyle || req.theme]] : []),
                        ...AESTHETIC_ROWS.filter(([, k]) => !!req[k]),
                      ];
                      return (
                        <View key={idx} style={s.reqCard}>
                          <View style={s.reqHead}>
                            <View style={s.rowCenter}>
                              <Text style={s.reqIndex}>{idx + 1}</Text>
                              <Text style={s.reqRoom} numberOfLines={1}>{req.roomName || 'General Space'}</Text>
                            </View>
                            <View style={s.actionWrap}>
                              {(req.source === 'client' || isClientSubmittedOnly) && (
                                <Text style={[s.tag, s.tagGreen]}>✦ Client Wishlist</Text>
                              )}
                              {!!req.interiorType && <Text style={[s.tag, s.tagMuted]}>{req.interiorType}</Text>}
                              {!!(req.designStyle || req.theme) && <Text style={[s.tag, s.tagGreen]}>{req.designStyle || req.theme}</Text>}
                            </View>
                          </View>

                          <View style={s.specBox}>
                            <Text style={[s.specTitle, { color: '#059669' }]}>Functional Requirements</Text>
                            {functional.length ? functional.map(([label, key, icon, color]) => (
                              <View key={key} style={s.specRow}>
                                <Text style={[s.specLabel, color && { color }]}>
                                  {icon ? <Ionicons name={icon} size={10} color={color} /> : null}{icon ? ' ' : ''}{label}
                                </Text>
                                <Text style={s.specValue}>{req[key]}</Text>
                              </View>
                            )) : <Text style={s.specEmpty}>No functional requirements recorded.</Text>}
                          </View>

                          <View style={s.specBox}>
                            <Text style={[s.specTitle, { color: '#7C3AED' }]}>Aesthetic Requirements</Text>
                            {aesthetic.length ? aesthetic.map(([label, key, , , direct]) => (
                              <View key={label} style={s.specRow}>
                                <Text style={s.specLabel}>{label}</Text>
                                <Text style={s.specValue}>{direct || req[key]}</Text>
                              </View>
                            )) : <Text style={s.specEmpty}>No aesthetic requirements recorded.</Text>}
                          </View>

                          {!!req.description && (
                            <View style={s.specBox}>
                              <Text style={[s.specTitle, { color: '#059669' }]}>✦ Specific Notes</Text>
                              <Text style={s.specValue}>{req.description}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={s.emptyBox}>
                    <View style={[s.emptyIcon, { backgroundColor: '#ECFDF5' }]}>
                      <Ionicons name="clipboard-outline" size={22} color="#059669" />
                    </View>
                    <Text style={s.emptyTitle}>No Requirements Logged</Text>
                    <Text style={s.emptySub}>Configure room-by-room functional and aesthetic specifications for this project.</Text>
                    {canEditReq && (
                      <TouchableOpacity style={[s.solidBtn, { backgroundColor: '#059669' }]} onPress={() => setShowReqModal(true)}>
                        <Ionicons name="add" size={13} color="#FFFFFF" />
                        <Text style={s.solidBtnText}>Add Room Requirements</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* ── TAB 2: SITE VISIT & MEASUREMENTS ── */}
            {showMeasurements && (
              <View style={{ gap: 12 }}>
                <View style={s.sectionHead}>
                  <View style={[s.rowCenter, { flex: 1 }]}>
                    <Ionicons name="resize-outline" size={16} color="#7C3AED" />
                    <Text style={s.cardTitle}>Site Visit & Spatial Measurements</Text>
                  </View>
                  {canEditSiteVisit && (
                    <TouchableOpacity style={[s.pillBtn, s.pillPurple]} onPress={() => setShowSiteVisitModal(true)}>
                      <Ionicons name="pencil" size={11} color="#7C3AED" />
                      <Text style={[s.pillBtnText, { color: '#7C3AED' }]}>{hasMeasurements ? 'Edit Measurements' : '+ Log Measurements'}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!!(customer?.remarks || siteMeasurements?.notes || customer?.siteVisitScheduledDate) && (
                  <View style={s.briefingBox}>
                    <View style={[s.rowCenter, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
                      <View style={s.rowCenter}>
                        <Ionicons name="document-text-outline" size={13} color="#7C3AED" />
                        <Text style={s.briefingLabel}>Site Visit Briefing & Notes</Text>
                      </View>
                      {!!customer?.siteVisitScheduledDate && (
                        <Text style={s.briefingDate}>
                          Scheduled: {new Date(customer.siteVisitScheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      )}
                    </View>
                    {!!(customer?.remarks || siteMeasurements?.notes) && (
                      <Text style={s.briefingText}>{customer?.remarks || siteMeasurements?.notes}</Text>
                    )}
                  </View>
                )}

                {hasMeasurements ? (
                  <>
                    <MeasureCard title="Room & Spatial Dimensions" icon="expand-outline" color="#7C3AED" tag="Spatial">
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Tile label="Carpet Area" value={siteMeasurements.carpetArea || '—'} unit="Sq.Ft" big />
                        <Tile label="Ceiling Height" value={siteMeasurements.ceilingHeight || '—'} unit="Ft" big />
                      </View>
                      <Tile label="Room Dimensions (L × W)" value={siteMeasurements.roomDimensions || 'Not recorded'} />
                      <Tile label="Floor-to-Ceiling Height" value={siteMeasurements.floorToCeilingHeight || 'Not recorded'} />
                      <Tile label="Rooms to Design" value={siteMeasurements.rooms || 'Not specified'} />
                    </MeasureCard>
                    <MeasureCard title="Openings & Structural Specs" icon="scan-outline" color="#2563EB" tag="Structure">
                      <Tile label="Door Dimensions" value={siteMeasurements.doorDimensions || 'Not recorded'} />
                      <Tile label="Window Dimensions" value={siteMeasurements.windowDimensions || 'Not recorded'} />
                      <Tile label="Wall Thickness" value={siteMeasurements.wallThickness || 'Not recorded'} />
                      <Tile label="Column / Beam Dimensions" value={siteMeasurements.columnBeamDimensions || 'Not recorded'} />
                    </MeasureCard>
                    <MeasureCard title="MEP & Utility Services" icon="flash-outline" color="#F59E0B" tag="MEP">
                      <Tile label="Existing Electrical Points" labelColor="#F59E0B" value={siteMeasurements.electricalPoints || 'No electrical notes recorded'} />
                      <Tile label="Plumbing Points" labelColor="#0891B2" value={siteMeasurements.plumbingPoints || 'No plumbing points recorded'} />
                      <Tile label="AC Locations & Piping" labelColor="#059669" value={siteMeasurements.acLocations || 'No AC locations recorded'} />
                    </MeasureCard>
                    <MeasureCard title="Furniture & Site Constraints" icon="bed-outline" color="#059669" tag="Conditions">
                      <Tile label="Existing Furniture Dimensions" labelColor="#059669" value={siteMeasurements.furnitureDimensions || 'No furniture dimensions recorded'} />
                      <Tile label="Site Constraints & Limitations" labelColor="#F43F5E" bg="#FFF1F2" value={siteMeasurements.siteConstraints || 'None reported'} />
                      <Tile label="Additional Site Notes" labelColor="#7C3AED" bg="#FAF5FF" value={siteMeasurements.notes || 'No notes added'} />
                    </MeasureCard>
                  </>
                ) : (
                  <View style={[s.emptyBox, s.card]}>
                    <View style={[s.emptyIcon, { backgroundColor: '#F5F3FF' }]}>
                      <Ionicons name="resize-outline" size={22} color="#7C3AED" />
                    </View>
                    <Text style={s.emptyTitle}>No Spatial Measurements Recorded</Text>
                    <Text style={s.emptySub}>Log carpet area, ceiling heights, door/window openings, and MEP utilities.</Text>
                    {canEditSiteVisit && (
                      <TouchableOpacity style={[s.solidBtn, { backgroundColor: '#7C3AED' }]} onPress={() => setShowSiteVisitModal(true)}>
                        <Ionicons name="add" size={13} color="#FFFFFF" />
                        <Text style={s.solidBtnText}>Log Measurements Now</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* ── TAB 3: SITE PHOTOS ── */}
            {showPhotos && (
              <View style={s.card}>
                <View style={[s.sectionHead, { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <View style={[s.rowCenter, { flex: 1, flexWrap: 'wrap' }]}>
                    <Ionicons name="image-outline" size={16} color="#3B82F6" />
                    <Text style={s.photosTitle}>Site Photos & Visual Records</Text>
                    <Text style={[s.pill, s.pillBlueText]}>{sitePhotos.length} Photos</Text>
                  </View>
                </View>
                <View style={s.actionWrap}>
                  {canEditPhotos && (
                    <TouchableOpacity style={[s.pillBtn, s.pillBlue]} onPress={handleDirectPhotoUpload} disabled={uploadingPhotos}>
                      {uploadingPhotos ? <ActivityIndicator size="small" color="#2563EB" /> : <Ionicons name="cloud-upload-outline" size={12} color="#2563EB" />}
                      <Text style={[s.pillBtnText, { color: '#2563EB' }]}>{uploadingPhotos ? 'Uploading...' : 'Upload Photos'}</Text>
                    </TouchableOpacity>
                  )}
                  {canEditSiteVisit && (
                    <TouchableOpacity style={[s.pillBtn, s.pillMuted]} onPress={() => setShowSiteVisitModal(true)}>
                      <Ionicons name="pencil" size={11} color="#64748B" />
                      <Text style={[s.pillBtnText, { color: '#64748B' }]}>Manage in Visit</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {hasPhotos ? (
                  <View style={s.photoGrid}>
                    {sitePhotos.map((url, idx) => (
                      <TouchableOpacity key={`${url}-${idx}`} style={s.photoThumb} onPress={() => Linking.openURL(url)}>
                        <Image source={{ uri: url }} style={s.photoImg} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={s.emptyBox}>
                    <Ionicons name="image-outline" size={32} color="#94A3B8" />
                    <Text style={s.emptyTitle}>No Site Photos Uploaded</Text>
                    <Text style={s.emptySub}>Upload site inspection photos & progress views.</Text>
                    {canEditPhotos && (
                      <TouchableOpacity style={[s.solidBtn, { backgroundColor: '#2563EB' }]} onPress={handleDirectPhotoUpload} disabled={uploadingPhotos}>
                        {uploadingPhotos ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="add" size={12} color="#FFFFFF" />}
                        <Text style={s.solidBtnText}>{uploadingPhotos ? 'Uploading...' : 'Upload Site Photos'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Modals for editing & sharing (same set as the web) */}
      {!!customer?._id && (
        <>
          <LogSiteVisitModal
            visible={showSiteVisitModal}
            onClose={() => setShowSiteVisitModal(false)}
            customerId={customer._id}
            initialMeasurements={customer.siteMeasurements}
            initialPhotos={customer.sitePhotos}
            instructions={customer.remarks || customer.siteMeasurements?.notes}
            keepStatus
            onSuccess={() => loadSiteDetails(true)}
          />
          <LogRequirementsModal
            visible={showReqModal}
            onClose={() => setShowReqModal(false)}
            customerId={customer._id}
            initialBudgetRange={customer.budgetRange || (projectInfo?.budget?.amount ? String(projectInfo.budget.amount) : '')}
            initialRequirements={teamRequirements.length > 0 ? teamRequirements : requirements}
            clientRequirements={clientRequirements}
            keepStatus
            onSuccess={() => loadSiteDetails(true)}
          />
          <CrmShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            customerId={customer._id}
            lead={customer}
            mode="requirements"
            onSuccess={() => loadSiteDetails(true)}
          />
          <SendRequirementsEmailModal
            visible={showEmailModal}
            onClose={() => setShowEmailModal(false)}
            lead={customer}
            onSuccess={() => loadSiteDetails(true)}
          />
        </>
      )}
    </View>
  );
}

function MeasureCard({ title, icon, color, tag, children }) {
  return (
    <View style={s.card}>
      <View style={[s.sectionHead, { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
        <View style={[s.rowCenter, { flex: 1 }]}>
          <Ionicons name={icon} size={15} color={color} />
          <Text style={s.measureTitle}>{title}</Text>
        </View>
        <Text style={[s.tag, { color, backgroundColor: `${color}1A`, borderColor: `${color}33` }]}>{tag}</Text>
      </View>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function Tile({ label, value, unit, big, labelColor, bg }) {
  return (
    <View style={[s.tile, big && { flex: 1 }, bg && { backgroundColor: bg }]}>
      <Text style={[s.tileLabel, labelColor && { color: labelColor }]}>{label}</Text>
      <Text style={big ? s.tileValueBig : s.tileValue}>
        {value}
        {unit ? <Text style={s.tileUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, gap: 6 },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  leadBadge: { backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  leadBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#7C3AED' },

  tabBarWrap: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tabBar: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F8FAFC' },
  tabText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  tabBadge: { fontSize: 10, fontFamily: 'Inter-SemiBold', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: 'hidden' },
  tabBadgeActive: { color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.2)' },

  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, gap: 12 },
  cardHeaderCol: { gap: 6, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  cardTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A', flexShrink: 1 },
  cardSub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  actionWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },

  pill: { fontSize: 11, fontFamily: 'Inter-SemiBold', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  pillGreen: { color: '#059669', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  pillBlueText: { color: '#2563EB', backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  pillBtnText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold' },
  pillIndigo: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  pillAmber: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  pillGreenBtn: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  pillPurple: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
  pillBlue: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  pillMuted: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },

  intakeCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, gap: 10, backgroundColor: '#FFFFFF' },
  intakeIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', alignItems: 'center', justifyContent: 'center' },
  intakeTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  intakeDesc: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B', lineHeight: 15 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  statusPillText: { fontSize: 10, fontFamily: 'Inter-Bold' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  linkBtnText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  linkBtnTextDark: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  linkBtnMuted: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  linkBtnRose: { backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3' },
  linkBtnGreen: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  expiryRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 6 },
  expiryChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  expiryChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  expiryChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#334155' },
  expiryChipTextActive: { color: '#FFFFFF' },
  clientNote: { fontSize: 12, fontFamily: 'Inter-Regular', fontStyle: 'italic', color: '#0F172A', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },

  highlightTile: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 10 },
  highlightIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  highlightLabel: { fontSize: 9.5, fontFamily: 'Inter-SemiBold', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4 },
  highlightValue: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2 },

  reqCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, gap: 10 },
  reqHead: { gap: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  reqIndex: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#059669', color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter-Bold', textAlign: 'center', lineHeight: 22, overflow: 'hidden' },
  reqRoom: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', flexShrink: 1 },
  tag: { fontSize: 9.5, fontFamily: 'Inter-Bold', textTransform: 'uppercase', letterSpacing: 0.4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  tagGreen: { color: '#059669', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  tagMuted: { color: '#64748B', backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  specBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, gap: 6 },
  specTitle: { fontSize: 10, fontFamily: 'Inter-Bold', textTransform: 'uppercase', letterSpacing: 0.4, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  specRow: { gap: 2 },
  specLabel: { fontSize: 10.5, fontFamily: 'Inter-Medium', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3 },
  specValue: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#0F172A', lineHeight: 17 },
  specEmpty: { fontSize: 11, fontFamily: 'Inter-Regular', fontStyle: 'italic', color: '#94A3B8', paddingVertical: 4 },

  emptyBox: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16, gap: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: '#FBFCFE' },
  emptyIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A', textAlign: 'center' },
  emptySub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center' },
  solidBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9, marginTop: 6 },
  solidBtnText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },

  briefingBox: { backgroundColor: '#FAF5FF', borderWidth: 1, borderColor: '#EDE9FE', borderRadius: 12, padding: 12, gap: 8 },
  briefingLabel: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#6D28D9', textTransform: 'uppercase', letterSpacing: 0.4 },
  briefingDate: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#6D28D9', backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  briefingText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#0F172A', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDE9FE', borderRadius: 8, padding: 10, lineHeight: 17 },

  measureTitle: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 1 },
  tile: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10 },
  tileLabel: { fontSize: 9.5, fontFamily: 'Inter-SemiBold', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  tileValue: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#0F172A', lineHeight: 17 },
  tileValueBig: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  tileUnit: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#64748B' },

  photosTitle: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.4 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: '31.5%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F1F5F9' },
  photoImg: { width: '100%', height: '100%' },
});

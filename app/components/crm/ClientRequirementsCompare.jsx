// =============================================================================
// Requirements — client intake link + room specifications
// Mobile port of the web InteriorComparativeRequirementsView. Four states:
//   1. waiting for the client (link active, nothing submitted)
//   2. link stopped / expired (nothing logged)
//   3. empty (no link, nothing logged)
//   4. requirements configured: one card per room; client intake and team
//      entries are merged by room name (team values win, client fills gaps)
// Client data: lead.clientRequirements(+Notes, SubmittedAt); team: lead.requirements.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, AppState, Image, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { WEB_APP_URL } from '../../config';
import { interiorCrmService } from '../../services/interiorCrmService';
import { useToast } from '../../context/ToastContext';
import SelectField from '../common/SelectField';

const EXPIRY_OPTIONS = [
  { value: '24', label: '24 Hours (1 Day)' },
  { value: '72', label: '3 Days' },
  { value: '168', label: '7 Days (1 Week)' },
  { value: '720', label: '30 Days' },
  { value: 'never', label: 'Never (No Expiry)' },
];

const POST_REQUIREMENT_STAGES = [
  'Under Site Visit', 'Measurement Done', 'Under Drawing', 'Design Approved', 'Under BOQ Creation',
  'Under Quotation', 'Quotation Pending', 'Quotation Sent', 'Negotiation', 'Booking Pending', 'Won', 'Converted',
];

function expiryOptionFor(expiresAt) {
  if (!expiresAt) return 'never';
  const h = Math.round((new Date(expiresAt).getTime() - Date.now()) / 3600000);
  if (Math.abs(h - 24) <= 4) return '24';
  if (Math.abs(h - 72) <= 8) return '72';
  if (Math.abs(h - 168) <= 24) return '168';
  if (Math.abs(h - 720) <= 48) return '720';
  return '';
}

function Spec({ label, value, color, strong }) {
  if (!value) return null;
  return (
    <View style={{ gap: 1 }}>
      <Text style={[s.specLabel, color && { color }]}>{label}</Text>
      <Text style={[s.specValue, strong && { fontFamily: 'Inter-Bold', color: '#6D28D9' }]}>{value}</Text>
    </View>
  );
}

/**
 * @param lead                 CRM lead
 * @param canEdit              may add / edit requirements and manage the intake link
 * @param isReadOnly           lost / converted lead
 * @param hasPassedToSiteVisit lead already moved past requirements (Discard is hidden)
 * @param currencySymbol       for room budgets
 * @param onEditSpecs          open the team requirements form
 * @param onRefresh            reload the lead
 * @param onOpenShare          open the share modal (expiry & permissions)
 */
export default function ClientRequirementsCompare({
  lead,
  canEdit = false,
  isReadOnly = false,
  hasPassedToSiteVisit: passedProp,
  currencySymbol = '₹',
  onEditSpecs,
  onRefresh,
  onOpenShare,
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(''); // 'link' | 'stop' | 'expiry' | 'discard' | 'sync'
  const [photo, setPhoto] = useState(null);
  const editable = canEdit && !isReadOnly;

  const share = lead?.shareSettings || {};
  const isLinkExpired = Boolean(share.expiresAt && new Date() > new Date(share.expiresAt));
  const isLinkStopped = share.isPublic === false;
  const isLinkActive = Boolean(share.shareToken && !isLinkStopped && !isLinkExpired);

  const expiry = (() => {
    if (isLinkStopped) return { label: 'Link Stopped / Disabled', warn: true };
    if (isLinkExpired) return { label: 'Link Expired', warn: true };
    if (!share.expiresAt) return { label: 'No Expiry (Always Active)', warn: false };
    const ms = new Date(share.expiresAt).getTime() - Date.now();
    const h = Math.round(ms / 3600000);
    if (h < 1) return { label: `Expires in ${Math.max(1, Math.round(ms / 60000))}m`, warn: true };
    if (h < 24) return { label: `Expires in ${h}h`, warn: h <= 3 };
    const d = Math.round(ms / 86400000);
    return { label: `Expires in ${d}d (${new Date(share.expiresAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })})`, warn: false };
  })();

  const hasPassedToSiteVisit = Boolean(
    passedProp !== undefined
      ? passedProp
      : (lead?.status && POST_REQUIREMENT_STAGES.includes(lead.status)) || lead?.siteMeasurements || lead?.linkedProject
  );

  const clientSubmittedAt = lead?.clientRequirementsSubmittedAt || lead?.clientRequirements?.submittedAt || lead?.clientWishlist?.submittedAt;
  const clientNotes = lead?.clientRequirementsNotes || lead?.clientWishlist?.overallVibe || lead?.clientWishlist?.generalNotes || lead?.clientRequirements?.notes || '';
  const inspirationImages = lead?.clientWishlist?.inspirationImages || lead?.clientRequirements?.inspirationImages || lead?.inspirationImages || [];

  // Same merge rules as the web: team values win, client values fill the gaps
  const rooms = useMemo(() => {
    const team = Array.isArray(lead?.requirements) ? lead.requirements
      : lead?.requirements && typeof lead.requirements === 'object' ? (Array.isArray(lead.requirements.rooms) ? lead.requirements.rooms : [lead.requirements]) : [];
    const client = Array.isArray(lead?.clientRequirements) ? lead.clientRequirements
      : Array.isArray(lead?.clientRequirements?.rooms) ? lead.clientRequirements.rooms
      : Array.isArray(lead?.clientWishlist?.rooms) ? lead.clientWishlist.rooms
      : lead?.clientRequirements && typeof lead.clientRequirements === 'object' ? [lead.clientRequirements] : [];

    const norm = (r, source) => ({
      roomName: String(r.roomName || r.name || r.room || 'Space').trim(),
      interiorType: r.interiorType || r.type || lead?.propertyType || 'Residential',
      designStyle: r.designStyle || r.style || r.theme || '',
      theme: r.theme || r.designStyle || r.style || '',
      dimensions: r.dimensions || r.carpetArea || r.area || r.size || '',
      budget: r.budget || r.estimatedBudget || '',
      roomUsage: r.roomUsage || r.usage || '',
      furnitureRequirements: r.furnitureRequirements || r.wishedItems || (Array.isArray(r.furniture) ? r.furniture.join(', ') : r.furniture || ''),
      storage: r.storage || r.storageRequirements || '',
      electricalPoints: r.electricalPoints || r.electrical || '',
      lightingRequirements: r.lightingRequirements || r.lighting || '',
      plumbingRequirements: r.plumbingRequirements || r.plumbing || '',
      circulation: r.circulation || '',
      colours: r.colours || r.colors || r.colorPalette || '',
      materials: Array.isArray(r.materials) ? r.materials.join(', ') : r.materials || r.materialSpecs || '',
      flooring: r.flooring || r.flooringType || '',
      ceiling: r.ceiling || (typeof r.falseCeiling === 'boolean' ? (r.falseCeiling ? 'False Ceiling Required' : '') : r.falseCeiling) || '',
      wallFinishes: r.wallFinishes || r.walls || r.wallDecor || '',
      furnitureStyle: r.furnitureStyle || r.furniture_style || '',
      description: r.description || r.notes || r.remarks || r.specialRequests || r.aestheticNotes || '',
      source,
    });
    const c = client.map((r) => norm(r, 'client'));
    const t = team.map((r) => norm(r, 'team'));
    if (!t.length) return c;
    if (!c.length) return t;
    const byName = new Map(c.map((r) => [r.roomName.toLowerCase(), r]));
    const used = new Set();
    const merged = t.map((tr) => {
      const key = tr.roomName.toLowerCase();
      const cr = byName.get(key);
      if (!cr) return tr;
      used.add(key);
      const out = { ...tr, source: 'merged' };
      Object.keys(tr).forEach((k) => {
        if (k !== 'source' && k !== 'description' && !tr[k]) out[k] = cr[k];
      });
      out.description = tr.description
        ? cr.description && cr.description !== tr.description ? `${tr.description} (Client: ${cr.description})` : tr.description
        : cr.description;
      return out;
    });
    c.forEach((cr) => { if (!used.has(cr.roomName.toLowerCase())) merged.push(cr); });
    return merged;
  }, [lead?.requirements, lead?.clientRequirements, lead?.clientWishlist, lead?.propertyType]);

  // While waiting for the client, re-check every 5s (and when the app returns)
  useEffect(() => {
    if (!isLinkActive || clientSubmittedAt || !onRefresh) return undefined;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') onRefresh();
    }, 5000);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') onRefresh(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [isLinkActive, clientSubmittedAt, onRefresh]);

  const formUrlFor = (token) => `${WEB_APP_URL}/share/requirements/${token}`;

  const getOrCreateUrl = async () => {
    if (isLinkActive) return formUrlFor(share.shareToken);
    setBusy('link');
    try {
      const res = await interiorCrmService.generateShareLink(lead._id, { mode: 'requirements', includeRequirements: true, allowDownload: false });
      const token = res?.data?.shareToken || res?.shareToken;
      if (!token) throw new Error(res?.error || 'Failed to generate share link');
      onRefresh?.();
      return formUrlFor(token);
    } catch (e) {
      showToast(e.message || 'Failed to create share link', 'error');
      return null;
    } finally {
      setBusy('');
    }
  };

  const copyLink = async () => {
    const url = await getOrCreateUrl();
    if (!url) return;
    await Clipboard.setStringAsync(url);
    showToast('Client Requirements Link copied to clipboard!', 'success');
  };

  const whatsApp = async () => {
    const url = await getOrCreateUrl();
    if (!url) return;
    const first = (lead?.name || 'there').split(' ')[0];
    const msg = `Hi ${first}! Please share your interior design preferences & room requirements using this link: ${url}\n\nOur design team will review your preferences right away!`;
    const phone = String(lead?.mobileNumber || lead?.phone || '').replace(/\D/g, '');
    Linking.openURL(phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`).catch(() => {});
  };

  const refreshNow = async () => {
    if (!onRefresh || busy) return;
    setBusy('sync');
    try {
      await onRefresh();
      showToast('Requirements status updated', 'success');
    } finally {
      setBusy('');
    }
  };

  const setExpiry = async (value, successMsg) => {
    setBusy('expiry');
    try {
      await interiorCrmService.generateShareLink(lead._id, {
        mode: 'requirements', includeRequirements: true, allowDownload: false,
        expiresHours: value === 'never' ? null : Number(value),
      });
      showToast(successMsg || `Link expiry set to ${EXPIRY_OPTIONS.find((o) => o.value === value)?.label || value}.`, 'success');
      onRefresh?.();
    } catch (e) {
      showToast(e.message || 'Failed to update link expiry', 'error');
    } finally {
      setBusy('');
    }
  };

  const stopLink = () => {
    Alert.alert('Stop Client Intake Link?', 'The link will be deactivated immediately. The client will no longer be able to open the form or submit.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop Link', style: 'destructive', onPress: async () => {
          setBusy('stop');
          try {
            await interiorCrmService.revokeShareLink(lead._id);
            showToast('Client intake link stopped.', 'success');
            onRefresh?.();
          } catch (e) {
            showToast(e.message || 'Failed to stop link', 'error');
          } finally {
            setBusy('');
          }
        },
      },
    ]);
  };

  const discard = () => {
    if (hasPassedToSiteVisit) {
      showToast('Cannot discard requirements after the lead has been passed to Site Visit.', 'error');
      return;
    }
    Alert.alert('Discard Requirements', 'Discard all logged requirements for this lead? All room specifications will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard', style: 'destructive', onPress: async () => {
          setBusy('discard');
          try {
            await interiorCrmService.updateCustomer(lead._id, {
              requirements: [], clientRequirements: null, clientWishlist: null, clientRequirementsSubmittedAt: null,
            });
            await interiorCrmService.createActivity({ customer: lead._id, type: 'Requirement Gathering', status: 'Completed', remarks: 'Discarded/reset all room requirements.' });
            showToast('Requirements discarded.', 'success');
            onRefresh?.();
          } catch (e) {
            showToast(e.message || 'Failed to discard requirements', 'error');
          } finally {
            setBusy('');
          }
        },
      },
    ]);
  };

  const Btn = ({ icon, label, onPress, tone = 'default', disabled, loading }) => {
    const tones = {
      default: { bg: '#FFFFFF', border: '#E2E8F0', fg: '#334155' },
      amber: { bg: '#F59E0B', border: '#F59E0B', fg: '#FFFFFF' },
      green: { bg: '#059669', border: '#059669', fg: '#FFFFFF' },
      whatsapp: { bg: '#16A34A', border: '#16A34A', fg: '#FFFFFF' },
      danger: { bg: '#FFF1F2', border: '#FECDD3', fg: '#E11D48' },
      successSoft: { bg: '#ECFDF5', border: '#A7F3D0', fg: '#047857' },
    }[tone];
    return (
      <TouchableOpacity
        style={[s.btn, { backgroundColor: tones.bg, borderColor: tones.border }, (disabled || loading) && { opacity: 0.6 }]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        {loading ? <ActivityIndicator size="small" color={tones.fg} /> : <Ionicons name={icon} size={13} color={tones.fg} />}
        <Text style={[s.btnText, { color: tones.fg }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const ExpiryPill = () => (
    <View style={[s.pill, expiry.warn ? { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' } : { backgroundColor: '#F0FDFA', borderColor: '#99F6E4' }]}>
      <Ionicons name="time-outline" size={11} color={expiry.warn ? '#E11D48' : '#0F766E'} />
      <Text style={[s.pillText, { color: expiry.warn ? '#BE123C' : '#0F766E' }]}>{expiry.label}</Text>
    </View>
  );

  // ── 1. Waiting for the client ──
  if (rooms.length === 0 && isLinkActive && !clientSubmittedAt) {
    return (
      <View style={[s.card, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', alignItems: 'center' }]}>
        <View style={[s.bigIcon, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="time-outline" size={26} color="#D97706" />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <View style={[s.pill, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
            <Text style={[s.pillText, { color: '#B45309' }]}>AWAITING CLIENT SUBMISSION</Text>
          </View>
          <ExpiryPill />
        </View>
        <Text style={s.title}>Waiting for Client Input</Text>
        <Text style={s.sub}>The public intake link is active. Waiting for {lead?.name || 'the client'} to submit room preferences online.</Text>
        <View style={s.btnRow}>
          <Btn icon="refresh" label={busy === 'sync' ? 'Checking...' : 'Check Status / Refresh'} tone="amber" onPress={refreshNow} loading={busy === 'sync'} />
          <Btn icon="copy-outline" label="Copy Intake Link" onPress={copyLink} loading={busy === 'link'} />
          {!!lead?.mobileNumber && <Btn icon="logo-whatsapp" label="Send via WhatsApp" tone="whatsapp" onPress={whatsApp} />}
        </View>
        <View style={{ alignSelf: 'stretch', marginTop: 10 }}>
          <Text style={[s.specLabel, { marginBottom: 4 }]}>SCHEDULE EXPIRY</Text>
          <SelectField
            value={expiryOptionFor(share.expiresAt)}
            onChange={(v) => setExpiry(v)}
            options={EXPIRY_OPTIONS}
            placeholder="Custom"
            disabled={busy === 'expiry'}
          />
        </View>
        {editable && (
          <View style={[s.btnRow, { marginTop: 10 }]}>
            <Btn icon="power-outline" label={busy === 'stop' ? 'Stopping...' : 'Stop Link'} tone="danger" onPress={stopLink} loading={busy === 'stop'} />
            {!!onOpenShare && <Btn icon="settings-outline" label="Link Settings" onPress={onOpenShare} />}
          </View>
        )}
        {editable && (
          <View style={s.footerLine}>
            <Text style={s.sub}>Want to take specs now?</Text>
            <TouchableOpacity onPress={onEditSpecs}>
              <Text style={s.link}>Enter Requirements Manually</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ── 2. Link stopped / expired, nothing logged ──
  if (rooms.length === 0 && (isLinkStopped || isLinkExpired) && share.shareToken) {
    return (
      <View style={[s.card, { borderColor: '#FECDD3', alignItems: 'center' }]}>
        <View style={[s.bigIcon, { backgroundColor: '#FFF1F2' }]}>
          <Ionicons name="power-outline" size={24} color="#E11D48" />
        </View>
        <View style={[s.pill, { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]}>
          <Text style={[s.pillText, { color: '#BE123C' }]}>{isLinkStopped ? '● LINK STOPPED / DISABLED' : '● LINK EXPIRED'}</Text>
        </View>
        <Text style={s.title}>{isLinkStopped ? 'Client Intake Link is Stopped' : 'Client Intake Link has Expired'}</Text>
        <Text style={s.sub}>
          {isLinkStopped
            ? 'The public requirements link is deactivated. Clients opening it will see that it has been disabled.'
            : 'The scheduled expiry has passed. Reactivate the link or enter requirements directly.'}
        </Text>
        {editable && (
          <View style={s.btnRow}>
            <Btn icon="refresh" label="Reactivate Link (7 Days)" tone="green" onPress={() => setExpiry('168', 'Client intake link reactivated!')} loading={busy === 'expiry'} />
            <Btn icon="create-outline" label="Enter Requirements Manually" onPress={onEditSpecs} />
            {!!onOpenShare && <Btn icon="settings-outline" label="Link Settings" onPress={onOpenShare} />}
          </View>
        )}
      </View>
    );
  }

  // ── 3. Empty ──
  if (rooms.length === 0) {
    return (
      <View style={[s.card, { alignItems: 'center' }]}>
        <View style={[s.bigIcon, { backgroundColor: '#EEF2FF' }]}>
          <Ionicons name="home-outline" size={26} color="#4F46E5" />
        </View>
        <Text style={s.title}>No Requirements Logged Yet</Text>
        <Text style={s.sub}>Add project specifications directly or generate an online intake link for the client.</Text>
        {editable && (
          <View style={s.btnRow}>
            <Btn icon="add" label="Create Requirements" tone="green" onPress={onEditSpecs} />
            <Btn icon="share-social-outline" label="Generate & Copy Client Link" onPress={copyLink} loading={busy === 'link'} />
            {!!onOpenShare && <Btn icon="settings-outline" label="Link Settings" onPress={onOpenShare} />}
          </View>
        )}
      </View>
    );
  }

  // ── 4. Requirements configured ──
  return (
    <View style={{ gap: 12 }}>
      <View style={s.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[s.smallIcon, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="home-outline" size={16} color="#059669" />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.headTitle}>Room Specifications ({rooms.length} {rooms.length === 1 ? 'Area' : 'Areas'})</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {clientSubmittedAt ? (
                <View style={[s.pill, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Text style={[s.pillText, { color: '#047857' }]}>✓ Client Submitted</Text>
                </View>
              ) : (
                <View style={[s.pill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={[s.pillText, { color: '#1D4ED8' }]}>Team Recorded</Text>
                </View>
              )}
              {!!clientSubmittedAt && isLinkActive && (
                <View style={[s.pill, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                  <Text style={[s.pillText, { color: '#B45309' }]}>Link Reactivated (Client Can Edit)</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={[s.btnRow, { justifyContent: 'flex-start', marginTop: 10 }]}>
          {isLinkActive && (
            <>
              <Btn icon="copy-outline" label="Share Link" onPress={copyLink} loading={busy === 'link'} />
              <ExpiryPill />
              {editable && <Btn icon="power-outline" label={busy === 'stop' ? 'Stopping...' : 'Stop Link'} tone="danger" onPress={stopLink} loading={busy === 'stop'} />}
            </>
          )}
          {!!share.shareToken && (isLinkStopped || isLinkExpired) && (
            <>
              <View style={[s.pill, { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]}>
                <Text style={[s.pillText, { color: '#BE123C' }]}>{isLinkStopped ? 'Link Disabled (Submitted)' : 'Link Expired'}</Text>
              </View>
              {editable && <Btn icon="refresh" label="Reactivate Link" tone="successSoft" onPress={() => setExpiry('168', 'Client intake link reactivated!')} loading={busy === 'expiry'} />}
            </>
          )}
          {!!onOpenShare && editable && <Btn icon="settings-outline" label="Settings" onPress={onOpenShare} />}
          {editable && !hasPassedToSiteVisit && (
            <Btn icon="trash-outline" label={busy === 'discard' ? 'Discarding...' : 'Discard'} tone="danger" onPress={discard} loading={busy === 'discard'} />
          )}
        </View>
      </View>

      {!!clientNotes && (
        <View style={[s.card, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}>
          <Text style={[s.specLabel, { color: '#7E22CE' }]}>CLIENT STATED DIRECTIVES & VISION</Text>
          <Text style={[s.specValue, { fontStyle: 'italic' }]}>“{clientNotes}”</Text>
        </View>
      )}

      {inspirationImages.length > 0 && (
        <View style={s.card}>
          <Text style={s.specLabel}>CLIENT INSPIRATION MOODBOARD ({inspirationImages.length} PHOTOS)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {inspirationImages.map((img, i) => (
              <TouchableOpacity key={i} onPress={() => setPhoto(img)}>
                <Image source={{ uri: img }} style={s.thumb} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {rooms.map((room, idx) => {
        const hasFunctional = Boolean(room.roomUsage || room.furnitureRequirements || room.storage || room.electricalPoints || room.lightingRequirements || room.plumbingRequirements || room.circulation);
        const hasAesthetic = Boolean(room.designStyle || room.theme || room.colours || room.materials || room.flooring || room.ceiling || room.wallFinishes || room.furnitureStyle);
        return (
          <View key={idx} style={[s.card, { padding: 0, overflow: 'hidden' }]}>
            <View style={s.roomHead}>
              <View style={s.roomIndex}><Text style={s.roomIndexText}>{idx + 1}</Text></View>
              <Text style={s.roomName}>{room.roomName}</Text>
              {!!room.interiorType && <Text style={s.sub}>({room.interiorType})</Text>}
              {room.source === 'client' && (
                <View style={[s.pill, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}><Text style={[s.pillText, { color: '#047857' }]}>Client Intake</Text></View>
              )}
              {room.source === 'merged' && (
                <View style={[s.pill, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}><Text style={[s.pillText, { color: '#7E22CE' }]}>Merged</Text></View>
              )}
              {!!(room.designStyle || room.theme) && (
                <View style={[s.pill, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}><Text style={[s.pillText, { color: '#6D28D9' }]}>{room.designStyle || room.theme}</Text></View>
              )}
              {!!room.dimensions && (
                <View style={[s.pill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}><Text style={[s.pillText, { color: '#1D4ED8' }]}>{room.dimensions}</Text></View>
              )}
              {!!room.budget && (
                <View style={[s.pill, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}><Text style={[s.pillText, { color: '#B45309' }]}>{currencySymbol} {room.budget}</Text></View>
              )}
            </View>
            <View style={{ padding: 12, gap: 10 }}>
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <Text style={[s.sectionTitle, { color: '#059669' }]}>FUNCTIONAL REQUIREMENTS</Text>
                  <Text style={[s.sectionState, hasFunctional && { color: '#059669' }]}>{hasFunctional ? 'Specified' : 'Not specified'}</Text>
                </View>
                <Spec label="USAGE / PRIMARY PURPOSE" value={room.roomUsage} />
                <Spec label="FURNITURE & FIXTURES REQUIRED" value={room.furnitureRequirements} />
                <Spec label="STORAGE UNITS" value={room.storage} />
                <Spec label="ELECTRICAL / MEP POINTS" value={room.electricalPoints} color="#D97706" />
                <Spec label="LIGHTING REQUIREMENTS" value={room.lightingRequirements} color="#D97706" />
                <Spec label="PLUMBING REQUIREMENTS" value={room.plumbingRequirements} color="#0891B2" />
                <Spec label="CIRCULATION & CLEARANCE" value={room.circulation} />
                {!hasFunctional && <Text style={s.emptyText}>No functional specifications recorded for this space.</Text>}
              </View>
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <Text style={[s.sectionTitle, { color: '#7C3AED' }]}>AESTHETIC REQUIREMENTS</Text>
                  <Text style={[s.sectionState, hasAesthetic && { color: '#7C3AED' }]}>{hasAesthetic ? 'Specified' : 'Not specified'}</Text>
                </View>
                <Spec label="DESIGN STYLE" value={room.designStyle || room.theme} strong />
                {!!room.theme && !!room.designStyle && room.theme !== room.designStyle && <Spec label="THEME / MOOD" value={room.theme} />}
                <Spec label="COLOURS & PALETTE" value={room.colours} />
                <Spec label="MATERIALS & FINISHES" value={room.materials} />
                <Spec label="FLOORING PREFERENCES" value={room.flooring} />
                <Spec label="CEILING & FALSE CEILING" value={room.ceiling} />
                <Spec label="WALL FINISHES & PANELING" value={room.wallFinishes} />
                <Spec label="FURNITURE STYLE" value={room.furnitureStyle} />
                {!hasAesthetic && <Text style={s.emptyText}>No aesthetic requirements recorded for this space.</Text>}
              </View>
              {!!room.description && (
                <View style={[s.section, { backgroundColor: '#F8FAFC' }]}>
                  <Text style={s.specLabel}>SPACE OBSERVATIONS & PREFERENCES</Text>
                  <Text style={[s.specValue, { fontStyle: 'italic' }]}>“{room.description}”</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}

      <Modal visible={!!photo} transparent animationType="fade" onRequestClose={() => setPhoto(null)}>
        <TouchableOpacity style={s.lightbox} activeOpacity={1} onPress={() => setPhoto(null)}>
          {!!photo && <Image source={{ uri: photo }} style={s.lightboxImg} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, gap: 8 },
  bigIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  smallIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A', textAlign: 'center' },
  headTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  sub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center', lineHeight: 17 },
  link: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#2563EB' },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  btnText: { fontSize: 12, fontFamily: 'Inter-Bold' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1, alignSelf: 'center' },
  pillText: { fontSize: 10, fontFamily: 'Inter-Bold' },
  footerLine: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#FDE68A', flexWrap: 'wrap', justifyContent: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#F1F5F9' },
  roomHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  roomIndex: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  roomIndexText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  roomName: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  section: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 10, gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sectionTitle: { fontSize: 10.5, fontFamily: 'Inter-Black', letterSpacing: 0.4 },
  sectionState: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#94A3B8' },
  specLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3 },
  specValue: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: '#1E293B', lineHeight: 17 },
  emptyText: { fontSize: 11.5, fontFamily: 'Inter-Regular', fontStyle: 'italic', color: '#94A3B8' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  lightboxImg: { width: '100%', height: '80%' },
});

import { tr } from '../../utils/i18n/tr';
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
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, AppState, Image, Modal, ActivityIndicator, LayoutAnimation } from 'react-native';
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
      <Text style={[s.specLabel, color && { color }]}>{tr(label)}</Text>
      <Text style={[s.specValue, strong && { fontFamily: 'Inter-Bold', color: '#6D28D9' }]}>{tr(value)}</Text>
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
  // Rooms collapse to a one-line title so every space fits on one screen
  const [openRooms, setOpenRooms] = useState(() => new Set());
  const toggleRoom = (i) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleRoomState(i);
  };
  const toggleRoomState = (i) => setOpenRooms((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });
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
    const merged = t.map((teamReq) => {
      const key = teamReq.roomName.toLowerCase();
      const cr = byName.get(key);
      if (!cr) return teamReq;
      used.add(key);
      const out = { ...teamReq, source: 'merged' };
      Object.keys(teamReq).forEach((k) => {
        if (k !== 'source' && k !== 'description' && !teamReq[k]) out[k] = cr[k];
      });
      out.description = teamReq.description
        ? cr.description && cr.description !== teamReq.description ? `${teamReq.description} (Client: ${cr.description})` : teamReq.description
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
      showToast(e.message || tr("Failed to create share link"), 'error');
      return null;
    } finally {
      setBusy('');
    }
  };

  const copyLink = async () => {
    const url = await getOrCreateUrl();
    if (!url) return;
    await Clipboard.setStringAsync(url);
    showToast(tr("Client Requirements Link copied to clipboard!"), 'success');
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
      showToast(tr("Requirements status updated"), 'success');
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
      showToast(successMsg || tr("Link expiry set to {{value}}.", { value: EXPIRY_OPTIONS.find((o) => o.value === value)?.label || value }), 'success');
      onRefresh?.();
    } catch (e) {
      showToast(e.message || tr("Failed to update link expiry"), 'error');
    } finally {
      setBusy('');
    }
  };

  const stopLink = () => {
    Alert.alert(tr("Stop Client Intake Link?"), tr("The link will be deactivated immediately. The client will no longer be able to open the form or submit."), [
      { text: tr("Cancel"), style: 'cancel' },
      {
        text: tr("Stop Link"), style: 'destructive', onPress: async () => {
          setBusy('stop');
          try {
            await interiorCrmService.revokeShareLink(lead._id);
            showToast(tr("Client intake link stopped."), 'success');
            onRefresh?.();
          } catch (e) {
            showToast(e.message || tr("Failed to stop link"), 'error');
          } finally {
            setBusy('');
          }
        },
      },
    ]);
  };

  const discard = () => {
    if (hasPassedToSiteVisit) {
      showToast(tr("Cannot discard requirements after the lead has been passed to Site Visit."), 'error');
      return;
    }
    Alert.alert(tr("Discard Requirements"), tr("Discard all logged requirements for this lead? All room specifications will be cleared."), [
      { text: tr("Cancel"), style: 'cancel' },
      {
        text: tr("Discard"), style: 'destructive', onPress: async () => {
          setBusy('discard');
          try {
            await interiorCrmService.updateCustomer(lead._id, {
              requirements: [], clientRequirements: null, clientWishlist: null, clientRequirementsSubmittedAt: null,
            });
            await interiorCrmService.createActivity({ customer: lead._id, type: 'Requirement Gathering', status: 'Completed', remarks: 'Discarded/reset all room requirements.' });
            showToast(tr("Requirements discarded."), 'success');
            onRefresh?.();
          } catch (e) {
            showToast(e.message || tr("Failed to discard requirements"), 'error');
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
        <Text style={[s.btnText, { color: tones.fg }]}>{tr(label)}</Text>
      </TouchableOpacity>
    );
  };

  const ExpiryPill = () => (
    <View style={[s.pill, expiry.warn ? { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' } : { backgroundColor: '#F0FDFA', borderColor: '#99F6E4' }]}>
      <Ionicons name="time-outline" size={11} color={expiry.warn ? '#E11D48' : '#0F766E'} />
      <Text style={[s.pillText, { color: expiry.warn ? '#BE123C' : '#0F766E' }]}>{tr(expiry.label)}</Text>
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
            <Text style={[s.pillText, { color: '#B45309' }]}>{tr("AWAITING CLIENT SUBMISSION")}</Text>
          </View>
          <ExpiryPill />
        </View>
        <Text style={s.title}>{tr("Waiting for Client Input")}</Text>
        <Text style={s.sub}>{tr("The public intake link is active. Waiting for ")}{lead?.name || tr("the client")}{tr(" to submit room preferences online.")}</Text>
        <View style={s.btnRow}>
          <Btn icon="refresh" label={busy === 'sync' ? tr("Checking...") : tr("Check Status / Refresh")} tone="amber" onPress={refreshNow} loading={busy === 'sync'} />
          <Btn icon="copy-outline" label={tr("Copy Intake Link")} onPress={copyLink} loading={busy === 'link'} />
          {!!lead?.mobileNumber && <Btn icon="logo-whatsapp" label={tr("Send via WhatsApp")} tone="whatsapp" onPress={whatsApp} />}
        </View>
        <View style={{ alignSelf: 'stretch', marginTop: 10 }}>
          <Text style={[s.specLabel, { marginBottom: 4 }]}>{tr("SCHEDULE EXPIRY")}</Text>
          <SelectField
            value={expiryOptionFor(share.expiresAt)}
            onChange={(v) => setExpiry(v)}
            options={EXPIRY_OPTIONS}
            placeholder={tr("Custom")}
            disabled={busy === 'expiry'}
          />
        </View>
        {editable && (
          <View style={[s.btnRow, { marginTop: 10 }]}>
            <Btn icon="power-outline" label={busy === 'stop' ? tr("Stopping...") : tr("Stop Link")} tone="danger" onPress={stopLink} loading={busy === 'stop'} />
            {!!onOpenShare && <Btn icon="settings-outline" label={tr("Link Settings")} onPress={onOpenShare} />}
          </View>
        )}
        {editable && (
          <View style={s.footerLine}>
            <Text style={s.sub}>{tr("Want to take specs now?")}</Text>
            <TouchableOpacity onPress={onEditSpecs}>
              <Text style={s.link}>{tr("Enter Requirements Manually")}</Text>
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
          <Text style={[s.pillText, { color: '#BE123C' }]}>{isLinkStopped ? tr("● LINK STOPPED / DISABLED") : tr("● LINK EXPIRED")}</Text>
        </View>
        <Text style={s.title}>{isLinkStopped ? tr("Client Intake Link is Stopped") : tr("Client Intake Link has Expired")}</Text>
        <Text style={s.sub}>
          {isLinkStopped
            ? tr("The public requirements link is deactivated. Clients opening it will see that it has been disabled.")
            : tr("The scheduled expiry has passed. Reactivate the link or enter requirements directly.")}
        </Text>
        {editable && (
          <View style={s.btnRow}>
            <Btn icon="refresh" label={tr("Reactivate Link (7 Days)")} tone="green" onPress={() => setExpiry('168', 'Client intake link reactivated!')} loading={busy === 'expiry'} />
            <Btn icon="create-outline" label={tr("Enter Requirements Manually")} onPress={onEditSpecs} />
            {!!onOpenShare && <Btn icon="settings-outline" label={tr("Link Settings")} onPress={onOpenShare} />}
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
        <Text style={s.title}>{tr("No Requirements Logged Yet")}</Text>
        <Text style={s.sub}>{tr("Add project specifications directly or generate an online intake link for the client.")}</Text>
        {editable && (
          <View style={s.btnRow}>
            <Btn icon="add" label={tr("Create Requirements")} tone="green" onPress={onEditSpecs} />
            <Btn icon="share-social-outline" label={tr("Generate & Copy Client Link")} onPress={copyLink} loading={busy === 'link'} />
            {!!onOpenShare && <Btn icon="settings-outline" label={tr("Link Settings")} onPress={onOpenShare} />}
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
            <Text style={s.headTitle}>{tr("Room Specifications (")}{rooms.length} {rooms.length === 1 ? tr("Area") : tr("Areas")})</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {clientSubmittedAt ? (
                <View style={[s.pill, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Text style={[s.pillText, { color: '#047857' }]}>{tr("✓ Client Submitted")}</Text>
                </View>
              ) : (
                <View style={[s.pill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={[s.pillText, { color: '#1D4ED8' }]}>{tr("Team Recorded")}</Text>
                </View>
              )}
              {!!clientSubmittedAt && isLinkActive && (
                <View style={[s.pill, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                  <Text style={[s.pillText, { color: '#B45309' }]}>{tr("Link Reactivated (Client Can Edit)")}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={[s.btnRow, { justifyContent: 'flex-start', marginTop: 10 }]}>
          {isLinkActive && (
            <>
              <Btn icon="copy-outline" label={tr("Share Link")} onPress={copyLink} loading={busy === 'link'} />
              <ExpiryPill />
              {editable && <Btn icon="power-outline" label={busy === 'stop' ? tr("Stopping...") : tr("Stop Link")} tone="danger" onPress={stopLink} loading={busy === 'stop'} />}
            </>
          )}
          {!!share.shareToken && (isLinkStopped || isLinkExpired) && (
            <>
              <View style={[s.pill, { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]}>
                <Text style={[s.pillText, { color: '#BE123C' }]}>{isLinkStopped ? tr("Link Disabled (Submitted)") : tr("Link Expired")}</Text>
              </View>
              {editable && <Btn icon="refresh" label={tr("Reactivate Link")} tone="successSoft" onPress={() => setExpiry('168', 'Client intake link reactivated!')} loading={busy === 'expiry'} />}
            </>
          )}
          {!!onOpenShare && editable && <Btn icon="settings-outline" label={tr("Settings")} onPress={onOpenShare} />}
          {editable && !hasPassedToSiteVisit && (
            <Btn icon="trash-outline" label={busy === 'discard' ? tr("Discarding...") : tr("Discard")} tone="danger" onPress={discard} loading={busy === 'discard'} />
          )}
        </View>
      </View>

      {!!clientNotes && (
        <View style={[s.card, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}>
          <Text style={[s.specLabel, { color: '#7E22CE' }]}>{tr("CLIENT STATED DIRECTIVES & VISION")}</Text>
          <Text style={[s.specValue, { fontStyle: 'italic' }]}>“{tr(clientNotes)}”</Text>
        </View>
      )}

      {inspirationImages.length > 0 && (
        <View style={s.card}>
          <Text style={s.specLabel}>{tr("CLIENT INSPIRATION MOODBOARD (")}{inspirationImages.length}{tr(" PHOTOS)")}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {inspirationImages.map((img, i) => (
              <TouchableOpacity key={i} onPress={() => setPhoto(img)}>
                <Image source={{ uri: img }} style={s.thumb} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={s.spacesBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.spacesTitle}>{tr("Spaces")}</Text>
          <Text style={s.spacesCount}>{rooms.length}</Text>
        </View>
        {rooms.length > 1 && (
          <TouchableOpacity
            style={s.expandBtn}
            activeOpacity={0.7}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setOpenRooms(openRooms.size === rooms.length ? new Set() : new Set(rooms.map((_, i) => i)));
            }}
          >
            <Ionicons name={openRooms.size === rooms.length ? 'chevron-up' : 'chevron-down'} size={13} color="#334155" />
            <Text style={s.expandText}>{openRooms.size === rooms.length ? tr("Collapse all") : tr("Expand all")}</Text>
          </TouchableOpacity>
        )}
      </View>
      {rooms.map((room, idx) => {
        const isOpen = openRooms.has(idx);
        const functionalFields = [room.roomUsage, room.furnitureRequirements, room.storage, room.electricalPoints, room.lightingRequirements, room.plumbingRequirements, room.circulation];
        const aestheticFields = [room.designStyle || room.theme, room.colours, room.materials, room.flooring, room.ceiling, room.wallFinishes, room.furnitureStyle];
        const hasFunctional = functionalFields.some(Boolean);
        const hasAesthetic = aestheticFields.some(Boolean);
        const specTotal = functionalFields.length + aestheticFields.length;
        const specFilled = [...functionalFields, ...aestheticFields].filter(Boolean).length;
        const specPct = specFilled / specTotal;
        const metaBits = [room.interiorType, room.designStyle || room.theme, room.dimensions].filter(Boolean).map((b) => tr(b));
        return (
          <View key={idx} style={[s.card, { padding: 0, overflow: 'hidden' }, isOpen && s.cardOpen]}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => toggleRoom(idx)} style={[s.roomHead, isOpen ? s.roomHeadOpen : { borderBottomWidth: 0 }]}>
              <View style={[s.roomIndex, !isOpen && s.roomIndexIdle]}>
                <Text style={[s.roomIndexText, !isOpen && { color: '#2563EB' }]}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[s.roomName, { flexShrink: 1 }]} numberOfLines={1}>{tr(room.roomName)}</Text>
                  {room.source === 'client' && (
                    <View style={[s.pill, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}><Text style={[s.pillText, { color: '#047857' }]}>{tr("Client Intake")}</Text></View>
                  )}
                  {room.source === 'merged' && (
                    <View style={[s.pill, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}><Text style={[s.pillText, { color: '#7E22CE' }]}>{tr("Merged")}</Text></View>
                  )}
                </View>
                {metaBits.length > 0 && <Text style={s.roomMeta} numberOfLines={1}>{metaBits.join(' · ')}</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={s.specTrack}>
                    <View style={[s.specFill, { width: `${Math.round(specPct * 100)}%`, backgroundColor: specPct >= 0.7 ? '#10B981' : specPct >= 0.35 ? '#F59E0B' : '#FB7185' }]} />
                  </View>
                  <Text style={s.specText}>{specFilled}/{specTotal} {tr("specs")}</Text>
                  {!!room.budget && <Text style={s.budgetText} numberOfLines={1}>{tr(currencySymbol)} {tr(room.budget)}</Text>}
                </View>
              </View>
              <View style={[s.chevron, isOpen && s.chevronOpen]}>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={isOpen ? '#2563EB' : '#64748B'} />
              </View>
            </TouchableOpacity>
            {isOpen && (
            <View style={{ padding: 12, gap: 10 }}>
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <Text style={[s.sectionTitle, { color: '#059669' }]}>{tr("FUNCTIONAL REQUIREMENTS")}</Text>
                  <Text style={[s.sectionState, hasFunctional && { color: '#059669' }]}>{hasFunctional ? tr("Specified") : tr("Not specified")}</Text>
                </View>
                <Spec label={tr("USAGE / PRIMARY PURPOSE")} value={room.roomUsage} />
                <Spec label={tr("FURNITURE & FIXTURES REQUIRED")} value={room.furnitureRequirements} />
                <Spec label={tr("STORAGE UNITS")} value={room.storage} />
                <Spec label={tr("ELECTRICAL / MEP POINTS")} value={room.electricalPoints} color="#D97706" />
                <Spec label={tr("LIGHTING REQUIREMENTS")} value={room.lightingRequirements} color="#D97706" />
                <Spec label={tr("PLUMBING REQUIREMENTS")} value={room.plumbingRequirements} color="#0891B2" />
                <Spec label={tr("CIRCULATION & CLEARANCE")} value={room.circulation} />
                {!hasFunctional && <Text style={s.emptyText}>{tr("No functional specifications recorded for this space.")}</Text>}
              </View>
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <Text style={[s.sectionTitle, { color: '#7C3AED' }]}>{tr("AESTHETIC REQUIREMENTS")}</Text>
                  <Text style={[s.sectionState, hasAesthetic && { color: '#7C3AED' }]}>{hasAesthetic ? tr("Specified") : tr("Not specified")}</Text>
                </View>
                <Spec label={tr("DESIGN STYLE")} value={room.designStyle || room.theme} strong />
                {!!room.theme && !!room.designStyle && room.theme !== room.designStyle && <Spec label={tr("THEME / MOOD")} value={room.theme} />}
                <Spec label={tr("COLOURS & PALETTE")} value={room.colours} />
                <Spec label={tr("MATERIALS & FINISHES")} value={room.materials} />
                <Spec label={tr("FLOORING PREFERENCES")} value={room.flooring} />
                <Spec label={tr("CEILING & FALSE CEILING")} value={room.ceiling} />
                <Spec label={tr("WALL FINISHES & PANELING")} value={room.wallFinishes} />
                <Spec label={tr("FURNITURE STYLE")} value={room.furnitureStyle} />
                {!hasAesthetic && <Text style={s.emptyText}>{tr("No aesthetic requirements recorded for this space.")}</Text>}
              </View>
              {!!room.description && (
                <View style={[s.section, { backgroundColor: '#F8FAFC' }]}>
                  <Text style={s.specLabel}>{tr("SPACE OBSERVATIONS & PREFERENCES")}</Text>
                  <Text style={[s.specValue, { fontStyle: 'italic' }]}>“{tr(room.description)}”</Text>
                </View>
              )}
            </View>
            )}
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
  sub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center', lineHeight: 17 },
  link: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#2563EB' },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  btnText: { fontSize: 13, fontFamily: 'Inter-Bold' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1, alignSelf: 'center' },
  pillText: { fontSize: 11.5, fontFamily: 'Inter-Bold' },
  footerLine: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#FDE68A', flexWrap: 'wrap', justifyContent: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#F1F5F9' },
  spacesBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  spacesTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  spacesCount: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#64748B', backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: 'hidden' },
  expandBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  expandText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#334155' },
  cardOpen: { borderColor: '#93C5FD' },
  roomHeadOpen: { backgroundColor: '#F5F9FF' },
  roomIndexIdle: { backgroundColor: '#EFF6FF' },
  roomMeta: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B' },
  specTrack: { width: 54, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  specFill: { height: 4, borderRadius: 2 },
  specText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  budgetText: { flexShrink: 1, fontSize: 11, fontFamily: 'Inter-Bold', color: '#B45309' },
  chevron: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  chevronOpen: { backgroundColor: '#EFF6FF' },
  roomHead: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  roomIndex: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  roomIndexText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  roomName: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  section: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 10, gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sectionTitle: { fontSize: 12, fontFamily: 'Inter-Bold', letterSpacing: 0.4 },
  sectionState: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#94A3B8' },
  specLabel: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.3 },
  specValue: { fontSize: 13.5, fontFamily: 'Inter-Medium', color: '#1E293B', lineHeight: 17 },
  emptyText: { fontSize: 13, fontFamily: 'Inter-Regular', fontStyle: 'italic', color: '#94A3B8' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  lightboxImg: { width: '100%', height: '80%' },
});

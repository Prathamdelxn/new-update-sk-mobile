// =============================================================================
// Client requirements intake (mobile port of the web Client Requirements Intake
// Portal ribbon + InteriorComparativeRequirementsView — see latest.md):
//   • portal ribbon: link status, client submitted / awaiting, Preview / Share / WhatsApp
//   • dual summary cards: client link submission vs our technical person
//   • view filter: Side-by-Side / Client Wishlist / Team Technical Brief
//   • room matrix: client wishlist and team specs per room (stacked on phones)
// Client data: lead.clientRequirements(+Notes, SubmittedAt); team data: lead.requirements.
// =============================================================================

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WEB_APP_URL } from '../../config';

const VIEW_MODES = [
  { key: 'side_by_side', label: 'Side-by-Side' },
  { key: 'client_only', label: 'Client Wishlist' },
  { key: 'team_only', label: 'Team Brief' },
];

const fmtDateTime = (d) => new Date(d).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function Field({ label, value }) {
  if (!value) return null;
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{value}</Text>
    </View>
  );
}

/**
 * @param lead            CRM lead
 * @param techPersonName  name shown for "Our Technical Person"
 * @param canShare        may generate / share the intake link
 * @param canEditSpecs    may log / edit the team's technical specs
 * @param onOpenShare     open the share modal in requirements mode
 * @param onEditSpecs     open the team requirements form
 */
export default function ClientRequirementsCompare({ lead, techPersonName, canShare, canEditSpecs, onOpenShare, onEditSpecs }) {
  const [viewMode, setViewMode] = useState('side_by_side');

  const share = lead?.shareSettings || {};
  const isExpired = Boolean(share.expiresAt && new Date(share.expiresAt).getTime() < Date.now());
  const isLinkActive = Boolean(share.shareToken && share.isPublic && !isExpired);
  const formUrl = share.shareToken ? `${WEB_APP_URL}/share/requirements/${share.shareToken}` : '';

  // Client submission (public intake portal), normalized like the web
  const clientRooms = useMemo(() => {
    const raw = Array.isArray(lead?.clientRequirements)
      ? lead.clientRequirements
      : Array.isArray(lead?.clientRequirements?.rooms) ? lead.clientRequirements.rooms
      : Array.isArray(lead?.clientWishlist?.rooms) ? lead.clientWishlist.rooms : [];
    return raw.map((r, idx) => ({
      roomName: String(r.roomName || r.name || r.room || `Space ${idx + 1}`).trim(),
      designStyle: r.designStyle || r.style || r.theme || '',
      interiorType: r.interiorType || r.type || '',
      wishedItems: r.furnitureRequirements || r.wishedItems || (Array.isArray(r.furniture) ? r.furniture.join(', ') : r.furniture || ''),
      storage: r.storage || r.storageRequirements || '',
      lighting: r.lightingRequirements || '',
      colours: r.colours || r.colors || '',
      materials: r.materials || '',
      notes: r.aestheticNotes || r.description || r.notes || r.remarks || '',
      budget: r.budget || '',
    }));
  }, [lead?.clientRequirements, lead?.clientWishlist]);
  const clientSubmittedAt = lead?.clientRequirementsSubmittedAt || lead?.clientRequirements?.submittedAt || lead?.clientWishlist?.submittedAt;
  const clientNotes = lead?.clientRequirementsNotes || lead?.clientWishlist?.generalNotes || '';
  const hasClientSubmitted = Boolean(clientSubmittedAt || clientRooms.length > 0);

  const teamRooms = Array.isArray(lead?.requirements) ? lead.requirements : [];
  const primaryStyle = teamRooms.find((r) => r.designStyle)?.designStyle || teamRooms.find((r) => r.theme)?.theme || '—';

  const roomNames = useMemo(() => {
    const names = [...clientRooms.map((r) => r.roomName), ...teamRooms.map((r) => String(r.roomName || r.room || r.name || '').trim())];
    const seen = new Set();
    return names.filter((n) => {
      const key = n.toLowerCase();
      if (!n || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [clientRooms, teamRooms]);

  const findRoom = (list, name, getName) => list.find((r) => String(getName(r) || '').trim().toLowerCase() === name.toLowerCase());

  const openWhatsApp = () => {
    if (!formUrl) return;
    const msg = `Hello ${lead?.name || 'Client'},\n\nPlease fill out your interior design requirements & room wishlist using this link:\n${formUrl}\n\nOur design team will review your preferences and specifications right away!`;
    const phone = String(lead?.mobileNumber || '').replace(/\D/g, '');
    Linking.openURL(phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`).catch(() => {});
  };

  const linkBadge = isLinkActive ? { t: 'Active', c: '#059669' } : isExpired ? { t: 'Expired', c: '#DC2626' } : { t: 'Unpublished', c: '#D97706' };

  return (
    <View style={{ gap: 12 }}>
      {/* Client Requirements Intake Portal ribbon */}
      <View style={s.ribbon}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={s.ribbonIcon}>
            <Ionicons name="globe-outline" size={17} color="#0D9488" />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.ribbonTitle}>Client Requirements Intake Portal</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <View style={[s.badge, { backgroundColor: linkBadge.c + '18', borderColor: linkBadge.c + '40' }]}>
                <Text style={[s.badgeText, { color: linkBadge.c }]}>{linkBadge.t}</Text>
              </View>
              <View style={[s.badge, hasClientSubmitted ? { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' } : { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                <Text style={[s.badgeText, { color: hasClientSubmitted ? '#047857' : '#B45309' }]}>{hasClientSubmitted ? '✓ Client Submitted' : 'Awaiting Client'}</Text>
              </View>
            </View>
          </View>
        </View>
        <Text style={s.ribbonSub}>
          {hasClientSubmitted && clientSubmittedAt
            ? `Client submitted specifications on ${fmtDateTime(clientSubmittedAt)}`
            : 'Share this link so the client can self-fill their room preferences, style wishlist and budget.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {isLinkActive && (
            <TouchableOpacity style={s.btnOutline} onPress={() => Linking.openURL(formUrl).catch(() => {})}>
              <Ionicons name="open-outline" size={13} color="#334155" />
              <Text style={s.btnOutlineText}>Preview Form</Text>
            </TouchableOpacity>
          )}
          {canShare && (
            <TouchableOpacity style={[s.btn, { backgroundColor: '#0D9488' }]} onPress={onOpenShare}>
              <Ionicons name="share-social-outline" size={13} color="#FFFFFF" />
              <Text style={s.btnText}>{isLinkActive ? 'Share Link' : 'Generate Link'}</Text>
            </TouchableOpacity>
          )}
          {isLinkActive && (
            <TouchableOpacity style={[s.btn, { backgroundColor: '#16A34A' }]} onPress={openWhatsApp}>
              <Ionicons name="logo-whatsapp" size={13} color="#FFFFFF" />
              <Text style={s.btnText}>WhatsApp</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Dual summary cards */}
      <View style={s.summaryCard}>
        <Text style={[s.summaryKicker, { color: '#7C3AED' }]}>SUBMITTED VIA CLIENT LINK</Text>
        <Text style={s.summaryName}>{lead?.name || 'Client'}</Text>
        <View style={s.summaryRow}>
          <View style={s.summaryCell}>
            <Text style={s.cellLabel}>STATUS</Text>
            <Text style={[s.cellValue, { color: hasClientSubmitted ? '#047857' : '#B45309' }]}>{hasClientSubmitted ? 'Client Submitted' : 'Awaiting Submission'}</Text>
          </View>
          <View style={s.summaryCell}>
            <Text style={s.cellLabel}>SUBMISSION DATE</Text>
            <Text style={s.cellValue}>{clientSubmittedAt ? fmtDateTime(clientSubmittedAt) : '—'}</Text>
          </View>
          <View style={s.summaryCell}>
            <Text style={s.cellLabel}>CUSTOMER SPACES</Text>
            <Text style={s.cellValue}>{clientRooms.length}</Text>
          </View>
        </View>
        {!!clientNotes && (
          <View style={[s.field, { marginTop: 8 }]}>
            <Text style={s.fieldLabel}>CLIENT NOTES & LIVING STYLE</Text>
            <Text style={s.fieldValue}>{clientNotes}</Text>
          </View>
        )}
      </View>

      <View style={s.summaryCard}>
        <Text style={[s.summaryKicker, { color: '#059669' }]}>OUR TECHNICAL PERSON</Text>
        <Text style={s.summaryName}>{techPersonName || 'Requirement Consultant'}</Text>
        <View style={s.summaryRow}>
          <View style={s.summaryCell}>
            <Text style={s.cellLabel}>STATUS</Text>
            <Text style={[s.cellValue, { color: teamRooms.length ? '#047857' : '#B45309' }]}>{teamRooms.length ? 'Specs Recorded' : 'Survey Pending'}</Text>
          </View>
          <View style={s.summaryCell}>
            <Text style={s.cellLabel}>SURVEYED SPACES</Text>
            <Text style={s.cellValue}>{teamRooms.length}</Text>
          </View>
          <View style={[s.summaryCell, { flexBasis: '100%' }]}>
            <Text style={s.cellLabel}>PRIMARY STYLE</Text>
            <Text style={s.cellValue} numberOfLines={1}>{primaryStyle}</Text>
          </View>
        </View>
        {canEditSpecs && (
          <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', alignSelf: 'flex-start', marginTop: 10 }]} onPress={onEditSpecs}>
            <Ionicons name={teamRooms.length ? 'create-outline' : 'add'} size={14} color="#FFFFFF" />
            <Text style={s.btnText}>{teamRooms.length ? 'Edit Technical Specs' : 'Log Technical Specs'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* View filter */}
      <View style={s.pills}>
        {VIEW_MODES.map((m) => (
          <TouchableOpacity key={m.key} style={[s.pill, viewMode === m.key && s.pillActive]} onPress={() => setViewMode(m.key)}>
            <Text style={[s.pillText, viewMode === m.key && s.pillTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Room matrix */}
      {roomNames.length === 0 ? (
        <View style={[s.summaryCard, { alignItems: 'center', paddingVertical: 24 }]}>
          <Ionicons name="home-outline" size={30} color="#CBD5E1" />
          <Text style={[s.summaryName, { marginTop: 6 }]}>No Room Requirements Logged Yet</Text>
          <Text style={[s.ribbonSub, { textAlign: 'center' }]}>Share the intake link with the client, or log the technical specs.</Text>
        </View>
      ) : (
        roomNames.map((name) => {
          const c = findRoom(clientRooms, name, (r) => r.roomName);
          const t = findRoom(teamRooms, name, (r) => r.roomName || r.room || r.name);
          if (viewMode === 'client_only' && !c) return null;
          if (viewMode === 'team_only' && !t) return null;
          return (
            <View key={name} style={s.roomCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Ionicons name="cube-outline" size={16} color="#2563EB" />
                <Text style={s.roomName}>{name}</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {c && <View style={[s.dot, { backgroundColor: '#8B5CF6' }]} />}
                  {t && <View style={[s.dot, { backgroundColor: '#10B981' }]} />}
                </View>
              </View>

              {viewMode !== 'team_only' && (
                <View style={[s.side, { borderColor: '#DDD6FE', backgroundColor: '#FAF5FF' }]}>
                  <Text style={[s.sideTitle, { color: '#6D28D9' }]}>Submitted by client through link</Text>
                  {c ? (
                    <>
                      {!!c.designStyle && (
                        <View style={[s.badge, { alignSelf: 'flex-start', backgroundColor: '#EDE9FE', borderColor: '#DDD6FE', marginBottom: 4 }]}>
                          <Text style={[s.badgeText, { color: '#6D28D9' }]}>{c.designStyle}</Text>
                        </View>
                      )}
                      <Field label="Furniture & fixtures wishlist" value={c.wishedItems} />
                      <Field label="Storage" value={c.storage} />
                      <Field label="Lighting" value={c.lighting} />
                      <Field label="Colours" value={c.colours} />
                      <Field label="Materials" value={c.materials} />
                      <Field label="Room budget" value={c.budget} />
                      <Field label="Client notes" value={c.notes} />
                    </>
                  ) : (
                    <Text style={s.emptyText}>Client hasn't added this space.</Text>
                  )}
                </View>
              )}

              {viewMode !== 'client_only' && (
                <View style={[s.side, { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4', marginTop: viewMode === 'side_by_side' ? 8 : 0 }]}>
                  <Text style={[s.sideTitle, { color: '#047857' }]}>Filled by our technical person{techPersonName ? ` (${techPersonName})` : ''}</Text>
                  {t ? (
                    <>
                      <Field label="Usage / function" value={t.roomUsage} />
                      <Field label="Design theme" value={t.designStyle || t.theme} />
                      <Field label="Storage units" value={t.storage} />
                      <Field label="Electrical / MEP" value={[t.electricalPoints, t.lightingRequirements, t.plumbingRequirements].filter(Boolean).join(' • ')} />
                      <Field label="Furniture" value={t.furnitureRequirements} />
                      <Field label="Materials" value={t.materials} />
                      <Field label="Walls / ceiling / flooring" value={[t.wallFinishes, t.ceiling, t.flooring].filter(Boolean).join(' • ')} />
                      <Field label="Notes" value={t.description} />
                    </>
                  ) : (
                    <Text style={s.emptyText}>Not surveyed yet.</Text>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const s = StyleSheet.create({
  ribbon: { backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99F6E4', borderRadius: 16, padding: 14 },
  ribbonIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  ribbonTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  ribbonSub: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 8, lineHeight: 16 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontFamily: 'Inter-Bold' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  btnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  btnOutlineText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#334155' },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14 },
  summaryKicker: { fontSize: 10, fontFamily: 'Inter-Bold', letterSpacing: 0.5 },
  summaryName: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  summaryCell: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 10, padding: 8 },
  cellLabel: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 0.4 },
  cellValue: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 2 },
  pills: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3 },
  pill: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  pillActive: { backgroundColor: '#0F172A' },
  pillText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#64748B' },
  pillTextActive: { color: '#FFFFFF' },
  roomCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14 },
  roomName: { flex: 1, fontSize: 14.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  side: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 6 },
  sideTitle: { fontSize: 10.5, fontFamily: 'Inter-Bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  field: { gap: 1 },
  fieldLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.3 },
  fieldValue: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: '#1E293B', lineHeight: 17 },
  emptyText: { fontSize: 12, fontFamily: 'Inter-Regular', fontStyle: 'italic', color: '#94A3B8' },
});

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function getUserDisplayName(userRef, users) {
  if (!userRef) return 'Assigned Member';
  const uId = typeof userRef === 'object' ? (userRef._id || userRef.id || userRef.clerkUserId) : userRef;
  const matched = users.find((u) => u._id === uId || u.id === uId || u.clerkUserId === uId);
  if (matched) {
    return matched.fullName || `${matched.firstName || ''} ${matched.lastName || ''}`.trim() || matched.name || 'Team Member';
  }
  if (typeof userRef === 'object') {
    return userRef.fullName || `${userRef.firstName || ''} ${userRef.lastName || ''}`.trim() || userRef.name || 'Team Member';
  }
  return 'Team Member';
}

export default function SiteVisitHistoryModal({
  visible,
  onClose,
  activities = [],
  users = [],
  leadName,
  onReschedule,
  isReadOnly = false,
}) {
  const siteVisits = activities
    .filter((a) => a.type === 'Site Visit' && (a.scheduledDate || a.remarks || a.status))
    .sort((a, b) => {
      const timeA = new Date(a.scheduledDate || a.createdAt).getTime();
      const timeB = new Date(b.scheduledDate || b.createdAt).getTime();
      return timeB - timeA;
    });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={s.iconBox}>
                <Ionicons name="time-outline" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={s.title}>Previous Site Visit Schedules</Text>
                  <View style={s.countPill}>
                    <Text style={s.countPillText}>{siteVisits.length} {siteVisits.length === 1 ? 'Record' : 'Records'}</Text>
                  </View>
                </View>
                <Text style={s.subtitle} numberOfLines={2}>
                  Full schedule history, assigned site members, and instructions{leadName ? ` for ${leadName}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
            {siteVisits.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="calendar-outline" size={32} color="#94A3B8" />
                <Text style={s.emptyTitle}>No Previous Site Visit Records</Text>
                <Text style={s.emptySub}>
                  When site visits are scheduled or rescheduled, the full audit trail and previous dates will appear here.
                </Text>
              </View>
            ) : (
              siteVisits.map((item, idx) => {
                const assignedName = getUserDisplayName(item.user, users);
                const isItemPending = item.status === 'Pending';
                const isOverdue = Boolean(isItemPending && item.scheduledDate && new Date(item.scheduledDate).getTime() < Date.now());
                const isLatest = idx === 0;

                const badgeText = isOverdue
                  ? 'Overdue'
                  : item.status === 'Completed'
                  ? 'Survey Completed'
                  : isLatest
                  ? 'Active Schedule'
                  : 'Archived / Past';
                const badgeColor = isOverdue ? '#DC2626' : item.status === 'Completed' ? '#16A34A' : isLatest ? '#7C3AED' : '#64748B';
                const badgeBg = isOverdue ? '#FEF2F2' : item.status === 'Completed' ? '#F0FDF4' : isLatest ? '#F5F3FF' : '#F8FAFC';

                return (
                  <View key={item._id || idx} style={[s.visitCard, isLatest && (isOverdue ? s.visitCardOverdue : s.visitCardActive)]}>
                    <View style={s.visitCardHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                        <Ionicons name="location-outline" size={13} color={isLatest ? '#7C3AED' : '#64748B'} />
                        <Text style={s.visitCardLabel}>
                          {isLatest ? 'Current / Latest Schedule' : `Previous Schedule #${siteVisits.length - idx}`}
                        </Text>
                        <View style={[s.statusBadge, { backgroundColor: badgeBg }]}>
                          <Text style={[s.statusBadgeText, { color: badgeColor }]}>{badgeText}</Text>
                        </View>
                      </View>
                    </View>

                    {!!item.scheduledDate && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                        <Ionicons name="time-outline" size={12} color={isOverdue ? '#DC2626' : '#7C3AED'} />
                        <Text style={s.visitDateText}>
                          {new Date(item.scheduledDate).toLocaleString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    )}

                    <View style={s.notesBox}>
                      <Text style={s.notesLabel}>INSTRUCTIONS / SITE NOTES</Text>
                      <Text style={s.notesText}>{item.remarks || 'No specific instructions entered.'}</Text>
                    </View>

                    <View style={s.footerRow}>
                      <Text style={s.footerText}>
                        Assigned: <Text style={s.footerTextBold}>{assignedName}</Text>
                      </Text>
                      {!!item.createdAt && (
                        <Text style={s.footerText}>
                          Logged: {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.closeFooterBtn} onPress={onClose}>
              <Text style={s.closeFooterBtnText}>Close</Text>
            </TouchableOpacity>
            {!isReadOnly && !!onReschedule && (
              <TouchableOpacity
                style={s.rescheduleBtn}
                onPress={() => { onClose(); onReschedule(); }}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
                <Text style={s.rescheduleBtnText}>Reschedule Site Visit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden', maxHeight: '86%', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  subtitle: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 3, lineHeight: 15 },
  countPill: { backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  countPillText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#7C3AED' },
  closeBtn: { padding: 6, backgroundColor: '#F8FAFC', borderRadius: 10 },
  emptyBox: { alignItems: 'center', paddingVertical: 32, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', gap: 6 },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  emptySub: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', paddingHorizontal: 24, lineHeight: 16 },
  visitCard: { borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14 },
  visitCardActive: { backgroundColor: '#FAF5FF', borderColor: 'rgba(124,58,237,0.3)' },
  visitCardOverdue: { backgroundColor: '#FEF2F2', borderColor: 'rgba(220,38,38,0.3)' },
  visitCardHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.8)' },
  visitCardLabel: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  statusBadgeText: { fontSize: 9, fontFamily: 'Inter-ExtraBold', textTransform: 'uppercase' },
  visitDateText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#0F172A' },
  notesBox: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 10, marginTop: 10 },
  notesLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#64748B', letterSpacing: 0.3 },
  notesText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#334155', marginTop: 4, lineHeight: 17 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  footerText: { fontSize: 10.5, fontFamily: 'Inter-Medium', color: '#64748B' },
  footerTextBold: { fontFamily: 'Inter-Bold', color: '#0F172A' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#F8FAFC' },
  closeFooterBtn: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  closeFooterBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#475569' },
  rescheduleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#7C3AED' },
  rescheduleBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

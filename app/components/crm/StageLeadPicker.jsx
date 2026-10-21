// =============================================================================
// Interior CRM — pick a lead to bring into a stage
// Leads normally reach a stage from the previous tab. Users who can create in a
// stage but can't see the earlier tabs pick the lead here; the lead then opens
// on that stage's "send to" form (same as the web "Add to <stage>" button).
// =============================================================================

import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function StageLeadPicker({ visible, title, leads, onClose, onPick }) {
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.mobileNumber, l.email, l.city, l.status].some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [leads, query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{title}</Text>
              <Text style={s.sub}>Choose the lead to bring into this stage</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={s.searchBox}>
            <Ionicons name="search" size={16} color="#94A3B8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, phone, city…"
              placeholderTextColor="#94A3B8"
              style={s.searchInput}
            />
          </View>

          <FlatList
            data={shown}
            keyExtractor={(item) => item._id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={s.empty}>
                {leads.length === 0 ? 'No leads are waiting to enter this stage.' : 'No leads match your search.'}
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.row}
                activeOpacity={0.7}
                onPress={() => {
                  onClose();
                  onPick(item._id);
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {[item.mobileNumber, item.city].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </View>
                <View style={s.badge}>
                  <Text style={s.badgeText}>{item.status}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  title: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  sub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter-Regular', color: '#0F172A' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  name: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  meta: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#F1F5F9' },
  badgeText: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#475569' },
  empty: { textAlign: 'center', color: '#94A3B8', fontSize: 13, fontFamily: 'Inter-Regular', paddingVertical: 40 },
});

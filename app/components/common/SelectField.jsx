// Dropdown field: shows the selected option and opens an inline list
// (works inside modals and scroll views). options: [{ value, label }] or strings.
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SelectField({ value, onChange, options = [], placeholder = 'Select…', style, disabled = false }) {
  const [open, setOpen] = useState(false);
  const list = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const selected = list.find((o) => o.value === value);

  return (
    <View style={style}>
      <TouchableOpacity
        style={[s.field, open && s.fieldOpen, disabled && { opacity: 0.6 }]}
        onPress={() => !disabled && setOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={[s.text, !selected && s.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
      </TouchableOpacity>
      {open && (
        <View style={s.menu}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 220 }}>
            {list.length === 0 ? (
              <Text style={s.empty}>No options</Text>
            ) : (
              list.map((o, idx) => {
                const active = o.value === value;
                return (
                  <TouchableOpacity
                    key={`${o.value}-${idx}`}
                    style={[s.item, active && s.itemActive, idx === list.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[s.itemText, active && s.itemTextActive]} numberOfLines={1}>{o.label}</Text>
                    {active && <Ionicons name="checkmark" size={15} color="#2563EB" />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  fieldOpen: { borderColor: '#93C5FD', backgroundColor: '#FFFFFF' },
  text: { flex: 1, marginRight: 8, fontSize: 13.5, fontFamily: 'Inter-Medium', color: '#0F172A' },
  placeholder: { color: '#94A3B8' },
  menu: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemActive: { backgroundColor: '#EFF6FF' },
  itemText: { flex: 1, marginRight: 8, fontSize: 13, fontFamily: 'Inter-Medium', color: '#334155' },
  itemTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },
  empty: { padding: 14, fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },
});

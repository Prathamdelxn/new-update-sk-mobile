import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Mirrors InteriorProjectBanner's category nav from sky-lite-web.
export const CATEGORIES = [
  { name: 'General', icon: '📋', items: ['Site Details', 'File Management', 'Team & Members'] },
  { name: 'Execution', icon: '📐', items: ['WBS Hierarchy', 'Tasks (Kanban)', 'Milestones', 'DPR Log', 'Weekly Reports', 'MOM'] },
  { name: 'Commercials', icon: '💰', items: ['BOQ Estimator', 'Change Requests', 'Variation Orders', 'Procurement', 'Purchase Orders', 'Vendors', 'Payments', 'Project Quotation'] },
  { name: 'Quality & Safety', icon: '🔍', items: ['Snags Logger', 'NCR Register', 'Risks Matrix'] },
  { name: 'Site Assets', icon: '📂', items: ['CAD Drawings', 'RFIs Tracker', 'Utility Checks', 'Site Photos', 'Project Handover'] },
];

export default function CategoryNav({ projectId, activeItem, comingSoon }) {
  const router = useRouter();
  const [openCategory, setOpenCategory] = useState(null);

  const go = (path) => router.push(`/i-project/${projectId}/${path}`);

  const handleItemPress = (item) => {
    setOpenCategory(null);
    switch (item) {
      case 'Tasks (Kanban)': return go('tasks');
      case 'Milestones': return go('milestones');
      case 'Snags Logger': return go('snags');
      case 'Risks Matrix': return go('risks');
      case 'RFIs Tracker': return go('rfis');
      case 'NCR Register': return go('ncrs');
      case 'Team & Members': return go('members');
      case 'WBS Hierarchy': return go('wbs');
      case 'Procurement':
      case 'Purchase Orders': return go('procurement');
      case 'Vendors': return go('vendors');
      case 'DPR Log': return go('dpr');
      case 'Weekly Reports': return go('weekly-reports');
      case 'MOM': return go('mom');
      case 'Utility Checks': return go('utilities');
      case 'Site Photos': return go('photos');
      case 'CAD Drawings': return go('drawings');
      case 'Project Handover': return go('handover');
      case 'Change Requests': return go('change-requests');
      case 'Variation Orders': return go('variation-orders');
      case 'BOQ Estimator': return go('boq');
      case 'Payments': return go('payments');
      case 'Project Quotation': return go('quotation');
      case 'Site Details': return go('site-details');
      default: return comingSoon ? comingSoon(item) : undefined;
    }
  };

  return (
    <View style={s.categoryBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {CATEGORIES.map((cat) => {
          const isActive = activeItem && cat.items.includes(activeItem);
          return (
            <TouchableOpacity
              key={cat.name}
              style={[s.catChip, (openCategory === cat.name || isActive) && s.catChipActive]}
              onPress={() => setOpenCategory(openCategory === cat.name ? null : cat.name)}
            >
              <Text style={s.catChipIcon}>{cat.icon}</Text>
              <Text style={[s.catChipText, (openCategory === cat.name || isActive) && s.catChipTextActive]}>{cat.name}</Text>
              <Ionicons name={openCategory === cat.name ? 'chevron-up' : 'chevron-down'} size={12} color={(openCategory === cat.name || isActive) ? '#2563EB' : '#94A3B8'} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {openCategory && (
        <View style={s.catDropdown}>
          {CATEGORIES.find((c) => c.name === openCategory).items.map((item) => (
            <TouchableOpacity key={item} style={s.catDropdownItem} onPress={() => handleItemPress(item)}>
              <Text style={[s.catDropdownItemText, item === activeItem && s.catDropdownItemTextActive]}>{item}</Text>
              <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  categoryBar: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 10 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  catChipActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  catChipIcon: { fontSize: 13 },
  catChipText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  catChipTextActive: { color: '#2563EB' },
  catDropdown: { marginHorizontal: 16, marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
  catDropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  catDropdownItemText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#334155' },
  catDropdownItemTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },
});

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const FLOW_STAGES = [
  { id: 'leads', label: 'All Leads', icon: 'people-outline' },
  { id: 'follow_ups', label: 'Follow-ups', icon: 'call-outline' },
  { id: 'site_visits', label: 'Site Visits', icon: 'location-outline' },
  { id: 'requirement_design', label: 'Requirements', icon: 'create-outline' },
  { id: 'drawing', label: 'Drawing', icon: 'pencil-outline' },
  { id: 'boq', label: 'BOQ', icon: 'calculator-outline' },
  { id: 'quotations', label: 'Quotations', icon: 'document-text-outline' },
  { id: 'won_projects', label: 'Won Projects', icon: 'trophy-outline' },
  { id: 'lost_leads', label: 'Lost Leads', icon: 'close-circle-outline' },
];

export default function CrmFlowTabs({ activeTab, onSelectTab, counts = {} }) {
  return (
    <View style={s.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {FLOW_STAGES.map((stage) => {
          const isActive = activeTab === stage.id;
          const count = counts[stage.id];

          return (
            <TouchableOpacity
              key={stage.id}
              style={[s.tabChip, isActive && s.tabChipActive]}
              onPress={() => onSelectTab(stage.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={stage.icon}
                size={14}
                color={isActive ? '#2563EB' : '#64748B'}
              />
              <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>
                {stage.label}
              </Text>
              {typeof count === 'number' && (
                <View style={[s.countBadge, isActive && s.countBadgeActive]}>
                  <Text style={[s.countText, isActive && s.countTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#2563EB',
    fontFamily: 'Inter-Bold',
  },
  countBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 2,
  },
  countBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  countText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#475569',
  },
  countTextActive: {
    color: '#1D4ED8',
  },
});

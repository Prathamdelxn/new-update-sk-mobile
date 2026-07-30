import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdaptiveGlass from './AdaptiveGlass';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ACTION_MAP = [
  { id: 'view', label: 'View', color: '#3B82F6' },
  { id: 'create', label: 'Create', color: '#60A5FA' },
  { id: 'update', label: 'Update', color: '#F59E0B' },
  { id: 'delete', label: 'Delete', color: '#EF4444' },
  { id: 'approve', label: 'Approve', color: '#8B5CF6' },
  { id: 'complete', label: 'Complete', color: '#10B981' },
  { id: 'assign', label: 'Assign', color: '#EC4899' },
];

const ModulePermissionCard = ({ title, permissions, onToggle }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const activeCount = Object.values(permissions).filter(val => val).length;

  return (
    <AdaptiveGlass intensity={10} tint="light" style={styles.card}>
      <TouchableOpacity 
        activeOpacity={0.7} 
        onPress={toggleExpand}
        style={styles.header}
      >
        <View style={styles.titleContent}>
          <Text style={styles.title}>{title}</Text>
          {!isExpanded && (
            <Text style={styles.summaryText}>
              {activeCount === 0 ? 'No access defined' : `${activeCount} permissions enabled`}
            </Text>
          )}
        </View>
        <Ionicons 
          name={isExpanded ? "chevron-up" : "chevron-down"} 
          size={18} 
          color="#94A3B8" 
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.grid}>
          {ACTION_MAP.map((action) => {
            const isActive = permissions[action.id];
            return (
              <TouchableOpacity
                key={action.id}
                activeOpacity={0.7}
                onPress={() => onToggle(action.id)}
                style={[
                  styles.actionChip,
                  isActive ? { backgroundColor: action.color + '10', borderColor: action.color + '30' } : null
                ]}
              >
                <View style={[
                  styles.indicator,
                  { backgroundColor: isActive ? action.color : '#E2E8F0' }
                ]} />
                <Text style={[
                  styles.actionLabel,
                  isActive ? { color: action.color, fontFamily: 'Inter-Bold' } : null
                ]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </AdaptiveGlass>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  summaryText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#94A3B8',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    width: '48%',
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
});

export default ModulePermissionCard;

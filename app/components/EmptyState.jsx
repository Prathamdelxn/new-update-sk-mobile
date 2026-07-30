import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdaptiveGlass from './AdaptiveGlass';

export default function EmptyState({ 
  icon = 'document-text-outline', 
  title = 'No Data Found', 
  description = 'There is currently no data to display here.',
  actionElement 
}) {
  return (
    <View style={styles.container}>
      <AdaptiveGlass intensity={40} tint="light" style={styles.glassCard}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={48} color="#94A3B8" />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {actionElement && <View style={styles.actionContainer}>{actionElement}</View>}
      </AdaptiveGlass>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  glassCard: {
    padding: 32,
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    width: '100%',
    maxWidth: 400,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#334155',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  actionContainer: {
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
  },
});

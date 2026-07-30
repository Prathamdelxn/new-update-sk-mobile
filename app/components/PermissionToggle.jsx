import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdaptiveGlass from './AdaptiveGlass';

const PermissionToggle = ({ icon, title, description, isEnabled, onToggle }) => {
  return (
    <AdaptiveGlass intensity={5} tint="light" style={styles.container}>
      <View style={styles.leftContent}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={20} color="#2563EB" />
        </View>
        <View style={styles.textContent}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
      <Switch
        value={isEnabled}
        onValueChange={onToggle}
        trackColor={{ true: '#2563EB', false: '#E2E8F0' }}
        thumbColor={isEnabled ? '#FFFFFF' : '#F8FAFC'}
      />
    </AdaptiveGlass>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginBottom: 12,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  textContent: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  description: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#94A3B8',
    marginTop: 2,
  },
});

export default PermissionToggle;

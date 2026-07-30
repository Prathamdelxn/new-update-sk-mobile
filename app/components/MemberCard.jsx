import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdaptiveGlass from './AdaptiveGlass';

const MemberCard = ({ name, email, role, onRemove, onChangeRole }) => {
  // Generate initials for avatar
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  // Simple color mapping for roles
  const getRoleStyle = (r) => {
    switch (r?.toLowerCase()) {
      case 'administrator': return { bg: '#FEE2E2', text: '#EF4444', icon: 'shield-checkmark' };
      case 'site manager': return { bg: '#FEF3C7', text: '#D97706', icon: 'construct' };
      case 'contractor': return { bg: '#DBEAFE', text: '#2563EB', icon: 'hammer' };
      default: return { bg: '#F1F5F9', text: '#64748B', icon: 'person' };
    }
  };

  const style = getRoleStyle(role);

  return (
    <AdaptiveGlass intensity={15} tint="light" style={styles.card}>
      <View style={styles.content}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>{initials}</Text>
          {role && role !== 'No Role' && (
            <View style={[styles.roleIndicator, { backgroundColor: style.text }]} />
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
          
          {role && role !== 'No Role' && (
            <View style={[styles.roleBadge, { backgroundColor: style.bg + '50', borderColor: style.bg }]}>
              <Text style={[styles.roleText, { color: style.text }]}>{role}</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={onChangeRole}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.deleteBtn]} 
            onPress={onRemove}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    </AdaptiveGlass>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginBottom: 12,
    padding: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-Black',
  },
  roleIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  info: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  email: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#94A3B8',
    marginTop: 1,
    marginBottom: 6,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 10,
    fontFamily: 'Inter-Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
});

export default MemberCard;

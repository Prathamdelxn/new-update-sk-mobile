import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdaptiveGlass from './AdaptiveGlass';

const ConfirmModal = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  onConfirm,
  onCancel,
  type = 'default',
  isSubmitting = false
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.confirmOverlay}>
        <AdaptiveGlass intensity={90} tint="light" style={styles.confirmCard}>
          <View style={[styles.confirmIconBox,
          type === 'destructive' ? styles.iconDestructive :
            type === 'success' ? styles.iconSuccess : styles.iconDefault
          ]}>
            <Ionicons
              name={
                type === 'destructive' ? "trash" :
                  type === 'success' ? "checkmark-circle" : "information-circle"
              }
              size={32}
              color={
                type === 'destructive' ? "#EF4444" :
                  type === 'success' ? "#10B981" : "#3B82F6"
              }
            />
          </View>
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmMessage}>{message}</Text>
          <View style={styles.confirmActions}>
            {onCancel && (
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={onCancel}
                disabled={isSubmitting}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.confirmConfirmBtn,
                !onCancel && { flex: 1 },
                type === 'destructive' ? { backgroundColor: '#EF4444' } :
                  type === 'success' ? { backgroundColor: '#10B981' } : { backgroundColor: '#3B82F6' }
              ]}
              onPress={onConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.confirmConfirmText}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </AdaptiveGlass>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmCard: { width: '100%', borderRadius: 32, padding: 32, alignItems: 'center', backgroundColor: '#FFFFFF' },
  confirmIconBox: { width: 72, height: 72, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  iconDefault: { backgroundColor: '#EFF6FF' },
  iconSuccess: { backgroundColor: '#ECFDF5' },
  iconDestructive: { backgroundColor: '#FEF2F2' },
  confirmTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  confirmMessage: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancelBtn: { flex: 1, height: 54, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  confirmCancelText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#64748B' },
  confirmConfirmBtn: { flex: 2, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  confirmConfirmText: { fontSize: 14, fontFamily: 'Inter-Black', color: '#FFFFFF' },
});

export default ConfirmModal;

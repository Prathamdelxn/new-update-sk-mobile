import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DrawingConfirmApproveModal({
  isOpen,
  visible,
  onClose,
  onConfirm,
  drawing,
  isSubmitting = false,
  leadName,
}) {
  const isModalOpen = Boolean(isOpen ?? visible);
  if (!isModalOpen || !drawing) return null;

  const drawingTitle = drawing.title || drawing.name || 'Drawing File';
  const versionNum = drawing.currentVersion || (drawing.versions && drawing.versions.length) || 1;
  const category = drawing.category || 'Architectural Design';

  return (
    <Modal visible={isModalOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          {/* Header Icon */}
          <View style={s.iconWrap}>
            <Ionicons name="shield-checkmark" size={28} color="#059669" />
          </View>

          <Text style={s.title}>Approve Architectural Drawing</Text>
          <Text style={s.subText}>
            You are approving this drawing for {leadName ? <Text style={{ fontFamily: 'Inter-Bold', color: '#0F172A' }}>{leadName}</Text> : 'the client'}.
          </Text>

          {/* Drawing Info Box */}
          <View style={s.infoBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="document-text" size={20} color="#2563EB" />
              <View style={{ flex: 1 }}>
                <Text style={s.infoTitle} numberOfLines={1}>{drawingTitle}</Text>
                <Text style={s.infoMeta}>Version {versionNum} • {category}</Text>
              </View>
            </View>

            <View style={s.noticeRow}>
              <Ionicons name="information-circle-outline" size={14} color="#059669" />
              <Text style={s.noticeText}>
                Approving this drawing confirms it meets all design standards and unlocks the BOQ Estimation phase.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={s.actionsRow}>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.confirmBtn, isSubmitting && { opacity: 0.7 }]}
              onPress={onConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  <Text style={s.confirmBtnText}>Confirm & Approve</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  subText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    gap: 10,
  },
  infoTitle: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  infoMeta: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 2,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 8,
  },
  noticeText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#065F46',
    flex: 1,
    lineHeight: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});

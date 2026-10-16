import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { interiorCrmService } from '../../services/interiorCrmService';
import { formatExactCurrency } from '../../utils/format';

export default function SendQuotationModal({
  isOpen,
  visible,
  onClose,
  customerId,
  customerName = 'Client',
  customerEmail = '',
  customerPhone = '',
  quotation,
  quotationIndex = null,
  onSuccess,
}) {
  const isModalOpen = Boolean(isOpen ?? visible);
  const [sendTarget, setSendTarget] = useState('customer'); // 'customer' | 'other'
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [additionalNote, setAdditionalNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isModalOpen && quotation) {
      const qNum = quotation.version || (quotationIndex !== null ? quotationIndex + 1 : 1);
      const title = quotation.title || `Quotation v${qNum}`;

      if (sendTarget === 'customer') {
        setRecipientEmail(customerEmail || '');
        setRecipientName(customerName || 'Client');
      }

      setCustomSubject(`Interior Design Quotation — ${title} for ${customerName}`);
      setCustomMessage(
        `Dear ${customerName},\n\nPlease find attached the detailed interior quotation (${title}) for your project. We have structured the scope of works as discussed.\n\nKindly review and let us know if you would like any revisions.`
      );
      setAdditionalNote('');
    }
  }, [isModalOpen, quotation, sendTarget, customerEmail, customerName, quotationIndex]);

  if (!isModalOpen || !quotation) return null;

  const totalAmount = quotation.grandTotal || quotation.totalAmount || quotation.total || 0;
  const itemsCount = (quotation.items || []).length;

  const handleSend = async () => {
    if (!recipientEmail.trim()) {
      Alert.alert('Email Required', 'Please enter a valid recipient email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email format.');
      return;
    }

    setSending(true);
    try {
      const emailToSend = recipientEmail.trim();
      const nameToSend = recipientName.trim();
      const messageToSend = additionalNote.trim() || customMessage.trim();
      const subjectToSend = customSubject.trim();

      await interiorCrmService.sendQuotationEmail(customerId, {
        quotation,
        recipientEmail: emailToSend,
        recipientName: nameToSend,
        recipientType: sendTarget,
        target: sendTarget,
        customSubject: subjectToSend,
        customMessage: messageToSend,
        subject: subjectToSend,
        message: messageToSend,
        additionalNotes: additionalNote.trim(),
        quotationIndex: typeof quotationIndex === 'number' ? quotationIndex : undefined,
      });

      Alert.alert('Success', `Quotation dispatched to ${emailToSend}!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.warn('Failed to send quotation:', err);
      Alert.alert('Failed to Send', err.message || 'Error occurred while emailing quotation.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={isModalOpen} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
        <View style={s.card}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="mail" size={17} color="#2563EB" />
                <Text style={s.headerTitle}>Send Quotation</Text>
              </View>
              <Text style={s.headerSub}>Dispatch itemized quote proposal via email</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
            {/* Target Selector */}
            <Text style={s.label}>Send Recipient Target</Text>
            <View style={s.targetTabs}>
              <TouchableOpacity
                style={[s.targetTab, sendTarget === 'customer' && s.targetTabActive]}
                onPress={() => {
                  setSendTarget('customer');
                  setRecipientEmail(customerEmail);
                  setRecipientName(customerName);
                }}
              >
                <Ionicons
                  name="person"
                  size={14}
                  color={sendTarget === 'customer' ? '#2563EB' : '#64748B'}
                />
                <Text style={[s.targetTabText, sendTarget === 'customer' && s.targetTabTextActive]}>
                  Client ({customerName})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.targetTab, sendTarget === 'other' && s.targetTabActive]}
                onPress={() => {
                  setSendTarget('other');
                  setRecipientEmail('');
                  setRecipientName('');
                }}
              >
                <Ionicons
                  name="mail-outline"
                  size={14}
                  color={sendTarget === 'other' ? '#2563EB' : '#64748B'}
                />
                <Text style={[s.targetTabText, sendTarget === 'other' && s.targetTabTextActive]}>
                  Custom Email
                </Text>
              </TouchableOpacity>
            </View>

            {/* Recipient Details */}
            <Text style={s.label}>Recipient Email *</Text>
            <TextInput
              style={s.input}
              value={recipientEmail}
              onChangeText={setRecipientEmail}
              placeholder="e.g. client@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#94A3B8"
            />

            <Text style={s.label}>Subject</Text>
            <TextInput
              style={s.input}
              value={customSubject}
              onChangeText={setCustomSubject}
              placeholder="Quotation email subject"
              placeholderTextColor="#94A3B8"
            />

            <Text style={s.label}>Message Body</Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={customMessage}
              onChangeText={setCustomMessage}
              multiline
              placeholder="Email content..."
              placeholderTextColor="#94A3B8"
            />

            {/* Quotation Summary Card */}
            <View style={s.summaryCard}>
              <View style={s.summaryHeader}>
                <Ionicons name="document-text" size={15} color="#2563EB" />
                <Text style={s.summaryTitle}>
                  {quotation.title || `Quotation v${quotation.version || 1}`}
                </Text>
              </View>

              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Line Items:</Text>
                <Text style={s.summaryVal}>{itemsCount} items</Text>
              </View>

              {quotation.taxPercentage > 0 && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Tax (GST {quotation.taxPercentage}%):</Text>
                  <Text style={s.summaryVal}>{formatExactCurrency(quotation.tax || 0)}</Text>
                </View>
              )}

              {quotation.discount > 0 && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Discount:</Text>
                  <Text style={[s.summaryVal, { color: '#059669' }]}>
                    - {formatExactCurrency(quotation.discount || 0)}
                  </Text>
                </View>
              )}

              <View style={s.summaryTotalRow}>
                <Text style={s.summaryTotalLabel}>Grand Total Value:</Text>
                <Text style={s.summaryTotalVal}>{formatExactCurrency(totalAmount)}</Text>
              </View>
            </View>

            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={sending}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.sendBtn, sending && { opacity: 0.7 }]}
              onPress={handleSend}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={15} color="#FFFFFF" />
                  <Text style={s.sendBtnText}>Send Quotation</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 16,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#475569',
    marginBottom: 5,
    marginTop: 8,
  },
  targetTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  targetTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 9,
  },
  targetTabActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  targetTabText: {
    fontSize: 11.5,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  targetTabTextActive: {
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12.5,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
  },
  textArea: {
    height: 75,
    textAlignVertical: 'top',
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 14,
    gap: 6,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
    paddingBottom: 6,
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 12.5,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  summaryVal: {
    fontSize: 11.5,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  summaryTotalVal: {
    fontSize: 14,
    fontFamily: 'Inter-Black',
    color: '#16A34A',
  },
  footer: {
    flexDirection: 'row',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  sendBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sendBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});

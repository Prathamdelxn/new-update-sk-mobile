import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, ScrollView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import interiorCrmService from '../../services/interiorCrmService';

function userLabel(u) {
  const name = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || 'User';
  return `${name}${u.role?.name || u.role ? ` (${u.role?.name || u.role})` : ''}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Modal Shell
// ─────────────────────────────────────────────────────────────────────────────
function ModalShell({ isOpen, onClose, icon, iconColor, title, subtitle, children }) {
  if (!isOpen) return null;
  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={[s.iconBox, { backgroundColor: `${iconColor}15` }]}>
              <Ionicons name={icon} size={20} color={iconColor} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.title}>{title}</Text>
              <Text style={s.subtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
          <View style={s.body}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Send To Site Visit Modal
// ─────────────────────────────────────────────────────────────────────────────
export function SendToSiteVisitModal({ isOpen, onClose, customerId, onSuccess, users = [] }) {
  const [assignedExecutive, setAssignedExecutive] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await interiorCrmService.updateCustomer(customerId, { status: 'Under Site Visit' });
      const assignedUser = users.find((u) => (u._id || u.id) === assignedExecutive);
      const assignNote = assignedUser ? `Assigned: ${userLabel(assignedUser)}` : '';
      const finalRemarks = [remarks.trim(), assignNote, `Scheduled for: ${scheduledDate}`].filter(Boolean).join(' | ');

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'Site Visit',
        status: 'Pending',
        scheduledDate,
        remarks: finalRemarks || 'Site visit scheduled.',
      });

      onSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to move lead to Site Visit.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon="location-outline"
      iconColor="#7C3AED"
      title="Pass to Site Visit"
      subtitle="Schedule site measurement and inspection"
    >
      <ScrollView style={{ maxHeight: 380 }}>
        <Text style={s.label}>Assign Site Executive</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pickerRow}>
          {users.map((u) => {
            const id = u._id || u.id;
            const active = assignedExecutive === id;
            return (
              <TouchableOpacity
                key={id}
                style={[s.userChip, active && s.userChipActive]}
                onPress={() => setAssignedExecutive(id)}
              >
                <Text style={[s.userChipText, active && s.userChipTextActive]}>
                  {userLabel(u)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={s.label}>Target Visit Date (YYYY-MM-DD)</Text>
        <TextInput
          style={s.input}
          value={scheduledDate}
          onChangeText={setScheduledDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94A3B8"
        />

        <Text style={s.label}>Visit Instructions / Notes</Text>
        <TextInput
          style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
          multiline
          numberOfLines={2}
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Keys with security, measure carpet area..."
          placeholderTextColor="#94A3B8"
        />

        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: '#7C3AED' }, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={s.actionBtnText}>Schedule Site Visit</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Send To Requirements Modal
// ─────────────────────────────────────────────────────────────────────────────
export function SendToRequirementsModal({ isOpen, onClose, customerId, onSuccess, users = [] }) {
  const [assignedDesigner, setAssignedDesigner] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await interiorCrmService.updateCustomer(customerId, { status: 'Under Requirement' });
      const assignedUser = users.find((u) => (u._id || u.id) === assignedDesigner);
      const assignNote = assignedUser ? `Designer: ${userLabel(assignedUser)}` : '';
      const finalRemarks = [remarks.trim(), assignNote].filter(Boolean).join(' | ') || 'Moved to requirement logging phase.';

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'Status Change',
        status: 'Completed',
        remarks: finalRemarks,
        completedDate: new Date(),
      });

      onSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to move lead to Requirements.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon="create-outline"
      iconColor="#4F46E5"
      title="Pass to Requirements"
      subtitle="Gather room preferences, styling & functional specs"
    >
      <ScrollView style={{ maxHeight: 380 }}>
        <Text style={s.label}>Assign Interior Designer</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pickerRow}>
          {users.map((u) => {
            const id = u._id || u.id;
            const active = assignedDesigner === id;
            return (
              <TouchableOpacity
                key={id}
                style={[s.userChip, active && s.userChipActive]}
                onPress={() => setAssignedDesigner(id)}
              >
                <Text style={[s.userChipText, active && s.userChipTextActive]}>
                  {userLabel(u)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={s.label}>Client Brief / Onboarding Remarks</Text>
        <TextInput
          style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
          multiline
          numberOfLines={2}
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Client prefers minimalist, wooden textures..."
          placeholderTextColor="#94A3B8"
        />

        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: '#4F46E5' }, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={s.actionBtnText}>Start Requirements</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Send To Drawing Modal
// ─────────────────────────────────────────────────────────────────────────────
export function SendToDrawingModal({ isOpen, onClose, customerId, onSuccess, users = [] }) {
  const [assignedArchitect, setAssignedArchitect] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await interiorCrmService.updateCustomer(customerId, { status: 'Under Drawing' });
      const assignedUser = users.find((u) => (u._id || u.id) === assignedArchitect);
      const assignNote = assignedUser ? `Architect: ${userLabel(assignedUser)}` : '';
      const finalRemarks = [remarks.trim(), assignNote].filter(Boolean).join(' | ') || 'Moved to 2D/3D drawing stage.';

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'Status Change',
        status: 'Completed',
        remarks: finalRemarks,
        completedDate: new Date(),
      });

      onSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to move lead to Drawing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon="pencil-outline"
      iconColor="#0284C7"
      title="Pass to Drawing & Layout"
      subtitle="Commission 2D CAD floor plans and 3D visual concepts"
    >
      <ScrollView style={{ maxHeight: 380 }}>
        <Text style={s.label}>Assign Draftsperson / Architect</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pickerRow}>
          {users.map((u) => {
            const id = u._id || u.id;
            const active = assignedArchitect === id;
            return (
              <TouchableOpacity
                key={id}
                style={[s.userChip, active && s.userChipActive]}
                onPress={() => setAssignedArchitect(id)}
              >
                <Text style={[s.userChipText, active && s.userChipTextActive]}>
                  {userLabel(u)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={s.label}>Drafting Scope & Deliverables</Text>
        <TextInput
          style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
          multiline
          numberOfLines={2}
          value={remarks}
          onChangeText={setRemarks}
          placeholder="2D furniture layout + 3D living room renders..."
          placeholderTextColor="#94A3B8"
        />

        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: '#0284C7' }, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={s.actionBtnText}>Commission Drawings</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Send To BOQ Modal
// ─────────────────────────────────────────────────────────────────────────────
export function SendToBoqModal({ isOpen, onClose, customerId, onSuccess, users = [] }) {
  const [assignedEstimator, setAssignedEstimator] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await interiorCrmService.updateCustomer(customerId, { status: 'Under BOQ Creation' });
      const assignedUser = users.find((u) => (u._id || u.id) === assignedEstimator);
      const assignNote = assignedUser ? `Estimator: ${userLabel(assignedUser)}` : '';
      const finalRemarks = [remarks.trim(), assignNote].filter(Boolean).join(' | ') || 'Moved to BOQ estimation phase.';

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'Status Change',
        status: 'Completed',
        remarks: finalRemarks,
        completedDate: new Date(),
      });

      onSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to move lead to BOQ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon="calculator-outline"
      iconColor="#059669"
      title="Pass to BOQ Estimation"
      subtitle="Generate itemized bill of quantities and cost sheets"
    >
      <ScrollView style={{ maxHeight: 380 }}>
        <Text style={s.label}>Assign Quantity Surveyor / Estimator</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pickerRow}>
          {users.map((u) => {
            const id = u._id || u.id;
            const active = assignedEstimator === id;
            return (
              <TouchableOpacity
                key={id}
                style={[s.userChip, active && s.userChipActive]}
                onPress={() => setAssignedEstimator(id)}
              >
                <Text style={[s.userChipText, active && s.userChipTextActive]}>
                  {userLabel(u)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={s.label}>Estimation Notes</Text>
        <TextInput
          style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
          multiline
          numberOfLines={2}
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Target budget under 15 Lakhs, premium fittings..."
          placeholderTextColor="#94A3B8"
        />

        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: '#059669' }, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={s.actionBtnText}>Pass to BOQ Phase</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Send To Quotations Modal
// ─────────────────────────────────────────────────────────────────────────────
export function SendToQuotationsModal({ isOpen, onClose, customerId, onSuccess }) {
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await interiorCrmService.updateCustomer(customerId, { status: 'Under Quotation' });
      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'Status Change',
        status: 'Completed',
        remarks: remarks.trim() || 'Moved to sales quotation & client presentation phase.',
        completedDate: new Date(),
      });

      onSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to move lead to Quotations.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon="document-text-outline"
      iconColor="#E11D48"
      title="Pass to Quotation Stage"
      subtitle="Prepare commercial proposal & discount approvals"
    >
      <ScrollView style={{ maxHeight: 320 }}>
        <Text style={s.label}>Quotation Briefing / Target Margin</Text>
        <TextInput
          style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
          multiline
          numberOfLines={2}
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Client requested 5% discount, payment in 4 tranches..."
          placeholderTextColor="#94A3B8"
        />

        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: '#E11D48' }, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={s.actionBtnText}>Move to Quotation</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Convert To Project Modal
// ─────────────────────────────────────────────────────────────────────────────
export function ConvertToProjectModal({ isOpen, onClose, customerId, onSuccess }) {
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await interiorCrmService.convertCustomer(customerId, {
        startDate,
        remarks: remarks.trim() || 'Lead won and converted to active project.',
      });

      Alert.alert('Congratulations! 🎉', 'Lead successfully converted into an Active Interior Project!');
      onSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Conversion Failed', e.message || 'Failed to convert lead to project.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon="trophy-outline"
      iconColor="#16A34A"
      title="Win & Convert to Project"
      subtitle="Finalize deal and initialize construction workspace"
    >
      <ScrollView style={{ maxHeight: 340 }}>
        <Text style={s.label}>Project Kickoff Date (YYYY-MM-DD)</Text>
        <TextInput
          style={s.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94A3B8"
        />

        <Text style={s.label}>Handover Remarks for Execution Team</Text>
        <TextInput
          style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
          multiline
          numberOfLines={2}
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Advance received, site keys available at gate..."
          placeholderTextColor="#94A3B8"
        />

        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: '#16A34A' }, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={s.actionBtnText}>🏆 Convert to Project</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ModalShell>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#475569',
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'Inter-Medium',
  },
  pickerRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  userChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  userChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  userChipText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  userChipTextActive: {
    color: '#2563EB',
    fontFamily: 'Inter-Bold',
  },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter-Bold',
  },
});

import React, { useState, useEffect } from 'react';
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

function toDateInputStr(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function fmtScheduleDisplay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
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

// Reusable "Previous Schedule (Reference)" box shown when reopening a modal in reschedule mode
function PreviousScheduleBox({ color, phaseLabel, scheduledDate, assignedLabel, remarks }) {
  return (
    <View style={[s.prevBox, { borderColor: `${color}33`, backgroundColor: `${color}0D` }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Ionicons name="time-outline" size={12} color={color} />
          <Text style={[s.prevBoxLabel, { color }]}>PREVIOUS SCHEDULE (REFERENCE)</Text>
        </View>
        <View style={s.prevBoxPill}>
          <Text style={s.prevBoxPillText}>{phaseLabel}</Text>
        </View>
      </View>
      {!!scheduledDate && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Ionicons name="calendar-outline" size={12} color={color} />
          <Text style={s.prevBoxText}>{fmtScheduleDisplay(scheduledDate)}</Text>
        </View>
      )}
      {!!assignedLabel && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Ionicons name="person-outline" size={12} color={color} />
          <Text style={s.prevBoxSub}>Assigned: <Text style={{ fontFamily: 'Inter-Bold', color: '#0F172A' }}>{assignedLabel}</Text></Text>
        </View>
      )}
      {!!remarks && (
        <Text style={s.prevBoxNote} numberOfLines={2}>&quot;{remarks}&quot;</Text>
      )}
    </View>
  );
}

// TAT (turnaround time) quick-date presets — adds N days to today and fills scheduledDate
function TatPresets({ color, scheduledDate, onPick }) {
  const presets = [
    { label: '+1 Day', days: 1 },
    { label: '+2 Days', days: 2 },
    { label: '+3 Days', days: 3 },
    { label: '+5 Days', days: 5 },
    { label: '+1 Week', days: 7 },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
      <Text style={s.tatLabel}>Quick TAT:</Text>
      {presets.map((p) => {
        const target = new Date(Date.now() + p.days * 24 * 60 * 60 * 1000);
        const formatted = toDateInputStr(target);
        const active = scheduledDate === formatted;
        return (
          <TouchableOpacity
            key={p.label}
            style={[s.tatChip, active && { backgroundColor: color, borderColor: color }]}
            onPress={() => onPick(formatted)}
          >
            <Text style={[s.tatChipText, active && { color: '#FFFFFF' }]}>{p.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Send To Site Visit Modal
// ─────────────────────────────────────────────────────────────────────────────
export function SendToSiteVisitModal({ isOpen, onClose, customerId, onSuccess, users = [], isFollowUpCompleted = true, initialData = null }) {
  const [assignedExecutive, setAssignedExecutive] = useState('');
  const [showExecutiveDropdown, setShowExecutiveDropdown] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => toDateInputStr(new Date()));
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRescheduling = Boolean(initialData?.scheduledDate || initialData?.assignedSalesExecutive);

  useEffect(() => {
    if (isOpen) {
      setAssignedExecutive(initialData?.assignedSalesExecutive || '');
      setScheduledDate(initialData?.scheduledDate ? toDateInputStr(initialData.scheduledDate) : toDateInputStr(new Date()));
      setRemarks(initialData?.remarks || '');
      setShowExecutiveDropdown(false);
    }
  }, [isOpen, initialData]);

  const previousAssignedUser = initialData?.assignedSalesExecutive
    ? userLabel(users.find((u) => (u._id || u.id) === initialData.assignedSalesExecutive) || {})
    : null;

  const handleSubmit = async () => {
    if (!isFollowUpCompleted && !isRescheduling) {
      Alert.alert('Follow-up Required', 'Please complete the follow-up before passing to the Site Visit stage.');
      return;
    }
    if (!assignedExecutive) {
      Alert.alert('Assignee Required', 'Please select a site executive before scheduling the site visit.');
      return;
    }
    if (!scheduledDate) {
      Alert.alert('Date Required', 'Please select a target visit date.');
      return;
    }

    setSubmitting(true);
    try {
      const trimmedRemarks = remarks.trim();
      await interiorCrmService.updateCustomer(customerId, {
        status: 'Under Site Visit',
        assignedTo: assignedExecutive,
        assignedSalesExecutive: assignedExecutive,
        siteVisitScheduledDate: new Date(scheduledDate).toISOString(),
        remarks: trimmedRemarks || undefined,
      });
      const assignedUser = users.find((u) => (u._id || u.id) === assignedExecutive);
      const assignNote = assignedUser ? `Assigned: ${userLabel(assignedUser)}` : '';
      const finalRemarks = [trimmedRemarks, assignNote, `Scheduled for: ${scheduledDate}`].filter(Boolean).join(' | ');

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'Site Visit',
        status: 'Pending',
        scheduledDate,
        remarks: finalRemarks || 'Site visit scheduled.',
        user: assignedExecutive || undefined,
      });

      // Auto-complete any pending follow-up activities (mirrors web flow)
      try {
        const actList = await interiorCrmService.getActivities(customerId);
        const acts = Array.isArray(actList) ? actList : (actList?.data || []);
        const pendingFollowUps = acts.filter(
          (a) => a.status?.toLowerCase() === 'pending' && a.type !== 'Site Visit'
        );
        for (const act of pendingFollowUps) {
          await interiorCrmService.updateActivity(act._id, {
            status: 'Completed',
            completedDate: new Date(),
          });
        }
      } catch (_) {
        // Non-critical – swallow silently
      }

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
      title={isRescheduling ? 'Reschedule Site Visit' : 'Pass to Site Visit'}
      subtitle={isRescheduling ? 'Update scheduled visit date & assigned member' : 'Schedule site measurement and inspection'}
    >
      <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {isRescheduling && (
          <PreviousScheduleBox
            color="#7C3AED"
            phaseLabel="Site Visit"
            scheduledDate={initialData?.scheduledDate}
            assignedLabel={previousAssignedUser}
            remarks={initialData?.remarks}
          />
        )}

        <Text style={s.label}>Assign Site Executive *</Text>
        <TouchableOpacity
           style={s.input}
           onPress={() => setShowExecutiveDropdown(!showExecutiveDropdown)}
        >
          <Text style={{ color: assignedExecutive ? '#0F172A' : '#94A3B8', fontFamily: 'Inter-Medium', fontSize: 13 }}>
            {assignedExecutive ? userLabel(users.find(u => (u._id || u.id) === assignedExecutive) || {}) : "Select Executive *"}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#64748B" style={{ position: 'absolute', right: 12, top: 12 }} />
        </TouchableOpacity>

        {showExecutiveDropdown && (
          <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginTop: 4, maxHeight: 150, overflow: 'hidden' }}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
              {users.map(u => {
                const id = u._id || u.id;
                const active = assignedExecutive === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: active ? '#EFF6FF' : 'transparent' }}
                    onPress={() => { setAssignedExecutive(id); setShowExecutiveDropdown(false); }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: active ? 'Inter-Bold' : 'Inter-Medium', color: active ? '#2563EB' : '#475569' }}>
                      {userLabel(u)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <Text style={s.label}>Target Visit Date *</Text>
        <TatPresets color="#7C3AED" scheduledDate={scheduledDate} onPick={setScheduledDate} />
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
            <Text style={s.actionBtnText}>{isRescheduling ? 'Confirm Reschedule' : 'Schedule Site Visit'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Send To Requirements Modal
// ─────────────────────────────────────────────────────────────────────────────
export function SendToRequirementsModal({ isOpen, onClose, customerId, onSuccess, users = [], initialData = null }) {
  const [assignedDesigner, setAssignedDesigner] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => toDateInputStr(new Date()));
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRescheduling = Boolean(initialData?.scheduledDate || initialData?.assignedMember);

  useEffect(() => {
    if (isOpen) {
      setAssignedDesigner(initialData?.assignedMember || '');
      setScheduledDate(initialData?.scheduledDate ? toDateInputStr(initialData.scheduledDate) : toDateInputStr(new Date()));
      setRemarks(initialData?.remarks || '');
      setShowDropdown(false);
    }
  }, [isOpen, initialData]);

  const previousAssignedUser = initialData?.assignedMember
    ? userLabel(users.find((u) => (u._id || u.id) === initialData.assignedMember) || {})
    : null;

  const handleSubmit = async () => {
    if (!assignedDesigner) {
      Alert.alert('Assignee Required', 'Please select an interior designer before starting the requirements phase.');
      return;
    }
    if (!scheduledDate) {
      Alert.alert('Date Required', 'Please select a session date.');
      return;
    }

    setSubmitting(true);
    try {
      await interiorCrmService.updateCustomer(customerId, {
        status: 'Under Requirement',
        assignedTo: assignedDesigner,
        designerAssigned: assignedDesigner,
      });
      const assignedUser = users.find((u) => (u._id || u.id) === assignedDesigner);
      const assignNote = assignedUser ? `Designer: ${userLabel(assignedUser)}` : '';
      const finalRemarks = [remarks.trim(), assignNote, `Session: ${scheduledDate}`].filter(Boolean).join(' | ') || 'Moved to requirement logging phase.';

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'Requirement Gathering',
        status: 'Pending',
        scheduledDate,
        remarks: finalRemarks,
        user: assignedDesigner || undefined,
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
      title={isRescheduling ? 'Reschedule Requirements Session' : 'Pass to Requirements'}
      subtitle={isRescheduling ? 'Update session date & assigned designer' : 'Gather room preferences, styling & functional specs'}
    >
      <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {isRescheduling && (
          <PreviousScheduleBox
            color="#4F46E5"
            phaseLabel="Requirements"
            scheduledDate={initialData?.scheduledDate}
            assignedLabel={previousAssignedUser}
            remarks={initialData?.remarks}
          />
        )}

        <Text style={s.label}>Assign Interior Designer *</Text>
        <TouchableOpacity
           style={s.input}
           onPress={() => setShowDropdown(!showDropdown)}
        >
          <Text style={{ color: assignedDesigner ? '#0F172A' : '#94A3B8', fontFamily: 'Inter-Medium', fontSize: 13 }}>
            {assignedDesigner ? userLabel(users.find(u => (u._id || u.id) === assignedDesigner) || {}) : "Select Designer *"}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#64748B" style={{ position: 'absolute', right: 12, top: 12 }} />
        </TouchableOpacity>

        {showDropdown && (
          <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginTop: 4, maxHeight: 150, overflow: 'hidden' }}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
              {users.map(u => {
                const id = u._id || u.id;
                const active = assignedDesigner === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: active ? '#EFF6FF' : 'transparent' }}
                    onPress={() => { setAssignedDesigner(id); setShowDropdown(false); }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: active ? 'Inter-Bold' : 'Inter-Medium', color: active ? '#2563EB' : '#475569' }}>
                      {userLabel(u)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <Text style={s.label}>Session Target Date *</Text>
        <TatPresets color="#4F46E5" scheduledDate={scheduledDate} onPick={setScheduledDate} />
        <TextInput
          style={s.input}
          value={scheduledDate}
          onChangeText={setScheduledDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94A3B8"
        />

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
            <Text style={s.actionBtnText}>{isRescheduling ? 'Reschedule Session' : 'Start Requirements'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Send To Drawing Modal
// ─────────────────────────────────────────────────────────────────────────────
export function SendToDrawingModal({ isOpen, onClose, customerId, onSuccess, users = [], initialData = null }) {
  const [assignedArchitect, setAssignedArchitect] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => toDateInputStr(new Date()));
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRescheduling = Boolean(initialData?.scheduledDate || initialData?.assignedDesigner);

  useEffect(() => {
    if (isOpen) {
      setAssignedArchitect(initialData?.assignedDesigner || '');
      setScheduledDate(initialData?.scheduledDate ? toDateInputStr(initialData.scheduledDate) : toDateInputStr(new Date()));
      setRemarks(initialData?.remarks || '');
      setShowDropdown(false);
    }
  }, [isOpen, initialData]);

  const previousAssignedUser = initialData?.assignedDesigner
    ? userLabel(users.find((u) => (u._id || u.id) === initialData.assignedDesigner) || {})
    : null;

  const handleSubmit = async () => {
    if (!assignedArchitect) {
      Alert.alert('Assignee Required', 'Please select a draftsperson or architect before commissioning drawings.');
      return;
    }
    if (!scheduledDate) {
      Alert.alert('Date Required', 'Please select a delivery deadline.');
      return;
    }

    setSubmitting(true);
    try {
      await interiorCrmService.updateCustomer(customerId, {
        status: 'Under Drawing',
        assignedTo: assignedArchitect,
        designerAssigned: assignedArchitect,
        drawingScheduledDate: new Date(scheduledDate).toISOString(),
      });
      const assignedUser = users.find((u) => (u._id || u.id) === assignedArchitect);
      const assignNote = assignedUser ? `Architect: ${userLabel(assignedUser)}` : '';
      const finalRemarks = [remarks.trim(), assignNote].filter(Boolean).join(' | ') || 'Lead passed to 2D/3D Drawing phase and assigned to designer.';

      await interiorCrmService.createActivity({
        customer: customerId,
        type: '2D/3D Drawing',
        status: 'Pending',
        scheduledDate,
        remarks: finalRemarks,
        user: assignedArchitect || undefined,
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
      title={isRescheduling ? 'Reschedule Drawing Delivery' : 'Pass to Drawing & Layout'}
      subtitle={isRescheduling ? 'Update drawing delivery date & assigned designer' : 'Commission 2D CAD floor plans and 3D visual concepts'}
    >
      <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {isRescheduling && (
          <PreviousScheduleBox
            color="#0284C7"
            phaseLabel="Drawing Phase"
            scheduledDate={initialData?.scheduledDate}
            assignedLabel={previousAssignedUser}
            remarks={initialData?.remarks}
          />
        )}

        <Text style={s.label}>Assign Draftsperson / Architect *</Text>
        <TouchableOpacity
           style={s.input}
           onPress={() => setShowDropdown(!showDropdown)}
        >
          <Text style={{ color: assignedArchitect ? '#0F172A' : '#94A3B8', fontFamily: 'Inter-Medium', fontSize: 13 }}>
            {assignedArchitect ? userLabel(users.find(u => (u._id || u.id) === assignedArchitect) || {}) : "Select Architect *"}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#64748B" style={{ position: 'absolute', right: 12, top: 12 }} />
        </TouchableOpacity>

        {showDropdown && (
          <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginTop: 4, maxHeight: 150, overflow: 'hidden' }}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
              {users.map(u => {
                const id = u._id || u.id;
                const active = assignedArchitect === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: active ? '#EFF6FF' : 'transparent' }}
                    onPress={() => { setAssignedArchitect(id); setShowDropdown(false); }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: active ? 'Inter-Bold' : 'Inter-Medium', color: active ? '#2563EB' : '#475569' }}>
                      {userLabel(u)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <Text style={s.label}>Delivery Deadline *</Text>
        <TatPresets color="#0284C7" scheduledDate={scheduledDate} onPick={setScheduledDate} />
        <TextInput
          style={s.input}
          value={scheduledDate}
          onChangeText={setScheduledDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94A3B8"
        />

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
            <Text style={s.actionBtnText}>{isRescheduling ? 'Reschedule Delivery' : 'Commission Drawings'}</Text>
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
  const [showDropdown, setShowDropdown] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!assignedEstimator) {
      Alert.alert('Assignee Required', 'Please select a quantity surveyor or estimator before moving to BOQ.');
      return;
    }

    setSubmitting(true);
    try {
      await interiorCrmService.updateCustomer(customerId, {
        status: 'Under BOQ Creation',
        assignedTo: assignedEstimator,
      });
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
      <ScrollView style={{ maxHeight: 380 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Assign Quantity Surveyor / Estimator *</Text>
        <TouchableOpacity
           style={s.input}
           onPress={() => setShowDropdown(!showDropdown)}
        >
          <Text style={{ color: assignedEstimator ? '#0F172A' : '#94A3B8', fontFamily: 'Inter-Medium', fontSize: 13 }}>
            {assignedEstimator ? userLabel(users.find(u => (u._id || u.id) === assignedEstimator) || {}) : "Select Estimator *"}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#64748B" style={{ position: 'absolute', right: 12, top: 12 }} />
        </TouchableOpacity>

        {showDropdown && (
          <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginTop: 4, maxHeight: 150, overflow: 'hidden' }}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
              {users.map(u => {
                const id = u._id || u.id;
                const active = assignedEstimator === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: active ? '#EFF6FF' : 'transparent' }}
                    onPress={() => { setAssignedEstimator(id); setShowDropdown(false); }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: active ? 'Inter-Bold' : 'Inter-Medium', color: active ? '#2563EB' : '#475569' }}>
                      {userLabel(u)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

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
export function SendToQuotationsModal({ isOpen, onClose, customerId, onSuccess, users = [] }) {
  const [assignedSalesExecutive, setAssignedSalesExecutive] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!assignedSalesExecutive) {
      Alert.alert('Assignee Required', 'Please select a member to assign before passing to Quotations.');
      return;
    }
    if (!remarks.trim()) {
      Alert.alert('Handover Notes Required', 'Handover notes & pricing assumptions are required before passing to quotations.');
      return;
    }

    setSubmitting(true);
    try {
      const assignedUser = users.find((u) => (u._id || u.id) === assignedSalesExecutive);
      const assignNote = assignedUser ? `Assigned Member: ${userLabel(assignedUser)}.` : '';
      const finalRemarks = [remarks.trim(), assignNote].filter(Boolean).join(' | ');

      await interiorCrmService.updateCustomer(customerId, {
        status: 'Under Quotation',
        assignedSalesExecutive,
        assignedTo: assignedSalesExecutive,
      });

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
      title="Pass to Quotations"
      subtitle="Assign a team member and document handover requirements"
    >
      <ScrollView style={{ maxHeight: 380 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Assign Sales / Quotation Executive *</Text>
        <TouchableOpacity
          style={s.input}
          onPress={() => setShowDropdown(!showDropdown)}
        >
          <Text style={{ color: assignedSalesExecutive ? '#0F172A' : '#94A3B8', fontFamily: 'Inter-Medium', fontSize: 13 }}>
            {assignedSalesExecutive ? userLabel(users.find((u) => (u._id || u.id) === assignedSalesExecutive) || {}) : "Select Sales Executive *"}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#64748B" style={{ position: 'absolute', right: 12, top: 12 }} />
        </TouchableOpacity>

        {showDropdown && (
          <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginTop: 4, maxHeight: 150, overflow: 'hidden' }}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
              {users.map((u) => {
                const id = u._id || u.id;
                const active = assignedSalesExecutive === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: active ? '#EFF6FF' : 'transparent' }}
                    onPress={() => { setAssignedSalesExecutive(id); setShowDropdown(false); }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: active ? 'Inter-Bold' : 'Inter-Medium', color: active ? '#2563EB' : '#475569' }}>
                      {userLabel(u)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <Text style={s.label}>Handover Notes & Pricing Assumptions *</Text>
        <TextInput
          style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
          multiline
          numberOfLines={3}
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Enter client payment terms, target discount constraints, milestone breakdown requirements..."
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Ionicons name="trophy-outline" size={16} color="#FFFFFF" />
              <Text style={s.actionBtnText}>Convert to Project</Text>
            </View>
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
  prevBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  prevBoxLabel: {
    fontSize: 9.5,
    fontFamily: 'Inter-ExtraBold',
    letterSpacing: 0.3,
  },
  prevBoxPill: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prevBoxPillText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
  },
  prevBoxText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  prevBoxSub: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  prevBoxNote: {
    fontSize: 11.5,
    fontFamily: 'Inter-MediumItalic',
    color: '#64748B',
    backgroundColor: 'rgba(255,255,255,0.6)',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  tatLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    textTransform: 'uppercase',
    marginRight: 2,
    alignSelf: 'center',
  },
  tatChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tatChipText: {
    fontSize: 10.5,
    fontFamily: 'Inter-SemiBold',
    color: '#475569',
  },
});

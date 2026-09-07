import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import interiorCrmService from '../../services/interiorCrmService';

const CATEGORIES = [
  'Flooring', 'Carpentry', 'False Ceiling', 'Electrical',
  'Plumbing', 'Painting', 'Civil', 'Hardware', 'Other'
];

const UNITS = ['sqft', 'rft', 'nos', 'lump-sum', 'bags', 'sqm'];

const emptyItem = (index = 1) => ({
  serialNumber: index,
  category: 'Flooring',
  itemName: '',
  description: '',
  quantity: '1',
  unit: 'sqft',
  rate: '0',
  amount: 0,
});

export default function BoqBuilderModal({
  isOpen,
  onClose,
  customerId,
  currentStatus,
  existingBoqs = [],
  editingIndex = null,
  onSuccess,
}) {
  const isEditing = editingIndex !== null && editingIndex >= 0 && existingBoqs[editingIndex];
  const [items, setItems] = useState([emptyItem(1)]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isEditing) {
        const target = existingBoqs[editingIndex];
        setItems(
          target.items && target.items.length > 0
            ? target.items.map((it, idx) => ({
                ...it,
                serialNumber: idx + 1,
                quantity: String(it.quantity || 1),
                rate: String(it.rate || it.unitRate || 0),
                amount: (parseFloat(it.quantity) || 0) * (parseFloat(it.rate || it.unitRate) || 0),
              }))
            : [emptyItem(1)]
        );
        setNotes(target.notes || '');
      } else {
        setItems([emptyItem(1)]);
        setNotes('');
      }
    }
  }, [isOpen, editingIndex, existingBoqs]);

  const updateField = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      const it = { ...copy[index], [field]: value };
      const q = parseFloat(it.quantity) || 0;
      const r = parseFloat(it.rate) || 0;
      it.amount = q * r;
      copy[index] = it;
      return copy;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        ...emptyItem(prev.length + 1),
        category: prev[prev.length - 1]?.category || 'Flooring',
        unit: prev[prev.length - 1]?.unit || 'sqft',
      },
    ]);
  };

  const removeItem = (idx) => {
    if (items.length <= 1) {
      Alert.alert('Notice', 'BOQ must have at least one line item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, serialNumber: i + 1 })));
  };

  const subtotal = items.reduce((acc, it) => acc + (it.amount || 0), 0);
  const taxAmount = Math.round(subtotal * 0.18);
  const grandTotal = Math.round(subtotal + taxAmount);

  const handleSubmit = async () => {
    const invalid = items.some((it) => !it.itemName.trim());
    if (invalid) {
      Alert.alert('Validation Error', 'Please enter a name for all line items.');
      return;
    }

    setSubmitting(true);
    try {
      const sanitizedItems = items.map((it, idx) => ({
        serialNumber: idx + 1,
        category: it.category || 'Other',
        itemName: it.itemName.trim(),
        description: it.description?.trim() || '',
        quantity: parseFloat(it.quantity) || 1,
        unit: it.unit || 'sqft',
        rate: parseFloat(it.rate) || 0,
        amount: (parseFloat(it.quantity) || 1) * (parseFloat(it.rate) || 0),
      }));

      const newBoq = {
        boqNumber: isEditing
          ? existingBoqs[editingIndex].boqNumber
          : `BOQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        version: isEditing
          ? existingBoqs[editingIndex].version
          : existingBoqs.length > 0
          ? `v${existingBoqs.length + 1}.0`
          : 'v1.0',
        items: sanitizedItems,
        subtotal,
        taxPercent: 18,
        taxAmount,
        totalAmount: grandTotal,
        notes: notes.trim(),
        status: isEditing ? existingBoqs[editingIndex].status : 'Draft',
        createdAt: isEditing ? existingBoqs[editingIndex].createdAt : new Date().toISOString(),
      };

      let updatedBoqs = [...existingBoqs];
      if (isEditing) {
        updatedBoqs[editingIndex] = newBoq;
      } else {
        updatedBoqs.push(newBoq);
      }

      const STAGES_AFTER_BOQ = ['Under Quotation', 'Won', 'Lost', 'Converted to Project'];
      const shouldUpdateStatus = !currentStatus || !STAGES_AFTER_BOQ.includes(currentStatus);

      await interiorCrmService.updateCustomer(customerId, {
        boqs: updatedBoqs,
        ...(shouldUpdateStatus ? { status: 'Under BOQ Creation' } : {}),
      });

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'Status Change',
        status: 'Completed',
        remarks: `${isEditing ? 'Updated' : 'Created'} Estimate BOQ (${newBoq.version}) totaling ₹${grandTotal.toLocaleString('en-IN')}.`,
        completedDate: new Date(),
      });

      onSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Save Failed', e.message || 'Failed to save BOQ.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color="#0F172A" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={s.headerTitle}>
                {isEditing ? `Edit BOQ (${existingBoqs[editingIndex]?.version})` : 'Create Estimate BOQ'}
              </Text>
              <Text style={s.headerSub}>Itemized cost calculation for pre-project estimate</Text>
            </View>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={[s.saveBtn, submitting && { opacity: 0.6 }]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={s.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
            {/* Item list */}
            {items.map((item, idx) => (
              <View key={idx} style={s.itemCard}>
                <View style={s.itemHeader}>
                  <View style={s.itemIndexBadge}>
                    <Text style={s.itemIndexText}>#{idx + 1}</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}
                    style={{ flex: 1, marginHorizontal: 8 }}
                  >
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[s.catChip, item.category === cat && s.catChipActive]}
                        onPress={() => updateField(idx, 'category', cat)}
                      >
                        <Text style={[s.catChipText, item.category === cat && s.catChipTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity onPress={() => removeItem(idx)} style={s.deleteBtn}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                {/* Name */}
                <TextInput
                  style={s.input}
                  placeholder="Item Name (e.g. Master Bedroom Wardrobe)"
                  placeholderTextColor="#94A3B8"
                  value={item.itemName}
                  onChangeText={(v) => updateField(idx, 'itemName', v)}
                />

                {/* Description */}
                <TextInput
                  style={[s.input, s.inputSm, { marginTop: 8 }]}
                  placeholder="Specifications / Materials (e.g. 18mm Marine Ply + Laminate)"
                  placeholderTextColor="#94A3B8"
                  value={item.description}
                  onChangeText={(v) => updateField(idx, 'description', v)}
                />

                {/* Qty, Unit, Rate Row */}
                <View style={s.calcRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Qty</Text>
                    <TextInput
                      style={s.input}
                      keyboardType="numeric"
                      value={item.quantity}
                      onChangeText={(v) => updateField(idx, 'quantity', v)}
                    />
                  </View>

                  <View style={{ width: 85 }}>
                    <Text style={s.fieldLabel}>Unit</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ maxHeight: 42 }}
                    >
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {UNITS.map((u) => (
                          <TouchableOpacity
                            key={u}
                            style={[s.unitChip, item.unit === u && s.unitChipActive]}
                            onPress={() => updateField(idx, 'unit', u)}
                          >
                            <Text style={[s.unitChipText, item.unit === u && s.unitChipTextActive]}>
                              {u}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  <View style={{ flex: 1.2 }}>
                    <Text style={s.fieldLabel}>Rate (₹)</Text>
                    <TextInput
                      style={s.input}
                      keyboardType="numeric"
                      value={item.rate}
                      onChangeText={(v) => updateField(idx, 'rate', v)}
                    />
                  </View>

                  <View style={{ width: 90, alignItems: 'flex-end', justifyContent: 'center' }}>
                    <Text style={s.fieldLabel}>Amount</Text>
                    <Text style={s.amountText}>
                      ₹{Math.round(item.amount || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            {/* Add item button */}
            <TouchableOpacity style={s.addBtn} onPress={addItem}>
              <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
              <Text style={s.addBtnText}>Add Line Item</Text>
            </TouchableOpacity>

            {/* Notes */}
            <View style={s.notesBox}>
              <Text style={s.fieldLabel}>Estimator Notes & Exclusions (Optional)</Text>
              <TextInput
                style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
                multiline
                numberOfLines={3}
                placeholder="Add special terms, exclusions, or site delivery assumptions..."
                placeholderTextColor="#94A3B8"
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </ScrollView>

          {/* Sticky Total Footer */}
          <View style={s.footer}>
            <View style={s.totalRow}>
              <View>
                <Text style={s.totalSubLabel}>Subtotal: ₹{subtotal.toLocaleString('en-IN')}</Text>
                <Text style={s.totalSubLabel}>GST (18%): ₹{taxAmount.toLocaleString('en-IN')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.grandTotalLabel}>Estimated Total</Text>
                <Text style={s.grandTotalValue}>₹{grandTotal.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 1,
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    fontSize: 13,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14, paddingBottom: 40 },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemIndexBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  itemIndexText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  catChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  catChipActive: {
    backgroundColor: '#DBEAFE',
  },
  catChipText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  catChipTextActive: {
    color: '#1D4ED8',
    fontFamily: 'Inter-Bold',
  },
  deleteBtn: {
    padding: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'Inter-Medium',
  },
  inputSm: {
    fontSize: 12,
    paddingVertical: 6,
  },
  calcRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  unitChip: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  unitChipActive: {
    backgroundColor: '#2563EB',
  },
  unitChipText: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'Inter-Medium',
  },
  unitChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  amountText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#16A34A',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    paddingVertical: 12,
  },
  addBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  notesBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalSubLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  grandTotalLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  grandTotalValue: {
    fontSize: 18,
    fontFamily: 'Inter-Black',
    color: '#0F172A',
  },
});

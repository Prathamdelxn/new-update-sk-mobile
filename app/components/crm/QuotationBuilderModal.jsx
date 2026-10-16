import React, { useState, useEffect, useMemo } from 'react';
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

export default function QuotationBuilderModal({
  visible,
  isOpen,
  onClose,
  customerId,
  existingQuotations = [],
  existingBoqs = [],
  editingQuoteIndex = null,
  budgetRange = null,
  isReadOnly = false,
  onSuccess,
}) {
  const isModalOpen = Boolean(visible ?? isOpen);
  const [submitting, setSubmitting] = useState(false);
  const [quotationTitle, setQuotationTitle] = useState('');
  const [scopeMode, setScopeMode] = useState('all'); // 'all' | 'categories' | 'items' | 'custom'
  const [quoteItems, setQuoteItems] = useState([]);
  const [markupPct, setMarkupPct] = useState('0');
  const [taxPct, setTaxPct] = useState('18');
  const [discountAmt, setDiscountAmt] = useState('0');
  const [quoteNotes, setQuoteNotes] = useState('');

  // Selected categories and items tracking
  const [selectedCategories, setSelectedCategories] = useState({});
  const [selectedItemIds, setSelectedItemIds] = useState({});
  const [expandedSections, setExpandedSections] = useState({});

  const isEditing = editingQuoteIndex !== null && editingQuoteIndex >= 0 && existingQuotations[editingQuoteIndex];
  const targetQuote = isEditing ? existingQuotations[editingQuoteIndex] : null;

  // Active BOQ (latest version)
  const activeBoq = useMemo(() => {
    if (!existingBoqs || existingBoqs.length === 0) return null;
    return existingBoqs[existingBoqs.length - 1];
  }, [existingBoqs]);

  // Structured BOQ Sections & Items
  const boqSections = useMemo(() => {
    if (!activeBoq) return [];
    if (activeBoq.sections && activeBoq.sections.length > 0) {
      return activeBoq.sections.map((s, idx) => ({
        id: s.id || `sec-${idx + 1}`,
        title: s.sectionTitle || s.name || `Section ${idx + 1}`,
        items: (activeBoq.items || []).filter((it) => (it.sectionId ? it.sectionId === s.id : it.category === s.sectionTitle)),
      }));
    }
    // Fallback: Group by category
    const items = activeBoq.items || [];
    const cats = Array.from(new Set(items.map((i) => i.category || 'General Scope')));
    return cats.map((cat, idx) => ({
      id: `sec-${idx + 1}`,
      title: cat,
      items: items.filter((i) => (i.category || 'General Scope') === cat),
    }));
  }, [activeBoq]);

  // Initialize
  useEffect(() => {
    if (!isModalOpen) return;

    if (isEditing && targetQuote) {
      setQuotationTitle(targetQuote.title || `Quotation v${targetQuote.version || 1}`);
      setScopeMode(targetQuote.scopeMode || 'custom');
      setQuoteItems(
        (targetQuote.items || []).map((it) => ({
          description: it.description || it.itemName || '',
          category: it.category || 'General Scope',
          quantity: String(it.quantity ?? 1),
          unit: it.unit || 'nos',
          unitPrice: String(it.unitPrice ?? it.rate ?? 0),
          total: (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice || it.rate) || 0),
          boqItemId: it.boqItemId || null,
        }))
      );
      setTaxPct(String(targetQuote.taxPercentage ?? 18));
      setDiscountAmt(String(targetQuote.discount ?? 0));
      setQuoteNotes(targetQuote.notes || '');
    } else {
      // New quote
      const qNum = (existingQuotations?.length || 0) + 1;
      setQuotationTitle(`Quotation ${qNum}`);
      setTaxPct('18');
      setDiscountAmt('0');
      setMarkupPct('0');
      setQuoteNotes('1. Quotation is valid for 30 days.\n2. 50% advance payment required to commence work.\n3. Goods once delivered and approved will not be returned.');

      if (activeBoq && activeBoq.items && activeBoq.items.length > 0) {
        setScopeMode('all');
        const catMap = {};
        const itMap = {};
        boqSections.forEach((sec) => {
          catMap[sec.title] = true;
          sec.items.forEach((it, iIdx) => {
            itMap[it.id || it._id || `${sec.id}-${iIdx}`] = true;
          });
        });
        setSelectedCategories(catMap);
        setSelectedItemIds(itMap);

        // Populate items from BOQ
        const mapped = activeBoq.items.map((it) => ({
          description: it.itemName || it.description || 'BOQ Item',
          category: it.category || it.sectionTitle || 'General',
          quantity: String(it.quantity ?? 1),
          unit: it.unit || 'sqft',
          unitPrice: String(it.rate ?? 0),
          total: (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0),
          boqItemId: it.id || it._id || null,
        }));
        setQuoteItems(mapped);
      } else {
        setScopeMode('custom');
        setQuoteItems([{ description: '', category: 'General', quantity: '1', unit: 'nos', unitPrice: '0', total: 0 }]);
      }
    }
  }, [isModalOpen, isEditing, targetQuote, activeBoq, existingQuotations]);

  // Sync items when scope changes
  const applyScopeSelection = (newScopeMode, newCatMap, newItemMap) => {
    if (!activeBoq || !activeBoq.items) return;

    let selected = [];
    if (newScopeMode === 'all') {
      selected = activeBoq.items;
    } else if (newScopeMode === 'categories') {
      selected = activeBoq.items.filter((it) => {
        const cat = it.category || it.sectionTitle || 'General Scope';
        return Boolean(newCatMap[cat]);
      });
    } else if (newScopeMode === 'items') {
      selected = activeBoq.items.filter((it, idx) => {
        const id = it.id || it._id || `item-${idx}`;
        return Boolean(newItemMap[id]);
      });
    }

    const markup = 1 + (parseFloat(markupPct) || 0) / 100;
    const mapped = selected.map((it) => {
      const unitRate = (parseFloat(it.rate) || 0) * markup;
      const qty = parseFloat(it.quantity) || 1;
      return {
        description: it.itemName || it.description || 'BOQ Item',
        category: it.category || it.sectionTitle || 'General',
        quantity: String(qty),
        unit: it.unit || 'sqft',
        unitPrice: String(Math.round(unitRate)),
        total: qty * Math.round(unitRate),
        boqItemId: it.id || it._id || null,
      };
    });

    setQuoteItems(mapped.length > 0 ? mapped : [{ description: '', category: 'General', quantity: '1', unit: 'nos', unitPrice: '0', total: 0 }]);
  };

  const handleScopeModeChange = (mode) => {
    setScopeMode(mode);
    if (mode === 'all') {
      const catMap = {};
      const itMap = {};
      boqSections.forEach((sec) => {
        catMap[sec.title] = true;
        sec.items.forEach((it, iIdx) => {
          itMap[it.id || it._id || `${sec.id}-${iIdx}`] = true;
        });
      });
      setSelectedCategories(catMap);
      setSelectedItemIds(itMap);
      applyScopeSelection('all', catMap, itMap);
    } else if (mode === 'categories') {
      applyScopeSelection('categories', selectedCategories, selectedItemIds);
    } else if (mode === 'items') {
      applyScopeSelection('items', selectedCategories, selectedItemIds);
    }
  };

  const toggleCategory = (catTitle) => {
    const updated = { ...selectedCategories, [catTitle]: !selectedCategories[catTitle] };
    setSelectedCategories(updated);
    applyScopeSelection('categories', updated, selectedItemIds);
  };

  const toggleItem = (itemId) => {
    const updated = { ...selectedItemIds, [itemId]: !selectedItemIds[itemId] };
    setSelectedItemIds(updated);
    applyScopeSelection('items', selectedCategories, updated);
  };

  const applyMarkup = (pct) => {
    setMarkupPct(pct);
    const markupVal = 1 + (parseFloat(pct) || 0) / 100;
    setQuoteItems((prev) =>
      prev.map((it) => {
        // Apply markup to base unitPrice
        const base = parseFloat(it.unitPrice) || 0;
        const newRate = Math.round(base * markupVal);
        const qty = parseFloat(it.quantity) || 0;
        return {
          ...it,
          unitPrice: String(newRate),
          total: qty * newRate,
        };
      })
    );
  };

  // Line item modifications
  const updateQuoteItem = (idx, field, val) => {
    setQuoteItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[idx], [field]: val };
      if (field === 'quantity' || field === 'unitPrice') {
        const q = parseFloat(item.quantity) || 0;
        const r = parseFloat(item.unitPrice) || 0;
        item.total = q * r;
      }
      copy[idx] = item;
      return copy;
    });
  };

  const addCustomItem = () => {
    setQuoteItems((prev) => [
      ...prev,
      { description: '', category: 'Custom Item', quantity: '1', unit: 'nos', unitPrice: '0', total: 0 },
    ]);
  };

  const removeQuoteItem = (idx) => {
    if (quoteItems.length <= 1) return;
    setQuoteItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Financials
  const subtotal = useMemo(() => {
    return quoteItems.reduce((acc, it) => acc + (it.total || 0), 0);
  }, [quoteItems]);

  const taxAmount = useMemo(() => {
    const t = parseFloat(taxPct) || 0;
    return Math.round((subtotal * t) / 100);
  }, [subtotal, taxPct]);

  const discountVal = useMemo(() => {
    return parseFloat(discountAmt) || 0;
  }, [discountAmt]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal + taxAmount - discountVal);
  }, [subtotal, taxAmount, discountVal]);

  // Save handler
  const handleSave = async () => {
    if (quoteItems.length === 0 || quoteItems.every((i) => !i.description.trim())) {
      Alert.alert('Error', 'Please include at least one valid line item.');
      return;
    }
    if (grandTotal <= 0) {
      Alert.alert('Error', 'Quotation total must be greater than ₹0.');
      return;
    }

    setSubmitting(true);
    try {
      const updatedQuotations = [...(existingQuotations || [])];

      const cleanItems = quoteItems
        .filter((it) => it.description && it.description.trim())
        .map((it) => ({
          description: it.description.trim(),
          category: it.category || 'General Scope',
          quantity: parseFloat(it.quantity) || 1,
          unit: it.unit || 'nos',
          unitPrice: parseFloat(it.unitPrice) || 0,
          total: (parseFloat(it.quantity) || 1) * (parseFloat(it.unitPrice) || 0),
          boqItemId: it.boqItemId || null,
        }));

      const quotePayload = {
        title: quotationTitle.trim() || `Quotation ${updatedQuotations.length + 1}`,
        version: isEditing ? targetQuote.version : updatedQuotations.length + 1,
        sourceBoqVersion: activeBoq?.version || 1,
        scopeMode,
        items: cleanItems,
        subtotal,
        taxPercentage: parseFloat(taxPct) || 0,
        tax: taxAmount,
        discount: discountVal,
        grandTotal,
        notes: quoteNotes.trim(),
        status: isEditing ? targetQuote.status || 'Draft' : 'Draft',
        updatedAt: new Date(),
      };

      if (isEditing) {
        updatedQuotations[editingQuoteIndex] = { ...targetQuote, ...quotePayload };
      } else {
        quotePayload.createdAt = new Date();
        updatedQuotations.push(quotePayload);
      }

      await interiorCrmService.updateCustomer(customerId, {
        quotations: updatedQuotations,
        status: 'Quotation Sent',
      });

      await interiorCrmService.createActivity({
        customer: customerId,
        type: 'System Update',
        status: 'Completed',
        remarks: isEditing
          ? `Quotation v${quotePayload.version} updated with total ${formatExactCurrency(grandTotal)}.`
          : `Quotation v${quotePayload.version} generated from BOQ with total ${formatExactCurrency(grandTotal)}.`,
        completedDate: new Date(),
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.warn('Save quotation error:', err);
      Alert.alert('Error', err.message || 'Failed to save quotation.');
    } finally {
      setSubmitting(false);
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
                <Ionicons name="calculator" size={18} color="#2563EB" />
                <Text style={s.headerTitle}>Quotation Builder</Text>
              </View>
              <Text style={s.headerSub}>
                {isEditing ? `Editing v${targetQuote?.version || 1}` : `Generating v${(existingQuotations?.length || 0) + 1}`} • Link to BOQ & configure margins
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
            {/* Title / Option Name */}
            <Text style={s.fieldLabel}>Quotation Title / Option Name</Text>
            <TextInput
              style={s.input}
              value={quotationTitle}
              onChangeText={setQuotationTitle}
              placeholder="e.g. Option A - Luxury Specification"
              placeholderTextColor="#94A3B8"
            />

            {/* Scope Selection from BOQ */}
            {activeBoq && (
              <View style={s.scopeSection}>
                <View style={s.scopeHeaderRow}>
                  <Ionicons name="layers-outline" size={14} color="#2563EB" />
                  <Text style={s.scopeHeaderTitle}>BOQ Scope Mode (v{activeBoq.version || 1})</Text>
                </View>

                <View style={s.scopeTabs}>
                  <TouchableOpacity
                    style={[s.scopeTab, scopeMode === 'all' && s.scopeTabActive]}
                    onPress={() => handleScopeModeChange('all')}
                  >
                    <Ionicons name="checkmark-done" size={13} color={scopeMode === 'all' ? '#FFFFFF' : '#2563EB'} />
                    <Text style={[s.scopeTabText, scopeMode === 'all' && s.scopeTabTextActive]}>All Items</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.scopeTab, scopeMode === 'categories' && s.scopeTabActive]}
                    onPress={() => handleScopeModeChange('categories')}
                  >
                    <Ionicons name="grid-outline" size={12} color={scopeMode === 'categories' ? '#FFFFFF' : '#2563EB'} />
                    <Text style={[s.scopeTabText, scopeMode === 'categories' && s.scopeTabTextActive]}>By Zone</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.scopeTab, scopeMode === 'items' && s.scopeTabActive]}
                    onPress={() => handleScopeModeChange('items')}
                  >
                    <Ionicons name="list-outline" size={13} color={scopeMode === 'items' ? '#FFFFFF' : '#2563EB'} />
                    <Text style={[s.scopeTabText, scopeMode === 'items' && s.scopeTabTextActive]}>Pick Items</Text>
                  </TouchableOpacity>
                </View>

                {/* Categories Mode Pills */}
                {scopeMode === 'categories' && (
                  <View style={s.categoriesPillsWrap}>
                    {boqSections.map((sec) => {
                      const isSel = Boolean(selectedCategories[sec.title]);
                      return (
                        <TouchableOpacity
                          key={sec.id}
                          style={[s.catPill, isSel && s.catPillActive]}
                          onPress={() => toggleCategory(sec.title)}
                        >
                          <Ionicons
                            name={isSel ? 'checkbox' : 'square-outline'}
                            size={14}
                            color={isSel ? '#2563EB' : '#64748B'}
                          />
                          <Text style={[s.catPillText, isSel && s.catPillTextActive]}>{sec.title}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Items Mode Accordion */}
                {scopeMode === 'items' && (
                  <View style={s.itemsPickList}>
                    {boqSections.map((sec) => (
                      <View key={sec.id} style={s.secPickGroup}>
                        <TouchableOpacity
                          style={s.secPickHeader}
                          onPress={() =>
                            setExpandedSections((prev) => ({ ...prev, [sec.id]: !prev[sec.id] }))
                          }
                        >
                          <Ionicons
                            name={expandedSections[sec.id] ? 'chevron-down' : 'chevron-forward'}
                            size={14}
                            color="#2563EB"
                          />
                          <Text style={s.secPickTitle}>{sec.title} ({sec.items.length})</Text>
                        </TouchableOpacity>

                        {expandedSections[sec.id] && (
                          <View style={s.secPickItemsList}>
                            {sec.items.map((it, idx) => {
                              const itId = it.id || it._id || `item-${idx}`;
                              const isSel = Boolean(selectedItemIds[itId]);
                              return (
                                <TouchableOpacity
                                  key={itId}
                                  style={s.itemPickRow}
                                  onPress={() => toggleItem(itId)}
                                >
                                  <Ionicons
                                    name={isSel ? 'checkbox' : 'square-outline'}
                                    size={16}
                                    color={isSel ? '#2563EB' : '#94A3B8'}
                                  />
                                  <Text style={s.itemPickName} numberOfLines={1}>
                                    {it.itemName || it.description}
                                  </Text>
                                  <Text style={s.itemPickRate}>{formatExactCurrency(it.rate || 0)}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Quick Markup Applicator */}
            <View style={s.markupBox}>
              <View style={{ flex: 1 }}>
                <Text style={s.markupTitle}>Apply Profit Margin / Markup (%)</Text>
                <Text style={s.markupSub}>Increases unit rates of all line items proportionally</Text>
              </View>
              <View style={s.markupInputsRow}>
                {['0', '5', '10', '15', '20'].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[s.markupChip, markupPct === p && s.markupChipActive]}
                    onPress={() => applyMarkup(p)}
                  >
                    <Text style={[s.markupChipText, markupPct === p && s.markupChipTextActive]}>+{p}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Line Items List */}
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={s.sectionTitle}>Quotation Items ({quoteItems.length})</Text>
                <TouchableOpacity onPress={addCustomItem} style={s.addCustomBtn}>
                  <Ionicons name="add" size={14} color="#2563EB" />
                  <Text style={s.addCustomBtnText}>Add Custom Item</Text>
                </TouchableOpacity>
              </View>

              {quoteItems.map((item, idx) => (
                <View key={idx} style={s.quoteItemCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      style={[s.input, { flex: 1 }]}
                      value={item.description}
                      onChangeText={(val) => updateQuoteItem(idx, 'description', val)}
                      placeholder="Line item description"
                      placeholderTextColor="#94A3B8"
                    />
                    {quoteItems.length > 1 && (
                      <TouchableOpacity onPress={() => removeQuoteItem(idx)} style={s.itemTrashBtn}>
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={s.quoteItemDetailsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.miniLabel}>Qty</Text>
                      <TextInput
                        style={s.miniInput}
                        value={String(item.quantity)}
                        onChangeText={(val) => updateQuoteItem(idx, 'quantity', val)}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.miniLabel}>Unit</Text>
                      <TextInput
                        style={s.miniInput}
                        value={item.unit}
                        onChangeText={(val) => updateQuoteItem(idx, 'unit', val)}
                        placeholder="sqft"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <View style={{ flex: 1.4 }}>
                      <Text style={s.miniLabel}>Rate (₹)</Text>
                      <TextInput
                        style={s.miniInput}
                        value={String(item.unitPrice)}
                        onChangeText={(val) => updateQuoteItem(idx, 'unitPrice', val)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <View style={{ flex: 1.5, alignItems: 'flex-end', justifyContent: 'center' }}>
                      <Text style={s.miniLabel}>Total</Text>
                      <Text style={s.itemTotalText}>{formatExactCurrency(item.total || 0)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Financial Summary */}
            <View style={s.financialCard}>
              <View style={s.finRow}>
                <Text style={s.finLabel}>Scope Subtotal</Text>
                <Text style={s.finVal}>{formatExactCurrency(subtotal)}</Text>
              </View>

              <View style={s.finRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.finLabel}>Tax (GST) %</Text>
                  <TextInput
                    style={s.taxInput}
                    value={taxPct}
                    onChangeText={setTaxPct}
                    keyboardType="numeric"
                    placeholder="18"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <Text style={s.finVal}>+ {formatExactCurrency(taxAmount)}</Text>
              </View>

              <View style={s.finRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.finLabel}>Discount (₹)</Text>
                  <TextInput
                    style={s.discountInput}
                    value={discountAmt}
                    onChangeText={setDiscountAmt}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <Text style={[s.finVal, { color: '#059669' }]}>- {formatExactCurrency(discountVal)}</Text>
              </View>

              <View style={s.grandTotalRow}>
                <Text style={s.grandTotalLabel}>Grand Total Proposal</Text>
                <Text style={s.grandTotalVal}>{formatExactCurrency(grandTotal)}</Text>
              </View>
            </View>

            {/* Terms & Notes */}
            <Text style={s.fieldLabel}>Terms & Scope Stipulations</Text>
            <TextInput
              style={s.notesInput}
              value={quoteNotes}
              onChangeText={setQuoteNotes}
              placeholder="Payment terms, validity, exclusions..."
              placeholderTextColor="#94A3B8"
              multiline
            />

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[s.saveBtn, submitting && { opacity: 0.7 }]} onPress={handleSave} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                  <Text style={s.saveBtnText}>{isEditing ? 'Update Quotation' : 'Save & Generate'}</Text>
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
    height: '92%',
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
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#475569',
    marginBottom: 5,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
  },

  // Scope
  scopeSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginTop: 10,
  },
  scopeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  scopeHeaderTitle: {
    fontSize: 11.5,
    fontFamily: 'Inter-Bold',
    color: '#1E40AF',
  },
  scopeTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  scopeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 7,
  },
  scopeTabActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  scopeTabText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#2563EB',
  },
  scopeTabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  categoriesPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  catPillActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  catPillText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  catPillTextActive: {
    color: '#2563EB',
    fontFamily: 'Inter-SemiBold',
  },

  itemsPickList: {
    marginTop: 10,
    gap: 6,
  },
  secPickGroup: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  secPickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: '#F8FAFC',
  },
  secPickTitle: {
    fontSize: 11.5,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  secPickItemsList: {
    padding: 6,
    gap: 4,
  },
  itemPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  itemPickName: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#334155',
    flex: 1,
  },
  itemPickRate: {
    fontSize: 10.5,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },

  // Markup
  markupBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  markupTitle: {
    fontSize: 11.5,
    fontFamily: 'Inter-Bold',
    color: '#1E40AF',
  },
  markupSub: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#3B82F6',
  },
  markupInputsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  markupChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markupChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  markupChipText: {
    fontSize: 10.5,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  markupChipTextActive: {
    color: '#FFFFFF',
  },

  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addCustomBtnText: {
    fontSize: 11.5,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
  },
  quoteItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    gap: 6,
  },
  itemTrashBtn: {
    padding: 6,
  },
  quoteItemDetailsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  miniLabel: {
    fontSize: 9.5,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
    marginBottom: 2,
  },
  miniInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 11.5,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
  },
  itemTotalText: {
    fontSize: 12.5,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },

  financialCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 10,
    gap: 8,
  },
  finRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finLabel: {
    fontSize: 11.5,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  finVal: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  taxInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    width: 44,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Inter-Bold',
  },
  discountInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    width: 60,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Inter-Bold',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 12.5,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  grandTotalVal: {
    fontSize: 15,
    fontFamily: 'Inter-Black',
    color: '#16A34A',
  },
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 11.5,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
    height: 60,
    textAlignVertical: 'top',
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
  saveBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});

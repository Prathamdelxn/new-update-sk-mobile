import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Modal, TextInput, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Checkbox from 'expo-checkbox';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function LabourManagement({ project, selectedDate }) {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [labourers, setLabourers] = useState([]);
  const [attendanceState, setAttendanceState] = useState({}); // { labourId: { isChecked: true/false, status: 'Present'/'Half Day' } }
  const [savedAttendanceState, setSavedAttendanceState] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSavedInDB, setIsSavedInDB] = useState(false);

  // Add Labour Modal States
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newLabour, setNewLabour] = useState({
    name: '',
    type: 'Unskilled', // 'Skilled' or 'Unskilled'
    paymentCycle: 'Monthly',
    wageAmount: ''
  });
  const [addingLabour, setAddingLabour] = useState(false);
  const [editingLabourId, setEditingLabourId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Export Modal States
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(new Date());
  const [exportEndDate, setExportEndDate] = useState(new Date());
  const [showPickerFor, setShowPickerFor] = useState(null); // 'start' or 'end'

  useEffect(() => {
    if (project?._id && selectedDate) {
      fetchData();
    }
  }, [project, selectedDate]);

  const fetchData = async (hideLoader = false) => {
    if (!hideLoader) setLoading(true);
    try {
      const [labourRes, attRes] = await Promise.all([
        fetch(`${API_BASE_URL}/labour?projectId=${project._id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/labour-attendance?projectId=${project._id}&date=${selectedDate}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (labourRes.ok && attRes.ok) {
        let labourData = await labourRes.json();
        const attData = await attRes.json();
        setIsSavedInDB(attData.length > 0);
        
        // Map existing attendance records
        const attMap = {};
        attData.forEach(r => {
          attMap[r.labour?._id || r.labour] = r.status;
        });

        // Sort labourers: marked ones go to the bottom
        labourData.sort((a, b) => {
          const aMarked = !!attMap[a._id];
          const bMarked = !!attMap[b._id];
          if (aMarked && !bMarked) return 1;
          if (!aMarked && bMarked) return -1;
          return 0;
        });
        
        setLabourers(labourData);
        
        // Initialize attendance state
        const initialState = {};
        
        labourData.forEach(labour => {
          const existingStatus = attMap[labour._id];
          if (existingStatus) {
            // Already marked
            initialState[labour._id] = {
              isChecked: existingStatus !== 'Absent',
              status: existingStatus === 'Absent' ? 'Present' : existingStatus // keep default for toggle if they check it back
            };
          } else {
            // Default new
            initialState[labour._id] = {
              isChecked: true, // By default checked (Present)
              status: 'Present'
            };
          }
        });
        
        setAttendanceState(initialState);
        setSavedAttendanceState(initialState);
      }
    } catch (e) {
      showToast('error', 'Failed to load labour data');
    } finally {
      if (!hideLoader) setLoading(false);
    }
  };

  const openEditModal = (labour) => {
    setNewLabour({
      name: labour.name,
      type: labour.type,
      paymentCycle: labour.paymentCycle,
      wageAmount: labour.wageAmount.toString()
    });
    setEditingLabourId(labour._id);
    setAddModalVisible(true);
  };

  const closeAddModal = () => {
    setAddModalVisible(false);
    setNewLabour({ name: '', type: 'Unskilled', paymentCycle: 'Monthly', wageAmount: '' });
    setEditingLabourId(null);
  };

  const handleSaveLabour = async () => {
    if (!newLabour.name || !newLabour.wageAmount) {
      showToast('error', 'Please fill name and wage amount');
      return;
    }
    setAddingLabour(true);
    try {
      let res;
      if (editingLabourId) {
        res = await fetch(`${API_BASE_URL}/labour/${editingLabourId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(newLabour)
        });
      } else {
        const payload = { project: project._id, ...newLabour };
        res = await fetch(`${API_BASE_URL}/labour`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }
      
      if (res.ok) {
        showToast('success', editingLabourId ? 'Labourer updated' : 'Labourer added successfully');
        closeAddModal();
        fetchData(); // Refresh list
      } else {
        showToast('error', 'Failed to save labourer');
      }
    } catch (e) {
      showToast('error', 'Network error');
    } finally {
      setAddingLabour(false);
    }
  };

  const handleDeleteLabour = async () => {
    if (!editingLabourId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/labour/${editingLabourId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('success', 'Labourer deleted');
        closeAddModal();
        fetchData();
      } else {
        showToast('error', 'Failed to delete');
      }
    } catch (e) {
      showToast('error', 'Network error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmitBulk = async () => {
    setSubmitting(true);
    try {
      // Prepare payload based on current state
      const attendances = labourers.map(labour => {
        const state = attendanceState[labour._id];
        let finalStatus = 'Absent';
        if (state.isChecked) {
          finalStatus = state.status; // 'Present' or 'Half Day'
        }
        return {
          labourId: labour._id,
          status: finalStatus
        };
      });

      const res = await fetch(`${API_BASE_URL}/labour-attendance/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId: project._id,
          date: selectedDate,
          attendances
        })
      });

      if (res.ok) {
        showToast('success', 'Attendance saved successfully');
        fetchData(true);
      } else {
        showToast('error', 'Failed to save attendance');
      }
    } catch (e) {
      showToast('error', 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const onDateChange = (event, selectedD) => {
    const current = selectedD || (showPickerFor === 'start' ? exportStartDate : exportEndDate);
    if (Platform.OS === 'android') {
      setShowPickerFor(null);
    }
    if (showPickerFor === 'start') {
      setExportStartDate(current);
    } else if (showPickerFor === 'end') {
      setExportEndDate(current);
    }
  };

  const handleDownloadPayroll = async () => {
    setIsDownloading(true);
    try {
      const startStr = exportStartDate.toISOString().split('T')[0];
      const endStr = exportEndDate.toISOString().split('T')[0];
      const url = `${API_BASE_URL}/labour/export?projectId=${project._id}&startDate=${startStr}&endDate=${endStr}`;
      
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        showToast('error', 'Failed to download payroll');
        return;
      }
      
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = async () => {
        const base64data = reader.result.split(',')[1];
        const fileUri = `${FileSystem.documentDirectory}Labour_Payroll_${startStr}_to_${endStr}.xlsx`;
        await FileSystem.writeAsStringAsync(fileUri, base64data, { encoding: 'base64' });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          showToast('error', 'Sharing is not available on this device');
        }
      };
      reader.readAsDataURL(blob);
      setExportModalVisible(false);
    } catch (e) {
      showToast('error', 'Network error during download');
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleCheck = (id) => {
    setAttendanceState(prev => ({
      ...prev,
      [id]: { ...prev[id], isChecked: !prev[id].isChecked }
    }));
  };

  const toggleHalfDay = (id, currentStatus) => {
    setAttendanceState(prev => ({
      ...prev,
      [id]: { ...prev[id], status: currentStatus === 'Present' ? 'Half Day' : 'Present' }
    }));
  };

  const filteredLabourers = labourers.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const hasChanges = Object.keys(attendanceState).some(id => {
    const current = attendanceState[id];
    const saved = savedAttendanceState[id] || { isChecked: true, status: 'Present' };
    return current.isChecked !== saved.isChecked || current.status !== saved.status;
  });

  const isSaveDisabled = submitting || (isSavedInDB && !hasChanges);

  if (loading) {
    return <ActivityIndicator size="small" color="#2563EB" style={{ margin: 20 }} />;
  }

  return (
    <View>
      <View style={s.headerRow}>
        <TextInput
          style={s.searchInput}
          placeholder="Search labourer..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        <View style={s.actionGroup}>
          <TouchableOpacity style={s.downloadBtn} onPress={() => setExportModalVisible(true)}>
            <Ionicons name="download-outline" size={20} color="#2563EB" />
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={() => { setEditingLabourId(null); setAddModalVisible(true); }}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={s.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {labourers.length === 0 ? (
        <View style={s.emptyBox}>
          <Ionicons name="people-outline" size={40} color="#CBD5E1" />
          <Text style={s.emptyText}>No labourers added yet.</Text>
        </View>
      ) : (
        <>
          <View style={s.listHeader}>
            <Text style={[s.listHeaderText, { width: 40 }]}>Mark</Text>
            <Text style={[s.listHeaderText, { flex: 1, paddingLeft: 8 }]}>Name</Text>
            <Text style={[s.listHeaderText, { width: 90, textAlign: 'center' }]}>Day Type</Text>
            <Text style={[s.listHeaderText, { width: 40, textAlign: 'center' }]}></Text>
          </View>

          <ScrollView style={s.listContainer} nestedScrollEnabled showsVerticalScrollIndicator={true}>
            {filteredLabourers.map(labour => {
              const state = attendanceState[labour._id] || { isChecked: true, status: 'Present' };
              const isChecked = state.isChecked;
              
              return (
                <View key={labour._id} style={[s.card, !isChecked && s.cardAbsent]}>
                  <View style={{ width: 40, alignItems: 'center' }}>
                    <Checkbox
                      value={isChecked}
                      onValueChange={() => toggleCheck(labour._id)}
                      color={isChecked ? '#2563EB' : undefined}
                      style={s.checkbox}
                    />
                  </View>
                  <View style={{ flex: 1, paddingLeft: 8 }}>
                    <Text style={[s.labourName, !isChecked && s.textDisabled]}>{labour.name}</Text>
                    <Text style={[s.labourSub, !isChecked && s.textDisabled]}>{labour.type} • Monthly</Text>
                  </View>
                  
                  <View style={{ width: 90, alignItems: 'center' }}>
                    {isChecked ? (
                      <TouchableOpacity 
                        style={[s.typeBadge, state.status === 'Half Day' ? s.typeBadgeHalf : s.typeBadgeFull]}
                        onPress={() => toggleHalfDay(labour._id, state.status)}
                      >
                        <Text style={[s.typeBadgeText, state.status === 'Half Day' ? s.typeTextHalf : s.typeTextFull]}>
                          {state.status === 'Half Day' ? 'Half' : 'Full'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={s.absentText}>Absent</Text>
                    )}
                  </View>
                  <View style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}>
                    <TouchableOpacity onPress={() => openEditModal(labour)}>
                      <Ionicons name="pencil" size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity 
            style={[s.submitBtn, isSaveDisabled && s.submitBtnDisabled]} 
            onPress={handleSubmitBulk} 
            disabled={isSaveDisabled}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Save Attendance</Text>}
          </TouchableOpacity>
        </>
      )}

      {/* Add/Edit Labour Modal */}
      <Modal visible={addModalVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={s.modalTitle}>{editingLabourId ? 'Edit Labourer' : 'Add New Labourer'}</Text>
              {editingLabourId && (
                <TouchableOpacity onPress={handleDeleteLabour} disabled={isDeleting} style={s.deleteBtnTop}>
                  {isDeleting ? <ActivityIndicator size="small" color="#EF4444" /> : <Ionicons name="trash" size={22} color="#EF4444" />}
                </TouchableOpacity>
              )}
            </View>
            
            <Text style={s.label}>Full Name</Text>
            <TextInput style={s.input} value={newLabour.name} onChangeText={t => setNewLabour({...newLabour, name: t})} placeholder="e.g. John Doe" />

            <View style={s.splitRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Type</Text>
                <View style={s.toggleGroup}>
                  <TouchableOpacity style={[s.toggleBtn, newLabour.type === 'Skilled' && s.toggleActive]} onPress={() => setNewLabour({...newLabour, type: 'Skilled'})}>
                    <Text style={[s.toggleText, newLabour.type === 'Skilled' && s.toggleTextActive]}>Skilled</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.toggleBtn, newLabour.type === 'Unskilled' && s.toggleActive]} onPress={() => setNewLabour({...newLabour, type: 'Unskilled'})}>
                    <Text style={[s.toggleText, newLabour.type === 'Unskilled' && s.toggleTextActive]}>Unskilled</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Text style={s.label}>Wage Amount (AED)</Text>
            <TextInput style={s.input} value={newLabour.wageAmount} onChangeText={t => setNewLabour({...newLabour, wageAmount: t})} placeholder="e.g. 150" keyboardType="numeric" />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={closeAddModal}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSaveLabour} disabled={addingLabour}>
                {addingLabour ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{editingLabourId ? 'Save Changes' : 'Save Labourer'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Export Modal */}
      <Modal visible={exportModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Export Payroll</Text>
            
            <View style={{ marginBottom: 16 }}>
              <Text style={s.label}>Start Date</Text>
              <TouchableOpacity style={s.dateInput} onPress={() => setShowPickerFor('start')}>
                <Text style={s.dateInputText}>{exportStartDate.toLocaleDateString()}</Text>
                <Ionicons name="calendar-outline" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={s.label}>End Date</Text>
              <TouchableOpacity style={s.dateInput} onPress={() => setShowPickerFor('end')}>
                <Text style={s.dateInputText}>{exportEndDate.toLocaleDateString()}</Text>
                <Ionicons name="calendar-outline" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {showPickerFor && (
              <DateTimePicker
                value={showPickerFor === 'start' ? exportStartDate : exportEndDate}
                mode="date"
                display="default"
                onChange={onDateChange}
              />
            )}
            
            {Platform.OS === 'ios' && showPickerFor && (
               <TouchableOpacity style={{ alignSelf: 'flex-end', marginBottom: 16 }} onPress={() => setShowPickerFor(null)}>
                 <Text style={{ color: '#2563EB', fontFamily: 'Inter-Bold', fontSize: 16 }}>Done</Text>
               </TouchableOpacity>
            )}

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => {setExportModalVisible(false); setShowPickerFor(null);}}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, {backgroundColor: '#16A34A'}]} onPress={handleDownloadPayroll} disabled={isDownloading}>
                {isDownloading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Download</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', gap: 8, marginBottom: 16, alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E0F2FE', fontFamily: 'Inter-Medium', fontSize: 14 },
  actionGroup: { flexDirection: 'row', gap: 8 },
  downloadBtn: { backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, gap: 6 },
  addBtnText: { color: '#fff', fontFamily: 'Inter-SemiBold', fontSize: 14 },
  
  emptyBox: { alignItems: 'center', paddingVertical: 50, backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: '#E0F2FE' },
  emptyText: { fontFamily: 'Inter-Medium', color: '#94A3B8', marginTop: 12, fontSize: 14 },
  
  listHeader: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, marginBottom: 4 },
  listHeaderText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  listContainer: { maxHeight: 400 },
  
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 12, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E0F2FE' },
  cardAbsent: { backgroundColor: '#F8FAFC', opacity: 0.8 },
  checkbox: { width: 22, height: 22, borderRadius: 6 },
  
  labourName: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#1E293B' },
  labourSub: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 4 },
  textDisabled: { color: '#94A3B8' },
  
  typeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  typeBadgeFull: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  typeTextFull: { color: '#16A34A', fontSize: 12, fontFamily: 'Inter-Bold' },
  typeBadgeHalf: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  typeTextHalf: { color: '#D97706', fontSize: 12, fontFamily: 'Inter-Bold' },
  absentText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#EF4444' },

  submitBtn: { backgroundColor: '#2563EB', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitBtnText: { color: '#fff', fontFamily: 'Inter-Bold', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A' },
  deleteBtnTop: { backgroundColor: '#FEE2E2', padding: 8, borderRadius: 20 },
  label: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#475569', marginBottom: 8 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E0F2FE', borderRadius: 12, padding: 14, fontSize: 15, fontFamily: 'Inter-Medium', marginBottom: 20 },
  splitRow: { flexDirection: 'row', marginBottom: 20 },
  toggleGroup: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0F2FE' },
  toggleText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' },
  toggleTextActive: { color: '#0F172A', fontFamily: 'Inter-Bold' },
  
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#F1F5F9' },
  cancelText: { color: '#475569', fontFamily: 'Inter-Bold', fontSize: 14 },
  saveBtn: { backgroundColor: '#0F172A', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontFamily: 'Inter-Bold', fontSize: 14 },
  
  dateInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E0F2FE', marginTop: 6 },
  dateInputText: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#1E293B' }
});

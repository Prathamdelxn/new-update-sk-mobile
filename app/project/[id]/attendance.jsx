import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Modal, Platform, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import LabourManagement from './LabourManagement';
import { isProjectLocked } from '../../utils/permissions';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function ProjectAttendanceTab({ project }) {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [monthlyRecords, setMonthlyRecords] = useState([]);
  const [expandedRecordId, setExpandedRecordId] = useState(null);

  // Calendar States
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [displayedMonth, setDisplayedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [showCalendar, setShowCalendar] = useState(false);

  // Export States
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(new Date());
  const [exportEndDate, setExportEndDate] = useState(new Date());
  const [showPickerFor, setShowPickerFor] = useState(null); // 'start' or 'end'
  const [exporting, setExporting] = useState(false);
  const [exportUserId, setExportUserId] = useState(null); // null means all users
  const [searchQuery, setSearchQuery] = useState('');
  
  // Manual Override States
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualUserId, setManualUserId] = useState(null);
  const [submittingManual, setSubmittingManual] = useState(false);
  
  const [activeTab, setActiveTab] = useState('Team'); // 'Team' or 'Labour'

  const isAdmin = user?.role?.name === 'Admin' || user?.role === 'Admin';

  useEffect(() => {
    fetchAttendanceData(displayedMonth);
  }, [project, displayedMonth]);

  const fetchAttendanceData = async (monthStr) => {
    if (!project?._id) return;
    setLoading(true);
    try {
      const resMonthly = await fetch(`${API_BASE_URL}/attendance/monthly?projectId=${project._id}&month=${monthStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resMonthly.ok) {
        const data = await resMonthly.json();
        setMonthlyRecords(data.records || []);
      }
    } catch (e) {
      console.error(e);
      showToast('error', 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const startStr = exportStartDate.toISOString().split('T')[0];
      const endStr = exportEndDate.toISOString().split('T')[0];
      
      let url = `${API_BASE_URL}/attendance/export?projectId=${project._id}&startDate=${startStr}&endDate=${endStr}`;
      if (isAdmin && exportUserId) {
        url += `&userId=${exportUserId}`;
      }

      const filename = `Attendance_Export_${startStr}_to_${endStr}.xlsx`;
      const destinationFile = new File(Paths.cache, filename);
      
      const downloadedFile = await File.downloadFileAsync(url, destinationFile, {
        headers: { Authorization: `Bearer ${token}` },
        idempotent: true // Overwrite if it already exists
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadedFile.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Share Attendance Excel'
        });
      } else {
        showToast('error', 'Sharing is not available on this device');
      }
      setExportModalVisible(false);
    } catch (e) {
      console.error(e);
      showToast('error', 'Error exporting Excel file');
    } finally {
      setExporting(false);
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

  const handleManualOverride = async () => {
    if (!manualUserId) return;
    if (isProjectLocked(project)) { showToast('error', 'This project is locked and can no longer be modified.'); return; }
    setSubmittingManual(true);
    try {
      const res = await fetch(`${API_BASE_URL}/attendance/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId: project._id,
          userId: manualUserId,
          date: selectedDate
        })
      });
      if (res.ok) {
        showToast('success', 'Attendance marked manually!');
        setManualModalVisible(false);
        setManualUserId(null);
        fetchAttendanceData(displayedMonth);
      } else {
        const err = await res.json();
        showToast('error', err.message || 'Failed to mark attendance');
      }
    } catch (e) {
      showToast('error', 'Network error');
    } finally {
      setSubmittingManual(false);
    }
  };

  const filteredRecords = monthlyRecords.filter(rec => {
    if (!rec.attendanceDate) return false;
    return rec.attendanceDate.startsWith(selectedDate);
  });

  // Calculate missing members for manual override
  const presentUserIds = filteredRecords.map(r => r.user?._id).filter(Boolean);
  const eligibleTeamMembers = (project?.members || [])
    .map(m => m.user)
    .filter(u => u && !presentUserIds.includes(u._id));

  // Extract unique users from loaded monthly records for Admin export filtering
  const uniqueMembers = Array.from(new Set(monthlyRecords.map(r => r.user?._id)))
    .map(id => monthlyRecords.find(r => r.user?._id === id)?.user)
    .filter(Boolean);

  const searchedMembers = uniqueMembers.filter(m => {
    const name = (m.name || m.email || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  if (loading && monthlyRecords.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <TouchableOpacity 
          style={s.dateSelectorBtn} 
          onPress={() => setShowCalendar(!showCalendar)}
        >
          <Ionicons name="calendar-outline" size={20} color="#0F172A" />
          <Text style={s.dateSelectorText}>
            {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <Ionicons name={showCalendar ? "chevron-up" : "chevron-down"} size={20} color="#0F172A" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={s.exportIconBtn} 
          onPress={() => setExportModalVisible(true)}
        >
          <Ionicons name="download-outline" size={22} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        {showCalendar && (
          <Calendar
            current={selectedDate}
            onDayPress={(day) => {
              setSelectedDate(day.dateString);
              setShowCalendar(false);
            }}
            onMonthChange={(month) => {
              const newMonth = month.dateString.substring(0, 7);
              setDisplayedMonth(newMonth);
            }}
            markedDates={{
              [selectedDate]: { selected: true, selectedColor: '#2563EB' }
            }}
            theme={{
              todayTextColor: '#2563EB',
              arrowColor: '#2563EB',
              textDayFontFamily: 'Inter-Medium',
              textMonthFontFamily: 'Inter-Bold',
              textDayHeaderFontFamily: 'Inter-SemiBold',
            }}
            style={{ marginBottom: 16 }}
          />
        )}

        {isAdmin && (
          <View style={s.tabContainer}>
            <TouchableOpacity 
              style={[s.tabBtn, activeTab === 'Team' && s.tabBtnActive]} 
              onPress={() => setActiveTab('Team')}
            >
              <Text style={[s.tabText, activeTab === 'Team' && s.tabTextActive]}>Team</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.tabBtn, activeTab === 'Labour' && s.tabBtnActive]} 
              onPress={() => setActiveTab('Labour')}
            >
              <Text style={[s.tabText, activeTab === 'Labour' && s.tabTextActive]}>Labour</Text>
            </TouchableOpacity>
          </View>
        )}

        {isAdmin ? (
          activeTab === 'Team' ? (
            <>
              <View style={s.teamHeaderRow}>
                <Text style={s.sectionTitle}>Team Check-ins</Text>
                {!isProjectLocked(project) && (
                  <TouchableOpacity style={s.overrideBtn} onPress={() => setManualModalVisible(true)}>
                    <Ionicons name="add" size={16} color="#2563EB" />
                    <Text style={s.overrideBtnText}>Manual Override</Text>
                  </TouchableOpacity>
                )}
              </View>

              {filteredRecords.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="people-outline" size={40} color="#94A3B8" />
                <Text style={s.emptyText}>No attendance records for this date.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                {filteredRecords.map((rec, i) => (
                  <TouchableOpacity 
                    key={rec._id || i} 
                    activeOpacity={0.7}
                    onPress={() => setExpandedRecordId(expandedRecordId === rec._id ? null : rec._id)}
                  >
                    <View style={s.historyRow}>
                      <View>
                        <Text style={s.historyDate}>{rec.user?.name || rec.user?.email || 'Unknown User'}</Text>
                        <Text style={s.historyTime}>
                          In: {new Date(rec.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          {rec.checkOutTime ? ` • Out: ${new Date(rec.checkOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : ''}
                        </Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: '#16A34A20' }]}>
                        <Text style={[s.badgeText, { color: '#16A34A' }]}>Present</Text>
                      </View>
                    </View>

                    {expandedRecordId === rec._id && (
                      <View style={s.expandedBox}>
                        {rec.checkInPhoto ? (
                          <>
                            <Text style={s.label}>Check-in Photo Verification:</Text>
                            <Image source={{ uri: rec.checkInPhoto }} style={s.expandedPhoto} resizeMode="cover" />
                          </>
                        ) : (
                          <Text style={s.emptyText}>No photo uploaded for this session.</Text>
                        )}
                        {rec.totalWorkHours && (
                          <View style={[s.row, {marginTop: 10}]}>
                            <Text style={s.label}>Total Logged Hours:</Text>
                            <Text style={s.value}>{rec.totalWorkHours}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            </>
          ) : (
            <LabourManagement project={project} selectedDate={selectedDate} />
          )
        ) : (
          <>
            <Text style={s.sectionTitle}>Your Attendance</Text>
            {filteredRecords.length > 0 ? (
              <View style={s.recordBox}>
                <View style={s.row}>
                  <Text style={s.label}>Date:</Text>
                  <Text style={s.value}>{new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                </View>
                <View style={s.row}>
                  <Text style={s.label}>Check-In Time:</Text>
                  <Text style={s.value}>{new Date(filteredRecords[0].checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                </View>
                {filteredRecords[0].checkOutTime && (
                  <>
                    <View style={s.row}>
                      <Text style={s.label}>Check-Out Time:</Text>
                      <Text style={s.value}>{new Date(filteredRecords[0].checkOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                    </View>
                    {filteredRecords[0].totalWorkHours && (
                      <View style={s.row}>
                        <Text style={s.label}>Total Hours:</Text>
                        <Text style={s.value}>{filteredRecords[0].totalWorkHours}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            ) : (
              <View style={s.emptyBox}>
                <Ionicons name="time-outline" size={40} color="#94A3B8" />
                <Text style={s.emptyText}>You haven't checked in on this date.</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Export Modal */}
      <Modal visible={exportModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Export to Excel</Text>
            
            {isAdmin && uniqueMembers.length > 0 && (
              <View style={[s.pickerContainer, { maxHeight: 220 }]}>
                <Text style={s.label}>Select Member</Text>
                <TextInput
                  style={s.searchInput}
                  placeholder="Search member by name..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#94A3B8"
                />
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true} style={{marginTop: 8}}>
                  <TouchableOpacity 
                    style={[s.memberListItem, exportUserId === null && s.memberListItemActive]}
                    onPress={() => setExportUserId(null)}
                  >
                    <Text style={[s.memberListItemText, exportUserId === null && s.memberListItemTextActive]}>All Team Members</Text>
                  </TouchableOpacity>
                  {searchedMembers.map(member => (
                    <TouchableOpacity 
                      key={member._id}
                      style={[s.memberListItem, exportUserId === member._id && s.memberListItemActive]}
                      onPress={() => setExportUserId(member._id)}
                    >
                      <Text style={[s.memberListItemText, exportUserId === member._id && s.memberListItemTextActive]}>{member.name || member.email}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={s.pickerContainer}>
              <Text style={s.label}>Start Date</Text>
              <TouchableOpacity style={s.dateInput} onPress={() => setShowPickerFor('start')}>
                <Text style={s.dateInputText}>{exportStartDate.toLocaleDateString()}</Text>
                <Ionicons name="calendar-outline" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={s.pickerContainer}>
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
               <TouchableOpacity style={s.iosDoneBtn} onPress={() => setShowPickerFor(null)}>
                 <Text style={s.iosDoneText}>Done</Text>
               </TouchableOpacity>
            )}

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => {setExportModalVisible(false); setShowPickerFor(null);}}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.exportBtn} onPress={handleExport} disabled={exporting}>
                {exporting ? <ActivityIndicator color="#fff" /> : <Text style={s.exportText}>Download Excel</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual Override Modal */}
      <Modal visible={manualModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Manual Override</Text>
            <Text style={s.label}>Select a member who hasn't checked in today ({new Date(selectedDate).toLocaleDateString()}):</Text>
            
            {eligibleTeamMembers.length === 0 ? (
              <Text style={[s.emptyText, { marginVertical: 20 }]}>All team members are already present!</Text>
            ) : (
              <ScrollView style={{ maxHeight: 220, marginTop: 12, marginBottom: 16 }} showsVerticalScrollIndicator={true}>
                {eligibleTeamMembers.map(member => (
                  <TouchableOpacity 
                    key={member._id}
                    style={[s.memberListItem, manualUserId === member._id && s.memberListItemActive]}
                    onPress={() => setManualUserId(member._id)}
                  >
                    <Text style={[s.memberListItemText, manualUserId === member._id && s.memberListItemTextActive]}>
                      {member.name || member.email}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => {setManualModalVisible(false); setManualUserId(null);}}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              {eligibleTeamMembers.length > 0 && (
                <TouchableOpacity style={s.exportBtn} onPress={handleManualOverride} disabled={!manualUserId || submittingManual}>
                  {submittingManual ? <ActivityIndicator color="#fff" /> : <Text style={s.exportText}>Mark Present</Text>}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingTop: 10 },
  center: { padding: 40, alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 },
  dateSelectorBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E0F2FE', gap: 8, marginRight: 10 },
  dateSelectorText: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  exportIconBtn: { backgroundColor: '#EFF6FF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#E0F2FE', marginBottom: 20 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  tabBtnActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0F2FE' },
  tabText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center' },
  tabTextActive: { color: '#0F172A', fontFamily: 'Inter-Bold' },
  teamHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  overrideBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DBEAFE', gap: 4 },
  overrideBtnText: { color: '#2563EB', fontFamily: 'Inter-Bold', fontSize: 13 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  recordBox: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B' },
  value: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontFamily: 'Inter-Bold' },
  emptyBox: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 10, textAlign: 'center' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  historyDate: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#1E293B' },
  historyTime: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 2 },
  expandedBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginTop: 4, marginBottom: 8, borderWidth: 1, borderColor: '#E0F2FE' },
  expandedPhoto: { width: '100%', height: 200, borderRadius: 8, marginTop: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', width: '100%', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 20 },
  pickerContainer: { marginBottom: 16 },
  dateInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E0F2FE', marginTop: 6 },
  dateInputText: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#1E293B' },
  searchInput: { backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: '#E0F2FE', fontFamily: 'Inter-Medium', fontSize: 14, color: '#0F172A' },
  memberListItem: { padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E0F2FE' },
  memberListItemActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  memberListItemText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#475569' },
  memberListItemTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },
  iosDoneBtn: { alignSelf: 'flex-end', marginBottom: 16 },
  iosDoneText: { color: '#2563EB', fontFamily: 'Inter-Bold', fontSize: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { color: '#64748B', fontFamily: 'Inter-Medium', fontSize: 15 },
  exportBtn: { backgroundColor: '#16A34A', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  exportText: { color: '#fff', fontFamily: 'Inter-Bold', fontSize: 15 }
});

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Modal, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocalSearchParams } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const { width } = Dimensions.get('window');

export default function ProjectReportsTab() {
  const { id } = useLocalSearchParams();
  const { token } = useAuth();
  
  const [reportType, setReportType] = useState('Daily'); // 'Daily' | 'Monthly' | 'Custom'
  const [customSubTab, setCustomSubTab] = useState('Tasks'); // 'Tasks' | 'Logs' | 'Issues' | 'Snags'
  
  const [milestones, setMilestones] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [issues, setIssues] = useState([]);
  const [snags, setSnags] = useState([]);
  const [project, setProject] = useState(null);
  
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // Default: 7 days ago
  const [endDate, setEndDate] = useState(new Date());
  
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedIssueDetail, setSelectedIssueDetail] = useState(null);
  const [selectedSnagDetail, setSelectedSnagDetail] = useState(null);
  const [successEmail, setSuccessEmail] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !token) return;
      try {
        setIsLoading(true);
        const [mRes, pRes, iRes, sRes] = await Promise.all([
          fetch(`${API_BASE_URL}/projects/${id}/milestones`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_BASE_URL}/projects/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_BASE_URL}/projects/${id}/issues`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_BASE_URL}/projects/${id}/snags`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        
        if (mRes.ok) setMilestones(await mRes.json());
        
        if (pRes.ok) {
          const pData = await pRes.json();
          setProject(pData);
          const members = [...(pData.members || [])];
          if (pData.createdBy) members.push(pData.createdBy);
          setProjectMembers(members);
        }

        if (iRes.ok) setIssues(await iRes.json());
        if (sRes.ok) setSnags(await sRes.json());
      } catch (err) {
        console.error("Fetch reports error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, token]);

  const onStartChange = (event, selectedDate) => {
    setShowStartPicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const onEndChange = (event, selectedDate) => {
    setShowEndPicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  // Filter Tasks and Calculate Chart Data
  const { chartData, groupedTasks, totalFiltered } = useMemo(() => {
    const allCompletedTasks = [];
    milestones.forEach(m => {
      if (m.tasks) {
        m.tasks.forEach(t => {
          if (t.isCompleted) {
            allCompletedTasks.push({
              ...t,
              milestoneName: m.name,
              completedAtDate: new Date(t.completedAt || m.updatedAt || new Date())
            });
          }
        });
      }
    });

    const cData = [];
    const grouped = {};
    let tFiltered = 0;

    if (reportType === 'Daily') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const count = allCompletedTasks.filter(t => 
          t.completedAtDate.getDate() === d.getDate() && 
          t.completedAtDate.getMonth() === d.getMonth() &&
          t.completedAtDate.getFullYear() === d.getFullYear()
        ).length;
        cData.push({ value: count, label: dateStr });
      }

      // Filter tasks for last 7 days for the list
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentTasks = allCompletedTasks.filter(t => t.completedAtDate >= sevenDaysAgo);
      recentTasks.forEach(t => {
        if (!grouped[t.milestoneName]) grouped[t.milestoneName] = [];
        grouped[t.milestoneName].push(t);
        tFiltered++;
      });

    } else if (reportType === 'Monthly') {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStr = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        const count = allCompletedTasks.filter(t => 
          t.completedAtDate.getMonth() === d.getMonth() &&
          t.completedAtDate.getFullYear() === d.getFullYear()
        ).length;
        cData.push({ value: count, label: monthStr });
      }

      // Filter tasks for last 6 months for the list
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const recentTasks = allCompletedTasks.filter(t => t.completedAtDate >= sixMonthsAgo);
      recentTasks.forEach(t => {
        if (!grouped[t.milestoneName]) grouped[t.milestoneName] = [];
        grouped[t.milestoneName].push(t);
        tFiltered++;
      });
    } else {
      // Custom Range
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const rangeTasks = allCompletedTasks.filter(t => t.completedAtDate >= start && t.completedAtDate <= end);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

      if (diffDays <= 15) {
        // Daily points
        for (let i = 0; i < diffDays; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const count = rangeTasks.filter(t => 
            t.completedAtDate.getDate() === d.getDate() && 
            t.completedAtDate.getMonth() === d.getMonth() &&
            t.completedAtDate.getFullYear() === d.getFullYear()
          ).length;
          cData.push({ value: count, label: dateStr });
        }
      } else {
        // Monthly points
        const startMonth = start.getMonth();
        const startYear = start.getFullYear();
        const endMonth = end.getMonth();
        const endYear = end.getFullYear();
        
        let currYear = startYear;
        let currMonth = startMonth;
        
        while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
          const d = new Date(currYear, currMonth, 1);
          const monthStr = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          const count = rangeTasks.filter(t => 
            t.completedAtDate.getMonth() === currMonth &&
            t.completedAtDate.getFullYear() === currYear
          ).length;
          cData.push({ value: count, label: monthStr });
          
          currMonth++;
          if (currMonth > 11) {
            currMonth = 0;
            currYear++;
          }
        }
      }

      rangeTasks.forEach(t => {
        if (!grouped[t.milestoneName]) grouped[t.milestoneName] = [];
        grouped[t.milestoneName].push(t);
        tFiltered++;
      });
    }

    return { chartData: cData.length > 0 ? cData : [{ value: 0, label: 'No Data' }], groupedTasks: grouped, totalFiltered: tFiltered };
  }, [milestones, reportType, startDate, endDate]);

  // Filter Audit Logs for Custom Range
  const filteredLogs = useMemo(() => {
    if (!project?.auditTrail) return [];
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    return project.auditTrail.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= start && logDate <= end;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [project, startDate, endDate]);

  // Filter Issues for Custom Range
  const filteredIssues = useMemo(() => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    return issues.filter(issue => {
      const issueDate = new Date(issue.createdAt);
      return issueDate >= start && issueDate <= end;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [issues, startDate, endDate]);

  // Filter Snags for Custom Range
  const filteredSnags = useMemo(() => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    return snags.filter(snag => {
      const snagDate = new Date(snag.createdAt);
      return snagDate >= start && snagDate <= end;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [snags, startDate, endDate]);

  // Handle PDF Export via Backend API
  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      
      const response = await fetch(`${API_BASE_URL}/projects/${id}/email-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reportType,
          startDate,
          endDate,
          // customTargetEmail: 'optional_override@email.com' // Using logged-in user by default
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessEmail(data.sentTo);
      } else {
        throw new Error(data.message || "Failed to generate report");
      }

    } catch (error) {
      console.error("PDF export/email failed:", error);
      Alert.alert("Error", error.message || "Something went wrong while requesting the report.");
    } finally {
      setIsExporting(false);
    }
  };

  // Display count dynamically based on selection
  const headerCount = useMemo(() => {
    if (reportType !== 'Custom') return totalFiltered;
    if (customSubTab === 'Tasks') return totalFiltered;
    if (customSubTab === 'Logs') return filteredLogs.length;
    if (customSubTab === 'Issues') return filteredIssues.length;
    if (customSubTab === 'Snags') return filteredSnags.length;
    return 0;
  }, [reportType, customSubTab, totalFiltered, filteredLogs, filteredIssues, filteredSnags]);

  const headerLabel = useMemo(() => {
    if (reportType !== 'Custom') return 'Completed Tasks';
    if (customSubTab === 'Tasks') return 'Completed Tasks';
    if (customSubTab === 'Logs') return 'Activity Logs';
    if (customSubTab === 'Issues') return 'Issues Reported';
    if (customSubTab === 'Snags') return 'Snags Reported';
    return '';
  }, [reportType, customSubTab]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 10, color: '#64748B', fontFamily: 'Inter-Medium' }}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Toggle */}
        <View style={styles.toggleWrapper}>
          <View style={styles.toggleBox}>
            <TouchableOpacity 
              style={[styles.toggleBtn, reportType === 'Daily' && styles.toggleBtnActive]}
              onPress={() => setReportType('Daily')}
            >
              <Text style={[styles.toggleText, reportType === 'Daily' && styles.toggleTextActive]}>Daily</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, reportType === 'Monthly' && styles.toggleBtnActive]}
              onPress={() => setReportType('Monthly')}
            >
              <Text style={[styles.toggleText, reportType === 'Monthly' && styles.toggleTextActive]}>Monthly</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, reportType === 'Custom' && styles.toggleBtnActive]}
              onPress={() => setReportType('Custom')}
            >
              <Text style={[styles.toggleText, reportType === 'Custom' && styles.toggleTextActive]}>Custom</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Custom Date Range Selectors */}
        {reportType === 'Custom' && (
          <View style={styles.dateSelectorContainer}>
            <View style={styles.dateSelectorCol}>
              <Text style={styles.dateSelectorLabel}>Start Date</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartPicker(true)}>
                <Feather name="calendar" size={14} color="#3B82F6" />
                <Text style={styles.dateButtonText}>{startDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateSelectorCol}>
              <Text style={styles.dateSelectorLabel}>End Date</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndPicker(true)}>
                <Feather name="calendar" size={14} color="#3B82F6" />
                <Text style={styles.dateButtonText}>{endDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                maximumDate={endDate}
                onChange={onStartChange}
              />
            )}

            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                minimumDate={startDate}
                maximumDate={new Date()}
                onChange={onEndChange}
              />
            )}
          </View>
        )}

        <View style={styles.headerContainer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{headerLabel}</Text>
            <Text style={styles.bigNumber}>{headerCount}</Text>
            <Text style={styles.subtitle}>
              {reportType === 'Daily' && 'in last 7 days'}
              {reportType === 'Monthly' && 'in last 6 months'}
              {reportType === 'Custom' && `from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`}
            </Text>
          </View>
          <TouchableOpacity style={styles.exportButton} onPress={handleExportPDF} activeOpacity={0.8}>
            <Feather name="download" size={16} color="#FFFFFF" />
            <Text style={styles.exportButtonText}>Export</Text>
          </TouchableOpacity>
        </View>

        {/* Chart (Hidden if Logs/Issues/Snags is selected in Custom view) */}
        {(reportType !== 'Custom' || customSubTab === 'Tasks') && (
          <View style={styles.chartContainer}>
            <LineChart
              data={chartData}
              width={width - 40}
              height={180}
              spacing={(width - 40) / Math.max(chartData.length, 1)}
              initialSpacing={15}
              color1="#3B82F6"
              textColor1="#3B82F6"
              dataPointsColor1="#3B82F6"
              dataPointsRadius1={4}
              areaChart
              startFillColor1="#3B82F6"
              endFillColor1="#EFF6FF"
              startOpacity={0.6}
              endOpacity={0.1}
              thickness={3}
              hideRules
              hideYAxisText
              yAxisColor="transparent"
              xAxisColor="#E2E8F0"
              xAxisLabelTextStyle={{ color: '#64748B', fontSize: 10, fontFamily: 'Inter-Medium' }}
              curved
              isAnimated
            />
          </View>
        )}

        {/* Custom Sub Tabs */}
        {reportType === 'Custom' && (
          <View style={styles.subTabWrapper}>
            {['Tasks', 'Logs', 'Issues', 'Snags'].map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.subTabBtn, customSubTab === tab && styles.subTabBtnActive]}
                onPress={() => setCustomSubTab(tab)}
              >
                <Text style={[styles.subTabBtnText, customSubTab === tab && styles.subTabBtnTextActive]}>
                  {tab === 'Tasks' && `Tasks (${totalFiltered})`}
                  {tab === 'Logs' && `Logs (${filteredLogs.length})`}
                  {tab === 'Issues' && `Issues (${filteredIssues.length})`}
                  {tab === 'Snags' && `Snags (${filteredSnags.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Breakdown List Section */}
        <View style={styles.listSection}>
          {reportType !== 'Custom' || customSubTab === 'Tasks' ? (
            <>
              <Text style={styles.listTitle}>Breakdown by Milestone</Text>
              {Object.keys(groupedTasks).length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No tasks completed in this range.</Text>
                </View>
              ) : (
                Object.entries(groupedTasks).map(([milestoneName, tasks], idx) => (
                  <View key={idx} style={styles.milestoneBlock}>
                    <Text style={styles.milestoneName}>{milestoneName}</Text>
                    <View style={styles.tasksContainer}>
                      {tasks.map((task, tIdx) => (
                        <TouchableOpacity key={tIdx} style={styles.simpleTaskRow} activeOpacity={0.7} onPress={() => setSelectedTask(task)}>
                          <View style={styles.dot} />
                          <View style={styles.taskInfo}>
                            <Text style={styles.taskTitle}>{task.title}</Text>
                            <Text style={styles.taskDate}>{task.completedAtDate.toLocaleDateString()}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </>
          ) : customSubTab === 'Logs' ? (
            <>
              <Text style={styles.listTitle}>Activity Logs</Text>
              {filteredLogs.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No activity logs in this range.</Text>
                </View>
              ) : (
                <View style={styles.logsList}>
                  {filteredLogs.map((log, idx) => (
                    <TouchableOpacity key={idx} style={styles.logCard} activeOpacity={0.8} onPress={() => setSelectedLog(log)}>
                      <View style={styles.logHeader}>
                        <View style={styles.logUserBadge}>
                          <Text style={styles.logUserTxt}>{log.userName?.charAt(0) || 'U'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.logUserTitle}>{log.userName || 'System'}</Text>
                          <Text style={styles.logRoleText}>{log.userRole || 'Member'}</Text>
                        </View>
                        <Text style={styles.logTimeText}>{new Date(log.timestamp).toLocaleDateString()}</Text>
                      </View>
                      <Text style={styles.logDetails} numberOfLines={2}>{log.details}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          ) : customSubTab === 'Issues' ? (
            <>
              <Text style={styles.listTitle}>Project Issues</Text>
              {filteredIssues.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No issues reported in this range.</Text>
                </View>
              ) : (
                <View style={styles.issuesList}>
                  {filteredIssues.map((issue, idx) => (
                    <TouchableOpacity key={idx} style={styles.issueCard} activeOpacity={0.8} onPress={() => setSelectedIssueDetail(issue)}>
                      <View style={styles.issueHeader}>
                        <Text style={styles.issueCardTitle} numberOfLines={1}>{issue.title}</Text>
                        <View style={[styles.priorityTag, { backgroundColor: issue.priority === 'Critical' ? '#FEF2F2' : '#F8FAFC' }]}>
                          <Text style={[styles.priorityTagText, { color: issue.priority === 'Critical' ? '#EF4444' : '#64748B' }]}>{issue.priority}</Text>
                        </View>
                      </View>
                      <Text style={styles.issueDesc} numberOfLines={2}>{issue.description}</Text>
                      <View style={styles.issueFooter}>
                        <Text style={styles.issueDateText}>{new Date(issue.createdAt).toLocaleDateString()}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: issue.status === 'Resolved' || issue.status === 'Closed' ? '#DCFCE7' : '#FEF3C7' }]}>
                          <Text style={[styles.statusBadgeText, { color: issue.status === 'Resolved' || issue.status === 'Closed' ? '#16A34A' : '#D97706' }]}>{issue.status}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.listTitle}>Project Snags</Text>
              {filteredSnags.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No snags reported in this range.</Text>
                </View>
              ) : (
                <View style={styles.issuesList}>
                  {filteredSnags.map((snag, idx) => (
                    <TouchableOpacity key={idx} style={styles.issueCard} activeOpacity={0.8} onPress={() => setSelectedSnagDetail(snag)}>
                      <View style={styles.issueHeader}>
                        <Text style={styles.issueCardTitle} numberOfLines={1}>{snag.title}</Text>
                        <View style={[styles.priorityTag, { backgroundColor: snag.priority === 'Critical' ? '#FEF2F2' : '#F8FAFC' }]}>
                          <Text style={[styles.priorityTagText, { color: snag.priority === 'Critical' ? '#EF4444' : '#64748B' }]}>{snag.priority}</Text>
                        </View>
                      </View>
                      <Text style={styles.issueDesc} numberOfLines={2}>{snag.description}</Text>
                      <View style={styles.issueFooter}>
                        <Text style={styles.issueDateText}>{new Date(snag.createdAt).toLocaleDateString()}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: snag.status === 'Resolved' ? '#DCFCE7' : '#FEF3C7' }]}>
                          <Text style={[styles.statusBadgeText, { color: snag.status === 'Resolved' ? '#16A34A' : '#D97706' }]}>{snag.status}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

      </ScrollView>

      {/* Task Details Modal */}
      <Modal visible={!!selectedTask} transparent animationType="fade" onRequestClose={() => setSelectedTask(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSelectedTask(null)} />
          <View style={styles.modalContent}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Task Details</Text>
              <TouchableOpacity onPress={() => setSelectedTask(null)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.detailTitle}>{selectedTask?.title}</Text>
              
              <View style={styles.detailRow}>
                <Feather name="calendar" size={16} color="#64748B" />
                <Text style={styles.detailText}>
                  Start Date: {selectedTask?.startDate ? new Date(selectedTask.startDate).toLocaleDateString() : 'N/A'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Feather name="calendar" size={16} color="#64748B" />
                <Text style={styles.detailText}>
                  End Date: {selectedTask?.endDate ? new Date(selectedTask.endDate).toLocaleDateString() : 'N/A'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Feather name="user" size={16} color="#64748B" />
                <Text style={styles.detailText}>
                  Created By: {selectedTask?.createdByName || 'Unknown'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Feather name="user" size={16} color="#64748B" />
                <Text style={styles.detailText}>
                  Completed By: {selectedTask?.completedByName || 'Unknown'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Feather name="calendar" size={16} color="#64748B" />
                <Text style={styles.detailText}>
                  Completed On: {selectedTask?.completedAtDate?.toLocaleDateString()}
                </Text>
              </View>

              {selectedTask?.completionNote ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Completion Note:</Text>
                  <Text style={styles.noteText}>{selectedTask.completionNote}</Text>
                </View>
              ) : null}

              {selectedTask?.proofImage?.url ? (
                <View style={styles.proofContainer}>
                  <Text style={styles.proofLabel}>Proof of Work:</Text>
                  <Image source={{ uri: selectedTask.proofImage.url }} style={styles.proofImage} resizeMode="cover" />
                </View>
              ) : (
                <View style={styles.noProofBox}>
                  <Ionicons name="image-outline" size={24} color="#CBD5E1" />
                  <Text style={styles.noProofText}>No proof image provided</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Log Details Modal */}
      <Modal visible={!!selectedLog} transparent animationType="fade" onRequestClose={() => setSelectedLog(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSelectedLog(null)} />
          <View style={styles.modalContent}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Details</Text>
              <TouchableOpacity onPress={() => setSelectedLog(null)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.logDetailUserRow}>
                <View style={styles.largeLogUserBadge}>
                  <Text style={styles.largeLogUserTxt}>{selectedLog?.userName?.charAt(0) || 'S'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logDetailUserName}>{selectedLog?.userName || 'System Action'}</Text>
                  <Text style={styles.logDetailUserRole}>{selectedLog?.userRole || 'System'}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Feather name="activity" size={16} color="#64748B" />
                <Text style={styles.detailText}>Action: {selectedLog?.action}</Text>
              </View>

              <View style={styles.detailRow}>
                <Feather name="calendar" size={16} color="#64748B" />
                <Text style={styles.detailText}>
                  Timestamp: {selectedLog ? new Date(selectedLog.timestamp).toLocaleString() : ''}
                </Text>
              </View>

              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>Details:</Text>
                <Text style={styles.noteText}>{selectedLog?.details}</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Issue Details Modal */}
      <Modal visible={!!selectedIssueDetail} transparent animationType="fade" onRequestClose={() => setSelectedIssueDetail(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSelectedIssueDetail(null)} />
          <View style={styles.modalContent}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Issue Details</Text>
              <TouchableOpacity onPress={() => setSelectedIssueDetail(null)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.detailTitle}>{selectedIssueDetail?.title}</Text>

              <View style={styles.detailRow}>
                <Feather name="info" size={16} color="#64748B" />
                <Text style={styles.detailText}>Category: {selectedIssueDetail?.category || 'Other'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Feather name="alert-circle" size={16} color="#64748B" />
                <Text style={styles.detailText}>Priority: {selectedIssueDetail?.priority || 'Medium'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Feather name="activity" size={16} color="#64748B" />
                <Text style={styles.detailText}>Status: {selectedIssueDetail?.status}</Text>
              </View>

              <View style={styles.detailRow}>
                <Feather name="calendar" size={16} color="#64748B" />
                <Text style={styles.detailText}>
                  Reported: {selectedIssueDetail ? new Date(selectedIssueDetail.createdAt).toLocaleString() : ''}
                </Text>
              </View>

              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>Description:</Text>
                <Text style={styles.noteText}>{selectedIssueDetail?.description}</Text>
              </View>

              {selectedIssueDetail?.images && selectedIssueDetail.images.length > 0 && (
                <View style={styles.proofContainer}>
                  <Text style={styles.proofLabel}>Attachments:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {selectedIssueDetail.images.map((img, idx) => (
                      <Image key={idx} source={{ uri: img }} style={styles.issueImagePreview} resizeMode="cover" />
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Snag Details Modal */}
      <Modal visible={!!selectedSnagDetail} transparent animationType="fade" onRequestClose={() => setSelectedSnagDetail(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSelectedSnagDetail(null)} />
          <View style={styles.modalContent}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Snag Details</Text>
              <TouchableOpacity onPress={() => setSelectedSnagDetail(null)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.detailTitle}>{selectedSnagDetail?.title}</Text>

              <View style={styles.detailRow}>
                <Feather name="alert-circle" size={16} color="#64748B" />
                <Text style={styles.detailText}>Priority: {selectedSnagDetail?.priority || 'Medium'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Feather name="activity" size={16} color="#64748B" />
                <Text style={styles.detailText}>Status: {selectedSnagDetail?.status}</Text>
              </View>

              <View style={styles.detailRow}>
                <Feather name="calendar" size={16} color="#64748B" />
                <Text style={styles.detailText}>
                  Reported: {selectedSnagDetail ? new Date(selectedSnagDetail.createdAt).toLocaleString() : ''}
                </Text>
              </View>

              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>Description:</Text>
                <Text style={styles.noteText}>{selectedSnagDetail?.description}</Text>
              </View>

              {selectedSnagDetail?.images && selectedSnagDetail.images.length > 0 && (
                <View style={styles.proofContainer}>
                  <Text style={styles.proofLabel}>Attachments:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {selectedSnagDetail.images.map((img, idx) => (
                      <Image key={idx} source={{ uri: img }} style={styles.issueImagePreview} resizeMode="cover" />
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Exporting Loading Modal */}
      <Modal visible={isExporting} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center', paddingVertical: 40 }]}>
            <ActivityIndicator size="large" color="#3B82F6" style={{ marginBottom: 20, transform: [{ scale: 1.2 }] }} />
            <Text style={{ fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 10 }}>Generating Report...</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', paddingHorizontal: 20, lineHeight: 22 }}>
              Please wait while we compile your project data and prepare the document. It will be sent to your email shortly.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={!!successEmail} transparent animationType="fade" onRequestClose={() => setSuccessEmail(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSuccessEmail(null)} />
          <View style={[styles.modalContent, { alignItems: 'center', paddingVertical: 40 }]}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
              <Feather name="check" size={40} color="#16A34A" />
            </View>
            <Text style={{ fontSize: 24, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 10 }}>Report Sent!</Text>
            <Text style={{ fontSize: 16, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center', marginBottom: 30, paddingHorizontal: 20, lineHeight: 24 }}>
              The project report has been successfully generated and emailed to <Text style={{ fontFamily: 'Inter-Medium', color: '#3B82F6' }}>{successEmail}</Text>.
            </Text>
            <TouchableOpacity 
              style={{ backgroundColor: '#3B82F6', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, width: '100%', alignItems: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
              onPress={() => setSuccessEmail(null)}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-SemiBold' }}>Done!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    paddingBottom: 100,
  },
  toggleWrapper: {
    paddingTop: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  toggleBox: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 30,
    padding: 4,
    width: 290,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 26,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
  },
  toggleTextActive: {
    color: '#0F172A',
    fontFamily: 'Inter-Bold',
  },
  dateSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  dateSelectorCol: {
    flex: 1,
  },
  dateSelectorLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
    marginBottom: 6,
    marginLeft: 4,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#334155',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  bigNumber: {
    fontSize: 48,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    lineHeight: 52,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 4,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    fontSize: 13,
  },
  chartContainer: {
    marginBottom: 20,
    marginLeft: -10,
  },
  subTabWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 6,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabBtnActive: {
    backgroundColor: '#3B82F6',
  },
  subTabBtnText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
    textAlign: 'center',
  },
  subTabBtnTextActive: {
    color: '#FFFFFF',
  },
  listSection: {
    paddingHorizontal: 20,
    gap: 20,
  },
  listTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
  },
  milestoneBlock: {
    marginBottom: 10,
  },
  milestoneName: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 12,
  },
  tasksContainer: {
    gap: 12,
    paddingLeft: 4,
  },
  simpleTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginRight: 14,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#0F172A',
  },
  taskDate: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
    marginTop: 4,
  },
  logsList: {
    gap: 12,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  logUserBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logUserTxt: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#3B82F6',
  },
  logUserTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
  },
  logRoleText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
  },
  logTimeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
  },
  logDetails: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#475569',
    lineHeight: 18,
  },
  logDetailUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  largeLogUserBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeLogUserTxt: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#3B82F6',
  },
  logDetailUserName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
  },
  logDetailUserRole: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  issuesList: {
    gap: 12,
  },
  issueCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  issueCardTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    flex: 1,
    marginRight: 8,
  },
  priorityTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityTagText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  issueDesc: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#475569',
    marginBottom: 12,
    lineHeight: 18,
  },
  issueFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  issueDateText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
  },
  issueImagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  detailTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#475569',
  },
  noteBox: {
    backgroundColor: '#F8FAFF',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noteLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#3B82F6',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#334155',
    lineHeight: 20,
  },
  proofContainer: {
    marginTop: 8,
    marginBottom: 30,
  },
  proofLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  proofImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  noProofBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    marginTop: 10,
    marginBottom: 30,
  },
  noProofText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
    marginTop: 8,
  }
});

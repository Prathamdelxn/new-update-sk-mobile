import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, Modal, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { hasProjectPermission, isProjectLocked } from '../../utils/permissions';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import ConfirmModal from '../../components/ConfirmModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCompact } from '../../utils/format';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function ProjectHandoverTab({ project, fetchProjectData }) {
  const router = useRouter();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!socket || !fetchProjectData) return;
    socket.on('project:updated', fetchProjectData);
    return () => socket.off('project:updated', fetchProjectData);
  }, [socket, fetchProjectData]);
  const projectId = project?._id;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationData, setValidationData] = useState(null);
  const [isUserModalVisible, setIsUserModalVisible] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(project?.status);
  const [isSnaggingInfoVisible, setIsSnaggingInfoVisible] = useState(false);
  const [snags, setSnags] = useState([]);
  const [isLoadingSnags, setIsLoadingSnags] = useState(false);
  const [selectedSnag, setSelectedSnag] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]); // Added selection state
  const [confirmModal, setConfirmModal] = useState({ visible: false });
  const [isRejectionModalVisible, setIsRejectionModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showApproverAlert, setShowApproverAlert] = useState(false);
  const [hasShownApproverAlert, setHasShownApproverAlert] = useState(false);

  useEffect(() => {
    if (currentStatus === 'Pending Handover' && 
        (project?.handoverApprover?._id || project?.handoverApprover) === (user?.id || user?._id) && 
        !hasShownApproverAlert) {
      setShowApproverAlert(true);
      setHasShownApproverAlert(true);
    }
  }, [currentStatus, project?.handoverApprover, user?.id, user?._id, hasShownApproverAlert]);
  const isAssignedToMe = (project?.snaggedBy?._id || project?.snaggedBy) === (user?.id || user?._id);
  const canAssignSnagging = !isProjectLocked(project) && hasProjectPermission(user, project, 'snag:assign');
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const fetchProjectMembers = useCallback(async () => {
    try {
      setIsLoadingMembers(true);
      
      // Fetch every project member — being selected as approver is itself the
      // authorization, so this must not be pre-filtered to only members who
      // already hold the handover:approve permission (that hid most members).
      const response = await fetch(`${API_BASE_URL}/users?projectId=${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const fetchedUsers = await response.json();
        setProjectMembers(fetchedUsers);
      } else {
        setProjectMembers([]);
      }
    } catch (e) {
      console.error('Error fetching members:', e);
      setProjectMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    if (isUserModalVisible) {
      fetchProjectMembers();
    }
  }, [isUserModalVisible, fetchProjectMembers]);

  const fetchSnags = useCallback(async () => {
    try {
      setIsLoadingSnags(true);
      const response = await fetch(`${API_BASE_URL}/projects/${projectId}/snags`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        // Show Draft and Open snags in the handover view
        setSnags(data.filter(s => s.status === 'Draft' || s.status === 'Open' || s.status === 'In Progress'));
      }
    } catch (e) {
      console.error('Error fetching snags:', e);
    } finally {
      setIsLoadingSnags(false);
    }
  }, [projectId, token]);

  const initializeHandover = useCallback(async () => {
    try {
      setIsValidating(true);

      // 1. Fetch Issues
      let issues = [];
      try {
        const issuesRes = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/issues`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (issuesRes.ok) issues = await issuesRes.json();
      } catch (err) {
        console.error("Error fetching issues:", err);
      }
      const openIssues = issues.filter(i => i.status !== 'Resolved' && i.status !== 'Closed');

      // 2. Fetch Milestones
      let milestones = [];
      try {
        const milestonesRes = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/milestones`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (milestonesRes.ok) milestones = await milestonesRes.json();
      } catch (err) {
        console.error("Error fetching milestones:", err);
      }
      const incompleteMilestones = milestones.filter(m => m.status !== 'Completed');
      const incompleteTasks = milestones.flatMap(m => m.tasks || []).filter(t => !t.isCompleted);

      // 3. Fetch BOQ Items
      let boqItems = [];
      try {
        const boqRes = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/boq`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (boqRes.ok) boqItems = await boqRes.json();
      } catch (err) {
        console.error("Error fetching BOQ:", err);
      }
      const latestBoq = boqItems.filter(b => b.isLatest !== false);
      const pendingBoq = latestBoq.filter(b => b.status === 'Pending');
      const approvedBoqCount = latestBoq.filter(b => b.status === 'Approved').length;

      // 4. Fetch Technical Plans
      let folders = [];
      try {
        const foldersRes = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/folders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (foldersRes.ok) folders = await foldersRes.json();
      } catch (err) {
        console.error("Error fetching plans/folders:", err);
      }
      const allPlans = folders.flatMap(f => f.documents || []);
      const pendingPlans = allPlans.filter(doc => {
        const latestVer = doc.versions?.[doc.versions.length - 1];
        return latestVer && latestVer.approvalStatus === 'Pending';
      });
      const approvedPlansCount = allPlans.filter(doc => {
        const latestVer = doc.versions?.[doc.versions.length - 1];
        return latestVer && latestVer.approvalStatus === 'Approved';
      }).length;

      // 5. Fetch Risks
      let risks = [];
      try {
        const risksRes = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/risks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (risksRes.ok) risks = await risksRes.json();
      } catch (err) {
        console.error("Error fetching risks:", err);
      }
      const activeRisks = risks.filter(r => r.status === 'Critical' || r.status === 'Active');


      setValidationData({
        totalIssues: issues.length,
        openIssuesList: openIssues,

        milestonesList: milestones,
        incompleteMilestonesCount: incompleteMilestones.length,
        incompleteTasksCount: incompleteTasks.length,

        totalBoqs: latestBoq.length,
        approvedBoqCount,
        pendingBoqsList: pendingBoq,

        totalPlans: allPlans.length,
        approvedPlansCount,
        pendingPlansList: pendingPlans,

        totalRisks: risks.length,
        activeRisksList: activeRisks,

        isValid: openIssues.length === 0 &&
          incompleteMilestones.length === 0 &&
          incompleteTasks.length === 0 &&
          pendingBoq.length === 0 &&
          approvedBoqCount > 0 &&
          pendingPlans.length === 0 &&
          approvedPlansCount > 0 &&
          activeRisks.length === 0
      });

      if (openIssues.length === 0 && incompleteMilestones.length === 0 && incompleteTasks.length === 0 && pendingBoq.length === 0 && approvedBoqCount > 0 && pendingPlans.length === 0 && approvedPlansCount > 0 && activeRisks.length === 0) {
        fetchProjectMembers();
      }
    } catch (e) {
      console.error('Validation Error:', e);
    } finally {
      setIsValidating(false);
    }
  }, [projectId, token, fetchProjectMembers]);

  useEffect(() => {
    if (project?.status) {
      setCurrentStatus(project.status);
    }
  }, [project?.status]);

  useEffect(() => {
    if (currentStatus === 'Under Snagging') {
      fetchSnags();
    } else if (currentStatus !== 'Snagging Completed' && currentStatus !== 'In Progress') {
      initializeHandover();
    }
  }, [currentStatus, fetchSnags, initializeHandover]);

  const handleRequestHandover = async (selectedUser) => {
    try {
      setIsUserModalVisible(false);
      setIsSubmitting(true);
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'Pending Handover',
          handoverApprover: selectedUser._id,
          auditAction: 'StatusChange',
          auditDetails: `Handover completion requested from ${selectedUser.name}.`
        })
      });

      if (response.ok) {
        setCurrentStatus('Pending Handover');
        showToast("Handover Requested Successfully!", "success");
        if (fetchProjectData) await fetchProjectData();
      } else {
        const err = await response.json();
        Alert.alert("Error", err.message || "Failed to request handover.");
      }
    } catch (e) {
      console.error('Handover Request Error:', e);
      Alert.alert("Error", "Something went wrong while requesting handover.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReInitializeHandover = async () => {
    try {
      setIsSubmitting(true);
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'Ongoing',
          handoverApprover: null,
          handoverRejectionReason: null,
          auditAction: 'StatusChange',
          auditDetails: `Handover validation re-initialized by ${user.name}. Status reverted to Ongoing.`
        })
      });

      if (response.ok) {
        setCurrentStatus('Ongoing');
        showToast("Handover re-initialized!", "success");
        if (fetchProjectData) await fetchProjectData();
        await initializeHandover();
      } else {
        const err = await response.json();
        Alert.alert("Error", err.message || "Failed to re-initialize handover.");
      }
    } catch (e) {
      console.error('Re-Initialize Handover Error:', e);
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveHandover = async (isApproved) => {
    if (!isApproved && !isRejectionModalVisible) {
      setIsRejectionModalVisible(true);
      return;
    }
    
    if (!isApproved && !rejectionReason.trim()) {
      showToast("Please provide a rejection reason.", "error");
      return;
    }

    try {
      setIsRejectionModalVisible(false);
      setIsSubmitting(true);
      const newStatus = isApproved ? 'Completed' : 'Handover Rejected';
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus,
          handoverApprover: isApproved ? project.handoverApprover?._id : null,
          handoverRejectionReason: isApproved ? null : rejectionReason,
          auditAction: 'StatusChange',
          auditDetails: isApproved ? `Handover verified and approved by ${user.name}. Project is ready for closure.` : `Handover rejected by ${user.name}. Reason: ${rejectionReason}. Project reverted.`
        })
      });

      if (response.ok) {
        setCurrentStatus(newStatus);
        setRejectionReason("");
        showToast(`Handover ${isApproved ? 'Approved' : 'Rejected'}!`, "success");
        if (fetchProjectData) await fetchProjectData();
      } else {
        const err = await response.json();
        Alert.alert("Error", err.message || `Failed to ${isApproved ? 'approve' : 'reject'} handover.`);
      }
    } catch (e) {
      console.error('Handover Approval Error:', e);
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalProjectCompletion = async () => {
    try {
      setIsSubmitting(true);
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'Completed',
          auditAction: 'StatusChange',
          auditDetails: 'Project formally completed and closed.'
        })
      });

      if (response.ok) {
        showToast("Project Completed Successfully!", "success");
        if (fetchProjectData) await fetchProjectData();
      } else {
        const err = await response.json();
        Alert.alert("Error", err.message || "Failed to complete project.");
      }
    } catch (e) {
      console.error('Project Completion Error:', e);
      Alert.alert("Error", "Something went wrong while completing project.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSelection = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === snags.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(snags.map(s => s._id));
    }
  };

  const handleBulkSendForFixing = async () => {
    if (isSubmitting || selectedIds.length === 0) return;
    try {
      setIsSubmitting(true);

      // 1. Get full data for selected snags and ensure they aren't already In Progress
      const selectedSnags = snags.filter(s => selectedIds.includes(s._id) && s.status !== 'In Progress');
      if (selectedSnags.length === 0 && selectedIds.length > 0) {
        showToast("Selected snags are already In Progress", "info");
        return;
      }

      // 3. Update individual snags to "In Progress"
      const snagPromises = selectedIds.map(id =>
        fetch(`${API_BASE_URL}/snags/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            status: 'In Progress',
            resolutionDetails: 'Sent for rectification.'
          })
        })
      );
      await Promise.all(snagPromises);

      // 4. Update project status to "Ongoing"
      await fetch(`${API_BASE_URL}/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          auditAction: 'SnagUpdated',
          auditDetails: `${selectedIds.length} snags updated to In Progress.`
        })
      });

      showToast(`${selectedIds.length} snags sent for fixing`, "success");
      setSelectedIds([]);
      if (fetchProjectData) await fetchProjectData(); // Refresh global project state
      fetchSnags();
    } catch (e) {
      console.error(e);
      showToast("Failed to process request", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMiniSnag = (snag) => {
    const isSelected = selectedIds.includes(snag._id);
    return (
      <TouchableOpacity
        key={snag._id}
        style={[styles.miniSnagCard, isSelected && styles.miniSnagCardSelected]}
        onLongPress={() => handleToggleSelection(snag._id)}
        onPress={() => selectedIds.length > 0 ? handleToggleSelection(snag._id) : setSelectedSnag(snag)}
      >
        {snag.images && snag.images.length > 0 && (
          <Image source={{ uri: snag.images[0] }} style={styles.miniSnagThumb} />
        )}
        <View style={[styles.priorityDot, { backgroundColor: snag.priority === 'Critical' ? '#EF4444' : '#3B82F6' }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.miniSnagTitle}>{snag.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
            <Feather name="user" size={10} color="#94A3B8" />
            <Text style={styles.miniSnagMeta}>Reported by {snag.createdBy?.name || 'Unknown'}</Text>
          </View>
        </View>
        {isSelected ? (
          <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />
        ) : (
          <View style={styles.openBadge}>
            <Text style={styles.openBadgeText}>{snag.status === 'Open' ? 'OPEN' : snag.status.toUpperCase()}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderChecklistGroup = (title, status, countMessage, pendingItems, iconName, key, detailsRenderer) => {
    const isExpanded = expandedSections[key];
    const isOk = status === 'ok';

    return (
      <View style={styles.checklistGroupCard}>
        <TouchableOpacity
          style={styles.checklistGroupHeader}
          onPress={() => toggleSection(key)}
          activeOpacity={0.7}
        >
          <View style={[styles.checklistIconWrapper, { backgroundColor: isOk ? '#E6F4EA' : '#FEF3C7' }]}>
            <Ionicons
              name={iconName}
              size={20}
              color={isOk ? '#10B981' : '#D97706'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checklistGroupTitle}>{title}</Text>
            <Text style={[styles.checklistGroupSub, { color: isOk ? '#10B981' : '#D97706' }]}>
              {countMessage}
            </Text>
          </View>
          <View style={[styles.checklistStatusBadge, { backgroundColor: isOk ? '#E6F4EA' : '#FEF3C7' }]}>
            <Text style={[styles.checklistStatusText, { color: isOk ? '#137333' : '#B06000' }]}>
              {isOk ? 'PASSED' : 'PENDING'}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="#64748B"
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.checklistDetailsArea}>
            {pendingItems && pendingItems.length > 0 ? (
              detailsRenderer(pendingItems)
            ) : (
              <View style={styles.emptyDetailRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
                <Text style={styles.emptyDetailText}>All checks passed successfully.</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderMilestonesDetails = (milestones) => {
    return (
      <View style={{ gap: 12 }}>
        {milestones.map((m) => {
          const completedTasksCount = (m.tasks || []).filter(t => t.isCompleted).length;
          const totalTasksCount = (m.tasks || []).length;
          const isMilestoneDone = m.status === 'Completed';

          return (
            <TouchableOpacity 
              key={m._id} 
              style={styles.milestoneDetailCard} 
              activeOpacity={0.7}
              onPress={() => router.push(`/project/${projectId}/milestones`)}
            >
              <View style={styles.milestoneDetailHeader}>
                <Ionicons
                  name={isMilestoneDone ? "checkmark-circle" : "ellipse-outline"}
                  size={16}
                  color={isMilestoneDone ? "#10B981" : "#64748B"}
                />
                <Text style={styles.milestoneDetailName}>{m.name}</Text>
                <View style={[styles.milestoneStatusBadge, { backgroundColor: isMilestoneDone ? '#E6F4EA' : '#F1F5F9' }]}>
                  <Text style={{ fontSize: 9, fontFamily: 'Inter-Bold', color: isMilestoneDone ? '#137333' : '#475569' }}>
                    {m.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: 6, paddingLeft: 22 }}>
                <Text style={styles.milestoneProgressText}>
                  Tasks: {completedTasksCount}/{totalTasksCount} completed
                </Text>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: totalTasksCount > 0 ? `${(completedTasksCount / totalTasksCount) * 100}%` : '0%',
                        backgroundColor: isMilestoneDone ? '#10B981' : '#3B82F6'
                      }
                    ]}
                  />
                </View>

                {m.tasks && m.tasks.length > 0 && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {m.tasks.map((task, idx) => (
                      <View key={idx} style={styles.taskChecklistItem}>
                        <Ionicons
                          name={task.isCompleted ? "checkmark-circle" : "ellipse-outline"}
                          size={14}
                          color={task.isCompleted ? "#3B82F6" : "#94A3B8"}
                        />
                        <Text style={[styles.taskChecklistText, task.isCompleted && styles.taskCompletedText]}>
                          {task.title}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderIssuesDetails = (issues) => {
    return (
      <View style={{ gap: 8 }}>
        {issues.map((i) => {
          const priorityColor = i.priority === 'High' ? '#EF4444' : i.priority === 'Medium' ? '#F59E0B' : '#10B981';
          return (
            <TouchableOpacity 
              key={i._id} 
              style={styles.itemDetailRow}
              activeOpacity={0.7}
              onPress={() => router.push(`/project/${projectId}/issues`)}
            >
              <View style={[styles.priorityBadgeDot, { backgroundColor: priorityColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemDetailTitle}>{i.title}</Text>
                <Text style={styles.itemDetailMeta}>Priority: {i.priority} | Status: {i.status}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderBoqsDetails = (boqs) => {
    return (
      <View style={{ gap: 8 }}>
        {boqs.map((b) => {
          return (
            <TouchableOpacity 
              key={b._id} 
              style={styles.itemDetailRow}
              activeOpacity={0.7}
              onPress={() => router.push(`/project/${projectId}/boq`)}
            >
              <MaterialCommunityIcons name="calculator-variant" size={16} color="#D97706" style={{ marginRight: 6 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemDetailTitle}>{b.itemDescription}</Text>
                <Text style={styles.itemDetailMeta}>Group: {b.groupName} | Status: {b.status}</Text>
              </View>
              <Text style={styles.itemDetailValue}>{project?.currency || '$'} {formatCompact(b.totalCost || 0)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderPlansDetails = (plans) => {
    return (
      <View style={{ gap: 8 }}>
        {plans.map((p) => {
          const latestVer = p.versions?.[p.versions.length - 1];
          return (
            <TouchableOpacity 
              key={p._id} 
              style={styles.itemDetailRow}
              activeOpacity={0.7}
              onPress={() => router.push(`/project/${projectId}/plans`)}
            >
              <Ionicons name="document-text-outline" size={16} color="#D97706" style={{ marginRight: 6 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemDetailTitle}>{p.name}</Text>
                <Text style={styles.itemDetailMeta}>
                  Version: v{latestVer?.versionNumber} | Status: {latestVer?.approvalStatus || 'Draft'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderRisksDetails = (risks) => {
    return (
      <View style={{ gap: 8 }}>
        {risks.map((r) => {
          const severityColor = r.impact === 'High' || r.impact === 'Very High' ? '#EF4444' : '#F59E0B';
          return (
            <TouchableOpacity 
              key={r._id} 
              style={styles.itemDetailRow}
              activeOpacity={0.7}
              onPress={() => router.push(`/project/${projectId}/risk`)}
            >
              <Ionicons name="alert-triangle-outline" size={16} color={severityColor} style={{ marginRight: 6 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemDetailTitle}>{r.title}</Text>
                <Text style={styles.itemDetailMeta}>
                  Impact: {r.impact} | Mitigation: {r.mitigationProgress || 0}% | Status: {r.status}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const canView = user?.role?.name === 'Admin' || hasProjectPermission(user, project, 'handover:view');
  if (!canView) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 40 }}>
        <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
        <Text style={{ fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A', marginTop: 16 }}>Access Restricted</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', marginTop: 8 }}>
          You don't have permission to view Handover.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <View style={[styles.headerIconBox, 
          ['Completed', 'Handover Completed'].includes(currentStatus) ? { backgroundColor: '#ECFDF5' } :
          currentStatus === 'Pending Handover' ? { backgroundColor: '#FEF3C7' } :
          currentStatus === 'Handover Rejected' ? { backgroundColor: '#FEF2F2' } : {}
        ]}>
          <MaterialCommunityIcons 
            name={
              ['Completed', 'Handover Completed'].includes(currentStatus) ? "check-decagram" :
              currentStatus === 'Pending Handover' ? "clipboard-clock-outline" :
              currentStatus === 'Handover Rejected' ? "close-octagon-outline" : "briefcase-check"
            } 
            size={28} 
            color={
              ['Completed', 'Handover Completed'].includes(currentStatus) ? "#10B981" :
              currentStatus === 'Pending Handover' ? "#D97706" :
              currentStatus === 'Handover Rejected' ? "#EF4444" : "#3B82F6"
            } 
          />
        </View>
        <Text style={styles.headerTitle}>Project Handover</Text>
      </View>

      {/* Handover Initialization & Validation */}
      <View style={styles.initSection}>
        {(currentStatus === 'Under Snagging' || currentStatus === 'Snagging Completed') && snags.length > 0 ? (
          <View style={styles.snaggingSummaryCard}>

            <AdaptiveGlass intensity={10} tint="light" style={styles.validatingCard}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <MaterialCommunityIcons
                  name={currentStatus === 'Snagging Completed' ? 'check-decagram' : 'clock-fast'}
                  size={20}
                  color={currentStatus === 'Snagging Completed' ? '#10B981' : '#64748B'}
                />
                <Text style={[styles.validatingText, currentStatus === 'Snagging Completed' && { color: '#10B981' }]}>
                  {currentStatus === 'Snagging Completed' ? 'Snagging Completed' : 'Project Under Snagging'}
                </Text>
              </View>
            </AdaptiveGlass>

            {!isAssignedToMe && (
              <View style={styles.snagListSection}>
                <View style={styles.snagListHeader}>
                  {selectedIds.length > 0 ? (
                    <View style={styles.selectionToolbar}>
                      <TouchableOpacity onPress={() => setSelectedIds([])}>
                        <Ionicons name="close" size={20} color="#64748B" />
                      </TouchableOpacity>
                      <Text style={styles.selectionTitle}>{selectedIds.length} selected</Text>
                      <View style={styles.selectionActionGroup}>
                        <TouchableOpacity onPress={handleSelectAll} style={styles.selectionActionBtn}>
                          <MaterialCommunityIcons
                            name={selectedIds.length === snags.length ? "checkbox-multiple-marked" : "checkbox-multiple-blank-outline"}
                            size={20}
                            color="#3B82F6"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleBulkSendForFixing} style={[styles.selectionActionBtn, styles.sendBulkBtn]}>
                          <Feather name="send" size={16} color="#FFF" />
                          <Text style={styles.sendBulkText}>Send for Fixing</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.snagListTitle}>Pending Snags ({snags.length})</Text>
                      <TouchableOpacity onPress={fetchSnags} disabled={isLoadingSnags}>
                        {isLoadingSnags ? <ActivityIndicator size="small" color="#3B82F6" /> : <Ionicons name="refresh" size={18} color="#3B82F6" />}
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {snags.length > 0 && (
                  snags.map(snag => renderMiniSnag(snag))
                )}
              </View>
            )}
          </View>
        ) : !validationData && !isValidating ? (
          <TouchableOpacity style={styles.initBtn} onPress={initializeHandover}>
            <LinearGradient colors={['#3B82F6', '#3B82F6']} style={styles.initGradient}>
              <MaterialCommunityIcons name="rocket-launch-outline" size={20} color="#FFF" />
              <Text style={styles.initBtnText}>Initialize Handover Validation</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : isValidating ? (
          <AdaptiveGlass intensity={10} tint="light" style={styles.validatingCard}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={styles.validatingText}>Checking Project Readiness...</Text>
          </AdaptiveGlass>
        ) : (
          <View style={{ gap: 16 }}>
            {['Completed', 'Handover Completed'].includes(currentStatus) ? (
              <View style={[styles.errorBanner, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <MaterialCommunityIcons name="check-decagram" size={14} color="#10B981" />
                <Text style={[styles.errorText, { color: '#065F46' }]}>Project handover process is fully completed.</Text>
              </View>
            ) : currentStatus === 'Pending Handover' ? (
              (project?.handoverApprover?._id || project?.handoverApprover) === user?.id ? (
                <View style={{ gap: 12 }}>
                  <Text style={[styles.errorText, { color: '#0F172A', textAlign: 'center', marginBottom: 4 }]}>You have been requested to verify and approve this handover.</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity style={[styles.snagBtn, { flex: 1, backgroundColor: '#EF4444' }]} onPress={() => handleApproveHandover(false)} disabled={isSubmitting}>
                      <Text style={[styles.snagBtnText, { color: '#FFF' }]}>Reject</Text>
                      <Ionicons name="close" size={16} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.snagBtn, { flex: 1, backgroundColor: '#3B82F6' }]} onPress={() => handleApproveHandover(true)} disabled={isSubmitting}>
                      <Text style={[styles.snagBtnText, { color: '#FFF' }]}>Approve</Text>
                      <MaterialCommunityIcons name="check-decagram" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                  borderWidth: 1,
                  borderColor: '#FDE68A',
                }}>
                  <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="clock-fast" size={24} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: 'Inter-Black', color: '#B45309', marginBottom: 4 }}>Pending Approval</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter-Medium', color: '#92400E', lineHeight: 18 }}>
                      Handover completion requested. Waiting for <Text style={{ fontFamily: 'Inter-Bold' }}>{project?.handoverApprover?.name || 'Manager'}</Text> to verify.
                    </Text>
                  </View>
                </View>
              )
            ) : currentStatus === 'Handover Rejected' ? (
              <View style={{ gap: 16 }}>
                <View style={[styles.errorBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA', flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 14 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Feather name="x-circle" size={14} color="#DC2626" />
                    <Text style={[styles.errorText, { color: '#991B1B', fontSize: 13 }]}>Handover Rejected</Text>
                  </View>
                  <Text style={[styles.errorText, { color: '#7F1D1D', fontSize: 12, paddingLeft: 22, marginTop: 4 }]}>
                    Reason: {project?.handoverRejectionReason || 'No reason provided.'}
                  </Text>
                </View>
                <TouchableOpacity style={[styles.snagBtn, { backgroundColor: '#3B82F6' }]} onPress={handleReInitializeHandover} disabled={isSubmitting}>
                  <Text style={[styles.snagBtnText, { color: '#FFF' }]}>Re-Initialize Handover Validation</Text>
                  <Ionicons name="refresh" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : validationData.isValid ? (
              <TouchableOpacity 
                style={[styles.snagBtn, { backgroundColor: '#3B82F6' }]} 
                onPress={() => {
                  const hasPerm = !isProjectLocked(project) && hasProjectPermission(user, project, 'handover:create');
                  if (!hasPerm) {
                    showToast("You don't have permission to initialize handover completion.", "error");
                    return;
                  }
                  setIsUserModalVisible(true);
                }} 
                disabled={isSubmitting}
              >
                <Text style={[styles.snagBtnText, { color: '#FFF' }]}>Handover Completion</Text>
                <MaterialCommunityIcons name="check-decagram" size={16} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <View style={[styles.errorBanner]}>
                <Feather name="info" size={14} color="#EF4444" />
                <Text style={styles.errorText}>Please resolve all pending checklist items to proceed.</Text>
              </View>
            )}

            <AdaptiveGlass intensity={20} tint="light" style={styles.validationResultCard}>
              <View style={styles.resHeader}>
                <Text style={styles.resTitle}>Handover Readiness Checklist</Text>
                <TouchableOpacity onPress={initializeHandover}>
                  <Ionicons name="refresh-circle" size={24} color="#3B82F6" />
                </TouchableOpacity>
              </View>

              <View style={styles.checklistContainer}>
              {renderChecklistGroup(
                "Milestones & Tasks Completion",
                (validationData.incompleteMilestonesCount === 0 && validationData.incompleteTasksCount === 0) ? 'ok' : 'pending',
                (validationData.incompleteMilestonesCount === 0 && validationData.incompleteTasksCount === 0)
                  ? 'All milestones and tasks completed'
                  : `${validationData.incompleteMilestonesCount} milestone(s) / ${validationData.incompleteTasksCount} task(s) left`,
                validationData.milestonesList,
                "flag-outline",
                "milestones",
                renderMilestonesDetails
              )}

              {renderChecklistGroup(
                "Snags and Issues Resolution",
                validationData.openIssuesList.length === 0 ? 'ok' : 'pending',
                validationData.openIssuesList.length === 0
                  ? 'All site snags and issues resolved'
                  : `${validationData.openIssuesList.length} open snag/issue(s) remaining`,
                validationData.openIssuesList,
                "alert-circle-outline",
                "issues",
                renderIssuesDetails
              )}

              {renderChecklistGroup(
                "BOQ Approvals",
                (validationData.approvedBoqCount > 0 && validationData.pendingBoqsList.length === 0) ? 'ok' : 'pending',
                validationData.approvedBoqCount === 0 
                  ? 'No approved BOQ items found'
                  : validationData.pendingBoqsList.length === 0
                    ? 'All BOQ items approved'
                    : `${validationData.pendingBoqsList.length} unapproved BOQ item(s)`,
                validationData.pendingBoqsList,
                "calculator-outline",
                "boqs",
                renderBoqsDetails
              )}

              {renderChecklistGroup(
                "Technical Plans & Drawings",
                (validationData.approvedPlansCount > 0 && validationData.pendingPlansList.length === 0) ? 'ok' : 'pending',
                validationData.approvedPlansCount === 0
                  ? 'No approved drawings found'
                  : validationData.pendingPlansList.length === 0
                    ? 'All technical drawings approved'
                    : `${validationData.pendingPlansList.length} unapproved drawing(s)`,
                validationData.pendingPlansList,
                "document-text-outline",
                "plans",
                renderPlansDetails
              )}

              {renderChecklistGroup(
                "Risk Register Mitigation",
                validationData.activeRisksList.length === 0 ? 'ok' : 'pending',
                validationData.activeRisksList.length === 0
                  ? 'All active risks mitigated'
                  : `${validationData.activeRisksList.length} active risk(s) require review`,
                validationData.activeRisksList,
                "warning-outline",
                "risks",
                renderRisksDetails
              )}


            </View>
          </AdaptiveGlass>
          </View>
        )}
      </View>


        {/* User Selection Modal for Handover Verification */}
      <Modal visible={isUserModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setIsUserModalVisible(false)} />
          <View style={[styles.userModalCard, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <Text style={styles.modalTitle}>Handover Verification</Text>
                <Text style={styles.modalSub}>Select a Homeowner to verify and complete this handover.</Text>
              </View>
              <TouchableOpacity onPress={() => setIsUserModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {isLoadingMembers ? (
              <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
            ) : (
              <ScrollView style={styles.userList} showsVerticalScrollIndicator={false}>
                {projectMembers.map((user) => (
                  <TouchableOpacity key={user._id} style={styles.userItem} onPress={() => handleRequestHandover(user)}>
                    <View style={styles.avatarBox}>
                      <Text style={styles.avatarText}>{user.name?.[0]}</Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{user.name}</Text>
                      <Text style={styles.userRole}>{user.role?.name || 'Team Member'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>
                ))}
                {projectMembers.length === 0 && (
                  <Text style={styles.emptyText}>No users found assigned to this project.</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Rejection Reason Modal */}
      <Modal visible={isRejectionModalVisible} transparent animationType="fade">
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 24 }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setIsRejectionModalVisible(false)} />
          <View style={{
            backgroundColor: '#FFF',
            borderRadius: 32,
            padding: 24,
            width: '100%',
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
            elevation: 10,
          }}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <Text style={styles.modalTitle}>Reject Handover</Text>
                <Text style={styles.modalSub}>Please provide a reason for rejecting this handover request.</Text>
              </View>
              <TouchableOpacity onPress={() => setIsRejectionModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={{
                backgroundColor: '#F8FAFC',
                borderRadius: 16,
                padding: 16,
                fontSize: 14,
                fontFamily: 'Inter-Medium',
                color: '#0F172A',
                height: 120,
                textAlignVertical: 'top',
                borderWidth: 1,
                borderColor: '#E2E8F0',
                marginBottom: 20
              }}
              placeholder="E.g. Missing technical drawings, open risks..."
              placeholderTextColor="#94A3B8"
              multiline
              value={rejectionReason}
              onChangeText={setRejectionReason}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.snagBtn, { flex: 1, backgroundColor: '#F1F5F9' }]} onPress={() => setIsRejectionModalVisible(false)} disabled={isSubmitting}>
                <Text style={[styles.snagBtnText, { color: '#475569' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.snagBtn, { flex: 1, backgroundColor: '#EF4444' }]} onPress={() => handleApproveHandover(false)} disabled={isSubmitting}>
                <Text style={[styles.snagBtnText, { color: '#FFF' }]}>Reject Handover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showApproverAlert} transparent animationType="fade">
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 24 }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowApproverAlert(false)} />
          <View style={{
            backgroundColor: '#FFF',
            borderRadius: 32,
            padding: 24,
            width: '100%',
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
            elevation: 10,
            alignItems: 'center',
          }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={32} color="#3B82F6" />
            </View>
            <Text style={{ fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', textAlign: 'center', marginBottom: 8 }}>
              Handover Requested
            </Text>
            <Text style={{ fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              You have been requested to verify and approve the final handover for this project. Please review the checklist and pending items before proceeding.
            </Text>

            <TouchableOpacity 
              style={[styles.snagBtn, { backgroundColor: '#3B82F6', width: '100%' }]} 
              onPress={() => setShowApproverAlert(false)}
            >
              <Text style={[styles.snagBtnText, { color: '#FFF' }]}>View Handover</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={isSnaggingInfoVisible}
        title="Snagging Mode"
        message="You are the assigned inspector for this project. You can now conduct the final verification and report any outstanding issues."
        confirmText="Got it"
        onConfirm={() => setIsSnaggingInfoVisible(false)}
        onCancel={() => setIsSnaggingInfoVisible(false)}
        type="success"
      />

      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
        type={confirmModal.type}
      />

      {/* Snag Detail Modal */}
      <Modal visible={!!selectedSnag} transparent animationType="fade">
        <View style={styles.detailModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelectedSnag(null)} />
          <View style={[styles.detailModalCard, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>SNAG DETAILS</Text>
                <Text style={styles.detailTitle}>{selectedSnag?.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSnag(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Description</Text>
                <Text style={styles.sectionValue}>{selectedSnag?.description}</Text>
              </View>

              <View style={styles.detailGrid}>
                <View style={styles.gridItem}>
                  <Text style={styles.sectionLabel}>Priority</Text>
                  <View style={[styles.priorityPill, { backgroundColor: selectedSnag?.priority === 'Critical' ? '#FEF2F2' : '#F1F5F9' }]}>
                    <Text style={[styles.priorityText, { color: selectedSnag?.priority === 'Critical' ? '#EF4444' : '#64748B' }]}>{selectedSnag?.priority}</Text>
                  </View>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.sectionLabel}>Status</Text>
                  <View style={styles.openBadge}>
                    <Text style={styles.openBadgeText}>{selectedSnag?.status}</Text>
                  </View>
                </View>
              </View>



              {selectedSnag?.images && selectedSnag.images.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>Evidence Photo</Text>
                  <Image source={{ uri: selectedSnag.images[0] }} style={styles.evidenceImage} />
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Reported On</Text>
                <Text style={styles.dateValue}>{selectedSnag ? new Date(selectedSnag.createdAt).toLocaleString() : ''}</Text>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.closeActionBtn} onPress={() => setSelectedSnag(null)}>
              <Text style={styles.closeActionText}>Close Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40, paddingHorizontal: 10, paddingTop: 10 },
  header: { marginBottom: 32, alignItems: 'center' },
  headerIconBox: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 24, fontFamily: 'Inter-Black', color: '#0F172A' },
  headerDesc: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 22 },

  initSection: { marginBottom: 24 },
  initBtn: { borderRadius: 16, overflow: 'hidden' },
  initGradient: { height: 56, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  initBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFF' },
  validatingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 20, gap: 12, borderWeight: 1, borderColor: '#E2E8F0' },
  validatingText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B' },
  completeMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6
  },
  completeMiniText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFF' },
  validationResultCard: { padding: 20, borderRadius: 24, borderWeight: 1, borderColor: 'rgba(255,255,255,0.5)' },
  resHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  resTitle: { fontSize: 16, fontFamily: 'Inter-Black', color: '#0F172A' },
  resGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  resItem: { alignItems: 'center', flex: 1 },
  resIcon: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  resLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#64748B', marginBottom: 2 },
  resValue: { fontSize: 12, fontFamily: 'Inter-Black', color: '#1E293B' },
  snagBtn: { flexDirection: 'row', backgroundColor: '#3B82F6', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },
  snagBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFF' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, gap: 8 },
  errorText: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#EF4444' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  userModalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%', overflow: 'hidden' },
  dragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontFamily: 'Inter-Black', color: '#0F172A' },
  modalSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 4 },
  closeBtn: { width: 36, height: 36, backgroundColor: '#F1F5F9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  userList: { marginTop: 8 },
  userItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 8, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#F1F5F9' },
  avatarBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontSize: 18, fontFamily: 'Inter-Black', color: '#FFF' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#1E293B' },
  userRole: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 14, fontFamily: 'Inter-Medium', color: '#94A3B8' },

  detailModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' },

  snaggingSummaryCard: { gap: 16 },
  snagListSection: { marginTop: 8, gap: 12 },
  snagListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  snagListTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#1E293B' },
  miniSnagCard: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  miniSnagCardSelected: { borderColor: '#3B82F6', backgroundColor: '#F0F9FF' },
  selectionToolbar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectionTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1 },
  selectionActionGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectionActionBtn: { height: 38, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 10 },
  sendBulkBtn: { backgroundColor: '#3B82F6', borderColor: '#3B82F6', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  sendBulkText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFF' },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  miniSnagTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A', textTransform: 'capitalize' },
  miniSnagThumb: { width: 40, height: 40, borderRadius: 10, marginRight: 4 },
  miniSnagMeta: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },
  openBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  openBadgeText: { fontSize: 9, fontFamily: 'Inter-Black', color: '#D97706' },

  detailModalCard: { backgroundColor: '#FFF', borderRadius: 32, padding: 24, width: '90%', maxHeight: '85%', alignSelf: 'center' },
  detailLabel: { fontSize: 10, fontFamily: 'Inter-Black', color: '#3B82F6', letterSpacing: 1.5, marginBottom: 4 },
  detailTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', marginBottom: 16 },
  detailSection: { marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase' },
  sectionValue: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#334155', lineHeight: 22 },
  detailGrid: { flexDirection: 'row', gap: 24, marginBottom: 20 },
  gridItem: { flex: 1 },
  priorityPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priorityText: { fontSize: 11, fontFamily: 'Inter-Black' },
  assigneeBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFF', padding: 10, borderRadius: 12 },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 12, fontFamily: 'Inter-Black', color: '#FFF' },
  assigneeName: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1E293B' },
  evidenceImage: { width: '100%', height: 200, borderRadius: 16, marginTop: 8, resizeMode: 'cover' },
  dateValue: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B' },
  closeActionBtn: { marginTop: 24, height: 50, backgroundColor: '#F1F5F9', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  closeActionText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#475569' },

  checklistContainer: { gap: 12, marginTop: 12 },
  checklistGroupCard: { backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', marginBottom: 8 },
  checklistGroupHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  checklistIconWrapper: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  checklistGroupTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1E293B' },
  checklistGroupSub: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },
  checklistStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  checklistStatusText: { fontSize: 9, fontFamily: 'Inter-Black' },
  checklistDetailsArea: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  emptyDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  emptyDetailText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' },
  milestoneDetailCard: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', padding: 12, marginBottom: 8 },
  milestoneDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  milestoneDetailName: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1E293B', flex: 1 },
  milestoneStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  milestoneProgressText: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B', marginBottom: 4 },
  progressBarBg: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', borderRadius: 2 },
  taskChecklistItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  taskChecklistText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#475569' },
  taskCompletedText: { textDecorationLine: 'line-through', color: '#94A3B8' },
  itemDetailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  priorityBadgeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  itemDetailTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1E293B', flex: 1 },
  itemDetailMeta: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },
  itemDetailValue: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' }
});

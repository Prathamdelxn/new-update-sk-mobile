import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StatusBar, Platform, Modal, TextInput, Keyboard, LayoutAnimation, Image } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import ConfirmModal from '../../../components/ConfirmModal';
import cloudinaryService from '../../../services/cloudinaryService';
import { milestoneService } from '../../../services/projectService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { hasProjectPermission, isProjectLocked } from '../../../utils/permissions';
const AdaptiveGlass = ({ style, children }) => <View style={[{ backgroundColor: '#FFFFFF', overflow: 'hidden' }, style]}>{children}</View>;

export default function MilestoneTaskDetail() {
  const { id: projectId, milestoneId } = useLocalSearchParams();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [project, setProject] = useState(null);
  const isAdmin = user?.role?.name === 'Admin';
  const isLocked = isProjectLocked(project);
  const canCreateTask = !isLocked && (isAdmin || hasProjectPermission(user, project, 'tasks:create'));
  const canUpdateTask = !isLocked && (isAdmin || hasProjectPermission(user, project, 'tasks:update'));
  const canDeleteTask = !isLocked && (isAdmin || hasProjectPermission(user, project, 'tasks:delete'));
  const canCompleteTask = !isLocked && (isAdmin || hasProjectPermission(user, project, 'tasks:complete'));
  const insets = useSafeAreaInsets();

  const [milestone, setMilestone] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [activeTaskIndex, setActiveTaskIndex] = useState(null);
  const [isCompletionConfirmVisible, setIsCompletionConfirmVisible] = useState(false);
  const [tempImageUri, setTempImageUri] = useState(null);
  const [completionNote, setCompletionNote] = useState('');
  const [editingTaskIndex, setEditingTaskIndex] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [materialUsage, setMaterialUsage] = useState({}); // { materialId: quantity }
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  const [selectedSnag, setSelectedSnag] = useState(null);
  const [isSnagModalVisible, setIsSnagModalVisible] = useState(false);
  const [isFetchingSnag, setIsFetchingSnag] = useState(false);

  // Modern Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: null,
    type: 'default'
  });

  // Form State
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    startDate: null,
    endDate: null,
    assignedTo: null
  });

  const [projectMembers, setProjectMembers] = useState([]);
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);

  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);

  const fetchInventory = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/materials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setInventory(data);
      }
    } catch (e) {
      console.error('Error fetching inventory:', e);
    }
  }, [projectId, token]);

  const fetchProjectMembers = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const proj = await response.json();
      
      if (response.ok && proj) {
        setProject(proj);
        // Filter users based on project permissions
        const eligibleMembers = (proj.members || []).filter(m => {
          if (!m.user) return false;
          const permissions = m.role?.permissions || [];
          const isAdminUser = m.user.role?.name === 'Admin' || permissions.includes('*');
          const canComplete = permissions.includes('tasks:complete');
          
          return isAdminUser || canComplete;
        }).map(m => m.user); // extract user objects

        setProjectMembers(eligibleMembers);
      }
    } catch (e) {
      console.error('Error fetching project members:', e);
    }
  }, [projectId, token]);

  const fetchMilestone = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await milestoneService.getProjectMilestones(projectId, token);
      
      if (data && Array.isArray(data)) {
        const current = data.find(m => m._id === milestoneId);
        if (current) {
          setMilestone(current);
          fetchProjectMembers();
          fetchInventory();
        } else {
          showToast("Milestone not found", "error");
        }
      } else {
        console.warn('Milestone data is not an array:', data);
        throw new Error(data?.message || 'Failed to fetch milestones');
      }
    } catch (error) {
      console.error('Error fetching milestone:', error);
      setConfirmModal({
        visible: true,
        title: 'Error',
        message: 'Failed to load milestone details',
        confirmText: 'Retry',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
          fetchMilestone();
        }
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, milestoneId, token, fetchProjectMembers]);

  const handleViewSnag = async (snagId) => {
    try {
      setIsFetchingSnag(true);
      setIsSnagModalVisible(true);
      setSelectedSnag(null);
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/snags/${snagId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedSnag(data);
      } else {
        showToast("Failed to load snag details", "error");
        setIsSnagModalVisible(false);
      }
    } catch (e) {
      console.error(e);
      showToast("Error loading snag", "error");
      setIsSnagModalVisible(false);
    } finally {
      setIsFetchingSnag(false);
    }
  };

  useEffect(() => {
    fetchMilestone();
  }, [fetchMilestone]);

  const handleAddTask = async () => {
    if (!canCreateTask) {
      setConfirmModal({
        visible: true,
        title: 'Access Denied',
        message: 'You do not have permission to create tasks.',
        confirmText: 'OK',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
      });
      return;
    }

    if (!newTask.title.trim()) {
      setConfirmModal({
        visible: true,
        title: 'Validation',
        message: 'Task title is required',
        confirmText: 'OK',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
      });
      return;
    }

    if (!newTask.startDate || !newTask.endDate) {
      setConfirmModal({
        visible: true,
        title: 'Validation',
        message: 'Please select both Start and End dates',
        confirmText: 'OK',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
      });
      return;
    }

    if (newTask.endDate < newTask.startDate) {
      setConfirmModal({
        visible: true,
        title: 'Validation',
        message: 'End date cannot be before the Start date',
        confirmText: 'OK',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
      });
      return;
    }

    let updatedTasks = [...(milestone.tasks || [])];
    if (editingTaskIndex !== null) {
      updatedTasks[editingTaskIndex] = {
        ...updatedTasks[editingTaskIndex],
        ...newTask
      };
    } else {
      updatedTasks.push({ ...newTask, isCompleted: false });
    }

    // Optional: Validate against milestone due date if it exists
    if (milestone.dueDate && newTask.endDate > new Date(milestone.dueDate)) {
      setConfirmModal({
        visible: true,
        title: 'Timeline Warning',
        message: `This task ends after the milestone's due date (${new Date(milestone.dueDate).toLocaleDateString()}). Do you want to proceed?`,
        confirmText: 'Yes, Proceed',
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
          await submitTask(updatedTasks);
        }
      });
      return;
    }

    await submitTask(updatedTasks);
  };

  const submitTask = async (updatedTasks) => {
    try {
      setIsSubmitting(true);
      await milestoneService.updateMilestone(projectId, milestoneId, token, {
        tasks: updatedTasks
      });

      setNewTask({
        title: '',
        description: '',
        startDate: null,
        endDate: null,
        assignedTo: null
      });
      setEditingTaskIndex(null);
      setIsModalVisible(false);
      fetchMilestone();
    } catch (error) {
      setConfirmModal({
        visible: true,
        title: 'Error',
        message: 'Failed to save task',
        confirmText: 'OK',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTask = (taskIndex) => {
    const task = milestone.tasks[taskIndex];
    setNewTask({
      title: task.title,
      description: task.description,
      startDate: task.startDate ? new Date(task.startDate) : null,
      endDate: task.endDate ? new Date(task.endDate) : null,
      assignedTo: task.assignedTo?._id || task.assignedTo
    });
    setEditingTaskIndex(taskIndex);
    setIsModalVisible(true);
  };

  const toggleTask = async (taskIndex) => {
    if (!canCompleteTask) {
      setConfirmModal({
        visible: true,
        title: 'Access Denied',
        message: 'You do not have permission to complete tasks.',
        confirmText: 'OK',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
      });
      return;
    }

    const task = milestone.tasks[taskIndex];

    // Assignment Check: Only the assignee or an Admin can complete the task
    const isAssignee = task.assignedTo === (user._id || user.id);
    if (task.assignedTo && !isAssignee && !isAdmin) {
      setConfirmModal({
        visible: true,
        title: 'Not Assigned to You',
        message: 'This task is assigned to another team member. Only the designated assignee or an Admin can complete this work.',
        confirmText: 'OK',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
      });
      return;
    }

    try {
      // If task is already completed, prevent uncompleting
      if (task.isCompleted) {
        setConfirmModal({
          visible: true,
          title: 'Task Locked',
          message: 'Completed tasks cannot be uncompleted to maintain the audit trail of work proof.',
          confirmText: 'OK',
          onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
        });
        return;
      }

      // Show specialized Proof Modal
      setActiveTaskIndex(taskIndex);
      setProofModalVisible(true);
    } catch (error) {
      setConfirmModal({
        visible: true,
        title: 'Error',
        message: 'Failed to update task',
        confirmText: 'OK',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
      });
    }
  };

  const handlePickAndUpload = async (index, useCamera) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return setConfirmModal({
          visible: true,
          title: 'Permission Denied',
          message: 'Camera permission is required to take photos.',
          confirmText: 'OK',
          onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
        });
        result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7
        });
      }

      if (!result.canceled) {
        setProofModalVisible(false);
        setTempImageUri(result.assets[0].uri);
        setCompletionNote('');
        setIsCompletionConfirmVisible(true);
      }
    } catch (e) {
      setConfirmModal({
        visible: true,
        title: 'Error',
        message: 'Image picker failed',
        confirmText: 'OK',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const finalizeToggle = async (taskIndex, localUri, note) => {
    try {
      setIsCompletionConfirmVisible(false);
      
      // 1. INVENTORY VALIDATION FIRST
      const usageItems = Object.entries(materialUsage)
        .filter(([_, qty]) => qty && parseFloat(qty) > 0)
        .map(([id, qty]) => ({ materialId: id, quantity: parseFloat(qty) }));

      if (usageItems.length > 0) {
        // Validate stock levels before proceeding
        for (const item of usageItems) {
          const invItem = inventory.find(i => i._id === item.materialId);
          if (invItem && item.quantity > invItem.balance) {
            setConfirmModal({
              visible: true,
              title: 'Insufficient Inventory',
              message: `The quantity for "${invItem.name}" exceeds available stock (${invItem.balance} ${invItem.unit}). Inventory needs to be replenished before this quantity can be logged.`,
              confirmText: 'OK',
              onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
            });
            return; // Exit early before ANY state changes or uploads
          }
        }
      }

      // 2. OPTIMISTIC UPDATE (Fast UI)
      const originalMilestone = { ...milestone }; // Store in case we need to revert
      const optimisticTasks = [...milestone.tasks];
      optimisticTasks[taskIndex] = {
        ...optimisticTasks[taskIndex],
        isCompleted: true,
        completedAt: new Date(),
        proofImage: localUri ? { url: localUri, uploadedAt: new Date() } : null,
        completionNote: note || ''
      };
      
      let optimisticStatus = milestone.status;
      const allCompletedOpt = optimisticTasks.every(t => t.isCompleted);
      const anyCompletedOpt = optimisticTasks.some(t => t.isCompleted);
      if (allCompletedOpt) optimisticStatus = 'Completed';
      else if (anyCompletedOpt) optimisticStatus = 'In Progress';
      else optimisticStatus = 'Pending';
      
      setMilestone(prev => ({
        ...prev,
        tasks: optimisticTasks,
        status: optimisticStatus
      }));

      // 3. CLOUDINARY UPLOAD
      let imageUrl = null;
      if (localUri) {
        setIsUploadingImage(true);
        try {
          imageUrl = await cloudinaryService.uploadFile(localUri, `task_proof_${Date.now()}.jpg`);
        } catch (uploadError) {
          setIsUploadingImage(false);
          setMilestone(originalMilestone); // Revert UI
          setConfirmModal({
            visible: true,
            title: 'Upload Error',
            message: 'Failed to upload proof image to Cloudinary',
            confirmText: 'OK',
            onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
          });
          return;
        }
        setIsUploadingImage(false);
      }

      // 4. SUBMIT TO BACKEND
      const finalTasks = [...optimisticTasks];
      finalTasks[taskIndex] = {
        ...finalTasks[taskIndex],
        proofImage: imageUrl ? { url: imageUrl, uploadedAt: new Date() } : null,
      };

      if (usageItems.length > 0) {
        try {
          await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-usage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              type: 'Used',
              items: usageItems,
              commonNote: `Used for task: ${optimisticTasks[taskIndex].title}`,
              locationOrTask: optimisticTasks[taskIndex].title
            })
          });
          setMaterialUsage({});
        } catch (e) {
          console.error('Failed to submit material usage:', e);
        }
      }

      try {
        await milestoneService.updateMilestone(projectId, milestoneId, token, {
          tasks: finalTasks,
          status: optimisticStatus
        });
        fetchMilestone(); // Sync with server data
        fetchInventory(); // Refresh stock levels
      } catch (backendError) {
        setMilestone(originalMilestone); // Revert UI
        setConfirmModal({
          visible: true,
          title: 'Error',
          message: 'Failed to save task update',
          confirmText: 'OK',
          onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
        });
      }
    } catch (e) {
      setConfirmModal({
        visible: true,
        title: 'Error',
        message: 'Failed to complete task',
        confirmText: 'OK',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
      });
    }
  };

  const deleteTask = async (taskIndex) => {
    if (!canDeleteTask) {
      setConfirmModal({
        visible: true,
        title: 'Access Denied',
        message: 'You do not have permission to delete tasks.',
        confirmText: 'OK',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
      });
      return;
    }

    setConfirmModal({
      visible: true,
      title: 'Delete Task',
      message: 'Are you sure you want to remove this task from the checklist?',
      confirmText: 'Delete Task',
      type: 'destructive',
      onConfirm: async () => {
        try {
          const updatedTasks = [...milestone.tasks];
          updatedTasks.splice(taskIndex, 1);
          await milestoneService.updateMilestone(projectId, milestoneId, token, { tasks: updatedTasks });
          fetchMilestone();
        } catch (error) {
          setConfirmModal({
            visible: true,
            title: 'Error',
            message: 'Failed to delete task',
            confirmText: 'OK',
            onConfirm: () => setConfirmModal(prev => ({ ...prev, visible: false }))
          });
        } finally {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  if (isLoading && !milestone) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!milestone) return null;

  const completedCount = milestone.tasks?.filter(t => t.isCompleted).length || 0;
  const totalCount = milestone.tasks?.length || 0;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerPre}>MILESTONE TASKS</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{milestone.name}</Text>
        </View>
        {canCreateTask && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsModalVisible(true)}>
            <Feather name="plus" size={20} color="#FFF" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.progressCard}>
          <View style={styles.progressInfoRow}>
            <View style={styles.progressTextCol}>
              <Text style={styles.progressValue}>{Math.round(progress * 100)}%</Text>
              <Text style={styles.progressLabel}>Overall Completion</Text>
            </View>
            <View style={styles.progressBadge}>
               <Feather name="check-circle" size={14} color={milestone.status === 'Completed' ? '#10B981' : '#3B82F6'} />
               <Text style={styles.progressStats}>{completedCount} / {totalCount} Tasks</Text>
            </View>
          </View>
          
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: milestone.status === 'Completed' ? '#10B981' : '#3B82F6' }]} />
          </View>
        </View>

        {milestone.description && (
          <View style={styles.milestoneDescBox}>
            <Text style={styles.milestoneDescLabel}>Milestone Description</Text>
            <Text style={styles.milestoneDescText}>{milestone.description}</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Task Checklist</Text>
          <TouchableOpacity style={styles.textAddBtn} onPress={() => setIsModalVisible(true)}>
            {/* <Feather name="plus-circle" size={16} color="#3B82F6" /> */}
            {/* <Text style={styles.textAddBtnText}>Add Task</Text> */}
          </TouchableOpacity>
        </View>

        {milestone.tasks?.map((task, index) => {
          const assignee = projectMembers.find(m => (m._id || m) === task.assignedTo);

          return (
            <TouchableOpacity
              key={index}
              style={styles.taskCard}
              activeOpacity={0.7}
              onPress={() => toggleTask(index)}
              onLongPress={() => deleteTask(index)}
            >
              <View style={styles.taskInner}>
                <View style={[styles.checkCircle, task.isCompleted && styles.checkCircleActive]}>
                  {task.isCompleted && <Feather name="check" size={14} color="#FFF" />}
                </View>
                <View style={styles.taskInfo}>
                  <Text style={[styles.taskTitle, task.isCompleted && styles.taskTitleDone]}>
                    {task.title}
                  </Text>
                  {task.description && (
                    <Text style={styles.taskDesc}>{task.description}</Text>
                  )}

                  <View style={styles.taskMeta}>
                    {assignee && (
                      <View style={styles.metaBadge}>
                        <Feather name="user" size={10} color="#64748B" />
                        <Text style={styles.metaText} numberOfLines={1}>{assignee.name || 'User'}</Text>
                      </View>
                    )}
                    {(task.startDate || task.endDate) && (
                      <View style={styles.metaBadge}>
                        <Feather name="calendar" size={10} color="#64748B" />
                        <Text style={styles.metaText}>
                          {task.startDate ? new Date(task.startDate).toLocaleDateString() : '??'} - {task.endDate ? new Date(task.endDate).toLocaleDateString() : '??'}
                        </Text>
                      </View>
                    )}
                    {task.sourceSnag && (
                      <TouchableOpacity 
                        style={[styles.metaBadge, { backgroundColor: '#F0F7FF', borderWidth: 1, borderColor: '#DBEAFE' }]} 
                        onPress={(e) => {
                          e.stopPropagation();
                          const sId = typeof task.sourceSnag === 'object' ? task.sourceSnag._id : task.sourceSnag;
                          handleViewSnag(sId);
                        }}
                      >
                        <Feather name="alert-circle" size={10} color="#3B82F6" />
                        <Text style={[styles.metaText, { color: '#3B82F6' }]}>Snag Task</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {task.isCompleted && task.completedAt && (
                    <View style={styles.completionBlock}>
                      <View style={styles.completionHeader}>
                        <Feather name="check-circle" size={12} color="#059669" />
                        <Text style={styles.completionHeaderText}>
                          Completed on {new Date(task.completedAt).toLocaleDateString()}
                        </Text>
                      </View>
                      
                      {(task.proofImage?.url || task.completionNote) && (
                        <View style={styles.completionContent}>
                          {task.proofImage?.url && (
                            <TouchableOpacity
                              onPress={() => setSelectedImage(task.proofImage.url)}
                              style={styles.proofContainer}
                            >
                              <Image source={{ uri: task.proofImage.url }} style={styles.proofThumb} />
                            </TouchableOpacity>
                          )}
                          {task.completionNote ? (
                            <Text style={styles.completionNoteText}>{task.completionNote}</Text>
                          ) : null}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                 <View style={styles.cardActions}>
                  {canUpdateTask && !task.isCompleted && (
                    <TouchableOpacity onPress={() => handleEditTask(index)} style={styles.actionIconBtn}>
                      <Feather name="edit-3" size={14} color="#3B82F6" />
                    </TouchableOpacity>
                  )}
                  {canDeleteTask && (
                    <TouchableOpacity onPress={() => deleteTask(index)} style={styles.actionIconBtn}>
                      <Feather name="trash-2" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {totalCount === 0 && (
          <View style={styles.emptyState}>
            <Feather name="list" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>No tasks assigned yet.{"\n"}Tap the + button to add one.</Text>
          </View>
        )}
      </ScrollView>

      {/* Original Snag Detail Modal */}
      <Modal 
        visible={isSnagModalVisible} 
        transparent 
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsSnagModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => setIsSnagModalVisible(false)} 
          />
          <View style={[styles.modalContent, { maxHeight: '90%', paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Original Snag Report</Text>
                <Text style={styles.modalSub}>Primary inspection data that triggered this task</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setIsSnagModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {isFetchingSnag ? (
              <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={{ marginTop: 12, color: '#64748B', fontFamily: 'Inter-Medium' }}>Fetching snag details...</Text>
              </View>
            ) : selectedSnag ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {selectedSnag.images && selectedSnag.images.length > 0 && (
                  <View style={styles.snagImageContainer}>
                    <Image source={{ uri: selectedSnag.images[0] }} style={styles.snagFullImage} />
                    <View style={styles.priorityFloatingBadge}>
                      <View style={[styles.priorityDot, { backgroundColor: selectedSnag.priority === 'Critical' ? '#EF4444' : '#F59E0B' }]} />
                      <Text style={styles.priorityText}>{selectedSnag.priority} Priority</Text>
                    </View>
                  </View>
                )}

                <View style={styles.snagDetailSection}>
                  <Text style={styles.snagDetailTitle}>{selectedSnag.title}</Text>
                  <View style={styles.snagMetaRow}>
                    <View style={styles.metaBadge}>
                      <Feather name="user" size={12} color="#64748B" />
                      <Text style={styles.metaText}>By {selectedSnag.createdBy?.name || 'Unknown'}</Text>
                    </View>
                    <View style={styles.metaBadge}>
                      <Feather name="calendar" size={12} color="#64748B" />
                      <Text style={styles.metaText}>{new Date(selectedSnag.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </View>

                  <View style={styles.snagDescBox}>
                    <Text style={styles.snagDescLabel}>DESCRIPTION</Text>
                    <Text style={styles.snagDescText}>{selectedSnag.description}</Text>
                  </View>

                  {selectedSnag.location && (
                    <View style={styles.snagDescBox}>
                      <Text style={styles.snagDescLabel}>LOCATION</Text>
                      <Text style={styles.snagDescText}>{selectedSnag.location}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity 
                  style={styles.snagCloseAction} 
                  onPress={() => setIsSnagModalVisible(false)}
                >
                  <Text style={styles.snagCloseActionText}>Close Details</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                <Text style={{ marginTop: 12, color: '#64748B', fontFamily: 'Inter-Medium' }}>Snag details unavailable</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedImage(null)}
          />
          <View style={styles.previewContent}>
            <Image source={{ uri: selectedImage }} style={styles.fullImage} />
            <TouchableOpacity
              style={styles.closePreviewBtn}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close" size={30} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Uploading Overlay */}
      {isUploadingImage && (
        <View style={styles.uploadOverlay}>
          <AdaptiveGlass intensity={40} tint="dark" style={styles.uploadLoader}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.uploadText}>Uploading Proof...</Text>
          </AdaptiveGlass>
        </View>
      )}

      {/* Add Task Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setIsModalVisible(false);
            }}
          />
          <View style={[
            styles.modalContent,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 10 : Math.max(insets.bottom, 24) }
          ]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingTaskIndex !== null ? 'Edit Task' : 'Add New Task'}</Text>
                {editingTaskIndex !== null && milestone?.tasks?.[editingTaskIndex]?.sourceSnag && (
                  <TouchableOpacity 
                    style={styles.modalSnagLinkHeader}
                    onPress={() => handleViewSnag(milestone.tasks[editingTaskIndex].sourceSnag)}
                  >
                    <Feather name="external-link" size={12} color="#3B82F6" />
                    <Text style={styles.modalSnagLinkText}>View Original Snag Report</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => {
                setIsModalVisible(false);
                setEditingTaskIndex(null);
                setNewTask({ title: '', description: '', startDate: null, endDate: null, assignedTo: null });
              }}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Task Title <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <View style={styles.inputContainer}>
                  <Feather name="edit-2" size={18} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputFlex}
                    placeholder="e.g. Install flooring"
                    value={newTask.title}
                    onChangeText={(v) => setNewTask({ ...newTask, title: v })}
                    placeholderTextColor="#94A3B8"
                    autoFocus
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <View style={[styles.inputContainer, styles.textAreaContainer]}>
                  <Feather name="align-left" size={18} color="#94A3B8" style={styles.inputIconTop} />
                  <TextInput
                    style={[styles.inputFlex, styles.textArea]}
                    placeholder="Describe the task details..."
                    value={newTask.description}
                    onChangeText={(v) => setNewTask({ ...newTask, description: v })}
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.inputLabel}>Start Date <Text style={{ color: '#EF4444' }}>*</Text></Text>
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => setShowStartDate(true)}
                  >
                    <Feather name="calendar" size={16} color="#3B82F6" />
                    <Text style={styles.datePickerText}>
                      {newTask.startDate ? newTask.startDate.toLocaleDateString() : 'Select'}
                    </Text>
                  </TouchableOpacity>
                  {showStartDate && (
                    <DateTimePicker
                      value={newTask.startDate || new Date()}
                      mode="date"
                      maximumDate={newTask.endDate ? new Date(newTask.endDate) : undefined}
                      onChange={(event, date) => {
                        setShowStartDate(false);
                        if (date) setNewTask({ ...newTask, startDate: date });
                      }}
                    />
                  )}
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>End Date <Text style={{ color: '#EF4444' }}>*</Text></Text>
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => setShowEndDate(true)}
                  >
                    <Feather name="calendar" size={16} color="#3B82F6" />
                    <Text style={styles.datePickerText}>
                      {newTask.endDate ? newTask.endDate.toLocaleDateString() : 'Select'}
                    </Text>
                  </TouchableOpacity>
                  {showEndDate && (
                    <DateTimePicker
                      value={newTask.endDate || (newTask.startDate ? new Date(newTask.startDate) : new Date())}
                      mode="date"
                      minimumDate={newTask.startDate ? new Date(newTask.startDate) : undefined}
                      onChange={(event, date) => {
                        setShowEndDate(false);
                        if (date) setNewTask({ ...newTask, endDate: date });
                      }}
                    />
                  )}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Assign To</Text>
                <TouchableOpacity 
                  style={styles.assigneeSelector} 
                  onPress={() => setIsAssignModalVisible(true)}
                >
                  <View style={styles.selectedMemberRow}>
                    <View style={[styles.avatarPlaceholderSmall, !newTask.assignedTo && { backgroundColor: '#F1F5F9' }]}>
                      {newTask.assignedTo ? (
                        <Text style={styles.avatarTextSmall}>
                          {projectMembers.find(m => m._id === newTask.assignedTo)?.name?.charAt(0).toUpperCase()}
                        </Text>
                      ) : (
                        <Feather name="user" size={14} color="#94A3B8" />
                      )}
                    </View>
                    <Text style={[styles.selectedMemberText, !newTask.assignedTo && { color: '#94A3B8' }]}>
                      {newTask.assignedTo 
                        ? projectMembers.find(m => m._id === newTask.assignedTo)?.name 
                        : 'Select a member to assign'}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Assignee Selection Modal */}
              <Modal visible={isAssignModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                  <TouchableOpacity 
                    style={StyleSheet.absoluteFill} 
                    onPress={() => setIsAssignModalVisible(false)} 
                  />
                  <AdaptiveGlass intensity={95} tint="light" style={styles.assignModalCard}>
                    <View style={styles.assignModalHeader}>
                      <Text style={styles.assignModalTitle}>Assign Task</Text>
                      <TouchableOpacity 
                        onPress={() => setIsAssignModalVisible(false)}
                        style={styles.assignCloseBtn}
                      >
                        <Ionicons name="close" size={20} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.assignModalSub}>Only users with task completion permissions are listed.</Text>
                    
                    <ScrollView style={styles.memberList} showsVerticalScrollIndicator={false}>
                      {projectMembers.map((member) => (
                        <TouchableOpacity
                          key={member._id}
                          style={[
                            styles.memberCard,
                            newTask.assignedTo === member._id && styles.memberCardActive
                          ]}
                          onPress={() => {
                            setNewTask({ ...newTask, assignedTo: member._id });
                            setIsAssignModalVisible(false);
                          }}
                        >
                          <View style={[styles.avatarBox, newTask.assignedTo === member._id && { backgroundColor: '#3B82F6' }]}>
                            <Text style={styles.avatarBoxText}>
                              {(member.name || 'U').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.memberInfoCol}>
                            <Text style={styles.memberNameText}>{member.name}</Text>
                            <Text style={styles.memberRoleText}>{member.role?.name || 'Member'}</Text>
                          </View>
                          {newTask.assignedTo === member._id && (
                            <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </AdaptiveGlass>
                </View>
              </Modal>

              <TouchableOpacity
                style={[styles.submitBtn, !newTask.title.trim() && styles.submitBtnDisabled]}
                activeOpacity={0.8}
                onPress={handleAddTask}
                disabled={!newTask.title.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>{editingTaskIndex !== null ? 'Save Changes' : 'Create Task'}</Text>
                    <Feather name="plus" size={18} color="#FFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Task Proof Selection Modal */}
      <Modal visible={proofModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            onPress={() => setProofModalVisible(false)} 
          />
          <AdaptiveGlass intensity={90} tint="light" style={styles.proofModalCard}>
            <View style={styles.proofModalHeader}>
              <View style={styles.proofIconCircle}>
                <Ionicons name="camera" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.proofModalTitle}>Work Proof Required</Text>
              <Text style={styles.proofModalSub}>How would you like to provide proof for this task?</Text>
            </View>

            <View style={styles.proofOptions}>
              <TouchableOpacity 
                style={styles.proofOptionBtn} 
                onPress={() => handlePickAndUpload(activeTaskIndex, true)}
              >
                <View style={[styles.optionIconBox, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="camera" size={20} color="#2563EB" />
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={styles.optionTitle}>Open Camera</Text>
                  <Text style={styles.optionSub}>Take a live photo of the work</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.proofOptionBtn} 
                onPress={() => handlePickAndUpload(activeTaskIndex, false)}
              >
                <View style={[styles.optionIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="image" size={20} color="#16A34A" />
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={styles.optionTitle}>Photo Gallery</Text>
                  <Text style={styles.optionSub}>Choose from your existing photos</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.proofOptionBtn} 
                onPress={() => {
                  setProofModalVisible(false);
                  setTempImageUri(null);
                  setCompletionNote('');
                  setIsCompletionConfirmVisible(true);
                }}
              >
                <View style={[styles.optionIconBox, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="arrow-forward-circle" size={20} color="#64748B" />
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={styles.optionTitle}>Skip Photo</Text>
                  <Text style={styles.optionSub}>Complete task without visual proof</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.proofCancelLink} 
              onPress={() => setProofModalVisible(false)}
            >
              <Text style={styles.proofCancelText}>Cancel</Text>
            </TouchableOpacity>
          </AdaptiveGlass>
        </View>
      </Modal>

      {/* Task Completion Confirmation Modal */}
      <Modal visible={isCompletionConfirmVisible} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setIsCompletionConfirmVisible(false)} />
          <AdaptiveGlass intensity={95} tint="light" style={styles.completionConfirmCard}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Completion</Text>
              <TouchableOpacity onPress={() => setIsCompletionConfirmVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {tempImageUri ? (
                <View style={styles.confirmPreviewContainer}>
                  <Text style={styles.confirmLabel}>WORK PROOF PREVIEW</Text>
                  <Image source={{ uri: tempImageUri }} style={styles.confirmPreviewImage} />
                </View>
              ) : (
                <View style={styles.noProofWarning}>
                  <Feather name="alert-circle" size={20} color="#F59E0B" />
                  <Text style={styles.noProofText}>Completing without visual proof.</Text>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Completion Note (Optional)</Text>
                <View style={[styles.inputContainer, styles.textAreaContainer]}>
                  <Feather name="edit-3" size={18} color="#94A3B8" style={styles.inputIconTop} />
                  <TextInput
                    style={[styles.inputFlex, styles.textArea]}
                    placeholder="Describe any specific details about the work completed..."
                    value={completionNote}
                    onChangeText={setCompletionNote}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={styles.confirmFinalBtnWrapper}>
                <TouchableOpacity 
                  style={styles.confirmFinalBtn} 
                  onPress={() => finalizeToggle(activeTaskIndex, tempImageUri, completionNote)}
                >
                  <Text style={styles.confirmFinalBtnText}>Finalize & Mark Completed</Text>
                  <Feather name="check-circle" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.usageSection}>
                <View style={styles.usageHeader}>
                  <Text style={styles.usageLabel}>MATERIALS USED</Text>
                  <Ionicons name="cube-outline" size={16} color="#64748B" />
                </View>
                {inventory.length > 0 && (
                  <View style={styles.materialSearchBox}>
                    <Feather name="search" size={16} color="#94A3B8" />
                    <TextInput
                      style={styles.materialSearchInput}
                      placeholder="Search material..."
                      value={materialSearchQuery}
                      onChangeText={setMaterialSearchQuery}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                )}
                
                {inventory.length > 0 ? (
                  inventory
                    .filter(item => item.name.toLowerCase().includes(materialSearchQuery.toLowerCase()))
                    .map((item) => (
                    <View key={item._id} style={[
                      styles.usageRow,
                      parseFloat(materialUsage[item._id] || 0) > item.balance && styles.usageRowError
                    ]}>
                      <View style={styles.usageInfo}>
                        <Text style={styles.usageName}>{item.name}</Text>
                        <Text style={[
                          styles.usageStock,
                          parseFloat(materialUsage[item._id] || 0) > item.balance && { color: '#EF4444' }
                        ]}>
                          Avail: {item.balance} {item.unit}
                          {parseFloat(materialUsage[item._id] || 0) > item.balance && " (Insufficent)"}
                        </Text>
                      </View>
                      <View style={[
                        styles.usageInputBox,
                        parseFloat(materialUsage[item._id] || 0) > item.balance && styles.usageInputError
                      ]}>
                        <TextInput
                          style={styles.usageInput}
                          keyboardType="numeric"
                          placeholder="0"
                          value={materialUsage[item._id] || ''}
                          onChangeText={(v) => setMaterialUsage({ ...materialUsage, [item._id]: v })}
                        />
                        <Text style={styles.usageUnit}>{item.unit}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noMaterialsText}>No inventory found for this project.</Text>
                )}
              </View>
            </ScrollView>
          </AdaptiveGlass>
        </View>
      </Modal>

      <ConfirmModal 
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F8FAFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  headerText: { flex: 1 },
  headerPre: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#3B82F6', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle: { fontSize: 22, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  content: { padding: 20 },
  progressCard: { padding: 16, borderRadius: 20, marginBottom: 20, backgroundColor: 'rgba(255, 255, 255, 0.85)', borderWidth: 1, borderColor: '#E2E8F0' },
  progressInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressTextCol: { flex: 1 },
  progressValue: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A', lineHeight: 24 },
  progressLabel: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#64748B', marginTop: 2 },
  progressBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  progressStats: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#334155' },
  progressBg: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  textAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  textAddBtnText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#3B82F6' },
  taskCard: { marginBottom: 12 },
  taskInner: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.85)', borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkCircleActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', lineHeight: 20 },
  taskTitleDone: { color: '#94A3B8' },
  taskDesc: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 4, lineHeight: 18 },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  metaText: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  completedAt: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#10B981', marginTop: 4 },
  completionBlock: { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#D1FAE5' },
  completionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  completionHeaderText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#059669' },
  completionContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  completionNoteText: { flex: 1, fontSize: 12, fontFamily: 'Inter-Medium', color: '#065F46', lineHeight: 18, fontStyle: 'italic' },
  proofContainer: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#FFF' },
  proofThumb: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  cardActions: { flexDirection: 'column', gap: 6, marginLeft: 8 },
  actionIconBtn: { width: 28, height: 28, backgroundColor: '#F8FAFF', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },

  modalSnagLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0F7FF', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#DBEAFE' },
  snagLinkContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  snagLinkLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#3B82F6' },

  modalSnagLinkHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, backgroundColor: '#F0F7FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  modalSnagLinkText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#3B82F6' },

  emptyText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#94A3B8', textAlign: 'center', lineHeight: 20 },

  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  uploadLoader: { padding: 30, borderRadius: 24, alignItems: 'center', gap: 12 },
  uploadText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFF' },

  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewContent: { width: '95%', height: '80%', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '100%', resizeMode: 'contain', borderRadius: 20 },
  closePreviewBtn: { position: 'absolute', top: -50, right: 0, padding: 10 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '85%' },
  dragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontFamily: 'Inter-Bold', color: '#0F172A' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#F1F5F9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  inputGroup: { marginBottom: 24 },
  inputLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#475569', marginBottom: 10 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, paddingHorizontal: 16, height: 56 },
  inputIcon: { marginRight: 12 },
  inputIconTop: { marginRight: 12, marginTop: 2 },
  inputFlex: { flex: 1, fontSize: 15, fontFamily: 'Inter-Medium', color: '#0F172A' },
  textAreaContainer: { height: 100, alignItems: 'flex-start', paddingTop: 16 },
  textArea: { textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center' },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F7FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 14, paddingHorizontal: 12, height: 48, gap: 8 },
  datePickerText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1E40AF' },
  membersScroll: { marginTop: 4 },
  memberItem: { alignItems: 'center', marginRight: 16, width: 64 },
  memberItemActive: { opacity: 1 },
  milestoneDescBox: { paddingHorizontal: 4, marginBottom: 24 },
  milestoneDescLabel: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  milestoneDescText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#475569', lineHeight: 22 },

  taskExtraRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  viewSnagBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F7FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 6, borderWidth: 1, borderColor: '#DBEAFE' },
  viewSnagBtnText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#3B82F6' },

  snagImageContainer: { width: '100%', height: 220, borderRadius: 24, overflow: 'hidden', marginBottom: 20 },
  snagFullImage: { width: '100%', height: '100%' },
  priorityFloatingBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  priorityText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#1E293B' },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  snagDetailSection: { paddingHorizontal: 4 },
  snagDetailTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 12 },
  snagMetaRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  snagDescBox: { backgroundColor: '#F8FAFF', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  snagDescLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#94A3B8', marginBottom: 8 },
  snagDescText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#334155', lineHeight: 22 },
  snagCloseAction: { backgroundColor: '#F1F5F9', height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  snagCloseActionText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#475569' },
  modalSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },

  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 6, borderWidth: 2, borderColor: 'transparent' },
  avatarText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFF' },
  memberName: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center' },
  memberNameActive: { color: '#3B82F6', fontFamily: 'Inter-SemiBold' },
  submitBtn: { flexDirection: 'row', backgroundColor: '#3B82F6', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', marginBottom: 20, },
  submitBtnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  submitBtnText: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#FFF' },

  // Assignee Selector Styles
  assigneeSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, paddingHorizontal: 16, height: 56 },
  selectedMemberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarPlaceholderSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  avatarTextSmall: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFF' },
  selectedMemberText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A' },

  // Assign Modal Styles
  assignModalCard: { width: '100%', height: '70%', backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, marginTop: 'auto' },
  assignModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  assignModalTitle: { fontSize: 22, fontFamily: 'Inter-Bold', color: '#0F172A' },
  assignCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  assignModalSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginBottom: 24 },
  memberList: { flex: 1 },
  memberCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  memberCardActive: { backgroundColor: '#F0F7FF', borderColor: '#BFDBFE' },
  avatarBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#94A3B8', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarBoxText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFF' },
  memberInfoCol: { flex: 1 },
  memberNameText: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#1E293B' },
  memberRoleText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },

  // Task Proof Modal Styles
  proofModalCard: { width: '92%', backgroundColor: '#FFF', borderRadius: 32, padding: 24, alignSelf: 'center', marginBottom: 30, overflow: 'hidden' },
  proofModalHeader: { alignItems: 'center', marginBottom: 24 },
  proofIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  proofModalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 8 },
  proofModalSub: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', lineHeight: 20 },
  proofOptions: { gap: 12, marginBottom: 20 },
  proofOptionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFF', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  optionIconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  optionTextCol: { flex: 1 },
  optionTitle: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#1E293B', marginBottom: 2 },
  optionSub: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#94A3B8' },
  proofCancelLink: { alignItems: 'center', paddingVertical: 8 },
  proofCancelText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#94A3B8' },

  // Completion Confirmation
  completionConfirmCard: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '85%', width: '100%' },
  confirmPreviewContainer: { marginBottom: 20, borderRadius: 20, overflow: 'hidden', backgroundColor: '#F8FAFF', padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  confirmLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#64748B', letterSpacing: 1, marginBottom: 8 },
  confirmPreviewImage: { width: '100%', height: 200, borderRadius: 12 },
  noProofWarning: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FEF3C7' },
  noProofText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#92400E' },
  confirmFinalBtn: { flexDirection: 'row', backgroundColor: '#10B981', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 10, gap: 10 },
  confirmFinalBtnText: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#FFF' },
  confirmFinalBtnWrapper: { marginBottom: 24 },

  usageSection: { backgroundColor: '#F8FAFF', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  usageLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#64748B', letterSpacing: 1 },
  materialSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 16 },
  materialSearchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter-Medium', color: '#0F172A', marginLeft: 8 },
  usageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#FFF', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  usageRowError: { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  usageInfo: { flex: 1 },
  usageName: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1E293B' },
  usageStock: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#94A3B8', marginTop: 2 },
  usageInputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10, width: 100, height: 40 },
  usageInputError: { borderColor: '#EF4444' },
  usageInput: { flex: 1, fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A', textAlign: 'right', paddingRight: 4 },
  usageUnit: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#64748B' },
  noMaterialsText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#94A3B8', textAlign: 'center', fontStyle: 'italic' },

  completionInfo: { marginTop: 6 },
  noteBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 4, gap: 6, alignSelf: 'flex-start' },
  noteText: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#059669', fontStyle: 'italic' },
});

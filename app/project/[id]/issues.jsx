import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Modal, TextInput, Platform, RefreshControl, LayoutAnimation, Image, Alert, Linking, Keyboard } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import ConfirmModal from '../../components/ConfirmModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import cloudinaryService from '../../services/cloudinaryService';
import { useTranslation } from 'react-i18next';
import SignatureScreen from "react-native-signature-canvas";
import ImageViewer from 'react-native-image-zoom-viewer';
import { hasProjectPermission, isProjectLocked } from '../../utils/permissions';
const { width } = Dimensions.get('window');

const CATEGORIES = ["Technical", "Resource", "Financial", "Site", "Client", "Third Party", "Other"];
const PRIORITIES = [
  { label: 'Low', color: '#10B981', bg: '#D1FAE5' },
  { label: 'Medium', color: '#3B82F6', bg: '#DBEAFE' },
  { label: 'High', color: '#F59E0B', bg: '#FEF3C7' },
  { label: 'Critical', color: '#EF4444', bg: '#FEE2E2' }
];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Escalated', 'Closed'];

export default function ProjectIssuesTab({ project }) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();
  const projectId = project?._id;
  
  const hasPermission = useCallback((moduleId, action) => {
    if (isProjectLocked(project) && action !== 'view') return false;
    return hasProjectPermission(user, project, `${moduleId}:${action}`) || hasProjectPermission(user, project, moduleId);
  }, [user, project]);

  const [activeSubTab, setActiveSubTab] = useState('Issues'); // Issues or Matrix
  const [issues, setIssues] = useState([]);
  const [matrix, setMatrix] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMatrixModalVisible, setIsEditMatrixModalVisible] = useState(false);
  const [matrixForm, setMatrixForm] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [allProjectMembers, setAllProjectMembers] = useState(project?.members || []);


  // Modals
  const [isAddIssueModalVisible, setIsAddIssueModalVisible] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [isUpdateModalVisible, setIsUpdateModalVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [category, setCategory] = useState('Other');
  const [updateStatus, setUpdateStatus] = useState('');
  const [updateNote, setUpdateNote] = useState('');
  const [assignedTo, setAssignedTo] = useState(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedImages, setSelectedImages] = useState([]);
  const [resolutionImage, setResolutionImage] = useState(null);

  const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);
  const [issueToDelete, setIssueToDelete] = useState(null);
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);

  const [imageToMark, setImageToMark] = useState(null);
  const [isMarkupVisible, setIsMarkupVisible] = useState(false);
  const signatureRef = useRef(null);

  const [fullScreenViewer, setFullScreenViewer] = useState(null);
  const [previewNewImage, setPreviewNewImage] = useState(null);
  const [markupColor, setMarkupColor] = useState('#EF4444');
  const [isPreparingMarkup, setIsPreparingMarkup] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!projectId) return;
    try {
      if (!isRefresh) setIsLoading(true);
      else setRefreshing(true);

      const [issuesRes, matrixRes] = await Promise.all([
        fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/issues`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/escalation-matrix`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (issuesRes.ok) setIssues(await issuesRes.json());
      if (matrixRes.ok) setMatrix(await matrixRes.json());
   

    } catch (error) {
      console.error("Fetch error:", error);
      showToast("Failed to load data", "error");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [projectId, token]);

  const handleUpdateMatrix = async () => {
    try {
      setIsSubmitting(true);
      const formattedLevels = matrixForm.map(lvl => ({
        level: lvl.level,
        role: lvl.role,
        responseTime: lvl.responseTime,
        user: lvl.user?._id || lvl.user || null
      }));
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/escalation-matrix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ levels: formattedLevels })
      });
      if (res.ok) {
        showToast("Matrix updated", "success");
        setIsEditMatrixModalVisible(false);
        fetchData();
      }
    } catch (error) {
      showToast("Update failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (projectId) {
      fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/users?projectId=${projectId}&permission=snags`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setProjectMembers(data);
      })
      .catch(err => console.error("Error fetching project members:", err));

      fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/users?projectId=${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAllProjectMembers(data);
      })
      .catch(err => console.error("Error fetching all members:", err));
    }
  }, [fetchData, projectId, token]);

  // Real-time: refresh when issues change
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchData(true);
    socket.on('issue:created', refresh);
    socket.on('issue:updated', refresh);
    socket.on('issue:deleted', refresh);
    return () => {
      socket.off('issue:created', refresh);
      socket.off('issue:updated', refresh);
      socket.off('issue:deleted', refresh);
    };
  }, [socket, fetchData]);



  const handlePickImage = async () => {
    Alert.alert(
      "Attach Image",
      "Choose a source",
      [
        {
          text: "Camera",
          onPress: async () => {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (permissionResult.granted === false) return showToast("Camera access required", "error");
            
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: false,
              quality: 0.7,
            });
            if (!result.canceled && result.assets[0].uri) {
              setPreviewNewImage({
                uri: result.assets[0].uri,
                width: result.assets[0].width,
                height: result.assets[0].height
              });
            }
          }
        },
        {
          text: "Gallery",
          onPress: async () => {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permissionResult.granted === false) return showToast("Gallery access required", "error");

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsMultipleSelection: false,
              quality: 0.7,
            });
            if (!result.canceled && result.assets[0].uri) {
              setPreviewNewImage({
                uri: result.assets[0].uri,
                width: result.assets[0].width,
                height: result.assets[0].height
              });
            }
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const handleCreateIssue = async () => {
    if (!title.trim()) return showToast("Title required", "error");
    if (!description.trim()) return showToast("Description required", "error");
    
    try {
      setIsSubmitting(true);
      
      // Upload images to Cloudinary (only new ones if editing, but for simplicity we re-upload or keep existing)
      // If editing, selectedImages might contain URLs already.
      const uploadedUrls = await Promise.all(
        selectedImages.map(uri => {
          if (uri.startsWith('http')) return uri; // Already uploaded
          return cloudinaryService.uploadFile(uri, 'issue_report');
        })
      );

      const url = selectedIssue 
        ? `${process.env.EXPO_PUBLIC_API_BASE_URL}/issues/${selectedIssue._id}`
        : `${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/issues`;
      
      const method = selectedIssue ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title, description, priority, category, assignedTo, images: uploadedUrls })
      });
      if (res.ok) {
        showToast(selectedIssue ? "Issue updated" : "Issue reported successfully", "success");
        setIsAddIssueModalVisible(false);
        setSelectedIssue(null);
        setTitle(''); 
        setDescription('');
        setPriority('Medium');
        setCategory('Other');
        setAssignedTo(null);
        setSelectedImages([]);
        fetchData();
      } else {
        const errorData = await res.json();
        showToast(errorData.message || `Failed to ${selectedIssue ? 'update' : 'create'} issue`, "error");
      }
    } catch (error) {
      showToast(t('networkErrorTryAgain'), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignIssue = async (memberId) => {
    if (!selectedIssue) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/issues/${selectedIssue._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ assignedTo: memberId })
      });
      if (res.ok) {
        showToast("Assigned successfully", "success");
        setIsAssignModalVisible(false);
        setAssignedTo(null);
        setSelectedIssue(null);
        fetchData();
      } else {
        showToast("Failed to assign issue", "error");
      }
    } catch (error) {
      showToast("Network Error", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateIssue = async () => {
    try {
      setIsSubmitting(true);
      
      let finalResolutionImage = resolutionImage;
      if (resolutionImage && !resolutionImage.startsWith('http')) {
        showToast("Uploading proof...", "default");
        finalResolutionImage = await cloudinaryService.uploadFile(resolutionImage, 'issue_resolution');
      }

      const payload = {
        status: updateStatus,
        note: updateNote,
        assignedTo: assignedTo,
      };

      // Ensure resolution data is handled correctly for Resolved/Closed statuses
      if (updateStatus === 'Resolved' || updateStatus === 'Closed') {
        payload.resolutionDate = new Date();
        payload.resolutionDetails = updateNote;
        payload.resolutionImage = finalResolutionImage; // Include even if null to allow clearing
      }

      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/issues/${selectedIssue._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        showToast(`Issue marked as ${updateStatus}`, "success");
        setIsUpdateModalVisible(false);
        setResolutionImage(null);
        setUpdateNote('');
        fetchData();
      } else {
        const errorData = await res.json();
        showToast(errorData.message || "Update failed", "error");
      }
    } catch (error) {
      showToast("Update failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteIssue = async () => {
    if (!issueToDelete) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/issues/${issueToDelete._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast("Issue removed", "delete");
        setIsConfirmDeleteVisible(false);
        setIssueToDelete(null);
        fetchData();
      }
    } catch (error) {
      showToast("Delete failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityColor = (label) => PRIORITIES.find(p => p.label === label)?.color || '#94A3B8';
  const getStatusColor = (status) => {
    switch(status) {
      case 'Open': return '#3B82F6';
      case 'In Progress': return '#F59E0B';
      case 'Resolved': return '#10B981';
      case 'Escalated': return '#EF4444';
      default: return '#64748B';
    }
  };

  if (isLoading && issues.length === 0) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Sub-Tab Selector */}
      <View style={styles.subTabContainer}>
        <TouchableOpacity 
          style={[styles.subTab, activeSubTab === 'Issues' && styles.subTabActive]} 
          onPress={() => { LayoutAnimation.easeInEaseOut(); setActiveSubTab('Issues'); }}
        >
          <Text style={[styles.subTabText, activeSubTab === 'Issues' && styles.subTabTextActive]}>Active Issues</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.subTab, activeSubTab === 'Matrix' && styles.subTabActive]} 
          onPress={() => { LayoutAnimation.easeInEaseOut(); setActiveSubTab('Matrix'); }}
        >
          <Text style={[styles.subTabText, activeSubTab === 'Matrix' && styles.subTabTextActive]}>Escalation Matrix</Text>
        </TouchableOpacity>
      </View>

      {activeSubTab === 'Issues' ? (
        !hasPermission('snags', 'view') ? (
          <View style={[styles.empty, { marginTop: 40 }]}>
            <Feather name="lock" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>Restricted Access</Text>
            <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 8, paddingHorizontal: 20 }}>
              You don't have permission to view Snags & Issues. Contact your administrator.
            </Text>
          </View>
        ) : (
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            style={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor="#3B82F6" />}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            <View style={[styles.headerRow, { width: '100%' }]}>
              <View style={{ flex: 1, flexShrink: 1, paddingRight: 10 }}>
                <Text style={styles.title} numberOfLines={1}>Snags and Issues</Text>
                <Text style={styles.countText}>{issues.length} active items</Text>
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={() => {
                if (!hasPermission('snags', 'create')) {
                  showToast("You don't have permission to report issues.", "error");
                  return;
                }
                setAssignedTo(null);
                setIsAddIssueModalVisible(true);
              }}>
                <Feather name="plus" size={16} color="#FFF" />
                <Text style={styles.addBtnText}>Report Issue</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
              {['All', 'My Tasks', ...STATUSES].map(s => (
                <TouchableOpacity 
                  key={s} 
                  onPress={() => setFilterStatus(s)}
                  style={[styles.filterChip, filterStatus === s && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, filterStatus === s && styles.filterChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {issues.length === 0 ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="check-circle-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>No active issues</Text>
              </View>
            ) : (
              issues
                .filter(i => {
                  if (filterStatus === 'All') return true;
                  if (filterStatus === 'My Tasks') return i.assignedTo?._id === user.id || i.assignedTo === user.id;
                  return i.status === filterStatus;
                })
                .map(issue => (
                <AdaptiveGlass key={issue._id} intensity={10} tint="light" style={styles.card}>
                  
                  {/* Header: Badges */}
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(issue.status) + '15' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(issue.status) }]}>{issue.status}</Text>
                      </View>
                    
                      {issue.priority && (
                        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(issue.priority) + '15' }]}>
                          <View style={[styles.dot, { backgroundColor: getPriorityColor(issue.priority) }]} />
                          <Text style={[styles.priorityText, { color: getPriorityColor(issue.priority) }]}>{issue.priority}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Body: Title, Desc, Assigner */}
                  <Text style={styles.issueTitle}>{issue.title}</Text>
                  {issue.description ? <Text style={styles.issueDesc} numberOfLines={3}>{issue.description}</Text> : null}

                  {issue.assignedTo && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      <Feather name="user" size={12} color="#64748B" />
                      <Text style={{ fontSize: 12, color: '#475569', fontFamily: 'Inter-Medium' }}>
                        Assigned to <Text style={{ fontFamily: 'Inter-Bold' }}>{typeof issue.assignedTo === 'object' ? (issue.assignedTo.name || issue.assignedTo._id) : (allProjectMembers.find(m => m._id === issue.assignedTo)?.name || issue.assignedTo)}</Text>
                      </Text>
                    </View>
                  )}
                  
                  {/* Image Gallery */}
                  {issue.images && issue.images.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageGallery}>
                      {issue.images.map((img, idx) => (
                        <TouchableOpacity key={idx} onPress={() => setFullScreenViewer({ images: issue.images, index: idx })} activeOpacity={0.8}>
                          <Image source={{ uri: img }} style={styles.galleryImage} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}

                  {/* Resolution Proof */}
                  {(issue.status === 'Resolved' || issue.status === 'Closed') && (
                    <View style={styles.resolutionProofBox}>
                      <View style={styles.proofHeader}>
                        <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                        <Text style={styles.proofTitle}>Resolution Proof</Text>
                      </View>
                      {issue.resolutionDetails && (
                        <Text style={styles.proofDesc}>{issue.resolutionDetails}</Text>
                      )}
                      {issue.resolutionImage && (
                        <TouchableOpacity onPress={() => setFullScreenViewer({ images: [issue.resolutionImage], index: 0 })} activeOpacity={0.8}>
                          <Image source={{ uri: issue.resolutionImage }} style={styles.resolutionPreview} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Footer */}
                  <View style={styles.cardFooter}>
                    <View style={styles.ownerInfo}>
                      <View style={[styles.miniAvatar, { backgroundColor: '#3B82F615' }]}>
                        <Text style={[styles.avatarTxt, { color: '#3B82F6' }]}>{issue.createdBy?.name?.charAt(0) || 'U'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ownerName} numberOfLines={1}>
                          {(typeof issue.createdBy === 'object' ? issue.createdBy.name : (allProjectMembers.find(m => m._id === issue.createdBy)?.name || issue.createdBy || 'Unknown'))}
                        </Text>
                        <Text style={styles.issueDate}>{new Date(issue.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                      </View>
                    </View>

                    <View style={styles.footerActions}>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        {hasPermission('snags', 'update') && issue.status !== 'Resolved' && issue.status !== 'Closed' && !issue.assignedTo && (
                          <TouchableOpacity 
                            style={[styles.resolveNowBtn, { backgroundColor: '#3B82F6' }]}
                            onPress={() => {
                              setSelectedIssue(issue);
                              setAssignedTo(issue.assignedTo?._id || null);
                              setIsAssignModalVisible(true);
                            }}
                          >
                            <Feather name="user-plus" size={14} color="#FFF" />
                            {/* <Text style={styles.resolveNowText}>Assign</Text> */}
                          </TouchableOpacity>
                        )}
                        
                        <TouchableOpacity 
                          style={styles.updateLink} 
                          onPress={() => {
                            if (!hasPermission('snags', 'update')) return showToast("You don't have permission.", "error");
                            setSelectedIssue(issue);
                            setUpdateStatus(issue.status);
                            setUpdateNote(issue.status === 'Resolved' || issue.status === 'Closed' ? issue.resolutionDetails : '');
                            setAssignedTo(issue.assignedTo?._id || null);
                            setResolutionImage(issue.resolutionImage || null);
                            setIsUpdateModalVisible(true);
                          }}
                        >
                          <MaterialCommunityIcons name="timeline-text-outline" size={18} color="#64748B" />
                        </TouchableOpacity>
                        
                        {issue.status === 'Open' && (
                          <TouchableOpacity 
                            style={styles.updateLink} 
                            onPress={() => {
                              if (!hasPermission('snags', 'update')) return showToast("You don't have permission.", "error");
                              setSelectedIssue(issue);
                              setTitle(issue.title);
                              setDescription(issue.description);
                              setPriority(issue.priority);
                              setCategory(issue.category);
                              setAssignedTo(issue.assignedTo?._id || issue.assignedTo);
                              setSelectedImages(issue.images || []);
                              setIsAddIssueModalVisible(true);
                            }}
                          >
                            <Feather name="edit-2" size={14} color="#64748B" />
                          </TouchableOpacity>
                        )}
                        
                        <TouchableOpacity 
                          style={styles.deleteBtn}
                          onPress={() => {
                            if (!hasPermission('snags', 'delete')) return showToast("You don't have permission.", "error");
                            setIssueToDelete(issue);
                            setIsConfirmDeleteVisible(true);
                          }}
                        >
                          <Feather name="trash-2" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </AdaptiveGlass>
              ))
            )}
          </ScrollView>
        )
      ) : (
        !hasPermission('risks', 'view') ? (
          <View style={[styles.empty, { marginTop: 40 }]}>
            <Feather name="lock" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>Restricted Access</Text>
            <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 8, paddingHorizontal: 20 }}>
              You don't have permission to view the Escalation Matrix. Contact your administrator.
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            <View style={[styles.headerRow, { width: '100%' }]}>
              <View style={{ flex: 1, flexShrink: 1, paddingRight: 10 }}>
                <Text style={styles.title} numberOfLines={2}>Hierarchy of Responsibility</Text>
                <Text style={styles.subtitle} numberOfLines={1}>Contact paths for issue resolution</Text>
              </View>
              <TouchableOpacity 
                style={[styles.addBtn, { flexShrink: 0 }]} 
                onPress={() => {
                  setMatrixForm(matrix?.levels?.length ? matrix.levels : [
                    { level: 1, role: "Site Supervisor", responseTime: "4 Hours" },
                    { level: 2, role: "Project Manager", responseTime: "24 Hours" },
                    { level: 3, role: "Operations Head", responseTime: "48 Hours" }
                  ]);
                  setIsEditMatrixModalVisible(true);
                }}
              >
                <Feather name="settings" size={16} color="#FFF" />
                <Text style={styles.addBtnText}>Setup</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.matrixContainer}>
              {(!matrix?.levels || matrix.levels.filter(lv => lv.user).length === 0) ? (
                <View style={styles.empty}>
                  <Feather name="git-merge" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No Matrix Configured</Text>
                  <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 8, paddingHorizontal: 20 }}>
                    Set up a chain of command to automatically escalate unresolved snags.
                  </Text>
                  <TouchableOpacity 
                    style={[styles.addBtn, { marginTop: 24, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }]}
                    onPress={() => {
                      setMatrixForm(matrix?.levels?.length ? matrix.levels : [
                        { level: 1, role: "Site Supervisor", responseTime: "4 Hours" },
                        { level: 2, role: "Project Manager", responseTime: "24 Hours" },
                        { level: 3, role: "Operations Head", responseTime: "48 Hours" }
                      ]);
                      setIsEditMatrixModalVisible(true);
                    }}
                  >
                    <Feather name="plus" size={16} color="#FFF" />
                    <Text style={[styles.addBtnText, { fontSize: 14 }]}>Configure Matrix</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                matrix.levels.filter(lv => lv.user).map((lv, idx, filteredArr) => (
                  <View key={idx} style={styles.matrixRow}>
                    <View style={styles.levelIndicator}>
                      <View style={styles.levelCircle}>
                        <Text style={styles.levelNum}>L{lv.level}</Text>
                      </View>
                      {idx !== filteredArr.length - 1 && <View style={styles.line} />}
                    </View>
                    
                    <View style={[styles.matrixCard, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16 }]}>
                      <View style={styles.userAvatar}>
                        <Text style={[styles.avatarInitial, !lv.user && { color: '#94A3B8' }]}>{lv.user?.name?.charAt(0) || '?'}</Text>
                      </View>
                      <View style={{ flex: 1, justifyContent: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                          <Text style={[styles.userNameText, { flexShrink: 1, color: lv.user ? '#0F172A' : '#94A3B8' }]} numberOfLines={1}>{lv.user?.name || "Unassigned"}</Text>
                          {(lv.user?.role?.name || lv.role) && (
                            <View style={styles.miniRoleBadge}>
                              <Text style={styles.miniRoleText}>{lv.user?.role?.name || lv.role}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.userEmailText, { marginTop: 0 }]} numberOfLines={1}>{lv.user?.email || "Click Setup to assign a team member"}</Text>
                      </View>
                      <TouchableOpacity 
                        style={[styles.contactBtn, !lv.user?.phoneNumber && { opacity: 0.5 }]}
                        onPress={() => lv.user?.phoneNumber && Linking.openURL(`tel:${lv.user.phoneNumber}`)}
                        disabled={!lv.user?.phoneNumber}
                      >
                        <Feather name="phone" size={14} color="#3B82F6" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )
      )}

      {/* MODALS */}
      <Modal visible={isAddIssueModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsAddIssueModalVisible(false)} />
          <AdaptiveGlass intensity={40} tint="light" style={[styles.bottomSheet, keyboardHeight > 0 && { paddingBottom: keyboardHeight + 10 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>{selectedIssue ? 'Edit Issue Details' : 'Report New Issue'}</Text>
              <TouchableOpacity onPress={() => {
                setIsAddIssueModalVisible(false);
                setSelectedIssue(null);
                setTitle('');
                setDescription('');
                setSelectedImages([]);
              }}>
                <Ionicons name="close-circle" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Reference Photos ({selectedImages.length})</Text>
                {selectedImages.length === 0 ? (
                  <TouchableOpacity 
                    style={[styles.imageAddBtn, { width: '100%', height: 100, flexDirection: 'column', gap: 8 }]} 
                    onPress={handlePickImage}
                  >
                    <Feather name="camera" size={24} color="#3B82F6" />
                    <Text style={{ color: '#3B82F6', fontFamily: 'Inter-Medium' }}>Add Photos</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {selectedImages.map((img, idx) => (
                      <View key={idx} style={[styles.imageWrapper, { width: 80, height: 80, borderRadius: 12, overflow: 'hidden' }]}>
                        <TouchableOpacity onPress={() => setFullScreenViewer({ images: selectedImages, index: idx })} activeOpacity={0.8}>
                          <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.imageDeleteBtn, { padding: 4, backgroundColor: '#FFF' }]} 
                          onPress={() => setSelectedImages(selectedImages.filter((_, i) => i !== idx))}
                        >
                          <Feather name="trash-2" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity 
                      style={[styles.imageAddBtn, { width: 80, height: 80 }]} 
                      onPress={handlePickImage}
                    >
                      <Feather name="plus" size={24} color="#3B82F6" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Issue Title</Text>
                <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="What is the problem?" placeholderTextColor="#94A3B8" />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Detailed Description</Text>
                <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Provide more context..." placeholderTextColor="#94A3B8" multiline numberOfLines={4} />
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateIssue} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>{selectedIssue ? 'Save Changes' : 'Submit Report'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </AdaptiveGlass>
        </View>
      </Modal>

      <Modal visible={isAssignModalVisible} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalOverlayCenter}>
          <TouchableOpacity style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} onPress={() => setIsAssignModalVisible(false)} />
          <View style={styles.smallModal}>
            <Text style={styles.modalTitleSmall}>Assign Issue</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Select Member</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                <View style={styles.userSelectionContainer}>
                  <TouchableOpacity 
                    onPress={() => handleAssignIssue(null)}
                    style={[styles.userChip, assignedTo === null && styles.userChipActive]}
                  >
                    <Text style={[styles.userChipText, assignedTo === null && styles.userChipTextActive]}>Unassigned</Text>
                  </TouchableOpacity>
                  {projectMembers.map(m => (
                    <TouchableOpacity 
                      key={m._id} 
                      onPress={() => handleAssignIssue(m._id)}
                      style={[styles.userChip, assignedTo === m._id && styles.userChipActive]}
                    >
                      <View style={[styles.miniAvatar, { width: 18, height: 18, backgroundColor: assignedTo === m._id ? '#FFFFFF40' : '#3B82F610' }]}>
                        <Text style={[styles.avatarTxt, { fontSize: 8, color: assignedTo === m._id ? '#FFF' : '#3B82F6' }]}>{m.name?.charAt(0)}</Text>
                      </View>
                      <Text style={[styles.userChipText, assignedTo === m._id && styles.userChipTextActive]}>{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAssignModalVisible(false)}>
              <Text style={{ color: '#64748B', fontFamily: 'Inter-Bold' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isUpdateModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsUpdateModalVisible(false)} />
          <AdaptiveGlass intensity={40} tint="light" style={[styles.bottomSheet, keyboardHeight > 0 && { paddingBottom: keyboardHeight + 10 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>Update Status</Text>
              <TouchableOpacity onPress={() => setIsUpdateModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Select New Status</Text>
                <View style={styles.statusRow}>
                  {STATUSES.map(s => (
                    <TouchableOpacity 
                      key={s} 
                      onPress={() => setUpdateStatus(s)} 
                      style={[styles.statusChip, updateStatus === s && { backgroundColor: getStatusColor(s), borderColor: getStatusColor(s) }]}
                    >
                      <Text style={[styles.statusChipText, updateStatus === s && { color: '#FFF' }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Resolution / Progress Note</Text>
                <TextInput style={[styles.input, styles.textArea]} value={updateNote} onChangeText={setUpdateNote} placeholder={updateStatus === 'Resolved' || updateStatus === 'Closed' ? "Describe the resolution steps..." : "What has been done so far?"} placeholderTextColor="#94A3B8" multiline numberOfLines={3} />
              </View>

              {(updateStatus === 'Resolved' || updateStatus === 'Closed') && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Proof of Resolution (Photo)</Text>
                  <View style={styles.imagePickerRow}>
                    {!resolutionImage ? (
                      <TouchableOpacity 
                        style={[styles.imageAddBtn, { width: '100%', height: 120, flexDirection: 'column', gap: 8 }]} 
                        onPress={async () => {
                          const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
                          if (permissionResult.granted === false) return showToast("Camera access required", "error");

                          const result = await ImagePicker.launchCameraAsync({
                            allowsEditing: true,
                            aspect: [4, 3],
                            quality: 0.7,
                          });
                          if (!result.canceled) {
                            LayoutAnimation.easeInEaseOut();
                            setResolutionImage(result.assets[0].uri);
                          }
                        }}
                      >
                        <Feather name="camera" size={24} color="#3B82F6" />
                        <Text style={{ color: '#3B82F6', fontFamily: 'Inter-Bold' }}>Capture Proof Photo</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.imageWrapper, { width: '100%', height: 200, backgroundColor: '#F1F5F9', borderRadius: 16, overflow: 'hidden' }]}>
                        <Image 
                          key={resolutionImage}
                          source={{ uri: resolutionImage }} 
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                        <TouchableOpacity 
                          style={[styles.imageDeleteBtn, { padding: 8, backgroundColor: '#FFF' }]} 
                          onPress={() => {
                            LayoutAnimation.easeInEaseOut();
                            setResolutionImage(null);
                          }}
                        >
                          <Feather name="trash-2" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {hasPermission('snags', 'assign') && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Re-assign (Optional)</Text>
                  <View style={styles.userSelectionContainer}>
                    <TouchableOpacity 
                      onPress={() => setAssignedTo(null)}
                      style={[styles.userChip, assignedTo === null && styles.userChipActive]}
                    >
                      <Text style={[styles.userChipText, assignedTo === null && styles.userChipTextActive]}>Unassigned</Text>
                    </TouchableOpacity>
                    {projectMembers.map(m => (
                      <TouchableOpacity 
                        key={m._id} 
                        onPress={() => setAssignedTo(m._id)}
                        style={[styles.userChip, assignedTo === m._id && styles.userChipActive]}
                      >
                        <View style={[styles.miniAvatar, { width: 18, height: 18, backgroundColor: assignedTo === m._id ? '#FFFFFF40' : '#3B82F610' }]}>
                          <Text style={[styles.avatarTxt, { fontSize: 8, color: assignedTo === m._id ? '#FFF' : '#3B82F6' }]}>{m.name?.charAt(0)}</Text>
                        </View>
                        <Text style={[styles.userChipText, assignedTo === m._id && styles.userChipTextActive]}>{m.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.submitBtn} onPress={handleUpdateIssue} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Update Issue</Text>}
              </TouchableOpacity>
            </ScrollView>
          </AdaptiveGlass>
        </View>
      </Modal>

      <Modal visible={isEditMatrixModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsEditMatrixModalVisible(false)} />
          <AdaptiveGlass intensity={40} tint="light" style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.modalTitle}>Configure Matrix</Text>
                <Text style={styles.countText}>{matrixForm.length} Escalation Levels</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  onPress={() => setMatrixForm([...matrixForm, { level: matrixForm.length + 1, role: '', responseTime: '', user: null }])} 
                  style={styles.addLevelBtn}
                >
                  <Feather name="plus-circle" size={16} color="#3B82F6" />
                  <Text style={styles.addLevelBtnText}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsEditMatrixModalVisible(false)}>
                  <Ionicons name="close-circle" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              {matrixForm.map((lv, idx) => (
                <View key={idx} style={styles.levelFormCard}>
                  <View style={styles.levelHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[styles.levelCircle, { width: 28, height: 28, borderRadius: 14 }]}>
                        <Text style={[styles.levelNum, { fontSize: 12 }]}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.levelLabel}>Escalation Level {idx + 1}</Text>
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={styles.orderControls}>
                        {idx > 0 && (
                          <TouchableOpacity 
                            onPress={() => {
                              const newForm = [...matrixForm];
                              [newForm[idx], newForm[idx-1]] = [newForm[idx-1], newForm[idx]];
                              newForm.forEach((l, i) => l.level = i + 1);
                              setMatrixForm(newForm);
                            }}
                            style={styles.controlBtn}
                          >
                            <Feather name="chevron-up" size={16} color="#3B82F6" />
                          </TouchableOpacity>
                        )}
                        {idx < matrixForm.length - 1 && (
                          <TouchableOpacity 
                            onPress={() => {
                              const newForm = [...matrixForm];
                              [newForm[idx], newForm[idx+1]] = [newForm[idx+1], newForm[idx]];
                              newForm.forEach((l, i) => l.level = i + 1);
                              setMatrixForm(newForm);
                            }}
                            style={styles.controlBtn}
                          >
                            <Feather name="chevron-down" size={16} color="#3B82F6" />
                          </TouchableOpacity>
                        )}
                      </View>
                      <TouchableOpacity 
                        onPress={() => setMatrixForm(matrixForm.filter((_, i) => i !== idx).map((l, i) => ({ ...l, level: i + 1 })))}
                        style={[styles.controlBtn, { backgroundColor: '#FEE2E2' }]}
                      >
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.userSelectionSection}>
                    <View style={styles.labelRow}>
                      <Text style={styles.labelSmall}>Assigned Person</Text>
                      {lv.user && (
                        <TouchableOpacity onPress={() => {
                          const newForm = [...matrixForm];
                          newForm[idx].user = null;
                          setMatrixForm(newForm);
                        }}>
                          <Text style={styles.clearTxt}>Clear selection</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    
                    <View style={styles.memberSelectionGrid}>
                      {projectMembers.map(m => {
                        const isSelected = (lv.user === m._id || lv.user?._id === m._id);
                        return (
                          <TouchableOpacity 
                            key={m._id} 
                            onPress={() => {
                              const newForm = [...matrixForm];
                              newForm[idx].user = m._id;
                              setMatrixForm(newForm);
                            }}
                            style={[styles.memberCardSmall, isSelected && styles.memberCardActive]}
                          >
                            <View style={[styles.miniAvatar, { width: 24, height: 24, backgroundColor: isSelected ? '#FFFFFF40' : '#3B82F610' }]}>
                              <Text style={[styles.avatarTxt, { fontSize: 9, color: isSelected ? '#FFF' : '#3B82F6' }]}>{m.name?.charAt(0)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.memberNameSmall, isSelected && { color: '#FFF' }]} numberOfLines={1}>{m.name}</Text>
                              {m.role?.name && (
                                <Text style={[styles.miniRoleText, { fontSize: 7, color: isSelected ? '#FFFFFF90' : '#64748B' }]} numberOfLines={1}>{m.role.name}</Text>
                              )}
                            </View>
                            {isSelected && <Feather name="check-circle" size={12} color="#FFF" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {projectMembers.length === 0 && (
                      <View style={styles.emptyMembers}>
                        <Feather name="users" size={20} color="#94A3B8" />
                        <Text style={styles.noMembersTxt}>No authorized members found.</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.submitBtn} onPress={handleUpdateMatrix} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Save Matrix Configuration</Text>}
              </TouchableOpacity>
            </ScrollView>
          </AdaptiveGlass>
        </View>
      </Modal>

      <ConfirmModal 
        visible={isConfirmDeleteVisible}
        title="Delete Issue"
        message="Are you sure you want to remove this report? This action cannot be undone."
        type="destructive"
        confirmText="Delete"
        onConfirm={handleDeleteIssue}
        onCancel={() => setIsConfirmDeleteVisible(false)}
      />

      <Modal visible={isMarkupVisible} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          
          {/* Top Bar */}
          <View style={{ paddingTop: insets.top + 10, backgroundColor: '#000', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 }}>
            <TouchableOpacity onPress={() => { setIsMarkupVisible(false); setImageToMark(null); }}>
              <Text style={{ color: '#FFF', fontSize: 17, fontFamily: 'Inter-Medium' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => signatureRef.current?.readSignature()}>
              <Text style={{ color: '#3B82F6', fontSize: 17, fontFamily: 'Inter-Bold' }}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Canvas Area */}
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            {imageToMark && (
              <SignatureScreen
                ref={signatureRef}
                dataURL={imageToMark.uri}
                penColor="#EF4444"
                onOK={(signature) => {
                  if (imageToMark.editIndex !== undefined) {
                    const newImgs = [...selectedImages];
                    newImgs[imageToMark.editIndex] = signature;
                    setSelectedImages(newImgs);
                  } else {
                    setSelectedImages([...selectedImages, signature]);
                  }
                  setIsMarkupVisible(false);
                  setImageToMark(null);
                }}
                onEmpty={() => {
                  setSelectedImages([...selectedImages, imageToMark.uri]);
                  setIsMarkupVisible(false);
                  setImageToMark(null);
                }}
                webStyle={`
                  .m-signature-pad {box-shadow: none; border: none; background: transparent; margin: 0; height: 100%;}
                  .m-signature-pad--body {border: none; margin: 0; background: transparent; height: 100%;}
                  .m-signature-pad--body canvas {
                    background-size: contain !important;
                    background-position: center !important;
                    background-repeat: no-repeat !important;
                  }
                  .m-signature-pad--footer {display: none; margin: 0px;}
                  body,html {height: 100%; width: 100%; margin: 0; padding: 0; background: #000;}
                `}
                autoClear={true}
              />
            )}
          </View>

          {/* Bottom Bar */}
          <View style={{ backgroundColor: '#000', paddingBottom: Platform.OS === 'ios' ? 40 : 20, paddingTop: 20, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              
              <TouchableOpacity onPress={() => signatureRef.current?.clearSignature()} style={{ padding: 8 }}>
                <MaterialCommunityIcons name="undo-variant" size={28} color="#FFF" />
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                {['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#FFFFFF'].map(color => (
                  <TouchableOpacity 
                    key={color}
                    onPress={() => {
                      setMarkupColor(color);
                      signatureRef.current?.changePenColor(color);
                    }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: color,
                      borderWidth: 2,
                      borderColor: markupColor === color ? '#FFF' : 'transparent',
                    }}
                  />
                ))}
              </View>

              <View style={{ width: 44 }} />

            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!previewNewImage} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          
          {previewNewImage && (
            <ImageViewer 
              imageUrls={[{ url: previewNewImage.uri }]}
              enableSwipeDown={true}
              onCancel={() => setPreviewNewImage(null)}
              renderIndicator={() => null}
              backgroundColor="#000"
              renderHeader={() => null}
            />
          )}

          <View style={{ position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, width: '100%', paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }} pointerEvents="box-none">
            
            <View pointerEvents="none">
              <Text style={{ color: '#FFF', fontSize: 18, fontFamily: 'Inter-Bold', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 4 }}>Preview Photo</Text>
              <Text style={{ color: '#CBD5E1', fontSize: 13, fontFamily: 'Inter-Medium', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 4, marginTop: 2 }}>Pinch to zoom & review</Text>
            </View>

            <TouchableOpacity 
              style={{ padding: 8 }}
              onPress={() => {
                setIsPreparingMarkup(true);
                setTimeout(async () => {
                  try {
                    const base64 = await FileSystem.readAsStringAsync(previewNewImage.uri, { encoding: 'base64' });
                    const cleanBase64 = base64.replace(/\n/g, '').replace(/\r/g, '');
                    setImageToMark({
                      uri: `data:image/jpeg;base64,${cleanBase64}`,
                      width: previewNewImage.width,
                      height: previewNewImage.height
                    });
                    setPreviewNewImage(null);
                    setIsMarkupVisible(true);
                  } catch (error) {
                    console.error('Error reading image base64:', error);
                  } finally {
                    setIsPreparingMarkup(false);
                  }
                }, 50);
              }}
              disabled={isPreparingMarkup}
            >
              {isPreparingMarkup ? <ActivityIndicator color="#FFF" size="small" /> : <MaterialCommunityIcons name="pencil" size={24} color="#FFF" />}
            </TouchableOpacity>

          </View>

          <View style={{ position: 'absolute', bottom: 0, width: '100%', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 50 : 30, paddingTop: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <TouchableOpacity 
              style={{ paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              onPress={() => setPreviewNewImage(null)}
            >
              <Text style={{ color: '#FFF', fontSize: 15, fontFamily: 'Inter-Medium' }}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#3B82F6', borderRadius: 6 }}
              onPress={() => {
                setSelectedImages([...selectedImages, previewNewImage.uri]);
                setPreviewNewImage(null);
              }}
            >
              <Text style={{ color: '#FFF', fontSize: 15, fontFamily: 'Inter-Bold' }}>Next</Text>
            </TouchableOpacity>
          </View>

        </View>
      </Modal>

      <Modal visible={!!fullScreenViewer} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {fullScreenViewer && (
            <ImageViewer
              imageUrls={fullScreenViewer.images.map(img => ({ url: img }))}
              index={fullScreenViewer.index}
              enableSwipeDown={true}
              onCancel={() => setFullScreenViewer(null)}
              onChange={(index) => setFullScreenViewer(prev => ({ ...prev, index }))}
              renderIndicator={() => null}
              backgroundColor="#000"
              renderHeader={() => (
                <View style={{ position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 20, right: 20, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }} 
                    onPress={() => setFullScreenViewer(null)}
                  >
                    <Ionicons name="close" size={24} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#FFF', fontSize: 16, fontFamily: 'Inter-Medium' }}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ width: 44, height: 44, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 22, justifyContent: 'center', alignItems: 'center' }} 
                    onPress={() => {
                      setIsPreparingMarkup(true);
                      setTimeout(() => {
                        const imgUrl = fullScreenViewer.images[fullScreenViewer.index];
                        const idx = fullScreenViewer.index;
                        setFullScreenViewer(null);
                        setTimeout(() => {
                          setImageToMark({ uri: imgUrl, width: 800, height: 800, editIndex: idx });
                          setIsMarkupVisible(true);
                          setIsPreparingMarkup(false);
                        }, 400);
                      }, 50);
                    }}
                    disabled={isPreparingMarkup}
                  >
                    {isPreparingMarkup ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="pencil" size={20} color="#FFF" />}
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  subTabContainer: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 0, paddingBottom: 12, gap: 12 },
  subTab: { flex: 1, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  subTabActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  subTabText: { fontSize: 13, color: '#64748B', fontFamily: 'Inter-SemiBold' },
  subTabTextActive: { color: '#FFF', fontFamily: 'Inter-Bold' },
  list: { flex: 1, paddingHorizontal: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 16, width: '100%' },
  title: { fontSize: 20, color: '#0F172A' , fontFamily: 'Inter-Bold' },
  subtitle: { fontSize: 13, color: '#64748B', marginBottom: 20 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', padding: 8, borderRadius: 10, gap: 6 },
  addBtnText: { color: '#FFF', fontSize: 12, fontFamily: 'Inter-Bold' },
  card: { borderRadius: 24, padding: 18, marginBottom: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#F1F5F9' },
  categoryText: { fontSize: 10, color: '#475569', textTransform: 'uppercase' , fontFamily: 'Inter-Bold' },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 10, textTransform: 'uppercase' , fontFamily: 'Inter-Bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: 'Inter-Bold' },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  issueTitle: { fontSize: 16, color: '#0F172A', lineHeight: 22, marginBottom: 6, fontFamily: 'Inter-SemiBold' },
  issueDesc: { fontSize: 13, color: '#64748B', lineHeight: 20, marginBottom: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)', gap: 12 },
  resolutionProofBox: { backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#DCFCE7' },
  proofHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  proofTitle: { fontSize: 13, color: '#10B981', fontFamily: 'Inter-Bold' },
  proofDesc: { fontSize: 13, color: '#047857', fontFamily: 'Inter-Medium', marginBottom: 8 },
  resolutionPreview: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#FFF' },
  ownerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: '40%' },
  miniAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 12, fontFamily: 'Inter-Bold' },
  ownerName: { fontSize: 13, color: '#1E293B' , fontFamily: 'Inter-SemiBold' },
  issueDate: { fontSize: 11, color: '#94A3B8' },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 1, justifyContent: 'flex-end' },
  updateLink: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 80, alignItems: 'center' },
  emptyText: { marginTop: 16, fontSize: 16, color: '#94A3B8', fontFamily: 'Inter-SemiBold' },
  
  matrixContainer: { marginTop: 10, paddingBottom: 40 },
  matrixRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  levelIndicator: { alignItems: 'center', width: 32 },
  levelCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  levelNum: { fontSize: 12, color: '#FFF' , fontFamily: 'Inter-Bold' },
  line: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginTop: -2 },
  matrixCard: { flex: 1, borderRadius: 24, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFF' },
  matrixHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F1F5F9' },
  roleText: { fontSize: 10, color: '#475569', textTransform: 'uppercase' , fontFamily: 'Inter-Bold' },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#3B82F610' },
  timeText: { fontSize: 11, color: '#3B82F6' , fontFamily: 'Inter-Bold' },
  matrixUserRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  userAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 18, color: '#0F172A' , fontFamily: 'Inter-Bold' },
  userNameText: { fontSize: 16, color: '#0F172A' , fontFamily: 'Inter-SemiBold' },
  userEmailText: { fontSize: 13, color: '#64748B', marginTop: 2, fontFamily: 'Inter-Medium' },
  matrixFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerLabel: { fontSize: 12, color: '#64748B' , fontFamily: 'Inter-Medium' },
  contactBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#F8FAFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '90%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sheetContent: { padding: 24 },
  modalTitle: { fontSize: 20, color: '#0F172A' , fontFamily: 'Inter-Bold' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, color: '#64748B', marginBottom: 8 , fontFamily: 'Inter-Bold' },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, fontSize: 16, color: '#0F172A' },
  textArea: { height: 100, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#3B82F6', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 12, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter-Bold' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  smallModal: { width: '100%', borderRadius: 24, padding: 24, backgroundColor: '#FFF' },
  modalTitleSmall: { fontSize: 18, color: '#0F172A', marginBottom: 16 , fontFamily: 'Inter-Bold' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statusChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFF' },
  statusChipText: { fontSize: 13, color: '#64748B' , fontFamily: 'Inter-Bold' },
  noteInput: { backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  confirmBtn: { flex: 2, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#3B82F6' },
  countText: { fontSize: 12, color: '#64748B', marginTop: 2 },
  filterBar: { marginBottom: 20 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  filterChipText: { fontSize: 13, color: '#64748B' , fontFamily: 'Inter-SemiBold' },
  filterChipTextActive: { color: '#FFF' },
  labelSmall: { fontSize: 12, color: '#64748B', marginBottom: 8 , fontFamily: 'Inter-Bold' },
  assignedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#F1F5F9', maxWidth: 100 },
  assignedText: { fontSize: 10, color: '#64748B' , fontFamily: 'Inter-SemiBold' },
  addLevelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addLevelBtnText: { fontSize: 12, color: '#3B82F6' , fontFamily: 'Inter-Bold' },
  levelFormCard: { backgroundColor: '#F8FAFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  levelLabel: { fontSize: 14, color: '#0F172A' , fontFamily: 'Inter-Bold' },
  smallInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, fontSize: 14, color: '#0F172A' },
  imageGallery: { marginBottom: 16, flexDirection: 'row' },
  galleryImage: { width: 100, height: 100, borderRadius: 12, marginRight: 10, backgroundColor: '#F1F5F9' },
  imagePickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  imageAddBtn: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: 1, borderStyle: 'dashed', borderColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  imageWrapper: { position: 'relative', marginTop: 8, marginRight: 8 },
  previewImage: { width: 60, height: 60, borderRadius: 12 },
  imageDeleteBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#FFF', borderRadius: 10 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clearTxt: { fontSize: 11, color: '#EF4444' , fontFamily: 'Inter-Bold' },
  memberSelectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  memberCardSmall: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, minWidth: '45%' },
  memberCardActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  memberNameSmall: { fontSize: 12, color: '#1E293B', flex: 1 , fontFamily: 'Inter-Bold' },
  noMembersTxt: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', padding: 10 },
  miniRoleBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  miniRoleText: { fontSize: 9, color: '#64748B', textTransform: 'uppercase' , fontFamily: 'Inter-Bold' },
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityPill: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#FFF' },
  priorityPillTxt: { fontSize: 13, color: '#64748B' , fontFamily: 'Inter-Bold' },
  categoryGrid: { gap: 10, paddingVertical: 4 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  categoryPillActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  categoryPillTxt: { fontSize: 13, color: '#64748B' , fontFamily: 'Inter-SemiBold' },
  categoryPillTxtActive: { color: '#FFF' },
  userSelectionContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  userChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  userChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  userChipText: { fontSize: 13, color: '#475569' , fontFamily: 'Inter-SemiBold' },
  userChipTextActive: { color: '#FFF' },
  orderControls: { flexDirection: 'row', gap: 4, backgroundColor: '#F1F5F9', padding: 4, borderRadius: 10 },
  controlBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  userSelectionSection: { marginTop: 12 },
  emptyMembers: { alignItems: 'center', padding: 20, backgroundColor: '#F8FAFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  resolveNowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  resolveNowText: { fontSize: 11, color: '#FFF' , fontFamily: 'Inter-Bold' },
  resolutionProofBox: { marginTop: 12, padding: 12, backgroundColor: '#F0FDF4', borderRadius: 16, borderWidth: 1, borderColor: '#DCFCE7' },
  proofHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  proofTitle: { fontSize: 11, color: '#10B981', textTransform: 'uppercase', letterSpacing: 0.5 , fontFamily: 'Inter-Bold' },
  proofDesc: { fontSize: 13, color: '#166534', lineHeight: 18, marginBottom: 10 },
  resolutionPreview: { width: '100%', height: 120, borderRadius: 12, backgroundColor: '#FFF' },
});
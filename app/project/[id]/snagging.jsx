import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, FlatList, TextInput, Modal, Image, Alert, Platform, Keyboard, LayoutAnimation } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import cloudinaryService from '../../services/cloudinaryService';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/ConfirmModal';
import { useTranslation } from 'react-i18next';
import { hasProjectPermission, isProjectLocked } from '../../utils/permissions';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function ProjectSnaggingTab({ project, fetchProjectData, refreshTrigger }) {
  const projectId = project?._id;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();

  // Modern Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: null,
    type: 'default'
  });

  const [snags, setSnags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
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
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
  const [assigningSnag, setAssigningSnag] = useState(null);
  const [fixingMembers, setFixingMembers] = useState([]);
  const [isLoadingFixingMembers, setIsLoadingFixingMembers] = useState(false);
  const [editingSnagId, setEditingSnagId] = useState(null);

  // New/Edit Snag Form
  const [newSnag, setNewSnag] = useState({ title: '', description: '', priority: 'Medium' });
  const [selectedImage, setSelectedImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Snag Completion Flow
  const [isCompleteModalVisible, setIsCompleteModalVisible] = useState(false);
  const [completingSnag, setCompletingSnag] = useState(null);
  const [completionProof, setCompletionProof] = useState(null);

  const fetchSnags = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/projects/${projectId}/snags`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setSnags(data);
      }
    } catch (e) {
      console.error('Fetch snags error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    fetchSnags();
  }, [fetchSnags, refreshTrigger]);

  const fetchFixingMembers = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsLoadingFixingMembers(true);
      const response = await fetch(`${API_BASE_URL}/users?projectId=${projectId}&permission=snag:complete`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFixingMembers(data);
      } else {
        setFixingMembers([]);
      }
    } catch (e) {
      console.error('Fetch fixing members error:', e);
      setFixingMembers([]);
    } finally {
      setIsLoadingFixingMembers(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    if (isAssignModalVisible) {
      fetchFixingMembers();
    }
  }, [isAssignModalVisible, fetchFixingMembers]);

  const handlePickImage = async () => {
    Alert.alert(
      t('attachEvidence'),
      t('chooseASource'),
      [
        {
          text: t('camera'),
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return Alert.alert(t('permissionRequired'), t('cameraAccessNeeded'));
            const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true });
            if (!result.canceled) setSelectedImage(result.assets[0]);
          }
        },
        {
          text: t('gallery'),
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return Alert.alert(t('permissionRequired'), t('galleryAccessNeeded'));
            const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true });
            if (!result.canceled) setSelectedImage(result.assets[0]);
          }
        },
        { text: t('cancel'), style: "cancel" }
      ]
    );
  };

  const handleAddSnag = async () => {
    if (!newSnag.title || !newSnag.description) {
      Alert.alert(t('missingInformation'), t('pleaseProvideTitleDesc'));
      return;
    }

    try {
      setIsSubmitting(true);
      let imageUrls = [];

      if (selectedImage && selectedImage.uri && !selectedImage.uri.startsWith('http')) {
        const uploadedUrl = await cloudinaryService.uploadFile(selectedImage.uri, 'snag_photo', 'image/jpeg');
        if (uploadedUrl) imageUrls.push(uploadedUrl);
      } else if (selectedImage && selectedImage.uri) {
        imageUrls.push(selectedImage.uri);
      }

      const url = editingSnagId ? `${API_BASE_URL}/snags/${editingSnagId}` : `${API_BASE_URL}/projects/${projectId}/snags`;
      const method = editingSnagId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newSnag,
          status: 'Draft',
          images: imageUrls
        })
      });

      if (response.ok) {
        setIsAddModalVisible(false);
        setEditingSnagId(null);
        setNewSnag({ title: '', description: '', priority: 'Medium' });
        setSelectedImage(null);
        showToast(editingSnagId ? "Snag updated successfully" : "Snag reported successfully", "success");
        fetchSnags();
      } else {
        const err = await response.json();
        showToast(err.message || `Failed to ${editingSnagId ? 'update' : 'create'} snag`, "error");
      }
    } catch (e) {
      console.error(e);
      showToast(t('networkErrorTryAgain'), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickCompletionProof = async () => {
    Alert.alert(
      t('proofOfRectification'),
      t('proofOfRectificationDesc'),
      [
        {
          text: t('camera'),
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return Alert.alert(t('permissionRequired'), t('cameraAccessNeeded'));
            const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true });
            if (!result.canceled) setCompletionProof(result.assets[0]);
          }
        },
        {
          text: t('gallery'),
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return Alert.alert(t('permissionRequired'), t('galleryAccessNeeded'));
            const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true });
            if (!result.canceled) setCompletionProof(result.assets[0]);
          }
        },
        { text: t('cancel'), style: "cancel" }
      ]
    );
  };

  const handleCompleteSnagAction = async () => {
    if (!completionProof) {
      Alert.alert(t('proofRequired'), t('uploadPhotoShowRectified'));
      return;
    }
    try {
      setIsSubmitting(true);
      
      let proofUrl = null;
      if (completionProof && completionProof.uri) {
        proofUrl = await cloudinaryService.uploadFile(completionProof.uri, 'snag_proof', 'image/jpeg');
      }

      if (!proofUrl) {
        throw new Error("Image upload failed");
      }

      const res = await fetch(`${API_BASE_URL}/snags/${completingSnag._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'Resolved',
          resolutionImage: proofUrl,
          resolutionDate: new Date(),
          resolutionDetails: 'Snag rectified by assignee.'
        })
      });

      if (!res.ok) throw new Error("Failed to update snag");

      if (!res.ok) throw new Error("Failed to update snag");

      showToast("Snag completed successfully!", "success");
      setIsCompleteModalVisible(false);
      setCompletingSnag(null);
      setCompletionProof(null);
      fetchSnags();
      if (fetchProjectData) fetchProjectData();

    } catch (e) {
      console.error(e);
      showToast("Error completing snag", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSnag = (snag) => {
    setEditingSnagId(snag._id);
    setNewSnag({
      title: snag.title,
      description: snag.description,
      priority: snag.priority
    });
    if (snag.images && snag.images.length > 0) {
      setSelectedImage({ uri: snag.images[0] });
    } else {
      setSelectedImage(null);
    }
    setIsAddModalVisible(true);
  };




  const handleDeleteSnag = (snagId) => {
    setConfirmModal({
      visible: true,
      title: "Delete Snag",
      message: "Are you sure you want to delete this draft snag? This action cannot be undone.",
      confirmText: "Delete Snag",
      type: "destructive",
      onConfirm: async () => {
        try {
          setIsSubmitting(true);
          const response = await fetch(`${API_BASE_URL}/snags/${snagId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            showToast("Snag deleted successfully", "delete");
            fetchSnags();
          } else {
            const err = await response.json();
            showToast(err.message || "Failed to delete snag", "error");
          }
        } catch (e) {
          console.error('Delete snag error:', e);
          showToast(t('networkError'), "error");
        } finally {
          setIsSubmitting(false);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const handleSendForFixing = async () => {
    if (isSubmitting) return;
    const draftSnags = snags.filter(s => s.status === 'Draft');
    if (draftSnags.length === 0) {
      if (snags.some(s => s.status === 'In Progress')) {
        showToast("These snags are already In Progress", "info");
      }
      return;
    }

    try {
      setIsSubmitting(true);
      
      // 1. Update snags to "In Progress"
      const promises = draftSnags.map(snag =>
        fetch(`${API_BASE_URL}/snags/${snag._id}`, {
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
      await Promise.all(promises);

      // 3. Update Project Status to "Ongoing"
      await fetch(`${API_BASE_URL}/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          auditAction: 'SnagUpdated',
          auditDetails: `${draftSnags.length} snags updated to In Progress.`
        })
      });

      showToast(`${draftSnags.length} snags sent for fixing`, "success");
      fetchSnags();
    } catch (e) {
      console.error('Send for fixing error:', e);
      showToast("Failed to process request", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteSnagging = async () => {
    setConfirmModal({
      visible: true,
      title: "Complete Snagging",
      message: "Are you sure you want to finalize the snagging phase? This will update the project status.",
      confirmText: "Complete Snagging",
      type: "success",
      onConfirm: async () => {
        try {
          setIsSubmitting(true);
          const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              status: 'Snagging Completed',
              auditAction: 'StatusChange',
              auditDetails: 'Snagging phase finalized by inspector.'
            })
          });
          if (response.ok) {
            showToast("Snagging phase completed", "success");
            if (fetchProjectData) fetchProjectData();
          } else {
            showToast("Failed to update status", "error");
          }
        } catch (e) {
          console.error(e);
          showToast(t('networkError'), "error");
        } finally {
          setIsSubmitting(false);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  const handleAssignSnagForFixing = async (snag, assignedUser) => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);

      // 1. Update snag to "In Progress" and set assignedTo
      await fetch(`${API_BASE_URL}/snags/${snag._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'In Progress',
          assignedTo: assignedUser._id,
          resolutionDetails: `Assigned to ${assignedUser.name} for snag rectification.`
        })
      });

      // 3. Update project status to "Ongoing"
      await fetch(`${API_BASE_URL}/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          auditAction: 'StatusChange',
          auditDetails: `Snag "${snag.title}" sent for fixing.`
        })
      });

      showToast("Snag assigned for fixing successfully", "success");
      setIsAssignModalVisible(false);
      setAssigningSnag(null);
      fetchSnags();
      if (fetchProjectData) fetchProjectData();
    } catch (e) {
      console.error(e);
      showToast("Error processing request", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSnagCard = ({ item }) => (
    <AdaptiveGlass intensity={20} tint="light" style={styles.snagCard}>
      <View style={styles.snagHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.snagTitle}>{item.title}</Text>
          <View style={[styles.priorityPill, { backgroundColor: item.priority === 'Critical' ? '#FEF2F2' : '#F1F5F9' }]}>
            <Text style={[styles.priorityText, { color: item.priority === 'Critical' ? '#EF4444' : '#64748B' }]}>{item.priority}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, {
          backgroundColor: item.status === 'Resolved' ? '#DCFCE7' :
            item.status === 'Draft' ? '#F1F5F9' : '#FEF3C7'
        }]}>
          <Text style={[styles.statusText, {
            color: item.status === 'Resolved' ? '#10B981' :
              item.status === 'Draft' ? '#64748B' : '#D97706'
          }]}>{item.status}</Text>
        </View>
      </View>

      <Text style={styles.snagDesc}>{item.description}</Text>

      {item.images && item.images.length > 0 && (
        <Image source={{ uri: item.images[0] }} style={styles.snagImage} />
      )}

      <View style={styles.cardFooter}>
        <View style={styles.metaRow}>
          <Feather name="calendar" size={12} color="#94A3B8" />
          <Text style={styles.metaText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {item.status === 'Draft' && canAssignSnagging && (
            <TouchableOpacity 
              style={styles.assignFixingBtn} 
              onPress={() => {
                setAssigningSnag(item);
                setIsAssignModalVisible(true);
              }}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Text style={styles.assignFixingBtnText}>{t('assignForFixing', 'Assign for Fixing')}</Text>
              <Feather name="tool" size={12} color="#2563EB" />
            </TouchableOpacity>
          )}

          {item.status === 'Draft' && isInspector && (
            <View style={styles.actionMiniGroup}>
              <TouchableOpacity style={styles.editMiniBtn} onPress={() => handleEditSnag(item)}>
                <Ionicons name="create-outline" size={16} color="#3B82F6" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteMiniBtn} onPress={() => handleDeleteSnag(item._id)}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
            
          )}

          {item.status === 'In Progress' && !isProjectLocked(project) && (item.assignedTo?._id === user?._id || item.assignedTo === user?._id || hasProjectPermission(user, project, 'snag:complete')) && (
            <TouchableOpacity
              style={[styles.assignFixingBtn, { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' }]}
              onPress={() => {
                setCompletingSnag(item);
                setCompletionProof(null);
                setIsCompleteModalVisible(true);
              }}
              disabled={isSubmitting}
            >
              <Feather name="check-circle" size={12} color="#059669" />
              <Text style={[styles.assignFixingBtnText, { color: '#059669' }]}>{t('completeSnag', 'Complete Snag')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </AdaptiveGlass>
  );

  const isInspector = !isProjectLocked(project) && (project?.snaggedBy?._id || project?.snaggedBy) === (user?.id || user?._id);
  const canAssignSnagging = !isProjectLocked(project) && hasProjectPermission(user, project, 'snag:assign');
  const isAdmin = !isProjectLocked(project) && user?.role?.name === 'Admin';
  const isSnaggingActive = project?.status === 'Under Snagging' || project?.status === 'Snagging Completed';

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{t('issuesAndSnags', 'Issues & Snags')}</Text>
          <Text style={styles.headerSub}>{t('qualityInspectionTracking', 'Quality Inspection & Issue Tracking')}</Text>
        </View>
        {(isInspector || canAssignSnagging || isAdmin) && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setEditingSnagId(null);
              setNewSnag({ title: '', description: '', priority: 'Medium' });
              setSelectedImage(null);
              setIsAddModalVisible(true);
            }}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {!isSnaggingActive ? (
        <View style={styles.notStartedContainer}>
          <AdaptiveGlass intensity={20} tint="light" style={styles.notStartedCard}>
            <View style={styles.notStartedIconBox}>
              <Ionicons name="clipboard-outline" size={48} color="#D97706" />
            </View>
            <Text style={styles.notStartedTitle}>{t('snaggingNotStarted')}</Text>
            <Text style={styles.notStartedSub}>{t('snaggingNotStartedDesc')}</Text>
          </AdaptiveGlass>
        </View>
      ) : isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>{t('loadingIssues')}</Text>
        </View>
      ) : (
        <>
          <View style={styles.listContent}>
            {snags.map(item => (
              <View key={item._id} style={{ marginBottom: 16 }}>
                {renderSnagCard({ item })}
              </View>
            ))}
            {snags.length === 0 && (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="clipboard-check-outline" size={64} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>{t('noIssuesReportedYet', 'No issues reported yet')}</Text>
                <Text style={styles.emptySub}>{t('startByAddingIssue', 'Start by adding a new issue to begin.')}</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Add Snag Modal */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setIsAddModalVisible(false)} />
          <View style={[styles.modalContent, { maxHeight: '85%', paddingBottom: keyboardHeight > 0 ? keyboardHeight + 10 : 40 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingSnagId ? t('updateSnagDetails', 'Update Snag Details') : t('reportNewSnag', 'Report New Snag')}</Text>
              <TouchableOpacity onPress={() => {
                setIsAddModalVisible(false);
                setEditingSnagId(null);
              }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.form}>
              <Text style={styles.label}>{t('title', 'Title')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('egPaintTouchUp', 'e.g. Paint touch-up in Master Bedroom')}
                placeholderTextColor="#94A3B8"
                value={newSnag.title}
                onChangeText={(text) => setNewSnag(s => ({ ...s, title: text }))}
              />

              <Text style={styles.label}>{t('description', 'Description')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t('detailedDescriptionIssue', 'Detailed description of the issue...')}
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                value={newSnag.description}
                onChangeText={(text) => setNewSnag(s => ({ ...s, description: text }))}
              />

              <Text style={styles.label}>{t('priority', 'Priority')}</Text>
              <View style={styles.priorityRow}>
                {['Low', 'Medium', 'High', 'Critical'].map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityItem, newSnag.priority === p && styles.priorityItemActive]}
                    onPress={() => setNewSnag(s => ({ ...s, priority: p }))}
                  >
                    <Text style={[styles.priorityItemText, newSnag.priority === p && styles.priorityItemTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t('photoEvidence', 'Photo Evidence')}</Text>
              {selectedImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.removeImgBtn} onPress={() => setSelectedImage(null)}>
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage}>
                  <Feather name="camera" size={24} color="#3B82F6" />
                  <Text style={styles.imagePickerText}>{t('captureOrUploadEvidence', 'Capture or Upload Evidence')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.submitBtn} onPress={handleAddSnag} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>{editingSnagId ? t('updateSnagDetails', 'Update Snag Details') : t('reportSnag', 'Report Snag')}</Text>}
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        isSubmitting={isSubmitting}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />

      {/* User Selection Modal for Snag Completion Assignment */}
      <Modal visible={isAssignModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setIsAssignModalVisible(false)} />
          <View style={[styles.userModalCard, { paddingBottom: Math.max(40, insets.bottom + 16) }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.modalTitle}>{t('assignToCompleteSnag', 'Assign to Complete Snag')}</Text>
                <Text style={styles.modalSub}>{t('selectAuthorizedUser', 'Select a user authorized to resolve/complete this snag.')}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAssignModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {isLoadingFixingMembers ? (
              <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
            ) : (
              <ScrollView style={styles.userList} showsVerticalScrollIndicator={false}>
                {fixingMembers.map((member) => (
                  <TouchableOpacity key={member._id} style={styles.userItem} onPress={() => handleAssignSnagForFixing(assigningSnag, member)}>
                    <View style={styles.avatarBox}>
                      <Text style={styles.avatarText}>{member.name?.[0]}</Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{member.name}</Text>
                      <Text style={styles.userRole}>{member.role?.name || 'Team Member'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>
                ))}
                {fixingMembers.length === 0 && (
                  <Text style={styles.emptyText}>{t('noAuthorizedUsers', 'No users with completion permissions found.')}</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Complete Snag Modal */}
      <Modal visible={isCompleteModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setIsCompleteModalVisible(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('completeSnag', 'Complete Snag')}</Text>
              <TouchableOpacity onPress={() => setIsCompleteModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>{t('proofOfRectification', 'Proof of Rectification')}</Text>
              <Text style={styles.emptySub}>{t('uploadClearPhotoRequired', 'Please upload a clear photo showing that the snag has been fixed. This is required to complete the snag.')}</Text>
              
              {completionProof ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: completionProof.uri }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.removeImgBtn} onPress={() => setCompletionProof(null)}>
                    <Ionicons name="close-circle" size={28} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickCompletionProof}>
                  <Ionicons name="camera" size={28} color="#3B82F6" />
                  <Text style={styles.imagePickerText}>{t('addProofPhoto', 'Add Proof Photo')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[styles.submitBtn, { backgroundColor: '#10B981', marginTop: 16 }]} 
                onPress={handleCompleteSnagAction} 
                disabled={isSubmitting || !completionProof}
              >
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>{t('markAsResolved', 'Mark as Resolved')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A' },
  headerSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },
  addBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B' },

  listContent: { gap: 16, paddingBottom: 20, paddingTop: 10 },
  snagCard: { padding: 20, borderRadius: 24, borderWeight: 1, borderColor: 'rgba(255,255,255,0.5)' },
  snagHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  titleContainer: { flex: 1, gap: 6 },
  snagTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#1E293B' },
  priorityPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  priorityText: { fontSize: 10, fontFamily: 'Inter-Black', textTransform: 'uppercase' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontFamily: 'Inter-Black', textTransform: 'uppercase' },
  snagDesc: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', lineHeight: 22, marginBottom: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionMiniGroup: { flexDirection: 'row', gap: 8 },
  editMiniBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  deleteMiniBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  assignFixingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 6
  },
  assignFixingBtnText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#2563EB'
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#94A3B8' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter-Black', color: '#1E293B', marginTop: 24 },
  emptySub: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 22 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A' },
  form: { gap: 16 },
  label: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1E293B' },
  input: { backgroundColor: '#F8FAFF', borderRadius: 14, padding: 16, fontSize: 15, fontFamily: 'Inter-Medium', color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  textArea: { height: 100, textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityItem: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  priorityItemActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  priorityItemText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B' },
  priorityItemTextActive: { color: '#FFF' },
  submitBtn: { height: 56, borderRadius: 16, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  submitText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFF' },

  snagImage: { width: '100%', height: 180, borderRadius: 16, marginBottom: 16, resizeMode: 'cover' },
  imagePickerBtn: { height: 100, borderRadius: 16, backgroundColor: '#F8FAFF', borderStyle: 'dashed', borderWidth: 2, borderColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', gap: 8 },
  imagePickerText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#3B82F6' },
  imagePreviewContainer: { width: '100%', height: 200, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImgBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: '#FFF', borderRadius: 12 },

  footerAction: { marginVertical: 16 },
  sendForFixingBtn: {
    height: 60,
    backgroundColor: '#2563EB',
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,


  },
  sendText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFF' },
  notStartedContainer: { padding: 4, marginTop: 10 },
  notStartedCard: { padding: 24, borderRadius: 24, alignItems: 'center', borderWeight: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.4)' },
  notStartedIconBox: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  notStartedTitle: { fontSize: 18, fontFamily: 'Inter-Black', color: '#3b7cfeff', letterSpacing: 0.5, textAlign: 'center', marginBottom: 12 },
  notStartedSub: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center', lineHeight: 22 },

  userModalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%', overflow: 'hidden' },
  dragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 4 },
  closeBtn: { width: 36, height: 36, backgroundColor: '#F1F5F9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  userList: { marginTop: 8 },
  userItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 8, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#F1F5F9' },
  avatarBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontSize: 18, fontFamily: 'Inter-Black', color: '#FFF' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#1E293B' },
  userRole: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', marginTop: 2 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 14, fontFamily: 'Inter-Medium', color: '#94A3B8' }
});

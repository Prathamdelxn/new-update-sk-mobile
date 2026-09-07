import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getFileIcon(fileName = '') {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext)) return { name: 'document-text-outline', color: '#DC2626' };
  if (['dwg', 'dxf', 'cad'].includes(ext)) return { name: 'layers-outline', color: '#2563EB' };
  if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext)) return { name: 'image-outline', color: '#059669' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { name: 'stats-chart-outline', color: '#16A34A' };
  if (['doc', 'docx'].includes(ext)) return { name: 'document-outline', color: '#2563EB' };
  if (['zip', 'rar', '7z'].includes(ext)) return { name: 'folder-outline', color: '#7C3AED' };
  return { name: 'document-outline', color: '#64748B' };
}

export default function InteriorFilemgtScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [items, setItems] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Create Folder Modal
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Upload File Modal
  const [uploadingFile, setUploadingFile] = useState(false);

  const loadFiles = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const parentQuery = currentFolderId ? `?parentId=${currentFolderId}` : '';
      const res = await interiorApiClient.get(`/projects/${projectId}/filemgt${parentQuery}`);
      if (res?.success && res?.data) {
        setItems(res.data.items || []);
        setBreadcrumbs(res.data.breadcrumbs || []);
      } else if (Array.isArray(res?.data)) {
        setItems(res.data);
        setBreadcrumbs([]);
      }
    } catch (e) {
      console.error('Failed to load project files', e);
      showToast('Failed to load project files', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, currentFolderId, showToast]);

  useFocusEffect(useCallback(() => { loadFiles(); }, [loadFiles]));

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      showToast('Please enter a folder name', 'error');
      return;
    }
    setCreatingFolder(true);
    try {
      await interiorApiClient.post(`/projects/${projectId}/filemgt`, {
        name: folderName.trim(),
        parentId: currentFolderId || null,
      });
      showToast('Folder created successfully', 'success');
      setIsFolderModalOpen(false);
      setFolderName('');
      loadFiles();
    } catch (e) {
      showToast(e.message || 'Failed to create folder', 'error');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handlePickAndUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];

      setUploadingFile(true);
      showToast('Uploading document to project cloud...', 'info');

      const uploadRes = await interiorApiClient.postForm(`/projects/${projectId}/drawings/upload`, {
        file: { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' },
      });

      const fileUrl = uploadRes?.data?.url || uploadRes?.url;
      if (!fileUrl) throw new Error('Cloud storage upload failed');

      await interiorApiClient.post(`/projects/${projectId}/filemgt/upload`, {
        fileUrl,
        name: file.name,
        size: file.size || 0,
        type: file.mimeType || file.name.split('.').pop() || 'document',
        parentId: currentFolderId || null,
      });

      showToast('File uploaded successfully!', 'success');
      loadFiles();
    } catch (e) {
      console.error('Upload failed:', e);
      showToast(e.message || 'Failed to upload file', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteItem = (item) => {
    Alert.alert(
      'Delete ' + (item.isFolder ? 'Folder' : 'File'),
      `Are you sure you want to permanently delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await interiorApiClient.delete(`/projects/${projectId}/filemgt/${item._id}`);
              showToast('Item deleted successfully', 'success');
              loadFiles();
            } catch (e) {
              showToast(e.message || 'Failed to delete item', 'error');
            }
          },
        },
      ]
    );
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter((it) => it.name?.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const folders = filteredItems.filter((i) => i.isFolder || i.type === 'folder');
  const files = filteredItems.filter((i) => !i.isFolder && i.type !== 'folder');

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        {/* --- HEADER --- */}
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>File Management</Text>
            <Text style={s.headerSub}>Project cloud drive, drawings & contract documents</Text>
          </View>
        </View>

        {/* --- BREADCRUMBS ROW --- */}
        <View style={s.breadcrumbBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.breadcrumbScroll}>
            <TouchableOpacity
              style={s.crumbItem}
              onPress={() => setCurrentFolderId(null)}
            >
              <Ionicons name="home-outline" size={13} color={currentFolderId === null ? '#2563EB' : '#64748B'} />
              <Text style={[s.crumbText, currentFolderId === null && s.crumbTextActive]}>Root</Text>
            </TouchableOpacity>

            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb._id || idx}>
                <Ionicons name="chevron-forward" size={12} color="#CBD5E1" />
                <TouchableOpacity
                  style={s.crumbItem}
                  onPress={() => setCurrentFolderId(crumb._id)}
                >
                  <Text style={[s.crumbText, idx === breadcrumbs.length - 1 && s.crumbTextActive]}>
                    {crumb.name}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </ScrollView>
        </View>

        {/* --- SEARCH BAR --- */}
        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={15} color="#94A3B8" />
            <TextInput
              style={s.searchInput}
              placeholder="Search files and folders..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {!!searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading && !refreshing ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadFiles(true);
                }}
                tintColor="#2563EB"
              />
            }
          >
            {filteredItems.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="folder-open-outline" size={44} color="#CBD5E1" />
                <Text style={s.emptyTitle}>This Folder is Empty</Text>
                <Text style={s.emptySub}>Create subfolders or upload project documents using the actions below.</Text>
              </View>
            ) : (
              <>
                {/* Folders Grid */}
                {folders.length > 0 && (
                  <View style={{ gap: 8 }}>
                    <Text style={s.sectionHeader}>Folders ({folders.length})</Text>
                    <View style={s.foldersGrid}>
                      {folders.map((fld) => (
                        <TouchableOpacity
                          key={fld._id}
                          style={s.folderCard}
                          onPress={() => setCurrentFolderId(fld._id)}
                          onLongPress={() => handleDeleteItem(fld)}
                        >
                          <Ionicons name="folder" size={24} color="#F59E0B" />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={s.folderTitle} numberOfLines={1}>{fld.name}</Text>
                            <Text style={s.folderSub}>{fld.itemCount || 0} items</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Files List */}
                {files.length > 0 && (
                  <View style={{ gap: 8, marginTop: folders.length > 0 ? 12 : 0 }}>
                    <Text style={s.sectionHeader}>Files ({files.length})</Text>
                    <View style={{ gap: 8 }}>
                      {files.map((file) => {
                        const icon = getFileIcon(file.name);
                        return (
                          <View key={file._id} style={s.fileCard}>
                            <View style={[s.fileIconBox, { backgroundColor: `${icon.color}15` }]}>
                              <Ionicons name={icon.name} size={18} color={icon.color} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={s.fileTitle} numberOfLines={1}>{file.name}</Text>
                              <Text style={s.fileSub}>
                                {formatBytes(file.size)} · {file.createdAt ? new Date(file.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                              </Text>
                            </View>

                            <TouchableOpacity
                              style={s.fileActionBtn}
                              onPress={() => {
                                if (file.fileUrl || file.url) Linking.openURL(file.fileUrl || file.url);
                              }}
                            >
                              <Ionicons name="open-outline" size={15} color="#2563EB" />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={s.fileDeleteBtn}
                              onPress={() => handleDeleteItem(file)}
                            >
                              <Ionicons name="trash-outline" size={15} color="#94A3B8" />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* --- BOTTOM ACTION BAR --- */}
        <View style={[s.bottomActionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={s.createFolderBtn}
            onPress={() => setIsFolderModalOpen(true)}
          >
            <Ionicons name="folder-outline" size={16} color="#475569" />
            <Text style={s.createFolderBtnText}>+ New Folder</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.uploadFileBtn}
            onPress={handlePickAndUploadFile}
            disabled={uploadingFile}
          >
            {uploadingFile ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                <Text style={s.uploadFileBtnText}>Upload Document</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ========================================================================= */}
      {/* MODAL: Create Folder */}
      {/* ========================================================================= */}
      <Modal visible={isFolderModalOpen} animationType="slide" transparent onRequestClose={() => setIsFolderModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Create New Folder</Text>
                <Text style={s.modalSubtitle}>Organize contracts, vendor submittals & drawings</Text>
              </View>
              <TouchableOpacity onPress={() => setIsFolderModalOpen(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Folder Name *</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Electrical Layouts Revision 2"
              placeholderTextColor="#94A3B8"
              value={folderName}
              onChangeText={setFolderName}
              autoFocus
            />

            <TouchableOpacity
              style={[s.saveBtn, creatingFolder && { opacity: 0.7 }]}
              onPress={handleCreateFolder}
              disabled={creatingFolder}
            >
              {creatingFolder ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={s.saveBtnText}>Create Folder</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8FAFF' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 10, gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  breadcrumbBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 8,
  },
  breadcrumbScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  crumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crumbText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  crumbTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  searchRow: { paddingHorizontal: 16, marginTop: 10 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#0F172A' },

  sectionHeader: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#64748B', textTransform: 'uppercase' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#475569' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', paddingHorizontal: 30 },

  foldersGrid: { gap: 8 },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 12,
  },
  folderTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  folderSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },

  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 12,
  },
  fileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  fileSub: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  fileActionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  fileDeleteBtn: {
    padding: 8,
    borderRadius: 8,
  },

  bottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  createFolderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
  },
  createFolderBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#334155' },

  uploadFileBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
  },
  uploadFileBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalCloseBtn: { padding: 4 },
  modalTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSubtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  label: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
  },

  saveBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  saveBtnText: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
});

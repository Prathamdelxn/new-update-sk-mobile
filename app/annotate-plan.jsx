// import React, { useState, useCallback, useEffect, useRef } from 'react';
// import {
//   View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
//   TextInput, Image, Alert, ActivityIndicator, Dimensions, StatusBar,
//   KeyboardAvoidingView, Platform, LayoutAnimation,
// } from 'react-native';
// import { Video, ResizeMode } from 'expo-av';
// import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// import { Ionicons } from '@expo/vector-icons';
// import { useLocalSearchParams, useRouter } from 'expo-router';
// import * as ImagePicker from 'expo-image-picker';
// import { useAuth } from './context/AuthContext';
// import { useToast } from './context/ToastContext';
// import cloudinaryService from './services/cloudinaryService';
// import { useTranslation } from 'react-i18next';

// const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
// const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// const ZOOM_STEPS = [1, 1.5, 2, 3];

// function uuid() {
//   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
//     const r = (Math.random() * 16) | 0;
//     return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
//   });
// }

// // ─── Tooltip callout above/below pin ─────────────────────────────────────────
// function PinTooltip({ ann }) {
//   const hasText = !!ann.text;
//   const hasPhoto = !!ann.imageUri;
//   const hasVideo = !!ann.videoUri;
//   if (!hasText && !hasPhoto && !hasVideo) return null;
  
//   const summary = hasText
//     ? ann.text
//     : hasPhoto
//       ? '📷 Photo attached'
//       : '🎥 Video attached';

//   return (
//     <View style={styles.tooltip} pointerEvents="none">
//       <Text style={styles.tooltipText} numberOfLines={2}>{summary}</Text>
//       <View style={styles.tooltipArrow} />
//     </View>
//   );
// }

// // ─── Single pin marker ────────────────────────────────────────────────────────
// function Pin({ ann, index, canvasW, canvasH, isSelected, onPress }) {
//   const left = ann.x * canvasW - 16;
//   const top = ann.y * canvasH - 36;
//   return (
//     <TouchableOpacity
//       style={[styles.pinOuter, { left, top }]}
//       onPress={(e) => { e.stopPropagation?.(); onPress(); }}
//       hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
//       activeOpacity={0.85}
//     >
//       <PinTooltip ann={ann} />
//       <Ionicons
//         name="location"
//         size={32}
//         color={isSelected ? '#F97316' : '#EF4444'}
//         style={isSelected ? { transform: [{ scale: 1.2 }] } : undefined}
//       />
//       <View style={[styles.pinBadge, isSelected && styles.pinBadgeActive]}>
//         <Text style={styles.pinBadgeText}>{index + 1}</Text>
//       </View>
//     </TouchableOpacity>
//   );
// }

// // ─── Attachment tab button ────────────────────────────────────────────────────
// function TabBtn({ label, icon, active, onPress }) {
//   return (
//     <TouchableOpacity
//       style={[styles.tabBtn, active && styles.tabBtnActive]}
//       onPress={onPress}
//     >
//       <Ionicons name={icon} size={16} color={active ? '#3B82F6' : '#94A3B8'} />
//       <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
//     </TouchableOpacity>
//   );
// }

// // ─── Annotation editor / viewer modal ────────────────────────────────────────
// function AnnotationModal({ visible, annotation, onSave, onDelete, onClose, uploading, readOnly = false }) {
//   const { t } = useTranslation();
//   const [tab, setTab] = useState('text');
//   const [text, setText] = useState('');
//   const [imageUri, setImageUri] = useState('');
//   const [videoUri, setVideoUri] = useState('');
//   const [picking, setPicking] = useState(false);
//   const [fullscreenMedia, setFullscreenMedia] = useState(null); // { type: 'image'|'video', uri }

//   useEffect(() => {
//     if (annotation) {
//       setText(annotation.text || '');
//       setImageUri(annotation.imageUri || '');
//       setVideoUri(annotation.videoUri || '');
//       setTab('text');
//     }
//   }, [annotation?.clientId]);

//   const pickMedia = async (type) => {
//     try {
//       setPicking(true);
//       const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
//       if (!perm.granted) {
//         Alert.alert('Permission required', 'Allow photo library access to attach media.');
//         return;
//       }
//       const result = await ImagePicker.launchImageLibraryAsync({
//         mediaTypes: type === 'photo'
//           ? ImagePicker.MediaTypeOptions.Images
//           : ImagePicker.MediaTypeOptions.Videos,
//         quality: 0.8,
//         allowsEditing: false,
//         videoMaxDuration: 60,
//       });
//       if (!result.canceled && result.assets?.[0]) {
//         if (type === 'photo') setImageUri(result.assets[0].uri);
//         else setVideoUri(result.assets[0].uri);
//       }
//     } finally {
//       setPicking(false);
//     }
//   };

//   const handleSave = () => onSave({ text: text.trim(), imageUri, videoUri });

//   if (!visible || !annotation) return null;

//   const pinIdx = (annotation._index ?? 0) + 1;

//   return (
//     <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
//       <KeyboardAvoidingView
//         behavior={Platform.OS === 'ios' ? 'padding' : undefined}
//         style={{ flex: 1 }}
//       >
//         <View style={styles.modalBg}>
//           <View style={styles.annotSheet}>
//             {/* Handle bar */}
//             <View style={styles.sheetHandle} />

//             {/* Header */}
//             <View style={styles.sheetHeader}>
//               <View style={styles.sheetPinBadge}>
//                 <Ionicons name="location" size={14} color="#EF4444" />
//                 <Text style={styles.sheetPinLabel}>Pin #{pinIdx}</Text>
//                 {readOnly && (
//                   <View style={styles.readOnlyTag}>
//                     <Ionicons name="eye-outline" size={10} color="#64748B" />
//                     <Text style={styles.readOnlyTagText}>View Only</Text>
//                   </View>
//                 )}
//               </View>
//               <View style={{ flexDirection: 'row', gap: 8 }}>
//                 {!readOnly && (
//                   <TouchableOpacity style={styles.sheetDeleteBtn} onPress={onDelete}>
//                     <Ionicons name="trash-outline" size={16} color="#EF4444" />
//                   </TouchableOpacity>
//                 )}
//                 <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
//                   <Ionicons name="close" size={18} color="#64748B" />
//                 </TouchableOpacity>
//               </View>
//             </View>

//             {/* Tabs */}
//             <View style={styles.tabRow}>
//               <TabBtn label="Text" icon="text-outline" active={tab === 'text'} onPress={() => setTab('text')} />
//               <TabBtn label="Photo" icon="image-outline" active={tab === 'photo'} onPress={() => setTab('photo')} />
//               <TabBtn label="Video" icon="videocam-outline" active={tab === 'video'} onPress={() => setTab('video')} />
//             </View>

//             {/* Tab content */}
//             <View style={styles.tabContent}>
//               {tab === 'text' && (
//                 <>
//                   <TextInput
//                     style={styles.annotInput}
//                     multiline
//                     numberOfLines={5}
//                     placeholder={t('describeLocationDefectNote')}
//                     placeholderTextColor="#CBD5E1"
//                     value={text}
//                     onChangeText={setText}
//                     autoFocus
//                   />
//                   {text.length > 0 && (
//                     <Text style={styles.charCount}>{text.length} chars</Text>
//                   )}
//                 </>
//               )}

//               {tab === 'photo' && (
//                 <>
//                   {imageUri ? (
//                     <View style={styles.mediaPreview}>
//                       <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.9} onPress={() => setFullscreenMedia({ type: 'image', uri: imageUri })}>
//                         <Image source={{ uri: imageUri }} style={styles.mediaThumb} resizeMode="cover" />
//                         <View style={styles.expandBtn} pointerEvents="none">
//                           <Ionicons name="expand" size={16} color="#FFF" />
//                         </View>
//                       </TouchableOpacity>
//                       <TouchableOpacity style={styles.mediaRemove} onPress={() => setImageUri('')}>
//                         <Ionicons name="close-circle" size={24} color="#EF4444" />
//                       </TouchableOpacity>
//                     </View>
//                   ) : (
//                     <TouchableOpacity
//                       style={styles.mediaPicker}
//                       onPress={() => pickMedia('photo')}
//                       disabled={picking}
//                     >
//                       {picking ? (
//                         <ActivityIndicator color="#3B82F6" />
//                       ) : (
//                         <>
//                           <View style={styles.mediaPickerIcon}>
//                             <Ionicons name="camera" size={28} color="#3B82F6" />
//                           </View>
//                           <Text style={styles.mediaPickerTitle}>Attach a Photo</Text>
//                           <Text style={styles.mediaPickerSub}>From your gallery</Text>
//                         </>
//                       )}
//                     </TouchableOpacity>
//                   )}
//                 </>
//               )}

//               {tab === 'video' && (
//                 <>
//                   {videoUri ? (
//                     <View style={styles.mediaPreview}>
//                       <Video
//                         source={{ uri: videoUri }}
//                         style={styles.videoPlayer}
//                         useNativeControls
//                         resizeMode={ResizeMode.CONTAIN}
//                         shouldPlay={false}
//                       />
//                       <TouchableOpacity style={styles.expandBtn} onPress={() => setFullscreenMedia({ type: 'video', uri: videoUri })}>
//                         <Ionicons name="expand" size={16} color="#FFF" />
//                       </TouchableOpacity>
//                       <TouchableOpacity style={styles.mediaRemove} onPress={() => setVideoUri('')}>
//                         <Ionicons name="close-circle" size={24} color="#EF4444" />
//                       </TouchableOpacity>
//                     </View>
//                   ) : (
//                     <TouchableOpacity
//                       style={styles.mediaPicker}
//                       onPress={() => pickMedia('video')}
//                       disabled={picking}
//                     >
//                       {picking ? (
//                         <ActivityIndicator color="#3B82F6" />
//                       ) : (
//                         <>
//                           <View style={styles.mediaPickerIcon}>
//                             <Ionicons name="videocam" size={28} color="#3B82F6" />
//                           </View>
//                           <Text style={styles.mediaPickerTitle}>Attach a Video</Text>
//                           <Text style={styles.mediaPickerSub}>Up to 60 seconds from your gallery</Text>
//                         </>
//                       )}
//                     </TouchableOpacity>
//                   )}
//                 </>
//               )}
//             </View>

//             {/* Attachment summary strip */}
//             {(imageUri || videoUri || text) && (
//               <View style={styles.attachSummary}>
//                 {text ? (
//                   <View style={styles.attachChip}>
//                     <Ionicons name="chatbubble-ellipses-outline" size={12} color="#3B82F6" />
//                     <Text style={styles.attachChipText}>Note</Text>
//                   </View>
//                 ) : null}
//                 {imageUri ? (
//                   <View style={styles.attachChip}>
//                     <Ionicons name="image-outline" size={12} color="#10B981" />
//                     <Text style={styles.attachChipText}>Photo</Text>
//                   </View>
//                 ) : null}
//                 {videoUri ? (
//                   <View style={styles.attachChip}>
//                     <Ionicons name="videocam-outline" size={12} color="#8B5CF6" />
//                     <Text style={styles.attachChipText}>Video</Text>
//                   </View>
//                 ) : null}
//               </View>
//             )}

//             {/* Save button — hidden in read-only mode */}
//             {!readOnly && (
//               <TouchableOpacity
//                 style={styles.sheetSaveBtn}
//                 onPress={handleSave}
//                 disabled={uploading}
//               >
//                 {uploading ? (
//                   <ActivityIndicator color="#FFF" />
//                 ) : (
//                   <>
//                     <Ionicons name="checkmark-circle" size={18} color="#FFF" />
//                     <Text style={styles.sheetSaveBtnText}>Save Pin</Text>
//                   </>
//                 )}
//               </TouchableOpacity>
//             )}
//           </View>
//         </View>
//       </KeyboardAvoidingView>

//       {/* Full-screen media viewer */}
//       <Modal visible={!!fullscreenMedia} transparent statusBarTranslucent animationType="fade">
//         <View style={styles.fsModal}>
//           <TouchableOpacity style={styles.fsClose} onPress={() => setFullscreenMedia(null)}>
//             <Ionicons name="close" size={24} color="#FFF" />
//           </TouchableOpacity>
//           {fullscreenMedia?.type === 'image' ? (
//             <Image source={{ uri: fullscreenMedia.uri }} style={styles.fsMedia} resizeMode="contain" />
//           ) : (
//             <Video
//               source={{ uri: fullscreenMedia?.uri }}
//               style={styles.fsMedia}
//               useNativeControls
//               resizeMode={ResizeMode.CONTAIN}
//               shouldPlay
//             />
//           )}
//         </View>
//       </Modal>
//     </Modal>
//   );
// }

// // ─── Main screen ──────────────────────────────────────────────────────────────
// export default function AnnotatePlan() {
//   const { t } = useTranslation();
//   const router = useRouter();
//   const insets = useSafeAreaInsets();
//   const { token, user } = useAuth();
//   const { showToast } = useToast();

//   const perms = user?.role?.permissions || [];
//   const canAnnotate = perms.includes('*') || perms.includes('annotations:update');
//   const { url, name, documentId, folderId, projectId } = useLocalSearchParams();

//   // Canvas sizing
//   const [containerH, setContainerH] = useState(SCREEN_H - 180);
//   const [zoomIdx, setZoomIdx] = useState(0);
//   const zoom = ZOOM_STEPS[zoomIdx];
//   const canvasW = SCREEN_W * zoom;
//   const canvasH = containerH * zoom;

//   // Undo/Redo
//   const [history, setHistory] = useState([[]]);
//   const [historyIndex, setHistoryIndex] = useState(0);
//   const annotations = history[historyIndex] ?? [];

//   // UI mode
//   const [isAddingPin, setIsAddingPin] = useState(false);
//   const [selectedId, setSelectedId] = useState(null);
//   const [modalVisible, setModalVisible] = useState(false);
//   const [editingAnnotation, setEditingAnnotation] = useState(null);
//   const [isSaving, setIsSaving] = useState(false);
//   const [isUploading, setIsUploading] = useState(false);
//   const [isLoading, setIsLoading] = useState(true);
//   const [hasUnsaved, setHasUnsaved] = useState(false);

//   useEffect(() => {
//     if (!folderId || !documentId || !token) { setIsLoading(false); return; }
//     (async () => {
//       try {
//         const res = await fetch(
//           `${API_BASE_URL}/projects/${projectId}/folders/${folderId}/annotations?documentId=${documentId}`,
//           { headers: { Authorization: `Bearer ${token}` } }
//         );
//         if (res.ok) {
//           const data = await res.json();
//           if (data && Array.isArray(data) && data.length > 0) { 
//             const normalized = data.map(ann => ({
//               ...ann,
//               clientId: ann.clientId || ann._id
//             }));
//             setHistory([normalized]); 
//             setHistoryIndex(0); 
//           }
//         }
//       } catch (e) { 
//         console.error('[annotate] load:', e); 
//       } finally { 
//         setIsLoading(false); 
//       }
//     })();
//   }, [documentId, folderId, projectId, token]);

//   // ── Zoom ─────────────────────────────────────────────────────────────────
//   const zoomIn = () => setZoomIdx((i) => Math.min(i + 1, ZOOM_STEPS.length - 1));
//   const zoomOut = () => setZoomIdx((i) => Math.max(i - 1, 0));

//   // ── History ──────────────────────────────────────────────────────────────
//   const pushHistory = useCallback((next) => {
//     setHistory((prev) => [...prev.slice(0, historyIndex + 1), next]);
//     setHistoryIndex((i) => i + 1);
//     setHasUnsaved(true);
//   }, [historyIndex]);

//   const undo = () => { if (historyIndex > 0) { setHistoryIndex((i) => i - 1); setHasUnsaved(true); } };
//   const redo = () => { if (historyIndex < history.length - 1) { setHistoryIndex((i) => i + 1); setHasUnsaved(true); } };

//   // ── Place pin on tap ─────────────────────────────────────────────────────
//   const handleCanvasTap = useCallback((e) => {
//     if (modalVisible) return;
//     if (!isAddingPin) { setSelectedId(null); return; }
    
//     const { locationX, locationY } = e.nativeEvent;
//     const newPin = {
//       clientId: uuid(),
//       documentId,
//       x: locationX / canvasW,
//       y: locationY / canvasH,
//       text: '',
//       imageUri: '',
//       videoUri: '',
//       createdAt: new Date().toISOString(),
//     };
    
//     const updated = [...annotations, newPin];
//     pushHistory(updated);
//     setSelectedId(newPin.clientId);
//     setEditingAnnotation({ ...newPin, _index: updated.length - 1 });
//     setModalVisible(true);
//     setIsAddingPin(false);
//   }, [isAddingPin, modalVisible, canvasW, canvasH, annotations, documentId, pushHistory]);

//   // ── Open pin for editing ─────────────────────────────────────────────────
//   const openPin = useCallback((ann, idx) => {
//     setSelectedId(ann.clientId);
//     setEditingAnnotation({ ...ann, _index: idx });
//     setModalVisible(true);
//     setIsAddingPin(false);
//   }, []);

//   // ── Save pin content (upload media first) ────────────────────────────────
//   const handleAnnotationSave = useCallback(async ({ text, imageUri, videoUri }) => {
//     let finalImageUri = imageUri;
//     let finalVideoUri = videoUri;

//     const needsUpload = (uri) => uri && (uri.startsWith('file://') || uri.startsWith('content://') || !uri.startsWith('http'));

//     try {
//       if (needsUpload(imageUri)) {
//         setIsUploading(true);
//         finalImageUri = await cloudinaryService.uploadFile(imageUri, `ann_photo_${Date.now()}.jpg`, 'image/jpeg');
//       }
//       if (needsUpload(videoUri)) {
//         setIsUploading(true);
//         finalVideoUri = await cloudinaryService.uploadFile(videoUri, `ann_video_${Date.now()}.mp4`, 'video/mp4');
//       }
//     } catch (e) {
//       showToast('Media upload failed', 'error');
//       setIsUploading(false);
//       return;
//     } finally {
//       setIsUploading(false);
//     }

//     const updated = annotations.map((a) =>
//       a.clientId === editingAnnotation.clientId
//         ? { ...a, text, imageUri: finalImageUri, videoUri: finalVideoUri }
//         : a
//     );
//     pushHistory(updated);
//     closeModal();
//   }, [annotations, editingAnnotation, pushHistory, showToast]);

//   // ── Delete pin ────────────────────────────────────────────────────────────
//   const handleDelete = useCallback(() => {
//     const updated = annotations.filter((a) => a.clientId !== editingAnnotation.clientId);
//     pushHistory(updated);
//     closeModal();
//   }, [annotations, editingAnnotation, pushHistory]);

//   const closeModal = () => {
//     setModalVisible(false);
//     setSelectedId(null);
//     setEditingAnnotation(null);
//   };

//   // ── Save to backend ───────────────────────────────────────────────────────
//   const handleSave = useCallback(async () => {
//     try {
//       setIsSaving(true);
//       const res = await fetch(
//         `${API_BASE_URL}/projects/${projectId}/folders/${folderId}/annotations`,
//         {
//           method: 'PATCH',
//           headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
//           body: JSON.stringify({ documentId, annotations }),
//         }
//       );
//       if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
//       setHasUnsaved(false);
//       showToast('Annotations saved.', 'success');
//     } catch (e) {
//       showToast(e.message || 'Save failed', 'error');
//     } finally { setIsSaving(false); }
//   }, [annotations, documentId, folderId, projectId, token, showToast]);

//   // ── Back guard ────────────────────────────────────────────────────────────
//   const handleBack = () => {
//     router.back();
//   };

//   return (
//     <View style={styles.root}>
//       <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
//       <SafeAreaView style={styles.safeArea} edges={['top']}>

//         {/* ── Header ── */}
//         <View style={styles.header}>
//           <TouchableOpacity style={styles.hBtn} onPress={handleBack}>
//             <Ionicons name="arrow-back" size={22} color="#0F172A" />
//           </TouchableOpacity>
//           <View style={{ flex: 1 }}>
//             <Text style={styles.hLabel}>PLAN ANNOTATIONS</Text>
//             <Text style={styles.hTitle} numberOfLines={1}>{name || 'Plan'}</Text>
//           </View>
//           {canAnnotate && (
//             <TouchableOpacity
//               style={[styles.saveHeaderBtn, (!hasUnsaved || isSaving) && { opacity: 0.5 }]}
//               onPress={handleSave}
//               disabled={!hasUnsaved || isSaving}
//             >
//               {isSaving ? (
//                 <ActivityIndicator size="small" color="#FFF" />
//               ) : (
//                 <Text style={styles.saveHeaderBtnText}>Save</Text>
//               )}
//             </TouchableOpacity>
//           )}
//         </View>

//         {/* ── Canvas ── */}
//         <View
//           style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
//           onLayout={(e) => {
//             const h = e.nativeEvent.layout.height;
//             if (Math.abs(containerH - h) > 1) setContainerH(h);
//           }}
//         >
//           <ScrollView
//             style={{ flex: 1 }}
//             scrollEnabled={zoom > 1}
//             showsVerticalScrollIndicator={false}
//             bounces={false}
//             nestedScrollEnabled
//             contentContainerStyle={{ flexGrow: 1, paddingBottom: annotations.length > 0 ? 60 : 0 }}
//           >
//             <ScrollView
//               horizontal
//               scrollEnabled={zoom > 1}
//               showsHorizontalScrollIndicator={false}
//               bounces={false}
//               nestedScrollEnabled
//               contentContainerStyle={{ flexGrow: 1 }}
//             >
//               <TouchableOpacity
//                 activeOpacity={1}
//                 onPress={handleCanvasTap}
//                 style={{ width: canvasW, height: Math.max(canvasH, 1) }}
//               >
//                 <View style={{ width: canvasW, height: Math.max(canvasH, 1), backgroundColor: '#F8FAFF' }}>
//                   {isLoading ? (
//                     <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' }}>
//                       <ActivityIndicator size="large" color="#3B82F6" />
//                     </View>
//                   ) : (
//                     <Image
//                       source={{ uri: url }}
//                       style={{ width: canvasW, height: canvasH }}
//                       resizeMode="contain"
//                     />
//                   )}

//                   {!isLoading && annotations.map((ann, idx) => (
//                     <Pin
//                       key={ann.clientId}
//                       ann={ann}
//                       index={idx}
//                       canvasW={canvasW}
//                       canvasH={canvasH}
//                       isSelected={selectedId === ann.clientId}
//                       onPress={() => openPin(ann, idx)}
//                     />
//                   ))}
//                 </View>
//               </TouchableOpacity>
//             </ScrollView>
//           </ScrollView>

//           {isAddingPin && (
//             <View style={styles.addPinOverlay} pointerEvents="none">
//               <View style={styles.addPinHintBox}>
//                 <Ionicons name="location" size={16} color="#FFF" />
//                 <Text style={styles.addPinHint}>Tap anywhere to place a pin</Text>
//               </View>
//             </View>
//           )}

//           {annotations.length > 0 && (
//             <View style={styles.pinStrip}>
//               <ScrollView
//                 horizontal
//                 showsHorizontalScrollIndicator={false}
//                 contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 6 }}
//               >
//               {annotations.map((ann, idx) => (
//                 <TouchableOpacity
//                   key={ann.clientId}
//                   style={[styles.pinChip, selectedId === ann.clientId && styles.pinChipActive]}
//                   onPress={() => openPin(ann, idx)}
//                 >
//                   <Ionicons name="location" size={12} color={selectedId === ann.clientId ? '#FFF' : '#EF4444'} />
//                   <Text style={[styles.pinChipText, selectedId === ann.clientId && { color: '#FFF' }]}>
//                     {idx + 1}
//                     {ann.text ? ` · ${ann.text.slice(0, 18)}${ann.text.length > 18 ? '…' : ''}` : ''}
//                   </Text>
//                   {ann.imageUri ? <Ionicons name="image-outline" size={11} color={selectedId === ann.clientId ? '#FFF' : '#94A3B8'} /> : null}
//                   {ann.videoUri ? <Ionicons name="videocam-outline" size={11} color={selectedId === ann.clientId ? '#FFF' : '#94A3B8'} /> : null}
//                 </TouchableOpacity>
//               ))}
//             </ScrollView>
//           </View>
//         )}
//         </View>

//         {/* ── Toolbar ── */}
//         <View style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
//           <View style={styles.toolGroup}>
//             <TouchableOpacity 
//               style={[styles.toolBtn, historyIndex === 0 && styles.toolBtnDim]} 
//               onPress={undo} disabled={historyIndex === 0}
//             >
//               <Ionicons name="arrow-undo-outline" size={20} color="#64748B" />
//             </TouchableOpacity>
//             <TouchableOpacity 
//               style={[styles.toolBtn, historyIndex === history.length - 1 && styles.toolBtnDim]} 
//               onPress={redo} disabled={historyIndex === history.length - 1}
//             >
//               <Ionicons name="arrow-redo-outline" size={20} color="#64748B" />
//             </TouchableOpacity>
//           </View>

//           {canAnnotate && (
//             <TouchableOpacity 
//               style={[styles.addPinBtn, isAddingPin && styles.addPinBtnActive]} 
//               onPress={() => setIsAddingPin(!isAddingPin)}
//             >
//               <Ionicons name="location" size={16} color="#FFF" />
//               <Text style={styles.addPinBtnText}>{isAddingPin ? 'Cancel' : 'Add Pin'}</Text>
//             </TouchableOpacity>
//           )}

//           <View style={styles.toolGroup}>
//             <TouchableOpacity style={styles.toolBtn} onPress={zoomOut} disabled={zoomIdx === 0}>
//               <Ionicons name="remove" size={20} color={zoomIdx === 0 ? "#CBD5E1" : "#64748B"} />
//             </TouchableOpacity>
//             <View style={styles.zoomBadge}>
//               <Text style={styles.zoomBadgeText}>{Math.round(zoom * 100)}%</Text>
//             </View>
//             <TouchableOpacity style={styles.toolBtn} onPress={zoomIn} disabled={zoomIdx === ZOOM_STEPS.length - 1}>
//               <Ionicons name="add" size={20} color={zoomIdx === ZOOM_STEPS.length - 1 ? "#CBD5E1" : "#64748B"} />
//             </TouchableOpacity>
//           </View>
//         </View>

//       </SafeAreaView>

//       <AnnotationModal
//         visible={modalVisible}
//         annotation={editingAnnotation}
//         onSave={handleAnnotationSave}
//         onDelete={handleDelete}
//         onClose={closeModal}
//         uploading={isUploading}
//         readOnly={!canAnnotate}
//       />
//     </View>
//   );
// }

// // ─── Styles ───────────────────────────────────────────────────────────────
// const styles = StyleSheet.create({
//   root: { flex: 1, backgroundColor: '#FFF' },
//   safeArea: { flex: 1, backgroundColor: '#FFF' },

//   header: {
//     flexDirection: 'row', alignItems: 'center', gap: 12,
//     paddingHorizontal: 16, paddingTop: 0, paddingBottom: 10,
//     backgroundColor: '#FFF',
//     borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
//   },
//   hBtn: {
//     width: 40, height: 40, borderRadius: 12,
//     backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0',
//     justifyContent: 'center', alignItems: 'center'
//   },
//   hLabel: {
//     fontSize: 9, fontFamily: 'Inter-Black', color: '#3B82F6', letterSpacing: 1.5 },
//   hTitle: { fontSize: 14, fontFamily: 'Inter-Black', color: '#0F172A' },
//   saveHeaderBtn: {
//     backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 8,
//     borderRadius: 10, minWidth: 64, alignItems: 'center',
//   },
//   saveHeaderBtnText: { fontSize: 13, fontFamily: 'Inter-Black', color: '#FFF' },

//   // Pin marker
//   pinOuter: { position: 'absolute', alignItems: 'center' },
//   pinBadge: {
//     position: 'absolute', top: 2, right: -8, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 17, height: 17,
//     justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
//     borderWidth: 1.5, borderColor: '#FFF',
//   },
//   pinBadgeActive: { backgroundColor: '#F97316' },
//   pinBadgeText: { fontSize: 9, fontFamily: 'Inter-Black', color: '#FFF' },

//   // Tooltip
//   tooltip: {
//     position: 'absolute', bottom: 38,
//     backgroundColor: 'rgba(15,23,42,0.88)', borderRadius: 8,
//     paddingHorizontal: 10, paddingVertical: 6,
//     maxWidth: 180, minWidth: 80,
//     shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
//     elevation: 6,
//   },
//   tooltipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#FFF', lineHeight: 15 },
//   tooltipArrow: {
//     position: 'absolute', bottom: -6, left: 14,
//     width: 0, height: 0,
//     borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6,
//     borderLeftColor: 'transparent', borderRightColor: 'transparent',
//     borderTopColor: 'rgba(15,23,42,0.88)',
//   },

//   // Add pin overlay
//   addPinOverlay: {
//     position: 'absolute', top: 20, left: 0, right: 0,
//     justifyContent: 'flex-start', alignItems: 'center',
//     paddingTop: 20,
//   },
//   addPinHintBox: {
//     flexDirection: 'row', alignItems: 'center', gap: 8,
//     backgroundColor: '#3B82F6',
//     paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
//     shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
//   },
//   addPinHint: {
//     color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 13
//   },

//   // Toolbar
//   toolbar: {
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
//     paddingHorizontal: 16, paddingTop: 16,
//     backgroundColor: '#FFF',
//     borderTopWidth: 1, borderTopColor: '#F1F5F9',
//     shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 8,
//     elevation: 8,
//   },
//   toolGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
//   toolBtn: {
//     width: 40, height: 40, borderRadius: 12,
//     backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0',
//     justifyContent: 'center', alignItems: 'center',
//   },
//   toolBtnDim: { opacity: 0.4 },
//   zoomBadge: {
//     paddingHorizontal: 10, paddingVertical: 6,
//     backgroundColor: '#EFF6FF', borderRadius: 8,
//     borderWidth: 1, borderColor: '#BFDBFE',
//   },
//   zoomBadgeText: { fontSize: 12, fontFamily: 'Inter-Black', color: '#1D4ED8' },
//   addPinBtn: {
//     flexDirection: 'row', alignItems: 'center', gap: 6,
//     backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 10,
//     borderRadius: 12,
//   },
//   addPinBtnActive: {
//     backgroundColor: '#64748B',
//   },
//   addPinBtnText: { fontSize: 13, fontFamily: 'Inter-Black', color: '#FFF' },

//   // Pin strip
//   pinStrip: { 
//     position: 'absolute', bottom: 0, left: 0, right: 0,
//     backgroundColor: 'rgba(248, 250, 255, 0.95)', 
//     borderTopWidth: 1, borderTopColor: '#F1F5F9' 
//   },
//   pinChip: {
//     flexDirection: 'row', alignItems: 'center', gap: 4,
//     backgroundColor: '#FFF', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5,
//     borderWidth: 1, borderColor: '#E2E8F0',
//   },
//   pinChipActive: {
//     backgroundColor: '#EF4444', borderColor: '#EF4444',
//   },
//   pinChipText: {
//     fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#334155'
//   },

//   // Modal
//   modalBg: {
//     flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
//     justifyContent: 'flex-end',
//   },
//   annotSheet: {
//     backgroundColor: '#FFF',
//     borderTopLeftRadius: 24, borderTopRightRadius: 24,
//     paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8,
//     shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
//     shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
//   },
//   sheetHandle: {
//     width: 36, height: 4, borderRadius: 2,
//     backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 16,
//   },
//   sheetHeader: {
//     flexDirection: 'row', alignItems: 'center',
//     justifyContent: 'space-between', marginBottom: 16,
//   },
//   sheetPinBadge: {
//     flexDirection: 'row', alignItems: 'center', gap: 6,
//     backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 6,
//     borderRadius: 10, borderWidth: 1, borderColor: '#FECACA',
//   },
//   sheetPinLabel: { fontSize: 14, fontFamily: 'Inter-Black', color: '#EF4444' },
//   sheetDeleteBtn: {
//     width: 36, height: 36, borderRadius: 10,
//     backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center',
//   },
//   sheetCloseBtn: {
//     width: 36, height: 36, borderRadius: 10,
//     backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
//   },

//   // Tabs
//   tabRow: {
//     flexDirection: 'row', gap: 8, marginBottom: 16,
//     backgroundColor: '#F8FAFF', borderRadius: 12, padding: 4,
//   },
//   tabBtn: {
//     flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
//     gap: 5, paddingVertical: 8, borderRadius: 9,
//   },
//   tabBtnActive: { backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
//   tabBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#94A3B8' },
//   tabBtnTextActive: { color: '#3B82F6' },

//   // Tab content
//   tabContent: { minHeight: 130, marginBottom: 12 },
//   annotInput: {
//     backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E2E8F0',
//     borderRadius: 12, padding: 14, fontSize: 14, fontFamily: 'Inter-Regular',
//     color: '#0F172A', minHeight: 110, textAlignVertical: 'top',
//   },
//   charCount: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#CBD5E1', textAlign: 'right', marginTop: 4 },
//   mediaPreview: { width: '100%', height: 160, borderRadius: 12, overflow: 'hidden', position: 'relative' },
//   mediaThumb: { width: '100%', height: '100%' },
//   mediaRemove: { position: 'absolute', top: 6, right: 6, backgroundColor: '#FFF', borderRadius: 12 },
//   videoPlayer: { width: '100%', height: '100%', backgroundColor: '#000', borderRadius: 12 },
//   expandBtn: {
//     position: 'absolute', bottom: 8, right: 8,
//     backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
//     padding: 6,
//   },
//   fsModal: {
//     flex: 1, backgroundColor: '#000',
//     justifyContent: 'center', alignItems: 'center',
//   },
//   fsClose: {
//     position: 'absolute', top: 52, right: 20, zIndex: 10,
//     backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
//     padding: 10,
//   },
//   fsMedia: { width: SCREEN_W, height: SCREEN_H },
//   mediaPicker: {
//     height: 130, borderRadius: 12, borderWidth: 1.5, borderColor: '#BFDBFE',
//     borderStyle: 'dashed', backgroundColor: '#F0F9FF',
//     alignItems: 'center', justifyContent: 'center', gap: 4,
//   },
//   mediaPickerIcon: {
//     width: 48, height: 48, borderRadius: 14,
//     backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center',
//     marginBottom: 4,
//   },
//   mediaPickerTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1D4ED8' },
//   mediaPickerSub: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#94A3B8' },

//   // Attachment summary
//   attachSummary: { flexDirection: 'row', gap: 6, marginBottom: 12 },
//   attachChip: {
//     flexDirection: 'row', alignItems: 'center', gap: 4,
//     backgroundColor: '#F8FAFF', paddingHorizontal: 8, paddingVertical: 4,
//     borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0',
//   },
//   attachChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },

//   // Save
//   sheetSaveBtn: {
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
//     backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 14,
//   },
//   sheetSaveBtnText: { fontSize: 15, fontFamily: 'Inter-Black', color: '#FFF' },

//   // View-only indicators
//   viewOnlyBadge: {
//     flexDirection: 'row', alignItems: 'center', gap: 6,
//     backgroundColor: '#F8FAFF', paddingHorizontal: 12, paddingVertical: 8,
//     borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
//   },
//   viewOnlyText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B' },
//   readOnlyTag: {
//     flexDirection: 'row', alignItems: 'center', gap: 3,
//     backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 3,
//     borderRadius: 6,
//   },
//   readOnlyTagText: { fontSize: 9, fontFamily: 'Inter-Bold', color: '#64748B' },
// });
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  TextInput, Image, Alert, ActivityIndicator, StatusBar,
  KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import cloudinaryService from './services/cloudinaryService';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const ZOOM_STEPS = [1, 1.5, 2, 3];

// ─── Design tokens ────────────────────────────────────────────────────────
const COLORS = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primarySoft: '#EEF2FF',
  primarySoftBorder: '#C7D2FE',
  pin: '#F43F5E',
  pinSoft: '#FFF1F2',
  pinSoftBorder: '#FECDD3',
  pinActive: '#F59E0B',
  success: '#10B981',
  successSoft: '#ECFDF5',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  dangerSoftBorder: '#FECACA',
  video: '#8B5CF6',
  white: '#FFFFFF',
};

const RADIUS = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

const shadow = (elevation = 4, opacity = 0.08) => ({
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: Math.ceil(elevation / 2) },
  shadowOpacity: opacity,
  shadowRadius: elevation,
  elevation,
});

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Tooltip callout above/below pin ─────────────────────────────────────────
function PinTooltip({ ann }) {
  const hasText = !!ann.text;
  const hasPhoto = !!ann.imageUri;
  const hasVideo = !!ann.videoUri;
  const hasAudio = !!ann.audioUri;
  if (!hasText && !hasPhoto && !hasVideo && !hasAudio) return null;

  const summary = hasText
    ? ann.text
    : hasPhoto
      ? '📷  Photo attached'
      : hasVideo
        ? '🎥  Video attached'
        : '🎤  Audio attached';

  return (
    <View style={styles.tooltip} pointerEvents="none">
      <Text style={styles.tooltipText} numberOfLines={2}>{summary}</Text>
      <View style={styles.tooltipArrow} />
    </View>
  );
}

// ─── Single pin marker ────────────────────────────────────────────────────────
function Pin({ ann, index, canvasW, canvasH, isSelected, onPress }) {
  const left = ann.x * canvasW - 17;
  const top = ann.y * canvasH - 38;
  return (
    <TouchableOpacity
      style={[styles.pinOuter, { left, top }]}
      onPress={(e) => { e.stopPropagation?.(); onPress(); }}
      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      activeOpacity={0.85}
    >
      <PinTooltip ann={ann} />
      <View style={[styles.pinGlyphWrap, isSelected && styles.pinGlyphWrapActive]}>
        <Ionicons name="location" size={30} color={isSelected ? COLORS.pinActive : COLORS.pin} />
      </View>
      <View style={[styles.pinBadge, isSelected && styles.pinBadgeActive]}>
        <Text style={styles.pinBadgeText}>{index + 1}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Attachment tab button ────────────────────────────────────────────────────
function TabBtn({ label, icon, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={16} color={active ? COLORS.primary : COLORS.textTertiary} />
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Annotation editor / viewer modal ────────────────────────────────────────
function AnnotationModal({ visible, annotation, onSave, onDelete, onClose, uploading, readOnly = false, sheetMaxWidth }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('text');
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [videoUri, setVideoUri] = useState('');
  const [audioUri, setAudioUri] = useState('');
  const [recording, setRecording] = useState(null);
  const [sound, setSound] = useState(null);
  const [picking, setPicking] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState(null); // { type: 'image'|'video', uri }
  const { width: winW, height: winH } = useWindowDimensions();

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Allow microphone access to record audio.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      setRecording(null);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setAudioUri(uri);
    } catch(e) { console.error(e); }
  };

  const playAudio = async () => {
    if (!audioUri) return;
    try {
      if (sound) await sound.unloadAsync();
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: audioUri });
      setSound(newSound);
      await newSound.playAsync();
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (annotation) {
      setText(annotation.text || '');
      setImageUri(annotation.imageUri || '');
      setVideoUri(annotation.videoUri || '');
      setAudioUri(annotation.audioUri || '');
      setTab('text');
    }
  }, [annotation?.clientId]);

  const pickMedia = async (type) => {
    try {
      setPicking(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Allow photo library access to attach media.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'photo'
          ? ImagePicker.MediaTypeOptions.Images
          : ImagePicker.MediaTypeOptions.Videos,
        quality: 0.8,
        allowsEditing: false,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets?.[0]) {
        if (type === 'photo') setImageUri(result.assets[0].uri);
        else setVideoUri(result.assets[0].uri);
      }
    } finally {
      setPicking(false);
    }
  };

  const handleSave = () => onSave({ text: text.trim(), imageUri, videoUri, audioUri });

  if (!visible || !annotation) return null;

  const pinIdx = (annotation._index ?? 0) + 1;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalBg}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
          <View style={[styles.annotSheet, { maxWidth: sheetMaxWidth, width: '100%', alignSelf: 'center' }]}>
            {/* Handle bar */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetPinBadge}>
                <Ionicons name="location" size={14} color={COLORS.pin} />
                <Text style={styles.sheetPinLabel}>Pin #{pinIdx}</Text>
                {readOnly && (
                  <View style={styles.readOnlyTag}>
                    <Ionicons name="eye-outline" size={10} color={COLORS.textSecondary} />
                    <Text style={styles.readOnlyTagText}>View Only</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
                {!readOnly && (
                  <TouchableOpacity style={styles.sheetDeleteBtn} onPress={onDelete} activeOpacity={0.75}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose} activeOpacity={0.75}>
                  <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
              <TabBtn label="Text" icon="text-outline" active={tab === 'text'} onPress={() => setTab('text')} />
              <TabBtn label="Photo" icon="image-outline" active={tab === 'photo'} onPress={() => setTab('photo')} />
              <TabBtn label="Video" icon="videocam-outline" active={tab === 'video'} onPress={() => setTab('video')} />
              <TabBtn label="Mic" icon="mic-outline" active={tab === 'audio'} onPress={() => setTab('audio')} />
            </View>

            {/* Tab content */}
            <View style={styles.tabContent}>
              {tab === 'text' && (
                <>
                  <TextInput
                    style={styles.annotInput}
                    multiline
                    numberOfLines={5}
                    placeholder={t ? t('describeLocationDefectNote') : 'Describe the location or defect…'}
                    placeholderTextColor={COLORS.textTertiary}
                    value={text}
                    onChangeText={setText}
                    editable={!readOnly}
                    autoFocus={!readOnly}
                  />
                  {text.length > 0 && (
                    <Text style={styles.charCount}>{text.length} chars</Text>
                  )}
                </>
              )}

              {tab === 'photo' && (
                <>
                  {imageUri ? (
                    <View style={styles.mediaPreview}>
                      <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.9} onPress={() => setFullscreenMedia({ type: 'image', uri: imageUri })}>
                        <Image source={{ uri: imageUri }} style={styles.mediaThumb} resizeMode="cover" />
                        <View style={styles.mediaGradientHint} pointerEvents="none" />
                        <View style={styles.expandBtn} pointerEvents="none">
                          <Ionicons name="expand" size={16} color={COLORS.white} />
                        </View>
                      </TouchableOpacity>
                      {!readOnly && (
                        <TouchableOpacity style={styles.mediaRemove} onPress={() => setImageUri('')} activeOpacity={0.8}>
                          <Ionicons name="close-circle" size={24} color={COLORS.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : readOnly ? (
                    <View style={styles.mediaEmptyState}>
                      <Ionicons name="image-outline" size={26} color={COLORS.textTertiary} />
                      <Text style={styles.mediaEmptyText}>No photo attached</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.mediaPicker}
                      onPress={() => pickMedia('photo')}
                      disabled={picking}
                      activeOpacity={0.8}
                    >
                      {picking ? (
                        <ActivityIndicator color={COLORS.primary} />
                      ) : (
                        <>
                          <View style={styles.mediaPickerIcon}>
                            <Ionicons name="camera" size={26} color={COLORS.primary} />
                          </View>
                          <Text style={styles.mediaPickerTitle}>Attach a Photo</Text>
                          <Text style={styles.mediaPickerSub}>From your gallery</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}

              {tab === 'video' && (
                <>
                  {videoUri ? (
                    <View style={styles.mediaPreview}>
                      <Video
                        source={{ uri: videoUri }}
                        style={styles.videoPlayer}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        shouldPlay={false}
                      />
                      <TouchableOpacity style={styles.expandBtn} onPress={() => setFullscreenMedia({ type: 'video', uri: videoUri })} activeOpacity={0.8}>
                        <Ionicons name="expand" size={16} color={COLORS.white} />
                      </TouchableOpacity>
                      {!readOnly && (
                        <TouchableOpacity style={styles.mediaRemove} onPress={() => setVideoUri('')} activeOpacity={0.8}>
                          <Ionicons name="close-circle" size={24} color={COLORS.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : readOnly ? (
                    <View style={styles.mediaEmptyState}>
                      <Ionicons name="videocam-outline" size={26} color={COLORS.textTertiary} />
                      <Text style={styles.mediaEmptyText}>No video attached</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.mediaPicker}
                      onPress={() => pickMedia('video')}
                      disabled={picking}
                      activeOpacity={0.8}
                    >
                      {picking ? (
                        <ActivityIndicator color={COLORS.primary} />
                      ) : (
                        <>
                          <View style={styles.mediaPickerIcon}>
                            <Ionicons name="videocam" size={26} color={COLORS.primary} />
                          </View>
                          <Text style={styles.mediaPickerTitle}>Attach a Video</Text>
                          <Text style={styles.mediaPickerSub}>Up to 60 seconds from your gallery</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}

              {tab === 'audio' && (
                <View style={styles.audioTabContainer}>
                  {audioUri ? (
                    <View style={styles.mediaPreview}>
                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACE.md }}>
                        <Ionicons name="musical-notes-outline" size={32} color={COLORS.primarySoftBorder} />
                        <TouchableOpacity style={styles.audioPlayBtn} onPress={playAudio} activeOpacity={0.8}>
                          <Ionicons name="play" size={24} color={COLORS.white} />
                          <Text style={styles.audioPlayText}>Play Recording</Text>
                        </TouchableOpacity>
                      </View>
                      {!readOnly && (
                        <TouchableOpacity style={styles.mediaRemove} onPress={() => setAudioUri('')} activeOpacity={0.8}>
                          <Ionicons name="close-circle" size={24} color={COLORS.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : readOnly ? (
                    <View style={styles.mediaEmptyState}>
                      <Ionicons name="mic-outline" size={26} color={COLORS.textTertiary} />
                      <Text style={styles.mediaEmptyText}>No audio attached</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.mediaPicker, recording && { borderColor: COLORS.pin, backgroundColor: COLORS.pinSoft }]}
                      onPress={recording ? stopRecording : startRecording}
                      activeOpacity={0.8}
                    >
                      {recording ? (
                        <>
                          <View style={[styles.mediaPickerIcon, { backgroundColor: COLORS.surface }]}>
                            <Ionicons name="stop" size={26} color={COLORS.pin} />
                          </View>
                          <Text style={[styles.mediaPickerTitle, { color: COLORS.pin }]}>Tap to Stop</Text>
                          <Text style={styles.mediaPickerSub}>Recording in progress…</Text>
                        </>
                      ) : (
                        <>
                          <View style={styles.mediaPickerIcon}>
                            <Ionicons name="mic" size={26} color={COLORS.primary} />
                          </View>
                          <Text style={styles.mediaPickerTitle}>Record Audio</Text>
                          <Text style={styles.mediaPickerSub}>Voice note for this pin</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Attachment summary strip */}
            {(imageUri || videoUri || text) && (
              <View style={styles.attachSummary}>
                {text ? (
                  <View style={styles.attachChip}>
                    <Ionicons name="chatbubble-ellipses-outline" size={12} color={COLORS.primary} />
                    <Text style={styles.attachChipText}>Note</Text>
                  </View>
                ) : null}
                {imageUri ? (
                  <View style={styles.attachChip}>
                    <Ionicons name="image-outline" size={12} color={COLORS.success} />
                    <Text style={styles.attachChipText}>Photo</Text>
                  </View>
                ) : null}
                {videoUri ? (
                  <View style={styles.attachChip}>
                    <Ionicons name="videocam-outline" size={12} color={COLORS.video} />
                    <Text style={styles.attachChipText}>Video</Text>
                  </View>
                ) : null}
                {audioUri ? (
                  <View style={styles.attachChip}>
                    <Ionicons name="mic-outline" size={12} color={COLORS.primaryDark} />
                    <Text style={styles.attachChipText}>Audio</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Save button — hidden in read-only mode */}
            {!readOnly && (
              <TouchableOpacity
                style={[styles.sheetSaveBtn, uploading && { opacity: 0.75 }]}
                onPress={handleSave}
                disabled={uploading}
                activeOpacity={0.85}
              >
                {uploading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                    <Text style={styles.sheetSaveBtnText}>Save Pin</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Full-screen media viewer */}
      <Modal visible={!!fullscreenMedia} transparent statusBarTranslucent animationType="fade">
        <View style={styles.fsModal}>
          <TouchableOpacity style={styles.fsClose} onPress={() => setFullscreenMedia(null)} activeOpacity={0.8}>
            <Ionicons name="close" size={24} color={COLORS.white} />
          </TouchableOpacity>
          {fullscreenMedia?.type === 'image' ? (
            <Image source={{ uri: fullscreenMedia.uri }} style={{ width: winW, height: winH }} resizeMode="contain" />
          ) : (
            <Video
              source={{ uri: fullscreenMedia?.uri }}
              style={{ width: winW, height: winH }}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
          )}
        </View>
      </Modal>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AnnotatePlan() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();

  const isTablet = SCREEN_W >= 768;
  const sheetMaxWidth = isTablet ? 480 : SCREEN_W;

  const perms = user?.role?.permissions || [];
  const { url, name, documentId, folderId, projectId, canAnnotate: canAnnotateParam } = useLocalSearchParams();
  // canAnnotateParam is resolved by the caller (plans.jsx) using the user's
  // project-specific role — checking only user.role.permissions here would
  // miss permissions granted via a project-level role assignment rather than
  // the user's global default role.
  const canAnnotate = canAnnotateParam !== undefined
    ? canAnnotateParam === '1'
    : (perms.includes('*') || perms.includes('annotations:update'));

  // Canvas sizing
  const [containerH, setContainerH] = useState(SCREEN_H - 180);
  const [zoomIdx, setZoomIdx] = useState(0);
  const zoom = ZOOM_STEPS[zoomIdx];
  const canvasW = SCREEN_W * zoom;
  const canvasH = containerH * zoom;

  // Undo/Redo
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const annotations = history[historyIndex] ?? [];

  // UI mode
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  useEffect(() => {
    if (!folderId || !documentId || !token) { setIsLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/projects/${projectId}/folders/${folderId}/annotations?documentId=${documentId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data) && data.length > 0) {
            const normalized = data.map(ann => ({
              ...ann,
              clientId: ann.clientId || ann._id
            }));
            setHistory([normalized]);
            setHistoryIndex(0);
          }
        }
      } catch (e) {
        console.error('[annotate] load:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [documentId, folderId, projectId, token]);

  // ── Zoom ─────────────────────────────────────────────────────────────────
  const zoomIn = () => setZoomIdx((i) => Math.min(i + 1, ZOOM_STEPS.length - 1));
  const zoomOut = () => setZoomIdx((i) => Math.max(i - 1, 0));

  // ── History ──────────────────────────────────────────────────────────────
  const pushHistory = useCallback((next) => {
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), next]);
    setHistoryIndex((i) => i + 1);
    setHasUnsaved(true);
  }, [historyIndex]);

  const undo = () => { if (historyIndex > 0) { setHistoryIndex((i) => i - 1); setHasUnsaved(true); } };
  const redo = () => { if (historyIndex < history.length - 1) { setHistoryIndex((i) => i + 1); setHasUnsaved(true); } };

  // ── Place pin on tap ─────────────────────────────────────────────────────
  const handleCanvasTap = useCallback((e) => {
    if (modalVisible) return;
    if (!isAddingPin) { setSelectedId(null); return; }

    const { locationX, locationY } = e.nativeEvent;
    const newPin = {
      clientId: uuid(),
      documentId,
      x: locationX / canvasW,
      y: locationY / canvasH,
      text: '',
      imageUri: '',
      videoUri: '',
      audioUri: '',
      createdAt: new Date().toISOString(),
    };

    const updated = [...annotations, newPin];
    pushHistory(updated);
    setSelectedId(newPin.clientId);
    setEditingAnnotation({ ...newPin, _index: updated.length - 1 });
    setModalVisible(true);
    setIsAddingPin(false);
  }, [isAddingPin, modalVisible, canvasW, canvasH, annotations, documentId, pushHistory]);

  // ── Open pin for editing ─────────────────────────────────────────────────
  const openPin = useCallback((ann, idx) => {
    setSelectedId(ann.clientId);
    setEditingAnnotation({ ...ann, _index: idx });
    setModalVisible(true);
    setIsAddingPin(false);
  }, []);

  // ── Save pin content (upload media first) ────────────────────────────────
  const handleAnnotationSave = useCallback(async ({ text, imageUri, videoUri, audioUri }) => {
    let finalImageUri = imageUri;
    let finalVideoUri = videoUri;
    let finalAudioUri = audioUri;

    const needsUpload = (uri) => uri && (uri.startsWith('file://') || uri.startsWith('content://') || !uri.startsWith('http'));

    try {
      if (needsUpload(imageUri)) {
        setIsUploading(true);
        finalImageUri = await cloudinaryService.uploadFile(imageUri, `ann_photo_${Date.now()}.jpg`, 'image/jpeg');
      }
      if (needsUpload(videoUri)) {
        setIsUploading(true);
        finalVideoUri = await cloudinaryService.uploadFile(videoUri, `ann_video_${Date.now()}.mp4`, 'video/mp4');
      }
      if (needsUpload(audioUri)) {
        setIsUploading(true);
        finalAudioUri = await cloudinaryService.uploadFile(audioUri, `ann_audio_${Date.now()}.m4a`, 'audio/m4a');
      }
    } catch (e) {
      showToast('Media upload failed', 'error');
      setIsUploading(false);
      return;
    } finally {
      setIsUploading(false);
    }

    const updated = annotations.map((a) =>
      a.clientId === editingAnnotation.clientId
        ? { ...a, text, imageUri: finalImageUri, videoUri: finalVideoUri, audioUri: finalAudioUri }
        : a
    );
    pushHistory(updated);
    closeModal();
  }, [annotations, editingAnnotation, pushHistory, showToast]);

  // ── Delete pin ────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    const updated = annotations.filter((a) => a.clientId !== editingAnnotation.clientId);
    pushHistory(updated);
    closeModal();
  }, [annotations, editingAnnotation, pushHistory]);

  const closeModal = () => {
    setModalVisible(false);
    setSelectedId(null);
    setEditingAnnotation(null);
  };

  // ── Save to backend ───────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      const res = await fetch(
        `${API_BASE_URL}/projects/${projectId}/folders/${folderId}/annotations`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ documentId, annotations }),
        }
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      setHasUnsaved(false);
      showToast('Annotations saved.', 'success');
    } catch (e) {
      showToast(e.message || 'Save failed', 'error');
    } finally { setIsSaving(false); }
  }, [annotations, documentId, folderId, projectId, token, showToast]);

  // ── Back guard ────────────────────────────────────────────────────────────
  const handleBack = () => {
    router.back();
  };

  const contentMaxWidth = isTablet ? 900 : SCREEN_W;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.hBtn} onPress={handleBack} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={styles.hLabelRow}>
              <View style={styles.hLabelDot} />
              <Text style={styles.hLabel}>PLAN ANNOTATIONS</Text>
            </View>
            <Text style={styles.hTitle} numberOfLines={1}>{name || 'Plan'}</Text>
          </View>
          {hasUnsaved && !isSaving && (
            <View style={styles.unsavedDot} />
          )}
          {canAnnotate && (
            <TouchableOpacity
              style={[styles.saveHeaderBtn, (!hasUnsaved || isSaving) && styles.saveHeaderBtnDisabled]}
              onPress={handleSave}
              disabled={!hasUnsaved || isSaving}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={14} color={COLORS.white} />
                  <Text style={styles.saveHeaderBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Canvas ── */}
        <View
          style={{ flex: 1, overflow: 'hidden', position: 'relative', width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (Math.abs(containerH - h) > 1) setContainerH(h);
          }}
        >
          <ScrollView
            style={{ flex: 1 }}
            scrollEnabled={zoom > 1}
            showsVerticalScrollIndicator={false}
            bounces={false}
            nestedScrollEnabled
            contentContainerStyle={{ flexGrow: 1, paddingBottom: annotations.length > 0 ? 64 : 0 }}
          >
            <ScrollView
              horizontal
              scrollEnabled={zoom > 1}
              showsHorizontalScrollIndicator={false}
              bounces={false}
              nestedScrollEnabled
              contentContainerStyle={{ flexGrow: 1 }}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={handleCanvasTap}
                style={{ width: canvasW, height: Math.max(canvasH, 1) }}
              >
                <View style={{ width: canvasW, height: Math.max(canvasH, 1), backgroundColor: COLORS.bg }}>
                  {isLoading ? (
                    <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: SPACE.sm }}>
                      <ActivityIndicator size="large" color={COLORS.primary} />
                      <Text style={styles.loadingText}>Loading plan…</Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: url }}
                      style={{ width: canvasW, height: canvasH }}
                      resizeMode="contain"
                    />
                  )}

                  {!isLoading && annotations.map((ann, idx) => (
                    <Pin
                      key={ann.clientId}
                      ann={ann}
                      index={idx}
                      canvasW={canvasW}
                      canvasH={canvasH}
                      isSelected={selectedId === ann.clientId}
                      onPress={() => openPin(ann, idx)}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            </ScrollView>
          </ScrollView>

          {isAddingPin && (
            <View style={styles.addPinOverlay} pointerEvents="none">
              <View style={styles.addPinHintBox}>
                <Ionicons name="location" size={16} color={COLORS.white} />
                <Text style={styles.addPinHint}>Tap anywhere to place a pin</Text>
              </View>
            </View>
          )}

          {/* {!isLoading && annotations.length === 0 && !isAddingPin && canAnnotate && (
            <View style={styles.emptyOverlay} pointerEvents="none">
              <View style={styles.emptyCard}>
                <Ionicons name="location-outline" size={22} color={COLORS.textTertiary} />
                <Text style={styles.emptyCardText}>No pins yet. Tap "Add Pin" to mark a location.</Text>
              </View>
            </View>
          )} */}

          {annotations.length > 0 && (
            <View style={styles.pinStrip}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm }}
              >
                {annotations.map((ann, idx) => (
                  <TouchableOpacity
                    key={ann.clientId}
                    style={[styles.pinChip, selectedId === ann.clientId && styles.pinChipActive]}
                    onPress={() => openPin(ann, idx)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="location" size={12} color={selectedId === ann.clientId ? COLORS.white : COLORS.pin} />
                    <Text style={[styles.pinChipText, selectedId === ann.clientId && { color: COLORS.white }]}>
                      {idx + 1}
                      {ann.text ? ` · ${ann.text.slice(0, 18)}${ann.text.length > 18 ? '…' : ''}` : ''}
                    </Text>
                    {ann.imageUri ? <Ionicons name="image-outline" size={11} color={selectedId === ann.clientId ? COLORS.white : COLORS.textTertiary} /> : null}
                    {ann.videoUri ? <Ionicons name="videocam-outline" size={11} color={selectedId === ann.clientId ? COLORS.white : COLORS.textTertiary} /> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* ── Toolbar ── */}
        <View style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, SPACE.lg), maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }]}>
          <View style={styles.toolGroup}>
            <TouchableOpacity
              style={[styles.toolBtn, historyIndex === 0 && styles.toolBtnDim]}
              onPress={undo} disabled={historyIndex === 0}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-undo-outline" size={19} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolBtn, historyIndex === history.length - 1 && styles.toolBtnDim]}
              onPress={redo} disabled={historyIndex === history.length - 1}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-redo-outline" size={19} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {canAnnotate && (
            <TouchableOpacity
              style={[styles.addPinBtn, isAddingPin && styles.addPinBtnActive]}
              onPress={() => setIsAddingPin(!isAddingPin)}
              activeOpacity={0.85}
            >
              <Ionicons name={isAddingPin ? 'close' : 'location'} size={16} color={COLORS.white} />
              <Text style={styles.addPinBtnText}>{isAddingPin ? 'Cancel' : 'Add Pin'}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.toolGroup}>
            <TouchableOpacity style={styles.toolBtn} onPress={zoomOut} disabled={zoomIdx === 0} activeOpacity={0.75}>
              <Ionicons name="remove" size={20} color={zoomIdx === 0 ? COLORS.borderStrong : COLORS.textSecondary} />
            </TouchableOpacity>
            <View style={styles.zoomBadge}>
              <Text style={styles.zoomBadgeText}>{Math.round(zoom * 100)}%</Text>
            </View>
            <TouchableOpacity style={styles.toolBtn} onPress={zoomIn} disabled={zoomIdx === ZOOM_STEPS.length - 1} activeOpacity={0.75}>
              <Ionicons name="add" size={20} color={zoomIdx === ZOOM_STEPS.length - 1 ? COLORS.borderStrong : COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

      </SafeAreaView>

      <AnnotationModal
        visible={modalVisible}
        annotation={editingAnnotation}
        onSave={handleAnnotationSave}
        onDelete={handleDelete}
        onClose={closeModal}
        uploading={isUploading}
        readOnly={!canAnnotate}
        sheetMaxWidth={sheetMaxWidth}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  safeArea: { flex: 1, backgroundColor: COLORS.surface },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingHorizontal: SPACE.lg, paddingTop: 4, paddingBottom: SPACE.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    ...shadow(3, 0.03),
  },
  hBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  hLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  hLabelDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.primary },
  hLabel: { fontSize: 10, fontFamily: 'Inter-Black', color: COLORS.primary, letterSpacing: 1.4 },
  hTitle: { fontSize: 16, fontFamily: 'Inter-Black', color: COLORS.textPrimary },
  unsavedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.pinActive, marginRight: -4 },
  saveHeaderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: RADIUS.md, minWidth: 72, justifyContent: 'center',
    ...shadow(6, 0.18),
    shadowColor: COLORS.primary,
  },
  saveHeaderBtnDisabled: { backgroundColor: COLORS.borderStrong, shadowOpacity: 0, elevation: 0 },
  saveHeaderBtnText: { fontSize: 13, fontFamily: 'Inter-Black', color: COLORS.white },

  loadingText: { fontSize: 13, fontFamily: 'Inter-Medium', color: COLORS.textTertiary },

  // Pin marker
  pinOuter: { position: 'absolute', alignItems: 'center', width: 34 },
  pinGlyphWrap: {
    ...shadow(4, 0.18),
  },
  pinGlyphWrapActive: { transform: [{ scale: 1.12 }] },
  pinBadge: {
    position: 'absolute', top: 1, right: -6, backgroundColor: COLORS.pin, borderRadius: 8, minWidth: 17, height: 17,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  pinBadgeActive: { backgroundColor: COLORS.pinActive },
  pinBadgeText: { fontSize: 9, fontFamily: 'Inter-Black', color: COLORS.white },

  // Tooltip
  tooltip: {
    position: 'absolute', bottom: 40,
    backgroundColor: 'rgba(15,23,42,0.92)', borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 6,
    maxWidth: 190, minWidth: 90,
    ...shadow(6, 0.25),
    shadowColor: '#000',
  },
  tooltipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: COLORS.white, lineHeight: 15 },
  tooltipArrow: {
    position: 'absolute', bottom: -6, left: 14,
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: 'rgba(15,23,42,0.92)',
  },

  // Add pin overlay
  addPinOverlay: {
    position: 'absolute', top: 18, left: 0, right: 0,
    justifyContent: 'flex-start', alignItems: 'center',
  },
  addPinHintBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20, paddingVertical: 11, borderRadius: RADIUS.pill,
    ...shadow(10, 0.28),
    shadowColor: COLORS.primary,
  },
  addPinHint: { color: COLORS.white, fontFamily: 'Inter-Bold', fontSize: 13 },

  // Empty state
  emptyOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACE.xxl,
  },
  emptyCard: {
    alignItems: 'center', gap: SPACE.sm,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: SPACE.xl, paddingVertical: SPACE.lg,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    maxWidth: 280,
  },
  emptyCardText: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },

  // Toolbar
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    ...shadow(10, 0.06),
  },
  toolGroup: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  toolBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  toolBtnDim: { opacity: 0.4 },
  zoomBadge: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.primarySoftBorder,
  },
  zoomBadgeText: { fontSize: 12, fontFamily: 'Inter-Black', color: COLORS.primaryDark },
  addPinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.pin, paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: RADIUS.md,
    ...shadow(8, 0.22),
    shadowColor: COLORS.pin,
  },
  addPinBtnActive: {
    backgroundColor: COLORS.textSecondary,
    shadowColor: COLORS.textSecondary,
  },
  addPinBtnText: { fontSize: 13.5, fontFamily: 'Inter-Black', color: COLORS.white },

  // Pin strip
  pinStrip: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  pinChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.pill, paddingHorizontal: 11, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  pinChipActive: {
    backgroundColor: COLORS.pin, borderColor: COLORS.pin,
    ...shadow(4, 0.2), shadowColor: COLORS.pin,
  },
  pinChipText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: COLORS.textPrimary },

  // Modal
  modalBg: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  annotSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACE.xl, paddingBottom: 34, paddingTop: SPACE.sm,
    ...shadow(20, 0.16),
  },
  sheetHandle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACE.lg,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: SPACE.lg,
  },
  sheetPinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.pinSoft, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.pinSoftBorder,
  },
  sheetPinLabel: { fontSize: 14, fontFamily: 'Inter-Black', color: COLORS.pin },
  sheetDeleteBtn: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.dangerSoft, justifyContent: 'center', alignItems: 'center',
  },
  sheetCloseBtn: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt, justifyContent: 'center', alignItems: 'center',
  },

  // Tabs
  tabRow: {
    flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.lg,
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: 4,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 9,
  },
  tabBtnActive: { backgroundColor: COLORS.surface, ...shadow(4, 0.07) },
  tabBtnText: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: COLORS.textTertiary },
  tabBtnTextActive: { color: COLORS.primary },

  // Tab content
  tabContent: { minHeight: 132, marginBottom: SPACE.md },
  annotInput: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACE.md, fontSize: 14, fontFamily: 'Inter-Regular',
    color: COLORS.textPrimary, minHeight: 112, textAlignVertical: 'top', lineHeight: 20,
  },
  charCount: { fontSize: 10.5, fontFamily: 'Inter-Medium', color: COLORS.textTertiary, textAlign: 'right', marginTop: 4 },
  mediaPreview: { width: '100%', height: 168, borderRadius: RADIUS.md, overflow: 'hidden', position: 'relative', backgroundColor: '#000' },
  mediaThumb: { width: '100%', height: '100%' },
  mediaGradientHint: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 40,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  mediaRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: COLORS.white, borderRadius: 12 },
  videoPlayer: { width: '100%', height: '100%', backgroundColor: '#000', borderRadius: RADIUS.md },
  expandBtn: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: RADIUS.sm,
    padding: 6,
  },
  mediaEmptyState: {
    height: 132, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  mediaEmptyText: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: COLORS.textTertiary },
  fsModal: {
    flex: 1, backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center',
  },
  fsClose: {
    position: 'absolute', top: 52, right: 20, zIndex: 10,
    backgroundColor: 'rgba(15,23,42,0.65)', borderRadius: 20,
    padding: 10,
  },
  mediaPicker: {
    height: 132, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primarySoftBorder,
    borderStyle: 'dashed', backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  mediaPickerIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
    marginBottom: 4, ...shadow(3, 0.06),
  },
  mediaPickerTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: COLORS.primaryDark },
  mediaPickerSub: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: COLORS.textTertiary },

  // Attachment summary
  attachSummary: { flexDirection: 'row', gap: 6, marginBottom: SPACE.md },
  attachChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.bg, paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  attachChipText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: COLORS.textSecondary },

  // Save
  sheetSaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 15,
    ...shadow(10, 0.22), shadowColor: COLORS.primary,
  },
  sheetSaveBtnText: { fontSize: 15, fontFamily: 'Inter-Black', color: COLORS.white },

  // Audio specific
  audioTabContainer: { flex: 1 },
  audioPlayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md,
    borderRadius: RADIUS.pill, ...shadow(4, 0.2),
  },
  audioPlayText: { color: COLORS.white, fontFamily: 'Inter-Bold', fontSize: 13.5 },

  // View-only indicators
  readOnlyTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.surfaceAlt, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6,
  },
  readOnlyTagText: { fontSize: 9, fontFamily: 'Inter-Bold', color: COLORS.textSecondary },
});
// import React, { useState, useEffect, useCallback } from 'react';
// import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, ScrollView, Alert, Image } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import ConfirmModal from '../../components/ConfirmModal';
// const AdaptiveGlass = ({ style, children }) => <View style={[{ backgroundColor: 'rgba(255, 255, 255, 0.85)', overflow: 'hidden' }, style]}>{children}</View>;
// import { useAuth } from '../../context/AuthContext';
// import { useToast } from '../../context/ToastContext';
// import { useSocket } from '../../context/SocketContext';
// import { formatCompact, formatCurrency } from '../../utils/format';
// import { useTranslation } from 'react-i18next';

// const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// export default function ProjectSurveyTab({ project, fetchProjectData }) {
//   const { t } = useTranslation();
//   const { token, user } = useAuth();
//   const { showToast } = useToast();
//   const { socket } = useSocket();
  
//   const [survey, setSurvey] = useState(null);
//   const [isLoading, setIsLoading] = useState(true);
  
//   // Rejection Modal State
//   const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
//   const [rejectionReason, setRejectionReason] = useState('');
//   const [isProcessing, setIsProcessing] = useState(false);

//   // Budget Modal State
//   const [isBudgetModalVisible, setIsBudgetModalVisible] = useState(false);
//   const [budgetApprovers, setBudgetApprovers] = useState([]);
//   const [selectedApprover, setSelectedApprover] = useState(null);
//   const [isFetchingApprovers, setIsFetchingApprovers] = useState(false);
//   const [isSendingBudgetReq, setIsSendingBudgetReq] = useState(false);

//   // Modern Confirmation Modal State
//   const [confirmModal, setConfirmModal] = useState({
//     visible: false,
//     title: '',
//     message: '',
//     confirmText: '',
//     onConfirm: null,
//     type: 'default'
//   });

//   const [selectedImage, setSelectedImage] = useState(null);

//   const isInterior = project?.projectType === 'Interior';

//   // Authorization Check
//   const isAdminOrManager = user?.role?.name === 'Admin' || user?.role?.permissions?.includes('*') || user?.role?.permissions?.includes('sitesurvey:manage');

//   const fetchSurvey = useCallback(async () => {
//     try {
//       if (!project?._id) return;
//       setIsLoading(true);
//       const res = await fetch(`${API_BASE_URL}/projects/${project._id}/survey`, {
//         headers: { 'Authorization': `Bearer ${token}` }
//       });
//       if (res.ok) {
//         const data = await res.json();
//         setSurvey(data);
//       } else {
//         setSurvey(null);
//       }
//     } catch (e) {
//       console.error(e);
//     } finally {
//       setIsLoading(false);
//     }
//   }, [project?._id, token]);

//   useEffect(() => {
//     fetchSurvey();
//   }, [fetchSurvey]);

//   useEffect(() => {
//     if (!socket) return;
//     socket.on('survey:updated', fetchSurvey);
//     return () => socket.off('survey:updated', fetchSurvey);
//   }, [socket, fetchSurvey]);

//   const handleAction = async (action) => {
//     if (isProcessing) return;
//     if (action === 'Reject' && !rejectionReason.trim()) {
//       showToast('Please provide a reason for rejecting the survey.', 'error');
//       return;
//     }

//     try {
//       setIsProcessing(true);
//       const res = await fetch(`${API_BASE_URL}/projects/${project._id}/survey`, {
//         method: 'PATCH',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify({
//           action,
//           rejectionReason: action === 'Reject' ? rejectionReason : undefined
//         })
//       });

//       if (res.ok) {
//         showToast(`Survey successfully ${action.toLowerCase()}ed!`, 'success');
//         setIsRejectModalVisible(false);
//         setRejectionReason('');
//         await fetchSurvey();
//         if (fetchProjectData) fetchProjectData();
//       } else {
//         const err = await res.json();
//         showToast(err.message || `Failed to ${action} survey`, 'error');
//       }
//     } catch (e) {
//       showToast(t('networkErrorProcessing'), 'error');
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   const openBudgetModal = async () => {
//     setIsBudgetModalVisible(true);
//     setIsFetchingApprovers(true);
//     try {
//       const res = await fetch(`${API_BASE_URL}/projects/${project._id}/budget-approvers`, {
//         headers: { 'Authorization': `Bearer ${token}` }
//       });
//       if (res.ok) {
//         setBudgetApprovers(await res.json());
//       }
//     } catch (e) {
//       console.error(e);
//       showToast('Failed to load approvers', 'error');
//     } finally {
//       setIsFetchingApprovers(false);
//     }
//   };

//   const handleSendBudgetRequest = async () => {
//     if (isSendingBudgetReq) return;
//     if (!selectedApprover) {
//       showToast('Please select an approver', 'error');
//       return;
//     }
//     setIsSendingBudgetReq(true);
//     try {
//       const res = await fetch(`${API_BASE_URL}/projects/${project._id}/budget-request`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify({ approverId: selectedApprover })
//       });

//       if (res.ok) {
//         showToast('Budget request sent successfully', 'success');
//         setIsBudgetModalVisible(false);
//         await fetchSurvey();
//       } else {
//         const err = await res.json();
//         showToast(err.message || 'Failed to send request', 'error');
//       }
//     } catch (e) {
//       showToast(t('networkError'), 'error');
//     } finally {
//       setIsSendingBudgetReq(false);
//     }
//   };

//   const getStatusBadge = (status) => {
//     switch(status) {
//       case 'Approved': return { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-circle' };
//       case 'Needs Attention': return { bg: '#FEE2E2', text: '#DC2626', icon: 'warning' };
//       case 'Submitted': return { bg: '#FEF3C7', text: '#D97706', icon: 'time' };
//       default: return { bg: '#F1F5F9', text: '#64748B', icon: 'document' };
//     }
//   };

//   if (isLoading) {
//     return (
//       <View style={styles.centerContainer}>
//         <ActivityIndicator size="large" color="#3B82F6" />
//       </View>
//     );
//   }

//   if (!survey) {
//     return (
//       <View style={styles.centerContainer}>
//         <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
//         <Text style={styles.emptyText}>No site survey found for this project yet.</Text>
//       </View>
//     );
//   }

//   const badge = getStatusBadge(survey.status);

//   return (
//     <View style={styles.tabScrollContent}>
      
//       {/* Header Banner */}
//       <AdaptiveGlass intensity={30} tint="light" style={styles.card}>
//         <View style={styles.headerRow}>
//           <View>
//             <Text style={styles.cardLabel}>{t('surveyReport', 'SURVEY REPORT')}</Text>
//             <Text style={styles.surveyTitle}>{t('initialAssessment', 'Initial Assessment')}</Text>
//           </View>
//           <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
//             <Ionicons name={badge.icon} size={14} color={badge.text} />
//             <Text style={[styles.statusBadgeText, { color: badge.text }]}>{survey.status}</Text>
//           </View>
//         </View>

//         <View style={styles.metaRow}>
//           <View style={styles.metaCol}>
//             <Text style={styles.metaLabel}>{t('submittedBy', 'Submitted By')}</Text>
//             <Text style={styles.metaValue}>{survey.surveyor?.name || 'Surveyor'}</Text>
//           </View>
//           <View style={styles.metaCol}>
//             <Text style={styles.metaLabel}>{t('date', 'Date')}</Text>
//             <Text style={styles.metaValue}>{new Date(survey.createdAt).toLocaleDateString()}</Text>
//           </View>
//         </View>
        
//         {survey.status === 'Needs Attention' && survey.rejectionReason && (
//           <View style={styles.rejectionBox}>
//             <Text style={styles.rejectionBoxTitle}>{t('rejectionFeedback', 'Rejection Feedback')}</Text>
//             <Text style={styles.rejectionBoxText}>{survey.rejectionReason}</Text>
//           </View>
//         )}

//         {(survey.surveyor?._id === user?._id || survey.surveyor === user?._id) && survey.status !== 'Approved' && (
//           <TouchableOpacity 
//             style={styles.editSurveyBtn}
//             onPress={() => router.push({
//               pathname: `/project/${project._id}/site-survey`,
//               params: { editMode: 'true', currentBudget: project.budget, projectType: project.projectType || 'Construction', currency: project.currency || 'AED' }
//             })}
//           >
//             <Ionicons name="create-outline" size={18} color="#2563EB" />
//             <Text style={styles.editSurveyBtnText}>{t('editSurveyReport', 'Edit Survey Report')}</Text>
//           </TouchableOpacity>
//         )}
//       </AdaptiveGlass>

//       {/* Grid Assessment */}
//       <View style={styles.gridTwo}>
//         <AdaptiveGlass intensity={20} tint="light" style={styles.gridItem}>
//            <View style={[styles.iconCircle, { backgroundColor: survey.accessibility === 'Good' ? '#D1FAE5' : (survey.accessibility === 'Hazardous' || survey.accessibility === 'Needs Work') ? '#FEE2E2' : '#FEF3C7' }]}>
//              <Ionicons name={isInterior ? 'home' : 'analytics'} size={20} color={survey.accessibility === 'Good' ? '#059669' : (survey.accessibility === 'Hazardous' || survey.accessibility === 'Needs Work') ? '#DC2626' : '#D97706'} />
//            </View>
//            <Text style={styles.gridVal}>{survey.accessibility}</Text>
//            <Text style={styles.gridLabel}>{isInterior ? 'Space Condition' : t('accessibility', 'Accessibility')}</Text>
//         </AdaptiveGlass>

//         <AdaptiveGlass intensity={20} tint="light" style={styles.gridItem}>
//            <View style={[styles.iconCircle, { backgroundColor: survey.powerAvailable ? '#DBEAFE' : '#F1F5F9' }]}>
//              <Ionicons name={isInterior ? 'bulb' : 'flash'} size={20} color={survey.powerAvailable ? '#2563EB' : '#94A3B8'} />
//            </View>
//            <Text style={styles.gridVal}>{survey.powerAvailable ? 'Accessible' : 'None'}</Text>
//            <Text style={styles.gridLabel}>{isInterior ? 'Electrical Access' : t('gridPower', 'Grid Power')}</Text>
//         </AdaptiveGlass>

//         <AdaptiveGlass intensity={20} tint="light" style={styles.gridItem}>
//            <View style={[styles.iconCircle, { backgroundColor: survey.waterAvailable ? '#E0F2FE' : '#F1F5F9' }]}>
//              <Ionicons name="water" size={20} color={survey.waterAvailable ? '#0284C7' : '#94A3B8'} />
//            </View>
//            <Text style={styles.gridVal}>{survey.waterAvailable ? 'Accessible' : 'None'}</Text>
//            <Text style={styles.gridLabel}>{isInterior ? 'Plumbing Access' : t('waterSupply', 'Water Supply')}</Text>
//         </AdaptiveGlass>
        
//         <AdaptiveGlass intensity={20} tint="light" style={styles.gridItem}>
//            <View style={[styles.iconCircle, { backgroundColor: survey.affectsBudget ? '#FEE2E2' : '#D1FAE5' }]}>
//              <Ionicons name="wallet" size={20} color={survey.affectsBudget ? '#DC2626' : '#059669'} />
//            </View>
//            <Text style={styles.gridVal}>{survey.affectsBudget ? 'Impacted' : 'Stable'}</Text>
//            <Text style={styles.gridLabel}>{t('budgetState', 'Budget State')}</Text>
//         </AdaptiveGlass>
//       </View>

//       {/* Interior: Room Details */}
//       {isInterior && (survey.roomCount || survey.ceilingHeight || survey.naturalLighting || survey.ventilationAvailable !== undefined) && (
//         <AdaptiveGlass intensity={20} tint="light" style={styles.card}>
//           <Text style={styles.cardLabel}>ROOM DETAILS</Text>
//           <View style={styles.detailStrip}>
//             {survey.roomCount != null && <View style={styles.detailItem}><Ionicons name="grid-outline" size={18} color="#3B82F6" /><Text style={styles.detailVal}>{survey.roomCount}</Text><Text style={styles.detailLabel}>Rooms</Text></View>}
//             {survey.ceilingHeight ? <View style={styles.detailItem}><Ionicons name="arrow-up-outline" size={18} color="#8B5CF6" /><Text style={styles.detailVal}>{survey.ceilingHeight}</Text><Text style={styles.detailLabel}>Ceiling Height</Text></View> : null}
//             {survey.naturalLighting ? <View style={styles.detailItem}><Ionicons name="sunny-outline" size={18} color="#F59E0B" /><Text style={styles.detailVal}>{survey.naturalLighting}</Text><Text style={styles.detailLabel}>Natural Light</Text></View> : null}
//             <View style={styles.detailItem}><Ionicons name="thermometer-outline" size={18} color={survey.ventilationAvailable ? '#10B981' : '#94A3B8'} /><Text style={styles.detailVal}>{survey.ventilationAvailable ? 'Yes' : 'No'}</Text><Text style={styles.detailLabel}>Ventilation</Text></View>
//           </View>
//         </AdaptiveGlass>
//       )}

//       {/* Interior: Structural Modification */}
//       {isInterior && survey.structuralModification && (
//         <AdaptiveGlass intensity={20} tint="light" style={[styles.card, { borderColor: '#FDE68A', backgroundColor: 'rgba(254,252,232,0.8)' }]}>
//           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
//             <Ionicons name="construct-outline" size={18} color="#D97706" />
//             <Text style={[styles.cardLabel, { color: '#D97706', marginBottom: 0 }]}>STRUCTURAL MODIFICATIONS NEEDED</Text>
//           </View>
//           <Text style={styles.notesText}>{survey.structuralNotes || 'Structural changes required — no details provided.'}</Text>
//         </AdaptiveGlass>
//       )}

//       {/* Interior: Client Style Preference */}
//       {isInterior && survey.clientStylePreference ? (
//         <AdaptiveGlass intensity={20} tint="light" style={styles.card}>
//           <Text style={styles.cardLabel}>CLIENT STYLE PREFERENCE</Text>
//           <Text style={styles.notesText}>{survey.clientStylePreference}</Text>
//         </AdaptiveGlass>
//       ) : null}

//       {/* Detail Notes */}
//       <AdaptiveGlass intensity={20} tint="light" style={styles.card}>
//          <Text style={styles.cardLabel}>{isInterior ? 'SPACE & CONDITION NOTES' : 'TERRAIN & SOIL REPORT'}</Text>
//          <Text style={styles.notesText}>{survey.terrainNotes || (isInterior ? 'No space condition notes provided.' : 'No specific technical notes provided.')}</Text>
//       </AdaptiveGlass>

//       <AdaptiveGlass intensity={20} tint="light" style={styles.card}>
//          <Text style={styles.cardLabel}>{t('surveyorComments', 'SURVEYOR COMMENTS')}</Text>
//          <Text style={styles.notesText}>{survey.surveyorComments || 'No general comments provided.'}</Text>
//       </AdaptiveGlass>

//       {/* Observation Image */}
//       {survey.observationImage && (
//         <AdaptiveGlass intensity={20} tint="light" style={styles.card}>
//           <Text style={styles.cardLabel}>{isInterior ? 'SPACE OBSERVATION PHOTO' : t('siteObservationPhoto', 'SITE OBSERVATION PHOTO')}</Text>
//           <TouchableOpacity onPress={() => setSelectedImage(survey.observationImage)} activeOpacity={0.8}>
//             <Image source={{ uri: survey.observationImage }} style={styles.observationImage} />
//           </TouchableOpacity>
//         </AdaptiveGlass>
//       )}

//       {/* Interior: Additional Room Photos */}
//       {isInterior && survey.additionalPhotos?.length > 0 && (
//         <AdaptiveGlass intensity={20} tint="light" style={styles.card}>
//           <Text style={styles.cardLabel}>ADDITIONAL ROOM PHOTOS</Text>
//           <View style={styles.photoGrid}>
//             {survey.additionalPhotos.map((uri, idx) => (
//               <TouchableOpacity key={idx} onPress={() => setSelectedImage(uri)} activeOpacity={0.8}>
//                 <Image source={{ uri }} style={styles.photoThumb} />
//               </TouchableOpacity>
//             ))}
//           </View>
//         </AdaptiveGlass>
//       )}

//       {/* Budget Request Alert */}
//       {survey.affectsBudget && (
//         <AdaptiveGlass intensity={40} tint="light" style={[styles.card, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
//           <View style={styles.budgetAlertHeader}>
//             <Ionicons name="alert-circle" size={20} color="#DC2626" />
//             <Text style={styles.budgetAlertTitle}>{t('budgetModificationRequested', 'Budget Modification Requested')}</Text>
//           </View>
//           <Text style={styles.budgetAlertAmt}>New Estimate: {formatCurrency(survey.recommendedBudget, project?.currency)}</Text>
//           <Text style={styles.budgetAlertReason}>{survey.budgetReason}</Text>
          
//           {survey.status === 'Approved' && !survey.budgetRequestSent && (
//             <TouchableOpacity 
//               style={[styles.approveBtn, { marginTop: 16, backgroundColor: '#DC2626', shadowColor: '#DC2626' }]} 
//               onPress={openBudgetModal}
//             >
//               <Ionicons name="send" size={18} color="#FFFFFF" />
//               <Text style={styles.approveBtnText}>{t('sendBudgetChangeRequest', 'Send Budget Change Request')}</Text>
//             </TouchableOpacity>
//           )}
//           {survey.status === 'Approved' && survey.budgetRequestSent && (
//             <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7', alignSelf: 'flex-start', marginTop: 16 }]}>
//               <Ionicons name="time" size={14} color="#D97706" />
//               <Text style={[styles.statusBadgeText, { color: '#D97706' }]}>{t('requestSentToApprover', 'Request Sent to Approver')}</Text>
//             </View>
//           )}
//         </AdaptiveGlass>
//       )}

//       {/* Action Buttons for Admins */}
//       {isAdminOrManager && survey.status === 'Submitted' && (
//         <View style={styles.actionRow}>
//           <TouchableOpacity style={styles.rejectBtn} onPress={() => setIsRejectModalVisible(true)}>
//             <Ionicons name="close" size={18} color="#EF4444" />
//             <Text style={styles.rejectBtnText}>{t('reject', 'Reject')}</Text>
//           </TouchableOpacity>
//           <TouchableOpacity 
//             style={styles.approveBtn} 
//             onPress={() => {
//               setConfirmModal({
//                 visible: true,
//                 title: 'Approve Survey',
//                 message: `Are you sure you want to approve this survey report? This will allow ${isInterior ? 'interior design planning' : 'construction planning'} to proceed.`,
//                 confirmText: 'Approve',
//                 type: 'success',
//                 onConfirm: () => {
//                   setConfirmModal(prev => ({ ...prev, visible: false }));
//                   handleAction('Approve');
//                 }
//               });
//             }}
//           >
//             <Ionicons name="checkmark" size={18} color="#FFFFFF" />
//             {isProcessing ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.approveBtnText}>{t('approveReport', 'Approve Report')}</Text>}
//           </TouchableOpacity>
//         </View>
//       )}

//       <ConfirmModal 
//         visible={confirmModal.visible}
//         title={confirmModal.title}
//         message={confirmModal.message}
//         confirmText={confirmModal.confirmText}
//         type={confirmModal.type}
//         isSubmitting={isProcessing}
//         onConfirm={confirmModal.onConfirm}
//         onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
//       />

//       {/* Rejection Modal */}
//       <Modal visible={isRejectModalVisible} transparent animationType="fade">
//         <View style={styles.modalOverlay}>
//           <View style={styles.smallModal}>
//             <Text style={styles.modalTitle}>{t('refuseSiteSurvey', 'Refuse Site Survey')}</Text>
//             <Text style={styles.modalSub}>{t('provideActionableFeedback', 'Provide actionable feedback so the surveyor can rectify the issues.')}</Text>
            
//             <TextInput
//               style={styles.modalTextArea}
//               placeholder={t('egMissingTerrainData', 'e.g. Missing terrain composition data...')}
//               multiline
//               textAlignVertical="top"
//               value={rejectionReason}
//               onChangeText={setRejectionReason}
//             />

//             <View style={styles.modalActions}>
//               <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsRejectModalVisible(false)} disabled={isProcessing}>
//                 <Text style={styles.cancelText}>{t('cancel', 'Cancel')}</Text>
//               </TouchableOpacity>
//               <TouchableOpacity style={styles.confirmRejectBtn} onPress={() => handleAction('Reject')} disabled={isProcessing}>
//                 {isProcessing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmRejectText}>{t('submitRejection', 'Submit Rejection')}</Text>}
//               </TouchableOpacity>
//             </View>
//           </View>
//         </View>
//       </Modal>

//       {/* Budget Approver Modal */}
//       <Modal visible={isBudgetModalVisible} transparent animationType="fade">
//         <View style={styles.modalOverlay}>
//           <View style={styles.smallModal}>
//             <Text style={styles.modalTitle}>{t('selectBudgetApprover', 'Select Budget Approver')}</Text>
//             <Text style={styles.modalSub}>{t('chooseTeamMemberBudget', 'Choose a team member with budget approval permissions to review this change.')}</Text>
            
//             {isFetchingApprovers ? (
//               <ActivityIndicator color="#3B82F6" style={{ marginVertical: 20 }} />
//             ) : (
//               <ScrollView style={{ maxHeight: 200, marginBottom: 20 }}>
//                 {budgetApprovers.length === 0 ? (
//                   <Text style={styles.emptyText}>No approvers assigned to this project.</Text>
//                 ) : (
//                   budgetApprovers.map(a => (
//                     <TouchableOpacity
//                       key={a._id}
//                       style={[
//                         styles.approverCard,
//                         selectedApprover === a._id && styles.approverCardSelected
//                       ]}
//                       onPress={() => setSelectedApprover(a._id)}
//                     >
//                       <View>
//                         <Text style={[styles.approverName, selectedApprover === a._id && { color: '#2563EB' }]}>{a.name}</Text>
//                         <Text style={styles.approverRole}>{a.roleName}</Text>
//                       </View>
//                       {selectedApprover === a._id && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
//                     </TouchableOpacity>
//                   ))
//                 )}
//               </ScrollView>
//             )}

//             <View style={styles.modalActions}>
//               <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsBudgetModalVisible(false)} disabled={isSendingBudgetReq}>
//                 <Text style={styles.cancelText}>{t('cancel', 'Cancel')}</Text>
//               </TouchableOpacity>
//               <TouchableOpacity style={[styles.confirmRejectBtn, { backgroundColor: '#2563EB' }]} onPress={handleSendBudgetRequest} disabled={isSendingBudgetReq || !selectedApprover}>
//                 {isSendingBudgetReq ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmRejectText}>{t('sendRequest', 'Send Request')}</Text>}
//               </TouchableOpacity>
//             </View>
//           </View>
//         </View>
//       </Modal>
//       {/* Fullscreen Image Preview */}
//       <Modal visible={!!selectedImage} transparent animationType="fade">
//         <View style={styles.previewOverlay}>
//           <TouchableOpacity style={styles.closePreviewBtn} onPress={() => setSelectedImage(null)}>
//             <Ionicons name="close-circle" size={36} color="#FFF" />
//           </TouchableOpacity>
//           {selectedImage && (
//             <View style={styles.previewContent}>
//               <Image source={{ uri: selectedImage }} style={styles.fullImage} />
//             </View>
//           )}
//         </View>
//       </Modal>

//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   tabScrollContent: { gap: 12, paddingBottom: 20 },
//   centerContainer: { flex: 1, minHeight: 300, justifyContent: 'center', alignItems: 'center', gap: 12 },
//   emptyText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B' },
//   card: { padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'rgba(255, 255, 255, 0.85)' },
//   cardLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 8 },
//   headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
//   surveyTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
//   statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 6 },
//   statusBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
//   metaRow: { flexDirection: 'row', gap: 24 },
//   metaCol: { flex: 1 },
//   metaLabel: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#94A3B8', marginBottom: 2 },
//   metaValue: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
//   rejectionBox: { marginTop: 16, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 16, borderWidth: 1, borderColor: '#FECACA' },
//   rejectionBoxTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#DC2626', marginBottom: 4, textTransform: 'uppercase' },
//   rejectionBoxText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#991B1B', lineHeight: 20 },
//   editSurveyBtn: { marginTop: 16, paddingVertical: 10, borderRadius: 14, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
//   editSurveyBtnText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#2563EB' },
//   gridTwo: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
//   gridItem: { width: '48%', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'rgba(255, 255, 255, 0.85)', alignItems: 'center' },
//   iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
//   gridVal: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 2 },
//   gridLabel: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#64748B' },
//   notesText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#334155', lineHeight: 20 },
//   budgetAlertHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
//   budgetAlertTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#DC2626' },
//   budgetAlertAmt: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#991B1B', marginBottom: 4 },
//   budgetAlertReason: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#B91C1C' },
//   actionRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
//   rejectBtn: { flex: 1, height: 56, borderRadius: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
//   rejectBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#DC2626' },
//   approveBtn: { flex: 2, height: 56, borderRadius: 16, backgroundColor: '#059669', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
//   approveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
//   modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
//   smallModal: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24 },
//   modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 6 },
//   modalSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginBottom: 20 },
//   modalTextArea: { height: 120, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A' },
//   modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
//   cancelBtn: { flex: 1, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
//   cancelText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#64748B' },
//   confirmRejectBtn: { flex: 2, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#DC2626' },
//   confirmRejectText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
//   approverCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
//   approverCardSelected: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
//   approverName: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
//   approverRole: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' },
//   observationImage: { width: '100%', height: 250, borderRadius: 16, marginTop: 10, resizeMode: 'cover' },
//   detailStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 4 },
//   detailItem: { alignItems: 'center', gap: 4, minWidth: 70 },
//   detailVal: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
//   detailLabel: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
//   photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
//   photoThumb: { width: 100, height: 100, borderRadius: 14, resizeMode: 'cover' },
//   previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
//   previewContent: { width: '95%', height: '80%', justifyContent: 'center', alignItems: 'center' },
//   fullImage: { width: '100%', height: '100%', resizeMode: 'contain', borderRadius: 20 },
//   closePreviewBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
// });




import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, ScrollView, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ConfirmModal from '../../components/ConfirmModal';
const AdaptiveGlass = ({ style, children }) => <View style={[{ backgroundColor: 'rgba(255, 255, 255, 0.85)', overflow: 'hidden' }, style]}>{children}</View>;
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import { formatCompact, formatCurrency } from '../../utils/format';
import { useTranslation } from 'react-i18next';
import { hasProjectPermission, isProjectLocked } from '../../utils/permissions';
import { useRouter } from 'expo-router';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function ProjectSurveyTab({ project, fetchProjectData }) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();
  const router = useRouter();
  
  const [survey, setSurvey] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Rejection Modal State
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Budget Modal State
  const [isBudgetModalVisible, setIsBudgetModalVisible] = useState(false);
  const [budgetApprovers, setBudgetApprovers] = useState([]);
  const [selectedApprover, setSelectedApprover] = useState(null);
  const [isFetchingApprovers, setIsFetchingApprovers] = useState(false);
  const [isSendingBudgetReq, setIsSendingBudgetReq] = useState(false);

  // Modern Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: null,
    type: 'default'
  });

  const [selectedImage, setSelectedImage] = useState(null);

  const isInterior = project?.projectType === 'Interior';

  // Authorization Check
  const isLocked = isProjectLocked(project);
  const isAdminOrManager = !isLocked && hasProjectPermission(user, project, 'sitesurvey:manage');

  const fetchSurvey = useCallback(async () => {
    try {
      if (!project?._id) return;
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/survey`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSurvey(data);
      } else {
        setSurvey(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [project?._id, token]);

  useEffect(() => {
    fetchSurvey();
  }, [fetchSurvey]);

  useEffect(() => {
    if (!socket) return;
    socket.on('survey:updated', fetchSurvey);
    return () => socket.off('survey:updated', fetchSurvey);
  }, [socket, fetchSurvey]);

  const handleAction = async (action) => {
    if (isProcessing) return;
    if (action === 'Reject' && !rejectionReason.trim()) {
      showToast('Please provide a reason for rejecting the survey.', 'error');
      return;
    }

    try {
      setIsProcessing(true);
      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/survey`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          rejectionReason: action === 'Reject' ? rejectionReason : undefined
        })
      });

      if (res.ok) {
        showToast(`Survey successfully ${action.toLowerCase()}ed!`, 'success');
        setIsRejectModalVisible(false);
        setRejectionReason('');
        await fetchSurvey();
        if (fetchProjectData) fetchProjectData();
      } else {
        const err = await res.json();
        showToast(err.message || `Failed to ${action} survey`, 'error');
      }
    } catch (e) {
      showToast(t('networkErrorProcessing'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const openBudgetModal = async () => {
    setIsBudgetModalVisible(true);
    setIsFetchingApprovers(true);
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/budget-approvers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setBudgetApprovers(await res.json());
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to load approvers', 'error');
    } finally {
      setIsFetchingApprovers(false);
    }
  };

  const handleSendBudgetRequest = async () => {
    if (isSendingBudgetReq) return;
    if (!selectedApprover) {
      showToast('Please select an approver', 'error');
      return;
    }
    setIsSendingBudgetReq(true);
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${project._id}/budget-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ approverId: selectedApprover })
      });

      if (res.ok) {
        showToast('Budget request sent successfully', 'success');
        setIsBudgetModalVisible(false);
        await fetchSurvey();
      } else {
        const err = await res.json();
        showToast(err.message || 'Failed to send request', 'error');
      }
    } catch (e) {
      showToast(t('networkError'), 'error');
    } finally {
      setIsSendingBudgetReq(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Approved': return { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-circle' };
      case 'Needs Attention': return { bg: '#FEE2E2', text: '#DC2626', icon: 'warning' };
      case 'Submitted': return { bg: '#FEF3C7', text: '#D97706', icon: 'time' };
      default: return { bg: '#F1F5F9', text: '#64748B', icon: 'document' };
    }
  };

  const currentBudget = project?.budgetHistory?.length ? project.budgetHistory[project.budgetHistory.length - 1].amount : 0;

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!survey) {
    const surveyorId = project?.siteSurveyor?._id || project?.siteSurveyor;
    const currentUserId = user?._id || user?.id;
    const isSurveyor = surveyorId && currentUserId && (surveyorId === currentUserId);
    const canManageSurvey = isAdminOrManager || isSurveyor;

    return (
      <View style={styles.centerContainer}>
        <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
        <Text style={styles.emptyText}>No site survey found for this project yet.</Text>
        
        {canManageSurvey && (
          <TouchableOpacity 
            style={[styles.editSurveyBtn, { paddingHorizontal: 24, marginTop: 24 }]}
            onPress={() => router.push({
              pathname: `/project/${project._id}/site-survey`,
              params: { editMode: 'false', currentBudget, projectType: project.projectType || 'Construction', currency: project.currency || 'AED' }
            })}
          >
            <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
            <Text style={styles.editSurveyBtnText}>Start Site Survey</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const badge = getStatusBadge(survey.status);

  // Extract true surveyor details from the already-decrypted project members list
  const surveyorId = survey.surveyor?._id || survey.surveyor;
  const surveyorUser = project?.members?.find(m => m._id === surveyorId) || 
                       (project?.createdBy?._id === surveyorId ? project?.createdBy : survey.surveyor);
  
  let surveyorName = 'Surveyor';
  if (surveyorUser?.name && (!surveyorUser.name.includes(':') || surveyorUser.name.length < 50)) {
    surveyorName = surveyorUser.name;
  } else if (surveyorUser?.email) {
    surveyorName = surveyorUser.email.split('@')[0];
  }
  const surveyorEmail = surveyorUser?.email || '';

  return (
    <View style={styles.tabScrollContent}>
      
      {/* Header Banner */}
      <AdaptiveGlass intensity={30} tint="light" style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.cardLabel}>{t('surveyReport', 'SURVEY REPORT')}</Text>
            <Text style={styles.surveyTitle}>{t('initialAssessment', 'Initial Assessment')}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon} size={14} color={badge.text} />
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>{survey.status}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.metaCol, { flex: 1.5 }]}>
            <Text style={styles.metaLabel}>{t('submittedBy', 'Submitted By')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#64748B', fontSize: 14, fontFamily: 'Inter-SemiBold' }}>{surveyorName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' }} numberOfLines={1}>{surveyorName}</Text>
                {!!surveyorEmail && <Text style={{ fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' }} numberOfLines={1}>{surveyorEmail}</Text>}
              </View>
            </View>
          </View>
          <View style={[styles.metaCol, { flex: 1, justifyContent: 'center' }]}>
            <Text style={styles.metaLabel}>{t('date', 'Date')}</Text>
            <Text style={[styles.metaValue, { marginTop: 4 }]}>{new Date(survey.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
        
        {survey.status === 'Needs Attention' && survey.rejectionReason && (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionBoxTitle}>{t('rejectionFeedback', 'Rejection Feedback')}</Text>
            <Text style={styles.rejectionBoxText}>{survey.rejectionReason}</Text>
          </View>
        )}

        {(survey.surveyor?._id === user?._id || survey.surveyor === user?._id) && survey.status !== 'Approved' && (
          <TouchableOpacity 
            style={styles.editSurveyBtn}
            onPress={() => router.push({
              pathname: `/project/${project._id}/site-survey`,
              params: { editMode: 'true', currentBudget, projectType: project.projectType || 'Construction', currency: project.currency || 'AED' }
            })}
          >
            <Ionicons name="create-outline" size={18} color="#2563EB" />
            <Text style={styles.editSurveyBtnText}>{t('editSurveyReport', 'Edit Survey Report')}</Text>
          </TouchableOpacity>
        )}
      </AdaptiveGlass>

      {/* Grid Assessment */}
      <View style={styles.gridTwo}>
        <AdaptiveGlass intensity={20} tint="light" style={styles.gridItem}>
           <View style={[styles.iconCircle, { backgroundColor: survey.accessibility === 'Good' ? '#D1FAE5' : (survey.accessibility === 'Hazardous' || survey.accessibility === 'Needs Work') ? '#FEE2E2' : '#FEF3C7' }]}>
             <Ionicons name={isInterior ? 'home' : 'analytics'} size={20} color={survey.accessibility === 'Good' ? '#059669' : (survey.accessibility === 'Hazardous' || survey.accessibility === 'Needs Work') ? '#DC2626' : '#D97706'} />
           </View>
           <Text style={styles.gridVal}>{survey.accessibility}</Text>
           <Text style={styles.gridLabel}>{isInterior ? 'Space Condition' : t('accessibility', 'Accessibility')}</Text>
        </AdaptiveGlass>

        <AdaptiveGlass intensity={20} tint="light" style={styles.gridItem}>
           <View style={[styles.iconCircle, { backgroundColor: survey.powerAvailable ? '#DBEAFE' : '#F1F5F9' }]}>
             <Ionicons name={isInterior ? 'bulb' : 'flash'} size={20} color={survey.powerAvailable ? '#2563EB' : '#94A3B8'} />
           </View>
           <Text style={styles.gridVal}>{survey.powerAvailable ? 'Accessible' : 'None'}</Text>
           <Text style={styles.gridLabel}>{isInterior ? 'Electrical Access' : t('gridPower', 'Grid Power')}</Text>
        </AdaptiveGlass>

        <AdaptiveGlass intensity={20} tint="light" style={styles.gridItem}>
           <View style={[styles.iconCircle, { backgroundColor: survey.waterAvailable ? '#E0F2FE' : '#F1F5F9' }]}>
             <Ionicons name="water" size={20} color={survey.waterAvailable ? '#0284C7' : '#94A3B8'} />
           </View>
           <Text style={styles.gridVal}>{survey.waterAvailable ? 'Accessible' : 'None'}</Text>
           <Text style={styles.gridLabel}>{isInterior ? 'Plumbing Access' : t('waterSupply', 'Water Supply')}</Text>
        </AdaptiveGlass>
        
        <AdaptiveGlass intensity={20} tint="light" style={styles.gridItem}>
           <View style={[styles.iconCircle, { backgroundColor: survey.affectsBudget ? '#FEE2E2' : '#D1FAE5' }]}>
             <Ionicons name="wallet" size={20} color={survey.affectsBudget ? '#DC2626' : '#059669'} />
           </View>
           <Text style={styles.gridVal}>{survey.affectsBudget ? 'Impacted' : 'Stable'}</Text>
           <Text style={styles.gridLabel}>{t('budgetState', 'Budget State')}</Text>
        </AdaptiveGlass>
      </View>

      {/* Interior: Room Details */}
      {isInterior && (survey.roomCount || survey.ceilingHeight || survey.naturalLighting || survey.ventilationAvailable !== undefined) && (
        <AdaptiveGlass intensity={20} tint="light" style={styles.card}>
          <Text style={styles.cardLabel}>ROOM DETAILS</Text>
          <View style={styles.detailStrip}>
            {survey.roomCount != null && <View style={styles.detailItem}><Ionicons name="grid-outline" size={18} color="#3B82F6" /><Text style={styles.detailVal}>{survey.roomCount}</Text><Text style={styles.detailLabel}>Rooms</Text></View>}
            {survey.ceilingHeight ? <View style={styles.detailItem}><Ionicons name="arrow-up-outline" size={18} color="#8B5CF6" /><Text style={styles.detailVal}>{survey.ceilingHeight}</Text><Text style={styles.detailLabel}>Ceiling Height</Text></View> : null}
            {survey.naturalLighting ? <View style={styles.detailItem}><Ionicons name="sunny-outline" size={18} color="#F59E0B" /><Text style={styles.detailVal}>{survey.naturalLighting}</Text><Text style={styles.detailLabel}>Natural Light</Text></View> : null}
            <View style={styles.detailItem}><Ionicons name="thermometer-outline" size={18} color={survey.ventilationAvailable ? '#10B981' : '#94A3B8'} /><Text style={styles.detailVal}>{survey.ventilationAvailable ? 'Yes' : 'No'}</Text><Text style={styles.detailLabel}>Ventilation</Text></View>
          </View>
        </AdaptiveGlass>
      )}

      {/* Interior: Structural Modification */}
      {isInterior && survey.structuralModification && (
        <AdaptiveGlass intensity={20} tint="light" style={[styles.card, { borderColor: '#FDE68A', backgroundColor: 'rgba(254,252,232,0.8)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Ionicons name="construct-outline" size={18} color="#D97706" />
            <Text style={[styles.cardLabel, { color: '#D97706', marginBottom: 0 }]}>STRUCTURAL MODIFICATIONS NEEDED</Text>
          </View>
          <Text style={styles.notesText}>{survey.structuralNotes || 'Structural changes required — no details provided.'}</Text>
        </AdaptiveGlass>
      )}

      {/* Interior: Client Style Preference */}
      {isInterior && survey.clientStylePreference ? (
        <AdaptiveGlass intensity={20} tint="light" style={styles.card}>
          <Text style={styles.cardLabel}>CLIENT STYLE PREFERENCE</Text>
          <Text style={styles.notesText}>{survey.clientStylePreference}</Text>
        </AdaptiveGlass>
      ) : null}

      {/* Detail Notes */}
      <AdaptiveGlass intensity={20} tint="light" style={styles.card}>
         <Text style={styles.cardLabel}>{isInterior ? 'SPACE & CONDITION NOTES' : 'TERRAIN & SOIL REPORT'}</Text>
         <Text style={styles.notesText}>{survey.terrainNotes || (isInterior ? 'No space condition notes provided.' : 'No specific technical notes provided.')}</Text>
      </AdaptiveGlass>

      <AdaptiveGlass intensity={20} tint="light" style={styles.card}>
         <Text style={styles.cardLabel}>{t('surveyorComments', 'SURVEYOR COMMENTS')}</Text>
         <Text style={styles.notesText}>{survey.surveyorComments || 'No general comments provided.'}</Text>
      </AdaptiveGlass>

      {/* Observation Image */}
      {survey.observationImage && (
        <AdaptiveGlass intensity={20} tint="light" style={styles.card}>
          <Text style={styles.cardLabel}>{isInterior ? 'SPACE OBSERVATION PHOTO' : t('siteObservationPhoto', 'SITE OBSERVATION PHOTO')}</Text>
          <TouchableOpacity onPress={() => setSelectedImage(survey.observationImage)} activeOpacity={0.8}>
            <Image source={{ uri: survey.observationImage }} style={styles.observationImage} />
          </TouchableOpacity>
        </AdaptiveGlass>
      )}

      {/* Interior: Additional Room Photos */}
      {isInterior && survey.additionalPhotos?.length > 0 && (
        <AdaptiveGlass intensity={20} tint="light" style={styles.card}>
          <Text style={styles.cardLabel}>ADDITIONAL ROOM PHOTOS</Text>
          <View style={styles.photoGrid}>
            {survey.additionalPhotos.map((uri, idx) => (
              <TouchableOpacity key={idx} onPress={() => setSelectedImage(uri)} activeOpacity={0.8}>
                <Image source={{ uri }} style={styles.photoThumb} />
              </TouchableOpacity>
            ))}
          </View>
        </AdaptiveGlass>
      )}

      {/* Budget Request Alert */}
      {survey.affectsBudget && (
        <AdaptiveGlass intensity={40} tint="light" style={[styles.card, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
          <View style={styles.budgetAlertHeader}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <Text style={styles.budgetAlertTitle}>{t('budgetModificationRequested', 'Budget Modification Requested')}</Text>
          </View>
          <Text style={styles.budgetAlertAmt}>New Estimate: {formatCurrency(survey.recommendedBudget, project?.currency)}</Text>
          <Text style={styles.budgetAlertReason}>{survey.budgetReason}</Text>
          
          {survey.status === 'Approved' && !survey.budgetRequestSent && (
            <TouchableOpacity 
              style={[styles.approveBtn, { marginTop: 16, backgroundColor: '#DC2626', shadowColor: '#DC2626' }]} 
              onPress={openBudgetModal}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
              <Text style={styles.approveBtnText}>{t('sendBudgetChangeRequest', 'Send Budget Change Request')}</Text>
            </TouchableOpacity>
          )}
          {survey.status === 'Approved' && survey.budgetRequestSent && (
            <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7', alignSelf: 'flex-start', marginTop: 16 }]}>
              <Ionicons name="time" size={14} color="#D97706" />
              <Text style={[styles.statusBadgeText, { color: '#D97706' }]}>{t('requestSentToApprover', 'Request Sent to Approver')}</Text>
            </View>
          )}
        </AdaptiveGlass>
      )}

      {/* Action Buttons for Admins */}
      {isAdminOrManager && survey.status === 'Submitted' && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => setIsRejectModalVisible(true)}>
            <Ionicons name="close" size={18} color="#EF4444" />
            <Text style={styles.rejectBtnText}>{t('reject', 'Reject')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.approveBtn} 
            onPress={() => {
              setConfirmModal({
                visible: true,
                title: 'Approve Survey',
                message: `Are you sure you want to approve this survey report? This will allow ${isInterior ? 'interior design planning' : 'construction planning'} to proceed.`,
                confirmText: 'Approve',
                type: 'success',
                onConfirm: () => {
                  setConfirmModal(prev => ({ ...prev, visible: false }));
                  handleAction('Approve');
                }
              });
            }}
          >
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            {isProcessing ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.approveBtnText}>{t('approveReport', 'Approve Report')}</Text>}
          </TouchableOpacity>
        </View>
      )}

      <ConfirmModal 
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        isSubmitting={isProcessing}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />

      {/* Rejection Modal */}
      <Modal visible={isRejectModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.smallModal}>
            <Text style={styles.modalTitle}>{t('refuseSiteSurvey', 'Refuse Site Survey')}</Text>
            <Text style={styles.modalSub}>{t('provideActionableFeedback', 'Provide actionable feedback so the surveyor can rectify the issues.')}</Text>
            
            <TextInput
              style={styles.modalTextArea}
              placeholder={t('egMissingTerrainData', 'e.g. Missing terrain composition data...')}
              multiline
              textAlignVertical="top"
              value={rejectionReason}
              onChangeText={setRejectionReason}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsRejectModalVisible(false)} disabled={isProcessing}>
                <Text style={styles.cancelText}>{t('cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmRejectBtn} onPress={() => handleAction('Reject')} disabled={isProcessing}>
                {isProcessing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmRejectText}>{t('submitRejection', 'Submit Rejection')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Budget Approver Modal */}
      <Modal visible={isBudgetModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.smallModal}>
            <Text style={styles.modalTitle}>{t('selectBudgetApprover', 'Select Budget Approver')}</Text>
            <Text style={styles.modalSub}>{t('chooseTeamMemberBudget', 'Choose a team member with budget approval permissions to review this change.')}</Text>
            
            {isFetchingApprovers ? (
              <ActivityIndicator color="#3B82F6" style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: 200, marginBottom: 20 }}>
                {budgetApprovers.length === 0 ? (
                  <Text style={styles.emptyText}>No approvers assigned to this project.</Text>
                ) : (
                  budgetApprovers.map(a => (
                    <TouchableOpacity
                      key={a._id}
                      style={[
                        styles.approverCard,
                        selectedApprover === a._id && styles.approverCardSelected
                      ]}
                      onPress={() => setSelectedApprover(a._id)}
                    >
                      <View>
                        <Text style={[styles.approverName, selectedApprover === a._id && { color: '#2563EB' }]}>{a.name}</Text>
                        <Text style={styles.approverRole}>{a.roleName}</Text>
                      </View>
                      {selectedApprover === a._id && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsBudgetModalVisible(false)} disabled={isSendingBudgetReq}>
                <Text style={styles.cancelText}>{t('cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmRejectBtn, { backgroundColor: '#2563EB' }]} onPress={handleSendBudgetRequest} disabled={isSendingBudgetReq || !selectedApprover}>
                {isSendingBudgetReq ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmRejectText}>{t('sendRequest', 'Send Request')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Fullscreen Image Preview */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.closePreviewBtn} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close-circle" size={36} color="#FFF" />
          </TouchableOpacity>
          {selectedImage && (
            <View style={styles.previewContent}>
              <Image source={{ uri: selectedImage }} style={styles.fullImage} />
            </View>
          )}
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  tabScrollContent: { gap: 12, paddingBottom: 20 },
  centerContainer: { flex: 1, minHeight: 300, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B' },
  card: { padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'rgba(255, 255, 255, 0.85)' },
  cardLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  surveyTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 6 },
  statusBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold', textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', gap: 24 },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#94A3B8', marginBottom: 2 },
  metaValue: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#0F172A' },
  rejectionBox: { marginTop: 16, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 16, borderWidth: 1, borderColor: '#FECACA' },
  rejectionBoxTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#DC2626', marginBottom: 4, textTransform: 'uppercase' },
  rejectionBoxText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#991B1B', lineHeight: 20 },
  editSurveyBtn: { marginTop: 16, paddingVertical: 10, borderRadius: 14, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  editSurveyBtnText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#2563EB' },
  gridTwo: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'rgba(255, 255, 255, 0.85)', alignItems: 'center' },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  gridVal: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 2 },
  gridLabel: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  notesText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#334155', lineHeight: 20 },
  budgetAlertHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  budgetAlertTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#DC2626' },
  budgetAlertAmt: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#991B1B', marginBottom: 4 },
  budgetAlertReason: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#B91C1C' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  rejectBtn: { flex: 1, height: 56, borderRadius: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  rejectBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#DC2626' },
  approveBtn: { flex: 2, height: 56, borderRadius: 16, backgroundColor: '#059669', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  approveBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  smallModal: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 6 },
  modalSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', marginBottom: 20 },
  modalTextArea: { height: 120, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, fontSize: 14, fontFamily: 'Inter-Medium', color: '#0F172A' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  cancelText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  confirmRejectBtn: { flex: 2, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#DC2626' },
  confirmRejectText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  approverCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  approverCardSelected: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  approverName: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A' },
  approverRole: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' },
  observationImage: { width: '100%', height: 250, borderRadius: 16, marginTop: 10, resizeMode: 'cover' },
  detailStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 4 },
  detailItem: { alignItems: 'center', gap: 4, minWidth: 70 },
  detailVal: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  detailLabel: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  photoThumb: { width: 100, height: 100, borderRadius: 14, resizeMode: 'cover' },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewContent: { width: '95%', height: '80%', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '100%', resizeMode: 'contain', borderRadius: 20 },
  closePreviewBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
});

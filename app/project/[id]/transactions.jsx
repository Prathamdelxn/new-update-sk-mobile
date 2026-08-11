// import React, { useState, useEffect, useCallback } from 'react';
// import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
// import { Feather } from '@expo/vector-icons';
// import AdaptiveGlass from '../../components/AdaptiveGlass';
// import { useAuth } from '../../context/AuthContext';
// import { useToast } from '../../context/ToastContext';
// import { useSocket } from '../../context/SocketContext';
// import * as ImagePicker from 'expo-image-picker';
// import * as Sharing from 'expo-sharing';
// import * as FileSystem from 'expo-file-system/legacy';
// import * as Print from 'expo-print';
// import cloudinaryService from '../../services/cloudinaryService';

// export default function ProjectTransactionsTab({ project, fetchProjectData }) {
//   const { token, user } = useAuth();
//   const { showToast } = useToast();
//   const { socket } = useSocket();
//   const projectId = project?._id;

//   const [transactions, setTransactions] = useState([]);
//   const [materialPurchases, setMaterialPurchases] = useState([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [isSubmitting, setIsSubmitting] = useState(false);
  
//   const [activeFilter, setActiveFilter] = useState('All');
  
//   // Modals
//   const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);
//   const [isTxModalVisible, setIsTxModalVisible] = useState(false);
//   const [editingTxId, setEditingTxId] = useState(null);
//   const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: null });
  
//   // Form State
//   const [txType, setTxType] = useState('Incoming');
//   const [amount, setAmount] = useState('');
//   const [partyName, setPartyName] = useState('');
//   const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
//   const [referenceNumber, setReferenceNumber] = useState('');
//   const [category, setCategory] = useState('');
//   const [description, setDescription] = useState('');
//   const [selectedInvoice, setSelectedInvoice] = useState(null);
//   const [isUploading, setIsUploading] = useState(false);

//   const fetchData = useCallback(async () => {
//     try {
//       setIsLoading(true);
//       const [txRes, purchaseRes] = await Promise.all([
//         fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/transactions`, { headers: { 'Authorization': `Bearer ${token}` } }),
//         fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-purchase`, { headers: { 'Authorization': `Bearer ${token}` } })
//       ]);
//       if (txRes.ok) setTransactions(await txRes.json());
//       if (purchaseRes.ok) setMaterialPurchases(await purchaseRes.json());
//     } catch (error) {
//       console.error('Error fetching financial data:', error);
//     } finally {
//       setIsLoading(false);
//     }
//   }, [projectId, token]);

//   useEffect(() => {
//     if (projectId) fetchData();
//   }, [fetchData, projectId]);

//   useEffect(() => {
//     if (!socket) return;
//     socket.on('transactions:updated', fetchData);
//     return () => socket.off('transactions:updated', fetchData);
//   }, [socket, fetchData]);

//   const ledger = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

//   const filteredLedger = ledger.filter(item => {
//     if (activeFilter === 'All') return true;
//     if (activeFilter === 'Purchases') return item.isPurchase;
//     return item.type === activeFilter && !item.isPurchase;
//   });

//   const totals = ledger.reduce((acc, item) => {
//     if (item.isPurchase) {
//       acc.outgoing += item.amount;
//     } else if (item.type === 'Incoming' || item.type === 'Debit Note') {
//       acc.incoming += item.amount; 
//     } else if (item.type === 'Outgoing') {
//       acc.outgoing += item.amount;
//     }
//     return acc;
//   }, { incoming: 0, outgoing: 0 });

//   const netBalance = totals.incoming - totals.outgoing;

//   const handleActionSelect = (type) => {
//     setIsActionSheetVisible(false);
//     setTxType(type);
//     setEditingTxId(null);
//     setAmount('');
//     setPartyName('');
//     setPaymentMethod('Bank Transfer');
//     setReferenceNumber('');
//     setCategory('');
//     setDescription('');
//     setSelectedInvoice(null);
//     setTimeout(() => setIsTxModalVisible(true), 300);
//   };

//   const generateTransactionHTML = (txData) => {
//     const isIncoming = txData.type === 'Incoming';
//     const mainColor = isIncoming ? '#10B981' : '#EF4444';
//     const bgColor = isIncoming ? '#ECFDF5' : '#FEF2F2';
//     const title = isIncoming ? 'OFFICIAL RECEIPT' : 'PAYMENT VOUCHER';

//     return `
//       <html>
//         <head>
//           <style>
//             body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
//             .header { display: flex; justify-content: space-between; border-bottom: 3px solid ${mainColor}; padding-bottom: 20px; }
//             .title-box { text-align: right; }
//             .company-name { color: ${mainColor}; font-size: 28px; font-weight: bold; margin-bottom: 4px; }
//             .doc-type { font-size: 20px; font-weight: 800; color: #1E293B; letter-spacing: 1px; }
//             .info-section { display: flex; justify-content: space-between; margin-top: 40px; }
//             .info-block { flex: 1; }
//             .label { color: #64748B; font-size: 11px; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
//             .value { font-size: 15px; font-weight: 600; color: #0F172A; }
//             .amount-card { margin-top: 50px; background: ${bgColor}; padding: 40px; border-radius: 20px; text-align: center; border: 1px solid ${mainColor}40; }
//             .amount-label { font-size: 13px; color: #64748B; margin-bottom: 10px; font-weight: bold; }
//             .amount-value { font-size: 42px; color: #0F172A; font-weight: 900; }
//             .details-section { margin-top: 40px; padding: 20px; background: #F8FAFF; border-radius: 12px; }
//             .footer { margin-top: 80px; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 20px; color: #94A3B8; font-size: 11px; }
//             .stamp { display: inline-block; margin-top: 20px; padding: 10px 20px; border: 3px double ${mainColor}; color: ${mainColor}; font-weight: bold; border-radius: 8px; transform: rotate(-5deg); opacity: 0.8; }
//           </style>
//         </head>
//         <body>
//           <div class="header">
//             <div>
//               <div class="company-name">Sky-Lite</div>
//               <div style="font-size: 13px; color: #64748B;">Construction Management Solutions</div>
//             </div>
//             <div class="title-box">
//               <div class="doc-type">${title}</div>
//               <div style="font-size: 13px; color: #64748B; margin-top: 5px;">Date: ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
//             </div>
//           </div>

//           <div class="info-section">
//             <div class="info-block">
//               <div class="label">Project Site</div>
//               <div class="value">${project?.name || 'N/A'}</div>
//             </div>
//             <div class="info-block" style="text-align: center;">
//               <div class="label">Reference No.</div>
//               <div class="value">${txData.referenceNumber || 'N/A'}</div>
//             </div>
//             <div class="info-block" style="text-align: right;">
//               <div class="label">${isIncoming ? 'Received From' : 'Paid To'}</div>
//               <div class="value">${txData.partyName}</div>
//             </div>
//           </div>

//           <div class="amount-card">
//             <div class="amount-label">TOTAL TRANSACTION VALUE</div>
//             <div class="amount-value">$${Number(txData.amount).toLocaleString()}</div>
//             <div class="stamp">${isIncoming ? 'FUNDS RECEIVED' : 'PAYMENT RELEASED'}</div>
//           </div>

//           <div class="details-section">
//             <div class="label">Transaction Particulars</div>
//             <div style="font-size: 14px; color: #334155; line-height: 1.6; min-height: 60px;">
//               ${txData.description || 'General transaction recorded for project expenditures/receipts.'}
//             </div>
//             <div style="margin-top: 15px; display: flex; gap: 20px;">
//               <div><span class="label">Payment Mode:</span> <span class="value" style="font-size: 13px;">${txData.paymentMethod}</span></div>
//               <div><span class="label">Category:</span> <span class="value" style="font-size: 13px;">${txData.category || 'Uncategorized'}</span></div>
//             </div>
//           </div>

//           <div class="footer">
//             This document is a digitally generated ${title.toLowerCase()} from the Sky-Lite Mobile Platform.<br/>
//             © ${new Date().getFullYear()} Sky-Lite Systems. All rights reserved.
//           </div>
//         </body>
//       </html>
//     `;
//   };


//   const handleSaveTx = async () => {
//     if (!amount || isNaN(parseFloat(amount)) || !partyName.trim()) {
//       showToast('Amount and Party Name are required', 'error');
//       return;
//     }
//     try {
//       setIsSubmitting(true);
      
//       const txData = {
//         type: txType,
//         amount: parseFloat(amount),
//         partyName,
//         paymentMethod,
//         referenceNumber,
//         category,
//         description
//       };

//       // Auto-generate PDF Invoice
//       setIsUploading(true);
//       const html = generateTransactionHTML(txData);
//       const { uri } = await Print.printToFileAsync({ html });
//       const fileName = `tx_inv_${Date.now()}.pdf`;
//       const invoiceUrl = await cloudinaryService.uploadFile(uri, fileName, 'application/pdf');
//       setIsUploading(false);

//       const url = editingTxId 
//         ? `${process.env.EXPO_PUBLIC_API_BASE_URL}/transactions/${editingTxId}`
//         : `${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/transactions`;
//       const method = editingTxId ? 'PATCH' : 'POST';

//       const response = await fetch(url, {
//         method,
//         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
//         body: JSON.stringify({ 
//           ...txData,
//           invoiceUrl
//         })
//       });

//       if (response.ok) {
//         setIsTxModalVisible(false);
//         showToast(editingTxId ? 'Transaction updated' : 'Transaction saved', 'success');
//         fetchData();
//       } else {
//         const err = await response.json();
//         showToast(err.message || 'Operation failed', 'error');
//       }
//     } catch (error) {
//       showToast('Failed to save transaction', 'error');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleDeleteTx = (id) => {
//     setConfirmModal({
//       visible: true,
//       title: 'Delete Transaction',
//       message: 'Are you sure you want to permanently delete this transaction record?',
//       onConfirm: async () => {
//         try {
//           const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/transactions/${id}`, {
//             method: 'DELETE',
//             headers: { 'Authorization': `Bearer ${token}` }
//           });
//           if (response.ok) {
//             showToast('Transaction permanently deleted', 'delete');
//             fetchData();
//           } else {
//             showToast('Failed to delete transaction', 'error');
//           }
//         } catch (error) {
//           showToast(t('networkErrorDeleting'), 'error');
//         } finally {
//           setConfirmModal({ visible: false, title: '', message: '', onConfirm: null });
//         }
//       }
//     });
//   };

//   const handleDownloadInvoice = async (item) => {
//     if (!item) return;
//     try {
//       let uriToShare = '';
      
//       if (item.invoiceUrl) {
//         const filename = item.invoiceUrl.split('/').pop() || 'invoice.pdf';
//         const fileUri = FileSystem.cacheDirectory + filename;
//         const downloadRes = await FileSystem.downloadAsync(item.invoiceUrl, fileUri);
//         uriToShare = downloadRes.uri;
//       } else {
//         // Generate on-the-fly for old records
//         showToast('Generating invoice for old record...', 'info');
//         const html = generateTransactionHTML(item);
//         const { uri } = await Print.printToFileAsync({ html });
//         uriToShare = uri;
//       }
      
//       if (await Sharing.isAvailableAsync()) {
//         showToast('Invoice ready, opening options...', 'success');
//         await Sharing.shareAsync(uriToShare);
//       } else {
//         showToast('Sharing not available', 'error');
//       }
//     } catch (error) {
//       console.error('Download error:', error);
//       showToast('Failed to process invoice', 'error');
//     }
//   };

//   const getTxDetails = (item) => {
//     if (item.isPurchase) {
//       return { color: '#8B5CF6', bg: '#F3E8FF', icon: 'shopping-cart', prefix: '-' };
//     }
//     switch (item.type) {
//       case 'Incoming': return { color: '#10B981', bg: '#D1FAE5', icon: 'arrow-down-left', prefix: '+' };
//       case 'Outgoing': return { color: '#EF4444', bg: '#FEE2E2', icon: 'arrow-up-right', prefix: '-' };
//       case 'Debit Note': return { color: '#F59E0B', bg: '#FEF3C7', icon: 'alert-triangle', prefix: '+' };
//       default: return { color: '#3B82F6', bg: '#DBEAFE', icon: 'file-text', prefix: '' };
//     }
//   };

//   if (isLoading) {
//     return (
//       <View style={styles.loadingBox}>
//         <ActivityIndicator size="large" color="#3B82F6" />
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
      
//       {/* Premium Light Glass Dashboard */}
//       <AdaptiveGlass intensity={80} tint="light" style={styles.dashboardCard}>
//         <View style={styles.dashTop}>
//           <Text style={styles.dashLabel}>Available Balance</Text>
//           <Text 
//             style={[styles.dashBalance, { color: netBalance >= 0 ? '#0F172A' : '#EF4444' }]} 
//             numberOfLines={1} 
//             adjustsFontSizeToFit
//           >
//             {netBalance >= 0 ? '' : '-'}${Math.abs(netBalance).toLocaleString()}
//           </Text>
//         </View>
        
//         <View style={styles.dashDivider} />
        
//         <View style={styles.dashRow}>
//           <View style={styles.dashCol}>
//             <View style={styles.dashIconBoxIn}>
//               <Feather name="arrow-down-left" size={16} color="#10B981" />
//             </View>
//             <View style={{ flex: 1 }}>
//               <Text style={styles.dashSubLabel} numberOfLines={1}>Total Inflow</Text>
//               <Text style={styles.dashSubValue} numberOfLines={1} adjustsFontSizeToFit>${totals.incoming.toLocaleString()}</Text>
//             </View>
//           </View>
          
//           <View style={{ width: 16 }} />

//           <View style={styles.dashCol}>
//             <View style={styles.dashIconBoxOut}>
//               <Feather name="arrow-up-right" size={16} color="#EF4444" />
//             </View>
//             <View style={{ flex: 1 }}>
//               <Text style={styles.dashSubLabel} numberOfLines={1}>Total Outflow</Text>
//               <Text style={styles.dashSubValue} numberOfLines={1} adjustsFontSizeToFit>${totals.outgoing.toLocaleString()}</Text>
//             </View>
//           </View>
//         </View>
//       </AdaptiveGlass>

//       {/* Modern Filter Chips */}
//       <View style={styles.filterWrapper}>
//         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
//           {['All', 'Incoming', 'Outgoing', 'Debit Note', 'Purchases'].map(filter => (
//             <TouchableOpacity key={filter} onPress={() => setActiveFilter(filter)} style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}>
//               <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
//             </TouchableOpacity>
//           ))}
//         </ScrollView>
//       </View>

//       {/* Header Row with Action */}
//       <View style={styles.headerRow}>
//         <Text style={styles.sectionLabel}>FINANCIAL LEDGER</Text>
//         <TouchableOpacity style={styles.addBtn} onPress={() => setIsActionSheetVisible(true)}>
//           <Feather name="plus" size={16} color="#FFF" />
//           <Text style={styles.addBtnText}>Add Record</Text>
//         </TouchableOpacity>
//       </View>

//       {/* Borderless List Feed */}
//       <ScrollView showsVerticalScrollIndicator={false} style={styles.feed}>
//         {filteredLedger.length === 0 ? (
//           <View style={styles.emptyBox}>
//             <View style={styles.emptyIconBox}>
//               <Feather name="layers" size={32} color="#CBD5E1" />
//             </View>
//             <Text style={styles.emptyText}>No financial records found</Text>
//           </View>
//         ) : (
//           <View style={styles.listContainer}>
//             {filteredLedger.map((item, index) => {
//               const { color, bg, icon, prefix } = getTxDetails(item);
//               const isLast = index === filteredLedger.length - 1;
//               return (
//                 <View key={item._id} style={[styles.txRow, isLast && { borderBottomWidth: 0 }]}>
//                   <View style={[styles.txIconBox, { backgroundColor: bg }]}>
//                     <Feather name={icon} size={20} color={color} />
//                   </View>
//                   <View style={styles.txContent}>
//                     <Text style={styles.txParty} numberOfLines={1}>{item.partyName}</Text>
//                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
//                       <Text style={styles.txMeta}>{item.type} • {new Date(item.date).toLocaleDateString()}</Text>
//                     </View>
//                   </View>
//                   <View style={styles.txRight}>
//                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
//                       <TouchableOpacity onPress={() => handleDownloadInvoice(item)} style={styles.txDownloadIconBtn}>
//                         <Feather name="download-cloud" size={18} color="#3B82F6" />
//                       </TouchableOpacity>
//                       <View style={{ alignItems: 'flex-end' }}>
//                         <Text style={[styles.txAmount, { color }]} numberOfLines={1} adjustsFontSizeToFit>{prefix}${item.amount?.toLocaleString()}</Text>
//                         {!item.isPurchase && (user?.role?.name === 'Admin' || user?.role?.name === 'SuperAdmin') && (
//                           <TouchableOpacity onPress={() => handleDeleteTx(item._id)} style={styles.txDeleteBtn} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
//                             <Feather name="trash-2" size={14} color="#94A3B8" />
//                           </TouchableOpacity>
//                         )}
//                       </View>
//                     </View>
//                   </View>
//                 </View>
//               );
//             })}
//           </View>
//         )}
//         <View style={{ height: 120 }} />
//       </ScrollView>



//       {/* Modern Action Sheet */}
//       <Modal visible={isActionSheetVisible} transparent animationType="fade">
//         <View style={styles.sheetOverlay}>
//           <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setIsActionSheetVisible(false)} />
//           <View style={styles.sheetContent}>
//             <View style={styles.sheetDragHandle} />
//             <Text style={styles.sheetTitle}>Record Transaction</Text>
            
//             <TouchableOpacity style={styles.sheetBtn} onPress={() => handleActionSelect('Incoming')}>
//               <View style={[styles.sheetIconBox, { backgroundColor: '#ECFDF5' }]}>
//                 <Feather name="arrow-down-left" size={20} color="#10B981" />
//               </View>
//               <View>
//                 <Text style={styles.sheetBtnTitle}>Incoming Funds</Text>
//                 <Text style={styles.sheetBtnSub}>Money received from client or HO</Text>
//               </View>
//             </TouchableOpacity>

//             <TouchableOpacity style={styles.sheetBtn} onPress={() => handleActionSelect('Outgoing')}>
//               <View style={[styles.sheetIconBox, { backgroundColor: '#FEF2F2' }]}>
//                 <Feather name="arrow-up-right" size={20} color="#EF4444" />
//               </View>
//               <View>
//                 <Text style={styles.sheetBtnTitle}>Outgoing Payment</Text>
//                 <Text style={styles.sheetBtnSub}>Money paid to vendor or labor</Text>
//               </View>
//             </TouchableOpacity>

//             <TouchableOpacity style={[styles.sheetBtn, { borderBottomWidth: 0 }]} onPress={() => handleActionSelect('Debit Note')}>
//               <View style={[styles.sheetIconBox, { backgroundColor: '#FFFBEB' }]}>
//                 <Feather name="alert-triangle" size={20} color="#F59E0B" />
//               </View>
//               <View>
//                 <Text style={styles.sheetBtnTitle}>Debit Note</Text>
//                 <Text style={styles.sheetBtnSub}>Record penalties or deductions</Text>
//               </View>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>

//       {/* Add Transaction Modal */}
//       <Modal visible={isTxModalVisible} transparent animationType="slide">
//         <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
//           <View style={styles.modalContent}>
//             <View style={styles.modalHeader}>
//               <Text style={styles.modalTitle}>New {txType}</Text>
//               <TouchableOpacity onPress={() => setIsTxModalVisible(false)} style={styles.closeBtn}>
//                 <Feather name="x" size={20} color="#64748B" />
//               </TouchableOpacity>
//             </View>

//             <ScrollView showsVerticalScrollIndicator={false}>
//               <View style={styles.inputGroup}>
//                 <Text style={styles.label}>Amount ($)</Text>
//                 <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="0.00" />
//               </View>

//               <View style={styles.inputGroup}>
//                 <Text style={styles.label}>{txType === 'Incoming' ? 'Received From' : txType === 'Outgoing' ? 'Paid To' : 'Issued To'}</Text>
//                 <TextInput style={styles.input} value={partyName} onChangeText={setPartyName} placeholder="Name of party..." />
//               </View>

//               <View style={styles.inputGroup}>
//                 <Text style={styles.label}>Description / Remarks (Optional)</Text>
//                 <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} multiline value={description} onChangeText={setDescription} placeholder="Enter any notes..." />
//               </View>

//               <View style={styles.autoGenBanner}>
//                 <Feather name="file-text" size={20} color="#3B82F6" />
//                 <Text style={styles.autoGenText}>Digital Invoice will be auto-generated</Text>
//               </View>
//             </ScrollView>

//             <TouchableOpacity style={styles.submitBtn} onPress={handleSaveTx} disabled={isSubmitting}>
//               {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Save</Text>}
//             </TouchableOpacity>
//           </View>
//         </KeyboardAvoidingView>
//       </Modal>

//       {/* Global Confirm Modal */}
//       <Modal visible={confirmModal.visible} transparent animationType="fade">
//         <View style={styles.confirmOverlay}>
//           <View style={styles.confirmBox}>
//             <Text style={styles.confirmTitle}>{confirmModal.title}</Text>
//             <Text style={styles.confirmText}>{confirmModal.message}</Text>
//             <View style={styles.confirmActions}>
//               <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmModal({ visible: false })}>
//                 <Text style={styles.confirmCancelText}>Cancel</Text>
//               </TouchableOpacity>
//               <TouchableOpacity style={styles.confirmDeleteBtn} onPress={confirmModal.onConfirm}>
//                 <Text style={styles.confirmDeleteText}>Delete</Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//         </View>
//       </Modal>

//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1 },
//   loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
//   // Light Premium Dashboard
//   dashboardCard: { borderRadius: 24, padding: 24, marginBottom: 24, backgroundColor: 'rgba(255, 255, 255, 0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,1)', shadowColor: '#94A3B8', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
//   dashTop: { alignItems: 'center', marginBottom: 20 },
//   dashLabel: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
//   dashBalance: { fontSize: 36, fontFamily: 'Inter-Black', color: '#0F172A' },
//   dashDivider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 20 },
//   dashRow: { flexDirection: 'row', justifyContent: 'space-between' },
//   dashCol: { flexDirection: 'row', alignItems: 'center', flex: 1 },
//   dashIconBoxIn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
//   dashIconBoxOut: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
//   dashSubLabel: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B', marginBottom: 2 },
//   dashSubValue: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },

//   // Filters
//   filterWrapper: { marginBottom: 16 },
//   filterScroll: { paddingRight: 20, paddingBottom: 4 },
//   filterChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: 'transparent', marginRight: 8 },
//   filterChipActive: { backgroundColor: '#FFF', shadowColor: '#94A3B8', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
//   filterText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#64748B' },
//   filterTextActive: { color: '#0F172A', fontFamily: 'Inter-Bold' },

//   // Feed
//   feed: { flex: 1 },
//   listContainer: { backgroundColor: '#FFF', borderRadius: 24, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, shadowColor: '#94A3B8', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
//   emptyBox: { alignItems: 'center', marginTop: 60 },
//   emptyIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F8FAFF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
//   emptyText: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#94A3B8' },

//   // Borderless Transaction Row
//   txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFF' },
//   txIconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
//   txContent: { flex: 1 },
//   txParty: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 4 },
//   txMeta: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#94A3B8' },
//   txRight: { alignItems: 'flex-end', justifyContent: 'center' },
//   txAmount: { fontSize: 16, fontFamily: 'Inter-Black', marginBottom: 6 },
//   txDeleteBtn: { padding: 4 },

//   // Header Row
//   headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
//   sectionLabel: { fontSize: 12, fontFamily: 'Inter-Black', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase' },
//   addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 6 },
//   addBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFF' },

//   // Bottom Action Sheet
//   sheetOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.3)', justifyContent: 'flex-end' },
//   sheetContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
//   sheetDragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
//   sheetTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', marginBottom: 20, textAlign: 'center' },
//   sheetBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFF' },
//   sheetIconBox: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
//   sheetBtnTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 4 },
//   sheetBtnSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B' },

//   // Add Modal
//   modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
//   modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '90%' },
//   modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
//   modalTitle: { fontSize: 22, fontFamily: 'Inter-Black', color: '#0F172A' },
//   closeBtn: { width: 40, height: 40, backgroundColor: '#F8FAFF', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
//   inputGroup: { marginBottom: 24 },
//   label: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
//   input: { backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 16, paddingHorizontal: 16, height: 56, fontSize: 15, fontFamily: 'Inter-Medium', color: '#0F172A' },
//   submitBtn: { height: 56, backgroundColor: '#3B82F6', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
//   submitBtnText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFF' },

//   // Confirm Modal
//   confirmOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', alignItems: 'center' },
//   confirmBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 28, padding: 24, alignItems: 'center' },
//   confirmTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', marginBottom: 12 },
//   confirmText: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#64748B', marginBottom: 32, textAlign: 'center', lineHeight: 22 },
//   confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
//   confirmCancelBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: '#F8FAFF', justifyContent: 'center', alignItems: 'center' },
//   confirmCancelText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#64748B' },
//   confirmDeleteBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
//   confirmDeleteText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFF' },

//   txDownloadIconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DBEAFE' },
//   autoGenBanner: { backgroundColor: '#F0F7FF', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
//   autoGenText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#1E293B' },
// });
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import cloudinaryService from '../../services/cloudinaryService';
import { useTranslation } from 'react-i18next';
import { hasProjectPermission, isProjectLocked } from '../../utils/permissions';
export default function ProjectTransactionsTab({ project, fetchProjectData }) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();
  const projectId = project?._id;

  const hasPermission = useCallback((moduleId, action) => {
    if (isProjectLocked(project) && action !== 'view') return false;
    return hasProjectPermission(user, project, `${moduleId}:${action}`) || hasProjectPermission(user, project, moduleId);
  }, [user, project]);

  const [transactions, setTransactions] = useState([]);
  const [materialPurchases, setMaterialPurchases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [activeFilter, setActiveFilter] = useState('All');
  
  // Modals
  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);
  const [isTxModalVisible, setIsTxModalVisible] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: null });

  // Amounts are truncated with "..." by default (huge/garbage values shouldn't
  // break tile layout) — each amount has its own eye toggle to reveal the
  // full figure, wrapped across lines instead of forced onto one.
  const [revealedBalance, setRevealedBalance] = useState(false);
  const [revealedInflow, setRevealedInflow] = useState(false);
  const [revealedOutflow, setRevealedOutflow] = useState(false);
  const [revealedTxIds, setRevealedTxIds] = useState(() => new Set());
  const toggleTxReveal = useCallback((id) => {
    setRevealedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  
  // Form State
  const [txType, setTxType] = useState('Incoming');
  const [amount, setAmount] = useState('');
  const [partyName, setPartyName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [txRes, purchaseRes] = await Promise.all([
        fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/transactions`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/material-purchase`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (txRes.ok) setTransactions(await txRes.json());
      if (purchaseRes.ok) setMaterialPurchases(await purchaseRes.json());
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    if (projectId) fetchData();
  }, [fetchData, projectId]);

  useEffect(() => {
    if (!socket) return;
    socket.on('transactions:updated', fetchData);
    return () => socket.off('transactions:updated', fetchData);
  }, [socket, fetchData]);

  const ledger = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredLedger = ledger.filter(item => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Incoming') return item.type === 'Incoming' || item.type === 'Debit Note';
    if (activeFilter === 'Outgoing') return item.type === 'Outgoing' || item.type === 'Purchase Payment';
    return false;
  });

  const totals = ledger.reduce((acc, item) => {
    if (item.type === 'Purchase Payment') {
      acc.outgoing += item.amount;
    } else if (item.type === 'Incoming' || item.type === 'Debit Note') {
      acc.incoming += item.amount; 
    } else if (item.type === 'Outgoing') {
      acc.outgoing += item.amount;
    }
    return acc;
  }, { incoming: 0, outgoing: 0 });

  const netBalance = totals.incoming - totals.outgoing;

  const handleActionSelect = (type) => {
    setIsActionSheetVisible(false);
    setTxType(type);
    setEditingTxId(null);
    setAmount('');
    setPartyName('');
    setPaymentMethod('Bank Transfer');
    setReferenceNumber('');
    setCategory('');
    setDescription('');
    setSelectedInvoice(null);
    setTimeout(() => setIsTxModalVisible(true), 300);
  };

  const generateTransactionHTML = (txData) => {
    const isIncoming = txData.type === 'Incoming';
    const mainColor = isIncoming ? '#10B981' : '#EF4444';
    const bgColor = isIncoming ? '#ECFDF5' : '#FEF2F2';
    const title = isIncoming ? 'OFFICIAL RECEIPT' : 'PAYMENT VOUCHER';

    return `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 3px solid ${mainColor}; padding-bottom: 20px; }
            .title-box { text-align: right; }
            .company-name { color: ${mainColor}; font-size: 28px; font-weight: bold; margin-bottom: 4px; }
            .doc-type { font-size: 20px; font-weight: 800; color: #1E293B; letter-spacing: 1px; }
            .info-section { display: flex; justify-content: space-between; margin-top: 40px; }
            .info-block { flex: 1; }
            .label { color: #64748B; font-size: 11px; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
            .value { font-size: 15px; font-weight: 600; color: #0F172A; }
            .amount-card { margin-top: 50px; background: ${bgColor}; padding: 40px; border-radius: 20px; text-align: center; border: 1px solid ${mainColor}40; }
            .amount-label { font-size: 13px; color: #64748B; margin-bottom: 10px; font-weight: bold; }
            .amount-value { font-size: 42px; color: #0F172A; font-weight: 900; }
            .details-section { margin-top: 40px; padding: 20px; background: #F8FAFF; border-radius: 12px; }
            .footer { margin-top: 80px; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 20px; color: #94A3B8; font-size: 11px; }
            .stamp { display: inline-block; margin-top: 20px; padding: 10px 20px; border: 3px double ${mainColor}; color: ${mainColor}; font-weight: bold; border-radius: 8px; transform: rotate(-5deg); opacity: 0.8; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="company-name">Sky-Lite</div>
              <div style="font-size: 13px; color: #64748B;">Construction Management Solutions</div>
            </div>
            <div class="title-box">
              <div class="doc-type">${title}</div>
              <div style="font-size: 13px; color: #64748B; margin-top: 5px;">Date: ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>

          <div class="info-section">
            <div class="info-block">
              <div class="label">Project Site</div>
              <div class="value">${project?.name || 'N/A'}</div>
            </div>
            <div class="info-block" style="text-align: center;">
              <div class="label">Reference No.</div>
              <div class="value">${txData.referenceNumber || 'N/A'}</div>
            </div>
            <div class="info-block" style="text-align: right;">
              <div class="label">${isIncoming ? 'Received From' : 'Paid To'}</div>
              <div class="value">${txData.partyName}</div>
            </div>
          </div>

          <div class="amount-card">
            <div class="amount-label">TOTAL TRANSACTION VALUE</div>
            <div class="amount-value">${project?.currency || '$'} ${Number(txData.amount).toLocaleString('en-US')}</div>
            <div class="stamp">${isIncoming ? 'FUNDS RECEIVED' : 'PAYMENT RELEASED'}</div>
          </div>

          <div class="details-section">
            <div class="label">Transaction Particulars</div>
            <div style="font-size: 14px; color: #334155; line-height: 1.6; min-height: 60px;">
              ${txData.description || 'General transaction recorded for project expenditures/receipts.'}
            </div>
            <div style="margin-top: 15px; display: flex; gap: 20px;">
              <div><span class="label">Payment Mode:</span> <span class="value" style="font-size: 13px;">${txData.paymentMethod}</span></div>
              <div><span class="label">Category:</span> <span class="value" style="font-size: 13px;">${txData.category || 'Uncategorized'}</span></div>
            </div>
          </div>

          <div class="footer">
            This document is a digitally generated ${title.toLowerCase()} from the Sky-Lite Mobile Platform.<br/>
            © ${new Date().getFullYear()} Sky-Lite Systems. All rights reserved.
          </div>
        </body>
      </html>
    `;
  };


  const handleSaveTx = async () => {
    if (!amount || isNaN(parseFloat(amount)) || !partyName.trim()) {
      showToast('Amount and Party Name are required', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      
      const txData = {
        type: txType,
        amount: parseFloat(amount),
        partyName,
        paymentMethod,
        referenceNumber,
        category,
        description
      };

      // Auto-generate PDF Invoice
      setIsUploading(true);
      const html = generateTransactionHTML(txData);
      const { uri } = await Print.printToFileAsync({ html });
      const fileName = `tx_inv_${Date.now()}.pdf`;
      const invoiceUrl = await cloudinaryService.uploadFile(uri, fileName, 'application/pdf');
      setIsUploading(false);

      const url = editingTxId 
        ? `${process.env.EXPO_PUBLIC_API_BASE_URL}/transactions/${editingTxId}`
        : `${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/transactions`;
      const method = editingTxId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          ...txData,
          invoiceUrl
        })
      });

      if (response.ok) {
        setIsTxModalVisible(false);
        showToast(editingTxId ? 'Transaction updated' : 'Transaction saved', 'success');
        fetchData();
      } else {
        const err = await response.json();
        showToast(err.message || 'Operation failed', 'error');
      }
    } catch (error) {
      showToast('Failed to save transaction', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTx = (id) => {
    setConfirmModal({
      visible: true,
      title: 'Delete Transaction',
      message: 'Are you sure you want to permanently delete this transaction record?',
      onConfirm: async () => {
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/transactions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            showToast('Transaction permanently deleted', 'delete');
            fetchData();
          } else {
            showToast('Failed to delete transaction', 'error');
          }
        } catch (error) {
          showToast(t('networkErrorDeleting'), 'error');
        } finally {
          setConfirmModal({ visible: false, title: '', message: '', onConfirm: null });
        }
      }
    });
  };

  const handleDownloadInvoice = async (item) => {
    if (!item) return;
    try {
      let uriToShare = '';
      
      if (item.invoiceUrl) {
        const filename = item.invoiceUrl.split('/').pop() || 'invoice.pdf';
        const fileUri = FileSystem.cacheDirectory + filename;
        const downloadRes = await FileSystem.downloadAsync(item.invoiceUrl, fileUri);
        uriToShare = downloadRes.uri;
      } else {
        // Generate on-the-fly for old records
        showToast('Generating invoice for old record...', 'info');
        const html = generateTransactionHTML(item);
        const { uri } = await Print.printToFileAsync({ html });
        uriToShare = uri;
      }
      
      if (await Sharing.isAvailableAsync()) {
        showToast('Invoice ready, opening options...', 'success');
        await Sharing.shareAsync(uriToShare);
      } else {
        showToast('Sharing not available', 'error');
      }
    } catch (error) {
      console.error('Download error:', error);
      showToast('Failed to process invoice', 'error');
    }
  };

  const getTxDetails = (item) => {
    if (item.type === 'Purchase Payment') {
      return { color: '#8B5CF6', bg: '#F3E8FF', icon: 'shopping-cart', prefix: '-' };
    }
    switch (item.type) {
      case 'Incoming': return { color: '#10B981', bg: '#D1FAE5', icon: 'arrow-down-left', prefix: '+' };
      case 'Outgoing': return { color: '#EF4444', bg: '#FEE2E2', icon: 'arrow-up-right', prefix: '-' };
      case 'Debit Note': return { color: '#F59E0B', bg: '#FEF3C7', icon: 'alert-triangle', prefix: '+' };
      default: return { color: '#3B82F6', bg: '#DBEAFE', icon: 'file-text', prefix: '' };
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!hasPermission('transactions', 'view')) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24, flex: 1 }]}>
        <Feather name="lock" size={48} color="#CBD5E1" />
        <Text style={{ marginTop: 16, fontSize: 16, fontFamily: 'Inter-Medium', color: '#64748B', textAlign: 'center' }}>
          You do not have permission to view transactions.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* Premium Dark Dashboard Card */}
      <View style={styles.dashboardCard}>
        <View style={styles.dashTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.dashLabel}>Available Balance</Text>
            <TouchableOpacity onPress={() => setRevealedBalance(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name={revealedBalance ? 'eye-off' : 'eye'} size={13} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          <Text
            style={[styles.dashBalance, { color: netBalance >= 0 ? '#FFFFFF' : '#EF4444', textAlign: 'center' }]}
            numberOfLines={revealedBalance ? undefined : 1}
            ellipsizeMode="tail"
          >
            {netBalance >= 0 ? '' : '-'}{project?.currency || '$'} {Number(Math.abs(netBalance)).toLocaleString('en-US')}
          </Text>
        </View>

        <View style={styles.dashDivider} />

        <View style={styles.dashRow}>
          <View style={styles.dashCol}>
            <View style={styles.dashIconBoxIn}>
              <Feather name="arrow-down-left" size={20} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={styles.dashSubLabel} numberOfLines={1}>Total Inflow</Text>
                <TouchableOpacity onPress={() => setRevealedInflow(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={revealedInflow ? 'eye-off' : 'eye'} size={11} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              <Text style={styles.dashSubValue} numberOfLines={revealedInflow ? undefined : 1} ellipsizeMode="tail">{project?.currency || '$'} {Number(totals.incoming).toLocaleString('en-US')}</Text>
            </View>
          </View>

          <View style={styles.dashCol}>
            <View style={styles.dashIconBoxOut}>
              <Feather name="arrow-up-right" size={20} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={styles.dashSubLabel} numberOfLines={1}>Total Outflow</Text>
                <TouchableOpacity onPress={() => setRevealedOutflow(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={revealedOutflow ? 'eye-off' : 'eye'} size={11} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              <Text style={styles.dashSubValue} numberOfLines={revealedOutflow ? undefined : 1} ellipsizeMode="tail">{project?.currency || '$'} {Number(totals.outgoing).toLocaleString('en-US')}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Modern Filter Chips */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['All', 'Incoming', 'Outgoing'].map(filter => (
            <TouchableOpacity key={filter} onPress={() => setActiveFilter(filter)} style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}>
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Header Row with Action */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>FINANCIAL LEDGER</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => {
          if (!hasPermission('transactions', 'create')) {
            showToast("You don't have permission to add transaction records.", "error");
            return;
          }
          setIsActionSheetVisible(true);
        }}>
          <Feather name="plus" size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Add Record</Text>
        </TouchableOpacity>
      </View>

      {/* Borderless List Feed */}
      <ScrollView showsVerticalScrollIndicator={false} style={styles.feed}>
        {filteredLedger.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconBox}>
              <Feather name="layers" size={32} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyText}>No financial records found</Text>
          </View>
        ) : (
          <View style={styles.txGrid}>
            {filteredLedger.map((item, index) => {
              const { color, bg, icon, prefix } = getTxDetails(item);
              return (
                <View key={item._id} style={styles.txRow}>
                  <View style={[styles.txIconBox, { backgroundColor: bg }]}>
                    <Feather name={icon} size={20} color={color} />
                  </View>
                  <View style={styles.txContent}>
                    <Text style={styles.txParty} numberOfLines={1}>{item.partyName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.txMeta}>{item.type} • {new Date(item.date).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <View style={styles.txRight}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                      <TouchableOpacity onPress={() => toggleTxReveal(item._id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name={revealedTxIds.has(item._id) ? 'eye-off' : 'eye'} size={12} color="#94A3B8" />
                      </TouchableOpacity>
                      <Text
                        style={[styles.txAmount, { color, marginBottom: 0, flexShrink: 1 }]}
                        numberOfLines={revealedTxIds.has(item._id) ? undefined : 1}
                        ellipsizeMode="tail"
                      >
                        {prefix}{project?.currency || '$'} {Number(item.amount).toLocaleString('en-US')}
                      </Text>
                    </View>
                    <View style={styles.txActionRow}>
                      <TouchableOpacity onPress={() => handleDownloadInvoice(item)} style={styles.actionIconBtn}>
                        <Feather name="download-cloud" size={14} color="#3B82F6" />
                      </TouchableOpacity>
                      
                      {item.linkedPurchase ? (
                        <View style={styles.actionIconBtn}>
                          <Feather name="lock" size={14} color="#CBD5E1" />
                        </View>
                      ) : (
                        <>
                          {!item.isPurchase && hasPermission('transactions', 'update') && (
                            <TouchableOpacity
                              onPress={() => {
                                setEditingTxId(item._id);
                                setTxType(item.type);
                                setAmount(item.amount.toString());
                                setPartyName(item.partyName || '');
                                setPaymentMethod(item.paymentMethod || 'Bank Transfer');
                                setReferenceNumber(item.referenceNumber || '');
                                setCategory(item.category || '');
                                setDescription(item.description || '');
                                setIsTxModalVisible(true);
                              }}
                              style={styles.actionIconBtn}
                            >
                              <Feather name="edit-2" size={14} color="#64748B" />
                            </TouchableOpacity>
                          )}

                          {!item.isPurchase && hasPermission('transactions', 'delete') && (
                            <TouchableOpacity onPress={() => handleDeleteTx(item._id)} style={styles.actionIconBtn}>
                              <Feather name="trash-2" size={14} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>



      {/* Modern Action Sheet */}
      <Modal visible={isActionSheetVisible} transparent animationType="fade">
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setIsActionSheetVisible(false)} />
          <View style={styles.sheetContent}>
            <View style={styles.sheetDragHandle} />
            <Text style={styles.sheetTitle}>Record Transaction</Text>
            
            <TouchableOpacity style={styles.sheetBtn} onPress={() => handleActionSelect('Incoming')}>
              <View style={[styles.sheetIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="arrow-down-left" size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.sheetBtnTitle}>Incoming Funds</Text>
                <Text style={styles.sheetBtnSub}>Money received from client or HO</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetBtn} onPress={() => handleActionSelect('Outgoing')}>
              <View style={[styles.sheetIconBox, { backgroundColor: '#FEF2F2' }]}>
                <Feather name="arrow-up-right" size={20} color="#EF4444" />
              </View>
              <View>
                <Text style={styles.sheetBtnTitle}>Outgoing Payment</Text>
                <Text style={styles.sheetBtnSub}>Money paid to vendor or labor</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sheetBtn, { borderBottomWidth: 0 }]} onPress={() => handleActionSelect('Debit Note')}>
              <View style={[styles.sheetIconBox, { backgroundColor: '#FFFBEB' }]}>
                <Feather name="alert-triangle" size={20} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.sheetBtnTitle}>Debit Note</Text>
                <Text style={styles.sheetBtnSub}>Record penalties or deductions</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Transaction Modal */}
      <Modal visible={isTxModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New {txType}</Text>
              <TouchableOpacity onPress={() => setIsTxModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Amount ($)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={(val) => setAmount(val.replace(/[^0-9.]/g, ''))} placeholder="0.00" />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{txType === 'Incoming' ? 'Received From' : txType === 'Outgoing' ? 'Paid To' : 'Issued To'}</Text>
                <TextInput style={styles.input} value={partyName} onChangeText={setPartyName} placeholder="Name of party..." />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description / Remarks (Optional)</Text>
                <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} multiline value={description} onChangeText={setDescription} placeholder="Enter any notes..." />
              </View>

              <View style={styles.autoGenBanner}>
                <Feather name="file-text" size={20} color="#3B82F6" />
                <Text style={styles.autoGenText}>Digital Invoice will be auto-generated</Text>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSaveTx} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Global Confirm Modal */}
      <Modal visible={confirmModal.visible} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>{confirmModal.title}</Text>
            <Text style={styles.confirmText}>{confirmModal.message}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmModal({ visible: false })}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDeleteBtn} onPress={confirmModal.onConfirm}>
                <Text style={styles.confirmDeleteText}>Delete</Text>
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
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Light Premium Dashboard
  dashboardCard: { borderRadius: 24, padding: 24, marginBottom: 20, backgroundColor: '#0F172A', shadowColor: '#0F172A', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  dashTop: { alignItems: 'center', marginBottom: 20 },
  dashLabel: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  dashBalance: { fontSize: 30, fontFamily: 'Inter-Black', color: '#FFFFFF' },
  dashDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
  dashRow: { flexDirection: 'column', gap: 14 },
  dashCol: { flexDirection: 'row', alignItems: 'center' },
  dashIconBoxIn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(16, 185, 129, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  dashIconBoxOut: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  dashSubLabel: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#94A3B8', marginBottom: 4 },
  dashSubValue: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  // Filters
  filterWrapper: { marginBottom: 20, maxHeight: 40 },
  filterScroll: { paddingRight: 20 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  filterText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#64748B' },
  filterTextActive: { color: '#FFF' },

  // Feed
  feed: { flex: 1 },
  txGrid: { paddingBottom: 20 },
  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F8FAFF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyText: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#94A3B8' },

  // Bento Transaction Row
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  txIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txContent: { flex: 1 },
  txParty: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#0F172A', marginBottom: 2 },
  txMeta: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' },
  txRight: { alignItems: 'flex-end', justifyContent: 'center', maxWidth: '55%' },
  txAmount: { fontSize: 14, fontFamily: 'Inter-Bold', marginBottom: 6, textAlign: 'right' },
  txActionRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionIconBtn: { width: 28, height: 28, backgroundColor: '#F8FAFF', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },

  // Header Row
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  sectionLabel: { fontSize: 12, fontFamily: 'Inter-Black', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 6 },
  addBtnText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFF' },

  // Bottom Action Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.3)', justifyContent: 'flex-end' },
  sheetContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  sheetDragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', marginBottom: 20, textAlign: 'center' },
  sheetBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFF' },
  sheetIconBox: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  sheetBtnTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 4 },
  sheetBtnSub: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B' },

  // Add Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  modalTitle: { fontSize: 22, fontFamily: 'Inter-Black', color: '#0F172A' },
  closeBtn: { width: 40, height: 40, backgroundColor: '#F8FAFF', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 16, paddingHorizontal: 16, height: 56, fontSize: 15, fontFamily: 'Inter-Medium', color: '#0F172A' },
  submitBtn: { height: 56, backgroundColor: '#3B82F6', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  submitBtnText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFF' },

  // Confirm Modal
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 28, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 20, fontFamily: 'Inter-Black', color: '#0F172A', marginBottom: 12 },
  confirmText: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#64748B', marginBottom: 32, textAlign: 'center', lineHeight: 22 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancelBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: '#F8FAFF', justifyContent: 'center', alignItems: 'center' },
  confirmCancelText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#64748B' },
  confirmDeleteBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  confirmDeleteText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFF' },

  autoGenBanner: { backgroundColor: '#F0F7FF', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
  autoGenText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#1E293B' },
});
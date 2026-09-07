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
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const WEATHER_OPTIONS = [
  { label: 'Sunny', icon: 'sunny-outline', color: '#D97706', bg: '#FEF3C7' },
  { label: 'Cloudy', icon: 'cloud-outline', color: '#475569', bg: '#F1F5F9' },
  { label: 'Rainy', icon: 'rainy-outline', color: '#2563EB', bg: '#EFF6FF' },
  { label: 'Heavy Wind', icon: 'flag-outline', color: '#7C3AED', bg: '#F5F3FF' },
];

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function InteriorDprScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [project, setProject] = useState(null);
  const [dprs, setDprs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState('labour'); // 'labour' | 'receipts' | 'tomorrow' | 'requirements'

  const [dprDate, setDprDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState('Sunny');
  const [siteInstructions, setSiteInstructions] = useState('');

  // 1. Labour Reports
  const [labourReports, setLabourReports] = useState([
    { agencyActivity: 'Carpentry - Wardrobe Framing', skilled: '3', unskilled: '1', currentWork: 'Living room TV unit framing & carcass', statusAsPerBarChart: '80%' },
    { agencyActivity: 'Electrical - Conduit Piping', skilled: '2', unskilled: '1', currentWork: 'Master bedroom wall chasing & pipe pull', statusAsPerBarChart: 'On Track' },
  ]);

  // 2. Material Receipts (Inward Deliveries)
  const [materialReceipts, setMaterialReceipts] = useState([
    { supplierName: 'Sri Balaji Plywoods', challanNo: 'DC-9042', receiptNo: 'MR-108', materialDetails: '18mm Century Marine Ply (710 grade)', uom: 'Sheets', qty: '25' },
  ]);

  // 3. Tomorrow's Planning
  const [tomorrowPlanning, setTomorrowPlanning] = useState([
    { agencyActivity: 'Carpentry - Lamination Work', skilled: '2', unskilled: '1', targetedWorks: 'Start laminate pressing for wardrobe shutters', remarkConcern: 'Require adhesive delivery by 10 AM' },
  ]);

  // 4. Material Requirements (Requisitions)
  const [materialRequirements, setMaterialRequirements] = useState([
    { materialDescription: 'Fevicol Marine Adhesive (50kg)', uom: 'Can', qty: '2' },
  ]);

  // View / Inspection Modal
  const [viewingDpr, setViewingDpr] = useState(null);
  const [viewTab, setViewTab] = useState('labour');

  // PDF Export loading
  const [generatingPdfId, setGeneratingPdfId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, dprRes] = await Promise.allSettled([
        interiorApiClient.get(`/projects/${projectId}`),
        interiorApiClient.get(`/projects/${projectId}/dpr`),
      ]);
      setProject(projRes.status === 'fulfilled' && projRes.value?.success ? projRes.value.data : null);
      setDprs(dprRes.status === 'fulfilled' && dprRes.value?.success ? dprRes.value.data || [] : []);
    } catch (e) {
      console.error('Failed to load DPRs', e);
      showToast('Failed to fetch DPR history', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Row Helpers
  const addLabourRow = () => {
    setLabourReports((prev) => [
      ...prev,
      { agencyActivity: '', skilled: '1', unskilled: '0', currentWork: '', statusAsPerBarChart: 'In Progress' },
    ]);
  };
  const removeLabourRow = (idx) => setLabourReports((prev) => prev.filter((_, i) => i !== idx));
  const updateLabourRow = (idx, field, val) =>
    setLabourReports((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  const addReceiptRow = () => {
    setMaterialReceipts((prev) => [
      ...prev,
      { supplierName: '', challanNo: '', receiptNo: '', materialDetails: '', uom: 'Nos', qty: '1' },
    ]);
  };
  const removeReceiptRow = (idx) => setMaterialReceipts((prev) => prev.filter((_, i) => i !== idx));
  const updateReceiptRow = (idx, field, val) =>
    setMaterialReceipts((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  const addTomorrowRow = () => {
    setTomorrowPlanning((prev) => [
      ...prev,
      { agencyActivity: '', skilled: '1', unskilled: '0', targetedWorks: '', remarkConcern: '' },
    ]);
  };
  const removeTomorrowRow = (idx) => setTomorrowPlanning((prev) => prev.filter((_, i) => i !== idx));
  const updateTomorrowRow = (idx, field, val) =>
    setTomorrowPlanning((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  const addRequirementRow = () => {
    setMaterialRequirements((prev) => [
      ...prev,
      { materialDescription: '', uom: 'Nos', qty: '1' },
    ]);
  };
  const removeRequirementRow = (idx) => setMaterialRequirements((prev) => prev.filter((_, i) => i !== idx));
  const updateRequirementRow = (idx, field, val) =>
    setMaterialRequirements((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  const resetForm = () => {
    setDprDate(new Date().toISOString().split('T')[0]);
    setWeather('Sunny');
    setSiteInstructions('');
    setLabourReports([
      { agencyActivity: '', skilled: '1', unskilled: '0', currentWork: '', statusAsPerBarChart: 'On Track' },
    ]);
    setMaterialReceipts([]);
    setTomorrowPlanning([]);
    setMaterialRequirements([]);
    setActiveFormTab('labour');
  };

  const handleSubmitDpr = async () => {
    if (!dprDate.trim()) {
      showToast('Please specify report date', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const validLabour = labourReports
        .filter((l) => l.agencyActivity?.trim() || l.currentWork?.trim())
        .map((l) => ({
          ...l,
          agencyActivity: l.agencyActivity?.trim() || 'General Work',
          currentWork: l.currentWork?.trim() || 'Daily progress',
          skilled: Math.max(0, parseInt(l.skilled, 10) || 0),
          unskilled: Math.max(0, parseInt(l.unskilled, 10) || 0),
        }));

      const validReceipts = materialReceipts
        .filter((m) => m.supplierName?.trim() || m.materialDetails?.trim())
        .map((m) => ({
          ...m,
          qty: Math.max(0, parseFloat(m.qty) || 0),
        }));

      const validTomorrow = tomorrowPlanning
        .filter((t) => t.agencyActivity?.trim() || t.targetedWorks?.trim())
        .map((t) => ({
          ...t,
          skilled: Math.max(0, parseInt(t.skilled, 10) || 0),
          unskilled: Math.max(0, parseInt(t.unskilled, 10) || 0),
        }));

      const validReqs = materialRequirements
        .filter((r) => r.materialDescription?.trim())
        .map((r) => ({
          ...r,
          qty: Math.max(0, parseFloat(r.qty) || 0),
        }));

      const payload = {
        date: dprDate,
        weather,
        siteInstructions: siteInstructions.trim(),
        labourReports: validLabour,
        materialReceipts: validReceipts,
        tomorrowPlanning: validTomorrow,
        materialRequirements: validReqs,
        // Fallback fields for legacy compatibility
        manpower: validLabour.map((l) => ({
          trade: l.agencyActivity,
          count: (parseInt(l.skilled, 10) || 0) + (parseInt(l.unskilled, 10) || 0),
          contractor: l.agencyActivity,
        })),
        activities: validLabour.map((l) => ({
          category: l.agencyActivity,
          description: l.currentWork,
          plannedProgress: 100,
          actualProgress: Math.min(100, Math.max(0, parseInt(l.statusAsPerBarChart, 10) || 50)),
          remarks: l.statusAsPerBarChart || '',
        })),
      };

      await interiorApiClient.post(`/projects/${projectId}/dpr`, payload);
      showToast('Daily Progress Report submitted successfully!', 'success');
      setIsFormOpen(false);
      resetForm();
      loadData();
    } catch (e) {
      showToast(e.message || 'Failed to submit DPR', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // PDF Export Generator via expo-print
  // ---------------------------------------------------------------------------
  const handleExportPdf = async (dprItem) => {
    setGeneratingPdfId(dprItem._id);
    try {
      const projName = project?.name || 'Interior Fitout Project';
      const clientName = project?.client || 'Client';
      const dateFormatted = formatDate(dprItem.date);

      const labourRows = dprItem.labourReports || [];
      const receiptRows = dprItem.materialReceipts || [];
      const tomorrowRows = dprItem.tomorrowPlanning || [];
      const reqRows = dprItem.materialRequirements || [];

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 25px; color: #0F172A; font-size: 11px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563EB; padding-bottom: 12px; margin-bottom: 16px; }
            .logo { font-size: 18px; font-weight: bold; color: #2563EB; }
            .sub { font-size: 10px; color: #64748B; margin-top: 2px; }
            .meta-grid { display: flex; justify-content: space-between; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px; margin-bottom: 16px; }
            .meta-item { display: flex; flex-direction: column; }
            .meta-label { font-size: 9px; font-weight: bold; color: #94A3B8; text-transform: uppercase; }
            .meta-val { font-size: 11px; font-weight: bold; color: #0F172A; margin-top: 2px; }
            .section-title { font-size: 12px; font-weight: bold; color: #1E293B; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; margin-top: 14px; margin-bottom: 8px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            th { background: #F1F5F9; color: #475569; font-weight: bold; text-align: left; padding: 6px 8px; border: 1px solid #CBD5E1; font-size: 10px; }
            td { padding: 6px 8px; border: 1px solid #CBD5E1; font-size: 10px; }
            .footer { margin-top: 30px; display: flex; justify-content: space-between; padding-top: 14px; border-top: 1px dashed #CBD5E1; }
            .sig-box { text-align: center; width: 180px; }
            .sig-line { border-top: 1px solid #0F172A; margin-top: 35px; padding-top: 4px; font-weight: bold; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">SKY INTERIOR & ARCHITECTURE</div>
              <div class="sub">Official Daily Progress Report (DPR)</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; font-size: 12px;">${dateFormatted}</div>
              <div class="sub">Weather: <b>${dprItem.weather || 'Normal'}</b></div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">Project Name</span><span class="meta-val">${projName}</span></div>
            <div class="meta-item"><span class="meta-label">Client</span><span class="meta-val">${clientName}</span></div>
            <div class="meta-item"><span class="meta-label">Report Date</span><span class="meta-val">${dateFormatted}</span></div>
          </div>

          <div class="section-title">1. Labour Deployment & Ongoing Work Status</div>
          <table>
            <thead>
              <tr>
                <th style="width: 25%;">Agency / Trade</th>
                <th style="width: 8%; text-align: center;">Skilled</th>
                <th style="width: 8%; text-align: center;">Unskilled</th>
                <th style="width: 44%;">Current Work Executed</th>
                <th style="width: 15%;">Status / Bar Chart</th>
              </tr>
            </thead>
            <tbody>
              ${labourRows.length > 0 ? labourRows.map((l) => `
                <tr>
                  <td><b>${l.agencyActivity || '-'}</b></td>
                  <td style="text-align: center;">${l.skilled || 0}</td>
                  <td style="text-align: center;">${l.unskilled || 0}</td>
                  <td>${l.currentWork || '-'}</td>
                  <td>${l.statusAsPerBarChart || '-'}</td>
                </tr>
              `).join('') : '<tr><td colspan="5" style="text-align:center;color:#94A3B8;">No labour deployed</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">2. Material Receipts (Inward Challans)</div>
          <table>
            <thead>
              <tr>
                <th style="width: 28%;">Supplier Name</th>
                <th style="width: 16%;">Challan No</th>
                <th style="width: 16%;">Receipt No</th>
                <th style="width: 28%;">Material Description</th>
                <th style="width: 12%; text-align: center;">Qty (UOM)</th>
              </tr>
            </thead>
            <tbody>
              ${receiptRows.length > 0 ? receiptRows.map((r) => `
                <tr>
                  <td>${r.supplierName || '-'}</td>
                  <td>${r.challanNo || '-'}</td>
                  <td>${r.receiptNo || '-'}</td>
                  <td>${r.materialDetails || '-'}</td>
                  <td style="text-align: center;">${r.qty || 0} ${r.uom || ''}</td>
                </tr>
              `).join('') : '<tr><td colspan="5" style="text-align:center;color:#94A3B8;">No inward deliveries recorded</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">3. Tomorrow's Planning</div>
          <table>
            <thead>
              <tr>
                <th style="width: 25%;">Agency Activity</th>
                <th style="width: 12%; text-align: center;">Headcount</th>
                <th style="width: 40%;">Targeted Works</th>
                <th style="width: 23%;">Concerns / Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${tomorrowRows.length > 0 ? tomorrowRows.map((t) => `
                <tr>
                  <td>${t.agencyActivity || '-'}</td>
                  <td style="text-align: center;">${(parseInt(t.skilled) || 0) + (parseInt(t.unskilled) || 0)}</td>
                  <td>${t.targetedWorks || '-'}</td>
                  <td>${t.remarkConcern || '-'}</td>
                </tr>
              `).join('') : '<tr><td colspan="4" style="text-align:center;color:#94A3B8;">No plan recorded</td></tr>'}
            </tbody>
          </table>

          ${dprItem.siteInstructions ? `
            <div class="section-title">4. Site Instructions & MOMs</div>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px; border-radius: 6px; font-size: 10.5px;">
              ${dprItem.siteInstructions}
            </div>
          ` : ''}

          <div class="footer">
            <div class="sig-box"><div class="sig-line">Prepared By (Site Engineer)</div></div>
            <div class="sig-box"><div class="sig-line">Verified By (Project Manager)</div></div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        showToast('PDF generated at ' + uri, 'success');
      }
    } catch (e) {
      console.error('PDF export failed:', e);
      showToast('Failed to export DPR PDF: ' + e.message, 'error');
    } finally {
      setGeneratingPdfId(null);
    }
  };

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
            <Text style={s.headerTitle}>Daily Progress Reports</Text>
            <Text style={s.headerSub}>Labour headcount, materials inward & site logs</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {dprs.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="document-text-outline" size={44} color="#CBD5E1" />
                <Text style={s.emptyTitle}>No Daily Reports Submitted</Text>
                <Text style={s.emptySub}>
                  Log site progress, manpower, inward materials and site instructions using the button below.
                </Text>
              </View>
            ) : (
              dprs.map((item) => {
                const weatherMeta = WEATHER_OPTIONS.find((w) => w.label === item.weather) || WEATHER_OPTIONS[0];
                const labourCount = (item.labourReports || []).reduce(
                  (sum, l) => sum + (parseInt(l.skilled, 10) || 0) + (parseInt(l.unskilled, 10) || 0),
                  0
                );
                const receiptsCount = (item.materialReceipts || []).length;
                const isExporting = generatingPdfId === item._id;

                return (
                  <View key={item._id} style={s.dprCard}>
                    {/* Top Row: Date, Weather badge, Actions */}
                    <View style={s.dprCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.dprDate}>{formatDate(item.date)}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <View style={[s.weatherBadge, { backgroundColor: weatherMeta.bg }]}>
                            <Ionicons name={weatherMeta.icon} size={11} color={weatherMeta.color} />
                            <Text style={[s.weatherBadgeText, { color: weatherMeta.color }]}>{item.weather || 'Sunny'}</Text>
                          </View>
                          <Text style={s.dprSubDate}>ID: {item._id?.slice(-6)?.toUpperCase()}</Text>
                        </View>
                      </View>

                      {/* PDF Export Button */}
                      <TouchableOpacity
                        style={s.pdfExportBtn}
                        onPress={() => handleExportPdf(item)}
                        disabled={isExporting}
                      >
                        {isExporting ? (
                          <ActivityIndicator size="small" color="#2563EB" />
                        ) : (
                          <>
                            <Ionicons name="document-outline" size={13} color="#2563EB" />
                            <Text style={s.pdfExportBtnText}>PDF</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Stats Metrics Grid */}
                    <View style={s.dprMetricsRow}>
                      <View style={s.dprMetricTile}>
                        <Ionicons name="people-outline" size={13} color="#2563EB" />
                        <Text style={s.dprMetricVal}>{labourCount || (item.manpower || []).reduce((s, m) => s + (m.count || 0), 0)}</Text>
                        <Text style={s.dprMetricLbl}>Manpower</Text>
                      </View>

                      <View style={s.dprMetricTile}>
                        <Ionicons name="cube-outline" size={13} color="#059669" />
                        <Text style={[s.dprMetricVal, { color: '#059669' }]}>{receiptsCount}</Text>
                        <Text style={s.dprMetricLbl}>Deliveries</Text>
                      </View>

                      <View style={s.dprMetricTile}>
                        <Ionicons name="calendar-outline" size={13} color="#7C3AED" />
                        <Text style={[s.dprMetricVal, { color: '#7C3AED' }]}>{(item.tomorrowPlanning || []).length}</Text>
                        <Text style={s.dprMetricLbl}>Tomorrow Tasks</Text>
                      </View>
                    </View>

                    {/* Card Actions */}
                    <View style={s.dprCardFooter}>
                      <TouchableOpacity
                        style={s.viewDetailsBtn}
                        onPress={() => {
                          setViewingDpr(item);
                          setViewTab('labour');
                        }}
                      >
                        <Text style={s.viewDetailsBtnText}>Inspect Full 4-Tab Breakdown</Text>
                        <Ionicons name="chevron-forward" size={14} color="#2563EB" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={s.deleteDprBtn}
                        onPress={() => handleDeleteDpr(item._id, item.date)}
                      >
                        <Ionicons name="trash-outline" size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
            <View style={{ height: 90 }} />
          </ScrollView>
        )}

        {/* --- FLOATING LOG DPR BUTTON --- */}
        <TouchableOpacity style={s.fab} onPress={() => setIsFormOpen(true)}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* ========================================================================= */}
      {/* MODAL: 4-Tab DPR Creator */}
      {/* ========================================================================= */}
      <Modal visible={isFormOpen} animationType="slide" transparent onRequestClose={() => setIsFormOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            {/* Modal Header */}
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Create Daily Progress Report</Text>
                <Text style={s.modalSubtitle}>4-Tab site operational log & handover record</Text>
              </View>
              <TouchableOpacity onPress={() => setIsFormOpen(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Date & Weather Row */}
            <View style={s.topInputRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>Report Date</Text>
                <TextInput
                  style={s.textInput}
                  value={dprDate}
                  onChangeText={setDprDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>Weather Condition</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                  {WEATHER_OPTIONS.map((w) => (
                    <TouchableOpacity
                      key={w.label}
                      style={[s.weatherChip, weather === w.label && s.weatherChipActive]}
                      onPress={() => setWeather(w.label)}
                    >
                      <Ionicons name={w.icon} size={11} color={weather === w.label ? '#FFFFFF' : '#64748B'} />
                      <Text style={[s.weatherChipText, weather === w.label && s.weatherChipTextActive]}>
                        {w.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Form Subtabs */}
            <View style={s.formTabRow}>
              {[
                { id: 'labour', label: '1. Labour', icon: 'people-outline' },
                { id: 'receipts', label: '2. Inward', icon: 'cube-outline' },
                { id: 'tomorrow', label: '3. Tomorrow', icon: 'calendar-outline' },
                { id: 'requirements', label: '4. Requisitions', icon: 'cart-outline' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[s.formTabItem, activeFormTab === tab.id && s.formTabItemActive]}
                  onPress={() => setActiveFormTab(tab.id)}
                >
                  <Text style={[s.formTabItemText, activeFormTab === tab.id && s.formTabItemTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subtab Content */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 10 }}>
              {/* TAB 1: LABOUR */}
              {activeFormTab === 'labour' && (
                <View style={{ gap: 10 }}>
                  <View style={s.subSectionHeader}>
                    <Text style={s.subSectionTitle}>Labour & Ongoing Works ({labourReports.length})</Text>
                    <TouchableOpacity style={s.addRowBtn} onPress={addLabourRow}>
                      <Ionicons name="add" size={13} color="#2563EB" />
                      <Text style={s.addRowBtnText}>Add Trade</Text>
                    </TouchableOpacity>
                  </View>

                  {labourReports.map((row, idx) => (
                    <View key={idx} style={s.itemBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={s.itemBoxNum}>Trade #{idx + 1}</Text>
                        {labourReports.length > 1 && (
                          <TouchableOpacity onPress={() => removeLabourRow(idx)}>
                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                      </View>

                      <TextInput
                        style={s.textInputSm}
                        placeholder="Agency / Trade (e.g. Electrical - Wall Chasing)"
                        placeholderTextColor="#94A3B8"
                        value={row.agencyActivity}
                        onChangeText={(t) => updateLabourRow(idx, 'agencyActivity', t)}
                      />

                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.miniLabel}>Skilled</Text>
                          <TextInput
                            style={s.textInputSm}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                            value={String(row.skilled)}
                            onChangeText={(t) => updateLabourRow(idx, 'skilled', t)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.miniLabel}>Unskilled</Text>
                          <TextInput
                            style={s.textInputSm}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                            value={String(row.unskilled)}
                            onChangeText={(t) => updateLabourRow(idx, 'unskilled', t)}
                          />
                        </View>
                        <View style={{ flex: 1.2 }}>
                          <Text style={s.miniLabel}>Status / Chart</Text>
                          <TextInput
                            style={s.textInputSm}
                            placeholder="e.g. 80%"
                            placeholderTextColor="#94A3B8"
                            value={row.statusAsPerBarChart}
                            onChangeText={(t) => updateLabourRow(idx, 'statusAsPerBarChart', t)}
                          />
                        </View>
                      </View>

                      <TextInput
                        style={[s.textInputSm, { height: 50 }]}
                        multiline
                        placeholder="Specific current work executed today"
                        placeholderTextColor="#94A3B8"
                        value={row.currentWork}
                        onChangeText={(t) => updateLabourRow(idx, 'currentWork', t)}
                      />
                    </View>
                  ))}
                </View>
              )}

              {/* TAB 2: RECEIPTS */}
              {activeFormTab === 'receipts' && (
                <View style={{ gap: 10 }}>
                  <View style={s.subSectionHeader}>
                    <Text style={s.subSectionTitle}>Material Receipts / Inward Challans ({materialReceipts.length})</Text>
                    <TouchableOpacity style={s.addRowBtn} onPress={addReceiptRow}>
                      <Ionicons name="add" size={13} color="#2563EB" />
                      <Text style={s.addRowBtnText}>Add Receipt</Text>
                    </TouchableOpacity>
                  </View>

                  {materialReceipts.length === 0 ? (
                    <Text style={s.emptyHint}>No inward materials logged for this date.</Text>
                  ) : (
                    materialReceipts.map((row, idx) => (
                      <View key={idx} style={s.itemBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={s.itemBoxNum}>Delivery #{idx + 1}</Text>
                          <TouchableOpacity onPress={() => removeReceiptRow(idx)}>
                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
                          </TouchableOpacity>
                        </View>

                        <TextInput
                          style={s.textInputSm}
                          placeholder="Supplier Name (e.g. Century Ply)"
                          placeholderTextColor="#94A3B8"
                          value={row.supplierName}
                          onChangeText={(t) => updateReceiptRow(idx, 'supplierName', t)}
                        />

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TextInput
                            style={[s.textInputSm, { flex: 1 }]}
                            placeholder="Challan #"
                            placeholderTextColor="#94A3B8"
                            value={row.challanNo}
                            onChangeText={(t) => updateReceiptRow(idx, 'challanNo', t)}
                          />
                          <TextInput
                            style={[s.textInputSm, { flex: 1 }]}
                            placeholder="Receipt #"
                            placeholderTextColor="#94A3B8"
                            value={row.receiptNo}
                            onChangeText={(t) => updateReceiptRow(idx, 'receiptNo', t)}
                          />
                        </View>

                        <TextInput
                          style={s.textInputSm}
                          placeholder="Material Details (e.g. 18mm Marine Ply)"
                          placeholderTextColor="#94A3B8"
                          value={row.materialDetails}
                          onChangeText={(t) => updateReceiptRow(idx, 'materialDetails', t)}
                        />

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TextInput
                            style={[s.textInputSm, { flex: 1 }]}
                            keyboardType="numeric"
                            placeholder="Quantity"
                            placeholderTextColor="#94A3B8"
                            value={String(row.qty)}
                            onChangeText={(t) => updateReceiptRow(idx, 'qty', t)}
                          />
                          <TextInput
                            style={[s.textInputSm, { flex: 1 }]}
                            placeholder="Unit (Sheets/Bags)"
                            placeholderTextColor="#94A3B8"
                            value={row.uom}
                            onChangeText={(t) => updateReceiptRow(idx, 'uom', t)}
                          />
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 3: TOMORROW */}
              {activeFormTab === 'tomorrow' && (
                <View style={{ gap: 10 }}>
                  <View style={s.subSectionHeader}>
                    <Text style={s.subSectionTitle}>Tomorrow's Planning ({tomorrowPlanning.length})</Text>
                    <TouchableOpacity style={s.addRowBtn} onPress={addTomorrowRow}>
                      <Ionicons name="add" size={13} color="#2563EB" />
                      <Text style={s.addRowBtnText}>Add Task</Text>
                    </TouchableOpacity>
                  </View>

                  {tomorrowPlanning.length === 0 ? (
                    <Text style={s.emptyHint}>No targeted planning logged for tomorrow.</Text>
                  ) : (
                    tomorrowPlanning.map((row, idx) => (
                      <View key={idx} style={s.itemBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={s.itemBoxNum}>Task #{idx + 1}</Text>
                          <TouchableOpacity onPress={() => removeTomorrowRow(idx)}>
                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
                          </TouchableOpacity>
                        </View>

                        <TextInput
                          style={s.textInputSm}
                          placeholder="Agency / Activity (e.g. Painting primer coat)"
                          placeholderTextColor="#94A3B8"
                          value={row.agencyActivity}
                          onChangeText={(t) => updateTomorrowRow(idx, 'agencyActivity', t)}
                        />

                        <TextInput
                          style={s.textInputSm}
                          placeholder="Targeted deliverables / room"
                          placeholderTextColor="#94A3B8"
                          value={row.targetedWorks}
                          onChangeText={(t) => updateTomorrowRow(idx, 'targetedWorks', t)}
                        />

                        <TextInput
                          style={s.textInputSm}
                          placeholder="Concerns / remarks / dependencies"
                          placeholderTextColor="#94A3B8"
                          value={row.remarkConcern}
                          onChangeText={(t) => updateTomorrowRow(idx, 'remarkConcern', t)}
                        />
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 4: REQUISITIONS */}
              {activeFormTab === 'requirements' && (
                <View style={{ gap: 10 }}>
                  <View style={s.subSectionHeader}>
                    <Text style={s.subSectionTitle}>Material Requirements / Requisitions ({materialRequirements.length})</Text>
                    <TouchableOpacity style={s.addRowBtn} onPress={addRequirementRow}>
                      <Ionicons name="add" size={13} color="#2563EB" />
                      <Text style={s.addRowBtnText}>Add Material</Text>
                    </TouchableOpacity>
                  </View>

                  {materialRequirements.length === 0 ? (
                    <Text style={s.emptyHint}>No urgent material requirements for site.</Text>
                  ) : (
                    materialRequirements.map((row, idx) => (
                      <View key={idx} style={s.itemBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={s.itemBoxNum}>Item #{idx + 1}</Text>
                          <TouchableOpacity onPress={() => removeRequirementRow(idx)}>
                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
                          </TouchableOpacity>
                        </View>

                        <TextInput
                          style={s.textInputSm}
                          placeholder="Material Description (e.g. Adhesive Can 50kg)"
                          placeholderTextColor="#94A3B8"
                          value={row.materialDescription}
                          onChangeText={(t) => updateRequirementRow(idx, 'materialDescription', t)}
                        />

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TextInput
                            style={[s.textInputSm, { flex: 1 }]}
                            keyboardType="numeric"
                            placeholder="Qty"
                            placeholderTextColor="#94A3B8"
                            value={String(row.qty)}
                            onChangeText={(t) => updateRequirementRow(idx, 'qty', t)}
                          />
                          <TextInput
                            style={[s.textInputSm, { flex: 1 }]}
                            placeholder="UOM (Can/Roll)"
                            placeholderTextColor="#94A3B8"
                            value={row.uom}
                            onChangeText={(t) => updateRequirementRow(idx, 'uom', t)}
                          />
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* Site Instructions / MOM */}
              <View style={{ marginTop: 12 }}>
                <Text style={s.inputLabel}>Site Instructions / MOM Notes</Text>
                <TextInput
                  style={[s.textInput, { height: 60, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="e.g. Client requested 2 additional power sockets behind refrigerator."
                  placeholderTextColor="#94A3B8"
                  value={siteInstructions}
                  onChangeText={setSiteInstructions}
                />
              </View>

              <TouchableOpacity
                style={[s.saveDprBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSubmitDpr}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.saveDprBtnText}>Submit Daily Progress Report</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: Inspect Historical DPR Details */}
      {/* ========================================================================= */}
      <Modal visible={!!viewingDpr} animationType="slide" transparent onRequestClose={() => setViewingDpr(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>DPR Breakdown: {formatDate(viewingDpr?.date)}</Text>
                <Text style={s.modalSubtitle}>Weather: {viewingDpr?.weather || 'Sunny'}</Text>
              </View>
              <TouchableOpacity onPress={() => setViewingDpr(null)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* View Tabs */}
            <View style={s.formTabRow}>
              {[
                { id: 'labour', label: 'Labour' },
                { id: 'receipts', label: 'Inward' },
                { id: 'tomorrow', label: 'Tomorrow' },
                { id: 'requirements', label: 'Requisitions' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[s.formTabItem, viewTab === tab.id && s.formTabItemActive]}
                  onPress={() => setViewTab(tab.id)}
                >
                  <Text style={[s.formTabItemText, viewTab === tab.id && s.formTabItemTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 10 }}>
              {viewTab === 'labour' && (
                <View style={{ gap: 8 }}>
                  {(viewingDpr?.labourReports || []).length === 0 ? (
                    <Text style={s.emptyHint}>No labour logs recorded.</Text>
                  ) : (
                    (viewingDpr?.labourReports || []).map((l, i) => (
                      <View key={i} style={s.inspectItemCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={s.inspectItemTitle}>{l.agencyActivity || 'General'}</Text>
                          <View style={s.inspectPill}>
                            <Text style={s.inspectPillText}>{l.statusAsPerBarChart || 'In Progress'}</Text>
                          </View>
                        </View>
                        <Text style={s.inspectSubText}>
                          Headcount: <Text style={{ fontFamily: 'Inter-Bold', color: '#0F172A' }}>{l.skilled || 0} Skilled</Text> + <Text style={{ fontFamily: 'Inter-Bold', color: '#0F172A' }}>{l.unskilled || 0} Unskilled</Text>
                        </Text>
                        {!!l.currentWork && <Text style={s.inspectBodyText}>{l.currentWork}</Text>}
                      </View>
                    ))
                  )}
                </View>
              )}

              {viewTab === 'receipts' && (
                <View style={{ gap: 8 }}>
                  {(viewingDpr?.materialReceipts || []).length === 0 ? (
                    <Text style={s.emptyHint}>No deliveries recorded.</Text>
                  ) : (
                    (viewingDpr?.materialReceipts || []).map((r, i) => (
                      <View key={i} style={s.inspectItemCard}>
                        <Text style={s.inspectItemTitle}>{r.materialDetails || 'Material'}</Text>
                        <Text style={s.inspectSubText}>Supplier: {r.supplierName || 'Vendor'}</Text>
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                          <Text style={s.inspectSubText}>Challan: <b>{r.challanNo || '-'}</b></Text>
                          <Text style={s.inspectSubText}>Qty: <b>{r.qty || 0} {r.uom || ''}</b></Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {viewTab === 'tomorrow' && (
                <View style={{ gap: 8 }}>
                  {(viewingDpr?.tomorrowPlanning || []).length === 0 ? (
                    <Text style={s.emptyHint}>No tomorrow plan recorded.</Text>
                  ) : (
                    (viewingDpr?.tomorrowPlanning || []).map((t, i) => (
                      <View key={i} style={s.inspectItemCard}>
                        <Text style={s.inspectItemTitle}>{t.agencyActivity || 'Planned Task'}</Text>
                        <Text style={s.inspectBodyText}>Target: {t.targetedWorks || '-'}</Text>
                        {!!t.remarkConcern && <Text style={[s.inspectSubText, { color: '#D97706' }]}>Concern: {t.remarkConcern}</Text>}
                      </View>
                    ))
                  )}
                </View>
              )}

              {viewTab === 'requirements' && (
                <View style={{ gap: 8 }}>
                  {(viewingDpr?.materialRequirements || []).length === 0 ? (
                    <Text style={s.emptyHint}>No site requisitions recorded.</Text>
                  ) : (
                    (viewingDpr?.materialRequirements || []).map((req, i) => (
                      <View key={i} style={s.inspectItemCard}>
                        <Text style={s.inspectItemTitle}>{req.materialDescription || 'Material'}</Text>
                        <Text style={s.inspectSubText}>Quantity: {req.qty || 0} {req.uom || ''}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* Site Instructions in Inspection */}
              {!!viewingDpr?.siteInstructions && (
                <View style={[s.inspectItemCard, { marginTop: 10, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }]}>
                  <Text style={[s.inspectItemTitle, { color: '#2563EB' }]}>Site Instructions & MOM Notes</Text>
                  <Text style={[s.inspectBodyText, { marginTop: 4 }]}>{viewingDpr.siteInstructions}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
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

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#475569' },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', paddingHorizontal: 30 },

  dprCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 14,
    gap: 10,
  },
  dprCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  dprDate: { fontSize: 14.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  dprSubDate: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8' },

  weatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  weatherBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold' },

  pdfExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pdfExportBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB' },

  dprMetricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dprMetricTile: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    gap: 2,
  },
  dprMetricVal: { fontSize: 14, fontFamily: 'Inter-Black', color: '#0F172A' },
  dprMetricLbl: { fontSize: 9.5, fontFamily: 'Inter-SemiBold', color: '#94A3B8', textTransform: 'uppercase' },

  dprCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 8,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsBtnText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#2563EB' },
  deleteDprBtn: { padding: 4 },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '92%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 10,
  },
  modalCloseBtn: { padding: 4 },
  modalTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSubtitle: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },

  topInputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inputLabel: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#475569', marginBottom: 4 },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
  },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  weatherChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  weatherChipText: { fontSize: 10, fontFamily: 'Inter-Medium', color: '#64748B' },
  weatherChipTextActive: { color: '#FFFFFF', fontFamily: 'Inter-Bold' },

  formTabRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 3,
    gap: 2,
    marginBottom: 6,
  },
  formTabItem: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  formTabItemActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  formTabItemText: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  formTabItemTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  subSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 },
  subSectionTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#1E293B' },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  addRowBtnText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#2563EB' },

  itemBox: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  itemBoxNum: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#2563EB', textTransform: 'uppercase' },
  miniLabel: { fontSize: 9.5, fontFamily: 'Inter-Medium', color: '#64748B', marginBottom: 2 },
  textInputSm: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11.5,
    fontFamily: 'Inter-Regular',
    color: '#0F172A',
  },
  emptyHint: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', marginVertical: 20 },

  saveDprBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  saveDprBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  // Inspect Modal
  inspectItemCard: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  inspectItemTitle: { fontSize: 12.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  inspectPill: { backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  inspectPillText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#2563EB' },
  inspectSubText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#64748B' },
  inspectBodyText: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#334155', marginTop: 2 },
});

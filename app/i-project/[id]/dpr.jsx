import React, { useState, useCallback } from 'react';
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
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useToast } from '../../context/ToastContext';
import interiorApiClient from '../../services/interiorApiClient';

const WEATHER_OPTIONS = [
  { value: 'Sunny', label: 'Sunny', icon: 'sunny-outline', color: '#D97706', bg: '#FEF3C7' },
  { value: 'Clear / Pleasant', label: 'Clear / Pleasant', icon: 'partly-sunny-outline', color: '#059669', bg: '#ECFDF5' },
  { value: 'Cloudy', label: 'Cloudy', icon: 'cloud-outline', color: '#475569', bg: '#F1F5F9' },
  { value: 'Rainy', label: 'Rainy', icon: 'rainy-outline', color: '#2563EB', bg: '#EFF6FF' },
  { value: 'Heavy Wind / Thunderstorm', label: 'Heavy Wind / Thunderstorm', icon: 'thunderstorm-outline', color: '#7C3AED', bg: '#F5F3FF' },
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

function DateField({ value, onChange, placeholder = 'Select date' }) {
  const [showIosPicker, setShowIosPicker] = useState(false);

  const open = () => {
    const base = value ? new Date(value) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        onChange: (event, d) => {
          if (event.type === 'set' && d) onChange(d.toISOString().split('T')[0]);
        },
      });
    } else {
      setShowIosPicker(true);
    }
  };

  const display = value
    ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <>
      <TouchableOpacity style={s.dateFieldBtn} onPress={open} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={15} color="#2563EB" style={{ marginRight: 8 }} />
        <Text style={[s.dateFieldText, !display && { color: '#94A3B8' }]}>{display || placeholder}</Text>
      </TouchableOpacity>
      {Platform.OS === 'ios' && showIosPicker && (
        <Modal transparent animationType="fade" visible={showIosPicker}>
          <View style={s.iosPickerOverlay}>
            <View style={s.iosPickerCard}>
              <DateTimePicker
                value={value ? new Date(value) : new Date()}
                mode="date"
                display="spinner"
                onChange={(event, d) => {
                  if (d) onChange(d.toISOString().split('T')[0]);
                }}
              />
              <TouchableOpacity style={s.iosPickerDone} onPress={() => setShowIosPicker(false)}>
                <Text style={s.iosPickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

function SelectDropdown({ value, options, onChange, placeholder = 'Select...', style, textStyle }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={{ position: 'relative', zIndex: open ? 50 : 1 }}>
      <TouchableOpacity style={[s.dropdownBtn, style]} onPress={() => setOpen((v) => !v)} activeOpacity={0.7}>
        <Text style={[s.dropdownBtnText, textStyle, !selected && { color: '#94A3B8' }]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color="#64748B" />
      </TouchableOpacity>
      {open && (
        <View style={s.dropdownMenu}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
            {options.map((o, idx) => {
              const active = o.value === value;
              return (
                <TouchableOpacity
                  key={`${o.value}-${idx}`}
                  style={[s.dropdownItem, active && s.dropdownItemActive]}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[s.dropdownItemText, active && s.dropdownItemTextActive]} numberOfLines={1}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// Official SkyStruct Creations DPR HTML Generator (100% parity with web)
// =============================================================================
export function generateDprHtml(dpr, project) {
  const projectName = project?.name || (typeof dpr?.projectName === 'string' ? dpr.projectName : '') || 'Site Project';
  const clientName = project?.clientName || project?.client?.name || project?.client || 'Valued Client';

  let formattedDate = '';
  if (dpr?.date) {
    const d = new Date(dpr.date);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      formattedDate = `${day}/${month}/${year}`;
    }
  }

  let labourRows = dpr?.labourReports && dpr.labourReports.length > 0 ? [...dpr.labourReports] : [];
  if (labourRows.length === 0) {
    if (dpr?.activities && dpr.activities.length > 0) {
      labourRows = dpr.activities.map((act, i) => {
        const mp = dpr.manpower && dpr.manpower[i];
        return {
          agencyActivity: mp ? `${mp.contractor ? mp.contractor + ' - ' : ''}${mp.trade || act.category}` : act.category,
          skilled: mp ? mp.count : '',
          unskilled: '',
          currentWork: act.description,
          statusAsPerBarChart: act.actualProgress !== undefined ? `${act.actualProgress}%` : (act.plannedProgress ? `Target ${act.plannedProgress}%` : ''),
        };
      });
    } else if (dpr?.manpower && dpr.manpower.length > 0) {
      labourRows = dpr.manpower.map((mp) => ({
        agencyActivity: `${mp.contractor ? mp.contractor + ' - ' : ''}${mp.trade}`,
        skilled: mp.count,
        unskilled: '',
        currentWork: 'Daily site task',
        statusAsPerBarChart: 'In Progress',
      }));
    }
  }

  const totalLabourRows = Math.max(8, labourRows.length);
  const paddedLabourRows = Array.from({ length: totalLabourRows }, (_, i) => labourRows[i] || {});

  const materialReceipts = dpr?.materialReceipts && dpr.materialReceipts.length > 0 ? [...dpr.materialReceipts] : [];
  const totalMaterialReceiptRows = Math.max(4, materialReceipts.length);
  const paddedMaterialReceipts = Array.from({ length: totalMaterialReceiptRows }, (_, i) => materialReceipts[i] || {});

  const tomorrowPlanning = dpr?.tomorrowPlanning && dpr.tomorrowPlanning.length > 0 ? [...dpr.tomorrowPlanning] : [];
  const totalTomorrowRows = Math.max(4, tomorrowPlanning.length);
  const paddedTomorrowPlanning = Array.from({ length: totalTomorrowRows }, (_, i) => tomorrowPlanning[i] || {});

  const materialRequirements = dpr?.materialRequirements && dpr.materialRequirements.length > 0 ? [...dpr.materialRequirements] : [];
  const totalRequirementSlots = Math.max(6, Math.ceil(materialRequirements.length / 2) * 2);
  const paddedMaterialReqs = Array.from({ length: totalRequirementSlots }, (_, i) => materialRequirements[i] || {});
  const halfCount = Math.max(3, Math.ceil(paddedMaterialReqs.length / 2));
  const leftMaterialReqs = paddedMaterialReqs.slice(0, halfCount);
  const rightMaterialReqs = paddedMaterialReqs.slice(halfCount, halfCount * 2);

  const momData = dpr?.siteInstructions || '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>DPR - ${projectName} - ${formattedDate}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a; background-color: #ffffff; padding: 10px;
          -webkit-print-color-adjust: exact; print-color-adjust: exact; position: relative;
        }
        .watermark {
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg);
          font-size: 76px; font-weight: 900; color: #0f172a; opacity: 0.038; letter-spacing: 8px;
          pointer-events: none; z-index: 0; white-space: nowrap; text-transform: uppercase;
        }
        .dpr-container {
          position: relative; z-index: 1; width: 100%; max-width: 800px; margin: 0 auto;
          border: 1.5px solid #0f172a; border-radius: 6px; background: #ffffff; overflow: hidden;
        }
        .table-grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .table-grid th, .table-grid td {
          border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 9.5px; color: #1e293b;
          word-wrap: break-word; overflow-wrap: break-word;
        }
        .table-grid th {
          font-weight: 700; text-align: center; background-color: #f8fafc; color: #0f172a;
          text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.3px;
        }
        .sec-title {
          font-size: 10.5px; font-weight: 800; padding: 4px 8px; border-top: 1.5px solid #0f172a;
          border-bottom: 1px solid #cbd5e1; background: linear-gradient(90deg, #f1f5f9 0%, #ffffff 100%);
          color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px; display: flex; align-items: center; gap: 6px;
        }
        .sec-title::before {
          content: ""; display: inline-block; width: 3px; height: 11px; background-color: #2563eb; border-radius: 2px;
        }
        .header-table { width: 100%; border-collapse: collapse; background: #ffffff; }
        .header-table td { border: 1px solid #0f172a; vertical-align: middle; }
        .logo-col { width: 30%; padding: 8px 10px; background: #fafafa; }
        .logo-box { display: flex; align-items: center; gap: 8px; }
        .brand-pill {
          display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px;
          border-radius: 8px; background: #2563eb; color: #ffffff; font-size: 14px; font-weight: 900; letter-spacing: -0.5px;
        }
        .brand-text { display: flex; flex-direction: column; }
        .brand-name { font-size: 14px; font-weight: 900; letter-spacing: 0.5px; color: #0f172a; line-height: 1.1; }
        .brand-slogan { font-size: 6.5px; font-weight: 700; letter-spacing: 1px; color: #64748b; text-transform: uppercase; margin-top: 2px; }
        .title-col { width: 44%; text-align: center; padding: 8px 6px; }
        .main-title { font-size: 14px; font-weight: 900; letter-spacing: 1px; color: #0f172a; text-transform: uppercase; }
        .date-col { width: 26%; padding: 8px 10px; font-size: 10px; font-weight: 700; background: #fafafa; text-align: right; }
        .project-meta-bar {
          padding: 6px 10px; font-size: 10px; font-weight: 600; background: #f8fafc;
          border-bottom: 1px solid #0f172a; display: flex; justify-content: space-between; align-items: center;
        }
        .project-name { font-weight: 800; color: #0f172a; }
        .meta-tag { color: #64748b; font-size: 9.5px; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .row-cell { height: 18px; font-size: 9px; }
        .row-cell:nth-child(even) { background-color: #fbfcfe; }
        .mom-box { min-height: 52px; padding: 8px 10px; font-size: 9.5px; line-height: 1.45; color: #1e293b; word-break: break-word; background: #ffffff; }
        .signatures-grid { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1.5px solid #0f172a; background: #f8fafc; }
        .sign-col { padding: 12px 10px 8px 10px; text-align: center; border-right: 1px solid #cbd5e1; }
        .sign-col:last-child { border-right: none; }
        .sign-line { width: 80%; margin: 18px auto 4px auto; border-bottom: 1px dashed #94a3b8; }
        .sign-title { font-size: 9px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.3px; }
      </style>
    </head>
    <body>
      <div class="watermark">SKYSTRUCT LITE</div>
      <div class="dpr-container">
        <!-- TOP HEADER -->
        <table class="header-table">
          <tr>
            <td class="logo-col">
              <div class="logo-box">
                <div class="brand-pill">SS</div>
                <div class="brand-text">
                  <span class="brand-name">SkyStruct Lite</span>
                  <span class="brand-slogan">Design • Build • Inspire</span>
                </div>
              </div>
            </td>
            <td class="title-col">
              <div class="main-title">DAILY PROGRESS REPORT</div>
            </td>
            <td class="date-col">
              <span style="color: #64748b;">DATE:</span> <span style="font-weight: 800; color: #0f172a;">${formattedDate}</span>
            </td>
          </tr>
        </table>

        <!-- PROJECT META ROW -->
        <div class="project-meta-bar">
          <div>
            <span class="meta-tag">PROJECT:</span> <span class="project-name">${projectName}</span>
          </div>
          <div>
            <span class="meta-tag">CLIENT:</span> <span style="font-weight: 700; color: #0f172a;">${clientName}</span>
            <span style="margin: 0 6px; color: #cbd5e1;">|</span>
            <span class="meta-tag">WEATHER:</span> <span style="font-weight: 700; color: #0f172a;">${dpr?.weather || 'Clear / Sunny'}</span>
          </div>
        </div>

        <!-- 1. LABOUR REPORT & ONGOING WORK STATUS -->
        <div class="sec-title" style="border-top: none;">1. Labour Report & Ongoing Work Status</div>
        <table class="table-grid">
          <thead>
            <tr>
              <th rowspan="2" style="width: 5%;">Sr.<br/>No.</th>
              <th rowspan="2" style="width: 28%;">Agency - Activity</th>
              <th colspan="2" style="width: 15%;">Manpower</th>
              <th colspan="2" style="width: 52%;">Work Status</th>
            </tr>
            <tr>
              <th style="width: 7.5%;">Skilled</th>
              <th style="width: 7.5%;">Unskilled</th>
              <th style="width: 32%;">Current Ongoing Work</th>
              <th style="width: 20%;">Status as per Bar Chart</th>
            </tr>
          </thead>
          <tbody>
            ${paddedLabourRows.map((row, idx) => `
              <tr class="row-cell">
                <td class="text-center" style="font-weight: 600; color: #64748b;">${idx + 1}</td>
                <td style="font-weight: 500;">${row.agencyActivity || ''}</td>
                <td class="text-center">${row.skilled !== undefined && row.skilled !== null ? row.skilled : ''}</td>
                <td class="text-center">${row.unskilled !== undefined && row.unskilled !== null ? row.unskilled : ''}</td>
                <td>${row.currentWork || ''}</td>
                <td style="font-weight: 600; color: #2563eb;">${row.statusAsPerBarChart || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- 2. MATERIAL RECEIPT DETAILS -->
        <div class="sec-title">2. Material Receipt Details</div>
        <table class="table-grid">
          <thead>
            <tr>
              <th style="width: 5%;">Sr.<br/>No.</th>
              <th style="width: 25%;">Name of Supplier</th>
              <th style="width: 12%;">Delivery<br/>Challan No</th>
              <th style="width: 12%;">Material<br/>Receipt No</th>
              <th style="width: 30%;">Material Details</th>
              <th style="width: 8%;">UOM</th>
              <th style="width: 8%;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${paddedMaterialReceipts.map((row, idx) => `
              <tr class="row-cell">
                <td class="text-center" style="font-weight: 600; color: #64748b;">${idx + 1}</td>
                <td>${row.supplierName || ''}</td>
                <td class="text-center font-mono">${row.challanNo || ''}</td>
                <td class="text-center font-mono">${row.receiptNo || ''}</td>
                <td style="font-weight: 500;">${row.materialDetails || ''}</td>
                <td class="text-center">${row.uom || ''}</td>
                <td class="text-center" style="font-weight: 700;">${row.qty !== undefined && row.qty !== null ? row.qty : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- 3. TOMORROW'S PLANNING -->
        <div class="sec-title">3. Tomorrow's Planning</div>
        <table class="table-grid">
          <thead>
            <tr>
              <th rowspan="2" style="width: 5%;">Sr.<br/>No.</th>
              <th rowspan="2" style="width: 28%;">Agency - Activity</th>
              <th colspan="2" style="width: 15%;">Manpower<br/>Requirement</th>
              <th rowspan="2" style="width: 32%;">Targeted Works</th>
              <th rowspan="2" style="width: 20%;">Remark / Concern</th>
            </tr>
            <tr>
              <th style="width: 7.5%;">Skilled</th>
              <th style="width: 7.5%;">Unskilled</th>
            </tr>
          </thead>
          <tbody>
            ${paddedTomorrowPlanning.map((row, idx) => `
              <tr class="row-cell">
                <td class="text-center" style="font-weight: 600; color: #64748b;">${idx + 1}</td>
                <td style="font-weight: 500;">${row.agencyActivity || ''}</td>
                <td class="text-center">${row.skilled !== undefined && row.skilled !== null ? row.skilled : ''}</td>
                <td class="text-center">${row.unskilled !== undefined && row.unskilled !== null ? row.unskilled : ''}</td>
                <td>${row.targetedWorks || ''}</td>
                <td style="color: #475569;">${row.remarkConcern || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- 4. MATERIAL REQUIREMENT -->
        <div class="sec-title">4. Material Requirement / Indents</div>
        <table class="table-grid">
          <thead>
            <tr>
              <th style="width: 5%;">Sr.</th>
              <th style="width: 29%;">Material Description</th>
              <th style="width: 8%;">UOM</th>
              <th style="width: 8%;">Qty</th>
              <th style="width: 5%;">Sr.</th>
              <th style="width: 29%;">Material Description</th>
              <th style="width: 8%;">UOM</th>
              <th style="width: 8%;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${leftMaterialReqs.map((leftRow, idx) => {
              const rightRow = rightMaterialReqs[idx] || {};
              const leftIndex = idx + 1;
              const rightIndex = idx + 1 + halfCount;
              return `
                <tr class="row-cell">
                  <td class="text-center" style="font-weight: 600; color: #64748b;">${leftIndex}</td>
                  <td style="font-weight: 500;">${leftRow.materialDescription || ''}</td>
                  <td class="text-center">${leftRow.uom || ''}</td>
                  <td class="text-center" style="font-weight: 700;">${leftRow.qty !== undefined && leftRow.qty !== null ? leftRow.qty : ''}</td>
                  <td class="text-center" style="font-weight: 600; color: #64748b;">${rightIndex}</td>
                  <td style="font-weight: 500;">${rightRow.materialDescription || ''}</td>
                  <td class="text-center">${rightRow.uom || ''}</td>
                  <td class="text-center" style="font-weight: 700;">${rightRow.qty !== undefined && rightRow.qty !== null ? rightRow.qty : ''}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- 5. MINUTES OF MEETING (MOM) -->
        <div class="sec-title">5. Minutes of Meeting (MOM) & Site Directives</div>
        <div class="mom-box">
          ${momData ? momData.replace(/\n/g, '<br/>') : '<span style="color: #94a3b8; font-style: italic;">No specific Minutes of Meeting recorded for this date. Site progress execution conforms to active baseline schedule.</span>'}
        </div>

        <!-- EXECUTIVE SIGNATURES SECTION -->
        <div class="signatures-grid">
          <div class="sign-col">
            <div class="sign-line"></div>
            <div class="sign-title">Prepared By (Site Engineer)</div>
          </div>
          <div class="sign-col">
            <div class="sign-line"></div>
            <div class="sign-title">Verified By (Project Manager)</div>
          </div>
          <div class="sign-col">
            <div class="sign-line"></div>
            <div class="sign-title">Approved By (Client / Architect)</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export default function InteriorDprScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: projectId } = useLocalSearchParams();
  const { showToast } = useToast();

  const [project, setProject] = useState(null);
  const [dprs, setDprs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [moms, setMoms] = useState([]);
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
    { agencyActivity: '', skilled: 1, unskilled: 0, currentWork: '', statusAsPerBarChart: 'In Progress' },
  ]);

  // 2. Material Receipts
  const [materialReceipts, setMaterialReceipts] = useState([]);

  // 3. Tomorrow's Planning
  const [tomorrowPlanning, setTomorrowPlanning] = useState([
    { agencyActivity: '', skilled: 1, unskilled: 0, targetedWorks: '', remarkConcern: '' },
  ]);

  // 4. Material Requirements
  const [materialRequirements, setMaterialRequirements] = useState([
    { materialDescription: '', uom: 'Nos', qty: 1 },
  ]);

  // Preview Sheet Modal State
  const [previewDpr, setPreviewDpr] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // View / Inspection Modal State
  const [viewingDpr, setViewingDpr] = useState(null);
  const [viewTab, setViewTab] = useState('labour');

  // PDF Action IDs
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, dprRes, taskRes, momRes] = await Promise.allSettled([
        interiorApiClient.get(`/projects/${projectId}`),
        interiorApiClient.get(`/projects/${projectId}/dpr`),
        interiorApiClient.get(`/projects/${projectId}/tasks`),
        interiorApiClient.get(`/projects/${projectId}/mom`),
      ]);
      setProject(projRes.status === 'fulfilled' && projRes.value?.success ? projRes.value.data : null);
      setDprs(dprRes.status === 'fulfilled' && dprRes.value?.success ? dprRes.value.data || [] : []);
      setTasks(taskRes.status === 'fulfilled' && taskRes.value?.success ? taskRes.value.data || [] : []);
      setMoms(momRes.status === 'fulfilled' && momRes.value?.success ? momRes.value.data || [] : []);
    } catch (e) {
      console.warn('Failed to load DPR dashboard', e);
      showToast('Failed to load DPR records', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Auto-populate from Live Tasks & MOMs (exact logic from web)
  const populateFromLiveProject = useCallback((customTasks, customMoms) => {
    const liveTasks = customTasks || tasks;
    const liveMoms = customMoms || moms;

    const activeTasks = liveTasks.filter((t) => t.status === 'in_progress' || t.status === 'todo');
    const liveLabour = activeTasks.length > 0
      ? activeTasks.map((t) => {
          const trade = t.packageId?.trade || t.packageId?.name || 'General Trade';
          const subtaskCount = t.subtasks?.length || 0;
          const completedSubtasks = t.subtasks?.filter((s) => s.completed).length || 0;
          const ongoingWork = subtaskCount > 0
            ? `${completedSubtasks}/${subtaskCount} steps done (${t.subtasks.map((s) => s.title).slice(0, 2).join(', ')})`
            : t.description || t.name;

          return {
            agencyActivity: `${trade} - ${t.name}`,
            skilled: Math.max(1, t.assignees?.length || 1),
            unskilled: 1,
            currentWork: ongoingWork,
            statusAsPerBarChart: `${t.progress || 0}% (${t.status === 'in_progress' ? 'In Progress' : 'Scheduled'})`,
          };
        })
      : [{ agencyActivity: '', skilled: 1, unskilled: 0, currentWork: '', statusAsPerBarChart: 'In Progress' }];

    const upcomingTasks = liveTasks.filter((t) => t.status === 'todo' || (t.status === 'in_progress' && (t.progress || 0) < 100));
    const liveTomorrow = upcomingTasks.length > 0
      ? upcomingTasks.slice(0, 4).map((t) => ({
          agencyActivity: `${t.packageId?.trade || 'Site Trade'} - ${t.name}`,
          skilled: Math.max(1, t.assignees?.length || 1),
          unskilled: 1,
          targetedWorks: `Continue execution for ${t.name}`,
          remarkConcern: 'Materials and site clearances verified',
        }))
      : [{ agencyActivity: '', skilled: 1, unskilled: 0, targetedWorks: '', remarkConcern: '' }];

    setLabourReports(liveLabour);
    setTomorrowPlanning(liveTomorrow);

    if (liveMoms && liveMoms.length > 0) {
      const latestMom = liveMoms[0];
      const momText = `Meeting: ${latestMom.title} (${new Date(latestMom.date).toLocaleDateString('en-IN')})\nAgenda: ${latestMom.agenda || 'Site Coordination'}\nDirectives: ${latestMom.notes || 'Execution as per drawings.'}${
        latestMom.actionItems?.length ? '\nAction Points: ' + latestMom.actionItems.map((a) => `• ${a.description} [${a.status || 'open'}]`).join('; ') : ''
      }`;
      setSiteInstructions(momText);
    }
  }, [tasks, moms]);

  const openCreateForm = () => {
    populateFromLiveProject();
    setIsFormOpen(true);
  };

  // Row Helpers
  const addLabourRow = () => {
    setLabourReports((p) => [...p, { agencyActivity: '', skilled: 1, unskilled: 0, currentWork: '', statusAsPerBarChart: 'In Progress' }]);
  };
  const removeLabourRow = (idx) => setLabourReports((p) => p.filter((_, i) => i !== idx));
  const updateLabourRow = (idx, field, val) => {
    setLabourReports((p) => {
      const c = [...p];
      c[idx] = { ...c[idx], [field]: val };
      return c;
    });
  };

  const addMaterialReceiptRow = () => {
    setMaterialReceipts((p) => [...p, { supplierName: '', challanNo: '', receiptNo: '', materialDetails: '', uom: 'Nos', qty: 1 }]);
  };
  const removeMaterialReceiptRow = (idx) => setMaterialReceipts((p) => p.filter((_, i) => i !== idx));
  const updateMaterialReceiptRow = (idx, field, val) => {
    setMaterialReceipts((p) => {
      const c = [...p];
      c[idx] = { ...c[idx], [field]: val };
      return c;
    });
  };

  const addTomorrowPlanningRow = () => {
    setTomorrowPlanning((p) => [...p, { agencyActivity: '', skilled: 1, unskilled: 0, targetedWorks: '', remarkConcern: '' }]);
  };
  const removeTomorrowPlanningRow = (idx) => setTomorrowPlanning((p) => p.filter((_, i) => i !== idx));
  const updateTomorrowPlanningRow = (idx, field, val) => {
    setTomorrowPlanning((p) => {
      const c = [...p];
      c[idx] = { ...c[idx], [field]: val };
      return c;
    });
  };

  const addMaterialRequirementRow = () => {
    setMaterialRequirements((p) => [...p, { materialDescription: '', uom: 'Nos', qty: 1 }]);
  };
  const removeMaterialRequirementRow = (idx) => setMaterialRequirements((p) => p.filter((_, i) => i !== idx));
  const updateMaterialRequirementRow = (idx, field, val) => {
    setMaterialRequirements((p) => {
      const c = [...p];
      c[idx] = { ...c[idx], [field]: val };
      return c;
    });
  };

  // Submit DPR
  const handleSubmitDpr = async () => {
    if (!dprDate) {
      showToast('Please select a DPR date', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const legacyManpower = labourReports.map((l) => ({
        trade: l.agencyActivity || 'General',
        count: (Number(l.skilled) || 0) + (Number(l.unskilled) || 0),
        contractor: l.agencyActivity?.split('-')[0]?.trim() || 'Vendor',
      }));

      const legacyActivities = labourReports.map((l) => ({
        category: l.agencyActivity?.split('-')[0]?.trim() || 'General',
        description: l.currentWork || l.agencyActivity || 'Daily task',
        plannedProgress: 100,
        actualProgress: parseInt(l.statusAsPerBarChart, 10) || 50,
        remarks: l.statusAsPerBarChart || '',
      }));

      const payload = {
        date: new Date(dprDate),
        weather,
        projectName: project?.name,
        labourReports,
        materialReceipts: materialReceipts.filter((m) => m.supplierName || m.materialDetails),
        tomorrowPlanning: tomorrowPlanning.filter((t) => t.agencyActivity || t.targetedWorks),
        materialRequirements: materialRequirements.filter((r) => r.materialDescription),
        siteInstructions,
        manpower: legacyManpower.length > 0 ? legacyManpower : [{ trade: 'General', count: 1, contractor: 'Vendor' }],
        activities: legacyActivities.length > 0 ? legacyActivities : [{ category: 'Site Work', description: 'General inspection', plannedProgress: 100, actualProgress: 100, remarks: '' }],
      };

      const res = await interiorApiClient.post(`/projects/${projectId}/dpr`, payload);
      if (res?.success) {
        showToast('Daily Progress Report submitted successfully', 'success');
        setIsFormOpen(false);
        loadData();
      }
    } catch (err) {
      showToast(err?.message || 'Failed to submit DPR', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete DPR
  const handleDeleteDpr = (dprId, date) => {
    Alert.alert(
      'Delete Daily Progress Report',
      `Are you sure you want to delete the DPR recorded for ${formatDate(date)}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Report',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(dprId);
            try {
              await interiorApiClient.delete(`/projects/${projectId}/dpr/${dprId}`);
              showToast('DPR report deleted successfully', 'delete');
              loadData();
            } catch (e) {
              showToast(e.message || 'Failed to delete DPR report', 'error');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  // PDF Download / Share
  const handleDownloadPdf = async (dprItem) => {
    try {
      setDownloadingId(dprItem._id);
      const html = generateDprHtml(dprItem, project);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        showToast('PDF generated at ' + uri, 'success');
      }
    } catch (e) {
      console.error('PDF export failed:', e);
      showToast('Failed to export PDF: ' + e.message, 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // Print
  const handlePrintDpr = async (dprItem) => {
    try {
      const html = generateDprHtml(dprItem, project);
      await Print.printAsync({ html });
    } catch (e) {
      showToast('Failed to open print dialogue', 'error');
    }
  };

  // Blank Template Download
  const handleDownloadBlankTemplate = async () => {
    try {
      const blankDpr = {
        date: new Date(),
        projectName: project?.name || 'Project Name',
        labourReports: [],
        materialReceipts: [],
        tomorrowPlanning: [],
        materialRequirements: [],
        siteInstructions: '',
      };
      const html = generateDprHtml(blankDpr, project);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        showToast('Blank Template PDF generated', 'success');
      }
    } catch (e) {
      showToast('Failed to generate template PDF', 'error');
    }
  };

  return (
    <View style={s.outerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={s.container} edges={['bottom']}>
        {/* --- HEADER BANNER (matches web) --- */}
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.headerTitle}>Daily Progress Reports (DPR)</Text>
              <View style={s.brandBadge}>
                <Text style={s.brandBadgeText}>SkyStruct Lite</Text>
              </View>
            </View>
            <Text style={s.headerSub} numberOfLines={1}>
              Site log, manpower status, material receipt, tomorrow planning & PDF generation for{' '}
              <Text style={{ color: '#0F172A', fontFamily: 'Inter-SemiBold' }}>{project?.name || 'Project'}</Text>
            </Text>
          </View>
        </View>

        {/* --- SUBHEADER ACTION TOOLBAR --- */}
        <View style={s.toolbar}>
          <TouchableOpacity style={s.templateBtn} onPress={handleDownloadBlankTemplate}>
            <Ionicons name="download-outline" size={14} color="#475569" />
            <Text style={s.templateBtnText}>Blank Template PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.logNewBtn} onPress={openCreateForm}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={s.logNewBtnText}>Log New DPR</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={s.loadingText}>Loading Daily Progress Reports...</Text>
          </View>
        ) : (
          <ScrollView style={s.mainScroll} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {dprs.length === 0 ? (
              <View style={s.emptyCard}>
                <View style={s.emptyIconCircle}>
                  <Ionicons name="document-text-outline" size={32} color="#2563EB" />
                </View>
                <Text style={s.emptyTitle}>No DPRs Recorded Yet</Text>
                <Text style={s.emptySub}>
                  Log site manpower, ongoing work progress, materials received, and tomorrow&apos;s planning. Click below to generate your first official DPR report.
                </Text>
                <TouchableOpacity style={s.emptyActionBtn} onPress={openCreateForm}>
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={s.emptyActionBtnText}>Create First DPR</Text>
                </TouchableOpacity>
              </View>
            ) : (
              dprs.map((item) => {
                const dateFormatted = formatDate(item.date);
                const weatherMeta = WEATHER_OPTIONS.find((w) => w.value === item.weather) || WEATHER_OPTIONS[0];

                const labourList = item.labourReports && item.labourReports.length > 0 ? item.labourReports : (item.manpower || []);
                const totalWorkers = item.labourReports && item.labourReports.length > 0
                  ? item.labourReports.reduce((acc, curr) => acc + (Number(curr.skilled) || 0) + (Number(curr.unskilled) || 0), 0)
                  : (item.manpower || []).reduce((acc, curr) => acc + (Number(curr.count) || 0), 0);

                const matReceiptCount = item.materialReceipts?.length || 0;
                const tomorrowCount = item.tomorrowPlanning?.length || 0;
                const isDownloading = downloadingId === item._id;
                const isDeleting = deletingId === item._id;

                return (
                  <View key={item._id} style={s.dprCard}>
                    {/* Top Row: Date, Weather badge on left, Delete action on right */}
                    <View style={s.cardTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <View style={s.dateTag}>
                          <Ionicons name="calendar" size={13} color="#2563EB" />
                          <Text style={s.dateTagText}>{dateFormatted}</Text>
                        </View>
                        <View style={[s.weatherPill, { backgroundColor: weatherMeta.bg }]}>
                          <Ionicons name={weatherMeta.icon} size={11} color={weatherMeta.color} />
                          <Text style={[s.weatherPillText, { color: weatherMeta.color }]}>{item.weather || 'Sunny'}</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[s.actionBtn, s.deleteBtn]}
                        onPress={() => handleDeleteDpr(item._id, item.date)}
                        disabled={isDeleting}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <Ionicons name="trash-outline" size={14} color="#DC2626" />
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* PDF Action Buttons Row (Preview Sheet, Print, Download PDF) */}
                    <View style={s.actionRow}>
                      <TouchableOpacity
                        style={[s.actionBtn, { flex: 1 }]}
                        onPress={() => {
                          setPreviewDpr(item);
                          setIsPreviewOpen(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="eye-outline" size={13} color="#334155" />
                        <Text style={s.actionBtnText}>Preview Sheet</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[s.actionBtn, { paddingHorizontal: 12 }]}
                        onPress={() => handlePrintDpr(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="print-outline" size={14} color="#334155" />
                        <Text style={s.actionBtnText}>Print</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[s.actionBtn, s.downloadBtn, { flex: 1.2 }]}
                        onPress={() => handleDownloadPdf(item)}
                        disabled={isDownloading}
                        activeOpacity={0.8}
                      >
                        {isDownloading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="download-outline" size={13} color="#FFFFFF" />
                            <Text style={s.downloadBtnText}>Download PDF</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Summary Metric Chips (4-Grid like Web) */}
                    <View style={s.metricsGrid}>
                      <View style={s.metricBox}>
                        <Text style={s.metricBoxLabel}>Total Manpower</Text>
                        <View style={s.metricBoxValRow}>
                          <Ionicons name="people" size={14} color="#2563EB" />
                          <Text style={s.metricBoxVal}>{totalWorkers} <Text style={s.metricBoxUnit}>workers</Text></Text>
                        </View>
                      </View>

                      <View style={s.metricBox}>
                        <Text style={s.metricBoxLabel}>Ongoing Works</Text>
                        <View style={s.metricBoxValRow}>
                          <Ionicons name="clipboard" size={14} color="#10B981" />
                          <Text style={s.metricBoxVal}>{labourList.length} <Text style={s.metricBoxUnit}>activities</Text></Text>
                        </View>
                      </View>

                      <View style={s.metricBox}>
                        <Text style={s.metricBoxLabel}>Materials Received</Text>
                        <View style={s.metricBoxValRow}>
                          <Ionicons name="cube" size={14} color="#8B5CF6" />
                          <Text style={s.metricBoxVal}>{matReceiptCount} <Text style={s.metricBoxUnit}>items</Text></Text>
                        </View>
                      </View>

                      <View style={s.metricBox}>
                        <Text style={s.metricBoxLabel}>Tomorrow Planned</Text>
                        <View style={s.metricBoxValRow}>
                          <Ionicons name="calendar-outline" size={14} color="#F59E0B" />
                          <Text style={s.metricBoxVal}>{tomorrowCount} <Text style={s.metricBoxUnit}>tasks</Text></Text>
                        </View>
                      </View>
                    </View>

                    {/* Labour Activities Preview (matches Web) */}
                    <View style={s.labourSection}>
                      <Text style={s.sectionHeaderTitle}>Labour Report & Ongoing Work Status</Text>
                      <View style={{ gap: 6 }}>
                        {item.labourReports && item.labourReports.length > 0 ? (
                          item.labourReports.slice(0, 3).map((row, i) => (
                            <View key={i} style={s.labourPreviewItem}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={s.labourAgency} numberOfLines={1}>{row.agencyActivity || 'General Trade'}</Text>
                                <View style={s.statusPill}>
                                  <Text style={s.statusPillText}>{row.statusAsPerBarChart || 'In Progress'}</Text>
                                </View>
                              </View>
                              {!!row.currentWork && (
                                <Text style={s.labourWorkDesc} numberOfLines={2}>{row.currentWork}</Text>
                              )}
                              <View style={s.headcountMeta}>
                                <Text style={s.headcountText}>Skilled: <Text style={{ fontFamily: 'Inter-Bold', color: '#0F172A' }}>{row.skilled || 0}</Text></Text>
                                <Text style={s.headcountText}>Unskilled: <Text style={{ fontFamily: 'Inter-Bold', color: '#0F172A' }}>{row.unskilled || 0}</Text></Text>
                              </View>
                            </View>
                          ))
                        ) : (item.activities || []).map((act, i) => (
                          <View key={i} style={s.labourPreviewItem}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={s.labourAgency}>{act.category || 'Site Work'}</Text>
                              <View style={s.statusPill}>
                                <Text style={s.statusPillText}>{act.actualProgress}%</Text>
                              </View>
                            </View>
                            <Text style={s.labourWorkDesc}>{act.description}</Text>
                          </View>
                        ))}
                        {item.labourReports && item.labourReports.length > 3 && (
                          <Text style={s.moreItemsHint}>+{item.labourReports.length - 3} more trades logged</Text>
                        )}
                      </View>
                    </View>

                    {/* Site Instructions / MOMs box if present */}
                    {!!item.siteInstructions && (
                      <View style={s.siteInstructionsBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                          <Ionicons name="chatbubbles-outline" size={13} color="#2563EB" />
                          <Text style={s.siteInstructionsTitle}>Site Instructions / MOMs:</Text>
                        </View>
                        <Text style={s.siteInstructionsBody} numberOfLines={3}>{item.siteInstructions}</Text>
                      </View>
                    )}

                    {/* Footer: Full Inspection trigger */}
                    <TouchableOpacity
                      style={s.inspectTrigger}
                      onPress={() => {
                        setViewingDpr(item);
                        setViewTab('labour');
                      }}
                    >
                      <Text style={s.inspectTriggerText}>Inspect Full 4-Tab Breakdown</Text>
                      <Ionicons name="chevron-forward" size={14} color="#2563EB" />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
            <View style={{ height: 90 }} />
          </ScrollView>
        )}

        {/* --- FLOATING LOG DPR BUTTON --- */}
        <TouchableOpacity style={s.fab} onPress={openCreateForm}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* ========================================================================= */}
      {/* MODAL: Full Official DPR Preview Sheet (WebView with Print & Share) */}
      {/* ========================================================================= */}
      <Modal visible={isPreviewOpen} animationType="slide" transparent onRequestClose={() => setIsPreviewOpen(false)}>
        <View style={s.previewModalOverlay}>
          <View style={s.previewModalCard}>
            <View style={s.previewTopBar}>
              <View style={{ flex: 1 }}>
                <Text style={s.previewModalTitle}>Daily Progress Report (DPR) Preview</Text>
                <Text style={s.previewModalSub}>
                  {project?.name || 'Project'} • {previewDpr?.date ? formatDate(previewDpr.date) : ''}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={s.previewActionBtn}
                  onPress={() => previewDpr && handlePrintDpr(previewDpr)}
                >
                  <Ionicons name="print-outline" size={15} color="#2563EB" />
                  <Text style={s.previewActionBtnText}>Print</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.previewActionBtn, { backgroundColor: '#2563EB', borderColor: '#2563EB' }]}
                  onPress={() => previewDpr && handleDownloadPdf(previewDpr)}
                >
                  <Ionicons name="share-outline" size={15} color="#FFFFFF" />
                  <Text style={[s.previewActionBtnText, { color: '#FFFFFF' }]}>Share PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.previewCloseBtn} onPress={() => setIsPreviewOpen(false)}>
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.webViewContainer}>
              {previewDpr ? (
                <WebView
                  source={{ html: generateDprHtml(previewDpr, project) }}
                  originWhitelist={['*']}
                  scalesPageToFit={true}
                  javaScriptEnabled={false}
                  style={{ flex: 1, backgroundColor: '#FFFFFF' }}
                />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: 4-Tab DPR Creator (Exact Web UI & Fields Parity) */}
      {/* ========================================================================= */}
      <Modal visible={isFormOpen} animationType="slide" transparent onRequestClose={() => setIsFormOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            {/* Modal Header */}
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={s.modalHeaderIconBox}>
                  <Ionicons name="document-text" size={18} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>Log Daily Progress Report (DPR)</Text>
                  <Text style={s.modalSubtitle}>SkyStruct Lite • {project?.name || 'Site Project'}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  style={s.syncLiveBtn}
                  onPress={() => {
                    populateFromLiveProject();
                    showToast('Live tasks and progress synchronized!', 'success');
                  }}
                >
                  <Ionicons name="sparkles" size={13} color="#2563EB" />
                  <Text style={s.syncLiveBtnText}>Sync Live Data</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsFormOpen(false)} style={s.modalCloseBtn}>
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Form Navigation Tabs (matches Web) */}
            <View style={s.formTabStrip}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }}>
                {[
                  { id: 'labour', label: `1. Labour & Works (${labourReports.length})` },
                  { id: 'receipts', label: `2. Material Receipts (${materialReceipts.length})` },
                  { id: 'tomorrow', label: `3. Tomorrow's Plan (${tomorrowPlanning.length})` },
                  { id: 'requirements', label: '4. Requirements & MOMs' },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    style={[s.formTabStripItem, activeFormTab === tab.id && s.formTabStripItemActive]}
                    onPress={() => setActiveFormTab(tab.id)}
                  >
                    <Text style={[s.formTabStripItemText, activeFormTab === tab.id && s.formTabStripItemTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Basic Info Bar (Always Visible at top of form, exact Web parity) */}
              <View style={s.basicInfoBar}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Report Date *</Text>
                  <DateField value={dprDate} onChange={setDprDate} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Weather Condition</Text>
                  <SelectDropdown
                    value={weather}
                    options={WEATHER_OPTIONS}
                    onChange={setWeather}
                    placeholder="Select weather..."
                  />
                </View>
              </View>

              {/* TAB 1: LABOUR REPORT & ONGOING WORK STATUS */}
              {activeFormTab === 'labour' && (
                <View style={s.tabContentWrapper}>
                  <View style={s.subSectionHeader}>
                    <View>
                      <Text style={s.subSectionTitle}>Labour Report & Ongoing Work Status</Text>
                      <Text style={s.subSectionSub}>Track agency activity, skilled / unskilled headcount, and ongoing task status.</Text>
                    </View>
                    <TouchableOpacity style={s.addRowBtn} onPress={addLabourRow}>
                      <Ionicons name="add" size={13} color="#2563EB" />
                      <Text style={s.addRowBtnText}>Add Row</Text>
                    </TouchableOpacity>
                  </View>

                  {labourReports.map((row, idx) => (
                    <View key={idx} style={s.itemBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text style={s.itemBoxNum}>Entry #{idx + 1}</Text>
                        {labourReports.length > 1 && (
                          <TouchableOpacity onPress={() => removeLabourRow(idx)}>
                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                      </View>

                      <View>
                        <Text style={s.fieldLabel}>Agency - Activity *</Text>
                        <TextInput
                          style={s.textInput}
                          placeholder="e.g. Electrical - Conduit Piping / Carpentry"
                          placeholderTextColor="#94A3B8"
                          value={row.agencyActivity}
                          onChangeText={(t) => updateLabourRow(idx, 'agencyActivity', t)}
                        />
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.fieldLabel}>Skilled</Text>
                          <TextInput
                            style={s.textInput}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                            value={String(row.skilled)}
                            onChangeText={(t) => updateLabourRow(idx, 'skilled', parseInt(t, 10) || 0)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.fieldLabel}>Unskilled</Text>
                          <TextInput
                            style={s.textInput}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                            value={String(row.unskilled)}
                            onChangeText={(t) => updateLabourRow(idx, 'unskilled', parseInt(t, 10) || 0)}
                          />
                        </View>
                      </View>

                      <View>
                        <Text style={s.fieldLabel}>Current Ongoing Work *</Text>
                        <TextInput
                          style={s.textInput}
                          placeholder="e.g. Living room wall chasing, bedroom conduit pull"
                          placeholderTextColor="#94A3B8"
                          value={row.currentWork}
                          onChangeText={(t) => updateLabourRow(idx, 'currentWork', t)}
                        />
                      </View>

                      <View>
                        <Text style={s.fieldLabel}>Status as per Bar Chart</Text>
                        <TextInput
                          style={s.textInput}
                          placeholder="e.g. On Track / 70% / Delayed"
                          placeholderTextColor="#94A3B8"
                          value={row.statusAsPerBarChart}
                          onChangeText={(t) => updateLabourRow(idx, 'statusAsPerBarChart', t)}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* TAB 2: MATERIAL RECEIPT DETAILS */}
              {activeFormTab === 'receipts' && (
                <View style={s.tabContentWrapper}>
                  <View style={s.subSectionHeader}>
                    <View>
                      <Text style={s.subSectionTitle}>Material Receipt Details</Text>
                      <Text style={s.subSectionSub}>Log goods / materials delivered to site with challan & receipt numbers.</Text>
                    </View>
                    <TouchableOpacity style={s.addRowBtn} onPress={addMaterialReceiptRow}>
                      <Ionicons name="add" size={13} color="#2563EB" />
                      <Text style={s.addRowBtnText}>Add Receipt</Text>
                    </TouchableOpacity>
                  </View>

                  {materialReceipts.length === 0 ? (
                    <View style={s.tabEmptyBox}>
                      <Text style={s.emptyHint}>No materials delivered today. Click &quot;Add Receipt&quot; if site received materials.</Text>
                    </View>
                  ) : (
                    materialReceipts.map((row, idx) => (
                      <View key={idx} style={s.itemBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={s.itemBoxNum}>Material Delivery #{idx + 1}</Text>
                          <TouchableOpacity onPress={() => removeMaterialReceiptRow(idx)}>
                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
                          </TouchableOpacity>
                        </View>

                        <View>
                          <Text style={s.fieldLabel}>Name of Supplier</Text>
                          <TextInput
                            style={s.textInput}
                            placeholder="e.g. Saint-Gobain Gyproc / Asian Paints"
                            placeholderTextColor="#94A3B8"
                            value={row.supplierName}
                            onChangeText={(t) => updateMaterialReceiptRow(idx, 'supplierName', t)}
                          />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Delivery Challan No</Text>
                            <TextInput
                              style={s.textInput}
                              placeholder="e.g. DC-1049"
                              placeholderTextColor="#94A3B8"
                              value={row.challanNo}
                              onChangeText={(t) => updateMaterialReceiptRow(idx, 'challanNo', t)}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Material Receipt No</Text>
                            <TextInput
                              style={s.textInput}
                              placeholder="e.g. MR-084"
                              placeholderTextColor="#94A3B8"
                              value={row.receiptNo}
                              onChangeText={(t) => updateMaterialReceiptRow(idx, 'receiptNo', t)}
                            />
                          </View>
                        </View>

                        <View>
                          <Text style={s.fieldLabel}>Material Details</Text>
                          <TextInput
                            style={s.textInput}
                            placeholder="e.g. 18mm Marine Plywood (BWP Grade)"
                            placeholderTextColor="#94A3B8"
                            value={row.materialDetails}
                            onChangeText={(t) => updateMaterialReceiptRow(idx, 'materialDetails', t)}
                          />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>UOM</Text>
                            <TextInput
                              style={s.textInput}
                              placeholder="e.g. Sheets / Nos / Bags"
                              placeholderTextColor="#94A3B8"
                              value={row.uom}
                              onChangeText={(t) => updateMaterialReceiptRow(idx, 'uom', t)}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Qty</Text>
                            <TextInput
                              style={s.textInput}
                              keyboardType="numeric"
                              placeholder="e.g. 20"
                              placeholderTextColor="#94A3B8"
                              value={String(row.qty)}
                              onChangeText={(t) => updateMaterialReceiptRow(idx, 'qty', t)}
                            />
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 3: TOMORROW'S PLANNING */}
              {activeFormTab === 'tomorrow' && (
                <View style={s.tabContentWrapper}>
                  <View style={s.subSectionHeader}>
                    <View>
                      <Text style={s.subSectionTitle}>Tomorrow&apos;s Planning</Text>
                      <Text style={s.subSectionSub}>Schedule targets, agency manpower requirements, and potential site concerns.</Text>
                    </View>
                    <TouchableOpacity style={s.addRowBtn} onPress={addTomorrowPlanningRow}>
                      <Ionicons name="add" size={13} color="#2563EB" />
                      <Text style={s.addRowBtnText}>Add Plan Row</Text>
                    </TouchableOpacity>
                  </View>

                  {tomorrowPlanning.length === 0 ? (
                    <View style={s.tabEmptyBox}>
                      <Text style={s.emptyHint}>No targeted planning logged for tomorrow.</Text>
                    </View>
                  ) : (
                    tomorrowPlanning.map((row, idx) => (
                      <View key={idx} style={s.itemBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={s.itemBoxNum}>Tomorrow Target #{idx + 1}</Text>
                          <TouchableOpacity onPress={() => removeTomorrowPlanningRow(idx)}>
                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
                          </TouchableOpacity>
                        </View>

                        <View>
                          <Text style={s.fieldLabel}>Agency - Activity</Text>
                          <TextInput
                            style={s.textInput}
                            placeholder="e.g. POP / False Ceiling Framing"
                            placeholderTextColor="#94A3B8"
                            value={row.agencyActivity}
                            onChangeText={(t) => updateTomorrowPlanningRow(idx, 'agencyActivity', t)}
                          />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Skilled Req</Text>
                            <TextInput
                              style={s.textInput}
                              keyboardType="numeric"
                              placeholder="0"
                              placeholderTextColor="#94A3B8"
                              value={String(row.skilled)}
                              onChangeText={(t) => updateTomorrowPlanningRow(idx, 'skilled', parseInt(t, 10) || 0)}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Unskilled Req</Text>
                            <TextInput
                              style={s.textInput}
                              keyboardType="numeric"
                              placeholder="0"
                              placeholderTextColor="#94A3B8"
                              value={String(row.unskilled)}
                              onChangeText={(t) => updateTomorrowPlanningRow(idx, 'unskilled', parseInt(t, 10) || 0)}
                            />
                          </View>
                        </View>

                        <View>
                          <Text style={s.fieldLabel}>Targeted Works</Text>
                          <TextInput
                            style={s.textInput}
                            placeholder="e.g. Master Bedroom perimeter GI channel fixing"
                            placeholderTextColor="#94A3B8"
                            value={row.targetedWorks}
                            onChangeText={(t) => updateTomorrowPlanningRow(idx, 'targetedWorks', t)}
                          />
                        </View>

                        <View>
                          <Text style={s.fieldLabel}>Remark / Concern</Text>
                          <TextInput
                            style={s.textInput}
                            placeholder="e.g. Awaiting electrical conduit clearance / drawings verified"
                            placeholderTextColor="#94A3B8"
                            value={row.remarkConcern}
                            onChangeText={(t) => updateTomorrowPlanningRow(idx, 'remarkConcern', t)}
                          />
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 4: REQUIREMENTS & MOMS */}
              {activeFormTab === 'requirements' && (
                <View style={s.tabContentWrapper}>
                  {/* Part A: Material Requirement at Site */}
                  <View style={s.subSectionHeader}>
                    <View>
                      <Text style={s.subSectionTitle}>Material Requirement at Site</Text>
                      <Text style={s.subSectionSub}>List upcoming site material requisitions or shortages.</Text>
                    </View>
                    <TouchableOpacity style={s.addRowBtn} onPress={addMaterialRequirementRow}>
                      <Ionicons name="add" size={13} color="#2563EB" />
                      <Text style={s.addRowBtnText}>Add Item</Text>
                    </TouchableOpacity>
                  </View>

                  {materialRequirements.length === 0 ? (
                    <View style={s.tabEmptyBox}>
                      <Text style={s.emptyHint}>No urgent material requirements for site.</Text>
                    </View>
                  ) : (
                    materialRequirements.map((row, idx) => (
                      <View key={idx} style={s.reqItemRow}>
                        <Text style={s.reqIndex}>{idx + 1}</Text>
                        <TextInput
                          style={[s.textInput, { flex: 2 }]}
                          placeholder="Material Description (e.g. 1mm Laminate L-904)"
                          placeholderTextColor="#94A3B8"
                          value={row.materialDescription}
                          onChangeText={(t) => updateMaterialRequirementRow(idx, 'materialDescription', t)}
                        />
                        <TextInput
                          style={[s.textInput, { flex: 0.9 }]}
                          placeholder="UOM"
                          placeholderTextColor="#94A3B8"
                          value={row.uom}
                          onChangeText={(t) => updateMaterialRequirementRow(idx, 'uom', t)}
                        />
                        <TextInput
                          style={[s.textInput, { flex: 0.8 }]}
                          keyboardType="numeric"
                          placeholder="Qty"
                          placeholderTextColor="#94A3B8"
                          value={String(row.qty)}
                          onChangeText={(t) => updateMaterialRequirementRow(idx, 'qty', t)}
                        />
                        {materialRequirements.length > 1 && (
                          <TouchableOpacity onPress={() => removeMaterialRequirementRow(idx)} style={{ padding: 4 }}>
                            <Ionicons name="trash-outline" size={16} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))
                  )}

                  {/* Part B: Minutes of Meeting (MOM) Data */}
                  <View style={s.momSectionWrapper}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Ionicons name="chatbubbles" size={15} color="#2563EB" />
                        <Text style={s.fieldLabel}>5. Minutes of Meeting (MOM) & Directives</Text>
                      </View>
                      {moms.length > 0 && (
                        <SelectDropdown
                          value=""
                          options={moms.map((m) => ({
                            value: m._id,
                            label: `${m.title} (${new Date(m.date).toLocaleDateString('en-IN')})`,
                          }))}
                          onChange={(val) => {
                            const selectedMom = moms.find((m) => m._id === val);
                            if (selectedMom) {
                              const text = `Meeting: ${selectedMom.title} (${new Date(selectedMom.date).toLocaleDateString('en-IN')})\nAgenda: ${selectedMom.agenda || 'Site Coordination'}\nDirectives & Notes: ${selectedMom.notes || 'Execution as per drawings.'}${
                                selectedMom.actionItems?.length ? '\nAction Items: ' + selectedMom.actionItems.map((a) => `• ${a.description} [${a.status || 'open'}]`).join('; ') : ''
                              }`;
                              setSiteInstructions(text);
                              showToast(`Inserted MOM: ${selectedMom.title}`, 'success');
                            }
                          }}
                          placeholder="Insert from MOMs..."
                          style={{ height: 32, paddingVertical: 4, paddingHorizontal: 8, minWidth: 140 }}
                          textStyle={{ fontSize: 10.5 }}
                        />
                      )}
                    </View>

                    <TextInput
                      style={[s.textInput, { height: 90, textAlignVertical: 'top' }]}
                      multiline
                      placeholder="Official Minutes of Meeting directives, decisions, and site action points..."
                      placeholderTextColor="#94A3B8"
                      value={siteInstructions}
                      onChangeText={setSiteInstructions}
                    />
                  </View>
                </View>
              )}

              {/* Modal Footer with Previous / Next / Cancel / Submit (Exact Web Navigation) */}
              <View style={s.modalFooter}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {activeFormTab !== 'labour' && (
                    <TouchableOpacity
                      style={s.navBtn}
                      onPress={() => {
                        if (activeFormTab === 'requirements') setActiveFormTab('tomorrow');
                        else if (activeFormTab === 'tomorrow') setActiveFormTab('receipts');
                        else if (activeFormTab === 'receipts') setActiveFormTab('labour');
                      }}
                    >
                      <Text style={s.navBtnText}>Previous</Text>
                    </TouchableOpacity>
                  )}
                  {activeFormTab !== 'requirements' && (
                    <TouchableOpacity
                      style={s.navBtn}
                      onPress={() => {
                        if (activeFormTab === 'labour') setActiveFormTab('receipts');
                        else if (activeFormTab === 'receipts') setActiveFormTab('tomorrow');
                        else if (activeFormTab === 'tomorrow') setActiveFormTab('requirements');
                      }}
                    >
                      <Text style={s.navBtnText}>Next Section</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setIsFormOpen(false)}>
                    <Text style={s.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.submitDprBtn, submitting && { opacity: 0.7 }]}
                    onPress={handleSubmitDpr}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="document-text" size={15} color="#FFFFFF" />
                        <Text style={s.submitDprBtnText}>Save & Generate</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
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
            <View style={s.formTabStrip}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }}>
                {[
                  { id: 'labour', label: '1. Labour & Works' },
                  { id: 'receipts', label: '2. Material Inward' },
                  { id: 'tomorrow', label: "3. Tomorrow's Plan" },
                  { id: 'requirements', label: '4. Requisitions & MOMs' },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    style={[s.formTabStripItem, viewTab === tab.id && s.formTabStripItemActive]}
                    onPress={() => setViewTab(tab.id)}
                  >
                    <Text style={[s.formTabStripItemText, viewTab === tab.id && s.formTabStripItemTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
                          <View style={s.statusPill}>
                            <Text style={s.statusPillText}>{l.statusAsPerBarChart || 'In Progress'}</Text>
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
                          <Text style={s.inspectSubText}>Challan: <Text style={{ fontFamily: 'Inter-Bold' }}>{r.challanNo || '-'}</Text></Text>
                          <Text style={s.inspectSubText}>Qty: <Text style={{ fontFamily: 'Inter-Bold' }}>{r.qty || 0} {r.uom || ''}</Text></Text>
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
                  {!!viewingDpr?.siteInstructions && (
                    <View style={s.siteInstructionsBox}>
                      <Text style={s.siteInstructionsTitle}>Site Instructions / MOMs:</Text>
                      <Text style={s.siteInstructionsBody}>{viewingDpr.siteInstructions}</Text>
                    </View>
                  )}
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
  mainScroll: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#64748B' },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexShrink: 0,
  },
  backBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A' },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 2 },
  brandBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  brandBadgeText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#2563EB' },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexShrink: 0,
    gap: 10,
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  templateBtnText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#475569' },
  logNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  logNewBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    alignItems: 'center',
    marginTop: 20,
  },
  emptyIconCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#0F172A', marginBottom: 6 },
  emptySub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#64748B', textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyActionBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  dprCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    paddingBottom: 10,
    gap: 8,
  },
  dateTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  dateTagText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#2563EB' },
  weatherPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  weatherPillText: { fontSize: 11, fontFamily: 'Inter-SemiBold' },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  actionBtnText: { fontSize: 11.5, fontFamily: 'Inter-SemiBold', color: '#334155' },
  downloadBtn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  downloadBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  deleteBtn: { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 9,
  },
  metricBoxLabel: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.3 },
  metricBoxValRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metricBoxVal: { fontSize: 13, fontFamily: 'Inter-Black', color: '#0F172A' },
  metricBoxUnit: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' },

  labourSection: { gap: 6 },
  sectionHeaderTitle: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3 },
  labourPreviewItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 10,
    gap: 4,
  },
  labourAgency: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A', flex: 1, marginRight: 8 },
  statusPill: { backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#059669' },
  labourWorkDesc: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#475569' },
  headcountMeta: { flexDirection: 'row', gap: 12, paddingTop: 2 },
  headcountText: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#64748B' },
  moreItemsHint: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#2563EB', textAlign: 'center', marginTop: 2 },

  siteInstructionsBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    padding: 10,
  },
  siteInstructionsTitle: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#1E40AF' },
  siteInstructionsBody: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#1E3A8A', lineHeight: 16 },

  inspectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 10,
  },
  inspectTriggerText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#2563EB' },

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

  // PREVIEW MODAL
  previewModalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'center', padding: 12 },
  previewModalCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', maxHeight: '94%' },
  previewTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  previewModalTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  previewModalSub: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },
  previewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  previewActionBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#2563EB' },
  previewCloseBtn: { padding: 4, marginLeft: 2 },
  webViewContainer: { flex: 1, backgroundColor: '#F1F5F9' },

  // CREATE / EDIT MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, height: '92%', maxHeight: '94%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12, marginBottom: 10 },
  modalHeaderIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 14.5, fontFamily: 'Inter-Bold', color: '#0F172A' },
  modalSubtitle: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#94A3B8', marginTop: 1 },
  modalCloseBtn: { padding: 4 },
  syncLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  syncLiveBtnText: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#2563EB' },

  formTabStrip: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  formTabStripItem: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  formTabStripItemActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  formTabStripItemText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  formTabStripItemTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  basicInfoBar: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  inputLabel: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#334155', marginBottom: 4 },
  fieldLabel: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: '#475569', marginBottom: 4 },

  dateFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    height: 38,
  },
  dateFieldText: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#0F172A' },

  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    height: 38,
  },
  dropdownBtnText: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#0F172A', flex: 1, marginRight: 6 },
  dropdownMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 999,
  },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  dropdownItemActive: { backgroundColor: '#EFF6FF' },
  dropdownItemText: { fontSize: 11.5, fontFamily: 'Inter-Medium', color: '#334155' },
  dropdownItemTextActive: { color: '#2563EB', fontFamily: 'Inter-Bold' },

  iosPickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  iosPickerCard: { backgroundColor: '#FFFFFF', padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  iosPickerDone: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16 },
  iosPickerDoneText: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#2563EB' },

  tabContentWrapper: { gap: 10, paddingBottom: 10 },
  subSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  subSectionTitle: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.3 },
  subSectionSub: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#64748B', marginTop: 1 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  addRowBtnText: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#2563EB' },

  itemBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 10, gap: 8, marginBottom: 8 },
  itemBoxNum: { fontSize: 10.5, fontFamily: 'Inter-Bold', color: '#64748B' },
  tabEmptyBox: { padding: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 12, alignItems: 'center' },
  emptyHint: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center' },

  reqItemRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  reqIndex: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#64748B', width: 16, textAlign: 'center' },
  momSectionWrapper: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 6 },

  textInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, fontFamily: 'Inter-Regular', color: '#0F172A' },

  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  navBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  navBtnText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#475569' },
  cancelBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  cancelBtnText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#64748B' },
  submitDprBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  submitDprBtnText: { fontSize: 11.5, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  inspectItemCard: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 10, padding: 10, gap: 3, marginBottom: 6 },
  inspectItemTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#0F172A' },
  inspectPill: { backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  inspectPillText: { fontSize: 9.5, fontFamily: 'Inter-Bold', color: '#059669' },
  inspectSubText: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#64748B' },
  inspectBodyText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#334155', marginTop: 2 },
});

// =============================================================================
// Interior project — "What needs doing" + health reasons (same rules as the web:
// new-update-web-sklite/src/features/interior-new/components/projects/InteriorProjectActionItems.tsx
// and src/components/interior/ProjectHealthBadge.tsx)
// =============================================================================

import interiorApiClient from '../../services/interiorApiClient';

export const DAY = 24 * 60 * 60 * 1000;
const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const CR_REVIEW = {
  submitted: 'Start review', design_review: 'Design review', pm_review: 'PM review',
  commercial_review: 'Commercial review', client_review: 'Client review',
};
const VO_REVIEW = {
  submitted: 'Start review', pm_review: 'PM review', commercial_review: 'Commercial review',
  management_approval: 'Management approval', client_approval: 'Client approval',
};
const CLOSED_PROJECT = ['completed', 'inactive', 'on-hold', 'on_hold', 'closed', 'cancelled'];

// module permission → API path (only fetched when the user can view it)
export const ACTION_SOURCES = [
  { key: 'tasks', perm: 'tasks', path: 'tasks' },
  { key: 'snags', perm: 'snags', path: 'snags' },
  { key: 'rfis', perm: 'rfis', path: 'rfis' },
  { key: 'risks', perm: 'risks', path: 'risks' },
  { key: 'milestones', perm: 'milestones', path: 'milestones' },
  { key: 'pos', perm: 'procurement', path: 'procurement' },
  { key: 'payments', perm: 'financials', path: 'payments' },
  { key: 'crs', perm: 'change_requests', path: 'change-requests' },
  { key: 'vos', perm: 'variation_orders', path: 'variation-orders' },
  { key: 'dprs', perm: 'dpr', path: 'dpr' },
];

export const KIND_META = {
  task: { label: 'Task', icon: 'checkbox-outline', color: '#2563EB', bg: '#EFF6FF' },
  snag: { label: 'Snag', icon: 'construct-outline', color: '#D97706', bg: '#FFFBEB' },
  rfi: { label: 'RFI', icon: 'help-circle-outline', color: '#4F46E5', bg: '#EEF2FF' },
  risk: { label: 'Risk', icon: 'shield-outline', color: '#DC2626', bg: '#FEF2F2' },
  milestone: { label: 'Milestone', icon: 'flag-outline', color: '#EA580C', bg: '#FFF7ED' },
  po: { label: 'Procurement', icon: 'cart-outline', color: '#059669', bg: '#ECFDF5' },
  cr: { label: 'Change Request', icon: 'git-pull-request-outline', color: '#7C3AED', bg: '#F5F3FF' },
  vo: { label: 'Variation Order', icon: 'git-compare-outline', color: '#C026D3', bg: '#FDF4FF' },
  dpr: { label: 'Site Report', icon: 'today-outline', color: '#475569', bg: '#F1F5F9' },
};

export const BUCKETS = [
  { key: 'overdue', label: 'Overdue', color: '#DC2626' },
  { key: 'today', label: 'Due today', color: '#D97706' },
  { key: 'soon', label: 'Due this week', color: '#D97706' },
  { key: 'waiting', label: 'Waiting on action', color: '#2563EB' },
  { key: 'later', label: 'Coming up', color: '#64748B' },
];

export const idOf = (v) => (v && typeof v === 'object' ? String(v._id ?? v.id ?? '') : v ? String(v) : '');
const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const clip = (s, n = 70) => {
  const t = String(s || '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const shortDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const listOf = (r) => {
  if (!r || r.status !== 'fulfilled' || !r.value) return [];
  const d = r.value?.data ?? r.value;
  return (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []).filter((x) => x && !x.isDeleted);
};

/** Fetch every source the user may view, in parallel. `allowed` = { key: bool }. */
export async function fetchActionSources(projectId, allowed) {
  const results = await Promise.allSettled(
    ACTION_SOURCES.map((src) => (allowed[src.key] ? interiorApiClient.get(`/projects/${projectId}/${src.path}`) : Promise.resolve(null)))
  );
  const out = {};
  ACTION_SOURCES.forEach((src, i) => { out[src.key] = listOf(results[i]); });
  out.paymentsLoaded = !!allowed.payments && results[ACTION_SOURCES.findIndex((s) => s.key === 'payments')].status === 'fulfilled';
  out.dprAllowed = !!allowed.dprs;
  return out;
}

export function bucketOf(item, today) {
  if (!item.due) return 'waiting';
  const d = startOfDay(item.due);
  if (d < today) return 'overdue';
  if (d === today) return 'today';
  if (d - today <= 7 * DAY) return 'soon';
  return 'later';
}

export function dueLabel(due, today) {
  if (!due) return null;
  const diff = Math.round((startOfDay(due) - today) / DAY);
  if (diff < 0) return `${-diff}d overdue`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 14) return `In ${diff} days`;
  return shortDate(due);
}

/** Turn the project's records into concrete next steps. */
export function buildActionItems(data, { me, projectStatus, formatMoney }) {
  if (!data) return [];
  const isMe = (v) => !!me && idOf(v) === me;
  const out = [];
  const now = startOfDay(new Date());
  const soonCutoff = now + 7 * DAY;

  for (const t of data.tasks) {
    if (t.status === 'completed') continue;
    const due = toDate(t.endDate || t.dueDate);
    const inReview = t.status === 'in_review';
    if (!inReview && !(due && startOfDay(due) <= soonCutoff)) continue;
    const assignees = Array.isArray(t.assignees) ? t.assignees : [];
    const names = assignees.map((p) => (p && typeof p === 'object' ? [p.firstName, p.lastName].filter(Boolean).join(' ') : '')).filter(Boolean);
    out.push({
      id: `task-${idOf(t)}`, recordId: idOf(t), kind: 'task', section: 'tasks', priority: t.priority,
      action: inReview ? 'Review and close' : t.status === 'in_progress' ? 'Finish' : 'Start',
      title: clip(t.name || t.title), meta: names.length ? names.join(', ') : 'Unassigned',
      due: inReview ? null : due, mine: assignees.some(isMe),
    });
  }

  for (const sg of data.snags) {
    const where = sg.location || sg.drawingTitle;
    if (['open', 'assigned', 'in_progress'].includes(sg.status)) {
      out.push({
        id: `snag-${idOf(sg)}`, kind: 'snag', section: 'snags', priority: sg.priority,
        action: sg.status === 'in_progress' ? 'Finish fixing snag' : 'Fix snag',
        title: clip(sg.description || sg.title || 'Snag'),
        meta: [where, sg.assignee ? null : 'Unassigned'].filter(Boolean).join(' · ') || undefined,
        due: toDate(sg.dueDate), mine: isMe(sg.assignee),
      });
    } else if (sg.status === 'resolved') {
      out.push({
        id: `snag-${idOf(sg)}`, kind: 'snag', section: 'snags', priority: sg.priority,
        action: 'Verify snag fix', title: clip(sg.description || 'Snag'), meta: where || undefined, due: null, mine: false,
      });
    }
  }

  for (const r of data.rfis) {
    if (r.status === 'open') {
      out.push({
        id: `rfi-${idOf(r)}`, kind: 'rfi', section: 'rfis', priority: r.priority,
        action: 'Answer RFI', title: clip(r.subject || r.question), meta: r.rfiNumber, due: toDate(r.dueDate), mine: isMe(r.assignedTo),
      });
    } else if (r.status === 'responded') {
      out.push({
        id: `rfi-${idOf(r)}`, kind: 'rfi', section: 'rfis', priority: r.priority,
        action: 'Review answer and close RFI', title: clip(r.subject || r.question), meta: r.rfiNumber, due: null, mine: isMe(r.raisedBy),
      });
    }
  }

  for (const rk of data.risks) {
    if (rk.status !== 'open' || Number(rk.score || 0) < 6) continue;
    out.push({
      id: `risk-${idOf(rk)}`, kind: 'risk', section: 'risks', priority: Number(rk.score) >= 9 ? 'critical' : 'high',
      action: rk.mitigationPlan ? 'Act on mitigation plan' : 'Add a mitigation plan',
      title: clip(rk.description), meta: `Score ${rk.score}/9`, due: toDate(rk.dueDate), mine: isMe(rk.owner),
    });
  }

  for (const m of data.milestones) {
    if (m.status === 'achieved') continue;
    const due = toDate(m.dueDate);
    if (m.status === 'delayed') {
      out.push({ id: `ms-${idOf(m)}`, kind: 'milestone', section: 'milestones', priority: 'high', action: 'Recover delayed milestone', title: clip(m.name), due, mine: false });
    } else if (due && startOfDay(due) <= soonCutoff) {
      out.push({
        id: `ms-${idOf(m)}`, kind: 'milestone', section: 'milestones',
        action: startOfDay(due) < now ? 'Mark achieved or delayed' : 'Get milestone done', title: clip(m.name), due, mine: false,
      });
    }
  }

  for (const po of data.pos) {
    const ref = [po.poNumber, po.materialName].filter(Boolean).join(' · ');
    const vendor = po.vendorName || po.vendor?.name;
    const base = { kind: 'po', section: 'procurement', mine: false, id: `po-${idOf(po)}` };
    const due = toDate(po.deliveryDate);
    switch (po.status) {
      case 'requested':
        out.push({ ...base, action: 'Send RFQ for material request', title: ref, meta: vendor, due: null });
        break;
      case 'rfq':
        out.push({ ...base, action: 'Compare quotes and raise PO', title: ref, meta: vendor, due: null });
        break;
      case 'pending':
        out.push({ ...base, action: 'Approve purchase order', title: ref, meta: [vendor, po.amount ? formatMoney(po.amount) : null].filter(Boolean).join(' · '), due: null });
        break;
      case 'approved':
      case 'ordered':
      case 'dispatched':
        if (due && startOfDay(due) <= soonCutoff) out.push({ ...base, action: 'Receive delivery and log GRN', title: ref, meta: vendor, due });
        break;
      case 'partially_delivered':
      case 'delivered': {
        if (po.status === 'partially_delivered') {
          out.push({ ...base, id: `${base.id}-grn`, action: 'Chase remaining delivery', title: ref, meta: vendor, due });
        }
        if (data.paymentsLoaded) {
          const paid = data.payments
            .filter((p) => p.type === 'outgoing' && p.poNo === po.poNumber)
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          const balance = Math.max(0, (Number(po.amount) || 0) - paid);
          if (balance > 0) out.push({ ...base, id: `${base.id}-pay`, action: `Pay vendor ${formatMoney(balance)}`, title: ref, meta: vendor, due: null });
        }
        break;
      }
      default:
        break;
    }
  }

  for (const cr of data.crs) {
    const stage = CR_REVIEW[cr.status];
    if (!stage) continue;
    out.push({ id: `cr-${idOf(cr)}`, kind: 'cr', section: 'change-requests', priority: cr.priority, action: stage, title: clip(cr.description || cr.title), meta: cr.crNumber, due: null, mine: false });
  }

  for (const vo of data.vos) {
    const stage = vo.status === 'approved' ? 'Execute approved VO' : VO_REVIEW[vo.status];
    if (!stage) continue;
    out.push({ id: `vo-${idOf(vo)}`, kind: 'vo', section: 'variation-orders', action: stage, title: clip(vo.description || vo.title), meta: vo.voNumber, due: null, mine: false });
  }

  const active = !CLOSED_PROJECT.includes(String(projectStatus || '').toLowerCase());
  if (data.dprAllowed && active) {
    const latest = data.dprs
      .map((d) => toDate(d.date || d.reportDate || d.createdAt))
      .filter(Boolean)
      .sort((x, y) => y.getTime() - x.getTime())[0];
    if (!latest || startOfDay(latest) < now) {
      out.push({
        id: 'dpr-today', kind: 'dpr', section: 'dpr', action: "Submit today's site report (DPR)",
        title: latest ? `Last report: ${shortDate(latest)}` : 'No site reports yet', due: new Date(), mine: false,
      });
    }
  }
  return out;
}

/** Group + sort items by urgency, then due date, then priority. */
export function groupActionItems(items, today) {
  const byBucket = new Map();
  for (const it of items) {
    const b = bucketOf(it, today);
    if (!byBucket.has(b)) byBucket.set(b, []);
    byBucket.get(b).push(it);
  }
  for (const list of byBucket.values()) {
    list.sort((x, y) => {
      const dx = x.due ? x.due.getTime() : Infinity;
      const dy = y.due ? y.due.getTime() : Infinity;
      if (dx !== dy) return dx - dy;
      return (PRIORITY_RANK[x.priority] ?? 4) - (PRIORITY_RANK[y.priority] ?? 4);
    });
  }
  return BUCKETS.filter((b) => byBucket.has(b.key)).map((b) => ({ ...b, items: byBucket.get(b.key) }));
}

/** Why the project is "At Risk" / "Delayed" — same rules as the backend health check. */
export function buildHealthReasons(project, data) {
  const reasons = [];
  const now = new Date();
  const daysAgo = (d) => Math.max(1, Math.floor((Date.now() - d.getTime()) / DAY));
  const end = toDate(project?.endDate);
  if (end && end < now && Number(project?.progress ?? 0) < 100 && project?.status !== 'completed') {
    reasons.push({
      key: 'end', icon: 'calendar-outline', color: '#DC2626', bg: '#FEF2F2', section: 'timeline',
      title: 'Past the project end date',
      hint: `Planned to finish on ${shortDate(end)} (${daysAgo(end)} days ago); progress is ${project?.progress ?? 0}%.`,
      rows: [],
    });
  }
  if (!data) return reasons;
  const delayed = data.milestones.filter((m) => m.status === 'delayed');
  if (delayed.length) {
    reasons.push({
      key: 'ms', icon: 'flag-outline', color: '#DC2626', bg: '#FEF2F2', section: 'milestones',
      title: `${delayed.length} delayed milestone${delayed.length > 1 ? 's' : ''}`,
      hint: 'Marked delayed. Mark them achieved once done.',
      rows: delayed.map((m) => ({ id: idOf(m), label: m.name, sub: m.dueDate ? `Due ${shortDate(new Date(m.dueDate))}` : undefined })),
    });
  }
  const overdue = data.tasks
    .filter((t) => t.status !== 'completed' && t.endDate && new Date(t.endDate) < now)
    .sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
  if (overdue.length) {
    reasons.push({
      key: 'tasks', icon: 'checkbox-outline', color: '#B45309', bg: '#FFFBEB', section: 'tasks',
      title: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`,
      hint: 'Not completed and past their end date.',
      rows: overdue.map((t) => ({
        id: idOf(t), taskId: idOf(t), label: t.name || t.title,
        sub: `${daysAgo(new Date(t.endDate))} days overdue · ${String(t.status || '').replace('_', ' ')}`,
      })),
    });
  }
  const risky = data.risks.filter((r) => r.status === 'open' && Number(r.score || 0) >= 6).sort((a, b) => Number(b.score) - Number(a.score));
  if (risky.length) {
    reasons.push({
      key: 'risks', icon: 'shield-outline', color: '#B45309', bg: '#FFFBEB', section: 'risks',
      title: `${risky.length} high-score open risk${risky.length > 1 ? 's' : ''}`,
      hint: 'Open risks scoring 6 or more out of 9.',
      rows: risky.map((r) => ({ id: idOf(r), label: r.description, sub: `Score ${r.score}/9${r.mitigationPlan ? '' : ' · no mitigation plan'}` })),
    });
  }
  return reasons;
}

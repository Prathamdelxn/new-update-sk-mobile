// =============================================================================
// Interior — Role permission catalog (modules × actions)
// Same as the web app (src/features/interior-new/lib/permissionCatalog.ts).
// Module keys match the interior-os-backend Role model.
// =============================================================================

export const PERMISSION_ACTIONS = [
  { key: 'read', label: 'View', short: 'V' },
  { key: 'create', label: 'Create', short: 'C' },
  { key: 'update', label: 'Update', short: 'U' },
  { key: 'delete', label: 'Delete', short: 'D' },
  { key: 'approve', label: 'Approve', short: 'A' },
  { key: 'export', label: 'Export', short: 'E' },
];

// Actions a module offers when it doesn't use all six (the rest show as "—" in the editors)
const CRUD = ['read', 'create', 'update', 'delete'];
// Dated records: logged, deleted and downloaded, never edited
const REPORT = ['read', 'create', 'delete', 'export'];

export const PERMISSION_MODULES = [
  // CRM — labels match the CRM tab names
  { key: 'crm_leads', label: 'Leads', category: 'CRM Pipeline', actions: ['read', 'create', 'update', 'delete', 'export'] },
  { key: 'crm_followups', label: 'Follow-ups', category: 'CRM Pipeline', actions: ['read', 'create', 'update'] },
  { key: 'crm_site_visits', label: 'Site Visits', category: 'CRM Pipeline', actions: ['read', 'create', 'update'] },
  { key: 'crm_requirements', label: 'Requirements', category: 'CRM Pipeline', actions: ['read', 'create', 'update'] },
  { key: 'crm_drawings', label: 'Drawings (2D/3D)', category: 'CRM Pipeline', actions: ['read', 'create', 'update', 'delete', 'approve'] },
  { key: 'crm_boq', label: 'BOQ', category: 'CRM Pipeline' },
  { key: 'crm_quotations', label: 'Quotations', category: 'CRM Pipeline' },
  // Project execution
  { key: 'projects', label: 'Project Config', category: 'Project Execution' },
  { key: 'wbs', label: 'WBS Hierarchy', category: 'Project Execution', actions: CRUD },
  { key: 'tasks', label: 'Activity / Task', category: 'Project Execution', actions: CRUD },
  { key: 'milestones', label: 'Milestones', category: 'Project Execution', actions: CRUD },
  { key: 'dpr', label: 'Daily Progress', category: 'Project Execution', actions: REPORT },
  { key: 'weekly_reports', label: 'Weekly Reports', category: 'Project Execution', actions: REPORT },
  { key: 'boq', label: 'BOQ', category: 'Project Execution', actions: ['read', 'create', 'update', 'delete', 'approve'] },
  { key: 'procurement', label: 'Procurement', category: 'Project Execution', actions: CRUD },
  { key: 'inventory', label: 'Inventory', category: 'Project Execution', actions: CRUD },
  { key: 'change_requests', label: 'Change Requests', category: 'Project Execution' },
  { key: 'variation_orders', label: 'Variation Orders', category: 'Project Execution', actions: ['read', 'create', 'approve'] },
  { key: 'confirm_order', label: 'Confirm Order', category: 'Project Execution', actions: ['read', 'update'] },
  { key: 'drawings', label: 'Drawings & CAD', category: 'Project Execution' },
  { key: 'rfis', label: 'RFIs', category: 'Project Execution', actions: CRUD },
  { key: 'mom', label: 'Minutes of Meeting', category: 'Project Execution', actions: CRUD },
  { key: 'risks', label: 'Risks', category: 'Project Execution', actions: CRUD },
  { key: 'snags', label: 'Snags', category: 'Project Execution', actions: CRUD },
  { key: 'utilities', label: 'Utilities', category: 'Project Execution', actions: ['read', 'update'] },
  { key: 'photos', label: 'Site Photos', category: 'Project Execution', actions: ['read', 'create', 'delete'] },
  { key: 'handover', label: 'Handover', category: 'Project Execution', actions: ['read', 'create', 'update', 'delete'] },
  { key: 'filemgt', label: 'File Management', category: 'Project Execution', actions: ['read', 'create', 'delete'] },
  { key: 'financials', label: 'Payments & Financials', category: 'Project Execution', actions: ['read', 'create', 'delete', 'export'] },
  { key: 'users', label: 'Team / Members', category: 'Project Execution' },
  // Organization-wide
  { key: 'dashboard', label: 'Dashboard', category: 'Organization', actions: ['read'] },
  { key: 'vendors', label: 'Vendor Management', category: 'Organization', actions: CRUD },
  { key: 'roles', label: 'Roles & Permissions', category: 'Organization', actions: CRUD },
];

export const MODULE_CATEGORIES = ['CRM Pipeline', 'Project Execution', 'Organization'];

const ALL_MODULE_ACTIONS = ['read', 'create', 'update', 'delete', 'approve', 'export'];

/** The actions a module offers (all six unless the module lists fewer). */
export function moduleActions(moduleKey) {
  return PERMISSION_MODULES.find((m) => m.key === moduleKey)?.actions ?? ALL_MODULE_ACTIONS;
}

/** Does a permission list grant `action` on `module`? `manage` grants every action. */
export function permissionsAllow(perms, module, action) {
  const entry = (perms || []).find((p) => p.module === module);
  if (!entry) return false;
  return entry.actions.includes(action) || entry.actions.includes('manage');
}

/** Org admins have full access whatever their role. */
export function isInteriorOrgAdmin(user) {
  if (!user) return false;
  const sys = String(user.systemRole || '').toLowerCase();
  const roleVal = typeof user.role === 'string' ? user.role : user.role?.slug || '';
  const slug = String(roleVal).toLowerCase();
  const name = String(user.role?.name || '').toLowerCase();
  return (
    sys === 'super_admin' ||
    sys === 'org_admin' ||
    sys === 'admin' ||
    slug === 'admin' ||
    slug === 'org_admin' ||
    slug === 'super_admin' ||
    slug === 'owner' ||
    name === 'admin' ||
    name === 'org admin' ||
    name === 'super admin' ||
    name === 'owner'
  );
}

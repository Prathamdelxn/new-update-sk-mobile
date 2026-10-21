// =============================================================================
// Interior CRM — stages, their permission modules and pipeline order
// Same rules as the web CRM and the backend (lib/crm-access).
// =============================================================================

export const CRM_MODULES = [
  'crm_leads',
  'crm_followups',
  'crm_site_visits',
  'crm_requirements',
  'crm_drawings',
  'crm_boq',
  'crm_quotations',
];

// Pipeline position of each status, to know which leads can still enter a stage
export const STATUS_STAGE_INDEX = {
  'New Lead': 0,
  Contacted: 1,
  'Meeting Scheduled': 1,
  'Under Site Visit': 2,
  'Measurement Done': 2,
  'Under Requirement': 3,
  'Requirement Completed': 3,
  'Under Drawing': 4,
  'Design Approved': 4,
  'Under BOQ Creation': 5,
  'Under Quotation': 6,
  'Quotation Pending': 6,
  'Quotation Sent': 6,
  Negotiation: 6,
  'Booking Pending': 6,
};

/**
 * Can this user move a lead from one stage module into another?
 * Create on the target stage, or Update on the current or target stage.
 */
export function canMoveLead(hasPermission, fromModule, toModule) {
  return (
    hasPermission(toModule, 'create') ||
    hasPermission(toModule, 'update') ||
    hasPermission(fromModule, 'update')
  );
}

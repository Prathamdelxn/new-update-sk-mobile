import interiorApiClient from './interiorApiClient';

export const interiorCrmService = {
  getCustomers: async (params) => {
    const res = await interiorApiClient.get('/crm/customers', params);
    return res?.data || res || [];
  },
  // Single-lead endpoint (same as web): the list endpoint leaves out site photos
  getCustomerById: async (id) => {
    try {
      const res = await interiorApiClient.get(`/crm/customers/${id}`);
      const lead = res?.data ?? null;
      if (lead && (lead._id || lead.id)) {
        // This endpoint populates people / project refs; screens expect plain ids (like the list)
        const idOf = (v) => (v && typeof v === 'object' ? v._id || v.id : v);
        return {
          ...lead,
          assignedSalesExecutive: idOf(lead.assignedSalesExecutive),
          designerAssigned: idOf(lead.designerAssigned),
          createdBy: idOf(lead.createdBy),
          linkedProject: idOf(lead.linkedProject),
        };
      }
    } catch (e) {
      if (e?.status === 403) throw e;
    }
    const res = await interiorApiClient.get('/crm/customers');
    const list = res?.data || res || [];
    return Array.isArray(list) ? list.find((c) => c._id === id || c.id === id) || null : null;
  },
  createCustomer: async (data) => {
    return interiorApiClient.post('/crm/customers', data);
  },
  updateCustomer: async (id, data) => {
    return interiorApiClient.patch(`/crm/customers/${id}`, data);
  },
  deleteCustomer: async (id) => {
    return interiorApiClient.delete(`/crm/customers/${id}`);
  },
  convertCustomer: async (id, data) => {
    return interiorApiClient.post(`/crm/customers/${id}/convert`, data);
  },
  sendQuotationEmail: async (id, data) => {
    return interiorApiClient.post(`/crm/customers/${id}/send-quotation-email`, data);
  },

  // Drawing two-step approval workflow
  sendDrawingForApproval: async (customerId, drawingId, data) => {
    return interiorApiClient.post(`/crm/customers/${customerId}/drawings/${drawingId}/send-for-approval`, data);
  },
  approveDrawing: async (customerId, drawingId, data) => {
    return interiorApiClient.post(`/crm/customers/${customerId}/drawings/${drawingId}/approve`, data);
  },
  uploadDrawingVersion: async (customerId, drawingId, data) => {
    return interiorApiClient.post(`/crm/customers/${customerId}/drawings/${drawingId}/version`, data);
  },
  deleteDrawing: async (customerId, drawingId) => {
    return interiorApiClient.delete(`/crm/customers/${customerId}/drawings/${drawingId}`);
  },

  // Public client share link for approved drawings
  generateShareLink: async (customerId, data) => {
    return interiorApiClient.post(`/crm/customers/${customerId}/share`, data);
  },
  revokeShareLink: async (customerId) => {
    return interiorApiClient.delete(`/crm/customers/${customerId}/share`);
  },

  // Activities
  getActivities: async (params) => {
    const query = typeof params === 'string' ? { customerId: params } : params;
    const res = await interiorApiClient.get('/crm/activities', query);
    return res?.data || res || [];
  },
  createActivity: async (data) => {
    return interiorApiClient.post('/crm/activities', data);
  },
  updateActivity: async (id, data) => {
    return interiorApiClient.patch(`/crm/activities/${id}`, data);
  },
  getPendingActivities: async () => {
    const res = await interiorApiClient.get('/crm/activities/pending');
    return res?.data || res || [];
  },

  // Users for assignees
  getUsers: async () => {
    const res = await interiorApiClient.get('/users');
    return res?.data || res || [];
  },
};

export default interiorCrmService;

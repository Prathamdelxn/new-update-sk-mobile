import interiorApiClient from './interiorApiClient';

export const interiorCrmService = {
  getCustomers: async (params) => {
    const res = await interiorApiClient.get('/crm/customers', params);
    return res?.data || res || [];
  },
  getCustomerById: async (id) => {
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

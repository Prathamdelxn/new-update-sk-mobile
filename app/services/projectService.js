import { API_BASE_URL } from '../config';

export const milestoneService = {
  getProjectMilestones: async (projectId, token) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/milestones`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  createMilestone: async (projectId, token, milestoneData) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/milestones`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(milestoneData),
    });
    return response.json();
  },

  updateMilestone: async (projectId, milestoneId, token, updates) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/milestones/${milestoneId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    return response.json();
  },

  deleteMilestone: async (projectId, milestoneId, token) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/milestones/${milestoneId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  importXER: async (projectId, token, fileContent) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/milestones/import-xer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileContent }),
    });
    return response.json();
  },
};

export const workProgressService = {
  getLogs: async (projectId, token, period = 'week') => {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/work-progress?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },

  createLog: async (projectId, token, data) => {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/work-progress`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return { ok: res.ok, data: await res.json() };
  },

  getSummary: async (projectId, token) => {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/work-progress/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },

  deleteLog: async (projectId, logId, token) => {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/work-progress?logId=${logId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },
};

export const boqService = {
  getBOQItems: async (projectId, token) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/boq`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },
};

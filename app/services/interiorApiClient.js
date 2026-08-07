import * as SecureStore from 'expo-secure-store';

// Dedicated client for the separate interior-os backend. `userToken` is
// shared with the construction flow (AuthContext normalizes both sessions
// under the same SecureStore keys) but requests here always go to the
// interior-os host, never the construction API.
const INTERIOR_API_BASE_URL = `${(process.env.EXPO_PUBLIC_INTERIOR_API_URL || '').replace(/\/+$/, '')}/api/v1`;

async function request(path, { method = 'GET', body, params } = {}) {
  const token = await SecureStore.getItemAsync('userToken');

  let url = `${INTERIOR_API_BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error || data?.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// For multipart uploads. Pass a plain object of fields; a `uri`/`name`/`type`
// shaped field is treated as a file part (matches expo-image-picker/
// expo-document-picker asset shape).
async function requestForm(path, fields) {
  const token = await SecureStore.getItemAsync('userToken');
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value && typeof value === 'object' && 'uri' in value) {
      form.append(key, { uri: value.uri, name: value.name || 'upload', type: value.type || 'application/octet-stream' });
    } else if (value !== undefined && value !== null) {
      form.append(key, value);
    }
  });

  const response = await fetch(`${INTERIOR_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error || data?.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

const interiorApiClient = {
  get: (path, params) => request(path, { method: 'GET', params }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  postForm: (path, fields) => requestForm(path, fields),
};

export default interiorApiClient;

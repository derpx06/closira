import { io } from 'socket.io-client';
import apiClient from './apiClient';
import { getAccessToken } from '../utils/authStorage';

function resolveSocketBaseUrl() {
  const apiBase = String(apiClient.defaults.baseURL || '').trim();
  if (!apiBase) {
    return window.location.origin;
  }

  if (apiBase.startsWith('/')) {
    return window.location.origin;
  }

  return apiBase.replace(/\/api\/?$/i, '');
}

export function createAgentSocket() {
  const token = getAccessToken();
  return io(resolveSocketBaseUrl(), {
    path: '/socket.io',
    transports: ['websocket'],
    auth: {
      token: token || '',
    },
    withCredentials: true,
  });
}


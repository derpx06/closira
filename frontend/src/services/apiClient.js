import axios from 'axios';
import loadingService from './loadingService';
import {
  clearAuthStorage,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from '../utils/authStorage';

export const AUTH_SESSION_EXPIRED_EVENT = 'auth:logout';

function resolveApiBaseURL() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv != null && String(fromEnv).trim() !== '') {
    return String(fromEnv).trim().replace(/\/+$/, '');
  }
  // Dev: same-origin /api so Vite proxy hits the backend (see vite.config.js server.proxy).
  if (import.meta.env.DEV) return '/api';
  // Production / preview without proxy: set VITE_API_BASE_URL to your API origin + /api
  return 'http://127.0.0.1:5000/api';
}

const apiClient = axios.create({
  baseURL: resolveApiBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

let isRefreshing = false;
let refreshQueue = [];

const notifyLoggedOut = () => {
  clearAuthStorage();
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
};

const processRefreshQueue = (error, accessToken = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(accessToken);
  });
  refreshQueue = [];
};

const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('Missing refresh token');
  }

  const response = await axios.post(
    `${apiClient.defaults.baseURL}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  );

  const payload = response?.data || {};
  const accessToken = payload.accessToken || payload.token;
  if (!accessToken) {
    throw new Error('Refresh token request did not return an access token.');
  }

  setAuthTokens({
    accessToken,
    refreshToken: payload.refreshToken || refreshToken,
  });

  return accessToken;
};

apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};

    const status = error.response?.status;
    const isUnauthorized = status === 401;
    const isRefreshRequest = (originalRequest.url || '').includes('/auth/refresh');
    const hasRefreshToken = !!getRefreshToken();

    if (
      isUnauthorized
      && hasRefreshToken
      && !originalRequest._retry
      && !isRefreshRequest
      && !originalRequest.skipAuthRefresh
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshedAccessToken = await refreshAccessToken();
        processRefreshQueue(null, refreshedAccessToken);

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${refreshedAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processRefreshQueue(refreshError, null);
        notifyLoggedOut();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (isUnauthorized) {
      notifyLoggedOut();
    }

    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      error.message =
        import.meta.env.DEV
          ? 'Cannot reach API. In dev, Vite proxies /api to the backend — ensure the backend is running and its PORT matches frontend/vite.config (reads ../backend/.env PORT, or set VITE_DEV_PROXY_TARGET).'
          : 'Network error: check API URL (VITE_API_BASE_URL) and that the server is reachable.';
    }

    return Promise.reject(error);
  },
);

export default apiClient;

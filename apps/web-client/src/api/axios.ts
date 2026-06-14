import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      return 'http://localhost:4000/api';
    }
  }
  return envUrl || 'http://localhost:4000/api';
};

const isProductionDomain = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return !(
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    );
  }
  return false;
};

function replaceLocalhostUrls(data: any): any {
  if (!data) return data;
  if (typeof data === 'string') {
    if (data.includes('localhost:9010')) {
      return data.replace(/https?:\/\/localhost:9010/g, 'https://bucket.techbarred.com');
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(replaceLocalhostUrls);
  }
  if (typeof data === 'object') {
    const proto = Object.getPrototypeOf(data);
    if (proto === null || proto === Object.prototype) {
      const nextData: any = {};
      for (const key of Object.keys(data)) {
        nextData[key] = replaceLocalhostUrls(data[key]);
      }
      return nextData;
    }
  }
  return data;
}

export const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.data && isProductionDomain()) {
      response.data = replaceLocalhostUrls(response.data);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      useAuthStore.getState().logout();
      const isSuperAdminPath = window.location.pathname.startsWith('/super-admin');
      window.location.href = isSuperAdminPath ? '/super-admin/login' : '/login';
    }
    return Promise.reject(error);
  }
);

// Also intercept global axios instance for standalone requests
axios.interceptors.response.use(
  (response) => {
    if (response.data && isProductionDomain()) {
      response.data = replaceLocalhostUrls(response.data);
    }
    return response;
  },
  (error) => Promise.reject(error)
);

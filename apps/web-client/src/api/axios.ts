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
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      useAuthStore.getState().logout();
      const isSuperAdminPath = window.location.pathname.startsWith('/super-admin');
      window.location.href = isSuperAdminPath ? '/super-admin/login' : '/login';
    }
    return Promise.reject(error);
  }
);

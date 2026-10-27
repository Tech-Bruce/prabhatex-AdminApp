import axios from 'axios';
import { tokenStore } from './tokenStore';

// ==========================================
// ==========================================
// 🔌 API CONNECTION SETTINGS
// ==========================================
// Manually change this URL to switch between local and production.
// Production: 'https://api.prabhatex.in/api/v1'
// Local (Wi-Fi): 'http://192.168.1.5:8080/api/v1'
// Local (Android Emulator): 'http://10.0.2.2:8080/api/v1'

// const BASE_URL = 'http://192.168.1.5:8080/api/v1'; // Update this manually!
const BASE_URL = 'https://api.prabhatex.in/api/v1'; // Update this manually!

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true, // Important for cookies
  headers: {
    'x-client-app': 'admin',
    'Accept': 'application/json',
  },
});

// Request interceptor: attach x-client-app and Bearer token reliably
api.interceptors.request.use(async (config) => {
  config.headers = config.headers || {};
  config.headers['x-client-app'] = 'admin';

  let token = tokenStore.get();
  if (!token) {
    try {
      token = await tokenStore.hydrate();
    } catch {
      // ignore
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type UnauthorizedCallback = () => void;
let onUnauthorized: UnauthorizedCallback | null = null;

export const setUnauthorizedCallback = (callback: UnauthorizedCallback | null) => {
  onUnauthorized = callback;
};

// Interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (onUnauthorized) {
        onUnauthorized();
      }
    }
    return Promise.reject(error);
  }
);


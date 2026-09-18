import axios from 'axios';

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
  withCredentials: true, // Important for cookies
});

// Interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // We can handle global 401s here to trigger a logout
    if (error.response && error.response.status === 401) {
      // Dispatch event or call a callback to clear auth state
    }
    return Promise.reject(error);
  }
);

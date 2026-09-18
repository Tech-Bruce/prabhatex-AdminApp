import { api } from './api';

export interface User {
  id: number;
  username: string;
  email: string;
  phoneNumber: string;
  avatar: string;
  role: string;
}

export const authApi = {
  login: async (data: { email?: string; phoneNumber?: string; password: string }) => {
    const response = await api.post('/login', data);
    return response.data as { success: boolean; message: string; user: User };
  },
  
  register: async (data: any) => {
    const response = await api.post('/register', data);
    return response.data as { success: boolean; message: string; user: User };
  },

  logout: async () => {
    const response = await api.post('/logout');
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/profile');
    return response.data as { success: boolean; message: string; user: User };
  }
};

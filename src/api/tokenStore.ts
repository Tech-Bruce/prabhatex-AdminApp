import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ADMIN_TOKEN_KEY = 'prabhatex_admin_token';
let cachedToken: string | null = null;

export const tokenStore = {
  get(): string | null {
    return cachedToken;
  },

  set(token: string | null): void {
    cachedToken = token;
  },

  async hydrate(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          cachedToken = window.localStorage.getItem(ADMIN_TOKEN_KEY);
        }
      } else {
        cachedToken = await SecureStore.getItemAsync(ADMIN_TOKEN_KEY);
      }
    } catch (e) {
      console.warn('Failed to hydrate admin token', e);
      cachedToken = null;
    }
    return cachedToken;
  },

  async save(token: string): Promise<void> {
    cachedToken = token;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
        }
      } else {
        await SecureStore.setItemAsync(ADMIN_TOKEN_KEY, token, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      }
    } catch (e) {
      console.warn('Failed to save admin token', e);
    }
  },

  async clear(): Promise<void> {
    cachedToken = null;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(ADMIN_TOKEN_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(ADMIN_TOKEN_KEY);
      }
    } catch (e) {
      console.warn('Failed to clear admin token', e);
    }
  },
};

import { Platform } from 'react-native';

function getWebStorage(kind: 'local' | 'session'): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJsonStorage<T>(key: string, kind: 'local' | 'session' = 'local'): T | null {
  const storage = getWebStorage(kind);
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJsonStorage(key: string, value: unknown, kind: 'local' | 'session' = 'local'): void {
  const storage = getWebStorage(kind);
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode — ignore
  }
}

export function removeStorageKey(key: string, kind: 'local' | 'session' = 'local'): void {
  const storage = getWebStorage(kind);
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Authenticated fetch helper.
 * Auto-attaches session_token from AsyncStorage as `Authorization: Bearer <token>`
 * and sends credentials for cookie auth (for web).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export async function getSessionToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem('session_token');
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string | null) {
  try {
    if (token) await AsyncStorage.setItem('session_token', token);
    else await AsyncStorage.removeItem('session_token');
  } catch {}
}

/**
 * Wrapper around fetch that injects Authorization header and includes credentials.
 * @param path  Either a path like `/api/auth/me` or a full URL.
 * @param init  Standard RequestInit. `body` may be a plain object (auto-JSON) or string/FormData.
 */
export async function apiFetch(path: string, init: RequestInit & { jsonBody?: any } = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${BACKEND_URL}${path}`;
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  // Attach token
  const token = await getSessionToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body = init.body;
  if (init.jsonBody !== undefined) {
    body = JSON.stringify(init.jsonBody);
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  }

  return fetch(url, {
    ...init,
    headers,
    body,
    credentials: 'include',
  });
}

export async function apiGet<T = any>(path: string): Promise<T | null> {
  try {
    const resp = await apiFetch(path);
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T | null> {
  try {
    const resp = await apiFetch(path, { method: 'POST', jsonBody: body ?? {} });
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

export async function apiDelete<T = any>(path: string): Promise<T | null> {
  try {
    const resp = await apiFetch(path, { method: 'DELETE' });
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

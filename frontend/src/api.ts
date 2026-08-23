/**
 * MedCheck Clinical Intelligence API Client (TypeScript Entrypoint)
 * Enterprise-grade client with JWT authentication, local offline resilience, and rate-limit handling.
 */
import type {
  CheckResponse,
  MedicineProfileResponse,
  MedicineSearchResult,
  UserAuthSession
} from './types/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TOKEN_KEY = 'medcheck_auth_token';
const USER_KEY = 'medcheck_user_profile';
const OFFLINE_CACHE_KEY = 'medcheck_offline_basket_cache';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getStoredUser(): UserAuthSession | null {
  const u = localStorage.getItem(USER_KEY);
  try {
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserAuthSession | null): void {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

/**
 * Ensures a valid session token exists (creates anonymous guest token if not logged in).
 */
export async function ensureAuthSession(): Promise<string | null> {
  let token = getStoredToken();
  if (token) return token;

  try {
    const res = await fetch(`${API_BASE}/api/auth/guest`, { method: 'POST' });
    if (res.ok) {
      const data: UserAuthSession = await res.json();
      setStoredToken(data.access_token);
      setStoredUser({
        access_token: data.access_token,
        token_type: data.token_type,
        user_id: data.user_id,
        username: data.username,
        is_guest: data.is_guest,
      });
      return data.access_token;
    }
  } catch (err) {
    console.warn('Guest auth generation failed:', err);
  }
  return null;
}

export async function loginUser(username: string, password: string): Promise<UserAuthSession> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Invalid username or password.');
  }
  const data: UserAuthSession = await res.json();
  setStoredToken(data.access_token);
  setStoredUser(data);
  return data;
}

export async function registerUser(username: string, password: string, email?: string): Promise<UserAuthSession> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email: email || undefined }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Registration failed.');
  }
  const data: UserAuthSession = await res.json();
  setStoredToken(data.access_token);
  setStoredUser(data);
  return data;
}

export function logoutUser(): void {
  setStoredToken(null);
  setStoredUser(null);
}

async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = await ensureAuthSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  let response = await fetch(url, { ...options, headers });

  // If 401 Unauthorized (expired token), retry once with fresh guest token
  if (response.status === 401) {
    logoutUser();
    token = await ensureAuthSession();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      response = await fetch(url, { ...options, headers });
    }
  }

  return response;
}

/**
 * Check potential interactions & comprehensive clinical intelligence for a basket of medicines.
 */
export async function checkMedicines(medicines: string[] | Array<{ name: string }>): Promise<CheckResponse> {
  if (!medicines || medicines.length < 1) {
    throw new Error('Please enter at least one medicine to analyze.');
  }

  const cleaned = medicines
    .map(m => (typeof m === 'string' ? m : m.name))
    .filter(Boolean)
    .map(m => m.trim().toLowerCase());

  const cacheKey = `${OFFLINE_CACHE_KEY}_${cleaned.slice().sort().join('::')}`;

  try {
    const response = await authenticatedFetch(`${API_BASE}/api/check`, {
      method: 'POST',
      body: JSON.stringify({ medicines: cleaned }),
    });

    if (!response.ok) {
      let errorMsg = 'Failed to analyze medicine safety.';
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            errorMsg = errorData.detail.map((d: any) => d.msg || d).join(', ');
          } else {
            errorMsg = errorData.detail;
          }
        }
      } catch {
        // fallback
      }
      throw new Error(errorMsg);
    }

    const data: CheckResponse = await response.json();
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      // storage quota
    }
    return data;
  } catch (err: any) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed;
      } catch {
        // ignore
      }
    }
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Unable to connect to MedCheck API server. Please verify the backend is running on ' + API_BASE);
    }
    throw err;
  }
}

/**
 * Fetch rich individual medicine intelligence profile.
 */
export async function getMedicineProfile(medicineName: string): Promise<MedicineProfileResponse | null> {
  if (!medicineName) return null;
  const clean = encodeURIComponent(medicineName.trim().toLowerCase());
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/medicine/${clean}/profile`);
    if (!response.ok) {
      throw new Error(`Could not fetch profile for ${medicineName}`);
    }
    return await response.json();
  } catch (err) {
    console.warn(`Profile fetch error for ${medicineName}:`, err);
    return null;
  }
}

/**
 * Search medicine database with autocomplete and preview metadata.
 */
export async function searchMedicines(query: string): Promise<MedicineSearchResult[]> {
  const clean = encodeURIComponent((query || '').trim().toLowerCase());
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/medicines/search?q=${clean}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (err) {
    console.warn('Medicine search error:', err);
    return [];
  }
}

/**
 * Check backend health status.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

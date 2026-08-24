/**
 * MedCheck Clinical Intelligence API Client
 *
 * Single source of truth for every call to the FastAPI backend. This file
 * replaces the former trio of `lib/api.js`, `api.js` (a re-export shim) and
 * `api.ts` (an unreferenced duplicate); the extensionless import sites
 * (`from '../lib/api'`) resolve here because Vite tries `.ts` once no `.js`
 * sibling exists.
 *
 * Two deliberate design points:
 *
 *  - Session token lives in memory only. The backend also sets the same JWT as
 *    an httpOnly `medcheck_session` cookie, so on a full page reload the browser
 *    re-authenticates from that cookie rather than from anything JavaScript can
 *    read. A token in localStorage survives XSS; a token in a closure and an
 *    httpOnly cookie does not. Every request therefore sends `credentials:
 *    'include'` so that cookie rides along.
 *
 *  - Errors are typed as `unknown` and narrowed, never `any`. The backend's
 *    error envelope (`{ detail: string | ValidationError[] }`) is modelled
 *    explicitly so a shape change is a compile-time signal, not a silent
 *    `undefined`.
 */
import type {
  CheckResponse,
  MedicineProfileResponse,
  MedicineSearchResult,
  UserAuthSession,
} from '../types/api';

const API_BASE: string = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Non-sensitive display profile (username, guest flag) may stay in localStorage:
// it is not a credential and losing it only costs a name in the navbar. The JWT
// itself is intentionally NOT persisted here -- see the module header.
const USER_KEY = 'medcheck_user_profile';
const OFFLINE_CACHE_KEY = 'medcheck_offline_basket_cache';

/** In-memory session token. Reset to null on every page load by design. */
let sessionToken: string | null = null;

interface StoredUser {
  user_id: string;
  username: string;
  is_guest: boolean;
}

/** Shape of the FastAPI error body: a plain string, or Pydantic's error list. */
interface ValidationErrorItem {
  msg?: string;
  loc?: (string | number)[];
  type?: string;
}
interface ApiErrorBody {
  detail?: string | ValidationErrorItem[];
}

export function getStoredToken(): string | null {
  return sessionToken;
}

export function setStoredToken(token: string | null): void {
  sessionToken = token || null;
}

export function getStoredUser(): StoredUser | null {
  const u = localStorage.getItem(USER_KEY);
  try {
    return u ? (JSON.parse(u) as StoredUser) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser | null): void {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

/**
 * Reads a backend error body and reduces it to a single human-readable string.
 * Accepts `unknown` because a failed response may not be JSON at all.
 */
function extractErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const detail = (body as ApiErrorBody).detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => (typeof d === 'string' ? d : d.msg))
      .filter((m): m is string => Boolean(m));
    if (parts.length) return parts.join(', ');
  }
  return fallback;
}

/**
 * Ensures a session exists. Returns the in-memory token if present; otherwise
 * mints an anonymous guest session. The guest path is also the first-visit path,
 * so a page reload that dropped the in-memory token transparently re-establishes
 * a session here without the user noticing.
 */
export async function ensureAuthSession(): Promise<string | null> {
  if (sessionToken) return sessionToken;

  try {
    const res = await fetch(`${API_BASE}/api/auth/guest`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      const data = (await res.json()) as UserAuthSession;
      setStoredToken(data.access_token);
      setStoredUser({
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
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractErrorMessage(body, 'Invalid username or password.'));
  }
  const data = (await res.json()) as UserAuthSession;
  setStoredToken(data.access_token);
  setStoredUser({ user_id: data.user_id, username: data.username, is_guest: false });
  return data;
}

export async function registerUser(
  username: string,
  password: string,
  email?: string,
): Promise<UserAuthSession> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password, email: email || undefined }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractErrorMessage(body, 'Registration failed.'));
  }
  const data = (await res.json()) as UserAuthSession;
  setStoredToken(data.access_token);
  setStoredUser({ user_id: data.user_id, username: data.username, is_guest: false });
  return data;
}

/**
 * Ends the session. Clears the in-memory token and stored profile immediately,
 * then asks the backend to delete the httpOnly cookie. The network call is
 * best-effort: local state is already gone, so a failed request cannot leave the
 * user appearing logged in.
 */
export async function logoutUser(): Promise<void> {
  setStoredToken(null);
  setStoredUser(null);
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    // The cookie is httpOnly and Lax; if this call fails it expires on its own.
  }
}

async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = await ensureAuthSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  let response = await fetch(url, { ...options, credentials: 'include', headers });

  // A 401 means the token (in memory or cookie) has expired. Drop it and mint a
  // fresh guest session, then retry once.
  if (response.status === 401) {
    await logoutUser();
    token = await ensureAuthSession();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      response = await fetch(url, { ...options, credentials: 'include', headers });
    }
  }

  return response;
}

/**
 * Check interactions & comprehensive clinical intelligence for a basket of
 * medicines. Falls back to the last cached response for the same basket when the
 * network is unreachable.
 */
export async function checkMedicines(
  medicines: (string | { name: string })[],
): Promise<CheckResponse> {
  if (!medicines || medicines.length < 1) {
    throw new Error('Please enter at least one medicine to analyze.');
  }

  const cleaned = medicines
    .map((m) => (typeof m === 'string' ? m : m.name))
    .filter(Boolean)
    .map((m) => m.trim().toLowerCase());

  const cacheKey = `${OFFLINE_CACHE_KEY}_${cleaned.slice().sort().join('::')}`;

  try {
    const response = await authenticatedFetch(`${API_BASE}/api/check`, {
      method: 'POST',
      body: JSON.stringify({ medicines: cleaned }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(extractErrorMessage(body, 'Failed to analyze medicine safety.'));
    }

    const data = (await response.json()) as CheckResponse;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      // ignore storage quota
    }
    return data;
  } catch (err: unknown) {
    // Offline fallback: serve the last good analysis for this exact basket.
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CheckResponse & { _offline?: boolean };
        parsed._offline = true;
        return parsed;
      } catch {
        // ignore
      }
    }
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error(
        `Unable to connect to MedCheck API server. Please verify the backend is running on ${API_BASE}`,
      );
    }
    throw err instanceof Error ? err : new Error('Failed to analyze medicine safety.');
  }
}

/** Fetch a rich individual medicine intelligence profile. */
export async function getMedicineProfile(
  medicineName: string,
): Promise<MedicineProfileResponse | null> {
  if (!medicineName) return null;
  const clean = encodeURIComponent(medicineName.trim().toLowerCase());
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/medicine/${clean}/profile`);
    if (!response.ok) {
      throw new Error(`Could not fetch profile for ${medicineName}`);
    }
    return (await response.json()) as MedicineProfileResponse;
  } catch (err: unknown) {
    console.warn(`Profile fetch error for ${medicineName}:`, err);
    return null;
  }
}

/** Search the medicine database with autocomplete and preview metadata. */
export async function searchMedicines(query: string): Promise<MedicineSearchResult[]> {
  const clean = encodeURIComponent((query || '').trim().toLowerCase());
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/medicines/search?q=${clean}`);
    if (!response.ok) return [];
    return (await response.json()) as MedicineSearchResult[];
  } catch (err: unknown) {
    console.warn('Medicine search error:', err);
    return [];
  }
}

/** Check backend health status. */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

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
  CatalogueProduct,
  CatalogueSearchResponse,
  ChatResponse,
  CheckResponse,
  IndiaBanAlert,
  IndiaBanInfo,
  IndiaBannedSearchItem,
  IndiaBannedSearchResponse,
  MedicineProfileResponse,
  MedicineSearchResult,
  PasswordResetConfirmResponse,
  PasswordResetRequestResponse,
  UserAuthSession,
} from '../types/api';

export type {
  CatalogueProduct,
  CatalogueSearchResponse,
  IndiaBanAlert,
  IndiaBanInfo,
  IndiaBannedSearchItem,
  IndiaBannedSearchResponse,
};

const API_BASE: string =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? '' : 'http://localhost:8000');

// Non-sensitive display profile (username, guest flag) may stay in localStorage:
// it is not a credential and losing it only costs a name in the navbar. The JWT
// itself is intentionally NOT persisted here -- see the module header.
const USER_KEY = 'medcheck_user_profile';
const OFFLINE_CACHE_KEY = 'medcheck_offline_basket_cache';

/** In-memory session token. Reset to null on every page load by design. */
let sessionToken: string | null = null;
let authPromise: Promise<string | null> | null = null;

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
  /**
   * Per-field messages from the backend's RequestValidationError handler
   * (`main.py:validation_exception_handler`), formatted as "field: message".
   *
   * This field was previously absent from the interface, so every 422 from the
   * API surfaced only its companion `detail` -- the deliberately generic "Input
   * validation failed. Please check the provided parameters." The actionable
   * part ("medicines.0: Invalid characters detected...") was parsed and
   * discarded, leaving the user a message that named neither the field nor the
   * problem.
   */
  errors?: string[];
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
 *
 * `errors` is checked before `detail` on purpose. When the backend emits both,
 * `detail` is the generic envelope and `errors` holds the per-field specifics,
 * so preferring `detail` would always throw away the only useful half.
 */
function extractErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const { detail, errors } = body as ApiErrorBody;

  if (Array.isArray(errors)) {
    const fieldMessages = errors
      .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
      .map((e) => e.trim());
    if (fieldMessages.length) return fieldMessages.join(' • ');
  }

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
  if (authPromise) return authPromise;

  authPromise = (async () => {
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
    } finally {
      authPromise = null;
    }
    return null;
  })();

  return authPromise;
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

export async function requestPasswordReset(
  username: string,
): Promise<PasswordResetRequestResponse> {
  const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractErrorMessage(body, 'Unable to request password reset.'));
  }
  return (await res.json()) as PasswordResetRequestResponse;
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<PasswordResetConfirmResponse> {
  const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      extractErrorMessage(
        body,
        'This reset link is invalid or has expired. Please request a new one.',
      ),
    );
  }
  return (await res.json()) as PasswordResetConfirmResponse;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TypeError('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const timeoutMs = url.includes('/api/check') ? 60000 : url.includes('/api/chat') ? 30000 : 15000;
  let token = await ensureAuthSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  let response = await fetchWithTimeout(url, { ...options, credentials: 'include', headers }, timeoutMs);

  // A 401 means the token (in memory or cookie) has expired.
  if (response.status === 401) {
    const user = getStoredUser();
    if (user && !user.is_guest) {
      await logoutUser();
      throw new Error('Session expired. Please log in again.');
    }
    await logoutUser();
    token = await ensureAuthSession();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      response = await fetchWithTimeout(url, { ...options, credentials: 'include', headers }, timeoutMs);
    }
  }

  return response;
}

/**
 * Check interactions & curated clinical intelligence for a basket of
 * medicines. Falls back to the last cached response for the same basket when the
 * network is unreachable.
 *
 * `patientWakeTime` anchors the backend's 24-hour administration timeline. The
 * backend has accepted it since the endpoint was written, but no caller ever
 * sent it, so every patient received a timeline anchored to the hardcoded
 * 07:00 AM default regardless of when they actually wake. Formats accepted by
 * `CheckRequest.validate_wake_time`: '07:00 AM' (12-hour) or '07:00' (24-hour).
 */
export async function checkMedicines(
  medicines: (string | { name: string })[],
  patientWakeTime?: string | null,
): Promise<CheckResponse> {
  if (!medicines || medicines.length < 1) {
    throw new Error('Please enter at least one medicine to analyze.');
  }

  const cleaned = medicines
    .map((m) => (typeof m === 'string' ? m : m.name))
    .filter(Boolean)
    .map((m) => m.trim().toLowerCase());

  const wakeTime = (patientWakeTime || '').trim();

  // The wake time is part of the cache key: two analyses of the same basket at
  // different wake times produce different timelines, so sharing one cache entry
  // would serve a stale schedule.
  const cacheKey = `${OFFLINE_CACHE_KEY}_${cleaned.slice().sort().join('::')}${
    wakeTime ? `@${wakeTime}` : ''
  }`;

  try {
    const response = await authenticatedFetch(`${API_BASE}/api/check`, {
      method: 'POST',
      body: JSON.stringify({
        medicines: cleaned,
        // Omitted entirely when blank. Sending `null` is equivalent here (the
        // field is Optional), but omitting keeps the payload minimal and matches
        // what the endpoint documents as "not supplied".
        ...(wakeTime ? { patient_wake_time: wakeTime } : {}),
      }),
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
    // Offline fallback: serve the last good analysis for this exact basket ONLY on network failure
    if (err instanceof TypeError) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CheckResponse;
          parsed._offline = true;
          return parsed;
        } catch {
          // ignore corrupted local storage
        }
      }
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
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Search request failed with status ${response.status}: ${errorText || response.statusText}`);
    }
    return (await response.json()) as MedicineSearchResult[];
  } catch (err: unknown) {
    console.warn('Medicine search error:', err);
    throw err;
  }
}

/** Ask the grounded medicine assistant about a medicine or a follow-up question. */
export async function chatAboutMedicine(
  medicine: string,
  question?: string | null,
): Promise<ChatResponse> {
  const trimmedMedicine = (medicine || '').trim();
  if (!trimmedMedicine) {
    throw new Error('Please enter a medicine name.');
  }
  const trimmedQuestion = question ? question.trim() : null;

  try {
    const response = await authenticatedFetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({
        medicine: trimmedMedicine,
        question: trimmedQuestion || null,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(extractErrorMessage(body, 'Unable to read the medicine label right now.'));
    }

    return (await response.json()) as ChatResponse;
  } catch (err: unknown) {
    if (err instanceof TypeError) {
      throw new Error(
        `Unable to reach the MedCheck API server. Please verify the backend is running on ${API_BASE}`,
      );
    }
    throw err instanceof Error ? err : new Error('Unable to read the medicine label right now.');
  }
}

/** Search India's official CDSCO banned and halted medicines list. */
export async function searchIndiaBanned(
  query: string = '',
  limit: number = 20,
): Promise<IndiaBannedSearchResponse> {
  const cleanQuery = encodeURIComponent((query || '').trim());
  try {
    const response = await authenticatedFetch(
      `${API_BASE}/api/india/banned?query=${cleanQuery}&limit=${limit}`,
    );
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(extractErrorMessage(body, 'Failed to search India banned medicines list.'));
    }
    return (await response.json()) as IndiaBannedSearchResponse;
  } catch (err: unknown) {
    if (err instanceof TypeError) {
      throw new Error(
        `Unable to reach the MedCheck API server. Please verify the backend is running on ${API_BASE}`,
      );
    }
    throw err instanceof Error ? err : new Error('Failed to search India banned medicines list.');
  }
}

/** Search the Indian medicines brand reference catalogue. */
export async function searchIndiaCatalogue(
  query: string = '',
  limit: number = 10,
): Promise<CatalogueSearchResponse> {
  const cleanQuery = encodeURIComponent((query || '').trim());
  try {
    const response = await authenticatedFetch(
      `${API_BASE}/api/india/catalogue/search?query=${cleanQuery}&limit=${limit}`,
    );
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(extractErrorMessage(body, 'Failed to search Indian medicines catalogue.'));
    }
    return (await response.json()) as CatalogueSearchResponse;
  } catch (err: unknown) {
    if (err instanceof TypeError) {
      throw new Error(
        `Unable to reach the MedCheck API server. Please verify the backend is running on ${API_BASE}`,
      );
    }
    throw err instanceof Error ? err : new Error('Failed to search Indian medicines catalogue.');
  }
}

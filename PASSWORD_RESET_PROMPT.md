# MEDCHECK: password recovery (forgot / reset password)

MEDCHECK's Auth page has Guest Access, Sign In and Create Account, but a user who
forgets their password has no way back in. Add a complete password recovery flow:
request a reset link by username, open the link, set a new password, sign in.

Facts about the current code (verified, do not re-litigate):

- Users live in SQLite at `settings.SQLITE_DB_PATH`, table `users`
  (id, username UNIQUE lowercased, email UNIQUE nullable, hashed_password,
  is_guest, created_at). Auth logic is in `backend/services/auth.py`
  (bcrypt via `get_password_hash` / `verify_password`, users created and fetched
  through `_get_sqlite_auth_conn()` + `anyio.to_thread.run_sync` wrappers).
- Auth endpoints live in `backend/main.py` under the AUTHENTICATION ENDPOINTS
  banner: register, login, guest, logout. All use
  `@limiter.limit(settings.RATE_LIMIT_AUTH)` ("10/minute").
- Password rules live in `backend/models.py` `UserCreate.validate_password_complexity`:
  min 8 characters, max 72 BYTES (bcrypt limit), at least one uppercase, one
  lowercase, one digit. `MIN_PASSWORD_LENGTH` and `MAX_PASSWORD_BYTES` are the
  constants. The reset flow must enforce exactly these rules with exactly these
  error messages.
- **There is no email service anywhere in this project**: no SMTP settings in
  `backend/config.py`, no mail library in requirements. Accounts may not even
  have an email (the field is optional at registration). So the reset link
  cannot be emailed today. Delivery for now is the server log (the standard
  development console-mail pattern), clearly marked as such in a code comment.
  Do NOT invent an email sender, do NOT add an email dependency, and do NOT
  return the token in any API response.
- Frontend: `frontend/src/pages/Auth.jsx` is the registry sheet (modes 'guest',
  'login', 'register' in a ruled ledger; errors render in the `.ed-notice-crit`
  sheet; inputs use INPUT_CLASS / LABEL_CLASS; `describePasswordProblem` and
  `PASSWORD_RULE_HINT` already exist there). Auth API calls live in
  `frontend/src/lib/api.ts` (`loginUser`, `registerUser`, `logoutUser`).

## Backend

### 1. `backend/config.py`

Add two settings with explanatory comments:

- `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30`
- `PASSWORD_RESET_LINK_BASE: str = "http://localhost:5173/auth"` — the Auth page
  URL the reset link points at; a deployment overrides it with its real /auth URL.

### 2. `backend/services/auth.py`

- New table in the same SQLite database, created next to the users table init
  (same `CREATE TABLE IF NOT EXISTS` pattern):
  `password_resets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`, plus an index on token_hash.
- `create_password_reset(username) -> Optional[str]` (async wrapper over a sync
  helper, following the existing pattern):
  - Look the user up by lowercased username. Return None when there is no such
    user OR the user is a guest (`is_guest`) — guest accounts are anonymous with
    random passwords and must never be resettable.
  - Delete (or mark used) every previous unused reset row for that user: a new
    request invalidates older links.
  - Generate the token with `secrets.token_urlsafe(32)`. Store ONLY
    `hashlib.sha256(token.encode()).hexdigest()` in token_hash. The raw token
    exists only in this function's return value. Never store it, never log it
    anywhere except the single delivery log line in the endpoint below.
  - expires_at = now (UTC) + `settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES`,
    stored as an ISO 8601 string.
  - Return the raw token.
- `reset_password_with_token(token, new_password) -> bool` (same async pattern):
  - Hash the presented token the same way and find the row by token_hash.
  - Return False when: no row, `used_at` is set, or expires_at is in the past.
  - On success: update that user's `hashed_password` to
    `get_password_hash(new_password)`, set `used_at` to now (UTC ISO), return True.
    One token, one use.

### 3. `backend/models.py`

- Factor the password complexity validation so registration and reset share ONE
  implementation: extract the body of `UserCreate.validate_password_complexity`
  into a module-level function and call it from both models. UserCreate's
  behaviour and error message text must stay byte-identical (existing tests
  assert on them).
- `PasswordResetRequest`: `username: str` (min_length 1, max_length 50).
- `PasswordResetConfirm`: `token: str` (min_length 20, max_length 200),
  `new_password: str` with the same Field bounds as UserCreate.password and the
  shared complexity validator.

### 4. `backend/main.py` — two endpoints in the AUTHENTICATION ENDPOINTS section, after logout

- `POST /api/auth/forgot-password`, rate-limited with
  `@limiter.limit(settings.RATE_LIMIT_AUTH)`, body `PasswordResetRequest`:
  - ALWAYS respond 200 with exactly:
    `{"message": "If an account with that username exists, a password reset link has been created. The link is valid for 30 minutes."}`
    (build the minutes from the setting). The response must be identical whether
    or not the account exists: no account enumeration.
  - When `create_password_reset` returns a token, write ONE info log line:
    `Password reset link for user '<username>': {settings.PASSWORD_RESET_LINK_BASE}?reset_token={token}`
    with a code comment directly above it explaining: MEDCHECK has no email
    service configured, so the link is delivered through the server log for now;
    when an email service is configured, send the link there and delete this log
    line, because a token in a log is a credential in a log.
- `POST /api/auth/reset-password`, same rate limit, body `PasswordResetConfirm`:
  - Success: 200 `{"status": "password_updated", "message": "Your password has been updated. Please sign in with your new password."}`
  - Invalid, expired or already-used token: 400 with detail exactly:
    `"This reset link is invalid or has expired. Please request a new one."`
  - A weak new password is rejected by the model validator as a normal 422.

### 5. Tests — new file `backend/tests/test_password_reset.py`

Follow the conventions of `backend/tests/test_auth.py` (same fixtures/client
style). Cover at least:

- forgot for an existing user: 200, the exact generic message, a password_resets
  row exists, and the stored token_hash is NOT the raw token (fetch the raw
  token by calling the service function directly in the test).
- forgot for an unknown username: identical status and identical response body,
  and no row is created.
- forgot for a guest user: identical generic response, no row created.
- full flow over HTTP: register a user, forgot, reset with the service-issued
  token, login with the OLD password returns 401, login with the NEW password
  returns 200.
- expired token (row with a past expires_at): reset returns 400 with the exact
  detail text.
- token reuse: a second reset with the same token returns 400.
- requesting a second link invalidates the first token (reset with it: 400).
- weak new password (for example all lowercase with a digit): 422.

## Frontend

### 6. `frontend/src/lib/api.ts`

Add `requestPasswordReset(username)` and `resetPassword(token, newPassword)`
following the exact fetch, base-URL and error-extraction pattern of `loginUser`
and `registerUser` in the same file. POST JSON to `/api/auth/forgot-password`
and `/api/auth/reset-password` respectively.

### 7. `frontend/src/pages/Auth.jsx`

- Read the `reset_token` query parameter with react-router's `useSearchParams`.
- **Set New Password view**: when a non-empty `reset_token` is present, render
  this view INSTEAD of the mode ledger and the three mode forms (masthead,
  scenarios, footnote and disclaimer stay). Contents:
  - A mono line above the form: "RESET PASSWORD" in the same kicker style as
    the sheet's other labels.
  - New Password field and Confirm New Password field, both reusing
    INPUT_CLASS / LABEL_CLASS / LockIcon, `autoComplete="new-password"`, and
    the existing PASSWORD_RULE_HINT line under the new password field.
  - Validate with the existing `describePasswordProblem`; if the two fields
    differ, set the error to exactly: "The two passwords do not match."
  - Submit button "Set New Password" (mono loading text "UPDATING" while busy,
    same disabled treatment as the other forms).
  - On success: replace the form with a forest confirmation block in the same
    style family as the Signed-in docket (bg-[#e8eee3], border-[#2d4a22],
    border-t-[3px]) reading "Your password has been updated. Please sign in
    with your new password." and an outline button "Go to Sign In" that clears
    the query parameter (setSearchParams) and sets mode to 'login'.
  - On API error (invalid or expired link): show the server's message in the
    existing `.ed-notice-crit` error sheet, and under the form add a plain
    "Request a new reset link" text button that switches to the Forgot view
    below (and clears the query parameter).
- **Forgot Password view**: in Sign In mode, under the password field, add a
  right-aligned text button "Forgot password?" styled like the guest footnote
  link (mono, small, underline on hover). Clicking it sets a new mode value
  'forgot' (the ledger selector stays visible; no ledger entry is active in
  this mode, which is fine). The view:
  - Mono line "RESET PASSWORD", one Username field (UserIcon, INPUT_CLASS),
    submit button "Create Reset Link" (loading text "CREATING LINK").
  - On submit, whatever the outcome of the API call, show the server's returned
    message (the endpoint's generic sentence) in a bordered ink notice
    (border-[#1a1a18], parchment background, serif text): the UI must never
    reveal whether the account exists.
  - A "Back to Sign In" text button returns to mode 'login'.
  - Switching into or out of this view clears errorMsg, like the existing mode
    selector does.
- All copy in plain language, no em dashes, no emojis. Editorial standard only:
  no rounded corners, no shadows, no blur, no new icons (reuse the existing
  landing-icons set), severity and notice colours unchanged.

## Hard rules

- No new dependencies, frontend or backend (stdlib `secrets` and `hashlib` only).
- Never store, return or log a raw reset token anywhere except the single
  delivery log line in the forgot-password endpoint.
- Do not change the behaviour or response shape of register, login, guest or
  logout. Do not change any clinical endpoint.
- No push, no deploy. Local changes only.

## Checks before you report done

- Full backend test suite passes, including the new test_password_reset.py and
  the untouched test_auth.py.
- `npm run typecheck` and `npm run build` pass in frontend/.
- A manual curl walk against the running backend: register a throwaway user,
  POST forgot-password, take the link from the backend log, POST
  reset-password, confirm login with the old password returns 401 and with the
  new password returns 200.
- Report: files changed, test counts, and the curl walk results.

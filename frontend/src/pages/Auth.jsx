import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useMedicine } from '../context/MedicineContext';
import { loginUser, registerUser, getStoredUser, logoutUser } from '../lib/api';
import { ShieldCheck, ArrowRight, User, Lock, Mail, AlertTriangle, LogOut, CheckCircle2, Sparkles } from 'lucide-react';

// Mirrors the backend policy in models.py (UserCreate.validate_password_complexity).
// Validating here is a UX affordance only -- the server remains the authority --
// but the two must agree, or the form accepts a password the API then rejects
// with an opaque 422.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;
const PASSWORD_RULE_HINT = 'Min 8 chars, with upper, lower & a digit';

/**
 * UTF-8 byte length of a string.
 *
 * bcrypt's 72-unit limit is measured in BYTES, and so is the backend's check
 * (`len(v.encode("utf-8")) > 72`). JavaScript's `String.length` counts UTF-16 code
 * units, which is a different number for anything outside ASCII: a 40-character
 * passphrase of CJK glyphs is 120 bytes, and 30 emoji are 120 bytes at
 * `.length === 60`. The old `password.length > 72` therefore passed those
 * client-side and the server rejected them with a message about a limit the user
 * appeared to be well inside -- while a 72-character ASCII password was accepted
 * by both, so the mismatch never showed up in testing.
 *
 * TextEncoder is available in every browser this app targets.
 *
 * @param {string} value
 * @returns {number}
 */
function utf8ByteLength(value) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  // Defensive only. Matches TextEncoder for the whole BMP plus surrogate pairs.
  return unescape(encodeURIComponent(value)).length;
}

function describePasswordProblem(password) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  // bcrypt silently truncates at 72 BYTES, so the backend rejects anything longer
  // rather than hash a password whose tail is ignored.
  const byteLength = utf8ByteLength(password);
  if (byteLength > MAX_PASSWORD_BYTES) {
    return password.length <= MAX_PASSWORD_BYTES
      // Naming the byte count is the only way this message makes sense to someone
      // looking at a password that is visibly shorter than 72 characters.
      ? `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer. Accented, emoji and non-Latin characters count as 2-4 bytes each, so this one is ${byteLength} bytes.`
      : `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer.`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }
  return null;
}

export function Auth() {
  const [mode, setMode] = useState('guest'); // 'guest' | 'login' | 'register'
  const [userName, setUserName] = useState(() => localStorage.getItem('medcheck_user_name') || '');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());

  const { loadScenario } = useMedicine();
  const navigate = useNavigate();

  const handleGuestAccess = (e) => {
    e.preventDefault();
    if (userName.trim()) {
      localStorage.setItem('medcheck_user_name', userName.trim());
    }
    navigate('/app');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setErrorMsg('Please enter both username and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await loginUser(usernameInput.trim(), passwordInput.trim());
      setCurrentUser(user);
      localStorage.setItem('medcheck_user_name', user.username);
      // Drop the plaintext password from component state as soon as it has been
      // exchanged for a session. Holding it keeps a live credential in the React
      // tree (visible in DevTools and in any error/state snapshot) for the rest
      // of the page's life, long after it is needed.
      setPasswordInput('');
      navigate('/app');
    } catch (err) {
      setPasswordInput('');
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setErrorMsg('Please enter a valid username and password.');
      return;
    }
    const passwordProblem = describePasswordProblem(passwordInput);
    if (passwordProblem) {
      setErrorMsg(passwordProblem);
      return;
    }
    setLoading(true);
    try {
      const user = await registerUser(usernameInput.trim(), passwordInput.trim(), emailInput.trim());
      setCurrentUser(user);
      localStorage.setItem('medcheck_user_name', user.username);
      setPasswordInput('');
      navigate('/app');
    } catch (err) {
      setPasswordInput('');
      setErrorMsg(err.message || 'Registration failed. Username may already exist.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // logoutUser also asks the backend to delete the httpOnly session cookie; the
    // local state below is cleared synchronously so the UI never lags the intent.
    logoutUser();
    setCurrentUser(null);
    setPasswordInput('');
    localStorage.removeItem('medcheck_user_name');
  };

  const handleProfileSelect = (scenarioKey) => {
    loadScenario(scenarioKey);
    navigate('/app');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Navbar />

      <main className="flex-1 pt-24 pb-12 px-4 sm:px-8 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <div className="w-full card flex flex-col gap-4">
          {/* Top Logo */}
          <div className="text-center">
            <div className="w-9 h-9 rounded-[4px] bg-[var(--accent)] text-[var(--text-inverse)] flex items-center justify-center font-bold mx-auto mb-2">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="font-serif text-[28px] font-bold text-[var(--text-primary)] tracking-tight">
              MEDCHECK Access
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 font-sans">
              Clinical pharmacology security & patient profile session management.
            </p>
          </div>

          {/* Current Logged In State Banner */}
          {currentUser && !currentUser.is_guest && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-[6px] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Signed in as <strong>{currentUser.username}</strong></span>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-[var(--bg-elevated)] p-1 rounded-[6px] border border-[var(--border-default)]">
            <button
              type="button"
              onClick={() => { setMode('guest'); setErrorMsg(''); }}
              className={`py-1.5 text-xs font-semibold rounded-[4px] transition-colors ${
                mode === 'guest' ? 'bg-[var(--accent)] text-[var(--text-inverse)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Guest Access
            </button>
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMsg(''); }}
              className={`py-1.5 text-xs font-semibold rounded-[4px] transition-colors ${
                mode === 'login' ? 'bg-[var(--accent)] text-[var(--text-inverse)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMsg(''); }}
              className={`py-1.5 text-xs font-semibold rounded-[4px] transition-colors ${
                mode === 'register' ? 'bg-[var(--accent)] text-[var(--text-inverse)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Register
            </button>
          </div>

          {errorMsg && (
            <div className="alert-danger text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Guest Entry Form */}
          {mode === 'guest' && (
            <form onSubmit={handleGuestAccess} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                {/* htmlFor/id pairs: a <label> that is neither wrapping nor
                    associated by id is announced as loose text, so a screen-reader
                    user reaching this field heard only the placeholder. */}
                <label htmlFor="guest-name" className="text-xs font-semibold text-[var(--text-secondary)]">
                  Patient / Provider Name <span className="text-[var(--text-muted)]">(Optional)</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="guest-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Mrs. Sharma or Dr. Patel"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--border-hover)] focus:bg-[var(--bg-surface)] rounded-[6px] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-h-[44px] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full min-h-[44px]"
              >
                <span>Continue as Guest</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* 2. Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="login-username" className="text-xs font-semibold text-[var(--text-secondary)]">Username</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--border-hover)] focus:bg-[var(--bg-surface)] rounded-[6px] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-h-[44px] transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="login-password" className="text-xs font-semibold text-[var(--text-secondary)]">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--border-hover)] focus:bg-[var(--bg-surface)] rounded-[6px] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-h-[44px] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full min-h-[44px] disabled:opacity-40"
              >
                {loading ? 'Authenticating...' : 'Sign In to Clinical Account'}
              </button>
            </form>
          )}

          {/* 3. Register Form */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="register-username" className="text-xs font-semibold text-[var(--text-secondary)]">Username</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="register-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Choose a username"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--border-hover)] focus:bg-[var(--bg-surface)] rounded-[6px] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-h-[44px] transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="register-email" className="text-xs font-semibold text-[var(--text-secondary)]">
                  Email <span className="text-[var(--text-muted)]">(Optional)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="register-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="doctor@hospital.org"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--border-hover)] focus:bg-[var(--bg-surface)] rounded-[6px] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-h-[44px] transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="register-password" className="text-xs font-semibold text-[var(--text-secondary)]">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="register-password"
                    name="new-password"
                    type="password"
                    autoComplete="new-password"
                    aria-describedby="register-password-hint"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder={PASSWORD_RULE_HINT}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--border-hover)] focus:bg-[var(--bg-surface)] rounded-[6px] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-h-[44px] transition-colors"
                  />
                </div>
                {/* The rule was previously only in the placeholder, which vanishes
                    the moment the user starts typing -- exactly when they need it.
                    Referenced by aria-describedby on the input above. */}
                <p id="register-password-hint" className="text-xs text-[var(--text-muted)]">
                  {PASSWORD_RULE_HINT}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full min-h-[44px] disabled:opacity-40"
              >
                {loading ? 'Creating Account...' : 'Create Clinical Account'}
              </button>
            </form>
          )}

          {/* Quick Scenario Launchers */}
          <div className="flex flex-col gap-2 pt-3 border-t border-[var(--border-default)]">
            <div className="badge badge-info">
              <Sparkles className="w-3 h-3" />
              <span>Preloaded Scenarios</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleProfileSelect('highRisk')}
                className="text-left p-3 rounded-[6px] bg-[var(--bg-elevated)] hover:bg-[#E2E8F0] border border-[var(--border-default)] hover:border-[rgba(220,38,38,0.4)] transition-colors flex items-center justify-between group cursor-pointer min-h-[48px]"
              >
                <div>
                  <div className="font-serif text-[16px] font-bold text-[var(--text-primary)] group-hover:text-[var(--severity-high)]">
                    Anticoagulant + NSAID
                  </div>
                  <div className="text-xs text-[var(--text-muted)] font-sans">
                    Warfarin + Aspirin + Ibuprofen
                  </div>
                </div>
                <div className="badge badge-high">
                  CRITICAL
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleProfileSelect('moderateRisk')}
                className="text-left p-3 rounded-[6px] bg-[var(--bg-elevated)] hover:bg-[#E2E8F0] border border-[var(--border-default)] hover:border-[rgba(217,119,6,0.4)] transition-colors flex items-center justify-between group cursor-pointer min-h-[48px]"
              >
                <div>
                  <div className="font-serif text-[16px] font-bold text-[var(--text-primary)] group-hover:text-[var(--severity-moderate)]">
                    Competitive NSAID Inhibition
                  </div>
                  <div className="text-xs text-[var(--text-muted)] font-sans">
                    Aspirin + Ibuprofen
                  </div>
                </div>
                <div className="badge badge-moderate">
                  MODERATE
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleProfileSelect('safe')}
                className="text-left p-3 rounded-[6px] bg-[var(--bg-elevated)] hover:bg-[#E2E8F0] border border-[var(--border-default)] hover:border-[rgba(5,150,105,0.4)] transition-colors flex items-center justify-between group cursor-pointer min-h-[48px]"
              >
                <div>
                  <div className="font-serif text-[16px] font-bold text-[var(--text-primary)] group-hover:text-[var(--severity-low)]">
                    Verified Safe Regimen
                  </div>
                  <div className="text-xs text-[var(--text-muted)] font-sans">
                    Paracetamol + Amoxicillin
                  </div>
                </div>
                <div className="badge badge-low">
                  SAFE
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Auth;

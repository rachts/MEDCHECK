import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Disclaimer } from '../components/Disclaimer';
import { useMedicine } from '../context/MedicineContext';
import {
  loginUser,
  registerUser,
  getStoredUser,
  logoutUser,
  requestPasswordReset,
  resetPassword,
} from '../lib/api';
import {
  ShieldCrossIcon,
  ArrowRightIcon,
  UserIcon,
  LockIcon,
  MailIcon,
  WarningIcon,
  LogOutIcon,
  CheckIcon,
  BookIcon,
} from './landing-icons';
import './app-editorial.css';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;
const PASSWORD_RULE_HINT = 'Min 8 chars, with upper, lower & a digit';

const ACCESS_MODES = [
  { id: 'guest', num: '01', label: 'Guest Access' },
  { id: 'login', num: '02', label: 'Sign In' },
  { id: 'register', num: '03', label: 'Create Account' },
];

const QUICK_SCENARIOS = [
  {
    key: 'highRisk',
    title: 'Anticoagulant + NSAID',
    medicines: 'Warfarin + Aspirin + Ibuprofen',
    severity: 'CRITICAL',
    tagClass: 'ed-tag-crit',
    hoverTitleClass: 'group-hover:text-[#8b2500]',
  },
  {
    key: 'moderateRisk',
    title: 'Competitive NSAID Inhibition',
    medicines: 'Aspirin + Ibuprofen',
    severity: 'MODERATE',
    tagClass: 'ed-tag-caut',
    hoverTitleClass: 'group-hover:text-[#8a5300]',
  },
  {
    key: 'safe',
    title: 'Verified Safe Regimen',
    medicines: 'Paracetamol + Amoxicillin',
    severity: 'SAFE',
    tagClass: 'ed-tag-safe',
    hoverTitleClass: 'group-hover:text-[#2d4a22]',
  },
];

function utf8ByteLength(value) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return unescape(encodeURIComponent(value)).length;
}

function describePasswordProblem(password) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  const byteLength = utf8ByteLength(password);
  if (byteLength > MAX_PASSWORD_BYTES) {
    return password.length <= MAX_PASSWORD_BYTES
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

const INPUT_CLASS =
  'w-full bg-[#f8f6f0] border border-[#1a1a18] focus:border-[#8b2500] focus:outline focus:outline-2 focus:outline-[#8b2500] focus:outline-offset-2 py-2.5 pl-9 pr-3 text-sm text-[#1a1a18] placeholder-[#57534a] min-h-[44px] font-ibm-serif rounded-none';

const LABEL_CLASS =
  'font-ibm-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#2d2b26]';

export function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resetToken = (searchParams.get('reset_token') || '').trim();

  const [mode, setMode] = useState('guest');
  const [userName, setUserName] = useState(() => localStorage.getItem('medcheck_user_name') || '');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetTokenInvalid, setResetTokenInvalid] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());

  const { loadScenario } = useMedicine();
  const navigate = useNavigate();

  useEffect(() => {
    setErrorMsg('');
    setResetSuccess(false);
    setResetTokenInvalid(false);
    setNewPasswordInput('');
    setConfirmPasswordInput('');
  }, [resetToken]);

  const clearResetToken = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('reset_token');
    setSearchParams(next);
  };

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
    logoutUser();
    setCurrentUser(null);
    setPasswordInput('');
    localStorage.removeItem('medcheck_user_name');
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const trimmedUsername = usernameInput.trim();
    if (!trimmedUsername) {
      setErrorMsg('Please enter your username.');
      return;
    }
    setLoading(true);
    try {
      const data = await requestPasswordReset(trimmedUsername);
      setForgotMessage(
        data.message ||
          'If an account with that username exists, a password reset link has been created. The link is valid for 30 minutes.',
      );
    } catch {
      setForgotMessage(
        'If an account with that username exists, a password reset link has been created. The link is valid for 30 minutes.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setResetTokenInvalid(false);
    const passwordProblem = describePasswordProblem(newPasswordInput);
    if (passwordProblem) {
      setErrorMsg(passwordProblem);
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setErrorMsg('The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(resetToken, newPasswordInput);
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setResetSuccess(true);
    } catch (err) {
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setResetTokenInvalid(true);
      setErrorMsg(
        err.message || 'This reset link is invalid or has expired. Please request a new one.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSelect = (scenarioKey) => {
    loadScenario(scenarioKey);
    navigate('/app');
  };

  return (
    <div className="ed-app min-h-screen flex flex-col bg-[#f8f6f0] text-[#1a1a18] rounded-none shadow-none">
      <Navbar />

      <main className="flex-1 pt-28 pb-16 px-4 sm:px-8 flex flex-col items-center justify-center max-w-3xl mx-auto w-full gap-6">
        <section
          aria-labelledby="auth-heading"
          className="ed-sheet w-full max-w-[540px] p-6 sm:p-8 flex flex-col gap-6"
        >
          {/* Registry Masthead */}
          <header className="border-b border-[#b7b09d] pb-5">
            <div className="flex items-center gap-2.5">
              <span
                className="w-7 h-7 border border-[#1a1a18] bg-[#f8f6f0] text-[#1a1a18] flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <ShieldCrossIcon size={15} />
              </span>
              <span className="font-ibm-mono text-[11px] uppercase tracking-[0.09em] text-[#8b2500] font-medium">
                MEDCHECK REGISTRY
              </span>
            </div>

            <h1
              id="auth-heading"
              className="font-newsreader text-[30px] sm:text-[34px] font-medium text-[#1a1a18] leading-tight mt-3"
            >
              MEDCHECK Access
            </h1>
            <p className="text-sm text-[#2d2b26] mt-2 font-ibm-serif leading-relaxed">
              Clinical pharmacology security and patient profile session management. Sign in or create an account for a named profile session with your medicine lists, notes, and history, or continue directly with guest access without one.
            </p>
          </header>

          {/* Current Logged In State Docket Entry */}
          {currentUser && !currentUser.is_guest && (
            <div className="bg-[#e8eee3] border border-[#2d4a22] border-t-[3px] border-t-[#2d4a22] p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-sm font-ibm-serif text-[#1a1a18]">
                <span
                  className="w-6 h-6 border border-[#2d4a22] bg-[#f8f6f0] text-[#2d4a22] flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <CheckIcon size={13} />
                </span>
                <span>
                  Signed in as <strong className="font-semibold">{currentUser.username}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="ed-btn-outline text-[11px] py-1.5 px-3 min-h-[36px]"
              >
                <LogOutIcon size={13} />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Mode Selector, Error Sheet & Active Form (or Set New Password when reset_token is present) */}
          {resetToken ? (
            <div className="flex flex-col gap-4">
              <div className="font-ibm-mono text-[11px] uppercase tracking-[0.09em] text-[#8b2500] font-medium">
                RESET PASSWORD
              </div>

              {errorMsg && (
                <div role="alert" className="ed-notice-crit p-3.5 flex items-start gap-2.5">
                  <WarningIcon size={16} className="shrink-0 mt-0.5 text-[#8b2500]" />
                  <p className="font-ibm-serif text-xs sm:text-[13px] text-[#1a1a18] leading-relaxed">
                    {errorMsg}
                  </p>
                </div>
              )}

              {resetSuccess ? (
                <div className="bg-[#e8eee3] border border-[#2d4a22] border-t-[3px] border-t-[#2d4a22] p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-sm font-ibm-serif text-[#1a1a18]">
                    <span
                      className="w-6 h-6 border border-[#2d4a22] bg-[#f8f6f0] text-[#2d4a22] flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      <CheckIcon size={13} />
                    </span>
                    <span>
                      Your password has been updated. Please sign in with your new password.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      clearResetToken();
                      setMode('login');
                      setErrorMsg('');
                      setPasswordInput('');
                    }}
                    className="ed-btn-outline text-[11px] py-1.5 px-3 min-h-[36px]"
                  >
                    Go to Sign In
                  </button>
                </div>
              ) : (
                <>
                  <form onSubmit={handleResetPassword} className="flex flex-col gap-4" aria-busy={loading}>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="reset-new-password" className={LABEL_CLASS}>
                        New Password
                      </label>
                      <div className="relative">
                        <LockIcon
                          size={15}
                          className="text-[#57534a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        />
                        <input
                          id="reset-new-password"
                          name="new-password"
                          type="password"
                          autoComplete="new-password"
                          aria-describedby="reset-password-hint"
                          required
                          value={newPasswordInput}
                          onChange={(e) => setNewPasswordInput(e.target.value)}
                          placeholder={PASSWORD_RULE_HINT}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <p
                        id="reset-password-hint"
                        className="font-ibm-mono text-[11px] tracking-[0.04em] text-[#57534a]"
                      >
                        {PASSWORD_RULE_HINT}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="reset-confirm-password" className={LABEL_CLASS}>
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <LockIcon
                          size={15}
                          className="text-[#57534a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        />
                        <input
                          id="reset-confirm-password"
                          name="confirm-new-password"
                          type="password"
                          autoComplete="new-password"
                          required
                          value={confirmPasswordInput}
                          onChange={(e) => setConfirmPasswordInput(e.target.value)}
                          placeholder="Re-enter your new password"
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="ed-btn-ink w-full min-h-[46px] disabled:opacity-55 disabled:cursor-not-allowed"
                    >
                      {loading ? 'UPDATING' : 'Set New Password'}
                    </button>
                    <span className="sr-only" role="status" aria-live="polite">
                      {loading ? 'UPDATING' : ''}
                    </span>
                  </form>

                  {resetTokenInvalid && (
                    <div className="flex justify-start">
                      <button
                        type="button"
                        onClick={() => {
                          clearResetToken();
                          setForgotMessage('');
                          setErrorMsg('');
                          setMode('forgot');
                        }}
                        className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#1a1a18] underline underline-offset-4 hover:text-[#8b2500] transition-colors cursor-pointer"
                      >
                        Request a new reset link
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              {/* Mode Selector: Ruled Ledger Index */}
              <div
                role="group"
                aria-label="Access mode"
                className="grid grid-cols-1 sm:grid-cols-3 border border-[#1a1a18] bg-[#f8f6f0] divide-y sm:divide-y-0 sm:divide-x divide-[#1a1a18]"
              >
                {ACCESS_MODES.map((item) => {
                  const active = mode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setMode(item.id);
                        setErrorMsg('');
                        setForgotMessage('');
                      }}
                      aria-pressed={active}
                      className={`px-3 py-2.5 text-left transition-colors cursor-pointer flex items-center justify-between gap-2 min-h-[44px] ${
                        active
                          ? 'bg-[#1a1a18] text-[#f8f6f0]'
                          : 'bg-[#f8f6f0] text-[#2d2b26] hover:bg-[#ece7d5] hover:text-[#1a1a18]'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className={`font-ibm-mono text-[10px] tracking-[0.06em] shrink-0 ${
                            active ? 'text-[#d5cfc0]' : 'text-[#57534a]'
                          }`}
                        >
                          {item.num}
                        </span>
                        <span className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] font-medium truncate">
                          {item.label}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`w-2 h-2 border shrink-0 ${
                          active ? 'border-[#f8f6f0] bg-[#f8f6f0]' : 'border-[#57534a] bg-transparent'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Error Notice Sheet */}
              {errorMsg && (
                <div role="alert" className="ed-notice-crit p-3.5 flex items-start gap-2.5">
                  <WarningIcon size={16} className="shrink-0 mt-0.5 text-[#8b2500]" />
                  <p className="font-ibm-serif text-xs sm:text-[13px] text-[#1a1a18] leading-relaxed">
                    {errorMsg}
                  </p>
                </div>
              )}

              {/* 1. Guest Entry Form */}
              {mode === 'guest' && (
                <form onSubmit={handleGuestAccess} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="guest-name" className={LABEL_CLASS}>
                      Patient / Provider Name{' '}
                      <span className="text-[#57534a] lowercase font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <UserIcon
                        size={15}
                        className="text-[#57534a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      />
                      <input
                        id="guest-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="e.g. Mrs. Sharma or Dr. Patel"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <button type="submit" className="ed-btn-ink w-full min-h-[46px]">
                    <span>Continue as Guest</span>
                    <ArrowRightIcon size={15} />
                  </button>
                </form>
              )}

              {/* 2. Login Form */}
              {mode === 'login' && (
                <form onSubmit={handleLogin} className="flex flex-col gap-4" aria-busy={loading}>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="login-username" className={LABEL_CLASS}>
                      Username
                    </label>
                    <div className="relative">
                      <UserIcon
                        size={15}
                        className="text-[#57534a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      />
                      <input
                        id="login-username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        required
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="Enter your username"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="login-password" className={LABEL_CLASS}>
                      Password
                    </label>
                    <div className="relative">
                      <LockIcon
                        size={15}
                        className="text-[#57534a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      />
                      <input
                        id="login-password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Enter your password"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setErrorMsg('');
                          setForgotMessage('');
                          setPasswordInput('');
                        }}
                        className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#57534a] hover:text-[#8b2500] hover:underline underline-offset-4 transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="ed-btn-ink w-full min-h-[46px] disabled:opacity-55 disabled:cursor-not-allowed"
                  >
                    {loading ? 'SIGNING IN' : 'Sign In to Clinical Account'}
                  </button>
                  <span className="sr-only" role="status" aria-live="polite">
                    {loading ? 'SIGNING IN' : ''}
                  </span>
                </form>
              )}

              {/* 3. Register Form */}
              {mode === 'register' && (
                <form onSubmit={handleRegister} className="flex flex-col gap-4" aria-busy={loading}>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="register-username" className={LABEL_CLASS}>
                      Username
                    </label>
                    <div className="relative">
                      <UserIcon
                        size={15}
                        className="text-[#57534a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      />
                      <input
                        id="register-username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        required
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="Choose a username"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="register-email" className={LABEL_CLASS}>
                      Email <span className="text-[#57534a] lowercase font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <MailIcon
                        size={15}
                        className="text-[#57534a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      />
                      <input
                        id="register-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="doctor@hospital.org"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="register-password" className={LABEL_CLASS}>
                      Password
                    </label>
                    <div className="relative">
                      <LockIcon
                        size={15}
                        className="text-[#57534a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      />
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
                        className={INPUT_CLASS}
                      />
                    </div>
                    <p
                      id="register-password-hint"
                      className="font-ibm-mono text-[11px] tracking-[0.04em] text-[#57534a]"
                    >
                      {PASSWORD_RULE_HINT}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="ed-btn-ink w-full min-h-[46px] disabled:opacity-55 disabled:cursor-not-allowed"
                  >
                    {loading ? 'CREATING ACCOUNT' : 'Create Clinical Account'}
                  </button>
                  <span className="sr-only" role="status" aria-live="polite">
                    {loading ? 'CREATING ACCOUNT' : ''}
                  </span>
                </form>
              )}

              {/* 4. Forgot Password Form */}
              {mode === 'forgot' && (
                <div className="flex flex-col gap-4">
                  <div className="font-ibm-mono text-[11px] uppercase tracking-[0.09em] text-[#8b2500] font-medium">
                    RESET PASSWORD
                  </div>

                  {forgotMessage && (
                    <div
                      role="status"
                      className="bg-[#f8f6f0] border border-[#1a1a18] p-3.5 font-ibm-serif text-xs sm:text-[13px] text-[#1a1a18] leading-relaxed"
                    >
                      {forgotMessage}
                    </div>
                  )}

                  <form onSubmit={handleForgotPassword} className="flex flex-col gap-4" aria-busy={loading}>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="forgot-username" className={LABEL_CLASS}>
                        Username
                      </label>
                      <div className="relative">
                        <UserIcon
                          size={15}
                          className="text-[#57534a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        />
                        <input
                          id="forgot-username"
                          name="username"
                          type="text"
                          autoComplete="username"
                          required
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value)}
                          placeholder="Enter your username"
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="ed-btn-ink w-full min-h-[46px] disabled:opacity-55 disabled:cursor-not-allowed"
                    >
                      {loading ? 'CREATING LINK' : 'Create Reset Link'}
                    </button>
                    <span className="sr-only" role="status" aria-live="polite">
                      {loading ? 'CREATING LINK' : ''}
                    </span>
                  </form>

                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMsg('');
                        setForgotMessage('');
                      }}
                      className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#1a1a18] underline underline-offset-4 hover:text-[#8b2500] transition-colors cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Quick Scenario Launchers */}
          <div className="flex flex-col gap-3 pt-5 border-t border-[#b7b09d]">
            <div className="inline-flex items-center gap-2 font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#57534a] font-medium">
              <BookIcon size={13} className="text-[#8b2500]" />
              <span>Preloaded Scenarios</span>
            </div>

            <div className="border border-[#b7b09d] bg-[#f8f6f0] divide-y divide-[#d5cfc0]">
              {QUICK_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.key}
                  type="button"
                  onClick={() => handleProfileSelect(scenario.key)}
                  className="w-full text-left px-3.5 py-3 bg-[#f8f6f0] hover:bg-[#ece7d5] transition-colors flex items-center justify-between gap-3 group cursor-pointer min-h-[52px]"
                >
                  <div className="min-w-0">
                    <div
                      className={`font-newsreader text-[16px] font-semibold text-[#1a1a18] ${scenario.hoverTitleClass} leading-snug`}
                    >
                      {scenario.title}
                    </div>
                    <div className="text-xs text-[#57534a] font-ibm-serif mt-0.5">
                      {scenario.medicines}
                    </div>
                  </div>
                  <span className={`ed-tag shrink-0 ${scenario.tagClass}`}>
                    {scenario.severity}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Guest Footnote */}
        <p className="max-w-[540px] w-full text-center font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#57534a] leading-relaxed">
          Guest sessions require no sign-up:{' '}
          <Link
            to="/app"
            className="text-[#1a1a18] underline underline-offset-4 hover:text-[#8b2500] transition-colors"
          >
            continue without an account
          </Link>
          .
        </p>

        {/* Medical Disclaimer */}
        <Disclaimer />
      </main>

      <Footer />
    </div>
  );
}

export default Auth;

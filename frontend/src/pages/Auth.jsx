import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useMedicine } from '../context/MedicineContext';
import { loginUser, registerUser, getStoredUser, logoutUser } from '../lib/api';
import { ShieldCheck, ArrowRight, User, Lock, Mail, AlertTriangle, LogOut, CheckCircle2, Sparkles } from 'lucide-react';

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
      navigate('/app');
    } catch (err) {
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
    if (passwordInput.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    setLoading(true);
    try {
      const user = await registerUser(usernameInput.trim(), passwordInput.trim(), emailInput.trim());
      setCurrentUser(user);
      localStorage.setItem('medcheck_user_name', user.username);
      navigate('/app');
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Username may already exist.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
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
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Patient / Provider Name <span className="text-[var(--text-muted)]">(Optional)</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
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
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Username</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--border-hover)] focus:bg-[var(--bg-surface)] rounded-[6px] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-h-[44px] transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
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
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Username</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Choose a username"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--border-hover)] focus:bg-[var(--bg-surface)] rounded-[6px] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-h-[44px] transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Email <span className="text-[var(--text-muted)]">(Optional)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="doctor@hospital.org"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--border-hover)] focus:bg-[var(--bg-surface)] rounded-[6px] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-h-[44px] transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--border-hover)] focus:bg-[var(--bg-surface)] rounded-[6px] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-h-[44px] transition-colors"
                  />
                </div>
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

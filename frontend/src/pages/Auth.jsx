import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { ShieldCheck, ArrowRight, Lock, Mail, User } from 'lucide-react';

export function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Non-blocking demo auth
    navigate('/app');
  };

  return (
    <div className="min-h-screen flex flex-col antialiased">
      <Navbar />

      <main className="flex-grow pt-28 pb-20 px-4 sm:px-8 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <div className="w-full bg-white/[0.08] backdrop-blur-[20px] border border-white/[0.15] rounded-3xl p-8 flex flex-col gap-6 shadow-glass relative overflow-hidden">
          {/* Top Logo */}
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-secondary-fixed text-deep-olive flex items-center justify-center font-bold text-xl shadow-inner-glow mx-auto mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="font-headline text-3xl font-bold text-primary-fixed mb-1">
              {isSignUp ? 'Create MedCheck Account' : 'Welcome to MedCheck'}
            </h1>
            <p className="text-xs sm:text-sm text-tertiary-fixed-dim/80">
              {isSignUp
                ? 'Save your prescriptions and track medication history.'
                : 'Sign in to access your personal medicine basket.'}
            </p>
          </div>

          {/* Tab switch */}
          <div className="flex bg-white/10 p-1 rounded-full border border-white/10">
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all ${
                !isSignUp ? 'bg-secondary-fixed text-deep-olive shadow-sm' : 'text-white/70 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all ${
                isSignUp ? 'bg-secondary-fixed text-deep-olive shadow-sm' : 'text-white/70 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isSignUp && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-white/80">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Jane Doe"
                    className="w-full bg-white/5 border border-white/15 focus:border-secondary-fixed rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-white/80">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-white/5 border border-white/15 focus:border-secondary-fixed rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-white/80">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/15 focus:border-secondary-fixed rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-2 w-full font-body text-sm font-semibold bg-secondary-fixed text-deep-olive py-3.5 rounded-full shadow-button-glow hover:bg-secondary-fixed-dim transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isSignUp ? 'Create Free Account' : 'Sign In & Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Guest Link */}
          <div className="text-center pt-2 border-t border-white/10">
            <Link
              to="/app"
              className="text-xs text-secondary-fixed hover:underline inline-flex items-center gap-1"
            >
              Continue without signing in as Guest →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

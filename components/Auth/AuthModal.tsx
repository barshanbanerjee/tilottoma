"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Mail, User, Sparkles, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AuthModal() {
  const { isAuthModalOpen, authModalTab, closeAuthModal, openAuthModal, login, register, requestContributor, user } = useAuth();

  const [tab, setTab] = useState<'login' | 'register' | 'contributor'>(authModalTab);

  // Sync tab if opened with specific tab
  React.useEffect(() => {
    setTab(authModalTab);
  }, [authModalTab]);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isAuthModalOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Failed to login');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await register(name, email, password);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Failed to register');
    }
  };

  const handleContributorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await requestContributor(bio);
    setLoading(false);
    if (res.success) {
      setSuccessMsg('Your request has been submitted! An administrator will review and verify your contributor account shortly.');
    } else {
      setError(res.error || 'Failed to submit contributor request');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
        >
          {/* Header banner */}
          <div className="bg-linear-to-r from-amber-900/10 via-amber-800/5 to-zinc-900/10 dark:from-amber-950/40 dark:to-zinc-900/60 p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
            <button
              onClick={closeAuthModal}
              className="absolute top-5 right-5 p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Tilottoma Archive
            </div>
            <h2 className="text-xl font-serif font-bold text-zinc-900 dark:text-zinc-100">
              {tab === 'login' && 'Welcome Back'}
              {tab === 'register' && 'Join the Chronicle'}
              {tab === 'contributor' && 'Become a Verified Contributor'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {tab === 'login' && 'Log in to document streets, save favourites, and propose heritage spots.'}
              {tab === 'register' && 'Create your account to engage with Kolkata’s living cartographic history.'}
              {tab === 'contributor' && 'Help map historical street names, colonial archives, and neighbourhood gems.'}
            </p>
          </div>

          {/* Tab selector */}
          {tab !== 'contributor' && (
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
              <button
                type="button"
                onClick={() => { setTab('login'); setError(''); }}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  tab === 'login'
                    ? 'border-b-2 border-amber-600 text-amber-700 dark:text-amber-400 dark:border-amber-400 bg-white dark:bg-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => { setTab('register'); setError(''); }}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  tab === 'register'
                    ? 'border-b-2 border-amber-600 text-amber-700 dark:text-amber-400 dark:border-amber-400 bg-white dark:bg-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Form Content */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB: LOGIN */}
            {tab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Email Address or Username
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com or admin"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-semibold text-sm rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                </button>

                <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 pt-2">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setTab('register'); setError(''); }}
                    className="text-amber-700 dark:text-amber-400 font-semibold hover:underline"
                  >
                    Register here
                  </button>
                </p>
              </form>
            )}

            {/* TAB: REGISTER */}
            {tab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Barshan Banerjee"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Password (min 6 characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-semibold text-sm rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>

                <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 pt-2">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setTab('login'); setError(''); }}
                    className="text-amber-700 dark:text-amber-400 font-semibold hover:underline"
                  >
                    Log in here
                  </button>
                </p>
              </form>
            )}

            {/* TAB: CONTRIBUTOR REQUEST */}
            {tab === 'contributor' && (
              <div>
                {successMsg ? (
                  <div className="py-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Request Received</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed px-4">
                      {successMsg}
                    </p>
                    <button
                      onClick={closeAuthModal}
                      className="mt-4 px-6 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-xl hover:bg-zinc-800"
                    >
                      Done
                    </button>
                  </div>
                ) : user?.contributorRequestStatus === 'REQUESTED' ? (
                  <div className="py-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Review Pending</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed px-4">
                      Your contributor application is currently under review by our archival administrators. You will be notified once approved.
                    </p>
                    <button
                      onClick={closeAuthModal}
                      className="mt-4 px-6 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-xl hover:bg-zinc-800"
                    >
                      Close
                    </button>
                  </div>
                ) : user?.contributorRequestStatus === 'APPROVED' || ['CONTRIBUTOR', 'MODERATOR', 'ADMIN'].includes(user?.role || '') ? (
                  <div className="py-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">You Are Already a Verified Contributor!</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed px-4">
                      Your account has verified privileges. You can contribute street geometries, historical archives, and zone recommendations.
                    </p>
                    <button
                      onClick={closeAuthModal}
                      className="mt-4 px-6 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-xl hover:bg-zinc-800"
                    >
                      Start Contributing
                    </button>
                  </div>
                ) : !user ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300">
                      <strong>Login required first:</strong> Please log in or create an account before applying for contributor verification.
                    </div>
                    <button
                      onClick={() => setTab('login')}
                      className="w-full py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800"
                    >
                      Go to Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContributorSubmit} className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">Why verification?</p>
                      <p>To preserve historical accuracy, street contributions and archival mapping are curated by verified community researchers and historians.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                        Your Background or Interest in Kolkata Heritage
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us a little about your research interest, local area knowledge, or passion for Kolkata history..."
                        className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !bio.trim()}
                      className="w-full py-3 bg-amber-700 hover:bg-amber-600 text-white font-semibold text-sm rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? 'Submitting Application...' : 'Submit Contributor Application'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

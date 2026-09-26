import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle, emulatorSignInAs } from '../services/auth';

export const LoginPage: React.FC = () => {
  const { user, rosterUser, authError, clearError, isParticipant, isHoD, isAdmin } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const isEmulator = import.meta.env.VITE_USE_EMULATORS === 'true';

  if (user && rosterUser) {
    if (isParticipant) return <Navigate to="/participant" replace />;
    if (isHoD) return <Navigate to="/hod" replace />;
    if (isAdmin) return <Navigate to="/admin" replace />;
  }

  const handleGoogleSignIn = async () => {
    clearError();
    setCustomError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setCustomError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmulatorSignIn = async (email: string, name: string) => {
    clearError();
    setCustomError(null);
    setSigningIn(true);
    try {
      await emulatorSignInAs(email, name);
    } catch (err: any) {
      console.error('Emulator sign-in error:', err);
      setCustomError(err.message || 'Emulator sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const activeError = authError || customError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-christ-navy to-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Crest */}
        <div className="mx-auto w-16 h-16 rounded-full bg-christ-gold flex items-center justify-center font-serif text-3xl font-extrabold text-christ-navy shadow-lg border-2 border-white/20">
          C
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
          CHRIST (Deemed to be University)
        </h2>
        <p className="text-xs uppercase tracking-widest text-christ-gold font-semibold mt-1">
          Bangalore Yeshwanthpur Campus (BYC)
        </p>
        <div className="mt-4 inline-block bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10">
          <p className="text-xs font-medium text-gray-200">
            Internal Quality Assurance Cell & HRDC
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-xl sm:px-10 border border-gray-100">
          <div className="text-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 leading-snug">
              Quality Improvement Programme (QIP)
            </h3>
            <p className="text-xs text-gray-600 mt-1 italic">
              "Shaping Future-Ready Graduates: T-Shaped Learning, Academic Rigour and Academic Transformation"
            </p>
            <p className="text-xs font-semibold text-christ-gold mt-2 bg-amber-50 py-1 rounded border border-amber-200">
              28 – 30 September 2026
            </p>
          </div>

          {activeError && (
            <div
              id="auth-error-banner"
              className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3 text-left animate-shake"
            >
              <svg className="w-5 h-5 text-red-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide">Access Denied</h4>
                <p className="text-sm text-red-700 mt-0.5 leading-relaxed">{activeError}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleGoogleSignIn}
              id="google-signin-btn"
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-christ-navy transition disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              {signingIn ? 'Connecting...' : 'Sign in with CHRIST Account'}
            </button>

            <div className="text-center text-xs text-gray-500 pt-2">
              <span className="font-semibold text-gray-700">@christuniversity.in</span> Google Workspace accounts only
            </div>
          </div>

          {/* Emulator quick testing tools for browser verification */}
          {isEmulator && (
            <div className="mt-8 pt-6 border-t border-dashed border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Emulator Quick Sign-In
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono">demo-byc-qip</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  id="emu-btn-admin"
                  onClick={() => handleEmulatorSignIn('appadmin@christuniversity.in', 'App Admin')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 p-2 rounded text-left font-medium transition border border-slate-200"
                >
                  👑 App Admin
                </button>
                <button
                  id="emu-btn-dean"
                  onClick={() => handleEmulatorSignIn('dean@christuniversity.in', 'Dean BYC')}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 p-2 rounded text-left font-medium transition border border-emerald-200"
                >
                  🎓 Dean (Read-Only)
                </button>
                <button
                  id="emu-btn-hod"
                  onClick={() => handleEmulatorSignIn('hod.cs@christuniversity.in', 'CS HoD')}
                  className="bg-purple-50 hover:bg-purple-100 text-purple-800 p-2 rounded text-left font-medium transition border border-purple-200"
                >
                  🏛️ CS HoD
                </button>
                <button
                  id="emu-btn-participant"
                  onClick={() => handleEmulatorSignIn('part1.cs@christuniversity.in', 'CS Participant 1')}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-800 p-2 rounded text-left font-medium transition border border-blue-200"
                >
                  👨‍🏫 CS Participant
                </button>
                <button
                  id="emu-btn-inactive"
                  onClick={() => handleEmulatorSignIn('inactive@christuniversity.in', 'Inactive User')}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-800 p-2 rounded text-left font-medium transition border border-rose-200"
                >
                  🚫 Inactive User
                </button>
                <button
                  id="emu-btn-not-roster"
                  onClick={() => handleEmulatorSignIn('nobody@christuniversity.in', 'Unregistered User')}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded text-left font-medium transition border border-gray-300"
                >
                  ❓ Not in Roster
                </button>
                <button
                  id="emu-btn-non-christ"
                  onClick={() => handleEmulatorSignIn('hacker@gmail.com', 'External User')}
                  className="col-span-2 bg-red-50 hover:bg-red-100 text-red-800 p-2 rounded text-center font-medium transition border border-red-200"
                >
                  ⚠️ Non-CHRIST Account (gmail.com)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

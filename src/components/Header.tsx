import React from 'react';
import { useAuth } from '../context/AuthContext';
import { signOutUser } from '../services/auth';

export const Header: React.FC = () => {
  const { rosterUser, isAppAdmin, isDeanOrLeadership } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const formatRoleBadge = () => {
    if (!rosterUser) return null;
    if (rosterUser.role === 'participant') {
      return <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-blue-200">Participant</span>;
    }
    if (rosterUser.role === 'hod') {
      return <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-purple-200">HoD</span>;
    }
    if (rosterUser.role === 'coordinator') {
      return <span className="bg-teal-100 text-teal-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-teal-200">QIP Coordinator</span>;
    }
    if (isAppAdmin) {
      return <span className="bg-amber-100 text-amber-900 text-xs font-semibold px-2.5 py-0.5 rounded border border-amber-300">App Admin</span>;
    }
    if (isDeanOrLeadership) {
      const typeLabel = rosterUser.adminType === 'dean' ? 'Dean' : rosterUser.adminType === 'associate_dean' ? 'Associate Dean' : 'HRDC';
      return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-emerald-300">{typeLabel} (Read-Only)</span>;
    }
    return <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-gray-200">Admin</span>;
  };

  return (
    <header className="bg-christ-navy text-white shadow-md border-b-4 border-christ-gold">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-center md:text-left">
          <img
            src="/christ-logo.png"
            alt="CHRIST University Logo"
            className="w-10 h-10 object-contain drop-shadow shrink-0"
          />
          <div>
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <h1 className="text-xl font-bold tracking-tight">HRDC QIP — BYC</h1>
              <span className="text-xs uppercase tracking-wider text-christ-gold font-medium bg-black/25 px-2 py-0.5 rounded">
                28–30 Sept 2026
              </span>
            </div>
            <p className="text-xs text-gray-300 hidden sm:block">
              Shaping Future-Ready Graduates: T-Shaped Learning, Academic Rigour and Transformation
            </p>
          </div>
        </div>

        {rosterUser && (
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2 text-xs font-semibold">
              {rosterUser.role === 'admin' && (
                <>
                  <a
                    href="/admin"
                    className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition"
                  >
                    Admin Console
                  </a>
                  <a
                    href="/hod"
                    className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition"
                  >
                    Session Board
                  </a>
                  <a
                    href="/analytics"
                    className="px-2.5 py-1 rounded bg-christ-gold/20 hover:bg-christ-gold/30 text-christ-gold transition border border-christ-gold/30"
                  >
                    Analytics & Reports
                  </a>
                </>
              )}
              {(rosterUser.role === 'hod' || rosterUser.role === 'coordinator') && (
                <>
                  <a
                    href="/hod"
                    className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition"
                  >
                    {rosterUser.role === 'coordinator' ? 'Coordinator Console' : 'HoD Console'}
                  </a>
                  <a
                    href="/analytics"
                    className="px-2.5 py-1 rounded bg-christ-gold/20 hover:bg-christ-gold/30 text-christ-gold transition border border-christ-gold/30"
                  >
                    Analytics & Reports
                  </a>
                </>
              )}
              {rosterUser.role === 'participant' && (
                <a
                  href="/participant"
                  className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition"
                >
                  My Activities
                </a>
              )}
            </nav>

            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold flex items-center gap-2 justify-end">
                {rosterUser.name}
                {formatRoleBadge()}
              </div>
              <div className="text-xs text-gray-300">
                {rosterUser.email} • <span className="font-mono text-christ-gold">{rosterUser.department}</span>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              id="header-signout-btn"
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded transition border border-white/20 shadow-sm"
              title="Sign Out"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getRosterUser, handleRedirectResult, signOutUser } from '../services/auth';
import { RosterUser } from '../types';

interface AuthContextType {
  user: User | null;
  rosterUser: RosterUser | null;
  loading: boolean;
  authError: string | null;
  clearError: () => void;
  isParticipant: boolean;
  isHoD: boolean;
  isAdmin: boolean;
  isAppAdmin: boolean;
  isDeanOrLeadership: boolean;
  reloadRoster: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [rosterUser, setRosterUser] = useState<RosterUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearError = () => setAuthError(null);

  const validateAndLoadRoster = async (firebaseUser: User) => {
    const email = firebaseUser.email?.toLowerCase().trim() || '';

    // Check institutional CHRIST email domain
    if (!email.match(/^[a-z0-9._%+-]+@christuniversity\.in$/)) {
      await signOutUser();
      setUser(null);
      setRosterUser(null);
      setAuthError('Only CHRIST University accounts (@christuniversity.in) are permitted. Please sign in with your institutional Google account.');
      setLoading(false);
      return;
    }

    try {
      const roster = await getRosterUser(email);
      if (!roster || roster.active !== true) {
        await signOutUser();
        setUser(null);
        setRosterUser(null);
        setAuthError('Your email is not registered for this programme. Please contact the QIP Coordinator.');
      } else {
        setUser(firebaseUser);
        setRosterUser(roster);
        setAuthError(null);
      }
    } catch (err) {
      console.error('Failed to read roster:', err);
      await signOutUser();
      setUser(null);
      setRosterUser(null);
      setAuthError('Your email is not registered for this programme. Please contact the QIP Coordinator.');
    } finally {
      setLoading(false);
    }
  };

  const reloadRoster = async () => {
    if (auth.currentUser) {
      await validateAndLoadRoster(auth.currentUser);
    }
  };

  useEffect(() => {
    // Check if coming back from signInWithRedirect
    handleRedirectResult().catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await validateAndLoadRoster(currentUser);
      } else {
        setUser(null);
        setRosterUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const isParticipant = rosterUser?.role === 'participant';
  const isHoD = rosterUser?.role === 'hod';
  const isAdmin = rosterUser?.role === 'admin';
  const isAppAdmin = isAdmin && rosterUser?.adminType === 'app_admin';
  const isDeanOrLeadership = isAdmin && rosterUser?.adminType !== 'app_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        rosterUser,
        loading,
        authError,
        clearError,
        isParticipant,
        isHoD,
        isAdmin,
        isAppAdmin,
        isDeanOrLeadership,
        reloadRoster,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

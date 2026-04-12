"use client";

import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

const FRIENDLY: Record<string, string> = {
  'auth/invalid-credential':     'Incorrect email or password.',
  'auth/user-not-found':         'No account with that email.',
  'auth/wrong-password':         'Incorrect password.',
  'auth/email-already-in-use':   'An account with this email already exists.',
  'auth/weak-password':          'Password must be at least 6 characters.',
  'auth/invalid-email':          'Please enter a valid email address.',
  'auth/popup-closed-by-user':   'Sign-in cancelled.',
  'auth/network-request-failed': 'Network error — check your connection.',
};

function friendly(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return FRIENDLY[(err as { code: string }).code] ?? 'Something went wrong. Try again.';
  }
  return 'Something went wrong. Try again.';
}

export const useFirebaseAuth = () => {
  const [user,             setUser]             = useState<User | null>(null);
  const [isAdmin,          setIsAdmin]          = useState(false);
  const [isAdminLoading,   setIsAdminLoading]   = useState(true);
  const [isAuthLoading,    setIsAuthLoading]    = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error,            setError]            = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        try {
          const tokenResult = await u.getIdTokenResult(true);
          setIsAdmin(!!tokenResult.claims.admin);
        } catch (error) {
          console.error("Error fetching claims:", error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      
      setIsAdminLoading(false);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsAuthenticating(true); setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      setError(friendly(err));
    } finally { setIsAuthenticating(false); }
  };

  const register = async (email: string, pass: string, firstName?: string, username?: string) => {
    setIsAuthenticating(true); setError(null);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, pass);
      if (firstName || username) {
        const { updateProfile } = await import('firebase/auth');
        const displayName = [firstName, username].filter(Boolean).join(' ');
        await updateProfile(user, { displayName });
      }
    } catch (err) {
      setError(friendly(err));
    } finally { setIsAuthenticating(false); }
  };

  const googleLogin = async () => {
    setIsAuthenticating(true); setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(friendly(err));
    } finally { setIsAuthenticating(false); }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err) {
      setError(friendly(err));
      return false;
    }
  };

  const logout = async () => { await signOut(auth); };

  return { user, isAdmin, isAdminLoading, isAuthLoading, isAuthenticating, error, login, register, googleLogin, resetPassword, logout };
};

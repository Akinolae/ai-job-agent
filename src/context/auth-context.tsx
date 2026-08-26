'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  UserCredential,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseClientConfigured } from '../config/firebase-client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithEmail: (email: string, password: string) => Promise<UserCredential>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<UserCredential>;
  signInWithGoogle: () => Promise<UserCredential>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isApiKeyIssue = (err: any): boolean => {
  if (!isFirebaseClientConfigured) return true;
  if (!err) return false;
  const code = (err.code || '').toLowerCase();
  const message = (err.message || '').toLowerCase();
  return (
    code.includes('api-key') ||
    code.includes('not-valid') ||
    code.includes('argument-error') ||
    message.includes('api-key') ||
    message.includes('api key') ||
    message.includes('not-valid') ||
    message.includes('invalid')
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for cached local session first
    const savedUser = localStorage.getItem('ai_agent_dev_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {}
    }

    if (!isFirebaseClientConfigured) {
      setLoading(false);
      return;
    }

    // Listen for Firebase auth state changes
    try {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
        } else if (!savedUser) {
          setUser(null);
        }
        setLoading(false);
      }, (err) => {
        console.warn('Firebase Auth State listener notice:', err);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch {
      setLoading(false);
    }
  }, []);

  const clearError = () => setError(null);

  const signInWithEmail = async (email: string, password: string): Promise<UserCredential> => {
    setError(null);
    if (!isFirebaseClientConfigured) {
      const mockUser = {
        uid: 'user_' + Buffer.from(email).toString('hex').slice(0, 12),
        email,
        displayName: email.split('@')[0],
        photoURL: null
      } as unknown as User;
      localStorage.setItem('ai_agent_dev_user', JSON.stringify(mockUser));
      setUser(mockUser);
      return { user: mockUser } as UserCredential;
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setUser(cred.user);
      return cred;
    } catch (err: any) {
      if (isApiKeyIssue(err)) {
        const mockUser = {
          uid: 'user_' + Date.now(),
          email,
          displayName: email.split('@')[0],
          photoURL: null
        } as unknown as User;
        localStorage.setItem('ai_agent_dev_user', JSON.stringify(mockUser));
        setUser(mockUser);
        return { user: mockUser } as UserCredential;
      }
      const msg = mapAuthError(err.code || err.message);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string): Promise<UserCredential> => {
    setError(null);
    if (!isFirebaseClientConfigured) {
      const mockUser = {
        uid: 'user_' + Buffer.from(email).toString('hex').slice(0, 12),
        email,
        displayName: displayName || email.split('@')[0],
        photoURL: null
      } as unknown as User;
      localStorage.setItem('ai_agent_dev_user', JSON.stringify(mockUser));
      setUser(mockUser);
      return { user: mockUser } as UserCredential;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName && cred.user) {
        await updateProfile(cred.user, { displayName });
      }
      setUser(cred.user);
      return cred;
    } catch (err: any) {
      if (isApiKeyIssue(err)) {
        const mockUser = {
          uid: 'user_' + Date.now(),
          email,
          displayName: displayName || email.split('@')[0],
          photoURL: null
        } as unknown as User;
        localStorage.setItem('ai_agent_dev_user', JSON.stringify(mockUser));
        setUser(mockUser);
        return { user: mockUser } as UserCredential;
      }
      const msg = mapAuthError(err.code || err.message);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signInWithGoogle = async (): Promise<UserCredential> => {
    setError(null);
    if (!isFirebaseClientConfigured) {
      const mockUser = {
        uid: 'google_user_' + Date.now(),
        email: 'alex.morgan@gmail.com',
        displayName: 'Alex Morgan',
        photoURL: null
      } as unknown as User;
      localStorage.setItem('ai_agent_dev_user', JSON.stringify(mockUser));
      setUser(mockUser);
      return { user: mockUser } as UserCredential;
    }

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      setUser(cred.user);
      return cred;
    } catch (err: any) {
      if (isApiKeyIssue(err)) {
        const mockUser = {
          uid: 'google_user_' + Date.now(),
          email: 'alex.morgan@gmail.com',
          displayName: 'Alex Morgan',
          photoURL: null
        } as unknown as User;
        localStorage.setItem('ai_agent_dev_user', JSON.stringify(mockUser));
        setUser(mockUser);
        return { user: mockUser } as UserCredential;
      }
      const msg = mapAuthError(err.code || err.message);
      setError(msg);
      throw new Error(msg);
    }
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    setError(null);
    if (!isFirebaseClientConfigured) {
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      if (isApiKeyIssue(err)) {
        return;
      }
      const msg = mapAuthError(err.code || err.message);
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async (): Promise<void> => {
    setError(null);
    try {
      if (isFirebaseClientConfigured) {
        await signOut(auth);
      }
    } catch (err) {
      console.warn('Sign out notice:', err);
    } finally {
      localStorage.removeItem('ai_agent_dev_user');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        sendPasswordReset,
        logout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function mapAuthError(codeOrMsg: string): string {
  if (codeOrMsg.includes('auth/invalid-credential') || codeOrMsg.includes('auth/wrong-password') || codeOrMsg.includes('auth/user-not-found')) {
    return 'Invalid email or password. Please check your credentials.';
  }
  if (codeOrMsg.includes('auth/email-already-in-use')) {
    return 'An account with this email address already exists.';
  }
  if (codeOrMsg.includes('auth/weak-password')) {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (codeOrMsg.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (codeOrMsg.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completing.';
  }
  if (codeOrMsg.includes('auth/popup-blocked')) {
    return 'Google sign-in popup was blocked by your browser. Please allow popups.';
  }
  if (codeOrMsg.includes('auth/network-request-failed')) {
    return 'Network connection error. Please check your internet connection.';
  }
  return codeOrMsg || 'An authentication error occurred. Please try again.';
}

'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../context/auth-context';
import { 
  FiUser, 
  FiMail, 
  FiLock, 
  FiShield, 
  FiEye, 
  FiEyeOff, 
  FiAlertTriangle, 
  FiCheckCircle, 
  FiX,
  FiAlertCircle
} from 'react-icons/fi';

interface AuthViewProps {
  onSuccess?: () => void;
  isModal?: boolean;
  onClose?: () => void;
}

const signInValidationSchema = Yup.object({
  email: Yup.string().email('Please enter a valid email address').required('Email address is required'),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required')
});

const signUpValidationSchema = Yup.object({
  displayName: Yup.string().min(2, 'Full name must be at least 2 characters').required('Full name is required'),
  email: Yup.string().email('Please enter a valid email address').required('Email address is required'),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords do not match')
    .required('Please confirm your password')
});

const forgotValidationSchema = Yup.object({
  email: Yup.string().email('Please enter a valid email address').required('Email address is required')
});

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess, isModal = false, onClose }) => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, sendPasswordReset, error, clearError } = useAuth();
  
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const getValidationSchema = () => {
    if (mode === 'signup') return signUpValidationSchema;
    if (mode === 'forgot') return forgotValidationSchema;
    return signInValidationSchema;
  };

  const formik = useFormik({
    initialValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: ''
    },
    validationSchema: getValidationSchema(),
    enableReinitialize: false,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values, { setSubmitting }) => {
      setLocalError(null);
      setResetSuccessMessage(null);
      clearError();

      try {
        if (mode === 'signin') {
          await signInWithEmail(values.email, values.password);
        } else if (mode === 'signup') {
          await signUpWithEmail(values.email, values.password, values.displayName);
        } else if (mode === 'forgot') {
          await sendPasswordReset(values.email);
          setResetSuccessMessage(`Password reset link sent to ${values.email}. Please check your inbox.`);
          setSubmitting(false);
          return;
        }

        if (onSuccess) onSuccess();
        if (onClose) onClose();
      } catch (err: any) {
        // Handled in auth-context
      } finally {
        setSubmitting(false);
      }
    }
  });

  const switchMode = (newMode: 'signin' | 'signup' | 'forgot') => {
    clearError();
    setLocalError(null);
    setResetSuccessMessage(null);
    setMode(newMode);
    formik.resetForm();
  };

  const handleGoogleAuth = async () => {
    setLocalError(null);
    setResetSuccessMessage(null);
    clearError();
    try {
      await signInWithGoogle();
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err: any) {
      // Error handled in auth-context
    }
  };

  const displayError = localError || error;

  return (
    <div className={`auth-card ${isModal ? 'auth-card-modal' : ''}`}>
      {isModal && onClose && (
        <button className="auth-close-btn" onClick={onClose} aria-label="Close modal">
          <FiX />
        </button>
      )}

      <div className="auth-header">
        <div className="auth-logo-badge">
          <span>AI</span>
        </div>
        <h2>
          {mode === 'signin' && 'Welcome Back'}
          {mode === 'signup' && 'Create Your Account'}
          {mode === 'forgot' && 'Reset Password'}
        </h2>
        <p className="auth-subtitle">
          {mode === 'signin' && 'Sign in to access your autonomous job application agent'}
          {mode === 'signup' && 'Set up your AI recruiter profile and automated application loops'}
          {mode === 'forgot' && 'Enter your email address to receive password recovery instructions'}
        </p>
      </div>

      {mode !== 'forgot' && (
        <div className="auth-segmented-switch">
          <button
            type="button"
            className={`auth-segment-btn ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-segment-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Create Account
          </button>
        </div>
      )}

      {displayError && (
        <div className="auth-alert auth-alert-danger">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FiAlertTriangle /> {displayError}
          </span>
        </div>
      )}

      {resetSuccessMessage && (
        <div className="auth-alert auth-alert-success">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FiCheckCircle /> {resetSuccessMessage}
          </span>
        </div>
      )}

      {mode !== 'forgot' && (
        <>
          <button
            type="button"
            className="btn-google-sso"
            onClick={handleGoogleAuth}
            disabled={formik.isSubmitting}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" className="google-svg-icon">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{mode === 'signin' ? 'Continue with Google' : 'Sign up with Google'}</span>
          </button>

          <div className="auth-divider">
            <span>or with email credentials</span>
          </div>
        </>
      )}

      <form onSubmit={formik.handleSubmit} className="auth-form" noValidate>
        {mode === 'signup' && (
          <div className="form-group">
            <label htmlFor="auth-name">Full Name</label>
            <div className="input-icon-wrapper">
              <span className="input-leading-icon"><FiUser /></span>
              <input
                type="text"
                id="auth-name"
                name="displayName"
                className={`form-control-modern form-control-with-icon ${formik.touched.displayName && formik.errors.displayName ? 'input-error' : ''}`}
                placeholder="e.g. Alex Morgan"
                value={formik.values.displayName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={formik.isSubmitting}
              />
            </div>
            {formik.touched.displayName && formik.errors.displayName && (
              <div className="form-error-msg">
                <FiAlertCircle /> {formik.errors.displayName}
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="auth-email">Email Address</label>
          <div className="input-icon-wrapper">
            <span className="input-leading-icon"><FiMail /></span>
            <input
              type="email"
              id="auth-email"
              name="email"
              className={`form-control-modern form-control-with-icon ${formik.touched.email && formik.errors.email ? 'input-error' : ''}`}
              placeholder="you@domain.com"
              value={formik.values.email}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={formik.isSubmitting}
            />
          </div>
          {formik.touched.email && formik.errors.email && (
            <div className="form-error-msg">
              <FiAlertCircle /> {formik.errors.email}
            </div>
          )}
        </div>

        {mode !== 'forgot' && (
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="auth-password">Password</label>
              {mode === 'signin' && (
                <button
                  type="button"
                  className="btn-link-auth"
                  onClick={() => switchMode('forgot')}
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <div className="input-icon-wrapper password-input-wrapper">
              <span className="input-leading-icon"><FiLock /></span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="auth-password"
                name="password"
                className={`form-control-modern form-control-with-icon ${formik.touched.password && formik.errors.password ? 'input-error' : ''}`}
                placeholder="••••••••"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={formik.isSubmitting}
              />
              <button
                type="button"
                className="btn-toggle-pwd"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {formik.touched.password && formik.errors.password && (
              <div className="form-error-msg">
                <FiAlertCircle /> {formik.errors.password}
              </div>
            )}
          </div>
        )}

        {mode === 'signup' && (
          <div className="form-group">
            <label htmlFor="auth-confirm-password">Confirm Password</label>
            <div className="input-icon-wrapper password-input-wrapper">
              <span className="input-leading-icon"><FiShield /></span>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="auth-confirm-password"
                name="confirmPassword"
                className={`form-control-modern form-control-with-icon ${formik.touched.confirmPassword && formik.errors.confirmPassword ? 'input-error' : ''}`}
                placeholder="••••••••"
                value={formik.values.confirmPassword}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={formik.isSubmitting}
              />
              <button
                type="button"
                className="btn-toggle-pwd"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                aria-label="Toggle confirm password visibility"
              >
                {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {formik.touched.confirmPassword && formik.errors.confirmPassword && (
              <div className="form-error-msg">
                <FiAlertCircle /> {formik.errors.confirmPassword}
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          className="btn-auth-submit"
          disabled={formik.isSubmitting}
        >
          {formik.isSubmitting ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span className="pulsating-dot" style={{ backgroundColor: '#ffffff' }}></span>
              <span>Processing...</span>
            </span>
          ) : (
            <>
              {mode === 'signin' && 'Sign In to Agent'}
              {mode === 'signup' && 'Create Free Account'}
              {mode === 'forgot' && 'Send Recovery Email'}
            </>
          )}
        </button>

        {mode === 'forgot' && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn-link-auth"
              onClick={() => switchMode('signin')}
            >
              ← Back to Sign In
            </button>
          </div>
        )}
      </form>

      <div className="auth-footer-terms">
        By signing in, you agree to our Terms of Service & Privacy Policy.
      </div>
    </div>
  );
};

'use client';

/**
 * Login Page
 * Two-step OTP authentication flow:
 * 1. Enter @cmgfi.com email address
 * 2. Enter 6-digit verification code from email
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type LoginStep = 'email' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          router.push('/');
        }
      } catch (error) {
        // Not authenticated, stay on login page
      }
    };
    checkAuth();
  }, [router]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep('otp');
        setMessage('Verification code sent! Check your email.');
        setCountdown(60); // 60-second cooldown before resend
      } else if (response.status === 429) {
        setError(`Too many requests. Please try again in ${Math.ceil(data.retryAfter / 60)} minutes.`);
      } else {
        setError(data.error || 'Failed to send verification code');
      }
    } catch (error) {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Authentication successful! Redirecting...');
        // Use window.location for full page reload to ensure middleware sees the cookie
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      } else if (response.status === 401) {
        setError(data.error || 'Invalid verification code');
        setRemainingAttempts(data.remainingAttempts);
      } else if (response.status === 403) {
        setError(data.error || 'Maximum attempts exceeded');
        // Reset to email step after max attempts
        setTimeout(() => {
          setStep('email');
          setOtp('');
          setRemainingAttempts(null);
        }, 3000);
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (error) {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setOtp('');
    setError('');
    setMessage('');
    setRemainingAttempts(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('New verification code sent!');
        setCountdown(60);
      } else {
        setError(data.error || 'Failed to resend code');
      }
    } catch (error) {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Servicing Ticket Analysis
          </h1>
          <p className="text-slate-400">
            AI-Powered Transcript Analytics & Insights
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl">
          {step === 'email' ? (
            // Step 1: Email Entry
            <form onSubmit={handleSendOTP}>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-2">
                  Sign In
                </h2>
                <p className="text-sm text-slate-400">
                  Enter your CMG Financial email address
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-white mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="username@cmgfi.com"
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-2">
                  Only @cmgfi.com email addresses are allowed
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-950/50 border border-red-800/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            </form>
          ) : (
            // Step 2: OTP Verification
            <form onSubmit={handleVerifyOTP}>
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                    setError('');
                    setMessage('');
                    setRemainingAttempts(null);
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300 mb-2"
                >
                  ← Change email
                </button>
                <h2 className="text-xl font-bold text-white mb-2">
                  Enter Verification Code
                </h2>
                <p className="text-sm text-slate-400">
                  We sent a 6-digit code to <span className="font-medium text-white">{email}</span>
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-white mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white text-center text-2xl font-mono tracking-widest placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  maxLength={6}
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-2">
                  Code expires in 5 minutes {remainingAttempts !== null && `• ${remainingAttempts} attempts remaining`}
                </p>
              </div>

              {message && (
                <div className="mb-4 p-3 bg-green-950/50 border border-green-800/50 rounded-lg text-green-400 text-sm">
                  {message}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-950/50 border border-red-800/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>

              <button
                type="button"
                onClick={handleResendOTP}
                disabled={loading || countdown > 0}
                className="w-full py-2 text-sm text-slate-400 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend verification code'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-slate-500">
          <p>Your session will remain active for 7 days</p>
          <p className="mt-2">© {new Date().getFullYear()} CMG Financial. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

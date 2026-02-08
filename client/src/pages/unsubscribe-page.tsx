import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { CheckCircle, XCircle, Mail, Settings, AlertCircle } from 'lucide-react';

interface EmailPreferences {
  onboarding: boolean;
  marketing: boolean;
  transactional: boolean;
}

export function UnsubscribePage() {
  const [location, navigate] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<EmailPreferences | null>(null);
  const [selectedPreferences, setSelectedPreferences] = useState<EmailPreferences>({
    onboarding: false,
    marketing: false,
    transactional: true
  });

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setError('Invalid unsubscribe link. Please check your email for the correct link.');
      setLoading(false);
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const response = await fetch(`/api/unsubscribe/validate?token=${token}`);
      const data = await response.json();

      if (!response.ok || !data.valid) {
        setError('This unsubscribe link is invalid or has expired. Please contact support if you need assistance.');
        setLoading(false);
        return;
      }

      setEmail(data.email);
      setPreferences(data.preferences);
      setSelectedPreferences({
        ...data.preferences,
        transactional: true // Always keep transactional emails enabled
      });
      setLoading(false);
    } catch (err) {
      setError('Failed to validate unsubscribe link. Please try again later.');
      setLoading(false);
    }
  };

  const handleUnsubscribe = async (unsubscribeAll: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      const emailTypes = unsubscribeAll
        ? { onboarding: false, marketing: false, transactional: true }
        : selectedPreferences;

      const response = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          emailTypes
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to unsubscribe');
      }

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Processing your request...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Successfully Unsubscribed</h1>
            <p className="mt-2 text-gray-600">
              Your email preferences have been updated for {email}.
            </p>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                You will continue to receive important account-related emails (transactional emails).
              </p>
            </div>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => navigate('/login')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Login
              </button>
              <button
                onClick={() => window.close()}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close This Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Unable to Unsubscribe</h1>
            <p className="mt-2 text-gray-600">{error}</p>
            <div className="mt-6">
              <a
                href="mailto:support@brokervault.ai"
                className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <div className="text-center mb-6">
          <Mail className="h-16 w-16 text-blue-600 mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Manage Email Preferences</h1>
          <p className="mt-2 text-gray-600">Choose which emails you'd like to receive from Broker Vault</p>
          {email && (
            <p className="mt-1 text-sm text-gray-500">Managing preferences for: {email}</p>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <p className="ml-2 text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div className="border rounded-lg p-4">
            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPreferences.onboarding}
                onChange={(e) => setSelectedPreferences({
                  ...selectedPreferences,
                  onboarding: e.target.checked
                })}
                className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <div className="ml-3">
                <p className="font-medium text-gray-900">Onboarding Emails</p>
                <p className="text-sm text-gray-600">
                  Helpful tips and guides to get the most out of Broker Vault
                </p>
              </div>
            </label>
          </div>

          <div className="border rounded-lg p-4">
            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPreferences.marketing}
                onChange={(e) => setSelectedPreferences({
                  ...selectedPreferences,
                  marketing: e.target.checked
                })}
                className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <div className="ml-3">
                <p className="font-medium text-gray-900">Marketing Emails</p>
                <p className="text-sm text-gray-600">
                  Product updates, new features, and special offers
                </p>
              </div>
            </label>
          </div>

          <div className="border rounded-lg p-4 bg-gray-50">
            <label className="flex items-start cursor-not-allowed opacity-75">
              <input
                type="checkbox"
                checked={true}
                disabled
                className="mt-1 h-4 w-4 text-gray-400 rounded border-gray-300"
              />
              <div className="ml-3">
                <p className="font-medium text-gray-900">Transactional Emails</p>
                <p className="text-sm text-gray-600">
                  Important account notifications, receipts, and security alerts (required)
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleUnsubscribe(false)}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Settings className="inline-block h-4 w-4 mr-2" />
            Update Email Preferences
          </button>

          <button
            onClick={() => handleUnsubscribe(true)}
            disabled={loading}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Unsubscribe from All Non-Essential Emails
          </button>
        </div>

        <div className="mt-6 pt-6 border-t text-center">
          <p className="text-sm text-gray-500">
            Need help? <a href="mailto:support@brokervault.ai" className="text-blue-600 hover:underline">Contact support</a>
          </p>
        </div>
      </div>
    </div>
  );
}
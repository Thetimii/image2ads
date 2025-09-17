"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Extend Window interface for Facebook Pixel
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

const CookieBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always required
    analytics: false,
    marketing: false,
    functional: false,
  });

  useEffect(() => {
    setMounted(true);
    
    // Check if user has already made a choice
    const cookieConsent = localStorage.getItem('cookieConsent');
    const savedPreferences = localStorage.getItem('cookiePreferences');
    
    if (!cookieConsent) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (savedPreferences) {
      // Apply saved preferences
      const parsedPreferences = JSON.parse(savedPreferences);
      setPreferences(parsedPreferences);
      applyPreferences(parsedPreferences);
    }
  }, []);

  const applyPreferences = (prefs: CookiePreferences) => {
    if (typeof window === 'undefined') return;

    // Analytics cookies
    if (prefs.analytics && window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted'
      });
    } else if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied'
      });
    }

    // Marketing cookies (Facebook Pixel)
    if (prefs.marketing && window.fbq) {
      window.fbq('consent', 'grant');
      window.fbq('track', 'PageView');
    } else if (window.fbq) {
      window.fbq('consent', 'revoke');
    }

    // Store in localStorage for future visits
    localStorage.setItem('cookiePreferences', JSON.stringify(prefs));
  };

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    };
    setPreferences(allAccepted);
    localStorage.setItem('cookieConsent', 'accepted');
    applyPreferences(allAccepted);
    setShowBanner(false);
  };

  const handleDeclineAll = () => {
    const onlyNecessary = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    };
    setPreferences(onlyNecessary);
    localStorage.setItem('cookieConsent', 'declined');
    applyPreferences(onlyNecessary);
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem('cookieConsent', 'customized');
    applyPreferences(preferences);
    setShowBanner(false);
  };

  const togglePreference = (key: keyof CookiePreferences) => {
    if (key === 'necessary') return; // Necessary cookies can't be disabled
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Don't render on server side to avoid hydration issues
  if (!mounted || !showBanner) {
    return null;
  }

  return (
    <AnimatePresence>
      {showBanner && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            onClick={(e) => e.stopPropagation()}
          />
          
          {/* Banner */}
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
          >
            <div className="max-w-4xl mx-auto">
              <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 p-6 md:p-8">
                {!showDetails ? (
                  /* Simple Banner */
                  <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                    {/* Content */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">We value your privacy</h3>
                      </div>
                      
                      <p className="text-gray-700 text-sm md:text-base leading-relaxed">
                        We use cookies to enhance your experience, analyze site traffic, and for marketing purposes. 
                        You can customize your preferences or accept all cookies.{' '}
                        <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline font-medium">
                          Privacy Policy
                        </a>
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                      <button
                        onClick={() => setShowDetails(true)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200 text-sm lg:text-base"
                      >
                        Customize
                      </button>
                      
                      <button
                        onClick={handleDeclineAll}
                        className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl transition-all duration-200 hover:scale-105 text-sm lg:text-base"
                      >
                        Decline All
                      </button>
                      
                      <button
                        onClick={handleAcceptAll}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-blue-500/25 text-sm lg:text-base"
                      >
                        Accept All
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Detailed Preferences */
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-gray-900">Cookie Preferences</h3>
                      <button
                        onClick={() => setShowDetails(false)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Necessary Cookies */}
                      <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900">Necessary Cookies</h4>
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Required</span>
                          </div>
                          <p className="text-sm text-gray-600">
                            Essential for the website to function properly. These cannot be disabled.
                          </p>
                        </div>
                        <div className="ml-4">
                          <div className="w-10 h-6 bg-green-500 rounded-full flex items-center">
                            <div className="w-4 h-4 bg-white rounded-full ml-5 transition-transform"></div>
                          </div>
                        </div>
                      </div>

                      {/* Analytics Cookies */}
                      <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-2">Analytics Cookies</h4>
                          <p className="text-sm text-gray-600">
                            Help us understand how visitors interact with our website by collecting anonymous information.
                          </p>
                        </div>
                        <div className="ml-4">
                          <button
                            onClick={() => togglePreference('analytics')}
                            className={`w-10 h-6 rounded-full flex items-center transition-colors ${
                              preferences.analytics ? 'bg-blue-500' : 'bg-gray-300'
                            }`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                              preferences.analytics ? 'translate-x-5' : 'translate-x-1'
                            }`}></div>
                          </button>
                        </div>
                      </div>

                      {/* Marketing Cookies */}
                      <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-2">Marketing Cookies</h4>
                          <p className="text-sm text-gray-600">
                            Used to track visitors across websites to display relevant ads and measure campaign effectiveness.
                          </p>
                        </div>
                        <div className="ml-4">
                          <button
                            onClick={() => togglePreference('marketing')}
                            className={`w-10 h-6 rounded-full flex items-center transition-colors ${
                              preferences.marketing ? 'bg-blue-500' : 'bg-gray-300'
                            }`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                              preferences.marketing ? 'translate-x-5' : 'translate-x-1'
                            }`}></div>
                          </button>
                        </div>
                      </div>

                      {/* Functional Cookies */}
                      <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-2">Functional Cookies</h4>
                          <p className="text-sm text-gray-600">
                            Enable enhanced functionality and personalization, such as chat support and user preferences.
                          </p>
                        </div>
                        <div className="ml-4">
                          <button
                            onClick={() => togglePreference('functional')}
                            className={`w-10 h-6 rounded-full flex items-center transition-colors ${
                              preferences.functional ? 'bg-blue-500' : 'bg-gray-300'
                            }`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                              preferences.functional ? 'translate-x-5' : 'translate-x-1'
                            }`}></div>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Save Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={handleDeclineAll}
                        className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl transition-all duration-200 text-sm lg:text-base"
                      >
                        Decline All
                      </button>
                      
                      <button
                        onClick={handleSavePreferences}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 text-sm lg:text-base"
                      >
                        Save Preferences
                      </button>
                      
                      <button
                        onClick={handleAcceptAll}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25 text-sm lg:text-base"
                      >
                        Accept All
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CookieBanner;

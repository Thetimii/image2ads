"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Extend Window interface for Facebook Pixel
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const CookieBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check if user has already made a choice
    const cookieConsent = localStorage.getItem('cookieConsent');
    if (!cookieConsent) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setShowBanner(false);
    
    // Enable analytics/tracking
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('consent', 'grant');
      window.fbq('track', 'PageView'); // Track the current page view
    }
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'declined');
    setShowBanner(false);
    
    // Disable analytics/tracking
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('consent', 'revoke');
    }
  };

  const handleSettings = () => {
    // You can expand this to show detailed cookie settings
    alert('Cookie settings coming soon! For now, please accept or decline.');
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
            <div className="max-w-6xl mx-auto">
              <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 p-6 md:p-8">
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
                      We use cookies and similar technologies to enhance your experience, analyze site traffic, and for marketing purposes. 
                      By clicking &quot;Accept All&quot;, you consent to our use of cookies. You can manage your preferences or learn more in our{' '}
                      <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline font-medium">
                        Privacy Policy
                      </a>.
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <button
                      onClick={handleSettings}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200 text-sm lg:text-base"
                    >
                      Settings
                    </button>
                    
                    <button
                      onClick={handleDecline}
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl transition-all duration-200 hover:scale-105 text-sm lg:text-base"
                    >
                      Decline
                    </button>
                    
                    <button
                      onClick={handleAccept}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-blue-500/25 text-sm lg:text-base"
                    >
                      Accept All
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CookieBanner;

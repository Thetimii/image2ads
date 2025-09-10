"use client";
import React from 'react';
import Image from 'next/image';

const Footer = () => {
  const scrollToSignup = () => {
    const signupElement = document.getElementById('signup-section');
    if (signupElement) {
      signupElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="py-12 px-6 bg-white/20 backdrop-blur-lg border-t border-white/30 shadow-lg">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12">
          <div className="mb-8 md:mb-0">
            <Image
              src="/logo.svg"
              alt="Image 2 Ads Logo"
              width={160}
              height={48}
              className="h-8 sm:h-10 w-auto"
            />
            <p className="text-slate-700 mt-2 max-w-md text-sm sm:text-base">
              Transform your product photos into high-converting ads with AI-powered design.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
            <div className="flex flex-wrap justify-center sm:justify-start space-x-6 sm:space-x-8">
              <a href="/about" className="text-slate-700 hover:text-slate-900 transition-colors duration-300 text-sm sm:text-base">About</a>
              <a href="/contact" className="text-slate-700 hover:text-slate-900 transition-colors duration-300 text-sm sm:text-base">Contact</a>
              <a href="/privacy" className="text-slate-700 hover:text-slate-900 transition-colors duration-300 text-sm sm:text-base">Privacy</a>
              <a href="/terms" className="text-slate-700 hover:text-slate-900 transition-colors duration-300 text-sm sm:text-base">Terms</a>
            </div>
            
            <button
              onClick={scrollToSignup}
              className="px-4 sm:px-6 py-2 sm:py-3 text-white font-semibold rounded-full bg-gradient-to-r from-blue-600 to-green-500 hover:from-blue-700 hover:to-green-600 transition-all duration-300 hover:scale-105 text-sm sm:text-base shadow-lg backdrop-blur-sm"
            >
              <span className="hidden sm:inline">Get Started</span>
              <span className="sm:hidden">Start</span>
            </button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center pt-6 sm:pt-8 border-t border-white/30">
          <p className="text-slate-700 mb-4 md:mb-0 text-sm sm:text-base">
            &copy; 2025 Image 2 Ads. All rights reserved.
          </p>
          
          <div className="flex space-x-3 sm:space-x-4">
            <a href="https://www.facebook.com/profile.php?id=61580386327319" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-blue-600 to-green-500 flex items-center justify-center hover:scale-110 transition-transform duration-300 text-white text-xs sm:text-sm font-bold shadow-lg backdrop-blur-sm">
              FB
            </a>
            <a href="#" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-green-500 to-blue-600 flex items-center justify-center hover:scale-110 transition-transform duration-300 text-white text-xs sm:text-sm font-bold shadow-lg backdrop-blur-sm">
              IG
            </a>
            <a href="#" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-blue-600 to-green-600 flex items-center justify-center hover:scale-110 transition-transform duration-300 text-white text-xs sm:text-sm font-bold shadow-lg backdrop-blur-sm">
              TW
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

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
    <footer className="py-16 px-6 bg-white/60 backdrop-blur-sm border-t border-slate-300/40">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12">
          <div className="mb-8 md:mb-0">
            <Image
              src="/logo.svg"
              alt="Image 2 Ads Logo"
              width={160}
              height={48}
              className="h-10 w-auto"
            />
            <p className="text-slate-600 mt-2 max-w-md">
              Transform your product photos into high-converting ads with AI-powered design.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="flex space-x-8">
              <a href="/about" className="text-slate-600 hover:text-slate-800 transition-colors duration-300">About</a>
              <a href="/contact" className="text-slate-600 hover:text-slate-800 transition-colors duration-300">Contact</a>
              <a href="/privacy" className="text-slate-600 hover:text-slate-800 transition-colors duration-300">Privacy</a>
              <a href="/terms" className="text-slate-600 hover:text-slate-800 transition-colors duration-300">Terms</a>
            </div>
            
            <button
              onClick={scrollToSignup}
              className="px-6 py-3 text-white font-semibold rounded-full bg-gradient-to-r from-blue-800 to-slate-700 hover:from-blue-900 hover:to-slate-800 transition-all duration-300 hover:scale-105"
            >
              Get Started
            </button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-slate-300/40">
          <p className="text-slate-600 mb-4 md:mb-0">
            &copy; 2025 Image 2 Ads. All rights reserved.
          </p>
          
          <div className="flex space-x-4">
            <a href="https://www.facebook.com/profile.php?id=61580386327319" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-800 to-slate-700 flex items-center justify-center hover:scale-110 transition-transform duration-300 text-white text-sm font-bold">
              FB
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-gradient-to-r from-slate-700 to-blue-800 flex items-center justify-center hover:scale-110 transition-transform duration-300 text-white text-sm font-bold">
              IG
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-800 to-slate-800 flex items-center justify-center hover:scale-110 transition-transform duration-300 text-white text-sm font-bold">
              TW
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

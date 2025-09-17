"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';

const Header = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    // Detect Safari
    const userAgent = navigator.userAgent.toLowerCase();
    setIsSafari(userAgent.includes('safari') && !userAgent.includes('chrome'));

    const controlHeader = () => {
      if (typeof window !== 'undefined') {
        if (window.scrollY > lastScrollY && window.scrollY > 100) {
          // Scrolling down and past 100px
          setIsVisible(false);
        } else {
          // Scrolling up
          setIsVisible(true);
        }
        setLastScrollY(window.scrollY);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', controlHeader);
      return () => {
        window.removeEventListener('scroll', controlHeader);
      };
    }
  }, [lastScrollY]);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-8 py-6 transition-transform duration-300 ${
      isVisible ? 'transform translate-y-0' : 'transform -translate-y-full'
    }`}>
      <div className="flex items-center">
        {isSafari ? (
          // Safari-specific PNG fallback
          <div className="relative h-14 w-auto">
            <Image
              src="/logo.png"
              alt="Image 2 Ads Logo"
              width={140}
              height={56}
              priority
              className="h-20 w-auto hover:scale-105 transition-transform duration-200"
              style={{
                imageRendering: 'auto'
              } as React.CSSProperties}
            />
          </div>
        ) : (
          // Standard SVG for other browsers
          <div className="relative h-12 w-auto">
            <Image
              src="/logo.svg"
              alt="Image 2 Ads Logo"
              width={120}
              height={48}
              priority
              className="h-12 w-auto hover:scale-105 transition-transform duration-200"
              unoptimized
            />
          </div>
        )}
      </div>
      <div className="flex items-center space-x-4">
        <a 
          href="/signin"
          className="px-6 py-2 text-gray-700 font-medium rounded-full border border-gray-300 hover:border-blue-500 hover:text-blue-600 transition-all duration-300"
        >
          Sign In
        </a>
        <a
          href="/signup"
          className="px-8 py-3 text-white font-semibold rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-purple-500/25"
        >
          Sign Up
        </a>
      </div>
    </header>
  );
};

export default Header;

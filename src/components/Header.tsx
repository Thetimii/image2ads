"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';

const Header = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
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

  const scrollToSignup = () => {
    const signupElement = document.getElementById('signup-section');
    if (signupElement) {
      signupElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-8 py-6 transition-transform duration-300 ${
      isVisible ? 'transform translate-y-0' : 'transform -translate-y-full'
    }`}>
      <div className="flex items-center">
        <Image
          src="/logo.svg"
          alt="Image 2 Ads Logo"
          width={500}
          height={300}
          priority
          className="h-16 w-auto"
        />
      </div>
      
      <button
        onClick={scrollToSignup}
        className="bg-white/20 backdrop-blur-lg text-white font-semibold py-3 px-6 rounded-full text-base border-2 border-white/30 hover:border-[#00C9FF]/50 hover:bg-gradient-to-r hover:from-[#00C9FF]/30 hover:to-[#92FE9D]/30 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl drop-shadow-sm"
      >
        Join Waitlist
      </button>
    
    </header>
  );
};

export default Header;

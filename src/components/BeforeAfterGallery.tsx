"use client";
import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

const BeforeAfterGallery = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const images = [
    { before: '/before1.jpg', after: '/after1.jpg' },
    { before: '/before2.jpg', after: '/after2.jpg' },
    { before: '/before3.jpg', after: '/after3.jpg' },
  ];

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current || !containerRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const sectionHeight = sectionRef.current.offsetHeight;
      const windowHeight = window.innerHeight;
      
      // Calculate when the section is in view
      const sectionTop = rect.top;
      const sectionBottom = rect.bottom;
      
      // Start animation when section enters viewport
      if (sectionTop <= 0 && sectionBottom >= windowHeight) {
        // Section is "sticky" - calculate progress based on scroll
        const scrolled = Math.abs(sectionTop);
        const maxScroll = sectionHeight - windowHeight;
        const progress = Math.min(scrolled / maxScroll, 1);
        setScrollProgress(progress);
      } else if (sectionBottom < windowHeight) {
        // Section has passed, keep it fully revealed
        setScrollProgress(1);
      } else {
        // Section hasn't reached yet
        setScrollProgress(0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial call

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section ref={sectionRef} className="py-24 px-6 relative min-h-[200vh]">
      <div 
        ref={containerRef}
        className="sticky top-0 h-screen flex flex-col justify-center"
      >
        <motion.h2 
          className="text-5xl md:text-6xl font-bold text-center mb-6 bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          From Bland to Brand
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-xl text-gray-300 text-center mb-16 max-w-2xl mx-auto"
        >
          See the transformation in action
        </motion.p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {images.map((image, index) => {
            // Calculate individual progress for each image with stagger
            const imageProgress = Math.max(0, Math.min(1, (scrollProgress - index * 0.15) / 0.7));
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="gradient-card rounded-2xl p-6 border border-white/20"
              >
                <h3 className="text-lg font-semibold text-gray-300 text-center mb-6">Before → After</h3>
                
                {/* Layered Image Container */}
                <div className="relative rounded-xl overflow-hidden border border-gray-600 h-96 w-64 mx-auto">
                  {/* After Image (underneath) */}
                  <Image 
                    src={image.after} 
                    alt="After transformation" 
                    fill
                    className="object-cover"
                    sizes="256px"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMzk4MUY2O3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM4QjVDRjY7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9InVybCgjZykiLz4KPHN2ZyB4PSIxNzAiIHk9IjEyMCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiPgo8cGF0aCBkPSJNMTIgMkwyIDdWMTdMMTIgMjJMMjIgMTdWN0wxMiAyWiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+Cjx0ZXh0IHg9IjIwMCIgeT0iMjAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5BZnRlcjwvdGV4dD4KPHN2Zz4=';
                    }}
                  />
                  
                  {/* Before Image (on top) - controlled by scroll */}
                  <div 
                    className="absolute inset-0 bg-gray-800 transition-transform duration-75 ease-out"
                    style={{
                      transform: `translateY(-${imageProgress * 100}%)`
                    }}
                  >
                    <Image 
                      src={image.before} 
                      alt="Before transformation" 
                      fill
                      className="object-cover"
                      sizes="256px"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzc0MTUxIi8+Cjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM5Q0E0QUYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkJlZm9yZTwvdGV4dD4KPHN2Zz4=';
                      }}
                    />
                    
                    {/* Before Label */}
                    <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-1">
                      <span className="text-sm text-gray-300">Before</span>
                    </div>
                  </div>
                  
                  {/* After Label - appears when before slides up */}
                  <div 
                    className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-1 transition-opacity duration-300"
                    style={{
                      opacity: imageProgress > 0.5 ? 1 : 0
                    }}
                  >
                    <span className="text-sm text-blue-400">After</span>
                  </div>
                  
                  {/* Progress indicator */}
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                    <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-400 transition-all duration-75 ease-out"
                        style={{ width: `${imageProgress * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default BeforeAfterGallery;

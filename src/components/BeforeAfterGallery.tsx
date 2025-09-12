"use client";
import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

const BeforeAfterGallery = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  const images = [
    { before: '/before1.jpg', after: '/after1.jpg' },
    { before: '/before2.jpg', after: '/after2.jpg' },
    { before: '/before3.jpg', after: '/after3.jpg' },
  ];

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const sectionHeight = sectionRef.current.offsetHeight;
      const windowHeight = window.innerHeight;
      
      // Only calculate progress when the section is in the sticky range
      if (rect.top <= 0 && rect.bottom >= windowHeight) {
        // We're in the sticky zone - calculate how far we've scrolled through it
        const scrollableDistance = sectionHeight - windowHeight;
        const scrolledAmount = Math.abs(rect.top);
        const progress = Math.min(scrolledAmount / scrollableDistance, 1);
        setScrollProgress(progress);
      } else if (rect.top > 0) {
        // Above the section
        setScrollProgress(0);
      } else {
        // Below the section
        setScrollProgress(1);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Desktop sticky version */}
      <section ref={sectionRef} className="hidden md:block" style={{ height: '200vh' }}>
        <div 
          className="sticky top-0 left-0 w-full h-screen flex flex-col justify-center z-10"
          style={{ 
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflow: 'hidden',
            backgroundColor: 'transparent'
          }}
        >
          <div className="px-6 py-8 h-full flex flex-col justify-center">
            <motion.h2 
              className="text-5xl md:text-6xl font-bold text-center mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
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
              className="text-xl text-gray-700 text-center mb-16 max-w-2xl mx-auto"
            >
              See the transformation in action
            </motion.p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {images.map((image, index) => {
                const startPoint = index * 0.2;
                const endPoint = startPoint + 0.3;
                const imageProgress = Math.max(0, Math.min(1, (scrollProgress - startPoint) / (endPoint - startPoint)));
                
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="gradient-card rounded-2xl p-6 border border-gray-300/40 shadow-xl"
                  >
                    <h3 className="text-lg font-semibold text-gray-700 text-center mb-6">Before → After</h3>
                    
                    <div className="relative rounded-xl overflow-hidden border border-gray-400/30 h-96 w-64 mx-auto shadow-lg">
                      <Image 
                        src={image.after} 
                        alt="After transformation" 
                        fill
                        className="object-cover"
                        sizes="256px"
                      />
                      
                      <div 
                        className="absolute inset-0 transition-all duration-100 ease-out overflow-hidden"
                        style={{
                          clipPath: `inset(0 0 ${imageProgress * 100}% 0)`,
                        }}
                      >
                        <Image 
                          src={image.before} 
                          alt="Before transformation" 
                          fill
                          className="object-cover"
                          sizes="256px"
                        />
                        
                        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1">
                          <span className="text-sm text-white">Before</span>
                        </div>
                      </div>
                      
                      <div 
                        className="absolute top-4 right-4 bg-blue-500/90 backdrop-blur-sm rounded-lg px-3 py-1 transition-opacity duration-200"
                        style={{
                          opacity: imageProgress > 0.2 ? 1 : 0
                        }}
                      >
                        <span className="text-sm text-white font-semibold">After</span>
                      </div>
                      
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                        <div className="w-20 h-2 bg-gray-300/50 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-100 ease-out rounded-full"
                            style={{ width: `${imageProgress * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      {index === 0 && scrollProgress === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                          <div className="text-center p-4 bg-white/90 rounded-xl">
                            <p className="text-gray-800 font-semibold text-sm">Scroll to reveal transformation</p>
                            <div className="mt-2 text-blue-600 animate-bounce">↓</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile static version */}
      <section className="block md:hidden py-16 px-6">
        <motion.h2 
          className="text-4xl font-bold text-center mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          From Bland to Brand
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-lg text-gray-700 text-center mb-12 max-w-2xl mx-auto"
        >
          See the transformation in action
        </motion.p>
        
        <div className="space-y-8 max-w-md mx-auto">
          {images.map((image, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="gradient-card rounded-2xl p-6 border border-gray-300/40 shadow-xl"
            >
              <h3 className="text-lg font-semibold text-gray-700 text-center mb-6">Before → After</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600 mb-2">Before</p>
                  <div className="relative rounded-lg overflow-hidden border border-gray-400/30 aspect-[4/6] shadow-md">
                    <Image 
                      src={image.before} 
                      alt="Before transformation" 
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                  </div>
                </div>
                
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600 mb-2">After</p>
                  <div className="relative rounded-lg overflow-hidden border border-blue-400/30 aspect-[4/6] shadow-md">
                    <Image 
                      src={image.after} 
                      alt="After transformation" 
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </>
  );
};

export default BeforeAfterGallery;

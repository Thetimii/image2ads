"use client";
import React from 'react';
import { motion } from 'framer-motion';

const HowItWorks = () => {
  const steps = [
    { title: 'Upload Your Photo', icon: '📤', desc: 'Simply upload your product photo - any quality works!', color: 'from-blue-500 to-cyan-500' },
    { title: 'AI Magic Happens', icon: '🎨', desc: 'Our AI analyzes and designs a stunning ad around your product', color: 'from-purple-500 to-pink-500' },
    { title: 'Get Conversions', icon: '🚀', desc: 'Download your professional ad and watch sales soar!', color: 'from-pink-500 to-orange-500' },
  ];

  return (
    <section className="py-24 px-6 relative">
      <motion.h2 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-5xl md:text-6xl font-bold text-center mb-6 bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent"
      >
        How It Works
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-xl text-gray-300 text-center mb-16 max-w-2xl mx-auto"
      >
        Three simple steps to transform your product photos into high-converting ads
      </motion.p>
      
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {steps.map((step, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.2 }}
            whileHover={{ scale: 1.05, y: -10 }}
            className="relative group"
          >
            <div className="gradient-card rounded-3xl p-8 text-center h-full border border-white/20 group-hover:border-white/40 transition-all duration-300">
              <div className="text-7xl mb-6 group-hover:scale-110 transition-transform duration-300">{step.icon}</div>
              <h3 className="text-2xl font-bold text-white mb-4">{step.title}</h3>
              <p className="text-gray-300 leading-relaxed">{step.desc}</p>
              
              <div className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-10 rounded-3xl transition-opacity duration-300`}></div>
            </div>
            
            {index < steps.length - 1 && (
              <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-white/30 to-transparent"></div>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorks;

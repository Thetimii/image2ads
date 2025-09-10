"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FAQ = () => {
  const faqs = [
    { q: 'What kind of photos can I upload?', a: 'Any product photo works! Upload smartphone pics, professional shots, or anything in between. Our AI handles the rest.' },
    { q: 'How fast do I get my ads?', a: 'Lightning fast! Your professional ads are generated in about 10-15 seconds using our advanced AI technology.' },
    { q: 'Is this completely automated?', a: 'Yes! Our entire process is powered by AI - no human designers needed. Just upload, and our AI creates stunning ads instantly.' },
    { q: 'What ad formats do you provide?', a: 'All major formats: Instagram Stories, Facebook Ads, Google Ads, TikTok, and custom sizes. Perfect for any platform!' },
    { q: 'Can the AI match my brand style?', a: 'Absolutely! Our AI learns your brand colors, fonts, and style preferences to create perfectly on-brand advertisements.' },
    { q: 'What if I want changes to my ad?', a: 'Simply regenerate with different style preferences! Our AI creates unlimited variations until you find the perfect ad.' },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 px-6 relative">
      <motion.h2 
        className="text-5xl md:text-6xl font-bold text-center mb-6 text-white drop-shadow-lg"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        Frequently Asked Questions
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-xl text-center mb-16 max-w-2xl mx-auto text-white/90 drop-shadow-md font-medium"
      >
        Everything you need to know about our AI-powered service
      </motion.p>
      
      <div className="max-w-3xl mx-auto">
        {faqs.map((faq, index) => (
          <motion.div 
            key={index} 
            className="mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
          >
            <motion.div
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 border-2 border-white/30 cursor-pointer flex justify-between items-center hover:border-white/50 transition-all duration-300 group shadow-xl"
              whileHover={{ scale: 1.01 }}
            >
              <h3 className="font-semibold text-lg text-white pr-4 group-hover:text-blue-200 transition-colors drop-shadow-md">{faq.q}</h3>
              <motion.span 
                className="text-2xl text-white flex-shrink-0 drop-shadow-md"
                animate={{ rotate: openIndex === index ? 45 : 0 }}
                transition={{ duration: 0.2 }}
              >
                +
              </motion.span>
            </motion.div>
            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 mt-2 rounded-2xl bg-white/25 backdrop-blur-sm border-2 border-white/20 text-white/95 leading-relaxed font-medium drop-shadow-sm shadow-lg">
                    {faq.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default FAQ;

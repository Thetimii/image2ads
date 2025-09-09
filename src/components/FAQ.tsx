"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FAQ = () => {
  const faqs = [
    { q: 'What kind of photos can I submit?', a: 'You can submit any product photo, from professional shots to simple smartphone pictures. Our AI and design team will handle the rest.' },
    { q: 'How long does it take to get my ad?', a: 'Turnaround time is typically 24-48 hours for a single ad. Bulk orders may take longer.' },
    { q: 'What if I don\'t like the ad?', a: 'We offer one round of revisions to ensure you are happy with the final product.' },
    { q: 'Can you match my brand\'s style?', a: 'Absolutely! You can provide your brand guidelines, and we will create ads that are perfectly on-brand.' },
    { q: 'What formats do you provide?', a: 'We provide ads in all major formats: Instagram Stories, Facebook Ads, Google Ads, and custom sizes upon request.' },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 px-6 relative">
      <motion.h2 
        className="text-5xl md:text-6xl font-bold text-center mb-6 bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent"
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
        className="text-xl text-gray-300 text-center mb-16 max-w-2xl mx-auto"
      >
        Everything you need to know about our service
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
              className="gradient-card rounded-2xl p-6 border border-white/20 cursor-pointer flex justify-between items-center hover:border-white/40 transition-all duration-300 group"
              whileHover={{ scale: 1.01 }}
            >
              <h3 className="font-semibold text-lg text-white pr-4 group-hover:text-blue-200 transition-colors">{faq.q}</h3>
              <motion.span 
                className="text-2xl text-blue-400 flex-shrink-0"
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
                  <div className="p-6 mt-2 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 text-gray-300 leading-relaxed">
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

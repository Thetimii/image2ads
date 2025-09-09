"use client";
import React from 'react';
import { motion } from 'framer-motion';

const Testimonials = () => {
  const testimonials = [
    { quote: "Image 2 Ads transformed our marketing overnight. Our CTR increased by 180% and sales doubled!", author: "Sarah Chen", company: "CEO of Glow Beauty", color: "from-blue-500 to-cyan-500" },
    { quote: "I was skeptical at first, but the ads they created were better than anything my $10k/month agency produced.", author: "Mike Rodriguez", company: "Founder of TechFlow", color: "from-purple-500 to-pink-500" },
    { quote: "The process was so simple, and the impact on our ROAS was immediate. Best investment we've made.", author: "Emily Watson", company: "CMO at FreshFoods", color: "from-pink-500 to-orange-500" },
  ];

  return (
    <section className="py-24 px-6 relative">
      <motion.h2 
        className="text-5xl md:text-6xl font-bold text-center mb-6 bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        Loved by 2,500+ Brands
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-xl text-gray-300 text-center mb-16 max-w-2xl mx-auto"
      >
        See what our customers are saying about their results
      </motion.p>
      
      <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {testimonials.map((testimonial, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.2 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="relative group"
          >
            <div className="gradient-card rounded-3xl p-8 h-full border border-white/20 group-hover:border-white/40 transition-all duration-300 relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${testimonial.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
              
              <div className="relative z-10">
                <div className="flex items-center mb-6">
                  <div className="flex text-yellow-400 text-xl">
                    ★★★★★
                  </div>
                </div>
                
                <div className="text-4xl text-white/30 mb-4">❝</div>
                <p className="text-lg text-gray-200 leading-relaxed mb-8 italic">{testimonial.quote}</p>
                
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold mr-4">
                    {testimonial.author.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-white">{testimonial.author}</p>
                    <p className="text-gray-400 text-sm">{testimonial.company}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default Testimonials;

"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';

const LeadCapture = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    industry: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({ name: '', email: '', industry: '' }); // Reset form
      } else {
        setSubmitStatus('error');
        setErrorMessage(result.error || 'Something went wrong');
      }
    } catch {
      setSubmitStatus('error');
      setErrorMessage('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <section id="signup-section" className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 text-white drop-shadow-lg">
            Join the Waitlist
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl text-white/90 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed font-medium drop-shadow-md px-4">
            Be among the first to access Image 2 Ads when we launch. Sign up now for early access and updates.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="bg-white/20 backdrop-blur-lg rounded-3xl p-4 sm:p-6 md:p-8 lg:p-12 border-2 border-white/30 shadow-2xl max-w-2xl mx-auto"
        >
          <div className="mb-4 sm:mb-6 md:mb-8">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 drop-shadow-md">Get Early Access</h3>
            <p className="text-white/90 drop-shadow-sm font-medium text-sm sm:text-base">Be notified when we launch • No commitment required</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <input 
                type="text" 
                name="name"
                placeholder="Your Name" 
                value={formData.name}
                onChange={handleInputChange}
                className="w-full p-3 sm:p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 transition-all duration-300 text-sm sm:text-base min-h-[44px] touch-manipulation"
                required
                disabled={isSubmitting}
              />
              <input 
                type="email" 
                name="email"
                placeholder="Email Address" 
                value={formData.email}
                onChange={handleInputChange}
                className="w-full p-3 sm:p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 transition-all duration-300 text-sm sm:text-base min-h-[44px] touch-manipulation"
                required
                disabled={isSubmitting}
              />
            </div>
            
            <input 
              type="text" 
              name="industry"
              placeholder="What industry are you in? (optional)" 
              value={formData.industry}
              onChange={handleInputChange}
              className="w-full p-3 sm:p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 transition-all duration-300 text-sm sm:text-base min-h-[44px] touch-manipulation"
              disabled={isSubmitting}
            />
            
            {submitStatus === 'error' && (
              <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200">
                {errorMessage}
              </div>
            )}
            
            {submitStatus === 'success' && (
              <div className="p-4 rounded-xl bg-green-500/20 border border-green-500/50 text-green-200">
                🎉 Successfully added to waitlist! We&apos;ll notify you when we launch.
              </div>
            )}
            
            <motion.button 
              type="submit" 
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              disabled={isSubmitting}
              className={`w-full p-4 text-base sm:text-lg font-bold rounded-xl transition-all duration-300 min-h-[52px] touch-manipulation ${
                isSubmitting 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 shadow-2xl hover:shadow-purple-500/25'
              } text-white`}
            >
              {isSubmitting ? 'Joining Waitlist...' : 'Join Waitlist →'}
            </motion.button>
          </form>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6 text-xs sm:text-sm text-gray-400">
            <div className="flex items-center">
              <span className="text-green-400 mr-2">✓</span>
              No spam, ever
            </div>
            <div className="flex items-center">
              <span className="text-green-400 mr-2">✓</span>
              Unsubscribe anytime
            </div>
            <div className="flex items-center">
              <span className="text-green-400 mr-2">✓</span>
              Launch updates only
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-400 text-sm">
            We&apos;re currently in development. Join the waitlist to be notified when we launch.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default LeadCapture;

"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24">
      {/* Animated background elements */}
      <div className="absolute inset-0 z-0">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden'
          } as React.CSSProperties}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-xl"
          animate={{
            x: [0, -80, 0],
            y: [0, 30, 0],
            scale: [1, 0.8, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden'
          } as React.CSSProperties}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6">
            Transform Your{" "}
            <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Images
            </span>{" "}
            Into{" "}
            <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
              Winning Ads
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-3xl mx-auto">
            Our AI-powered platform helps businesses create high-converting advertisements 
            from their existing product images in seconds, not hours.
          </p>

          <motion.a
            href="/signin"
            className="inline-block bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-8 rounded-full text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started Free
          </motion.a>
        </motion.div>

        {/* Before/After Preview */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-16 flex flex-col md:flex-row justify-center items-center space-y-10 md:space-y-0 md:space-x-12"
        >
          <div className="text-center">
            <p className="text-gray-800 mb-4 font-semibold text-lg bg-white/70 backdrop-blur-sm rounded-full px-4 py-2 inline-block shadow-md">Before</p>
            <div className="relative w-72 h-80 md:w-80 md:h-96 rounded-xl overflow-hidden shadow-xl border-2 border-gray-300/40 hover:scale-105 transition-transform duration-300">
              <Image
                src="/before1.jpg"
                alt="Product image before transformation"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 288px, 320px"
              />
            </div>
          </div>
          
          <div className="text-4xl md:text-5xl text-blue-600 rotate-90 md:rotate-0 font-bold drop-shadow-md">→</div>
          
          <div className="text-center">
            <p className="text-gray-800 mb-4 font-semibold text-lg bg-white/70 backdrop-blur-sm rounded-full px-4 py-2 inline-block shadow-md">After</p>
            <div className="relative w-72 h-80 md:w-80 md:h-96 rounded-xl overflow-hidden shadow-xl border-2 border-blue-300/40 hover:scale-105 transition-transform duration-300">
              <Image
                src="/after1.jpg"
                alt="Professional ad after AI transformation"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 288px, 320px"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

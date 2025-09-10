"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function Hero() {
  const scrollToSignup = () => {
    const signupSection = document.getElementById("signup-section");
    if (signupSection) {
      signupSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 sm:pt-20 pb-6 sm:pb-8 px-2 sm:px-4">
      <div className="relative z-10 max-w-7xl mx-auto text-center w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl xl:text-7xl font-bold mb-3 sm:mb-4 md:mb-6 text-white drop-shadow-lg px-2 sm:px-4 leading-tight">
            Transform Your{" "}
            <span className="text-[#00C9FF] drop-shadow-lg">
              Images
            </span>{" "}
            Into{" "}
            <span className="text-[#92FE9D] drop-shadow-lg">
              Professional Ads
            </span>
          </h1>
          
          <p 
            className="text-base sm:text-lg md:text-xl lg:text-2xl mb-4 sm:mb-6 md:mb-8 max-w-3xl mx-auto text-white/90 drop-shadow-md font-medium px-2 sm:px-4 leading-relaxed"
          >
            Our AI-powered platform helps businesses create high-converting advertisements 
            from their existing product images in seconds, not hours.
          </p>

          <motion.button
            onClick={scrollToSignup}
            className="bg-white/20 backdrop-blur-lg text-white font-semibold py-3 px-5 sm:py-4 sm:px-8 rounded-full text-sm sm:text-base lg:text-lg border-2 border-white/30 hover:border-[#00C9FF]/50 hover:bg-gradient-to-r hover:from-[#00C9FF]/30 hover:to-[#92FE9D]/30 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl mx-2 sm:mx-4 min-h-[44px] touch-manipulation"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Join the Waitlist
          </motion.button>
        </motion.div>

        {/* Before/After Preview */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-8 sm:mt-12 md:mt-16 flex flex-col md:flex-row justify-center items-center space-y-6 sm:space-y-8 md:space-y-0 md:space-x-12 px-2 sm:px-4"
        >
          <div className="text-center">
            <p className="text-white font-medium mb-3 sm:mb-4 text-sm sm:text-base md:text-lg drop-shadow-md">Before</p>
            <div className="relative w-48 h-60 sm:w-64 sm:h-80 md:w-80 md:h-96 lg:w-96 lg:h-[500px] rounded-xl overflow-hidden shadow-2xl border-2 border-white/30 bg-white/10 backdrop-blur-sm">
              <Image
                src="/before1.jpg"
                alt="Product image before transformation"
                fill
                className="object-cover"
                sizes="(max-width: 480px) 192px, (max-width: 640px) 256px, (max-width: 768px) 320px, 384px"
              />
            </div>
          </div>
          
          <div className="text-xl sm:text-2xl md:text-4xl text-white drop-shadow-lg rotate-90 md:rotate-0">→</div>
          
          <div className="text-center">
            <p className="text-white font-medium mb-3 sm:mb-4 text-sm sm:text-base md:text-lg drop-shadow-md">After</p>
            <div className="relative w-48 h-60 sm:w-64 sm:h-80 md:w-80 md:h-96 lg:w-96 lg:h-[500px] rounded-xl overflow-hidden shadow-2xl border-2 border-white/30 bg-white/10 backdrop-blur-sm">
              <Image
                src="/after1.jpg"
                alt="Professional ad after AI transformation"
                fill
                className="object-cover"
                sizes="(max-width: 480px) 192px, (max-width: 640px) 256px, (max-width: 768px) 320px, 384px"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

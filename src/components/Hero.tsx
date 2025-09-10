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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-8 px-4">
      <div className="relative z-10 max-w-7xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold mb-4 md:mb-6 text-white drop-shadow-lg px-4">
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
            className="text-lg sm:text-xl md:text-2xl mb-6 md:mb-8 max-w-3xl mx-auto text-white/90 drop-shadow-md font-medium px-4"
          >
            Our AI-powered platform helps businesses create high-converting advertisements 
            from their existing product images in seconds, not hours.
          </p>

          <motion.button
            onClick={scrollToSignup}
            className="bg-white/20 backdrop-blur-lg text-white font-semibold py-3 px-6 sm:py-4 sm:px-8 rounded-full text-base sm:text-lg border-2 border-white/30 hover:border-[#00C9FF]/50 hover:bg-gradient-to-r hover:from-[#00C9FF]/30 hover:to-[#92FE9D]/30 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl mx-4"
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
          className="mt-12 md:mt-16 flex flex-col md:flex-row justify-center items-center space-y-8 md:space-y-0 md:space-x-12 px-4"
        >
          <div className="text-center">
            <p className="text-white font-medium mb-4 text-base sm:text-lg drop-shadow-md">Before</p>
            <div className="relative w-64 h-80 sm:w-80 sm:h-96 md:w-96 md:h-[500px] rounded-xl overflow-hidden shadow-2xl border-2 border-white/30 bg-white/10 backdrop-blur-sm">
              <Image
                src="/before1.jpg"
                alt="Product image before transformation"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 320px, 384px"
              />
            </div>
          </div>
          
          <div className="text-2xl sm:text-4xl text-white drop-shadow-lg rotate-90 md:rotate-0">→</div>
          
          <div className="text-center">
            <p className="text-white font-medium mb-4 text-base sm:text-lg drop-shadow-md">After</p>
            <div className="relative w-64 h-80 sm:w-80 sm:h-96 md:w-96 md:h-[500px] rounded-xl overflow-hidden shadow-2xl border-2 border-white/30 bg-white/10 backdrop-blur-sm">
              <Image
                src="/after1.jpg"
                alt="Professional ad after AI transformation"
                fill
                className="object-cover"
                sizes="(max-width: 640px) 256px, (max-width: 768px) 320px, 384px"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

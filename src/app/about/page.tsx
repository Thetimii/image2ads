import Link from 'next/link';

export default function About() {
  return (
    <div className="min-h-screen py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-white hover:text-[#00C9FF] mb-6 sm:mb-8 inline-block font-medium drop-shadow-md transition-colors duration-300">
          ← Back to Home
        </Link>
        
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 sm:mb-8 text-white drop-shadow-lg">
          About Image 2 Ads
        </h1>
        
        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 sm:p-8 border-2 border-white/30 shadow-xl">
          <p className="text-lg sm:text-xl text-white/95 mb-6 font-medium drop-shadow-sm">
            Image 2 Ads is an AI-powered platform that transforms ordinary product photos into stunning, high-converting advertisements in seconds.
          </p>
          
          <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 drop-shadow-md">Our Mission</h2>
          <p className="text-white/90 mb-6 leading-relaxed">
            We believe every business deserves professional-quality advertising, regardless of budget or design expertise. Our AI technology democratizes access to high-quality ad creation, helping businesses of all sizes compete in the digital marketplace.
          </p>
          
          <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">How It Works</h2>
          <p className="text-white/90 mb-6 leading-relaxed">
            Our advanced AI analyzes your product images, understands your brand style, and generates professional advertisements optimized for conversion across all major platforms including Facebook, Instagram, Google Ads, and more.
          </p>
          
          <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">Why Choose Us</h2>
          <ul className="text-white/90 mb-6 space-y-2 leading-relaxed">
            <li>• Lightning-fast generation (10-15 seconds)</li>
            <li>• 100% AI-powered - no human designers needed</li>
            <li>• Professional quality results every time</li>
            <li>• Multiple format support for all platforms</li>
            <li>• Brand-consistent designs</li>
            <li>• Cost-effective solution for businesses</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

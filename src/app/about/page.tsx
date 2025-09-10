import Link from 'next/link';

export default function About() {
  return (
    <div className="min-h-screen text-gray-800 py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-600 hover:text-blue-800 mb-8 inline-block">
          ← Back to Home
        </Link>
        
        <h1 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
          About Image 2 Ads
        </h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-xl text-gray-700 mb-6">
            Image 2 Ads is an AI-powered platform that transforms ordinary product photos into stunning, high-converting advertisements in seconds.
          </p>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Our Mission</h2>
          <p className="text-gray-700 mb-6">
            We believe every business deserves professional-quality advertising, regardless of budget or design expertise. Our AI technology democratizes access to high-quality ad creation, helping businesses of all sizes compete in the digital marketplace.
          </p>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">How It Works</h2>
          <p className="text-gray-700 mb-6">
            Our advanced AI analyzes your product images, understands your brand style, and generates professional advertisements optimized for conversion across all major platforms including Facebook, Instagram, Google Ads, and more.
          </p>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Why Choose Us</h2>
          <ul className="text-gray-700 mb-6 space-y-2">
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

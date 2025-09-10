import Link from 'next/link';

export default function Privacy() {
  return (
    <div className="min-h-screen py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-white hover:text-[#00C9FF] mb-8 inline-block font-medium drop-shadow-md transition-colors duration-300">
          ← Back to Home
        </Link>
        
        <h1 className="text-4xl md:text-5xl font-bold mb-8 text-white drop-shadow-lg">
          Privacy Policy
        </h1>
        
        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-8 border-2 border-white/30 shadow-xl">
          <p className="text-sm text-white/80 mb-8">Last updated: September 10, 2025</p>
          
          <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">Information We Collect</h2>
          <p className="text-white/90 mb-6 leading-relaxed">
            We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support.
          </p>
          
          <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">How We Use Your Information</h2>
          <ul className="text-white/90 mb-6 space-y-2 leading-relaxed">
            <li>• To provide and improve our AI-powered ad generation services</li>
            <li>• To process your images and create advertisements</li>
            <li>• To communicate with you about our services</li>
            <li>• To ensure the security and integrity of our platform</li>
          </ul>
          
          <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">Data Security</h2>
          <p className="text-white/90 mb-6 leading-relaxed">
            We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
          </p>
          
          <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">Your Images</h2>
          <p className="text-white/90 mb-6 leading-relaxed">
            Images you upload are processed by our AI and stored securely. We do not use your images for any purpose other than generating your advertisements. You retain all rights to your images.
          </p>
          
          <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">Contact Us</h2>
          <p className="text-white/90 mb-6 leading-relaxed">
            If you have any questions about this Privacy Policy, please contact us at image2ad@proton.me.
          </p>
        </div>
      </div>
    </div>
  );
}

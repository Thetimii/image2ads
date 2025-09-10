import Link from 'next/link';

export default function Privacy() {
  return (
    <div className="min-h-screen text-gray-800 py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-600 hover:text-blue-800 mb-8 inline-block">
          ← Back to Home
        </Link>
        
        <h1 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
          Privacy Policy
        </h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-sm text-gray-600 mb-8">Last updated: September 10, 2025</p>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Information We Collect</h2>
          <p className="text-gray-700 mb-6">
            We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support.
          </p>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">How We Use Your Information</h2>
          <ul className="text-gray-700 mb-6 space-y-2">
            <li>• To provide and improve our AI-powered ad generation services</li>
            <li>• To process your images and create advertisements</li>
            <li>• To communicate with you about our services</li>
            <li>• To ensure the security and integrity of our platform</li>
          </ul>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Data Security</h2>
          <p className="text-gray-700 mb-6">
            We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
          </p>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Your Images</h2>
          <p className="text-gray-700 mb-6">
            Images you upload are processed by our AI and stored securely. We do not use your images for any purpose other than generating your advertisements. You retain all rights to your images.
          </p>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Contact Us</h2>
          <p className="text-gray-700 mb-6">
            If you have any questions about this Privacy Policy, please contact us at image2ad@proton.me.
          </p>
        </div>
      </div>
    </div>
  );
}

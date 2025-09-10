import Link from 'next/link';

export default function Terms() {
  return (
    <div className="min-h-screen text-gray-800 py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-600 hover:text-blue-800 mb-8 inline-block">
          ← Back to Home
        </Link>
        
        <h1 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
          Terms of Service
        </h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-sm text-gray-600 mb-8">Last updated: September 10, 2025</p>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Acceptance of Terms</h2>
          <p className="text-gray-700 mb-6">
            By accessing and using Image 2 Ads, you accept and agree to be bound by the terms and provision of this agreement.
          </p>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Service Description</h2>
          <p className="text-gray-700 mb-6">
            Image 2 Ads is an AI-powered platform that generates advertisements from product images. Our service is provided &quot;as is&quot; and we reserve the right to modify or discontinue the service at any time.
          </p>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">User Responsibilities</h2>
          <ul className="text-gray-700 mb-6 space-y-2">
            <li>• You must own or have rights to all images you upload</li>
            <li>• You will not upload inappropriate, offensive, or copyrighted content</li>
            <li>• You are responsible for how you use the generated advertisements</li>
            <li>• You will not attempt to reverse engineer our AI technology</li>
          </ul>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Intellectual Property</h2>
          <p className="text-gray-700 mb-6">
            You retain ownership of your original images. Generated advertisements are provided for your commercial use. Our AI technology and platform remain our intellectual property.
          </p>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Limitation of Liability</h2>
          <p className="text-gray-700 mb-6">
            Image 2 Ads shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
          </p>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Contact Information</h2>
          <p className="text-gray-700 mb-6">
            For questions about these Terms of Service, contact us at image2ad@proton.me.
          </p>
        </div>
      </div>
    </div>
  );
}

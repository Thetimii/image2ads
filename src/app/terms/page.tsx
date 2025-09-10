import Link from 'next/link';

export default function Terms() {
  return (
    <div className="min-h-screen py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-white hover:text-[#00C9FF] mb-8 inline-block font-medium drop-shadow-md transition-colors duration-300">
          ← Back to Home
        </Link>
        
        <h1 className="text-4xl md:text-5xl font-bold mb-8 text-white drop-shadow-lg">
          Terms of Service
        </h1>
        
        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-8 border-2 border-white/30 shadow-xl">
          <p className="text-sm text-white/80 mb-8">Last updated: September 10, 2025</p>
          
          <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">Acceptance of Terms</h2>
          <p className="text-white/90 mb-6 leading-relaxed">
            By accessing and using Image 2 Ads, you accept and agree to be bound by the terms and provision of this agreement.
          </p>
          
          <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">Service Description</h2>
          <p className="text-white/90 mb-6 leading-relaxed">
            Image 2 Ads is an AI-powered platform that generates advertisements from product images. Our service is provided &quot;as is&quot; and we reserve the right to modify or discontinue the service at any time.
          </p>
          
          <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">User Responsibilities</h2>
          <ul className="text-white/90 mb-6 space-y-2 leading-relaxed">
            <li>• You must own or have rights to all images you upload</li>
            <li>• You will not upload inappropriate, offensive, or copyrighted content</li>
            <li>• You are responsible for how you use the generated advertisements</li>
            <li>• You will not attempt to reverse engineer our AI technology</li>
          </ul>
          
          <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">Intellectual Property</h2>
          <p className="text-white/90 mb-6 leading-relaxed">
            You retain ownership of your original images. Generated advertisements are provided for your commercial use. Our AI technology and platform remain our intellectual property.
          </p>
          
          <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">Limitation of Liability</h2>
          <p className="text-white/90 mb-6 leading-relaxed">
            Image 2 Ads shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
          </p>
          
          <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">Contact Information</h2>
          <p className="text-white/90 mb-6 leading-relaxed">
            For questions about these Terms of Service, contact us at image2ad@proton.me.
          </p>
        </div>
      </div>
    </div>
  );
}

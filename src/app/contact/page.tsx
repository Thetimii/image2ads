import Link from 'next/link';

export default function Contact() {
  return (
    <div className="min-h-screen text-gray-800 py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-600 hover:text-blue-800 mb-8 inline-block">
          ← Back to Home
        </Link>
        
        <h1 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
          Contact Us
        </h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-xl text-gray-700 mb-8">
            Have questions about Image 2 Ads? We&apos;d love to hear from you!
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Get in Touch</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-800">Email</h3>
                  <p className="text-gray-700">image2ad@proton.me</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-800">Social Media</h3>
                  <p className="text-gray-700">
                    Follow us on{' '}
                    <a 
                      href="https://www.facebook.com/profile.php?id=61580386327319" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Facebook
                    </a>
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-800">Business Hours</h3>
                  <p className="text-gray-700">
                    Our AI works 24/7, and our support team is available Monday-Friday, 9 AM - 6 PM EST
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Frequently Asked Questions</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-800">How fast is the AI generation?</h3>
                  <p className="text-gray-700">Our AI generates professional ads in 10-15 seconds!</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-800">What image formats do you accept?</h3>
                  <p className="text-gray-700">We accept JPG, PNG, and most common image formats.</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-800">Do you offer refunds?</h3>
                  <p className="text-gray-700">Yes, we offer a 30-day money-back guarantee if you&apos;re not satisfied.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

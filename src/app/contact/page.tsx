import Link from 'next/link';

export default function Contact() {
  return (
    <div className="min-h-screen py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-white hover:text-[#00C9FF] mb-8 inline-block font-medium drop-shadow-md transition-colors duration-300">
          ← Back to Home
        </Link>
        
        <h1 className="text-4xl md:text-5xl font-bold mb-8 text-white drop-shadow-lg">
          Contact Us
        </h1>
        
        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-8 border-2 border-white/30 shadow-xl">
          <p className="text-xl text-white/95 mb-8 font-medium drop-shadow-sm">
            Have questions about Image 2 Ads? We'd love to hear from you!
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">Get in Touch</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-white drop-shadow-sm">Email</h3>
                  <p className="text-white/90">image2ad@proton.me</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white drop-shadow-sm">Social Media</h3>
                  <p className="text-white/90">
                    Follow us on{' '}
                    <a 
                      href="https://www.facebook.com/profile.php?id=61580386327319" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[#00C9FF] hover:text-[#92FE9D] transition-colors duration-300 font-medium"
                    >
                      Facebook
                    </a>
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white drop-shadow-sm">Business Hours</h3>
                  <p className="text-white/90">
                    Our AI works 24/7, and our support team is available Monday-Friday, 9 AM - 6 PM EST
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-md">Frequently Asked Questions</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-white drop-shadow-sm">How fast is the AI generation?</h3>
                  <p className="text-white/90">Our AI generates professional ads in 10-15 seconds!</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white drop-shadow-sm">What image formats do you accept?</h3>
                  <p className="text-white/90">We accept JPG, PNG, and most common image formats.</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white drop-shadow-sm">Do you offer refunds?</h3>
                  <p className="text-white/90">Yes, we offer a 30-day money-back guarantee if you're not satisfied.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

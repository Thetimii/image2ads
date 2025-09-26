import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import BeforeAfterGallery from "@/components/BeforeAfterGallery";
import PricingSection from "@/components/PricingSection";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen text-gray-800">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <BeforeAfterGallery />
        <PricingSection />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}

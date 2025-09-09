import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import BeforeAfterGallery from "@/components/BeforeAfterGallery";
import LeadCapture from "@/components/LeadCapture";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen text-white">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <BeforeAfterGallery />
        <LeadCapture />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}

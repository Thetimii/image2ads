import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import BeforeAfterGallery from "@/components/BeforeAfterGallery";
import PricingSection from "@/components/PricingSection";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import { StudioExperience } from "@/components/studio/StudioMotion";

export default function Home() {
  return (
    <StudioExperience>
      <a className="studio-skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      <main id="main-content">
        <Hero />
        <BeforeAfterGallery />
        <HowItWorks />
        <PricingSection />
        <FAQ />
      </main>
      <Footer />
    </StudioExperience>
  );
}

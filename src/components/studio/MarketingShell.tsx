import type { ReactNode } from "react";
import Header from "../Header";
import Footer from "../Footer";
import { StudioExperience } from "./StudioMotion";

export default function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <StudioExperience>
      <a className="studio-skip-link" href="#page-content">
        Skip to content
      </a>
      <Header />
      <main id="page-content" className="studio-page-content studio-container">
        {children}
      </main>
      <Footer />
    </StudioExperience>
  );
}

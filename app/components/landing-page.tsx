import { HeroSection } from "./landing/hero-section";
import { SiteHeader } from "./landing/site-header";
import {
  ContactSection,
  DemoSection,
  ExpansionSection,
  FaqSection,
  FooterSection,
  ProblemSection,
  RigourSection,
  SolutionSection,
  UseCasesSection,
} from "./landing/sections";

export function LandingPage() {
  return (
    <main className="min-h-screen bg-[#081119] text-[#eef4f8]">
      <SiteHeader />
      <div className="lp-page-shell">
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <UseCasesSection />
        <DemoSection />
        <ExpansionSection />
        <RigourSection />
        <FaqSection />
        <ContactSection />
      </div>
      <FooterSection />
    </main>
  );
}

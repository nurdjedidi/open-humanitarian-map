import { landingConfig } from "~/content";

import { CtaButton } from "./cta-button";

const navItems = [
  { href: "#probleme", label: "Problème" },
  { href: "#solution", label: "Solution" },
  { href: "#demo", label: "Démo" },
  { href: "#contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="lp-header">
      <div className="lp-header-shell">
        <a className="lp-brand" href="#top">
          <span className="lp-brand-mark">HM</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black tracking-[0.08em] text-[#f8f4ed]">
              {landingConfig.productName}
            </span>
            <span className="lp-brand-subtitle block truncate text-xs text-[#8ca2b5]">
              Cartographie décisionnelle pour ONG
            </span>
          </span>
        </a>

        <nav className="lp-nav" aria-label="Navigation principale">
          {navItems.map((item) => (
            <a key={item.href} className="lp-nav-link" href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex">
          <CtaButton href={landingConfig.demoUrl} external>
            Voir la démo
          </CtaButton>
        </div>
      </div>
    </header>
  );
}

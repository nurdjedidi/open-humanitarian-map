import { landingConfig } from "~/content";

import { CtaButton } from "./cta-button";
import { MapPreview } from "./map-preview";

export function HeroSection() {
  return (
    <section className="lp-section lp-hero-section" id="top">
      <div className="lp-hero-stack">
        <div className="mx-auto max-w-4xl text-center">
          <p className="lp-eyebrow">
            Cartographie humanitaire • aide à la décision • ONG
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] text-[#fbf8f2] sm:text-5xl md:mt-5 md:text-6xl md:leading-[0.98] xl:text-7xl">
            Identifiez où intervenir en priorité.
          </h1>

          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-[#b6c3cf] sm:text-lg sm:leading-8 md:mt-6 md:text-[1.15rem]">
            {landingConfig.productName} aide les ONG et équipes opérations à
            croiser les données terrain pour produire une carte
            humanitaire lisible, priorisée et immédiatement exploitable.
          </p>

          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <CtaButton href={landingConfig.demoUrl} external>
              Voir la démo
            </CtaButton>
            <CtaButton href="#contact" variant="secondary">
              Prendre contact
            </CtaButton>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 text-sm text-[#d4dee8] sm:mt-9 sm:gap-3">
            <span className="lp-chip">Cartographie humanitaire</span>
            <span className="lp-chip">Priorisation géographique ONG</span>
            <span className="lp-chip">Analyse IPC et population</span>
            <span className="lp-chip">Lecture terrain et accès</span>
          </div>
        </div>

        <div className="mt-8 sm:mt-10">
          <MapPreview />
        </div>
      </div>
    </section>
  );
}

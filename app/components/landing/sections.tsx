import type { LucideIcon } from "lucide-react";
import {
  CircleHelp,
  Clock3,
  Droplets,
  Globe2,
  Map,
  MapPinned,
  Route,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";

import { landingConfig } from "~/content";

import { CtaButton } from "./cta-button";
import { SectionHeading } from "./section-heading";

const problemCards: Array<{
  icon: LucideIcon;
  title: string;
  text: string;
}> = [
  {
    icon: Map,
    title: "Données dispersées",
    text: "Les limites admin, les fichiers IPC, les rasters population et les couches terrain vivent rarement au même endroit ni au même format.",
  },
  {
    icon: Clock3,
    title: "Décision lente",
    text: "Les équipes doivent souvent comparer plusieurs fichiers à la main avant de savoir où concentrer l'attention et les ressources.",
  },
  {
    icon: Route,
    title: "Lecture terrain incomplète",
    text: "Même avec une zone prioritaire identifiée, il manque souvent une lecture rapide des routes, villages et points d'eau visibles.",
  },
];

const solutionSteps = [
  "Ingestion des données humanitaires géospatiales et tabulaires",
  "Croisement de l'IPC, de la population et du contexte administratif",
  "Agrégation par région pour obtenir une lecture comparable",
  "Ajout du contexte terrain utile via OSM",
  "Production d'une carte humanitaire prête pour la lecture opérationnelle",
];

const useCases: Array<{ icon: LucideIcon; label: string }> = [
  { icon: MapPinned, label: "Prioriser les interventions par région" },
  { icon: Workflow, label: "Préparer un brief de coordination" },
  {
    icon: Users,
    label: "Comparer deux zones de même phase IPC mais de poids humain différent",
  },
  { icon: Globe2, label: "Préparer une mission terrain ou une revue programme" },
  { icon: ShieldCheck, label: "Appuyer une note bailleur ou un échange de pilotage" },
  { icon: Map, label: "Expliquer visuellement une priorisation géographique ONG" },
];

const regionalTargets = [
  "Sénégal",
  "Gambie",
  "Guinée",
  "Guinée-Bissau",
  "Sierra Leone",
];

const faqItems: Array<{
  icon: LucideIcon;
  question: string;
  answer: string;
}> = [
  {
    icon: CircleHelp,
    question: "À quoi sert cet outil de cartographie humanitaire ?",
    answer:
      "Il sert à aider une ONG ou une équipe opérations à identifier où intervenir en priorité à partir de données IPC, population et contexte terrain.",
  },
  {
    icon: CircleHelp,
    question: "Est-ce uniquement une carte ou un vrai outil d'aide à la décision ?",
    answer:
      "L'objectif est d'aller au-delà d'un simple viewer SIG : la carte synthétise les besoins, hiérarchise les régions et montre le contexte utile pour lire le terrain.",
  },
  {
    icon: CircleHelp,
    question: "Quels types de données peuvent être croisés ?",
    answer:
      "Le produit est pensé pour croiser des limites administratives, des données IPC, de la population, des rasters et des couches OSM comme les routes, villages ou points d'eau.",
  },
  {
    icon: CircleHelp,
    question: "Le produit est-il limité au Sénégal ?",
    answer:
      "Le Sénégal est la base actuelle de démonstration, mais l'architecture vise une extension vers d'autres pays d'Afrique de l'Ouest.",
  },
];

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="lp-icon-badge" aria-hidden="true">
      <Icon size={18} strokeWidth={2.1} />
    </span>
  );
}

export function ProblemSection() {
  return (
    <section className="lp-section lp-section-band" id="probleme">
      <SectionHeading
        eyebrow="Le problème"
        title="Les ONG ont besoin d'une lecture géographique claire, pas d'une pile de fichiers impossibles à relier vite."
        description="La priorisation humanitaire devient fragile quand l'IPC, la population, les limites administratives et le terrain ne se lisent pas ensemble."
      />

      <div className="mt-8 grid gap-4 md:mt-10 md:grid-cols-3 md:gap-5">
        {problemCards.map((card, index) => (
          <article key={card.title} className="lp-card lp-card-problem p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <IconBadge icon={card.icon} />
              <div className="lp-card-index">0{index + 1}</div>
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#f8f4ed] sm:mt-5 sm:text-xl">
              {card.title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-[#b6c3cf] sm:text-base">
              {card.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SolutionSection() {
  return (
    <section className="lp-section" id="solution">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div>
          <SectionHeading
            eyebrow="La solution"
            title="Une carte humanitaire décisionnelle qui transforme les données dispersées en priorités d'action."
            description="L'approche est pensée pour les ONG et la coordination terrain : on croise les signaux utiles, on les agrège par région, puis on les rend lisibles dans une seule interface."
          />
        </div>

        <div className="lp-card lp-card-process p-5 sm:p-6 md:p-7">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0c170] sm:text-sm">
            Pipeline métier
          </div>
          <ol className="mt-5 space-y-4 sm:mt-6">
            {solutionSteps.map((step, index) => (
              <li key={step} className="flex gap-4">
                <span className="lp-step-badge">{index + 1}</span>
                <span className="pt-0.5 text-sm leading-7 text-[#d7e1e9] sm:pt-1 sm:text-base">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function UseCasesSection() {
  return (
    <section className="lp-section lp-section-band-soft" id="cas-usage">
      <SectionHeading
        eyebrow="Cas d'usage"
        title="Une carte pensée pour décider, expliquer et coordonner."
        description="La valeur ne vient pas seulement du croisement de données, mais de la capacité à transformer la carte en outil de priorisation géographique humanitaire."
        center
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 md:mt-10">
        {useCases.map((useCase) => (
          <article
            key={useCase.label}
            className="lp-card lp-card-usecase min-h-[152px] p-5 sm:min-h-[168px] sm:p-6"
          >
            <div className="lp-card-glow" />
            <div className="relative">
              <IconBadge icon={useCase.icon} />
            </div>
            <div className="relative mt-4 text-base font-semibold leading-7 text-[#edf4f8] sm:mt-5 sm:text-lg sm:leading-8">
              {useCase.label}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function DemoSection() {
  return (
    <section className="lp-section" id="demo">
      <div className="lp-card overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border-b border-white/8 p-5 sm:p-6 md:p-7 lg:border-b-0 lg:border-r">
            <SectionHeading
              eyebrow="Voir la démo"
              title="La carte web montre déjà la logique produit : priorités régionales, couches OSM utiles et lecture rapide."
              description="Le démonstrateur actuel met en avant le Sénégal, avec une carte principale priorisée et des couches contextuelles comme les routes, les lieux habités et les points d'eau."
            />

            <div className="mt-6 space-y-4 text-sm leading-7 text-[#c3d0da] sm:mt-8 sm:text-base">
              <p>
                Le cœur du produit est d'aider une ONG à répondre vite à une
                question simple : <strong>où agir d'abord ?</strong>
              </p>
              <p>
                Ensuite, la carte permet de comprendre le terrain visible sans
                surcharger l'interface.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-4">
              <CtaButton href={landingConfig.demoUrl} external>
                Ouvrir la démo
              </CtaButton>
              <CtaButton href="#contact" variant="ghost">
                Demander une présentation
              </CtaButton>
            </div>
          </div>

          <div className="bg-[linear-gradient(160deg,rgba(17,27,40,0.96),rgba(8,16,25,0.98))] p-5 sm:p-6 md:p-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="lp-card lp-card-mini p-5">
                <IconBadge icon={MapPinned} />
                <div className="mt-4 text-xs uppercase tracking-[0.18em] text-[#89b9ea] sm:text-sm">
                  Couche principale
                </div>
                <div className="mt-3 text-xl font-black text-[#f9f6ef] sm:text-2xl">
                  Score par région
                </div>
                <p className="mt-3 text-sm leading-7 text-[#b6c3cf]">
                  Phase IPC, population P3+, poids humain et lecture synthétique
                  de la priorité.
                </p>
              </div>

              <div className="lp-card lp-card-mini p-5">
                <IconBadge icon={Droplets} />
                <div className="mt-4 text-xs uppercase tracking-[0.18em] text-[#89b9ea] sm:text-sm">
                  Contexte terrain
                </div>
                <div className="mt-3 text-xl font-black text-[#f9f6ef] sm:text-2xl">
                  Routes, eau, villages
                </div>
                <p className="mt-3 text-sm leading-7 text-[#b6c3cf]">
                  Lecture contextuelle pour comprendre l'environnement visible
                  autour d'une zone prioritaire.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ExpansionSection() {
  return (
    <section className="lp-section lp-section-band" id="extension-regionale">
      <SectionHeading
        eyebrow="Extension régionale"
        title="Sénégal aujourd'hui, logique Afrique de l'Ouest demain."
        description="L'architecture du produit et des exports a été pensée pour permettre une montée en charge pays par pays sans refaire tout le socle."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 md:mt-10">
        {regionalTargets.map((country, index) => (
          <article
            key={country}
            className={[
              "lp-card p-5 sm:p-6",
              index === 0 ? "lp-card-country-active" : "lp-card-country",
            ].join(" ")}
          >
            <div className="text-xs uppercase tracking-[0.18em] text-[#8fb6d8] sm:text-sm">
              {index === 0 ? "Base actuelle" : "Étape suivante"}
            </div>
            <div className="mt-3 text-xl font-black text-[#fbf8f2] sm:text-2xl">
              {country}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function RigourSection() {
  return (
    <section className="lp-section" id="rigueur-donnees">
      <SectionHeading
        eyebrow="Sources et rigueur"
        title="Un discours produit crédible repose aussi sur des sources et des licences claires."
        description="La page reste orientée usage, mais le produit s'appuie sur des jeux de données humanitaires et cartographiques traçables."
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <article className="lp-card p-5 sm:p-6">
          <IconBadge icon={ShieldCheck} />
          <h3 className="mt-4 text-lg font-bold text-[#f8f4ed] sm:mt-5">
            IPC et sécurité alimentaire
          </h3>
          <p className="mt-3 text-sm leading-7 text-[#c0ccd7]">
            Données IPC, sécurité alimentaire et nutrition utilisées comme base
            de priorisation quand elles sont disponibles.
          </p>
        </article>
        <article className="lp-card p-5 sm:p-6">
          <IconBadge icon={Users} />
          <h3 className="mt-4 text-lg font-bold text-[#f8f4ed] sm:mt-5">
            Population et admin
          </h3>
          <p className="mt-3 text-sm leading-7 text-[#c0ccd7]">
            Limites administratives, population agrégée et autres couches
            régionales pour rendre la lecture comparable.
          </p>
        </article>
        <article className="lp-card p-5 sm:p-6">
          <IconBadge icon={Droplets} />
          <h3 className="mt-4 text-lg font-bold text-[#f8f4ed] sm:mt-5">
            Contexte terrain
          </h3>
          <p className="mt-3 text-sm leading-7 text-[#c0ccd7]">
            Routes, points d'eau et lieux habités issus d'OpenStreetMap pour
            compléter la lecture opérationnelle du terrain.
          </p>
        </article>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section className="lp-section lp-section-band-soft" id="faq">
      <SectionHeading
        eyebrow="FAQ"
        title="Questions fréquentes autour de la cartographie humanitaire pour ONG."
        description="Une FAQ courte aide à la compréhension produit et des enjeux."
      />

      <div className="mt-8 space-y-4">
        {faqItems.map((item) => (
          <details key={item.question} className="lp-faq-item group">
            <summary className="lp-faq-summary">
              <span className="min-w-0 flex items-center gap-3 sm:gap-4">
                <IconBadge icon={item.icon} />
                <span className="lp-faq-question">{item.question}</span>
              </span>
              <span className="lp-faq-icon" aria-hidden="true">
                +
              </span>
            </summary>
            <div className="lp-faq-answer">
              <p className="max-w-4xl text-sm leading-7 text-[#bfccd7] sm:text-base sm:leading-8">
                {item.answer}
              </p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ContactSection() {
  return (
    <section className="lp-section pb-10" id="contact">
      <div className="lp-card lp-card-contact p-5 sm:p-7 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-8">
          <div>
            <SectionHeading
              eyebrow="Contact"
              title="Vous voulez tester la démo, discuter d'un pilote ou préparer un déploiement sur d'autres pays ou zones ?"
              description="La première version est centrée sur le Sénégal, mais la logique produit vise une montée en charge multi-pays en Afrique de l'Ouest."
            />
          </div>

          <div className="flex flex-col gap-3 sm:gap-4">
            <CtaButton href={landingConfig.contact.email} variant="primary" external>
              Écrire par email
            </CtaButton>
            <CtaButton href={landingConfig.contact.whatsapp} variant="secondary" external>
              Contacter sur WhatsApp
            </CtaButton>
            <CtaButton href={landingConfig.contact.linkedin} variant="ghost" external>
              Voir le profil LinkedIn
            </CtaButton>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FooterSection() {
  return (
    <footer className="border-t border-white/8 px-4 py-6 text-xs text-[#90a3b3] sm:px-5 sm:text-sm md:px-8">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          OHM • Open Humanitarian Map • Outil de cartographie humanitaire et
          d'aide à la décision pour ONG
        </div>
        <div>
          Sénégal en base produit, extension prévue vers la Gambie, la Guinée,
          la Guinée-Bissau et la Sierra Leone.
        </div>
      </div>
    </footer>
  );
}

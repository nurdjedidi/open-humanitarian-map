import type { Locale } from "./detect-locale";

export const messages = {
  fr: {
    common: {
      brandShort: "OHM",
      brandFull: "Open Humanitarian Map",
      languageFr: "FR",
      languageEn: "EN",
      noData: "Aucune donnée",
      urgentHigh: "Urgence forte",
      close: "Fermer",
    },
    seo: {
      homeTitle: "OHM – Open Humanitarian Map | Cartographie humanitaire pour ONG",
      homeDescription:
        "OHM est un outil de cartographie décisionnelle pour ONG. Croisez IPC, population, routes, villages, points d’eau et accès terrain pour identifier où intervenir en priorité.",
      aboutTitle: "OHM – À propos",
      sourcesTitle: "OHM – Sources",
      contactTitle: "OHM – Contact",
    },
    demo: {
      title: "OHM map",
      layers: "Couches",
      roads: "Routes principales",
      water: "Points d’eau",
      settlements: "Lieux habités",
      timelineLabel: "Timeline IPC",
      timelineHint:
        "Fais glisser pour relire les snapshots IPC du plus ancien au plus récent.",
      timelineFallbackNote:
        "Certaines zones n'ont pas de donnée pour cette année. Dernière donnée utilisée: {details}.",
      population2020Note:
        "Population de référence: raster WorldPop 2020 agrégé par région.",
      layersHint:
        "Les routes restent visibles par défaut. L’eau et les lieux habités deviennent plus utiles en zoomant.",
      basemap: "Fond de carte",
      basemapVoyagerLabel: "Voyager",
      basemapVoyagerDesc: "Fond clair, bon pour la lecture régionale",
      basemapDarkLabel: "Dark",
      basemapDarkDesc: "Contraste fort pour les couches opérationnelles",
      basemapSatelliteLabel: "Satellite",
      basemapSatelliteDesc: "Fond image pour vérification terrain",
      legend: "Légende",
      mapLoaderTitle: "Chargement de la carte",
      mapLoaderBody:
        "Initialisation du fond, des régions prioritaires et des couches terrain.",
      mapTooltipLineRegion: "{score} | Phase IPC {phase}",
      mapTooltipLineRegion2: "P3+: {p3} | Pop: {population}",
      defaultReason: "Analyse disponible dans la fiche région.",
      defaultMapTitle: "Sénégal",
      navAbout: "About",
      navSources: "Sources",
      navContact: "Contact",
    },
    info: {
      backToMap: "Retour à la carte",
      aboutTitle: "À propos d’OHM",
      aboutBody1:
        "OHM est un outil de cartographie décisionnelle conçu pour aider les ONG et équipes opérations à identifier où intervenir en priorité.",
      aboutBody2:
        "Le cœur du produit est de croiser des données IPC, population et contexte terrain pour produire une lecture géographique claire, rapide et exploitable.",
      aboutBody3:
        "La version actuelle met en avant le Sénégal, avec une logique pensée pour une montée en charge vers d’autres pays et jeux de données.",
      sourcesTitle: "Sources et licences",
      sourcesIntro:
        "Les couches visibles dans la carte reposent sur des sources cartographiques et humanitaires explicitement attribuées.",
      sourceOsm: "© OpenStreetMap contributors (via Geofabrik).",
      sourceIpc:
        "IPC – Integrated Food Security Phase Classification – © Government, CILSS, IPC, contributor: Food Security and Nutrition Working Group, West and Central Africa, via Humanitarian Data Exchange (CC BY).",
      sourceBoundaries:
        "Senegal boundaries – © Government of Senegal, updated by OCHA/ROWCA, via Humanitarian Data Exchange (CC BY-IGO).",
      contactTitle: "Contact",
      contactBody:
        "Pour discuter d’un pilote, d’une adaptation à un autre pays ou d’un usage ONG/opérations, tu peux utiliser les liens ci-dessous.",
      contactEmail: "Écrire par email",
      contactWhatsapp: "Contacter sur WhatsApp",
      contactLinkedin: "Voir le LinkedIn",
    },
  },
  en: {
    common: {
      brandShort: "OHM",
      brandFull: "Open Humanitarian Map",
      languageFr: "FR",
      languageEn: "EN",
      noData: "No data",
      urgentHigh: "High urgency",
      close: "Close",
    },
    seo: {
      homeTitle: "OHM – Open Humanitarian Map | Humanitarian mapping for NGOs",
      homeDescription:
        "OHM is a decision-support humanitarian mapping tool for NGOs. Combine IPC, population, roads, settlements, water points and field access to identify where to intervene first.",
      aboutTitle: "OHM – About",
      sourcesTitle: "OHM – Sources",
      contactTitle: "OHM – Contact",
    },
    demo: {
      title: "OHM map",
      layers: "Layers",
      roads: "Main roads",
      water: "Water points",
      settlements: "Settlements",
      timelineLabel: "IPC timeline",
      timelineHint:
        "Use the slider to move from the oldest to the most recent IPC snapshot.",
      timelineFallbackNote:
        "Some areas do not have data for this year. Latest available data used: {details}.",
      population2020Note:
        "Population reference: WorldPop 2020 raster aggregated by region.",
      layersHint:
        "Roads stay visible by default. Water and settlements become more useful as you zoom in.",
      basemap: "Basemap",
      basemapVoyagerLabel: "Voyager",
      basemapVoyagerDesc: "Light basemap, good for regional reading",
      basemapDarkLabel: "Dark",
      basemapDarkDesc: "High contrast for operational layers",
      basemapSatelliteLabel: "Satellite",
      basemapSatelliteDesc: "Imagery basemap for field verification",
      legend: "Legend",
      mapLoaderTitle: "Loading map",
      mapLoaderBody:
        "Initializing basemap, priority regions and field context layers.",
      mapTooltipLineRegion: "{score} | IPC phase {phase}",
      mapTooltipLineRegion2: "P3+: {p3} | Pop: {population}",
      defaultReason: "Analysis available in the region sheet.",
      defaultMapTitle: "Senegal",
      navAbout: "About",
      navSources: "Sources",
      navContact: "Contact",
    },
    info: {
      backToMap: "Back to map",
      aboutTitle: "About OHM",
      aboutBody1:
        "OHM is a decision-oriented mapping tool designed to help NGOs and operations teams identify where to intervene first.",
      aboutBody2:
        "The core idea is to combine IPC, population and field context datasets into a clear, fast and actionable geographic reading.",
      aboutBody3:
        "The current version focuses on Senegal, with a structure designed to scale to other countries and dataset types.",
      sourcesTitle: "Sources and licenses",
      sourcesIntro:
        "Visible layers in the map rely on humanitarian and cartographic sources with explicit attribution.",
      sourceOsm: "© OpenStreetMap contributors (via Geofabrik).",
      sourceIpc:
        "IPC – Integrated Food Security Phase Classification – © Government, CILSS, IPC, contributor: Food Security and Nutrition Working Group, West and Central Africa, via Humanitarian Data Exchange (CC BY).",
      sourceBoundaries:
        "Senegal boundaries – © Government of Senegal, updated by OCHA/ROWCA, via Humanitarian Data Exchange (CC BY-IGO). " +
        "Gambia boundaries - © Gambia National Disaster Management Agency(NDMA), via Humanitarian Data Exchange (CC BY-IGO).",
      contactTitle: "Contact",
      contactBody:
        "To discuss a pilot, an adaptation to another country, or an NGO/operations use case, you can use the links below.",
      contactEmail: "Send an email",
      contactWhatsapp: "Contact on WhatsApp",
      contactLinkedin: "View LinkedIn",
    },
  },
} as const;

export type MessageKey = string;

export function getMessage(locale: Locale, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = messages[locale];

  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      current = undefined;
      break;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : undefined;
}

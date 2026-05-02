import { useI18n } from "~/i18n/use-i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { AlertTriangle, X } from "lucide-react";

import {
  createContribution,
  getCurrentUser,
  getValidatedContributions,
  type AuthState,
  type ContributionType,
} from "~/api/ohm-api";
import { AdminReviewPanel } from "./contributions/admin-review-panel";
import { AuthModal } from "./contributions/auth-modal";
import { ContributionControls } from "./contributions/contribution-controls";
import type { AnalysisMode, MapDataset, PopulationCountrySummary } from "~/data/dataset-types";
import {
  getIpcCountrySummary,
  getRegionDetail,
  hydrateAdminForCountry,
  loadCountryLayer,
  loadCombinedLayer,
  getTimelineFallbackSummary,
  getTimelineYears,
  loadCombinedDatasetProgressive,
  projectDatasetForYear,
} from "~/data/runtime-datasets";
import { BASEMAPS, MapView, type BasemapId, type ViewMode } from "./map-view";
import { FloatingControlButtons, FloatingSidePanel, type FloatingPanelId } from "./map-first/floating-controls";
import { OverlayHeader } from "./map-first/overlay-header";
import { RegionTimelinePanel } from "./map-first/region-timeline-panel";
import { formatCompactNumber, formatPercent } from "~/utils";
import type { ManifestIpcCountryOverview } from "~/data/dataset-types";

function asFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasCountryTiles(dataset: MapDataset, layerId: "osm_roads" | "osm_water" | "osm_settlements") {
  return dataset.countries.some((country) => Boolean(country.tileUrls[layerId]));
}

function slugFromFeatureId(featureId: string | null | undefined): string | null {
  if (!featureId) return null;
  const separator = featureId.indexOf(":");
  return separator === -1 ? null : featureId.slice(0, separator);
}

function summarizePopulationLayer(
  layer: FeatureCollection | null | undefined,
): PopulationCountrySummary[] {
  if (!layer?.features?.length) return [];

  const byCountry = new Map<string, PopulationCountrySummary>();
  for (const feature of layer.features) {
    const props = feature.properties ?? {};
    const countryKey = String(props.country_slug ?? props.country ?? "unknown");
    const countryName = String(props.country_name ?? props.country ?? countryKey);
    const weight = Number(props.weight ?? props.population ?? 0);
    const density = Number(props.density ?? props.population_density ?? 0);
    const yearLabel = String(props.year_label ?? props.source_year ?? "n/a");

    const current =
      byCountry.get(countryKey) ??
      {
        countryKey,
        countryName,
        points: 0,
        totalWeight: 0,
        maxWeight: 0,
        avgDensity: 0,
        yearLabel,
      };

    current.points += 1;
    current.totalWeight += Number.isFinite(weight) ? weight : 0;
    current.maxWeight = Math.max(current.maxWeight, Number.isFinite(weight) ? weight : 0);
    current.avgDensity = (current.avgDensity ?? 0) + (Number.isFinite(density) ? density : 0);
    if (current.yearLabel === "n/a" && yearLabel !== "n/a") {
      current.yearLabel = yearLabel;
    }
    byCountry.set(countryKey, current);
  }

  return Array.from(byCountry.values())
    .map((item) => ({
      ...item,
      avgDensity: item.points > 0 ? (item.avgDensity ?? 0) / item.points : null,
    }))
    .sort((left, right) => right.totalWeight - left.totalWeight);
}

function readProjectedIpcMetric(
  properties: Record<string, unknown>,
  primaryKey: string,
  suffixes: string[],
): number {
  const primaryValue = asFiniteNumber(properties[primaryKey]);
  if (primaryValue > 0) return primaryValue;

  for (const [key, value] of Object.entries(properties)) {
    const normalized = key.toLowerCase();
    if (suffixes.some((suffix) => normalized.endsWith(suffix))) {
      const candidate = asFiniteNumber(value);
      if (candidate > 0) return candidate;
    }
  }

  return 0;
}

function buildIpcOverviewFromDataset(dataset: MapDataset | null, fallbackP3Plus = 0) {
  const empty = {
    totals: {
      population: 0,
      phase1: 0,
      phase2: 0,
      phase3: 0,
      phase4: 0,
      phase5: 0,
      phase3plus: fallbackP3Plus,
    },
    topCountries: [] as Array<{
      countryKey: string;
      countryName: string;
      latestYear: number | null;
      phase3plus: number;
      phase3plusShare: number | null;
      phase4: number;
      phase5: number;
    }>,
  };

  if (!dataset?.admin.features.length) return empty;

  const byCountry = new Map<string, {
    countryKey: string;
    countryName: string;
    latestYear: number | null;
    population: number;
    phase1: number;
    phase2: number;
    phase3: number;
    phase4: number;
    phase5: number;
    phase3plus: number;
  }>();

  for (const feature of dataset.admin.features) {
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const countryName = String(properties.country_name ?? properties.adm0_name ?? "Zone");
    const countryKey = String(properties.country_slug ?? properties.adm0_name ?? countryName);
    const current =
      byCountry.get(countryKey) ??
      {
        countryKey,
        countryName,
        latestYear: null,
        population: 0,
        phase1: 0,
        phase2: 0,
        phase3: 0,
        phase4: 0,
        phase5: 0,
        phase3plus: 0,
      };

    const timelineYear = asFiniteNumber(properties.timeline_year);
    if (timelineYear > 0) {
      current.latestYear =
        current.latestYear === null ? timelineYear : Math.max(current.latestYear, timelineYear);
    }

    current.population += readProjectedIpcMetric(properties, "ipc_population_total", ["_population"]);
    current.phase1 += readProjectedIpcMetric(properties, "ipc_phase1", ["_phase1"]);
    current.phase2 += readProjectedIpcMetric(properties, "ipc_phase2", ["_phase2"]);
    current.phase3 += readProjectedIpcMetric(properties, "ipc_phase3", ["_phase3"]);
    current.phase4 += readProjectedIpcMetric(properties, "ipc_phase4", ["_phase4"]);
    current.phase5 += readProjectedIpcMetric(properties, "ipc_phase5", ["_phase5"]);
    current.phase3plus += readProjectedIpcMetric(properties, "ipc_people_p3plus", ["_phase35", "_phase3plus"]);
    byCountry.set(countryKey, current);
  }

  const countries = Array.from(byCountry.values()).map((country) => ({
    ...country,
    phase3plusShare: country.population > 0 ? country.phase3plus / country.population : null,
  }));

  const totals = countries.reduce(
    (current, country) => ({
      population: current.population + country.population,
      phase1: current.phase1 + country.phase1,
      phase2: current.phase2 + country.phase2,
      phase3: current.phase3 + country.phase3,
      phase4: current.phase4 + country.phase4,
      phase5: current.phase5 + country.phase5,
      phase3plus: current.phase3plus + country.phase3plus,
    }),
    { population: 0, phase1: 0, phase2: 0, phase3: 0, phase4: 0, phase5: 0, phase3plus: 0 },
  );

  return {
    totals: {
      ...totals,
      phase3plus: totals.phase3plus > 0 ? totals.phase3plus : fallbackP3Plus,
    },
    topCountries: countries
      .sort((left, right) => {
        if (right.phase3plus !== left.phase3plus) return right.phase3plus - left.phase3plus;
        return (right.phase3plusShare ?? 0) - (left.phase3plusShare ?? 0);
      })
      .slice(0, 3)
      .map((country) => ({
        countryKey: country.countryKey,
        countryName: country.countryName,
        latestYear: country.latestYear,
        phase3plus: country.phase3plus,
        phase3plusShare: country.phase3plusShare,
        phase4: country.phase4,
        phase5: country.phase5,
      })),
  };
}

function buildIpcOverviewFromManifestCountries(dataset: MapDataset | null, fallbackP3Plus = 0) {
  const overviews = (dataset?.countries ?? [])
    .map((country) => country.ipcOverview)
    .filter((overview): overview is ManifestIpcCountryOverview => Boolean(overview));

  if (!overviews.length) {
    return null;
  }

  const countries = overviews.map((overview, index) => {
    const population = asFiniteNumber(overview.population_total);
    const phase3plus = asFiniteNumber(overview.phase3plus_total);
    return {
      countryKey: String(overview.country_key ?? dataset?.countries[index]?.slug ?? `country-${index}`),
      countryName: String(overview.country_name ?? dataset?.countries[index]?.title ?? "Zone"),
      latestYear:
        typeof overview.latest_year === "number" && Number.isFinite(overview.latest_year)
          ? overview.latest_year
          : null,
      population,
      phase1: asFiniteNumber(overview.phase1_total),
      phase2: asFiniteNumber(overview.phase2_total),
      phase3: asFiniteNumber(overview.phase3_total),
      phase4: asFiniteNumber(overview.phase4_total),
      phase5: asFiniteNumber(overview.phase5_total),
      phase3plus,
      phase3plusShare:
        typeof overview.phase3plus_share === "number" && Number.isFinite(overview.phase3plus_share)
          ? overview.phase3plus_share
          : population > 0
            ? phase3plus / population
            : null,
    };
  });

  const totals = countries.reduce(
    (current, country) => ({
      population: current.population + country.population,
      phase1: current.phase1 + country.phase1,
      phase2: current.phase2 + country.phase2,
      phase3: current.phase3 + country.phase3,
      phase4: current.phase4 + country.phase4,
      phase5: current.phase5 + country.phase5,
      phase3plus: current.phase3plus + country.phase3plus,
    }),
    { population: 0, phase1: 0, phase2: 0, phase3: 0, phase4: 0, phase5: 0, phase3plus: 0 },
  );

  return {
    totals: {
      ...totals,
      phase3plus: totals.phase3plus > 0 ? totals.phase3plus : fallbackP3Plus,
    },
    topCountries: countries
      .sort((left, right) => {
        if (right.phase3plus !== left.phase3plus) return right.phase3plus - left.phase3plus;
        return (right.phase3plusShare ?? 0) - (left.phase3plusShare ?? 0);
      })
      .slice(0, 3)
      .map((country) => ({
        countryKey: country.countryKey,
        countryName: country.countryName,
        latestYear: country.latestYear,
        phase3plus: country.phase3plus,
        phase3plusShare: country.phase3plusShare,
        phase4: country.phase4,
        phase5: country.phase5,
      })),
  };
}

function buildIpcOverview(ipcSummary: Array<{
  countryKey: string;
  countryName: string;
  latestYear: number | null;
  population: number;
  phase1: number;
  phase2: number;
  phase3: number;
  phase4: number;
  phase5: number;
  phase3plus: number;
  phase3plusShare: number | null;
}>, fallbackP3Plus = 0) {
  const totals = ipcSummary.reduce(
    (current, country) => ({
      population: current.population + country.population,
      phase1: current.phase1 + country.phase1,
      phase2: current.phase2 + country.phase2,
      phase3: current.phase3 + country.phase3,
      phase4: current.phase4 + country.phase4,
      phase5: current.phase5 + country.phase5,
      phase3plus: current.phase3plus + country.phase3plus,
    }),
    { population: 0, phase1: 0, phase2: 0, phase3: 0, phase4: 0, phase5: 0, phase3plus: 0 },
  );

  const topCountries = [...ipcSummary]
    .sort((left, right) => {
      if (right.phase3plus !== left.phase3plus) return right.phase3plus - left.phase3plus;
      return (right.phase3plusShare ?? 0) - (left.phase3plusShare ?? 0);
    })
    .slice(0, 3);

  return {
    totals: {
      ...totals,
      phase3plus: totals.phase3plus > 0 ? totals.phase3plus : fallbackP3Plus,
    },
    topCountries,
  };
}

function HungerSnapshotPanel({
  open,
  setOpen,
  loading,
  topCountries,
  totals,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  loading: boolean;
  topCountries: Array<{
    countryKey: string;
    countryName: string;
    latestYear: number | null;
    phase3plus: number;
    phase3plusShare: number | null;
    phase4: number;
    phase5: number;
  }>;
  totals: {
    population: number;
    phase1: number;
    phase2: number;
    phase3: number;
    phase4: number;
    phase5: number;
    phase3plus: number;
  };
}) {
  const activeYears = Array.from(
    new Set(topCountries.map((country) => country.latestYear).filter((year): year is number => typeof year === "number")),
  ).sort((left, right) => left - right);
  const activeYearsLabel =
    activeYears.length === 0
      ? "Référence active selon pays"
      : activeYears.length === 1
        ? `Référence active ${activeYears[0]}`
        : `Références actives ${activeYears[0]}-${activeYears[activeYears.length - 1]} selon pays`;
  const phaseCards = [
    { label: "IPC 1", value: totals.phase1, tone: "text-[#d7ef96]" },
    { label: "IPC 2", value: totals.phase2, tone: "text-[#ffd45d]" },
    { label: "IPC 3", value: totals.phase3, tone: "text-[#ffb24e]" },
    { label: "IPC 4", value: totals.phase4, tone: "text-[#ff8d74]" },
    { label: "IPC 5", value: totals.phase5, tone: "text-[#ff7387]" },
  ];
  const hasDetailedTotals =
    totals.population > 0 ||
    totals.phase1 > 0 ||
    totals.phase2 > 0 ||
    totals.phase3 > 0 ||
    totals.phase4 > 0 ||
    totals.phase5 > 0;

  return (
    <>
      <div
        className={[
          "pointer-events-none absolute inset-x-0 bottom-0 z-[38] flex justify-end px-4 pb-4 transition-all duration-200 md:px-5 md:pb-5",
          open ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100",
        ].join(" ")}
      >
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={[
              "inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#08131e]/92 text-sm font-semibold text-[#eef5fb] shadow-[0_18px_45px_rgba(2,6,12,0.34)] backdrop-blur-xl transition hover:bg-[#0e1c2b]/96",
              open ? "pointer-events-none" : "",
            ].join(" ")}
            aria-label="Ouvrir le brief faim"
            title="Brief faim"
            aria-hidden={open}
            tabIndex={open ? -1 : 0}
          >
            <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#d98a35]/18 text-[#ffd38b]">
              <AlertTriangle className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 rounded-full bg-[#d98a35] px-1.5 py-0.5 text-[9px] font-black text-[#08131e]">
                {topCountries.length || 3}
              </span>
            </span>
          </button>
        </div>
      </div>

      <aside
        className={[
          "pointer-events-none absolute inset-x-2 bottom-2 z-[39] md:inset-x-auto md:bottom-12 md:right-4 md:top-26 md:w-[380px]",
          open ? "" : "",
        ].join(" ")}
      >
        <div
          className={[
            "pointer-events-auto rounded-[26px] border border-white/10 bg-[#08131e]/96 text-[#eef5fb] shadow-[0_28px_90px_rgba(2,6,12,0.42)] backdrop-blur-xl transition-all duration-300",
            open
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-4 opacity-0",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#89b8e0]">
                Afrique · Signal faim
              </div>
              <h3 className="mt-1 text-lg font-semibold text-[#f5efe5]">3 pays les plus en danger</h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-[#d7e4ee] transition hover:bg-white/[0.08]"
              aria-label="Fermer le panneau"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="panel-scroll max-h-[72vh] overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:max-h-[70vh]">
            <div className="rounded-[22px] border border-[#d98a35]/18 bg-[linear-gradient(135deg,rgba(217,138,53,0.18),rgba(217,138,53,0.05))] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffd38b]">
                Donnée phare
              </div>
              <div className="mt-2 text-3xl font-black text-[#fff1cc]">
                {formatCompactNumber(totals.phase3plus)}
              </div>
              <div className="mt-1 text-sm text-[#f2d7a6]">personnes en phase IPC 3+ sur la référence active par pays</div>
              <div className="mt-3 text-xs text-[#c9d7e2]">
                Population totale couverte: {formatCompactNumber(totals.population)}
              </div>
              <div className="mt-1 text-[11px] text-[#9db2c3]">{activeYearsLabel}</div>
            </div>

            {loading || !hasDetailedTotals ? (
              <div className="mt-4 rounded-[22px] border border-white/8 bg-[#0c1824]/92 p-4 text-sm text-[#c9d7e2]">
                <div className="flex items-center gap-3">
                  <div className="map-loader h-5 w-5 rounded-full border-2 border-white/15 border-t-[#f0c170]" />
                  <div>
                    <div className="font-semibold text-[#eef5fb]">Brief famine en préparation</div>
                    <div className="mt-1 text-xs text-[#93a9bb]">
                      On charge les couches admin détaillées pour calculer les totaux IPC par phase sans afficher de faux zéros.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {phaseCards.map((phase) => (
                    <div key={phase.label} className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-[#89a1b4]">{phase.label}</div>
                      <div className={`mt-1 text-base font-black ${phase.tone}`}>{formatCompactNumber(phase.value)}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
              {topCountries.map((country, index) => (
                <article
                  key={country.countryKey}
                  className="rounded-[22px] border border-white/8 bg-[#13202d]/90 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#89b8e0]">
                        #{index + 1}
                      </div>
                      <h4 className="truncate text-lg font-semibold text-[#f5efe5]">{country.countryName}</h4>
                      <p className="mt-0.5 text-xs text-[#91a8ba]">Référence {country.latestYear ?? "n/a"}</p>
                    </div>
                    <div className="rounded-2xl border border-[#d98a35]/28 bg-[#d98a35]/10 px-3 py-2 text-right">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffd38b]">P3+</div>
                      <div className="text-sm font-black text-[#ffe2aa]">{formatPercent(country.phase3plusShare)}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-2xl bg-white/[0.045] px-3 py-2">
                      <div className="text-[#8fa8bb]">P3+</div>
                      <div className="mt-1 text-sm font-black text-[#edf5fb]">
                        {formatCompactNumber(country.phase3plus)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/[0.045] px-3 py-2">
                      <div className="text-[#8fa8bb]">P4</div>
                      <div className="mt-1 text-sm font-black text-[#ffb4a3]">
                        {formatCompactNumber(country.phase4)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/[0.045] px-3 py-2">
                      <div className="text-[#8fa8bb]">P5</div>
                      <div className="mt-1 text-sm font-black text-[#ff8aa0]">
                        {formatCompactNumber(country.phase5)}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function combinePopulationCollections(
  collections: Array<FeatureCollection | null | undefined>,
): FeatureCollection | null {
  const features = collections.flatMap((collection) => collection?.features ?? []);
  return features.length ? { type: "FeatureCollection", features } : null;
}

function AppLoader() {
  const { t } = useI18n();

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#061019] text-[#e8eef5]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(132,183,228,0.24),transparent_30%),radial-gradient(circle_at_80%_5%,rgba(240,193,112,0.20),transparent_28%),linear-gradient(135deg,#07111a_0%,#0a1722_48%,#07111a_100%)]" />
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:72px_72px]" />

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-3 py-3 md:px-4 md:py-4">
        <div className="flex min-w-0 items-center gap-3 rounded-[22px] border border-white/10 bg-[#08131e]/88 px-3 py-2.5 shadow-[0_18px_60px_rgba(2,6,12,0.32)] backdrop-blur-xl md:px-4 md:py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#08131e]/40 p-1 md:h-11 md:w-11 md:rounded-2xl">
            <img src="/favicon.svg" alt="OHM" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-[#84b7e4] md:text-[11px] md:tracking-[0.22em]">
              Open Humanitarian Map
            </p>
            <h1 className="truncate text-sm font-extrabold text-[#f4f8fc] md:text-lg">
              West Africa priority map
            </h1>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-[22px] border border-white/10 bg-[#08131e]/80 px-3 py-2 shadow-[0_18px_60px_rgba(2,6,12,0.24)] backdrop-blur-xl md:flex">
          <span className="h-9 w-24 rounded-full bg-white/[0.06]" />
          <span className="h-9 w-24 rounded-full bg-white/[0.06]" />
          <span className="h-9 w-20 rounded-full bg-white/[0.06]" />
        </div>
      </header>

      <div className="absolute left-3 top-[86px] z-10 flex flex-col gap-2 md:left-4 md:top-[96px]">
        {[0, 1, 2, 3].map((item) => (
          <span
            key={item}
            className="h-12 w-12 rounded-2xl border border-white/10 bg-[#08131e]/75 shadow-[0_12px_34px_rgba(2,6,12,0.3)] backdrop-blur-xl"
          />
        ))}
      </div>

      <div className="absolute inset-0 z-20 flex items-center justify-center px-6">
        <div className="flex max-w-[320px] flex-col items-center gap-3 rounded-3xl border border-white/10 bg-[#07111a]/70 px-6 py-5 text-center text-[#eef4fa] shadow-[0_24px_80px_rgba(2,6,12,0.36)] backdrop-blur-md">
          <div className="map-loader h-10 w-10 rounded-full border-2 border-white/15 border-t-[#f0c170]" />
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#e8bd78]">
            {t("demo.mapLoaderTitle")}
          </div>
          <div className="text-sm leading-6 text-[#d1dce6]">
            {t("demo.mapLoaderBody")}
          </div>
        </div>
      </div>
    </main>
  );
}

export function MapFirstPage() {
  const { t } = useI18n();
  const [dataset, setDataset] = useState<MapDataset | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDatasetComplete, setIsDatasetComplete] = useState(false);
  const [showWater, setShowWater] = useState(false);
  const [showSettlements, setShowSettlements] = useState(false);
  const [showRoads, setShowRoads] = useState(true);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("ipc");
  const [basemapId, setBasemapId] = useState<BasemapId>("voyager");
  const [viewMode, setViewMode] = useState<ViewMode>("flat");
  const [droneMode, setDroneMode] = useState(false);
  const [activePanel, setActivePanel] = useState<FloatingPanelId>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [contributionMode, setContributionMode] = useState(false);
  const [contributionPoint, setContributionPoint] = useState<[number, number] | null>(null);
  const [contributionType, setContributionType] = useState<ContributionType>("access");
  const [contributionValue, setContributionValue] = useState("accessible");
  const [contributionFeedback, setContributionFeedback] = useState<string | null>(null);
  const [contributionLoading, setContributionLoading] = useState(false);
  const [contributions, setContributions] = useState<FeatureCollection | null>(null);
  const [visibleCountrySlugs, setVisibleCountrySlugs] = useState<string[]>([]);
  const [populationByCountry, setPopulationByCountry] = useState<Record<string, FeatureCollection>>({});
  const [populationLoading, setPopulationLoading] = useState(false);
  const contextLayerStateRef = useRef({
    showRoads: true,
    showWater: false,
    showSettlements: false,
  });
  const datasetPopulationSlugs = useMemo(
    () =>
      dataset?.countries
        .filter((country) => Boolean(country.availableLayers.population))
        .map((country) => country.slug) ?? [],
    [dataset],
  );
  const populationTargetSlugs = useMemo(
    () => datasetPopulationSlugs,
    [datasetPopulationSlugs],
  );

  const refreshAuth = async () => {
    try {
      const next = await getCurrentUser();
      setAuth(next);
    } catch {
      setAuth(null);
    }
  };

  const refreshContributions = async () => {
    try {
      const next = await getValidatedContributions();
      setContributions(next);
    } catch {
      setContributions({ type: "FeatureCollection", features: [] });
    }
  };

  useEffect(() => {
    let mounted = true;
    loadCombinedDatasetProgressive((partial) => {
      if (!mounted) return;
      setDataset(partial);
      const years = getTimelineYears(partial);
      setActiveYear((current) => current ?? (years.length ? years[years.length - 1] : null));
    })
      .then((next) => {
        if (!mounted) return;
        setDataset(next);
        setIsDatasetComplete(true);
        const years = getTimelineYears(next);
        setActiveYear(years.length ? years[years.length - 1] : null);
      })
      .catch((error) => {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load datasets");
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    void refreshAuth();
    void refreshContributions();
  }, []);

  useEffect(() => {
    if (!dataset || !isDatasetComplete) return;
    const requestedLayers = [
      showRoads && !dataset.layers.osm_roads && !hasCountryTiles(dataset, "osm_roads")
        ? "osm_roads"
        : null,
      showWater && !dataset.layers.osm_water && !hasCountryTiles(dataset, "osm_water")
        ? "osm_water"
        : null,
      showSettlements &&
      !dataset.layers.osm_settlements &&
      !hasCountryTiles(dataset, "osm_settlements")
        ? "osm_settlements"
        : null,
    ].filter(Boolean) as Array<"osm_roads" | "osm_water" | "osm_settlements">;
    if (!requestedLayers.length) return;

    let cancelled = false;
    Promise.all(
      requestedLayers.map((layerId) =>
        loadCombinedLayer(layerId).then((collection) => [layerId, collection] as const),
      ),
    )
      .then((loadedLayers) => {
        if (cancelled) return;
        setDataset((current) => {
          if (!current) return current;
          return {
            ...current,
            layers: {
              ...current.layers,
              ...Object.fromEntries(loadedLayers),
            },
          };
        });
      })
      .catch((error) => {
        console.warn("[OHM] Couche OSM non chargee", error);
      });

    return () => {
      cancelled = true;
    };
  }, [dataset, isDatasetComplete, showRoads, showWater, showSettlements]);

  useEffect(() => {
    if (!dataset || !isDatasetComplete || analysisMode !== "population" || !populationTargetSlugs.length) {
      setPopulationLoading(false);
      return;
    }

    const missing = populationTargetSlugs.filter((slug) => !populationByCountry[slug]);
    if (!missing.length) {
      setPopulationLoading(false);
      return;
    }

    let cancelled = false;
    setPopulationLoading(true);
    Promise.all(missing.map((slug) => loadCountryLayer(slug, "population").then((collection) => [slug, collection] as const)))
      .then((entries) => {
        if (cancelled) return;
        setPopulationByCountry((current) => {
          const next = { ...current };
          for (const [slug, collection] of entries) {
            if (collection) next[slug] = collection;
          }
          return next;
        });
        setPopulationLoading(false);
      })
      .catch((error) => {
        if (!cancelled) {
          setPopulationLoading(false);
        }
        console.warn("[OHM] Couche population non chargee", error);
      });

    return () => {
      cancelled = true;
    };
  }, [analysisMode, dataset, isDatasetComplete, populationByCountry, populationTargetSlugs]);

  useEffect(() => {
    if (!dataset || !selectedRegionId) return;
    if (getRegionDetail(dataset, selectedRegionId)) return;

    const slug = slugFromFeatureId(selectedRegionId);
    if (!slug) return;

    let cancelled = false;
    hydrateAdminForCountry(slug)
      .then((next) => {
        if (!next || cancelled) return;
        setDataset(next);
      })
      .catch((error) => {
        console.warn(`[OHM] Hydratation ciblée admin ignorée: ${slug}`, error);
      });

    return () => {
      cancelled = true;
    };
  }, [dataset, selectedRegionId]);

  const basemapLabel = (id: BasemapId) => {
    if (id === "dark-matter") {
      return {
        label: t("demo.basemapDarkLabel"),
        description: t("demo.basemapDarkDesc"),
      };
    }
    if (id === "satellite") {
      return {
        label: t("demo.basemapSatelliteLabel"),
        description: t("demo.basemapSatelliteDesc"),
      };
    }
    return {
      label: t("demo.basemapVoyagerLabel"),
      description: t("demo.basemapVoyagerDesc"),
    };
  };

  const timelineYears = useMemo(
    () => (dataset ? getTimelineYears(dataset) : []),
    [dataset],
  );
  const displayDataset = useMemo(
    () => (dataset && activeYear !== null ? projectDatasetForYear(dataset, activeYear) : dataset),
    [dataset, activeYear],
  );
  const timelineFallbacks = useMemo(
    () => (dataset ? getTimelineFallbackSummary(dataset, activeYear) : []),
    [dataset, activeYear],
  );
  const ipcSummary = useMemo(
    () => (displayDataset ? getIpcCountrySummary(displayDataset, activeYear) : []),
    [displayDataset, activeYear],
  );
  const ipcOverview = useMemo(
    () => {
      const fallbackP3Plus = Number(displayDataset?.summary.people_p3plus_total ?? 0);
      const manifestOverview = buildIpcOverviewFromManifestCountries(displayDataset, fallbackP3Plus);
      if (manifestOverview && (manifestOverview.totals.population > 0 || manifestOverview.totals.phase3plus > 0)) {
        return manifestOverview;
      }
      const projectedOverview = buildIpcOverviewFromDataset(displayDataset, fallbackP3Plus);
      if (projectedOverview.totals.population > 0 || projectedOverview.totals.phase3plus > 0) {
        return projectedOverview;
      }
      return buildIpcOverview(ipcSummary, fallbackP3Plus);
    },
    [displayDataset, ipcSummary],
  );
  const hasImmediateSnapshotData = ipcOverview.totals.population > 0 || ipcOverview.totals.phase3plus > 0;
  useEffect(() => {
    if (!snapshotOpen || !dataset || dataset.adminHydrated || hasImmediateSnapshotData) {
      setSnapshotLoading(false);
      return;
    }

    let cancelled = false;
    setSnapshotLoading(true);

    (async () => {
      for (const country of dataset.countries) {
        if (cancelled) return;
        const next = await hydrateAdminForCountry(country.slug);
        if (cancelled || !next) continue;
        setDataset(next);
      }
      if (!cancelled) {
        setSnapshotLoading(false);
      }
    })().catch((error) => {
      console.warn("[OHM] Hydratation du brief faim ignorée", error);
      if (!cancelled) {
        setSnapshotLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [snapshotOpen, dataset, hasImmediateSnapshotData]);
  const populationSummary = useMemo(
    () =>
      summarizePopulationLayer(
        combinePopulationCollections(
          populationTargetSlugs.map((slug) => populationByCountry[slug]).filter(Boolean),
        ),
      ),
    [populationByCountry, populationTargetSlugs],
  );
  const populationOverlay = useMemo(
    () =>
      combinePopulationCollections(
        populationTargetSlugs.map((slug) => populationByCountry[slug]).filter(Boolean),
      ),
    [populationByCountry, populationTargetSlugs],
  );

  const changeAnalysisMode = (nextMode: AnalysisMode) => {
    if (nextMode === analysisMode) return;

    if (nextMode === "population") {
      if (!datasetPopulationSlugs.length) {
        return;
      }
      contextLayerStateRef.current = {
        showRoads,
        showWater,
        showSettlements,
      };
      setShowRoads(false);
      setShowWater(false);
      setShowSettlements(false);
      setSelectedRegionId(null);
      setActivePanel(null);
      const targetSlugs = datasetPopulationSlugs.filter((slug) => !populationByCountry[slug]);
      setPopulationLoading(targetSlugs.length > 0);
      setAnalysisMode("population");
      return;
    }

    setAnalysisMode("ipc");
    setPopulationLoading(false);
    setShowRoads(contextLayerStateRef.current.showRoads);
    setShowWater(contextLayerStateRef.current.showWater);
    setShowSettlements(contextLayerStateRef.current.showSettlements);
  };

  const setTypeAndDefaultValue = (nextType: ContributionType) => {
    setContributionType(nextType);
    const defaults: Record<ContributionType, string> = {
      access: "accessible",
      water: "functional",
      road: "truck_ok",
      ngo_presence: "active",
      alert: "food_crisis",
    };
    setContributionValue(defaults[nextType]);
  };

  const submitContribution = async () => {
    if (!auth) {
      setAuthModalOpen(true);
      return;
    }
    if (!contributionPoint) return;

    setContributionLoading(true);
    setContributionFeedback(null);
    try {
      await createContribution({
        geometry: {
          type: "Point",
          coordinates: contributionPoint,
        },
        type: contributionType,
        value: contributionValue,
        confidence: 0.5,
      });
      setContributionFeedback("Contribution envoyée. Elle sera visible après validation.");
      setContributionPoint(null);
      setContributionMode(false);
    } catch (error) {
      setContributionFeedback(error instanceof Error ? error.message : "Envoi impossible.");
    } finally {
      setContributionLoading(false);
    }
  };

  if (loadError) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-[#061019] px-6 text-[#e8eef5]">
        <div className="max-w-lg rounded-[26px] border border-white/10 bg-[#0a1420]/90 p-6 text-center shadow-[0_24px_80px_rgba(2,6,12,0.38)]">
          <p className="mt-3 text-sm text-[#a7b8c6]">{loadError}</p>
        </div>
      </main>
    );
  }

  if (!displayDataset || !dataset) {
    return <AppLoader />;
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#061019] text-[#e8eef5]">
      <div className="absolute inset-0">
        <MapView
          dataset={displayDataset}
          analysisMode={analysisMode}
          holdLoading={!isDatasetComplete || (analysisMode === "population" && populationLoading)}
          showRoads={showRoads}
          showWater={showWater}
          showSettlements={showSettlements}
          populationData={populationOverlay}
          basemapId={basemapId}
          viewMode={viewMode}
          droneMode={droneMode}
          selectedRegionId={selectedRegionId}
          contributionMode={contributionMode}
          contributions={contributions ?? undefined}
          pendingContributionCoordinate={contributionPoint}
          onMapClick={(coordinate) => {
            setContributionPoint(coordinate);
            setContributionFeedback(null);
          }}
          onRegionSelect={(region) => setSelectedRegionId(region?.id ?? null)}
          onVisibleCountriesChange={setVisibleCountrySlugs}
        />
      </div>

      <OverlayHeader dataset={dataset} />

      <FloatingControlButtons
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        analysisMode={analysisMode}
        setAnalysisMode={changeAnalysisMode}
      />

      <FloatingSidePanel
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        showRoads={showRoads}
        showWater={showWater}
        showSettlements={showSettlements}
        setShowRoads={setShowRoads}
        setShowWater={setShowWater}
        setShowSettlements={setShowSettlements}
        basemapId={basemapId}
        setBasemapId={setBasemapId}
        viewMode={viewMode}
        setViewMode={setViewMode}
        droneMode={droneMode}
        setDroneMode={setDroneMode}
        basemaps={BASEMAPS}
        basemapLabel={basemapLabel}
        legend={displayDataset.legend}
        analysisMode={analysisMode}
        setAnalysisMode={changeAnalysisMode}
        timelineYears={timelineYears}
        activeYear={activeYear}
        setActiveYear={setActiveYear}
        timelineFallbacks={timelineFallbacks}
        ipcSummary={ipcSummary}
        populationSummary={populationSummary}
      />

      <HungerSnapshotPanel
        open={snapshotOpen}
        setOpen={setSnapshotOpen}
        loading={snapshotLoading}
        topCountries={ipcOverview.topCountries}
        totals={ipcOverview.totals}
      />

      {analysisMode === "ipc" ? (
        <RegionTimelinePanel
          region={getRegionDetail(dataset, selectedRegionId)}
          onClose={() => setSelectedRegionId(null)}
        />
      ) : null}

      <ContributionControls
        isAuthenticated={Boolean(auth)}
        contributionMode={contributionMode}
        selectedCoordinate={contributionPoint}
        type={contributionType}
        value={contributionValue}
        feedback={contributionFeedback}
        loading={contributionLoading}
        onOpenAuth={() => setAuthModalOpen(true)}
        onToggleMode={() => {
          setContributionMode((current) => !current);
          setContributionPoint(null);
          setContributionFeedback(null);
        }}
        onTypeChange={setTypeAndDefaultValue}
        onValueChange={setContributionValue}
        onSubmit={submitContribution}
        onCancelPoint={() => setContributionPoint(null)}
      />

      <AdminReviewPanel auth={auth} onReviewed={refreshContributions} />

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={refreshAuth}
      />
    </main>
  );
}

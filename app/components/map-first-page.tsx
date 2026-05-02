import { useI18n } from "~/i18n/use-i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";

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
    () => (dataset ? getIpcCountrySummary(dataset, activeYear) : []),
    [dataset, activeYear],
  );
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

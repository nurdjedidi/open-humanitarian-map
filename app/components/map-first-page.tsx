import { useI18n } from "~/i18n/use-i18n";
import { useEffect, useMemo, useState } from "react";
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
import type { MapDataset } from "~/data/dataset-types";
import {
  getIpcCountrySummary,
  getRegionDetail,
  loadCombinedLayer,
  getTimelineFallbackSummary,
  getTimelineYears,
  loadCombinedDataset,
  projectDatasetForYear,
} from "~/data/runtime-datasets";
import { BASEMAPS, MapView, type BasemapId, type ViewMode } from "./map-view";
import { FloatingControlButtons, FloatingSidePanel, type FloatingPanelId } from "./map-first/floating-controls";
import { OverlayHeader } from "./map-first/overlay-header";
import { RegionTimelinePanel } from "./map-first/region-timeline-panel";

export function MapFirstPage() {
  const { t } = useI18n();
  const [dataset, setDataset] = useState<MapDataset | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showWater, setShowWater] = useState(false);
  const [showSettlements, setShowSettlements] = useState(false);
  const [showRoads, setShowRoads] = useState(true);
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
    loadCombinedDataset()
      .then((next) => {
        if (!mounted) return;
        setDataset(next);
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
    if (!dataset) return;
    const requestedLayers = [
      showRoads && !dataset.layers.osm_roads ? "osm_roads" : null,
      showWater && !dataset.layers.osm_water ? "osm_water" : null,
      showSettlements && !dataset.layers.osm_settlements ? "osm_settlements" : null,
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
  }, [dataset, showRoads, showWater, showSettlements]);

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
    return (
      <main className="h-screen w-screen bg-[#061019]" />
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#061019] text-[#e8eef5]">
      <div className="absolute inset-0">
        <MapView
          dataset={displayDataset}
          showRoads={showRoads}
          showWater={showWater}
          showSettlements={showSettlements}
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
        />
      </div>

      <OverlayHeader dataset={dataset} />

      <FloatingControlButtons
        activePanel={activePanel}
        setActivePanel={setActivePanel}
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
        timelineYears={timelineYears}
        activeYear={activeYear}
        setActiveYear={setActiveYear}
        timelineFallbacks={timelineFallbacks}
        ipcSummary={ipcSummary}
      />

      <RegionTimelinePanel
        region={getRegionDetail(dataset, selectedRegionId)}
        onClose={() => setSelectedRegionId(null)}
      />

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

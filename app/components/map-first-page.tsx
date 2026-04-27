import { useI18n } from "~/i18n/use-i18n";
import { useEffect, useMemo, useState } from "react";

import type { MapDataset } from "~/data/datasets";
import {
  getRegionDetail,
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

  useEffect(() => {
    let mounted = true;
    loadCombinedDataset()
      .then((next) => {
        if (!mounted) return;
        setDataset(next);
        setShowRoads(next.layerDefaults.osm_roads);
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
      />

      <RegionTimelinePanel
        region={getRegionDetail(dataset, selectedRegionId)}
        onClose={() => setSelectedRegionId(null)}
      />
    </main>
  );
}

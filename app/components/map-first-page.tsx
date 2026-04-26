import { useI18n } from "~/i18n/use-i18n";
import { useState } from "react";

import { combinedDataset } from "~/data/datasets";
import { BASEMAPS, MapView, type BasemapId, type ViewMode } from "./map-view";
import { FloatingControlButtons, FloatingSidePanel, type FloatingPanelId } from "./map-first/floating-controls";
import { OverlayHeader } from "./map-first/overlay-header";

export function MapFirstPage() {
  const { t } = useI18n();
  const dataset = combinedDataset;
  const [showWater, setShowWater] = useState(false);
  const [showSettlements, setShowSettlements] = useState(false);
  const [showRoads, setShowRoads] = useState(dataset.layerDefaults.osm_roads);
  const [basemapId, setBasemapId] = useState<BasemapId>("voyager");
  const [viewMode, setViewMode] = useState<ViewMode>("flat");
  const [droneMode, setDroneMode] = useState(false);
  const [activePanel, setActivePanel] = useState<FloatingPanelId>(null);

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

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#061019] text-[#e8eef5]">
      <div className="absolute inset-0">
        <MapView
          dataset={dataset}
          showRoads={showRoads}
          showWater={showWater}
          showSettlements={showSettlements}
          basemapId={basemapId}
          viewMode={viewMode}
          droneMode={droneMode}
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
        legend={dataset.legend}
      />
    </main>
  );
}

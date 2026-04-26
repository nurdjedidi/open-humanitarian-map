import { BookOpen, Layers3, Map, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import type { ResolvedLegendItem } from "~/data/datasets";
import { useI18n } from "~/i18n/use-i18n";
import type { BasemapId } from "../map-view";
import { LegendItem } from "./legend";
import { PanelSection, ToggleRow, cx } from "./ui";

export type FloatingPanelId = "layers" | "basemap" | "legend" | null;

export function FloatingControlButtons({
  activePanel,
  setActivePanel,
}: {
  activePanel: FloatingPanelId;
  setActivePanel: (value: FloatingPanelId) => void;
}) {
  const { t } = useI18n();
  const items = [
    { id: "layers" as const, label: t("demo.layers"), icon: PanelLeftOpen },
    { id: "basemap" as const, label: t("demo.basemap"), icon: Map },
    { id: "legend" as const, label: t("demo.legend"), icon: BookOpen },
  ];

  return (
    <div className="absolute left-3 top-[86px] z-30 flex flex-col gap-2 md:left-4 md:top-[96px]">
      {items.map((item) => {
        const Icon = item.icon;
        const active = activePanel === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActivePanel(active ? null : item.id)}
            className={cx(
              "flex h-12 w-12 items-center justify-center rounded-2xl border shadow-[0_12px_34px_rgba(2,6,12,0.3)] backdrop-blur-xl transition",
              active
                ? "border-[#d98a35] bg-[#172636]/95 text-white"
                : "border-white/10 bg-[#08131e]/88 text-[#d7e4ee] hover:bg-[#0f1b28]/92",
            )}
            aria-label={item.label}
            title={item.label}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );
}

export function FloatingSidePanel({
  activePanel,
  setActivePanel,
  showRoads,
  showWater,
  showSettlements,
  setShowRoads,
  setShowWater,
  setShowSettlements,
  basemapId,
  setBasemapId,
  basemaps,
  basemapLabel,
  legend,
}: {
  activePanel: FloatingPanelId;
  setActivePanel: (value: FloatingPanelId) => void;
  showRoads: boolean;
  showWater: boolean;
  showSettlements: boolean;
  setShowRoads: (value: boolean) => void;
  setShowWater: (value: boolean) => void;
  setShowSettlements: (value: boolean) => void;
  basemapId: BasemapId;
  setBasemapId: (value: BasemapId) => void;
  basemaps: Array<{ id: BasemapId; label: string; description: string }>;
  basemapLabel: (id: BasemapId) => { label: string; description: string };
  legend: ResolvedLegendItem[];
}) {
  const { t } = useI18n();

  if (!activePanel) return null;

  return (
    <aside className="panel-scroll absolute left-[68px] top-[86px] z-30 w-[290px] max-w-[calc(100vw-92px)] overflow-y-auto md:left-[76px] md:top-[96px]">
      <div className="rounded-[24px] border border-white/10 bg-[#0a1420]/94 p-3 shadow-[0_18px_60px_rgba(2,6,12,0.34)] backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#85b8e5]">
            {activePanel === "layers"
              ? t("demo.layers")
              : activePanel === "basemap"
                ? t("demo.basemap")
                : t("demo.legend")}
          </div>
          <button
            type="button"
            onClick={() => setActivePanel(null)}
            className="rounded-full border border-white/8 bg-white/[0.04] p-2 text-[#dfe8ef] transition hover:bg-white/[0.08]"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {activePanel === "layers" ? (
          <PanelSection title={t("demo.layers")}>
            <div className="space-y-3">
              <ToggleRow
                label={t("demo.roads")}
                checked={showRoads}
                onChange={setShowRoads}
              />
              <ToggleRow
                label={t("demo.water")}
                checked={showWater}
                onChange={setShowWater}
              />
              <ToggleRow
                label={t("demo.settlements")}
                checked={showSettlements}
                onChange={setShowSettlements}
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-[#96abbb]">
              {t("demo.layersHint")}
            </p>
          </PanelSection>
        ) : null}

        {activePanel === "basemap" ? (
          <PanelSection title={t("demo.basemap")}>
            <div className="grid gap-2">
              {basemaps.map((option) => {
                const active = option.id === basemapId;
                const localized = basemapLabel(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBasemapId(option.id)}
                    className={cx(
                      "rounded-2xl border px-3 py-3 text-left transition",
                      active
                        ? "border-[#d98a35] bg-[#172636] text-white"
                        : "border-white/8 bg-white/[0.03] text-[#d6e5f3] hover:bg-white/[0.08]",
                    )}
                  >
                    <div className="font-semibold">{localized.label}</div>
                    <div className="text-xs text-[#8ea7bb]">
                      {localized.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </PanelSection>
        ) : null}

        {activePanel === "legend" ? (
          <PanelSection title={t("demo.legend")}>
            <div className="space-y-3">
              {legend.map((item) => (
                <LegendItem item={item} key={item.id} />
              ))}
            </div>
          </PanelSection>
        ) : null}
      </div>
    </aside>
  );
}

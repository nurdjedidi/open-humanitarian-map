import {
  BookOpen,
  Building2,
  Layers3,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  Plane,
} from "lucide-react";

import type { ResolvedLegendItem } from "~/data/datasets";
import { useI18n } from "~/i18n/use-i18n";
import type { BasemapId, ViewMode } from "../map-view";
import { LegendItem } from "./legend";
import { MobileSheet, PanelSection, ToggleRow, cx } from "./ui";

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

function TimelineBlock({
  t,
  timelineYears,
  activeYear,
  setActiveYear,
  timelineFallbacks,
}: {
  t: (key: string, vars?: Record<string, string | number | null | undefined>) => string;
  timelineYears: number[];
  activeYear: number | null;
  setActiveYear: (value: number | null) => void;
  timelineFallbacks: Array<{ countryName: string; latestYear: number }>;
}) {
  const activeYearIndex =
    activeYear === null
      ? Math.max(0, timelineYears.length - 1)
      : Math.max(0, timelineYears.indexOf(activeYear));
  const canStepBackward = activeYearIndex > 0;
  const canStepForward = activeYearIndex < timelineYears.length - 1;

  if (timelineYears.length <= 1) return null;

  return (
    <div className="mb-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 md:mb-4 md:py-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#85b8e5]">
          {t("demo.timelineLabel")}
        </div>
        <div className="rounded-full border border-[#d98a35]/35 bg-[#d98a35]/12 px-2.5 py-1 text-xs font-semibold text-[#ffd38b]">
          {activeYear ?? timelineYears[timelineYears.length - 1]}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(0, timelineYears.length - 1)}
        step={1}
        value={activeYearIndex}
        onChange={(event) => {
          const nextIndex = Number(event.target.value);
          setActiveYear(timelineYears[nextIndex] ?? null);
        }}
        className="ohm-range mt-2 w-full"
      />

      <div className="mt-2 flex items-center justify-between text-[11px] text-[#8fa8bb]">
        <span>{timelineYears[0]}</span>
        <span>{timelineYears[timelineYears.length - 1]}</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 md:hidden">
        <button
          type="button"
          disabled={!canStepBackward}
          onClick={() => {
            const nextIndex = Math.max(0, activeYearIndex - 1);
            setActiveYear(timelineYears[nextIndex] ?? null);
          }}
          className={cx(
            "rounded-xl border px-3 py-2 text-sm font-semibold transition",
            canStepBackward
              ? "border-white/10 bg-white/[0.05] text-[#e7eef5] hover:bg-white/[0.08]"
              : "cursor-not-allowed border-white/6 bg-white/[0.03] text-[#6f8496]",
          )}
        >
          ← {timelineYears[Math.max(0, activeYearIndex - 1)] ?? timelineYears[0]}
        </button>
        <button
          type="button"
          disabled={!canStepForward}
          onClick={() => {
            const nextIndex = Math.min(timelineYears.length - 1, activeYearIndex + 1);
            setActiveYear(timelineYears[nextIndex] ?? null);
          }}
          className={cx(
            "rounded-xl border px-3 py-2 text-sm font-semibold transition",
            canStepForward
              ? "border-white/10 bg-white/[0.05] text-[#e7eef5] hover:bg-white/[0.08]"
              : "cursor-not-allowed border-white/6 bg-white/[0.03] text-[#6f8496]",
          )}
        >
          {timelineYears[Math.min(timelineYears.length - 1, activeYearIndex + 1)] ??
            timelineYears[timelineYears.length - 1]}{" "}
          →
        </button>
      </div>

      <p className="mt-3 hidden text-xs leading-5 text-[#96abbb] md:block">
        {t("demo.timelineHint")}
      </p>

      {timelineFallbacks.length ? (
        <p className="mt-2 rounded-xl border border-[#d98a35]/20 bg-[#d98a35]/8 px-2.5 py-1.5 text-[11px] leading-4 text-[#f2d4a0] md:py-2 md:text-xs md:leading-5">
          {t("demo.timelineFallbackNote", {
            details: timelineFallbacks
              .map((item) => `${item.countryName}: ${item.latestYear}`)
              .join(" · "),
          })}
        </p>
      ) : null}
    </div>
  );
}

function PanelContent({
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
  viewMode,
  setViewMode,
  droneMode,
  setDroneMode,
  basemaps,
  basemapLabel,
  legend,
  timelineYears,
  activeYear,
  setActiveYear,
  timelineFallbacks,
}: {
  activePanel: Exclude<FloatingPanelId, null>;
  setActivePanel: (value: FloatingPanelId) => void;
  showRoads: boolean;
  showWater: boolean;
  showSettlements: boolean;
  setShowRoads: (value: boolean) => void;
  setShowWater: (value: boolean) => void;
  setShowSettlements: (value: boolean) => void;
  basemapId: BasemapId;
  setBasemapId: (value: BasemapId) => void;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  droneMode: boolean;
  setDroneMode: (value: boolean) => void;
  basemaps: Array<{ id: BasemapId; label: string; description: string }>;
  basemapLabel: (id: BasemapId) => { label: string; description: string };
  legend: ResolvedLegendItem[];
  timelineYears: number[];
  activeYear: number | null;
  setActiveYear: (value: number | null) => void;
  timelineFallbacks: Array<{ countryName: string; latestYear: number }>;
}) {
  const { t } = useI18n();

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3 px-1 md:mb-3">
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
          <TimelineBlock
            t={t}
            timelineYears={timelineYears}
            activeYear={activeYear}
            setActiveYear={setActiveYear}
            timelineFallbacks={timelineFallbacks}
          />

          <div className="space-y-2 md:space-y-3">
            <ToggleRow label={t("demo.roads")} checked={showRoads} onChange={setShowRoads} />
            <ToggleRow label={t("demo.water")} checked={showWater} onChange={setShowWater} />
            <ToggleRow
              label={t("demo.settlements")}
              checked={showSettlements}
              onChange={setShowSettlements}
            />
          </div>

          <p className="mt-3 hidden text-sm leading-6 text-[#96abbb] md:block">
            {t("demo.layersHint")}
          </p>
          <p className="mt-2 text-[11px] leading-4 text-[#7f98ab] md:text-xs md:leading-5">
            {t("demo.population2020Note")}
          </p>
        </PanelSection>
      ) : null}

      {activePanel === "basemap" ? (
        <PanelSection title={t("demo.basemap")}>
          <div className="mb-4 grid gap-2">
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
                  <div className="text-xs text-[#8ea7bb]">{localized.description}</div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-white/8 pt-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#85b8e5]">
              Mode de vue
            </div>
            <div className="grid gap-2">
              {[
                {
                  id: "flat" as const,
                  icon: Layers3,
                  label: "Vue d'ensemble",
                  description: "Lecture plane et stable à grande échelle",
                },
                {
                  id: "urban-3d" as const,
                  icon: Building2,
                  label: "3D",
                  description: "Zoom fort et bâtiments extrudés si disponibles",
                },
              ].map((mode) => {
                const Icon = mode.icon;
                const active = mode.id === viewMode;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setViewMode(mode.id)}
                    className={cx(
                      "flex items-start gap-3 rounded-2xl border px-3 py-3 text-left transition",
                      active
                        ? "border-[#d98a35] bg-[#172636] text-white"
                        : "border-white/8 bg-white/[0.03] text-[#d6e5f3] hover:bg-white/[0.08]",
                    )}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-semibold">{mode.label}</div>
                      <div className="text-xs text-[#8ea7bb]">{mode.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  const next = !droneMode;
                  setDroneMode(next);
                  if (next) {
                    setBasemapId("satellite");
                  }
                }}
                className={cx(
                  "flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition",
                  droneMode
                    ? "border-[#d98a35] bg-[#172636] text-white"
                    : "border-white/8 bg-white/[0.03] text-[#d6e5f3] hover:bg-white/[0.08]",
                )}
              >
                <Plane className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">Drone</div>
                  <div className="text-xs text-[#8ea7bb]">
                    Vue inclinée et zoom rapproché. Peut se combiner avec le mode 3D.
                  </div>
                </div>
              </button>
            </div>
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
    </>
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
  viewMode,
  setViewMode,
  droneMode,
  setDroneMode,
  basemaps,
  basemapLabel,
  legend,
  timelineYears,
  activeYear,
  setActiveYear,
  timelineFallbacks,
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
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  droneMode: boolean;
  setDroneMode: (value: boolean) => void;
  basemaps: Array<{ id: BasemapId; label: string; description: string }>;
  basemapLabel: (id: BasemapId) => { label: string; description: string };
  legend: ResolvedLegendItem[];
  timelineYears: number[];
  activeYear: number | null;
  setActiveYear: (value: number | null) => void;
  timelineFallbacks: Array<{ countryName: string; latestYear: number }>;
}) {
  if (!activePanel) return null;

  const contentProps = {
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
    viewMode,
    setViewMode,
    droneMode,
    setDroneMode,
    basemaps,
    basemapLabel,
    legend,
    timelineYears,
    activeYear,
    setActiveYear,
    timelineFallbacks,
  };

  return (
    <>
      <aside className="absolute bottom-4 left-[76px] top-[96px] z-30 hidden w-[290px] max-w-[calc(100vw-92px)] md:block">
        <div className="panel-scroll h-full overflow-y-auto rounded-[24px] border border-white/10 bg-[#0a1420]/94 p-3 shadow-[0_18px_60px_rgba(2,6,12,0.34)] backdrop-blur-xl">
          <PanelContent {...contentProps} />
        </div>
      </aside>

      <MobileSheet
        open={Boolean(activePanel)}
        title=""
        onClose={() => setActivePanel(null)}
        withBackdrop={false}
      >
        <PanelContent {...contentProps} />
      </MobileSheet>
    </>
  );
}

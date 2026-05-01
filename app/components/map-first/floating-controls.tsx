import {
  BarChart3,
  BookOpen,
  Building2,
  Layers3,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  Plane,
} from "lucide-react";

import type {
  AnalysisMode,
  IpcCountrySummary,
  PopulationCountrySummary,
  ResolvedLegendItem,
} from "~/data/dataset-types";
import { useI18n } from "~/i18n/use-i18n";
import { formatCompactNumber, formatPercent } from "~/utils";
import type { BasemapId, ViewMode } from "../map-view";
import { LegendItem } from "./legend";
import { MobileSheet, PanelSection, ToggleRow, cx } from "./ui";

export type FloatingPanelId = "layers" | "basemap" | "legend" | "ipc" | null;

export function FloatingControlButtons({
  activePanel,
  setActivePanel,
  analysisMode,
  setAnalysisMode,
}: {
  activePanel: FloatingPanelId;
  setActivePanel: (value: FloatingPanelId) => void;
  analysisMode: AnalysisMode;
  setAnalysisMode: (value: AnalysisMode) => void;
}) {
  const { t } = useI18n();
  const items = [
    { id: "layers" as const, label: t("demo.layers"), icon: PanelLeftOpen },
    { id: "basemap" as const, label: t("demo.basemap"), icon: Map },
    { id: "legend" as const, label: t("demo.legend"), icon: BookOpen },
    { id: "ipc" as const, label: analysisMode === "population" ? "Population" : "IPC", icon: BarChart3 },
  ];

  return (
    <div className="absolute left-3 top-[86px] z-30 flex flex-col gap-2 md:left-4 md:top-[96px]">
      <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-[#08131e]/90 p-1 shadow-[0_12px_34px_rgba(2,6,12,0.3)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setAnalysisMode("ipc")}
          className={cx(
            "rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
            analysisMode === "ipc"
              ? "bg-[#d98a35] text-[#08131e]"
              : "text-[#d7e4ee] hover:bg-white/[0.06]",
          )}
        >
          IPC
        </button>
        <button
          type="button"
          onClick={() => setAnalysisMode("population")}
          className={cx(
            "rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
            analysisMode === "population"
              ? "bg-[#c084fc] text-[#08131e]"
              : "text-[#d7e4ee] hover:bg-white/[0.06]",
          )}
        >
          POP
        </button>
      </div>
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

      <p className="mt-3 hidden text-xs leading-5 text-[#96abbb] md:block">{t("demo.timelineHint")}</p>

      {timelineFallbacks.length ? (
        <p className="mt-2 rounded-xl border border-[#d98a35]/20 bg-[#d98a35]/8 px-2.5 py-1.5 text-[11px] leading-4 text-[#f2d4a0] md:py-2 md:text-xs md:leading-5">
          {t("demo.timelineFallbackNote", {
            details: timelineFallbacks.map((item) => `${item.countryName}: ${item.latestYear}`).join(" · "),
          })}
        </p>
      ) : null}
    </div>
  );
}

function PopulationSummaryPanel({ populationSummary }: { populationSummary: PopulationCountrySummary[] }) {
  if (!populationSummary.length) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-sm leading-6 text-[#9ab0c1]">
        Active un pays avec artefact population publie pour voir le resume. Le mode reste leger tant que la couche n'est
        pas demandee.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {populationSummary.map((country) => (
        <article
          key={country.countryKey}
          className="rounded-[22px] border border-white/8 bg-[#162231]/88 p-3 shadow-[0_14px_38px_rgba(0,0,0,0.18)]"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold text-[#f5f0e8]">{country.countryName}</h3>
              <p className="mt-0.5 text-xs text-[#91a8ba]">Annee source: {country.yearLabel}</p>
            </div>
            <div className="shrink-0 rounded-2xl border border-[#c084fc]/35 bg-[#c084fc]/14 px-3 py-2 text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#edd5ff]">Points</div>
              <div className="text-sm font-black text-[#f5e9ff]">{formatCompactNumber(country.points)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            <div className="min-w-0 rounded-2xl bg-white/[0.055] px-3 py-2">
              <div className="text-[#8fa8bb]">Poids total</div>
              <div className="truncate text-sm font-black text-[#edf5fb]">{formatCompactNumber(country.totalWeight)}</div>
            </div>
            <div className="min-w-0 rounded-2xl bg-white/[0.055] px-3 py-2">
              <div className="text-[#8fa8bb]">Pic local</div>
              <div className="truncate text-sm font-black text-[#edf5fb]">{formatCompactNumber(country.maxWeight)}</div>
            </div>
            <div className="min-w-0 rounded-2xl bg-white/[0.055] px-3 py-2">
              <div className="text-[#8fa8bb]">Densite moy.</div>
              <div className="truncate text-sm font-black text-[#edf5fb]">
                {country.avgDensity !== null ? formatCompactNumber(country.avgDensity) : "n/a"}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function IpcSummaryPanel({ ipcSummary }: { ipcSummary: IpcCountrySummary[] }) {
  return (
    <div className="space-y-3">
      {ipcSummary.map((country) => {
        const total = Math.max(country.population, 1);
        const phases = [
          { label: "1", value: country.phase1, color: "bg-[#dcefa1]", text: "text-[#dcefa1]" },
          { label: "2", value: country.phase2, color: "bg-[#ffd45d]", text: "text-[#ffd45d]" },
          { label: "3", value: country.phase3, color: "bg-[#f59a2f]", text: "text-[#f59a2f]" },
          { label: "4", value: country.phase4, color: "bg-[#dd4b2f]", text: "text-[#ff9c88]" },
          { label: "5", value: country.phase5, color: "bg-[#5d1115]", text: "text-[#ff7b8a]" },
        ];

        return (
          <article
            key={country.countryKey}
            className="rounded-[22px] border border-white/8 bg-[#162231]/88 p-3 shadow-[0_14px_38px_rgba(0,0,0,0.18)]"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-[#f5f0e8]">{country.countryName}</h3>
                <p className="mt-0.5 text-xs text-[#91a8ba]">Donnee utilisee: {country.latestYear ?? "n/a"}</p>
              </div>
              <div className="shrink-0 rounded-2xl border border-[#d98a35]/35 bg-[#d98a35]/14 px-3 py-2 text-right">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffd38b]">P3+</div>
                <div className="text-sm font-black text-[#ffe2aa]">{formatPercent(country.phase3plusShare)}</div>
              </div>
            </div>

            <div className="mb-3 flex h-4 overflow-hidden rounded-full bg-black/20 ring-1 ring-white/8">
              {phases.map((phase) => (
                <div
                  key={phase.label}
                  className={phase.color}
                  style={{ width: `${Math.max(0, (phase.value / total) * 100)}%` }}
                  title={`IPC ${phase.label}: ${formatCompactNumber(phase.value)}`}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <div className="min-w-0 rounded-2xl bg-white/[0.055] px-3 py-2">
                <div className="text-[#8fa8bb]">Population</div>
                <div className="truncate text-sm font-black text-[#edf5fb]">{formatCompactNumber(country.population)}</div>
              </div>
              <div className="min-w-0 rounded-2xl bg-white/[0.055] px-3 py-2">
                <div className="text-[#8fa8bb]">P3+</div>
                <div className="truncate text-sm font-black text-[#edf5fb]">{formatCompactNumber(country.phase3plus)}</div>
              </div>
              <div className="min-w-0 rounded-2xl bg-white/[0.055] px-3 py-2">
                <div className="text-[#8fa8bb]">P4+</div>
                <div className="truncate text-sm font-black text-[#edf5fb]">{formatCompactNumber(country.phase4plus)}</div>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-white/8">
              {phases.map((phase) => (
                <div
                  key={phase.label}
                  className="grid grid-cols-[62px_1fr] items-center border-b border-white/6 bg-white/[0.025] px-3 py-2 text-xs last:border-b-0"
                >
                  <div className={`font-bold ${phase.text}`}>IPC {phase.label}</div>
                  <div className="text-right font-semibold text-[#edf5fb]">{formatCompactNumber(phase.value)}</div>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function PanelContent({
  activePanel,
  setActivePanel,
  analysisMode,
  setAnalysisMode,
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
  ipcSummary,
  populationSummary,
}: {
  activePanel: Exclude<FloatingPanelId, null>;
  setActivePanel: (value: FloatingPanelId) => void;
  analysisMode: AnalysisMode;
  setAnalysisMode: (value: AnalysisMode) => void;
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
  ipcSummary: IpcCountrySummary[];
  populationSummary: PopulationCountrySummary[];
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
              : activePanel === "legend"
                ? t("demo.legend")
                : analysisMode === "population"
                  ? "Population"
                  : "IPC"}
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
          <div className="mb-3 flex overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => setAnalysisMode("ipc")}
              className={cx(
                "flex-1 rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
                analysisMode === "ipc"
                  ? "bg-[#d98a35] text-[#08131e]"
                  : "text-[#d7e4ee] hover:bg-white/[0.06]",
              )}
            >
              IPC
            </button>
            <button
              type="button"
              onClick={() => setAnalysisMode("population")}
              className={cx(
                "flex-1 rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
                analysisMode === "population"
                  ? "bg-[#c084fc] text-[#08131e]"
                  : "text-[#d7e4ee] hover:bg-white/[0.06]",
              )}
            >
              Population
            </button>
          </div>

          {analysisMode === "ipc" ? (
            <TimelineBlock
              t={t}
              timelineYears={timelineYears}
              activeYear={activeYear}
              setActiveYear={setActiveYear}
              timelineFallbacks={timelineFallbacks}
            />
          ) : (
            <div className="mb-3 rounded-2xl border border-[#c084fc]/20 bg-[#c084fc]/10 px-3 py-2.5 text-xs leading-5 text-[#ead6ff] md:mb-4">
              Mode population rasterise. Les couches OSM sont coupees par defaut pour laisser le glow et les points lire
              les densites plus clairement.
            </div>
          )}

          <div className="space-y-2 md:space-y-3">
            <ToggleRow label={t("demo.roads")} checked={showRoads} onChange={setShowRoads} />
            <ToggleRow label={t("demo.water")} checked={showWater} onChange={setShowWater} />
            <ToggleRow label={t("demo.settlements")} checked={showSettlements} onChange={setShowSettlements} />
          </div>

          <p className="mt-3 hidden text-sm leading-6 text-[#96abbb] md:block">
            {analysisMode === "population"
              ? "Active les reperes terrain si tu veux recroiser la densite avec les routes, l'eau ou les villages."
              : t("demo.layersHint")}
          </p>
          <p className="mt-2 text-[11px] leading-4 text-[#7f98ab] md:text-xs md:leading-5">
            {analysisMode === "population"
              ? "La couche population vient des TIFF publies pour le web sous forme de points ponderes et d'un glow macro."
              : t("demo.population2020Note")}
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
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#85b8e5]">Mode de vue</div>
            <div className="grid gap-2">
              {[
                {
                  id: "flat" as const,
                  icon: Layers3,
                  label: "Vue d'ensemble",
                  description: "Lecture plane et stable a grande echelle",
                },
                {
                  id: "urban-3d" as const,
                  icon: Building2,
                  label: "3D",
                  description: "Zoom fort et batiments extrudes si disponibles",
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
                  <div className="text-xs text-[#8ea7bb]">Vue inclinee et zoom rapproche. Peut se combiner avec le mode 3D.</div>
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

      {activePanel === "ipc" ? (
        analysisMode === "population" ? (
          <PanelSection title="Mode population">
            <div className="mb-3 rounded-2xl border border-[#c084fc]/20 bg-[#c084fc]/10 px-3 py-2.5 text-xs leading-5 text-[#ead6ff]">
              Lecture derivee du raster population. Le glow montre les concentrations larges, puis les points prennent le
              relai au zoom.
            </div>
            <PopulationSummaryPanel populationSummary={populationSummary} />
          </PanelSection>
        ) : (
          <PanelSection title="Population par phase IPC">
            <div className="mb-3 rounded-2xl border border-[#d98a35]/20 bg-[#d98a35]/10 px-3 py-2.5 text-xs leading-5 text-[#f0d6a5]">
              Aggregation par pays sur l'annee active. P3+ = IPC 3 + IPC 4 + IPC 5.
            </div>
            <IpcSummaryPanel ipcSummary={ipcSummary} />
          </PanelSection>
        )
      ) : null}
    </>
  );
}

export function FloatingSidePanel({
  activePanel,
  setActivePanel,
  analysisMode,
  setAnalysisMode,
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
  ipcSummary,
  populationSummary,
}: {
  activePanel: FloatingPanelId;
  setActivePanel: (value: FloatingPanelId) => void;
  analysisMode: AnalysisMode;
  setAnalysisMode: (value: AnalysisMode) => void;
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
  ipcSummary: IpcCountrySummary[];
  populationSummary: PopulationCountrySummary[];
}) {
  if (!activePanel) return null;

  const contentProps = {
    activePanel,
    setActivePanel,
    analysisMode,
    setAnalysisMode,
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
    ipcSummary,
    populationSummary,
  };

  return (
    <>
      <aside
        className={cx(
          "absolute bottom-4 left-[76px] top-[96px] z-30 hidden max-w-[calc(100vw-92px)] md:block",
          activePanel === "ipc" ? "w-[390px]" : "w-[290px]",
        )}
      >
        <div className="panel-scroll h-full overflow-y-auto rounded-[24px] border border-white/10 bg-[#0a1420]/94 p-3 shadow-[0_18px_60px_rgba(2,6,12,0.34)] backdrop-blur-xl">
          <PanelContent {...contentProps} />
        </div>
      </aside>

      <MobileSheet open={Boolean(activePanel)} title="" onClose={() => setActivePanel(null)} withBackdrop={false}>
        <PanelContent {...contentProps} />
      </MobileSheet>
    </>
  );
}

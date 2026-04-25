import type { Route } from "./+types/demo";
import { Link } from "react-router";
import { useMemo, useState } from "react";

import { BASEMAPS, MapView, type BasemapId } from "~/components/map-view";
import {
  senegalDataset,
  type RegionRecord,
  type ResolvedLegendItem,
} from "~/data/senegal";
import {
  formatCompactNumber,
  formatPercent,
  formatScore100,
} from "~/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "OHM | Démo Sénégal" },
    {
      name: "description",
      content:
        "Démo OHM : carte humanitaire du Sénégal avec priorisation régionale et contexte OSM.",
    },
  ];
}

function LegendItem({ item }: { item: ResolvedLegendItem }) {
  if (item.id === "admin_priority") {
    const colors = item.colorScale ?? [
      "#c6c6c6",
      "#fff1aa",
      "#f5b437",
      "#dc4b23",
      "#23080c",
    ];
    return (
      <div className="rounded-2xl border border-[#223447] bg-[#111c28] p-3">
        <div className="text-sm font-semibold text-[#eff5fa]">{item.label}</div>
        <div
          className="mt-3 h-2.5 rounded-full"
          style={{ background: `linear-gradient(90deg, ${colors.join(", ")})` }}
        />
        <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#8ba4b8]">
          <span>No data</span>
          <span>Urgence forte</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#223447] bg-[#111c28] px-3 py-2.5">
      <span
        className={[
          "inline-flex shrink-0 items-center justify-center rounded-full",
          item.symbol === "road" ? "h-[3px] w-7 rounded-full" : "h-3.5 w-3.5",
        ].join(" ")}
        style={{ backgroundColor: item.color ?? "#6b7280" }}
      />
      <div>
        <div className="text-sm font-semibold text-[#eff5fa]">{item.label}</div>
        <div className="text-xs leading-5 text-[#8ea7bb]">{item.meaning}</div>
      </div>
    </div>
  );
}

function RegionCard({
  region,
  active,
  onClick,
}: {
  region: RegionRecord;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-2xl border px-4 py-3 text-left transition",
        active
          ? "border-[#d98a35] bg-[#172636]"
          : "border-[#223447] bg-[#101922] hover:bg-[#14202c]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-bold text-[#eff5fa]">{region.name}</div>
          <div className="mt-1 text-sm text-[#8ea7bb]">{region.priorityLabel}</div>
        </div>
        <div className="rounded-full bg-[#f0c170] px-3 py-1 text-sm font-bold text-[#13202b]">
          {formatScore100(region.score100)}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#d3dee8]">
        <span className="rounded-full bg-[#192735] px-2 py-1">
          P3+: {formatCompactNumber(region.ipcPeopleP3Plus)}
        </span>
        <span className="rounded-full bg-[#192735] px-2 py-1">
          Pop: {formatCompactNumber(region.ipcPopulationTotal)}
        </span>
      </div>
    </button>
  );
}

function RegionDetail({ region }: { region: RegionRecord | null }) {
  if (!region) {
    return (
      <section className="rounded-3xl border border-[#223447] bg-[#0f1822] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7db4e8]">
          Région active
        </div>
        <p className="mt-3 text-sm leading-6 text-[#9db4c6]">
          Clique une région sur la carte pour afficher le détail.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-[#223447] bg-[#0f1822] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7db4e8]">
        Région active
      </div>
      <h2 className="mt-3 text-2xl font-black text-[#f4f8fc]">{region.name}</h2>
      <p className="mt-1 text-sm text-[#9db4c6]">{region.adm1Name}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#203243] bg-[#13202c] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[#7db4e8]">
            Score
          </div>
          <div className="mt-1 text-2xl font-black text-[#f4f8fc]">
            {formatScore100(region.score100)}
          </div>
        </div>
        <div className="rounded-2xl border border-[#203243] bg-[#13202c] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[#7db4e8]">
            Phase IPC
          </div>
          <div className="mt-1 text-2xl font-black text-[#f4f8fc]">
            {region.ipcPhase ?? "n/a"}
          </div>
        </div>
        <div className="rounded-2xl border border-[#203243] bg-[#13202c] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[#7db4e8]">
            P3+
          </div>
          <div className="mt-1 text-2xl font-black text-[#f4f8fc]">
            {formatCompactNumber(region.ipcPeopleP3Plus)}
          </div>
        </div>
        <div className="rounded-2xl border border-[#203243] bg-[#13202c] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[#7db4e8]">
            Part P3+
          </div>
          <div className="mt-1 text-2xl font-black text-[#f4f8fc]">
            {formatPercent(region.ipcShareP3Plus)}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-[#d8e6f1]">{region.decisionReason}</p>
    </section>
  );
}

export default function Demo() {
  const dataset = senegalDataset;
  const [showWater, setShowWater] = useState(dataset.layerDefaults.osm_water);
  const [showSettlements, setShowSettlements] = useState(
    dataset.layerDefaults.osm_settlements,
  );
  const [showRoads, setShowRoads] = useState(dataset.layerDefaults.osm_roads);
  const [basemapId, setBasemapId] = useState<BasemapId>("voyager");
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    dataset.topRegions[0]?.id ?? null,
  );
  const [hoverRegion, setHoverRegion] = useState<RegionRecord | null>(null);

  const selectedRegion = useMemo(
    () =>
      hoverRegion ??
      dataset.topRegions.find((region) => region.id === selectedRegionId) ??
      null,
    [dataset.topRegions, hoverRegion, selectedRegionId],
  );

  return (
    <main className="min-h-screen bg-[#061019] p-3 text-[#e8eef5] md:p-5 xl:h-screen xl:min-h-0 xl:overflow-hidden">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1600px] flex-col overflow-hidden rounded-[30px] border border-[#223447] bg-[#08131e] shadow-[0_24px_120px_rgba(5,10,16,0.45)] md:min-h-[calc(100vh-2.5rem)] xl:h-[calc(100vh-2.5rem)] xl:min-h-0">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#223447] bg-[#0c1724] px-5 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1b3955] text-sm font-black text-[#91c7ff]">
              OHM
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7db4e8]">
                Open Humanitarian Map
              </p>
              <h1 className="text-lg font-extrabold tracking-wide text-[#f1f6fb] md:text-xl">
                Démo Sénégal
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-full border border-[#294157] px-4 py-2 text-sm font-semibold text-[#d4e2ee] transition hover:bg-[#142231]"
            >
              Retour à la landing
            </Link>

            <div className="grid w-full grid-cols-1 gap-2 text-xs font-semibold text-[#d6e5f3] sm:w-auto sm:grid-cols-3">
              <div className="rounded-2xl border border-[#223447] bg-[#122232] px-4 py-2">
                <div className="text-[#8ea7bb]">Régions</div>
                <div className="mt-1 text-lg font-black text-white">
                  {dataset.summary.feature_count ?? dataset.admin.features.length}
                </div>
              </div>
              <div className="rounded-2xl border border-[#223447] bg-[#122232] px-4 py-2">
                <div className="text-[#8ea7bb]">Score moyen</div>
                <div className="mt-1 text-lg font-black text-white">
                  {formatScore100(dataset.summary.score_100_mean)}
                </div>
              </div>
              <div className="rounded-2xl border border-[#223447] bg-[#122232] px-4 py-2">
                <div className="text-[#8ea7bb]">P3+</div>
                <div className="mt-1 text-lg font-black text-white">
                  {formatCompactNumber(dataset.summary.people_p3plus_total)}
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid flex-1 gap-4 p-4 xl:min-h-0 xl:grid-cols-[300px_minmax(0,1fr)_340px] xl:overflow-hidden xl:p-5">
          <aside className="panel-scroll order-2 flex flex-col gap-4 xl:order-1 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
            <section className="rounded-3xl border border-[#24384b] bg-[#0f1c2a] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7db4e8]">
                Carte
              </div>
              <div className="mt-3 text-2xl font-black text-[#f4f8fc]">
                {dataset.title}
              </div>
              <p className="mt-2 text-sm leading-6 text-[#9db4c6]">
                Manifest actif : {dataset.manifestName}
              </p>
            </section>

            <section className="rounded-3xl border border-[#24384b] bg-[#0f1c2a] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7db4e8]">
                Couches
              </div>
              <div className="mt-4 space-y-3 text-sm text-[#d6e5f3]">
                <label className="flex items-center justify-between rounded-xl border border-white/8 bg-white/3 px-3 py-2">
                  <span>Routes principales</span>
                  <input
                    type="checkbox"
                    checked={showRoads}
                    onChange={(event) => setShowRoads(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-white/8 bg-white/3 px-3 py-2">
                  <span>Points d'eau</span>
                  <input
                    type="checkbox"
                    checked={showWater}
                    onChange={(event) => setShowWater(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-white/8 bg-white/3 px-3 py-2">
                  <span>Lieux habités</span>
                  <input
                    type="checkbox"
                    checked={showSettlements}
                    onChange={(event) => setShowSettlements(event.target.checked)}
                  />
                </label>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#8ea7bb]">
                Les routes restent visibles par défaut. L'eau et les lieux
                habités se lisent surtout en zoomant.
              </p>
            </section>

            <section className="rounded-3xl border border-[#24384b] bg-[#0f1c2a] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7db4e8]">
                Fond de carte
              </div>
              <div className="mt-4 grid gap-2">
                {BASEMAPS.map((option) => {
                  const active = option.id === basemapId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setBasemapId(option.id)}
                      className={[
                        "rounded-2xl border px-3 py-3 text-left transition",
                        active
                          ? "border-[#d98a35] bg-[#172636] text-white"
                          : "border-[#223447] bg-[#101922] text-[#d6e5f3] hover:bg-[#14202c]",
                      ].join(" ")}
                    >
                      <div className="font-semibold">{option.label}</div>
                      <div className="text-xs text-[#8ea7bb]">
                        {option.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-[#24384b] bg-[#0f1c2a] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7db4e8]">
                Légende
              </div>
              <div className="mt-4 space-y-3">
                {dataset.legend.map((item) => (
                  <LegendItem item={item} key={item.id} />
                ))}
              </div>
            </section>
          </aside>

          <section className="order-1 min-h-0 xl:order-2 xl:h-full xl:min-h-0 xl:overflow-hidden">
            <MapView
              dataset={dataset}
              showRoads={showRoads}
              showWater={showWater}
              showSettlements={showSettlements}
              basemapId={basemapId}
              selectedRegionId={selectedRegionId}
              onRegionHover={setHoverRegion}
              onRegionSelect={(region) => setSelectedRegionId(region?.id ?? null)}
            />
          </section>

          <aside className="panel-scroll order-3 flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:pl-1">
            <RegionDetail region={selectedRegion} />

            <section className="rounded-3xl border border-[#24384b] bg-[#0f1c2a] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7db4e8]">
                Top régions prioritaires
              </div>
              <p className="mt-2 text-sm text-[#9db4c6]">
                Lecture rapide pour savoir où agir d'abord.
              </p>
              <div className="mt-4 space-y-3">
                {dataset.topRegions.map((region) => (
                  <RegionCard
                    key={region.id}
                    region={region}
                    active={region.id === selectedRegionId}
                    onClick={() => setSelectedRegionId(region.id)}
                  />
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

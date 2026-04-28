import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";

import type {
  MapDataset,
  RegionDetail,
  RegionRecord,
  RegionTimelineEntry,
  ResolvedLegendItem,
  SupportedLayerId,
} from "./datasets";

type JsonModule = Record<string, unknown>;

type ManifestLayer = {
  id?: string;
  type?: string;
  path?: string;
  label?: string;
  visible_by_default?: boolean;
  zoom?: { min?: number | null; max?: number | null } | null;
};

type ManifestLegendItem = {
  id?: string;
  label?: string;
  type?: string;
  symbol?: string;
  color?: string;
  color_scale?: string[];
  meaning?: string;
  visible_by_default?: boolean;
  zoom?: { min?: number | null; max?: number | null } | null;
  artifact?: string;
  source?: string;
};

type ManifestSummary = {
  feature_count?: number;
  score_100_mean?: number;
  people_p3plus_total?: number;
  osm_counts?: Record<string, number>;
  pipeline_log?: string[];
  top_regions?: Array<Record<string, unknown>>;
  data_quality?: Record<string, unknown>;
  [key: string]: unknown;
};

type ManifestLike = {
  geojson?: string;
  artifacts?: Record<string, { geojson?: string; label?: string; kind?: string }>;
  legend?: ManifestLegendItem[];
  layers?: ManifestLayer[];
  summary?: ManifestSummary;
  maplibre?: {
    default_view?: string;
    default_layers?: string[];
  };
  run?: {
    zone?: string;
    output_name?: string;
    created_at?: string;
  };
};

type DatasetIndexEntry = {
  slug: string;
  title?: string;
  manifest: string;
};

type RuntimeCountryCatalog = {
  slug: string;
  title?: string;
  manifestName: string;
  manifest: ManifestLike;
  files: Map<string, JsonModule>;
};

type FileRequest = {
  aliases: string[];
  candidates: string[];
};

const DATA_BASE_URL = (import.meta.env.VITE_OHM_DATA_BASE_URL ?? "/data").replace(/\/$/, "");
const DATA_INDEX_URL = `${DATA_BASE_URL}/index.json`;

function basename(input: string): string {
  return input.replace(/\\/g, "/").split("/").pop() ?? input;
}

function normalizeText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function featureDisplayArea(feature: Feature<Geometry, GeoJsonProperties>): number {
  const props = feature.properties ?? {};
  const direct = asNumber(props.area_sqkm);
  if (direct !== null && direct > 0) return direct;

  const bbox = (feature as Feature<Geometry, GeoJsonProperties> & { bbox?: number[] }).bbox;
  if (Array.isArray(bbox) && bbox.length === 4) {
    const width = Math.abs((bbox[2] ?? 0) - (bbox[0] ?? 0));
    const height = Math.abs((bbox[3] ?? 0) - (bbox[1] ?? 0));
    return width * height;
  }
  return 0;
}

function isFeatureCollection(value: unknown): value is FeatureCollection {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as { type?: string }).type === "FeatureCollection"
  );
}

function canonicalLayerId(layerId: string | undefined): SupportedLayerId | null {
  if (!layerId) return null;
  if (layerId === "admin_priority") return "admin_priority";
  if (layerId === "osm_water" || layerId === "osm_context_water") return "osm_water";
  if (layerId === "osm_settlements" || layerId === "osm_context_settlements") return "osm_settlements";
  if (layerId === "osm_roads" || layerId === "osm_context_roads") return "osm_roads";
  return null;
}

function currentFileName(layerId: SupportedLayerId): string {
  if (layerId === "admin_priority") return "current.admin_priority.geojson";
  if (layerId === "osm_water") return "current.osm_water.geojson";
  if (layerId === "osm_settlements") return "current.osm_settlements.geojson";
  return "current.osm_roads.geojson";
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function fallbackLegend(): ResolvedLegendItem[] {
  return [
    {
      id: "admin_priority",
      label: "Priorité humanitaire",
      type: "choropleth",
      symbol: "fill",
      meaning: "Gravité IPC + personnes affectées + part de population en P3+.",
      visibleByDefault: true,
      colorScale: ["#d4d4d4", "#fff1aa", "#f5b437", "#dc4b23", "#23080c"],
    },
    {
      id: "osm_roads",
      label: "Routes principales",
      type: "line",
      symbol: "road",
      meaning: "Axes de circulation principaux pour le contexte d'accès.",
      visibleByDefault: true,
      color: "#4b5563",
    },
    {
      id: "osm_water",
      label: "Points d'eau",
      type: "point",
      symbol: "droplet",
      meaning: "Points d'eau OSM disponibles sur la zone.",
      visibleByDefault: false,
      color: "#3b82f6",
    },
    {
      id: "osm_settlements",
      label: "Lieux habités",
      type: "point",
      symbol: "settlement",
      meaning: "Villes, bourgs et villages OSM.",
      visibleByDefault: false,
      color: "#111827",
    },
  ];
}

async function fetchJson<T = JsonModule>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Impossible de charger ${url}`);
  }
  const text = await response.text();
  const sanitized = text
    .replace(/\bNaN\b/g, "null")
    .replace(/\bInfinity\b/g, "null")
    .replace(/\b-Infinity\b/g, "null");
  return JSON.parse(sanitized) as T;
}

async function fetchDatasetIndex(): Promise<DatasetIndexEntry[]> {
  const payload = await fetchJson<{ countries?: DatasetIndexEntry[] }>(DATA_INDEX_URL);
  return Array.isArray(payload.countries) ? payload.countries : [];
}

async function buildCountryCatalog(entry: DatasetIndexEntry): Promise<RuntimeCountryCatalog> {
  const manifestUrl = `${DATA_BASE_URL}/${entry.slug}/${basename(entry.manifest)}`;
  const manifest = await fetchJson<ManifestLike>(manifestUrl);

  const fileRequests: FileRequest[] = [];
  const addFileRequest = (
    layerId: SupportedLayerId,
    reference: string | undefined,
    extraCandidates: string[] = [],
  ) => {
    if (!reference) return;
    const originalName = basename(reference);
    fileRequests.push({
      aliases: uniqueStrings([originalName, currentFileName(layerId), ...extraCandidates]),
      candidates: uniqueStrings([currentFileName(layerId), ...extraCandidates, originalName]),
    });
  };

  if (manifest.geojson) {
    addFileRequest("admin_priority", manifest.geojson, ["current.geojson"]);
  }
  for (const [artifactId, artifact] of Object.entries(manifest.artifacts ?? {})) {
    const name = basename(artifact.geojson ?? "");
    if (artifactId === "world" || name === "world.geojson") continue;
    const layerId = canonicalLayerId(artifactId);
    if (!layerId) continue;
    addFileRequest(layerId, artifact.geojson, layerId === "admin_priority" ? ["current.geojson"] : []);
  }
  for (const layer of manifest.layers ?? []) {
    if (basename(layer.path ?? "") === "world.geojson") continue;
    const layerId = canonicalLayerId(layer.id);
    if (!layerId) continue;
    addFileRequest(layerId, layer.path, layerId === "admin_priority" ? ["current.geojson"] : []);
  }

  const files = new Map<string, JsonModule>();
  await Promise.all(
    fileRequests.map(async (request) => {
      for (const candidate of request.candidates) {
        try {
          const payload = await fetchJson(`${DATA_BASE_URL}/${entry.slug}/${candidate}`);
          for (const alias of request.aliases) {
            files.set(alias, payload);
          }
          files.set(candidate, payload);
          return;
        } catch {
          // Try the next compatible filename.
        }
      }
    }),
  );

  return {
    slug: entry.slug,
    title: entry.title,
    manifestName: basename(entry.manifest),
    manifest,
    files,
  };
}

function decorateAdmin(admin: FeatureCollection): FeatureCollection {
  return {
    ...admin,
    features: admin.features.map((feature, index) => {
      const properties = { ...(feature.properties ?? {}) };
      const id =
        asString(properties.feature_id) ||
        asString(properties.adm3_pcode) ||
        asString(properties.adm2_pcode) ||
        asString(properties.adm1_pcode) ||
        `${asString(properties.adm3_name || properties.adm2_name || properties.adm1_name || properties.name || "region")}-${index}`;

      properties.feature_id = id;
      properties.region_name = asString(
        properties.adm3_name ||
          properties.adm2_name ||
          properties.adm1_name ||
          properties.admin_name ||
          properties.name,
        "Zone inconnue",
      );
      return {
        ...feature,
        properties,
      };
    }),
  };
}

function resolveGeoJson(country: RuntimeCountryCatalog, reference: string | undefined): FeatureCollection | null {
  if (!reference) return null;
  const direct = country.files.get(basename(reference));
  return direct && isFeatureCollection(direct) ? direct : null;
}

function resolveAdminGeoJson(country: RuntimeCountryCatalog, manifest: ManifestLike): FeatureCollection {
  const artifactPath = manifest.artifacts?.admin_priority?.geojson;
  const resolved = resolveGeoJson(country, artifactPath ?? manifest.geojson);
  if (!resolved) {
    throw new Error(`Impossible de résoudre le GeoJSON admin du manifest ${country.slug}.`);
  }
  return decorateAdmin(resolved);
}

function resolveLayers(
  country: RuntimeCountryCatalog,
  manifest: ManifestLike,
): Partial<Record<SupportedLayerId, FeatureCollection>> {
  const resolved: Partial<Record<SupportedLayerId, FeatureCollection>> = {};

  for (const [artifactId, artifact] of Object.entries(manifest.artifacts ?? {})) {
    const layerId = canonicalLayerId(artifactId);
    if (!layerId || layerId === "admin_priority") continue;
    const geojson = resolveGeoJson(country, artifact.geojson);
    if (geojson) resolved[layerId] = geojson;
  }

  for (const layer of manifest.layers ?? []) {
    const layerId = canonicalLayerId(layer.id);
    if (!layerId || layerId === "admin_priority" || resolved[layerId]) continue;
    const geojson = resolveGeoJson(country, layer.path);
    if (geojson) resolved[layerId] = geojson;
  }

  return resolved;
}

function resolveLegend(manifest: ManifestLike): ResolvedLegendItem[] {
  const items: ResolvedLegendItem[] = [];
  for (const item of manifest.legend ?? []) {
    const layerId = canonicalLayerId(item.id);
    if (!layerId) continue;
    items.push({
      id: layerId,
      label: asString(item.label, layerId),
      type: (item.type === "line" ? "line" : item.type === "point" ? "point" : "choropleth") as ResolvedLegendItem["type"],
      symbol: (
        item.symbol === "road" ||
        item.symbol === "settlement" ||
        item.symbol === "droplet"
          ? item.symbol
          : "fill"
      ) as ResolvedLegendItem["symbol"],
      meaning: asString(item.meaning, ""),
      visibleByDefault: Boolean(item.visible_by_default),
      color: item.color,
      colorScale: item.color_scale,
      zoomMin: item.zoom?.min ?? null,
      zoomMax: item.zoom?.max ?? null,
    });
  }
  if (!items.length) return fallbackLegend();

  const missing = fallbackLegend().filter(
    (fallbackItem) => !items.some((item) => item.id === fallbackItem.id),
  );
  return [...items, ...missing];
}

function regionRecordFromFeature(feature: Feature<Geometry, GeoJsonProperties>): RegionRecord {
  const props = feature.properties ?? {};
  return {
    id: asString(props.feature_id),
    name: asString(
      props.region_name || props.adm3_name || props.adm2_name || props.adm1_name || props.name,
      "Zone inconnue",
    ),
    adm1Name: asString(props.adm1_name, "n/a"),
    priorityScore: asNumber(props.priority_score ?? props.score),
    score100: asNumber(props.score_100),
    priorityLabel: asString(props.priority_label || props.status, "n/a"),
    decisionReason: asString(props.decision_reason, "Analyse disponible dans la fiche région."),
    ipcPhase: asNumber(props.ipc_phase_dominant),
    ipcPeopleP3Plus: asNumber(props.ipc_people_p3plus),
    ipcPopulationTotal: asNumber(props.ipc_population_total),
    ipcShareP3Plus: asNumber(props.ipc_share_p3plus),
  };
}

function parseHistoryPayload(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function timelineEntriesFromFeature(feature: Feature<Geometry, GeoJsonProperties>): RegionTimelineEntry[] {
  const props = feature.properties ?? {};
  const historyKey = Object.keys(props).find((key) => key.endsWith("_history"));
  if (!historyKey) return [];

  return parseHistoryPayload(props[historyKey])
    .map((entry) => {
      const year = asNumber(entry.reference_year ?? entry.exercise_year);
      const p3plus = asNumber(entry.phase35 ?? entry.phase3) ?? 0;
      const population = asNumber(entry.population);
      return {
        year,
        label: asString(entry.reference_label || entry.exercise_label, year ? String(year) : "n/a"),
        type: asString(entry.chtype, "n/a"),
        phase: asNumber(entry.phase_class),
        p3plus,
        population,
        shareP3Plus:
          population && population > 0 && p3plus !== null ? p3plus / population : null,
      };
    })
    .sort((left, right) => (left.year ?? 0) - (right.year ?? 0));
}

function resolveTopRegions(manifest: ManifestLike, admin: FeatureCollection): RegionRecord[] {
  const summaryRegions = manifest.summary?.top_regions;
  const adminRecords = admin.features.map(regionRecordFromFeature);
  const byName = new Map(adminRecords.map((record) => [normalizeText(record.name), record]));

  if (summaryRegions?.length) {
    return summaryRegions
      .map((region) => {
        const name = asString(region.name);
        const existing = byName.get(normalizeText(name));
        return {
          id: existing?.id ?? name,
          name: name || existing?.name || "Zone inconnue",
          adm1Name: existing?.adm1Name ?? "n/a",
          priorityScore: asNumber(region.priority_score) ?? existing?.priorityScore ?? null,
          score100: asNumber(region.score_100) ?? existing?.score100 ?? null,
          priorityLabel: asString(region.priority_label, existing?.priorityLabel ?? "n/a"),
          decisionReason: asString(region.decision_reason, existing?.decisionReason ?? "Analyse disponible dans la fiche région."),
          ipcPhase: asNumber(region.ipc_phase_dominant) ?? existing?.ipcPhase ?? null,
          ipcPeopleP3Plus: asNumber(region.ipc_people_p3plus) ?? existing?.ipcPeopleP3Plus ?? null,
          ipcPopulationTotal: asNumber(region.ipc_population_total) ?? existing?.ipcPopulationTotal ?? null,
          ipcShareP3Plus: asNumber(region.ipc_share_p3plus) ?? existing?.ipcShareP3Plus ?? null,
        };
      })
      .slice(0, 8);
  }

  return adminRecords
    .slice()
    .sort((left, right) => (right.priorityScore ?? -1) - (left.priorityScore ?? -1))
    .slice(0, 8);
}

function resolveLayerDefaults(
  manifest: ManifestLike,
  legend: ResolvedLegendItem[],
): Record<SupportedLayerId, boolean> {
  const defaults: Record<SupportedLayerId, boolean> = {
    admin_priority: true,
    osm_water: false,
    osm_settlements: false,
    osm_roads: true,
  };

  for (const layerId of ["admin_priority", "osm_water", "osm_settlements", "osm_roads"] as SupportedLayerId[]) {
    const layerEntry = (manifest.layers ?? []).find(
      (layer) => canonicalLayerId(layer.id) === layerId,
    );
    const legendEntry = legend.find((item) => item.id === layerId);
    if (typeof layerEntry?.visible_by_default === "boolean") {
      defaults[layerId] = layerEntry.visible_by_default;
      continue;
    }
    if (typeof legendEntry?.visibleByDefault === "boolean") {
      defaults[layerId] = legendEntry.visibleByDefault;
    }
  }
  defaults.admin_priority = true;
  defaults.osm_roads = true;
  return defaults;
}

function buildDataset(country: RuntimeCountryCatalog): MapDataset {
  const admin = resolveAdminGeoJson(country, country.manifest);
  const legend = resolveLegend(country.manifest);
  const layers = resolveLayers(country, country.manifest);
  const summary = country.manifest.summary ?? {};
  const title = asString(country.manifest.run?.zone, country.title ?? country.slug);
  return {
    id: country.slug,
    slug: country.slug,
    manifest: country.manifest,
    manifestName: country.manifestName,
    title,
    admin,
    layers,
    legend,
    summary,
    topRegions: resolveTopRegions(country.manifest, admin),
    layerDefaults: resolveLayerDefaults(country.manifest, legend),
  };
}

function combineFeatureCollections(
  datasets: MapDataset[],
  selector: (dataset: MapDataset) => FeatureCollection | undefined,
): FeatureCollection {
  const features = datasets.flatMap((dataset) =>
    (selector(dataset)?.features ?? []).map((feature, index) => {
      const properties = { ...(feature.properties ?? {}) };
      const baseId =
        asString(properties.feature_id) ||
        asString(properties.adm3_pcode) ||
        asString(properties.adm2_pcode) ||
        asString(properties.adm1_pcode) ||
        `${dataset.slug}-${index}`;
      properties.feature_id = `${dataset.slug}:${baseId}`;
      properties.country_slug = dataset.slug;
      properties.country_name = dataset.title;
      return {
        ...feature,
        properties,
      };
    }),
  );
  return { type: "FeatureCollection", features };
}

function combineLegend(datasets: MapDataset[]): ResolvedLegendItem[] {
  const seen = new Map<SupportedLayerId, ResolvedLegendItem>();
  for (const dataset of datasets) {
    for (const item of dataset.legend) {
      if (!seen.has(item.id)) seen.set(item.id, item);
    }
  }
  return (["admin_priority", "osm_water", "osm_settlements", "osm_roads"] as SupportedLayerId[])
    .map((id) => seen.get(id))
    .filter(Boolean) as ResolvedLegendItem[];
}

function combineLayerDefaults(datasets: MapDataset[]): Record<SupportedLayerId, boolean> {
  return {
    admin_priority: true,
    osm_water: datasets.some((dataset) => dataset.layerDefaults.osm_water),
    osm_settlements: datasets.some((dataset) => dataset.layerDefaults.osm_settlements),
    osm_roads: datasets.some((dataset) => dataset.layerDefaults.osm_roads),
  };
}

function combineSummary(datasets: MapDataset[]): ManifestSummary {
  return {
    feature_count: datasets.reduce(
      (sum, dataset) => sum + Number(dataset.summary.feature_count ?? dataset.admin.features.length ?? 0),
      0,
    ),
    people_p3plus_total: datasets.reduce(
      (sum, dataset) => sum + Number(dataset.summary.people_p3plus_total ?? 0),
      0,
    ),
    score_100_mean:
      datasets.reduce((sum, dataset) => sum + Number(dataset.summary.score_100_mean ?? 0), 0) /
      Math.max(datasets.length, 1),
  };
}

function combineTopRegions(datasets: MapDataset[]): RegionRecord[] {
  return datasets
    .flatMap((dataset) => dataset.topRegions)
    .slice()
    .sort((left, right) => (right.priorityScore ?? -1) - (left.priorityScore ?? -1))
    .slice(0, 12);
}

export async function loadCombinedDataset(): Promise<MapDataset> {
  const entries = await fetchDatasetIndex();
  if (!entries.length) {
    throw new Error("Aucun dataset pays trouvé dans public/data.");
  }
  const datasets = await Promise.all(entries.map((entry) => buildCountryCatalog(entry).then(buildDataset)));

  const admin = combineFeatureCollections(datasets, (dataset) => dataset.admin);
  admin.features = admin.features
    .slice()
    .sort((left, right) => featureDisplayArea(right) - featureDisplayArea(left));
  const layers: Partial<Record<SupportedLayerId, FeatureCollection>> = {
    admin_priority: admin,
    osm_water: combineFeatureCollections(datasets, (dataset) => dataset.layers.osm_water),
    osm_settlements: combineFeatureCollections(datasets, (dataset) => dataset.layers.osm_settlements),
    osm_roads: combineFeatureCollections(datasets, (dataset) => dataset.layers.osm_roads),
  };

  return {
    id: "combined",
    slug: "combined",
    manifest: {},
    manifestName: datasets.map((dataset) => dataset.manifestName).join(", "),
    title: datasets.map((dataset) => dataset.title).join(" + "),
    admin,
    layers,
    legend: combineLegend(datasets),
    summary: combineSummary(datasets),
    topRegions: combineTopRegions(datasets),
    layerDefaults: combineLayerDefaults(datasets),
  };
}

export function getTimelineFallbackSummary(
  dataset: MapDataset,
  year: number | null,
): Array<{ countryName: string; latestYear: number }> {
  if (year === null) return [];

  const byCountry = new Map<string, { countryName: string; latestYear: number }>();

  for (const feature of dataset.admin.features) {
    const props = feature.properties ?? {};
    const countryName = asString(props.country_name || props.adm0_name, "Zone");
    const countryKey = asString(props.country_slug || props.adm0_name || countryName, countryName);
    const latestYear = Math.max(
      -Infinity,
      ...timelineEntriesFromFeature(feature)
        .map((entry) => entry.year)
        .filter((entryYear): entryYear is number => typeof entryYear === "number" && Number.isFinite(entryYear)),
    );

    if (!Number.isFinite(latestYear) || latestYear >= year) continue;

    const current = byCountry.get(countryKey);
    if (!current || latestYear > current.latestYear) {
      byCountry.set(countryKey, { countryName, latestYear });
    }
  }

  return Array.from(byCountry.values()).sort((left, right) =>
    left.countryName.localeCompare(right.countryName),
  );
}

export function getRegionDetail(
  dataset: MapDataset,
  featureId: string | null | undefined,
): RegionDetail | null {
  if (!featureId) return null;
  const feature = dataset.admin.features.find(
    (item) => asString(item.properties?.feature_id) === featureId,
  );
  if (!feature) return null;
  const props = feature.properties ?? {};
  const base = regionRecordFromFeature(feature);
  return {
    ...base,
    countryName: asString(props.country_name || props.adm0_name, "n/a"),
    history: timelineEntriesFromFeature(feature),
  };
}

export function getTimelineYears(dataset: MapDataset): number[] {
  const years = new Set<number>();
  for (const feature of dataset.admin.features) {
    for (const entry of timelineEntriesFromFeature(feature)) {
      if (typeof entry.year === "number" && Number.isFinite(entry.year)) {
        years.add(entry.year);
      }
    }
  }
  return Array.from(years).sort((left, right) => left - right);
}

function priorityLabelFromScore(score: number | null): string {
  if (score === null) return "Donnees manquantes";
  if (score >= 0.66) return "Prioritaire";
  if (score >= 0.33) return "A surveiller";
  return "Faible";
}

function pickTimelineEntryForYear(
  entries: RegionTimelineEntry[],
  year: number,
): RegionTimelineEntry | null {
  const exactMatches = entries.filter((entry) => entry.year === year);
  if (exactMatches.length) {
    return exactMatches[exactMatches.length - 1] ?? null;
  }

  const previousMatches = entries
    .filter((entry) => typeof entry.year === "number" && (entry.year ?? 0) <= year)
    .sort((left, right) => (left.year ?? 0) - (right.year ?? 0));

  if (previousMatches.length) {
    return previousMatches[previousMatches.length - 1] ?? null;
  }

  return null;
}

function decorateFeatureForYear(
  feature: Feature<Geometry, GeoJsonProperties>,
  year: number,
  maxP3Plus: number,
  maxShare: number,
): Feature<Geometry, GeoJsonProperties> {
  const props = { ...(feature.properties ?? {}) };
  const entry = pickTimelineEntryForYear(timelineEntriesFromFeature(feature), year);

  if (!entry || entry.phase === null) {
    props.ipc_phase_dominant = null;
    props.ipc_people_p3plus = 0;
    props.ipc_people_p4plus = 0;
    props.ipc_share_p3plus = null;
    props.ipc_population_total = entry?.population ?? null;
    props.priority_score = null;
    props.score = null;
    props.score_100 = 0;
    props.priority_label = "Donnees manquantes";
    props.status = "Donnees manquantes";
    props.decision_reason = "Donnees IPC manquantes pour cette annee.";
    props.timeline_year = year;
    return { ...feature, properties: props };
  }

  const severity = Math.max(0, Math.min(1, ((entry.phase ?? 1) - 1) / 4));
  const burden =
    maxP3Plus > 0 && entry.p3plus !== null ? Math.max(0, Math.min(1, entry.p3plus / maxP3Plus)) : null;
  const share =
    maxShare > 0 && entry.shareP3Plus !== null ? Math.max(0, Math.min(1, entry.shareP3Plus / maxShare)) : null;

  const weighted = [
    { value: severity, weight: 0.45 },
    { value: burden, weight: 0.35 },
    { value: share, weight: 0.20 },
  ].filter((item) => item.value !== null) as Array<{ value: number; weight: number }>;

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const priorityScore =
    totalWeight > 0
      ? weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight
      : null;
  const score100 = priorityScore === null ? 0 : Math.round(priorityScore * 1000) / 10;
  const priorityLabel = priorityLabelFromScore(priorityScore);
  const sharePercent =
    entry.shareP3Plus !== null ? `${(entry.shareP3Plus * 100).toFixed(1)}%` : "n/a";
  const p3Label =
    entry.p3plus !== null ? Math.round(entry.p3plus).toLocaleString("fr-FR") : "0";

  props.ipc_phase_dominant = entry.phase;
  props.ipc_people_p3plus = entry.p3plus ?? 0;
  props.ipc_people_p4plus = 0;
  props.ipc_share_p3plus = entry.shareP3Plus;
  props.ipc_population_total = entry.population;
  props.priority_score = priorityScore;
  props.score = priorityScore;
  props.score_100 = score100;
  props.priority_label = priorityLabel;
  props.status = priorityLabel;
  props.decision_reason = `${p3Label} personnes P3+, ${sharePercent} affectées (${year}).`;
  props.timeline_year = year;
  return { ...feature, properties: props };
}

export function projectDatasetForYear(
  dataset: MapDataset,
  year: number | null,
): MapDataset {
  if (year === null) return dataset;

  const selectedEntries = dataset.admin.features
    .map((feature) => pickTimelineEntryForYear(timelineEntriesFromFeature(feature), year))
    .filter((entry): entry is RegionTimelineEntry => Boolean(entry && entry.phase !== null));

  const maxP3Plus = Math.max(
    0,
    ...selectedEntries.map((entry) => entry.p3plus ?? 0),
  );
  const maxShare = Math.max(
    0,
    ...selectedEntries.map((entry) => entry.shareP3Plus ?? 0),
  );

  const admin: FeatureCollection = {
    ...dataset.admin,
    features: dataset.admin.features.map((feature) =>
      decorateFeatureForYear(feature, year, maxP3Plus, maxShare),
    ),
  };

  const topRegions = admin.features
    .map(regionRecordFromFeature)
    .filter((record) => record.priorityScore !== null)
    .sort((left, right) => (right.priorityScore ?? -1) - (left.priorityScore ?? -1))
    .slice(0, 12);

  const scoreValues = admin.features
    .map((feature) => asNumber(feature.properties?.score_100))
    .filter((value): value is number => value !== null);
  const p3Total = admin.features.reduce(
    (sum, feature) => sum + Number(asNumber(feature.properties?.ipc_people_p3plus) ?? 0),
    0,
  );

  return {
    ...dataset,
    admin,
    summary: {
      ...dataset.summary,
      feature_count: admin.features.length,
      people_p3plus_total: p3Total,
      score_100_mean:
        scoreValues.reduce((sum, value) => sum + value, 0) / Math.max(scoreValues.length, 1),
    },
    topRegions,
  };
}

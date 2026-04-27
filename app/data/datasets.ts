import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";

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

export type SupportedLayerId =
  | "admin_priority"
  | "osm_water"
  | "osm_settlements"
  | "osm_roads";

export type ResolvedLegendItem = {
  id: SupportedLayerId;
  label: string;
  type: "choropleth" | "point" | "line";
  symbol: "fill" | "droplet" | "settlement" | "road";
  meaning: string;
  visibleByDefault: boolean;
  color?: string;
  colorScale?: string[];
  zoomMin?: number | null;
  zoomMax?: number | null;
};

export type RegionRecord = {
  id: string;
  name: string;
  adm1Name: string;
  priorityScore: number | null;
  score100: number | null;
  priorityLabel: string;
  decisionReason: string;
  ipcPhase: number | null;
  ipcPeopleP3Plus: number | null;
  ipcPopulationTotal: number | null;
  ipcShareP3Plus: number | null;
};

export type RegionTimelineEntry = {
  year: number | null;
  label: string;
  type: string;
  phase: number | null;
  p3plus: number | null;
  population: number | null;
  shareP3Plus: number | null;
};

export type RegionDetail = RegionRecord & {
  countryName: string;
  history: RegionTimelineEntry[];
};

export type MapDataset = {
  id: string;
  slug: string;
  manifest: ManifestLike;
  manifestName: string;
  title: string;
  admin: FeatureCollection;
  layers: Partial<Record<SupportedLayerId, FeatureCollection>>;
  legend: ResolvedLegendItem[];
  summary: ManifestSummary;
  topRegions: RegionRecord[];
  layerDefaults: Record<SupportedLayerId, boolean>;
};

const DATA_RAW_MODULES = import.meta.glob("../../data/*/*.{json,geojson}", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const SUPPORTED_LAYERS: SupportedLayerId[] = [
  "admin_priority",
  "osm_water",
  "osm_settlements",
  "osm_roads",
];

function basename(input: string): string {
  return input.replace(/\\/g, "/").split("/").pop() ?? input;
}

function parentFolder(input: string): string {
  const parts = input.replace(/\\/g, "/").split("/");
  return parts.at(-2) ?? "";
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

function titleFromSlug(slug: string): string {
  const known: Record<string, string> = {
    senegal: "Sénégal",
    gambie: "Gambie",
    gambia: "Gambia",
    guinee: "Guinée",
    guinea: "Guinea",
    guinee_bissau: "Guinée-Bissau",
    guinea_bissau: "Guinea-Bissau",
    sierra_leone: "Sierra Leone",
  };
  if (known[slug]) return known[slug];
  const text = slug.replace(/[-_]+/g, " ").trim();
  if (!text) return "Unknown";
  return text
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isFeatureCollection(value: unknown): value is FeatureCollection {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as { type?: string }).type === "FeatureCollection"
  );
}

function isManifest(value: unknown): value is ManifestLike {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    ("geojson" in (value as object) || "layers" in (value as object) || "artifacts" in (value as object))
  );
}

type CountryCatalog = {
  slug: string;
  files: Map<string, JsonModule>;
};

function buildCatalogByCountry() {
  const catalog = new Map<string, CountryCatalog>();
  for (const [path, rawValue] of Object.entries(DATA_RAW_MODULES)) {
    const slug = parentFolder(path);
    if (!slug) continue;
    const entry = catalog.get(slug) ?? { slug, files: new Map<string, JsonModule>() };
    entry.files.set(basename(path), JSON.parse(rawValue) as JsonModule);
    catalog.set(slug, entry);
  }
  return catalog;
}

const CATALOG_BY_COUNTRY = buildCatalogByCountry();

function collectManifests(country: CountryCatalog): Array<{ name: string; manifest: ManifestLike }> {
  return Array.from(country.files.entries())
    .filter(([name, value]) => name.endsWith(".manifest.json") && isManifest(value))
    .map(([name, manifest]) => ({ name, manifest }));
}

function manifestTimestamp(manifest: ManifestLike): number {
  const raw = manifest.run?.created_at;
  if (!raw) return 0;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : 0;
}

function pickPrimaryManifest(country: CountryCatalog): { name: string; manifest: ManifestLike } {
  const manifests = collectManifests(country);
  if (!manifests.length) {
    throw new Error(`Aucun manifest trouvé dans LP/data/${country.slug}.`);
  }

  return manifests
    .slice()
    .sort((left, right) => {
      const timeDiff = manifestTimestamp(right.manifest) - manifestTimestamp(left.manifest);
      if (timeDiff !== 0) return timeDiff;
      return right.name.localeCompare(left.name);
    })[0];
}

function resolveGeoJson(country: CountryCatalog, reference: string | undefined): FeatureCollection | null {
  if (!reference) return null;
  const direct = country.files.get(basename(reference));
  if (direct && isFeatureCollection(direct)) {
    return direct;
  }
  return null;
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

function resolveAdminGeoJson(country: CountryCatalog, manifest: ManifestLike): FeatureCollection {
  const artifactPath = manifest.artifacts?.admin_priority?.geojson;
  const resolved = resolveGeoJson(country, artifactPath ?? manifest.geojson);
  if (!resolved) {
    throw new Error(`Impossible de résoudre le GeoJSON admin du manifest ${country.slug}.`);
  }
  return decorateAdmin(resolved);
}

function canonicalLayerId(layerId: string | undefined): SupportedLayerId | null {
  if (!layerId) return null;
  if (layerId === "admin_priority") return "admin_priority";
  if (layerId === "osm_water" || layerId === "osm_context_water") return "osm_water";
  if (layerId === "osm_settlements" || layerId === "osm_context_settlements") return "osm_settlements";
  if (layerId === "osm_roads" || layerId === "osm_context_roads") return "osm_roads";
  return null;
}

function resolveLayers(
  country: CountryCatalog,
  manifest: ManifestLike,
): Partial<Record<SupportedLayerId, FeatureCollection>> {
  const resolved: Partial<Record<SupportedLayerId, FeatureCollection>> = {};

  for (const [artifactId, artifact] of Object.entries(manifest.artifacts ?? {})) {
    const layerId = canonicalLayerId(artifactId);
    if (!layerId || layerId === "admin_priority") continue;
    const geojson = resolveGeoJson(country, artifact.geojson);
    if (geojson) {
      resolved[layerId] = geojson;
    }
  }

  for (const layer of manifest.layers ?? []) {
    const layerId = canonicalLayerId(layer.id);
    if (!layerId || layerId === "admin_priority" || resolved[layerId]) continue;
    const geojson = resolveGeoJson(country, layer.path);
    if (geojson) {
      resolved[layerId] = geojson;
    }
  }

  return resolved;
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

  if (!items.length) {
    return fallbackLegend();
  }

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
          population && population > 0 && p3plus !== null
            ? p3plus / population
            : null,
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
          decisionReason: asString(
            region.decision_reason,
            existing?.decisionReason ?? "Analyse disponible dans la fiche région.",
          ),
          ipcPhase: asNumber(region.ipc_phase_dominant) ?? existing?.ipcPhase ?? null,
          ipcPeopleP3Plus: asNumber(region.ipc_people_p3plus) ?? existing?.ipcPeopleP3Plus ?? null,
          ipcPopulationTotal:
            asNumber(region.ipc_population_total) ?? existing?.ipcPopulationTotal ?? null,
          ipcShareP3Plus:
            asNumber(region.ipc_share_p3plus) ?? existing?.ipcShareP3Plus ?? null,
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

  for (const layerId of SUPPORTED_LAYERS) {
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

function buildDataset(country: CountryCatalog): MapDataset {
  const primary = pickPrimaryManifest(country);
  const admin = resolveAdminGeoJson(country, primary.manifest);
  const legend = resolveLegend(primary.manifest);
  const layers = resolveLayers(country, primary.manifest);
  const summary = primary.manifest.summary ?? {};
  const title = asString(primary.manifest.run?.zone, titleFromSlug(country.slug));
  return {
    id: country.slug,
    slug: country.slug,
    manifest: primary.manifest,
    manifestName: primary.name,
    title,
    admin,
    layers,
    legend,
    summary,
    topRegions: resolveTopRegions(primary.manifest, admin),
    layerDefaults: resolveLayerDefaults(primary.manifest, legend),
  };
}

export const allDatasets: MapDataset[] = Array.from(CATALOG_BY_COUNTRY.values())
  .map((country) => buildDataset(country))
  .sort((left, right) => left.title.localeCompare(right.title));

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

  return {
    type: "FeatureCollection",
    features,
  };
}

function combineLegend(datasets: MapDataset[]): ResolvedLegendItem[] {
  const seen = new Map<SupportedLayerId, ResolvedLegendItem>();
  for (const dataset of datasets) {
    for (const item of dataset.legend) {
      if (!seen.has(item.id)) {
        seen.set(item.id, item);
      }
    }
  }
  return SUPPORTED_LAYERS.map((id) => seen.get(id)).filter(Boolean) as ResolvedLegendItem[];
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

export function getCombinedDataset(): MapDataset {
  const datasets = allDatasets;
  if (!datasets.length) {
    throw new Error("Aucun dataset pays trouvé dans LP/data.");
  }

  const admin = combineFeatureCollections(datasets, (dataset) => dataset.admin);
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

export const combinedDataset = getCombinedDataset();

export function getDatasetBySlug(slug: string | null | undefined): MapDataset | null {
  if (!slug) return null;
  return allDatasets.find((dataset) => dataset.slug === slug) ?? null;
}

export function getDefaultDataset(): MapDataset {
  return combinedDataset;
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

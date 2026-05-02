import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";

import type {
  ManifestLayer,
  ManifestLegendItem,
  ManifestLike,
  ManifestSummary,
  MapDataset,
  IpcCountrySummary,
  RegionDetail,
  RegionRecord,
  RegionTimelineEntry,
  ResolvedLegendItem,
  SupportedLayerId,
} from "./dataset-types";

type JsonModule = Record<string, unknown>;

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
  tileUrls: Partial<Record<SupportedLayerId, string>>;
  tileSourceLayers: Partial<Record<SupportedLayerId, string>>;
  availableLayers: Partial<Record<SupportedLayerId, boolean>>;
};

type FileRequest = {
  aliases: string[];
  candidates: string[];
};

const DATA_BASE_URL = (import.meta.env.VITE_OHM_DATA_BASE_URL ?? "/data").replace(/\/$/, "");
const DATA_INDEX_URL = `${DATA_BASE_URL}/index.json`;
const DATA_CACHE_BUSTER = String(Date.now());
const ADMIN_LOAD_CONCURRENCY = 15;
let catalogCache: RuntimeCountryCatalog[] | null = null;
const combinedLayerCache = new Map<SupportedLayerId, FeatureCollection>();

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

function emptyFeatureCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function canonicalLayerId(layerId: string | undefined): SupportedLayerId | null {
  if (!layerId) return null;
  if (layerId === "admin_priority") return "admin_priority";
  if (layerId === "osm_water" || layerId === "osm_context_water") return "osm_water";
  if (layerId === "osm_settlements" || layerId === "osm_context_settlements") return "osm_settlements";
  if (layerId === "osm_roads" || layerId === "osm_context_roads") return "osm_roads";
  if (layerId === "population" || layerId === "population_density" || layerId === "population_points") {
    return "population";
  }
  return null;
}

function currentFileName(layerId: SupportedLayerId): string {
  if (layerId === "admin_priority") return "current.admin_priority.geojson";
  if (layerId === "osm_water") return "current.osm_water.geojson";
  if (layerId === "osm_settlements") return "current.osm_settlements.geojson";
  if (layerId === "population") return "current.population.geojson";
  return "current.osm_roads.geojson";
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function resolveTileConfig(
  slug: string,
  manifest: ManifestLike,
): {
  tileUrls: Partial<Record<SupportedLayerId, string>>;
  tileSourceLayers: Partial<Record<SupportedLayerId, string>>;
  availableLayers: Partial<Record<SupportedLayerId, boolean>>;
} {
  const tileUrls: Partial<Record<SupportedLayerId, string>> = {};
  const tileSourceLayers: Partial<Record<SupportedLayerId, string>> = {};
  const availableLayers: Partial<Record<SupportedLayerId, boolean>> = {};

  for (const [artifactId, artifact] of Object.entries(manifest.tiles?.artifacts ?? {})) {
    const layerId = canonicalLayerId(artifactId);
    if (!layerId || !artifact.pmtiles) continue;
    tileUrls[layerId] = `${DATA_BASE_URL}/${slug}/${basename(artifact.pmtiles)}`;
    tileSourceLayers[layerId] = artifact.source_layer ?? artifactId;
    availableLayers[layerId] = true;
  }

  const conventionalTiles: Array<{
    layerId: SupportedLayerId;
    filename: string;
    sourceLayer: string;
  }> = [
      {
        layerId: "admin_priority",
        filename: "current.admin_priority.pmtiles",
        sourceLayer: "admin_priority",
      },
      {
        layerId: "osm_roads",
        filename: "current.osm_roads.pmtiles",
        sourceLayer: "osm_roads",
      },
      {
        layerId: "osm_water",
        filename: "current.osm_water.pmtiles",
        sourceLayer: "osm_water",
      },
      {
        layerId: "osm_settlements",
        filename: "current.osm_settlements.pmtiles",
        sourceLayer: "osm_settlements",
      },
    ];

  for (const tile of conventionalTiles) {
    if (!tileUrls[tile.layerId]) {
      tileUrls[tile.layerId] = `${DATA_BASE_URL}/${slug}/${tile.filename}`;
    }
    if (!tileSourceLayers[tile.layerId]) {
      tileSourceLayers[tile.layerId] = tile.sourceLayer;
    }
    if (availableLayers[tile.layerId] === undefined) {
      availableLayers[tile.layerId] = true;
    }
  }

  const hasPopulationArtifact =
    Object.entries(manifest.artifacts ?? {}).some(
      ([artifactId, artifact]) =>
        canonicalLayerId(artifactId) === "population" && Boolean(artifact.geojson),
    ) ||
    Boolean(
      Object.entries(manifest.tiles?.artifacts ?? {}).find(
        ([artifactId, artifact]) =>
          canonicalLayerId(artifactId) === "population" && Boolean(artifact.pmtiles),
      ),
    );

  if (hasPopulationArtifact) {
    if (!tileUrls.population) {
      tileUrls.population = `${DATA_BASE_URL}/${slug}/current.population.pmtiles`;
    }
    if (!tileSourceLayers.population) {
      tileSourceLayers.population = "population";
    }
    availableLayers.population = true;
  } else {
    availableLayers.population = false;
  }

  return { tileUrls, tileSourceLayers, availableLayers };
}

function withRuntimeCacheBuster(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}ohm_v=${DATA_CACHE_BUSTER}`;
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
      colorScale: ["#d4d4d4", "#fff7bc", "#ffd25c", "#f59123", "#de4827", "#3a080e"],
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
    {
      id: "population",
      label: "Population",
      type: "heatmap",
      symbol: "population",
      meaning: "Densite de population derivee du raster WorldPop.",
      visibleByDefault: false,
      colorScale: ["#0f172a", "#1d4ed8", "#38bdf8", "#f59e0b", "#f97316", "#fb7185"],
    },
  ];
}

async function fetchJson<T = JsonModule>(url: string): Promise<T> {
  const requestUrl = withRuntimeCacheBuster(url);
  const response = await fetch(requestUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Impossible de charger ${url} (${response.status})`);
  }
  const fallbackResponse = response.clone();
  try {
    return (await response.json()) as T;
  } catch {
    const text = await fallbackResponse.text();
    const sanitized = text
      .replace(/\bNaN\b/g, "null")
      .replace(/\bInfinity\b/g, "null")
      .replace(/\b-Infinity\b/g, "null");
    return JSON.parse(sanitized) as T;
  }
}

async function fetchDatasetIndex(): Promise<DatasetIndexEntry[]> {
  const payload = await fetchJson<{ countries?: DatasetIndexEntry[] }>(DATA_INDEX_URL);
  return Array.isArray(payload.countries) ? payload.countries : [];
}

function sortDatasetEntries(entries: DatasetIndexEntry[]): DatasetIndexEntry[] {
  const preferred = ["senegal", "gambie", "gambia", "guinea", "guinee"];

  return entries.slice().sort((left, right) => {
    const leftIndex = preferred.indexOf(normalizeText(left.slug));
    const rightIndex = preferred.indexOf(normalizeText(right.slug));

    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }

    return left.slug.localeCompare(right.slug);
  });
}

function fileRequestForLayer(
  manifest: ManifestLike,
  layerId: SupportedLayerId,
): FileRequest | null {
  if (layerId === "population") {
    const hasPopulationArtifact =
      Object.entries(manifest.artifacts ?? {}).some(
        ([artifactId, artifact]) =>
          canonicalLayerId(artifactId) === "population" && Boolean(artifact.geojson),
      ) ||
      Boolean(
        Object.entries(manifest.tiles?.artifacts ?? {}).find(
          ([artifactId, artifact]) =>
            canonicalLayerId(artifactId) === "population" &&
            (Boolean(artifact.geojson_fallback) || Boolean(artifact.pmtiles)),
        ),
      );

    if (!hasPopulationArtifact) {
      return null;
    }
  }

  const references: string[] = [];

  if (layerId === "admin_priority" && manifest.geojson) {
    references.push(manifest.geojson);
  }

  for (const [artifactId, artifact] of Object.entries(manifest.artifacts ?? {})) {
    const name = basename(artifact.geojson ?? "");
    if (artifactId === "world" || name === "world.geojson") continue;
    if (canonicalLayerId(artifactId) === layerId && artifact.geojson) {
      references.push(artifact.geojson);
    }
  }

  for (const layer of manifest.layers ?? []) {
    if (basename(layer.path ?? "") === "world.geojson") continue;
    if (canonicalLayerId(layer.id) === layerId && layer.path) {
      references.push(layer.path);
    }
  }

  const extraCandidates = layerId === "admin_priority" ? ["current.geojson"] : [];
  const candidates = uniqueStrings([
    currentFileName(layerId),
    ...extraCandidates,
    ...references.map(basename),
  ]);
  if (!candidates.length) return null;

  return {
    aliases: uniqueStrings([
      currentFileName(layerId),
      ...extraCandidates,
      ...references.map(basename),
    ]),
    candidates,
  };
}

async function fetchCountryLayerFile(
  slug: string,
  request: FileRequest | null,
): Promise<Map<string, JsonModule>> {
  const files = new Map<string, JsonModule>();
  if (!request) return files;

  for (const candidate of request.candidates) {
    try {
      const payload = await fetchJson(`${DATA_BASE_URL}/${slug}/${candidate}`);
      for (const alias of request.aliases) {
        files.set(alias, payload);
      }
      files.set(candidate, payload);
      return files;
    } catch {
      // Try the next compatible filename.
    }
  }

  return files;
}

async function hydrateCountryAdmin(country: RuntimeCountryCatalog): Promise<void> {
  const request = fileRequestForLayer(country.manifest, "admin_priority");
  const files = await fetchCountryLayerFile(country.slug, request);
  for (const [key, value] of files) {
    country.files.set(key, value);
  }
}

function isCountryAdminHydrated(country: RuntimeCountryCatalog): boolean {
  return Boolean(resolveAdminGeoJson(country, country.manifest)?.features.length);
}

async function buildCountryCatalog(entry: DatasetIndexEntry): Promise<RuntimeCountryCatalog> {
  const manifestUrl = `${DATA_BASE_URL}/${entry.slug}/${basename(entry.manifest)}`;
  const manifest = await fetchJson<ManifestLike>(manifestUrl);
  const { tileUrls, tileSourceLayers, availableLayers } = resolveTileConfig(entry.slug, manifest);

  return {
    slug: entry.slug,
    title: entry.title,
    manifestName: basename(entry.manifest),
    manifest,
    files: new Map<string, JsonModule>(),
    tileUrls,
    tileSourceLayers,
    availableLayers,
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

function resolveAdminGeoJson(
  country: RuntimeCountryCatalog,
  manifest: ManifestLike,
): FeatureCollection | null {
  const artifactPath = manifest.artifacts?.admin_priority?.geojson;
  const resolved = resolveGeoJson(country, artifactPath ?? manifest.geojson);
  return resolved ? decorateAdmin(resolved) : null;
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
      const phase1 = asNumber(entry.phase1);
      const phase2 = asNumber(entry.phase2);
      const phase3 = asNumber(entry.phase3);
      const phase4 = asNumber(entry.phase4);
      const phase5 = asNumber(entry.phase5);
      const p3plus = asNumber(entry.phase35 ?? entry.phase3) ?? 0;
      const population = asNumber(entry.population);
      return {
        year,
        label: asString(entry.reference_label || entry.exercise_label, year ? String(year) : "n/a"),
        type: asString(entry.chtype, "n/a"),
        phase: asNumber(entry.phase_class),
        phase1,
        phase2,
        phase3,
        phase4,
        phase5,
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
    population: false,
  };

  for (const layerId of ["admin_priority", "osm_water", "osm_settlements", "osm_roads", "population"] as SupportedLayerId[]) {
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
  const admin = resolveAdminGeoJson(country, country.manifest) ?? emptyFeatureCollection();
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
    countries: [
      {
        slug: country.slug,
        title,
        manifestName: country.manifestName,
        ipcOverview: country.manifest.summary?.ipc_country_overview,
        tileUrls: country.tileUrls,
        tileSourceLayers: country.tileSourceLayers,
        availableLayers: country.availableLayers,
      },
    ],
    adminHydrated: admin.features.length > 0,
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
  return (["admin_priority", "osm_water", "osm_settlements", "osm_roads", "population"] as SupportedLayerId[])
    .map((id) => seen.get(id))
    .filter(Boolean) as ResolvedLegendItem[];
}

function combineLayerDefaults(datasets: MapDataset[]): Record<SupportedLayerId, boolean> {
  return {
    admin_priority: true,
    osm_water: false,
    osm_settlements: false,
    osm_roads: false,
    population: false,
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

function buildCombinedDatasetFromParts(datasets: MapDataset[]): MapDataset {
  const admin = combineFeatureCollections(datasets, (dataset) => dataset.admin);
  admin.features = admin.features
    .slice()
    .sort((left, right) => featureDisplayArea(right) - featureDisplayArea(left));

  return {
    id: "combined",
    slug: "combined",
    manifest: {},
    manifestName: datasets.map((dataset) => dataset.manifestName).join(", "),
    title: datasets.map((dataset) => dataset.title).join(" + "),
    admin,
    layers: { admin_priority: admin },
    legend: combineLegend(datasets),
    summary: combineSummary(datasets),
    topRegions: combineTopRegions(datasets),
    layerDefaults: combineLayerDefaults(datasets),
    countries: datasets.flatMap((dataset) => dataset.countries),
    adminHydrated: datasets.every((dataset) => dataset.adminHydrated),
  };
}

async function resolveCountryLayer(
  country: RuntimeCountryCatalog,
  layerId: SupportedLayerId,
): Promise<FeatureCollection | null> {
  const request = fileRequestForLayer(country.manifest, layerId);
  for (const alias of request?.aliases ?? []) {
    const existing = country.files.get(alias);
    if (existing && isFeatureCollection(existing)) return existing;
  }

  const fetched = await fetchCountryLayerFile(country.slug, request);
  for (const [alias, payload] of fetched) {
    country.files.set(alias, payload);
  }

  for (const alias of request?.aliases ?? []) {
    const existing = country.files.get(alias);
    if (existing && isFeatureCollection(existing)) return existing;
  }

  return null;
}

function combineLayerFromCatalogs(
  catalogs: RuntimeCountryCatalog[],
  layerId: SupportedLayerId,
  collections: Array<FeatureCollection | null>,
): FeatureCollection {
  const features = catalogs.flatMap((country, countryIndex) =>
    (collections[countryIndex]?.features ?? []).map((feature, index) => {
      const properties = { ...(feature.properties ?? {}) };
      const baseId =
        asString(properties.feature_id) ||
        asString(properties.osm_id) ||
        asString(properties.id) ||
        `${country.slug}-${layerId}-${index}`;
      properties.feature_id = `${country.slug}:${baseId}`;
      properties.country_slug = country.slug;
      properties.country_name = asString(country.manifest.run?.zone, country.title ?? country.slug);
      return {
        ...feature,
        properties,
      };
    }),
  );
  return { type: "FeatureCollection", features };
}

export async function loadCombinedLayer(
  layerId: Exclude<SupportedLayerId, "admin_priority">,
): Promise<FeatureCollection> {
  const cached = combinedLayerCache.get(layerId);
  if (cached) return cached;

  if (!catalogCache?.length) {
    throw new Error("Le catalogue OHM n'est pas encore chargé.");
  }

  const collections = await Promise.all(
    catalogCache.map((country) => resolveCountryLayer(country, layerId)),
  );
  const combined = combineLayerFromCatalogs(catalogCache, layerId, collections);
  combinedLayerCache.set(layerId, combined);
  console.info("[OHM] Couche chargée à la demande", {
    layerId,
    features: combined.features.length,
  });
  return combined;
}

export async function loadCountryLayer(
  slug: string,
  layerId: Exclude<SupportedLayerId, "admin_priority">,
): Promise<FeatureCollection | null> {
  if (!catalogCache?.length) {
    throw new Error("Le catalogue OHM n'est pas encore charge.");
  }

  const country = catalogCache.find((item) => item.slug === slug);
  if (!country) return null;

  const collection = await resolveCountryLayer(country, layerId);
  if (!collection) return null;

  return {
    type: "FeatureCollection",
    features: collection.features.map((feature, index) => {
      const properties = { ...(feature.properties ?? {}) };
      const baseId =
        asString(properties.feature_id) ||
        asString(properties.osm_id) ||
        asString(properties.id) ||
        `${country.slug}-${layerId}-${index}`;
      properties.feature_id = `${country.slug}:${baseId}`;
      properties.country_slug = country.slug;
      properties.country_name = asString(country.manifest.run?.zone, country.title ?? country.slug);
      return {
        ...feature,
        properties,
      };
    }),
  };
}

export async function loadCombinedDataset(): Promise<MapDataset> {
  const entries = sortDatasetEntries(await fetchDatasetIndex());
  if (!entries.length) {
    throw new Error("Aucun dataset pays trouvé dans public/data.");
  }
  console.info(
    "[OHM] Dataset index",
    entries.map((entry) => entry.slug),
  );
  const results = await Promise.allSettled(
    entries.map((entry) => buildCountryCatalog(entry)),
  );
  const catalogs = results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      console.info("[OHM] Dataset chargé", {
        slug: result.value.slug,
        title: result.value.title,
      });
      return [result.value];
    }
    console.warn(
      `[OHM] Dataset ignoré: ${entries[index]?.slug ?? "unknown"}`,
      result.reason,
    );
    return [];
  });
  catalogCache = catalogs;
  combinedLayerCache.clear();
  const datasets = catalogs.map((catalog) => {
    const dataset = buildDataset(catalog);
    console.info("[OHM] Dataset admin chargé", {
      slug: dataset.slug,
      title: dataset.title,
      adminFeatures: dataset.admin.features.length,
    });
    return dataset;
  });

  if (!datasets.length) {
    throw new Error(
      `Aucun dataset pays chargeable depuis ${DATA_INDEX_URL}. Vérifie les slugs et fichiers current.* dans le stockage.`,
    );
  }

  const combined = buildCombinedDatasetFromParts(datasets);
  console.info("[OHM] Dataset combiné", {
    countries: datasets.map((dataset) => dataset.slug),
    adminFeatures: combined.admin.features.length,
  });
  return combined;
}

export async function loadCombinedDatasetProgressive(
  onPartialDataset: (dataset: MapDataset) => void,
): Promise<MapDataset> {
  const entries = sortDatasetEntries(await fetchDatasetIndex());
  if (!entries.length) {
    throw new Error("Aucun dataset pays trouvé dans public/data.");
  }

  const catalogs: RuntimeCountryCatalog[] = [];
  const datasets: MapDataset[] = [];
  catalogCache = catalogs;
  combinedLayerCache.clear();

  const manifestQueue = entries.slice();
  const manifestWorkers = Array.from(
    { length: Math.min(ADMIN_LOAD_CONCURRENCY, manifestQueue.length) },
    async () => {
      while (manifestQueue.length) {
        const entry = manifestQueue.shift();
        if (!entry) return;

        try {
          const catalog = await buildCountryCatalog(entry);
          const dataset = buildDataset(catalog);
          catalogs.push(catalog);
          datasets.push(dataset);
          catalogCache = catalogs.slice();
          onPartialDataset(buildCombinedDatasetFromParts([...datasets]));
        } catch (error) {
          console.warn(`[OHM] Dataset ignoré: ${entry.slug}`, error);
        }
      }
    },
  );

  const results = await Promise.allSettled(manifestWorkers);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(
        `[OHM] Worker dataset interrompu: ${entries[index]?.slug ?? "unknown"}`,
        result.reason,
      );
    }
  });

  if (!datasets.length) {
    throw new Error(
      `Aucun dataset pays chargeable depuis ${DATA_INDEX_URL}. Vérifie les slugs et fichiers current.* dans le stockage.`,
    );
  }

  const initialCombined = buildCombinedDatasetFromParts(datasets);
  return initialCombined;

  const hydrationQueue = catalogs.slice();
  const hydrationWorkers = Array.from(
    { length: Math.min(3, hydrationQueue.length) },
    async () => {
      while (hydrationQueue.length) {
        const country = hydrationQueue.shift();
        if (!country) return;

        try {
          await hydrateCountryAdmin(country);
          const refreshedDatasets = catalogs.map((catalog) => buildDataset(catalog));
          datasets.splice(0, datasets.length, ...refreshedDatasets);
          catalogCache = catalogs.slice();
          onPartialDataset(buildCombinedDatasetFromParts(refreshedDatasets));
        } catch (error) {
          console.warn(`[OHM] Hydratation admin ignorée: ${country.slug}`, error);
        }
      }
    },
  );

  await Promise.allSettled(hydrationWorkers);

  const combined = buildCombinedDatasetFromParts(datasets);
  return combined;
}

export async function hydrateAdminForCountry(slug: string): Promise<MapDataset | null> {
  if (!catalogCache?.length) return null;

  const country = catalogCache.find((item) => item.slug === slug);
  if (!country) return null;

  if (!isCountryAdminHydrated(country)) {
    await hydrateCountryAdmin(country);
  }

  return buildCombinedDatasetFromParts(catalogCache.map((catalog) => buildDataset(catalog)));
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

export function getIpcCountrySummary(
  dataset: MapDataset,
  year: number | null,
): IpcCountrySummary[] {
  const countries = new Map<string, IpcCountrySummary>();

  for (const feature of dataset.admin.features) {
    const props = feature.properties ?? {};
    const entries = timelineEntriesFromFeature(feature);
    const fallbackYear = Math.max(
      -Infinity,
      ...entries
        .map((item) => item.year)
        .filter((itemYear): itemYear is number => typeof itemYear === "number" && Number.isFinite(itemYear)),
    );
    const targetYear = year ?? (Number.isFinite(fallbackYear) ? fallbackYear : null);
    if (targetYear === null) continue;
    const entry = pickTimelineEntryForYear(entries, targetYear);
    if (!entry) continue;

    const countryName = asString(props.country_name || props.adm0_name, "Zone");
    const countryKey = asString(props.country_slug || props.adm0_name || countryName, countryName);
    const current =
      countries.get(countryKey) ??
      {
        countryKey,
        countryName,
        year,
        latestYear: null,
        population: 0,
        phase1: 0,
        phase2: 0,
        phase3: 0,
        phase4: 0,
        phase5: 0,
        phase3plus: 0,
        phase4plus: 0,
        phase3plusShare: null,
        phase4plusShare: null,
      };

    current.latestYear =
      entry.year !== null && Number.isFinite(entry.year)
        ? Math.max(current.latestYear ?? -Infinity, entry.year)
        : current.latestYear;
    current.population += entry.population ?? 0;
    current.phase1 += entry.phase1 ?? 0;
    current.phase2 += entry.phase2 ?? 0;
    current.phase3 += entry.phase3 ?? 0;
    current.phase4 += entry.phase4 ?? 0;
    current.phase5 += entry.phase5 ?? 0;
    current.phase3plus += entry.p3plus ?? (entry.phase3 ?? 0) + (entry.phase4 ?? 0) + (entry.phase5 ?? 0);
    current.phase4plus += (entry.phase4 ?? 0) + (entry.phase5 ?? 0);

    countries.set(countryKey, current);
  }

  return Array.from(countries.values())
    .map((item) => ({
      ...item,
      latestYear: item.latestYear !== null && Number.isFinite(item.latestYear) ? item.latestYear : null,
      phase3plusShare: item.population > 0 ? item.phase3plus / item.population : null,
      phase4plusShare: item.population > 0 ? item.phase4plus / item.population : null,
    }))
    .sort((left, right) => right.phase3plus - left.phase3plus);
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
  if (year === null || !dataset.admin.features.length) return dataset;

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

import type { FeatureCollection } from "geojson";

export type ManifestLayer = {
  id?: string;
  type?: string;
  path?: string;
  label?: string;
  visible_by_default?: boolean;
  zoom?: { min?: number | null; max?: number | null } | null;
};

export type ManifestLegendItem = {
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

export type ManifestSummary = {
  feature_count?: number;
  score_100_mean?: number;
  people_p3plus_total?: number;
  osm_counts?: Record<string, number>;
  pipeline_log?: string[];
  top_regions?: Array<Record<string, unknown>>;
  data_quality?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ManifestLike = {
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
  phase1: number | null;
  phase2: number | null;
  phase3: number | null;
  phase4: number | null;
  phase5: number | null;
  p3plus: number | null;
  population: number | null;
  shareP3Plus: number | null;
};

export type IpcCountrySummary = {
  countryKey: string;
  countryName: string;
  year: number | null;
  latestYear: number | null;
  population: number;
  phase1: number;
  phase2: number;
  phase3: number;
  phase4: number;
  phase5: number;
  phase3plus: number;
  phase4plus: number;
  phase3plusShare: number | null;
  phase4plusShare: number | null;
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

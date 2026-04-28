import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";
import type { StyleSpecification } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import type { MapDataset, RegionRecord } from "~/data/datasets";
import { useI18n } from "~/i18n/use-i18n";
import {
  featureName,
  formatCompactNumber,
  formatScore100,
  getFeatureBounds,
  priorityColor,
  safeNumber,
  toPointCoordinates,
} from "~/utils";

export type BasemapId = "voyager" | "dark-matter" | "satellite";
export type ViewMode = "flat" | "urban-3d";

type SelectionDetail =
  | {
      kind: "region";
      id: string;
      title: string;
      badges: [string, string];
      accent: "amber";
    }
  | {
      kind: "osm";
      id: string;
      title: string;
      badges: [string, string?];
      accent: "blue" | "slate" | "green";
    };

type TooltipPosition = {
  x: number;
  y: number;
};

type PointRecord = {
  id: string;
  label: string;
  line1: string;
  line2: string;
  coordinates: [number, number];
};

type CountryLabelRecord = {
  id: string;
  label: string;
  coordinates: [number, number];
};

type MapViewProps = {
  dataset: MapDataset;
  showWater: boolean;
  showSettlements: boolean;
  showRoads: boolean;
  basemapId: BasemapId;
  viewMode: ViewMode;
  droneMode: boolean;
  selectedRegionId?: string | null;
  contributionMode?: boolean;
  contributions?: FeatureCollection;
  pendingContributionCoordinate?: [number, number] | null;
  onMapClick?: (coordinate: [number, number]) => void;
  onRegionHover?: (region: RegionRecord | null) => void;
  onRegionSelect?: (region: RegionRecord | null) => void;
};

const INITIAL_CENTER: [number, number] = [-14.7, 14.5];
const INITIAL_ZOOM = 4.55;

function adminFillAlpha(droneMode: boolean) {
  return droneMode ? 52 : 146;
}

function adminBorderColor(
  isSelected: boolean,
  droneMode: boolean,
): [number, number, number, number] {
  if (isSelected) return [255, 255, 255, droneMode ? 230 : 255];
  // More visible and sharper for admin boundaries
  return droneMode ? [100, 105, 120, 130] : [110, 115, 130, 210];
}

function roadLineColor(droneMode: boolean): [number, number, number, number] {
  // Softer and more contextual for roads
  return droneMode ? [120, 120, 125, 90] : [130, 130, 135, 110];
}

function osmPointAlpha(droneMode: boolean, baseAlpha: number) {
  return droneMode ? Math.max(70, Math.round(baseAlpha * 0.55)) : baseAlpha;
}

function contributionColor(type: unknown): [number, number, number, number] {
  if (type === "water") return [45, 140, 255, 230];
  if (type === "road" || type === "access") return [240, 193, 112, 230];
  if (type === "ngo_presence") return [139, 215, 166, 230];
  if (type === "alert") return [248, 92, 92, 235];
  return [160, 180, 195, 220];
}

export const BASEMAPS: Array<{
  id: BasemapId;
  label: string;
  description: string;
  style: string | StyleSpecification;
}> = [
  {
    id: "voyager",
    label: "Voyager",
    description: "Fond clair, bon pour la lecture régionale",
    style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  },
  {
    id: "dark-matter",
    label: "Dark",
    description: "Contraste fort pour les couches opérationnelles",
    style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  },
  {
    id: "satellite",
    label: "Satellite",
    description: "Fond image pour vérification terrain",
    style: {
      version: 8,
      sources: {
        satellite: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Tiles © Esri",
        },
      },
      layers: [{ id: "satellite", type: "raster", source: "satellite" }],
    } as StyleSpecification,
  },
];

function buildRegionRecord(
  feature: Feature<Geometry, GeoJsonProperties>,
  fallbackReason: string,
): RegionRecord {
  const props = feature.properties ?? {};
  return {
    id: String(
      props.feature_id ?? props.adm2_pcode ?? props.adm1_pcode ?? featureName(props),
    ),
    name: featureName(props),
    adm1Name: typeof props.adm1_name === "string" ? props.adm1_name : "n/a",
    priorityScore: safeNumber(props.priority_score ?? props.score),
    score100: safeNumber(props.score_100),
    priorityLabel:
      typeof props.priority_label === "string"
        ? props.priority_label
        : typeof props.status === "string"
          ? props.status
          : "n/a",
    decisionReason:
      typeof props.decision_reason === "string" ? props.decision_reason : fallbackReason,
    ipcPhase: safeNumber(props.ipc_phase_dominant),
    ipcPeopleP3Plus: safeNumber(props.ipc_people_p3plus),
    ipcPopulationTotal: safeNumber(props.ipc_population_total),
    ipcShareP3Plus: safeNumber(props.ipc_share_p3plus),
  };
}

function featureRecordIndex(
  collection: FeatureCollection,
  fallbackReason: string,
): Map<string, RegionRecord> {
  return new Map(
    collection.features.map((feature) => {
      const record = buildRegionRecord(feature, fallbackReason);
      return [record.id, record];
    }),
  );
}

function downsampleFeatures(
  features: Feature<Geometry, GeoJsonProperties>[],
  maxPoints: number,
) {
  if (features.length <= maxPoints) return features;
  const step = Math.max(1, Math.round(features.length / maxPoints));
  return features.filter((_, index) => index % step === 0).slice(0, maxPoints);
}

function pointLabel(feature: Feature<Geometry, GeoJsonProperties>, fallback: string) {
  const props = feature.properties ?? {};
  const candidates = [
    typeof props.name === "string" ? props.name : "",
    typeof props.amenity === "string" ? props.amenity : "",
    typeof props.place === "string" ? props.place : "",
    fallback,
  ];
  return candidates.find((value) => value.trim()) ?? fallback;
}

function pointRecords(collection: FeatureCollection | undefined, fallback: string): PointRecord[] {
  if (!collection) return [];
  return collection.features.map((feature, index) => ({
    id: `${fallback}-${index}`,
    label: pointLabel(feature, fallback),
    line1:
      typeof feature.properties?.amenity === "string"
        ? feature.properties.amenity
        : fallback,
    line2: "",
    coordinates: toPointCoordinates(feature),
  }));
}

function mapBounds(collection: FeatureCollection): [[number, number], [number, number]] {
  const bounds = {
    minLng: Number.POSITIVE_INFINITY,
    minLat: Number.POSITIVE_INFINITY,
    maxLng: Number.NEGATIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
  };

  for (const feature of collection.features) {
    const [southWest, northEast] = getFeatureBounds(feature);
    bounds.minLng = Math.min(bounds.minLng, southWest[0]);
    bounds.minLat = Math.min(bounds.minLat, southWest[1]);
    bounds.maxLng = Math.max(bounds.maxLng, northEast[0]);
    bounds.maxLat = Math.max(bounds.maxLat, northEast[1]);
  }

  if (!Number.isFinite(bounds.minLng)) {
    return [[-18.2, 12.0], [-11.2, 16.9]];
  }

  return [
    [bounds.minLng, bounds.minLat],
    [bounds.maxLng, bounds.maxLat],
  ];
}

function countryLabelRecords(collection: FeatureCollection): CountryLabelRecord[] {
  const grouped = new Map<
    string,
    { label: string; minLng: number; minLat: number; maxLng: number; maxLat: number }
  >();

  for (const feature of collection.features) {
    const props = feature.properties ?? {};
    const key =
      (typeof props.country_slug === "string" && props.country_slug) ||
      (typeof props.adm0_name === "string" && props.adm0_name) ||
      "country";
    const label =
      (typeof props.country_name === "string" && props.country_name) ||
      (typeof props.adm0_name === "string" && props.adm0_name) ||
      key;
    const [[minLng, minLat], [maxLng, maxLat]] = getFeatureBounds(feature);
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { label, minLng, minLat, maxLng, maxLat });
      continue;
    }
    current.minLng = Math.min(current.minLng, minLng);
    current.minLat = Math.min(current.minLat, minLat);
    current.maxLng = Math.max(current.maxLng, maxLng);
    current.maxLat = Math.max(current.maxLat, maxLat);
  }

  return Array.from(grouped.entries()).map(([key, value]) => ({
    id: key,
    label: value.label,
    coordinates: [
      (value.minLng + value.maxLng) / 2,
      (value.minLat + value.maxLat) / 2,
    ],
  }));
}

function tintByCountry(
  color: [number, number, number, number],
  countrySlug: unknown,
): [number, number, number, number] {
  const slug = typeof countrySlug === "string" ? countrySlug : "";
  if (slug === "gambie" || slug === "gambia") {
    return [
      Math.min(255, color[0] + 10),
      Math.max(0, color[1] - 8),
      Math.max(0, color[2] - 8),
      color[3],
    ];
  }
  if (slug === "senegal") {
    return [
      Math.max(0, color[0] - 2),
      Math.min(255, color[1] + 3),
      Math.max(0, color[2] - 2),
      color[3],
    ];
  }
  return color;
}

function findLabelLayerId(map: any): string | null {
  const styleLayers = map?.getStyle?.()?.layers;
  if (!Array.isArray(styleLayers)) return null;

  const firstSymbolLayer = styleLayers.find((layer: any) => layer?.type === "symbol");
  return firstSymbolLayer?.id ?? null;
}

function tuneBasemapLabels(map: any, basemapId: BasemapId) {
  const styleLayers = map?.getStyle?.()?.layers;
  if (!Array.isArray(styleLayers)) return;

  const isDark = basemapId === "dark-matter";
  const textColor = isDark ? "#ffffff" : "#1a1a1a";
  const haloColor = isDark ? "#000000" : "#ffffff";

  for (const layer of styleLayers) {
    if (layer?.type !== "symbol" || !layer?.layout?.["text-field"]) continue;

    try {
      map.setPaintProperty(layer.id, "text-color", textColor);
      map.setPaintProperty(layer.id, "text-halo-color", haloColor);
      map.setPaintProperty(layer.id, "text-halo-width", 1.4);
      map.setPaintProperty(layer.id, "text-halo-blur", 0.2);
    } catch { }
  }
}

function removeBuildingsLayer(map: any) {
  try {
    if (map.getLayer("ohm-3d-buildings")) {
      map.removeLayer("ohm-3d-buildings");
    }
  } catch {
    // ignore cleanup errors
  }
}

function ensureBuildingsLayer(map: any, beforeId?: string | null) {
  removeBuildingsLayer(map);
  const style = map?.getStyle?.();
  const sources = style?.sources ?? {};
  const vectorSourceIds = Object.entries(sources)
    .filter(([, source]: any) => source?.type === "vector")
    .map(([sourceId]) => sourceId);

  for (const sourceId of vectorSourceIds) {
    for (const sourceLayer of ["building", "buildings"]) {
      try {
        map.addLayer(
          {
            id: "ohm-3d-buildings",
            type: "fill-extrusion",
            source: sourceId,
            "source-layer": sourceLayer,
            minzoom: 14,
            paint: {
              "fill-extrusion-color": [
                "interpolate",
                ["linear"],
                ["zoom"],
                14,
                "#b08b62",
                17,
                "#8f6e4d",
              ],
              "fill-extrusion-height": [
                "coalesce",
                ["get", "render_height"],
                ["get", "height"],
                8,
              ],
              "fill-extrusion-base": [
                "coalesce",
                ["get", "render_min_height"],
                ["get", "min_height"],
                0,
              ],
              "fill-extrusion-opacity": 0.86,
            },
          },
          beforeId ?? undefined,
        );
        return true;
      } catch {
        // try next source/source-layer candidate
      }
    }
  }

  return false;
}

export function MapView({
  dataset,
  showWater,
  showSettlements,
  showRoads,
  basemapId,
  viewMode,
  droneMode,
  selectedRegionId = null,
  contributionMode = false,
  contributions,
  pendingContributionCoordinate = null,
  onMapClick,
  onRegionHover,
  onRegionSelect,
}: MapViewProps) {
  const { t } = useI18n();
  const mapRootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlayRef = useRef<any>(null);
  const basemapStyleRef = useRef<string | StyleSpecification | null>(null);
  const contributionModeRef = useRef(contributionMode);
  const onMapClickRef = useRef(onMapClick);

  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [detail, setDetail] = useState<SelectionDetail | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [labelLayerId, setLabelLayerId] = useState<string | null>(null);

  const regionFallbackReason = t("demo.defaultReason");
  const regionIndex = useMemo(
    () => featureRecordIndex(dataset.admin, regionFallbackReason),
    [dataset.admin, regionFallbackReason],
  );
  const currentBasemap = useMemo(
    () => BASEMAPS.find((item) => item.id === basemapId) ?? BASEMAPS[0],
    [basemapId],
  );
  const initialBasemapStyleRef = useRef<string | StyleSpecification>(currentBasemap.style);

  const waterLabel = t("demo.water");
  const settlementsLabel = t("demo.settlements");
  const waterPoints = useMemo(
    () => pointRecords(dataset.layers.osm_water, waterLabel),
    [dataset.layers.osm_water, waterLabel],
  );
  const settlementPoints = useMemo(
    () => pointRecords(dataset.layers.osm_settlements, settlementsLabel),
    [dataset.layers.osm_settlements, settlementsLabel],
  );
  const waterOverviewRecords = useMemo(
    () =>
      pointRecords(
        {
          type: "FeatureCollection",
          features: downsampleFeatures(dataset.layers.osm_water?.features ?? [], 110),
        },
        waterLabel,
      ),
    [dataset.layers.osm_water, waterLabel],
  );
  const settlementOverviewRecords = useMemo(
    () =>
      pointRecords(
        {
          type: "FeatureCollection",
          features: downsampleFeatures(
            dataset.layers.osm_settlements?.features ?? [],
            150,
          ),
        },
        settlementsLabel,
      ),
    [dataset.layers.osm_settlements, settlementsLabel],
  );
  const countryLabels = useMemo(() => countryLabelRecords(dataset.admin), [dataset.admin]);

  useEffect(() => {
    contributionModeRef.current = contributionMode;
    onMapClickRef.current = onMapClick;
  }, [contributionMode, onMapClick]);

  const layers = useMemo(() => {
    const layers: any[] = [
      new GeoJsonLayer({
        id: "admin-priority",
        data: dataset.admin,
        pickable: true,
        stroked: true,
        filled: true,
        lineWidthMinPixels: 1,
        getLineWidth: (feature: Feature<Geometry, GeoJsonProperties>) =>
          feature.properties?.feature_id === selectedRegionId
            ? droneMode
              ? 2.6
              : 3.6
            : droneMode
              ? 0.7
              : 1.0,
        getLineColor: (feature: Feature<Geometry, GeoJsonProperties>) =>
          adminBorderColor(feature.properties?.feature_id === selectedRegionId, droneMode),
        getFillColor: (feature: Feature<Geometry, GeoJsonProperties>) =>
          tintByCountry(
            priorityColor(
              feature.properties?.priority_score ?? feature.properties?.score,
              adminFillAlpha(droneMode),
            ),
            feature.properties?.country_slug ?? feature.properties?.adm0_name,
          ),
        updateTriggers: {
          getFillColor: [selectedRegionId, droneMode],
          getLineWidth: [selectedRegionId, droneMode],
          getLineColor: [selectedRegionId, droneMode],
        },
        beforeId: labelLayerId ?? undefined,
        autoHighlight: false,
        onHover: ({
          object,
          x,
          y,
        }: {
          object?: Feature<Geometry, GeoJsonProperties> | null;
          x: number;
          y: number;
        }) => {
          if (!object) {
            onRegionHover?.(null);
            setDetail(null);
            setTooltipPosition(null);
            return;
          }
          const record = buildRegionRecord(object, regionFallbackReason);
          onRegionHover?.(record);
          setDetail({
            kind: "region",
            id: record.id,
            title: record.name,
            badges: [
              t("demo.mapTooltipLineRegion", {
                score: formatScore100(record.score100),
                phase: record.ipcPhase ?? "n/a",
              }),
              t("demo.mapTooltipLineRegion2", {
                p3: formatCompactNumber(record.ipcPeopleP3Plus),
                population: formatCompactNumber(record.ipcPopulationTotal),
              }),
            ],
            accent: "amber",
          });
          setTooltipPosition({ x, y });
        },
        onClick: ({ object }: { object?: Feature<Geometry, GeoJsonProperties> | null }) => {
          if (contributionMode) return;
          if (!object) return;
          const record = buildRegionRecord(object, regionFallbackReason);
          onRegionSelect?.(record);
          mapRef.current?.fitBounds(getFeatureBounds(object), {
            padding: { top: 60, bottom: 60, left: 60, right: 60 },
            duration: 600,
            maxZoom: 9.2,
          });
        },
      }),
    ];


    if (showRoads && dataset.layers.osm_roads) {
      layers.push(
        new GeoJsonLayer({
          id: "osm-roads",
          data: dataset.layers.osm_roads,
          pickable: false,
          stroked: true,
          filled: false,
          lineWidthMinPixels: 1,
          getLineWidth: zoom >= 9 ? (droneMode ? 1.5 : 2.2) : droneMode ? 0.6 : 0.9,
          getLineColor: roadLineColor(droneMode),
          updateTriggers: { getLineWidth: [zoom, droneMode], getLineColor: [droneMode] },
          beforeId: labelLayerId ?? undefined,
          autoHighlight: false,
        }),
      );
    }

    if (showWater) {
      layers.push(
        new ScatterplotLayer({
          id: "osm-water-overview",
          data: waterOverviewRecords,
          pickable: true,
          minZoom: 0,
          maxZoom: 7.15,
          getPosition: (item: PointRecord) => item.coordinates,
          getFillColor: [45, 140, 255, osmPointAlpha(droneMode, 200)],
          getLineColor: [255, 255, 255, osmPointAlpha(droneMode, 220)],
          stroked: true,
          filled: true,
          radiusScale: 6,
          radiusMinPixels: 4,
          radiusMaxPixels: 7,
          getRadius: 70,
          beforeId: labelLayerId ?? undefined,
          parameters: { depthTest: false },
          updateTriggers: { getFillColor: [droneMode], getLineColor: [droneMode] },
          autoHighlight: false,
          onHover: ({
            object,
            x,
            y,
          }: {
            object?: PointRecord | null;
            x: number;
            y: number;
          }) => {
            if (!object) {
              setDetail(null);
              setTooltipPosition(null);
              return;
            }
            setDetail({
              kind: "osm",
              id: object.id,
              title: object.label,
              badges: [object.line1, object.line2 || undefined],
              accent: "blue",
            });
            setTooltipPosition({ x, y });
          },
        }),
      );
      layers.push(
        new ScatterplotLayer({
          id: "osm-water-detail",
          data: waterPoints,
          pickable: true,
          minZoom: 7.15,
          getPosition: (item: PointRecord) => item.coordinates,
          getFillColor: [45, 140, 255, osmPointAlpha(droneMode, 220)],
          getLineColor: [255, 255, 255, osmPointAlpha(droneMode, 235)],
          stroked: true,
          filled: true,
          radiusScale: 6.5,
          radiusMinPixels: 5,
          radiusMaxPixels: 9,
          getRadius: 82,
          beforeId: labelLayerId ?? undefined,
          parameters: { depthTest: false },
          updateTriggers: { getFillColor: [droneMode], getLineColor: [droneMode] },
          autoHighlight: false,
          onHover: ({
            object,
            x,
            y,
          }: {
            object?: PointRecord | null;
            x: number;
            y: number;
          }) => {
            if (!object) {
              setDetail(null);
              setTooltipPosition(null);
              return;
            }
            setDetail({
              kind: "osm",
              id: object.id,
              title: object.label,
              badges: [object.line1, object.line2 || undefined],
              accent: "blue",
            });
            setTooltipPosition({ x, y });
          },
        }),
      );
    }

    if (showSettlements) {
      layers.push(
        new ScatterplotLayer({
          id: "osm-settlements-overview",
          data: settlementOverviewRecords,
          pickable: true,
          minZoom: 0,
          maxZoom: 7.15,
          getPosition: (item: PointRecord) => item.coordinates,
          getFillColor: [35, 35, 35, osmPointAlpha(droneMode, 176)],
          getLineColor: [255, 255, 255, osmPointAlpha(droneMode, 160)],
          stroked: true,
          filled: true,
          radiusScale: 6,
          radiusMinPixels: 2.5,
          radiusMaxPixels: 6,
          getRadius: 80,
          beforeId: labelLayerId ?? undefined,
          parameters: { depthTest: false },
          updateTriggers: { getFillColor: [droneMode], getLineColor: [droneMode] },
          autoHighlight: false,
          onHover: ({
            object,
            x,
            y,
          }: {
            object?: PointRecord | null;
            x: number;
            y: number;
          }) => {
            if (!object) {
              setDetail(null);
              setTooltipPosition(null);
              return;
            }
            setDetail({
              kind: "osm",
              id: object.id,
              title: object.label,
              badges: [settlementsLabel],
              accent: "slate",
            });
            setTooltipPosition({ x, y });
          },
        }),
      );
      layers.push(
        new ScatterplotLayer({
          id: "osm-settlements-detail",
          data: settlementPoints,
          pickable: true,
          minZoom: 7.15,
          getPosition: (item: PointRecord) => item.coordinates,
          getFillColor: [35, 35, 35, osmPointAlpha(droneMode, 180)],
          getLineColor: [255, 255, 255, osmPointAlpha(droneMode, 160)],
          stroked: true,
          filled: true,
          radiusScale: 7,
          radiusMinPixels: 3,
          radiusMaxPixels: 8,
          getRadius: 90,
          beforeId: labelLayerId ?? undefined,
          parameters: { depthTest: false },
          updateTriggers: { getFillColor: [droneMode], getLineColor: [droneMode] },
          autoHighlight: false,
          onHover: ({
            object,
            x,
            y,
          }: {
            object?: PointRecord | null;
            x: number;
            y: number;
          }) => {
            if (!object) {
              setDetail(null);
              setTooltipPosition(null);
              return;
            }
            setDetail({
              kind: "osm",
              id: object.id,
              title: object.label,
              badges: [settlementsLabel],
              accent: "slate",
            });
            setTooltipPosition({ x, y });
          },
        }),
      );
    }

    if (contributions) {
      layers.push(
        new GeoJsonLayer({
          id: "field-contributions",
          data: contributions,
          pickable: true,
          stroked: true,
          filled: true,
          pointRadiusMinPixels: 6,
          pointRadiusMaxPixels: 12,
          pointRadiusScale: 8,
          getPointRadius: 70,
          getFillColor: (feature: Feature<Geometry, GeoJsonProperties>) =>
            contributionColor(feature.properties?.type),
          getLineColor: [255, 255, 255, 235],
          lineWidthMinPixels: 1,
          parameters: { depthTest: false },
          beforeId: labelLayerId ?? undefined,
          autoHighlight: false,
          onHover: ({
            object,
            x,
            y,
          }: {
            object?: Feature<Geometry, GeoJsonProperties> | null;
            x: number;
            y: number;
          }) => {
            if (!object) {
              setDetail(null);
              setTooltipPosition(null);
              return;
            }
            setDetail({
              kind: "osm",
              id: String(object.properties?.id ?? "contribution"),
              title: "Contribution terrain",
              badges: [
                String(object.properties?.type ?? "terrain"),
                String(object.properties?.value ?? "validated"),
              ],
              accent: "green",
            });
            setTooltipPosition({ x, y });
          },
        }),
      );
    }

    if (pendingContributionCoordinate) {
      layers.push(
        new ScatterplotLayer({
          id: "pending-field-contribution",
          data: [pendingContributionCoordinate],
          pickable: false,
          getPosition: (item: [number, number]) => item,
          getFillColor: [240, 193, 112, 230],
          getLineColor: [255, 255, 255, 255],
          stroked: true,
          filled: true,
          radiusScale: 8,
          radiusMinPixels: 8,
          radiusMaxPixels: 14,
          getRadius: 85,
          parameters: { depthTest: false },
          beforeId: labelLayerId ?? undefined,
        }),
      );
    }

    return layers;
  }, [
    contributions,
    contributionMode,
    dataset.admin,
    dataset.layers.osm_roads,
    pendingContributionCoordinate,
    regionFallbackReason,
    selectedRegionId,
    settlementsLabel,
    settlementOverviewRecords,
    settlementPoints,
    showRoads,
    showSettlements,
    showWater,
    countryLabels,
    droneMode,
    labelLayerId,
    t,
    waterLabel,
    waterOverviewRecords,
    waterPoints,
    zoom,
    onRegionHover,
    onRegionSelect,
  ]);

  useEffect(() => {
    if (!mapRootRef.current || typeof window === "undefined") return;
    let mounted = true;

    const run = async () => {
      const [{ default: maplibregl }, { MapboxOverlay }] = await Promise.all([
        import("maplibre-gl"),
        import("@deck.gl/mapbox"),
      ]);

      if (!mounted || !mapRootRef.current) return;

      const map = new maplibregl.Map({
        container: mapRootRef.current,
        style: initialBasemapStyleRef.current,
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        minZoom: 3,
        maxZoom: 19,
        pitch: 0,
      });

      mapRef.current = map;
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );

      const overlay = new MapboxOverlay({ interleaved: true, layers });
      overlayRef.current = overlay;
      map.addControl(overlay);
      basemapStyleRef.current = currentBasemap.style;

      const sync = () => setZoom(map.getZoom());

      const bindStyleState = () => {
        const nextLabelLayerId = findLabelLayerId(map);
        setLabelLayerId((current) =>
          current === nextLabelLayerId ? current : nextLabelLayerId,
        );
        tuneBasemapLabels(map, basemapId);
        if (viewMode === "urban-3d") {
          ensureBuildingsLayer(map, nextLabelLayerId);
        } else {
          removeBuildingsLayer(map);
        }
        overlay.setProps({ layers });
      };

      map.on("load", () => {
        bindStyleState();
        map.fitBounds(mapBounds(dataset.admin), {
          padding: { top: 120, bottom: 120, left: 120, right: 120 },
          duration: 0,
          maxZoom: 5.2,
        });
        sync();
        setIsMapReady(true);
      });

      map.on("styledata", () => {
        // Use a much lighter sync for style data to avoid loops
        const nextLabelLayerId = findLabelLayerId(map);
        setLabelLayerId((current) =>
          current === nextLabelLayerId ? current : nextLabelLayerId,
        );
        // We only tune labels if they aren't already tuned? 
        // Actually, we'll just be careful not to trigger infinite loops.
        // Moving tuneBasemapLabels out of here for now, or making it smarter.
      });

      // Style load is the best place to re-apply our custom tuning
      map.on("style.load", bindStyleState);

      map.on("zoomend", sync);
      map.on("click", (event: any) => {
        if (!contributionModeRef.current) return;
        onMapClickRef.current?.([event.lngLat.lng, event.lngLat.lat]);
      });
    };

    void run();

    return () => {
      mounted = false;
      overlayRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    overlayRef.current?.setProps({ layers });
  }, [layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (basemapStyleRef.current === currentBasemap.style) return;

    basemapStyleRef.current = currentBasemap.style;
    map.setStyle(currentBasemap.style);
  }, [currentBasemap.style]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (viewMode === "urban-3d") {
      ensureBuildingsLayer(map, labelLayerId);
    } else {
      removeBuildingsLayer(map);
    }

    map.easeTo({
      pitch: droneMode ? 70 : viewMode === "urban-3d" ? 58 : 0,
      bearing: droneMode ? -22 : viewMode === "urban-3d" ? -14 : 0,
      zoom:
        viewMode === "urban-3d"
          ? Math.max(map.getZoom(), droneMode ? 15.8 : 15.2)
          : map.getZoom(),
      duration: 900,
    });
  }, [viewMode, droneMode, labelLayerId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedRegionId) return;
    const feature = dataset.admin.features.find(
      (item) => item.properties?.feature_id === selectedRegionId,
    );
    if (!feature) return;

    map.fitBounds(getFeatureBounds(feature), {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      duration: 550,
      maxZoom: 9.2,
    });
    const record = regionIndex.get(selectedRegionId);
    if (record) {
      setDetail({
        kind: "region",
        id: record.id,
        title: record.name,
        badges: [
          t("demo.mapTooltipLineRegion", {
            score: formatScore100(record.score100),
            phase: record.ipcPhase ?? "n/a",
          }),
          t("demo.mapTooltipLineRegion2", {
            p3: formatCompactNumber(record.ipcPeopleP3Plus),
            population: formatCompactNumber(record.ipcPopulationTotal),
          }),
        ],
        accent: "amber",
      });
      setTooltipPosition(null);
    }
  }, [dataset.admin.features, regionIndex, selectedRegionId, t]);

  return (
    <div className="map-shell relative h-full w-full overflow-hidden bg-[#081119]">
      <div id="map-root" ref={mapRootRef} className="h-full w-full" />

      {!isMapReady ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(24,40,56,0.92),rgba(8,17,26,0.98))]">
          <div className="flex max-w-[320px] flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-center text-[#eef4fa] shadow-[0_24px_80px_rgba(2,6,12,0.36)] backdrop-blur-md">
            <div className="map-loader h-10 w-10 rounded-full border-2 border-white/15 border-t-[#f0c170]" />
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#e8bd78]">
              {t("demo.mapLoaderTitle")}
            </div>
            <div className="text-sm leading-6 text-[#d1dce6]">
              {t("demo.mapLoaderBody")}
            </div>
          </div>
        </div>
      ) : null}

      {detail && tooltipPosition ? (
        <div
          className="pointer-events-none absolute z-20 max-w-[320px] -translate-y-[110%] rounded-2xl border border-white/12 bg-[#0b131d]/94 px-4 py-3 text-sm text-[#f4efe7] shadow-[0_18px_50px_rgba(2,6,12,0.34)] backdrop-blur-md"
          style={{
            left: `clamp(12px, ${tooltipPosition.x + 14}px, calc(100% - 332px))`,
            top: `clamp(84px, ${tooltipPosition.y - 8}px, calc(100% - 24px))`,
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className={[
                "mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
                detail.accent === "amber"
                  ? "bg-[#f0c170]"
                  : detail.accent === "blue"
                    ? "bg-[#3f93ff]"
                    : detail.accent === "green"
                      ? "bg-[#8bd7a6]"
                      : "bg-[#94a3b8]",
              ].join(" ")}
            />
            <div className="min-w-0">
              <div className="font-semibold text-[#fff8ee]">{detail.title}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {detail.badges.filter(Boolean).map((badge) => (
                  <span
                    key={badge}
                    className={[
                      "rounded-full border px-2.5 py-1 text-xs font-medium",
                      detail.accent === "amber"
                        ? "border-[#f0c17033] bg-[#f0c1701a] text-[#ffe0a7]"
                        : detail.accent === "blue"
                          ? "border-[#3f93ff33] bg-[#3f93ff1a] text-[#cfe2ff]"
                          : detail.accent === "green"
                            ? "border-[#8bd7a633] bg-[#8bd7a61a] text-[#dff8e8]"
                            : "border-white/10 bg-white/[0.05] text-[#d7dee5]",
                    ].join(" ")}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

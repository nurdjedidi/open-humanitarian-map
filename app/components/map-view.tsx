import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";
import type { MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Protocol } from "pmtiles";

import type { MapDataset, RegionRecord, SupportedLayerId } from "~/data/dataset-types";
import { useI18n } from "~/i18n/use-i18n";
import {
  formatCompactNumber,
  formatScore100,
  getFeatureBounds,
  safeNumber,
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

const INITIAL_ZOOM = 4.55;
const INITIAL_BOUNDS: [[number, number], [number, number]] = [
  [-19.5, 2.0],
  [30.5, 28.5],
];
const OHM_SOURCE_PREFIX = "ohm-src-";
const OHM_LAYER_PREFIX = "ohm-lyr-";
const CONTRIBUTION_SOURCE_ID = `${OHM_SOURCE_PREFIX}contributions`;
const PENDING_SOURCE_ID = `${OHM_SOURCE_PREFIX}pending`;
let pmtilesProtocolRegistered = false;

function ensurePmtilesProtocol(maplibregl: any) {
  if (pmtilesProtocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  pmtilesProtocolRegistered = true;
}

function adminFillOpacity(droneMode: boolean) {
  return droneMode ? 0.24 : 0.65;
}

function buildRegionRecordFromProperties(
  props: Record<string, unknown>,
  countrySlug: string,
  fallbackReason: string,
): RegionRecord {
  const rawId =
    String(
      props.feature_id ??
        props.adm3_pcode ??
        props.adm2_pcode ??
        props.adm1_pcode ??
        props.region_name ??
        props.name ??
        "region",
    ) || "region";

  return {
    id: `${countrySlug}:${rawId}`,
    name:
      (typeof props.region_name === "string" && props.region_name) ||
      (typeof props.adm3_name === "string" && props.adm3_name) ||
      (typeof props.adm2_name === "string" && props.adm2_name) ||
      (typeof props.adm1_name === "string" && props.adm1_name) ||
      (typeof props.name === "string" && props.name) ||
      "Zone inconnue",
    adm1Name:
      (typeof props.adm1_name === "string" && props.adm1_name) || "n/a",
    priorityScore: safeNumber(props.priority_score ?? props.score),
    score100: safeNumber(props.score_100),
    priorityLabel:
      (typeof props.priority_label === "string" && props.priority_label) ||
      (typeof props.status === "string" && props.status) ||
      "n/a",
    decisionReason:
      (typeof props.decision_reason === "string" && props.decision_reason) ||
      fallbackReason,
    ipcPhase: safeNumber(props.ipc_phase_dominant),
    ipcPeopleP3Plus: safeNumber(props.ipc_people_p3plus),
    ipcPopulationTotal: safeNumber(props.ipc_population_total),
    ipcShareP3Plus: safeNumber(props.ipc_share_p3plus),
  };
}

function layerId(slug: string, part: string) {
  return `${OHM_LAYER_PREFIX}${slug}-${part}`;
}

function sourceId(slug: string, part: string) {
  return `${OHM_SOURCE_PREFIX}${slug}-${part}`;
}

function splitSelectedRegionId(selectedRegionId: string | null | undefined) {
  if (!selectedRegionId) return { slug: null, rawId: null };
  const separator = selectedRegionId.indexOf(":");
  if (separator === -1) {
    return { slug: null, rawId: selectedRegionId };
  }
  return {
    slug: selectedRegionId.slice(0, separator),
    rawId: selectedRegionId.slice(separator + 1),
  };
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

  const isDark = basemapId === "dark-matter" || basemapId === "satellite";
  const textColor = isDark ? "#ffffff" : "#1a1a1a";
  const haloColor = isDark ? "#000000" : "#ffffff";

  for (const layer of styleLayers) {
    if (layer?.type !== "symbol" || !layer?.layout?.["text-field"]) continue;

    try {
      map.setPaintProperty(layer.id, "text-color", textColor);
      map.setPaintProperty(layer.id, "text-halo-color", haloColor);
      map.setPaintProperty(layer.id, "text-halo-width", 1.4);
      map.setPaintProperty(layer.id, "text-halo-blur", 0.25);
    } catch {
      // Ignore layers that do not accept these paint properties.
    }
  }
}

function removeLayerIfExists(map: any, id: string) {
  if (map.getLayer(id)) {
    map.removeLayer(id);
  }
}

function removeSourceIfExists(map: any, id: string) {
  if (map.getSource(id)) {
    map.removeSource(id);
  }
}

function removeBuildingsLayer(map: any) {
  removeLayerIfExists(map, "ohm-3d-buildings");
}

function ensureBuildingsLayer(map: any, beforeId?: string | null) {
  removeBuildingsLayer(map);
  const style = map?.getStyle?.();
  const sources = style?.sources ?? {};
  const vectorSourceIds = Object.entries(sources)
    .filter(([, source]: any) => source?.type === "vector")
    .map(([sourceKey]) => sourceKey);

  for (const vectorSourceId of vectorSourceIds) {
    for (const sourceLayer of ["building", "buildings"]) {
      try {
        map.addLayer(
          {
            id: "ohm-3d-buildings",
            type: "fill-extrusion",
            source: vectorSourceId,
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
                ["to-number", ["get", "render_height"]],
                ["to-number", ["get", "height"]],
                8,
              ],
              "fill-extrusion-base": [
                "coalesce",
                ["to-number", ["get", "render_min_height"]],
                ["to-number", ["get", "min_height"]],
                0,
              ],
              "fill-extrusion-opacity": 0.86,
            },
          },
          beforeId ?? undefined,
        );
        return true;
      } catch {
        // Try next source layer candidate.
      }
    }
  }

  return false;
}

function upsertGeoJsonSource(map: any, id: string, data: FeatureCollection) {
  const existing = map.getSource(id);
  if (existing) {
    existing.setData(data);
    return;
  }

  map.addSource(id, {
    type: "geojson",
    data,
  });
}

function applyOperationalLayers(
  map: any,
  dataset: MapDataset,
  options: {
    showRoads: boolean;
    showWater: boolean;
    showSettlements: boolean;
    selectedRegionId: string | null;
    droneMode: boolean;
    labelLayerId: string | null;
    contributions?: FeatureCollection;
    pendingContributionCoordinate?: [number, number] | null;
  },
) {
  const beforeId = options.labelLayerId ?? undefined;
  const { slug: selectedSlug, rawId: selectedRawId } = splitSelectedRegionId(
    options.selectedRegionId,
  );

  for (const country of dataset.countries) {
    const adminTileUrl = country.tileUrls.admin_priority;
    const adminSourceLayer = country.tileSourceLayers.admin_priority ?? "admin_priority";
    if (adminTileUrl) {
      const adminSourceId = sourceId(country.slug, "admin");
      if (!map.getSource(adminSourceId)) {
        map.addSource(adminSourceId, {
          type: "vector",
          url: `pmtiles://${adminTileUrl}`,
        });
      }

      const adminFillId = layerId(country.slug, "admin-fill");
      removeLayerIfExists(map, adminFillId);
      map.addLayer(
        {
          id: adminFillId,
          type: "fill",
          source: adminSourceId,
          "source-layer": adminSourceLayer,
          paint: {
            "fill-color": [
              "case",
              [
                "any",
                ["has", "priority_score"],
                ["has", "score"],
              ],
              [
                "interpolate",
                ["linear"],
                [
                  "coalesce",
                  ["to-number", ["get", "priority_score"]],
                  ["to-number", ["get", "score"]],
                  0,
                ],
                0,
                "#fff7bc",
                0.25,
                "#fec44f",
                0.5,
                "#fe9929",
                0.75,
                "#d95f0e",
                0.9,
                "#990000",
                1,
                "#660000",
              ],
              "#e5e7eb",
            ],
            "fill-opacity": adminFillOpacity(options.droneMode),
          },
        },
        beforeId,
      );

      const adminLineId = layerId(country.slug, "admin-line");
      removeLayerIfExists(map, adminLineId);
      map.addLayer(
        {
          id: adminLineId,
          type: "line",
          source: adminSourceId,
          "source-layer": adminSourceLayer,
          paint: {
            "line-color": options.droneMode ? "#6b7280" : "#4b5563",
            "line-width": options.droneMode ? 0.7 : 1.0,
            "line-opacity": options.droneMode ? 0.5 : 0.85,
          },
        },
        beforeId,
      );

      const adminHighlightId = layerId(country.slug, "admin-highlight");
      removeLayerIfExists(map, adminHighlightId);
      map.addLayer(
        {
          id: adminHighlightId,
          type: "line",
          source: adminSourceId,
          "source-layer": adminSourceLayer,
          filter:
            selectedSlug === country.slug && selectedRawId
              ? ["==", ["to-string", ["get", "feature_id"]], selectedRawId]
              : ["==", ["to-string", ["get", "feature_id"]], "__none__"],
          paint: {
            "line-color": "#ffffff",
            "line-width": options.droneMode ? 2.8 : 3.6,
            "line-opacity": 1,
          },
        },
        beforeId,
      );
    }

    const roadsTileUrl = country.tileUrls.osm_roads;
    const roadsSourceLayer = country.tileSourceLayers.osm_roads ?? "osm_roads";
    const roadsSourceId = sourceId(country.slug, "roads");
    const roadsLayerId = layerId(country.slug, "roads");
    if (roadsTileUrl && options.showRoads) {
      if (!map.getSource(roadsSourceId)) {
        map.addSource(roadsSourceId, {
          type: "vector",
          url: `pmtiles://${roadsTileUrl}`,
        });
      }

      removeLayerIfExists(map, roadsLayerId);
      map.addLayer(
        {
          id: roadsLayerId,
          type: "line",
          source: roadsSourceId,
          "source-layer": roadsSourceLayer,
          paint: {
            "line-color": options.droneMode ? "#6b7280" : "#7c828a",
            "line-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1,
              0.35,
              6,
              0.55,
              10,
              0.75,
            ],
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1,
              0.4,
              4,
              0.9,
              8,
              1.8,
              11,
              3.2,
              14,
              5.2,
            ],
          },
        },
        beforeId,
      );
    } else {
      removeLayerIfExists(map, roadsLayerId);
      removeSourceIfExists(map, roadsSourceId);
    }

    const waterTileUrl = country.tileUrls.osm_water;
    const waterSourceLayer = country.tileSourceLayers.osm_water ?? "osm_water";
    const waterSourceId = sourceId(country.slug, "water");
    const waterOverviewId = layerId(country.slug, "water-overview");
    const waterDetailId = layerId(country.slug, "water-detail");
    if (waterTileUrl && options.showWater) {
      if (!map.getSource(waterSourceId)) {
        map.addSource(waterSourceId, {
          type: "vector",
          url: `pmtiles://${waterTileUrl}`,
        });
      }

      removeLayerIfExists(map, waterOverviewId);
      removeLayerIfExists(map, waterDetailId);
      map.addLayer(
        {
          id: waterDetailId,
          type: "circle",
          source: waterSourceId,
          "source-layer": waterSourceLayer,
          minzoom: 6.1,
          paint: {
            "circle-color": "#3f93ff",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              6.1,
              0.8,
              10,
              1.15,
              14,
              1.35,
            ],
            "circle-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              6.1,
              options.droneMode ? 0.28 : 0.46,
              8.5,
              options.droneMode ? 0.4 : 0.72,
              12,
              options.droneMode ? 0.55 : 0.92,
            ],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              6.1,
              2.7,
              7.5,
              3.7,
              11,
              6.5,
              14,
              8.7,
            ],
          },
        },
        beforeId,
      );
    } else {
      removeLayerIfExists(map, waterOverviewId);
      removeLayerIfExists(map, waterDetailId);
      removeSourceIfExists(map, waterSourceId);
    }

    const settlementTileUrl = country.tileUrls.osm_settlements;
    const settlementSourceLayer =
      country.tileSourceLayers.osm_settlements ?? "osm_settlements";
    const settlementSourceId = sourceId(country.slug, "settlements");
    const settlementOverviewId = layerId(country.slug, "settlements-overview");
    const settlementDetailId = layerId(country.slug, "settlements-detail");
    if (settlementTileUrl && options.showSettlements) {
      if (!map.getSource(settlementSourceId)) {
        map.addSource(settlementSourceId, {
          type: "vector",
          url: `pmtiles://${settlementTileUrl}`,
        });
      }

      removeLayerIfExists(map, settlementOverviewId);
      removeLayerIfExists(map, settlementDetailId);
      map.addLayer(
        {
          id: settlementDetailId,
          type: "circle",
          source: settlementSourceId,
          "source-layer": settlementSourceLayer,
          minzoom: 5.8,
          paint: {
            "circle-color": "#20242b",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5.8,
              0.65,
              9,
              0.9,
              14,
              1.1,
            ],
            "circle-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5.8,
              options.droneMode ? 0.2 : 0.34,
              8.5,
              options.droneMode ? 0.34 : 0.56,
              12,
              options.droneMode ? 0.48 : 0.86,
            ],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5.8,
              1.8,
              7.2,
              2.7,
              11,
              4.7,
              14,
              6.0,
            ],
          },
        },
        beforeId,
      );
    } else {
      removeLayerIfExists(map, settlementOverviewId);
      removeLayerIfExists(map, settlementDetailId);
      removeSourceIfExists(map, settlementSourceId);
    }
  }

  if (options.contributions) {
    upsertGeoJsonSource(map, CONTRIBUTION_SOURCE_ID, options.contributions);
    removeLayerIfExists(map, layerId("contributions", "points"));
    map.addLayer(
      {
        id: layerId("contributions", "points"),
        type: "circle",
        source: CONTRIBUTION_SOURCE_ID,
        paint: {
          "circle-color": [
            "match",
            ["get", "type"],
            "water",
            "#2d8cff",
            "road",
            "#f0c170",
            "access",
            "#f0c170",
            "ngo_presence",
            "#8bd7a6",
            "alert",
            "#f85c5c",
            "#a0b4c3",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.2,
          "circle-radius": 6.5,
          "circle-opacity": 0.95,
        },
      },
      beforeId,
    );
  } else {
    removeLayerIfExists(map, layerId("contributions", "points"));
    removeSourceIfExists(map, CONTRIBUTION_SOURCE_ID);
  }

  if (options.pendingContributionCoordinate) {
    upsertGeoJsonSource(map, PENDING_SOURCE_ID, {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: options.pendingContributionCoordinate,
          },
        },
      ],
    });
    removeLayerIfExists(map, layerId("pending", "point"));
    map.addLayer(
      {
        id: layerId("pending", "point"),
        type: "circle",
        source: PENDING_SOURCE_ID,
        paint: {
          "circle-color": "#f0c170",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-radius": 7.5,
          "circle-opacity": 0.98,
        },
      },
      beforeId,
    );
  } else {
    removeLayerIfExists(map, layerId("pending", "point"));
    removeSourceIfExists(map, PENDING_SOURCE_ID);
  }
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
    description: "Light basemap, good for regional reading",
    style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  },
  {
    id: "dark-matter",
    label: "Dark",
    description: "High contrast for operational layers",
    style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  },
  {
    id: "satellite",
    label: "Satellite",
    description: "Imagery basemap for field verification",
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
  const contributionModeRef = useRef(contributionMode);
  const onMapClickRef = useRef(onMapClick);
  const datasetRef = useRef(dataset);

  useEffect(() => {
    datasetRef.current = dataset;
  }, [dataset]);

  const [detail, setDetail] = useState<SelectionDetail | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [labelLayerId, setLabelLayerId] = useState<string | null>(null);

  const regionFallbackReason = t("demo.defaultReason");
  const currentBasemap = useMemo(
    () => BASEMAPS.find((item) => item.id === basemapId) ?? BASEMAPS[0],
    [basemapId],
  );
  const basemapStyleRef = useRef<string | StyleSpecification>(currentBasemap.style);

  useEffect(() => {
    contributionModeRef.current = contributionMode;
    onMapClickRef.current = onMapClick;
  }, [contributionMode, onMapClick]);

  useEffect(() => {
    if (!mapRootRef.current || typeof window === "undefined") return;
    let mounted = true;

    const run = async () => {
      const { default: maplibregl } = await import("maplibre-gl");
      ensurePmtilesProtocol(maplibregl);

      if (!mounted || !mapRootRef.current) return;

      const map = new maplibregl.Map({
        container: mapRootRef.current,
        style: basemapStyleRef.current,
        bounds: INITIAL_BOUNDS,
        fitBoundsOptions: {
          padding: { top: 120, bottom: 120, left: 120, right: 120 },
          maxZoom: 5.2,
        },
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

      const bindStyleState = () => {
        const nextLabelLayerId = findLabelLayerId(map);
        setLabelLayerId(nextLabelLayerId);
        tuneBasemapLabels(map, basemapId);
        applyOperationalLayers(map, dataset, {
          showRoads,
          showWater,
          showSettlements,
          selectedRegionId,
          droneMode,
          labelLayerId: nextLabelLayerId,
          contributions,
          pendingContributionCoordinate,
        });

        if (viewMode === "urban-3d") {
          ensureBuildingsLayer(map, nextLabelLayerId);
        } else {
          removeBuildingsLayer(map);
        }
      };

      map.on("load", () => {
        bindStyleState();
        requestAnimationFrame(() => {
          map.resize();
          setIsMapReady(true);
        });
      });

      map.on("style.load", bindStyleState);

      map.on("mousemove", (event: any) => {
        const currentDataset = datasetRef.current;
        const adminLayerIds = currentDataset.countries.map((country) =>
          layerId(country.slug, "admin-fill"),
        );
        const waterLayerIds = currentDataset.countries.flatMap((country) => [
          layerId(country.slug, "water-overview"),
          layerId(country.slug, "water-detail"),
        ]);
        const settlementLayerIds = currentDataset.countries.flatMap((country) => [
          layerId(country.slug, "settlements-overview"),
          layerId(country.slug, "settlements-detail"),
        ]);
        const contributionLayerId = layerId("contributions", "points");

        const features = map.queryRenderedFeatures(event.point, {
          layers: [
            ...adminLayerIds,
            ...waterLayerIds,
            ...settlementLayerIds,
            contributionLayerId,
          ].filter((id) => map.getLayer(id)),
        }) as MapGeoJSONFeature[];

        if (!features.length) {
          onRegionHover?.(null);
          setDetail(null);
          setTooltipPosition(null);
          return;
        }

        const feature = features[0];
        const sourceSlug =
          currentDataset.countries.find((country) => feature.layer.id.includes(country.slug))?.slug ??
          "country";

        if (feature.layer.id.includes("admin-fill")) {
          const record = buildRegionRecordFromProperties(
            feature.properties ?? {},
            sourceSlug,
            regionFallbackReason,
          );
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
          setTooltipPosition({ x: event.point.x, y: event.point.y });
          return;
        }

        if (feature.layer.id.includes("water")) {
          setDetail({
            kind: "osm",
            id: `${sourceSlug}-water`,
            title:
              String(feature.properties?.name ?? feature.properties?.amenity ?? t("demo.water")) ||
              t("demo.water"),
            badges: [t("demo.water")],
            accent: "blue",
          });
          setTooltipPosition({ x: event.point.x, y: event.point.y });
          return;
        }

        if (feature.layer.id.includes("settlements")) {
          setDetail({
            kind: "osm",
            id: `${sourceSlug}-settlement`,
            title: String(feature.properties?.name ?? t("demo.settlements")),
            badges: [t("demo.settlements")],
            accent: "slate",
          });
          setTooltipPosition({ x: event.point.x, y: event.point.y });
          return;
        }

        if (feature.layer.id === contributionLayerId) {
          setDetail({
            kind: "osm",
            id: String(feature.properties?.id ?? "contribution"),
            title: "Contribution terrain",
            badges: [
              String(feature.properties?.type ?? "terrain"),
              String(feature.properties?.value ?? "validated"),
            ],
            accent: "green",
          });
          setTooltipPosition({ x: event.point.x, y: event.point.y });
        }
      });

      map.on("click", (event: any) => {
        if (contributionModeRef.current) {
          onMapClickRef.current?.([event.lngLat.lng, event.lngLat.lat]);
          return;
        }

        const currentDataset = datasetRef.current;
        const adminLayerIds = currentDataset.countries.map((country) =>
          layerId(country.slug, "admin-fill"),
        );
        const features = map.queryRenderedFeatures(event.point, {
          layers: adminLayerIds.filter((id) => map.getLayer(id)),
        }) as MapGeoJSONFeature[];

        if (!features.length) return;

        const feature = features[0];
        const sourceSlug =
          currentDataset.countries.find((country) => feature.layer.id.includes(country.slug))?.slug ??
          "country";
        const record = buildRegionRecordFromProperties(
          feature.properties ?? {},
          sourceSlug,
          regionFallbackReason,
        );
        onRegionSelect?.(record);

        const exactFeature = dataset.admin.features.find(
          (item) => String(item.properties?.feature_id) === record.id,
        );

        if (exactFeature) {
          map.fitBounds(getFeatureBounds(exactFeature as Feature<Geometry, GeoJsonProperties>), {
            padding: { top: 60, bottom: 60, left: 60, right: 60 },
            duration: 550,
            maxZoom: 9.2,
          });
        } else {
          map.easeTo({
            center: event.lngLat,
            zoom: Math.max(map.getZoom(), 7.4),
            duration: 500,
          });
        }
      });
    };

    void run();

    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (basemapStyleRef.current === currentBasemap.style) return;

    basemapStyleRef.current = currentBasemap.style;
    map.setStyle(currentBasemap.style);
  }, [currentBasemap.style]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    applyOperationalLayers(map, dataset, {
      showRoads,
      showWater,
      showSettlements,
      selectedRegionId,
      droneMode,
      labelLayerId,
      contributions,
      pendingContributionCoordinate,
    });

    tuneBasemapLabels(map, basemapId);
    if (viewMode === "urban-3d") {
      ensureBuildingsLayer(map, labelLayerId);
    } else {
      removeBuildingsLayer(map);
    }
  }, [
    basemapId,
    contributions,
    dataset,
    droneMode,
    labelLayerId,
    pendingContributionCoordinate,
    selectedRegionId,
    showRoads,
    showSettlements,
    showWater,
    viewMode,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      pitch: droneMode ? 70 : viewMode === "urban-3d" ? 58 : 0,
      bearing: droneMode ? -22 : viewMode === "urban-3d" ? -14 : 0,
      zoom:
        viewMode === "urban-3d"
          ? Math.max(map.getZoom(), droneMode ? 15.8 : 15.2)
          : map.getZoom(),
      duration: 900,
    });
  }, [viewMode, droneMode]);

  return (
    <div className="map-shell relative h-full w-full overflow-hidden bg-[#081119]">
      <div id="map-root" ref={mapRootRef} className="h-full w-full bg-[#081119]" />

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

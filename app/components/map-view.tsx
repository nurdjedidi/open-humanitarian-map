import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";
import type { StyleSpecification } from "maplibre-gl";

import type { RegionRecord, SenegalDataset } from "~/data/senegal";
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

type SelectionDetail =
  | { kind: "region"; id: string; title: string; line1: string; line2: string }
  | { kind: "osm"; id: string; title: string; line1: string; line2: string };

type PointRecord = {
  id: string;
  label: string;
  line1: string;
  line2: string;
  coordinates: [number, number];
};

type MapViewProps = {
  dataset: SenegalDataset;
  showWater: boolean;
  showSettlements: boolean;
  showRoads: boolean;
  basemapId: BasemapId;
  selectedRegionId?: string | null;
  onRegionHover?: (region: RegionRecord | null) => void;
  onRegionSelect?: (region: RegionRecord | null) => void;
};

const INITIAL_CENTER: [number, number] = [-14.7, 14.5];
const INITIAL_ZOOM = 5.5;

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
      typeof props.decision_reason === "string"
        ? props.decision_reason
        : "Analyse disponible dans la fiche région.",
    ipcPhase: safeNumber(props.ipc_phase_dominant),
    ipcPeopleP3Plus: safeNumber(props.ipc_people_p3plus),
    ipcPopulationTotal: safeNumber(props.ipc_population_total),
    ipcShareP3Plus: safeNumber(props.ipc_share_p3plus),
  };
}

function featureRecordIndex(collection: FeatureCollection): Map<string, RegionRecord> {
  return new Map(
    collection.features.map((feature) => {
      const record = buildRegionRecord(feature);
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

function regionTooltip(record: RegionRecord): SelectionDetail {
  return {
    kind: "region",
    id: record.id,
    title: record.name,
    line1: `${formatScore100(record.score100)} | Phase IPC ${record.ipcPhase ?? "n/a"}`,
    line2: `P3+: ${formatCompactNumber(record.ipcPeopleP3Plus)} | Pop: ${formatCompactNumber(record.ipcPopulationTotal)}`,
  };
}

export function MapView({
  dataset,
  showWater,
  showSettlements,
  showRoads,
  basemapId,
  selectedRegionId = null,
  onRegionHover,
  onRegionSelect,
}: MapViewProps) {
  const mapRootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlayRef = useRef<any>(null);

  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [detail, setDetail] = useState<SelectionDetail | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const regionIndex = useMemo(() => featureRecordIndex(dataset.admin), [dataset.admin]);
  const currentBasemap = useMemo(
    () => BASEMAPS.find((item) => item.id === basemapId) ?? BASEMAPS[0],
    [basemapId],
  );

  const waterPoints = useMemo(
    () => pointRecords(dataset.layers.osm_water, "Point d'eau"),
    [dataset.layers.osm_water],
  );
  const settlementPoints = useMemo(
    () => pointRecords(dataset.layers.osm_settlements, "Lieu habité"),
    [dataset.layers.osm_settlements],
  );
  const waterOverviewRecords = useMemo(
    () =>
      pointRecords(
        {
          type: "FeatureCollection",
          features: downsampleFeatures(dataset.layers.osm_water?.features ?? [], 110),
        },
        "Point d'eau",
      ),
    [dataset.layers.osm_water],
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
        "Lieu habité",
      ),
    [dataset.layers.osm_settlements],
  );

  const buildLayers = useMemo(() => {
    const layers: any[] = [
      new GeoJsonLayer({
        id: "admin-priority",
        data: dataset.admin,
        pickable: true,
        stroked: true,
        filled: true,
        lineWidthMinPixels: 1,
        getLineWidth: (feature: Feature<Geometry, GeoJsonProperties>) =>
          feature.properties?.feature_id === selectedRegionId ? 3.6 : 1.2,
        getLineColor: (feature: Feature<Geometry, GeoJsonProperties>) =>
          feature.properties?.feature_id === selectedRegionId
            ? [248, 250, 252, 245]
            : [62, 62, 62, 170],
        getFillColor: (feature: Feature<Geometry, GeoJsonProperties>) =>
          priorityColor(feature.properties?.priority_score ?? feature.properties?.score, 190),
        updateTriggers: {
          getFillColor: [selectedRegionId],
          getLineWidth: [selectedRegionId],
          getLineColor: [selectedRegionId],
        },
        autoHighlight: false,
        onHover: ({ object }: { object?: Feature<Geometry, GeoJsonProperties> | null }) => {
          if (!object) {
            onRegionHover?.(null);
            return;
          }
          const record = buildRegionRecord(object);
          onRegionHover?.(record);
          setDetail(regionTooltip(record));
        },
        onClick: ({ object }: { object?: Feature<Geometry, GeoJsonProperties> | null }) => {
          if (!object) return;
          const record = buildRegionRecord(object);
          onRegionSelect?.(record);
          setDetail(regionTooltip(record));
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
          getLineWidth: zoom >= 9 ? 2.2 : 1.3,
          getLineColor: [80, 80, 86, 145],
          updateTriggers: { getLineWidth: [zoom] },
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
          getFillColor: [45, 140, 255, 200],
          getLineColor: [255, 255, 255, 220],
          stroked: true,
          filled: true,
          radiusScale: 6,
          radiusMinPixels: 4,
          radiusMaxPixels: 7,
          getRadius: 70,
          autoHighlight: false,
          onHover: ({ object }: { object?: PointRecord | null }) => {
            if (!object) return;
            setDetail({
              kind: "osm",
              id: object.id,
              title: object.label,
              line1: object.line1,
              line2: object.line2,
            });
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
          getFillColor: [45, 140, 255, 220],
          getLineColor: [255, 255, 255, 235],
          stroked: true,
          filled: true,
          radiusScale: 6.5,
          radiusMinPixels: 5,
          radiusMaxPixels: 9,
          getRadius: 82,
          autoHighlight: false,
          onHover: ({ object }: { object?: PointRecord | null }) => {
            if (!object) return;
            setDetail({
              kind: "osm",
              id: object.id,
              title: object.label,
              line1: object.line1,
              line2: object.line2,
            });
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
          getFillColor: [35, 35, 35, 176],
          getLineColor: [255, 255, 255, 160],
          stroked: true,
          filled: true,
          radiusScale: 6,
          radiusMinPixels: 2.5,
          radiusMaxPixels: 6,
          getRadius: 80,
          autoHighlight: false,
          onHover: ({ object }: { object?: PointRecord | null }) => {
            if (!object) return;
            setDetail({
              kind: "osm",
              id: object.id,
              title: object.label,
              line1: "Lieu habité",
              line2: "",
            });
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
          getFillColor: [35, 35, 35, 180],
          getLineColor: [255, 255, 255, 160],
          stroked: true,
          filled: true,
          radiusScale: 7,
          radiusMinPixels: 3,
          radiusMaxPixels: 8,
          getRadius: 90,
          autoHighlight: false,
          onHover: ({ object }: { object?: PointRecord | null }) => {
            if (!object) return;
            setDetail({
              kind: "osm",
              id: object.id,
              title: object.label,
              line1: "Lieu habité",
              line2: "",
            });
          },
        }),
      );
    }

    return layers;
  }, [
    dataset.admin,
    dataset.layers.osm_roads,
    selectedRegionId,
    showRoads,
    showSettlements,
    showWater,
    settlementOverviewRecords,
    settlementPoints,
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
        style: currentBasemap.style,
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        minZoom: 5,
        maxZoom: 13,
        pitch: 0,
      });

      mapRef.current = map;
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );

      const overlay = new MapboxOverlay({ interleaved: true, layers: buildLayers });
      overlayRef.current = overlay;
      map.addControl(overlay);

      const sync = () => setZoom(map.getZoom());

      const bindStyleState = () => {
        overlay.setProps({ layers: buildLayers });
      };

      map.on("load", () => {
        bindStyleState();
        map.fitBounds(mapBounds(dataset.admin), {
          padding: { top: 72, bottom: 72, left: 72, right: 72 },
          duration: 0,
          maxZoom: 6.95,
        });
        sync();
        setIsMapReady(true);
      });

      map.on("zoomend", sync);
      map.on("styledata", bindStyleState);
    };

    void run();

    return () => {
      mounted = false;
      overlayRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [buildLayers, currentBasemap.style, dataset.admin]);

  useEffect(() => {
    overlayRef.current?.setProps({ layers: buildLayers });
  }, [buildLayers]);

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
      setDetail(regionTooltip(record));
    }
  }, [dataset.admin.features, regionIndex, selectedRegionId]);

  return (
    <div className="map-shell relative h-[48vh] min-h-[340px] max-h-[calc(100vh-18rem)] overflow-hidden rounded-[28px] border border-white/10 bg-[#081119] shadow-[0_25px_90px_rgba(2,6,12,0.4)] md:h-[56vh] md:min-h-[420px] xl:h-full xl:min-h-0 xl:max-h-none">
      <div id="map-root" ref={mapRootRef} className="h-full w-full" />

      {!isMapReady ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(24,40,56,0.92),rgba(8,17,26,0.98))]">
          <div className="flex max-w-[320px] flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-center text-[#eef4fa] shadow-[0_24px_80px_rgba(2,6,12,0.36)] backdrop-blur-md">
            <div className="map-loader h-10 w-10 rounded-full border-2 border-white/15 border-t-[#f0c170]" />
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#e8bd78]">
              Chargement de la carte
            </div>
            <div className="text-sm leading-6 text-[#d1dce6]">
              Initialisation du fond, des régions prioritaires et des couches
              terrain.
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 max-w-[340px] rounded-2xl border border-white/12 bg-[#08111a]/90 px-4 py-3 text-sm text-[#f4efe7] shadow-[0_14px_40px_rgba(2,6,12,0.3)] backdrop-blur-md md:left-5 md:right-auto">
          <div className="font-semibold text-[#fff5e6]">{detail.title}</div>
          <div className="mt-1 text-[#d7dee5]">{detail.line1}</div>
          {detail.line2 ? <div className="text-[#d7dee5]">{detail.line2}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

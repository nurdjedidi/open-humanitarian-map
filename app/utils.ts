import type { Feature, GeoJsonProperties, Geometry } from "geojson";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function safeNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCompactNumber(value: unknown): string {
  const parsed = safeNumber(value);
  if (parsed === null) return "n/a";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(parsed));
}

export function formatPercent(value: unknown): string {
  const parsed = safeNumber(value);
  if (parsed === null) return "n/a";
  return `${(parsed * 100).toFixed(1)}%`;
}

export function formatScore100(value: unknown): string {
  const parsed = safeNumber(value);
  if (parsed === null) return "n/a";
  return `${Math.round(parsed)}/100`;
}

export function featureName(properties?: GeoJsonProperties): string {
  if (!properties) return "Zone inconnue";
  const candidates = [
    properties.region_name,
    properties.adm2_name,
    properties.adm1_name,
    properties.admin_name,
    properties.name,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }
  return "Zone inconnue";
}

export function getFeatureCenter(feature: Feature<Geometry, GeoJsonProperties>): [number, number] {
  const bounds = getFeatureBounds(feature);
  return [
    (bounds[0][0] + bounds[1][0]) / 2,
    (bounds[0][1] + bounds[1][1]) / 2,
  ];
}

export function getFeatureBounds(feature: Feature<Geometry, GeoJsonProperties>): [[number, number], [number, number]] {
  const bounds = {
    minLng: Number.POSITIVE_INFINITY,
    minLat: Number.POSITIVE_INFINITY,
    maxLng: Number.NEGATIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
  };

  const visit = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return;
    if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
      const lng = coordinates[0] as number;
      const lat = coordinates[1] as number;
      bounds.minLng = Math.min(bounds.minLng, lng);
      bounds.minLat = Math.min(bounds.minLat, lat);
      bounds.maxLng = Math.max(bounds.maxLng, lng);
      bounds.maxLat = Math.max(bounds.maxLat, lat);
      return;
    }
    for (const item of coordinates) visit(item);
  };

  if (feature.geometry.type === "GeometryCollection") {
    for (const geometry of feature.geometry.geometries) {
      if ("coordinates" in geometry) {
        visit(geometry.coordinates);
      }
    }
  } else {
    visit(feature.geometry.coordinates);
  }

  if (!Number.isFinite(bounds.minLng) || !Number.isFinite(bounds.minLat)) {
    return [[-18.2, 12.0], [-11.2, 16.9]];
  }

  return [
    [bounds.minLng, bounds.minLat],
    [bounds.maxLng, bounds.maxLat],
  ];
}

export function toPointCoordinates(feature: Feature<Geometry, GeoJsonProperties>): [number, number] {
  if (feature.geometry.type === "Point") {
    return feature.geometry.coordinates as [number, number];
  }
  return getFeatureCenter(feature);
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function interpolateColor(left: [number, number, number], right: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(lerp(left[0], right[0], t)),
    Math.round(lerp(left[1], right[1], t)),
    Math.round(lerp(left[2], right[2], t)),
  ];
}

export function priorityColor(score: unknown, alpha = 210): [number, number, number, number] {
  const parsed = safeNumber(score);
  if (parsed === null) {
    return [168, 168, 168, 104];
  }

  const clamped = clamp(parsed, 0, 1);
  const stops: Array<[number, [number, number, number]]> = [
    [0, [255, 241, 170]],
    [0.35, [245, 180, 55]],
    [0.6, [220, 75, 35]],
    [0.82, [145, 20, 25]],
    [1, [35, 8, 12]],
  ];

  for (let index = 0; index < stops.length - 1; index += 1) {
    const [leftPos, leftColor] = stops[index];
    const [rightPos, rightColor] = stops[index + 1];
    if (clamped >= leftPos && clamped <= rightPos) {
      const localT = (clamped - leftPos) / (rightPos - leftPos);
      const [r, g, b] = interpolateColor(leftColor, rightColor, localT);
      return [r, g, b, alpha];
    }
  }

  return [...stops[stops.length - 1][1], alpha];
}

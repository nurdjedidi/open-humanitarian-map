import type { FeatureCollection, Geometry } from "geojson";

const API_BASE_URL = (import.meta.env.VITE_OHM_API_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

export type AuthProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  organization: string | null;
  role: "contributor" | "admin";
};

export type AuthState = {
  user: { id: string; email: string | null };
  profile: AuthProfile | null;
};

export type ContributionType = "access" | "water" | "road" | "ngo_presence" | "alert";

export type ContributionPayload = {
  geometry: Geometry;
  type: ContributionType;
  value: string;
  confidence?: number;
  countryCode?: string;
  admCode?: string;
  osmRef?: string;
};

export type AdminContribution = {
  id: string;
  user_id: string;
  geometry: Geometry;
  type: ContributionType;
  value: string;
  confidence: number;
  status: "pending" | "validated" | "rejected";
  country_code: string | null;
  adm_code: string | null;
  osm_ref: string | null;
  created_at: string;
};

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `API request failed (${response.status})`);
  }

  return body as T;
}

export function getCurrentUser() {
  return apiRequest<AuthState>("/api/auth/me");
}

export function signup(payload: { email: string; password: string; displayName?: string }) {
  return apiRequest<{ user: { id: string; email: string | null }; needsEmailConfirmation: boolean }>(
    "/api/auth/signup",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function login(payload: { email: string; password: string }) {
  return apiRequest<{ user: { id: string; email: string | null } }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return apiRequest<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export function getValidatedContributions(bbox?: [number, number, number, number]) {
  const query = bbox ? `?bbox=${bbox.join(",")}` : "";
  return apiRequest<FeatureCollection>(`/api/contributions${query}`);
}

export function createContribution(payload: ContributionPayload) {
  return apiRequest<{ contribution: { id: string; status: string; created_at: string } }>(
    "/api/contributions",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function getPendingAdminContributions() {
  return apiRequest<{ contributions: AdminContribution[] }>("/api/admin/contributions?status=pending");
}

export function reviewContribution(id: string, decision: "validate" | "reject") {
  return apiRequest<{ contribution: { id: string; status: string } }>(
    `/api/admin/contributions/${id}/${decision === "validate" ? "validate" : "reject"}`,
    { method: "POST" },
  );
}

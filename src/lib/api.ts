import type { ManifestV1, RegionsResponseV1, SummaryV1 } from "@/types/api";

function apiBase(): string | undefined {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  return raw.replace(/\/$/, "");
}

/** When unset, load static JSON from Vite public/ (same shape as S3). */
export function useLambdaApi(): boolean {
  return apiBase() !== undefined;
}

export function summaryUrl(): string {
  const base = apiBase();
  return base ? `${base}/api/summary` : "/processed/v1/summary.json";
}

export function regionsUrl(): string {
  const base = apiBase();
  return base ? `${base}/api/regions` : "/processed/v1/regions.json";
}

export function manifestUrl(): string {
  const base = apiBase();
  return base ? `${base}/api/manifest` : "/processed/v1/manifest.json";
}

export async function fetchJson<T>(url: string): Promise<T> {
  /** Avoid stale dashboard numbers after S3/API updates (browser HTTP cache). */
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchSummary(): Promise<SummaryV1> {
  return fetchJson<SummaryV1>(summaryUrl());
}

export async function fetchRegions(): Promise<RegionsResponseV1> {
  return fetchJson<RegionsResponseV1>(regionsUrl());
}

export async function fetchManifest(): Promise<ManifestV1> {
  return fetchJson<ManifestV1>(manifestUrl());
}

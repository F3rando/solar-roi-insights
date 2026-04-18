import { useQuery } from "@tanstack/react-query";
import { fetchManifest, fetchRegions, fetchSummary } from "@/lib/api";

export function useSolarSummary() {
  return useQuery({
    queryKey: ["solar", "summary"],
    queryFn: fetchSummary,
  });
}

export function useSolarRegions() {
  return useQuery({
    queryKey: ["solar", "regions"],
    queryFn: fetchRegions,
  });
}

export function useSolarManifest() {
  return useQuery({
    queryKey: ["solar", "manifest"],
    queryFn: fetchManifest,
  });
}

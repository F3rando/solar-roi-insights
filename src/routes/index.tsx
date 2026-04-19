import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchManifest, fetchRegions, fetchSummary } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SolarSense — Solar ROI Intelligence for Cities & Business" },
      {
        name: "description",
        content:
          "A decision intelligence dashboard for solar adoption: savings, payback, and environmental ROI by neighborhood.",
      },
      { property: "og:title", content: "SolarSense — Solar ROI Decision Intelligence" },
      {
        property: "og:description",
        content:
          "Interactive map + financial dashboard for renewable energy adoption in San Diego.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [warming, setWarming] = useState(false);

  const warmDashboard = useCallback(async () => {
    await Promise.all([
      queryClient.ensureQueryData({ queryKey: ["solar", "summary"], queryFn: fetchSummary }),
      queryClient.ensureQueryData({ queryKey: ["solar", "regions"], queryFn: fetchRegions }),
      queryClient.ensureQueryData({ queryKey: ["solar", "manifest"], queryFn: fetchManifest }),
    ]);
  }, [queryClient]);

  useEffect(() => {
    void warmDashboard();
  }, [warmDashboard]);

  return (
    <div className="dark min-h-screen bg-background text-foreground overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-24 -right-24 h-96 w-96 rounded-full bg-solar/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-warn/10 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-6xl px-5 py-12 md:py-16">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary">SolarSense</div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/methodology" className="hover:text-foreground">
              Methodology
            </Link>
            <Link
              to={"/dashboard" as any}
              className="hover:text-foreground"
              onMouseEnter={() => void warmDashboard()}
            >
              Dashboard
            </Link>
          </div>
        </div>

        <section className="mt-12 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10 items-start">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-3 py-1 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary shadow-[var(--shadow-glow-primary)]" />
              Built for cities, utilities, and enterprise sustainability teams
            </div>

            <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]">
              Make solar decisions with <span className="gradient-text">ROI clarity</span>.
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-[62ch] leading-relaxed">
              SolarSense turns neighborhood-scale adoption + rate assumptions into decision intelligence:
              payback, 25-year savings, and CO₂ impact—so governments and businesses can prioritize the
              places where solar wins fastest.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                onMouseEnter={() => void warmDashboard()}
                onClick={async () => {
                  if (warming) return;
                  setWarming(true);
                  try {
                    await warmDashboard();
                    await navigate({ to: "/dashboard" as any });
                  } finally {
                    setWarming(false);
                  }
                }}
                aria-busy={warming}
                className="inline-flex w-full sm:w-auto min-w-[220px] items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
              >
                {warming ? "Opening dashboard…" : "Get started"}
              </button>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="panel p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Financial</div>
                <div className="mt-1 text-sm text-foreground/90">Payback + savings scenarios</div>
              </div>
              <div className="panel p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Geospatial</div>
                <div className="mt-1 text-sm text-foreground/90">Hotspots by neighborhood</div>
              </div>
              <div className="panel p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Climate</div>
                <div className="mt-1 text-sm text-foreground/90">CO₂ avoided at scale</div>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              What you’ll see inside
            </div>
            <ul className="mt-3 space-y-3 text-sm text-foreground/85">
              <li className="flex gap-3">
                <span className="mt-1 size-1.5 rounded-full bg-primary shrink-0" />
                Interactive map to compare neighborhoods side-by-side
              </li>
              <li className="flex gap-3">
                <span className="mt-1 size-1.5 rounded-full bg-primary shrink-0" />
                What-if controls for system size, investment, and utility inflation
              </li>
              <li className="flex gap-3">
                <span className="mt-1 size-1.5 rounded-full bg-primary shrink-0" />
                Cost projection explorer (solar pathway vs grid-only)
              </li>
              <li className="flex gap-3">
                <span className="mt-1 size-1.5 rounded-full bg-primary shrink-0" />
                Environmental ROI metrics for reporting
              </li>
            </ul>

            <div className="mt-5 rounded-xl border border-border/70 bg-card/40 p-4 text-xs text-muted-foreground leading-relaxed">
              Tip: if you’re presenting to a city council or CFO, open a neighborhood with fast payback,
              then tweak “Utility Price Increase” to show downside protection.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

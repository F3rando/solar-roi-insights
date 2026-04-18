import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [{ title: "Methodology — SolarSense" }],
  }),
  component: Methodology,
});

function Methodology() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <Link
          to="/"
          className="text-sm text-primary hover:underline"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Methodology</h1>
        <p className="mt-2 text-muted-foreground">
          How we compute and display solar adoption and ROI metrics. Updated as we wire ZenPower + ETL.
        </p>

        <section className="mt-10 space-y-6 text-sm leading-relaxed">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-primary">Data sources</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/90">
              <li>
                <strong>ZenPower solar dataset</strong> (required sponsor dataset) — primary source for adoption,
                geography, and time-based views once ETL is complete.
              </li>
              <li>
                <strong>Neighborhood model (current UI)</strong> — Scripps-style heat and EIA-style rates in{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">src/lib/solar.ts</code> drive payback and
                savings until regional metrics are fully replaced by pipeline output.
              </li>
              <li>
                <strong>Processed bundles</strong> — <code className="rounded bg-muted px-1 py-0.5 text-xs">processed/v1/*.json</code>{" "}
                served locally or via API Gateway + Lambda from S3; shapes defined in{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">src/types/api.ts</code>.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-primary">Metric definitions (v1)</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/90">
              <li>
                <strong>Adoption index</strong> — normalized score (0–1) per region for map coloring; exact
                formula TBD from ZenPower fields.
              </li>
              <li>
                <strong>YoY growth</strong> — year-over-year change in relevant install or capacity units from
                the dataset.
              </li>
              <li>
                <strong>Median estimated annual savings</strong> — illustrative USD from pipeline mocks; will be
                tied to utility rates and production assumptions documented here.
              </li>
              <li>
                <strong>CO₂ avoided</strong> — from estimated production × grid emission factor (region-specific
                factor TBD, e.g. eGRID-style).
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-primary">Limitations</h2>
            <p className="mt-3 text-foreground/90">
              Current JSON under <code className="rounded bg-muted px-1 py-0.5 text-xs">public/processed/v1/</code>{" "}
              is for UI and API integration testing. Figures are not final audit outputs until the ZenPower ETL
              run is merged and reviewed.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

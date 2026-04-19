import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { RegionRowV1, SummaryV1 } from "@/types/api";
import type { SolarReportAiInsights } from "@/types/solarReportAi";
import type { Inputs, Zone } from "@/lib/solar";
import {
  SAN_DIEGO_ZONES,
  paybackYears,
  cumulativeSavings,
  efficiencyPct,
  co2AvoidedTons,
  treesEquivalent,
  zoneStatus,
} from "@/lib/solar";

export type FullReportPdfParams = {
  regions: RegionRowV1[];
  zones: Zone[];
  inputs: Inputs;
  summary?: SummaryV1 | null;
  dataSourceLabel: string;
  manifestGeneratedAt?: string | null;
  /** Optional strategic narrative (structured supplement from server). */
  aiInsights?: SolarReportAiInsights | null;
};

const BRAND = { r: 16, g: 120, b: 72 };
const MUTED: [number, number, number] = [55, 65, 60];

function zoneForRegion(zones: Zone[], regionId: string): Zone | undefined {
  return zones.find((z) => z.id === regionId);
}

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function appendAiNarrativeToPdf(
  doc: jsPDF,
  sorted: RegionRowV1[],
  insights: SolarReportAiInsights,
  margin: number,
  pageW: number,
  pageH: number,
): void {
  doc.addPage();
  let y = margin + 8;
  const maxW = pageW - margin * 2;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin - 40) {
      doc.addPage();
      y = margin + 8;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 30, 25);
  doc.text("Strategic narrative — program & investment lens", margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const aiDisc = doc.splitTextToSize(
    "Supplemental analysis derived from the facts in this report—not engineering, interconnection, tariff, or legal advice. Validate before commitments.",
    maxW,
  );
  ensureSpace(aiDisc.length * 11 + 8);
  doc.text(aiDisc, margin, y);
  y += aiDisc.length * 11 + 14;

  const sectionBody = (title: string, body: string, titleSize = 11) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(titleSize);
    doc.setTextColor(20, 30, 25);
    doc.text(title, margin, y);
    y += titleSize + 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const lines = doc.splitTextToSize(body, maxW);
    ensureSpace(lines.length * 12 + 12);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 14;
  };

  const sectionBullets = (title: string, items: string[], titleSize = 11) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(titleSize);
    doc.setTextColor(20, 30, 25);
    doc.text(title, margin, y);
    y += titleSize + 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    for (const item of items) {
      const bullet = `• ${item}`;
      const lines = doc.splitTextToSize(bullet, maxW - 12);
      ensureSpace(lines.length * 11 + 6);
      doc.text(lines, margin + 6, y);
      y += lines.length * 11 + 4;
    }
    y += 10;
  };

  sectionBody("Executive summary", insights.executive_summary);
  sectionBody("Strategic investment brief", insights.strategic_investment_brief);
  sectionBullets("Portfolio & program priorities", insights.portfolio_program_priorities);
  sectionBody("Risks, constraints & limits", insights.risks_constraints_and_limits);
  sectionBullets("Leading indicators to monitor", insights.leading_indicators_to_monitor);

  if (insights.dataset_context) {
    sectionBody("Dataset context", insights.dataset_context, 11);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 30, 25);
  doc.text("Per-region program & investment notes", margin, y);
  y += 18;

  const byId = new Map(insights.regions.map((r) => [r.region_id, r]));
  for (const region of sorted) {
    const row = byId.get(region.id);
    if (!row) continue;

    const blockTitle = `${region.name} · rating ${row.rating_1_to_5}/5`;
    ensureSpace(96);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(blockTitle, margin, y);
    y += 14;
    doc.setTextColor(95, 105, 100);
    doc.setFontSize(9);
    const headLines = doc.splitTextToSize(row.headline, maxW);
    doc.text(headLines, margin, y);
    y += headLines.length * 11 + 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const angleLines = doc.splitTextToSize(row.investment_angle, maxW);
    ensureSpace(angleLines.length * 12 + 20);
    doc.text(angleLines, margin, y);
    y += angleLines.length * 12 + 6;

    const compLines = doc.splitTextToSize(row.comparative_context, maxW);
    ensureSpace(compLines.length * 12 + 20);
    doc.text(compLines, margin, y);
    y += compLines.length * 12 + 6;

    const actLines = doc.splitTextToSize(`Stakeholder actions: ${row.stakeholder_actions}`, maxW);
    ensureSpace(actLines.length * 12 + 16);
    doc.text(actLines, margin, y);
    y += actLines.length * 12 + 16;
  }
}

/** Builds and triggers download of a multi-page regional PDF. */
export function downloadSolarSenseFullReport(params: FullReportPdfParams): void {
  const { regions, zones, inputs, summary, dataSourceLabel, manifestGeneratedAt, aiInsights } =
    params;
  if (!regions.length) {
    throw new Error("No regions loaded — cannot build report.");
  }

  const sorted = [...regions].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, pageW, 6, "F");
  y += 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 30, 25);
  doc.text("SolarSense — full regional report", margin, y);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const generated = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  doc.text(`Report timestamp: ${generated}`, margin, y);
  y += 14;
  doc.text(`Data source: ${dataSourceLabel}`, margin, y);
  y += 14;
  if (manifestGeneratedAt) {
    doc.text(`Dataset snapshot (manifest): ${manifestGeneratedAt}`, margin, y);
    y += 14;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 30, 25);
  doc.text("Scenario (What-If sliders)", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    `System ${inputs.systemKw.toFixed(1)} kW · Investment ${fmtMoney(inputs.investment)} · Utility escalation ${inputs.utilityIncreasePct.toFixed(1)}% / yr`,
    margin,
    y,
  );
  y += 22;

  if (summary) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 30, 25);
    doc.text("Dataset-wide KPIs (summary bundle)", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const k = summary.kpis;
    const c = summary.coverage;
    const lines = [
      `Scope: ${summary.scope.label} (${summary.scope.geo_level})`,
      `Installs (est.): ${k.total_estimated_installs.toLocaleString("en-US")} · Capacity: ${k.total_capacity_mw.toFixed(1)} MW`,
      `YoY growth: +${k.yoy_growth_pct.toFixed(1)}% · Median payback: ${k.median_payback_years.toFixed(1)} yr · CO₂ avoided: ${k.est_co2_avoided_kt_per_year.toFixed(0)} kt/yr`,
      `Regions in bundle: ${c.regions_count} · Last data year: ${c.last_data_year}`,
    ];
    for (const line of lines) {
      doc.text(line, margin, y);
      y += 13;
    }
    if (summary.disclaimer) {
      y += 4;
      doc.setFontSize(8);
      const wrapped = doc.splitTextToSize(`Disclaimer: ${summary.disclaimer}`, pageW - margin * 2);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 10 + 8;
    }
  }

  y += 10;
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(0.75);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 30, 25);
  doc.text("All regions — modeled + ZenPower fields", margin, y);

  const head = [
    [
      "Region",
      "Adopt %",
      "YoY %",
      "Med $/yr",
      "Bucket",
      "Payback (yr)",
      "25-yr save",
      "Panel eff %",
      "CO₂ 25yr (t)",
      "Trees ≈",
      "ROI band",
      "Sun hrs/yr",
    ],
  ];

  const body = sorted.map((region) => {
    const z = zoneForRegion(zones, region.id);
    const ins = region.solar_insights;
    const adopt = `${(region.adoption_index * 100).toFixed(0)}%`;
    const yoy = `+${region.yoy_growth_pct.toFixed(1)}%`;
    const med = fmtMoney(region.median_est_annual_savings_usd);
    const bucket = region.install_count_bucket;
    if (!z) {
      return [
        region.name,
        adopt,
        yoy,
        med,
        bucket,
        "—",
        "—",
        "—",
        "—",
        "—",
        "—",
        ins?.max_sunshine_hours_per_year != null
          ? String(Math.round(ins.max_sunshine_hours_per_year))
          : "—",
      ];
    }
    const payback = paybackYears(z, inputs, ins);
    const save = cumulativeSavings(z, inputs, 25, ins);
    const eff = efficiencyPct(z.heatC);
    const co2 = co2AvoidedTons(z, inputs, 25, ins);
    const trees = treesEquivalent(co2);
    const band = zoneStatus(z, inputs, ins).label;
    return [
      region.name,
      adopt,
      yoy,
      med,
      bucket,
      payback >= 99 ? "99+" : payback.toFixed(1),
      fmtMoney(save),
      `${eff.toFixed(0)}%`,
      String(co2),
      String(trees),
      band,
      ins?.max_sunshine_hours_per_year != null
        ? String(Math.round(ins.max_sunshine_hours_per_year))
        : "—",
    ];
  });

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head,
    body,
    theme: "striped",
    headStyles: {
      fillColor: [BRAND.r, BRAND.g, BRAND.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak", valign: "middle" },
    columnStyles: {
      0: { cellWidth: 100 },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      11: { halign: "right" },
    },
    showHead: "everyPage",
    didDrawPage: (data) => {
      const d = data.doc;
      const h = d.internal.pageSize.getHeight();
      d.setFontSize(7);
      d.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      const note = d.splitTextToSize(
        "SolarSense — modeled payback/savings use zone irradiance, heat, and utility defaults; ZenPower fields come from regions.json. Not an installer quote.",
        pageW - margin * 2,
      );
      d.text(note, margin, h - 22);
    },
  });

  const pageH = doc.internal.pageSize.getHeight();
  if (aiInsights) {
    appendAiNarrativeToPdf(doc, sorted, aiInsights, margin, pageW, pageH);
  }

  const safe = `SolarSense-regional-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(safe);
}

export function buildFullReportPdfParams(
  regions: RegionRowV1[] | undefined,
  inputs: Inputs,
  summary: SummaryV1 | null | undefined,
  dataSourceLabel: string,
  manifestGeneratedAt: string | null | undefined,
  aiInsights?: SolarReportAiInsights | null,
): FullReportPdfParams {
  return {
    regions: regions ?? [],
    zones: SAN_DIEGO_ZONES,
    inputs,
    summary: summary ?? null,
    dataSourceLabel,
    manifestGeneratedAt: manifestGeneratedAt ?? null,
    aiInsights: aiInsights ?? null,
  };
}

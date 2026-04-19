import { z } from "zod";

/** Validated Gemini output — one call per full report (business / government lens). */
export const solarReportAiInsightsSchema = z.object({
  executive_summary: z.string(),
  /** Memo-style: where to deploy attention, capital, or policy given the bundle (not a stat recap). */
  strategic_investment_brief: z.string(),
  /** Concrete, sequenced or thematic priorities (programs, geography, equity, grid readiness framing). */
  portfolio_program_priorities: z.array(z.string()).min(4).max(10),
  /** Data limits, model limits, and deployment risks an approver should weigh. */
  risks_constraints_and_limits: z.string(),
  /** What leadership should track to validate assumptions and steer budgets. */
  leading_indicators_to_monitor: z.array(z.string()).min(3).max(8),
  dataset_context: z.string().optional(),
  regions: z.array(
    z.object({
      region_id: z.string(),
      rating_1_to_5: z.number().int().min(1).max(5),
      headline: z.string(),
      /** Why this sub-market matters for public or private solar deployment / investment. */
      investment_angle: z.string(),
      /** How this area compares to others in the bundle on drivers (adoption, savings signals, resource). */
      comparative_context: z.string(),
      /** Actions for agencies, programs, utilities, or investors—not generic homeowner tips. */
      stakeholder_actions: z.string(),
    }),
  ),
});

export type SolarReportAiInsights = z.infer<typeof solarReportAiInsightsSchema>;

export type SolarReportNarrativeResult =
  | { ok: true; insights: SolarReportAiInsights }
  | {
      ok: false;
      error: string;
      code: "NO_API_KEY" | "GEMINI_HTTP" | "GEMINI_BODY" | "PARSE" | "EMPTY";
    };

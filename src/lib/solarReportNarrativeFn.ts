import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SolarReportNarrativeResult } from "@/types/solarReportAi";
import { solarReportAiInsightsSchema } from "@/types/solarReportAi";

const factsInputSchema = z.object({
  generated_at_utc: z.string(),
  scenario: z.object({
    system_kw: z.number(),
    investment_usd: z.number(),
    utility_escalation_pct_per_year: z.number(),
  }),
  data_source_label: z.string(),
  manifest_generated_at: z.string().nullable(),
  summary: z.record(z.string(), z.unknown()).nullable(),
  regions: z.array(z.record(z.string(), z.unknown())).min(1),
});

/** Default for AI Studio / new keys; override with GEMINI_MODEL if Google changes availability. */
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

function extractJsonText(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  return t;
}

export const fetchSolarReportNarrative = createServerFn({ method: "POST" })
  .inputValidator(factsInputSchema)
  .handler(async ({ data }): Promise<SolarReportNarrativeResult> => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return {
        ok: false,
        error: "Narrative service API key is not set on the server.",
        code: "NO_API_KEY",
      };
    }

    const systemPrompt = `You are writing for decision-makers: city/county energy offices, economic development, sustainability leads, institutional investors, utilities, and program managers evaluating where solar deployment and related investment deliver the most public and commercial value.

The input JSON ("report_facts") combines a ZenPower-style regional snapshot with a simple interactive rooftop financial model (irradiance, urban heat, utility rate, optional Google sunshine fields). It is NOT an interconnection study, tariff filing, or site-specific engineering report.

Your job is strategic synthesis—NOT narrating the spreadsheet. Avoid repeating the same numbers region-by-region. At most one explicit numeric call-out per region when it changes a conclusion; prefer relative language (higher/lower vs bundle median, leaders/laggards).

Content rules:
- Ground arguments in the provided fields only. If modeled fields are null, say what cannot be concluded and what extra data would be needed (e.g. hosting capacity, queue depth, AHJ throughput, income-qualified uptake).
- Call out trade-offs: adoption vs modeled payback, inland irradiance vs heat derate, equity / access angles only when supported by adoption or savings signals—do not invent demographics.
- Speak to portfolios: sequencing incentives, outreach, workforce, bulk procurement, public buildings, community aggregation, or private C&I—choose what best fits the signals, not generic platitudes.
- Mention California/San Diego context only at a high level (e.g. rate pressure, coastal fog vs inland sun) when consistent with the numbers—no fabricated policy citations.
- Ratings 1–5 = relative attractiveness for modeled ROI / deployment momentum within THIS region list only.

Anti-patterns (do NOT):
- Open with a paragraph that restates each column for the whole table.
- Give generic "solar is good" filler.
- Provide legal, tax, or guaranteed savings promises.
- Name vendors, models, or automation (e.g. "AI", "machine learning", chatbots) in any output string; write as a neutral analyst memo.

Output strictly valid JSON (no markdown, no code fences) with this shape:
{
  "executive_summary": string — 4–6 sentences: cross-region story, tensions, and where leadership should focus first.
  "strategic_investment_brief": string — 8–14 sentences: reads like an internal memo (deployment strategy, capital/program alignment, who benefits, what to validate before scaling).
  "portfolio_program_priorities": string[] — 4–10 items; each item 1–2 sentences, actionable (e.g. "Prioritize technical assistance in … because …").
  "risks_constraints_and_limits": string — 5–8 sentences: model limits, data gaps, grid/program risks, and what would invalidate the ranking.
  "leading_indicators_to_monitor": string[] — 3–8 items; concrete metrics or studies (queue, permitting cycle times, incentive uptake, realized vs modeled savings studies, etc.—only as monitoring concepts, not fake measurements).
  "dataset_context": string (optional) — 1–3 sentences on what the snapshot covers and excludes.
  "regions": [
    {
      "region_id": string (must match input regions[].region_id),
      "rating_1_to_5": integer 1-5,
      "headline": string — decision-oriented, ≤14 words,
      "investment_angle": string — 5–8 sentences: why a public or private program/portfolio would overweight or underweight this sub-market vs alternatives in the bundle; tie to adoption, YoY, modeled payback/savings band, heat/sun/utility signals without re-listing all stats.
      "comparative_context": string — 2–3 sentences: position vs other areas in this dataset (leaders/laggards, outliers, clusters).
      "stakeholder_actions": string — 3–5 sentences: specific actions for agencies, utilities, or investors (RFPs, pilots, targeted rebates, permitting partnerships, measurement)—not homeowner roof-repair tips.
    }
  ]
}

You MUST include one regions[] entry for every region in the input, in the same order as input.regions, with matching region_id.`;

    const userPayload = JSON.stringify(data, null, 0);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Here is the report_facts JSON. Respond with JSON only.\n\n${userPayload}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.42,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      return { ok: false, error: msg, code: "GEMINI_HTTP" };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Narrative API HTTP ${res.status}: ${errText.slice(0, 400)}`,
        code: "GEMINI_HTTP",
      };
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return {
        ok: false,
        error: "Invalid narrative API response (not JSON).",
        code: "GEMINI_BODY",
      };
    }

    const parts = (body as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
      ?.candidates?.[0]?.content?.parts;
    const rawText = parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!rawText.trim()) {
      return { ok: false, error: "Empty model output.", code: "EMPTY" };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonText(rawText));
    } catch {
      return { ok: false, error: "Model output was not valid JSON.", code: "PARSE" };
    }

    const checked = solarReportAiInsightsSchema.safeParse(parsed);
    if (!checked.success) {
      return {
        ok: false,
        error: `JSON schema mismatch: ${checked.error.message.slice(0, 500)}`,
        code: "PARSE",
      };
    }

    const inputIds: string[] = [];
    for (const r of data.regions) {
      const id = r.region_id;
      if (typeof id !== "string" || !id) {
        return {
          ok: false,
          error: "Invalid facts payload: region missing region_id.",
          code: "PARSE",
        };
      }
      inputIds.push(id);
    }
    const outIds = checked.data.regions.map((r) => r.region_id);
    const missing = inputIds.filter((id) => !outIds.includes(id));
    if (missing.length) {
      return {
        ok: false,
        error: `Model omitted regions: ${missing.join(", ")}`,
        code: "PARSE",
      };
    }

    return { ok: true, insights: checked.data };
  });

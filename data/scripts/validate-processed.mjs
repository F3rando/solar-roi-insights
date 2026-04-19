#!/usr/bin/env node
/**
 * Validates processed v1 JSON against the same rules as src/types/api.ts (keep in sync).
 * Usage: node data/scripts/validate-processed.mjs [path/to/processed/v1]
 * Default: public/processed/v1 relative to cwd
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DEFAULT_DIR = path.join(ROOT, "public/processed/v1");

const BUCKET_INSTALL = new Set(["high", "medium", "low"]);

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

function isNum(x) {
  return typeof x === "number" && !Number.isNaN(x);
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function validateManifest(m, fname) {
  if (!m || typeof m !== "object") fail(`${fname}: not an object`);
  const req = ["version", "schema_version", "generated_at", "summary", "regions"];
  for (const k of req) {
    if (m[k] === undefined || m[k] === null) fail(`${fname}: missing "${k}"`);
  }
  if (typeof m.summary !== "string" || typeof m.regions !== "string")
    fail(`${fname}: summary and regions must be path strings`);
  if (typeof m.schema_version !== "number") fail(`${fname}: schema_version must be number`);
  ok(`${fname}: manifest shape`);
}

function validateSummary(s, fname) {
  if (!s?.scope || !s?.kpis || !s?.coverage) fail(`${fname}: need scope, kpis, coverage`);
  const { scope, kpis, coverage } = s;
  if (typeof scope.label !== "string" || typeof scope.geo_level !== "string")
    fail(`${fname}: scope.label / scope.geo_level`);
  const kk = [
    "total_estimated_installs",
    "total_capacity_mw",
    "median_payback_years",
    "est_co2_avoided_kt_per_year",
    "yoy_growth_pct",
  ];
  for (const k of kk) {
    if (!isNum(kpis[k])) fail(`${fname}: kpis.${k} must be a number`);
  }
  if (!isNum(coverage.regions_count) || !isNum(coverage.last_data_year))
    fail(`${fname}: coverage.regions_count / last_data_year`);
  ok(`${fname}: summary shape`);
}

function validateSolarInsights(si, p) {
  if (si === undefined) return;
  if (!si || typeof si !== "object") fail(`${p}: solar_insights must be an object`);
  const nk = ["max_sunshine_hours_per_year", "carbon_offset_factor_kg_per_mwh", "max_array_panels_count"];
  for (const k of nk) {
    if (si[k] !== undefined && !isNum(si[k])) fail(`${p}: solar_insights.${k} must be a number`);
  }
  if (si.imagery_quality !== undefined && typeof si.imagery_quality !== "string")
    fail(`${p}: solar_insights.imagery_quality must be a string`);
}

function validateRegions(r, fname) {
  if (!Array.isArray(r?.regions)) fail(`${fname}: regions must be an array`);
  for (let i = 0; i < r.regions.length; i++) {
    const row = r.regions[i];
    const p = `${fname} regions[${i}]`;
    if (typeof row.id !== "string" || typeof row.name !== "string") fail(`${p}: id/name`);
    if (!row.centroid || !isNum(row.centroid.lat) || !isNum(row.centroid.lon))
      fail(`${p}: centroid.lat / centroid.lon`);
    if (!isNum(row.adoption_index)) fail(`${p}: adoption_index`);
    if (!isNum(row.yoy_growth_pct)) fail(`${p}: yoy_growth_pct`);
    if (!isNum(row.median_est_annual_savings_usd)) fail(`${p}: median_est_annual_savings_usd`);
    if (!BUCKET_INSTALL.has(row.install_count_bucket))
      fail(`${p}: install_count_bucket must be high|medium|low`);
    validateSolarInsights(row.solar_insights, p);
  }
  ok(`${fname}: regions shape (${r.regions.length} rows)`);
}

async function main() {
  const dir = path.resolve(process.argv[2] || DEFAULT_DIR);
  let names;
  try {
    names = await readdir(dir);
  } catch (e) {
    return fail(`Cannot read ${dir}: ${e.message}`);
  }

  const need = ["manifest.json", "summary.json", "regions.json"];
  for (const n of need) {
    if (!names.includes(n)) fail(`Missing ${n} in ${dir}`);
  }

  const manifest = await readJson(path.join(dir, "manifest.json"));
  const summary = await readJson(path.join(dir, "summary.json"));
  const regions = await readJson(path.join(dir, "regions.json"));

  validateManifest(manifest, "manifest.json");
  validateSummary(summary, "summary.json");
  validateRegions(regions, "regions.json");

  console.log(`\nAll good: ${dir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

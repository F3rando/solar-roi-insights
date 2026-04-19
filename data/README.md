# Data pipeline (raw → notebooks → processed JSON)

This folder holds **how** you turn sponsor / public datasets into the **three files** the app and AWS API serve (`manifest`, `summary`, `regions`). The TypeScript contract is **`src/types/api.ts`**.

## Flow

```text
data/raw/          ← drop immutable extracts (git-ignored blobs)
     ↓
notebooks / scripts  ← clean, join, aggregate, map to region ids
     ↓
public/processed/v1/*.json   ← dev + Vite static fallback
     ↓
aws s3 sync …/processed/v1/  s3://BUCKET/processed/v1/   ← production
```

- **Audit / reproducibility:** copy `data/lineage/run_log.example.json` → `run_log.json`, add one entry per export (inputs used, notebook name, timestamp). `run_log.json` can be committed so the team shares lineage; keep huge raw files out of git.

- **Quality gate before PR or deploy:**

  ```bash
  npm run data:validate
  ```

- **Update the live API (S3 → Lambda):** set the bucket name (must match your Lambda `DATA_BUCKET`), then sync:

  ```bash
  export S3_METRICS_BUCKET=your-bucket-name
  npm run data:publish
  ```

  Full pipeline (ETL + validate + upload): **`npm run data:ship`** (needs `S3_METRICS_BUCKET` + AWS CLI configured). Dry run: `npm run data:publish -- --dryrun`.

- **Google Solar (optional):** put `GOOGLE_SOLAR_API_KEY` in `.env.local`, then run `python3 data/notebooks/aggregate_san_diego.py`. The script merges Building Insights fields into each row as `solar_insights` (no key in the frontend).

- **Datasets first?** You can add CSVs under `data/raw/` whenever — the **folder layout and validator** do not depend on specific columns. When you know the ZenPower schema, create `data/notebooks/01_explore.ipynb` and map columns → `SummaryV1` / `RegionRowV1`.

## Related

- API env: `.env.example` (`VITE_API_URL`)
- Lambda/S3 path: partner stack; keys stay `processed/v1/…`

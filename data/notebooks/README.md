# Analysis notebooks

## Primary ETL (San Diego slice)

- **`aggregate_san_diego.py`** — stdlib-only. Filters `data/raw/records.csv` to San Diego County, assigns each permit to the nearest zone (`sd_zones.py`), writes `public/processed/v1/*.json`.

  ```bash
  # from repo root
  python data/notebooks/aggregate_san_diego.py
  npm run data:validate
  ```

- **`01_san_diego_aggregate.ipynb`** — runs the same pipeline via `main()` (open in Jupyter / VS Code).

**Outputs must match** `src/types/api.ts` v1:

- `public/processed/v1/summary.json`
- `public/processed/v1/regions.json`
- `public/processed/v1/manifest.json`

Workflow:

1. Drop raw CSV into `data/raw/` (ignored by git).
2. Run the script or notebook.
3. `npm run data:validate`, then **`export S3_METRICS_BUCKET=…` + `npm run data:publish`** to refresh S3 for the API. Or **`npm run data:ship`** for ETL + validate + publish in one go.

Optional: use `requirements.txt` when you add pandas-heavy exploration notebooks.

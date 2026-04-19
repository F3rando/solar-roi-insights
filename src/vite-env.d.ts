/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API Gateway base URL (no trailing slash). Omit to load `/processed/v1/*.json` from `public/`. */
  readonly VITE_API_URL?: string;
  /** MapTiler Cloud key for MapLibre 3D terrain / vector styles. See `src/lib/maptiler.ts`. */
  readonly VITE_MAPTILER_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

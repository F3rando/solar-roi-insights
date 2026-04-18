/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API Gateway base URL (no trailing slash). Omit to load `/processed/v1/*.json` from `public/`. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ENCRYPTION?: string;
  readonly VITE_METRICS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
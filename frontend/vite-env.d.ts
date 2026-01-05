/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DB_TYPE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DB_HOST?: string;
  readonly VITE_DB_PORT?: string;
  readonly VITE_DB_NAME?: string;
  readonly VITE_DB_USER?: string;
  readonly VITE_DB_PASSWORD?: string;
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}





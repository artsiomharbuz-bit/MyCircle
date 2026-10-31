/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly EXPO_PUBLIC_SUPABASE_URL: string;
  readonly EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

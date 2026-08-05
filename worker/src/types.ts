export type Env = {
  DB: D1Database;
  // Optional so the app still deploys (documents disabled with a clear 503)
  // if the r2_buckets binding is removed on accounts without R2 enabled.
  DOCS?: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET?: string;
  NYC_APP_TOKEN?: string;
  CORS_ORIGINS?: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  company: string;
  created_at: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: { user: User };
};

export type Dict = Record<string, any>;

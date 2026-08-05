export type Env = {
  DB: D1Database;
  DOCS: R2Bucket;
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

export type Bindings = {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  SESSION_SECRET: string; // set with: wrangler secret put SESSION_SECRET
  PUBLIC_MEDIA_BASE_URL?: string;
};

export type Variables = {
  userId: string;
  isAdmin: boolean;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };

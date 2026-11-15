import { defineConfig } from "drizzle-kit";

// Used only for `drizzle-kit generate` (diffing worker/db/schema.ts into
// SQL migrations under /migrations). Actual migrations are applied with
// `wrangler d1 migrations apply`, not drizzle-kit push/migrate.
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./worker/db/schema.ts",
  out: "./migrations",
});

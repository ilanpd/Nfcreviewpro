import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 CLI config (migrations, introspection, `prisma db seed`).
// Uses the DIRECT (non-pooled) connection: PgBouncer's transaction mode
// (Supabase's default pooled DATABASE_URL) doesn't support the session-level
// features migrations rely on. The app itself connects separately at
// runtime via the PrismaPg adapter in src/lib/prisma.ts, using the pooled URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Plain process.env access (not the stricter `env()` helper) so
    // `prisma generate` still succeeds before real DB credentials exist —
    // e.g. right after scaffolding, or in a CI step that only type-checks.
    url: process.env["DIRECT_URL"],
  },
});

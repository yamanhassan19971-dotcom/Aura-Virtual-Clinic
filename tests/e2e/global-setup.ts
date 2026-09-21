import { execSync } from "node:child_process";

export default async function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://aura:aura_dev_pw@localhost:5432/aura_test";
  const env = { ...process.env, DATABASE_URL: databaseUrl };

  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed-e2e.ts", { stdio: "inherit", env });
}

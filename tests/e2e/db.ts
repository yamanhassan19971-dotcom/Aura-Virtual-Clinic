import { PrismaClient } from "@prisma/client";

// Matches the DATABASE_URL constant in playwright.config.ts. Hardcoded
// (rather than read from process.env) so this file works the same whether
// it's imported by the Playwright test runner process or a worker process —
// env vars set for the webServer's child process don't propagate here.
export const prisma = new PrismaClient({
  datasourceUrl: "postgresql://aura:aura_dev_pw@localhost:5432/aura_test",
});

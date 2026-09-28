import { defineRouting } from "next-intl/routing";

// AURA targets Syrian/Arabic-speaking dental practices first — Arabic is
// the primary language, English a secondary option. `localeDetection` is
// disabled so this is a deliberate product decision, not something a
// visitor's browser Accept-Language header can override.
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];

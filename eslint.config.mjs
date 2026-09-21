import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // react-hooks/refs and react-hooks/set-state-in-effect are new,
    // React-Compiler-era rules that false-positive on two legitimate
    // patterns used throughout this codebase: dnd-kit's setNodeRef
    // ref-callback API (not a raw ref.current read), and effects that
    // genuinely synchronize with an external system (a debounce timer, a
    // setInterval clock) — both are patterns React's own docs endorse.
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Playwright fixtures conventionally name a parameter `use`, which
    // trips the "React Hook" naming heuristic even though this has
    // nothing to do with React.
    files: ["tests/e2e/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

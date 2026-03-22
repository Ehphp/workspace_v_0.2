import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // STEP 2 — Architectural guard: no new client-side activity filtering by tech_category
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      // Known legacy (STEP 4 cleanup)
      // Known legacy (STEP 4 cleanup)
      "src/hooks/usePresetManagement.ts",
      "src/components/requirements/wizard/WizardStep2.tsx",
      // Canonical pipeline — reads tech_category to build API request payload, not for filtering
      "src/hooks/useQuickEstimationV2.ts",
      // Canonical helper — allowed
      "src/lib/technology-helpers.ts",
      // Display/CRUD — reads tech_category for UI labels, not estimation decisions
      "src/components/estimation/TechnologySection.tsx",
      "src/components/lists/EditListDialog.tsx",
      "src/components/lists/ListTechnologyDialog.tsx",
      "src/hooks/useActivityManagement.ts",
      // Domain persistence — passes through, not filtering
      "src/lib/api.ts",
      "src/lib/domain-save.ts",
      // Types/config/tests — structural, not logic
      "src/types/**",
      "src/test/**",
      "src/lib/mockData.ts",
      // Admin config pages — display/CRUD, not estimation
      "src/components/configuration/**",
      "src/pages/configuration/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='tech_category']",
          message: "[STEP 2] Do not use tech_category for decisions. Activity filtering must happen server-side via fetchActivitiesServerSide(). Use technology_id FK.",
        },
      ],
    },
  },
  // Style guardrails for pages — warn about patterns that should use shared components
  {
    files: ["src/pages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "JSXAttribute[name.name='className'][value.value=/min-h-screen/]",
          message: "Use <PageShell> instead of min-h-screen for page layout.",
        },
      ],
    },
  },
);

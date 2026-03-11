import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  {
    ignores: [
      "**/*.d.ts",
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
      "apps/api/openapi.yaml",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/dist/**", "@repo/*/dist/*"],
              message:
                "Do not import workspace build artifacts from source files. Import the package entrypoint instead.",
            },
            {
              group: ["@repo/*/src", "@repo/*/src/*"],
              message:
                "Do not import another workspace package's src files directly. Use the package entrypoint or declared exports.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/**/*.ts", "packages/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@repo/api", "@repo/api/*", "@repo/web", "@repo/web/*", "@repo/transcription", "@repo/transcription/*", "@/*"],
              message:
                "Packages must not import application code or app-local aliases. Keep package layers independent from apps.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/api/src/**/*.ts", "packages/core/src/**/*.ts", "packages/db/src/**/*.ts"],
    ignores: ["**/__tests__/**", "packages/db/src/scripts/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration[source.value=/^\\.{1,2}\\//]:not([source.value=/\\.js$/]):not([importKind='type'])",
          message:
            "Relative ESM runtime imports in these packages must use explicit .js extensions.",
        },
        {
          selector:
            "ExportNamedDeclaration[source.value=/^\\.{1,2}\\//]:not([source.value=/\\.js$/])",
          message: "Relative re-exports in these packages must use explicit .js extensions.",
        },
        {
          selector:
            "ExportAllDeclaration[source.value=/^\\.{1,2}\\//]:not([source.value=/\\.js$/])",
          message: "Relative re-exports in these packages must use explicit .js extensions.",
        },
      ],
    },
  },
);

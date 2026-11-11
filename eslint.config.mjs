import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import reactHooks from "eslint-plugin-react-hooks"

export default tseslint.config(
  { ignores: ["dist/**", "release/**", "outputs/**", "work/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: { globals: globals.node },
  },
  {
    // Test bundles reference identifiers that esbuild plugin stubs inject
    // only at load time (e.g. __calls placeholders in server/*.test.mjs).
    files: ["server/*.test.mjs"],
    rules: { "no-undef": "off" },
  },
)

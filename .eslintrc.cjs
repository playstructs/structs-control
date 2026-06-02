/**
 * ESLint config for structs-control.
 *
 * In addition to the standard rules, we encode the architectural rules from
 * docs/PATTERNS.md as `no-restricted-*` errors. Any agent (human or AI) that
 * runs `npm run lint` should see violations of these conventions immediately.
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  extends: ["eslint:recommended"],
  ignorePatterns: [
    "dist/",
    "node_modules/",
    "references/",
    "public/js/",
    "src/js/ts/",
  ],
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-console": ["warn", { allow: ["warn", "error", "info", "debug"] }],
    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.name='localStorage']",
        message: "Do not use localStorage. Mnemonic + auth go through store.session (sessionStorage). UI state goes in the URL.",
      },
      {
        selector: "MemberExpression[object.name='localStorage'][property.name='setItem']",
        message: "Do not write to localStorage. Use store.session (sessionStorage) for auth, URL state for UI.",
      },
    ],
  },
  overrides: [
    {
      // Outside api/, no direct fetch.
      files: ["src/js/**/*.js"],
      excludedFiles: [
        "src/js/api/**",
        "src/js/framework/JsonAjaxer.js",
        "src/js/framework/GrassManager.js",
      ],
      rules: {
        "no-restricted-globals": [
          "error",
          { name: "fetch", message: "Network access goes through src/js/api/GuildAPI.js (which uses framework/JsonAjaxer)." },
        ],
      },
    },
    {
      // No imports from references/ -- it's read-only.
      files: ["src/**/*.{js,ts}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["**/references/**", "../../../references/*", "references/*"],
                message: "references/ is read-only. Copy what you need into src/ and adapt it.",
              },
            ],
          },
        ],
      },
    },
    {
      // Test files: relax some rules.
      files: ["tests/**/*.js"],
      rules: { "no-restricted-syntax": "off" },
    },
  ],
};

// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'design_handoff_threatdoppler/*', 'supabase/functions/**'],
  },
  {
    files: ['jest.setup.js', '**/__tests__/**'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
]);

import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['en'],
  extract: {
    input: ['modules/**/*.{js,ts,tsx}', 'layers/shell/**/*.{js,ts,tsx}'],
    output: 'public/locales/{{language}}/{{namespace}}.json',
    nsSeparator: false,
    keySeparator: false,
    defaultValue: key => key,
    extractFromComments: false,
    sort: 'locize',
    ignoreNamespaces: ['languages'],
  },
});

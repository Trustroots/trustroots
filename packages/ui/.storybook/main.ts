import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig, type PluginOption } from 'vite';

import appConfig from '../../../vite.config.mts';

/*
 * Stories render with the app's own build setup: its Less options, path
 * aliases and Tailwind plugin, so a component looks the same here as on the
 * site. Storybook brings its own React plugin, so the app's is left out.
 */
const appPlugins = (appConfig.plugins ?? [])
  .flat()
  .filter(
    (plugin): plugin is PluginOption & { name: string } =>
      !!plugin &&
      typeof plugin === 'object' &&
      'name' in plugin &&
      /^(trustroots-legacy-|@tailwindcss\/)/.test(plugin.name),
  );

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  core: { disableTelemetry: true },
  viteFinal: storybookConfig =>
    mergeConfig(storybookConfig, {
      plugins: appPlugins,
      resolve: { alias: appConfig.resolve?.alias },
      css: appConfig.css,
    }),
};

export default config;

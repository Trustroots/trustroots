import { createContext, useContext } from 'react';

import type { AuthUser } from './auth';

export type BootstrapData = {
  env?: string;
  isNativeMobileApp?: boolean;
  settings: NonNullable<Window['settings']>;
  title: string;
  user: AuthUser | null;
};

export const AppBootstrapContext = createContext<BootstrapData | null>(null);

export function useBootstrapData(): BootstrapData {
  const bootstrapData = useContext(AppBootstrapContext);
  if (!bootstrapData) {
    throw new Error('useBootstrapData must be used within AppProviders');
  }
  return bootstrapData;
}

export function useSettings(): BootstrapData['settings'] {
  return useBootstrapData().settings;
}

export function useAppConfig() {
  const { env, isNativeMobileApp, title } = useBootstrapData();
  return { env, isNativeMobileApp, title };
}

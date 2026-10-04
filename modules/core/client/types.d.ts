interface Window {
  user?: {
    _id?: string;
    id?: string;
    public?: boolean;
    roles?: string[];
    username?: string;
    languages?: string[];
    [key: string]: unknown;
  } | null;
  settings?: {
    mapbox?: { publicKey?: string };
    flashTimeout?: number;
    limits?: { maximumExperienceFeedbackPublicLength?: number };
    maxUploadSize?: number;
    profileMinimumLength?: number;
    referencesEnabled?: boolean;
    [key: string]: unknown;
  };
  env?: string;
  gaId?: string;
  title?: string;
  isNativeMobileApp?: boolean;
  ga?: (...args: unknown[]) => void;
}

declare const process: {
  env: Record<string, string | undefined>;
};

declare module '*.svg' {
  const url: string;
  export default url;
}

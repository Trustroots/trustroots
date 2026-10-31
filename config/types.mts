import type { ConnectOptions } from 'mongoose';
import type { MailMessage } from 'nodemailer';

export interface DatabaseConfig {
  uri: string;
  options: Omit<ConnectOptions, 'auth'> & {
    auth?: ConnectOptions['auth'] | { authMechanism: string };
  };
  debug: boolean;
  autoIndex: boolean;
  checkCompatibility: boolean;
  uploadTmpDir?: string;
}

export interface Config {
  geoip: { databasePath: string };
  featureFlags: Record<string, boolean>;
  app: { title: string; description: string };
  siteAnnouncement: { enabled: boolean; message: string };
  maxUploadSize: number;
  maxAvatarUploadSize: number;
  imageProcessor: 'graphicsmagick' | 'imagemagick' | 'imagemagic';
  uploadTmpDir: string;
  uploadDir: string;
  circleImagesDir: string;
  port: number;
  host: string;
  fd: number | null;
  https: boolean;
  sessionProxy: boolean;
  sessionSecret: string;
  sessionCollection: string;
  domain: string;
  csrfAllowedOrigins: string[];
  supportEmail: string;
  supportVolunteerNames: string[];
  supportInbox: {
    enabled: boolean;
    fromName: string;
    fromAddress: string;
    imap: {
      enabled: boolean;
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password: string;
      mailbox: string;
      pollIntervalMinutes: number;
      maxMessageBytes: number;
      maxStoredBodyBytes: number;
      maxMessagesPerPoll: number;
    };
  };
  surveyReactivateHosts: string | false;
  profileMinimumLength: number;
  illegalStrings: string[];
  sparkpostWebhook: { enabled: boolean; username: string; password: string };
  influxdb: {
    enabled: boolean;
    options: {
      host: string;
      port: number;
      protocol: 'http' | 'https';
      database: string;
      username?: string;
      password?: string;
      pool?: { requestTimeout?: number; maxRetries?: number };
    };
  };
  targetedRequestLimits: Record<
    string,
    { windowMs: number; ipLimit: number; identityLimit: number }
  >;
  limits: {
    maximumExperienceFeedbackPublicLength: number;
    longMessageMinimumLength: number;
    messagesToIndividualsThrottle: {
      duration: Record<string, number>;
      count: number;
    };
    maxSignupReminders: number;
    maxProcessSignupReminders: number;
    timeToReactivateHosts: Record<string, number>;
    timeToReplyExperience: Record<string, number>;
    timeToUpdateLastSeenUser: Record<string, number>;
    unreadMessageReminders: Record<string, number>[];
    unreadMessageRemindersTooLate: Record<string, number>;
    paginationLimit: number;
    welcomeSequence: Record<string, Record<string, number>>;
    maxOfferValidFromNow: Record<string, number>;
  };
  mailer: {
    from: string;
    options: {
      service?: string | false;
      host?: string;
      port?: number;
      secure?: boolean;
      url?: string;
      streamTransport?: boolean;
      sendmail?: boolean;
      auth?: { user: string | false; pass: string | false };
      jsonTransport?: boolean;
      name?: string;
      version?: string;
      logger?: boolean;
      send?: (
        mail: MailMessage,
        callback: (error?: Error | null, info?: unknown) => void,
      ) => void;
    };
  };
  mapbox: {
    maps?: Record<string, { map: string; user: string; legacy: boolean }>;
    map?: Record<string, boolean | number>;
    user: string;
    publicKey: string;
  };
  twitter: { username: string };
  google: { page: string };
  webPush: {
    publicKey: string;
    privateKey: string;
    subject: string;
    allowedHosts: string[];
  };
  umami: { scriptSrc: string; websiteId: string };
  db: DatabaseConfig;
  files: {
    server: {
      models: string[];
      routes: string[];
      configs: string[];
      policies: string[];
    };
  };
  utils: {
    getGlobbedPaths: (
      patterns: string | string[],
      excludes?: string | string[],
    ) => string[];
  };
}

export type DefaultConfig = Omit<Config, 'db' | 'files' | 'utils'>;
export type ConfigOverrides = Partial<DefaultConfig> & { db?: DatabaseConfig };
export type DeepPartial<T> = T extends readonly (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

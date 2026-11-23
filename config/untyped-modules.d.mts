declare module 'append-field' {
  export default function appendField(
    fields: Record<string, unknown>,
    name: string,
    value: string,
  ): void;
}

declare module 'passport' {
  interface AuthenticationInfo {
    message?: string;
  }

  interface PassportAuthenticator {
    use(strategy: unknown): void;
    initialize(): import('express').RequestHandler;
    session(): import('express').RequestHandler;
    serializeUser<User>(
      handler: (
        user: User,
        done: (error: Error | null, session: unknown) => void,
      ) => void,
    ): void;
    deserializeUser<Session, User>(
      handler: (
        session: Session,
        done: (error: Error | null, user: User | false | null) => void,
      ) => void,
    ): void;
    authenticate<User>(
      strategy: string,
      callback: (
        error: Error | null,
        user: User | null | false,
        info?: AuthenticationInfo,
      ) => void,
    ): (req: unknown, res: unknown, next: (error?: Error) => void) => unknown;
  }

  const passport: PassportAuthenticator;
  export default passport;
}

declare module 'passport-local' {
  interface AuthenticationInfo {
    message?: string;
  }

  type VerifyCallback = (
    error: Error | null,
    user?: unknown | false | null,
    info?: AuthenticationInfo,
  ) => void;

  type VerifyFunction = (
    username: unknown,
    password: unknown,
    done: VerifyCallback,
  ) => void;

  interface StrategyOptions {
    usernameField?: string;
    passwordField?: string;
  }

  export class Strategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
  }

  const passportLocal: { Strategy: typeof Strategy };
  export default passportLocal;
}

declare module 'speakingurl' {
  export default function speakingurl(
    text: string,
    options?: Record<string, unknown>,
  ): string;
}

declare module 'sanitize-html' {
  export interface SanitizeFrame {
    tag: string;
    text: string;
    attribs: Record<string, string>;
  }
  export interface SanitizeOptions {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    transformTags?: Record<string, string>;
    exclusiveFilter?: (frame: SanitizeFrame) => boolean;
    selfClosing?: string[];
    allowProtocolRelative?: boolean;
    allowedSchemesByTag?: Record<string, string[]>;
  }
  export default function sanitizeHtml(
    content: string,
    options?: SanitizeOptions,
  ): string;
}

declare module 'semver' {
  export function valid(version: string): string | null;
  export function satisfies(version: string, range: string): boolean;
  const semver: { satisfies: typeof satisfies; valid: typeof valid };
  export default semver;
}

declare module 'html-to-text' {
  export function htmlToText(
    text: string,
    options?: { wordwrap?: number },
  ): string;
}

declare module 'validator' {
  export function isEmail(text: string): boolean;
  export function isFQDN(text: string): boolean;
  export function isLength(
    value: unknown,
    options: { min?: number; max?: number } | number,
  ): boolean;
  export function isURL(
    text: string,
    options?: Record<string, unknown>,
  ): boolean;
  const validator: {
    isEmail: typeof isEmail;
    isFQDN: typeof isFQDN;
    isLength: typeof isLength;
    isURL: typeof isURL;
  };
  export default validator;
}

declare module 'he' {
  export function decode(content: string): string;
}

declare module 'qs' {
  const qs: {
    stringify(values: Record<string, unknown>): string;
    parse(value: string): Record<string, unknown>;
  };
  export default qs;
}

declare module 'compression' {
  export default function compression(options: {
    filter(
      req: import('express').Request,
      res: import('express').Response,
    ): boolean;
    level: number;
  }): import('express').RequestHandler;
}

declare module 'express-session' {
  export default function session(options: {
    saveUninitialized: boolean;
    resave: boolean;
    secret: string;
    proxy: boolean;
    cookie: {
      secure: boolean;
      httpOnly: boolean;
      sameSite: 'lax';
      maxAge: number;
    };
    store: object;
  }): import('express').RequestHandler;
}

declare module 'web-push' {
  interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }
  interface SendOptions {
    TTL?: number;
  }
  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string,
  ): void;
  export function sendNotification(
    subscription: PushSubscription,
    payload: string,
    options?: SendOptions,
  ): Promise<unknown>;
}

declare module 'async' {
  export function map<T>(
    items: T[],
    iteratee: (item: T, callback: (error?: Error | null) => void) => void,
    callback: (error?: Error | null) => void,
  ): void;
  export function waterfall(
    tasks: Array<(...args: never[]) => void>,
    callback?: (error?: Error | null, ...results: unknown[]) => void,
  ): void;
  export function each<T>(
    items: T[],
    iteratee: (item: T, callback: (error?: Error | null) => void) => void,
    callback?: (error?: Error | null) => void,
  ): void;
  export function parallel<Result extends Record<string, unknown>>(
    tasks: {
      [Key in keyof Result]: (
        callback: (error?: Error | null, result?: Result[Key]) => void,
      ) => void;
    },
    callback: (error: Error | null, results: Result) => void,
  ): void;
  export function eachSeries<Item>(
    items: Item[],
    iteratee: (item: Item, callback: (error?: Error | null) => void) => void,
    callback?: (error?: Error | null) => void,
  ): void;
  export function eachOfSeries<Items extends object>(
    items: Items extends readonly unknown[] ? never : Items,
    iteratee: (
      value: Items[keyof Items],
      key: Extract<keyof Items, string>,
      callback: (error?: Error | null) => void,
    ) => void,
    callback: (error?: Error | null) => void,
  ): void;
  export function eachOfSeries<Value>(
    items: Value[],
    iteratee: (
      value: Value,
      key: number,
      callback: (error?: Error | null) => void,
    ) => void,
    callback: (error?: Error | null) => void,
  ): void;
  export function mapValuesSeries<T, R>(
    values: Record<string, T>,
    iteratee: (
      value: T,
      key: string,
      callback: (error: Error | null, result: R) => void,
    ) => void,
    callback: (error: Error | null, result: Record<string, R>) => void,
  ): void;
  export function nextTick(callback: () => void): void;
  export function queue<T>(
    worker: (task: T, callback: (error?: Error | null) => void) => void,
    concurrency: number,
  ): {
    length(): number;
    push(task: T | T[]): void;
    error(handler: (error: Error, task: T) => void): void;
    drain(callback?: () => void): void;
  };
  const async: {
    map: typeof map;
    each: typeof each;
    mapValuesSeries: typeof mapValuesSeries;
    nextTick: typeof nextTick;
    waterfall: typeof waterfall;
    parallel: typeof parallel;
    eachSeries: typeof eachSeries;
    eachOfSeries: typeof eachOfSeries;
    each: typeof each;
    queue: typeof queue;
  };
  export default async;
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
    isLength: typeof isLength;
    isURL: typeof isURL;
  };
  export default validator;
}

declare module 'he' {
  export function decode(content: string): string;
}

declare module 'juice' {
  export default function juice(html: string): string;
}

declare module 'qs' {
  const qs: {
    stringify(values: Record<string, unknown>): string;
    parse(value: string): Record<string, unknown>;
  };
  export default qs;
}

declare module 'multer' {
  interface UploadedFile {
    buffer: Buffer;
    originalname: string;
  }
  interface UploadRequest {
    file?: UploadedFile;
  }
  interface MulterError extends Error {
    code?: string;
  }
  type FileFilterCallback = (error: Error | null, acceptFile?: boolean) => void;
  type UploadCallback = (error: MulterError | null) => void;
  interface Multer {
    single(
      fieldName: string,
    ): (req: UploadRequest, res: unknown, callback: UploadCallback) => void;
  }
  function multer(options: {
    limits?: { fileSize?: number };
    storage: object;
    fileFilter(
      req: object,
      file: { originalname: string },
      callback: FileFilterCallback,
    ): void;
  }): Multer;
  function multer(options: {
    dest: string;
    limits: { fileSize: number; files: number; fields: number; parts: number };
    fileFilter(
      req: object,
      file: { mimetype?: string },
      callback: FileFilterCallback,
    ): void;
  }): {
    single(
      fieldName: string,
    ): (
      req: { file?: { path?: string } },
      res: unknown,
      callback: UploadCallback,
    ) => void;
  };
  namespace multer {
    function memoryStorage(): object;
  }
  export default multer;
}

declare module 'nunjucks' {
  interface Environment {
    addFilter(name: string, filter: (value: unknown) => string): void;
  }
  interface Renderer {
    (
      template: string,
      context: object,
      callback: (error: Error | null, result?: string) => void,
    ): void;
    (template: string, context?: object): string;
  }
  const nunjucks: {
    configure(
      path: string,
      options: {
        watch: boolean;
        noCache: boolean;
        express?: import('express').Express;
      },
    ): Environment;
    render: Renderer;
  };
  export default nunjucks;
}

declare module 'morgan' {
  export default function morgan(
    format: string,
  ): import('express').RequestHandler;
}

declare module 'serve-favicon' {
  export default function favicon(
    path: string,
  ): import('express').RequestHandler;
}

declare module 'cookie-parser' {
  export default function cookieParser(): import('express').RequestHandler;
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
  const webPush: {
    setVapidDetails(
      subject: string,
      publicKey: string,
      privateKey: string,
    ): void;
    sendNotification(
      subscription: PushSubscription,
      payload: string,
      options?: SendOptions,
    ): Promise<unknown>;
  };
  export default webPush;
}

declare module 'gm' {
  import type { EventEmitter } from 'node:events';

  export interface Command {
    options(options: { timeout: number }): this;
    addDisposer(emitter: EventEmitter, events: string[]): this;
    command(name: string): this;
    in(...args: Array<string | number>): this;
    toBuffer(
      callback: (error: Error | null, output: Buffer | null) => void,
    ): this;
    identify(
      options: { format: string },
      callback: (error: Error | null, output: string) => void,
    ): this;
    autoOrient(): this;
    noProfile(): this;
    colorspace(value: string): this;
    interlace(value: string): this;
    filter(value: string): this;
    resize(width: number, height: string): this;
    gravity(value: string): this;
    extent(width: number, height: number): this;
    unsharp(
      radius: number,
      sigma: number,
      amount: number,
      threshold: number,
    ): this;
    quality(value: number): this;
    write(path: string, callback: (error?: Error | null) => void): this;
  }

  interface GraphicsMagick {
    (source: string | null): Command;
    subClass(options: { imageMagick: boolean }): GraphicsMagick;
  }

  const gm: GraphicsMagick;
  export default gm;
}

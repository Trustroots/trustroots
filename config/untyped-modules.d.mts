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
    callback: (error?: Error | null) => void,
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
  const async: {
    map: typeof map;
    waterfall: typeof waterfall;
    parallel: typeof parallel;
    eachSeries: typeof eachSeries;
    eachOfSeries: typeof eachOfSeries;
  };
  export default async;
}

declare module 'basic-auth' {
  export default function basicAuth(
    req: import('http').IncomingMessage,
  ): { name: string; pass: string } | undefined;
}

declare module 'mongoose-paginate' {
  export default function mongoosePaginate(
    schema: import('mongoose').Schema,
  ): void;
}

declare module 'mongoose-url-slugs' {
  export default function urlSlugs(
    source: string,
    options: {
      field: string;
      generator(value: string): string;
    },
  ): (schema: import('mongoose').Schema) => void;
}

declare module 'speakingurl' {
  export default function speakingurl(
    text: string,
    options?: Record<string, unknown>,
  ): string;
}

declare module 'sanitize-html' {
  export default function sanitizeHtml(
    text: string,
    options?: Record<string, unknown>,
  ): string;
}

declare module 'semver' {
  export function satisfies(version: string, range: string): boolean;
  const semver: { satisfies: typeof satisfies };
  export default semver;
}

declare module 'html-to-text' {
  export function htmlToText(
    text: string,
    options?: { wordwrap?: number },
  ): string;
  const htmlToTextModule: { htmlToText: typeof htmlToText };
  export default htmlToTextModule;
}

declare module 'validator' {
  export function isEmail(text: string): boolean;
  export function isURL(
    text: string,
    options?: Record<string, unknown>,
  ): boolean;
  const validator: { isEmail: typeof isEmail; isURL: typeof isURL };
  export default validator;
}

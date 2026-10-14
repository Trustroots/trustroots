declare module 'async' {
  export function map<T>(
    items: T[],
    iteratee: (item: T, callback: (error?: Error | null) => void) => void,
    callback: (error?: Error | null) => void,
  ): void;
  const async: { map: typeof map };
  export default async;
}

declare module 'basic-auth' {
  export default function basicAuth(
    req: import('http').IncomingMessage,
  ): { name: string; pass: string } | undefined;
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
  const validator: { isEmail: typeof isEmail };
  export default validator;
}

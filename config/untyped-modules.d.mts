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

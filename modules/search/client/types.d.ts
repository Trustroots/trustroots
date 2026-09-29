declare module 'nostr-tools/relay' {
  export { Relay } from 'nostr-tools';
}

declare module 'open-location-code' {
  export class OpenLocationCode {
    decode(code: string): {
      latitudeCenter: number;
      longitudeCenter: number;
    };
  }
}

declare module '*.svg' {
  const source: string;
  export default source;
}

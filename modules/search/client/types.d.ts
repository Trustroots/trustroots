declare module 'nostr-tools/relay' {
  export { Relay } from 'nostr-tools';
}

declare module 'open-location-code' {
  export class OpenLocationCode {
    encode(latitude: number, longitude: number, codeLength?: number): string;
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

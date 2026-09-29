declare module 'nostr-tools/relay' {
  export { Relay, Subscription } from 'nostr-tools';
}

declare module 'open-location-code' {
  export class OpenLocationCode {
    decode(code: string): {
      latitudeCenter: number;
      longitudeCenter: number;
    };
  }
}

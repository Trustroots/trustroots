declare module 'open-location-code' {
  export class OpenLocationCode {
    encode(latitude: number, longitude: number, codeLength?: number): string;
  }
}

declare module 'faker' {
  export interface FakerApi {
    datatype: {
      boolean(): boolean;
    };
    internet: {
      color(): string;
      email(): string;
      password(): string;
      url(): string;
      userName(): string;
    };
    lorem: {
      sentences(): string;
      word(): string;
    };
    name: {
      findName(): string;
      firstName(): string;
      lastName(): string;
    };
    random: {
      words(): string;
    };
  }

  const faker: FakerApi;
  export default faker;
}

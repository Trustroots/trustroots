export interface PolicyUser {
  roles?: string[];
  public?: boolean;
  mfaEnabled?: boolean;
  $locals?: { mfaVerified?: boolean };
  _id: {
    valueOf(): unknown;
    equals?(id: unknown): boolean;
  };
}

export interface PolicyResponse {
  status(code: number): PolicyResponse;
  json(body: { message: string }): unknown;
}

export interface PolicyRequest {
  user?: PolicyUser;
  route: { path: string };
  method: string;
}

export type PolicyNext = (error?: unknown) => unknown;

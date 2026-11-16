export interface PolicyRule {
  roles: string[];
  allows: Array<{
    resources: string;
    permissions: string | string[];
  }>;
}

export type PolicyDecisionCallback = (
  error: Error | null,
  allowed: boolean,
) => unknown;

export interface MemoryPolicy {
  allow(rules: PolicyRule[]): void;
  areAnyRolesAllowed(
    roles: string[],
    resource: string,
    permission: string,
  ): Promise<boolean>;
  areAnyRolesAllowed(
    roles: string[],
    resource: string,
    permission: string,
    callback: PolicyDecisionCallback,
  ): unknown;
}

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
  send(body: { message: string }): unknown;
}

export interface PolicyRequest {
  user?: PolicyUser;
  route: { path: string };
  method: string;
}

export type PolicyNext = (error?: unknown) => unknown;

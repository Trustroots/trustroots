import axios from '../../../core/client/api/http-client.js';

export interface MfaStatus {
  enabled: boolean;
  recoveryCodesRemaining: number;
}

export interface MfaSetup {
  provisioningUri: string;
  expires: string;
}

export interface MfaRecoveryCodes {
  recoveryCodes: string[];
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const { data } = await axios.get('/api/users/mfa');
  return data;
}

export async function beginMfaEnrollment(
  currentPassword: string,
): Promise<MfaSetup> {
  const { data } = await axios.post('/api/users/mfa/enrol', {
    currentPassword,
  });
  return data;
}

export async function verifyMfaEnrollment(
  code: string,
): Promise<
  MfaRecoveryCodes & { enabled: true; user: Record<string, unknown> }
> {
  const { data } = await axios.post('/api/users/mfa/enrol/verify', { code });
  return data;
}

export async function regenerateMfaRecoveryCodes(
  currentPassword: string,
  code: string,
): Promise<MfaRecoveryCodes> {
  const { data } = await axios.post('/api/users/mfa/recovery-codes', {
    currentPassword,
    code,
  });
  return data;
}

export async function disableMfa(
  currentPassword: string,
  code: string,
): Promise<{ enabled: false }> {
  const { data } = await axios.post('/api/users/mfa/disable', {
    currentPassword,
    code,
  });
  return data;
}

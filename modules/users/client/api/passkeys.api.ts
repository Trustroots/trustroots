import {
  startRegistration,
  startAuthentication,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import axios from '../../../core/client/api/http-client.js';
import type { AuthenticatedUser } from './auth.api';

export interface MemberPasskey {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
}

export async function getPasskeys(): Promise<MemberPasskey[]> {
  const { data } = await axios.get('/api/users/passkeys');
  return data;
}

export async function registerPasskey(
  currentPassword: string,
  code: string,
  label: string,
): Promise<void> {
  const { data } = await axios.post<{
    ceremonyId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>('/api/users/passkeys/register/options', { currentPassword, code, label });
  const response = await startRegistration({ optionsJSON: data.options });
  await axios.post('/api/users/passkeys/register/verify', {
    ceremonyId: data.ceremonyId,
    response,
  });
}

export async function signinWithPasskey(): Promise<AuthenticatedUser> {
  const { data } = await axios.post<{
    ceremonyId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  }>('/api/auth/passkeys/options', {});
  const response = await startAuthentication({ optionsJSON: data.options });
  const result = await axios.post<AuthenticatedUser>(
    '/api/auth/passkeys/verify',
    { ceremonyId: data.ceremonyId, response },
  );
  return result.data;
}

export async function removePasskey(
  id: string,
  currentPassword: string,
  code: string,
): Promise<void> {
  await axios.delete('/api/users/passkeys/' + encodeURIComponent(id), {
    data: { currentPassword, code },
  });
}

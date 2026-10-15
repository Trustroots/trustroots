import axios from '../../../core/client/api/http-client.js';
import type {
  MiniProfile,
  OwnProfile,
  PublicProfile,
  UpdateProfileRequest,
} from '../../shared/profile.js';
import type { ClientOwnProfile } from '../types.js';

export type UserUpdate = UpdateProfileRequest;

export interface PasswordChangeResult {
  user: ClientOwnProfile;
}

export interface ProfileRemovalResult {
  message?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  verifyPassword: string;
}

export interface ChangeEmailInput {
  email: string;
  currentPassword: string;
  mfaCode?: string;
}

export async function update(data: UserUpdate): Promise<OwnProfile> {
  const { data: user } = await axios.put<OwnProfile>('/api/users', data);
  return user;
}

export async function changeEmail({
  email,
  currentPassword,
  mfaCode,
}: ChangeEmailInput): Promise<OwnProfile> {
  const { data: user } = await axios.post<OwnProfile>(
    '/api/users/email-change',
    {
      email,
      currentPassword,
      mfaCode,
    },
  );
  return user;
}

export async function cancelEmailChange(): Promise<OwnProfile> {
  const { data: user } = await axios.delete<OwnProfile>(
    '/api/users/email-change',
  );
  return user;
}

export async function fetch(
  username: string,
): Promise<PublicProfile | OwnProfile> {
  const { data: user } = await axios.get<PublicProfile | OwnProfile>(
    `/api/users/${username}`,
  );
  return user;
}

export async function fetchMini(userId: string): Promise<MiniProfile> {
  const { data: user } = await axios.get<MiniProfile>(
    `/api/users/mini/${userId}`,
  );
  return user;
}

export async function uploadAvatar(file: File): Promise<void> {
  const formData = new FormData();
  formData.append('avatar', file);
  await axios.post('/api/users-avatar', formData, {
    timeout: 120000,
  });
}

export async function changePassword({
  currentPassword,
  newPassword,
  verifyPassword,
}: ChangePasswordInput): Promise<PasswordChangeResult> {
  const { data } = await axios.post('/api/users/password', {
    currentPassword,
    newPassword,
    verifyPassword,
  });
  return data;
}

export async function resendEmailConfirmation(): Promise<void> {
  await axios.post('/api/auth/resend-confirmation');
}

export async function removeProfile(): Promise<ProfileRemovalResult> {
  const { data } = await axios.delete('/api/users');
  return data;
}

export async function removeSocialAccount(
  provider: string,
): Promise<ClientOwnProfile> {
  const { data } = await axios.delete<ClientOwnProfile>(
    `/api/users/accounts/${provider}`,
  );
  return data;
}

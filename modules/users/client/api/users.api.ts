import axios from '../../../core/client/api/http-client.js';
import type {
  MiniProfile,
  OwnProfile,
  PublicProfile,
  UpdateProfileRequest,
} from '../../shared/profile.js';
import type { ClientOwnProfile } from '../types.js';

export type UserUpdate = UpdateProfileRequest;

export async function nostrChallenge(nostrNpub: string) {
  const { data } = await axios.post<{
    event: import('nostr-tools').EventTemplate;
  }>('/api/users/nostr/challenge', { nostrNpub });
  return data.event;
}

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

export async function update(data: UserUpdate): Promise<OwnProfile> {
  const { data: user } = await axios.put<OwnProfile>('/api/users', data);
  return user;
}

export async function fetch(
  username: string,
): Promise<PublicProfile | OwnProfile> {
  // 404 is a removed, blocked or unknown member; profiles and threads show that.
  const { data: user } = await axios.get<PublicProfile | OwnProfile>(
    `/api/users/${username}`,
    { expectedStatuses: [404] },
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

export async function cancelEmailChange(
  newEmail: string,
): Promise<{ currentEmail: string }> {
  const { data } = await axios.post('/api/auth/cancel-email-change', {
    newEmail,
  });
  return data;
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

export interface ProfileRemovalStatus {
  pending: boolean;
}

export async function getProfileRemovalStatus(): Promise<ProfileRemovalStatus> {
  const { data } = await axios.get<ProfileRemovalStatus>(
    '/api/users/removal/pending',
  );
  return data;
}

export async function cancelProfileRemoval(): Promise<ProfileRemovalStatus> {
  const { data } = await axios.delete<ProfileRemovalStatus>(
    '/api/users/removal/pending',
  );
  return data;
}

import axios from '../../../core/client/api/http-client.js';
import type {
  ContactConfirmation,
  ContactListEntry,
  ContactRecord,
} from '../types';
import { readApiError } from '@/modules/users/client/utils/api-error';

export interface ContactRequest {
  friendUserId: string;
  message?: string;
}

export async function remove(contactId: string): Promise<void> {
  await axios.delete(`/api/contact/${contactId}`);
}

export async function getContactsCommon(
  id: string,
): Promise<ContactListEntry[]> {
  const { data } = await axios.get(`/api/contacts/${id}/common`);
  return data;
}

export async function getByUserId(
  userId: string,
): Promise<ContactRecord | null> {
  try {
    const { data } = await axios.get(`/api/contact-by/${userId}`);
    return data;
  } catch (error: unknown) {
    if (readApiError(error).status === 404) return null;
    throw error;
  }
}

export async function getByContactId(
  contactId: string,
): Promise<ContactConfirmation> {
  const { data } = await axios.get(`/api/contact/${contactId}`);
  return data;
}

export async function list(listUserId: string): Promise<ContactListEntry[]> {
  const { data } = await axios.get(`/api/contacts/${listUserId}`);
  return data;
}

export async function create({
  friendUserId,
  message,
}: ContactRequest): Promise<ContactRecord> {
  const { data } = await axios.post('/api/contact', { friendUserId, message });
  return data;
}

export async function confirm(contactId: string): Promise<ContactRecord> {
  const { data } = await axios.put(`/api/contact/${contactId}`, {
    confirm: true,
  });
  return data;
}

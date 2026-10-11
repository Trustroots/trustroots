import axios, { type AxiosResponse } from 'axios';

import {
  confirm,
  create,
  getByContactId,
  getByUserId,
  getContactsCommon,
  list,
  remove,
} from '@/modules/contacts/client/api/contacts.api';
import type {
  ContactConfirmation,
  ContactListEntry,
  ContactRecord,
} from '@/modules/contacts/client/types';
import type { UserProfile } from '@/modules/users/client/types';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

const axiosMock = jest.mocked(axios);
const AxiosHeaders =
  jest.requireActual<typeof import('axios')>('axios').AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

const user: UserProfile = {
  _id: 'user-1',
  username: 'member-one',
  displayName: 'Member One',
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('contacts api', () => {
  it('removes a contact', async () => {
    axiosMock.delete.mockResolvedValueOnce(response(undefined));

    await remove('contact-1');
    expect(axiosMock.delete).toHaveBeenCalledWith('/api/contact/contact-1');
  });

  it('fetches contacts in common', async () => {
    const data: ContactListEntry[] = [
      {
        _id: 'contact-1',
        confirmed: true,
        created: '2025-01-02T00:00:00.000Z',
        user,
      },
    ];
    axiosMock.get.mockResolvedValueOnce(response(data));

    await expect(getContactsCommon('user-1')).resolves.toBe(data);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/contacts/user-1/common');
  });

  it('returns null when a contact by user id is missing', async () => {
    axiosMock.get.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(getByUserId('missing-user')).resolves.toBeNull();
  });

  it('rethrows unexpected errors when fetching by user id', async () => {
    const error = { response: { status: 500 } };
    axiosMock.get.mockRejectedValueOnce(error);

    await expect(getByUserId('user-1')).rejects.toBe(error);
  });

  it('fetches an existing contact by user id', async () => {
    const contact: ContactRecord = {
      _id: 'contact-1',
      confirmed: true,
      user,
    };
    axiosMock.get.mockResolvedValueOnce(response(contact));

    await expect(getByUserId('user-2')).resolves.toBe(contact);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/contact-by/user-2');
  });

  it('fetches a contact by contact id', async () => {
    const contact: ContactConfirmation = {
      _id: 'contact-1',
      userFrom: user,
      userTo: { ...user, _id: 'user-2', username: 'member-two' },
    };
    axiosMock.get.mockResolvedValueOnce(response(contact));

    await expect(getByContactId('contact-1')).resolves.toBe(contact);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/contact/contact-1');
  });

  it('lists contacts for a user', async () => {
    const contacts: ContactListEntry[] = [
      {
        _id: 'contact-1',
        confirmed: true,
        created: '2025-01-02T00:00:00.000Z',
        user,
      },
    ];
    axiosMock.get.mockResolvedValueOnce(response(contacts));

    await expect(list('user-1')).resolves.toBe(contacts);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/contacts/user-1');
  });

  it('creates a contact request', async () => {
    const contact: ContactRecord = { _id: 'contact-2' };
    axiosMock.post.mockResolvedValueOnce(response(contact));

    await expect(
      create({ friendUserId: 'user-2', message: 'Hello!' }),
    ).resolves.toBe(contact);
    expect(axiosMock.post).toHaveBeenCalledWith('/api/contact', {
      friendUserId: 'user-2',
      message: 'Hello!',
    });
  });

  it('confirms a contact request', async () => {
    const contact: ContactRecord = { _id: 'contact-2', confirmed: true };
    axiosMock.put.mockResolvedValueOnce(response(contact));

    await expect(confirm('contact-2')).resolves.toBe(contact);
    expect(axiosMock.put).toHaveBeenCalledWith('/api/contact/contact-2', {
      confirm: true,
    });
  });
});

import axios from 'axios';

import {
  confirm,
  create,
  getByContactId,
  getByUserId,
  getContactsCommon,
  list,
  remove,
} from '@/modules/contacts/client/api/contacts.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('contacts api', () => {
  it('removes a contact', async () => {
    axios.delete.mockResolvedValueOnce({});

    await remove('contact-1');
    expect(axios.delete).toHaveBeenCalledWith('/api/contact/contact-1');
  });

  it('fetches contacts in common', async () => {
    const data = [{ _id: 'contact-1' }];
    axios.get.mockResolvedValueOnce({ data });

    await expect(getContactsCommon('user-1')).resolves.toBe(data);
    expect(axios.get).toHaveBeenCalledWith('/api/contacts/user-1/common');
  });

  it('returns null when a contact by user id is missing', async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(getByUserId('missing-user')).resolves.toBeNull();
  });

  it('rethrows unexpected errors when fetching by user id', async () => {
    const error = { response: { status: 500 } };
    axios.get.mockRejectedValueOnce(error);

    await expect(getByUserId('user-1')).rejects.toBe(error);
  });

  it('fetches an existing contact by user id', async () => {
    const contact = { _id: 'contact-1', confirmed: true };
    axios.get.mockResolvedValueOnce({ data: contact });

    await expect(getByUserId('user-2')).resolves.toBe(contact);
    expect(axios.get).toHaveBeenCalledWith('/api/contact-by/user-2');
  });

  it('fetches a contact by contact id', async () => {
    const contact = { _id: 'contact-1' };
    axios.get.mockResolvedValueOnce({ data: contact });

    await expect(getByContactId('contact-1')).resolves.toBe(contact);
    expect(axios.get).toHaveBeenCalledWith('/api/contact/contact-1');
  });

  it('lists contacts for a user', async () => {
    const contacts = [{ _id: 'contact-1' }];
    axios.get.mockResolvedValueOnce({ data: contacts });

    await expect(list('user-1')).resolves.toBe(contacts);
    expect(axios.get).toHaveBeenCalledWith('/api/contacts/user-1');
  });

  it('creates a contact request', async () => {
    const contact = { _id: 'contact-2' };
    axios.post.mockResolvedValueOnce({ data: contact });

    await expect(
      create({ friendUserId: 'user-2', message: 'Hello!' }),
    ).resolves.toBe(contact);
    expect(axios.post).toHaveBeenCalledWith('/api/contact', {
      friendUserId: 'user-2',
      message: 'Hello!',
    });
  });

  it('confirms a contact request', async () => {
    const contact = { _id: 'contact-2', confirmed: true };
    axios.put.mockResolvedValueOnce({ data: contact });

    await expect(confirm('contact-2')).resolves.toBe(contact);
    expect(axios.put).toHaveBeenCalledWith('/api/contact/contact-2', {
      confirm: true,
    });
  });
});

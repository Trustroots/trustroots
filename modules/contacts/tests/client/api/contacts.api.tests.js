import axios from 'axios';

import {
  remove,
  create,
  getByUserId,
  getByContactId,
  confirm,
  getContactsCommon,
  list,
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

  it('fetches a contact by user and treats a missing contact as empty', async () => {
    const contact = { _id: 'contact-1' };
    axios.get.mockResolvedValueOnce({ data: contact });
    await expect(getByUserId('user-1')).resolves.toBe(contact);
    expect(axios.get).toHaveBeenCalledWith('/api/contact-by/user-1');

    axios.get.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(getByUserId('user-2')).resolves.toBeNull();
  });

  it('propagates other contact lookup errors', async () => {
    const error = new Error('Request failed');
    axios.get.mockRejectedValueOnce(error);
    await expect(getByUserId('user-1')).rejects.toBe(error);
  });

  it('lists a member’s contacts', async () => {
    const contacts = [{ _id: 'contact-1' }];
    axios.get.mockResolvedValueOnce({ data: contacts });
    await expect(list('user-1')).resolves.toBe(contacts);
    expect(axios.get).toHaveBeenCalledWith('/api/contacts/user-1');
  });
});

it('loads and confirms a contact using its existing endpoints', async () => {
  axios.get.mockResolvedValue({ data: { _id: 'sample-contact' } });
  await expect(getByContactId('sample-contact')).resolves.toEqual({
    _id: 'sample-contact',
  });
  expect(axios.get).toHaveBeenCalledWith('/api/contact/sample-contact');
  axios.put.mockResolvedValue({ data: { confirmed: true } });
  await expect(confirm('sample-contact')).resolves.toEqual({ confirmed: true });
  expect(axios.put).toHaveBeenCalledWith('/api/contact/sample-contact', {
    confirm: true,
  });
});

it('loads an existing connection and creates a contact', async () => {
  axios.get.mockResolvedValue({ data: { confirmed: false } });
  await expect(getByUserId('friend-1')).resolves.toEqual({ confirmed: false });
  expect(axios.get).toHaveBeenCalledWith('/api/contact-by/friend-1');
  axios.post.mockResolvedValue({ data: { _id: 'contact-1' } });
  const data = { friendUserId: 'friend-1', message: '<p>Hello</p>' };
  await expect(create(data)).resolves.toEqual({ _id: 'contact-1' });
  expect(axios.post).toHaveBeenCalledWith('/api/contact', data);
});

it('distinguishes an absent contact from failed lookups', async () => {
  axios.get.mockRejectedValueOnce({ response: { status: 404 } });
  await expect(getByUserId('friend-1')).resolves.toBeNull();
  const unavailable = { response: { status: 503 } };
  axios.get.mockRejectedValueOnce(unavailable);
  await expect(getByUserId('friend-1')).rejects.toBe(unavailable);
  const network = new Error('network');
  axios.get.mockRejectedValueOnce(network);
  await expect(getByUserId('friend-1')).rejects.toBe(network);
});

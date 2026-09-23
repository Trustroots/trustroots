import axios from 'axios';

import {
  remove,
  getByContactId,
  confirm,
  getContactsCommon,
  getByUserId,
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

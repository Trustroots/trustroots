import axios from 'axios';

import {
  remove,
  getContactsCommon,
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
});

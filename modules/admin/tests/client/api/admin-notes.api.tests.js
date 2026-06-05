import axios from 'axios';

import { addNote, listNotes } from '@/modules/admin/client/api/admin-notes.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin notes api', () => {
  it('adds a note', async () => {
    const data = { _id: 'note-1' };
    axios.post.mockResolvedValueOnce({ data });

    await expect(addNote({ note: 'Hello', userId: 'user-1' })).resolves.toBe(
      data,
    );
    expect(axios.post).toHaveBeenCalledWith('/api/admin/notes', {
      note: 'Hello',
      userId: 'user-1',
    });
  });

  it('lists notes for a user', async () => {
    const data = [{ _id: 'note-1' }];
    axios.get.mockResolvedValueOnce({ data });

    await expect(listNotes('user-1')).resolves.toBe(data);
    expect(axios.get).toHaveBeenCalledWith('/api/admin/notes?userId=user-1');
  });
});

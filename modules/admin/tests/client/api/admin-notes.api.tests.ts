import axios, { type AxiosResponse } from 'axios';

import { addNote, listNotes } from '@/modules/admin/client/api/admin-notes.api';

vi.mock(
  'axios',
  async () => await import('@/modules/core/tests/client/api/axios.mock'),
);

const axiosMock = vi.mocked(axios);

const { AxiosHeaders: ActualAxiosHeaders } =
  await vi.importActual<typeof import('axios')>('axios');

function response<T>(data: T): AxiosResponse<T> {
  const headers = new ActualAxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('admin notes api', () => {
  it('adds a note', async () => {
    const data = { _id: 'note-1' };
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(addNote({ note: 'Hello', userId: 'user-1' })).resolves.toBe(
      data,
    );
    expect(axiosMock.post).toHaveBeenCalledWith('/api/admin/notes', {
      note: 'Hello',
      userId: 'user-1',
    });
  });

  it('lists notes for a user', async () => {
    const data = [{ _id: 'note-1' }];
    axiosMock.get.mockResolvedValueOnce(response(data));

    await expect(listNotes('user-1')).resolves.toBe(data);
    expect(axiosMock.get).toHaveBeenCalledWith(
      '/api/admin/notes?userId=user-1',
    );
  });
});

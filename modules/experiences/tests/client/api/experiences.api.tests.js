import axios from 'axios';

import {
  create,
  read,
  readMine,
  report,
  getCount,
} from '@/modules/experiences/client/api/experiences.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('experiences api', () => {
  it('creates an experience and returns the saved object', async () => {
    const saved = { _id: 'exp-1', recommend: 'yes' };
    axios.post.mockResolvedValueOnce({ data: saved });

    await expect(create({ recommend: 'yes' })).resolves.toBe(saved);
    expect(axios.post).toHaveBeenCalledWith('/api/experiences', {
      recommend: 'yes',
    });
  });

  it('reads experiences shared with a user', async () => {
    const experiences = [{ _id: 'exp-1' }];
    axios.get.mockResolvedValueOnce({ data: experiences });

    await expect(read({ userTo: 'user-1' })).resolves.toBe(experiences);
    expect(axios.get).toHaveBeenCalledWith('/api/experiences', {
      params: { userTo: 'user-1' },
    });
  });

  it('reads the mutual experience', async () => {
    const experience = { _id: 'exp-1', response: null };
    axios.get.mockResolvedValueOnce({ data: experience });

    await expect(readMine({ userWith: 'user-2' })).resolves.toBe(experience);
    expect(axios.get).toHaveBeenCalledWith('/api/my-experience', {
      params: { userWith: 'user-2' },
    });
  });

  it('returns null when the mutual experience is not found (404)', async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(readMine({ userWith: 'user-2' })).resolves.toBeNull();
  });

  it('rethrows non-404 errors when reading the mutual experience', async () => {
    const error = { response: { status: 500 } };
    axios.get.mockRejectedValueOnce(error);

    await expect(readMine({ userWith: 'user-2' })).rejects.toBe(error);
  });

  it('reports a member', async () => {
    axios.post.mockResolvedValueOnce({});

    await report({ username: 'spammer' }, 'They are a spammer');
    expect(axios.post).toHaveBeenCalledWith('/api/support', {
      message: 'They are a spammer',
      reportMember: 'spammer',
    });
  });

  it('returns the experience count', async () => {
    const count = { count: 5, hasPending: true };
    axios.get.mockResolvedValueOnce({ data: count });

    await expect(getCount('user-1')).resolves.toBe(count);
    expect(axios.get).toHaveBeenCalledWith('/api/experiences/count', {
      params: { userTo: 'user-1' },
    });
  });

  it('returns a zero count when fetching the count fails', async () => {
    axios.get.mockRejectedValueOnce(new Error('boom'));

    await expect(getCount('user-1')).resolves.toEqual({ count: 0 });
  });
});

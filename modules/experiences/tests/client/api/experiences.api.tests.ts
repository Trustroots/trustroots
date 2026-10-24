import axios from 'axios';

import {
  create,
  read,
  readMine,
  getCount,
  getSuggestion,
  readReplyRecipient,
} from '@/modules/experiences/client/api/experiences.api';
import type {
  Experience,
  ExperienceMine,
} from '@/modules/experiences/shared/experience';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock'),
);
const mockedAxios = jest.mocked(axios);

afterEach(() => {
  jest.clearAllMocks();
});

const experienceMine: ExperienceMine = {
  _id: 'experience-1',
  created: '2024-01-01T00:00:00.000Z',
  public: true,
  userFrom: 'user-1',
  userTo: 'user-2',
  recommend: 'yes',
  response: null,
};

const experience: Experience = {
  ...experienceMine,
  userFrom: { _id: 'user-1', username: 'member-one' },
  userTo: { _id: 'user-2', username: 'member-two' },
};

describe('experiences api', () => {
  it('loads only the reply recipient identity with an encoded username', async () => {
    const recipient = {
      _id: 'user-2',
      username: 'member-two',
      displayName: 'Member Two',
    };
    mockedAxios.get.mockResolvedValueOnce({ data: recipient });
    await expect(readReplyRecipient('member/two')).resolves.toBe(recipient);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      '/api/experiences/reply-recipient/member%2Ftwo',
    );
  });
  it('creates an experience and returns the saved object', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: experienceMine });

    await expect(create({ recommend: 'yes' })).resolves.toBe(experienceMine);
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/experiences', {
      recommend: 'yes',
    });
  });

  it('reads experiences shared with a user', async () => {
    const experiences: Experience[] = [experience];
    mockedAxios.get.mockResolvedValueOnce({ data: experiences });

    await expect(read({ userTo: 'user-1' })).resolves.toBe(experiences);
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/experiences', {
      params: { userTo: 'user-1' },
    });
  });

  it('reads the mutual experience', async () => {
    const mutualExperience: ExperienceMine = {
      ...experienceMine,
      response: null,
    };
    mockedAxios.get.mockResolvedValueOnce({ data: mutualExperience });

    await expect(readMine({ userWith: 'user-2' })).resolves.toBe(
      mutualExperience,
    );
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/my-experience', {
      params: { userWith: 'user-2' },
    });
  });

  it('returns null when the mutual experience is not found (404)', async () => {
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(readMine({ userWith: 'user-2' })).resolves.toBeNull();
  });

  it('rethrows non-404 errors when reading the mutual experience', async () => {
    const error = { response: { status: 500 } };
    mockedAxios.get.mockRejectedValueOnce(error);

    await expect(readMine({ userWith: 'user-2' })).rejects.toBe(error);
  });

  it('returns the experience count', async () => {
    const count = { count: 5, hasPending: true };
    mockedAxios.get.mockResolvedValueOnce({ data: count });

    await expect(getCount('user-1')).resolves.toBe(count);
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/experiences/count', {
      params: { userTo: 'user-1' },
    });
  });

  it('returns a zero count when fetching the count fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('boom'));

    await expect(getCount('user-1')).resolves.toEqual({ count: 0 });
  });

  it('returns an experience suggestion', async () => {
    const suggestion = {
      _id: 'user-1',
      displayName: 'Member Three',
      username: 'member-three',
    };
    mockedAxios.get.mockResolvedValueOnce({ data: suggestion });

    await expect(getSuggestion()).resolves.toBe(suggestion);
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/experiences/suggestion');
  });
});

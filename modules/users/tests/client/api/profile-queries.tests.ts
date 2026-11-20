import { QueryClient } from '@tanstack/react-query';

import * as experiencesApi from '@/modules/experiences/client/api/experiences.api';
import { profileQuery } from '@/modules/users/client/api/profile-queries';
import * as usersApi from '@/modules/users/client/api/users.api';

vi.mock('@/modules/users/client/api/users.api');
vi.mock('@/modules/experiences/client/api/experiences.api');

const fetchProfile = vi.mocked(usersApi.fetch);
const readReplyRecipient = vi.mocked(experiencesApi.readReplyRecipient);

type Profile = Awaited<ReturnType<typeof usersApi.fetch>>;
type Recipient = Awaited<ReturnType<typeof experiencesApi.readReplyRecipient>>;

const profile = { _id: 'member-1', username: 'walker' } as Profile;
const ownExperience = { _id: 'experience-1' } as Recipient['ownExperience'];
const recipient = {
  _id: 'member-1',
  username: 'walker',
  ownExperience,
} as Recipient;
const notFound = Object.assign(new Error('Not found'), {
  response: { status: 404 },
});

function load(canLoadReply: boolean) {
  return new QueryClient().fetchQuery(
    profileQuery('walker', { canLoadReply, viewerId: 'viewer-1' }),
  );
}

describe('profileQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keys the profile by member and viewer', () => {
    expect(
      profileQuery('walker', { canLoadReply: true, viewerId: 'viewer-1' })
        .queryKey,
    ).toEqual([
      'profile',
      'walker',
      { canLoadReply: true, viewerId: 'viewer-1' },
    ]);
  });

  it('loads the member profile', async () => {
    fetchProfile.mockResolvedValueOnce(profile);

    await expect(load(true)).resolves.toEqual({
      profile,
      experienceOnly: false,
      ownExperience: undefined,
    });
    expect(fetchProfile).toHaveBeenCalledWith('walker');
    expect(readReplyRecipient).not.toHaveBeenCalled();
  });

  it('falls back to the experience recipient for a missing profile', async () => {
    fetchProfile.mockRejectedValueOnce(notFound);
    readReplyRecipient.mockResolvedValueOnce(recipient);

    await expect(load(true)).resolves.toEqual({
      profile: recipient,
      experienceOnly: true,
      ownExperience,
    });
    expect(readReplyRecipient).toHaveBeenCalledWith('walker');
  });

  it('fails for a missing profile when replies cannot be loaded', async () => {
    fetchProfile.mockRejectedValueOnce(notFound);

    await expect(load(false)).rejects.toBe(notFound);
    expect(readReplyRecipient).not.toHaveBeenCalled();
  });

  it('fails for errors other than a missing profile', async () => {
    const serverError = Object.assign(new Error('Server error'), {
      response: { status: 500 },
    });
    fetchProfile.mockRejectedValueOnce(serverError);

    await expect(load(true)).rejects.toBe(serverError);
    expect(readReplyRecipient).not.toHaveBeenCalled();
  });
});

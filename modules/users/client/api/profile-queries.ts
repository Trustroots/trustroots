import { queryOptions, type QueryClient } from '@tanstack/react-query';

import { getErrorResponse } from '@trustroots/core/http-client';
import { readReplyRecipient } from '@/modules/experiences/client/api/experiences.api';
import { fetch as fetchProfile } from './users.api';

type ProfileQuery = {
  canLoadReply: boolean;
  viewerId?: string;
};

/**
 * A member's profile, or, for a member who can only be replied to, the
 * experience recipient. The route loader starts it and the page reads it,
 * so switching profile tabs reuses it while it is fresh.
 */
export function profileQuery(username: string, options: ProfileQuery) {
  return queryOptions({
    queryKey: ['profile', username, options],
    queryFn: async () => {
      try {
        const profile = await fetchProfile(username);
        return { profile, experienceOnly: false, ownExperience: undefined };
      } catch (error) {
        if (!options.canLoadReply || getErrorResponse(error)?.status !== 404) {
          throw error;
        }
        const profile = await readReplyRecipient(username);
        return {
          profile,
          experienceOnly: true,
          ownExperience: profile.ownExperience,
        };
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Saving profile changes updates the signed-in member, so profiles read before are stale. */
export function invalidateProfiles(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ['profile'] });
}

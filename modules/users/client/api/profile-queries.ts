import { queryOptions } from '@tanstack/react-query';

import { getErrorResponse } from '@/modules/core/client/api/http-client';
import { readReplyRecipient } from '@/modules/experiences/client/api/experiences.api';
import { fetch as fetchProfile } from './users.api';

type ProfileQuery = {
  canLoadReply: boolean;
  isCreatingExperience: boolean;
  viewerId?: string;
};

/**
 * A member's profile, or, for a member who can only be replied to, the
 * experience recipient. The route loader fetches it on every navigation.
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
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

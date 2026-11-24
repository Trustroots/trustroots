import axios from '../../../core/client/api/http-client';

export interface MemberSearchFilters {
  connectionsOnly?: boolean;
  types?: Array<'host' | 'meet'>;
  volunteering?: boolean;
  onlineRecently?: boolean;
  tribes?: string[];
  languages?: string[];
}

export async function searchUsers(
  query: string,
  filters: MemberSearchFilters | boolean = false,
): Promise<import('axios').AxiosResponse> {
  const {
    connectionsOnly,
    types,
    volunteering,
    onlineRecently,
    tribes,
    languages,
  } = typeof filters === 'boolean' ? { connectionsOnly: filters } : filters;
  const params = new URLSearchParams();
  if (connectionsOnly) params.set('connectionsOnly', 'true');
  if (types?.length) params.set('types', types.join(','));
  if (volunteering) params.set('volunteering', 'true');
  if (onlineRecently) params.set('onlineRecently', 'true');
  if (tribes?.length) params.set('tribes', tribes.join(','));
  if (languages?.length) params.set('languages', languages.join(','));
  const filterQuery = params.toString();
  return await axios.get(
    `/api/users?search=${encodeURIComponent(query)}${filterQuery ? '&' + filterQuery : ''}`,
    {
      timeout: 10000,
    },
  );
}

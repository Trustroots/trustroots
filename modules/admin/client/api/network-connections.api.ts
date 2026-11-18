import axios from '../../../core/client/api/http-client.js';
import type { Network } from '../../../users/shared/network-connections.js';

export interface CurrentNetworkConnection {
  network: Network;
  identifier: string;
}

export interface NetworkConnectionChange {
  network: Network;
  oldIdentifier: string | null;
  newIdentifier: string | null;
  changedAt: string | null;
  initial: boolean;
}

export interface MemberNetworkConnectionsPage {
  current: CurrentNetworkConnection[];
  history: NetworkConnectionChange[];
  page: number;
  hasNextPage: boolean;
}

export interface NetworkConnectionMember {
  _id: string;
  username: string;
  displayName: string;
  identifier: string;
  current: boolean;
}

export interface NetworkConnectionSearchPage {
  members: NetworkConnectionMember[];
  page: number;
  hasNextPage: boolean;
}

export async function getMemberNetworkConnections(
  memberId: string,
  page = 1,
): Promise<MemberNetworkConnectionsPage> {
  const { data } = await axios.get<MemberNetworkConnectionsPage>(
    `/api/admin/network-connections/${encodeURIComponent(memberId)}`,
    { params: { page } },
  );
  return data;
}

export async function searchNetworkConnections(
  network: Network,
  identifier: string,
  page = 1,
): Promise<NetworkConnectionSearchPage> {
  const { data } = await axios.get<NetworkConnectionSearchPage>(
    '/api/admin/network-connections',
    { params: { network, identifier, page } },
  );
  return data;
}

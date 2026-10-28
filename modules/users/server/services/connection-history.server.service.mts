import mongoose from 'mongoose';
import {
  NETWORKS,
  connectionSearchKey,
  currentConnections,
  normaliseIdentifier,
  type ConnectionHistoryEntry,
  type Network,
} from '../../shared/network-connections.ts';
import type {
  UserServerDocument,
  UserServerRecord,
} from '../models/user.server.types.mts';

const connectionPaths: Record<Network, string[]> = {
  email: ['email'],
  couchers: ['extSitesCouchers'],
  bewelcome: ['extSitesBW'],
  couchsurfing: ['extSitesCS'],
  warmshowers: ['extSitesWS'],
  servas: ['extSitesServas'],
  nostr: ['nostrNpub'],
  facebook: ['additionalProvidersData'],
  twitter: ['additionalProvidersData'],
  github: ['additionalProvidersData'],
};

type ConnectionSnapshot = Partial<Record<Network, string>>;

export const CONNECTION_HISTORY_CONFLICT_MESSAGE =
  'An external connection changed in another request. Please try again.';

export class ConnectionHistoryConflictError extends Error {
  constructor() {
    super(CONNECTION_HISTORY_CONFLICT_MESSAGE);
    this.name = 'ConnectionHistoryConflictError';
  }
}

export function isConnectionHistoryWriteConflict(
  error: Error,
  user: UserServerDocument,
): boolean {
  if (error instanceof ConnectionHistoryConflictError) return true;
  if (
    !(error instanceof mongoose.Error.VersionError) &&
    !(error instanceof mongoose.Error.DocumentNotFoundError)
  ) {
    return false;
  }
  return NETWORKS.some(({ id }) => hasChangedConnectionPath(user, id));
}

function snapshotConnections(record: object): ConnectionSnapshot {
  return Object.fromEntries(
    currentConnections(record).map(connection => [
      connection.network,
      connection.identifier,
    ]),
  ) as ConnectionSnapshot;
}

function normalisedValue(
  network: Network,
  value: string | null | undefined,
): string | null {
  return value ? normaliseIdentifier(network, value) : null;
}

function sameIdentifier(
  network: Network,
  first: string | null | undefined,
  second: string | null | undefined,
): boolean {
  return normalisedValue(network, first) === normalisedValue(network, second);
}

function sameStoredIdentifier(
  first: string | null | undefined,
  second: string | null | undefined,
): boolean {
  return (first || null) === (second || null);
}

function hasChangedConnectionPath(
  user: UserServerDocument,
  network: Network,
): boolean {
  return connectionPaths[network].some(path => user.isModified(path));
}

function allHistoryKeys(
  history: ConnectionHistoryEntry[],
  record: object,
): string[] {
  const keys = new Set<string>();
  currentConnections(record).forEach(({ network, identifier }) => {
    keys.add(connectionSearchKey(network, identifier));
  });
  history.forEach(entry => {
    if (entry.oldIdentifier) {
      keys.add(connectionSearchKey(entry.network, entry.oldIdentifier));
    }
    if (entry.newIdentifier) {
      keys.add(connectionSearchKey(entry.network, entry.newIdentifier));
    }
  });
  return [...keys];
}

function makeInitialEntries(record: object): ConnectionHistoryEntry[] {
  return currentConnections(record)
    .filter(({ network }) => network !== 'email')
    .map(({ network, identifier }) => ({
      network,
      oldIdentifier: null,
      newIdentifier: identifier,
      changedAt: null,
      initial: true,
    }));
}

export function initialConnectionHistoryState(record: object): {
  connectionHistory: ConnectionHistoryEntry[];
  connectionSearchKeys: string[];
} {
  const source = record as object & {
    connectionHistory?: ConnectionHistoryEntry[];
  };
  const history = [
    ...(source.connectionHistory || []),
    ...makeInitialEntries(record),
  ];
  return {
    connectionHistory: history,
    connectionSearchKeys: allHistoryKeys(history, record),
  };
}

/**
 * Record changed external identities as part of the same User save. A private
 * revision condition serialises concurrent history initialisation and writes.
 */
export async function trackConnectionHistoryBeforeSave(
  user: UserServerDocument,
): Promise<void> {
  if (user.isNew) {
    const connections = currentConnections(user);
    const now = new Date();
    user.connectionHistory = connections
      .filter(({ network }) => network !== 'email')
      .map(({ network, identifier }) => ({
        network,
        oldIdentifier: null,
        newIdentifier: identifier,
        changedAt: now,
        initial: false,
      }));
    user.connectionSearchKeys = allHistoryKeys(user.connectionHistory, user);
    user.connectionHistoryInitialised = true;
    user.connectionHistoryRevision = 1;
    user.markModified('connectionHistory');
    user.markModified('connectionSearchKeys');
    return;
  }

  const possibleNetworks = NETWORKS.map(({ id }) => id).filter(network =>
    hasChangedConnectionPath(user, network),
  );
  if (possibleNetworks.length === 0) return;

  const snapshot = (user.$locals.connectionSnapshot ||
    snapshotConnections(user)) as ConnectionSnapshot;
  const current = snapshotConnections(user);
  const changedNetworks = possibleNetworks.filter(
    network => !sameIdentifier(network, snapshot[network], current[network]),
  );

  const User = mongoose.model('User');
  const persisted = await User.findById(user._id)
    .select(
      '+connectionHistory +connectionSearchKeys +connectionHistoryInitialised +connectionHistoryRevision ' +
        'email extSitesCouchers extSitesBW extSitesCS extSitesWS extSitesServas nostrNpub additionalProvidersData',
    )
    .lean<UserServerRecord>()
    .exec();
  if (!persisted)
    throw new mongoose.Error.DocumentNotFoundError(user._id.toString());

  const persistedConnections = snapshotConnections(persisted);
  const persistedHistory = (persisted.connectionHistory ||
    []) as ConnectionHistoryEntry[];

  for (const network of possibleNetworks) {
    if (
      !sameStoredIdentifier(snapshot[network], persistedConnections[network])
    ) {
      throw new ConnectionHistoryConflictError();
    }
  }

  const history = [...persistedHistory];
  if (!persisted.connectionHistoryInitialised) {
    history.push(...makeInitialEntries(persisted));
  }

  const changedAt = new Date();
  changedNetworks.forEach(network => {
    const oldIdentifier = persistedConnections[network] || null;
    const newIdentifier = current[network] || null;
    if (sameIdentifier(network, oldIdentifier, newIdentifier)) return;
    history.push({
      network,
      oldIdentifier,
      newIdentifier,
      changedAt,
      initial: false,
    });
  });

  const revision = persisted.connectionHistoryRevision || 0;
  const where = (user.$where || {}) as Record<string, unknown>;
  user.$where = {
    ...where,
    ...(persisted.connectionHistoryRevision === undefined
      ? { connectionHistoryRevision: { $exists: false } }
      : { connectionHistoryRevision: revision }),
  };
  user.connectionHistory = history;
  user.connectionSearchKeys = allHistoryKeys(history, user);
  user.connectionHistoryInitialised = true;
  user.connectionHistoryRevision = revision + 1;
  user.markModified('connectionHistory');
  user.markModified('connectionSearchKeys');
  user.markModified('connectionHistoryInitialised');
  user.markModified('connectionHistoryRevision');
}

export function captureConnectionSnapshot(user: UserServerDocument): void {
  user.$locals.connectionSnapshot = snapshotConnections(user);
}

export function clearConnectionHistoryCas(user: UserServerDocument): void {
  const where = user.$where as Record<string, unknown> | undefined;
  if (!where || !Object.hasOwn(where, 'connectionHistoryRevision')) return;
  delete where.connectionHistoryRevision;
  user.$where = where;
}

import type { Db, Document } from 'mongodb';
import { circleDiscoveryIndexes } from '../../../../config/lib/circle-discovery-indexes.mts';
import type { MongoIndexInventory } from '../../shared/mongo-diagnostics.mts';

const options = { timeoutMS: 5_000 };

function describeIndex({ name, key, weights }: Document) {
  const fields = Object.entries(key).flatMap(([field, order]) => {
    if (weights && field === '_fts') {
      return Object.keys(weights).map(textField => `${textField} (text)`);
    }
    return weights && field === '_ftsx' ? [] : [`${field} (${order})`];
  });
  return { name: name as string, fields };
}

async function listCollections(db: Db) {
  try {
    return await db
      .listCollections(
        { type: { $in: ['collection', 'timeseries'] } },
        { ...options, nameOnly: true },
      )
      .toArray();
  } catch {
    return null;
  }
}

async function listIndexes(db: Db, name: string) {
  try {
    return await db.collection(name).listIndexes(options).toArray();
  } catch {
    return null;
  }
}

export async function readMongoIndexInventory(
  db: Db,
): Promise<MongoIndexInventory> {
  const collections = await listCollections(db);
  const indexesByCollection = new Map(
    await Promise.all(
      (collections ?? [])
        .map(({ name }) => name)
        .filter(name => !name.startsWith('system.'))
        .sort()
        .map(async name => [name, await listIndexes(db, name)] as const),
    ),
  );

  return {
    collections:
      collections === null
        ? null
        : Array.from(indexesByCollection, ([name, indexes]) => ({
            name,
            indexes: indexes?.map(describeIndex) ?? null,
          })),
    circleDiscovery: circleDiscoveryIndexes.map(({ collection, name, key }) => {
      const indexes = indexesByCollection.get(collection);
      let status: MongoIndexInventory['circleDiscovery'][number]['status'];
      if (collections === null || indexes === null) {
        status = 'unavailable';
      } else {
        const index = indexes?.find(index => index.name === name);
        if (!index) {
          status = 'missing';
        } else {
          const matches =
            JSON.stringify(Object.entries(index.key)) ===
              JSON.stringify(Object.entries(key)) &&
            !index.unique &&
            !index.sparse &&
            !index.hidden &&
            index.collation === undefined &&
            index.partialFilterExpression === undefined &&
            index.expireAfterSeconds === undefined;
          status = matches ? 'matches' : 'different';
        }
      }
      return { collection, name, status };
    }),
  };
}

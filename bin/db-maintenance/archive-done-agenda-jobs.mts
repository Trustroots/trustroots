#!/usr/bin/env node

/**
 * Archive done Agenda jobs from `agendaJobs` collection by moving them
 * to `agendaJobsArchived` collection.
 *
 * Make sure this collection exists before running this! Script won't create it.
 *
 * Usage:
 *
 *  pnpm run agenda-maintenance
 *
 * To reverse ALL the documents from archive back to live db:
 *
 *  pnpm run agenda-maintenance reverse
 */
import {
  MongoClient,
  type Collection,
  type Document,
  type Filter,
  type WithId,
} from 'mongodb';
import config from './../../config/config.mjs';

const filter: Filter<Document> = {
  nextRunAt: null,
  lockedAt: null,
};

const isReverse = process.argv[2] === 'reverse';
const sourceCollectionName = isReverse ? 'agendaJobsArchived' : 'agendaJobs';
const targetCollectionName = isReverse ? 'agendaJobs' : 'agendaJobsArchived';

if (isReverse) {
  console.log('🚨 Reverse action! Movind docs from archive back to live.');
}

function reportCollectionCounts(
  sourceCollection: Collection<Document>,
  targetCollection: Collection<Document>,
): Promise<void> {
  return sourceCollection.countDocuments().then(
    async sourceCount => {
      console.log('\nSource count: ' + sourceCount);
      try {
        const targetCount = await targetCollection.countDocuments();
        console.log('Target count: ' + targetCount);
        console.log('Total: ' + (sourceCount + targetCount) + '\n');
      } catch (error) {
        console.log(
          'Could not get count of documents in target collection: ' +
            targetCollectionName,
        );
        console.error(error);
      }
    },
    error => {
      console.log(
        'Could not get count of documents in source collection: ' +
          sourceCollectionName,
      );
      console.error(error);
    },
  );
}

async function moveDocument(
  doc: WithId<Document>,
  sourceCollection: Collection<Document>,
  targetCollection: Collection<Document>,
): Promise<void> {
  await targetCollection.insertOne(doc);
  await sourceCollection.deleteOne(doc);
}

async function archiveDoneAgendaJobs(): Promise<void> {
  let client: MongoClient | undefined;
  let total = 0;
  let totalProcessed = 0;

  try {
    client = await MongoClient.connect(config.db.uri);
    console.log('Connected to MongoDB:', config.db.uri);
    const db = client.db();
    const sourceCollection = db.collection<Document>(sourceCollectionName);
    const targetCollection = db.collection<Document>(targetCollectionName);

    console.log('Counting docs...');
    total = await sourceCollection.countDocuments(filter);
    if (total <= 0) {
      console.log('No documents to transfer.');
      process.exit(0);
    }

    console.log(
      'Going to move ' +
        total +
        ' documents from ' +
        sourceCollectionName +
        ' to ' +
        targetCollectionName +
        '\n',
    );
    await reportCollectionCounts(sourceCollection, targetCollection);
    console.log('Fetching docs for transfer...\n');
    const cursor = sourceCollection.find(filter);
    const progressInterval = 0.1;
    let progress = 1;

    console.log('\nProcessing ' + total + ' docs...');
    try {
      let doc: WithId<Document> | null;
      while ((doc = await cursor.next()) !== null) {
        await moveDocument(doc, sourceCollection, targetCollection);
        if (progress % Math.ceil((total / 100) * progressInterval) === 0) {
          const progressPercent = ((progress / total) * 100).toFixed(1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(
            '~' + progressPercent + '% (' + progress + '/' + total + ')',
          );
        }
        ++progress;
      }
      console.log('\nDone with the queue');
      totalProcessed = progress;
    } catch (error) {
      console.error('\nCursor processing error:');
      console.error(error);
      totalProcessed = progress;
    } finally {
      try {
        await cursor.close();
        console.log('\nCursor closed.');
      } catch (error) {
        console.log('\nFailed to close cursor at the end of the script:');
        console.error(error);
      }
    }

    await reportCollectionCounts(sourceCollection, targetCollection);
  } catch (error) {
    console.log('\nFinal error:');
    console.error(error);
  }

  console.log(
    '\n\n✨  Done ' +
      (totalProcessed || 0) +
      '/' +
      (total || 0) +
      ' documents.',
  );

  if (client) {
    console.log('Closing db...');
    try {
      await client.close();
      console.log('\nDisconnected from MongoDB');
    } catch (error) {
      console.log('\nFailed to disconnect DB:');
      console.error(error);
    }
  } else {
    console.log('DB already closed.');
  }
  process.exit(0);
}

void archiveDoneAgendaJobs();

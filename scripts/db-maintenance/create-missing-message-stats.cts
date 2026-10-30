#!/usr/bin/env node
import type {
  HistoricalMessage,
  LegacyMongoose,
} from '../legacy-cli-contracts.d.cts';

/**
 * The purpose of this script is to fill the MessageStats collection with
 * statistics of the messages which were created before the introduction of the
 * MessageStat model to the application.
 * It will iterate through all the messages which are less than 90 days old and
 * create/update the corresponding MessageStat document.
 * If you want to iterate through a different time period, edit the
 * searchMessagesParam variable.
 */

// a day in milliseconds
const DAY = 24 * 3600 * 1000;

// we use searcMessagesParam as a parameter to find the messages whose
// MessageStat we'll create/update
//
// now we'll iterate only through the messages less than 90 days old
//
// in fact we'll update some threads older than 90 days (the ones which start
// earlier, but contain messages younger than 90 days), but we don't care. It
// doesn't influence the statistics thanks to the
// messageStatService.updateMessageStat's idempotence
const searchMessagesParam = {
  //* remove one '/' if you want to iterate through the messages of all the
  //  time
  created: {
    $gt: new Date(Date.now() - 90 * DAY),
  },
  // */
};

const config = require('./../../config/config.mts');
require('./../../config/lib/mongoose.mjs');
const mongoose = require('mongoose') as LegacyMongoose;
require('./../../modules/messages/server/models/message.server.model.mjs');
require('./../../modules/messages/server/models/message-stat.server.model.mjs');
const Message = mongoose.model<HistoricalMessage>('Message');
const messageStatService =
  require('./../../modules/messages/server/services/message-stat.server.service.mjs') as {
    updateMessageStat(
      message: HistoricalMessage,
      callback: (error: unknown, result: unknown) => void,
    ): void;
  };

// the expression below uses ES6 Promises, so it shouldn't belong here.
// there is a warning when one doesn't provide one's own library.
// it was present elsewhere i believe
mongoose.Promise = Promise;

// Bootstrap db connection
mongoose.set('strictQuery', false);
mongoose.connect(config.db.uri).catch(function (err) {
  console.log('Could not connect to MongoDB!');
  console.error(err);
});

async function updateMessageStats() {
  // count all messages to be able to show progress
  const messageNo = await Message.countDocuments(searchMessagesParam);
  console.log('found ' + messageNo + ' messages\n');
  console.log('streaming, and updating message stats for each message\n');

  // cursor for streaming from mongoDB
  const cursor = Message.find(searchMessagesParam)
    // .sort({ created: 1 })
    .cursor();

  // settings how often the progress will be printed to console
  // every PROGRESS_INTERVAL %
  const PROGRESS_INTERVAL = 0.1; // percent
  let progress = 0; // progress counter

  // here we process the message and (sometimes) print progress
  function saveMessageAndRunCounter(message: HistoricalMessage) {
    return new Promise<void>(function (resolve, reject) {
      // updating the message stat
      messageStatService.updateMessageStat(message, function (err, resp) {
        if (err) return reject(err);
        // showing a progress
        if (progress % Math.ceil((messageNo / 100) * PROGRESS_INTERVAL) === 0) {
          // update the progress instead of logging to newline
          const progressPercent = ((progress / messageNo) * 100).toFixed(1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(
            progressPercent +
              '% (' +
              progress +
              '/' +
              messageNo +
              ')' +
              ' - ' +
              message.created +
              ' - ' +
              resp,
          );
        }
        ++progress;

        resolve();
      });
    });
  }

  // getting the next message from mongodb
  async function nextMessage() {
    try {
      return await cursor.next();
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  // msg should be null at the end of stream, but weaker check is safe
  for (let msg = await nextMessage(); msg; msg = await nextMessage()) {
    await saveMessageAndRunCounter(msg);
  }

  return { processedNo: progress, allNo: messageNo };
}

function finish(err: unknown, processedNo?: number, allNo?: number) {
  mongoose.disconnect();
  if (err) {
    console.error(err);
    console.log('******************* errored **************************');
    return;
  }

  // finish writing the progress bar
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(
    Math.floor((Number(processedNo) / Number(allNo)) * 100) +
      '% (' +
      processedNo +
      '/' +
      allNo +
      ') (ended)\n\n',
  );

  console.log('************** finished successfully *****************');
  console.log('******* the message stats are up to date now *********');
  console.log('********************* bye! ***************************');

  return; // all finished!
}

updateMessageStats().then(function ({ processedNo, allNo }) {
  finish(null, processedNo, allNo);
}, finish);

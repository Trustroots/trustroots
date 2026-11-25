#!/usr/bin/env node

import { text } from 'node:stream/consumers';
import mongoose from 'mongoose';
import { canSendDeploymentNotifications } from '../config/lib/deployment-notification-recipients.mts';
import {
  queueDeploymentNotifications,
  readDeploymentSuccessReceipt,
} from '../config/lib/deployment-notifications.mts';

try {
  const { default: config, mailMode } = await import('../config/config.mts');
  if (!canSendDeploymentNotifications(config.domain, mailMode)) {
    console.error(
      'Deployment notifications require explicit production tier, production runtime, a canonical domain and live mail.',
    );
    process.exitCode = 1;
  } else {
    const receipt = readDeploymentSuccessReceipt(await text(process.stdin));
    try {
      const { connection } = await mongoose.connect(config.db.uri, {
        autoIndex: false,
        autoCreate: false,
        serverSelectionTimeoutMS: 5000,
      });
      const count = await queueDeploymentNotifications(
        connection.db!,
        receipt,
        config.mailer.from,
      );
      console.log(`Deployment notification destinations: ${count}`);
    } finally {
      await mongoose.disconnect();
    }
  }
} catch {
  console.error('Could not queue deployment notifications for this receipt.');
  process.exitCode = 1;
}

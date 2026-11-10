#!/usr/bin/env node

import mongoose from 'mongoose';
import {
  canPreviewDeploymentNotificationRecipients,
  findDeploymentNotificationAddresses,
} from '../config/lib/deployment-notification-recipients.mts';

try {
  const { default: config, mailMode } = await import('../config/config.mts');
  if (!canPreviewDeploymentNotificationRecipients(config.domain, mailMode)) {
    console.error(
      'Recipient preview requires explicit production tier, production runtime, a canonical domain and live mail.',
    );
    process.exitCode = 1;
  } else {
    try {
      const { connection } = await mongoose.connect(config.db.uri, {
        autoIndex: false,
        autoCreate: false,
      });
      const addresses = await findDeploymentNotificationAddresses(
        connection.db!,
      );
      console.log(
        `Eligible deployment notification destinations: ${addresses.size}`,
      );
    } finally {
      await mongoose.disconnect();
    }
  }
} catch {
  console.error('Could not preview deployment notification recipients.');
  process.exitCode = 1;
}

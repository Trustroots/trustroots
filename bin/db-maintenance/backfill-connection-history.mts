#!/usr/bin/env node

/** Initialise private external connection search history for existing users. */
import mongooseService from '../../config/lib/mongoose.mjs';
import type { Connection } from 'mongoose';
import type { UserServerRecord } from '../../modules/users/server/models/user.server.types.mts';
import { backfillConnectionHistory } from '../../modules/users/server/services/connection-history-backfill.server.service.mts';

mongooseService.connect(async (connection: Connection) => {
  try {
    await mongooseService.loadModels();
    const User = connection.model<UserServerRecord>('User');
    const initialised = await backfillConnectionHistory(User);
    console.log(
      `Initialised ${initialised} users with external connection history`,
    );
  } catch (error) {
    console.error('External connection history backfill failed:', error);
    process.exitCode = 1;
  } finally {
    await mongooseService.disconnect();
  }
});

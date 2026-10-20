#!/usr/bin/env node
// Run against the target environment after deploying the Radio circle client.
import mongooseService from '../../config/lib/mongoose.mjs';
import type { Connection } from 'mongoose';

mongooseService.connect(async (connection: Connection) => {
  try {
    const Tribe = connection.model('Tribe');
    const existing = await Tribe.findOne({ slug: 'radio' });
    if (!existing) {
      await Tribe.create({
        label: 'Radio',
        color: '065f46',
        description:
          'Listen to radio together, discover stations and meet fellow music lovers.',
      });
    }
    console.log('Radio circle is available at /circles/radio.');
  } catch (error) {
    console.error('Could not provision the Radio circle.', error);
    process.exitCode = 1;
  } finally {
    mongooseService.disconnect();
  }
});

#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import config from '../../config/config.mts';
import mongooseService from '../../config/lib/mongoose.mjs';

// Usage: NODE_ENV=production node bin/db-maintenance/link-support-reports.mts mappings.json ADMIN_ID [--apply]
// The mappings are manually verified evidence, not matches against current usernames.
const [filename, actorId, mode] = process.argv.slice(2);

interface HistoricalReportMapping {
  requestId: string;
  reportedUserId: string;
  evidence: string;
}

function isHistoricalReportMapping(
  value: unknown,
): value is HistoricalReportMapping {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'requestId' in value &&
    typeof value.requestId === 'string' &&
    'reportedUserId' in value &&
    typeof value.reportedUserId === 'string' &&
    'evidence' in value &&
    typeof value.evidence === 'string'
  );
}

type LinkHistoricalReport = (
  mapping: HistoricalReportMapping,
  actorId: string,
  apply: boolean,
) => Promise<{
  requestId: string;
  reportedUserId: string;
  applied: boolean;
}>;

try {
  if (!filename || !actorId || (mode && mode !== '--apply'))
    throw new Error(
      'Usage: link-support-reports.mts mappings.json ADMIN_ID [--apply]',
    );
  const mappings: unknown = JSON.parse(await readFile(filename, 'utf8'));
  if (!Array.isArray(mappings))
    throw new Error('Mappings must be a JSON array.');
  await mongoose.connect(config.db.uri, {
    autoIndex: false,
    autoCreate: false,
  });
  await mongooseService.loadModels();
  const { linkHistoricalReport: untypedLinkHistoricalReport } =
    await import('../../modules/support/server/services/report-link.server.service.mjs');
  // The service validates these exact fields before using the mapping.
  const linkHistoricalReport: LinkHistoricalReport =
    untypedLinkHistoricalReport;
  for (const mapping of mappings) {
    if (!isHistoricalReportMapping(mapping))
      throw new Error(
        'Each mapping requires requestId, reportedUserId and historical identity evidence.',
      );
    console.log(
      await linkHistoricalReport(mapping, actorId, mode === '--apply'),
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await new Promise(resolve => mongooseService.disconnect(resolve));
}

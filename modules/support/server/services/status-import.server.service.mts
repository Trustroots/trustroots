import mongoose, { type Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  isSupportStatus,
  normaliseSupportStatus,
} from '../../shared/statuses.ts';
import type {
  SupportStatusImportApplyResponse,
  SupportStatusImportChange,
  SupportStatusImportCounts,
  SupportStatusImportItem,
  SupportStatusImportManifest,
  SupportStatusImportPreviewResponse,
} from '../../shared/status-import.ts';
import {
  normaliseStoredSupportCategory,
  supportRequestImportFingerprints,
} from './support-fingerprint.server.service.mts';
import type { SupportRequestRecord } from '../models/support.server.model.mts';
import type {
  SupportStatusImportPreviewEntry as PreviewEntry,
  SupportStatusImportPreviewRecord,
} from '../models/support-status-import-preview.server.model.mts';

const PREVIEW_TTL_MS = 30 * 60 * 1000;
const MAX_MANIFEST_ITEMS = 10_000;
interface SupportUserRecord {
  _id: Types.ObjectId;
  roles: string[];
}

interface AuditLogRecord {
  user: Types.ObjectId | string;
  route: string;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
}

interface SupportRequestImportRecord extends Pick<
  SupportRequestRecord,
  | 'category'
  | 'reportMember'
  | 'email'
  | 'message'
  | 'status'
  | 'statusRevision'
  | 'statusChangedAt'
  | 'lastActivityAt'
  | 'sent'
  | 'zendeskTicketId'
> {
  _id: Types.ObjectId;
}

interface ImportError extends Error {
  status: number;
}

const Preview = mongoose.model<SupportStatusImportPreviewRecord>(
  'SupportStatusImportPreview',
);

function fail(status: number, message: string): ImportError {
  return Object.assign(new Error(message), { status });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === keys.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateManifest(value: unknown): SupportStatusImportManifest {
  if (
    !isObject(value) ||
    !hasExactKeys(value, ['version', 'exportedAt', 'items']) ||
    value.version !== 1 ||
    !parseDate(value.exportedAt) ||
    !Array.isArray(value.items) ||
    value.items.length > MAX_MANIFEST_ITEMS
  ) {
    throw fail(400, 'Invalid support status manifest.');
  }
  const items: SupportStatusImportItem[] = [];
  for (const item of value.items) {
    if (
      !isObject(item) ||
      !hasExactKeys(item, [
        'zendeskTicketId',
        'status',
        'updatedAt',
        'fingerprint',
      ]) ||
      !Number.isSafeInteger(item.zendeskTicketId) ||
      Number(item.zendeskTicketId) <= 0 ||
      !isSupportStatus(item.status) ||
      !parseDate(item.updatedAt) ||
      typeof item.fingerprint !== 'string' ||
      !/^[a-f\d]{64}$/.test(item.fingerprint)
    ) {
      throw fail(400, 'Invalid support status manifest.');
    }
    items.push({
      zendeskTicketId: Number(item.zendeskTicketId),
      status: item.status,
      updatedAt: parseDate(item.updatedAt)!.toISOString(),
      fingerprint: item.fingerprint,
    });
  }
  return {
    version: 1,
    exportedAt: parseDate(value.exportedAt)!.toISOString(),
    items,
  };
}

async function requireAdministrator(actorId: Types.ObjectId | string) {
  const User = mongoose.model<SupportUserRecord>('User');
  const actor = await User.findById(actorId).select('roles').lean();
  if (!actor?.roles?.includes('admin'))
    throw fail(403, 'An administrator must import support statuses.');
  return actor._id;
}

async function audit(
  actorId: Types.ObjectId,
  route: string,
  previewId: string,
  metadata: Record<string, unknown>,
) {
  const AuditLog = mongoose.model<AuditLogRecord>('AuditLog');
  await new AuditLog({
    user: actorId,
    route,
    params: { previewId },
    query: {},
    body: metadata,
  }).save();
}

function importFingerprints(record: SupportRequestImportRecord): string[] {
  const category = normaliseStoredSupportCategory(
    record.category,
    record.reportMember,
  );
  if (
    !category ||
    typeof record.email !== 'string' ||
    typeof record.message !== 'string'
  ) {
    return [];
  }
  return supportRequestImportFingerprints({
    category,
    email: record.email,
    message: record.message,
  });
}

function countReason(
  counts: SupportStatusImportCounts,
  reason: NonNullable<PreviewEntry['reason']>,
) {
  counts.skipped++;
  counts.skippedByReason[reason] = (counts.skippedByReason[reason] || 0) + 1;
}

function sameStatusAndTicket(
  record: SupportRequestImportRecord,
  item: Pick<SupportStatusImportItem, 'status' | 'zendeskTicketId'>,
): boolean {
  return (
    normaliseSupportStatus(record.status) === item.status &&
    record.zendeskTicketId === item.zendeskTicketId
  );
}

function hasNewerActivity(
  record: SupportRequestImportRecord,
  updatedAt: Date,
): boolean {
  return [record.lastActivityAt, record.statusChangedAt, record.sent].some(
    value => value instanceof Date && value > updatedAt,
  );
}

function snapshot(
  record: SupportRequestImportRecord,
): Pick<
  PreviewEntry,
  | 'currentStatus'
  | 'statusRevision'
  | 'statusChangedAt'
  | 'lastActivityAt'
  | 'sent'
  | 'currentTicketId'
> {
  return {
    currentStatus: record.status,
    statusRevision: record.statusRevision ?? 0,
    statusChangedAt: record.statusChangedAt ?? null,
    lastActivityAt: record.lastActivityAt ?? null,
    sent: record.sent ?? null,
    currentTicketId: record.zendeskTicketId ?? null,
  };
}

export async function previewReducedManifest(
  source: unknown,
  actorId: Types.ObjectId | string,
): Promise<SupportStatusImportPreviewResponse> {
  const actor = await requireAdministrator(actorId);
  const manifest = validateManifest(source);
  const SupportRequest =
    mongoose.model<SupportRequestImportRecord>('SupportRequest');
  const requests = await SupportRequest.find({})
    .select(
      '_id category reportMember email message status statusRevision statusChangedAt lastActivityAt sent zendeskTicketId',
    )
    .maxTimeMS(10_000)
    .lean();
  const localByFingerprint = new Map<string, SupportRequestImportRecord[]>();
  const localByTicketId = new Map<number, SupportRequestImportRecord[]>();
  for (const request of requests) {
    for (const fingerprint of importFingerprints(request)) {
      const matches = localByFingerprint.get(fingerprint) || [];
      matches.push(request);
      localByFingerprint.set(fingerprint, matches);
    }
    if (typeof request.zendeskTicketId === 'number') {
      const assigned = localByTicketId.get(request.zendeskTicketId) || [];
      assigned.push(request);
      localByTicketId.set(request.zendeskTicketId, assigned);
    }
  }
  const ticketIdCounts = new Map<number, number>();
  const fingerprintCounts = new Map<string, number>();
  const sourceTicketsByRequest = new Map<string, Set<number>>();
  for (const item of manifest.items) {
    for (const request of localByFingerprint.get(item.fingerprint) || []) {
      const id = String(request._id);
      const ticketIds = sourceTicketsByRequest.get(id) || new Set<number>();
      ticketIds.add(item.zendeskTicketId);
      sourceTicketsByRequest.set(id, ticketIds);
    }
    ticketIdCounts.set(
      item.zendeskTicketId,
      (ticketIdCounts.get(item.zendeskTicketId) || 0) + 1,
    );
    fingerprintCounts.set(
      item.fingerprint,
      (fingerprintCounts.get(item.fingerprint) || 0) + 1,
    );
  }

  const counts: SupportStatusImportCounts = {
    total: manifest.items.length,
    eligible: 0,
    alreadyApplied: 0,
    skipped: 0,
    skippedByReason: {},
  };
  const entries: PreviewEntry[] = [];
  const changes: SupportStatusImportChange[] = [];
  for (const item of manifest.items) {
    const entry: PreviewEntry = {
      zendeskTicketId: item.zendeskTicketId,
      status: item.status,
      updatedAt: new Date(item.updatedAt),
      fingerprint: item.fingerprint,
      state: 'skipped',
    };
    if (ticketIdCounts.get(item.zendeskTicketId)! > 1) {
      entry.reason = 'duplicate-ticket-id';
      countReason(counts, entry.reason);
      entries.push(entry);
      continue;
    }
    if (fingerprintCounts.get(item.fingerprint)! > 1) {
      entry.reason = 'duplicate-fingerprint';
      countReason(counts, entry.reason);
      entries.push(entry);
      continue;
    }
    const matches = localByFingerprint.get(item.fingerprint) || [];
    if (matches.length === 0) {
      entry.reason = 'no-match';
      countReason(counts, entry.reason);
      entries.push(entry);
      continue;
    }
    if (matches.length !== 1) {
      entry.reason = 'ambiguous-match';
      countReason(counts, entry.reason);
      entries.push(entry);
      continue;
    }
    const request = matches[0]!;
    if (sourceTicketsByRequest.get(String(request._id))!.size > 1) {
      entry.reason = 'ambiguous-source-match';
      countReason(counts, entry.reason);
      entries.push(entry);
      continue;
    }
    const recordSnapshot = snapshot(request);
    Object.assign(entry, recordSnapshot, {
      requestId: request._id,
      originalFingerprint: importFingerprints(request)[0],
    });
    if (
      localByTicketId
        .get(item.zendeskTicketId)
        ?.some(assigned => !assigned._id.equals(request._id))
    ) {
      entry.reason = 'ticket-id-conflict';
      countReason(counts, entry.reason);
      entries.push(entry);
      continue;
    }
    if (
      request.zendeskTicketId !== undefined &&
      request.zendeskTicketId !== item.zendeskTicketId
    ) {
      entry.reason = 'ticket-id-conflict';
      countReason(counts, entry.reason);
      entries.push(entry);
      continue;
    }
    if (sameStatusAndTicket(request, item)) {
      entry.state = 'alreadyApplied';
      counts.alreadyApplied++;
      entries.push(entry);
      continue;
    }
    if (hasNewerActivity(request, entry.updatedAt)) {
      entry.reason = 'newer-local-activity';
      countReason(counts, entry.reason);
      entries.push(entry);
      continue;
    }
    entry.state = 'ready';
    counts.eligible++;
    changes.push({
      requestId: String(request._id),
      zendeskTicketId: item.zendeskTicketId,
      currentStatus: normaliseSupportStatus(request.status),
      importedStatus: item.status,
      updatedAt: item.updatedAt,
    });
    entries.push(entry);
  }

  const now = new Date();
  const preview = new Preview({
    actor,
    createdAt: now,
    expiresAt: new Date(now.getTime() + PREVIEW_TTL_MS),
    entries,
    counts,
  });
  const previewId = String(preview._id);
  try {
    await audit(actor, 'support-status-import/preview', previewId, {
      total: counts.total,
      eligible: counts.eligible,
      skipped: counts.skipped,
    });
    await preview.save();
  } catch {
    throw fail(500, 'Unable to prepare support status import.');
  }
  return {
    previewId,
    counts,
    changes,
    expiresAt: preview.expiresAt.toISOString(),
  };
}

function addSnapshotFilter(
  filter: Record<string, unknown>,
  key: keyof PreviewEntry,
  value: unknown,
) {
  if (key === 'statusRevision') {
    filter.statusRevision = { $in: [value ?? 0, null] };
  } else if (value === null || value === undefined) {
    filter[key] = null;
  } else {
    filter[key] = value;
  }
}

async function currentRequest(entry: PreviewEntry) {
  if (!entry.requestId) return null;
  const SupportRequest =
    mongoose.model<SupportRequestImportRecord>('SupportRequest');
  return SupportRequest.findById(entry.requestId)
    .select(
      '_id category reportMember email message status statusRevision statusChangedAt lastActivityAt sent zendeskTicketId',
    )
    .lean();
}

function stillMatchesSnapshot(
  record: SupportRequestImportRecord,
  entry: PreviewEntry,
) {
  return (
    record.status === entry.currentStatus &&
    (record.statusRevision ?? 0) === (entry.statusRevision ?? 0) &&
    (record.statusChangedAt?.getTime() ?? null) ===
      (entry.statusChangedAt?.getTime() ?? null) &&
    (record.lastActivityAt?.getTime() ?? null) ===
      (entry.lastActivityAt?.getTime() ?? null) &&
    (record.sent?.getTime() ?? null) === (entry.sent?.getTime() ?? null) &&
    (record.zendeskTicketId ?? null) === (entry.currentTicketId ?? null)
  );
}

export async function applyPreview(
  previewId: string,
  actorId: Types.ObjectId | string,
): Promise<SupportStatusImportApplyResponse> {
  const actor = await requireAdministrator(actorId);
  if (!/^[a-f\d]{24}$/i.test(previewId))
    throw fail(400, 'Invalid support status preview.');
  const preview = await Preview.findOne({ _id: previewId, actor }).lean();
  if (!preview) throw fail(404, 'Support status preview not found.');
  if (preview.expiresAt <= new Date())
    throw fail(410, 'Support status preview has expired.');
  if (preview.result) return preview.result;
  const applyToken = randomUUID();
  const claimed = await Preview.findOneAndUpdate(
    {
      _id: preview._id,
      actor,
      result: { $exists: false },
      applyToken: { $exists: false },
    },
    { $set: { applyToken } },
    { returnDocument: 'after' },
  ).lean();
  if (!claimed) {
    const latest = await Preview.findOne({ _id: preview._id, actor }).lean();
    if (latest?.result) return latest.result;
    throw fail(409, 'Support status preview is already being applied.');
  }

  try {
    const ready = claimed.entries.filter(entry => entry.state === 'ready');
    await audit(actor, 'support-status-import/apply', previewId, {
      eligible: ready.length,
    });

    const result: SupportStatusImportApplyResponse = {
      applied: 0,
      alreadyApplied: claimed.entries.filter(
        entry => entry.state === 'alreadyApplied',
      ).length,
      skipped: claimed.entries.filter(entry => entry.state === 'skipped')
        .length,
    };
    const SupportRequest =
      mongoose.model<SupportRequestImportRecord>('SupportRequest');
    for (const entry of ready) {
      const current = await currentRequest(entry);
      if (
        !current ||
        importFingerprints(current)[0] !==
          (entry.originalFingerprint ?? entry.fingerprint)
      ) {
        result.skipped++;
        continue;
      }
      if (sameStatusAndTicket(current, entry)) {
        result.alreadyApplied++;
        continue;
      }
      if (
        !stillMatchesSnapshot(current, entry) ||
        hasNewerActivity(current, entry.updatedAt)
      ) {
        result.skipped++;
        continue;
      }
      const filter: Record<string, unknown> = {
        _id: entry.requestId,
        category: current.category,
        email: current.email,
        message: current.message,
        reportMember: current.reportMember ?? null,
      };
      addSnapshotFilter(filter, 'status', entry.currentStatus);
      addSnapshotFilter(filter, 'statusRevision', entry.statusRevision);
      addSnapshotFilter(filter, 'statusChangedAt', entry.statusChangedAt);
      addSnapshotFilter(filter, 'lastActivityAt', entry.lastActivityAt);
      addSnapshotFilter(filter, 'sent', entry.sent);
      addSnapshotFilter(filter, 'zendeskTicketId', entry.currentTicketId);
      const resolvedAt =
        entry.status === 'solved' || entry.status === 'closed'
          ? entry.updatedAt
          : null;
      const update = await SupportRequest.updateOne(filter, {
        $set: {
          status: entry.status,
          zendeskTicketId: entry.zendeskTicketId,
          statusChangedAt: new Date(),
          resolvedAt,
        },
        $inc: { statusRevision: 1 },
      });
      if (update.modifiedCount === 1) result.applied++;
      else result.skipped++;
    }
    const completed = await Preview.findOneAndUpdate(
      { _id: claimed._id, actor, applyToken, result: { $exists: false } },
      {
        $set: { appliedAt: new Date(), result },
        $unset: { applyToken: 1 },
      },
      { returnDocument: 'after' },
    ).lean();
    if (!completed?.result)
      throw fail(409, 'Support status preview changed during apply.');
    return completed.result;
  } catch (error) {
    await Preview.updateOne(
      { _id: claimed._id, actor, applyToken },
      { $unset: { applyToken: 1 } },
    );
    const status = (error as ImportError).status;
    if (status && status < 500) throw error;
    throw fail(500, 'Unable to apply support status import.');
  }
}

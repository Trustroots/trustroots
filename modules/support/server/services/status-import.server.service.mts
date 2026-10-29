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
  SupportStatusImportMatchReview,
  SupportStatusImportSelection,
} from '../../shared/status-import.ts';
import {
  normaliseStoredSupportCategory,
  supportImportMessageHash,
  supportImportSenderHash,
  supportRequestImportFingerprints,
} from './support-fingerprint.server.service.mts';
import { SUPPORT_CATEGORIES } from '../../shared/categories.ts';
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
  | 'username'
  | 'subject'
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
    (value.version !== 1 && value.version !== 2) ||
    !parseDate(value.exportedAt) ||
    !Array.isArray(value.items) ||
    value.items.length > MAX_MANIFEST_ITEMS
  ) {
    throw fail(400, 'Invalid support status manifest.');
  }
  const items: SupportStatusImportItem[] = [];
  for (const item of value.items) {
    const keys =
      value.version === 1
        ? ['zendeskTicketId', 'status', 'updatedAt', 'fingerprint']
        : ['zendeskTicketId', 'status', 'updatedAt', 'fingerprint', 'evidence'];
    if (
      !isObject(item) ||
      !hasExactKeys(item, keys) ||
      !Number.isSafeInteger(item.zendeskTicketId) ||
      Number(item.zendeskTicketId) <= 0 ||
      !isSupportStatus(item.status) ||
      !parseDate(item.updatedAt) ||
      typeof item.fingerprint !== 'string' ||
      !/^[a-f\d]{64}$/.test(item.fingerprint)
    ) {
      throw fail(400, 'Invalid support status manifest.');
    }
    let evidence: SupportStatusImportItem['evidence'];
    if (value.version === 2) {
      const raw = item.evidence;
      if (
        !isObject(raw) ||
        !hasExactKeys(raw, [
          'senderHash',
          'category',
          'submittedAt',
          'normalisedMessageHash',
        ]) ||
        typeof raw.senderHash !== 'string' ||
        !/^[a-f\d]{64}$/.test(raw.senderHash) ||
        typeof raw.normalisedMessageHash !== 'string' ||
        !/^[a-f\d]{64}$/.test(raw.normalisedMessageHash) ||
        typeof raw.category !== 'string' ||
        !Object.hasOwn(SUPPORT_CATEGORIES, raw.category) ||
        !(raw.submittedAt === null || parseDate(raw.submittedAt))
      )
        throw fail(400, 'Invalid support status manifest.');
      evidence = {
        senderHash: raw.senderHash,
        category: raw.category,
        submittedAt:
          raw.submittedAt === null
            ? null
            : parseDate(raw.submittedAt)!.toISOString(),
        normalisedMessageHash: raw.normalisedMessageHash,
      };
    }
    items.push({
      zendeskTicketId: Number(item.zendeskTicketId),
      status: item.status,
      updatedAt: parseDate(item.updatedAt)!.toISOString(),
      fingerprint: item.fingerprint,
      ...(evidence ? { evidence } : {}),
    });
  }
  return {
    version: value.version,
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

const SUGGESTION_REASON =
  'same sender, same category, submitted within the selected window, equivalent message after formatting normalisation' as const;

function parseMatchingWindowMinutes(value: unknown): number {
  if (typeof value === 'string' && /^(?:[1-9]|[1-5]\d|60)$/.test(value))
    return Number(value);
  throw fail(400, 'Matching window must be an integer from 1 to 60 minutes.');
}

function suggestedCandidates(
  item: SupportStatusImportItem,
  requestsByEvidence: Map<string, SupportRequestImportRecord[]>,
  matchingWindowMinutes: number,
) {
  const evidence = item.evidence;
  if (!evidence?.submittedAt) return [];
  const submittedAt = new Date(evidence.submittedAt).getTime();
  const key = `${evidence.senderHash}:${evidence.category}:${evidence.normalisedMessageHash}`;
  return (requestsByEvidence.get(key) || []).flatMap(request => {
    if (!(request.sent instanceof Date)) return [];
    const difference = Math.abs(request.sent.getTime() - submittedAt);
    if (difference > matchingWindowMinutes * 60_000) return [];
    return [{ request, timeDifferenceSeconds: Math.floor(difference / 1000) }];
  });
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

function statusForPreview(value: string | null | undefined) {
  return value == null
    ? ('unconfirmed' as const)
    : normaliseSupportStatus(value);
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
  rawMatchingWindowMinutes: unknown = '1',
): Promise<SupportStatusImportPreviewResponse> {
  const actor = await requireAdministrator(actorId);
  const matchingWindowMinutes = parseMatchingWindowMinutes(
    rawMatchingWindowMinutes,
  );
  const manifest = validateManifest(source);
  const SupportRequest =
    mongoose.model<SupportRequestImportRecord>('SupportRequest');
  const requests = await SupportRequest.find({})
    .select(
      '_id category reportMember email username subject message status statusRevision statusChangedAt lastActivityAt sent zendeskTicketId',
    )
    .maxTimeMS(10_000)
    .lean();
  const localByFingerprint = new Map<string, SupportRequestImportRecord[]>();
  const localByTicketId = new Map<number, SupportRequestImportRecord[]>();
  const requestsByEvidence = new Map<string, SupportRequestImportRecord[]>();
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
    if (
      typeof request.email === 'string' &&
      typeof request.message === 'string'
    ) {
      const category = normaliseStoredSupportCategory(
        request.category,
        request.reportMember,
      );
      if (category) {
        const key = `${supportImportSenderHash(request.email)}:${category}:${supportImportMessageHash(request.message)}`;
        const bucket = requestsByEvidence.get(key) || [];
        bucket.push(request);
        requestsByEvidence.set(key, bucket);
      }
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
    suggested: 0,
    alreadyApplied: 0,
    skipped: 0,
    skippedByReason: {},
  };
  const entries: PreviewEntry[] = [];
  const changes: SupportStatusImportChange[] = [];
  const matchReviews: SupportStatusImportMatchReview[] = [];
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
      const candidates = suggestedCandidates(
        item,
        requestsByEvidence,
        matchingWindowMinutes,
      ).filter(
        ({ request }) =>
          (request.zendeskTicketId == null ||
            request.zendeskTicketId === item.zendeskTicketId) &&
          !sourceTicketsByRequest.get(String(request._id))?.size,
      );
      if (candidates.length) {
        counts.suggested++;
        matchReviews.push({
          zendeskTicketId: item.zendeskTicketId,
          category: item.evidence!.category,
          submittedAt: item.evidence!.submittedAt,
          importedStatus: item.status,
          candidates: candidates.map(({ request, timeDifferenceSeconds }) => ({
            requestId: String(request._id),
            category: item.evidence!.category,
            submittedAt: request.sent.toISOString(),
            matchKind: 'suggested',
            reason: SUGGESTION_REASON,
            ...(typeof request.username === 'string'
              ? { senderUsername: request.username }
              : {}),
            email: request.email!,
            ...(typeof request.subject === 'string'
              ? { subject: request.subject }
              : {}),
            timeDifferenceSeconds,
            competingCandidateCount: candidates.length,
            currentStatus: statusForPreview(request.status),
            importedStatus: item.status,
          })),
        });
        for (const { request } of candidates) {
          entries.push({
            zendeskTicketId: item.zendeskTicketId,
            status: item.status,
            updatedAt: new Date(item.updatedAt),
            fingerprint: item.fingerprint,
            originalFingerprint: importFingerprints(request)[0],
            requestId: request._id,
            state: 'suggested',
            matchKind: 'suggested',
            senderHash: item.evidence!.senderHash,
            category: item.evidence!.category,
            submittedAt: new Date(item.evidence!.submittedAt!),
            normalisedMessageHash: item.evidence!.normalisedMessageHash,
            competingCandidateCount: candidates.length,
            ...snapshot(request),
          });
        }
        continue;
      }
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
      currentStatus: statusForPreview(request.status),
      importedStatus: item.status,
      updatedAt: item.updatedAt,
      matchKind: 'exact',
      reason: 'exact request fingerprint',
    });
    entries.push(entry);
  }

  const now = new Date();
  const preview = new Preview({
    actor,
    createdAt: now,
    expiresAt: new Date(now.getTime() + PREVIEW_TTL_MS),
    matchingWindowMinutes,
    entries,
    counts,
  });
  const previewId = String(preview._id);
  try {
    await audit(actor, 'support-status-import/preview', previewId, {
      total: counts.total,
      eligible: counts.eligible,
      suggested: counts.suggested,
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
    matchReviews,
    expiresAt: preview.expiresAt.toISOString(),
    matchingWindowMinutes,
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
  selectedMatches: SupportStatusImportSelection[] = [],
): Promise<SupportStatusImportApplyResponse> {
  const actor = await requireAdministrator(actorId);
  if (!/^[a-f\d]{24}$/i.test(previewId))
    throw fail(400, 'Invalid support status preview.');
  const preview = await Preview.findOne({ _id: previewId, actor }).lean();
  if (!preview) throw fail(404, 'Support status preview not found.');
  if (preview.expiresAt <= new Date())
    throw fail(410, 'Support status preview has expired.');
  if (preview.result) return preview.result;
  if (
    !Array.isArray(selectedMatches) ||
    selectedMatches.some(
      selection =>
        !isObject(selection) ||
        !hasExactKeys(selection, ['zendeskTicketId', 'requestId']) ||
        !Number.isSafeInteger(selection.zendeskTicketId) ||
        typeof selection.requestId !== 'string' ||
        !/^[a-f\d]{24}$/i.test(selection.requestId),
    )
  )
    throw fail(400, 'Invalid support status selection.');
  const selectedTicketIds = new Set<number>();
  const selectedRequestIds = new Set<string>();
  const automaticTicketIds = new Set(
    preview.entries
      .filter(
        entry => entry.state === 'ready' || entry.state === 'alreadyApplied',
      )
      .map(entry => entry.zendeskTicketId),
  );
  const automaticRequestIds = new Set(
    preview.entries
      .filter(
        entry =>
          (entry.state === 'ready' || entry.state === 'alreadyApplied') &&
          entry.requestId,
      )
      .map(entry => String(entry.requestId)),
  );
  for (const selection of selectedMatches) {
    if (
      selectedTicketIds.has(selection.zendeskTicketId) ||
      selectedRequestIds.has(selection.requestId) ||
      automaticTicketIds.has(selection.zendeskTicketId) ||
      automaticRequestIds.has(selection.requestId)
    )
      throw fail(400, 'Support status selections must be one-to-one.');
    selectedTicketIds.add(selection.zendeskTicketId);
    selectedRequestIds.add(selection.requestId);
    if (
      !preview.entries.some(
        entry =>
          entry.state === 'suggested' &&
          entry.zendeskTicketId === selection.zendeskTicketId &&
          String(entry.requestId) === selection.requestId,
      )
    )
      throw fail(400, 'Selected support request is not a suggested match.');
  }
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
    const selectedKeys = new Set(
      selectedMatches.map(item => `${item.zendeskTicketId}:${item.requestId}`),
    );
    const ready = claimed.entries.filter(
      entry =>
        entry.state === 'ready' ||
        (entry.state === 'suggested' &&
          selectedKeys.has(
            `${entry.zendeskTicketId}:${String(entry.requestId)}`,
          )),
    );
    const unresolvedSuggestedTickets = new Set(
      claimed.entries
        .filter(
          entry =>
            entry.state === 'suggested' &&
            !selectedTicketIds.has(entry.zendeskTicketId),
        )
        .map(entry => entry.zendeskTicketId),
    );
    await audit(actor, 'support-status-import/apply', previewId, {
      eligible: ready.length,
      selectedSuggestions: selectedMatches.length,
    });

    const result: SupportStatusImportApplyResponse = {
      applied: 0,
      alreadyApplied: claimed.entries.filter(
        entry => entry.state === 'alreadyApplied',
      ).length,
      skipped:
        claimed.entries.filter(entry => entry.state === 'skipped').length +
        unresolvedSuggestedTickets.size,
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
      if (entry.matchKind === 'suggested') {
        const originalTime = entry.submittedAt?.getTime();
        if (
          !entry.senderHash ||
          !entry.category ||
          !entry.normalisedMessageHash ||
          typeof current.email !== 'string' ||
          typeof current.message !== 'string' ||
          supportImportSenderHash(current.email) !== entry.senderHash ||
          normaliseStoredSupportCategory(
            current.category,
            current.reportMember,
          ) !== entry.category ||
          supportImportMessageHash(current.message) !==
            entry.normalisedMessageHash ||
          originalTime === undefined ||
          !(current.sent instanceof Date) ||
          Math.abs(current.sent.getTime() - originalTime) >
            (claimed.matchingWindowMinutes ?? 1) * 60_000
        ) {
          result.skipped++;
          continue;
        }
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
      const ticketOwner = await SupportRequest.findOne({
        zendeskTicketId: entry.zendeskTicketId,
        _id: { $ne: current._id },
      })
        .select('_id')
        .lean();
      if (ticketOwner) {
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

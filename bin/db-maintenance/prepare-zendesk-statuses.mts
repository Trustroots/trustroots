#!/usr/bin/env node
import { chmod, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPPORT_CATEGORIES } from '../../modules/support/shared/categories.ts';
import {
  isSupportStatus,
  normaliseSupportStatus,
  type SupportStatus,
} from '../../modules/support/shared/statuses.ts';
import { supportRequestFingerprint } from '../../modules/support/server/services/support-fingerprint.server.service.mts';

export interface ReducedZendeskStatusItem {
  zendeskTicketId: number;
  status: SupportStatus;
  updatedAt: string;
  fingerprint: string;
}

export interface ReducedZendeskStatusManifest {
  version: 1;
  exportedAt: string;
  items: ReducedZendeskStatusItem[];
}

export interface PreparationCounts {
  records: number;
  included: number;
  skipped: number;
  duplicateTicketIds: number;
}

interface ParsedSupportRequest {
  category: keyof typeof SUPPORT_CATEGORIES;
  email: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function categoryForLabel(
  value: string,
): keyof typeof SUPPORT_CATEGORIES | null {
  const entry = Object.entries(SUPPORT_CATEGORIES).find(
    ([, label]) => label === value.trim(),
  );
  return entry ? (entry[0] as keyof typeof SUPPORT_CATEGORIES) : null;
}

/** Extracts only the initial request rendered by the repository's support email template. */
export function parseSupportRequestTemplate(
  value: unknown,
): ParsedSupportRequest | null {
  if (typeof value !== 'string' || value.length > 200_000) return null;
  const source = value.replace(/\r\n/g, '\n');
  const currentMatch = source.match(
    /^Category: ([^\n]+)\n(?:Reported member: [^\n]*\n)?([\s\S]*)\n\n-- \nFrom username: [^\n]*\nEmail: ([^\n]+)\nAuthenticated:/,
  );
  const legacyMatch = currentMatch
    ? null
    : source.match(
        /^(?:(?:Reporting|Reported) member: ([^\n]*)\n)?([\s\S]*)\n\n-- \n(?:From username|Username): [^\n]*\nEmail: ([^\n]+)\nAuthenticated:/,
      );
  // The January 2016 template predates the signature separator. Require its
  // complete generated footer, including the final browser and ID lines.
  const earliestMatch =
    currentMatch || legacyMatch
      ? null
      : source.match(
          /^([\s\S]*)\n\nUsername: [^\n]*\nEmail: ([^\n]+)\nAuthenticated: (?:yes|no)\nBrowser: [^\n]*\nID: [^\n]*\n?$/,
        );
  if (!currentMatch && !legacyMatch && !earliestMatch) return null;
  const category = currentMatch
    ? categoryForLabel(currentMatch[1]!)
    : legacyMatch?.[1]?.trim()
      ? 'reportMember'
      : 'other';
  const email = (
    currentMatch
      ? currentMatch[3]!
      : legacyMatch
        ? legacyMatch[3]!
        : earliestMatch![2]!
  )
    .trim()
    .toLowerCase();
  // The mail renderer wraps plain URLs in angle brackets. Requests store the
  // original text, so remove only that known rendering wrapper before hashing.
  const message = (
    currentMatch
      ? currentMatch[2]!
      : legacyMatch
        ? legacyMatch[2]!
        : earliestMatch![1]!
  )
    .replace(/<(https?:\/\/[^\s<>]+)>/g, '$1')
    .trim();
  if (
    !category ||
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !message
  ) {
    return null;
  }
  return { category, email, message };
}

function ticketBodies(ticket: Record<string, unknown>): unknown[] {
  const bodies: unknown[] = [];
  if (typeof ticket.description === 'string') bodies.push(ticket.description);
  const comments = ticket.comments;
  if (Array.isArray(comments)) {
    for (const comment of comments) {
      if (isRecord(comment) && typeof comment.body === 'string')
        bodies.push(comment.body);
    }
  }
  return bodies;
}

function parsedInitialRequest(
  ticket: Record<string, unknown>,
): ParsedSupportRequest | null {
  const matches = ticketBodies(ticket)
    .map(parseSupportRequestTemplate)
    .filter((item): item is ParsedSupportRequest => item !== null);
  if (!matches.length) return null;
  const first = matches[0]!;
  if (
    matches.some(
      item =>
        item.category !== first.category ||
        item.email !== first.email ||
        item.message !== first.message,
    )
  ) {
    return null;
  }
  return first;
}

function parseTicketId(value: unknown): number | null {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d{1,16}$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseUpdatedAt(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function extractTicketStatusItem(
  ticket: unknown,
): ReducedZendeskStatusItem | null {
  if (!isRecord(ticket)) return null;
  const zendeskTicketId = parseTicketId(ticket.id);
  const status = isSupportStatus(ticket.status)
    ? normaliseSupportStatus(ticket.status)
    : null;
  const updatedAt = parseUpdatedAt(ticket.updated_at);
  const request = parsedInitialRequest(ticket);
  if (zendeskTicketId === null || status === null || !updatedAt || !request) {
    return null;
  }
  return {
    zendeskTicketId,
    status,
    updatedAt,
    fingerprint: supportRequestFingerprint(request),
  };
}

function pageRecords(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;
  for (const key of ['tickets', 'results']) {
    if (Array.isArray(value[key])) return value[key] as unknown[];
  }
  return 'id' in value && 'status' in value ? [value] : null;
}

export function prepareZendeskStatusManifest(
  pages: readonly unknown[],
  exportedAt: Date = new Date(),
): { manifest: ReducedZendeskStatusManifest; counts: PreparationCounts } {
  const counts: PreparationCounts = {
    records: 0,
    included: 0,
    skipped: 0,
    duplicateTicketIds: 0,
  };
  const candidates: ReducedZendeskStatusItem[] = [];
  for (const page of pages) {
    const records = pageRecords(page);
    if (!records) {
      counts.skipped++;
      continue;
    }
    counts.records += records.length;
    for (const record of records) {
      const item = extractTicketStatusItem(record);
      if (item) candidates.push(item);
      else counts.skipped++;
    }
  }

  const occurrences = new Map<number, number>();
  for (const item of candidates) {
    occurrences.set(
      item.zendeskTicketId,
      (occurrences.get(item.zendeskTicketId) || 0) + 1,
    );
  }
  const items = candidates.filter(item => {
    const duplicate = occurrences.get(item.zendeskTicketId)! > 1;
    if (duplicate) {
      counts.duplicateTicketIds++;
      counts.skipped++;
      return false;
    }
    return true;
  });
  counts.included = items.length;
  return {
    manifest: { version: 1, exportedAt: exportedAt.toISOString(), items },
    counts,
  };
}

function parseInput(contents: string): unknown {
  try {
    return JSON.parse(contents) as unknown;
  } catch {
    const lines = contents.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        return null;
      }
    });
  }
}

export async function prepareZendeskStatusFiles(
  inputPaths: readonly string[],
  outputPath: string,
): Promise<PreparationCounts> {
  const expandedPaths: string[] = [];
  for (const inputPath of inputPaths) {
    const inputStat = await stat(inputPath);
    if (!inputStat.isDirectory()) {
      expandedPaths.push(inputPath);
      continue;
    }
    const children = await readdir(inputPath, { withFileTypes: true });
    expandedPaths.push(
      ...children
        .filter(
          child =>
            child.isFile() && /\.(?:json|jsonl|ndjson)$/i.test(child.name),
        )
        .map(child => join(inputPath, child.name))
        .sort(),
    );
  }
  if (!expandedPaths.length)
    throw new Error('No JSON export pages were found in the input path.');
  const pages = await Promise.all(
    expandedPaths.map(async path => parseInput(await readFile(path, 'utf8'))),
  );
  const { manifest, counts } = prepareZendeskStatusManifest(pages);
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await chmod(outputPath, 0o600);
  return counts;
}

async function main(arguments_: string[]) {
  const args = arguments_[0] === '--' ? arguments_.slice(1) : arguments_;
  const outputIndex = args.indexOf('--output');
  if (
    outputIndex < 0 ||
    !args[outputIndex + 1] ||
    args.some(
      (argument, index) => argument === '--output' && index !== outputIndex,
    )
  ) {
    throw new Error(
      'Usage: prepare-zendesk-statuses.mts --output reduced.json export.json|export-directory [additional inputs ...]',
    );
  }
  const outputPath = args[outputIndex + 1]!;
  const inputPaths = args.filter(
    (_, index) => index !== outputIndex && index !== outputIndex + 1,
  );
  if (!inputPaths.length || inputPaths.includes('--')) {
    throw new Error(
      'Usage: prepare-zendesk-statuses.mts --output reduced.json export.json|export-directory [additional inputs ...]',
    );
  }
  const counts = await prepareZendeskStatusFiles(inputPaths, outputPath);
  console.log(JSON.stringify(counts));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2)).catch(() => {
    console.error(
      'Zendesk status manifest preparation failed. Check input files and arguments.',
    );
    process.exitCode = 1;
  });
}

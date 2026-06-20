#!/usr/bin/env node

/**
 * Scan locale JSON files for placeholder/tag mismatches vs English source.
 * Reports: triple braces, missing/extra {{...}} placeholders, mismatched <N>...</N> tags.
 *
 * Usage: node bin/check-i18n-placeholders.js [localeDir...]
 * Default: all dirs under public/locales/ except en/
 */

const { readFileSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

const LOCALES_ROOT = join(__dirname, '..', 'public', 'locales');
const EN_ROOT = join(LOCALES_ROOT, 'en');

const localeDirs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(LOCALES_ROOT).filter(
      d => d !== 'en' && statSync(join(LOCALES_ROOT, d)).isDirectory(),
    );

function extractPlaceholders(str) {
  const matches = str.match(/\{\{[^}]+\}\}/g);
  return matches ? [...matches].sort().join(',') : '';
}

function extractTags(str) {
  const matches = str.match(/<\/?\d+>/g);
  return matches ? [...matches].sort().join(',') : '';
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function checkFile(locale, component, enData, localeData) {
  const issues = [];

  for (const key of Object.keys(localeData)) {
    const value = localeData[key];
    if (typeof value !== 'string' || value === '') continue;

    const enValue = enData[key];
    if (enValue === undefined) continue;

    if (/\}\}\}/.test(value) || /\{\{\{/.test(value)) {
      issues.push({ type: 'triple-brace', key, value: value.slice(0, 80) });
      continue;
    }

    const enPh = extractPlaceholders(enValue);
    const locPh = extractPlaceholders(value);
    if (enPh !== locPh) {
      issues.push({
        type: 'placeholder-mismatch',
        key,
        expected: enPh || '(none)',
        got: locPh || '(none)',
        value: value.slice(0, 80),
      });
    }

    const enTags = extractTags(enValue);
    const locTags = extractTags(value);
    if (enTags !== locTags) {
      issues.push({
        type: 'tag-mismatch',
        key,
        expected: enTags || '(none)',
        got: locTags || '(none)',
        value: value.slice(0, 80),
      });
    }
  }

  return issues.map(i => ({ locale, component, ...i }));
}

let allIssues = [];

for (const locale of localeDirs) {
  const localePath = join(LOCALES_ROOT, locale);
  let files;
  try {
    files = readdirSync(localePath).filter(f => f.endsWith('.json'));
  } catch {
    continue;
  }

  for (const file of files) {
    const component = file.replace('.json', '');
    const enFile = join(EN_ROOT, file);
    const locFile = join(localePath, file);
    let enData;
    let localeData;
    try {
      enData = loadJson(enFile);
      localeData = loadJson(locFile);
    } catch {
      continue;
    }
    allIssues = allIssues.concat(
      checkFile(locale, component, enData, localeData),
    );
  }
}

if (allIssues.length === 0) {
  console.log('No placeholder/tag issues found.');
  process.exit(0);
}

console.log(`Found ${allIssues.length} issue(s):\n`);
for (const issue of allIssues) {
  const rel = `${issue.locale}/${issue.component}.json`;
  if (issue.type === 'triple-brace') {
    console.log(`[triple-brace] ${rel} :: ${issue.key}`);
    console.log(`  ${issue.value}`);
  } else if (issue.type === 'placeholder-mismatch') {
    console.log(`[placeholder] ${rel} :: ${issue.key}`);
    console.log(`  expected: ${issue.expected}`);
    console.log(`  got:      ${issue.got}`);
  } else if (issue.type === 'tag-mismatch') {
    console.log(`[tag] ${rel} :: ${issue.key}`);
    console.log(`  expected: ${issue.expected}`);
    console.log(`  got:      ${issue.got}`);
  }
  console.log('');
}

process.exit(1);

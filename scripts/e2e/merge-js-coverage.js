#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const v8toIstanbul = require('v8-to-istanbul');
const libCoverage = require('istanbul-lib-coverage');

const root = path.resolve(__dirname, '../..');
const rawDir = path.join(root, 'coverage/e2e/js-raw');
const capturedBundlesDir = path.join(root, 'coverage/e2e/captured-bundles');
const outputPath = path.join(root, 'coverage/e2e/coverage-summary.json');
const assetsDir = path.join(root, 'public/assets');
const modulesDir = path.join(root, 'modules');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isAppBundleUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname) &&
      parsed.pathname.startsWith('/assets/')
    );
  } catch (error) {
    return false;
  }
}

function resolveBundlePath(url, source) {
  if (!isAppBundleUrl(url)) {
    return null;
  }

  const bundleName = path.basename(new URL(url).pathname);
  const builtBundlePath = path.join(assetsDir, bundleName);
  if (fs.existsSync(builtBundlePath)) {
    return builtBundlePath;
  }

  if (!source) {
    return null;
  }

  const capturedBundlePath = path.join(capturedBundlesDir, bundleName);
  fs.mkdirSync(capturedBundlesDir, { recursive: true });
  fs.writeFileSync(capturedBundlePath, source);
  return capturedBundlePath;
}

function shouldIncludeSource(sourcePath) {
  const normalized = sourcePath.split(path.sep).join('/');
  if (normalized.includes('node_modules')) {
    return false;
  }

  return normalized.includes('/modules/');
}

function normalizeSourcePath(sourcePath) {
  if (path.isAbsolute(sourcePath)) {
    return sourcePath;
  }

  return path.resolve(root, sourcePath);
}

function summarizeMap(coverageMap) {
  const summary = libCoverage.createCoverageSummary();

  for (const file of coverageMap.files()) {
    summary.merge(coverageMap.fileCoverageFor(file));
  }

  return {
    total: summary.toJSON(),
  };
}

async function mergeRawCoverage() {
  if (!fs.existsSync(rawDir)) {
    return null;
  }

  const rawFiles = fs
    .readdirSync(rawDir)
    .filter(fileName => fileName.endsWith('.json'));
  if (rawFiles.length === 0) {
    return null;
  }

  const coverageMap = libCoverage.createCoverageMap({});

  for (const fileName of rawFiles) {
    const entries = readJson(path.join(rawDir, fileName));
    for (const entry of entries) {
      const bundlePath = resolveBundlePath(entry.url, entry.source);
      if (!bundlePath) {
        continue;
      }

      const converter = v8toIstanbul(bundlePath, 0, {
        source: entry.source || fs.readFileSync(bundlePath, 'utf8'),
      });
      await converter.load();
      converter.applyCoverage(entry.functions);
      const istanbul = converter.toIstanbul();

      for (const [sourcePath, fileCoverage] of Object.entries(istanbul)) {
        const normalizedPath = normalizeSourcePath(sourcePath);
        if (!shouldIncludeSource(normalizedPath)) {
          continue;
        }

        if (!normalizedPath.startsWith(modulesDir)) {
          continue;
        }

        coverageMap.addFileCoverage(fileCoverage);
      }
    }
  }

  if (coverageMap.files().length === 0) {
    return null;
  }

  const summary = summarizeMap(coverageMap);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

async function run() {
  try {
    const summary = await mergeRawCoverage();
    if (!summary) {
      return null;
    }

    return summary;
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    process.stderr.write(`Failed to merge end-to-end JS coverage: ${message}\n`);
    return null;
  }
}

if (require.main === module) {
  run().then(summary => {
    if (summary) {
      process.stdout.write(
        `Wrote ${path.relative(root, outputPath)} from Playwright JS coverage.\n`,
      );
    }
  });
}

module.exports = {
  mergeRawCoverage,
  outputPath,
  rawDir,
};

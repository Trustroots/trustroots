const fs = require('node:fs') as typeof import('node:fs');
const path = require('node:path') as typeof import('node:path');

interface PackageManifest {
  name: string;
  version: string;
}

interface InstalledPackage extends PackageManifest {
  path: string;
}

function readPackageManifest(filename: string): PackageManifest {
  const value: unknown = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (
    typeof value !== 'object' ||
    value === null ||
    !('name' in value) ||
    typeof value.name !== 'string' ||
    !('version' in value) ||
    typeof value.version !== 'string'
  ) {
    throw new Error(`Invalid package manifest: ${filename}`);
  }
  return { name: value.name, version: value.version };
}

function collectInstalledPackages(root: string): InstalledPackage[] {
  const packages: InstalledPackage[] = [];
  function scan(directory: string): void {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || !entry.isDirectory()) continue;
      const location = path.join(directory, entry.name);
      if (entry.name.startsWith('@')) {
        scan(location);
        continue;
      }
      const manifest = readPackageManifest(path.join(location, 'package.json'));
      packages.push({
        name: manifest.name,
        version: manifest.version,
        path: path.relative(root, location).split(path.sep).join('/'),
      });
      scan(path.join(location, 'node_modules'));
    }
  }
  scan(path.join(root, 'node_modules'));
  const virtualStore = path.join(root, 'node_modules/.pnpm');
  if (fs.existsSync(virtualStore)) {
    for (const entry of fs.readdirSync(virtualStore, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        scan(path.join(virtualStore, entry.name, 'node_modules'));
      }
    }
  }
  return packages.sort((a, b) => a.path.localeCompare(b.path));
}

// Node does not set require.main when this script is supplied over Docker stdin.
if (require.main === module || process.argv.includes('--inventory-stdin')) {
  process.stdout.write(
    `${JSON.stringify(
      { packages: collectInstalledPackages(process.cwd()) },
      null,
      2,
    )}\n`,
  );
}

module.exports = { collectInstalledPackages };

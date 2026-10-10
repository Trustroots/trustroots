const fs = require('fs');
const path = require('path');

function collectInstalledPackages(root) {
  const packages = [];
  function scan(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || !entry.isDirectory()) continue;
      const location = path.join(directory, entry.name);
      if (entry.name.startsWith('@')) {
        scan(location);
        continue;
      }
      const manifest = JSON.parse(
        fs.readFileSync(path.join(location, 'package.json'), 'utf8'),
      );
      packages.push({
        name: manifest.name,
        version: manifest.version,
        path: path.relative(root, location).split(path.sep).join('/'),
      });
      scan(path.join(location, 'node_modules'));
    }
  }
  scan(path.join(root, 'node_modules'));
  return packages.sort((a, b) => a.path.localeCompare(b.path));
}

if (require.main === module) {
  process.stdout.write(
    `${JSON.stringify(
      { packages: collectInstalledPackages(process.cwd()) },
      null,
      2,
    )}\n`,
  );
}

module.exports = { collectInstalledPackages };

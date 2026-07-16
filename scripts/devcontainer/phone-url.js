/* eslint-disable no-console, no-process-exit */

const fs = require('fs');
const os = require('os');

if (fs.existsSync('/.dockerenv')) {
  console.error(
    'Run this from the host terminal, not inside the devcontainer.',
  );
  process.exit(1);
}

const port = Number(process.env.TRUSTROOTS_DEV_WEBPACK_HOST_PORT || 13000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(
    'TRUSTROOTS_DEV_WEBPACK_HOST_PORT must be a valid port number.',
  );
  process.exit(1);
}

const ignoredInterface = /^(docker|veth|br-|lo|utun|tun|tap)/i;
const addresses = Object.entries(os.networkInterfaces())
  .filter(([name]) => !ignoredInterface.test(name))
  .flatMap(([, interfaces]) => interfaces || [])
  .filter(
    address =>
      address.family === 'IPv4' &&
      !address.internal &&
      !address.address.startsWith('169.254.'),
  )
  .map(address => address.address);

if (!addresses.length) {
  console.error('No local network IPv4 address was found.');
  process.exit(1);
}

console.log('Open one of these URLs on a phone connected to the same Wi-Fi:');
addresses.forEach(address => console.log(`http://${address}:${port}`));

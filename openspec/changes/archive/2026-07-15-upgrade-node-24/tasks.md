## 1. Runtime declarations and environments

- [x] 1.1 Update Node.js and npm requirements in `.nvmrc`, `package.json`, environment checks, and developer documentation.
- [x] 1.2 Upgrade development, CI, and devcontainer images to the exact Node.js 24 release and remove the npm 7 installation.
- [x] 1.3 Upgrade both production stages to the maintained Passenger Node.js 24 image and verify their runtime versions.
- [x] 1.4 Update GitHub Actions to use Node.js 24 and remove npm 7 setup.

## 2. Dependency compatibility

- [x] 2.1 Regenerate `package-lock.json` with Node.js 24 and npm 11 and verify `npm ci` leaves it unchanged.
- [x] 2.2 Replace `mmmagic` and its node-gyp workaround with maintained magic-byte detection and update its unit tests.
- [x] 2.3 Upgrade `sharp` and Firebase Admin, remove the incompatible optional `canvas` install, and resolve other clean-install blockers.
- [x] 2.4 Upgrade Webpack and associated loaders/plugins so builds do not require the legacy OpenSSL provider.
- [x] 2.5 Re-enable worker tests excluded for Node.js 22+ and resolve their dependency incompatibility.

## 3. Verification

- [x] 3.1 Run formatting/lint and focused unit tests for changed runtime services.
- [x] 3.2 Run the full client and server test suites with unchanged 100% coverage requirements.
- [x] 3.3 Build development and production images and smoke-test the web and worker entry points on Node.js 24.
- [x] 3.4 Run the complete end-to-end suite without reducing the 167-test baseline.

## 4. Documentation and completion

- [x] 4.1 Update development, devcontainer, Docker, and deployment documentation for Node.js 24/npm 11.
- [x] 4.2 Validate the OpenSpec change, record verification results, and archive it after all implementation tasks pass.

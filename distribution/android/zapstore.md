# Zapstore publishing

Zapstore publishes Nostr-signed release metadata for the existing Android APKs.
Use the root [zapstore.yaml](../../zapstore.yaml); the
[preview release workflow](../../.github/workflows/android-preview-release.yml)
already includes an optional Zapstore publishing step.

## Prerequisites

- A signed GitHub Android preview release.
- Access to the Trustroots Nostr signer matching `pubkey` in `zapstore.yaml`.
- The existing Android signing keystore, alias and passwords for the first
  certificate-linking step. See [signing credentials](README.md#signing-credentials).
- `zsp`. The workflow currently pins version `0.4.17`. With Go installed:

  ```sh
  go install github.com/zapstore/zsp@v0.4.17
  export PATH="$(go env GOPATH)/bin:$PATH"
  zsp --version
  ```

Alternatively, download the appropriate platform binary from
[zsp releases](https://github.com/zapstore/zsp/releases).

## First publication

The [publishing script](publish-zapstore.sh) finds the root configuration and
uses browser signing by default. From this directory, run the commands below.
From the repository root, use `./distribution/android/publish-zapstore.sh`.
The script also works when invoked by its absolute path from another directory.

1. Check the selected APK without publishing:

   ```sh
   ./publish-zapstore.sh --check
   ```

   A successful check identifies `org.trustroots.android`. This checks source
   discovery; it does not confirm relay acceptance or publish a listing.

2. Ensure the root configuration is committed and available in the public
   repository. Zapstore uses it to verify that the publishing Nostr key belongs
   to the project.
3. Select the Trustroots identity in a NIP-07 browser signer and publish:

   ```sh
   ./publish-zapstore.sh
   ```

   To supply the keystore location and link its certificate before publishing:

   ```sh
   ./publish-zapstore.sh ~/trustroots-android-release.p12
   ```

   The explicit `--keystore PATH` form is also supported. Replace the example
   filename with your existing keystore. Relative paths
   resolve from your current directory; paths containing spaces must be quoted.
   The wrapper runs `zsp identity --link-key` first and stops if linking fails.
   `--check` and `--offline` skip that step. Use `--help` for wrapper usage.
   Passwords and any required alias are handled by `zsp` interactively.

   Approve signing when prompted. A project-controlled NIP-46 bunker can also
   supply `SIGN_WITH`, which the script preserves when set; obtain its credentials
   through the project's secure credential process. Additional CLI arguments
   are forwarded to `zsp`.

4. If not already linked through `--keystore`, complete the one-time
   signing-certificate link when prompted. Supply the
   existing keystore's absolute path, alias and passwords. This creates the
   NIP-C1 proof connecting the Android signing key to the Nostr publisher.
5. Confirm publication succeeds, find the app in Zapstore and test installation
   and an update from an existing project-signed APK. Record the verified listing
   URL on the public apps page.

## Enable automated updates

After the first publication and certificate link are verified, configure GitHub:

| Setting                    | Type             | Value                                                                 |
| -------------------------- | ---------------- | --------------------------------------------------------------------- |
| `ZAPSTORE_SIGN_WITH`       | Actions secret   | Project-controlled NIP-46 bunker URL for the same Trustroots identity |
| `ZAPSTORE_PUBLISH_ENABLED` | Actions variable | `true`                                                                |

The existing Android preview workflow publishes to Zapstore after creating each
GitHub prerelease. Ensure the remote signer is available and authorised for CI.
Check the first automated run's Zapstore step and verify the new version in the
client. To pause Zapstore automation, set `ZAPSTORE_PUBLISH_ENABLED` to `false`.

## Troubleshooting

- `zsp: command not found`: install the CLI and add its installation directory to
  `PATH`, or invoke the downloaded executable by its full path.
- `load JKS: got invalid magic`: the file may contain PKCS#12 data despite a
  `.jks` extension. Check with `keytool -list -keystore /path/to/keystore`.
  If it reports `Keystore type: PKCS12`, use a `.p12` filename so `zsp` selects
  the correct parser. A symlink preserves the original file:

  ```sh
  ln -s ~/trustroots-android-release.jks ~/trustroots-android-release.p12
  ./publish-zapstore.sh ~/trustroots-android-release.p12
  ```

- Publisher rejected: confirm the signing identity matches `pubkey` and the
  public repository contains `zapstore.yaml`.
- Certificate mismatch: compare the APK's signing certificate with the existing
  release keystore; do not replace the key to work around the error.
- GitHub lookup fails: check API rate limits and release availability. The CI
  workflow supplies `GITHUB_TOKEN` for its release lookup.

See the official [publishing guide](https://zapstore.dev/docs/publish),
[trust model](https://zapstore.dev/docs/trust-model) and
[CLI reference](https://github.com/zapstore/zsp) for current requirements.

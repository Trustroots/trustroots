# Publish Android previews from the apps page

## Why

Maintainers currently need a local zsp process to publish an already signed Android preview to Zapstore. The public apps page already compares the GitHub and Zapstore versions and can offer the corresponding publishing action.

## What Changes

- Prepare verified APK metadata during the Android release workflow and copy the candidate APK into the docs deployment.
- Show a maintainer publishing control on `/apps/`, identifying the prepared version and APK hash before signing.
- Use the existing Trustroots NIP-07 browser identity to authorise the APK upload and sign asset/release events. Confirm upload completion and relay acceptance before reporting success.
- Keep the existing CLI and optional CI signer supported. The page publishes an existing signed APK; it does not build a new binary or collect credentials.

## Impact

Affected specification: android-distribution. Changes are confined to Android release preparation, GitHub Pages deployment and docs browser scripts. No application API, database or account changes. Docs deployments include one preview APK and its public descriptor. Historical releases without descriptors use the verified checked-in candidate until a newly prepared release is deployed.

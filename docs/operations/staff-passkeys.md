# Optional staff passkeys

Administrators with an enrolled authenticator can add a device passkey or hardware key
from the account settings page. Registration and removal ask for the current
password and an unused authenticator or recovery code. The authenticator and
recovery codes remain available after adding or removing a passkey. Disabling
authenticator MFA deletes that account's passkeys and outstanding ceremonies.

After password sign-in, staff can choose **Use a registered passkey** for the
second step. Android and iOS use the same system-browser flow, then return
to the app. Add and remove passkeys in the website's account settings.

## Deployment

Set `TRUSTROOTS_PASSKEY_RP_ID` to the site's domain, without a scheme or port,
and `TRUSTROOTS_PASSKEY_ORIGINS` to a comma-separated list of complete origins,
including the scheme and any non-default port. For example, a local deployment
can use `localhost` and `http://localhost:4300`. Production origins use HTTPS.
Use a stable RP ID: changing it requires members to register credentials again.
These values are explicit deployment configuration and are never inferred from
request headers. Missing configuration leaves passkey operations unavailable.
For hosts using their own Compose file, pass both variables in the `webapp`
service environment.

Run the normal `npm run ensure-indexes` deployment step. `MemberPasskey`
credentials have unique identifiers and an owner index. `PasskeyCeremony`
documents expire after five minutes and have a TTL index; requests independently
check expiry before consuming them. Account removal deletes both collections'
member records. Mobile handoff records also expire after five minutes. On an
existing production deployment, run `pnpm run ensure-indexes MobileBrowserHandoff`
to create their expiry and lookup indexes. Back up credential public keys with
the application database.

The browser requires user verification on registration and sign-in. A cancelled
device request can be retried with a fresh ceremony, or the member can use their
authenticator or recovery code. Credential details remain available only to the
owner; display responses omit public-key material and ceremony bindings.

## Verify mobile sign-in

The release Android app uses the verified App Link at
`https://www.trustroots.org/mobile-auth/complete`. Serve
`/.well-known/assetlinks.json` on that host as JSON over HTTPS without a
redirect. The checked-in association names `org.trustroots.android` and the
certificate used to sign official preview APKs. Verify the certificate against
a published release with `apksigner verify --print-certs <apk>` before changing
it. On a device with a signed build, check the association with
`adb shell pm get-app-links org.trustroots.android`.

On both Android and iOS, use a test administrator account with an enrolled
authenticator and a registered passkey. Start in the app and sign in once
with an authenticator code, once with a recovery code and once with the
passkey. Confirm that each sign-in returns to the app and opens a member-only
screen. Reopen the app after sign-in to check session persistence. Cancel
a browser sign-in and confirm the app is still signed out and can retry.

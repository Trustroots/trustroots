# Optional staff passkeys

Administrators with an enrolled authenticator can add a device passkey or hardware key
from the account settings page. Registration and removal ask for the current
password and an unused authenticator or recovery code. The authenticator and
recovery codes remain available after adding or removing a passkey.

After password sign-in, staff can choose **Use a registered passkey** for the
second step. Native clients retain their existing authenticator compatibility
behaviour; this change adds the browser passkey flow.

## Deployment

Set `TRUSTROOTS_PASSKEY_RP_ID` to the site's domain, without a scheme or port,
and `TRUSTROOTS_PASSKEY_ORIGINS` to a comma-separated list of complete origins,
including the scheme and any non-default port. For example, a local deployment
can use `localhost` and `http://localhost:4300`. Production origins use HTTPS.
Use a stable RP ID: changing it requires members to register credentials again.
These values are explicit deployment configuration and are never inferred from
request headers. Missing configuration leaves passkey operations unavailable.

Run the normal `npm run ensure-indexes` deployment step. `MemberPasskey`
credentials have unique identifiers and an owner index. `PasskeyCeremony`
documents expire after five minutes and have a TTL index; requests independently
check expiry before consuming them. Account removal deletes both collections'
member records. Back up credential public keys with the application database.

The browser requires user verification on registration and sign-in. A cancelled
device request can be retried with a fresh ceremony, or the member can use their
authenticator or recovery code. Credential details remain available only to the
owner; display responses omit public-key material and ceremony bindings.

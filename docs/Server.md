# Server

As of October 2022 the production server is deployed at Hetzner Cloud with ansible and docker

SSL certs from Let's Encrypt certbot.

## Browser origins and cookie-backed mutations

The application checks browser `Origin` and Fetch Metadata headers before
session handling. If the browser app is served from an additional origin,
configure `TRUSTROOTS_CSRF_ALLOWED_ORIGINS` as a comma-separated list of
trusted origins, for example `https://app.example.org`. Do not include paths.
For a TLS-terminating proxy, ensure it overwrites forwarded protocol headers
and prevent direct access to the application server.

The browser signs out with `POST /api/auth/signout`; `GET` is no longer
supported. Update external clients that used the former GET route. Originless
native clients must send `X-Trustroots-Request: 1` on bodyless or multipart
state-changing requests. The shared browser API client adds this marker to
state-changing requests automatically. When uploading `FormData`, leave
`Content-Type` unset so the browser can add the multipart boundary.

## Avatar upload staging

Deploy the updated Nginx location rules in
`deploy/files/prod-conf/nginx-location.conf` with the avatar processing
change. Nginx serves static files before requests reach Express middleware,
so the rules must deny requests for unpublished staging thumbnails.

Kasper, Robin and Callum have access, can deploy and are maintaining off-site encrypted backups.

## Session cookies behind HTTPS

Set `https: true` in local configuration for HTTPS deployments. Session cookies
then require HTTPS and include Secure, HttpOnly and SameSite=Lax. Direct TLS
termination (for example Passenger) needs no proxy setting. For a TLS frontend,
also set `sessionProxy: true` only when that frontend overwrites
`X-Forwarded-Proto` and prevents direct public access to the application. This
setting is off by default and does not enable Express-wide proxy trust. Verify
sign-in and the Secure cookie through the actual frontend before deployment.
Leave `https: false` for HTTP development and tests. The lifetime remains 28 days.
Untouched anonymous requests no longer create stored sessions, and unchanged
authenticated requests refresh expiry through the session store's touch method.
SameSite is an additional defence; the separate CSRF middleware also protects
cookie-backed mutations.

## Authenticator MFA encryption key

Set `MFA_ENCRYPTION_KEY` on every application instance to the same dedicated
base64-encoded 32-byte random key. Generate it with
`openssl rand -base64 32`; do not reuse `SESSION_SECRET`, database credentials,
or password-hashing material. The application uses this key only for
AES-256-GCM encryption of authenticator secrets. Keep it in the deployment
secret store and include it in the protected configuration backup needed to
restore MFA after disaster recovery. Losing the key makes enrolled
authenticator secrets unreadable and requires account recovery. Rotating the
key requires decrypting and re-encrypting every active and pending secret
before switching all instances; do not replace the value without that
migration. Test environments use a fixed test-only key.

Authenticator MFA is optional for members. Admin, moderator, and welcome-team
permissions require a session that has completed MFA. Existing privileged
members should enrol an authenticator before relying on those permissions.
The current MFA challenge is supported by the web sign-in flow. Native Android
and iOS clients do not yet handle the `202 mfaRequired` response, so members
who enable MFA must use the web client until native challenge support ships.

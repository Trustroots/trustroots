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


Kasper, Robin and Callum have access, can deploy and are maintaining off-site encrypted backups.


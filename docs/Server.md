# Server

As of October 2022 the production server is deployed at Hetzner Cloud with ansible and docker

SSL certs from Let's Encrypt certbot.

## Avatar upload staging

Deploy the updated Nginx location rules in
`deploy/files/prod-conf/nginx-location.conf` with the avatar processing
change. Nginx serves static files before requests reach Express middleware,
so the rules must deny requests for unpublished staging thumbnails.


Kasper, Robin and Callum have access, can deploy and are maintaining off-site encrypted backups.


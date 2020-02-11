# Server

As of December 2018 we're in the process of moving to deploying
everything [through
ansible](https://github.com/Trustroots/trustroots/tree/master/deploy/ansible). For
now we have done the basics for https://dev.trustroots.org/ and
https://staging.trustroots.org/.

---

Trustroots runs on
[DigitalOcean](https://www.digitalocean.com/?refcode=6dc078966c9c)
(_referral link_) Ubuntu 14.04 droplet.

This is how to configure production server.

# Nginx

- Nginx v1.8.x
- Redirect port 80 to 443.
- Redirect non-www to www.
- Proxy traffic to port 3000 (NodeJS app) with [Passenger](https://www.phusionpassenger.com/) v5.x [Installation instructions](https://www.phusionpassenger.com/documentation/Users%20guide%20Nginx.html#install_on_debian_ubuntu)
- Serve /public/ directly with Nginx (without NodeJS in between).

Make sure `/etc/nginx/nginx.conf` has these:

```
passenger_root /usr/lib/ruby/vendor_ruby/phusion_passenger/locations.ini;
# passenger_ruby /usr/bin/passenger_free_ruby;
passenger_nodejs /usr/local/bin/node;
passenger_show_version_in_header off;
```

Make sure you have configuration file at `/etc/nginx/sites-available/trustroots_org.conf` and equivalent symlink pointing to it from sites-enabled: `ln -s ../sites-available/trustroots_org.conf trustroots_org.conf`.

Test configuration by running `sudo nginx -t` and start/stop/restart nginx by `sudo service nginx {start|stop|restart|reload|force-reload|status|configtest|rotate|upgrade}`

# SSL

- Old certs from Namecheap.com (currently just `www.trustroots.org` + `trustroots.org`
- New certs with Certbot (shop/grafana/dev etc)
- [Check health](https://www.ssllabs.com/ssltest/analyze.html?d=trustroots.org)

# Backups

- Located at `/srv/backups/`
- Daily full backup of the server droplet by DigitalOcean
- Daily synced of backups directory to [S3](http://aws.amazon.com/s3/) (database & uploaded files).

## Configure backups

1. Install [AWS CLI](https://github.com/aws/aws-cli)
2. Make sure you have bucket `trustroots-backups` at [S3](http://aws.amazon.com/s3/) and give user access to that bucket
3. Create a config file with user's access keys `/srv/configs/aws.conf`:

```
[default]
aws_access_key_id=ACCESS_KEY
aws_secret_access_key=SECRET_KEY
# Optional, to define default region for this profile.
region=eu-west-1
```

4. Add backup scripts for the [DB](https://github.com/Trustroots/trustroots/blob/master/scripts/backup-db.sh) and [files](https://github.com/Trustroots/trustroots/blob/master/scripts/s3backup.sh) by typing `sudo crontab -e` and add these lines:

```
# Backup Trustroots.org DB, once per hour (at x:00)
0 * * * * /srv/trustroots/scripts/backup-db.sh >/dev/null 2>&1

# Sync backup directory to AWS S3, once per hour (at x:10)
10 * * * * /srv/trustroots/scripts/s3backup.sh >/dev/null 2>&1
```

If your deployment runs DB migration scripts, create a backup prior to that by running `sudo bash /srv/trustroots/scripts/backup-db.sh`

#### Updating AWS client ([via](https://trepmal.com/2014/03/12/automating-backups-to-amazon-s3/))

- As in; it's not installed via python pip
- Test you have the latest; `aws --version`
- Update:

```
wget https://s3.amazonaws.com/aws-cli/awscli-bundle.zip
unzip awscli-bundle.zip
sudo ./awscli-bundle/install -i /usr/local/aws -b /usr/local/bin/aws
```

# Database

- Install & setup [MongoDB](http://www.mongodb.org/) v2.x

# Swap

- Follow [these instructions](https://www.digitalocean.com/community/tutorials/how-to-add-swap-on-ubuntu-14-04)
- Swap file 4 Gt
- Set `vm.swappiness` to 30
- Set `vfs_cache_pressure` to 50

# Logs

- rsyslog pushes logs to [papertrail](http://papertrailapp.com) as per [this](http://help.papertrailapp.com/kb/configuration/configuring-remote-syslog-from-unixlinux-and-bsdos-x/)
- [remote_syslog](https://github.com/papertrail/remote_syslog2) is installed and pushing logs to papertrail
  - It may or may not be started on boot #442

# People with rights to access the server, databases and statistics

Kasper, Mikael. Abel.
https://github.com/orgs/Trustroots/teams/ops

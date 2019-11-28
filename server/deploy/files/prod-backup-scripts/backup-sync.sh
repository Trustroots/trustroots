#!/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# AWS S3 sync backup
#
# Make sure you have aws-cli installed before running this!
#
# http://aws.amazon.com/
# https://github.com/aws/aws-cli
# https://trepmal.com/2014/03/12/automating-backups-to-amazon-s3/

BUCKET="trustroots-backups"
BACKUPS_BASE=/srv/backups
MONGODB_DUMPS=$BACKUPS_BASE/mongodb-dumps
INFLUXDB_DUMPS=$BACKUPS_BASE/influxdb-dumps
AVATAR_DATA=/srv/uploads
GRAFANA_DATA=/var/lib/grafana # Grafana data, sessions and plugins
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOGSPATH=/srv/logs/aws
LOGFILE=$LOGSPATH/$TIMESTAMP.log

# AWS Config (OR keep it at ~/.aws/config and comment this out)
export AWS_CONFIG_FILE=/srv/configs/aws.conf

set -e

# Just to ensure this scripts works in any env
export LC_ALL=C

# Handle logging to log files
# Requires $LOGFILE and $LOGSPATH
source logs.sh

echo "Backup sync to AWS S3 at $TIMESTAMP"

# Delete older logfiles
echo "Delete old AWS logs..."
find $LOGSPATH -name "*.log" -type f -mtime +7 -print -delete

# Backup
# Files that exist in the destination but not in the source are deleted during sync.

# MongoDB dumps
echo "Sync MongoDB dumps..."
/usr/local/bin/aws s3 sync $MONGODB_DUMPS s3://$BUCKET/mongodb-dumps --delete

# User uploads
echo "Sync user uploads..."
/usr/local/bin/aws s3 sync $AVATAR_DATA s3://$BUCKET/users-uploads --delete

# User InfluxDB dumps
echo "Sync InfluxDB dumps..."
/usr/local/bin/aws s3 sync $INFLUXDB_DUMPS s3://$BUCKET/influxdb-dumps --delete

# User Grafana data
echo "Sync user uploads..."
/usr/local/bin/aws s3 sync $GRAFANA_DATA s3://$BUCKET/grafana-data --delete

echo "Finished at $(date +%Y%m%d_%H%M%S)"

exit 0


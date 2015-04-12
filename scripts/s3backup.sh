#!/bin/bash

# AWS S3 sync backup
#
# Make sure you have aws-cli installed before running this!
#
# http://aws.amazon.com/
# https://github.com/aws/aws-cli
# https://trepmal.com/2014/03/12/automating-backups-to-amazon-s3/

BUCKET="trustroots-backups"
BACKUPSDIR=/srv/backups
AVATAR_BACKUPSDIR=/srv/trustroots/public/modules/users/img/profile/uploads
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOGSPATH="/srv/logs/aws/"
LOGFILE=$LOGSPATH/$TIMESTAMP.log

# AWS Config (OR keep it at ~/.aws/config and comment this out)
export AWS_CONFIG_FILE=/srv/configs/aws.conf

if [ ! -d "$LOGSPATH" ]; then
  echo ""
  echo "Creating $LOGSPATH directory..."
  mkdir -p $LOGSPATH
fi

echo "Backup S3 sync at $TIMESTAMP" >> $LOGFILE

# Delete older logfiles
echo "Delete old AWS logs..." >> $LOGFILE
find $LOGSPATH -name "*.log" -type f -mtime +7 -print -delete >> $LOGFILE

# Backup
# Files that exist in the destination but not in the source are deleted during sync.

# MongoDBs
echo "Sync MongoDB backups..." >> $LOGFILE
/usr/local/bin/aws s3 sync $BACKUPSDIR s3://$BUCKET --delete >> $LOGFILE

# User uploads
echo "Sync user uploads..." >> $LOGFILE
/usr/local/bin/aws s3 sync $AVATAR_BACKUPSDIR s3://$BUCKET/users-uploads --delete >> $LOGFILE


echo "Finished at $(date +%Y%m%d_%H%M%S)" >> $LOGFILE

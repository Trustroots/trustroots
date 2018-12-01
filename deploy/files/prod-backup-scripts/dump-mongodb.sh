#!/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

#
# MONGODB BACKUP
#
# 1. Export the db
# 2. tar.gz exported files
# 3. delete exported files (keeps tar)

# Note that backups are non-blocking
# http://stackoverflow.com/questions/14825557/does-mongodump-lock-the-database
# To lock/unlock, you could use https://gist.github.com/mushfiq/6186677 and https://gist.github.com/mushfiq/6186681
# See http://mushfiq.me/2013/08/08/mongodb-backup-script/ for more.


# SETTINGS
MONGODBNAME="trust-roots" # database name
DUMPPATH="/srv/backups/mongodb-dumps"
LOGSPATH="/srv/logs/mongodb-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TIMESTART=$(date +%s)
LOGFILE=$LOGSPATH/$MONGODBNAME_$TIMESTAMP.log
DUMPFILE=$MONGODBNAME-$TIMESTAMP

set -e

# Handle logging to log files
# Requires $LOGFILE and $LOGSPATH
source logs.sh

# Make sure these directories exist
if [ ! -d "$DUMPPATH" ]; then
  echo "Creating $DUMPPATH directory..."
  mkdir -p $DUMPPATH
fi

echo "Backup:: Script Start -- $(date +%Y%m%d_%H%M)"

# Delete older backups
echo "Delete old backups..."
find $DUMPPATH -name "*.tar.gz" -type f -mtime +5 -print -delete

# Backup MongoDB
echo "Exporting MongoDB to $DUMPFILE..."
/usr/bin/mongodump --db "$MONGODBNAME" --out "$DUMPPATH/$DUMPFILE"

# create an archive out of that dump
echo "Store dump folder to $DUMPFILE.tar.gz..."
tar -zcvf "$DUMPPATH/$DUMPFILE.tar.gz" -C "$DUMPPATH" "$DUMPFILE"

# remove the dump because we only keep the archive version
rm -rf "$DUMPPATH/$DUMPFILE"

TIMEEND=$(date +%s)
TIMEELAPSED=$(expr $TIMEEND - $TIMESTART)

echo "Backup :: Script End -- $(date +%Y%m%d_%H%M)"
echo "Elapsed Time ::  $(date -d 00:00:$TIMEELAPSED +%Hh:%Mm:%Ss) "

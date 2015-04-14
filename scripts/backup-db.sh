#!/bin/bash

#
# MONGODB BACKUP
#
# Export the db and tar.gz them into a folder.


# Note that backups are non-blocking
# http://stackoverflow.com/questions/14825557/does-mongodump-lock-the-database
# To lock/unlock, you could use https://gist.github.com/mushfiq/6186677 and https://gist.github.com/mushfiq/6186681
# See http://mushfiq.me/2013/08/08/mongodb-backup-script/ for more.


# SETTINGS
MONGODBNAME="trust-roots" # MongoDB to backup

DUMPPATH="/srv/backups/db-dumps"
LOGSPATH="/srv/logs/db-backups"
#TIMESTAMP=`/bin/date +%Y%m%d`
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TIMESTART=$(date +%s)
LOGFILE=$LOGSPATH/$MONGODBNAME_$TIMESTAMP.log

# Make sure these directories exist
if [ ! -d "$DUMPPATH" ]; then
  echo ""
  echo "Creating $DUMPPATH directory..."
  mkdir -p $DUMPPATH
fi
if [ ! -d "$LOGSPATH" ]; then
  echo ""
  echo "Creating $LOGSPATH directory..."
  mkdir -p $LOGSPATH
fi

echo "Backup:: Script Start -- $(date +%Y%m%d_%H%M)" >> $LOGFILE

# Just to ensure this scripts works in any env
export LC_ALL=C

# Delete older backups
echo "Delete old backups..." >> $LOGFILE
find $DUMPPATH -name "*.tar.gz" -type f -mtime +7 -print -delete >> $LOGFILE

# Delete older logfiles
echo "Delete old logs..." >> $LOGFILE
find $LOGSPATH -name "*.log" -type f -mtime +7 -print -delete >> $LOGFILE

DUMPFILE=$MONGODBNAME-$TIMESTAMP

echo "Exporting MongoDB to $DUMPFILE..." >> $LOGFILE
# Backup MongoDB
mongodump --db "$MONGODBNAME" --out "$DUMPPATH/$DUMPFILE" >> $LOGFILE

echo "Store dump folder to $DUMPFILE.tar.gz..." >> $LOGFILE
tar -zcvf "$DUMPPATH/$DUMPFILE.tar.gz" "$DUMPPATH/$DUMPFILE" >> $LOGFILE # create an archive out of that dump

#cd $DUMPPATH
rm -rf "$DUMPPATH/$DUMPFILE" >> $LOGFILE # remove the dump because we only keep the archive version


TIMEEND=$(date +%s)
TIMEELAPSED=$(expr $TIMEEND - $TIMESTART)

echo "Backup :: Script End -- $(date +%Y%m%d_%H%M)" >> $LOGFILE
echo "Elapsed Time ::  $(date -d 00:00:$TIMEELAPSED +%Hh:%Mm:%Ss) " >> $LOGFILE

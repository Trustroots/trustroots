#!/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

#
# INFLUXDB BACKUP
#
# Export the InfluxDB Meta and tar.gz them into a folder
#
# See https://docs.influxdata.com/influxdb/v1.0/administration/backup_and_restore/

# SETTINGS
INFLUXDB_DATABASE="trustroots"
DUMPPATH_BASE="/srv/backups/influxdb-dumps"
LOGSPATH="/srv/logs/influxdb-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TIMESTART=$(date +%s)
DUMPPATH="$DUMPPATH_BASE/$TIMESTAMP"
LOGFILE=$LOGSPATH/$TIMESTAMP.log

set -e

# Handle logging to log files
# Requires $LOGFILE and $LOGSPATH
#source logs.sh

# Make sure directory exists
if [ ! -d "$DUMPPATH" ]; then
  echo ""
  echo "Creating $DUMPPATH directory..."
  mkdir -p $DUMPPATH
fi

echo "InfluxDB backup :: Script Start -- $(date +%Y%m%d_%H%M)"
echo "Dump folder: $DUMPPATH"

# Delete older backups
echo "Delete old backups..."
find $DUMPPATH -name "*.tar.gz" -type f -mtime +2 -print -delete

# Backup db + metastore
# Each database must be backed up individually.
echo "Exporting database \"$INFLUXDB_DATABASE\"..."
/usr/bin/influxd backup -database $INFLUXDB_DATABASE "$DUMPPATH"

# Create an archive out of that dump
echo "Store dump folder to $DUMPPATH_BASE/$TIMESTAMP.tar.gz..."
tar -zcvf "$DUMPPATH_BASE/$TIMESTAMP.tar.gz" -C "$DUMPPATH_BASE" "$TIMESTAMP"

# Clean out folder, keep the tar
echo "Remove folder \"$DUMPPATH\"..." >> $LOGFILE
rm -rf "$DUMPPATH" # remove the dump because we only keep the archive version


TIMEEND=$(date +%s)
TIMEELAPSED=$(expr $TIMEEND - $TIMESTART)

echo "InfluxDB backup :: Script End -- $(date +%Y%m%d_%H%M)"
echo "Elapsed Time ::  $(date -d 00:00:$TIMEELAPSED +%Hh:%Mm:%Ss) "


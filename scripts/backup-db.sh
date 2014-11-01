#!/bin/bash
DUMPPATH=/srv/backups/db-dumps # dumps directory we just created
MONGODBNAME=trust-roots # your MongoDB database name
DAY=`/bin/date +%Y%m%d` # today's datetime

# Just to ensure this scripts works in any env
export LC_ALL=C

# Backup
mongodump --db $MONGODBNAME --out $DUMPPATH/mongo_$DAY # run the command we those variables set
cd $DUMPPATH/mongo_$DAY # navigate to the folder where the dump was saved
tar -cvzf "$DUMPPATH/mongo_$DAY.tar" $MONGODBNAME # create an archive out of that dump

cd $DUMPPATH
rm -rf $DUMPPATH/mongo_$DAY # remove the dump because we only keep the archive version

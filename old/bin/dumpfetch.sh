#!/bin/bash

echo Fetching prod db
echo   This will only work if you have ssh access to our production server
echo   i.e. this should only work if you have signed our NDA
echo
echo If you run this on your laptop:
echo  - Ensure that the harddrive is encrypted
echo  - Ensure that you have a screensaver with short time
echo


cd $(dirname $0)
ssh trustroots.org "mongodump --db trust-roots --out ~/dump"
rsync -zav trustroots.org:dump .
ssh trustroots.org "rm -r ~/dump"

./dumpimport.sh ${1:-trustroots-dev}

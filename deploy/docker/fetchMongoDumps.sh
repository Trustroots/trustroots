#!/bin/bash

set -eo pipefail

cd "$(dirname "$0")"
mkdir -p mongodumps
cd mongodumps
archive=trust-roots-dump-no-agenda.bson.gz
partial=$(mktemp "${archive}.XXXXXX")
trap 'rm -f "$partial"' EXIT

ssh trustroots.org "sudo docker exec trustroots-mongodb-1 mongodump --db trust-roots --excludeCollection agendaJobs --archive --gzip" | pv > "$partial"
mv "$partial" "$archive"

#!/bin/bash

DB=${1:-trustroots-dev}

echo Importing dumps into $DB


cd $(dirname $0)

pushd dump/trust-roots

# Removing some stuff that didn't work for @guaka
sed -e 's/,"safe":null//g' users.metadata.json > users.metadata.json
sed -e 's/,"safe":null//g' offers.metadata.json > offers.metadata.json
popd


mongo $DB --eval "db.dropDatabase()"
mongorestore --db $DB dump/trust-roots

./privacy.mongo

#!/bin/bash

cd $(dirname $0)/../../../

pwd

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

set -e

echo "Importing MongoDB data from mongodumps/mongodb/trust-roots to localhost:27017"

if [ ! -d "mongodumps/mongodb/trust-roots" ]; then
  echo "Error: mongodumps/mongodb/trust-roots/ directory not found"
  exit 1
fi

MONGODUMP_PATH=$(realpath mongodumps/mongodb/trust-roots)

DB_NAME="trustroots"

echo "This will drop the existing '$DB_NAME' database and import fresh data."
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Import cancelled."
    exit 1
fi

DB_NAME="trustroots"

echo "Dropping existing collections..."
mongosh --host localhost:27017 --eval "db.dropDatabase()" $DB_NAME

echo "Importing data..."
mongorestore --host localhost:27017 --db $DB_NAME --excludeCollection=agendaJobs $MONGODUMP_PATH

echo "Data import completed!"

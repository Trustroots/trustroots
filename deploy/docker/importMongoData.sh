#!/bin/bash

cd $(dirname $0)

pwd

DB_NAME="trustroots"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

set -e

echo "Importing MongoDB data from mongodumps/ to localhost:27017"

if [ ! -d "mongodumps" ]; then
  echo "Error: mongodumps/ directory not found"
  exit 1
fi

MONGODUMP_PATH=$(realpath mongodumps)


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
# Check if we have a compressed BSON archive file
if [ -f "$MONGODUMP_PATH/trust-roots-dump-no-agenda.bson.gz" ]; then
  echo "Found compressed BSON archive file, importing..."
  # The archive contains data for "trust-roots" database, we need to rename it to "trustroots"
  gunzip -c "$MONGODUMP_PATH/trust-roots-dump-no-agenda.bson.gz" | mongorestore --host localhost:27017 --archive --nsFrom="trust-roots.*" --nsTo="trustroots.*"
else
  echo "No compressed BSON archive file found, trying standard mongorestore..."
  mongorestore --host localhost:27017 --db $DB_NAME --excludeCollection=agendaJobs $MONGODUMP_PATH
fi

echo "Data import completed!"

echo ""
echo "=========================================="
echo "DATABASE OVERVIEW"
echo "=========================================="

echo "Database: $DB_NAME"
echo "Host: localhost:27017"
echo ""

# Get collection list and document counts
echo "Collections and document counts:"
echo "--------------------------------"
mongosh --host localhost:27017 --quiet --eval "
db = db.getSiblingDB('$DB_NAME');
var collections = db.getCollectionNames();
collections.forEach(function(collection) {
  var count = db.getCollection(collection).countDocuments();
  print(collection + ': ' + count + ' documents');
});
" | grep -v "MongoDB shell"

echo ""

# Get database stats
echo "Database statistics:"
echo "-------------------"
mongosh --host localhost:27017 --quiet --eval "
db = db.getSiblingDB('$DB_NAME');
var stats = db.stats();
print('Collections: ' + stats.collections);
print('Data size: ' + (stats.dataSize / 1024 / 1024).toFixed(2) + ' MB');
print('Storage size: ' + (stats.storageSize / 1024 / 1024).toFixed(2) + ' MB');
print('Index size: ' + (stats.indexSize / 1024 / 1024).toFixed(2) + ' MB');
print('Total size: ' + (stats.totalSize / 1024 / 1024).toFixed(2) + ' MB');
" | grep -v "MongoDB shell"

echo ""
echo "=========================================="

#!/bin/bash

cd "$(dirname "$0")"

pwd

DB_NAME="trustroots"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

set -e

if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker-compose"
else
  echo "Error: docker compose (or docker-compose) is required."
  exit 1
fi

if ! $DOCKER_COMPOSE_CMD ps --services --status running | rg -x "mongodb" >/dev/null; then
  echo "Error: mongodb service is not running."
  echo "Start it with: $DOCKER_COMPOSE_CMD up -d mongodb"
  exit 1
fi

if $DOCKER_COMPOSE_CMD exec -T mongodb sh -lc "command -v mongosh >/dev/null 2>&1"; then
  MONGO_SHELL="mongosh"
elif $DOCKER_COMPOSE_CMD exec -T mongodb sh -lc "command -v mongo >/dev/null 2>&1"; then
  MONGO_SHELL="mongo"
else
  echo "Error: neither 'mongosh' nor 'mongo' is available in mongodb container."
  exit 1
fi

echo "Importing MongoDB data from mongodumps/ to mongodb container"

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
$DOCKER_COMPOSE_CMD exec -T mongodb "$MONGO_SHELL" "$DB_NAME" --quiet --eval "db.dropDatabase()"

echo "Importing data..."
# Check if we have a compressed BSON archive file
if [ -f "$MONGODUMP_PATH/trust-roots-dump-no-agenda.bson.gz" ]; then
  echo "Found compressed BSON archive file, importing..."
  # The archive contains data for "trust-roots" database, we need to rename it to "trustroots"
  gunzip -c "$MONGODUMP_PATH/trust-roots-dump-no-agenda.bson.gz" | \
    $DOCKER_COMPOSE_CMD exec -T mongodb mongorestore --archive --nsFrom="trust-roots.*" --nsTo="trustroots.*"
else
  echo "No compressed BSON archive file found, trying standard mongorestore..."
  TMP_DUMP_PATH="/tmp/trustroots-mongodump-$TIMESTAMP"
  echo "Copying dump directory into mongodb container..."
  $DOCKER_COMPOSE_CMD cp "$MONGODUMP_PATH" "mongodb:$TMP_DUMP_PATH"
  echo "Importing dump from container path..."
  $DOCKER_COMPOSE_CMD exec -T mongodb mongorestore --db "$DB_NAME" --excludeCollection=agendaJobs "$TMP_DUMP_PATH"
  echo "Cleaning up temporary dump files in container..."
  $DOCKER_COMPOSE_CMD exec -T mongodb rm -rf "$TMP_DUMP_PATH"
fi

echo "Data import completed!"

echo ""
echo "=========================================="
echo "DATABASE OVERVIEW"
echo "=========================================="

echo "Database: $DB_NAME"
echo "Host: mongodb (docker compose service)"
echo ""

# Get collection list and document counts
echo "Collections and document counts:"
echo "--------------------------------"
$DOCKER_COMPOSE_CMD exec -T mongodb "$MONGO_SHELL" --quiet --eval "
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
$DOCKER_COMPOSE_CMD exec -T mongodb "$MONGO_SHELL" --quiet --eval "
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

cd $(dirname $0)
mkdir -p mongodumps
cd mongodumps
ssh trustroots.org "sudo docker exec trustroots-mongodb-1 mongodump --db trust-roots --excludeCollection agendaJobs --archive --gzip" | pv > trust-roots-dump-no-agenda.bson.gz

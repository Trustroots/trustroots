#!/bin/bash

# Script lists all running docker container IPs
# http://stackoverflow.com/a/31559812/1984644
#
# To get your machine IP instead, type `docker-machine ip default`
# (where default is your machine name, usually `default`)
#

dip() {
  docker inspect --format '{{ .NetworkSettings.IPAddress }}' "$@"
}

dipall() {
  for container_name in $(docker-compose ps | tail +3 | cut -d" " -f1);
  do
    local container_ip=$(dip $container_name)
    if [[ -n "$container_ip" ]]; then
      echo $(dip $container_name) " $container_name"
    fi
  done
}

dipall
exit 0

#!/bin/sh

set -e

case "$1" in
  start)
    echo "Starting Trustroots.org..."
    echo
    sudo service nginx start
    sudo passenger-status
  ;;
restart)
    echo "Restarting Trustroots.org..."
    echo
    sudo service nginx restart
    sudo passenger-status
  ;;
stop)
    echo "Stopping Trustroots.org..."
    echo
    sudo service nginx stop
    sudo passenger-status
  ;;

*)
  echo "Usage: sh starter.sh {start|restart|stop}"
  exit 1
  ;;
esac

exit 0

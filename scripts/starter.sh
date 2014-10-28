#!/bin/sh

# A script that starts the app using forever (npm install -g forever)


case "$1" in
  start)
    echo "Starting Trustroots.org..."
    echo
    NODE_ENV=production grunt production-forever
    forever list
  ;;
restart)
    echo "Restarting Trustroots.org..."
    echo
    grunt forever::restart
  ;;
stop)
    echo "Stopping Trustroots.org..."
    echo
    grunt forever::stop
  ;;

*)
  echo "Usage: sh starter.sh {start|restart|stop}"
  exit 1
  ;;
esac

exit 0

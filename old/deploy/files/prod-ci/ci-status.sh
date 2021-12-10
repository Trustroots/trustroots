#!/bin/bash

# Trustroots app + background worker status

echo ""
echo "-------------------------------------------"
echo "Trustroots Worker status (pm2)"
sudo su -c "pm2 show worker" pm2

echo ""
echo "-------------------------------------------"
echo "Passenger status"
sudo passenger-status

echo ""
echo "-------------------------------------------"
echo "MongoDB status"
#sudo service mongod status
sudo systemctl status mongodb --lines=0

echo ""
echo "-------------------------------------------"
echo "InfluxDB status"
sudo systemctl status influxdb --lines=0

echo ""
echo "-------------------------------------------"
echo "Grafana status"
sudo systemctl status grafana-server --lines=0

exit 0

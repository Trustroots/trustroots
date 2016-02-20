#!/bin/bash

# Start containers at the background and tail logs from the app container
docker-compose up -d && docker-compose logs trustroots
exit 0

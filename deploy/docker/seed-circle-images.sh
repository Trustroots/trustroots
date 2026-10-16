#!/bin/bash
# Copy shipped circle images into the live directory without replacing files
# that an administrator has already stored there. The live directory is the
# persistent mount; the seed stays in the image outside that mount.
set -eu
seed=/home/app/trustroots/circle-image-seed
dest=/home/app/trustroots/public/uploads-circle
mkdir -p "$dest"
if [ -d "$seed" ]; then
  cp -an "$seed/." "$dest/"
fi
chown -R app:app "$dest"

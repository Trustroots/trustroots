#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Generate Swagger UI documentation for our API
# http://swagger.io/swagger-ui/

echo ""
echo "Generating Swagger UI docs..."
echo ""

DOCS_INSTALL_PATH="./public/developers/api"

# return 1 if global command line program installed, else 0
# example
# echo "node: $(program_is_installed node)"
# https://gist.github.com/JamieMason/4761049
function is_installed {
  # set to 1 initially
  local return_=1
  # set to 0 if not found
  type $1 >/dev/null 2>&1 || { local return_=0; }
  # return value
  echo "$return_"
}

# Check we have what we need
if [ "$(is_installed wget)" -ne "1" ]
then
  echo "Error: Missing wget. Install it before running this script."
  exit 1
fi
if [ "$(is_installed unzip)" -ne "1" ]
then
  echo "Error: Missing unzip. Install it before running this script."
  exit 1
fi

# Folder/download jazz
if [ ! -d "./tmp" ]; then
  mkdir -p ./tmp
fi
if [ -d "./tmp/swagger-ui-master" ]; then
  rm -fr ./tmp/swagger-ui-master
fi
if [ -f "./tmp/swagger-ui.zip" ]; then
  rm -f ./tmp/swagger-ui.zip
fi
wget -nv -O ./tmp/swagger-ui.zip  https://github.com/swagger-api/swagger-ui/archive/master.zip
unzip -q ./tmp/swagger-ui.zip -d ./tmp
if [ -d "$DOCS_INSTALL_PATH" ]; then
  rm -fr "$DOCS_INSTALL_PATH"
fi
mkdir -p "$DOCS_INSTALL_PATH"
mv ./tmp/swagger-ui-master/dist/* "$DOCS_INSTALL_PATH"
rm -fr ./tmp/swagger-ui-master

# Replace demo swagger.json with our own
#sed -i "/http:\/\/petstore\.swagger\.io/v2/c\\/developers" ./public/developers/api/index.html
#sed -i 's#http://petstore.swagger.io/v2/swagger.json#/developers/swagger.json#g' ./public/developers/api/index.html
#sed 's/http:\/\/petstore.swagger.io\/v2/\/developers/g' ./public/developers/api/index.html

# Validator doesn't support https :-(
# https://github.com/swagger-api/validator-badge/issues/22
#sed -i 's#url: url,#url: url, validatorUrl:null,#g' ./public/developers/api/index.html
#sed -i "" "s!url: url,!url: url, validatorUrl:null,!g" ./public/developers/api/index.html

rm -fr ./tmp/swagger-ui-master

if [ -d "$DOCS_INSTALL_PATH" ]; then
  echo "Done with the docs!"
else
  echo "Something went wrong when generating docs..."
  echo "You can try to generate them again by running `npm docs`"
fi

exit 0

#!/bin/bash

# Script to generate self signed certificates for dev purposes
#
# See https://github.com/Trustroots/trustroots/tree/master/docs/SSL-Certificate.md for production certs

CERT_PATH="./scripts/certs"
CERT_FILE="trustroots_org"

CSR_FILE="${CERT_PATH}/${CERT_FILE}_csr.pem"
KEY_FILE="${CERT_PATH}/${CERT_FILE}_key.pem"
CER_FILE="${CERT_PATH}/${CERT_FILE}_cer.pem"

echo "Making sure $CERT_PATH exists..."
mkdir -p "$CERT_PATH"

echo "Generating self-signed certificates..."
openssl genrsa -out "$KEY_FILE" 1024
echo "Done: $KEY_FILE"
openssl req -new -key "$KEY_FILE" -out "$CSR_FILE"
openssl x509 -req -days 9999 -in "$CSR_FILE" -signkey "$KEY_FILE" -out "$CER_FILE"
echo "Done: $CER_FILE"
rm "$CSR_FILE"
chmod 600 "$KEY_FILE" "$CER_FILE"

echo ""
echo "All done!"
echo ""
exit 1

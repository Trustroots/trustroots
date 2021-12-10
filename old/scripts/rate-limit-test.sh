#!/bin/bash

# A script to test rate limiting
# https://lincolnloop.com/blog/rate-limiting-nginx/

#DOMAIN = "https://dev.trustroots.org"

echo ""
echo "Testing rate limiting..."

for i in {0..20}; do
  echo "Attempt $i..."
  (curl -Is https://dev.trustroots.org/api/auth/signin | head -n1 &) 2>/dev/null; 
done

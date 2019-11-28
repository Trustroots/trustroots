#!/bin/bash
#
# This is an example of how you can use curl to test API calls.
# This can be very useful for testing and developing.
#
# e.g.
#    watch ./local-curl.sh 'users?search=trust'
#    ./local-curl.sh 'users?search=yes'|jq


COOKIEJAR=/tmp/cookies.txt

BASEURL=http://localhost:3000/

APICALL=${1:-'users?search=guaka'}


# @todo use $BASEURL
curl -s -c $COOKIEJAR 'http://localhost:3000/api/auth/signin' -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:63.0) Gecko/20100101 Firefox/63.0' -H 'Accept: application/json, text/plain, */'  --compressed -H 'Referer: http://localhost:3000/signin' -H 'Content-Type: application/json;charset=utf-8' -H 'Connection: keep-alive' -H 'DNT: 1' --data '{"username":"guaka","password":"password1234"}' > /dev/null

curl -s -b $COOKIEJAR ${BASEURL}api/$APICALL

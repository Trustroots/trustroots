#!/bin/bash

#
# Test if you can reast host via ipv6 and ipv4.
# Run:
# ./ipv46test.sh
#
# Defaults to "trustroots.org" and test string "<!DOCTYPE html>"
#
# Or to set hostname, run:
# ./ipv46test.sh example.org
#
# Or to set hostname and test string to find, run:
# ./ipv46test.sh example.org "test string"
#

# Options
DEFAULT_HOSTNAME="trustroots.org"
DEFAULT_TEST_STRING="<!DOCTYPE html>"

# Helpers
HOSTNAME=${1:-$DEFAULT_HOSTNAME}
TEST_STRING=${2:-$DEFAULT_TEST_STRING}
IPV4_IP=$(dig ${HOSTNAME} A +short | tail -n1)
IPV6_IP=$(dig ${HOSTNAME} AAAA +short | tail -n1)
RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m' # No Color

print_error() {
  printf "${RED}[ERROR]${NC} $TEST_NAME\n"
}
print_success() {
  printf "${GREEN}[OK]${NC} $TEST_NAME\n"
}


printf "\nTesting access to \"${BOLD}$HOSTNAME${NC}\""
printf "\nLooking for test string \"${BOLD}$TEST_STRING${NC}\"\n"

#
# IPV4
#
printf "\n...via ${BOLD}IPv4${NC}:\n"

# IPV6 host
TEST_NAME="$HOSTNAME"
TEST=$(curl -4 -gsL "$HOSTNAME" --max-time 5 | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

TEST_NAME="www.$HOSTNAME"
TEST=$(curl -4 -gsL "www.$HOSTNAME" --max-time 5 | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

# IPV6 ip
if [ -n "$IPV4_IP" ]; then
  TEST_NAME="https://$IPV4_IP"
  TEST=$(curl -4 -gskL "https://$IPV4_IP" --max-time 5 | head -1 | xargs)
  if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

  TEST_NAME="http://$IPV4_IP"
  TEST=$(curl -4 -gsL "http://$IPV4_IP" --max-time 5 | head -1 | xargs)
  if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

  TEST_NAME="$IPV4_IP"
  TEST=$(curl -4 -gsL "$IPV4_IP" --max-time 5 | head -1 | xargs)
  if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi
else
  TEST_NAME="Could not get IPV4 IP address for hostname."
  print_error
fi


#
# IPV6
#
printf "\n...via ${BOLD}IPv6${NC}:\n"

# IPV6 host
TEST_NAME="$HOSTNAME"
TEST=$(curl -6 -gsL "$HOSTNAME" --max-time 5 | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

TEST_NAME="www.$HOSTNAME"
TEST=$(curl -6 -gsL "www.$HOSTNAME" --max-time 5 | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

# IPV6 ip
if [ -n "$IPV6_IP" ]; then
  TEST_NAME="http://$IPV6_IP"
  TEST=$(curl -6 -gsL "http://[$IPV6_IP]" | head -1 | xargs)
  if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

  TEST_NAME="https://$IPV6_IP"
  TEST=$(curl -6 -gskL "https://[$IPV6_IP]" | head -1 | xargs)
  if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

  TEST_NAME="$IPV6_IP"
  TEST=$(curl -6 -gskL "[$IPV6_IP]" | head -1 | xargs)
  if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi
else
  TEST_NAME="Could not get IPV6 IP address for hostname."
  print_error
fi

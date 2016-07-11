#!/bin/bash

# Modify these variables to your needs
HOSTNAME=trustroots.org
TEST_STRING="<!DOCTYPE html>"


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


printf "\nTesting access to ${BOLD}$HOSTNAME${NC}:\n"

printf "\n...via ${BOLD}IPv6${NC}:\n"

TEST_NAME="$HOSTNAME"
TEST=$(curl -4 -gsL "$HOSTNAME" | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

TEST_NAME="www.$HOSTNAME"
TEST=$(curl -4 -gsL "www.$HOSTNAME" | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

TEST_NAME="https://$IPV4_IP"
TEST=$(curl -4 -gskL "https://$IPV4_IP" | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

TEST_NAME="http://$IPV4_IP"
TEST=$(curl -4 -gsL "http://$IPV4_IP" | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

TEST_NAME="$IPV4_IP"
TEST=$(curl -4 -gsL "$IPV4_IP" | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

printf "\n...via ${BOLD}IPv6${NC}:\n"

TEST_NAME="$HOSTNAME"
TEST=$(curl -6 -gsL "$HOSTNAME" | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

TEST_NAME="www.$HOSTNAME"
TEST=$(curl -6 -gsL "www.$HOSTNAME" | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

TEST_NAME="http://$IPV6_IP"
TEST=$(curl -6 -gsL "http://[$IPV6_IP]" | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

TEST_NAME="https://$IPV6_IP"
TEST=$(curl -6 -gskL "https://[$IPV6_IP]" | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

TEST_NAME="$IPV6_IP"
TEST=$(curl -6 -gskL "[$IPV6_IP]" | head -1 | xargs)
if [ "$TEST" = "$TEST_STRING" ] ; then print_success ; else print_error ; fi

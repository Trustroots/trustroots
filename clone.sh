#!/bin/bash
git clone git@github.com:guaka/bikeshed.git
cd bikeshed/bikeshed
mrt install
mrt --settings settings-test.json

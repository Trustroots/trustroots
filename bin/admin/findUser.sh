#!/bin/bash
#########
#
# This is a simple shell script to help finding users
#
# @guaka uses this to
# - find profiles of new developers on GitHub
# - find profiles of the people behind support queries
#

CMD="mongo --quiet trustroots-dev --eval"


$CMD 'db.users.find({$or: [ 
                     { "username": { $regex: /.*'$1'.*/i }},
		     { "displayName": { $regex: /.*'$1'.*/i }},
		     { "email": { $regex: /.*'$1'.*/i }}		     
            	     ]
                    }
                   ).map (function(u) { return [ u.username, u.email ] })'
